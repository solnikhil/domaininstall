# domaininstall — feature candidates (one-by-one)

> Working inventory of possible new features, grounded in `ROADMAP.md`, prior
> research (`RESEARCH*.md`), 2026 market signals, and a **137-agent evaluation**
> (workflow `feature-research`, 2026-08-04). This is **not** a commitment to
> build any of these.
>
> **Full multi-agent report:** [`FEATURE-RESEARCH-REPORT.md`](./FEATURE-RESEARCH-REPORT.md)
> (15 research + 40 score + 40 skeptic + 40 measure + 2 synth).
>
> **How to read each entry.** Every feature has: what it is, why it might
> matter, risks / objections, how you would measure success, multi-agent
> **priority score** (higher = better under the panel’s formula), and stance
> (NOW / NEXT / LATER / DEFER / NEVER). Stances assume **zero external
> publishers today** and the roadmap rule: do not expand the CLI if publisher,
> correctness, or comprehension gates fail.

**Related:** `ROADMAP.md` (source of truth for shipped work and bets),
`SECURITY.md`, `SECURITY-domain-ownership.md`.

---

## Product constraints (apply to every feature)

| Constraint | Implication |
| --- | --- |
| Promise is **mapping continuity**, not package safety | Features that sound like a malware scanner or full attestation product fight non-goals |
| Binding constraint is **publisher supply** | Prefer features that create mappings or reduce setup friction |
| Milestone 4 not started | Prefer validation experiments over large eng bets |
| Non-goals | Not a scanner, registry, provenance system, or lockfile replacement |
| Ranked growth bets | (1) publisher onboarding → (2) resolve/API → (3) agent/CI policy → (4) spec → (5) other ecosystems |

---

## Multi-agent consensus (2026-08-04)

**Headline.** With zero external publishers, **do not expand the CLI yet**. Run
Milestone 4 under a feature freeze. Skeptics marked even high-score items
`should_build=false` until validation runs. Scores still rank *what to build
after* M4 (or on pivot).

| Bucket | What the panel agreed |
| --- | --- |
| **Immediate** | M4 quiet beta only — outreach, guide accuracy, trackers, bugfixes that unblock measurement. No growth features “to make M4 pass.” |
| **After continue** | F01 setup *only if* Gate 2 shows CLI-solvable friction; then F03 `resolve --json` as the eng hinge |
| **Pivot if M4 fails** | F03 → F05 policy mode → F34 GitHub Action (→ F33 MCP later). Continuity checks for agents/CI, not a general allowlist product |
| **Never / non-goal** | F32 health scanner, F31 directory, F19 transparency log, F22 cool-down *inside* di, F16/F23/F24 provenance productization, F27 URI/SRV, F39 offline pin-only, F25–F26 other ecosystems before npm demand |

Score columns below: **Prio** = panel priority formula; **Wait M4** = scorer said wait; **Skeptic** = `should_build` (almost all false pre-M4).

---

## Feature index

