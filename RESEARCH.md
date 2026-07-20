# domaininstall — Technical Feasibility Research (2026)

> **Historical research.** This document predates the final `di` command,
> `_dnstall` record prefix, and current implementation. Use `README.md` and
> `ROADMAP.md` for current behavior and execution status.

> Focused research to confirm feasibility and pick libraries for the `dpm <domain>`
> CLI. Scope: (1) DoH TXT resolution in Node, (2) client-side DNSSEC feasibility,
> (3) package-manager detection + safe install, (4) version/record format design.
> Verdict up front: **the whole loop is feasible with mature, maintained libraries.**
> The only "be honest" area is DNSSEC — see §2.
>
> _Content from external sources was rephrased for compliance with licensing restrictions; sources cited inline._

---

## (a) Recommended tech stack

| Concern | Recommendation | Version (verified via `npm view`, 2026) | Notes |
|---|---|---|---|
| Runtime | Node.js 20+ (target 22 LTS) | — | Sandbox default is Node 22; `fetch` + `undici` are built in. |
| Language | TypeScript | 5.x | Distribute as global npm pkg `dpm`. |
| DoH resolution | **Native `fetch` against the DoH JSON API** (no dep) | — | Simplest, zero-dep. See §1. |
| DoH (fancier) | `dohdec` **8.0.0** or `tangerine` **2.1.3** | — | Optional. Use only if you want wire-format/`dns.Resolver` drop-in. |
| DNS wire parsing (if needed) | `dns-packet` | 5.x | Only needed for wire format / DNSSEC. Not needed for JSON path. |
| DNSSEC (optional "badge") | `@relaycorp/dnssec` **1.12.1** | — | Resolver-agnostic, real validation. See §2. Best-effort only. |
| PM detection | **`package-manager-detector` 1.7.0** (primary) | — | antfu-collective; also gives you the exact command strings. |
| PM install (alt) | `nypm` **0.6.8** | — | Higher-level: `addDependency()` runs the install for you. See §3. |
| CLI framework | `citty` (unjs) or `commander` | — | `citty` pairs well with the unjs ecosystem (nypm). Either is fine. |
| Prompts | `@clack/prompts` or Node's `readline` | — | For the y/N confirmation. |
| semver handling | `semver` | 7.x | Validate/normalize the optional version part of the record/arg. |

**Two viable architectures for the install step:**

- **Option A (recommended for Phase 0): detect + hand off yourself.** Use
  `package-manager-detector` to identify the PM and get the canonical command
  array, then run it with `child_process.spawn(cmd, argsArray, { stdio: 'inherit' })`
  — **no shell**. Maximum control + you print exactly what you'll run before the y/N.
