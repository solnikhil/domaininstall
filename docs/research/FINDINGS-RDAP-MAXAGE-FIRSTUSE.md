# Design memo: RDAP, pin maxAge, and first-use (pre-M4)

**Date:** 2026-08-04  
**Scope:** Short design decision memo from existing research and roadmap — **no product code**.  
**Anchors:** [`ROADMAP.md`](../../ROADMAP.md) G8 / G9 / G10 and §6 layers 3–5, [`SECURITY-domain-ownership.md`](../../SECURITY-domain-ownership.md), [`docs/FEATURE-CANDIDATES.md`](../FEATURE-CANDIDATES.md) F17–F19, [`docs/FEATURE-RESEARCH-REPORT.md`](../FEATURE-RESEARCH-REPORT.md), [`docs/RESEARCH-BACKLOG.md`](../RESEARCH-BACKLOG.md) RB-RDAP / RB-MAXAGE / RB-TOFU-FIRST, [`src/pin.ts`](../../src/pin.ts).

---

## 1. RDAP feasibility (summary)

**Intent (design docs):** At pin time and on re-verify, query RDAP for registration signals — especially **creation date moved** (re-registration after expiry) — and block / force re-confirm when liveness identity drifts. Also discussed: expiry window, nameserver set, transfer-related EPP status.

**What is realistic:**

| Point | Assessment |
| --- | --- |
| Signal quality | **Creation date change** is the high-signal re-registration cue when present and stable |
| Protocol | RDAP is structured JSON and preferable to scraping WHOIS |
| Industry use | Uptime / brand monitors poll RDAP for expiry, EPP locks, registrar/NS drift — not for package safety |
| Fit to domaininstall | Orthogonal layer: helps **domain continuity after first pin**, not npm malware or first-sight mapping truth |

**What makes it a poor pre-M4 build:**

| Risk | Implication for a CLI default |
| --- | --- |
| Per-TLD / ccTLD coverage gaps | Cannot fail closed universally; soft-fail “unknown” dominates |
| Privacy redaction (post-GDPR) | Cannot bind to stable registrant identity; missing fields ≠ safe |
| Rate limits and endpoint churn | Extra network dependency on every install/verify; outage UX |
| Privacy proxies / thin Whois | Masked fields → false “unknown” or missed re-reg |
| Hijack without re-reg | Registrar/DNS account takeover may leave creation date unchanged |
| Maintenance cost | High vs single-maintainer alpha; competes with Oh Dear-class monitors |
| Product sequencing | ROADMAP R5 / demand probes: raise priority only when **external** mappings exist |

**Feasibility verdict:** RDAP is a **plausible later layer** for returning-user re-registration detection, not a ship-now control. Implementation, if ever, should:

- Prefer **diff against pin-time snapshot** over absolute WHOIS identity  
- Treat missing/unparseable RDAP as **unknown** (warn or soft policy), never as silent trust  
- Stay out of the critical path until publisher supply and M4 gates justify the complexity  

**Stance remains:** F18 / G9 = **LATER** (post external mappings + demand), not alpha work.

---

## 2. Pin maxAge — recommended default (if any)

**Current code:** Pins store `firstSeen` / `lastSeen` only. **No expiry.** Continuity diffs still run every install on namespace / package / registry / dnsVersion.

**Why maxAge exists in the design:** ACME-style short trust windows reduce “stale forever” risk if the mapping string is unchanged but underlying ownership flipped in ways Layer-2 fields miss.

**Coupling:** Age-only re-prompts without stronger signals (especially RDAP / richer pins) risk **re-confirm theater**: users type “yes” because nothing visible changed. Feature research demand probes prefer **age + RDAP** over age alone.

**Recommended default for product code today:**

| Option | Recommendation |
| --- | --- |
| Ship a numeric default maxAge (e.g. 30 / 90 days) | **No — not pre-M4** |
| Document a “likely future default” for design | **Optional only as research:** 90 days is a common “human re-attention” ballpark if Layer-2 stays thin; **do not** commit in code or user docs as policy |
| Gate implementation | After pin UX (list/forget), real multi-use users, and ideally alongside or after a liveness signal so re-verify is meaningful |

**If maxAge ever ships (post-demand):**

- Default should force **interactive** re-confirm for humans; CI/agent paths need an explicit policy mode (ties to G4 / resolve-json work)  
- Prefer re-fetch of **security-relevant pin fields**, not a no-op “touch lastSeen”  
- Avoid sub-week defaults that train users to auto-approve  

**Stance remains:** F17 / G8 = **LATER**. **No maxAge default in the product pre-M4.**

---

## 3. First-use options

**Problem (G10):** Local TOFU protects **returning** clients with durable state. The **first** successful install has nothing to compare; ephemeral CI is “trust on every use” unless state is pre-seeded.

**Options:**

| Option | Description | Pros | Cons |
| --- | --- | --- | --- |
| **A. Do nothing** | Keep honest README/SECURITY language; no new infra or heuristics | Matches zero-infra stance; no false assurance; no phone-home | Residual first-sight risk remains (already accepted) |
| **B. Heuristics** | e.g. warn if package is brand-new on npm, domain age unknown, typosquat scores | Might scare some bad cases | High false positives; expands claim surface; not continuity; maintenance |
| **C. Optional log** | Community first-seen transparency log (sumdb-like) | Classic fix for shared first observation | Infra + operator + gossip; sticky bad first entries; F19 panel score negative; conflicts with single-maintainer zero-infra |

**Recommendation for pre-M4: Option A — do nothing** beyond existing documentation.

Rationale:

1. Transparency log (Layer 5 / F19) is **NEVER / DEFER** without a host partner; unmonitored logs are forensics theater.  
2. Heuristics blur the narrow claim (“continuity of domain→package declaration”) into malware/typosquat scanning (non-goal).  
3. Higher-leverage first-use substitutes for agents/CI are **org allowlists** and non-interactive `resolve` policy — post M4 pivot paths — not a global log.  
4. Shipping fake confidence (badge, soft block, phone-home) before external publishers exist optimizes the wrong side of a two-sided market.

**Comprehension duty (already in product docs):** first use is user-judged; TOFU starts after the first successful pin. Keep saying that; do not invent a half-log.

---

## 4. Pre-M4 decision table

| Topic | Gap | Pre-M4 decision |
| --- | --- | --- |
| RDAP liveness | G9 / Layer 3 | **Do not build.** Feasible later as pin-snapshot diff; demand + external maps first |
| Pin maxAge | G8 / Layer 4 | **Do not ship a default.** No code expiry; optional design note only |
| First-use protection | G10 / Layer 5 | **Do nothing** (no heuristics, no optional log product) |

**Revisit when:** M4 publisher / correctness / comprehension gates allow continued CLI investment **and** external multi-use pins exist **and** demand probes for F17/F18 (and only with partners for F19) clear their thresholds.

---

## 5. One-line summary

**Pre-M4: no RDAP, no maxAge default, no first-use log or heuristics — document limits, keep Layer-2 TOFU, invest in publisher validation instead.**