| ID | Title | Prio | Wait M4 | Stance (post panel) |
| --- | --- | --- | --- | --- |
| F01 | `di setup` publisher onboarding | 41 | yes | **NEXT** (continue path only; not pre-M4) |
| F02 | README verify badge | 28 | yes | **NEXT** (after live external placements) |
| F03 | `di resolve --json` | 35 | yes | **NEXT** (first eng hinge / pivot substrate) |
| F04 | Hosted verification API | 20.5 | yes | **LATER** |
| F05 | Agent/CI allowlist policy mode | 35.5 | yes | **NEXT** (pivot path after F03) |
| F06 | `_dnstall` record specification | 22 | yes | **NEXT** (after multi-publisher demand) |
| F07 | Scope-specific registry support | 19.5 | yes | **LATER** (when a real user hits G1) |
| F08 | `di trust list` / `forget` | 24.5 | yes | **NEXT** (hygiene when multi-pin users exist) |
| F09 | System-resolver fallback | 13 | yes | **LATER** |
| F10 | Configurable DoH providers | 12.5 | yes | **LATER** |
| F11 | pnpm project support | 12 | yes | **LATER** |
| F12 | Yarn project support | 6 | yes | **LATER** |
| F13 | Bun project support | 7 | yes | **LATER** |
| F14 | Pin publisher identity | 11.5 | yes | **LATER** |
| F15 | Pin tarball integrity | 5 | yes | **LATER** |
| F16 | Pin provenance state | 2 | yes | **NEVER** (border non-goal) |
| F17 | Pin maxAge re-verification | 9.5 | yes | **LATER** |
| F18 | RDAP registration liveness | 13 | yes | **LATER** |
| F19 | Transparency log (first-use) | −1.5 | yes | **NEVER / DEFER** |
| F20 | Show resolver used in CLI | 15.5 | no | **LATER** (tiny honesty; not growth) |
| F21 | Windows trust-store hardening | 5 | yes | **LATER** |
| F22 | min-release-age cool-down gate | 3.5 | yes | **NEVER** (use native PM settings) |
| F23 | Provenance badge in preview | 3.5 | yes | **NEVER** (overclaim risk) |
| F24 | trustPolicy-style no-downgrade | 1.5 | yes | **NEVER** (border non-goal) |
| F25 | PyPI ecosystem mapping | 5.5 | yes | **DEFER** |
| F26 | crates.io ecosystem mapping | 5.5 | yes | **DEFER** |
| F27 | URI or SRV record support | 1 | yes | **NEVER / DEFER** |
| F28 | DNS resolution cache | 2.5 | yes | **LATER** |
| F29 | Domain expiry warning | 9.5 | yes | **LATER** |
| F30 | Rich record metadata | 4.5 | yes | **DEFER** |
| F31 | Public package directory | −2 | yes | **NEVER** |
| F32 | Pre-install health signals | −3.5 | yes | **NEVER** |
| F33 | MCP / agent tool for resolve | 16 | yes | **NEXT** (after F03 + pivot/continue) |
| F34 | GitHub Action verify | 26.5 | yes | **NEXT** (after F03; pivot path) |
| F35 | `di doctor` diagnostics | 29.5 | yes | **NEXT** (only if setup still fails for env reasons) |
| F36 | DNSSEC end-to-end validation | 6 | yes | **LATER** |
| F37 | Pin store export / import | 8.5 | yes | **LATER** |
| F38 | Shell completions | 6.5 | yes | **LATER** |
| F39 | Offline / airgap mode | −2 | yes | **NEVER / DEFER** |
| F40 | Subpackage UX polish | 6.5 | yes | **LATER** |

---

## One by one

### F01 — `di setup` publisher onboarding

**What.** A command that takes a package name (and optional version policy) and
prints the exact `_dnstall` TXT value plus copy-paste steps for common
registrars (Cloudflare, Route53, Namecheap, GoDaddy, etc.). Optionally checks
propagation with `di verify` in a loop.

**Why it matters.** Roadmap bet #1. Without publishers, every other feature is
polish on a tool nobody can use. Original research and Go #26160 both flag
**DNS onboarding friction** as the fatal risk.

**Risks.** Registrar UIs change; propagation delay frustrates users; a bad setup
UX becomes the product’s reputation.

**Measure.** Median time from zero → green `di verify` ≤ 10 minutes; ≥4/5
publishers complete without maintainer help (Milestone 4 gate 2).

**Panel:** prio **41** (highest raw score); skeptic `build=false` until M4; unlock only if Gate 2 fails on *format/copy-paste* friction, not wrong-NS or author≠DNS-ops.

**Stance: NEXT (continue path only).** Do **not** build pre-M4 — freeze first, measure whether a generator is needed.

---

### F02 — README verify badge

**What.** Generate a markdown snippet / shield badge: “Verified with domaininstall”
linking to `di verify <domain>` docs or a live check.

