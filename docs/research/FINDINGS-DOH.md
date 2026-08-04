# Findings: DoH, AD bit, dual-provider policy, system-resolver fallback

**Status:** research complete  
**Date:** 2026-08-04  
**Anchors:** `src/doh.ts`, `src/cli.ts` (`dnssecBadge`), ROADMAP G3 / G6 / R4, SECURITY.md, RESEARCH-BACKLOG RB-DOH / RB-GATE6

---

## What the code does today

`resolveTxt` queries two hard-coded DNS-over-HTTPS JSON endpoints in order:

1. `https://cloudflare-dns.com/dns-query`
2. `https://dns.google/resolve`

Each request uses `type=TXT`, `do=1` (DNSSEC OK — ask for DNSSEC-related data), and treats `json.AD === true` as `authenticated: true`. Authoritative outcomes (`answer`, `nodata`, `nxdomain`) **stop** the chain. Only provider-local failures (timeout, HTTP error, SERVFAIL, REFUSED, malformed) fall through to the next provider. `provider_exhaustion` is a distinct fail-closed outcome.

The install/verify preview shows `DNSSEC ✓` when `authenticated` is true, otherwise `DNSSEC —`. Verify also prints per-provider attempt outcomes.

---

## AD bit: what it actually means

### Protocol meaning

The **AD (Authenticated Data)** bit is defined for DNSSEC-aware recursive resolvers (RFC 3655 redefinition; RFC 4035 usage). When a validating recursive server returns a response with AD set, it asserts that **it** has authenticated the data in the answer/authority sections according to **its** DNSSEC policy (chain of trust from configured trust anchors).

AD is **not**:

- proof that the domain’s owner is the same person as last week
- proof that the TXT payload names a safe package
- proof that *this client* re-validated signatures itself
- equivalent to “DNSSEC is enabled on the zone” in isolation (a zone may be unsigned and AD will correctly be false)

AD is:

- a **resolver-attested** claim that the answer was DNSSEC-validated end-to-end *as the resolver sees the chain*
- available for positive answers and, in principle, for authenticated negative answers (NXDOMAIN / NODATA via NSEC/NSEC3), when the resolver sets AD on those statuses

### What Cloudflare and Google document for DoH JSON

Both providers expose the same informal JSON schema (Cloudflare explicitly follows Google’s).

| Field | Meaning (provider docs) |
| --- | --- |
| `do` (request) | DO bit: client wants DNSSEC-related records in the response when supported |
| `cd` (request) | Checking Disabled: skip validation at the resolver |
| `AD` (response) | Cloudflare: “every record in the answer was verified with DNSSEC.” Google: “Whether all response data was validated with DNSSEC.” |
| `CD` (response) | Echo of whether the client disabled checking |

domaininstall correctly leaves `cd` unset (validation enabled) and sets `do=1`. It does **not** implement client-side signature validation; it **trusts the DoH operator’s AD bit over TLS**. That matches SECURITY.md: transport to the configured DoH providers is trusted, and DNSSEC authenticity is a signal from those providers—not a local crypto verification.

### Practical implications for `_dnstall` TXT

1. **AD=true** means “Cloudflare/Google validated this TXT (or this negative answer) under their trust anchors.” Useful against on-path DNS spoofing between the user and the authoritative path *as observed by that public resolver*.
2. **AD=false** is the common case for unsigned zones. It is **not** an attack signal by itself. The badge must not scare users into thinking the mapping is fake.
3. **AD does nothing after domain transfer / re-registration.** A new legitimate owner who enables DNSSEC will get AD=true on a malicious repoint. Ownership continuity remains a pin/RDAP problem (SECURITY-domain-ownership.md Layer 1+).
4. **AD is only as honest as the DoH operator.** A compromised or malicious public resolver can return AD=true with fabricated data. Dual independent providers reduce (do not eliminate) that risk; they do not replace client-side validation or a transparency log.
5. **Split-view / different authorities.** Two providers can disagree. Current policy stops on the **first** authoritative answer and never cross-checks. That is intentional for availability and simplicity, but a hostile or poisoned first provider wins without Google ever being consulted.

---

## Dual-provider policy recommendation

### Keep (already correct)

