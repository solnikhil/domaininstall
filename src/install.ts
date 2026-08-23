/** Safe npm-only package-manager handoff for the current alpha. */

import { spawn, spawnSync } from "node:child_process";
import { createHash, timingSafeEqual } from "node:crypto";
import {
  chmodSync,
  createReadStream,
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, delimiter, dirname, join, resolve } from "node:path";
import { sanitizeTerminalText } from "./terminal.js";

const NON_NPM_LOCKFILES = ["pnpm-lock.yaml", "yarn.lock", "bun.lock", "bun.lockb"] as const;

/**
 * How to invoke npm on this platform.
 *
 * On POSIX systems `npm` is an executable shim and can be spawned directly with
 * `shell: false`. On Windows it is `npm.cmd`, which Node refuses to spawn
 * without a shell, and running it through `cmd.exe` would expose npm arguments
 * to command-line parsing — a version range such as `^18` or `>=1 <2` contains
 * characters `cmd.exe` treats as escapes and redirections. So on Windows we
 * locate npm's own JavaScript entry point and run it with the current Node
 * binary, which is exactly what `npm.cmd` does internally, with no shell in the
 * middle.
 */
export interface NpmLauncher {
  /** Executable to spawn. */
  command: string;
  /** Arguments that must precede npm's own arguments. */
  prefixArgs: string[];
}

export interface NpmLauncherEnvironment {
  platform: string;
  /** Value of `PATH` (or `Path` on Windows). */
  pathValue: string;
  /** Value of `PATHEXT`, used to find the npm launcher on Windows. */
  pathExt: string;
  /** Separator between `PATH` entries on the target platform. */
  pathDelimiter: string;
  /** Path to the running Node binary. */
  execPath: string;
  /** `npm_execpath`, set when running inside an npm script. */
  npmExecPath: string | undefined;
  /** Windows per-user application data directory, where npm installs globals. */
  appData: string | undefined;
  exists: (candidate: string) => boolean;
}

export type NpmLauncherResult = { ok: true; launcher: NpmLauncher } | { ok: false; error: string };

const NPM_CLI_SCRIPT = join("node_modules", "npm", "bin", "npm-cli.js");

function defaultLauncherEnvironment(): NpmLauncherEnvironment {
  return {
    platform: process.platform,
    pathValue: process.env.PATH ?? process.env.Path ?? "",
    pathExt: process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD",
    pathDelimiter: delimiter,
    execPath: process.execPath,
    npmExecPath: process.env.npm_execpath,
    appData: process.env.APPDATA,
    exists: existsSync,
  };
}

/** Directories on `PATH` that contain an npm launcher. */
function npmLauncherDirectories(env: NpmLauncherEnvironment): string[] {
  // PATHEXT is conventionally upper case while the files on disk are usually
  // lower case. Windows itself is case-insensitive, so try both spellings.
  const extensions = new Set<string>([""]);
  for (const raw of env.pathExt.split(";")) {
    const extension = raw.trim();
    if (!extension) continue;
    extensions.add(extension);
    extensions.add(extension.toLowerCase());
  }
  const directories: string[] = [];
  for (const rawDirectory of env.pathValue.split(env.pathDelimiter)) {
    const directory = rawDirectory.replace(/^"|"$/g, "").trim();
    if (!directory) continue;
    if ([...extensions].some((extension) => env.exists(join(directory, `npm${extension}`)))) {
      directories.push(directory);
    }
  }
  return directories;
}

export function resolveNpmLauncher(overrides: Partial<NpmLauncherEnvironment> = {}): NpmLauncherResult {
  const env: NpmLauncherEnvironment = { ...defaultLauncherEnvironment(), ...overrides };

  if (env.platform !== "win32") {
    return { ok: true, launcher: { command: "npm", prefixArgs: [] } };
  }

  const candidates: string[] = [];
  if (env.npmExecPath && env.npmExecPath.toLowerCase().endsWith(".js")) {
    candidates.push(env.npmExecPath);
  }
  for (const directory of npmLauncherDirectories(env)) {
    candidates.push(join(directory, NPM_CLI_SCRIPT));
  }
  const nodeDirectory = dirname(env.execPath);
  candidates.push(join(nodeDirectory, NPM_CLI_SCRIPT));
  candidates.push(join(nodeDirectory, "..", "lib", NPM_CLI_SCRIPT));
  if (env.appData) candidates.push(join(env.appData, "npm", NPM_CLI_SCRIPT));

  for (const candidate of candidates) {
    if (env.exists(candidate)) {
      return { ok: true, launcher: { command: env.execPath, prefixArgs: [candidate] } };
    }
  }

  return {
    ok: false,
    error:
      "Could not locate npm's CLI entry point (node_modules/npm/bin/npm-cli.js) on this Windows system. " +
      "Install Node.js with npm, or make sure npm is on PATH, then try again.",
  };
}

