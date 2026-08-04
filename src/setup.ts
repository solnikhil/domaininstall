/**
 * Publisher onboarding: turn a package name into the exact DNS record that
 * declares it for a domain.
 *
 * This is deliberately offline. A publisher needs the record text *before* the
 * record exists, so nothing here performs a lookup; `di verify` is the online
 * half of the loop.
 *
 * The generated value is checked back through the record parser before it is
 * returned, so the generator and the resolver can never disagree about the
 * format.
 */

import { DNS_PREFIX, RECORD_KEY, parseRecord } from "./record.js";
import {
  parseTarget,
  validatePackageName,
  validateVersionRange,
  type Result,
} from "./validate.js";

/** Only npm is wired up in this alpha, matching the install path. */
const NAMESPACE = "npm";

export interface SetupPlan {
  /** The zone the publisher administers, e.g. "example.com". */
  zone: string;
  /** What most DNS providers expect in the name/host field, e.g. "_dnstall.react". */
  relativeName: string;
  /** The fully-qualified record name, e.g. "_dnstall.react.example.com". */
  dnsName: string;
  /** The TXT value, e.g. "dnstall=pkg:npm/%40acme/widget@^2". */
  recordValue: string;
  /** A complete zone-file line, for anyone editing BIND or Route 53 directly. */
  zoneFileLine: string;
  /** The npm package being declared. */
  package: string;
  /** The declared version policy, when the publisher supplied one. */
  version?: string;
  /** The target to hand to `di verify`, e.g. "example.com/react". */
  verifyTarget: string;
}

/**
 * Split "name@range" or "@scope/name@range" into a package and optional range.
 *
 * A leading "@" is a scope, not a separator, so only an "@" after the first
 * character can introduce a version.
 */
export function splitPackageSpec(spec: string): { pkg: string; version?: string } {
  const at = spec.lastIndexOf("@");
  if (at > 0) return { pkg: spec.slice(0, at), version: spec.slice(at + 1) };
  return { pkg: spec };
}

/**
 * purl percent-encodes a leading npm scope: "@acme/widget" becomes
 * "%40acme/widget". The inner slash stays literal, because the record parser
 * splits the namespace on the first slash and percent-decodes the remainder.
 */
export function encodePurlPackage(pkg: string): string {
  return pkg.startsWith("@") ? `%40${pkg.slice(1)}` : pkg;
}

export function buildSetupPlan(domainTarget: string, packageSpec: string): Result<SetupPlan> {
  const target = parseTarget(domainTarget);
  if (!target.ok) return target;
  if (target.value.version !== undefined) {
    return {
      ok: false,
      error:
        "Put the version range on the package, not the domain " +
        "(di setup example.com my-package@^2).",
    };
  }
  const { domain, sub } = target.value;

  const { pkg, version } = splitPackageSpec(packageSpec.trim());
  const nameCheck = validatePackageName(pkg);
  if (!nameCheck.ok) return nameCheck;
  if (version !== undefined) {
    const versionCheck = validateVersionRange(version);
    if (!versionCheck.ok) return versionCheck;
  }

  const relativeName = sub ? `_${DNS_PREFIX}.${sub}` : `_${DNS_PREFIX}`;
  const dnsName = `${relativeName}.${domain}`;
  const encoded = encodePurlPackage(nameCheck.value);
  const recordValue = `${RECORD_KEY}=pkg:${NAMESPACE}/${encoded}${version ? `@${version}` : ""}`;

  // Fail loudly rather than hand a publisher a record this CLI cannot read.
  const roundTrip = parseRecord(recordValue);
  if (
    !roundTrip ||
    roundTrip.namespace !== NAMESPACE ||
    roundTrip.package !== nameCheck.value ||
    roundTrip.version !== version
  ) {
    return {
      ok: false,
      error: `Internal error: generated a record this version cannot parse back (${recordValue}).`,
    };
  }

  const plan: SetupPlan = {
    zone: domain,
    relativeName,
    dnsName,
    recordValue,
    zoneFileLine: `${dnsName}.  IN  TXT  "${recordValue}"`,
    package: nameCheck.value,
    verifyTarget: sub ? `${domain}/${sub}` : domain,
  };
  if (version) plan.version = version;
  return { ok: true, value: plan };
}