- **Authoritative stop:** NODATA / NXDOMAIN from provider A must not be “fixed” by querying B. An outage is not the same as “no record,” but a real negative answer is not an outage. The code already separates `servfail`/`timeout`/`http_error` from `nodata`/`nxdomain`.
- **Fail closed on exhaustion:** no silent install when both providers fail.
- **Prefer DoH over ambient system DNS by default:** transport authentication to a known resolver host, consistent AD signal, fewer corporate-MITM surprises on plain port 53.

### Recommend (policy refinements, not product expansion)

1. **Order:** keep Cloudflare → Google unless evidence shows systematic bias. Document that order in user-facing security notes (G6: which resolver was used is already partly surfaced on verify).
2. **Do not require AD.** Requiring DNSSEC would break most real domains and contradict the roadmap (“prefer, don’t require”).
3. **Optional future cross-check (not required for G3):** if *both* providers return `answer` with **different sorted TXT sets**, refuse rather than install. Only run the second query when the first succeeded *if* a strict mode is on; default path can stay first-authoritative-wins for latency. Defer until there is real dual-provider abuse evidence—alpha cost is high relative to adoption.
4. **Configurable providers (optional, lower priority than labeled system fallback):** env like `DOMAININSTALL_DOH_URLS` (comma-separated HTTPS URLs only, same JSON schema assumption). Default remains the two hard-coded URLs. Reject `http:` and credentialed URLs the same way registry URLs are validated.
5. **Never auto-downgrade** from DoH to system DNS on failure. That is the G3 trap: silent unauthenticated resolution after a DoH block looks like success.

---

## Badge copy recommendation

Current strings: `DNSSEC ✓` / `DNSSEC —`.

### Risk

RB-GATE6 and R3: users may read ✓ as “package is safe” or “domain ownership proven.” SECURITY.md’s claim is narrower: continuity of a domain-to-package declaration; DNSSEC authenticates DNS data in transit, not package contents or continued ownership.

### Recommended user-facing copy

Keep the short badge for density, but fix the semantic in help/preview:

| State | Short badge (OK to keep) | Prefer clarifying line (verify / summary footnote) |
| --- | --- | --- |
| `authenticated === true` | `DNSSEC ✓` | “Resolver validated this DNS answer (DNSSEC). Not package safety.” |
| `authenticated === false` | `DNSSEC —` | “DNS answer not DNSSEC-validated by the resolver (common for unsigned zones).” |
| System-resolver path (future) | **never** show `DNSSEC ✓` | Always `unauthenticated DNS` / `system resolver (no DNSSEC signal)` |

Avoid synonyms that over-claim: “secure,” “trusted,” “verified owner,” “authentic package.”

If comprehension testing (M4 gate 6) shows persistent over-read, rename the short badge to **`DNSSEC AD`** / **`no AD`** (more accurate, less marketing) or **`DoH+AD`** / **`DoH`**. That change is copy-only and does not need protocol work.

### Preview field suggestion

Add or emphasize resolver host on install preview (not only verify), e.g. `resolver  cloudflare-dns.com` next to the badge. Closes part of G6 and makes dual-provider behavior legible.

---

## System-resolver fallback design (opt-in, labeled unauthenticated)

### Problem (G3 / R4)

Networks that block public DoH leave the tool at `provider_exhaustion`. A silent fallback to the OS resolver would restore availability but would **drop** DoH transport guarantees and the AD bit. Auto-fallback is a security downgrade.

### Design rules

1. **Opt-in only.** Example flags/env (names illustrative):
   - CLI: `--allow-system-dns` (install/verify)
   - Env: `DOMAININSTALL_ALLOW_SYSTEM_DNS=1`
   - Never default on.
2. **Only after DoH exhaustion** (or if the user explicitly forces system DNS and accepts the label). Do not interleave system DNS before public DoH in the default path.
3. **Always label unauthenticated.**
   - Set `authenticated: false` always for this path.
   - Preview must show something unmistakable, e.g.  
     `resolver  system (unauthenticated — no DNSSEC AD signal)`  
     not `DNSSEC —` alone (which users already see for unsigned-but-DoH answers).
