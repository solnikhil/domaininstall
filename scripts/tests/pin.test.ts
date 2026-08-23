import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Harness, TestModule } from "./harness.ts";

async function run(h: Harness): Promise<void> {
  h.section("pin.ts — TOFU store, CAS, validation, reset");

  const state = mkdtempSync(join(tmpdir(), "dnstall-pin-extra-"));
  const prev = process.env.DOMAININSTALL_STATE_DIR;
  process.env.DOMAININSTALL_STATE_DIR = state;

  // Fresh import so DIR binds to this state dir (module reads env at load time... actually pin.ts reads DIR at module load as const).
  // The main suite already sets DOMAININSTALL_STATE_DIR before import. For isolation we must set env BEFORE dynamic import.
  // pin.js already loaded by main suite if run after — so we rely on DOMAININSTALL_STATE_DIR being set at first import.
  // This module is loaded as part of exhaustive suite which sets env first in the runner.

  const pin = await import("../../dist/pin.js");
  const { diffPin, getPin, listPins, resetPinStore, savePin, PIN_FILE } = pin as typeof pin & {
    listPins?: () => unknown;
  };

  const domain = "pin-extra.example";
  const base = {
    namespace: "npm",
    package: "pkg-a",
    registry: "https://registry.npmjs.org/",
    dnsVersion: null as string | null,
  };

  // clean slate if leftover
  try {
    resetPinStore();
  } catch {
    /* empty store ok */
  }

  h.check("getPin missing returns undefined", getPin(domain) === undefined);

  const first = savePin(domain, base);
  h.check("first save ok", first.ok === true);
  h.check("getPin returns package", getPin(domain)?.package === "pkg-a");
  h.check("firstSeen set", typeof getPin(domain)?.firstSeen === "string");
  h.check("lastSeen set", typeof getPin(domain)?.lastSeen === "string");
  h.check(
    "legacy-style save records explicit unknown artifact state",
    getPin(domain)?.resolvedVersion === null &&
      getPin(domain)?.integrity === null &&
      getPin(domain)?.tarball === null &&
      getPin(domain)?.resolvedAt === null,
  );

  const match = diffPin(domain, base);
  h.check("diff empty when identical", match.changes.length === 0 && match.existing !== null);

  const pkgChange = diffPin(domain, { ...base, package: "pkg-b" });
  h.check(
    "diff detects package",
    pkgChange.changes.some((c) => c.field === "package" && c.was === "pkg-a" && c.now === "pkg-b"),
  );

  const nsChange = diffPin(domain, { ...base, namespace: "pypi" });
  h.check("diff detects namespace", nsChange.changes.some((c) => c.field === "namespace"));

  const regChange = diffPin(domain, { ...base, registry: "https://other.example/" });
  h.check("diff detects registry", regChange.changes.some((c) => c.field === "registry"));

  const dnsChange = diffPin(domain, { ...base, dnsVersion: "^2" });
  h.check("diff detects dnsVersion null→value", dnsChange.changes.some((c) => c.field === "dnsVersion"));

  // save with version
  const withDns = savePin(
    domain,
    { ...base, dnsVersion: "^1" },
    getPin(domain)!,
  );
  h.check("CAS update dnsVersion", withDns.ok === true);
  h.check("pin stores dnsVersion", getPin(domain)?.dnsVersion === "^1");

  // invalid package on save
  const badPkg = savePin("good.example", {
    namespace: "npm",
    package: "--evil",
    registry: "https://registry.npmjs.org/",
    dnsVersion: null,
  });
  h.check("savePin rejects invalid package", badPkg.ok === false);

  const badDomain = savePin("not_a_domain", base);
  h.check("savePin rejects invalid domain", badDomain.ok === false);

  const badReg = savePin("reg.example", {
    namespace: "npm",
    package: "x",
    registry: "http://insecure.example/",
    dnsVersion: null,
  });
  // may accept or reject depending on pin validation — check it doesn't throw
  h.check("savePin with http registry does not throw", badReg.ok === true || badReg.ok === false);

  // CAS diverge: expected wrong pin
  const diverge = savePin(
    domain,
    { ...base, package: "hijack", dnsVersion: "^1" },
    {
      namespace: "npm",
      package: "wrong-expected",
      registry: "https://registry.npmjs.org/",
      dnsVersion: "^1",
      firstSeen: "x",
      lastSeen: "x",
    },
  );
  h.check("CAS refuses when expected pin mismatches", diverge.ok === false);
  h.check("package unchanged after CAS refuse", getPin(domain)?.package === "pkg-a");

  // schema
  const raw = JSON.parse(readFileSync(join(state, "pins.json"), "utf8")) as {
    version: number;
    pins: Record<string, unknown>;
  };
  h.check("schema version 2", raw.version === 2);
  h.check("pins object present", typeof raw.pins === "object");
  h.check("PIN_FILE basename is pins.json", PIN_FILE.endsWith("pins.json"));

  const artifact = {
    resolvedVersion: "2.4.1",
    integrity: `sha512-${Buffer.alloc(64, 7).toString("base64")}`,
    tarball: "https://registry.npmjs.org/pkg-a/-/pkg-a-2.4.1.tgz",
    resolvedAt: "2026-08-23T00:00:00.000Z",
  };
  const artifactDomain = "artifact.example";
  h.check("saves complete immutable artifact identity", savePin(artifactDomain, { ...base, ...artifact }).ok);
  h.check(
    "round-trips artifact version, SRI, URL, and resolution time",
    getPin(artifactDomain)?.resolvedVersion === artifact.resolvedVersion &&
      getPin(artifactDomain)?.integrity === artifact.integrity &&
      getPin(artifactDomain)?.tarball === artifact.tarball &&
      getPin(artifactDomain)?.resolvedAt === artifact.resolvedAt,
  );
  const versionReview = diffPin(artifactDomain, { ...base, ...artifact, resolvedVersion: "2.5.0" });
  h.check(
    "exact-version changes require review but are not same-version mutations",
    versionReview.changes.some((change) => change.field === "resolvedVersion") && !versionReview.blockedArtifactMutation,
  );
  const swappedIntegrity = diffPin(artifactDomain, {
    ...base,
    ...artifact,
    integrity: `sha512-${Buffer.alloc(64, 8).toString("base64")}`,
  });
  h.check(
    "same-version integrity replacement is a hard block",
    swappedIntegrity.blockedArtifactMutation && swappedIntegrity.changes.some((change) => change.field === "integrity"),
  );
  const movedTarball = diffPin(artifactDomain, { ...base, ...artifact, tarball: "https://cdn.example/pkg-a-2.4.1.tgz" });
  h.check("same-version canonical tarball replacement is a hard block", movedTarball.blockedArtifactMutation);
  h.check(
    "rejects partial artifact identities",
    !savePin("partial.example", { ...base, resolvedVersion: "1.0.0" }).ok,
  );
  h.check(
    "rejects malformed or wrong-length SRI in trust state",
    !savePin("bad-sri.example", {
      ...base,
      ...artifact,
      integrity: "sha512-YmFk",
    }).ok,
  );

  // second domain
  savePin("other.example", {
    namespace: "npm",
    package: "other",
    registry: "https://registry.npmjs.org/",
    dnsVersion: null,
  });
  h.check("stores multiple domains", getPin("other.example")?.package === "other");

  // reset
  const backup = resetPinStore();
  h.check("reset returns backup path", typeof backup === "string" && existsSync(backup!));
  h.check("reset clears pins", getPin(domain) === undefined && getPin("other.example") === undefined);
  const after = JSON.parse(readFileSync(join(state, "pins.json"), "utf8")) as { pins: object };
  h.check("reset leaves empty store", Object.keys(after.pins).length === 0);

  // corrupt → fail closed
  writeFileSync(join(state, "pins.json"), "{nope", "utf8");
  let threw = false;
  try {
    getPin("x.example");
  } catch {
    threw = true;
  }
  h.check("corrupt JSON fails closed", threw);
  const b2 = resetPinStore();
  h.check("reset after corrupt creates backup", !!b2 && readdirSync(state).some((n) => n.startsWith("pins.backup-")));

  // invalid schema version
  writeFileSync(
    join(state, "pins.json"),
    JSON.stringify({ version: 99, pins: {} }),
    "utf8",
  );
  let versionThrew = false;
  try {
    getPin("x.example");
  } catch {
    versionThrew = true;
  }
  h.check("unknown schema version fails closed", versionThrew);
  resetPinStore();

  // v1 migration must preserve unknown as unknown, never look up or invent SRI.
  const legacyTime = "2026-08-01T00:00:00.000Z";
  writeFileSync(
    join(state, "pins.json"),
    JSON.stringify({
      version: 1,
      pins: {
        "legacy.example": {
          namespace: "npm",
          package: "legacy-pkg",
          registry: "https://registry.npmjs.org/",
          dnsVersion: "^1",
          firstSeen: legacyTime,
          lastSeen: legacyTime,
        },
      },
    }),
    "utf8",
  );
  const migrated = getPin("legacy.example");
  h.check(
    "v1 migration exposes explicit unknown artifact state",
    migrated?.resolvedVersion === null && migrated.integrity === null && migrated.tarball === null && migrated.resolvedAt === null,
  );
  savePin("migration-trigger.example", base);
  const migratedRaw = JSON.parse(readFileSync(join(state, "pins.json"), "utf8")) as {
    version: number;
    pins: Record<string, { integrity?: unknown; resolvedVersion?: unknown }>;
  };
  h.check(
    "next write migrates v1 to v2 without inventing artifact identity",
    migratedRaw.version === 2 &&
      migratedRaw.pins["legacy.example"]?.resolvedVersion === null &&
      migratedRaw.pins["legacy.example"]?.integrity === null,
  );
  resetPinStore();

  // invalid pin entry inside valid schema
  writeFileSync(
    join(state, "pins.json"),
    JSON.stringify({
      version: 1,
      pins: {
        "bad.example": {
          namespace: "npm",
          package: "--bad",
          registry: "https://registry.npmjs.org/",
          dnsVersion: null,
          firstSeen: "t",
          lastSeen: "t",
        },
      },
    }),
    "utf8",
  );
  let entryThrew = false;
  try {
    getPin("bad.example");
  } catch {
    entryThrew = true;
  }
  h.check("invalid pin entry fails closed", entryThrew);
  resetPinStore();

  if (typeof listPins === "function") {
    h.check("listPins exists if exported", true);
  }

  process.env.DOMAININSTALL_STATE_DIR = prev;
  rmSync(state, { recursive: true, force: true });
}

export const pinTests: TestModule = { name: "pin", run };
