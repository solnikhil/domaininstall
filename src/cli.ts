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

import { resolveTxt } from "./doh.js";
import { parseRecords, DNS_PREFIX, type DnstallRecord } from "./record.js";
import { parseTarget, validatePackageName, validateVersionRange } from "./validate.js";
import { diffPin, savePin, getPin, PIN_FILE, type PinChange } from "./pin.js";
import {
  detectPackageManager,
  buildInstallPlan,
  runInstall,
  registryFor,
} from "./install.js";
import { c, info, warn, error, success, confirm } from "./ui.js";

const NAMESPACE = "npm"; // only npm is wired up in v0

interface Resolved {
  domain: string;
  dnsName: string;
  authenticated: boolean;
  record: DnstallRecord;
  version?: string; // effective version after precedence
  registry: string;
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

  if (txt.status === 3 || txt.records.length === 0) {
    return {
      ok: false,
      message: `No domaininstall record found at ${c.cyan(dnsName)}`,
      hint: `The domain owner needs to publish a TXT record, e.g.\n    ${c.dim(`${dnsName}  TXT  "dnstall=pkg:npm/<package>"`)}`,
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

  const record = npmRecords[0]!; // sorted upstream; first wins deterministically

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
    registry: registryFor(record.namespace),
  };
  if (effectiveVersion) resolved.version = effectiveVersion;
  return { ok: true, resolved };
}

function dnssecBadge(authenticated: boolean): string {
  return authenticated ? c.green("DNSSEC ✓") : c.gray("DNSSEC —");
}

function printSummary(r: Resolved, commandDisplay: string, targetDir: string): void {
  info("");
  info(`  ${c.dim("domain")}    ${c.bold(r.domain)}   ${dnssecBadge(r.authenticated)}`);
  info(`  ${c.dim("package")}   ${c.bold(r.record.package)}`);
  info(`  ${c.dim("version")}   ${r.version ? c.bold(r.version) : c.dim("latest")}`);
  info(`  ${c.dim("registry")}  ${r.registry}`);
  info(`  ${c.dim("into")}      ${targetDir}`);
  if (r.record.metadata.repo) info(`  ${c.dim("repo")}      ${r.record.metadata.repo}`);
  info("");
  info(`  ${c.dim("will run")}  ${c.cyan(commandDisplay)}`);
  info("");
}

function printPinWarning(changes: PinChange[]): void {
  warn("This domain previously mapped to a DIFFERENT package.");
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
  const outcome = await resolveTarget(target);
  if (!outcome.ok) {
    error(outcome.message);
    if (outcome.hint) info("\n  " + outcome.hint + "\n");
    return 1;
  }
  const r = outcome.resolved;

  const project = detectPackageManager();
  const plan = buildInstallPlan(project.pm, r.record.package, r.version);
  const targetDir = process.cwd();

  printSummary(r, plan.display, targetDir);

  // TOFU pin check — the domain-hijack defense.
  const { existing, changes } = diffPin(r.domain, {
    namespace: r.record.namespace,
    package: r.record.package,
    registry: r.registry,
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
      registry: r.registry,
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

  if (txt.provider) info(c.dim(`  resolver:  ${new URL(txt.provider).host}`));
  info(c.dim(`  status:    ${txt.status === 0 ? "NOERROR" : txt.status === 3 ? "NXDOMAIN (no record)" : txt.status}`));
  info(`  ${dnssecBadge(txt.authenticated)}`);
  info("");

  if (txt.records.length === 0) {
    error("No TXT records found — this domain hasn't set up domaininstall.");
    info(
      `\n  To enable it, publish:\n    ${c.dim(`${dnsName}  TXT  "dnstall=pkg:npm/<package>"`)}\n`,
    );
    return 1;
  }

  info(c.dim("  raw TXT records:"));
  for (const rec of txt.records) info(`    ${rec}`);
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

  const pin = getPin(effectiveDomain);
  info("");
  if (pin) {
    info(c.dim(`  pin: first seen ${pin.firstSeen.slice(0, 10)} → ${pin.package} (${pin.namespace})`));
  } else {
    info(c.dim("  pin: none yet (will be recorded on first install)"));
  }
  info(c.dim(`  pin file: ${PIN_FILE}`));
  info("");
  success("Record looks valid.");
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

  ${c.bold("3")}  Confirm to install with your project's package manager
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
  domaininstall <domain>                     descriptive alias
  dnstall <domain>                           legacy short alias

${c.dim("EXAMPLES")}
  di zuraai.xyz                      install the package zuraai.xyz vouches for
  di stripe.com/react                install the "react" sub-package
  di stripe.com@^18                  pin a version range
  di verify zuraai.xyz               check the record without installing

${c.dim("OPTIONS")}
  -y, --yes        skip the confirmation prompt (ignored if the mapping changed)
  -h, --help       show this help
  -V, --version    show version

${c.dim("HOW IT WORKS")}
  The domain owner publishes a TXT record:
    _dnstall.<domain>  TXT  "dnstall=pkg:npm/<package>"
  domaininstall resolves it over DNS-over-HTTPS, shows you exactly what will be
  installed, remembers the mapping (trust-on-first-use), and hands off to your
  package manager. It never executes anything from the DNS record.
`;

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith("-")));
  const positionals = args.filter((a) => !a.startsWith("-"));

  if (flags.has("-V") || flags.has("--version")) {
    info("0.0.1");
    return 0;
  }
  if (flags.has("-h") || flags.has("--help")) {
    info(HELP);
    return 0;
  }
  if (positionals.length === 0) {
    info(GET_STARTED);
    return 0;
  }

  const [first, second] = positionals;
  if (first === "verify") {
    if (!second) {
      error("verify needs a domain, e.g. `di verify zuraai.xyz`");
      return 1;
    }
    return cmdVerify(second);
  }

  const yes = flags.has("-y") || flags.has("--yes");
  return cmdInstall(first!, { yes });
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
