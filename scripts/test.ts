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
import { pathToFileURL } from "node:url";

import { resolveTxt } from "../dist/doh.js";
import { parseCliArgs } from "../dist/args.js";
import { distinctRecordMappings, parseRecord, parseRecords } from "../dist/record.js";
import { buildSetupPlan, encodePurlPackage, splitPackageSpec } from "../dist/setup.js";
import { validatePackageName, parseTarget, validateDomain } from "../dist/validate.js";
import {
  buildInstallPlan,
  detectNpmProject,
  npmScopeOf,
  resolveEffectiveRegistry,
  resolveNpmLauncher,
  resolveNpmRegistry,
} from "../dist/install.js";
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
  const globalInstall = parseCliArgs(["example.com", "-g", "--yes"]);
  check(
    "accepts -g alongside --yes",
    globalInstall.ok &&
      globalInstall.command.kind === "install" &&
      globalInstall.command.global === true &&
      globalInstall.command.yes === true,
  );
  const localInstall = parseCliArgs(["example.com"]);
  check(
    "install defaults to the current project",
    localInstall.ok && localInstall.command.kind === "install" && localInstall.command.global === false,
  );
  check("rejects both -g and --global", !parseCliArgs(["example.com", "-g", "--global"]).ok);
  check("rejects --global on verify", !parseCliArgs(["verify", "example.com", "--global"]).ok);
  check("rejects --global on trust reset", !parseCliArgs(["trust", "reset", "--all", "--global"]).ok);

  console.log("\n2b. Publisher record generation (di setup)");
  const setupPlain = buildSetupPlan("example.com", "my-package");
  check(
    "generates a root record with the relative name providers expect",
    setupPlain.ok &&
      setupPlain.value.relativeName === "_dnstall" &&
      setupPlain.value.dnsName === "_dnstall.example.com" &&
      setupPlain.value.recordValue === "dnstall=pkg:npm/my-package" &&
      setupPlain.value.verifyTarget === "example.com",
  );
  const setupRange = buildSetupPlan("example.com", "my-package@^2");
  check(
    "declares a version policy when one is supplied",
    setupRange.ok &&
      setupRange.value.version === "^2" &&
      setupRange.value.recordValue === "dnstall=pkg:npm/my-package@^2",
  );
  const setupScoped = buildSetupPlan("example.com", "@acme/widget@~1.2");
  check(
    "purl-encodes a leading scope but keeps the inner slash literal",
    setupScoped.ok &&
      setupScoped.value.recordValue === "dnstall=pkg:npm/%40acme/widget@~1.2" &&
      setupScoped.value.package === "@acme/widget",
  );
  const setupSub = buildSetupPlan("example.com/react", "@acme/react-widget");
  check(
    "a sub-package becomes an extra DNS label",
    setupSub.ok &&
      setupSub.value.relativeName === "_dnstall.react" &&
      setupSub.value.dnsName === "_dnstall.react.example.com" &&
      setupSub.value.verifyTarget === "example.com/react",
  );
  check(
    "emits a quoted zone-file line",
    setupSub.ok &&
      setupSub.value.zoneFileLine ===
        '_dnstall.react.example.com.  IN  TXT  "dnstall=pkg:npm/%40acme/react-widget"',
  );
  // The generator and the resolver must never disagree about the format.
  const roundTrips = [
    buildSetupPlan("example.com", "my-package"),
    buildSetupPlan("example.com", "my-package@^2"),
    buildSetupPlan("example.com", "@acme/widget@~1.2"),
    buildSetupPlan("example.com/react", "@acme/react-widget"),
  ].every((built) => {
    if (!built.ok) return false;
    const parsedBack = parseRecord(built.value.recordValue);
    return (
      parsedBack?.namespace === "npm" &&
      parsedBack.package === built.value.package &&
      parsedBack.version === built.value.version
    );
  });
  check("every generated record parses back to the same mapping", roundTrips);
  check("rejects a package name that could smuggle a flag", !buildSetupPlan("example.com", "--registry=evil").ok);
  check("rejects an invalid domain", !buildSetupPlan("not-a-domain", "my-package").ok);
  check("rejects an invalid version range", !buildSetupPlan("example.com", "my-package@ ^2").ok);
  check("rejects an empty version range", !buildSetupPlan("example.com", "my-package@").ok);
  check(
    "rejects a version range on the domain instead of the package",
    !buildSetupPlan("example.com@^2", "my-package").ok,
  );
  check("splits a scoped spec without treating the scope as a version", splitPackageSpec("@acme/widget").version === undefined);
  check("encodes only a leading scope", encodePurlPackage("plain") === "plain" && encodePurlPackage("@a/b") === "%40a/b");
  const setupArgs = parseCliArgs(["setup", "example.com", "my-package"]);
  check(
    "parses the setup command",
    setupArgs.ok &&
      setupArgs.command.kind === "setup" &&
      setupArgs.command.target === "example.com" &&
      setupArgs.command.packageSpec === "my-package",
  );
  check("setup requires both a domain and a package", !parseCliArgs(["setup", "example.com"]).ok);
  check("setup rejects surplus positionals", !parseCliArgs(["setup", "example.com", "a", "b"]).ok);
  check("setup rejects options", !parseCliArgs(["setup", "example.com", "my-package", "--yes"]).ok);

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
  const firstSave = savePin(testDomain, {
    namespace: "npm",
    package: "good-pkg",
    registry: "https://registry.npmjs.org/",
    dnsVersion: null,
  });
  check("savePin records a first-use pin", firstSave.ok === true);
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

  const existingPin = getPin(testDomain)!;
  const casSame = savePin(
    testDomain,
    {
      namespace: "npm",
      package: "good-pkg",
      registry: "https://registry.npmjs.org/",
      dnsVersion: null,
    },
    existingPin,
  );
  check("savePin CAS succeeds when expected pin matches", casSame.ok === true);

  const casDiverge = savePin(
    testDomain,
    {
      namespace: "npm",
      package: "other-pkg",
      registry: "https://registry.npmjs.org/",
      dnsVersion: null,
    },
    // Claim we expected no pin while one exists → refuse overwrite
  );
  check(
    "savePin refuses unexpected first-use when pin exists",
    casDiverge.ok === false && casDiverge.reason === "diverged",
  );
  check("diverged savePin leaves package unchanged", getPin(testDomain)?.package === "good-pkg");

  const invalidSave = savePin("not a domain", {
    namespace: "npm",
    package: "x",
    registry: "https://registry.npmjs.org/",
    dnsVersion: null,
  });
  check(
    "savePin validates domain on write",
    invalidSave.ok === false && invalidSave.reason === "invalid",
  );

  // Concurrent first-use of the same identity should succeed (idempotent), not diverge.
  resetPinStore();
  const twinDomain = "twin.example";
  const twinInput = {
    namespace: "npm" as const,
    package: "same-pkg",
    registry: "https://registry.npmjs.org/",
    dnsVersion: null as string | null,
  };
  check("twin first write", savePin(twinDomain, twinInput).ok === true);
  const twinRace = savePin(twinDomain, twinInput); // expected absent, store already has same identity
  check(
    "savePin is idempotent when the same identity is already present",
    twinRace.ok === true && getPin(twinDomain)?.package === "same-pkg",
  );

  // Restore a pin for the remaining permission / corrupt-state checks below.
  check(
    "restore smoke-test pin after twin checks",
    savePin(testDomain, {
      namespace: "npm",
      package: "good-pkg",
      registry: "https://registry.npmjs.org/",
      dnsVersion: null,
    }).ok === true,
  );

  const isWindows = process.platform === "win32";
  const pinFile = join(state, "pins.json");
  const stored = JSON.parse(readFileSync(pinFile, "utf8")) as { version?: number };
  check("writes a versioned pin schema", stored.version === 1);
  if (isWindows) {
    // Windows has no POSIX mode bits; the store relies on the user profile ACL.
    console.log("  - skipped POSIX permission checks on Windows");
  } else {
    check("restricts pin-file permissions", (statSync(pinFile).mode & 0o777) === 0o600);
    check("restricts state-directory permissions", (statSync(state).mode & 0o777) === 0o700);
  }

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

  if (isWindows) {
    // Creating a symlink on Windows needs elevation or developer mode.
    console.log("  - skipped symlink trust-state checks on Windows");
  } else {
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
      !!symlinkBackup &&
        lstatSync(symlinkBackup).isSymbolicLink() &&
        readFileSync(victim, "utf8") === "must remain unchanged",
    );
  }

  console.log("\n4b. Granular trust management");
  const listState = mkdtempSync(join(tmpdir(), "dnstall-list-"));
  {
    // A dedicated store keeps these assertions independent of the pins written
    // by the section above.
    const child = (code: string) =>
      spawnSync(process.execPath, ["--input-type=module", "--eval", code], {
        encoding: "utf8",
        env: { ...process.env, DOMAININSTALL_STATE_DIR: listState },
      });
    const pinUrl = new URL("../dist/pin.js", import.meta.url).href;
    const seed = child(
      `import { savePin } from ${JSON.stringify(pinUrl)};
savePin("zeta.example", { namespace: "npm", package: "zeta", registry: "https://registry.npmjs.org/", dnsVersion: "^2" });
savePin("alpha.example", { namespace: "npm", package: "@acme/alpha", registry: "https://registry.npmjs.org/", dnsVersion: null });`,
    );
    const listed = child(
      `import { listPins } from ${JSON.stringify(pinUrl)};
process.stdout.write(JSON.stringify(listPins().map((pin) => [pin.domain, pin.package, pin.dnsVersion])));`,
    );
    check(
      "lists every pin sorted by domain",
      seed.status === 0 &&
        listed.status === 0 &&
        listed.stdout ===
          JSON.stringify([
            ["alpha.example", "@acme/alpha", null],
            ["zeta.example", "zeta", "^2"],
          ]),
    );
    const forgotten = child(
      `import { forgetPin, getPin, listPins } from ${JSON.stringify(pinUrl)};
const expected = getPin("alpha.example");
if (!expected) throw new Error("expected alpha.example seed pin");
const removed = forgetPin("alpha.example", expected);
process.stdout.write(JSON.stringify({
  removedPackage: removed?.package ?? null,
  alphaStillPresent: getPin("alpha.example") !== undefined,
  survivors: listPins().map((pin) => pin.domain),
  secondRemoval: forgetPin("alpha.example", expected) ?? null,
}));`,
    );
    const forgetResult = forgotten.status === 0
      ? (JSON.parse(forgotten.stdout) as {
          removedPackage: string | null;
          alphaStillPresent: boolean;
          survivors: string[];
          secondRemoval: unknown;
        })
      : undefined;
    check(
      "forget removes only the named domain and returns what it removed",
      forgetResult?.removedPackage === "@acme/alpha" &&
        forgetResult.alphaStillPresent === false &&
        JSON.stringify(forgetResult.survivors) === JSON.stringify(["zeta.example"]),
    );
    check("forgetting an unknown domain reports nothing removed", forgetResult?.secondRemoval === null);
    const compareDelete = child(
      `import { forgetPin, getPin, savePin } from ${JSON.stringify(pinUrl)};
const observed = getPin("zeta.example");
if (!observed) throw new Error("missing seed pin");
savePin("zeta.example", { namespace: "npm", package: "changed", registry: "https://registry.npmjs.org/", dnsVersion: null }, observed);
const removed = forgetPin("zeta.example", observed);
process.stdout.write(JSON.stringify({ removed: removed ?? null, current: getPin("zeta.example")?.package ?? null }));`,
    );
    check(
      "forget compare-and-delete refuses a concurrently changed mapping",
      compareDelete.status === 0 &&
        compareDelete.stdout === JSON.stringify({ removed: null, current: "changed" }),
    );
    check(
      "forget leaves a valid v1 store with no temp or lock files",
      (JSON.parse(readFileSync(join(listState, "pins.json"), "utf8")) as { version?: number }).version === 1 &&
        !readdirSync(listState).some((name) => name.endsWith(".tmp") || name === "pins.lock"),
    );
    const corruptListState = mkdtempSync(join(tmpdir(), "dnstall-list-corrupt-"));
    writeFileSync(join(corruptListState, "pins.json"), "not json", "utf8");
    const corruptList = spawnSync(
      process.execPath,
      ["--input-type=module", "--eval", `import { listPins } from ${JSON.stringify(pinUrl)}; listPins();`],
      { encoding: "utf8", env: { ...process.env, DOMAININSTALL_STATE_DIR: corruptListState } },
    );
    check("listing a corrupt store fails closed instead of reporting no pins", corruptList.status !== 0);
    rmSync(corruptListState, { recursive: true, force: true });
  }
  rmSync(listState, { recursive: true, force: true });

  const pinModule = new URL("../dist/pin.js", import.meta.url).href;
  const runWriter = (index: number) =>
    new Promise<number>((resolve) => {
      const code = `import { savePin } from ${JSON.stringify(pinModule)}; const r = savePin(${JSON.stringify(`worker-${index}.example`)}, { namespace: "npm", package: ${JSON.stringify(`pkg-${index}`)}, registry: "https://registry.npmjs.org/", dnsVersion: null }); if (!r.ok) process.exit(2);`;
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

  const globalPlan = buildInstallPlan("stripe", undefined, "https://registry.npmjs.org/", { global: true });
  check(
    "global plan asks npm for a global install",
    globalPlan.global && globalPlan.argv.includes("--global") && globalPlan.display.includes("--global"),
  );
  const projectPlan = buildInstallPlan("stripe", undefined, "https://registry.npmjs.org/");
  check(
    "project plan never adds --global",
    !projectPlan.global && !projectPlan.argv.includes("--global"),
  );

  console.log("\n6. Scope-specific registries");
  check(
    "extracts the scope of a scoped package",
    npmScopeOf("@acme/widget") === "@acme" && npmScopeOf("widget") === null && npmScopeOf("@acme") === null,
  );
  const scopeDir = mkdtempSync(join(tmpdir(), "dnstall-scope-"));
  // npm only loads project-level .npmrc when the directory is a package root.
  writeFileSync(join(scopeDir, "package.json"), JSON.stringify({ name: "scope-fixture", version: "0.0.0" }));
  writeFileSync(
    join(scopeDir, ".npmrc"),
    "registry=https://packages.example.test/npm/\n@acme:registry=https://other.example.test/npm/\n",
  );
  check(
    "refuses a scope registry that diverges from the pinned registry",
    !resolveEffectiveRegistry("@acme/widget", scopeDir).ok,
  );
  const unscoped = resolveEffectiveRegistry("widget", scopeDir);
  check(
    "unscoped packages are unaffected by scope configuration",
    unscoped.ok && unscoped.registry === "https://packages.example.test/npm/",
  );
  writeFileSync(
    join(scopeDir, ".npmrc"),
    "registry=https://packages.example.test/npm/\n@acme:registry=https://packages.example.test/npm/\n",
  );
  const agreeing = resolveEffectiveRegistry("@acme/widget", scopeDir);
  check(
    "accepts a scope registry that matches the default",
    agreeing.ok && agreeing.registry === "https://packages.example.test/npm/",
  );
  rmSync(scopeDir, { recursive: true, force: true });

  console.log("\n7. npm launcher resolution (cross-platform)");
  const posixLauncher = resolveNpmLauncher({ platform: "linux" });
  check(
    "POSIX spawns npm directly without a shell",
    posixLauncher.ok &&
      posixLauncher.launcher.command === "npm" &&
      posixLauncher.launcher.prefixArgs.length === 0,
  );
  const launcherRoot = mkdtempSync(join(tmpdir(), "dnstall-launcher-"));
  const npmHome = join(launcherRoot, "npm-home");
  mkdirSync(join(npmHome, "node_modules", "npm", "bin"), { recursive: true });
  const pathNpmCli = join(npmHome, "node_modules", "npm", "bin", "npm-cli.js");
  writeFileSync(pathNpmCli, "");
  writeFileSync(join(npmHome, "npm.cmd"), "");
  const nodeHome = join(launcherRoot, "node-home");
  mkdirSync(join(nodeHome, "node_modules", "npm", "bin"), { recursive: true });
  const nodeNpmCli = join(nodeHome, "node_modules", "npm", "bin", "npm-cli.js");
  writeFileSync(nodeNpmCli, "");
  const windowsBase = {
    platform: "win32",
    pathDelimiter: ";",
    pathExt: ".COM;.EXE;.BAT;.CMD",
    npmExecPath: undefined,
    appData: undefined,
  };
  const fromPath = resolveNpmLauncher({
    ...windowsBase,
    pathValue: `C:\\definitely\\missing;${npmHome}`,
    execPath: join(launcherRoot, "unrelated", "node.exe"),
  });
  check(
    "Windows runs npm's CLI entry point with the current Node binary",
    fromPath.ok &&
      fromPath.launcher.command === join(launcherRoot, "unrelated", "node.exe") &&
      fromPath.launcher.prefixArgs.length === 1 &&
      fromPath.launcher.prefixArgs[0] === pathNpmCli,
  );
  const fromNodeDirectory = resolveNpmLauncher({
    ...windowsBase,
    pathValue: "",
    execPath: join(nodeHome, "node.exe"),
  });
  check(
    "Windows falls back to the npm beside the Node binary",
    fromNodeDirectory.ok && fromNodeDirectory.launcher.prefixArgs[0] === nodeNpmCli,
  );
  const noLauncher = resolveNpmLauncher({
    ...windowsBase,
    pathValue: "",
    execPath: join(launcherRoot, "empty", "node.exe"),
  });
  check("Windows fails closed when npm's entry point is missing", !noLauncher.ok);
  rmSync(launcherRoot, { recursive: true, force: true });

  console.log("\n8. CLI guidance");
  const cli = join(import.meta.dirname, "..", "dist", "cli.js");
  const rootManifest = JSON.parse(
    readFileSync(join(import.meta.dirname, "..", "package.json"), "utf8"),
  ) as { version: string };
  const reportedVersion = spawnSync(process.execPath, [cli, "--version"], { encoding: "utf8" });
  check(
    "--version reports the manifest version",
    reportedVersion.status === 0 && reportedVersion.stdout.trim() === rootManifest.version,
  );
  const rejectedFlag = spawnSync(process.execPath, [cli, "example.com", "--nope"], { encoding: "utf8" });
  check(
    "errors are written to stderr and keep stdout clean",
    rejectedFlag.status === 1 &&
      rejectedFlag.stderr.includes("Unknown option") &&
      rejectedFlag.stdout === "",
  );
  const globalHelp = spawnSync(process.execPath, [cli, "--help"], { encoding: "utf8" });
  check("--help documents the global install flag", globalHelp.stdout.includes("--global"));
  check("--help documents the setup command", globalHelp.stdout.includes("di setup <domain>"));
  const setupRun = spawnSync(process.execPath, [cli, "setup", "example.com", "@acme/widget@^2"], {
    encoding: "utf8",
  });
  check(
    "setup prints the record, the relative name, and the verify follow-up",
    setupRun.status === 0 &&
      setupRun.stdout.includes("dnstall=pkg:npm/%40acme/widget@^2") &&
      setupRun.stdout.includes("_dnstall.example.com") &&
      setupRun.stdout.includes("di verify example.com") &&
      setupRun.stderr === "",
  );
  const setupNoNetwork = spawnSync(process.execPath, [cli, "setup", "example.invalid", "pkg"], {
    encoding: "utf8",
    // A resolver reachable only through this variable would reveal a lookup.
    env: { ...process.env, DOMAININSTALL_STATE_DIR: join(tmpdir(), "dnstall-setup-unused") },
  });
  check(
    "setup performs no lookup and writes no trust state",
    setupNoNetwork.status === 0 && !existsSync(join(tmpdir(), "dnstall-setup-unused")),
  );
  const setupInvalid = spawnSync(process.execPath, [cli, "setup", "example.com", "--registry=evil"], {
    encoding: "utf8",
  });
  check(
    "setup rejects a flag-shaped package name on stderr",
    setupInvalid.status === 1 && setupInvalid.stdout === "" && setupInvalid.stderr.length > 0,
  );
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
  check(
    "--help documents granular trust management",
    globalHelp.stdout.includes("di trust list") && globalHelp.stdout.includes("di trust forget <domain>"),
  );
  const trustCliState = mkdtempSync(join(tmpdir(), "dnstall-trust-cli-"));
  const runTrustCli = (args: string[]) =>
    spawnSync(process.execPath, [cli, ...args], {
      encoding: "utf8",
      env: { ...process.env, DOMAININSTALL_STATE_DIR: trustCliState },
    });
  const emptyList = runTrustCli(["trust", "list"]);
  check(
    "trust list reports an empty store without failing",
    emptyList.status === 0 && emptyList.stdout.includes("No remembered mappings yet"),
  );
  spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `import { savePin } from ${JSON.stringify(pinModule)};
savePin("kept.example", { namespace: "npm", package: "kept", registry: "https://registry.npmjs.org/", dnsVersion: null });
savePin("dropped.example", { namespace: "npm", package: "dropped", registry: "https://registry.npmjs.org/", dnsVersion: "^3" });
savePin("long.example", { namespace: "npm", package: "very-long-${"x".repeat(60)}", registry: "https://registry.npmjs.org/", dnsVersion: null });`,
    ],
    { env: { ...process.env, DOMAININSTALL_STATE_DIR: trustCliState } },
  );
  const populatedList = runTrustCli(["trust", "list"]);
  check(
    "trust list shows each mapping with its policy",
    populatedList.status === 0 &&
      populatedList.stdout.includes("3 remembered mappings") &&
      populatedList.stdout.includes("dropped.example") &&
      populatedList.stdout.includes("kept.example") &&
      populatedList.stdout.includes("^3") &&
      populatedList.stdout.includes("latest"),
  );
  check(
    "trust list truncates oversized table cells instead of shifting later columns",
    populatedList.stdout.includes("…") && !populatedList.stdout.includes(`very-long-${"x".repeat(60)}`),
  );
  const forgetUnknown = runTrustCli(["trust", "forget", "never-pinned.example", "--force"]);
  check(
    "trust forget reports an unknown domain on stderr and exits non-zero",
    forgetUnknown.status === 1 && forgetUnknown.stderr.includes("No remembered mapping"),
  );
  const forgetInvalid = runTrustCli(["trust", "forget", "not-a-domain", "--force"]);
  check("trust forget rejects a malformed domain", forgetInvalid.status === 1);
  // Without a TTY, confirm() declines, so an unforced removal must not proceed.
  const forgetUnconfirmed = runTrustCli(["trust", "forget", "dropped.example"]);
  check(
    "trust forget will not remove a pin non-interactively without --force",
    forgetUnconfirmed.status === 130 &&
      (
        JSON.parse(readFileSync(join(trustCliState, "pins.json"), "utf8")) as {
          pins: Record<string, unknown>;
        }
      ).pins["dropped.example"] !== undefined,
  );
  const forgetForced = runTrustCli(["trust", "forget", "DROPPED.example", "--force"]);
  const afterForget = JSON.parse(readFileSync(join(trustCliState, "pins.json"), "utf8")) as {
    version?: number;
    pins: Record<string, unknown>;
  };
  check(
    "trust forget --force removes one mapping, case-insensitively, and keeps the rest",
    forgetForced.status === 0 &&
      afterForget.version === 1 &&
      afterForget.pins["dropped.example"] === undefined &&
      afterForget.pins["kept.example"] !== undefined,
  );
  check(
    "trust forget does not create a backup file the way a full reset does",
    !readdirSync(trustCliState).some((name) => name.startsWith("pins.backup-")),
  );
  rmSync(trustCliState, { recursive: true, force: true });
  check("trust list rejects options", !parseCliArgs(["trust", "list", "--force"]).ok);
  check("trust forget requires a domain", !parseCliArgs(["trust", "forget"]).ok);
  check("trust forget rejects --all", !parseCliArgs(["trust", "forget", "example.com", "--all"]).ok);
  check("trust reset still requires --all", !parseCliArgs(["trust", "reset"]).ok);
  check("an unknown trust subcommand is rejected", !parseCliArgs(["trust", "purge"]).ok);
  const forgetArgs = parseCliArgs(["trust", "forget", "example.com", "--force"]);
  check(
    "parses trust forget with --force",
    forgetArgs.ok &&
      forgetArgs.command.kind === "trust_forget" &&
      forgetArgs.command.domain === "example.com" &&
      forgetArgs.command.force === true,
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
  const fakeNpmBody = `const fs = require("node:fs");
if (process.argv[2] === "config" && process.argv[3] === "get") {
  process.stdout.write("https://registry.npmjs.org/\\n");
  process.exit(0);
}
fs.appendFileSync(process.env.DOMAININSTALL_TEST_MARKER, "install\\n");
`;
  const fakeNpm = join(fakeBin, "npm");
  writeFileSync(fakeNpm, `#!/usr/bin/env node\n${fakeNpmBody}`);
  chmodSync(fakeNpm, 0o755);
  // Windows resolves npm through its JavaScript entry point beside npm.cmd, so
  // the stand-in has to exist in both shapes for these gates to run everywhere.
  writeFileSync(join(fakeBin, "npm.cmd"), "@echo off\r\n");
  mkdirSync(join(fakeBin, "node_modules", "npm", "bin"), { recursive: true });
  writeFileSync(join(fakeBin, "node_modules", "npm", "bin", "npm-cli.js"), fakeNpmBody);
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
  // Node requires an explicit file URL for --import on Windows; a C:\... path
  // is otherwise parsed as an unsupported URL scheme.
  const mockDnsUrl = pathToFileURL(mockDns).href;
  const marker = join(gateRoot, "install-marker");
  const gatePath = `${fakeBin}${delimiter}${process.env.PATH ?? process.env.Path ?? ""}`;
  const baseGateEnv = {
    ...process.env,
    // Windows exposes the search path as "Path"; set both so the child agrees.
    ...(process.platform === "win32" ? { Path: gatePath } : {}),
    PATH: gatePath,
    // Inherited from the outer npm run, this would point the CLI at the real npm.
    npm_execpath: "",
    DOMAININSTALL_TEST_MARKER: marker,
  };
  const runGatedCli = (args: string[], stateDir: string, dnsMode = "ambiguous") =>
    spawnSync(process.execPath, ["--import", mockDnsUrl, cli, ...args], {
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
    corruptInstall.status === 1 &&
      corruptInstall.stderr.includes("trust reset --all") &&
      !existsSync(marker),
  );

  const ambiguousState = join(gateRoot, "ambiguous-state");
  const ambiguous = runGatedCli(["example.com", "--yes"], ambiguousState);
  check(
    "--yes cannot bypass ambiguous DNS mappings",
    ambiguous.status === 1 &&
      ambiguous.stderr.includes("Conflicting domaininstall mappings") &&
      !existsSync(marker) &&
      !existsSync(join(ambiguousState, "pins.json")),
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
  const mappingChangeSafe =
    mappingChange.status === 130 &&
    unchangedPin.pins["example.com"]?.package === "old-package" &&
    !existsSync(marker);
  if (!mappingChangeSafe) {
    console.log(
      `    diagnostics: ${JSON.stringify({
        status: mappingChange.status,
        signal: mappingChange.signal,
        error: mappingChange.error?.message,
        stdout: mappingChange.stdout,
        stderr: mappingChange.stderr,
        pinnedPackage: unchangedPin.pins["example.com"]?.package,
        installMarkerExists: existsSync(marker),
      })}`,
    );
  }
  check(
    "--yes cannot bypass a changed TOFU mapping",
    mappingChangeSafe,
  );
  rmSync(gateRoot, { recursive: true, force: true });

  console.log("\n9. Deterministic DNS outcomes and fallback");
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

  const withAd = await resolveTxt("dnstall", "ad.example", {
    providers: ["https://resolver.example"],
    fetchImpl: (async () =>
      jsonResponse({
        Status: 0,
        AD: true,
        Answer: [{ type: 16, name: "_dnstall.ad.example", data: '"dnstall=pkg:npm/adpkg"' }],
      })) as typeof fetch,
  });
  check(
    "propagates resolver AD bit and matching QNAME",
    withAd.outcome === "answer" && withAd.authenticated === true && withAd.records[0] === "dnstall=pkg:npm/adpkg",
  );

  const wrongName = await resolveTxt("dnstall", "wrong.example", {
    providers: ["https://resolver-one.example", "https://resolver-two.example"],
    fetchImpl: (async () =>
      jsonResponse({
        Status: 0,
        Answer: [{ type: 16, name: "_dnstall.other.example", data: '"dnstall=pkg:npm/evil"' }],
      })) as typeof fetch,
  });
  check(
    "wrong-name TXT answers are malformed and fall through",
    wrongName.outcome === "provider_exhaustion" &&
      wrongName.attempts.every((attempt) => attempt.outcome === "malformed"),
  );

  const oversized = await resolveTxt("dnstall", "huge.example", {
    providers: ["https://resolver.example"],
    fetchImpl: (async () =>
      new Response("x".repeat(300_000), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as typeof fetch,
  });
  check(
    "rejects oversized DoH bodies as malformed",
    oversized.outcome === "provider_exhaustion" && oversized.attempts[0]?.outcome === "malformed",
  );

  const {
    assertEffectiveRegistryUnchanged,
    canonicalizeRegistryUrl,
    registriesEqual,
  } = await import("../dist/install.js");
  const registryDir = mkdtempSync(join(tmpdir(), "dnstall-registry-recheck-"));
  writeFileSync(join(registryDir, "package.json"), JSON.stringify({ name: "registry-fixture", version: "0.0.0" }));
  writeFileSync(join(registryDir, ".npmrc"), "registry=https://registry.npmjs.org/\n");
  const regAgain = assertEffectiveRegistryUnchanged("stripe", "https://registry.npmjs.org/", registryDir);
  check(
    "assertEffectiveRegistryUnchanged accepts stable public registry",
    regAgain.ok === true && regAgain.registry === "https://registry.npmjs.org/",
  );
  const regMismatch = assertEffectiveRegistryUnchanged(
    "stripe",
    "https://example-registry.invalid/",
    registryDir,
  );
  check(
    "assertEffectiveRegistryUnchanged detects registry drift",
    regMismatch.ok === false,
  );
  rmSync(registryDir, { recursive: true, force: true });
  check(
    "registry trailing-slash forms are equal",
    registriesEqual("https://registry.npmjs.org", "https://registry.npmjs.org/") === true,
  );
  check(
    "canonicalizeRegistryUrl lowercases host and adds trailing slash",
    canonicalizeRegistryUrl("https://Registry.NPMJS.org") === "https://registry.npmjs.org/",
  );
  // assertEffectiveRegistryUnchanged should accept expected without trailing slash
  // when npm returns the slash form (canonical equality).
  const regSlash = assertEffectiveRegistryUnchanged("stripe", "https://registry.npmjs.org");
  check(
    "assertEffectiveRegistryUnchanged tolerates trailing-slash drift",
    regSlash.ok === true,
  );

  rmSync(state, { recursive: true, force: true });

  console.log(`\n${fail === 0 ? "\x1b[32m" : "\x1b[31m"}${pass} passed, ${fail} failed\x1b[0m\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