**Why it matters.** Supply needs demand signals *on publisher docs*. A badge is
cheap marketing that also documents the intended install path.

**Risks.** Badge over-claims security (“verified safe package”). Copy must say
**mapping verified**, not package audited.

**Measure.** ≥3 real README / install-doc placements (Milestone 4 gate 3).

**Panel:** prio **28**; demand-first — greenlight only after ≥5 external maps + real placements; static snippets first, no live badge infra.

**Stance: NEXT.** After Gate 3 has live external placements; keep claim = mapping only.

---

### F03 — `di resolve --json`

**What.** Non-interactive resolve that prints a stable JSON schema (domain,
package, version policy, registry, DNSSEC badge, pin status, exit codes) and
never installs.

**Why it matters.** Closes G4. Unlocks CI, agents, and scripts without weakening
the human confirm path for `di <domain>`. Roadmap bet #2.

**Risks.** Schema churn if published too early; exit-code semantics must be
documented and versioned.

**Measure.** Third party can integrate from docs alone; golden fixtures for every
DNS outcome (NXDOMAIN, NODATA, conflict, pin mismatch).

**Panel:** prio **35**; shared eng hinge for continue *and* pivot; skeptics still say wait_m4 (don’t freeze a public API over an empty graph without a written pivot).

**Stance: NEXT.** First engineering bet after M4 continue-vs-pivot (or substrate of formal agent/CI pivot).

---

### F04 — Hosted verification API

**What.** HTTP endpoint: `GET /v1/resolve?domain=example.com` returning the same
shape as F03, without requiring the CLI.

**Why it matters.** Lowest friction for bots and multi-language tools. Makes the
convention feel like infrastructure.

**Risks.** Hosting, abuse, rate limits, privacy (queried domains), and ops burden
for a single-maintainer project. Conflicts with “zero-infra” posture if
overbuilt early.

**Measure.** External caller integrates; error budget and rate-limit policy
written; no PII retention of query logs beyond short TTL.

**Panel:** prio **20.5**; high non-goal/infra risk; prefer local resolve.

**Stance: LATER.** Only if third parties reject local CLI/DNS after supply exists.

---

### F05 — Agent / CI allowlist policy mode

**What.** Non-interactive mode: “only install packages declared by these
domains” (or “only if domain maps to this package”). Deterministic exit codes,
no TTY. Roadmap bet #3.

**Why it matters.** Turns domaininstall from convenience into an **org control**.
Single-org adoption does not need a two-sided market. Strong pivot if Milestone 4
human/publisher gates fail.

**Risks.** Scope creep into full policy engine; confusion with Socket/npq/allowlist
products; must not imply malware scanning.

**Measure.** Runs unattended in CI; documented policy file; false-positive rate
measured on a real monorepo.

**Panel:** prio **35.5**; explicit **pivot path** if M4 publisher/comprehension fails; must stay continuity policy, not Socket/npq replacement.

**Stance: NEXT (pivot path).** After F03; only with org self-maps or formal pivot write-up.

---

### F06 — `_dnstall` record specification

**What.** Short, versioned standalone spec for the TXT format (fields, purl
shape, multi-record rules, error handling) separate from this CLI.

**Why it matters.** Roadmap bet #4 and 1.0 readiness. Other tools can implement
the convention; the project becomes a protocol, not only a binary.

**Risks.** Spec without implementations is theater; over-specifying before real
publishers freezes bad choices.

**Measure.** Spec versioned (e.g. `dnstall-1`); at least one independent parser
or golden test suite outside marketing copy.

**Panel:** prio **22**; premature specs don’t create supply.

**Stance: NEXT.** After multi-publisher demand or a second implementer commits.

---

### F07 — Scope-specific registry support (G1)

**What.** When `@scope:registry` would divert npm away from the displayed
registry, resolve and pin the **effective** registry instead of refusing.

**Why it matters.** High severity gap: scoped private registries are real.
Refusal is honest today; support would unblock enterprise-ish use.

