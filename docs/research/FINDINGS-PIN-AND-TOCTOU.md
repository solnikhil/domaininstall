# Findings: pin fields, schema v2, exact-version + integrity, TOCTOU

**Status:** research complete  
**Date:** 2026-08-04  
**Anchors:** `src/pin.ts`, `src/cli.ts` (`diffPin` / `savePin` / confirm → `runInstall`), `src/install.ts` (`buildInstallPlan`), ROADMAP G7 / G8 / §6 layers 1–2, SECURITY-domain-ownership.md, RESEARCH-BACKLOG RB-PIN / RB-TOCTOU

---

## Current pin schema (v1)

Store file: `~/.domaininstall/pins.json` (or `DOMAININSTALL_STATE_DIR`), `STORE_VERSION = 1`.

Per-domain pin fields today:

| Field | Role |
| --- | --- |
| `namespace` | Ecosystem (`npm` only in alpha) |
| `package` | npm package name from DNS |
| `registry` | Effective HTTPS registry URL shown and passed as `--registry=` |
| `dnsVersion` | Domain’s declared version **policy** from the TXT record (`null` ⇒ “latest” in diffs), **not** the CLI override |
| `firstSeen` / `lastSeen` | ISO timestamps |

Diff triggers interactive re-confirm (and ignores `--yes`) when namespace, package, registry, or dnsVersion change. Pin is written only after a **successful** install.

Hardening already present: fail-closed parse, lock, atomic replace, POSIX owner/mode + O_NOFOLLOW; weaker Windows guarantees documented in SECURITY.md.

---

## Threat coverage vs current pins

Headline threat from SECURITY-domain-ownership.md: domain expires / transfers / is hijacked; attacker repoints `_dnstall` to a different package.

| Attack / change | Caught by v1 pins? |
| --- | --- |
| TXT repoints to different package name | **Yes** (`package`) |
| TXT switches ecosystem | **Yes** (`namespace`) |
| Effective registry changes (or scope divert was wrongly shown) | **Yes** (`registry`), with install refused when `@scope:registry` ≠ default |
| Domain’s DNS version policy changes (`@^1` → `@^2` or to latest) | **Yes** (`dnsVersion`) — separate from one-off CLI `@version` |
| Same package, malicious **new** version matching a range | **No** — pin does not store resolved version or integrity |
| Same package name, **npm owner/publisher** takeover | **No** |
| Tarball replaced at same version (registry integrity change) | **No** |
| Provenance present then gone | **No** |
| DNSSEC AD true → false (or reverse) | **No** (not pinned; badge is display-only) |
| Domain re-registered (RDAP creation date moves) | **No** (G9) |
| First-time user, no prior pin | **No** by design (G10 / TOFU) |
| TTL flip of DNS **after** confirm | **Mostly no for DNS** — DNS is not re-queried after confirm (good). **Yes residual for npm range resolution** (below). |

**Honest summary:** v1 pins defeat the **repoint-to-another-package** story for returning users. They do **not** pin artifact identity. ROADMAP §6 already marks layers 1–2 as partial for that reason (G7).

---

## Residual TOCTOU (mapping vs artifact)

Roadmap anti-TOCTOU claim: resolve once before preview; confirmed values are what execute. That is **true for the domaininstall-controlled argv**:

- package name comes from the already-parsed record
- version string is the effective policy/CLI range (or omitted for latest)
- `--registry=` is the pre-resolved effective registry
- DNS is not consulted again after confirm

It is **not** true that “the bits the user mentally approved” are bound:

1. **Range / latest drift.** `buildInstallPlan` emits `pkg@^18` or bare `pkg`. Between confirm and npm’s registry fetch, a new version can satisfy the range. The user confirmed a **policy**, not a tarball.
2. **No integrity in argv.** npm will verify whatever integrity the **registry** advertises at fetch time; domaininstall does not pin or re-check a previously seen SRI.
3. **CLI version override is not pinned.** By design `dnsVersion` tracks the TXT policy only, so `di domain@^9` does not rewrite the pin’s policy—but the install still uses the override for that run without recording the resolved exact version.

So: **DNS TOCTOU is largely closed; npm resolution TOCTOU remains open.** Closing G7 without an exact-version step only half-solves the design doc’s anti-TOCTOU rule (“pass exact version + integrity hash to npm”).

---

## Recommended pin schema v2

Bump `STORE_VERSION` to `2`. Keep fail-closed parsing. Migrate v1 → v2 on read by filling new fields with `null` / omitted and **not** inventing integrity after the fact (unknown is unknown).

### Fields to add (minimum useful set)

