/**
 * Minimal assertion harness shared by modular unit tests.
 * Matches the style of scripts/test.ts (no external test framework).
 */

export type CheckFn = (name: string, cond: boolean, detail?: string) => void;

export interface Harness {
  check: CheckFn;
  section: (title: string) => void;
  pass: number;
  fail: number;
}

export function createHarness(): Harness {
  let pass = 0;
  let fail = 0;

  const check: CheckFn = (name, cond, detail) => {
    if (cond) {
      pass++;
      console.log(`  \x1b[32m✔\x1b[0m ${name}`);
    } else {
      fail++;
      console.log(`  \x1b[31m✖ ${name}\x1b[0m`);
      if (detail) console.log(`    ${detail}`);
    }
  };

  const section = (title: string) => {
    console.log(`\n${title}`);
  };

  return {
    check,
    section,
    get pass() {
      return pass;
    },
    get fail() {
      return fail;
    },
  };
}

export type TestModule = {
  name: string;
  run: (h: Harness) => void | Promise<void>;
};