**Risks.** Easy to get wrong (show one registry, fetch another). Security-sensitive.

**Measure.** Adversarial tests: conflicting scope config, pin includes effective
registry, preview matches fetch.

**Panel:** prio **19.5**; refuse already fail-closed.

**Stance: LATER.** When a real `@scope:registry` installer appears.

---

### F08 — `di trust list` and `di trust forget` (G2)

**What.** List saved domain→package pins; forget one domain (with backup) without
`trust reset --all`.

**Why it matters.** High severity gap. Full wipe is a blunt recovery tool; power
users and testers need partial control.

**Risks.** Low if modeled carefully (atomic writes, confirm forget).

**Measure.** Tests for list/forget/partial reset; no silent full wipe.

**Panel:** prio **24.5**; low non-goal risk but still wait_m4 (full reset recovers today).

**Stance: NEXT.** Hygiene when multi-pin installers appear post-M4 — not a growth bet.

---

### F09 — System-resolver fallback (G3)

**What.** Opt-in fallback to the OS DNS resolver when both hard-coded DoH
providers fail, clearly labeled **unauthenticated** in the preview.

**Why it matters.** DoH blocks make the tool unusable; fail-closed is correct but
hostile on restricted networks.

**Risks.** Silent downgrade is a security footgun — labeling and opt-in are
mandatory.

**Measure.** Distinct preview badge; default remains DoH-only; tests for
opt-in path.

**Panel:** prio **13**; only on a real dual-DoH failure report (R4).

**Stance: LATER.** Availability fix, not growth.

---

### F10 — Configurable DoH providers

**What.** User/config list of DoH endpoints instead of only Cloudflare/Google
(or whatever is hard-coded).

**Why it matters.** Enterprise DNS, privacy-conscious users, provider outages.

**Risks.** Misconfiguration; users pointing at malicious resolvers; complexity.

**Measure.** Documented config schema; fail-closed on empty/invalid list.

**Panel:** prio **12.5**.

**Stance: LATER.** Sibling of F09; not speculative expansion.

---

### F11 — pnpm project support (G5)

**What.** Detect pnpm projects; install with lifecycle scripts disabled and
behavior tested to the same adversarial standard as npm.

**Why it matters.** Large share of modern JS repos. Refusal is honest but limits
addressable market.

**Risks.** Each PM has different flags, lockfiles, and script defaults (pnpm is
stricter). Multiplies test matrix.

**Measure.** Adversarial suite green; live install on pnpm fixture.

**Panel:** prio **12**; bet 5 last.

**Stance: LATER.** After npm demand proven.

---

### F12 — Yarn project support (G5)

**What.** Same as F11 for Yarn Berry.

**Why it matters.** Still common in enterprises.

**Risks.** Yarn config surface is large; Berry vs classic differences.

**Measure.** Same as F11 for Yarn fixtures.

**Panel:** prio **6**.

**Stance: LATER.** After pnpm + demand.

---

### F13 — Bun project support (G5)

**What.** Same as F11 for Bun.

**Why it matters.** Growing runtime/PM; different security defaults.

**Risks.** Moving target; fewer mature “ignore scripts” norms documented.

**Measure.** Same as F11 for Bun fixtures.

**Panel:** prio **7**.

**Stance: LATER.**

---

### F14 — Pin publisher identity (G7)

**What.** On resolve/install, record npm publisher (or trusted-publisher identity)
in the pin; block or hard-warn if it changes.

**Why it matters.** Domain repoint is only one hijack mode; stolen npm tokens are
another. Closes part of ownership-change design layers.

**Risks.** npm identity fields can be noisy; account renames; false positives.

**Measure.** Fixture where publisher changes is refused without `--yes` bypass.

**Panel:** prio **11.5**; avoid overclaiming npm-account trust (R3).

**Stance: LATER.** After external maps and returning installers.

---

### F15 — Pin tarball integrity (G7)

**What.** Pin resolved tarball hash (e.g. from registry metadata) and diff on
later installs.

