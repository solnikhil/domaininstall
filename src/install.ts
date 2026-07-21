/** Safe npm-only package-manager handoff for the current alpha. */

import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { sanitizeTerminalText } from "./terminal.js";

const NON_NPM_LOCKFILES = ["pnpm-lock.yaml", "yarn.lock", "bun.lock", "bun.lockb"] as const;

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

/** Ask npm for its effective registry, validate it, then pin it as a CLI flag. */
export function resolveNpmRegistry(cwd = process.cwd()): RegistryResult {
  const result = spawnSync("npm", ["config", "get", "registry"], {
    cwd,
    encoding: "utf8",
    shell: false,
    timeout: 5000,
  });
  if (result.error) return { ok: false, error: `Could not read npm's effective registry: ${result.error.message}` };
  if (result.status !== 0) return { ok: false, error: "npm config get registry failed." };

  const lines = result.stdout.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length !== 1) return { ok: false, error: "npm returned an invalid registry value." };

  let url: URL;
  try {
    url = new URL(lines[0]!);
  } catch {
    return { ok: false, error: "npm returned a malformed registry URL." };
  }
  if (url.protocol !== "https:") return { ok: false, error: "The npm registry must use HTTPS." };
  if (url.username || url.password || url.search || url.hash) {
    return { ok: false, error: "The npm registry URL must not contain credentials, a query, or a fragment." };
  }
  return { ok: true, registry: url.href };
}

export interface InstallPlan {
  pm: "npm";
  spec: string;
  registry: string;
  argv: string[];
  display: string;
}

export function buildInstallPlan(pkg: string, version: string | undefined, registry: string): InstallPlan {
  const spec = version ? `${pkg}@${version}` : pkg;
  const argv = ["install", "--ignore-scripts", `--registry=${registry}`, spec];
  return { pm: "npm", spec, registry, argv, display: `npm ${argv.join(" ")}` };
}

export function runInstall(plan: InstallPlan): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn("npm", plan.argv, {
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
