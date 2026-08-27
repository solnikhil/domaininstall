/**
 * Product-claim regression gate.
 *
 * The exact demo copy is snapshotted for deliberate review, while policy
 * checks cover both rendered CLI output and demo story sources so a future
 * hard-coded label cannot bypass the shared copy object.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { CLI_CLAIM_BOUNDARY } from "../dist/claims.js";
import { DEMO_CLAIM_COPY } from "../demo/src/claim-copy.ts";

const root = join(import.meta.dirname, "..");
let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    passed++;
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
    return;
  }
  failed++;
  console.log(`  \x1b[31m✖ ${name}\x1b[0m`);
  if (detail) console.log(`    ${detail}`);
}

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

function runCli(args: string[]): { status: number | null; output: string } {
  const result = spawnSync(process.execPath, [join(root, "dist", "cli.js"), ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

type ForbiddenClaim = { label: string; pattern: RegExp };
const FORBIDDEN_UNQUALIFIED_CLAIMS: ForbiddenClaim[] = [
  { label: '"vouches for"', pattern: /\bvouches?\s+for\b/i },
  { label: "package authenticity", pattern: /\bauthentic(?:ity)?\b/i },
  { label: "typosquat verdict", pattern: /\btyposquat(?:s|ting)?\b/i },
  { label: '"verified package"', pattern: /\bverified\s+(?:safe\s+)?package\b/i },
  { label: '"safe package"', pattern: /\bsafe\s+package\b/i },
  {
    label: "affirmative package-safety promise",
    pattern: /\b(?:makes?|keeps?|guarantees?|certifies?)\s+(?:the\s+)?package\s+safe\b/i,
  },
];

function violations(surface: string, content: string): string[] {
  return FORBIDDEN_UNQUALIFIED_CLAIMS.flatMap(({ label, pattern }) =>
    pattern.test(content) ? [`${surface}: ${label}`] : [],
  );
}

console.log("\n========== Product claim guard ==========");

const expectedDemoCopy = JSON.parse(read("demo/tests/claim-copy.snapshot.json")) as unknown;
check(
  "demo claim copy matches the reviewed snapshot",
  JSON.stringify(DEMO_CLAIM_COPY) === JSON.stringify(expectedDemoCopy),
  "Copy changed without updating the reviewed claim snapshot.",
);

const getStarted = runCli([]);
const help = runCli(["--help"]);
check("CLI onboarding renders successfully", getStarted.status === 0);
check("CLI help renders successfully", help.status === 0);
check(
  "CLI onboarding states the declaration/safety boundary",
  getStarted.output.includes(CLI_CLAIM_BOUNDARY),
);
check("CLI help states the declaration/safety boundary", help.output.includes(CLI_CLAIM_BOUNDARY));
check(
  "demo visibly states the declaration/safety boundary",
  DEMO_CLAIM_COPY.verify.boundary.includes("declaration") &&
    DEMO_CLAIM_COPY.verify.boundary.includes("not package safety") &&
    DEMO_CLAIM_COPY.verify.boundary.includes("publisher identity"),
);

const surfaces: Array<[string, string]> = [
  ["CLI onboarding", getStarted.output],
  ["CLI help", help.output],
  ["README", read("README.md")],
  ["demo claim copy", JSON.stringify(DEMO_CLAIM_COPY)],
  ["demo Hook", read("demo/src/story/Hook.tsx")],
  ["demo Verify", read("demo/src/story/Verify.tsx")],
  ["demo story cues", read("demo/src/Story.tsx")],
];
const found = surfaces.flatMap(([surface, content]) => violations(surface, content));
check(
  "CLI, README, and demo contain no unqualified authenticity/safety verdicts",
  found.length === 0,
  found.join("; "),
);

const hookSource = read("demo/src/story/Hook.tsx");
const verifySource = read("demo/src/story/Verify.tsx");
check(
  "demo scenes consume the governed claim copy",
  hookSource.includes("DEMO_CLAIM_COPY.hook.declaredBadge") &&
    hookSource.includes("DEMO_CLAIM_COPY.hook.otherBadge") &&
    verifySource.includes("DEMO_CLAIM_COPY.verify.verdict") &&
    verifySource.includes("DEMO_CLAIM_COPY.verify.boundary"),
);

console.log(`\n${failed === 0 ? "\x1b[32m" : "\x1b[31m"}${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed === 0 ? 0 : 1);
