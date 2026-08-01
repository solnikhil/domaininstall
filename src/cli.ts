#!/usr/bin/env node
/**
 * domaininstall — install a package by domain name.
 *
 * Usage:
 *   di <domain>[/sub][@version]                resolve + confirm + install
 *   domaininstall <domain>                     descriptive alias
 *   dnstall <domain>                           legacy short alias
 *   di verify <domain>                         diagnose the record, no install
 */

import { createRequire } from "node:module";

import { resolveTxt, type DnsAttempt } from "./doh.js";
import { parseCliArgs } from "./args.js";
import {
  distinctRecordMappings,
  parseRecords,
  DNS_PREFIX,
  type DnstallRecord,
} from "./record.js";
import { parseTarget, validateDomain, validatePackageName, validateVersionRange } from "./validate.js";
import {
  diffPin,
  forgetPin,
  listPins,
  savePin,
  getPin,
  resetPinStore,
  PIN_FILE,
  type PinChange,
} from "./pin.js";
import { buildRecord, readmeSnippet, REGISTRAR_NOTES } from "./setup.js";
import {
  detectNpmProject,
  buildInstallPlan,
  npmScopeOf,
  resolveEffectiveRegistry,
  resolveNpmGlobalPrefix,
  resolveNpmRegistry,
  runInstall,
} from "./install.js";
import { c, ce, info, detail, warn, error, success, confirm } from "./ui.js";
import { sanitizeTerminalText } from "./terminal.js";

const NAMESPACE = "npm"; // only npm is wired up in v0

/** Single source of truth for the CLI version: the published manifest. */
const VERSION = (
  createRequire(import.meta.url)("../package.json") as { version: string }
).version;

interface Resolved {
  domain: string;
  dnsName: string;
  authenticated: boolean;
  record: DnstallRecord;
  version?: string; // effective version after precedence
  cliVersion?: string;
}

type ResolveOutcome =
  | { ok: true; resolved: Resolved }
  | { ok: false; message: string; hint?: string };

async function resolveTarget(target: string): Promise<ResolveOutcome> {
  const parsed = parseTarget(target);
  if (!parsed.ok) return { ok: false, message: parsed.error };

  const { domain, sub, version: cliVersion } = parsed.value;
  const effectiveDomain = sub ? `${sub}.${domain}` : domain;
  const dnsName = `_${DNS_PREFIX}.${effectiveDomain}`;

  const txt = await resolveTxt(DNS_PREFIX, effectiveDomain);

  if (txt.outcome === "nxdomain" || txt.outcome === "nodata") {
    return {
      ok: false,
      message:
        txt.outcome === "nxdomain"
          ? `The DNS name ${dnsName} does not exist (NXDOMAIN).`
          : `No TXT record exists at ${dnsName} (NODATA).`,
      hint: `The domain owner needs to publish a TXT record, e.g.\n    ${c.dim(`${dnsName}  TXT  "dnstall=pkg:npm/<package>"`)}`,
    };
  }
  if (txt.outcome === "provider_exhaustion") {
    return {
      ok: false,
      message: "DNS lookup failed: all configured resolvers returned transient, refused, or invalid responses.",
      hint: `Run ${c.bold(`di verify ${effectiveDomain}`)} for per-resolver diagnostics.`,
    };
  }

  const npmRecords = parseRecords(txt.records, NAMESPACE);
  if (npmRecords.length === 0) {
    const anyRecords = parseRecords(txt.records);
    if (anyRecords.length > 0) {
      return {
        ok: false,
        message: `Found a record for namespace "${anyRecords[0]!.namespace}", which isn't supported yet (v0 = npm only).`,
      };
    }
    return { ok: false, message: `A TXT record exists at ${dnsName} but none are valid domaininstall records.` };
  }

  const mappings = distinctRecordMappings(npmRecords);
  if (mappings.length > 1) {
    return {
      ok: false,
      message: `Conflicting domaininstall mappings found at ${dnsName}; refusing to choose one.`,
    };
  }
  const record = mappings[0]!;

  // Version precedence: CLI arg > record version > latest
  const effectiveVersion = cliVersion ?? record.version;

  // Validate everything derived from DNS before it goes anywhere near spawn.
  const nameCheck = validatePackageName(record.package);
  if (!nameCheck.ok) return { ok: false, message: `Record contains an invalid package name: ${nameCheck.error}` };
  if (effectiveVersion) {
    const verCheck = validateVersionRange(effectiveVersion);
    if (!verCheck.ok) return { ok: false, message: verCheck.error };
  }

  const resolved: Resolved = {
    domain: effectiveDomain,
    dnsName,
    authenticated: txt.authenticated,
    record,
  };
  if (effectiveVersion) resolved.version = effectiveVersion;
  if (cliVersion) resolved.cliVersion = cliVersion;
  return { ok: true, resolved };
}

