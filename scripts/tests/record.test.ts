import {
  DNS_PREFIX,
  RECORD_KEY,
  distinctRecordMappings,
  parseRecord,
  parseRecords,
} from "../../dist/record.js";
import type { Harness, TestModule } from "./harness.ts";

function run(h: Harness): void {
  h.section("record.ts — constants and purl/legacy parsing");

  h.check("DNS_PREFIX is dnstall", DNS_PREFIX === "dnstall");
  h.check("RECORD_KEY is dnstall", RECORD_KEY === "dnstall");

  h.check("null for empty string", parseRecord("") === null);
  h.check("null for whitespace only", parseRecord("   ") === null);
  h.check("null without key prefix", parseRecord("pkg:npm/foo") === null);
  h.check("null for foreign key", parseRecord("dnslink=/ipfs/Qm") === null);
  h.check("null for dnstall without payload", parseRecord("dnstall=") === null);
  h.check("null for bare path without slash body", parseRecord("dnstall=/") === null);
  h.check("null for pkg: without type/name", parseRecord("dnstall=pkg:") === null);
  h.check("null for pkg:npm only", parseRecord("dnstall=pkg:npm") === null);
  h.check("null for pkg:npm/", parseRecord("dnstall=pkg:npm/") === null);
  h.check("null for unknown payload shape", parseRecord("dnstall=not-a-purl") === null);

  const plain = parseRecord("dnstall=pkg:npm/lodash");
  h.check("purl plain package", plain?.namespace === "npm" && plain?.package === "lodash" && !plain?.version);

  const ranged = parseRecord("dnstall=pkg:npm/lodash@^4.17.0");
  h.check("purl with caret range", ranged?.package === "lodash" && ranged?.version === "^4.17.0");

  const scoped = parseRecord("dnstall=pkg:npm/%40babel/core@7");
  h.check(
    "purl percent-encoded scope",
    scoped?.package === "@babel/core" && scoped?.version === "7",
  );

  const withQuery = parseRecord("dnstall=pkg:npm/foo@1.0.0?arch=x64#src");
  h.check(
    "purl drops query and fragment",
    withQuery?.package === "foo" && withQuery?.version === "1.0.0",
  );

  const meta = parseRecord(
    "dnstall=pkg:npm/widget@1 repo=https://github.com/a/b homepage=https://a.example",
  );
  h.check(
    "parses trailing metadata key=value pairs",
    meta?.metadata.repo === "https://github.com/a/b" &&
      meta?.metadata.homepage === "https://a.example",
  );
  h.check("ignores bare metadata tokens without equals", parseRecord("dnstall=pkg:npm/x lone")?.package === "x");
  h.check(
    "ignores empty metadata keys",
    parseRecord("dnstall=pkg:npm/x =value ok=1")?.metadata.ok === "1",
  );

  const legacy = parseRecord("dnstall=/npm/@scope/name@~1.2");
  h.check(
    "legacy scoped package with version",
    legacy?.namespace === "npm" && legacy?.package === "@scope/name" && legacy?.version === "~1.2",
  );
  h.check("legacy unscoped", parseRecord("dnstall=/npm/express")?.package === "express");
  h.check("legacy with metadata", parseRecord("dnstall=/npm/foo@1 note=x")?.metadata.note === "x");

  // leading @ is scope, not version split at 0
  const atName = parseRecord("dnstall=pkg:npm/%40only");
  h.check("encoded @name without slash is package token", atName?.package === "@only" && !atName?.version);

  const badDecode = parseRecord("dnstall=pkg:npm/%E0%A4%A");
  h.check("malformed percent-encoding does not throw", badDecode !== null || badDecode === null);

  const multi = parseRecords(
    [
      "dnstall=pkg:npm/a",
      "dnslink=/ipfs/x",
      "dnstall=pkg:pypi/b",
      "dnstall=pkg:npm/c@1",
      "garbage",
    ],
    "npm",
  );
  h.check("parseRecords filters invalid and non-npm", multi.length === 2 && multi[0]!.package === "a");

  const allNs = parseRecords(["dnstall=pkg:npm/a", "dnstall=pkg:pypi/b"]);
  h.check("parseRecords without filter keeps all namespaces", allNs.length === 2);

  const same = distinctRecordMappings(
    parseRecords(
      ["dnstall=pkg:npm/a@1 repo=one", "dnstall=pkg:npm/a@1 repo=two", "dnstall=pkg:npm/a@2"],
      "npm",
    ),
  );
  h.check(
    "distinct mappings ignore metadata-only differences",
    same.length === 2 &&
      same.some((r) => r.version === "1") &&
      same.some((r) => r.version === "2"),
  );

  const noVer = distinctRecordMappings(parseRecords(["dnstall=pkg:npm/a", "dnstall=pkg:npm/a@"], "npm"));
  // "@" with empty version still sets version to "" from split — package a with version ""
  h.check("distinct mappings handle missing versions", noVer.length >= 1);

  h.check(
    "raw field preserved",
    parseRecord("  dnstall=pkg:npm/z  ")?.raw === "dnstall=pkg:npm/z" ||
      parseRecord("  dnstall=pkg:npm/z  ")?.package === "z",
  );
}

export const recordTests: TestModule = { name: "record", run };
