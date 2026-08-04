/**
 * Live end-to-end test.
 *
 * Resolves a real _dnstall TXT record, runs the compiled CLI non-interactively,
 * and verifies both install modes plus the TOFU pin that records them. This is
 * the only suite that performs a live DNS lookup and a real npm installation;
 * everything deterministic lives in scripts/test.ts.
 *
 * Phases:
 *   1. project-scoped install  → node_modules/<package> in a temp project
 *   2. TOFU pin               → schema, mapping, and registry recorded
 *   3. global install         → <prefix>/{lib/,}node_modules/<package>
 *   4. pin continuity         → second install matches, firstSeen preserved
 *   5. di verify              → exits 0 against the live record
 *
 * Both installs run against an isolated state directory and, for the global
 * phase, an isolated npm prefix, so a run never touches the user's real
 * ~/.domaininstall state or a shared system prefix. The isolated prefix is also
 * what lets the global phase run unprivileged on macOS and Linux, where npm's
 * default prefix is root-owned.
 *
 * Required DNS record:
 *   _dnstall.zuraai.xyz  TXT  "dnstall=pkg:npm/zuraai"
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const domain = process.env.DOMAININSTALL_E2E_DOMAIN || "zuraai.xyz";
const expectedPackage = process.env.DOMAININSTALL_E2E_PACKAGE || "zuraai";
const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));

const IS_WINDOWS = process.platform === "win32";

interface StoredPin {
  namespace?: string;
  package?: string;
  registry?: string;
  dnsVersion?: string | null;
  firstSeen?: string;
  lastSeen?: string;
}

interface StoredPinFile {
  version?: number;
  pins?: Record<string, StoredPin>;
}

function step(message: string): void {
  console.log(`\n▸ ${message}`);
}

/**
 * Windows keeps freshly written files briefly locked by antivirus and indexing,
 * so a plain recursive remove after an npm install is a known flake source.
 */
function removeTree(target: string): void {
  rmSync(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}

function run(
  args: string[],
  cwd: string,
  stateDir: string,
  extraEnv: Record<string, string> = {},
): Promise<number> {
  return new Promise((resolve) => {
    // process.execPath is spawned directly with shell:false on every platform;
    // the CLI itself is responsible for locating npm without a shell.
    const child = spawn(process.execPath, [cli, ...args], {
      cwd,
      env: { ...process.env, DOMAININSTALL_STATE_DIR: stateDir, ...extraEnv },
      stdio: "inherit",
      shell: false,
    });
    child.on("error", () => resolve(127));
    child.on("close", (code) => resolve(code ?? 1));
  });
}

function readPinFile(stateDir: string): StoredPinFile {
  const file = join(stateDir, "pins.json");
  if (!existsSync(file)) throw new Error(`no trust store was written at ${file}`);
  return JSON.parse(readFileSync(file, "utf8")) as StoredPinFile;
}

/**
 * Where `npm install --global` places a package.
 *
 * POSIX nests packages under `lib/`; Windows puts `node_modules` directly in
 * the prefix. Asserting the platform-correct path is the point of running this
 * suite on all three operating systems rather than Linux alone.
 */
function globalPackageDir(prefix: string, pkg: string): string {
  return IS_WINDOWS ? join(prefix, "node_modules", pkg) : join(prefix, "lib", "node_modules", pkg);
}

async function main(): Promise<void> {
  const root = mkdtempSync(join(tmpdir(), "domaininstall-e2e-"));
  const project = join(root, "project");
  const state = join(root, "state");
  const globalPrefix = join(root, "npm-global-prefix");

  console.log(`\nplatform: ${process.platform}  node: ${process.version}`);
  console.log(`target:   ${domain} -> ${expectedPackage}`);

  try {
    mkdirSync(project);
    mkdirSync(globalPrefix);
    writeFileSync(
      join(project, "package.json"),
      JSON.stringify({ name: "domaininstall-e2e", version: "1.0.0", private: true }),
    );

    step(`project-scoped install: di ${domain} --yes`);
    const installCode = await run([domain, "--yes"], project, state);
    if (installCode !== 0) throw new Error(`di exited with code ${installCode}`);

    if (!existsSync(join(project, "node_modules", expectedPackage))) {
      throw new Error(`${expectedPackage} was not installed into the project`);
    }

    step("TOFU pin was recorded");
    const afterInstall = readPinFile(state);
    const pin = afterInstall.pins?.[domain];
    if (afterInstall.version !== 1 || pin?.package !== expectedPackage) {
      throw new Error(`expected a ${domain} -> ${expectedPackage} TOFU pin`);
    }
    if (!pin.registry?.startsWith("https://")) {
      throw new Error(`expected the pin to record an HTTPS registry, got ${String(pin.registry)}`);
    }
    const firstSeen = pin.firstSeen;
    if (!firstSeen) throw new Error("expected the pin to record firstSeen");

    step(`global install into an isolated prefix: di ${domain} --global --yes`);
    const globalCode = await run([domain, "--global", "--yes"], project, state, {
      // npm reads npm_config_prefix, so the CLI's own `npm config get prefix`
      // preview and the install itself agree on this temporary location.
      npm_config_prefix: globalPrefix,
    });
    if (globalCode !== 0) throw new Error(`di --global exited with code ${globalCode}`);

    const installedGlobally = globalPackageDir(globalPrefix, expectedPackage);
    if (!existsSync(installedGlobally)) {
      throw new Error(`${expectedPackage} was not installed globally at ${installedGlobally}`);
    }

    step("pin continuity across a second install");
    const afterGlobal = readPinFile(state);
    const updated = afterGlobal.pins?.[domain];
    if (updated?.firstSeen !== firstSeen) {
      throw new Error("a matching second install must not reset firstSeen");
    }
    if (!updated.lastSeen || updated.lastSeen < firstSeen) {
      throw new Error("expected lastSeen to be refreshed by the second install");
    }

    step(`di verify ${domain}`);
    const verifyCode = await run(["verify", domain], project, state);
    if (verifyCode !== 0) throw new Error(`di verify exited with code ${verifyCode}`);

    console.log(
      `\n✔ live E2E passed on ${process.platform}: ${domain} -> ${expectedPackage}` +
        ` -> project install -> global install -> pin continuity -> di verify\n`,
    );
  } finally {
    removeTree(root);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
