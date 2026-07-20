/**
 * domaininstall DNS record format.
 *
 * Location:  _dnstall.<domain>   (TXT)
 * Value:     dnstall=<payload> [key=value ...]
 *
 * The payload identifies a package. Two forms are accepted:
 *
 *   1. purl (preferred) — a Package URL (ECMA-427 / package-url spec):
 *        dnstall=pkg:npm/stripe@^18
 *        dnstall=pkg:npm/%40stripe/react-stripe-js@^2
 *      purl is a real cross-ecosystem standard already spoken by SBOM tools,
 *      vulnerability scanners, and dependency trackers.
 *
 *   2. legacy DNSLink-style (still accepted, forgiving):
 *        dnstall=/npm/stripe@^18
 *
 * Optional space-separated RFC 1464 key=value metadata may follow the payload:
 *        dnstall=pkg:npm/foo@^5 repo=https://github.com/foo/foo homepage=https://foo.com
 *
 * Rules borrowed from DNSLink:
 *   - Multiple records may exist; evaluate deterministically (sorted upstream).
 *   - Never throw on a malformed record — ignore it and move on.
 */

export const DNS_PREFIX = "dnstall";
export const RECORD_KEY = "dnstall";

export interface DnstallRecord {
  namespace: string; // ecosystem, e.g. "npm" (the purl "type")
  package: string; // e.g. "stripe" or "@stripe/react-stripe-js"
  version?: string; // optional semver range
  metadata: Record<string, string>;
  raw: string;
}

/** Split an identifier like "@scope/name@^2" into package + version range. */
function splitPackageVersion(identifier: string): { pkg: string; version?: string } {
  // A leading "@" denotes a scope, not a version separator.
  const at = identifier.lastIndexOf("@");
  if (at > 0) {
    return { pkg: identifier.slice(0, at), version: identifier.slice(at + 1) };
  }
  return { pkg: identifier };
}

/** Percent-decode a purl segment, but never throw on malformed input. */
function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Extract { namespace, identifier } from the payload, or null if unrecognized. */
function parsePayload(payload: string): { namespace: string; identifier: string } | null {
  let body: string;
  if (payload.startsWith("pkg:")) {
    // purl form: pkg:<type>/<namespace?>/<name>@<version>?<qualifiers>#<subpath>
    body = payload.slice("pkg:".length);
  } else if (payload.startsWith("/")) {
    // legacy DNSLink form: /<namespace>/<identifier>
    body = payload.slice(1);
  } else {
    return null;
  }

  // Drop purl qualifiers/subpath — not used in v0.
  const q = body.search(/[?#]/);
  if (q >= 0) body = body.slice(0, q);

  const slash = body.indexOf("/");
  if (slash <= 0) return null;
  const namespace = body.slice(0, slash).toLowerCase();
  const identifier = safeDecode(body.slice(slash + 1));
  if (!namespace || !identifier) return null;
  return { namespace, identifier };
}

/** Parse a single raw TXT value into a record, or null if it isn't ours/invalid. */
export function parseRecord(raw: string): DnstallRecord | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith(`${RECORD_KEY}=`)) return null;

  const tokens = trimmed.split(/\s+/);
  const payload = tokens[0]!.slice(RECORD_KEY.length + 1); // strip "dnstall="

  const parsed = parsePayload(payload);
  if (!parsed) return null;

  const { pkg, version } = splitPackageVersion(parsed.identifier);
  if (!pkg) return null;

  const metadata: Record<string, string> = {};
  for (const token of tokens.slice(1)) {
    const eq = token.indexOf("=");
    if (eq > 0) {
      const key = token.slice(0, eq);
      const value = token.slice(eq + 1);
      if (key) metadata[key] = value;
    }
    // unknown/invalid tokens are ignored, never fatal
  }

  const record: DnstallRecord = { namespace: parsed.namespace, package: pkg, metadata, raw: trimmed };
  if (version) record.version = version;
  return record;
}

/**
 * Parse all TXT values and return the valid domaininstall records.
 * Optionally filter to a namespace (e.g. "npm").
 */
export function parseRecords(rawRecords: string[], namespace?: string): DnstallRecord[] {
  const parsed = rawRecords
    .map(parseRecord)
    .filter((r): r is DnstallRecord => r !== null);
  return namespace ? parsed.filter((r) => r.namespace === namespace) : parsed;
}

/** Return one representative for each distinct install-relevant mapping. */
export function distinctRecordMappings(records: DnstallRecord[]): DnstallRecord[] {
  const mappings = new Map<string, DnstallRecord>();
  for (const record of records) {
    const key = JSON.stringify([record.namespace, record.package, record.version ?? null]);
    if (!mappings.has(key)) mappings.set(key, record);
  }
  return [...mappings.values()];
}
