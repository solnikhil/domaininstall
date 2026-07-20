# domaininstall — Project Notes

> Working brainstorm + research log. Captures the concept, what the research
> found, the design we've settled on, the roadmap, and open decisions.
> Status: **pre-code / planning.** Nothing built yet.

---

## 1. The concept

Let developers install a package using a **domain name they already trust**
instead of hunting for the right (often taken / squatted) package name.

```
dpm stripe.com          # resolves the domain to a verified package, then installs it
```

The domain owner proves the mapping with a DNS record. The tool reads that
record, shows the user exactly what will be installed, asks for confirmation,
and hands off to the real package manager (npm to start).

Two interfaces:
- `dpm <domain>` — canonical, reliable command (the real product).
- `install.xyz.com` — optional shell "magic" via a command-not-found hook
  (a demo/party trick, explicitly **deferred** — it's the fragile, low-value part).

### The problem it solves
- **npm name exhaustion** — good names are taken; new projects get stuck with
  ugly names or a scope.
- **Trust / provenance** — a domain is a brand developers already know, and it
  costs money + leaves a DNS/WHOIS trail, so it's inherently harder to
  typosquat than a free npm string.
- **Makes an owned domain useful** — the domain becomes the install identity.

---

## 2. Research findings & prior art

### Go vanity import paths (VALIDATES the core idea)
- Go import paths are domain-based: `k8s.io/...`, `go.uber.org/zap`,
  `google.golang.org/grpc`. Used at massive scale.
- Mechanism: `go get` fetches `https://domain/path?go-get=1`, reads a
  `<meta name="go-import">` tag pointing to the real repo.
- Shipped in **Go 1 (2012)**, essentially unchanged since — stable, battle-tested,
  BSD-licensed (open source). Google maintains `govanityurls`.
- Your `xyz.com/pkg1` instinct = Go's `domain.com/subpath`. Already proven.

### Go proposal #26160 — "use DNS TXT records for vanity import paths" (KEY)
- Filed 2018, **closed ~3 weeks later**, rejected by Russ Cox (rsc).
- Rejection reasons were about **Go's legacy**, NOT the merits:
  1. Couldn't drop HTTPS; didn't want two parallel mechanisms.
  2. Ambiguity if HTTPS + DNS disagree ("gaslighting").
  3. HTTPS hosting is getting easier (GitHub Pages, Netlify, Firebase, Let's Encrypt).
  4. DNS is harder to debug / registrar UIs are bad.
  5. Scale problem solved differently (they built `proxy.golang.org`).
- **rsc's concession (the green light):** "If it were day 1 and we were
  redesigning, maybe there would be an argument for DNSSEC instead of HTTPS."
- **Why this is good for us:** objections #1 and #2 are pure legacy drag. We're
  greenfield — we pick DNS as the single mechanism, so they don't apply.
- The proposer (SamWhited) landed on a hybrid at the end: use **DNS only as the
  canonical pointer**, let the normal fetch mechanism pull the code. That hybrid
  IS our design.
- **Objections that DO carry over:** DNS onboarding UX (registrar pain,
  propagation, debugging) and "HTTPS is easy now" — so DON'T sell on
  "avoid running a server"; sell on **trust / anti-typosquatting**.

### IPFS DNSLink (THE TECHNICAL TEMPLATE — steal this)
- Live, spec'd system (dnslink.org) that maps a domain to a resource via a TXT
  record. This is exactly our mechanism, already solved.
- Record lives on a `_dnslink.` subdomain, format follows RFC 1464 `key=value`:
  ```
  _dnslink.example.com  TXT  "dnslink=/ipfs/<CID>"
  ```
- Conventions we inherit for free:
  - `/<namespace>/<identifier>` → namespace = ecosystem (npm/pypi/cargo).
  - Multiple records per domain allowed (multiple packages).
  - Sort lexicographically for deterministic results.
  - CNAME delegation supported (central management).
  - "Never error on invalid records — ignore and move on."

### Security landscape
- **npm 12 (July 8, 2026)** now blocks lifecycle install scripts
  (preinstall/install/postinstall) unless explicitly allowed.
  - Good: safer base; installs carry less arbitrary-code risk.
  - Honest: removes "we stop malicious install scripts" as a selling point →
    lean on provenance + anti-typosquatting instead.
- **Typosquatting / slopsquatting** (AI-hallucinated package names) is escalating;
  the Shai-Hulud worm hit npm in late 2025. Real, current pain.

### DNS technical facts
- TXT string limit = 255 bytes each; a record can hold multiple strings
  (concatenated); multiple TXT records per name allowed.
- **DNSSEC** = authenticity/integrity (prevents spoofing) but low deployment.
- **DoH/DoT** = encryption/privacy of the query, NOT authenticity.
- Plan: resolve over DoH to a trusted resolver; treat DNSSEC as a trust boost
  (badge) where present, don't require it.

### The competitive landscape / GTM
- No existing "install npm package by domain" tool found — space is open.
- The thing we actually compete with: `curl get.company.com | bash`
  (Docker, pnpm, Ollama, Homebrew, rustup all do it). Popular but widely
  considered insecure (arbitrary code, MITM, server can detect piping).
  → Position domaininstall as **"the safe, verified replacement for curl | bash."**
- Dev tools win on adoption, not code (Bun: nail one narrow slice, then expand).
- Cheapest channel = content. The story writes itself: "Go's community proposed
  this in 2018, agreed it was good, never shipped it. IPFS proved it works.
  Here it is for npm."

---

## 3. Design decisions (settled)

- **Record format:** adopt DNSLink's convention.
  ```
  _dpm.stripe.com.  TXT  "dpm=/npm/stripe"
  ```
  - `/namespace/` = ecosystem → npm/pypi/cargo for free.
  - Multiple records = multiple packages; sort lexicographically; ignore invalid.
- **Multi-package via subdomain:**
  ```
  dpm stripe.com        → _dpm.stripe.com        → stripe
  dpm stripe.com/react  → _dpm.react.stripe.com  → @stripe/react-stripe-js
  ```
- **Security:**
  - Resolve over DoH (Cloudflare/Google) to resist local tampering.
  - Prefer DNSSEC-validated answers (badge), don't require.
  - Always print domain → package → registry → target dir; require `y/N`.
  - Never execute record contents; pass args to the PM as argv (no shell string).
- **Package-manager handoff:** reuse a maintained detector (`nypm` or
  `package-manager-detector`) — don't reinvent lockfile detection.
- **Infra:** none for v0. Pure DNS resolution. Zero cost = we survive slow
  adoption cheaply. Caching proxy/registry optional later.
- **Tech:** Node + TypeScript, distributed as a global npm package (`npm i -g dpm`).
  Single-binary option later.
- **Naming:** command = `dpm`; DNS prefix = `_dpm` (underscore-prefixed TXT is the
  correct convention per DNSLink/DKIM/DMARC).

---

## 4. Roadmap

- **Phase 0 — Prove the loop (a weekend).**
  `dpm <domain>` → DoH TXT lookup → parse DNSLink-style record → confirm →
  npm handoff. Plus `dpm verify <domain>` that diagnoses record problems
  (fixes the DNS-UX pain point). npm only, one shell.
  Prove end-to-end on `zuraai.xyz`. **Deliverable: a 20-second demo clip.**

- **Phase 1 — Make it real.**
  Subdomain multi-package, multi-PM detection, metadata in records
  (repo/homepage/issue-tracker — the discoverability Go #19725 wanted),
  fallback sources (Go #9532).

- **Phase 2 — Publish the spec.** (Highest leverage.)
  Write "the DPM record spec" as its own page, like dnslink.org. Reframes the
  project from "a CLI" to "an open standard" others can implement → de-risks
  adoption.

- **Phase 3 — Sugar & scale.**
  Optional `dpm setup` shell hook for `install.xyz.com`; pip/cargo namespaces;
  caching proxy; DNSSEC validation badges; web directory of registered domains.

---

## 5. Go-to-market

- **Wedge:** security-conscious teams + memorable installs. Position as the
  verified, no-arbitrary-code replacement for `curl | bash`.
- **Content:** the "Go wanted this in 2018 and never shipped it / IPFS proved it"
  narrative → HN / Reddit / Lobsters.
- **Seed supply yourself:** register `_dpm.zuraai.xyz` + a few friendly OSS
  packages so the tool is useful on day one, not empty.

---

## 6. Outreach — Sam Whited (author of Go proposal #26160)

Cold DM (short):
> Hi Sam — just read your 2018 proposal for DNS TXT vanity imports in Go (#26160).
> Most of what killed it was Go's legacy (can't drop HTTPS, didn't want two
> mechanisms) — and rsc even said a clean-slate design might've picked DNS.
> I'm building that clean slate. Curious: 8 years on, do you still think DNS is
> the right primitive here — and anything you'd do differently today?

Email subject: **Your 2018 DNS vanity-imports proposal (#26160)**

One-liner ("what I'm building"):
> A DNS-verified name→package resolver: run `dpm stripe.com` and it reads a DNS
> record proving the domain owns the package, then installs it via npm. DNS is
> the trusted pointer; npm still does the fetch — basically the hybrid you landed
> on at the end of that thread, as an anti-typosquatting layer on top of existing
> package managers.

Follow-up (if he replies):
> The one thing I keep circling on is the DNS onboarding UX — registrar pain,
> propagation, debugging. Did you have a plan for that, or is it just an
> accepted cost?

---

## 7. Open decisions / next steps

- [ ] Confirm command name `dpm` + prefix `_dpm` (recommended).
- [ ] Scaffold Phase 0 (CLI, DoH resolver, DNSLink-style parser, `verify`, npm handoff).
- [x] Set `_dnstall.zuraai.xyz` TXT record and test the full loop live.
- [ ] Record the 20-second demo clip.
- [ ] Draft the record spec page (Phase 2).
- [ ] Send the DM to Sam.

---

## 8. Key references

- Go vanity imports: https://sagikazarmark.hu/blog/vanity-import-paths-in-go/
- Go proposal #26160 (DNS TXT): https://github.com/golang/go/issues/26160
- DNSLink standard: https://dnslink.org/
- npm 12 blocks install scripts: https://www.digitalapplied.com/blog/npm-12-install-scripts-blocked-supply-chain-guide-2026
- Package manager detectors: https://github.com/unjs/nypm , https://yarnpkg.com/en/package/package-manager-detector
- govanityurls (Google): https://github.com/GoogleCloudPlatform/govanityurls


---

## 9. Update log (post-research build)

### Naming (decided)
- npm package / brand: **`domaininstall`** (not publicly published yet; matches repo).
- Primary CLI command: **`di`**. Descriptive/legacy aliases: **`domaininstall`** + **`dnstall`**.
- The unscoped npm package name `di` is already owned by an unrelated dependency-injection project, so the install package remains `domaininstall` while its executable is `di`.
- `dpm` was dropped — it's already taken on npm (dpm.fi). Any `_dpm`/`dpm=`
  references above are superseded by `_dnstall` / `dnstall=`.

### Record format (FINAL for v0) — now purl-based
Transport stays **TXT** (universal registrar support, safe over DoH JSON,
DNSLink lineage). Payload upgraded from the DNSLink `/npm/` form to a
**purl (Package URL)** — a real cross-ecosystem standard (ECMA-427) already
spoken by SBOM tools, vuln scanners, and dependency trackers.

```
_dnstall.stripe.com.  TXT  "dnstall=pkg:npm/stripe@^18"
_dnstall.stripe.com.  TXT  "dnstall=pkg:npm/%40stripe/react-stripe-js@^2 repo=https://github.com/stripe/react-stripe-js"
```

- Legacy `dnstall=/npm/stripe@^18` is still parsed (forgiving), but purl is
  the documented/preferred form.
- Multi-package still via subdomain: `_dnstall.react.stripe.com`.
- Version precedence: CLI arg `@ver` > record version > `latest`.

### v0 — BUILT ✅
Working CLI in the repo. Node 22 + TypeScript, ESM, **zero runtime deps**
(native `fetch` DoH). Builds via `tsc` to `dist/`.
- `src/cli.ts` — commands `install` + `verify`, arg parsing.
- `src/doh.ts` — DoH JSON resolver (Cloudflare + Google fallback), `AD` flag,
  multi-string TXT parsing.
- `src/record.ts` — purl + legacy parser.
- `src/validate.ts` — strict input validation (rejects flag-smuggling / shell
  metachars) — the #1 security layer.
- `src/pin.ts` — trust-on-first-use pins at `~/.domaininstall/pins.json`
  (domain-hijack defense).
- `src/install.ts` — PM detection (npm/pnpm/yarn/bun) + `spawn` with `shell:false`.
- `src/ui.ts` — colored output + y/N confirm.
- `scripts/smoke.ts` — 19 checks passing, incl. **live DoH** + a **real
  `npm install`** handoff.

The live end-to-end test is `npm run test:e2e`. It expects:

```dns
_dnstall.zuraai.xyz.  TXT  "dnstall=pkg:npm/zuraai"
```

It runs the compiled `di` CLI, installs the vouched package into a temporary
project, and verifies an isolated TOFU pin without touching the user's real
`~/.domaininstall` state.

### Sam Whited replied (author of Go proposal #26160)
He's a genuine kindred spirit — his [2017 post](https://blog.samwhited.com/2017/08/musings-on-the-future-of-go-package-management/)
maps our exact use cases (discovery, auditability, publishing, ownership,
**namespacing** — literally "don't want to worry whether `xmpp`/`tls` is taken").

His steer: he still favors DNS for this; if designing today he'd consider
**SRV or URI records instead of TXT**. Our analysis:
- **SRV** locates a *server* (host+port) — fits his heavier *federated package
  server* model, NOT our lightweight "record points directly at a package"
  model. Wrong fit for v0.
- **URI** (RFC 7553) is semantically ideal (name→URI, built-in priority/weight)
  and could carry a purl — BUT registrar UI support is patchy and DoH JSON
  parsing of URI records is on shakier ground (Cloudflare says the JSON format
  isn't standardized and may change). Both hit our #1 risk: publisher DNS-UX
  friction.
- **Decision:** keep TXT transport, adopt **purl payload** now (captures Sam's
  "be more rigorous than a TXT grab-bag" instinct for free). Revisit URI records
  as an optional richer form in a later phase (would need wire-format DoH).
- His CA-support caveat doesn't apply to us — we don't issue certificates.

Bank for later (Phase 3): his **federated-server** idea is a real answer to the
domain-expiry problem — an authoritative server can keep serving cached packages
after a domain lapses and re-checks DNS to confirm it's still authoritative.