function dnssecBadge(authenticated: boolean): string {
  return authenticated ? c.green("DNSSEC ✓") : c.gray("DNSSEC —");
}

function resolverName(provider: string): string {
  try {
    return new URL(provider).host;
  } catch {
    return provider;
  }
}

function printResolverAttempts(attempts: DnsAttempt[]): void {
  if (attempts.length === 0) return;
  info(c.dim("  attempts:"));
  for (const attempt of attempts) {
    const status = attempt.status === undefined ? "" : ` (status ${attempt.status})`;
    info(c.dim(`    ${resolverName(attempt.provider)}: ${attempt.outcome}${status}`));
  }
}

function printSummary(r: Resolved, commandDisplay: string, target: string, registry: string): void {
  info("");
  info(`  ${c.dim("domain")}    ${c.bold(r.domain)}   ${dnssecBadge(r.authenticated)}`);
  info(`  ${c.dim("package")}   ${c.bold(r.record.package)}`);
  info(
    `  ${c.dim("version")}   ${r.version ? c.bold(r.version) : c.dim("latest")}` +
      (r.cliVersion ? c.dim("  (CLI override)") : ""),
  );
  info(`  ${c.dim("DNS policy")} ${r.record.version ? c.bold(r.record.version) : c.dim("latest")}`);
  info(`  ${c.dim("registry")}  ${registry}`);
  info(`  ${c.dim("scripts")}   ${c.bold("disabled")}`);
  info(`  ${c.dim("into")}      ${sanitizeTerminalText(target)}`);
  if (r.record.metadata.repo) {
    info(`  ${c.dim("repo")}      ${sanitizeTerminalText(r.record.metadata.repo)}`);
  }
  info("");
  info(`  ${c.dim("will run")}  ${c.cyan(commandDisplay)}`);
  info("");
}

function printPinWarning(changes: PinChange[]): void {
  warn("This domain's previously trusted mapping or policy has changed.");
  for (const ch of changes) {
    detail(`    ${ch.field}: ${ce.red(ch.was)} ${ce.dim("→")} ${ce.yellow(ch.now)}`);
  }
  detail(ce.dim("    A domain can change hands or be hijacked. Only continue if you"));
  detail(ce.dim("    expected this change."));
  detail("");
}

/** Where the install will land, for the pre-install preview. */
function installTargetDescription(global: boolean): string {
  if (!global) return process.cwd();
  const prefix = resolveNpmGlobalPrefix();
  return prefix.ok ? `${prefix.value} (global)` : "npm's global prefix (global)";
}

