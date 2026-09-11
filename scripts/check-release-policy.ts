/**
 * Static guardrails for the release workflow's security-critical dependency
 * graph. This intentionally uses no YAML dependency: production dependencies
 * stay at zero, and CI can detect release-policy drift before packaging.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const workflowsDirectory = join(root, ".github", "workflows");
const publishPath = join(workflowsDirectory, "publish.yml");
const e2ePath = join(workflowsDirectory, "e2e.yml");
const bootstrapPath = join(workflowsDirectory, "publish-bootstrap.yml");
const releaseDocsPath = join(root, "docs", "RELEASE.md");

const publish = readFileSync(publishPath, "utf8");
const e2e = readFileSync(e2ePath, "utf8");
const releaseDocs = readFileSync(releaseDocsPath, "utf8");

const failures: string[] = [];

function requirePolicy(condition: boolean, message: string): void {
  if (!condition) failures.push(message);
}

function matches(text: string, pattern: RegExp): boolean {
  return pattern.test(text.replaceAll("\r\n", "\n"));
}

requirePolicy(!existsSync(bootstrapPath), "the retired token bootstrap workflow must remain removed");
requirePolicy(
  matches(publish, /^on:\n  push:\n    tags: \["v\*"\]\n  workflow_dispatch:/m),
  "publication must be tag-triggered (with dispatch available only for an exact-tag retry)",
);
requirePolicy(
  matches(publish, /^concurrency:\n(?:  .*\n)*  group: npm-publish-\$\{\{ github\.ref \}\}\n  cancel-in-progress: false/m),
  "publication must serialize attempts for the same tag",
);
requirePolicy(
  matches(
    publish,
    /^  live-e2e:\n(?:    .*\n)*?    if: github\.ref_type == 'tag'\n(?:    .*\n)*?    uses: \.\/\.github\/workflows\/e2e\.yml/m,
  ),
  "the release graph must call the reusable live E2E workflow at its exact ref",
);
requirePolicy(matches(e2e, /^  workflow_call:$/m), "live E2E must remain reusable by the release graph");
requirePolicy(
  matches(e2e, /^        os: \[ubuntu-latest, macos-latest, windows-latest\]$/m),
  "live E2E must require Linux, macOS, and Windows",
);
requirePolicy(matches(e2e, /^      fail-fast: false$/m), "live E2E must report every required platform result");
requirePolicy(
  matches(
    publish,
    /^  publish:\n(?:    .*\n)*?    needs: live-e2e\n    if: needs\.live-e2e\.result == 'success' && github\.ref_type == 'tag'/m,
  ),
  "the publish job must depend on a successful live E2E call for a tag",
);
requirePolicy(
  matches(publish, /^    environment: npm-production$/m),
  "the publish job must retain protected-environment approval",
);
requirePolicy(
  matches(publish, /^    permissions:\n      contents: read\n      id-token: write$/m),
  "the publish job must use narrowly scoped trusted-publishing permissions",
);
requirePolicy(
  !matches(publish, /^\s+ref:/m) && !matches(e2e, /^\s+ref:/m),
  "release and E2E checkout must not override the triggering tag SHA",
);

const workflowPublishers = readdirSync(workflowsDirectory)
  .filter((file) => file.endsWith(".yml") || file.endsWith(".yaml"))
  .filter((file) => readFileSync(join(workflowsDirectory, file), "utf8").includes("npm publish"));
requirePolicy(
  workflowPublishers.length === 1 && workflowPublishers[0] === basename(publishPath),
  "publish.yml must be the only workflow capable of invoking npm publish",
);
requirePolicy(
  !readdirSync(workflowsDirectory)
    .filter((file) => file.endsWith(".yml") || file.endsWith(".yaml"))
    .some((file) => readFileSync(join(workflowsDirectory, file), "utf8").includes("NPM_PUBLISH_TOKEN")),
  "release workflows must not reintroduce a long-lived npm publication token",
);
requirePolicy(
  releaseDocs.includes("same workflow run") && releaseDocs.includes("exact tag SHA"),
  "release documentation must describe the enforced same-run, exact-SHA gate",
);

if (failures.length > 0) {
  console.error("Release policy violations:");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exitCode = 1;
} else {
  console.log("Release policy verified: exact-tag cross-platform E2E gates publication.");
}
