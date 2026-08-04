# Research backlog

This document tracks **open research questions** that came out of a full
codebase and docs review. Research here means “we do not yet know the answer
well enough to design, prioritize, or ship safely,” not “we should polish a
feature.”

**How this differs from `ROADMAP.md`**

| Document | Job |
| --- | --- |
| [`ROADMAP.md`](../ROADMAP.md) | Operational **status**: what shipped, what is incomplete, gates, bets, risks |
| **This file** | **Research questions**: assumptions to test, designs to de-risk, evidence to gather before more code |

If status and research disagree, fix the research item or update the roadmap
after the research lands. Historical notes (`RESEARCH.md`, `NOTES.md`,
`SECURITY-domain-ownership.md`) are frozen design history; they feed questions
here but do not override current code or the roadmap.

---

## How to use

### Status tags

| Tag | Meaning |
| --- | --- |
| `open` | Not started; question still blocks a confident decision |
| `in-progress` | Someone is actively answering it; link notes/PR in the item |
| `done` | Answer written down (even if the answer is “don’t build this”); close the item |

### Priority

| Priority | Meaning |
| --- | --- |
| **P0** | Product-validation or positioning; blocks the continue-vs-pivot call |
| **P1** | Security or platform assumptions that affect real installs today |
| **P2** | Important design de-risk; can wait until M4 or a growth bet starts |
| **P3** | Nice-to-know; do not schedule unless idle or a related P1/P2 opens |

### Severity (for security/assumption items)

| Severity | Meaning |
| --- | --- |
| **Critical** | Wrong answer could enable hijack, wrong install, or silent trust failure |
| **High** | Wrong answer breaks a supported platform path or core claim |
| **Medium** | Gaps or footguns; mitigated by refuse/fail-closed today |
| **Low** | Documentation drift, polish, or long-horizon protocol work |

### Workflow

1. Pick from the **priority stack** or **suggested order**.
2. Write findings next to the item (or a short note under `docs/` if long).
3. Mark `done` when the question is answered; open a roadmap/gap update only if
   implementation should follow.

**Last execution:** 2026-08-04 (desk research + local pre-flight). Findings live under
[`docs/research/`](research/README.md). Human gates (recruitment, studies) remain open.

---

## Priority stack

| ID | Priority | Status | Title | Findings |
| --- | --- | --- | --- | --- |
| RB-M4-KIT | P0 | **done** (materials) | Verify M4 kit is usable | [FINDINGS-M4-DRYRUN](research/FINDINGS-M4-DRYRUN.md) |
| RB-GATE1 | P0 | open | Publisher recruitment | Seed: [PROSPECT-CANDIDATES](m4/PROSPECT-CANDIDATES.md) |
| RB-GATE2 | P0 | open | DNS setup friction | Needs human publishers |
| RB-GATE6 | P0 | partial | Comprehension + DNSSEC badge | Badge copy shipped; study open |
| RB-POSITION | P0 | **done** (desk) | DNS vs provenance / agents | [FINDINGS-POSITIONING](research/FINDINGS-POSITIONING.md) |
| RB-DOH | P1 | **done** | DoH / AD / multi-resolver | [FINDINGS-DOH](research/FINDINGS-DOH.md) |
| RB-PIN | P1 | **done** (design) | Pin completeness | [FINDINGS-PIN-AND-TOCTOU](research/FINDINGS-PIN-AND-TOCTOU.md) |
| RB-TOCTOU | P1 | **done** (design) | Exact version + integrity | same |
| RB-SCOPE | P1 | **done** | Scope registries policy | [FINDINGS-SCOPE-AND-PURL](research/FINDINGS-SCOPE-AND-PURL.md) |
| RB-WIN-NPM | P1 | partial | Windows npm + E2E | [FINDINGS-WINDOWS-AND-SCRIPTS](research/FINDINGS-WINDOWS-AND-SCRIPTS.md) |
| RB-NONTTY | P1 | **done** (design) | CI / agent JSON mode | [FINDINGS-NONTTY](research/FINDINGS-NONTTY.md) |
| RB-RDAP | P2 | **done** (defer) | RDAP liveness | [FINDINGS-RDAP-MAXAGE-FIRSTUSE](research/FINDINGS-RDAP-MAXAGE-FIRSTUSE.md) |
| RB-MAXAGE | P2 | **done** (defer) | Pin maxAge | same |
| RB-TOFU-FIRST | P2 | **done** (defer) | First-use / transparency log | same |
| RB-PM | P2 | open | Multi package-manager | — |
| RB-PURL | P2 | **done** | purl boundaries | [FINDINGS-SCOPE-AND-PURL](research/FINDINGS-SCOPE-AND-PURL.md) |
| RB-TXT | P2 | open | TXT multi-string edges | — |
| RB-CNAME | P2 | open | CNAME takeover | — |
| RB-WIN-PIN | P2 | **done** (doc) | Windows trust store | [FINDINGS-WINDOWS-AND-SCRIPTS](research/FINDINGS-WINDOWS-AND-SCRIPTS.md) |
| RB-SCRIPTS | P2 | **done** | ignore-scripts | same |
| RB-META | P2 | open | Record metadata UX | — |
| RB-GLOBAL | P2 | partial | Global install UX | same Windows memo |
| RB-NPMCONFIG | P2 | open | npm config diversion | — |
| RB-SPEC | P2 | open | Standalone record spec | after M4 |