async function cmdInstall(target: string, opts: { yes: boolean; global: boolean }): Promise<number> {
  // Reject malformed targets and unsafe/corrupt trust state before invoking npm
  // even for the read-only registry lookup.
  const targetCheck = parseTarget(target);
  if (!targetCheck.ok) {
    error(targetCheck.error);
    return 1;
  }
  const checkedDomain = targetCheck.value.sub
    ? `${targetCheck.value.sub}.${targetCheck.value.domain}`
    : targetCheck.value.domain;
  getPin(checkedDomain);

  // A global install ignores the current directory, so only a project-scoped
  // install has to agree with the package manager this project declares.
  if (!opts.global) {
    const project = detectNpmProject();
    if (!project.ok) {
      error(project.error);
      return 1;
    }
  }
  const defaultRegistry = resolveNpmRegistry();
  if (!defaultRegistry.ok) {
    error(defaultRegistry.error);
    return 1;
  }

  const outcome = await resolveTarget(target);
  if (!outcome.ok) {
    error(outcome.message);
    if (outcome.hint) info("\n  " + outcome.hint + "\n");
    return 1;
  }
  const r = outcome.resolved;

  // Re-resolve now that the package name is known: npm gives a scope-specific
  // registry precedence over the default one, and the pinned/displayed registry
  // must be the registry npm will actually use.
  const registryResult = resolveEffectiveRegistry(
    r.record.package,
    process.cwd(),
    defaultRegistry.registry,
  );
  if (!registryResult.ok) {
    error(registryResult.error);
    return 1;
  }
  const registry = registryResult.registry;

  const plan = buildInstallPlan(r.record.package, r.version, registry, { global: opts.global });

  printSummary(r, plan.display, installTargetDescription(opts.global), registry);

  // TOFU pin check — the domain-hijack defense.
  const { existing, changes } = diffPin(r.domain, {
    namespace: r.record.namespace,
    package: r.record.package,
    registry,
    dnsVersion: r.record.version ?? null,
  });

  let requireInteractive = false;
  if (changes.length > 0) {
    printPinWarning(changes);
    requireInteractive = true; // never auto-approve a changed mapping
  } else if (existing) {
    info(c.dim(`  ✓ matches the pin first seen ${existing.firstSeen.slice(0, 10)}`));
    info("");
  }

  if (opts.yes && !requireInteractive) {
    info(c.dim("  --yes: skipping confirmation"));
  } else {
    if (opts.yes && requireInteractive) warn("Ignoring --yes because the mapping changed; confirm manually.");
    const proceed = await confirm(`Install ${c.bold(plan.spec)} from ${c.bold(r.domain)}?`);
    if (!proceed) {
      info(c.dim("Aborted."));
      return 130;
    }
  }

  const code = await runInstall(plan);
  if (code === 0) {
    savePin(r.domain, {
      namespace: r.record.namespace,
      package: r.record.package,
      registry,
      dnsVersion: r.record.version ?? null,
    });
    success(`Installed ${plan.spec} from ${r.domain}`);
  } else {
    error(`Install failed (${plan.pm} exited with code ${code}).`);
  }
  return code;
}

/**
 * Machine-readable `verify` output.
 *
 * `schema` is versioned so CI, bots, and agents can depend on this shape and
 * detect a change rather than silently misreading it.
 */
interface VerifyJson {
  schema: 1;
  domain: string | null;
  dnsName: string | null;
  resolver: string | null;
  outcome: string | null;
  dnssecAuthenticated: boolean;
  attempts: { resolver: string; outcome: string; status?: number }[];
  records: string[];
  mapping: {
    namespace: string;
    package: string;
    version: string | null;
    metadata: Record<string, string>;
  } | null;
  registry: string | null;
  pin: {
    namespace: string;
    package: string;
    registry: string;
    dnsVersion: string | null;
    firstSeen: string;
    lastSeen: string;
  } | null;
  pinFile: string;
  valid: boolean;
  error: string | null;
}