**Why it matters.** Detects package content change for the same name/version
policy path the pin cares about.

**Risks.** Version ranges mean “same pin, new version” is normal — integrity must
attach to the **resolved version**, not only the package name.

**Measure.** Tampered / replaced version triggers hard stop.

**Panel:** prio **5**.

**Stance: LATER.** Design carefully with range policies.

---

### F16 — Pin provenance state (G7 / layer 6)

**What.** Remember whether the installed version had provenance/attestations;
warn if a later version drops it (pnpm `trustPolicy` spirit).

**Why it matters.** Market is training users on provenance drop as compromise
signal. Fits as a **signal**, not a safety proof.

**Risks.** Many packages lack provenance forever; noisy warnings; non-goal creep
if marketed as “we verified the build.”

**Measure.** Synthetic drop case; opt-in strictness.

**Panel:** prio **2**; high non-goal risk (attestations border). **Panel NEVER bucket** with F23/F24.

**Stance: NEVER** as a productized trust layer. Prefer native npm/pnpm provenance tooling.

---

### F17 — Pin maxAge re-verification (G8)

**What.** Pins expire after `maxAge`; force full re-verify / re-confirm.

**Why it matters.** Stale trust forever is a known gap; short trust windows are
in the ownership-change design.

**Risks.** Annoying re-prompts; bad default ages; breaks unattended use without
policy mode.

**Measure.** Expired pin requires interactive re-confirm; CI mode has explicit
policy.

**Panel:** prio **9.5**.

**Stance: LATER.** After pin UX (F08) and real returning users.

---

### F18 — RDAP registration liveness (G9)

**What.** Check domain registration/creation dates; block if transfer or
re-registration is detected.

**Why it matters.** Domain expiry → re-register is a classic hijack for
domain-linked trust.

**Risks.** Per-TLD mess, privacy proxies, RDAP outages; high maintenance.

**Measure.** Known re-reg fixture blocks; soft-fail policy documented.

**Panel:** prio **13**; R5 trigger once high-value external maps exist.

**Stance: LATER.**

---

### F19 — Transparency log for first-time users (G10)

**What.** Public append-only log of domain→package mappings so first use isn’t
blind TOFU.

**Why it matters.** TOFU cannot protect the first visit; a log is the classic fix.

**Risks.** Needs infrastructure, operators, and gossip — conflicts with
zero-infra, single-maintainer reality. Deferred in roadmap for good reason.

**Measure.** Only revisit if a host org sponsors the log.

**Panel:** prio **−1.5**; highest effort + non-goal risk; empty at zero publishers.

**Stance: NEVER / DEFER.** Only with infrastructure partners and dense supply.

---

### F20 — Show resolver used in CLI (G6)

**What.** Preview/verify output shows which DoH provider (or system resolver)
answered.

**Why it matters.** Every lookup discloses the domain to a third party; users
deserve to see where it went. Small honesty win.

**Risks.** Negligible if worded clearly.

**Measure.** Snapshot tests for preview lines.

**Panel:** prio **15.5**; only feature scored **wait_m4=false** (tiny honesty win) but still not a growth priority; skeptic build=false in aggregate freeze.

**Stance: LATER.** Cheap anytime bugfix after command surface stabilizes — not a M4 substitute.

---

### F21 — Windows trust-store hardening (G11)

**What.** Stronger pin-file guarantees on Windows closer to POSIX owner-only /
no-follow semantics, within what Node exposes.

**Why it matters.** Documented weaker guarantees today; Windows is a supported
platform (0.0.3 work).

**Risks.** Platform limits may make “perfect parity” impossible; over-promising.

**Measure.** Document residual risk honestly; tests for symlink rejection remain.

**Panel:** prio **5**.

**Stance: LATER.** Track Node capabilities; don’t block product validation.

---

### F22 — min-release-age cool-down gate

**What.** Refuse (or warn on) package versions younger than N days/hours, matching
2025–2026 package-manager cool-down trends.