---

## Detailed research items

### P0 — Product validation and positioning

#### RB-M4-KIT — Verify M4 kit is usable

| Field | Value |
| --- | --- |
| **Priority** | P0 |
| **Severity** | High (process) |
| **Status** | **done** (materials usable; human beta not started) |
| **Code/docs anchors** | [`docs/m4/README.md`](m4/README.md), [`docs/m4/RUNBOOK.md`](m4/RUNBOOK.md), [`docs/m4/OUTREACH.md`](m4/OUTREACH.md), [`docs/m4/PUBLISHER-GUIDE.md`](m4/PUBLISHER-GUIDE.md), [`docs/m4/RESULTS.md`](m4/RESULTS.md), [`ROADMAP.md`](../ROADMAP.md) §7 |

**Research question.** Can a single maintainer run the quiet-beta kit as written
for two weeks without inventing process on the fly? Are templates, trackers, and
scorecards complete enough that gates produce evidence rather than vibes?

**Method.** Dry-run the runbook alone: fill one fake contact through
`CONTACT-TRACKER.md`, walk `PUBLISHER-GUIDE.md` against a throwaway domain you
control, time each instrument, and list every missing step or broken link. Do
not mark human gates passed during the dry-run.

**Findings (2026-08-04).** Kit is write-ready: guides, outreach, comprehension,
usage, runbook, results shell are complete. CONTACT-TRACKER empty (expected).
Prospect seed list added: [`m4/PROSPECT-CANDIDATES.md`](m4/PROSPECT-CANDIDATES.md).
Local pre-flight: `di verify zuraai.xyz` OK on published 0.0.3. Details:
[FINDINGS-M4-DRYRUN.md](research/FINDINGS-M4-DRYRUN.md).

**Blocks / unblocks.** Unblocks starting RB-GATE1 outreach. Human gates still open.

---

| **Status** | open — needs human outreach; seed list ready |#### RB-GATE1 — Publisher recruitment

| Field | Value |
| --- | --- |
| **Priority** | P0 |
| **Severity** | Critical (product) |
| **Status** | open |
| **Code/docs anchors** | [`docs/m4/OUTREACH.md`](m4/OUTREACH.md), [`docs/m4/CONTACT-TRACKER.md`](m4/CONTACT-TRACKER.md), [`docs/m4/RESULTS.md`](m4/RESULTS.md), [`ROADMAP.md`](../ROADMAP.md) §7 gate 1, [`RESEARCH-demand-and-prior-art.md`](../RESEARCH-demand-and-prior-art.md) |

**Research question.** Will enough qualified npm maintainers accept contact and
publish a live `_dnstall` mapping? Roadmap threshold: 20 contacted, ≥5 external
mappings live. Today external adoption is zero (maintainer domain only).

**Method.** Execute outreach from the kit only; log every contact and outcome.
Do not count maintainer-owned mappings as external. After the window, compute
conversion rates (contacted → replied → mapped) and note refusal reasons.

**Blocks / unblocks.** Blocks any “CLI growth” bet that assumes network effects.
Failure unblocks RB-POSITION (pivot evaluation). Success unblocks publisher
onboarding engineering (roadmap bet 1).

---

| **Status** | open — needs human publishers |#### RB-GATE2 — DNS setup friction

| Field | Value |
| --- | --- |
| **Priority** | P0 |
| **Severity** | Critical (product) |
| **Status** | open |
| **Code/docs anchors** | [`docs/m4/PUBLISHER-GUIDE.md`](m4/PUBLISHER-GUIDE.md), [`docs/m4/RESULTS.md`](m4/RESULTS.md), [`src/cli.ts`](../src/cli.ts) (`cmdVerify`), [`src/record.ts`](../src/record.ts), [`ROADMAP.md`](../ROADMAP.md) §7 gate 2 / R2 |

**Research question.** Can publishers complete an unassisted setup (TXT on
`_dnstall.<domain>`) without the maintainer editing DNS? Threshold: ≥4 of 5
complete; median time ≤10 minutes. Historical risk (Go vanity-import / registrar
UX) says this is the gate most likely to fail.

