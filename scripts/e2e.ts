/**
 * Live end-to-end test.
 *
 * Resolves a real _dnstall TXT record, runs the compiled CLI non-interactively,
 * installs the vouched package into a temporary project, and verifies the TOFU
 * pin. State is isolated from the user's real ~/.domaininstall directory.
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

function run(command: string, args: string[], cwd: string, stateDir: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, DOMAININSTALL_STATE_DIR: stateDir },
      stdio: "inherit",
      shell: false,
    });
    child.on("error", () => resolve(127));
    child.on("close", (code) => resolve(code ?? 1));
  });
}

async function main(): Promise<void> {
  const root = mkdtempSync(join(tmpdir(), "domaininstall-e2e-"));
  const project = join(root, "project");
  const state = join(root, "state");

  try {
    mkdirSync(project);
    writeFileSync(
      join(project, "package.json"),
      JSON.stringify({ name: "domaininstall-e2e", version: "1.0.0", private: true }),
    );

    console.log(`\nResolving and installing ${domain} through di...\n`);
    const code = await run(process.execPath, [cli, domain, "--yes"], project, state);
    if (code !== 0) throw new Error(`di exited with code ${code}`);

    if (!existsSync(join(project, "node_modules", expectedPackage))) {
      throw new Error(`${expectedPackage} was not installed`);
    }

    const pins = JSON.parse(readFileSync(join(state, "pins.json"), "utf8")) as Record<
      string,
      { package?: string }
    >;
    if (pins[domain]?.package !== expectedPackage) {
      throw new Error(`expected a ${domain} -> ${expectedPackage} TOFU pin`);
    }

    console.log(`\n✔ live E2E passed: ${domain} -> ${expectedPackage} -> npm install\n`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
