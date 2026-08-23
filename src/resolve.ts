/**
 * Side-effect-free domain resolution model shared by human and machine output.
 *
 * This module may read DNS, npm configuration, and the local trust pin. It does
 * not prompt, install a package, or write trust state.
 */

import { resolveTxt, type DnsAttempt, type DnsOutcome, type TxtResult } from "./doh.js";
import { resolveEffectiveRegistry } from "./install.js";
import { diffPinIdentity, inspectPin, type Pin, type PinChange } from "./pin.js";
import {
  DNS_PREFIX,
  distinctRecordMappings,
  parseRecords,
  type DnstallRecord,
} from "./record.js";
import { parseTarget, validatePackageName, validateVersionRange } from "./validate.js";

export const RESOLVE_SCHEMA_VERSION = 1 as const;
export const RESOLVE_SCHEMA_ID =
  "https://raw.githubusercontent.com/solnikhil/domaininstall/main/schema/resolve-v1.schema.json";

export const RESOLVE_EXIT_CODES = {
  resolved: 0,
  invalidInput: 2,
  authoritativeAbsence: 3,
  providerExhaustion: 4,
  conflictingMappings: 5,
  registryFailure: 6,
  pinChanged: 7,
  internalFailure: 8,
  invalidDeclaration: 9,
} as const;

export type ResolveExitCode = (typeof RESOLVE_EXIT_CODES)[keyof typeof RESOLVE_EXIT_CODES];

export type ResolutionOutcome =
  | "resolved"
  | "invalid_input"
  | "authoritative_absence"
  | "provider_exhaustion"
  | "conflicting_mappings"
  | "registry_failure"
  | "pin_changed"
  | "internal_failure"
  | "invalid_declaration";

export type ResolutionErrorCode =
  | "USAGE"
  | "INVALID_TARGET"
  | "DNS_NXDOMAIN"
  | "DNS_NODATA"
  | "DNS_PROVIDER_EXHAUSTION"
  | "DNS_NO_VALID_RECORD"
  | "DNS_UNSUPPORTED_NAMESPACE"
  | "DNS_CONFLICT"
  | "INVALID_PACKAGE_NAME"
  | "INVALID_VERSION"
  | "REGISTRY_RESOLUTION_FAILED"
  | "PIN_CHANGED"
  | "PIN_STORE_FAILURE"
  | "INTERNAL";

export interface ResolutionInput {
  target: string;
  normalizedTarget: string | null;
  domain: string | null;
  subdomain: string | null;
  effectiveDomain: string | null;
  cliVersionOverride: string | null;
  dnsName: string | null;
}

export interface ResolutionDnsAttempt {
  provider: string;
  identity: string;
  outcome: DnsAttempt["outcome"];
  status: number | null;
}

export interface ResolutionDns {
  outcome: DnsOutcome | "not_queried";
  queriedName: string | null;
  records: string[];
  resolver: {
    provider: string;
    identity: string;
  } | null;
  dnssec: {
    ad: boolean;
    source: "resolver_reported";
  };
  status: number | null;
  attempts: ResolutionDnsAttempt[];
}

export interface ResolutionMapping {
  namespace: string;
  package: string;
  dnsVersionPolicy: string | null;
  effectiveVersion: string | null;
  versionSource: "cli" | "dns" | "latest";
  metadata: Record<string, string>;
  raw: string;
}

export interface ResolutionPin {
  status: "not_checked" | "absent" | "uncompared" | "match" | "changed";
  current: Pin | null;
  diff: PinChange[];
}

export interface ResolutionDocument {
  schemaVersion: typeof RESOLVE_SCHEMA_VERSION;
  schema: string;
  ok: boolean;
  outcome: ResolutionOutcome;
  exitCode: ResolveExitCode;
  input: ResolutionInput;
  dns: ResolutionDns;
  mappings: {
    supported: ResolutionMapping[];
    unsupported: ResolutionMapping[];
    selected: ResolutionMapping | null;
    conflicts: ResolutionMapping[];
  };
  registry: {
    status: "not_attempted" | "resolved" | "failed";
    effective: string | null;
    message: string | null;
  };
  pin: ResolutionPin;
  error: {
    code: ResolutionErrorCode;
    message: string;
  } | null;
}

export interface ResolveDomainOptions {
  cwd?: string;
  knownDefaultRegistry?: string;
  resolveDns?: typeof resolveTxt;
  resolveRegistry?: typeof resolveEffectiveRegistry;
  readPin?: typeof inspectPin;
}

function resolverIdentity(provider: string): string {
  try {
    return new URL(provider).host;
  } catch {
    return provider;
  }
}