**Method.** Give only the publisher guide. Time from start of instructions to
`di verify <domain>` success. Record registrar product, stuck points (name vs
host, quotes, propagation, multi-string TXT), and whether `di verify` diagnostics
were enough.

**Blocks / unblocks.** Blocks “`di setup` / registrar recipes” feature design
(need failure modes). Unblocks honest decision on whether DNS onboarding is
fatal for a CLI thesis.

---

| **Status** | partial — badge copy done; human study open |#### RB-GATE6 — Comprehension and DNSSEC badge

| Field | Value |
| --- | --- |
| **Priority** | P0 |
| **Severity** | High (reputational / safety messaging) |
| **Status** | open |
| **Code/docs anchors** | [`docs/m4/COMPREHENSION.md`](m4/COMPREHENSION.md), [`src/cli.ts`](../src/cli.ts) (`dnssecBadge`, `printSummary`), [`src/doh.ts`](../src/doh.ts) (`authenticated` / AD bit), [`SECURITY.md`](../SECURITY.md), [`ROADMAP.md`](../ROADMAP.md) §7 gate 6 / R3 |

**Research question.** After using the tool (or reading the preview), do ≥80% of
participants understand that domaininstall verifies **mapping continuity**, not
package safety? Does the `DNSSEC ✓ / —` badge cause people to over-read
authenticity as “package is safe” or “ownership is proven”?

**Method.** Run the comprehension instrument as written. Add one targeted probe
about the DNSSEC line if the base instrument does not cover it. Compare answers
for people who saw `DNSSEC ✓` vs `DNSSEC —`.

**Blocks / unblocks.** Blocks marketing language and any stronger security
wording. Miscomprehension unblocks copy/UX changes before feature expansion.
Feeds RB-DOH (what the badge should mean).

---

| **Status** | **done** (desk) — research/FINDINGS-POSITIONING.md |#### RB-POSITION — DNS CLI vs provenance / agents pivot

| Field | Value |
| --- | --- |
| **Priority** | P0 |
| **Severity** | Critical (strategy) |
| **Status** | open |
| **Code/docs anchors** | [`ROADMAP.md`](../ROADMAP.md) §7 decision rule, §8 bets 2–3, [`docs/FEATURE-CANDIDATES.md`](FEATURE-CANDIDATES.md) (F03–F05, F33–F34), [`RESEARCH-demand-and-prior-art.md`](../RESEARCH-demand-and-prior-art.md), [`SECURITY.md`](../SECURITY.md) non-goals |

**Research question.** If gates 1, 4, or 6 fail, is the highest-value next form
still a human DNS install CLI—or a verification API / agent-CI policy surface
that one organization can adopt without a publisher network? How does that
compare to leaning on npm provenance/OIDC rather than DNS mappings?

**Method.** After M4 scorecard is filled (or if recruitment stalls early), write
a one-page decision memo: evidence from gates, effort for pivot path A
(`di resolve --json` + CI policy) vs path B (stay DNS CLI + onboarding), and
what non-goals still hold. Do not implement either path until the memo exists.

**Blocks / unblocks.** Blocks roadmap growth bets and large security layers that
only pay off with many publishers. Unblocks RB-NONTTY and RB-SPEC if pivot
toward platform/interop wins.

---

### P1 — Security and code assumptions

| **Status** | **done** — research/FINDINGS-DOH.md |#### RB-DOH — DoH providers, AD bit, multi-resolver

| Field | Value |
| --- | --- |
| **Priority** | P1 |
| **Severity** | High |
| **Status** | open |
| **Code/docs anchors** | [`src/doh.ts`](../src/doh.ts) (`DOH_PROVIDERS`, `do=1`, `authenticated: json.AD === true`, authoritative stop vs fallback), [`src/cli.ts`](../src/cli.ts) (`dnssecBadge`, resolver attempt printing), [`SECURITY.md`](../SECURITY.md), [`ROADMAP.md`](../ROADMAP.md) G3/G6, R4 |

**Research question.** What does the AD bit from Cloudflare/Google DoH actually
guarantee in practice for `_dnstall` TXT lookups? When is multi-provider fallback
safe vs misleading? Is hard-coding two providers acceptable long-term, and what
labeling is required if a system-resolver fallback is ever added?

**Method.** Document provider differences (JSON schema, AD on NXDOMAIN/NODATA,
SERVFAIL handling) with fixture captures. Threat-model: compromised or blocked
provider, split-view DNS, AD=true without client-side validation. Compare to
roadmap G3 options (configurable providers vs opt-in system resolver).

**Blocks / unblocks.** Blocks honest DNSSEC badge semantics and G3 design.
Unblocks any “resolver used” UX and configurable-provider work.

---

| **Status** | **done** (design) — research/FINDINGS-PIN-AND-TOCTOU.md |#### RB-PIN — Pin completeness (publisher / integrity)

