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

import { resolveTxt, type DnsAttempt } from "./doh.js";
import { parseCliArgs } from "./args.js";
import {
  distinctRecordMappings,
  parseRecords,
  DNS_PREFIX,
  type DnstallRecord,
} from "./record.js";
import { parseTarget, validatePackageName, validateVersionRange } from "./validate.js";
import {
  diffPin,
  savePin,
  getPin,
  resetPinStore,
  PIN_FILE,
  type PinChange,
} from "./pin.js";
import {
  detectNpmProject,
  buildInstallPlan,
  resolveNpmRegistry,
  runInstall,
} from "./install.js";
import { c, info, warn, error, success, confirm } from "./ui.js";
import { sanitizeTerminalText } from "./terminal.js";

const NAMESPACE = "npm"; // only npm is wired up in v0

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

function printSummary(r: Resolved, commandDisplay: string, targetDir: string, registry: string): void {
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
  info(`  ${c.dim("into")}      ${sanitizeTerminalText(targetDir)}`);
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
    info(`    ${ch.field}: ${c.red(ch.was)} ${c.dim("→")} ${c.yellow(ch.now)}`);
  }
  info(
    c.dim(
      "    A domain can change hands or be hijacked. Only continue if you\n" +
        "    expected this change.",
    ),
  );
  info("");
}

async function cmdInstall(target: string, opts: { yes: boolean }): Promise<number> {
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

  const project = detectNpmProject();
  if (!project.ok) {
    error(project.error);
    return 1;
  }
  const registryResult = resolveNpmRegistry();
  if (!registryResult.ok) {
    error(registryResult.error);
    return 1;
  }
  const registry = registryResult.registry;

  const outcome = await resolveTarget(target);
  if (!outcome.ok) {
    error(outcome.message);
    if (outcome.hint) info("\n  " + outcome.hint + "\n");
    return 1;
  }
  const r = outcome.resolved;

  const plan = buildInstallPlan(r.record.package, r.version, registry);
  const targetDir = process.cwd();

  printSummary(r, plan.display, targetDir, registry);

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

async function cmdVerify(target: string): Promise<number> {
  const parsed = parseTarget(target);
  if (!parsed.ok) {
    error(parsed.error);
    return 1;
  }
  const { domain, sub } = parsed.value;
  const effectiveDomain = sub ? `${sub}.${domain}` : domain;
  const dnsName = `_${DNS_PREFIX}.${effectiveDomain}`;

  info(`\n  Looking up ${c.cyan(dnsName)} ...\n`);
  const txt = await resolveTxt(DNS_PREFIX, effectiveDomain);

  if (txt.provider) info(c.dim(`  resolver:  ${resolverName(txt.provider)}`));
  info(c.dim(`  outcome:   ${txt.outcome}`));
  printResolverAttempts(txt.attempts);
  info(`  ${dnssecBadge(txt.authenticated)}`);
  info("");

  if (txt.outcome === "provider_exhaustion") {
    error("DNS lookup failed after exhausting every configured resolver.");
    return 1;
  }

  if (txt.outcome === "nxdomain" || txt.outcome === "nodata") {
    error(
      txt.outcome === "nxdomain"
        ? "The requested DNS name does not exist (NXDOMAIN)."
        : "The DNS name exists but has no TXT answer (NODATA).",
    );
    info(
      `\n  To enable it, publish:\n    ${c.dim(`${dnsName}  TXT  "dnstall=pkg:npm/<package>"`)}\n`,
    );
    return 1;
  }

  info(c.dim("  raw TXT records:"));
  for (const rec of txt.records) info(`    ${sanitizeTerminalText(rec)}`);
  info("");

  const records = parseRecords(txt.records);
  if (records.length === 0) {
    warn("TXT records exist, but none are valid domaininstall records.");
    return 1;
  }

  for (const rec of records) {
    const supported = rec.namespace === NAMESPACE;
    info(
      `  ${supported ? c.green("●") : c.yellow("○")} ${c.bold(rec.package)}` +
        `  ${c.dim(`(${rec.namespace}${rec.version ? " @ " + rec.version : ""})`)}` +
        (supported ? "" : c.dim("  — namespace not supported in v0")),
    );
  }

  const supportedMappings = distinctRecordMappings(
    records.filter((record) => record.namespace === NAMESPACE),
  );
  if (supportedMappings.length > 1) {
    info("");
    error("Conflicting supported mappings found; installation would be refused.");
    return 1;
  }
  if (supportedMappings.length === 0) {
    info("");
    warn("No mapping uses the npm namespace supported by this alpha.");
    return 1;
  }
  const supportedRecord = supportedMappings[0]!;
  const packageCheck = validatePackageName(supportedRecord.package);
  if (!packageCheck.ok) {
    error(`The npm mapping contains an invalid package name: ${packageCheck.error}`);
    return 1;
  }
  if (supportedRecord.version) {
    const versionCheck = validateVersionRange(supportedRecord.version);
    if (!versionCheck.ok) {
      error(`The npm mapping contains an invalid version policy: ${versionCheck.error}`);
      return 1;
    }
  }

  const pin = getPin(effectiveDomain);
  info("");
  if (pin) {
    info(c.dim(`  pin: first seen ${pin.firstSeen.slice(0, 10)} → ${pin.package} (${pin.namespace})`));
    info(c.dim(`  pin DNS policy: ${pin.dnsVersion ?? "latest"}`));
    info(c.dim(`  pin registry: ${pin.registry}`));
  } else {
    info(c.dim("  pin: none yet (will be recorded on first install)"));
  }
  info(c.dim(`  pin file: ${PIN_FILE}`));
  info("");
  success("Record looks valid.");
  return 0;
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

  ${c.dim("Run")} ${c.bold("di --help")} ${c.dim("for every command and option.")}
`;

const HELP = `
${c.bold("di")} — install a package by domain name

${c.dim("USAGE")}
  di <domain>[/sub][@version]                resolve, confirm, and install
  di verify <domain>                         diagnose the DNS record (no install)
  di trust reset --all [--force]             back up and reset all TOFU pins
  domaininstall <domain>                     descriptive alias
  dnstall <domain>                           legacy short alias

${c.dim("EXAMPLES")}
  di zuraai.xyz                      install the package zuraai.xyz vouches for
  di stripe.com/react                install the "react" sub-package
  di stripe.com@^18                  override the install version range
  di verify zuraai.xyz               check the record without installing

${c.dim("OPTIONS")}
  -y, --yes        skip the confirmation prompt (ignored if the mapping changed)
  -h, --help       show this help
  -V, --version    show version
  --force          skip the trust-reset prompt (only with trust reset --all)

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
      info("0.0.1");
      return 0;
    case "install":
      return cmdInstall(parsed.command.target, { yes: parsed.command.yes });
    case "verify":
      return cmdVerify(parsed.command.target);
    case "trust_reset":
      return cmdTrustReset(parsed.command.force);
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