function mappingFromRecord(
  record: DnstallRecord,
  cliVersion: string | undefined,
): ResolutionMapping {
  const metadata = Object.fromEntries(Object.entries(record.metadata).sort(([a], [b]) => a.localeCompare(b)));
  return {
    namespace: record.namespace,
    package: record.package,
    dnsVersionPolicy: record.version ?? null,
    effectiveVersion: cliVersion ?? record.version ?? null,
    versionSource: cliVersion ? "cli" : record.version ? "dns" : "latest",
    metadata,
    raw: record.raw,
  };
}

function emptyDocument(target: string): ResolutionDocument {
  return {
    schemaVersion: RESOLVE_SCHEMA_VERSION,
    schema: RESOLVE_SCHEMA_ID,
    ok: false,
    outcome: "invalid_input",
    exitCode: RESOLVE_EXIT_CODES.invalidInput,
    input: {
      target,
      normalizedTarget: null,
      domain: null,
      subdomain: null,
      effectiveDomain: null,
      cliVersionOverride: null,
      dnsName: null,
    },
    dns: {
      outcome: "not_queried",
      queriedName: null,
      records: [],
      resolver: null,
      dnssec: { ad: false, source: "resolver_reported" },
      status: null,
      attempts: [],
    },
    mappings: { supported: [], unsupported: [], selected: null, conflicts: [] },
    registry: { status: "not_attempted", effective: null, message: null },
    pin: { status: "not_checked", current: null, diff: [] },
    error: null,
  };
}

function fail(
  document: ResolutionDocument,
  outcome: Exclude<ResolutionOutcome, "resolved">,
  exitCode: ResolveExitCode,
  code: ResolutionErrorCode,
  message: string,
): ResolutionDocument {
  document.ok = false;
  document.outcome = outcome;
  document.exitCode = exitCode;
  document.error = { code, message };
  return document;
}

function applyDns(document: ResolutionDocument, txt: TxtResult): void {
  document.dns = {
    outcome: txt.outcome,
    queriedName: document.input.dnsName,
    records: [...txt.records],
    resolver: txt.provider
      ? { provider: txt.provider, identity: resolverIdentity(txt.provider) }
      : null,
    dnssec: { ad: txt.authenticated, source: "resolver_reported" },
    status: txt.status >= 0 ? txt.status : null,
    attempts: txt.attempts.map((attempt) => ({
      provider: attempt.provider,
      identity: resolverIdentity(attempt.provider),
      outcome: attempt.outcome,
      status: attempt.status ?? null,
    })),
  };
}