**Why it matters.** Industry consensus mitigation for flash malware publishes.

**Risks.** Not unique to domaininstall (users can set npm/pnpm/yarn/bun config);
duplicating PM policy may confuse. Delays legitimate hotfixes.

**Measure.** Only ship if `di` install path bypasses user PM config and needs its
own gate; otherwise document “set min-release-age in your PM.”

**Panel:** prio **3.5**; market-real but orthogonal; expands version-trust claim.

**Stance: NEVER** inside `di`. Document native npm/pnpm/yarn/bun cool-downs instead.

---

### F23 — Provenance badge in preview

**What.** After resolve, show whether the candidate version has npm provenance /
signatures — as a **badge**, not a safety claim.

**Why it matters.** Users already look for this signal; showing it next to DNS
continuity educates without expanding the promise.

**Risks.** Badge misread as “safe”; registry API failures; performance.

**Measure.** Wording review (comprehension ≥80% that it is not a safety proof);
tests for present/absent.

**Panel:** prio **3.5**; high overclaim (R3) / non-goal risk.

**Stance: NEVER** as marketed safety chrome. Continuity claim must stay narrow.

---

### F24 — trustPolicy-style no-downgrade

**What.** Fail when aggregate trust signals weaken vs pin (DNSSEC lost,
provenance dropped, publisher changed).

**Why it matters.** Matches pnpm’s compromise-shaped signal.

**Risks.** Complex product; false positives; depends on F14–F16/F23 maturity.

**Measure.** Matrix of downgrade cases with golden exits.

**Panel:** prio **1.5**.

**Stance: NEVER** as productized multi-signal trust product. Prefer PM-native trustPolicy.

---

### F25 — PyPI ecosystem mapping

**What.** Same DNS purl pattern (`pkg:pypi/...`) installing via pip/uv.

**Why it matters.** Roadmap bet #5 — reuse protocol across ecosystems.

**Risks.** Doubles support surface before npm demand is proven.

**Measure.** Only after npm has external publishers and repeated users.

**Panel:** prio **5.5**.

**Stance: DEFER.** Bet 5 last — only after npm demand.

---

### F26 — crates.io ecosystem mapping

**What.** Same idea for Rust crates.

**Why it matters.** Same as F25.

**Risks.** Same as F25.

**Panel:** prio **5.5**.

**Stance: DEFER.**

---

### F27 — URI or SRV record support

**What.** Alternative record types (e.g. URI per RFC 7553) instead of or in
addition to TXT.

**Why it matters.** Suggested in Go #26160 discussion.

**Risks.** Registrar UI and DoH JSON support are weaker than TXT; worsens the
#1 onboarding risk. Explicitly deferred in roadmap.

**Panel:** prio **1**; worsens onboarding friction (bet 1 opposite).

**Stance: NEVER / DEFER.**

---

### F28 — DNS resolution cache

**What.** Cache DoH answers with TTL awareness for repeated `verify`/`resolve`.

**Why it matters.** Speed and less provider chatter.

**Risks.** Stale security-relevant data; TOCTOU if cache spans confirm→install
(current design resolves once before confirm — preserve that).

**Measure.** Cache never used for the install decision after confirm without
reusing the same resolved snapshot.

**Panel:** prio **2.5**.

**Stance: LATER.** After correctness paths are stable; never span confirm→install.

---

### F29 — Domain expiry warning

**What.** Warn when RDAP/WHOIS-like data shows domain near expiry or redemption.

**Why it matters.** Soft version of F18; educates publishers and installers.

**Risks.** Same RDAP fragility as F18; noisy false alarms.

**Panel:** prio **9.5**.

**Stance: LATER.** Bundle with F18 if ever built.

---

### F30 — Rich record metadata

**What.** Optional TXT fields: homepage, source repo, maintainer contact, etc.

**Why it matters.** Richer previews; directory (F31) fuel.

**Risks.** Spec complexity; unused fields; spoofable metadata (still just DNS).

