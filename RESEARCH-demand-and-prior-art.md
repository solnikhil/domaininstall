# domaininstall — Skeptical Demand & Prior-Art Research

> **Historical market research.** This analysis remains useful background, but
> current positioning and quantitative validation gates live in `ROADMAP.md`.

> Honest, evidence-based assessment of whether "install a package by domain name,
> verified via a DNS TXT record" has real demonstrated demand — or whether it's a
> vitamin, not a painkiller. Written to be skeptical, not to cheerlead.
> Date of research: current session. All sources linked inline.

---

## TL;DR verdict

**The problems are real, but the appetite for *this specific solution* is largely
unproven — and the closest large-scale precedents (Deno HTTP imports, Go DNS
proposal) either retreated from or rejected the domain-as-identity model.** The
trust/provenance angle is already being addressed by well-funded incumbents
(npm provenance + Sigstore). This looks closer to a **vitamin** than a painkiller
for most developers, with one genuinely painful niche (AI slopsquatting) that a
verification layer *could* address — but that niche is also being chased by the
whole security industry. Proceed only with eyes open about a hard two-sided
adoption problem and strong incumbents.

---

## (a) Existing / prior tools and how close they are

| Tool / effort | What it does | Closeness | Status |
|---|---|---|---|
| **Go vanity import paths** ([docs/blog](https://sagikazarmark.hu/blog/vanity-import-paths-in-go/)) | Domain-based import paths (`k8s.io/...`), resolved via an HTTPS `<meta go-import>` tag | Very close in spirit (domain = identity), but **HTTPS-based, not DNS**, and it resolves *source repos*, not registry packages | **Live, shipped in Go 1 (2012), massive scale.** The one true validation that domain-as-identity works — but note it's mandatory in Go, not opt-in |
| **Go proposal #26160 — DNS TXT for vanity imports** ([issue](https://github.com/golang/go/issues/26160)) | Exactly the domaininstall mechanism (DNS TXT → package pointer) | **Nearly identical mechanism** | **Rejected ~3 weeks after filing (2018).** Some reasons were Go-legacy, but reviewers also flagged DNS debugging pain and "HTTPS hosting is easy now" — objections that DO carry over |
| **IPFS DNSLink** ([dnslink.org](https://dnslink.org/)) | Maps a domain → resource via `_dnslink` TXT record | **The exact technical template** | Live and spec'd, but **niche**; DNSLink adoption rides on IPFS adoption, which remains small vs. mainstream package use |
| **Deno HTTP/URL imports** ([retrospective](https://deno.com/blog/http-imports)) | Import packages directly by URL/domain, no central registry | **Closest large-scale test of "domain-as-package-identity" in JS** | **Walked back.** Deno now recommends JSR (a centralized registry) + npm specifiers. See section (d) — this is the most important data point |
| **webinstall.dev / webi** ([site](https://webinstall.dev/), [installers repo](https://github.com/jcarterbohan/webi-installers)) | Memorable-URL installs of dev tools (`curl webinstall.dev/<pkg>`) | Close on the "memorable install URL" UX; **no DNS ownership proof** — it's a curated central catalog | Live but **niche/low-profile**; a small community catalog, not a movement |
| **dpm.fi — "Dumb Packet Manager"** ([site](https://dpm.fi/)) | Profile-based multi-source installer for lab environments; installs via `curl -sL dpm.fi/install.sh \| sh` | Not the same concept, **but it already uses the `dpm` command name** | Live. ⚠️ **Naming collision** with the notes' proposed `dpm` command |
| **npm provenance + Sigstore attestations** ([github.blog](https://github.blog/security/supply-chain-security/introducing-npm-package-provenance/), [docs](https://docs.npmjs.com/generating-provenance-statements/)) | Cryptographically links a published package to its source repo & build | **This is the real incumbent for the "provenance/trust" selling point** | **Shipped, backed by GitHub/Microsoft + OpenSSF, growing fast.** Directly competes with the "verified provenance" pitch |
| **npm trusted publishers (OIDC)** ([docs](https://docs.npmjs.com/trusted-publishers)) | Keyless, token-free publishing tied to CI identity | Adjacent — attacks the "who is allowed to publish this name" problem | Shipped 2025 |
| **txt-domain-verification (npm)** ([pkg](https://www.npmjs.com/package/txt-domain-verification)) | Library to verify domain ownership via TXT records | A building block, not a product | Live utility library |

**Bottom line on prior art:** No one has shipped the exact product ("`dpm stripe.com`
→ DNS-TXT-verified → npm install"). The space is *technically* open. But "open"
here partly reflects that the two biggest ecosystems to attempt domain-as-identity
(Go via DNS, Deno via URL) **either rejected the DNS variant or retreated from the
URL variant** — that's a warning sign, not just a gap in the market.

---

## (b) Do developers genuinely want this, or just tolerate the problem?

Honest read: **mostly tolerate.** Evidence by sub-problem:

### npm name exhaustion — real annoyance, low urgency
- npm actively blocks confusingly-similar / typo-squatting names, which frustrates
  publishers ([SO: spam detection](https://stackoverflow.com/questions/48668389/npm-publish-failed-with-package-name-triggered-spam-detection),
  [SO: too similar](https://stackoverflow.com/questions/60665491/npm-publish-got-package-name-too-similar-to-existing-packages)).
- The registry is genuinely polluted with spam/junk packages
  ([Veracode: "npm garbage patch"](https://www.veracode.com/blog/the-great-npm-garbage-patch/),
  [Sonatype: 281k fake packages](https://www.sonatype.com/blog/crypto-enthusiasts-flood-npm-with-281000-bogus-packages-overnight)).
- **But** the ecosystem already has a widely-accepted escape hatch: **scopes**
  (`@org/name`). Developers grumble and reach for a scope; they don't go looking
  for a new install paradigm. This is annoyance, not acute pain.

### Trust / `curl | bash` distrust — loud debate, entrenched behavior
- The `curl | bash` debate is *perennial and unresolved*: critics call it one of
  the least-safe install methods ([security.SE](https://security.stackexchange.com/questions/213401/is-curl-something-sudo-bash-a-reasonably-safe-installation-method)),
  yet defenders (including vendors) argue the risk is overstated
  ([Chef: "5 ways… / stop caring"](https://www.chef.io/blog/5-ways-to-deal-with-the-install-sh-curl-pipe-bash-problem),
  [Sandstorm](https://sandstorm.io/news/2015-09-24-is-curl-bash-insecure-pgp-verified-install),
  [OSI Discuss](https://discuss.opensource.org/t/curl-bash-trust-as-a-privilege/1011)).
- Key tell: **the biggest projects (Docker, Homebrew, rustup, Ollama, pnpm) keep
  shipping `curl | bash` as the front-door install anyway**, because it converts
  new users. That's revealed preference: convenience beats the security objection
  for the people who actually choose install methods. A safer replacement has to
  be *at least as frictionless*, or it loses on the same axis that keeps
  `curl | bash` alive.

### Typosquatting / slopsquatting — the ONE genuinely hot, current pain
- This is real, escalating, and getting mainstream security coverage:
  [The Register (coined "slopsquatting")](https://theregister.com/2025/04/12/ai_code_suggestions_sabotage_supply_chain),
  [Wikipedia](https://en.wikipedia.org/wiki/Slopsquatting),
  [Trend Micro](https://www.trendmicro.com/vinfo/us/security/news/cybercrime-and-digital-threats/slopsquatting-when-ai-agents-hallucinate-malicious-packages),
  [Kaspersky (hallucination rates 5–25%)](https://me-en.kaspersky.com/blog/ai-slopsquatting-supply-chain-risk/24010/).
- AI agents installing hallucinated package names is a concrete, novel attack
  surface where "resolve via a name the domain owner actually vouches for" has a
  real story.
- **Caveat:** the mitigation developers/orgs are actually adopting is
  scanning/allow-listing and provenance verification — not a new install command.
  domaininstall would be competing for this budget against the entire supply-chain
  security industry (Sonatype, Endor, Socket, Cloudsmith, etc.).

**Synthesis:** Developers complain loudly about *symptoms* (spam, squatting, unsafe
installs) but have adapted with scopes, "just be careful," and increasingly
provenance tooling. There is no visible groundswell asking for "install by domain."
The demand is **latent and inferred**, not **expressed**.

---

## (c) Top 3 adoption risks (evidence-based)

### Risk 1 — The domain-as-identity model has already been *retreated from* at scale (Deno)
Deno built its entire early module system on importing by URL/domain, then
published a candid post-mortem ([Deno: "What we got wrong about HTTP imports"](https://deno.com/blog/http-imports))
explaining why it moved to a **centralized registry (JSR)** + npm specifiers.
Their stated problems map almost 1:1 onto risks for domaininstall:
- **URLs/domains are *less* memorable and more verbose than short names** — Deno's
  own example contrasts `import express from "express"` favorably against the long
  URL form. This directly undercuts the notes' "domains are memorable" premise.
- **No semver / duplicate-dependency hell** when identity is a URL/domain.
- **Reliability = your weakest host.** Resolution now depends on the domain owner's
  DNS + hosting staying up, forever. ([Deno also later](https://deno.com/blog/not-using-npm-specifiers-doing-it-wrong)
  told users to stop importing npm packages via HTTP.)
Go reviewers rejected the DNS-TXT variant for overlapping reasons (DNS debugging
pain; HTTPS is easy now) — [Go #26160](https://github.com/golang/go/issues/26160).
**Two serious ecosystems tried adjacent versions of this and backed away.**

### Risk 2 — The "trust/provenance" wedge is already owned by better-resourced incumbents, and DNS is weaker crypto
- npm provenance + Sigstore/SLSA is shipped, backed by GitHub/Microsoft + OpenSSF,
  and is becoming the default trust layer ([github.blog](https://github.blog/security/supply-chain-security/introducing-npm-package-provenance/),
  [Sigstore research](https://rywalker.com/research/sigstore)).
- Even *that* cryptographic approach is getting beaten in real incidents
  (attackers forged valid Sigstore attestations in the Shai-Hulud / "mini
  Shai-Hulud" worms — [slsa.dev](https://slsa.dev/blog/2026/05/mini-shai-hulud-what-slsa-can-and-cannot-do),
  [cyberuptive](https://www.cyberuptive.com/insights/mini-shai-hulud-npm-supply-chain/)).
- DNS TXT + DoH (without near-universal DNSSEC) is a **weaker** authenticity
  primitive than keyless signing. Security-conscious buyers — the stated wedge —
  will ask "why is a TXT record more trustworthy than a signed provenance
  attestation?" and the honest answer is "it usually isn't." The notes already
  concede npm 12 removes the "we block install scripts" pitch; provenance removes
  much of the remaining "verified" pitch too.

### Risk 3 — Brutal two-sided (publisher + consumer) cold-start with no network effect to force it
- This is a classic chicken-and-egg platform: **consumers won't type `dpm foo.com`
  unless domains publish records; domain owners won't publish records unless
  consumers use the tool** ([NFX on the chicken-or-egg problem](https://www.nfx.com/post/19-marketplace-tactics-for-overcoming-the-chicken-or-egg-problem)).
- Unlike Go (where domain imports were *mandatory*, forcing the behavior),
  domaininstall is **purely optional sugar on top of npm** — there's no mechanism
  compelling either side to adopt. A publisher gains almost nothing (their package
  already installs fine via `npm i foo`); a consumer must install a new global CLI
  first, which is *more* friction than the `npm`/`curl` they already have.
- Seeding supply yourself (the notes' plan) gets you a demo, not liquidity.

---

## (d) Blunt verdict

**Is there a real, demonstrated appetite? No — not yet, and the strongest
historical precedents lean negative.**

- **The pains are real** (npm spam/name-squatting, `curl | bash` distrust, and
  especially AI slopsquatting), but developers currently **tolerate** them with
  scopes, caution, and emerging provenance tooling. There is **no expressed demand**
  for "install by domain" — the demand is inferred.
- **The one large-scale, real-world test of domain/URL-as-package-identity in JS
  (Deno) was rolled back**, and its post-mortem contradicts the core "domains are
  memorable and better" premise. Go rejected the DNS variant. That's the single
  most important fact in this report.
- **The trust wedge is contested by incumbents with better crypto** (Sigstore
  provenance) and more distribution (GitHub/npm/Microsoft).
- **The adoption model is a hard two-sided problem with no forcing function** —
  it's optional convenience layered on a package manager that already works.

This reads as a **vitamin, not a painkiller** for the mainstream developer. It is
a genuinely elegant idea (Go's community even liked it in principle), and there's a
narrow, timely story around **slopsquatting / AI-agent installs** where a
domain-vouched resolver could be a real painkiller — *if* that's made the sharp,
single wedge and paired with a forcing function (e.g., an AI-agent/MCP integration
that refuses to install unless a package is domain-vouched, so consumers create
publisher pull).

**Recommendation before writing more code:** don't build the general-purpose
`dpm <domain>` yet. First, validate the *slopsquatting/AI-install* wedge with real
users, and get a straight answer to the killer question: **"Why is a DNS TXT record
more trustworthy — and more convenient — than npm's existing Sigstore provenance?"**
If there's no crisp answer, the project competes on convenience against `npm`/`curl`
(which it can't beat on friction) and on trust against Sigstore (which it can't beat
on cryptography). Also note the **`dpm` name is already taken** by [dpm.fi](https://dpm.fi/).

---

## Source list (primary)
- Deno, *What we got wrong about HTTP imports*: https://deno.com/blog/http-imports
- Deno, *If you're not using npm specifiers, you're doing it wrong*: https://deno.com/blog/not-using-npm-specifiers-doing-it-wrong
- Go proposal #26160 (DNS TXT vanity imports): https://github.com/golang/go/issues/26160
- Go vanity import paths overview: https://sagikazarmark.hu/blog/vanity-import-paths-in-go/
- IPFS DNSLink: https://dnslink.org/
- npm package provenance (GitHub): https://github.blog/security/supply-chain-security/introducing-npm-package-provenance/
- npm trusted publishers: https://docs.npmjs.com/trusted-publishers
- Sigstore/SLSA limits (forged attestations): https://slsa.dev/blog/2026/05/mini-shai-hulud-what-slsa-can-and-cannot-do
- Slopsquatting (The Register): https://theregister.com/2025/04/12/ai_code_suggestions_sabotage_supply_chain
- npm spam/pollution (Veracode): https://www.veracode.com/blog/the-great-npm-garbage-patch/
- curl|bash debate (Chef): https://www.chef.io/blog/5-ways-to-deal-with-the-install-sh-curl-pipe-bash-problem
- webinstall.dev: https://webinstall.dev/
- dpm.fi (name collision): https://dpm.fi/
- Entropic (failed npm alternative): https://www.theregister.com/2019/06/04/npm_cj_silverio_javascript/
- Chicken-and-egg / two-sided adoption (NFX): https://www.nfx.com/post/19-marketplace-tactics-for-overcoming-the-chicken-or-egg-problem

*Content from sources was rephrased/summarized for compliance with licensing restrictions.*
