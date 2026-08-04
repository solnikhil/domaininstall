import {
  parseTarget,
  validateDomain,
  validateNamespace,
  validatePackageName,
  validateVersionRange,
} from "../../dist/validate.js";
import type { Harness, TestModule } from "./harness.ts";

function run(h: Harness): void {
  h.section("validate.ts — domain, package, version, target");

  // domains
  h.check("accepts example.com", validateDomain("example.com").ok);
  h.check("lowercases domain", validateDomain("ExAmPle.COM").ok && (validateDomain("ExAmPle.COM") as { value: string }).value === "example.com");
  h.check("rejects empty domain", !validateDomain("").ok);
  h.check("rejects whitespace domain", !validateDomain("   ").ok);
  h.check("rejects single label", !validateDomain("localhost").ok);
  h.check("rejects leading hyphen label", !validateDomain("-bad.com").ok);
  h.check("rejects double dot", !validateDomain("a..b.com").ok);
  h.check("rejects shell metachar", !validateDomain("evil;rm.com").ok);
  h.check("rejects space in domain", !validateDomain("evil .com").ok);
  h.check("rejects underscore label", !validateDomain("foo_bar.com").ok);
  h.check("rejects domain longer than 253", !validateDomain(`${"a".repeat(250)}.com`).ok);
  h.check("accepts multi-label", validateDomain("a.b.c.example.co.uk").ok);
  h.check("accepts numeric labels", validateDomain("1.2.example.com").ok);

  // package names
  h.check("accepts plain package", validatePackageName("lodash").ok);
  h.check("accepts dots and hyphens", validatePackageName("my.pkg-name").ok);
  h.check("accepts scoped package", validatePackageName("@scope/pkg").ok);
  h.check("rejects empty package", !validatePackageName("").ok);
  h.check("rejects flag smuggling", !validatePackageName("--registry=evil").ok);
  h.check("rejects leading dash", !validatePackageName("-evil").ok);
  h.check("rejects leading dot", !validatePackageName(".hidden").ok);
  h.check("rejects leading underscore", !validatePackageName("_private").ok);
  h.check("rejects uppercase unscoped", !validatePackageName("Lodash").ok);
  h.check("rejects path traversal-ish", !validatePackageName("../evil").ok);
  h.check("rejects space", !validatePackageName("foo bar").ok);
  h.check("rejects incomplete scope", !validatePackageName("@scope").ok);
  h.check("rejects name over 214 chars", !validatePackageName("a".repeat(215)).ok);

  // version ranges
  h.check("accepts plain version", validateVersionRange("1.2.3").ok);
  h.check("accepts caret", validateVersionRange("^18").ok);
  h.check("accepts tilde", validateVersionRange("~1.2.0").ok);
  h.check("accepts comparison", validateVersionRange(">=1.0.0").ok);
  h.check("accepts or-range tokens", validateVersionRange("1.0.0||2.0.0").ok);
  h.check("rejects empty version", !validateVersionRange("").ok);
  h.check("rejects leading dash version", !validateVersionRange("-1").ok);
  h.check("rejects spaces in version", !validateVersionRange(">=1 <2").ok);
  h.check("rejects shell chars in version", !validateVersionRange("1;rm").ok);

  // namespace
  h.check("accepts npm namespace", validateNamespace("npm").ok);
  h.check("lowercases namespace", (validateNamespace("NPM") as { ok: true; value: string }).value === "npm");
  h.check("rejects empty namespace", !validateNamespace("").ok);
  h.check("rejects hyphens in namespace", !validateNamespace("my-ns").ok);

  // parseTarget
  h.check("rejects empty target", !parseTarget("").ok);
  const simple = parseTarget("example.com");
  h.check("parses bare domain", simple.ok && simple.value.domain === "example.com" && !simple.value.sub && !simple.value.version);

  const full = parseTarget("Example.COM/React@^5");
  h.check(
    "parses domain/sub@version with normalization",
    full.ok &&
      full.value.domain === "example.com" &&
      full.value.sub === "react" &&
      full.value.version === "^5",
  );

  h.check("rejects invalid domain in target", !parseTarget("not_a_domain").ok);
  h.check("rejects invalid sub label", !parseTarget("example.com/bad_sub").ok);
  h.check("rejects sub with slash residue after strip", !parseTarget("example.com/has.dot").ok);
  h.check("accepts hyphenated sub", parseTarget("example.com/my-pkg").ok);
  h.check("rejects bad version in target", !parseTarget("example.com@bad version").ok);
  h.check("trailing slashes on sub stripped", parseTarget("example.com/react///").ok && (parseTarget("example.com/react///") as { value: { sub?: string } }).value.sub === "react");
}

export const validateTests: TestModule = { name: "validate", run };