| Field | Value |
| --- | --- |
| **Priority** | P1 |
| **Severity** | Critical |
| **Status** | open |
| **Code/docs anchors** | [`src/pin.ts`](../src/pin.ts) (`Pin` fields: `namespace`, `package`, `registry`, `dnsVersion`), [`src/cli.ts`](../src/cli.ts) (`diffPin` / `savePin` on install), [`ROADMAP.md`](../ROADMAP.md) §6 layers 1–2 / G7, [`SECURITY-domain-ownership.md`](../SECURITY-domain-ownership.md) layer 1 |

**Research question.** Which additional pin fields (npm publisher/owner, tarball
integrity SRI, provenance state, DNSSEC-at-pin-time) are necessary to detect the
attacks the design doc cares about, without turning domaininstall into a full
attestation product? What is the minimum schema bump (`STORE_VERSION`) and
migration story?

**Method.** For each candidate field: threat closed, false-positive rate, data
source (npm registry API vs local install metadata), offline behavior, and
whether first-use still has nothing to compare. Prototype schema only on paper
or in a branch; measure impact on pin-diff UX.

**Blocks / unblocks.** Blocks G7 implementation choices. Unblocks RB-TOCTOU
(integrity must be bound at install time) and RB-MAXAGE (what re-verify means).

---

| **Status** | **done** (design) — research/FINDINGS-PIN-AND-TOCTOU.md |#### RB-TOCTOU — Exact version + integrity install

| Field | Value |
| --- | --- |
| **Priority** | P1 |
| **Severity** | High |
| **Status** | open |
| **Code/docs anchors** | [`src/cli.ts`](../src/cli.ts) (resolve → plan → confirm → `runInstall`), [`src/install.ts`](../src/install.ts) (`buildInstallPlan`: `pkg@version` or bare name + `--registry`), [`ROADMAP.md`](../ROADMAP.md) §6 anti-TOCTOU (“resolve once”) |

**Research question.** Roadmap claims resolution is fixed before confirmation and
those values are executed—true for the **mapping**, but the install still hands
npm a possibly **range** version and no integrity pin. What is the residual
TOCTOU window between confirm and tarball fetch (registry mutation, range
resolution drift), and what exact-version + integrity flow is feasible without
re-resolving DNS?

**Method.** Trace the confirmed `InstallPlan` vs what npm may still decide
(`npm install pkg@^x` after publish of a new matching version). Evaluate:
resolve to exact version + integrity before confirm; pass integrity to npm; or
document the residual risk. Prefer designs that keep zero production deps.

**Blocks / unblocks.** Blocks integrity pinning (RB-PIN) and any “what you
confirmed is what installed” marketing. Unblocks a tighter security claim if
the gap can be closed.

---

| **Status** | **done** — research/FINDINGS-SCOPE-AND-PURL.md |#### RB-SCOPE — Scope registries

| Field | Value |
| --- | --- |
| **Priority** | P1 |
| **Severity** | High |
| **Status** | open |
| **Code/docs anchors** | [`src/install.ts`](../src/install.ts) (`npmScopeOf`, `resolveEffectiveRegistry` refuse when `@scope:registry` ≠ default), [`src/cli.ts`](../src/cli.ts) (effective registry for scoped packages), [`ROADMAP.md`](../ROADMAP.md) G1 |

**Research question.** Is permanent refuse the right long-term product for
private/scoped registries, or should the **effective** scope registry be
displayed, pinned, and passed so installs work for org users? What attacks open
if we support it (user-config smuggling, pin confusion across registries)?

**Method.** Enumerate npm precedence rules (`@scope:registry` vs `--registry`).
Design pin keys that include registry host. User research: how many target
publishers need private registries in M4? Write accept/refuse criteria.

**Blocks / unblocks.** Blocks G1 implementation. Unblocks enterprise/agent
adoption if private registries are common among recruits.

---

| **Status** | partial — research/FINDINGS-WINDOWS-AND-SCRIPTS.md; clean VM gate open |#### RB-WIN-NPM — Windows npm launcher + E2E

| Field | Value |
| --- | --- |
| **Priority** | P1 |
| **Severity** | High |
| **Status** | open |
| **Code/docs anchors** | [`src/install.ts`](../src/install.ts) (`resolveNpmLauncher`, Windows `npm-cli.js` path candidates), [`scripts/e2e.ts`](../scripts/e2e.ts) (live E2E; CI is Ubuntu-oriented per roadmap), [`ROADMAP.md`](../ROADMAP.md) §4 outstanding Windows post-publish gate, R7, G11 |

**Research question.** Does the published `0.0.3` artifact perform a real
global/local install on Windows with ranges that would break under `cmd.exe`?
Which launcher discovery paths fail in common Node installers (fnm, nvm-windows,
company images)?

