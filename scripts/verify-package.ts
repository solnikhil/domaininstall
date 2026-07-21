/** Build and inspect the exact npm tarball, then install and exercise it. */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const work = mkdtempSync(join(tmpdir(), "domaininstall-package-"));

function run(command: string, args: string[], cwd: string) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", shell: false });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed:\n${result.stdout}${result.stderr}`);
  }
  return result;
}

try {
  const packed = run("npm", ["pack", "--json", "--pack-destination", work], root);
  const packResult = JSON.parse(packed.stdout) as Array<{
    filename: string;
    files: Array<{ path: string }>;
  }>;
  if (packResult.length !== 1) throw new Error("npm pack did not produce exactly one artifact");

  const artifact = packResult[0]!;
  const paths = new Set(artifact.files.map((file) => file.path));
  for (const required of ["README.md", "LICENSE", "package.json", "dist/cli.js"]) {
    if (!paths.has(required)) throw new Error(`packed artifact is missing ${required}`);
  }
  for (const path of paths) {
    if (["src/", "scripts/", "demo/", "artifacts/"].some((prefix) => path.startsWith(prefix))) {
      throw new Error(`packed artifact unexpectedly contains ${path}`);
    }
  }

  const repackDirectory = join(work, "repack");
  mkdirSync(repackDirectory);
  const repacked = run("npm", ["pack", "--json", "--pack-destination", repackDirectory], root);
  const repackResult = JSON.parse(repacked.stdout) as Array<{ filename: string }>;
  if (repackResult.length !== 1) throw new Error("second npm pack did not produce exactly one artifact");
  const digest = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
  if (
    digest(join(work, artifact.filename)) !==
    digest(join(repackDirectory, repackResult[0]!.filename))
  ) {
    throw new Error("two consecutive npm packs produced different tarballs");
  }

  const project = join(work, "consumer");
  mkdirSync(project);
  writeFileSync(
    join(project, "package.json"),
    JSON.stringify({ name: "domaininstall-package-check", version: "1.0.0", private: true }),
  );
  run(
    "npm",
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", join(work, artifact.filename)],
    project,
  );

  const installedManifest = JSON.parse(
    readFileSync(join(project, "node_modules", "domaininstall", "package.json"), "utf8"),
  ) as { version?: string; dependencies?: Record<string, string>; bin?: Record<string, string> };
  if (installedManifest.version !== "0.0.2") throw new Error("installed version is not 0.0.2");
  if (installedManifest.dependencies && Object.keys(installedManifest.dependencies).length > 0) {
    throw new Error("domaininstall unexpectedly has production dependencies");
  }
  for (const alias of ["di", "domaininstall", "dnstall"]) {
    if (installedManifest.bin?.[alias] !== "dist/cli.js") throw new Error(`invalid ${alias} bin mapping`);
    const executable = join(project, "node_modules", ".bin", process.platform === "win32" ? `${alias}.cmd` : alias);
    const invocation = run(executable, ["--version"], project);
    if (invocation.stdout.trim() !== "0.0.2") throw new Error(`${alias} did not report version 0.0.2`);
  }

  console.log(`✔ package verified: ${artifact.filename}`);
  console.log(`✔ required files present; development sources excluded`);
  console.log(`✔ consecutive packs are byte-for-byte reproducible`);
  console.log(`✔ clean install has zero production dependencies`);
  console.log(`✔ di, domaininstall, and dnstall aliases execute`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