async function cmdVerify(target: string, json: boolean): Promise<number> {
  const payload: VerifyJson = {
    schema: 1,
    domain: null,
    dnsName: null,
    resolver: null,
    outcome: null,
    dnssecAuthenticated: false,
    attempts: [],
    records: [],
    mapping: null,
    registry: null,
    pin: null,
    pinFile: PIN_FILE,
    valid: false,
    error: null,
  };

  // In JSON mode stdout carries the payload and nothing else, so every human
  // line is suppressed. Diagnostics stay on stderr either way.
  const say = (msg: string): void => {
    if (!json) info(msg);
  };
  const finish = (code: number): number => {
    if (json) info(JSON.stringify(payload, null, 2));
    return code;
  };
  const refuse = (message: string, code = 1): number => {
    payload.error = message;
    payload.valid = false;
    error(message);
    return finish(code);
  };

  const parsed = parseTarget(target);
  if (!parsed.ok) {
    payload.error = parsed.error;
    error(parsed.error);
    return finish(1);
  }
  const { domain, sub } = parsed.value;
  const effectiveDomain = sub ? `${sub}.${domain}` : domain;
  const dnsName = `_${DNS_PREFIX}.${effectiveDomain}`;
  payload.domain = effectiveDomain;
  payload.dnsName = dnsName;

  say(`\n  Looking up ${c.cyan(dnsName)} ...\n`);
  const txt = await resolveTxt(DNS_PREFIX, effectiveDomain);

  payload.outcome = txt.outcome;
  payload.dnssecAuthenticated = txt.authenticated;
  payload.records = [...txt.records];
  if (txt.provider) payload.resolver = resolverName(txt.provider);
  payload.attempts = txt.attempts.map((attempt) => {
    const entry: { resolver: string; outcome: string; status?: number } = {
      resolver: resolverName(attempt.provider),
      outcome: attempt.outcome,
    };
    if (attempt.status !== undefined) entry.status = attempt.status;
    return entry;
  });

  if (txt.provider) say(c.dim(`  resolver:  ${resolverName(txt.provider)}`));
  say(c.dim(`  outcome:   ${txt.outcome}`));
  if (!json) printResolverAttempts(txt.attempts);
  say(`  ${dnssecBadge(txt.authenticated)}`);
  say("");

  if (txt.outcome === "provider_exhaustion") {
    return refuse("DNS lookup failed after exhausting every configured resolver.");
  }

  if (txt.outcome === "nxdomain" || txt.outcome === "nodata") {
    const message =
      txt.outcome === "nxdomain"
        ? "The requested DNS name does not exist (NXDOMAIN)."
        : "The DNS name exists but has no TXT answer (NODATA).";
    payload.error = message;
    error(message);
    say(
      `\n  To enable it, publish:\n    ${c.dim(`${dnsName}  TXT  "dnstall=pkg:npm/<package>"`)}\n`,
    );
    if (!json) {
      info(`  Or generate it: ${c.bold(`di setup ${effectiveDomain} <package>`)}\n`);
    }
    return finish(1);
  }

  say(c.dim("  raw TXT records:"));
  for (const rec of txt.records) say(`    ${sanitizeTerminalText(rec)}`);
  say("");

  const records = parseRecords(txt.records);
  if (records.length === 0) {
    payload.error = "TXT records exist, but none are valid domaininstall records.";
    warn("TXT records exist, but none are valid domaininstall records.");
    return finish(1);
  }

  if (!json) {
    for (const rec of records) {
      const supported = rec.namespace === NAMESPACE;
      info(
        `  ${supported ? c.green("●") : c.yellow("○")} ${c.bold(rec.package)}` +
          `  ${c.dim(`(${rec.namespace}${rec.version ? " @ " + rec.version : ""})`)}` +
          (supported ? "" : c.dim("  — namespace not supported in v0")),
      );
    }
  }

  const supportedMappings = distinctRecordMappings(
    records.filter((record) => record.namespace === NAMESPACE),
  );
  if (supportedMappings.length > 1) {
    say("");
    return refuse("Conflicting supported mappings found; installation would be refused.");
  }
  if (supportedMappings.length === 0) {
    say("");
    payload.error = "No mapping uses the npm namespace supported by this alpha.";
    warn("No mapping uses the npm namespace supported by this alpha.");
    return finish(1);
  }
  const supportedRecord = supportedMappings[0]!;
  const packageCheck = validatePackageName(supportedRecord.package);
  if (!packageCheck.ok) {
    return refuse(`The npm mapping contains an invalid package name: ${packageCheck.error}`);
  }
  if (supportedRecord.version) {
    const versionCheck = validateVersionRange(supportedRecord.version);
    if (!versionCheck.ok) {
      return refuse(`The npm mapping contains an invalid version policy: ${versionCheck.error}`);
    }
  }

  payload.mapping = {
    namespace: supportedRecord.namespace,
    package: supportedRecord.package,
    version: supportedRecord.version ?? null,
    metadata: { ...supportedRecord.metadata },
  };

  // A scoped package is the one case where local npm configuration can send the
  // install somewhere other than the default registry, so say so before install.
  if (npmScopeOf(supportedRecord.package)) {
    const effective = resolveEffectiveRegistry(supportedRecord.package);
    if (effective.ok) {
      payload.registry = effective.registry;
      say(c.dim(`  registry for this package: ${effective.registry}`));
    } else {
      say("");
      payload.error = effective.error;
      warn(effective.error);
    }
  }

  const pin = getPin(effectiveDomain);
  if (pin) {
    payload.pin = {
      namespace: pin.namespace,
      package: pin.package,
      registry: pin.registry,
      dnsVersion: pin.dnsVersion,
      firstSeen: pin.firstSeen,
      lastSeen: pin.lastSeen,
    };
  }
  say("");
  if (pin) {
    say(c.dim(`  pin: first seen ${pin.firstSeen.slice(0, 10)} → ${pin.package} (${pin.namespace})`));
    say(c.dim(`  pin DNS policy: ${pin.dnsVersion ?? "latest"}`));
    say(c.dim(`  pin registry: ${pin.registry}`));
  } else {
    say(c.dim("  pin: none yet (will be recorded on first install)"));
  }
  say(c.dim(`  pin file: ${PIN_FILE}`));
  say("");

  payload.valid = true;
  if (!json) success("Record looks valid.");
  return finish(0);
}