**Panel:** prio **4.5**.

**Stance: DEFER.** Keep the record small until publishers exist.

---

### F31 — Public package directory

**What.** Website listing domains that publish `_dnstall` mappings.

**Why it matters.** Discovery for a network-effect product.

**Risks.** Becomes a package registry/mirror in spirit; spam; ops; roadmap
defers directories.

**Panel:** prio **−2**; registry/authority feel; empty with zero maps.

**Stance: NEVER.**

---

### F32 — Pre-install health signals (npq-adjacent)

**What.** Optional signals before confirm: has README, license, repo age, download
velocity, etc.

**Why it matters.** npq-style proactive checks; users like dashboards.

**Risks.** Non-goal creep into scanner product; false confidence; API deps.

**Panel:** prio **−3.5** (lowest); explicit non-goal; worst R3 overclaim.

**Stance: NEVER.** Point users at Socket/Snyk/npq.

---

### F33 — MCP / agent tool for resolve

**What.** Expose `resolve` as an MCP tool or agent skill so coding agents check
domain→package before `npm i` hallucinated names.

**Why it matters.** Slopsquatting is the hottest adjacent pain. Agents may be the
real user persona even if humans don’t switch install habits.

**Risks.** Needs F03; distribution of the tool; agents ignoring the tool.

**Measure.** Agent harness: hallucinated name blocked when domain policy is set;
docs for Cursor/other agents.

**Panel:** prio **16**; empty graph leaves slopsquat defense hollow (continuity ≠ model-intended name).

**Stance: NEXT.** After F03 + continue-vs-pivot write-up.

---

### F34 — GitHub Action verify

**What.** Official Action: fail CI if domain mapping missing, drifts from pin
policy, or resolve fails.

**Why it matters.** CI is where policy sticks; marketing surface for maintainers.

**Risks.** Action maintenance; versioning; secrets none if public DNS only.

**Measure.** Reference workflow in a sample repo; green/red fixtures.

**Panel:** prio **26.5**; pairs with F05 on pivot path.

**Stance: NEXT.** After F03; continuity-only policy wording.

---

### F35 — `di doctor` diagnostics

**What.** One command: Node/npm presence, DoH reachability, pin store health,
platform notes, sample resolve.

**Why it matters.** Support burden killer; helps Milestone 4 unassisted setup.

**Risks.** Scope bloat if it tries to fix everything.

**Measure.** Reproduces common failures with actionable next steps.

**Panel:** prio **29.5** (high raw score) but **not** Gate 2 itself — only if post-M4 setup still fails for diagnosable env issues.

**Stance: NEXT.** Conditional; docs/guide first, doctor second.

---

### F36 — DNSSEC end-to-end validation

**What.** Client-side chain validation (beyond resolver AD bit) for a stronger
DNSSEC badge.

**Why it matters.** Differentiator for authenticity-minded users.

**Risks.** Heavy deps, false negatives (middleboxes), most domains unsigned —
badge rarely green. Research already says best-effort only.

**Panel:** prio **6**.

**Stance: LATER.** Keep AD-bit badge; revisit if demand is loud.

---

### F37 — Pin store export / import

**What.** Export/import `pins.json` (or a signed subset) for team machines.

**Why it matters.** TOFU is per-machine today; teams want shared trust state.

**Risks.** Sharing pins can propagate a bad first pin; import needs confirmation.

**Measure.** Round-trip test; import always shows diff and confirms.

**Panel:** prio **8.5**.

**Stance: LATER.** After F08 exists.

---

### F38 — Shell completions

**What.** bash/zsh/fish/pwsh completions for subcommands and flags.

**Why it matters.** Polish; lower CLI friction.

**Risks.** None serious; maintenance of completion scripts.

**Panel:** prio **6.5**.

**Stance: LATER.** After command surface stabilizes (setup, trust, resolve).

---

### F39 — Offline / airgap mode

**What.** Resolve only from exported pins; no live DNS.

