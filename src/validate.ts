/**
 * Input validation — the single most important security layer.
 *
 * Everything here guards values that originate from DNS (untrusted) or the CLI
 * before they are ever handed to a package manager. Even though we execute via
 * an argv array (never a shell string), we still strictly validate to prevent
 * argument/flag smuggling (e.g. a "package name" of `--registry=evil`).
 */

export interface Valid<T> {
  ok: true;
  value: T;
}
export interface Invalid {
  ok: false;
  error: string;
}
export type Result<T> = Valid<T> | Invalid;

const ok = <T>(value: T): Valid<T> => ({ ok: true, value });
const bad = (error: string): Invalid => ({ ok: false, error });

/** Domain names: labels of letters/digits/hyphens, dot-separated, with a TLD. */
export function validateDomain(input: string): Result<string> {
  const domain = input.trim().toLowerCase();
  if (!domain) return bad("empty domain");
  if (domain.length > 253) return bad("domain too long");
  if (domain.startsWith("-") || domain.includes("..")) return bad("malformed domain");
  const labelRe = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
  const labels = domain.split(".");
  if (labels.length < 2) return bad("expected a fully-qualified domain (e.g. example.com)");
  for (const label of labels) {
    if (!labelRe.test(label)) return bad(`invalid domain label: "${label}"`);
  }
  return ok(domain);
}

/**
 * npm package name grammar (scoped or unscoped). Deliberately strict.
 * Rejects anything that could be read as a CLI flag.
 */
export function validatePackageName(input: string): Result<string> {
  const name = input.trim();
  if (!name) return bad("empty package name");
  if (name.length > 214) return bad("package name too long");
  if (name.startsWith("-")) return bad("package name may not start with '-'");
  if (name.startsWith(".") || name.startsWith("_")) return bad("package name may not start with '.' or '_'");

  const unscoped = /^[a-z0-9][a-z0-9._-]*$/;
  const scoped = /^@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/;
  if (!unscoped.test(name) && !scoped.test(name)) {
    return bad(`invalid package name: "${name}"`);
  }
  return ok(name);
}

/** A conservative semver-range validator (no external dep for v0). */
export function validateVersionRange(input: string): Result<string> {
  const v = input.trim();
  if (!v) return bad("empty version");
  if (v.startsWith("-")) return bad("version may not start with '-'");
  // Allow digits, dots, and common range operators/keywords. No spaces, no shell chars.
  if (!/^[a-zA-Z0-9.^~*<>=+|-]+$/.test(v)) {
    return bad(`invalid version range: "${v}"`);
  }
  return ok(v);
}

/** Recognized ecosystems for v0 (only npm is wired up). */
export function validateNamespace(input: string): Result<string> {
  const ns = input.trim().toLowerCase();
  if (!/^[a-z0-9]+$/.test(ns)) return bad(`invalid namespace: "${ns}"`);
  return ok(ns);
}

/** Split a user-facing target like "stripe.com/react@5" into parts. */
export function parseTarget(input: string): Result<{ domain: string; sub?: string; version?: string }> {
  let rest = input.trim();
  if (!rest) return bad("no domain provided");

  // Extract trailing @version (but not a leading @scope — targets never start with @).
  let version: string | undefined;
  const at = rest.lastIndexOf("@");
  if (at > 0) {
    version = rest.slice(at + 1);
    rest = rest.slice(0, at);
  }

  // Split domain / subpath (e.g. stripe.com/react -> _dnstall.react.stripe.com).
  let sub: string | undefined;
  const slash = rest.indexOf("/");
  let domainPart = rest;
  if (slash >= 0) {
    domainPart = rest.slice(0, slash);
    sub = rest.slice(slash + 1).replace(/\/+$/, "");
  }

  const domainRes = validateDomain(domainPart);
  if (!domainRes.ok) return domainRes;

  const out: { domain: string; sub?: string; version?: string } = { domain: domainRes.value };
  if (sub) {
    if (!/^[a-z0-9][a-z0-9-]*$/i.test(sub)) return bad(`invalid sub-package label: "${sub}"`);
    out.sub = sub.toLowerCase();
  }
  if (version) {
    const vr = validateVersionRange(version);
    if (!vr.ok) return vr;
    out.version = vr.value;
  }
  return ok(out);
}