async function cmdTrustReset(force: boolean): Promise<number> {
  warn("This removes every remembered domain mapping and resets trust-on-first-use state.");
  if (!force) {
    const proceed = await confirm("Back up and reset all domaininstall trust pins?");
    if (!proceed) {
      info(c.dim("Aborted."));
      return 130;
    }
  }
  const backup = resetPinStore();
  if (backup) info(c.dim(`  previous trust state: ${backup}`));
  success("Trust state reset. Every domain will be treated as a new first use.");
  return 0;
}

/** Show every remembered mapping, so a changed pin can be inspected in context. */
function cmdTrustList(json: boolean): number {
  const pins = listPins();

  if (json) {
    info(
      JSON.stringify(
        {
          schema: 1,
          pinFile: PIN_FILE,
          pins: pins.map((entry) => ({ domain: entry.domain, ...entry.pin })),
        },
        null,
        2,
      ),
    );
    return 0;
  }

  if (pins.length === 0) {
    info("");
    info(c.dim("  No domains are pinned yet. The first install of a domain records one."));
    info(c.dim(`  pin file: ${PIN_FILE}`));
    info("");
    return 0;
  }

  info("");
  for (const { domain, pin } of pins) {
    info(`  ${c.bold(sanitizeTerminalText(domain))}`);
    info(`    ${c.dim("package")}     ${sanitizeTerminalText(pin.package)} ${c.dim(`(${pin.namespace})`)}`);
    info(`    ${c.dim("DNS policy")}  ${pin.dnsVersion ?? c.dim("latest")}`);
    info(`    ${c.dim("registry")}    ${sanitizeTerminalText(pin.registry)}`);
    info(`    ${c.dim("first seen")}  ${pin.firstSeen.slice(0, 10)}`);
    info("");
  }
  info(c.dim(`  ${pins.length} pinned domain${pins.length === 1 ? "" : "s"} in ${PIN_FILE}`));
  info(c.dim(`  Forget one with ${c.bold("di trust forget <domain>")}`));
  info("");
  return 0;
}