let cachedLauncher: NpmLauncherResult | undefined;

function npmLauncher(): NpmLauncherResult {
  cachedLauncher ??= resolveNpmLauncher();
  return cachedLauncher;
}

export type NpmProjectResult =
  | { ok: true; hasProject: boolean; detectedFrom: string }
  | { ok: false; error: string };

export function detectNpmProject(cwd = process.cwd()): NpmProjectResult {
  const incompatibleLocks = NON_NPM_LOCKFILES.filter((file) => existsSync(join(cwd, file)));
  if (incompatibleLocks.length > 0) {
    return {
      ok: false,
      error: `The current alpha only supports npm; found ${incompatibleLocks.join(", ")}.`,
    };
  }

  const packageJson = join(cwd, "package.json");
  if (existsSync(packageJson)) {
    let manifest: unknown;
    try {
      manifest = JSON.parse(readFileSync(packageJson, "utf8")) as unknown;
    } catch {
      return { ok: false, error: "package.json is not valid JSON." };
    }
    if (typeof manifest === "object" && manifest !== null && !Array.isArray(manifest)) {
      const packageManager = (manifest as Record<string, unknown>).packageManager;
      if (typeof packageManager === "string" && !packageManager.startsWith("npm@")) {
        return {
          ok: false,
          error: `The current alpha only supports npm; package.json declares ${packageManager}.`,
        };
      }
    } else return { ok: false, error: "package.json must contain a JSON object." };
    return {
      ok: true,
      hasProject: true,
      detectedFrom: existsSync(join(cwd, "package-lock.json"))
        ? "package-lock.json"
        : existsSync(join(cwd, "npm-shrinkwrap.json"))
          ? "npm-shrinkwrap.json"
          : "package.json",
    };
  }

  return { ok: true, hasProject: false, detectedFrom: "default npm" };
}

export type RegistryResult = { ok: true; registry: string } | { ok: false; error: string };
export type NpmConfigResult = { ok: true; value: string } | { ok: false; error: string };

/** Read a single npm config value without involving a shell. */
function npmConfigGet(key: string, cwd: string): NpmConfigResult {
  const launcher = npmLauncher();
  if (!launcher.ok) return { ok: false, error: launcher.error };

  const result = spawnSync(launcher.launcher.command, [...launcher.launcher.prefixArgs, "config", "get", key], {
    cwd,
    encoding: "utf8",
    shell: false,
    timeout: 10000,
  });
  if (result.error) {
    return { ok: false, error: `Could not read npm configuration (${key}): ${result.error.message}` };
  }
  if (result.status !== 0) return { ok: false, error: `npm config get ${key} failed.` };
  if (typeof result.stdout !== "string") return { ok: false, error: `npm returned no value for ${key}.` };

  const lines = result.stdout.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length !== 1) return { ok: false, error: `npm returned an invalid value for ${key}.` };
  return { ok: true, value: lines[0]!.trim() };
}

/** npm prints these when a config key has no value. */
function isUnsetConfigValue(value: string): boolean {
  return value.length === 0 || value === "undefined" || value === "null";
}

/**
 * Normalize an HTTPS registry URL for pin and equality checks.
 * Lowercases the host and ensures the path ends with `/` so trailing-slash
 * drift from `npm config get` does not false-fail continuity checks.
 */
export function canonicalizeRegistryUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (!url.hostname || url.username || url.password || url.search || url.hash) return null;
  url.hostname = url.hostname.toLowerCase();
  if (!url.pathname.endsWith("/")) {
    url.pathname = `${url.pathname}/`;
  }
  return url.href;
}

function validateRegistryUrl(raw: string): RegistryResult {
  const registry = canonicalizeRegistryUrl(raw);
  if (!registry) {
    // Distinguish common failures for clearer errors.
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return { ok: false, error: "npm returned a malformed registry URL." };
    }
    if (url.protocol !== "https:") return { ok: false, error: "The npm registry must use HTTPS." };
    if (url.username || url.password || url.search || url.hash) {
      return { ok: false, error: "The npm registry URL must not contain credentials, a query, or a fragment." };
    }
    return { ok: false, error: "npm returned a malformed registry URL." };
  }
  return { ok: true, registry };
}

