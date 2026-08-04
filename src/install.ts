/** Safe npm-only package-manager handoff for the current alpha. */

import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
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
  argv: string[];
  display: string;
}

export function buildInstallPlan(
  pkg: string,
  version: string | undefined,
  registry: string,
  options: { global?: boolean } = {},
): InstallPlan {
  const spec = version ? `${pkg}@${version}` : pkg;
  const global = options.global === true;
  const argv = ["install", "--ignore-scripts"];
  if (global) argv.push("--global");
  argv.push(`--registry=${registry}`, spec);
  return { pm: "npm", spec, registry, global, argv, display: `npm ${argv.join(" ")}` };
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