**Method.** Run `docs/RELEASE.md` post-publication verification on a clean
Windows machine; record Node/npm install method, `resolveNpmLauncher` path used,
and install of a domain with a semver range if available. Optionally add a
Windows live E2E job only after manual success is documented.

**Blocks / unblocks.** Blocks calling Windows “fully supported.” Unblocks
closing the 0.0.3 exit gate and de-prioritizing launcher bugs.

---

| **Status** | **done** (design) — research/FINDINGS-NONTTY.md |#### RB-NONTTY — CI / agent JSON mode design

| Field | Value |
| --- | --- |
| **Priority** | P1 |
| **Severity** | High |
| **Status** | open |
| **Code/docs anchors** | [`src/ui.ts`](../src/ui.ts) (`confirm` returns false when `!stdin.isTTY`), [`src/cli.ts`](../src/cli.ts) (`--yes` ignored on pin change), [`src/args.ts`](../src/args.ts), [`ROADMAP.md`](../ROADMAP.md) G4, bets 2–3, [`docs/FEATURE-CANDIDATES.md`](FEATURE-CANDIDATES.md) F03/F05 |

**Research question.** What is a safe non-interactive contract for agents and CI:
stable `di resolve --json` schema, exit codes, and allowlist policy—without
auto-installing on mapping change or teaching bots to pass `--yes` blindly?

**Method.** Draft JSON schema and exit-code table (mapping ok / changed / DNS
failure / pin missing). Threat-model agent misuse. Compare “resolve only” vs
“policy gate around npm.” Align with RB-POSITION before large implementation.

**Blocks / unblocks.** Blocks G4 and agent pivot. Unblocks GitHub Action / MCP
experiments once schema is stable on paper.

---

### P2 — Design de-risk

| **Status** | **done** (defer pre-M4) — research/FINDINGS-RDAP-MAXAGE-FIRSTUSE.md |#### RB-RDAP — Registration liveness

| Field | Value |
| --- | --- |
| **Priority** | P2 |
| **Severity** | Medium |
| **Status** | open |
| **Code/docs anchors** | [`ROADMAP.md`](../ROADMAP.md) G9 / §6 layer 3, [`SECURITY-domain-ownership.md`](../SECURITY-domain-ownership.md) layer 3, no RDAP code in `src/` today |

**Research question.** Can RDAP (or similar) detect re-registration/transfer
reliably enough to fail closed without false positives from privacy proxies and
per-TLD quirks?

**Method.** Survey RDAP availability for common publisher TLDs; prototype
“creation date / updated date changed” checks offline; document failure modes.
Only raise priority when external mappings exist (roadmap R5).

**Blocks / unblocks.** Blocks layer-3 security design. Unblocks ownership-change
hardening after M4.

---

| **Status** | **done** (defer pre-M4) — research/FINDINGS-RDAP-MAXAGE-FIRSTUSE.md |#### RB-MAXAGE — Pin maxAge / re-verification

| Field | Value |
| --- | --- |
| **Priority** | P2 |
| **Severity** | Medium |
| **Status** | open |
| **Code/docs anchors** | [`src/pin.ts`](../src/pin.ts) (`firstSeen` / `lastSeen`, no expiry), [`ROADMAP.md`](../ROADMAP.md) G8 / §6 layer 4, [`SECURITY-domain-ownership.md`](../SECURITY-domain-ownership.md) layer 4 |

**Research question.** What maxAge (or re-confirm cadence) reduces hijack blast
radius without fatiguing users into always typing “yes”?

**Method.** Compare ACME-style short windows vs Go-sum-style permanent pins;
propose defaults and override UX; decide whether expiry forces interactive
confirm only or full re-fetch of registry identity fields (RB-PIN).

**Blocks / unblocks.** Blocks G8. Couples with RB-PIN and RB-TOFU-FIRST.

---

| **Status** | **done** (defer pre-M4) — research/FINDINGS-RDAP-MAXAGE-FIRSTUSE.md |#### RB-TOFU-FIRST — First-use gap

| Field | Value |
| --- | --- |
| **Priority** | P2 |
| **Severity** | Medium (by design for local TOFU) |
| **Status** | open |
| **Code/docs anchors** | [`src/pin.ts`](../src/pin.ts), [`ROADMAP.md`](../ROADMAP.md) G10 / §6 layer 5, [`SECURITY-domain-ownership.md`](../SECURITY-domain-ownership.md) (sumdb / CT analogies) |

**Research question.** Without a transparency log or shared infrastructure, what
mitigations help first-time users (stronger warnings, optional public log, org
allowlists)? Is layer 5 permanently out of scope under the zero-infra stance?

**Method.** Write a short decision: build / partner / never for a mapping log.
For agent/CI pivot, evaluate org-local allowlists as a substitute for global
first-use protection.