/** True when two registry URLs refer to the same host/path after canonicalization. */
export function registriesEqual(a: string, b: string): boolean {
  const left = canonicalizeRegistryUrl(a);
  const right = canonicalizeRegistryUrl(b);
  return left !== null && right !== null && left === right;
}

/** Ask npm for its default effective registry, then validate it. */
export function resolveNpmRegistry(cwd = process.cwd()): RegistryResult {
  const configured = npmConfigGet("registry", cwd);
  if (!configured.ok) return { ok: false, error: configured.error };
  if (isUnsetConfigValue(configured.value)) {
    return { ok: false, error: "npm returned an invalid registry value." };
  }
  return validateRegistryUrl(configured.value);
}

/** `@scope` of a package name, or null when the name is unscoped. */
export function npmScopeOf(pkg: string): string | null {
  if (!pkg.startsWith("@")) return null;
  const slash = pkg.indexOf("/");
  if (slash <= 1) return null;
  const scope = pkg.slice(0, slash);
  return /^@[a-z0-9][a-z0-9._-]*$/.test(scope) ? scope : null;
}

/**
 * The registry npm will actually use for this package.
 *
 * npm gives a scope-specific `@scope:registry` setting precedence over the
 * default registry, including over an explicit `--registry` flag. Rather than
 * display and pin one registry while npm quietly fetches from another, refuse
 * the install when the two disagree.
 */
export function resolveEffectiveRegistry(
  pkg: string,
  cwd = process.cwd(),
  /** Already-resolved default registry, to avoid asking npm twice. */
  knownDefaultRegistry?: string,
): RegistryResult {
  const base: RegistryResult = knownDefaultRegistry
    ? { ok: true, registry: knownDefaultRegistry }
    : resolveNpmRegistry(cwd);
  if (!base.ok) return base;

  const scope = npmScopeOf(pkg);
  if (!scope) return base;

  const scoped = npmConfigGet(`${scope}:registry`, cwd);
  if (!scoped.ok) return { ok: false, error: scoped.error };
  if (isUnsetConfigValue(scoped.value)) return base;

  const scopedRegistry = validateRegistryUrl(scoped.value);
  if (!scopedRegistry.ok) {
    return { ok: false, error: `npm routes ${scope} to an unsupported registry: ${scopedRegistry.error}` };
  }
  if (!registriesEqual(scopedRegistry.registry, base.registry)) {
    return {
      ok: false,
      error:
        `Your npm configuration routes ${scope} to ${scopedRegistry.registry}, not ${base.registry}. ` +
        "npm gives a scope-specific registry precedence over the registry domaininstall pins, so the " +
        `install is refused rather than shown against the wrong registry. Install ${pkg} with npm directly.`,
    };
  }
  // Prefer the already-canonical default so pins stay stable.
  return base;
}

/** Where a global install would place the package. */
export function resolveNpmGlobalPrefix(cwd = process.cwd()): NpmConfigResult {
  const prefix = npmConfigGet("prefix", cwd);
  if (!prefix.ok) return prefix;
  if (isUnsetConfigValue(prefix.value)) return { ok: false, error: "npm returned an empty global prefix." };
  return prefix;
}

export interface InstallPlan {
  pm: "npm";
  spec: string;
  registry: string;
  global: boolean;
  artifact: PreparedNpmArtifact;
  argv: string[];
  display: string;
}

export function buildInstallPlan(
  pkg: string,
  artifact: PreparedNpmArtifact,
  registry: string,
  options: { global?: boolean } = {},
): InstallPlan {
  const spec = `${pkg}@${artifact.version}`;
  const global = options.global === true;
  const argv = ["install", "--ignore-scripts"];
  if (global) argv.push("--global");
  // `--prefer-offline` is deliberate: the isolated cache contains a fresh,
  // post-confirmation packument plus the SRI-verified root tarball. npm can
  // still fetch missing transitive dependencies, but it cannot float the root
  // selector or substitute different root bytes without an integrity failure.
  argv.push(
    "--save-exact",
    "--prefer-offline",
    `--cache=${artifact.cacheDir}`,
    `--registry=${registry}`,
    spec,
  );
  const visible = ["install", "--ignore-scripts"];
  if (global) visible.push("--global");
  visible.push("--save-exact", `--registry=${registry}`, spec);
  return {
    pm: "npm",
    spec,
    registry,
    global,
    artifact,
    argv,
    display: `npm ${visible.join(" ")}`,
  };
}