| Field | Type | Purpose | Diff behavior |
| --- | --- | --- | --- |
| `resolvedVersion` | `string \| null` | Exact version last successfully installed for this domain | Change → re-confirm (optional severity: info if still within `dnsVersion` policy, hard if policy also changed) |
| `integrity` | `string \| null` | SRI from registry packument `dist.integrity` (e.g. `sha512-…`) for that version | Change at same version → **hard** re-confirm (possible re-publish / swap) |
| `resolvedAt` | ISO string \| null | When resolvedVersion/integrity were captured | Not a diff field; supports G8 maxAge later |
| `dnssecAtPin` | `boolean \| null` | AD bit at last successful pin update | Regression true→false → warn / re-confirm (low priority) |

Optional later (not required to close the core G7 loop):

| Field | Notes |
| --- | --- |
| `publisher` / `maintainers` | From registry metadata; unstable shape; privacy/renames cause noise |
| `provenance` | Boolean or attestation digest; useful signal, forgeable (design doc Layer 6) |
| `maxAgeDays` / `expiresAt` | G8 short trust window |
| `registration` | RDAP snapshot (G9) |

### What NOT to pin yet

- **Full packument or tarball bytes** — size and complexity; integrity SRI is enough.
- **Dependency tree / lockfile of transitive deps** — out of scope; domaininstall is not a substitute for package-lock.
- **CLI override version as permanent policy** — keep `dnsVersion` = DNS policy only.
- **Transparency-log inclusion proofs** — no infra (G10 / Layer 5).
- **Nameserver sets** — noisy; couple to RDAP work if ever.
- **git commit / repo URL from TXT metadata** — metadata is untrusted display only today; pinning it creates false continuity.

### Migration rules

- v1 pins remain valid; missing v2 fields mean “never bound an artifact.”
- First successful install **after** upgrade should populate `resolvedVersion` + `integrity` when the resolve-before-install path exists.
- Diffing: if old pin has `integrity: null` and new install gets an integrity, treat as **enrichment** (update pin) without screaming “hijack,” unless package/registry/policy also changed.
- If pin has integrity and live resolve differs → hard interactive path (same as package rename).

---

## Exact-version + integrity install flow (no new deps)

Goal: what the user confirms is an **artifact identity**, then npm is invoked in a way that cannot silently float to another version.

### Recommended flow (install path)

```
1. DNS resolve + parse + validate (existing)
2. Resolve effective registry (existing)
3. Registry metadata fetch (NEW, HTTPS only, same registry host):
     GET {registry}/{encodedPackage}
     or GET {registry}/{encodedPackage}/{exactVersion}
   - Use global fetch (already used for DoH); zero deps
   - For scoped packages: encode as @scope%2Fname (npm registry convention)
4. Select exact version:
   - If effective version is exact semver → use it
   - If range or latest → pick max satisfying version from packument
     (implement a minimal range check or only support exact + dist-tags
      first; see version-range note below)
5. Read dist.integrity (and dist.tarball) for that version; fail closed if missing
6. Preview shows: package, exact version, integrity short prefix, registry, DNS policy
7. Confirm
8. Install with argv that pins identity, still --ignore-scripts:
     npm install --ignore-scripts [--global] --registry={registry} {pkg}@{exactVersion}
   - npm still verifies integrity against the registry’s current metadata for that
     version; our pin records what we showed
9. On success, savePin including resolvedVersion + integrity (+ dnssecAtPin)
```

### Integrity in the install command

npm does **not** expose a stable first-class `npm install pkg --integrity=sha512-…` UX comparable to package-lock’s `integrity` field for arbitrary CLI installs. Practical options without new deps:

| Approach | Pros | Cons |
| --- | --- | --- |
| **A. Exact `pkg@version` only** | Simple; closes range float; npm still checks registry integrity at fetch | Does not freeze SRI if registry rewrites metadata for same version (rare but the scary case) |
| **B. Install via tarball URL** `npm install --ignore-scripts {dist.tarball}` | URL is specific; still registry-hosted | Tarball URL may not re-check the pin’s SRI unless we hash the download ourselves; auth/CDN quirks |
| **C. Fetch tarball in-process, verify SRI with `crypto` (Node built-in), then `npm install ./file.tgz`** | True pin enforcement; zero deps | More code; offline path; global install behavior; must validate URL host matches registry |
| **D. Write a transient package-lock / use `npm ci`** | npm-native integrity | Heavy-handed; interacts badly with existing project lockfiles |

**Recommendation for alpha/G7:**

- **Ship A first** (exact version after packument resolve, show integrity in preview, store integrity in pin, hard-diff on next run). This closes range TOCTOU and detects integrity changes on re-install **before** the next npm invocation.
- **Add C when** enforcing integrity on the *current* install (not only next time) is required—still no new dependencies (`node:crypto` createHash / webcrypto). Prefer verifying the tarball ourselves over trusting a rewritten packument.