4. **Implementation vehicle:** Node `dns.promises.resolveTxt(name)` (or `Resolver#resolveTxt`). Zero new dependencies. Note:
   - Returns `string[][]` (chunks per TXT record); join chunks the same way DoH multi-string normalization already intends.
   - **No AD bit** is available from Node’s `dns` API; do not invent one from “lookup succeeded.”
   - `dns.lookup` is the wrong API (getaddrinfo / A/AAAA only).
   - On some systems, “system resolver” still points at a local validating stub; domaininstall cannot observe AD, so still label unauthenticated.
5. **Map errors carefully:**
   - `ENOTFOUND` / `ENODATA`-class → `nxdomain` or `nodata` as accurately as the platform allows (Node often collapses these; document residual ambiguity).
   - Timeouts / `ESERVFAIL` → not success; if system DNS was the last resort, surface as resolution failure.
6. **Confirmation impact:** if system DNS was used, treat like a heightened-caution path: still require interactive confirm for first use; consider refusing `--yes` when resolution was unauthenticated **or** print a hard warning that `--yes` cannot skip the mapping-change path (already true) and should not hide the unauthenticated label.
7. **Privacy note:** system DNS discloses the queried name to whatever resolver the OS uses (corp DNS, ISP). DoH already discloses to Cloudflare/Google (G6). Document both; do not claim privacy improvement from system fallback.

### Alternatives considered

| Option | Verdict |
| --- | --- |
| Auto system fallback after DoH fail | **Reject.** Silent downgrade. |
| Configurable extra DoH URLs only | Helps enterprise with private DoH; does not help pure DoH blocks. Ship later if needed. |
| Require user to paste TXT | Out of scope; breaks “install by domain.” |
| Client-side DNSSEC validation | High complexity, trust-anchor maintenance, contradicts zero-deps alpha. Not recommended now. |

---

## Concrete recommendations for later code

Priority order for implementation when G3 is scheduled:

1. **Docs + badge footnote only** — no behavior change; reduce misread of AD.
2. **Show resolver on install summary** — one line; already have `provider` on `TxtResult`.
3. **Opt-in system DNS fallback** behind flag/env with forced `authenticated: false` and distinct UI label; wire `dns.promises.resolveTxt` after provider exhaustion only when opt-in is set.
4. **Optional** `DOMAININSTALL_DOH_URLS` for custom DoH JSON endpoints (HTTPS-only validation).
5. **Defer** dual-provider answer cross-check and client-side DNSSEC.

Tests to add when coding:

- Fixture: AD true/false, NXDOMAIN with AD, SERVFAIL then success on second provider, both exhaust.
- System path: opt-in off → exhaustion still fails; opt-in on → label unauthenticated; never claim DNSSEC ✓.
- Authoritative NODATA from first provider must not query second (existing behavior lock).

---

## Decision

- **AD bit:** treat as “DoH resolver reports DNSSEC-validated answer,” never as package safety or ownership continuity. Current `json.AD === true` mapping is correct for the trust model in SECURITY.md.
- **Dual providers:** keep sequential authoritative-stop policy; do not auto-downgrade. Prefer labeled opt-in system resolver over silent second-chance ambient DNS.
- **Badge:** keep short `DNSSEC ✓/—` only with clarifying copy; never show ✓ on system DNS.
- **G3 close condition:** opt-in system-resolver fallback **or** documented configurable DoH list, with unauthenticated labeling mandatory for any non-DoH path. Research favors **opt-in system DNS** as the availability escape hatch that matches the roadmap wording.

## Recommended next code change

When engineering picks up G3 (not part of this research writeup):

1. Surface `txt.provider` on the install preview.
2. Add clarifying DNSSEC footnote strings in `cli.ts`.
3. Implement `--allow-system-dns` / env gate + `dns.promises.resolveTxt` after DoH exhaustion with forced unauthenticated labeling.

No product code change in this research pass.

## Residual unknowns

- Exact AD behavior on **NODATA vs NXDOMAIN** for `_dnstall` names across Cloudflare vs Google (needs fixture captures against signed and unsigned zones).
- How often Node on Windows/macOS collapses NXDOMAIN vs NODATA for `resolveTxt` (affects parity of system-fallback diagnostics).
- Whether enterprise users need private DoH more than system DNS (would elevate configurable DoH URLs).
- Comprehension impact of badge wording until M4 gate 6 runs (RB-GATE6).
- Whether a future “strict dual-provider agree” mode is worth the latency for the threat of a single malicious public resolver.