**Blocks / unblocks.** Blocks layer-5 investment. Unblocks honest README language
about first install.

---

#### RB-PM — Multi package-manager support

| Field | Value |
| --- | --- |
| **Priority** | P2 |
| **Severity** | Medium |
| **Status** | open |
| **Code/docs anchors** | [`src/install.ts`](../src/install.ts) (`NON_NPM_LOCKFILES`, `detectNpmProject`, npm-only `buildInstallPlan`), [`ROADMAP.md`](../ROADMAP.md) G5 |

**Research question.** For each of pnpm, Yarn, and Bun: is there a
scripts-disabled install path that preserves “show exact command, then run it”
and adversarial argument safety comparable to the Windows npm launcher work?

**Method.** Per-PM: command argv construction, registry override flags, global
install, lockfile detection false positives. Defer implementation until M4
passes and npm path is fully trusted.

**Blocks / unblocks.** Blocks G5. Unblocks multi-PM roadmap only after demand.

---

| **Status** | **done** — research/FINDINGS-SCOPE-AND-PURL.md |#### RB-PURL — purl boundaries

| Field | Value |
| --- | --- |
| **Priority** | P2 |
| **Severity** | Medium |
| **Status** | open |
| **Code/docs anchors** | [`src/record.ts`](../src/record.ts) (`pkg:` purl parse; qualifiers/subpath dropped; legacy `/npm/...` form), [`src/validate.ts`](../src/validate.ts) (namespace/package rules), [`ROADMAP.md`](../ROADMAP.md) bet 5 (other ecosystems) |

**Research question.** Which purl features must be rejected vs ignored vs
supported for a future multi-ecosystem world (qualifiers, subpath, non-npm
types)? How strict should unknown namespaces be?

**Method.** Compare current parser behavior to package-url / ECMA-427 examples;
list breaking changes if a standalone spec freezes the format (RB-SPEC).

**Blocks / unblocks.** Blocks multi-ecosystem promises and spec freezes.

---

#### RB-TXT — TXT multi-string and parsing edges

| Field | Value |
| --- | --- |
| **Priority** | P2 |
| **Severity** | Medium |
| **Status** | open |
| **Code/docs anchors** | [`src/doh.ts`](../src/doh.ts) (`normalizeTxtData`), [`src/record.ts`](../src/record.ts) (record parse, conflict detection), historical notes in [`RESEARCH.md`](../RESEARCH.md) / [`NOTES.md`](../NOTES.md) |

**Research question.** Are all realistic registrar/DoH encodings of long or
quoted TXT values handled, and do conflicting multi-record sets always fail
closed as intended?

**Method.** Fixture matrix: multi-string concatenation, escaped quotes,
duplicate keys, multiple `dnstall=` records, whitespace. Cross-check Cloudflare
vs Google JSON `data` shapes.

**Blocks / unblocks.** Blocks confidence in publisher guide examples. Couples
with RB-GATE2 stuck points.

---

#### RB-CNAME — CNAME / delegated subdomain takeover

| Field | Value |
| --- | --- |
| **Priority** | P2 |
| **Severity** | High (threat) / Medium (near-term exposure) |
| **Status** | open |
| **Code/docs anchors** | [`src/validate.ts`](../src/validate.ts) / [`src/cli.ts`](../src/cli.ts) (subdomain targets → `_dnstall.<sub>.<domain>`), [`SECURITY-domain-ownership.md`](../SECURITY-domain-ownership.md) (CNAME takeover discussion), [`README.md`](../README.md) sub-package docs |

**Research question.** How should publisher guidance treat CNAME delegation of
`_dnstall` or multi-package subdomains, given dangling-DNS takeover risk?

**Method.** Document recommended record layout (apex TXT vs delegated zone);
add takeover checklist to publisher guide; decide if the CLI should warn on
unexpected resolution patterns (if detectable over DoH JSON).

**Blocks / unblocks.** Blocks safer multi-package deployment advice.

---

| **Status** | **done** (doc) — research/FINDINGS-WINDOWS-AND-SCRIPTS.md |#### RB-WIN-PIN — Windows trust-store guarantees

| Field | Value |
| --- | --- |
| **Priority** | P2 |
| **Severity** | Medium |
| **Status** | open |
| **Code/docs anchors** | [`src/pin.ts`](../src/pin.ts) (`IS_WINDOWS`, ACL/no-follow comments, atomic replace + lock), [`SECURITY.md`](../SECURITY.md) trust store notes, [`ROADMAP.md`](../ROADMAP.md) G11 |

**Research question.** What residual Windows threats remain (reparse points,
shared profiles, non-owner ACL inheritance) after current mitigations, and is
G11 closable without new Node primitives?

**Method.** Threat-model against documented behavior; test symlink/junction
rejection; decide accept residual vs document-only.