const MAX_ARTIFACT_BYTES = 1024 * 1024 * 1024;
const EXACT_VERSION =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const SRI_STRENGTH = { sha256: 1, sha384: 2, sha512: 3 } as const;
type SupportedSriAlgorithm = keyof typeof SRI_STRENGTH;

export interface NpmArtifactIdentity {
  version: string;
  integrity: string;
  tarball: string;
}

export interface PreparedNpmArtifact extends NpmArtifactIdentity {
  resolvedAt: string;
  tarballPath: string;
  cacheDir: string;
  tempDir: string;
}

export type PrepareArtifactResult =
  | { ok: true; artifact: PreparedNpmArtifact }
  | { ok: false; error: string };

export type ArtifactMetadataResult =
  | { ok: true; artifact: NpmArtifactIdentity }
  | { ok: false; error: string };

function runNpmCapture(args: string[], cwd: string, timeout: number): NpmConfigResult {
  const launcher = npmLauncher();
  if (!launcher.ok) return { ok: false, error: launcher.error };
  const result = spawnSync(launcher.launcher.command, [...launcher.launcher.prefixArgs, ...args], {
    cwd,
    encoding: "utf8",
    shell: false,
    timeout,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error) return { ok: false, error: result.error.message };
  if (result.status !== 0) {
    const detail =
      typeof result.stderr === "string"
        ? sanitizeTerminalText(result.stderr.trim().slice(0, 4096))
        : "";
    return { ok: false, error: detail || `npm exited with code ${result.status ?? "unknown"}.` };
  }
  if (typeof result.stdout !== "string") return { ok: false, error: "npm returned no output." };
  return { ok: true, value: result.stdout };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Canonical HTTPS identity for a registry-provided tarball URL. */
export function canonicalizeTarballUrl(raw: string): string | null {
  if (raw.length === 0 || raw.length > 8192) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (
    url.protocol !== "https:" ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    return null;
  }
  url.hostname = url.hostname.toLowerCase();
  return url.href;
}

/** Strictly parse the three fields npm selected from a registry packument. */
export function parseNpmArtifactMetadata(stdout: string): ArtifactMetadataResult {
  let value: unknown;
  try {
    value = JSON.parse(stdout) as unknown;
  } catch {
    return { ok: false, error: "npm returned malformed JSON while resolving the package artifact." };
  }
  if (!isPlainObject(value)) {
    return { ok: false, error: "npm returned an ambiguous artifact selection instead of one exact version." };
  }
  const version = value.version;
  const integrity = value["dist.integrity"];
  const rawTarball = value["dist.tarball"];
  if (typeof version !== "string" || !EXACT_VERSION.test(version)) {
    return { ok: false, error: "The registry did not resolve the requested policy to one valid exact version." };
  }
  if (typeof integrity !== "string" || parseSri(integrity).length === 0) {
    return { ok: false, error: `The registry returned no supported SRI for ${version}.` };
  }
  if (typeof rawTarball !== "string") {
    return { ok: false, error: `The registry returned no tarball URL for ${version}.` };
  }
  const tarball = canonicalizeTarballUrl(rawTarball);
  if (!tarball) {
    return { ok: false, error: `The registry returned an unsafe tarball URL for ${version}.` };
  }
  return {
    ok: true,
    artifact: { version, integrity, tarball },
  };
}

interface SriDigest {
  algorithm: SupportedSriAlgorithm;
  digest: Buffer;
}

function parseSri(value: string): SriDigest[] {
  const parsed: SriDigest[] = [];
  for (const token of value.trim().split(/\s+/)) {
    const match = /^(sha256|sha384|sha512)-([A-Za-z0-9+/]+={0,2})(?:\?[^\s]+)?$/.exec(token);
    if (!match) continue;
    const algorithm = match[1] as SupportedSriAlgorithm;
    const encoded = match[2]!;
    const digest = Buffer.from(encoded, "base64");
    if (digest.length === 0 || digest.toString("base64") !== encoded) continue;
    parsed.push({ algorithm, digest });
  }
  if (parsed.length === 0) return [];
  const strongest = Math.max(...parsed.map((entry) => SRI_STRENGTH[entry.algorithm]));
  return parsed.filter((entry) => SRI_STRENGTH[entry.algorithm] === strongest);
}

/** Verify bytes against the strongest supported algorithm present in the SRI. */
export async function verifyArtifactIntegrity(path: string, integrity: string): Promise<boolean> {
  const expected = parseSri(integrity);
  if (expected.length === 0) return false;
  const algorithm = expected[0]!.algorithm;
  const hash = createHash(algorithm);
  try {
    for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
  } catch {
    return false;
  }
  const actual = hash.digest();
  return expected.some(
    (entry) => entry.digest.length === actual.length && timingSafeEqual(entry.digest, actual),
  );
}

function resolveMetadata(
  pkg: string,
  version: string,
  registry: string,
  cacheDir: string,
  cwd: string,
): ArtifactMetadataResult {
  const spec = `${pkg}@${version}`;
  const output = runNpmCapture(
    [
      "view",
      spec,
      "version",
      "dist.integrity",
      "dist.tarball",
      "--json",
      "--prefer-online",
      `--cache=${cacheDir}`,
      `--registry=${registry}`,
    ],
    cwd,
    30_000,
  );
  if (!output.ok) return { ok: false, error: `Could not resolve ${spec}: ${output.error}` };
  return parseNpmArtifactMetadata(output.value);
}

export interface PackedArtifactSelection {
  version: string;
  integrity: string;
  tarballPath: string;
}

/** Parse npm pack's one selected artifact, never npm view's multi-version range output. */
export function parsePackedArtifactSelection(
  stdout: string,
  tempDir: string,
  expectedPackage: string,
): PackedArtifactSelection | null {
  let value: unknown;
  try {
    value = JSON.parse(stdout) as unknown;
  } catch {
    return null;
  }
  if (!Array.isArray(value) || value.length !== 1 || !isPlainObject(value[0])) return null;
  const name = value[0].name;
  const version = value[0].version;
  const integrity = value[0].integrity;
  const filename = value[0].filename;
  if (name !== expectedPackage || typeof version !== "string" || !EXACT_VERSION.test(version)) return null;
  if (typeof integrity !== "string" || parseSri(integrity).length === 0) return null;
  if (typeof filename !== "string" || filename !== basename(filename) || !filename.endsWith(".tgz")) return null;
  const candidate = resolve(tempDir, filename);
  if (dirname(candidate) !== resolve(tempDir)) return null;
  try {
    const stat = lstatSync(candidate);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0 || stat.size > MAX_ARTIFACT_BYTES) return null;
  } catch {
    return null;
  }
  return { version, integrity, tarballPath: candidate };
}

export function disposePreparedArtifact(artifact: PreparedNpmArtifact): void {
  const expectedParent = resolve(tmpdir());
  const target = resolve(artifact.tempDir);
  if (dirname(target) !== expectedParent || !basename(target).startsWith("domaininstall-artifact-")) return;
  try {
    rmSync(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  } catch {
    // Cleanup must not replace the install result. The private random temp
    // directory contains only public package bytes and npm cache metadata.
  }
}

/** Resolve once, download with npm's auth, then independently verify the bytes. */
export async function prepareNpmArtifact(
  pkg: string,
  selector: string | undefined,
  registry: string,
  cwd = process.cwd(),
): Promise<PrepareArtifactResult> {
  const tempDir = mkdtempSync(join(tmpdir(), "domaininstall-artifact-"));
  if (process.platform !== "win32") chmodSync(tempDir, 0o700);
  const cacheDir = join(tempDir, "npm-cache");
  let prepared: PreparedNpmArtifact | undefined;
  try {
    const requestedSpec = selector ? `${pkg}@${selector}` : pkg;
    // npm pack and npm install share npm's pacote resolver. Let that resolver
    // select one exact version directly; `npm view pkg@range ... --json` is not
    // suitable here because it returns an array for ranges with many releases.
    const packed = runNpmCapture(
      [
        "pack",
        requestedSpec,
        "--ignore-scripts",
        "--json",
        `--pack-destination=${tempDir}`,
        "--prefer-online",
        `--cache=${cacheDir}`,
        `--registry=${registry}`,
      ],
      cwd,
      120_000,
    );
    if (!packed.ok) return { ok: false, error: `Could not resolve and download ${requestedSpec}: ${packed.error}` };
    const selection = parsePackedArtifactSelection(packed.value, tempDir, pkg);
    if (!selection) return { ok: false, error: "npm produced an invalid or oversized package archive." };

    // Exact-version metadata is always one object. It supplies the canonical
    // tarball URL and registry SRI for the exact artifact npm pack selected.
    const selected = resolveMetadata(pkg, selection.version, registry, cacheDir, cwd);
    if (!selected.ok) return selected;
    const identity = selected.artifact;
    if (identity.version !== selection.version || identity.integrity !== selection.integrity) {
      return { ok: false, error: `Registry metadata did not match npm's selected ${pkg}@${selection.version}.` };
    }
    if (!(await verifyArtifactIntegrity(selection.tarballPath, identity.integrity))) {
      return { ok: false, error: `Downloaded bytes for ${pkg}@${identity.version} do not match the resolved SRI.` };
    }
    prepared = {
      version: identity.version,
      integrity: identity.integrity,
      tarball: identity.tarball,
      resolvedAt: new Date().toISOString(),
      tarballPath: selection.tarballPath,
      cacheDir,
      tempDir,
    };
    return { ok: true, artifact: prepared };
  } finally {
    if (!prepared) {
      disposePreparedArtifact({
        version: "0.0.0",
        integrity: "",
        tarball: "",
        resolvedAt: "",
        tarballPath: "",
        cacheDir,
        tempDir,
      });
    }
  }
}

/** Re-fetch exact metadata after confirmation and seed only the verified bytes. */
export async function recheckAndSeedNpmArtifact(
  pkg: string,
  artifact: PreparedNpmArtifact,
  registry: string,
  cwd = process.cwd(),
): Promise<RegistryResult> {
  const current = resolveMetadata(pkg, artifact.version, registry, artifact.cacheDir, cwd);
  if (!current.ok) return { ok: false, error: current.error };
  const next = current.artifact;
  if (
    next.version !== artifact.version ||
    next.integrity !== artifact.integrity ||
    next.tarball !== artifact.tarball
  ) {
    return {
      ok: false,
      error:
        `Registry artifact metadata for ${pkg}@${artifact.version} changed after confirmation. ` +
        "Installation is refused; resolve and review it again.",
    };
  }
  if (!(await verifyArtifactIntegrity(artifact.tarballPath, artifact.integrity))) {
    return { ok: false, error: "The verified package archive changed before npm handoff." };
  }
  const seeded = runNpmCapture(
    ["cache", "add", artifact.tarballPath, "--ignore-scripts", `--cache=${artifact.cacheDir}`],
    cwd,
    120_000,
  );
  if (!seeded.ok) return { ok: false, error: `Could not seed the verified npm artifact: ${seeded.error}` };
  let archiveStillValid = false;
  try {
    const after = statSync(artifact.tarballPath);
    archiveStillValid = after.isFile() && after.size > 0 && after.size <= MAX_ARTIFACT_BYTES;
  } catch {
    archiveStillValid = false;
  }
  if (!archiveStillValid) {
    return { ok: false, error: "The verified package archive changed before npm handoff." };
  }
  return { ok: true, registry };
}

/**
 * Re-read npm config and ensure the package still resolves to `expectedRegistry`.
 * Closes a TOCTOU window where @scope:registry could change after preview/confirm.
 */
export function assertEffectiveRegistryUnchanged(
  pkg: string,
  expectedRegistry: string,
  cwd = process.cwd(),
): RegistryResult {
  // Call resolveEffectiveRegistry WITHOUT knownDefaultRegistry so both default
  // and scoped registries are re-read from npm.
  const resolved = resolveEffectiveRegistry(pkg, cwd);
  if (!resolved.ok) return resolved;
  if (!registriesEqual(resolved.registry, expectedRegistry)) {
    return {
      ok: false,
      error:
        `npm configuration changed since confirmation: ${pkg} now resolves to ${resolved.registry}, ` +
        `not the confirmed registry ${expectedRegistry}. Install is refused.`,
    };
  }
  return resolved;
}

export function runInstall(plan: InstallPlan): Promise<number> {
  return new Promise((resolve) => {
    const launcher = npmLauncher();
    if (!launcher.ok) {
      process.stderr.write(`${sanitizeTerminalText(launcher.error)}\n`);
      resolve(127);
      return;
    }

    const child = spawn(launcher.launcher.command, [...launcher.launcher.prefixArgs, ...plan.argv], {
      stdio: "inherit",
      shell: false,
    });
    child.on("error", (err) => {
      process.stderr.write(`Failed to launch npm: ${sanitizeTerminalText(err.message)}\n`);
      resolve(127);
    });
    child.on("close", (code) => resolve(code ?? 1));
  });
}