/** Resolve and evaluate a target without installation, prompting, or writes. */
export async function resolveDomain(
  target: string,
  options: ResolveDomainOptions = {},
): Promise<ResolutionDocument> {
  const document = emptyDocument(target);
  const parsed = parseTarget(target);
  if (!parsed.ok) {
    return fail(
      document,
      "invalid_input",
      RESOLVE_EXIT_CODES.invalidInput,
      "INVALID_TARGET",
      parsed.error,
    );
  }

  const { domain, sub, version: cliVersion } = parsed.value;
  const effectiveDomain = sub ? `${sub}.${domain}` : domain;
  const normalizedTarget = `${domain}${sub ? `/${sub}` : ""}${cliVersion ? `@${cliVersion}` : ""}`;
  const dnsName = `_${DNS_PREFIX}.${effectiveDomain}`;
  document.input = {
    target,
    normalizedTarget,
    domain,
    subdomain: sub ?? null,
    effectiveDomain,
    cliVersionOverride: cliVersion ?? null,
    dnsName,
  };

  const txt = await (options.resolveDns ?? resolveTxt)(DNS_PREFIX, effectiveDomain);
  applyDns(document, txt);

  if (txt.outcome === "nxdomain") {
    return fail(
      document,
      "authoritative_absence",
      RESOLVE_EXIT_CODES.authoritativeAbsence,
      "DNS_NXDOMAIN",
      `The DNS name ${dnsName} does not exist (NXDOMAIN).`,
    );
  }
  if (txt.outcome === "nodata") {
    return fail(
      document,
      "authoritative_absence",
      RESOLVE_EXIT_CODES.authoritativeAbsence,
      "DNS_NODATA",
      `No TXT record exists at ${dnsName} (NODATA).`,
    );
  }
  if (txt.outcome === "provider_exhaustion") {
    return fail(
      document,
      "provider_exhaustion",
      RESOLVE_EXIT_CODES.providerExhaustion,
      "DNS_PROVIDER_EXHAUSTION",
      "DNS lookup failed after exhausting every configured resolver.",
    );
  }

  const parsedRecords = parseRecords(txt.records);
  const supportedRecords = distinctRecordMappings(
    parsedRecords.filter((record) => record.namespace === "npm"),
  );
  const unsupportedRecords = distinctRecordMappings(
    parsedRecords.filter((record) => record.namespace !== "npm"),
  );
  document.mappings.supported = supportedRecords.map((record) => mappingFromRecord(record, cliVersion));
  document.mappings.unsupported = unsupportedRecords.map((record) => mappingFromRecord(record, cliVersion));

  if (parsedRecords.length === 0) {
    return fail(
      document,
      "invalid_declaration",
      RESOLVE_EXIT_CODES.invalidDeclaration,
      "DNS_NO_VALID_RECORD",
      `TXT records exist at ${dnsName}, but none are valid domaininstall records.`,
    );
  }
  if (supportedRecords.length === 0) {
    const namespaces = [...new Set(unsupportedRecords.map((record) => record.namespace))].sort().join(", ");
    return fail(
      document,
      "invalid_declaration",
      RESOLVE_EXIT_CODES.invalidDeclaration,
      "DNS_UNSUPPORTED_NAMESPACE",
      `No mapping uses the supported npm namespace; found: ${namespaces}.`,
    );
  }
  if (supportedRecords.length > 1) {
    document.mappings.conflicts = [...document.mappings.supported];
    return fail(
      document,
      "conflicting_mappings",
      RESOLVE_EXIT_CODES.conflictingMappings,
      "DNS_CONFLICT",
      `Conflicting domaininstall mappings found at ${dnsName}; refusing to choose one.`,
    );
  }

  const selectedRecord = supportedRecords[0]!;
  const selected = document.mappings.supported[0]!;
  document.mappings.selected = selected;

  const packageCheck = validatePackageName(selectedRecord.package);
  if (!packageCheck.ok) {
    return fail(
      document,
      "invalid_declaration",
      RESOLVE_EXIT_CODES.invalidDeclaration,
      "INVALID_PACKAGE_NAME",
      `The npm mapping contains an invalid package name: ${packageCheck.error}`,
    );
  }
  const effectiveVersion = cliVersion ?? selectedRecord.version;
  if (effectiveVersion) {
    const versionCheck = validateVersionRange(effectiveVersion);
    if (!versionCheck.ok) {
      return fail(
        document,
        "invalid_declaration",
        RESOLVE_EXIT_CODES.invalidDeclaration,
        "INVALID_VERSION",
        `The npm mapping contains an invalid version policy: ${versionCheck.error}`,
      );
    }
  }

  let pin: Pin | undefined;
  try {
    pin = (options.readPin ?? inspectPin)(effectiveDomain);
  } catch (error) {
    return fail(
      document,
      "internal_failure",
      RESOLVE_EXIT_CODES.internalFailure,
      "PIN_STORE_FAILURE",
      error instanceof Error ? error.message : String(error),
    );
  }
  if (!pin) {
    document.pin = { status: "absent", current: null, diff: [] };
  } else {
    document.pin = { status: "uncompared", current: pin, diff: [] };
  }

  const registry = (options.resolveRegistry ?? resolveEffectiveRegistry)(
    selectedRecord.package,
    options.cwd ?? process.cwd(),
    options.knownDefaultRegistry,
  );
  if (!registry.ok) {
    document.registry = { status: "failed", effective: null, message: registry.error };
    return fail(
      document,
      "registry_failure",
      RESOLVE_EXIT_CODES.registryFailure,
      "REGISTRY_RESOLUTION_FAILED",
      registry.error,
    );
  }
  document.registry = { status: "resolved", effective: registry.registry, message: null };

  if (pin) {
    const changes = diffPinIdentity(pin, {
      namespace: selectedRecord.namespace,
      package: selectedRecord.package,
      registry: registry.registry,
      dnsVersion: selectedRecord.version ?? null,
    });
    document.pin = {
      status: changes.length > 0 ? "changed" : "match",
      current: pin,
      diff: changes,
    };
    if (changes.length > 0) {
      return fail(
        document,
        "pin_changed",
        RESOLVE_EXIT_CODES.pinChanged,
        "PIN_CHANGED",
        "The live DNS/registry mapping does not match the local trust pin.",
      );
    }
  }

  document.ok = true;
  document.outcome = "resolved";
  document.exitCode = RESOLVE_EXIT_CODES.resolved;
  document.error = null;
  return document;
}

/** Build a schema-valid failure document for an unexpected resolver exception. */
export function internalResolutionFailure(target: string, error: unknown): ResolutionDocument {
  const document = emptyDocument(target);
  const message = error instanceof Error ? error.message : String(error);
  const code: ResolutionErrorCode =
    error instanceof Error && error.name === "PinStoreError" ? "PIN_STORE_FAILURE" : "INTERNAL";
  return fail(
    document,
    "internal_failure",
    RESOLVE_EXIT_CODES.internalFailure,
    code,
    message || "Unexpected internal failure.",
  );
}

/** Build a JSON usage failure when machine mode was explicitly requested. */
export function invalidResolutionRequest(target: string, message: string): ResolutionDocument {
  return fail(
    emptyDocument(target),
    "invalid_input",
    RESOLVE_EXIT_CODES.invalidInput,
    "USAGE",
    message,
  );
}