**Blocks / unblocks.** Blocks G11. Couples with RB-WIN-NPM platform story.

---

| **Status** | **done** — research/FINDINGS-WINDOWS-AND-SCRIPTS.md |#### RB-SCRIPTS — Lifecycle scripts disabled

| Field | Value |
| --- | --- |
| **Priority** | P2 |
| **Severity** | Medium |
| **Status** | open |
| **Code/docs anchors** | [`src/install.ts`](../src/install.ts) (`--ignore-scripts` in `buildInstallPlan`), [`README.md`](../README.md), [`SECURITY.md`](../SECURITY.md) |

**Research question.** Which popular packages break under `--ignore-scripts`, and
what recovery path should docs recommend without re-enabling scripts by default?

**Method.** Sample high-traffic packages that need `postinstall` (native addons).
Document user recovery (`npm rebuild`, explicit script review). Decide if global
CLI installs need different defaults.

**Blocks / unblocks.** Blocks UX surprises during M4 usage diary (gate 5).

---

#### RB-META — Optional record metadata

| Field | Value |
| --- | --- |
| **Priority** | P2 |
| **Severity** | Low–Medium |
| **Status** | open |
| **Code/docs anchors** | [`src/record.ts`](../src/record.ts) (RFC 1464 `key=value` metadata; unknown keys kept), [`src/cli.ts`](../src/cli.ts) (displays `repo` if present), [`src/terminal.ts`](../src/terminal.ts) (sanitization) |

**Research question.** Which metadata keys are display-only vs security-relevant?
Should unknown keys stay ignored forever, or can malicious metadata social-engineer
users (fake repo URLs)?

**Method.** Inventory displayed fields; check sanitization coverage; propose
allowlist for keys shown in preview vs silently ignored.

**Blocks / unblocks.** Blocks rich-metadata features and RB-SPEC key registry.

---

| **Status** | partial — research/FINDINGS-WINDOWS-AND-SCRIPTS.md |#### RB-GLOBAL — Global install safety

| Field | Value |
| --- | --- |
| **Priority** | P2 |
| **Severity** | Medium |
| **Status** | open |
| **Code/docs anchors** | [`src/args.ts`](../src/args.ts) (`-g` / `--global`), [`src/install.ts`](../src/install.ts) (`resolveNpmGlobalPrefix`, plan flags), [`src/cli.ts`](../src/cli.ts) (`installTargetDescription`) |

**Research question.** Does showing npm’s global prefix sufficiently prevent
surprise installs into the wrong prefix, and are multi-user / elevated Windows
global installs an acceptable risk for a domain-mapped CLI tool?

**Method.** Map prefix resolution across OS/user configs; document failure modes
when `prefix` is misconfigured; decide extra confirmations for `-g`.

**Blocks / unblocks.** Blocks global-install UX polish and agent use of `-g`.

---

#### RB-NPMCONFIG — npm config diversion surfaces

| Field | Value |
| --- | --- |
| **Priority** | P2 |
| **Severity** | High (class of bug) |
| **Status** | open |
| **Code/docs anchors** | [`src/install.ts`](../src/install.ts) (`npmConfigGet`, registry HTTPS validation, scope registry refuse), [`SECURITY.md`](../SECURITY.md) (registry smuggling class) |

**Research question.** Beyond `@scope:registry`, which npm config keys can still
make the installed bits differ from the preview (e.g. `omit`, `before`, custom
CA, proxy, replace-registry packs)? What must be read, displayed, or refused?

**Method.** Review npm config that affects `install` resolution; classify
display / pin / refuse. Add adversarial tests for any new checks.

**Blocks / unblocks.** Blocks residual “shown ≠ installed” bugs after G1.

---

#### RB-SPEC — Standalone `_dnstall` record specification

| Field | Value |
| --- | --- |
| **Priority** | P2 |
| **Severity** | Medium (interop) |
| **Status** | open |
| **Code/docs anchors** | [`src/record.ts`](../src/record.ts), [`README.md`](../README.md) record format, [`ROADMAP.md`](../ROADMAP.md) bet 4 / 1.0 item 3, [`docs/FEATURE-CANDIDATES.md`](FEATURE-CANDIDATES.md) F06 |

**Research question.** What must a versioned, implementation-independent
`_dnstall` TXT spec include (grammar, conflict rules, purl profile, metadata
registry) so other tools can implement it without reading this repo?

**Method.** Extract normative rules from `record.ts` + README; mark
implementation-defined behavior; draft a short spec only after M4 or an explicit
interop need (agent API). Coordinate with RB-PURL and RB-META.

**Blocks / unblocks.** Blocks treating the format as a multi-tool convention.
Unblocks third-party resolvers once published.

---

## Stale assumptions watchlist

Historical docs predate final naming and some shipped behavior. Use this table
when reading old material; do not “fix” historical files—update code, roadmap,
or this backlog instead.

