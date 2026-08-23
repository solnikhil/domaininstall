import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { Harness, TestModule } from "./harness.ts";

const provider = "https://resolver.example/dns-query";
const registry = "https://registry.npmjs.org/";
const now = "2026-08-23T12:00:00.000Z";

function dns(outcome: string, records: string[] = [], attempts = [{ provider, outcome, status: 0 }]) {
  return async () => ({
    outcome,
    records,
    authenticated: outcome === "answer",
    status: outcome === "provider_exhaustion" ? -1 : 0,
    provider: outcome === "provider_exhaustion" ? null : provider,
    attempts,
  });
}

const goodRecord = "dnstall=pkg:npm/safe-package@^1 repo=https://example.com/repo";
const base = {
  resolveDns: dns("answer", [goodRecord]),
  resolveRegistry: () => ({ ok: true, registry }),
  readPin: () => undefined,
};

async function run(h: Harness): Promise<void> {
  h.section("resolve.ts — versioned machine contract");

  // Dynamic import is intentional: the exhaustive runner installs an isolated
  // DOMAININSTALL_STATE_DIR in main(), after static module initialization.
  const {
    internalResolutionFailure,
    RESOLVE_EXIT_CODES,
    RESOLVE_SCHEMA_ID,
    resolveDomain,
  } = await import("../../dist/resolve.js");

  const schema = JSON.parse(
    readFileSync(join(import.meta.dirname, "..", "..", "schema", "resolve-v1.schema.json"), "utf8"),
  ) as { $id?: string; properties?: { schemaVersion?: { const?: number } } };
  h.check("checked-in schema has the runtime id and major", schema.$id === RESOLVE_SCHEMA_ID && schema.properties?.schemaVersion?.const === 1);

  const success = await resolveDomain("EXAMPLE.com/CLI@^2", base);
  h.check(
    "resolved document normalizes input and records version provenance",
    success.ok &&
      success.exitCode === 0 &&
      success.input.normalizedTarget === "example.com/cli@^2" &&
      success.input.effectiveDomain === "cli.example.com" &&
      success.input.dnsName === "_dnstall.cli.example.com" &&
      success.mappings.selected?.effectiveVersion === "^2" &&
      success.mappings.selected.versionSource === "cli",
  );
  h.check(
    "resolved document exposes resolver identity, AD source, registry, and absent pin",
    success.dns.resolver?.identity === "resolver.example" &&
      success.dns.dnssec.ad === true &&
      success.dns.dnssec.source === "resolver_reported" &&
      success.registry.effective === registry &&
      success.pin.status === "absent" &&
      success.error === null,
  );
  h.check(
    "every document has the stable top-level contract",
    ["schemaVersion", "schema", "ok", "outcome", "exitCode", "input", "dns", "mappings", "registry", "pin", "error"]
      .every((key) => Object.hasOwn(success, key)),
  );

  const matchingPin = await resolveDomain("example.com", {
    ...base,
    readPin: () => ({
      namespace: "npm", package: "safe-package", registry, dnsVersion: "^1", firstSeen: now, lastSeen: now,
    }),
  });
  h.check("matching pin is returned without a diff", matchingPin.ok && matchingPin.pin.status === "match" && matchingPin.pin.diff.length === 0);

  const changedPin = await resolveDomain("example.com", {
    ...base,
    readPin: () => ({
      namespace: "npm", package: "old-package", registry, dnsVersion: null, firstSeen: now, lastSeen: now,
    }),
  });
  h.check(
    "pin change has a dedicated exit and field-level diff",
    changedPin.exitCode === RESOLVE_EXIT_CODES.pinChanged &&
      changedPin.outcome === "pin_changed" &&
      changedPin.error?.code === "PIN_CHANGED" &&
      changedPin.mappings.selected?.package === "safe-package" &&
      changedPin.pin.diff.map((item) => item.field).join(",") === "package,dnsVersion",
  );

  const invalid = await resolveDomain("not-a-domain", base);
  h.check("invalid input is deterministic and skips DNS", invalid.exitCode === 2 && invalid.error?.code === "INVALID_TARGET" && invalid.dns.outcome === "not_queried");

  const nx = await resolveDomain("missing.example", { ...base, resolveDns: dns("nxdomain") });
  const nodata = await resolveDomain("empty.example", { ...base, resolveDns: dns("nodata") });
  h.check("authoritative absence distinguishes NXDOMAIN and NODATA", nx.exitCode === 3 && nodata.exitCode === 3 && nx.error?.code === "DNS_NXDOMAIN" && nodata.error?.code === "DNS_NODATA");

  const exhausted = await resolveDomain("broken.example", {
    ...base,
    resolveDns: dns("provider_exhaustion", [], [
      { provider: "https://one.example/dns-query", outcome: "servfail", status: 2 },
      { provider: "https://two.example/dns-query", outcome: "timeout" },
    ]),
  });
  h.check("provider exhaustion retains all attempts", exhausted.exitCode === 4 && exhausted.error?.code === "DNS_PROVIDER_EXHAUSTION" && exhausted.dns.attempts.length === 2 && exhausted.dns.attempts[1]?.status === null);

  const conflict = await resolveDomain("conflict.example", {
    ...base,
    resolveDns: dns("answer", ["dnstall=pkg:npm/a", "dnstall=pkg:npm/b"]),
  });
  h.check("conflict exposes every supported mapping and selects none", conflict.exitCode === 5 && conflict.mappings.conflicts.length === 2 && conflict.mappings.selected === null);

  const registryFailure = await resolveDomain("example.com", {
    ...base,
    resolveRegistry: () => ({ ok: false, error: "npm config unavailable" }),
    readPin: () => ({
      namespace: "npm", package: "safe-package", registry, dnsVersion: "^1", firstSeen: now, lastSeen: now,
    }),
  });
  h.check("registry failure is explicit and preserves the unread pin snapshot", registryFailure.exitCode === 6 && registryFailure.registry.status === "failed" && registryFailure.pin.status === "uncompared" && registryFailure.pin.current?.package === "safe-package" && registryFailure.error?.code === "REGISTRY_RESOLUTION_FAILED");

  const declarationCases = await Promise.all([
    resolveDomain("example.com", { ...base, resolveDns: dns("answer", ["unrelated=value"]) }),
    resolveDomain("example.com", { ...base, resolveDns: dns("answer", ["dnstall=pkg:pypi/thing"]) }),
    resolveDomain("example.com", { ...base, resolveDns: dns("answer", ["dnstall=pkg:npm/--evil"]) }),
    resolveDomain("example.com", { ...base, resolveDns: dns("answer", ["dnstall=pkg:npm/safe@bad$"]) }),
  ]);
  h.check(
    "invalid declaration variants share a stable class with precise codes",
    declarationCases.every((item) => item.exitCode === 9) &&
      declarationCases.map((item) => item.error?.code).join(",") ===
        "DNS_NO_VALID_RECORD,DNS_UNSUPPORTED_NAMESPACE,INVALID_PACKAGE_NAME,INVALID_VERSION",
  );

  const internal = internalResolutionFailure("example.com", new Error("boom"));
  const pinFailure = internalResolutionFailure("example.com", Object.assign(new Error("unsafe store"), { name: "PinStoreError" }));
  h.check("internal and pin-store exceptions still produce parseable documents", internal.exitCode === 8 && internal.error?.code === "INTERNAL" && pinFailure.error?.code === "PIN_STORE_FAILURE");
}

export const resolveTests: TestModule = { name: "resolve", run };
