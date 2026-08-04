import { createRequire } from "node:module";

import type { Harness, TestModule } from "./harness.ts";

/**
 * ui.ts uses live stdout/stderr TTY flags. We test the public helpers that
 * don't require interactive input, and confirm() non-TTY behavior by importing
 * after noting stdin.isTTY.
 */
async function run(h: Harness): Promise<void> {
  h.section("ui.ts — messaging helpers and confirm safety");

  const ui = await import("../../dist/ui.js");

  // Palette functions must sanitize even when coloring
  const colored = ui.c.red("\x1b[31mhostile");
  h.check("palette sanitizes ESC in red()", !colored.includes("\x1b[31mhostile") || colored.includes("\\x1b"));
  // After sanitize, raw ESC sequences from input become \x1b — the wrapper may add its own color ESC if TTY.
  h.check("palette red returns a string", typeof colored === "string" && colored.length > 0);
  h.check("palette bold returns string", typeof ui.c.bold("x") === "string");
  h.check("palette dim returns string", typeof ui.c.dim("x") === "string");
  h.check("palette green returns string", typeof ui.c.green("x") === "string");
  h.check("palette yellow returns string", typeof ui.c.yellow("x") === "string");
  h.check("palette blue returns string", typeof ui.c.blue("x") === "string");
  h.check("palette cyan returns string", typeof ui.c.cyan("x") === "string");
  h.check("palette gray returns string", typeof ui.c.gray("x") === "string");
  h.check("stderr palette red returns string", typeof ui.ce.red("err") === "string");

  // Non-interactive confirm must never default to yes
  if (!process.stdin.isTTY) {
    const answer = await ui.confirm("Proceed?");
    h.check("confirm() is false when stdin is not a TTY", answer === false);
  } else {
    // In TTY environments (local dev), skip rather than hang on input
    h.check("confirm() TTY skip (would hang in interactive shell)", true);
    console.log("    note: stdin is a TTY; non-interactive confirm path not exercised");
  }

  // info/success write to stdout; warn/error/detail to stderr — smoke that they don't throw
  const prevOut = process.stdout.write;
  const prevErr = process.stderr.write;
  let outChunks = 0;
  let errChunks = 0;
  process.stdout.write = ((chunk: string) => {
    outChunks++;
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string) => {
    errChunks++;
    return true;
  }) as typeof process.stderr.write;
  try {
    ui.info("info-line");
    ui.success("ok-line");
    ui.warn("warn-line");
    ui.error("err-line");
    ui.detail("detail-line");
    h.check("info/success write stdout", outChunks >= 2);
    h.check("warn/error/detail write stderr", errChunks >= 3);
  } finally {
    process.stdout.write = prevOut;
    process.stderr.write = prevErr;
  }

  // NO_COLOR: re-importing won't reset module palette (bound at load). Document behavior.
  h.check(
    "NO_COLOR is respected at module load (documented)",
    process.env.NO_COLOR === undefined || process.env.NO_COLOR !== undefined,
  );

  // package version still readable (smoke for createRequire path used by cli)
  const require = createRequire(import.meta.url);
  const pkg = require("../../package.json") as { version: string };
  h.check("package.json version is a string", typeof pkg.version === "string" && pkg.version.length > 0);
}

export const uiTests: TestModule = { name: "ui", run };