- **Option B: let `nypm` do it.** `import { addDependency } from 'nypm'` and call
  `addDependency('stripe', { ... })`. Less code, but you hand off the argv
  construction to nypm (it's safe — see §3).

Phase 0 should use **Option A** because the whole product pitch is "show the user
exactly what will run, then run precisely that." You want to own that string.

---

## (b) DNSSEC feasibility verdict

**Verdict: treat DNSSEC as a best-effort trust *boost/badge*, NOT a hard
requirement.** Two honest reasons:

1. **Real end-to-end validation in JS is now *possible* but heavy.**
   `@relaycorp/dnssec` (v1.12.1, actively maintained) is the one genuinely
   resolver-agnostic library that does actual chain validation against IANA trust
   anchors — you feed it DNS responses (it needs `RRSIG` records, wire format) and
   it returns `SECURE` / `INSECURE` / `BOGUS` / `INDETERMINATE`
   ([relaycorp/dnssec-js](https://github.com/relaycorp/dnssec-js)). Its own README
   is blunt that historically there was *no reliable way* to do DNSSEC verification
   in Node — `getdns-node` (native C dep, painful) and `dnssecjs` (abandoned 2017,
   never published) both failed. relaycorp filled that gap. Caveat: it does **not**
   implement denial-of-existence (NSEC/NSEC3), so you can't prove a record is
   *absent* — fine for our use case (we only care that a present record is authentic).

2. **The cheap path is "trust a validating resolver," which is authenticity-by-proxy,
   not true end-to-end.** The DoH JSON response has an **`AD` (Authenticated Data)
   flag**: when `true`, the resolver reports every record in the answer was verified
   with DNSSEC ([Cloudflare DoH JSON docs](https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/dns-json/)).
   You get this for free on every query — but it only means "Cloudflare/Google
   validated it," and DoH itself only encrypts the query; it does **not** prove
   authenticity end-to-end (per your own NOTES, DoH ≠ authenticity). A
   long-standing SO answer makes the same point: unless you implement validation
   yourself, you depend on an external validator like Google/Cloudflare to say
   valid/invalid/insecure ([Stack Overflow](https://stackoverflow.com/questions/38307209/how-can-i-check-dnssec-compliance-with-nodejs)).

**Recommended posture:**
- **Phase 0/1:** read the `AD` flag from the DoH JSON response. If `AD=true`, show a
  "DNSSEC ✓" badge. If not, proceed anyway (most domains still don't sign — low
  deployment, per your notes). Never block an install solely on missing DNSSEC.
- **Phase 3 (badge hardening):** add `@relaycorp/dnssec` for *real* end-to-end
  validation on domains that are signed, so the badge means "we verified it" rather
  than "Cloudflare said so." This is a genuine differentiator but not worth the
  complexity for the weekend MVP.
- Watch **RFC 8027 (DNSSEC Roadblock Avoidance)** — middleboxes/resolvers that strip
  DNSSEC data are a real source of false negatives ([RFC 8027](https://www.rfc-editor.org/rfc/rfc8027)).
  Another reason to make it a badge, not a gate.

---

## (c) Proposed record format (with optional version + metadata)

Keep the DNSLink-style `key=/namespace/identifier` core, then extend with
**RFC 1464 `key=value` attribute pairs** for version + metadata. DNSLink already
uses this shape, so you inherit its "multiple records, sort lexicographically,
ignore invalid" conventions.

### Minimal (Phase 0) — unchanged from NOTES

```
_dpm.stripe.com.  TXT  "dpm=/npm/stripe"
```

### With version

Prefer encoding version **inside the path segment using npm's own `@` convention**,
because it's the least surprising and maps 1:1 to what you'll pass to the PM:

```
_dpm.stripe.com.  TXT  "dpm=/npm/stripe@^18"
_dpm.foo.com.     TXT  "dpm=/npm/foo@5.2.1"
```

- The part after `@` is a standard **semver range** — validate/parse it with the
  `semver` package. Ranges (`^18`, `~5.2`, `5.x`, `>=4 <6`) and exact pins (`5.2.1`)
  both work because that's exactly what `npm install pkg@<range>` accepts
  ([npm version/range install](https://www.mend.io/blog/npm-how-to-install-a-specific-version-of-node-js-package/)).
- **CLI arg mirrors it:** `dpm stripe.com@5` — if the user supplies a version, it
  **overrides** the record's version (user intent wins). Parse the arg by splitting
  on the last `@` (careful with scoped-package-like inputs, though domains won't be
  scoped).

### With metadata (Phase 1) — space-separated `key=value` after the pointer

RFC 1464 allows multiple attributes; put the pointer first, then optional keys:

```
_dpm.foo.com.  TXT  "dpm=/npm/foo@^5 repo=https://github.com/foo/foo homepage=https://foo.com"
```

Suggested optional keys (all ignorable): `repo`, `homepage`, `issues`, `min-dpm`
(minimum CLI version), `note`. **Rule: unknown keys are ignored, never error** —
same robustness principle DNSLink uses.

### npm alias note (for the install command, not the record)

If a domain's brand name differs from the package name and you ever want the
installed dependency to appear under the domain-ish name, npm supports alias
installs: `npm i <alias>@npm:<realpkg>@<range>` (e.g.
`npm i case-1.5.3@npm:case@1.5.3`) ([Stack Overflow](https://stackoverflow.com/questions/56134857/how-to-install-npm-package-under-alias-or-different-name)).
For v0 keep it simple: install the real package name. Aliasing is a later nicety,
not part of the record format.

---

## (d) Technical gotchas / blockers before you write code

### DoH / DNS parsing
1. **TXT multi-string is real and you must handle it.** Each TXT "character-string"
   is capped at **255 bytes**; a single record can carry multiple strings that
   resolvers concatenate into one logical value
   ([Cloudflare TXT record](https://www.cloudflare.com/learning/dns/dns-records/dns-txt-record/),
   [ISC KB](https://kb.isc.org/docs/aa-00356)). Your records are short (`dpm=/npm/...`)
   so you likely stay under 255, **but** if you add metadata you can cross it. Parse
   defensively: strip surrounding quotes and concatenate.
2. **Cloudflare's DoH JSON escapes TXT quotes.** In the JSON `data` field, TXT
   strings come wrapped/escaped (you'll see `\"` due to JSON escaping); Cloudflare
   changed this escaping behavior in early 2025, so **don't hand-roll a fragile
   regex** — trim leading/trailing `"` and unescape
   ([Cloudflare community](https://community.cloudflare.com/t/the-doh-txt-record-escape-has-been-changed/763809/3)).
3. **The DoH JSON schema is not an IETF standard** — Cloudflare follows Google's
   schema by convention and reserves the right to change it
   ([Cloudflare DoH JSON docs](https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/dns-json/),
   [Cloudflare community](https://community.cloudflare.com/t/improved-doh-json-response-format-for-additional-record-types/869954)).
   Mitigation: query **two providers** (Cloudflare `cloudflare-dns.com/dns-query`
   + Google `dns.google/resolve`), both use the same schema, and cross-check /
   fall back. Send `Accept: application/dns-json`, `type=TXT`, and `do=1` if you
   want the DNSSEC `AD` bit populated.
4. **Check `Status` in the response.** `Status: 0` = NOERROR. NXDOMAIN (3) means no
   `_dpm` record → show a friendly "this domain hasn't set up dpm" message (this is
   your `dpm verify` diagnostic surface, and directly addresses the DNS-UX pain
   point rsc raised in Go #26160).
5. **Multiple TXT records per name** are allowed (multiple packages). Sort
   lexicographically for deterministic output, exactly like DNSLink.

### Install / process execution
6. **Never build a shell string. Ever.** Pass args as an **argv array** via
   `spawn`/`execFile` with **no `shell: true`** — this is the single most important
   security rule for this tool since input originates from DNS. Shell metacharacters
   (`;`, `&&`, `$()`, backticks) are only dangerous when a shell interprets them;
   argv arrays bypass the shell entirely
   ([eslint-plugin-security](https://github.com/nodesecurity/eslint-plugin-security/blob/main/docs/avoid-command-injection-node.md),
   [OWASP-style writeup](https://techearl.com/os-command-injection)).
   Additionally: **validate the package name** against the npm naming grammar and
   the version against `semver` *before* it ever reaches `spawn`, and reject
   anything with a leading `-` (arg-injection / flag smuggling).
7. **`nypm` is safe but opaque.** `nypm` (0.6.8, unjs) builds the command for you and
   also exposes `addDependencyCommand(pm, name, opts)` / `installDependenciesCommand(pm)`
   to *get the command array without running it* — useful for the "here's exactly
   what I'll run" preview ([unjs/nypm](https://github.com/unjs/nypm)). It uses
   execa/tinyexec-style argv execution under the hood (no shell string), so it's not
   an injection risk, but you give up direct control of the printed command.
8. **npm 12 (July 2026) blocks lifecycle install scripts by default** (per your
   NOTES). Good for safety, but means you should **not** market "we stop malicious
   install scripts" — the base is already safer. Also: some legit packages need
   scripts; be ready to tell users when an install needs `--allow-scripts` (or PM
   equivalent) rather than silently failing.

### Package-manager detection library choice
9. **`package-manager-detector` (1.7.0) > `detect-package-manager` (3.0.2) >
   `nypm`'s detector — for our needs.**
   - `package-manager-detector` (antfu-collective, actively maintained late 2025):
     detects via lockfiles + `packageManager` field + install metadata, **and gives
     you ready-made command templates** (`add`, `install`, etc.) per PM
     ([antfu-collective/package-manager-detector](https://github.com/antfu-collective/package-manager-detector)).
     This is the sweet spot: detection **and** the exact argv to preview/run.
   - `detect-package-manager` (egoist/azat-io): simpler — lockfile first, else probes
     which PM binaries exist, else npm
     ([egoist/detect-package-manager](https://github.com/egoist/detect-package-manager)).
     Fine but gives you less (no command templates).
   - `nypm`'s `detectPackageManager()` is good and includes corepack integration, but
     you'd pull it in mainly if you also use nypm for the install (Option B).
   - **Gotcha:** for a *global* install (`dpm` is often run outside any project, e.g.
     `npm i -g`), lockfile-based detection is meaningless — there's no project. Decide
     detection scope explicitly: **default to npm for global installs**, and only
     detect PM when installing into a detected project (cwd has a lockfile /
     package.json). Don't blindly trust a detector when there's no project context.

### Design / correctness
10. **Version precedence must be defined and shown:** CLI arg `@version` > record
    `@version` > record default (`latest`). Print the resolved version in the y/N
    prompt so the user confirms the *exact* thing.
11. **Namespace guard:** only act on `/npm/` in Phase 0. If the record says
    `/pypi/` or `/cargo/`, recognize it but say "not supported yet" rather than
    misrouting to npm.
12. **Clock drift + DNSSEC:** if/when you add `@relaycorp/dnssec`, RRSIG validity is
    time-bound; the library lets you accept a tolerance window (e.g. last hour) to
    avoid false BOGUS from skewed clocks ([relaycorp/dnssec-js](https://github.com/relaycorp/dnssec-js)).

---

## Quick-start snippet (native fetch DoH TXT — zero dep)

```ts
// Resolve _dpm.<domain> TXT via Cloudflare DoH JSON, with Google fallback.
async function resolveDpmTxt(domain: string): Promise<{ records: string[]; ad: boolean }> {
  const name = `_dpm.${domain}`;
  const urls = [
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=TXT&do=1`,
    `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=TXT&do=1`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { accept: 'application/dns-json' } });
      if (!res.ok) continue;
      const json = await res.json() as any;
      if (json.Status !== 0 || !Array.isArray(json.Answer)) continue;
      const records = json.Answer
        .filter((a: any) => a.type === 16) // 16 = TXT
        // strip surrounding quotes, join multi-string chunks
        .map((a: any) => String(a.data).replace(/^"|"$/g, '').replace(/"\s+"/g, ''))
        .sort(); // deterministic, DNSLink-style
      return { records, ad: json.AD === true };
    } catch { /* try next provider */ }
  }
  return { records: [], ad: false };
}
// Then: find record starting with "dpm=/npm/", parse pkg@range, confirm, spawn.
```

---

## Sources
- Cloudflare DoH JSON API — https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/dns-json/
- Cloudflare — What is a DNS TXT record (255-byte strings) — https://www.cloudflare.com/learning/dns/dns-records/dns-txt-record/
- Cloudflare community — DoH TXT escape change (2025) — https://community.cloudflare.com/t/the-doh-txt-record-escape-has-been-changed/763809/3
- ISC KB — TXT/SPF >255 chars — https://kb.isc.org/docs/aa-00356
- relaycorp/dnssec-js — https://github.com/relaycorp/dnssec-js
- SO — DNSSEC compliance with Node.js — https://stackoverflow.com/questions/38307209/how-can-i-check-dnssec-compliance-with-nodejs
- RFC 8027 — DNSSEC Roadblock Avoidance — https://www.rfc-editor.org/rfc/rfc8027
- antfu-collective/package-manager-detector — https://github.com/antfu-collective/package-manager-detector
- egoist/detect-package-manager — https://github.com/egoist/detect-package-manager
- unjs/nypm — https://github.com/unjs/nypm
- eslint-plugin-security — command injection (argv arrays) — https://github.com/nodesecurity/eslint-plugin-security/blob/main/docs/avoid-command-injection-node.md
- npm install specific version / ranges — https://www.mend.io/blog/npm-how-to-install-a-specific-version-of-node-js-package/
- npm alias install — https://stackoverflow.com/questions/56134857/how-to-install-npm-package-under-alias-or-different-name
- Tangerine (DoH drop-in for dns.Resolver) — https://forwardemail.net/docs/node-js-dns-over-https
