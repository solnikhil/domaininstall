/**
 * Smoke test — exercises every v0 component against the compiled output in
 * ../dist. Run with: node --experimental-strip-types scripts/smoke.ts
 * (Node 22 strips types natively.)
 */
import { mkdtempSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolveTxt } from "../dist/doh.js";
import { parseRecord, parseRecords } from "../dist/record.js";
import { validatePackageName, parseTarget, validateDomain } from "../dist/validate.js";
import { detectPackageManager, buildInstallPlan, runInstall } from "../dist/install.js";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean): void {
  if (cond) {
    pass++;
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
  } else {
    fail++;
    console.log(`  \x1b[31m✖ ${name}\x1b[0m`);
  }
}

async function main() {
  const state = mkdtempSync(join(tmpdir(), "dnstall-state-"));
  process.env.DOMAININSTALL_STATE_DIR = state;
  const { diffPin, savePin } = await import("../dist/pin.js");

  console.log("\n1. Record parsing (purl + legacy)");
  const p1 = parseRecord("dnstall=pkg:npm/stripe");
  check("purl: plain npm package", p1?.namespace === "npm" && p1?.package === "stripe");
  const p2 = parseRecord("dnstall=pkg:npm/stripe@^18");
  check("purl: package with version range", p2?.package === "stripe" && p2?.version === "^18");
  const p3 = parseRecord("dnstall=pkg:npm/%40stripe/react-stripe-js@^2 repo=https://github.com/stripe/x");
  check(
    "purl: encoded scope + version + metadata",
    p3?.package === "@stripe/react-stripe-js" && p3?.version === "^2" && p3?.metadata.repo === "https://github.com/stripe/x",
  );
  check("purl: drops qualifiers/subpath", parseRecord("dnstall=pkg:npm/foo@1.2?arch=x64#sub")?.package === "foo");
  const r1 = parseRecord("dnstall=/npm/stripe@^18");
  check("legacy: /npm/ form still works", r1?.namespace === "npm" && r1?.package === "stripe" && r1?.version === "^18");
  const r3 = parseRecord("dnstall=/npm/@stripe/react-stripe-js@^2");
  check("legacy: scoped package", r3?.package === "@stripe/react-stripe-js" && r3?.version === "^2");
  check("ignores foreign records (dnslink)", parseRecord("dnslink=/ipfs/abc") === null);
  check("namespace filter", parseRecords(["dnstall=pkg:npm/a", "dnstall=pkg:pypi/b"], "npm").length === 1);

  console.log("\n2. Input validation (security)");
  check("rejects flag-smuggling package name", !validatePackageName("--registry=evil").ok);
  check("accepts normal package name", validatePackageName("stripe").ok);
  check("rejects shell metachars in domain", !validateDomain("evil;rm -rf").ok);
  const t = parseTarget("stripe.com/react@5");
  check("parses domain/sub@version", t.ok && t.value.domain === "stripe.com" && t.value.sub === "react" && t.value.version === "5");

  console.log("\n3. TOFU pin");
  const testDomain = "smoke-test.example";
  savePin(testDomain, { namespace: "npm", package: "good-pkg", registry: "registry.npmjs.org" });
  const same = diffPin(testDomain, { namespace: "npm", package: "good-pkg", registry: "registry.npmjs.org" });
  check("no change when mapping matches", same.changes.length === 0 && !!same.existing);
  const changed = diffPin(testDomain, { namespace: "npm", package: "EVIL-pkg", registry: "registry.npmjs.org" });
  check("detects package change (hijack signal)", changed.changes.some((c) => c.field === "package"));

  console.log("\n4. Package-manager detection + plan");
  const plan = buildInstallPlan("npm", "stripe", "^18");
  check('builds "npm install stripe@^18"', plan.display === "npm install stripe@^18");
  const tmp = mkdtempSync(join(tmpdir(), "dnstall-pm-"));
  writeFileSync(join(tmp, "pnpm-lock.yaml"), "");
  check("detects pnpm from lockfile", detectPackageManager(tmp).pm === "pnpm");
  rmSync(tmp, { recursive: true, force: true });

  console.log("\n5. Live DoH resolution (real network)");
  const dnslink = await resolveTxt("dnslink", "en.wikipedia-on-ipfs.org");
  check("resolves a real TXT record over DoH", dnslink.records.some((r) => r.startsWith("dnslink=/ip")));

  console.log("\n6. Real install handoff (npm install a tiny package)");
  const proj = mkdtempSync(join(tmpdir(), "dnstall-install-"));
  writeFileSync(join(proj, "package.json"), JSON.stringify({ name: "smoke", version: "1.0.0", private: true }));
  const cwd = process.cwd();
  process.chdir(proj);
  const code = await runInstall(buildInstallPlan("npm", "is-number", "7.0.0"));
  process.chdir(cwd);
  check("npm install exited 0", code === 0);
  check("package landed in node_modules", existsSync(join(proj, "node_modules", "is-number")));
  rmSync(proj, { recursive: true, force: true });
  rmSync(state, { recursive: true, force: true });

  console.log(`\n${fail === 0 ? "\x1b[32m" : "\x1b[31m"}${pass} passed, ${fail} failed\x1b[0m\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