**Why it matters.** Enterprise airgap installs.

**Risks.** Narrow audience early; security model is “trust the export.”

**Panel:** prio **−2**; skips live DNS re-verify that *is* the continuity promise.

**Stance: NEVER / DEFER.** Competes with lockfiles; abandons the product promise.

---

### F40 — Subpackage UX polish

**What.** Clearer multi-package domains: list declared subpackages, better
errors for `domain/sub`, maybe `di list example.com` if DNS allows enumeration
(usually it does not — so docs + conventions matter more than magic).

**Why it matters.** Subpackage labels already exist (`_dnstall.react.example.com`);
UX can still confuse.

**Risks.** DNS cannot enumerate labels easily; “list” may be impossible without a
manifest record.

**Measure.** Fewer support questions; clearer verify errors.

**Panel:** prio **6.5**.

**Stance: LATER.** Small docs/CLI copy wins anytime; deep list UX needs design.

---

## Suggested sequencing (multi-agent consensus)

```text
NOW (this window — feature freeze)
  Milestone 4 quiet beta only: contacts, PUBLISHER-GUIDE, trackers, claim hygiene
  Bugfixes that unblock measurement — no F01–F40 “to make M4 pass”

NEXT (after continue decision)
  F01 setup — only if Gate 2 fails on format/copy-paste friction
  F03 resolve --json — first eng hinge
  F02 badge — after live external placements (static first)
  F06 spec — after multi-publisher / second implementer
  F08 trust list/forget · F35 doctor (conditional) · F07 when hit
  F20 resolver shown as tiny honesty when touching DNS UX

NEXT (if M4 fails → formal pivot)
  F03 → F05 policy mode → F34 GitHub Action → F33 MCP
  Continuity-only wording; not a general allowlist product

LATER (depth after real adoption)
  F04 hosted API · F09/F10 DoH resilience · F11–F13 other PMs
  F14/F15/F17/F18/F29 pin + RDAP layers · F21 Windows
  F28 cache · F36 DNSSEC E2E · F37 export · F38 completions · F40 subpackages

NEVER / DEFER (panel kill list)
  F19 transparency log · F22 cool-down inside di · F23/F16/F24 provenance product
  F25–F27 multi-ecosystem / URI · F30 rich metadata · F31 directory
  F32 health scanner · F39 offline pin-only
```

---

## How to measure the program (not just features)

Reuse Milestone 4 gates as the north star (panel measurement plan):

| Gate | Threshold (from roadmap) |
| --- | --- |
| Publishers | 20 contacted; ≥5 external mappings live |
| Setup | ≥4/5 unassisted; median ≤10 minutes |
| Docs placement | ≥3 real README placements |
| Discovery | ≥90% correct package selection in tasks |
| Usage | ≥10 external users, ≥25 uses, ≥5 repeat |
| Comprehension | ≥80% understand “mapping ≠ package safety” |

**Weekly checklist (from synthesizers).** Funnel counts; gate thresholds; failure
taxonomy (wrong NS, author≠DNS ops, propagation, motivation, DoH block, claim
confusion); feature-freeze audit; pivot watch (two consecutive weeks missing
publisher, Gate 4 correctness, or comprehension → stop human-CLI bets and
timebox F03+F05/F34). Never count
`zuraai.xyz` as external supply.

**Decision rule.** If publisher, correctness, or comprehension gates fail: stop
expanding the human install CLI; double down on F03/F05/F33/F34 (agent/CI
continuity policy), or archive growth work.

---

## Changelog for this doc

| Date | Note |
| --- | --- |
| 2026-08-04 | Initial inventory of F01–F40 from roadmap, gaps, bets, market research. |
| 2026-08-04 | Updated stances + scores from 137-agent workflow `feature-research` (15/40/40/40/2 all OK). Full report in `FEATURE-RESEARCH-REPORT.md`. Consensus: M4 freeze first; F03 hinge; pivot path F05/F34; kill scanner/directory/provenance-as-product. |