/**
 * Forget one domain instead of every domain.
 *
 * Without this, the only escape from an unexpected mapping change is
 * `trust reset --all`, which discards trust history for every other domain too.
 */
function cmdTrustForget(domain: string): number {
  const parsed = validateDomain(domain);
  if (!parsed.ok) {
    error(parsed.error);
    return 1;
  }

  const removed = forgetPin(parsed.value);
  if (!removed) {
    warn(`No pin exists for ${parsed.value}; nothing to forget.`);
    return 1;
  }
  success(`Forgot the pin for ${parsed.value}.`);
  info(c.dim("  The next install of this domain is treated as a new first use."));
  return 0;
}

/** Generate the DNS record a publisher has to create, with registrar guidance. */
function cmdSetup(target: string, packageInput: string, json: boolean): number {
  const parsed = parseTarget(target);
  if (!parsed.ok) {
    error(parsed.error);
    return 1;
  }
  if (parsed.value.version) {
    error("Put the version range on the package, not the domain: di setup example.com pkg@^2");
    return 1;
  }

  const built = buildRecord(parsed.value.domain, packageInput, parsed.value.sub);
  if (!built.ok) {
    error(built.error);
    return 1;
  }
  const record = built.value;
  const verifyDomain = parsed.value.sub
    ? `${parsed.value.domain}/${parsed.value.sub}`
    : parsed.value.domain;

  const snippet = readmeSnippet(parsed.value.domain, packageInput);

  if (json) {
    info(
      JSON.stringify(
        {
          schema: 1,
          domain: parsed.value.domain,
          record: {
            name: record.name,
            host: record.host,
            type: record.type,
            value: record.value,
            quotedValue: record.quotedValue,
            zoneLine: record.zoneLine,
          },
          verifyCommand: `di verify ${verifyDomain}`,
          registrars: REGISTRAR_NOTES,
          readme: snippet.ok ? snippet.value : null,
        },
        null,
        2,
      ),
    );
    return 0;
  }

  info("");
  info(`  Publish this DNS record on ${c.bold(sanitizeTerminalText(parsed.value.domain))}:`);
  info("");
  info(`  ${c.dim("type")}   ${c.bold(record.type)}`);
  info(`  ${c.dim("name")}   ${c.bold(sanitizeTerminalText(record.name))}`);
  info(`  ${c.dim("value")}  ${c.bold(sanitizeTerminalText(record.quotedValue))}`);
  info("");
  info(c.dim("  Most registrar forms want only the host part in the name field:"));
  info(`    ${c.cyan(sanitizeTerminalText(record.host))}`);
  info("");
  info(c.dim("  Editing a zone file directly:"));
  info(`    ${c.dim(sanitizeTerminalText(record.zoneLine))}`);
  info("");
  info(`  ${c.cyan("WHERE TO PUT IT")}`);
  info("");
  for (const entry of REGISTRAR_NOTES) {
    info(`  ${c.bold(entry.registrar)}`);
    info(`    ${c.dim(entry.note)}`);
  }
  info("");
  info(`  ${c.cyan("THEN CONFIRM IT")}`);
  info("");
  info(`  DNS changes take a few minutes to propagate. When it has, run:`);
  info(`    ${c.dim("$")} ${c.cyan(`di verify ${verifyDomain}`)}`);
  info("");
  info(c.dim("  Until it propagates, verify reports NODATA or NXDOMAIN. That is expected;"));
  info(c.dim("  wait a minute and run it again rather than editing the record."));
  info("");
  if (snippet.ok) {
    info(`  ${c.cyan("TELL YOUR USERS")}`);
    info("");
    info(c.dim("  Paste this into your README:"));
    info("");
    for (const line of snippet.value.split("\n")) info(`    ${line}`);
  }
  return 0;
}