| Assumption in historical docs | Current reality (verify in code/roadmap) | Why it matters |
| --- | --- | --- |
| Command / record names `dpm`, `_dpm`, `dpm=/npm/...` | CLI is `di`; record is `_dnstall` + `dnstall=` with purl preferred (`pkg:npm/...`) | Copy-paste from `RESEARCH.md` / `SECURITY-domain-ownership.md` / early `NOTES.md` will produce wrong DNS |
| DNSSEC end-to-end validation via `@relaycorp/dnssec` planned soon | Badge uses DoH **AD bit** only (`src/doh.ts`); not client-side chain validation | Overstates authenticity; RB-DOH / RB-GATE6 |
| Full pin identity (publisher, integrity, registration date) in Phase 0 | Pins are `namespace`, `package`, `registry`, `dnsVersion` only (`src/pin.ts`) | Design doc layers ≠ shipped layers; see roadmap §6 |
| Multi-PM via `package-manager-detector` / `nypm` | npm-only; non-npm lockfiles refused (`src/install.ts`) | Feature research must not assume multi-PM exists |
| System resolver or many DoH providers | Two hard-coded DoH URLs; no system fallback | G3 still open; R4 |
| Windows via `npm.cmd` / shell | Windows uses Node + `npm-cli.js`, `shell: false` | Old shell-injection notes may be outdated; still verify RB-WIN-NPM |
| Machine-readable / non-TTY install path | Non-TTY confirm = no; `--yes` skips only when pin unchanged | Agents cannot integrate safely yet; RB-NONTTY |
| “Ignore invalid records and continue” (DNSLink-style) | Conflicting mappings refuse; bad trust state fails closed | Ownership signals must not inherit DNSLink looseness |
| Live E2E proves all platforms | Deterministic tests multi-OS; live E2E Ubuntu-centric; Windows post-publish gate open | Do not treat CI green as Windows install proof |
| External adoption underway | Roadmap: zero external mappings; M4 kit ready, human gates not passed | Engineering priority still subordinate to validation |
| Provenance / malware scanning as product direction | Explicit non-goals in roadmap and `SECURITY.md` | Scope creep vs RB-POSITION |

---

## Suggested order of attack

### Done (desk / local) — 2026-08-04

Kit dry-run, positioning, DoH, pin/TOCTOU design, scope/purl, non-TTY design,
RDAP/maxAge/first-use deferral, Windows probe + partial publish verify, DNSSEC
badge reword (`DNSSEC: AD` / `DNSSEC: no AD`).

### Remaining — needs humans or clean hardware

1. **RB-GATE1** — outreach using [PROSPECT-CANDIDATES.md](m4/PROSPECT-CANDIDATES.md); log in CONTACT-TRACKER.
2. **RB-GATE2** — unassisted setup timing as soon as first publishers try.
3. **RB-GATE6** — run comprehension instrument (badge probe included in design).
4. **RB-WIN-NPM** — clean Windows VM full RELEASE.md checklist; then tick ROADMAP §4.
5. Gates 3–5 (placement, discovery study, usage diary) once mappings exist.
6. **RB-NPMCONFIG** / **RB-TXT** / **RB-CNAME** / **RB-META** / **RB-PM** / **RB-SPEC** — only if M4 continues CLI growth or pivot needs them.
7. Implement (later, not research): pin v2 + exact integrity install; `di resolve --json` per FINDINGS-NONTTY if pivot or bet 2 wins.

---

## Related documents

| Document | Role |
| --- | --- |
| [`docs/research/README.md`](research/README.md) | Index of executed findings |
| [`docs/m4/PROSPECT-CANDIDATES.md`](m4/PROSPECT-CANDIDATES.md) | Gate 1 candidate shortlist (not contacted) |
| [`ROADMAP.md`](../ROADMAP.md) | Live status, gaps G1–G11, M4 gates, growth bets |
| [`SECURITY.md`](../SECURITY.md) | Threat model, claim boundary, reporting |
| [`SECURITY-domain-ownership.md`](../SECURITY-domain-ownership.md) | Design research for expiry / transfer / repoint (historical examples) |
| [`docs/m4/README.md`](m4/README.md) | Milestone 4 product-validation kit index |
| [`docs/FEATURE-CANDIDATES.md`](FEATURE-CANDIDATES.md) | Feature inventory (implementation candidates, not research status) |
| [`README.md`](../README.md) | User-facing behavior and limits |
| [`RESEARCH.md`](../RESEARCH.md), [`NOTES.md`](../NOTES.md), [`RESEARCH-demand-and-prior-art.md`](../RESEARCH-demand-and-prior-art.md) | Frozen historical research |

---

*Last updated: 2026-08-04. All research items above are **open** until evidence is recorded and status is changed.*