Do **not** add `pacote`, `ssri`, or `npm-registry-fetch` as production dependencies; the project’s zero-deps stance is a security and supply-chain feature (ROADMAP §2).

### Version selection without a semver library

`validateVersionRange` today is a charset gate, not a semver engine. Options:

1. **Phase 1:** only auto-resolve exact versions and single dist-tags (`latest`, `next`); if DNS/CLI supplies a range (`^`, `~`, `>=`), either:
   - pass the range through as today (document residual risk), or
   - resolve packument and implement a **narrow** satisfier for `^x.y.z` / `~x.y.z` / exact (common publisher cases), refuse exotic ranges until a careful parser exists.
2. **Avoid** pulling `semver` unless product-validation demands rich ranges in DNS.

Recommendation: **exact + `latest` tag resolution in packument first**; keep charset validation for ranges; when range is present, resolve to max matching version with a small hand-rolled comparator for standard npm range forms *or* call `npm view pkg@version version --json` via the existing shell-free npm launcher (uses local npm’s semver, no new dep, but couples to npm CLI).

`npm view` approach (attractive for zero-deps):

```
npm view {pkg}@{range} version --json --registry={registry}
npm view {pkg}@{exact} dist.integrity --json --registry={registry}
```

Reuse `resolveNpmLauncher` / spawnSync patterns from `install.ts`. Validate outputs as strings; refuse multi-value surprises.

---

## Interaction with confirm UX

- Preview must show **exact** version when resolved, plus DNS policy line (already separate).
- If integrity is shown abbreviated (`sha512-AbCd…`), full value still goes to the pin.
- Mapping change and integrity change both force interactive confirm; do not allow `--yes` to skip.
- Enrichment-only updates (null → first integrity) can soft-update after success without a scary “hijack” banner.

---

## Open residual risks (even after v2 + exact version)

1. **First-use TOFU** — still nothing to compare (G10).
2. **Same-version tarball replacement** if we only do approach A and never verify bytes (mitigate with C or hard-diff on next install when integrity string changes).
3. **Transitive dependencies** — unpinned; `--ignore-scripts` reduces but does not eliminate risk.
4. **Publisher account takeover with new version** — exact pin helps only if user re-installs via domaininstall and diffs; `npm update` outside the tool bypasses pins entirely.
5. **RDAP / expiry** — still open (G9).
6. **Pin store compromise** — local attacker who can write `pins.json` can weaken TOFU; fail-closed mode bits help on POSIX only (G11).
7. **Registry lies on first fetch** — integrity pins whatever the registry said at first success; without a transparency log, first fetch remains trusted (same class as go.sum without sumdb).
8. **Scoped registry refuse** — orthogonal; wrong registry never gets pinned if install is refused (see FINDINGS-SCOPE-AND-PURL.md).

---

## Decision

- v1 pins are **sufficient for mapping continuity**, **insufficient for artifact continuity**.
- G7 should be closed by **schema v2** (`resolvedVersion`, `integrity`, timestamps) plus an install path that **resolves exact version before confirm** and records registry SRI.
- Prefer **zero new deps**: packument via `fetch` or `npm view` through the existing launcher; optional tarball hash with `node:crypto`.
- **Do not** pin publisher/provenance/RDAP in the first v2 bump unless the fetch path already has the data for free and diffs are carefully tiered—integrity + exact version are the high-value pair.
- Roadmap’s “anti-TOCTOU: resolve once” should be documented as **mapping fixed; artifact fixed only after G7 exact+integrity work.**

## Recommended next code change

When implementing (not in this research pass):

1. Extend `Pin` + `diffPin` + `STORE_VERSION` migration in `pin.ts`.
2. Add `resolveNpmArtifact(pkg, range, registry) → { version, integrity }` using `npm view` or HTTPS packument.
3. Change `buildInstallPlan` to require exact version for the executed argv; show integrity in `printSummary`.
4. Tests: range resolves to exact; integrity change forces confirm; v1 pin migration; no install on packument failure.

## Residual unknowns

- How often npm registry omits `dist.integrity` for old packages (fail-closed may block legacy packages).
- Stability of `npm view … --json` output across npm major versions used in CI (22/24 matrix).
- Whether publishers commonly put rich ranges in TXT (affects how soon a full range engine is needed).
- False-positive rate if npm ever rotates integrity algorithms (sha512 → something else) for the same bytes.
- Product willingness to fetch registry metadata before confirm (extra network; privacy: registry sees package lookup, not only DoH providers).
