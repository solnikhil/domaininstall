# domaininstall — Security Design: Domain Expiry / Ownership Change / Revocation

> Focused threat: a mapped domain **expires or changes ownership**, an attacker
> re-registers it, repoints `_dpm.<domain>` at a malicious package, and hijacks
> every `dpm <domain>` install. This doc surveys how comparable systems handle
> it, proposes a concrete mitigation design for domaininstall, and lists the
> abuse cases the design must explicitly cover.
>
> *Content from external sources was rephrased for compliance with licensing
> restrictions; sources are linked inline.*

---

## The core insight

Our DNS record is a **mutable pointer** with **no built-in notion of
continuity of ownership**. Crucially, **DNSSEC does not help here**: it proves
a record wasn't tampered with in transit, but if an attacker legitimately
owns the (re-registered) domain, DNSSEC will faithfully sign the malicious
mapping. This exact gap is documented for "dead infrastructure hijacking":
DNSSEC signs the misdirection faithfully because the attacker genuinely
controls the resource the record points to ([CyFirma, 2026](https://www.cyfirma.com/research/dead-infrastructure-hijacking-a-complete-and-precisely-bound-threat-assessment/)).

So the problem cannot be solved at the "is this DNS answer authentic?" layer.
It must be solved at the **"is this the same owner/package I trusted before, and
should I still trust it?"** layer. Every mature system below solves it with some
combination of: (1) content integrity via hashing, (2) trust-on-first-use
pinning, (3) a shared append-only log so *new* clients inherit that trust,
(4) frequent re-validation with short trust windows, and (5) explicit
revocation.

---

## (a) How comparable systems solve it

### IPFS DNSLink — *content addressing decouples integrity from the pointer*
DNSLink maps a domain to an IPFS **CID** via a TXT record on `_dnslink.<domain>`
([IPFS docs](https://docs.ipfs.tech/concepts/dnslink/)). The pointer is mutable
(the owner edits DNS), but the **CID is a hash of the content**, so the fetched
bytes are self-verifying — if any bit changes, the CID changes
([Cloudflare](https://ghost.blog.cloudflare.com/continuing-to-improve-our-ipfs-gateway/)).
The spec mandates safe recursive resolution with a hard recursion limit (e.g. 32)
and path preservation ([DNSLink Gateway Spec](https://specs.ipfs.tech/http-gateways/dnslink-gateway/)).
- **Lesson for us:** content-addressing gives *integrity* but **not ownership
  continuity** — whoever controls the domain can still point at a different
  (also-valid) CID. DNSLink alone does **not** solve our threat; it only
  guarantees you got the bytes the current record named. We must add a pinning /
  continuity layer on top.

### Go checksum database + `go.sum` — *the strongest analog: TOFU + global transparency log*
Go module import paths are domain-based (vanity paths), exactly like ours. Go
authenticates every download so today's bits match yesterday's, detecting
unexpected changes whether malicious or not
([goproxy docs](https://github.com/goproxyio/goproxy.io/blob/master/content/docs/GOSUMDB-env.md)).
The **checksum database** is a tamper-proof, append-only transparency log that
records the hash of a module version **the first time it is seen across the
whole ecosystem**, then serves that same hash to every client forever
([Go sumdb design #25530](https://golang.org/design/25530-sumdb);
[filippo.io](https://words.filippo.io/go-source/)). This closes the
"first-time user" gap that a purely local lockfile leaves open.
- **Lesson for us:** this is the model to copy. A **local pin** (`go.sum`)
  protects returning users; a **global append-only log** (sumdb) protects
  *first-time* users so they inherit the community's original trust decision.
- **Caveat to design around:** the log is not magic — a malicious proxy was
  found able to bypass checksum-DB verification (CVE-2026-42501,
  [golang/go#79070](https://github.com/golang/go/issues/79070)), so the
  verification path itself must be hard to bypass.

### ACME / Let's Encrypt / CAA — *short trust windows + a DNS allowlist*
Three relevant mechanisms:
1. **CAA records** let a domain owner declare which CAs may issue for the domain
   (RFC 8659/8657) — a DNS-level **allowlist** of who is authorized
   ([Let's Encrypt](https://letsencrypt.org/cs/docs/caa/)).
2. **Short lifetimes** limit blast radius: certs are moving from 90 → 45 days,
   with the CA/Browser Forum stepping max lifetime down to 47 days by 2029
   ([Let's Encrypt](http://www.letsencrypt.org/2025/12/02/from-90-to-45);
   [makoserver](https://makoserver.net/articles/Lets-Encrypt)).
3. **Shrinking validation reuse:** the period you may reuse a past domain-control
   validation is collapsing — Let's Encrypt from 30 days toward **7 hours by
   2028**, and the CA/B Forum max reuse from 398 → 200 → 100 → 10 days
   ([Let's Encrypt](http://www.letsencrypt.org/2025/12/02/from-90-to-45);
   [Encryption Consulting](https://www.encryptionconsulting.com/domain-control-validation-at-scale/)).
- **Lesson for us:** never treat a past verification as permanent. **Re-verify
  domain control frequently**, keep the trusted window short, and let owners
  publish an allowlist of who/what is authorized.

### Certificate Transparency — *detect mis-issuance after the fact*
CT requires CAs to publish every issued cert to append-only, publicly auditable
logs, shifting from "trust me" to "prove it"; monitors watch the logs and alert
a domain owner when a cert appears that they never requested
([certpulse](https://certpulse.hashnode.dev/certificate-transparency-a-practical-guide-for-devops-and-security-engineers);
[MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Public_Key_Pinning);
[transparency.dev](https://certificate.transparency.dev/howctworks/)).
- **Lesson for us:** a public, append-only record of domain→package mappings
  gives owners and monitors a way to **detect a hostile repoint quickly**, even
  when it can't prevent it.

### Domain-verification services (Google / Cloudflare / Docker) — *continuous re-check + revocation*
Ownership is proven with a unique TXT token
([Google Cloud Identity](https://cloud.google.com/identity/docs/verify-domain-txt)).
The important part: verification is **not permanent** — Search Console
periodically re-checks that the token is still present and valid, and if it can
no longer confirm it, ownership is **revoked** and the owner notified
([Google Search Console](https://support.google.com/webmasters/answer/9008080?hl=en)).
- **Lesson for us:** tie continued trust to the **continued presence** of the
  proof, and revoke automatically when it disappears or changes.

### npm provenance / Sigstore — *link the artifact to its source, with limits*
npm provenance uses Sigstore to cryptographically link a published package to
its source repo and build instructions, so consumers can verify where/how it was
built ([GitHub blog](https://github.blog/security/supply-chain-security/introducing-npm-package-provenance/);
[Sigstore](https://blog.sigstore.dev/npm-provenance-ga/)).
- **Lesson for us:** provenance is a strong *signal* to surface, but **not a
  guarantee** — attackers who stole a build runner's OIDC token have produced
  attestations indistinguishable from genuine ones
  ([SLSA blog](https://slsa.dev/blog/2026/05/mini-shai-hulud-what-slsa-can-and-cannot-do)).
  Treat it as one input, not the whole trust decision.

### Subdomain takeover / dangling DNS — *the failure mode we are literally building on*
A dangling record points at a deprovisioned/expired resource; an attacker claims
that resource and takes over the name
([Microsoft](https://learn.microsoft.com/en-in/azure/security/fundamentals/subdomain-takeover);
[Spamhaus](https://www.spamhaus.org/resource-hub/dns/dangling-dns-and-the-dangers-of-subdomain-hijacking/)).
Because our `_dpm.react.stripe.com` pattern encourages **CNAME delegation** for
central management, and CNAMEs are the most takeover-prone record type, we
inherit this risk directly. The consensus mitigation is to **remove dangling
records promptly** (closing the window immediately) and continuously monitor for
them ([Barrion](https://barrion.io/vulnerabilities/subdomain-takeover-risk)).

---

## (b) Recommended mitigation design for domaininstall

**Principle:** DNS is only a *pointer*. Trust comes from **pinning what we
resolved, re-verifying it on a short cadence, and detecting registration/owner
changes** — layered defense-in-depth so no single failure is catastrophic.

### Layer 0 — Authentic resolution (already in NOTES)
Resolve over DoH; prefer DNSSEC-validated answers (badge, not requirement).
This stops in-transit spoofing but, as noted above, does **nothing** for
ownership change — hence the layers below.

### Layer 1 — TOFU local pin (the `dpm-lock` file) — *ship in Phase 0*
On first successful `dpm <domain>`, write a lockfile entry pinning the full
resolved identity, not just the package name:

```jsonc
{
  "stripe.com": {
    "package": "stripe",              // npm package identity
    "registry": "https://registry.npmjs.org",
    "version": "18.2.0",              // resolved version at pin time
    "integrity": "sha512-...",        // npm tarball SRI hash
    "publisher": "stripe-bot",        // npm publisher/owner at pin time
    "provenance": true,               // npm/Sigstore provenance present?
    "dnssec": true,
    "registration": {                 // RDAP snapshot at pin time
      "created": "2010-04-27",
      "expires": "2027-04-27",
      "nameservers": ["ns-...", "ns-..."]
    },
    "pinnedAt": "2026-..."
  }
}
```

- Reuses npm's existing **integrity** (SRI) mechanism — no new crypto.
- Pins **identity attributes** (publisher, registration date, nameservers), not
  just the string, so an ownership flip is detectable.

### Layer 2 — Re-verify on every install, compare against the pin
On each subsequent `dpm <domain>`, re-resolve and diff against the pin. **Block
and require explicit re-confirmation** (loud, not a soft warning) when any of
these change:
- package name or registry (repointed to a different/typosquatted package),
- npm publisher/owner (npm-side account takeover),
- **RDAP creation date is newer than the pin** → the domain was **re-registered**
  (the expiry/takeover signal),
- nameserver set changed (possible transfer / DNS-provider takeover),
- DNSSEC status regressed (was signed, now isn't).

Borrowed from Google's model: continued trust is contingent on the proof still
matching; when it stops matching, trust is revoked pending human confirmation.

### Layer 3 — Registration-liveness check (RDAP/WHOIS) — *the direct expiry defense*
Query **RDAP** (structured, rate-limit-friendlier than WHOIS) at pin time and on
re-verify. Flag: domain within/after its expiry window, a creation date that
moved, or a recent transfer. This is what turns "expired domain" from an
invisible event into an explicit prompt. Tradeoff: RDAP data is inconsistent
across TLDs and privacy proxies can mask fields — treat a *changed* creation date
as high-signal and missing data as "unknown, warn."

### Layer 4 — Short trust window + re-confirmation cadence
Borrowing from the shrinking ACME reuse windows: a pin is not forever. Attach a
`maxAge` to pins (e.g. re-run full re-verification if the pin is older than N
days, or if the record's TTL implies staleness). Never silently trust a months-old
pin without re-checking registration liveness.

### Layer 5 — Global transparency log (opt-in hosted service) — *Phase 2, protects first-time users*
The local lockfile protects *returning* users but leaves the **first-time
installer** exposed (they have nothing to compare against). Following Go's sumdb:
publish an **append-only log of first-seen `domain → package` mappings** plus the
registration snapshot. A new install checks the log; if the domain's registration
changed since the community first pinned it, warn/block. Also enables:
- **monitoring** (CT-style) so owners are alerted to hostile repoints,
- a **denylist** of known-hijacked domains,
- **owner-signed revocation tombstones** (owner publishes "this mapping is
  retired" — analogous to removing the verification token / a CAA-style
  statement).

**Explicit tradeoff:** this reintroduces infrastructure and a trusted party,
which conflicts with the "zero-infra v0" decision in NOTES §3. Recommendation:
**Layers 1–4 are pure-client and ship first** (they already defeat the headline
attack for anyone who installed before the takeover); Layer 5 is the Phase-2
upgrade that extends protection to first-time users and should be designed as an
*optional, replaceable* endpoint (like `GONOSUMDB`/`GOFLAGS` lets Go users opt
out or self-host).

### Layer 6 — Provenance as a surfaced signal
Prefer and prominently display **npm provenance** for the target package, and
show whether the pinned publisher matches. Do not *gate* solely on it (forgeable
per the SLSA note), but a package that had provenance at pin time and lost it is
a red flag worth surfacing.

### Anti-TOCTOU rule (cheap, high value)
Resolve **once**, show the user the exact pinned identity, and pass **that exact
version + integrity hash** to npm as argv. Do **not** re-resolve between the
`y/N` confirmation and the install — otherwise a low-TTL record can flip between
what the user approved and what gets installed.

### Design summary table

| Layer | Protects against | Cost | Phase |
|---|---|---|---|
| 0 DoH/DNSSEC | in-transit spoofing | none | 0 |
| 1 TOFU local pin | silent repoint for returning users | low | 0 |
| 2 Re-verify + diff | ownership/publisher/package change | low | 0 |
| 3 RDAP liveness | expiry / re-registration / transfer | medium (network, parsing) | 0–1 |
| 4 Short trust window | stale trust | low | 1 |
| 5 Transparency log + revocation | first-time-user exposure, mass hijack | high (infra, trusted party) | 2 |
| 6 Provenance signal | npm-side tampering | low | 1 |

---

## (c) Abuse cases the design MUST explicitly handle

1. **Expired-then-re-registered domain.** Attacker buys a lapsed domain and
   repoints `_dpm`. → Caught by Layer 2 (publisher/package diff) + Layer 3
   (RDAP creation-date moved) + Layer 5 (log mismatch) for new users.
2. **Domain sold / transferred to a new owner** who changes the mapping (may be
   benign or malicious). → Nameserver + registration diff triggers re-confirm.
3. **Dangling / abandoned record** left pointing at an unpublished or squatted
   package name after the owner stops maintaining it. → Resolution to a
   non-existent/newly-created package must be flagged, not silently installed.
4. **Temporary DNS control** via registrar or DNS-provider account takeover
   (domain not expired). → RDAP won't show re-registration, so rely on
   publisher/package/integrity diff + provenance + (Layer 5) monitoring alerts.
5. **Subdomain takeover of a multi-package subdomain** (`_dpm.react.stripe.com`)
   via a dangling CNAME delegation. → Treat delegated/CNAME'd `_dpm` subdomains
   with extra suspicion; pin the delegation target; monitor for dangling CNAMEs.
6. **Repoint to a similarly-named / dependency-confusion package** (same domain,
   record now names `strlpe` or an internal-looking scope). → Package-name diff
   against pin blocks it.
7. **npm-side package hijack** after a benign pin (malicious version published to
   the same package). → Integrity-hash mismatch on the pinned version + refusal
   to auto-jump versions without re-confirmation; surface lost provenance.
8. **WHOIS/RDAP privacy masking** hiding a re-registration. → "Unknown
   registration data" must degrade to a warning, never to silent trust.
9. **DNS spoofing / MITM at resolution time.** → DoH + DNSSEC preference
   (Layer 0); pin comparison catches a one-off spoof that doesn't match history.
10. **First-to-pin squatting in the transparency log.** Attacker races to be the
    first to register a `domain→package` mapping in the Layer-5 log. → Require the
    first pin to carry a proof of domain control *and* a registration-age check;
    refuse to honor a pin created suspiciously close to a (re-)registration date.
11. **CNAME delegation to an attacker-controlled zone** (`_dpm.x.com` CNAME →
    `dpm.provider.net` that the attacker later claims). → Resolve and record the
    final answer's authority; flag when the delegation chain's control changes.
12. **TTL / TOCTOU flip** between `verify` and `install`. → Anti-TOCTOU rule:
    resolve once, pin, pass the exact version+hash to npm; never re-resolve
    post-confirmation.
13. **Revocation bypass / stale denylist** — attacker installs during the window
    before the log/denylist updates, or a revoked mapping is served from cache.
    → Owner-signed tombstones honored client-side; bound cache lifetime; fail
    closed on a known-revoked mapping.

---

## How this fits the existing plan (NOTES.md)

- **Phase 0** already lists a `dpm verify` command — extend it to also perform
  the RDAP liveness check and initialize the `dpm-lock` pin (Layers 1–3).
- The "never error on invalid records — ignore and move on" convention from
  DNSLink must **not** extend to *ownership-change* signals: those are the one
  case where we deliberately **fail loud / fail closed**, not ignore.
- Keeps the "zero-infra v0" promise: Layers 0–4 are entirely client-side. The
  only infra (Layer 5 transparency log) is deferred to Phase 2 and designed to be
  optional/self-hostable, mirroring Go's `GONOSUMDB`/opt-out model.
