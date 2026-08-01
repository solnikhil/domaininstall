/**
 * Publisher onboarding — turn a package name into the exact DNS record to publish.
 *
 * Pure logic only: no printing, no network, no file access. The CLI layer owns
 * presentation. Nothing here trusts its input; package names, version ranges,
 * and domains are validated with the same guards used on the install path.
 */

import { DNS_PREFIX, RECORD_KEY } from "./record.js";
import {
  validateDomain,
  validatePackageName,
  validateVersionRange,
  type Result,
} from "./validate.js";

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const bad = (error: string): Result<never> => ({ ok: false, error });

/** A package argument, optionally carrying a version range: "foo@^2". */
export interface PackageSpec {
  package: string;
  version?: string;
}

/** The record a publisher has to create, in the shapes registrars ask for. */
export interface RecordParts {
  /** Fully-qualified record name: _dnstall.example.com */
  name: string;
  /** Host/subdomain part alone, which is what most registrar forms want. */
  host: string;
  type: "TXT";
  /** Unquoted record value: dnstall=pkg:npm/foo@^2 */
  value: string;
  /** Value wrapped in the quotes most zone editors expect. */
  quotedValue: string;
  /** A full BIND-style zone line, for anyone editing a zone file directly. */
  zoneLine: string;
}

export interface RegistrarNote {
  registrar: string;
  note: string;
}

/**
 * Split "foo@^2" or "@scope/foo@^2" into package and range.
 *
 * A leading "@" denotes an npm scope, not a version separator, which is why the
 * search starts past index 0 — the same rule the record parser applies.
 */
export function parsePackageSpec(input: string): Result<PackageSpec> {
  const trimmed = input.trim();
  if (!trimmed) return bad("no package provided");

  let name = trimmed;
  let range: string | undefined;
  const at = trimmed.lastIndexOf("@");
  if (at > 0) {
    name = trimmed.slice(0, at);
    range = trimmed.slice(at + 1);
  }

  const nameResult = validatePackageName(name);
  if (!nameResult.ok) return nameResult;

  if (range === undefined) return ok({ package: nameResult.value });

  const rangeResult = validateVersionRange(range);
  if (!rangeResult.ok) return rangeResult;
  return ok({ package: nameResult.value, version: rangeResult.value });
}

/**
 * Build the record payload.
 *
 * A scoped package's leading "@" is percent-encoded, because in a purl the "@"
 * character separates the version. `pkg:npm/%40scope/name` is what the parser
 * decodes back into `@scope/name`.
 */
export function buildRecordValue(input: string): Result<string> {
  const spec = parsePackageSpec(input);
  if (!spec.ok) return spec;

  const identifier = spec.value.package.startsWith("@")
    ? `%40${spec.value.package.slice(1)}`
    : spec.value.package;
  const versioned = spec.value.version ? `${identifier}@${spec.value.version}` : identifier;
  return ok(`${RECORD_KEY}=pkg:npm/${versioned}`);
}

/**
 * Build every shape of the record for a domain and package.
 *
 * `sub` adds a sub-package label, so `di setup example.com/react react` and
 * `di example.com/react` agree on the record name.
 */
export function buildRecord(domain: string, packageInput: string, sub?: string): Result<RecordParts> {
  const domainResult = validateDomain(domain);
  if (!domainResult.ok) return domainResult;

  if (sub !== undefined && !/^[a-z0-9][a-z0-9-]*$/i.test(sub)) {
    return bad(`invalid sub-package label: "${sub}"`);
  }

  const valueResult = buildRecordValue(packageInput);
  if (!valueResult.ok) return valueResult;

  const host = sub ? `_${DNS_PREFIX}.${sub.toLowerCase()}` : `_${DNS_PREFIX}`;
  const name = `${host}.${domainResult.value}`;
  const quotedValue = `"${valueResult.value}"`;

  return ok({
    name,
    host,
    type: "TXT",
    value: valueResult.value,
    quotedValue,
    zoneLine: `${name}.  IN  TXT  ${quotedValue}`,
  });
}

/**
 * Registrar-specific guidance.
 *
 * Each note covers the one step that actually causes failed setups rather than
 * restating the form. The recurring mistake is pasting the fully-qualified
 * record name into a field that already appends the domain, which silently
 * creates _dnstall.example.com.example.com.
 */
export const REGISTRAR_NOTES: readonly RegistrarNote[] = [
  {
    registrar: "Cloudflare",
    note: "DNS > Records > Add record, type TXT. Put only the host in Name; Cloudflare appends the domain and shows the full name once saved. Leave the proxy off, since TXT records are never proxied.",
  },
  {
    registrar: "Namecheap",
    note: "Advanced DNS > Add New Record > TXT Record. Host takes the host part alone. Namecheap's default TTL of Automatic is fine.",
  },
  {
    registrar: "GoDaddy",
    note: "DNS > Records > Add > TXT. The Name field is the host part alone. GoDaddy sometimes re-displays the value with its own quoting, so re-check it after saving.",
  },
  {
    registrar: "Squarespace (formerly Google Domains)",
    note: "DNS > Custom records > Add record, type TXT. Host takes the host part alone. Migrated Google Domains zones keep the same layout.",
  },
  {
    registrar: "Amazon Route 53",
    note: "Hosted zone > Create record, type TXT. Route 53 wants the fully-qualified record name and requires the value to be enclosed in double quotes exactly as shown.",
  },
  {
    registrar: "Any other DNS host",
    note: "Create a TXT record at the host shown. If the form's name field already displays your domain beside it, enter only the host part; if it expects a full name, use the fully-qualified one.",
  },
];

/** A README snippet a publisher can paste to advertise the mapping. */
export function readmeSnippet(domain: string, packageInput: string): Result<string> {
  const domainResult = validateDomain(domain);
  if (!domainResult.ok) return domainResult;
  const spec = parsePackageSpec(packageInput);
  if (!spec.ok) return spec;

  const site = domainResult.value;
  const snippet = [
    "## Install",
    "",
    "```bash",
    `di ${site}`,
    "```",
    "",
    `That resolves this project's package from \`${site}\` over DNS, previews it, and installs`,
    "with npm lifecycle scripts disabled. To inspect the declaration without installing:",
    "",
    "```bash",
    `di verify ${site}`,
    "```",
    "",
    `Installing \`${spec.value.package}\` directly from npm keeps working exactly as before.`,
    "",
  ].join("\n");
  return ok(snippet);
}