const GET_STARTED = `
${c.bold("di")} — install packages by domain name

  A domain tells ${c.bold("di")} which package it vouches for.
  You see the exact install command before anything runs.

${c.cyan("GET STARTED")}

  ${c.bold("1")}  Check the domain's package mapping
     ${c.dim("$")} ${c.cyan("di verify zuraai.xyz")}

  ${c.bold("2")}  Preview the package and install command
     ${c.dim("$")} ${c.cyan("di zuraai.xyz")}

  ${c.bold("3")}  Confirm the npm install (dependency scripts stay disabled)
     ${c.dim("domain  →  DNS record  →  package preview  →  install")}

${c.cyan("OTHER WAYS TO USE IT")}

  ${c.cyan("di stripe.com/react")}    use a domain sub-package
  ${c.cyan("di stripe.com@^18")}      request a version range
  ${c.cyan("di stripe.com -g")}       install globally, not into this project

  ${c.dim("Run")} ${c.bold("di --help")} ${c.dim("for every command and option.")}
`;

const HELP = `
${c.bold("di")} — install a package by domain name

${c.dim("USAGE")}
  di <domain>[/sub][@version] [-g]           resolve, confirm, and install
  di verify <domain> [--json]                diagnose the DNS record (no install)
  di setup <domain> <package>[@range]        generate the TXT record to publish
  di trust list [--json]                     show every remembered mapping
  di trust forget <domain>                   forget one domain's mapping
  di trust reset --all [--force]             back up and reset all TOFU pins
  domaininstall <domain>                     descriptive alias
  dnstall <domain>                           legacy short alias

${c.dim("EXAMPLES")}
  di zuraai.xyz                      install the package zuraai.xyz vouches for
  di stripe.com/react                install the "react" sub-package
  di stripe.com@^18                  override the install version range
  di stripe.com --global             install globally instead of into this project
  di verify zuraai.xyz               check the record without installing
  di verify zuraai.xyz --json        the same check as machine-readable JSON
  di setup example.com my-package    print the record a publisher must publish

${c.dim("OPTIONS")}
  -y, --yes        skip the confirmation prompt (ignored if the mapping changed)
  -g, --global     install globally (npm install --global)
  --json           machine-readable output (verify, setup, trust list)
  -h, --help       show this help
  -V, --version    show version
  --force          skip the trust-reset prompt (only with trust reset --all)

${c.dim("PACKAGE MANAGERS")}
  Project installs support npm only for now. A global install (-g) works in any
  project, including pnpm, Yarn, and Bun ones, because it does not touch the
  project directory.

${c.dim("HOW IT WORKS")}
  The domain owner publishes a TXT record:
    _dnstall.<domain>  TXT  "dnstall=pkg:npm/<package>"
  domaininstall resolves it over DNS-over-HTTPS, shows you exactly what will be
  installed, remembers the mapping (trust-on-first-use), and hands off to your
  npm with lifecycle scripts disabled. It never executes text from the DNS record.
`;

async function main(): Promise<number> {
  const parsed = parseCliArgs(process.argv.slice(2));
  if (!parsed.ok) {
    error(parsed.error);
    return 1;
  }

  switch (parsed.command.kind) {
    case "get_started":
      info(GET_STARTED);
      return 0;
    case "help":
      info(HELP);
      return 0;
    case "version":
      info(VERSION);
      return 0;
    case "install":
      return cmdInstall(parsed.command.target, {
        yes: parsed.command.yes,
        global: parsed.command.global,
      });
    case "verify":
      return cmdVerify(parsed.command.target, parsed.command.json);
    case "setup":
      return cmdSetup(parsed.command.target, parsed.command.package, parsed.command.json);
    case "trust_reset":
      return cmdTrustReset(parsed.command.force);
    case "trust_list":
      return cmdTrustList(parsed.command.json);
    case "trust_forget":
      return cmdTrustForget(parsed.command.domain);
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
