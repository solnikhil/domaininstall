/**
 * Deterministic unit/security suite. It uses local fixtures and mocked DNS
 * providers only; live DNS and install checks live in scripts/e2e.ts.
 */
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { spawn, spawnSync } from "node:child_process";

import { resolveTxt } from "../dist/doh.js";
import { parseCliArgs } from "../dist/args.js";
import { distinctRecordMappings, parseRecord, parseRecords } from "../dist/record.js";
import { validatePackageName, parseTarget, validateDomain } from "../dist/validate.js";
import { buildInstallPlan, detectNpmProject, resolveNpmRegistry } from "../dist/install.js";
import { sanitizeTerminalText } from "../dist/terminal.js";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean): void {
  if (cond) {
    pass++;
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
  } else {
    fail++;
    console.log(`  \x1b[31m✖ ${name}\x1b[0m`);
  }
}

async function main() {
  const state = mkdtempSync(join(tmpdir(), "dnstall-state-"));
  process.env.DOMAININSTALL_STATE_DIR = state;
  const { diffPin, getPin, resetPinStore, savePin } = await import("../dist/pin.js");

  console.log("\n1. Record parsing (purl + legacy)");
  const p1 = parseRecord("dnstall=pkg:npm/stripe");
  check("purl: plain npm package", p1?.namespace === "npm" && p1?.package === "stripe");
  const p2 = parseRecord("dnstall=pkg:npm/stripe@^18");
  check("purl: package with version range", p2?.package === "stripe" && p2?.version === "^18");
  const p3 = parseRecord("dnstall=pkg:npm/%40stripe/react-stripe-js@^2 repo=https://github.com/stripe/x");
  check(
    "purl: encoded scope + version + metadata",
    p3?.package === "@stripe/react-stripe-js" && p3?.version === "^2" && p3?.metadata.repo === "https://github.com/stripe/x",
  );
  check("purl: drops qualifiers/subpath", parseRecord("dnstall=pkg:npm/foo@1.2?arch=x64#sub")?.package === "foo");
  const r1 = parseRecord("dnstall=/npm/stripe@^18");
  check("legacy: /npm/ form still works", r1?.namespace === "npm" && r1?.package === "stripe" && r1?.version === "^18");
  const r3 = parseRecord("dnstall=/npm/@stripe/react-stripe-js@^2");
  check("legacy: scoped package", r3?.package === "@stripe/react-stripe-js" && r3?.version === "^2");
  check("ignores foreign records (dnslink)", parseRecord("dnslink=/ipfs/abc") === null);
  check("namespace filter", parseRecords(["dnstall=pkg:npm/a", "dnstall=pkg:pypi/b"], "npm").length === 1);
  const duplicateMappings = distinctRecordMappings(
    parseRecords(["dnstall=pkg:npm/a repo=https://one.example", "dnstall=pkg:npm/a repo=https://two.example"], "npm"),
  );
  check("identical mappings are not ambiguous", duplicateMappings.length === 1);
  const conflictingMappings = distinctRecordMappings(
    parseRecords(["dnstall=pkg:npm/a@1", "dnstall=pkg:npm/a@2"], "npm"),
  );
  check("distinct version policies are ambiguous", conflictingMappings.length === 2);

  console.log("\n2. Input validation (security)");
  check("rejects flag-smuggling package name", !validatePackageName("--registry=evil").ok);
  check("accepts normal package name", validatePackageName("stripe").ok);
  check("rejects shell metachars in domain", !validateDomain("evil;rm -rf").ok);
  const t = parseTarget("stripe.com/react@5");
  check("parses domain/sub@version", t.ok && t.value.domain === "stripe.com" && t.value.sub === "react" && t.value.version === "5");
  check("rejects unknown CLI flags", !parseCliArgs(["example.com", "--registry=evil"]).ok);
  check("rejects surplus CLI positionals", !parseCliArgs(["example.com", "extra.example"]).ok);
  check("rejects conflicting CLI modes", !parseCliArgs(["example.com", "--help"]).ok);
  check("rejects unsupported -- separator", !parseCliArgs(["example.com", "--"]).ok);
  check("accepts one explicit install confirmation flag", parseCliArgs(["example.com", "--yes"]).ok);

  console.log("\n3. Terminal output sanitization");
  const ansi = sanitizeTerminalText("safe\x1b[31mred\x1b[0m");
  check("escapes ANSI CSI sequences", ansi === "safe\\x1b[31mred\\x1b[0m" && !ansi.includes("\x1b"));
  const osc = sanitizeTerminalText("\x1b]8;;https://evil.example\x07click\x1b]8;;\x07");
  check("escapes OSC hyperlinks and terminators", !osc.includes("\x1b") && !osc.includes("\x07"));
  const controls = sanitizeTerminalText("first\nsecond\r\t\0");
  check("escapes newline and control characters", controls === "first\\nsecond\\r\\t\\u{0000}");
  const bidi = sanitizeTerminalText(`safe${String.fromCodePoint(0x202e)}txt${String.fromCodePoint(0x2066)}`);
  check("escapes bidirectional controls", bidi === "safe\\u{202e}txt\\u{2066}");

  console.log("\n4. TOFU pin");
  const testDomain = "smoke-test.example";
  savePin(testDomain, {
    namespace: "npm",
    package: "good-pkg",
    registry: "https://registry.npmjs.org/",
    dnsVersion: null,
  });
  const same = diffPin(testDomain, {
    namespace: "npm",
    package: "good-pkg",
    registry: "https://registry.npmjs.org/",
    dnsVersion: null,
  });
  check("no change when mapping matches", same.changes.length === 0 && !!same.existing);
  const changed = diffPin(testDomain, {
    namespace: "npm",
    package: "EVIL-pkg",
    registry: "https://registry.npmjs.org/",
    dnsVersion: null,
  });
  check("detects package change (hijack signal)", changed.changes.some((c) => c.field === "package"));
  const changedDnsVersion = diffPin(testDomain, {
    namespace: "npm",
    package: "good-pkg",
    registry: "https://registry.npmjs.org/",
    dnsVersion: "^2",
  });
  check(
    "pins DNS version policy independently",
    changedDnsVersion.changes.some((c) => c.field === "dnsVersion"),
  );

  const pinFile = join(state, "pins.json");
  const stored = JSON.parse(readFileSync(pinFile, "utf8")) as { version?: number };
  check("writes a versioned pin schema", stored.version === 1);
  check("restricts pin-file permissions", (statSync(pinFile).mode & 0o777) === 0o600);
  check("restricts state-directory permissions", (statSync(state).mode & 0o777) === 0o700);

  writeFileSync(pinFile, "{ definitely not json", "utf8");
  let corruptFailedClosed = false;
  try {
    getPin(testDomain);
  } catch {
    corruptFailedClosed = true;
  }
  check("corrupt trust state fails closed", corruptFailedClosed);
  const corruptBackup = resetPinStore();
  check("explicit reset preserves corrupt state as a backup", !!corruptBackup && existsSync(corruptBackup));

  const victim = join(state, "victim.txt");
  writeFileSync(victim, "must remain unchanged", "utf8");
  rmSync(pinFile);
  symlinkSync(victim, pinFile);
  let symlinkFailedClosed = false;
  try {
    getPin(testDomain);
  } catch {
    symlinkFailedClosed = true;
  }
  check("refuses a symlinked pin file", symlinkFailedClosed);
  const symlinkBackup = resetPinStore();
  check(
    "recovery moves the symlink without touching its target",
    !!symlinkBackup && lstatSync(symlinkBackup).isSymbolicLink() && readFileSync(victim, "utf8") === "must remain unchanged",
  );

  const pinModule = new URL("../dist/pin.js", import.meta.url).href;
  const runWriter = (index: number) =>
    new Promise<number>((resolve) => {
      const code = `import { savePin } from ${JSON.stringify(pinModule)}; savePin(${JSON.stringify(`worker-${index}.example`)}, { namespace: "npm", package: ${JSON.stringify(`pkg-${index}`)}, registry: "https://registry.npmjs.org/", dnsVersion: null });`;
      const child = spawn(process.execPath, ["--input-type=module", "--eval", code], {
        env: { ...process.env, DOMAININSTALL_STATE_DIR: state },
        stdio: "ignore",
      });
      child.on("error", () => resolve(127));
      child.on("close", (exitCode) => resolve(exitCode ?? 1));
    });
  const writerCodes = await Promise.all(Array.from({ length: 8 }, (_, index) => runWriter(index)));
  check("serializes concurrent pin writers", writerCodes.every((code) => code === 0));
  check(
    "concurrent writers do not lose pins",
    Array.from({ length: 8 }, (_, index) => getPin(`worker-${index}.example`)?.package === `pkg-${index}`).every(Boolean),
  );
  check(
    "atomic writes leave no temporary or lock files",
    !readdirSync(state).some((name) => name.endsWith(".tmp") || name === "pins.lock"),
  );

  console.log("\n5. Package-manager detection + plan");
  const plan = buildInstallPlan("stripe", "^18", "https://registry.npmjs.org/");
  check("builds an npm-only install plan", plan.pm === "npm" && plan.spec === "stripe@^18");
  check(
    "pins the displayed registry and disables lifecycle scripts",
    plan.argv.includes("--ignore-scripts") &&
      plan.argv.includes("--registry=https://registry.npmjs.org/") &&
      plan.display.includes("--ignore-scripts"),
  );
  const tmp = mkdtempSync(join(tmpdir(), "dnstall-pm-"));
  writeFileSync(join(tmp, "pnpm-lock.yaml"), "");
  check("blocks non-npm projects for the alpha", !detectNpmProject(tmp).ok);
  rmSync(join(tmp, "pnpm-lock.yaml"));
  writeFileSync(join(tmp, "package.json"), JSON.stringify({ name: "test", version: "1.0.0" }));
  writeFileSync(join(tmp, ".npmrc"), "registry=https://packages.example.test/npm/\n");
  const customRegistry = resolveNpmRegistry(tmp);
  check(
    "reads the effective npm registry",
    customRegistry.ok && customRegistry.registry === "https://packages.example.test/npm/",
  );
  writeFileSync(join(tmp, ".npmrc"), "registry=http://packages.example.test/npm/\n");
  check("rejects an insecure effective registry", !resolveNpmRegistry(tmp).ok);
  rmSync(tmp, { recursive: true, force: true });

  console.log("\n6. CLI guidance");
  const cli = join(import.meta.dirname, "..", "dist", "cli.js");
  const getStarted = spawnSync(process.execPath, [cli], { encoding: "utf8" });
  check(
    "no arguments shows the guided start flow",
    getStarted.status === 0 &&
      getStarted.stdout.includes("GET STARTED") &&
      getStarted.stdout.includes("di verify zuraai.xyz") &&
      getStarted.stdout.includes("domain  →  DNS record  →  package preview  →  install"),
  );
  const help = spawnSync(process.execPath, [cli, "--help"], { encoding: "utf8" });
  check(
    "--help keeps the full command reference",
    help.status === 0 && help.stdout.includes("USAGE") && help.stdout.includes("OPTIONS"),
  );
  const recoveryState = mkdtempSync(join(tmpdir(), "dnstall-recovery-"));
  writeFileSync(join(recoveryState, "pins.json"), "broken", "utf8");
  const recovery = spawnSync(process.execPath, [cli, "trust", "reset", "--all", "--force"], {
    encoding: "utf8",
    env: { ...process.env, DOMAININSTALL_STATE_DIR: recoveryState },
  });
  const recovered = JSON.parse(readFileSync(join(recoveryState, "pins.json"), "utf8")) as { version?: number };
  check(
    "CLI recovery backs up and resets invalid trust state",
    recovery.status === 0 && recovered.version === 1 && readdirSync(recoveryState).some((name) => name.startsWith("pins.backup-")),
  );
  rmSync(recoveryState, { recursive: true, force: true });

  const gateRoot = mkdtempSync(join(tmpdir(), "dnstall-cli-gates-"));
  const fakeBin = join(gateRoot, "bin");
  mkdirSync(fakeBin);
  const fakeNpm = join(fakeBin, "npm");
  writeFileSync(
    fakeNpm,
    `#!/usr/bin/env node
const fs = require("node:fs");
if (process.argv[2] === "config" && process.argv[3] === "get") {
  process.stdout.write("https://registry.npmjs.org/\\n");
  process.exit(0);
}
fs.appendFileSync(process.env.DOMAININSTALL_TEST_MARKER, "install\\n");
`,
  );
  chmodSync(fakeNpm, 0o755);
  const mockDns = join(gateRoot, "mock-dns.mjs");
  writeFileSync(
    mockDns,
    `const answers = process.env.DOMAININSTALL_TEST_DNS_MODE === "single"
  ? [{ type: 16, data: '\"dnstall=pkg:npm/safe-package\"' }]
  : [
      { type: 16, data: '\"dnstall=pkg:npm/safe-package\"' },
      { type: 16, data: '\"dnstall=pkg:npm/other-package\"' }
    ];
globalThis.fetch = async () => new Response(JSON.stringify({
  Status: 0,
  Answer: answers
}), { status: 200, headers: { "content-type": "application/json" } });
`,
  );
  const marker = join(gateRoot, "install-marker");
  const baseGateEnv = {
    ...process.env,
    PATH: `${fakeBin}${delimiter}${process.env.PATH ?? ""}`,
    DOMAININSTALL_TEST_MARKER: marker,
  };
  const runGatedCli = (args: string[], stateDir: string, dnsMode = "ambiguous") =>
    spawnSync(process.execPath, ["--import", mockDns, cli, ...args], {
      encoding: "utf8",
      env: { ...baseGateEnv, DOMAININSTALL_STATE_DIR: stateDir, DOMAININSTALL_TEST_DNS_MODE: dnsMode },
    });

  const invalidState = join(gateRoot, "invalid-state");
  const unknownFlag = runGatedCli(["example.com", "--unknown"], invalidState);
  const invalidTarget = runGatedCli(["not-a-domain", "--yes"], invalidState);
  check(
    "malformed CLI input fails before npm, DNS side effects, or trust state",
    unknownFlag.status === 1 &&
      invalidTarget.status === 1 &&
      !existsSync(marker) &&
      !existsSync(invalidState),
  );

  const corruptState = join(gateRoot, "corrupt-state");
  mkdirSync(corruptState, { mode: 0o700 });
  writeFileSync(join(corruptState, "pins.json"), "corrupt", { mode: 0o600 });
  const corruptInstall = runGatedCli(["example.com", "--yes"], corruptState);
  check(
    "corrupt trust state fails before npm or installation",
    corruptInstall.status === 1 && !existsSync(marker),
  );

  const ambiguousState = join(gateRoot, "ambiguous-state");
  const ambiguous = runGatedCli(["example.com", "--yes"], ambiguousState);
  check(
    "--yes cannot bypass ambiguous DNS mappings",
    ambiguous.status === 1 && !existsSync(marker) && !existsSync(join(ambiguousState, "pins.json")),
  );

  const changedState = join(gateRoot, "changed-state");
  mkdirSync(changedState, { mode: 0o700 });
  const now = new Date().toISOString();
  writeFileSync(
    join(changedState, "pins.json"),
    JSON.stringify({
      version: 1,
      pins: {
        "example.com": {
          namespace: "npm",
          package: "old-package",
          registry: "https://registry.npmjs.org/",
          dnsVersion: null,
          firstSeen: now,
          lastSeen: now,
        },
      },
    }),
    { mode: 0o600 },
  );
  const mappingChange = runGatedCli(["example.com", "--yes"], changedState, "single");
  const unchangedPin = JSON.parse(readFileSync(join(changedState, "pins.json"), "utf8")) as {
    pins: Record<string, { package: string }>;
  };
  check(
    "--yes cannot bypass a changed TOFU mapping",
    mappingChange.status === 130 && unchangedPin.pins["example.com"]?.package === "old-package" && !existsSync(marker),
  );
  rmSync(gateRoot, { recursive: true, force: true });

  console.log("\n7. Deterministic DNS outcomes and fallback");
  const jsonResponse = (body: unknown) =>
    new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

  let authoritativeCalls = 0;
  const nxdomain = await resolveTxt("dnstall", "missing.example", {
    providers: ["https://resolver-one.example", "https://resolver-two.example"],
    fetchImpl: (async () => {
      authoritativeCalls++;
      return jsonResponse({ Status: 3, AD: true });
    }) as typeof fetch,
  });
  check(
    "NXDOMAIN is distinct and stops fallback",
    nxdomain.outcome === "nxdomain" && authoritativeCalls === 1,
  );

  const nodata = await resolveTxt("dnstall", "empty.example", {
    providers: ["https://resolver.example"],
    fetchImpl: (async () => jsonResponse({ Status: 0, Answer: [{ type: 5, data: "alias.example." }] })) as typeof fetch,
  });
  check("NODATA is distinct from NXDOMAIN", nodata.outcome === "nodata");

  const fallbackResponses = [
    jsonResponse({ Status: 2 }),
    jsonResponse({ Status: 0, AD: true, Answer: [{ type: 16, data: '"dnstall=pkg:npm/safe"' }] }),
  ];
  const fallback = await resolveTxt("dnstall", "fallback.example", {
    providers: ["https://resolver-one.example", "https://resolver-two.example"],
    fetchImpl: (async () => fallbackResponses.shift()!) as typeof fetch,
  });
  check(
    "SERVFAIL falls back to a usable answer",
    fallback.outcome === "answer" &&
      fallback.records[0] === "dnstall=pkg:npm/safe" &&
      fallback.attempts.map((attempt) => attempt.outcome).join(",") === "servfail,answer",
  );

  const timeout = new Error("timed out");
  timeout.name = "TimeoutError";
  const exhaustedResponses: Array<Response | Error> = [
    jsonResponse({ Status: 5 }),
    new Response("not json", { status: 200 }),
    timeout,
  ];
  const exhausted = await resolveTxt("dnstall", "broken.example", {
    providers: [
      "https://resolver-one.example",
      "https://resolver-two.example",
      "https://resolver-three.example",
    ],
    fetchImpl: (async () => {
      const next = exhaustedResponses.shift()!;
      if (next instanceof Error) throw next;
      return next;
    }) as typeof fetch,
  });
  check(
    "REFUSED, malformed, and timeout exhaust providers without becoming NODATA",
    exhausted.outcome === "provider_exhaustion" &&
      exhausted.attempts.map((attempt) => attempt.outcome).join(",") === "refused,malformed,timeout",
  );

  rmSync(state, { recursive: true, force: true });

  console.log(`\n${fail === 0 ? "\x1b[32m" : "\x1b[31m"}${pass} passed, ${fail} failed\x1b[0m\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
