/**
 * Package-manager detection and safe install handoff.
 *
 * Security rule #1: we NEVER build a shell string. Arguments are passed as an
 * argv array to spawn() with shell:false, so DNS-derived values can never be
 * interpreted as shell syntax. Values are also validated before they reach here.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

const LOCKFILES: Array<{ file: string; pm: PackageManager }> = [
  { file: "bun.lockb", pm: "bun" },
  { file: "bun.lock", pm: "bun" },
  { file: "pnpm-lock.yaml", pm: "pnpm" },
  { file: "yarn.lock", pm: "yarn" },
  { file: "package-lock.json", pm: "npm" },
  { file: "npm-shrinkwrap.json", pm: "npm" },
];

export interface ProjectContext {
  pm: PackageManager;
  hasProject: boolean;
  detectedFrom: string;
}

/** Detect the package manager from the current project, defaulting to npm. */
export function detectPackageManager(cwd = process.cwd()): ProjectContext {
  for (const { file, pm } of LOCKFILES) {
    if (existsSync(join(cwd, file))) {
      return { pm, hasProject: true, detectedFrom: file };
    }
  }
  const hasProject = existsSync(join(cwd, "package.json"));
  return { pm: "npm", hasProject, detectedFrom: hasProject ? "package.json (default npm)" : "default" };
}

/** The add/install subcommand for each package manager. */
function installArgs(pm: PackageManager, spec: string): string[] {
  switch (pm) {
    case "npm":
      return ["install", spec];
    case "pnpm":
    case "yarn":
    case "bun":
      return ["add", spec];
  }
}

export interface InstallPlan {
  pm: PackageManager;
  spec: string; // e.g. "stripe@^18"
  argv: string[]; // full argv passed to the PM
  display: string; // human-readable command for the confirmation prompt
}

export function buildInstallPlan(pm: PackageManager, pkg: string, version?: string): InstallPlan {
  const spec = version ? `${pkg}@${version}` : pkg;
  const args = installArgs(pm, spec);
  return { pm, spec, argv: args, display: `${pm} ${args.join(" ")}` };
}

/** Run the install. Returns the child process exit code. */
export function runInstall(plan: InstallPlan): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(plan.pm, plan.argv, {
      stdio: "inherit",
      shell: false, // critical: no shell interpretation, ever
    });
    child.on("error", (err) => {
      process.stderr.write(`Failed to launch ${plan.pm}: ${err.message}\n`);
      resolve(127);
    });
    child.on("close", (code) => resolve(code ?? 1));
  });
}

/** Registry hostname for a namespace (shown to the user; npm only for v0). */
export function registryFor(namespace: string): string {
  switch (namespace) {
    case "npm":
      return "registry.npmjs.org";
    case "pypi":
      return "pypi.org";
    case "cargo":
      return "crates.io";
    default:
      return namespace;
  }
}
