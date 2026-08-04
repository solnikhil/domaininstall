/**
 * Exhaustive modular unit + CLI integration suite.
 * Complements scripts/test.ts (security gate suite) with per-module coverage.
 *
 * Run via: npm test  (after the primary suite) or npm run test:exhaustive
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createHarness, type TestModule } from "./tests/harness.ts";
import { recordTests } from "./tests/record.test.ts";
import { validateTests } from "./tests/validate.test.ts";
import { argsTests } from "./tests/args.test.ts";
import { terminalTests } from "./tests/terminal.test.ts";
import { installTests } from "./tests/install.test.ts";
import { dohTests } from "./tests/doh.test.ts";
import { uiTests } from "./tests/ui.test.ts";
import { pinTests } from "./tests/pin.test.ts";
import { cliTests } from "./tests/cli.test.ts";

const modules: TestModule[] = [
  recordTests,
  validateTests,
  argsTests,
  terminalTests,
  installTests,
  dohTests,
  uiTests,
  pinTests,
  cliTests,
];

async function main(): Promise<void> {
  // Isolate pin store before any pin module load (pin binds DIR at import time).
  const state = mkdtempSync(join(tmpdir(), "dnstall-exhaustive-state-"));
  process.env.DOMAININSTALL_STATE_DIR = state;

  console.log("\n========== Exhaustive module suite ==========");
  console.log(`Modules: ${modules.map((m) => m.name).join(", ")}`);

  const h = createHarness();

  for (const mod of modules) {
    try {
      await mod.run(h);
    } catch (error) {
      h.check(`${mod.name} module threw`, false, error instanceof Error ? error.message : String(error));
    }
  }

  rmSync(state, { recursive: true, force: true });

  console.log(
    `\n${h.fail === 0 ? "\x1b[32m" : "\x1b[31m"}Exhaustive: ${h.pass} passed, ${h.fail} failed\x1b[0m\n`,
  );
  process.exit(h.fail === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
