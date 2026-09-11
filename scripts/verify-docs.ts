import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const cli = join(root, "dist", "cli.js");

function fail(message: string): never {
  throw new Error(`documentation verification failed: ${message}`);
}

function run(args: string[]): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
    shell: false,
  });
  if (result.error) fail(`${args.join(" ")} could not run: ${result.error.message}`);
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

const help = run(["--help"]);
if (help.status !== 0) fail("--help exited nonzero");

const documentedHelpFragments = [
  "di <domain>[/sub][@version] [-g]",
  "di verify <domain>",
  "di setup <domain>[/sub] <package>[@range]",
  "di trust list",
  "di trust forget <domain> [--force]",
  "di trust reset --all [--force]",
];
for (const fragment of documentedHelpFragments) {
  if (!help.stdout.includes(fragment)) fail(`CLI help is missing documented command: ${fragment}`);
}

const setup = run(["setup", "example.com", "example-package@^2"]);
if (setup.status !== 0 || !setup.stdout.includes("dnstall=pkg:npm/example-package@^2")) {
  fail("reference producer command does not emit the documented mapping");
}

const recordFormat = readFileSync(join(root, "docs", "RECORD-FORMAT.md"), "utf8");
if (recordFormat.includes("di verify <domain> --json")) {
  fail("record specification advertises the unimplemented verify --json interface");
}
for (const reference of ["di setup <domain> <package>[@range]", "di verify <domain>"]) {
  if (!recordFormat.includes(reference)) fail(`record specification is missing reference command: ${reference}`);
}

const publisherGuide = readFileSync(join(root, "docs", "m4", "PUBLISHER-GUIDE.md"), "utf8");
if (/There is no `di setup` command/i.test(publisherGuide)) fail("publisher guide contains stale setup guidance");
if (!publisherGuide.includes("di setup <domain> <package>[@range]")) {
  fail("publisher guide does not use the shipped setup command");
}

const readme = readFileSync(join(root, "README.md"), "utf8");
if (!/This `main`-branch README\s*>?\s*documents the next release candidate/u.test(readme)) {
  fail("README does not distinguish main documentation from released documentation");
}

process.stdout.write("✔ shipped command documentation matches CLI help and reference commands\n");
