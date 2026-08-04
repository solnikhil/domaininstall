# Findings — M4 kit maintainer dry-run

**Date:** 2026-08-04  
**Role:** Maintainer walking `docs/m4/*` as if starting the quiet beta **today**, without inventing contacts or results.  
**Authority:** `ROADMAP.md` §7; kit index `docs/m4/README.md`.

---

## Verdict

| Dimension | Status | Evidence |
| --- | --- | --- |
| **Kit readiness (materials)** | **Partial → mostly ready** | All protocol docs exist and cross-link; publisher guide is complete enough for unassisted setup; outreach templates and scorecard shells are filled out as templates. |
| **Human-gate readiness** | **Not started** | Tracker empty (control only); RESULTS unscored; zero external mappings (ROADMAP §2). |
| **Measurement-study readiness (gates 4–6)** | **Partial** | Instruments exist; discovery **stimulus cards incomplete** for half the task bank; no prospect list, no scheduled participants. |
| **Can start outreach this week?** | **Yes**, after pre-flight checks below | Day-0 items are mostly local/docs; blocking item is **building a real ≥20 qualified prospect list** (human research, not kit writing). |

**Mark the kit: PARTIAL (materials ~90%; execution 0%).** Safe to run gate 1–3 process; gates 4–6 need card completion + recruitment of participants.

---

## Walkthrough by document

### `docs/m4/README.md`

- Clear purpose: product validation, not features.
- Index table links to all nine kit files — **all targets exist**.
- Link to `ROADMAP.md#7-milestone-4--product-validation` — GitHub slug form looks consistent with heading “7. Milestone 4 — product validation.”
- Process order is correct: recruit → onboard → place → measure → runbook → score.
- **No broken local links** found in this file.

### `docs/m4/RUNBOOK.md`

- Non-negotiables match roadmap (no launch, no CLI expansion to “pass” M4, no padding friends).
- Day-0 pre-flight is actionable.
- Week 1/2 cadence is realistic for a single maintainer.
- Roadmap update instructions are concrete.
- **Gap:** Assumes a prospect list exists by day 2–4; kit does not include a sourcing spreadsheet beyond empty tracker rows 1–20.
- **No broken links** to OUTREACH / CONTACT-TRACKER / PUBLISHER-GUIDE.

### `docs/m4/PUBLISHER-GUIDE.md`

- Strong unassisted guide: format, steps, Cloudflare/Namecheap/Squarespace/Route53/GoDaddy, GitHub Pages edge cases, scoped packages, sub-packages, failure table.
- Live reference `zuraai.xyz` documented.
- Claim boundaries repeated.
- Links to `SECURITY.md`, `README.md`, `ROADMAP.md`, `PLACEMENT-SNIPPETS.md` — **valid relative paths**.
- **Honest limit:** No `di setup` (called out). Gate 2 friction remains registrar UX + propagation — guide mitigates, does not eliminate.
- **Minor:** Google Domains → Squarespace note may age; still useful.

### `docs/m4/OUTREACH.md`

- Qualification/exclusion criteria are strict enough to prevent padding.
- Email + follow-up + DM templates include **narrow claim**.
- Ethics section is solid.
- Sourcing ideas are methods-only (correct — no fake names).
- Link to publisher guide on GitHub uses `solnikhil/domaininstall` — matches README clone URL.
- **Empty readiness:** No actual contact list; “20 contacted” cannot start until maintainer fills prospects.

### `docs/m4/CONTACT-TRACKER.md`

- **Scoreboard: all zeros.** Last updated 2026-08-04: “no external outreach sent yet.”
- Row 0 control `zuraai` present and correctly excluded from external counts.
- Rows 1–20 are blank shells with `pending` — **empty tracker readiness: ready as template, not as evidence.**
- Column definitions are clear.

### `docs/m4/PLACEMENT-SNIPPETS.md`

- Short/long README sections + static shields + “what not to write” table.
- Honest claim badge preferred — good for gate 6.
- Links to PUBLISHER-GUIDE, README, SECURITY — **valid**.
- **Depends on** live external mappings before gate 3 can score — materials ready, placements not.

### `docs/m4/DISCOVERY-PROTOCOL.md`

- Design is rigorous for a quiet beta (within-subjects, thresholds, stop rules).
- Task bank T1–T12 listed with keys.
- **Broken / incomplete materials:**
  - Full stimulus cards only for **T1, T2, T3, T5, T9, T12**.
  - Line ~368: *“Cards for T4, T6, T7, T8, T10, T11 follow the same template…”* — **not written**. Counterbalancing table uses T1–T6 for the 6×6 plan, so **T4 and T6 are required** and incomplete as printable cards.
  - Mock verify output format **does not match live CLI** (`src/cli.ts` verify prints resolver/outcome/raw TXT/pin lines, not the simplified card layout). Acceptable for SIM if labeled; LIVE prefers real CLI — OK, but card vs live discrepancy may confuse runners.
- Consent/debrief/copy are ready.
- **Gate 4 cannot be run at full fidelity until T4/T6 (at minimum) cards are filled.**

### `docs/m4/USAGE-DIARY.md`

- Definitions for external user / successful use / repeat user are careful and anti-padding.
- Diary template + interview questions ready.
- No telemetry by design — correct for alpha.
- **Empty:** running tally at 0; needs real users after supply or discovery sessions.

### `docs/m4/COMPREHENSION.md`

- Critical set C1–C3 matches product claim; scoring rule clear.
- Debrief script excellent for failed mental models.
- Links/logic to RESULTS and ROADMAP sound.
- **DNSSEC over-read** only appears as a distractor in C3 (option C), not as a dedicated item — research backlog RB-GATE6 still open; optional probe recommended in `FINDINGS-POSITIONING.md`.
- **Not runnable until** participants exist with README + verify exposure.

### `docs/m4/RESULTS.md`

- Scorecard structure complete.
- Overall status already marked: **In progress (kit ready; human gates incomplete)** — accurate.
- All Actual fields blank — **empty tracker readiness for scoring: template only.**
- Decision checklist empty — correct.

---

## Broken links and doc defects

| Issue | Severity | Notes |
| --- | --- | --- |
| Discovery cards T4, T6, T7, T8, T10, T11 not written | **High** for gate 4 | T4/T6 needed for recommended 6-task plan |
| CONTACT-TRACKER / RESULTS empty | Expected | Not a link bug; human gate not started |
| Mock verify cards ≠ live `di verify` layout | Low | Document intentional simplification; prefer live for T1 |
| ROADMAP anchor `#7-...` | Low | Depends on GitHub heading slug; path `../../ROADMAP.md` is fine |
| No `docs/research/` was present before this research pass | N/A | Created by research outputs |
| Cross-links inside `docs/m4/` | OK | Spot-checked relative paths resolve to existing files |
| OUTREACH GitHub blob URLs | OK | Match public repo path `docs/m4/PUBLISHER-GUIDE.md` |

No missing kit **files** relative to README index. Completeness issue is **content depth** (discovery cards) and **execution data** (tracker/results).

---

## Missing steps (to go from “kit on disk” to “beta running”)

1. Confirm live reference: `di verify zuraai.xyz` and clean global install of published version.
2. Build **≥20 qualified prospects** (OUTREACH criteria) into CONTACT-TRACKER rows 1–20.
3. Set beta window dates in RUNBOOK + RESULTS.
4. Feature freeze commitment (personal checklist).
5. Send outreach; log same day.
6. For gate 2: capture setup minutes + unassisted Y/N without editing their DNS.
7. For gate 3: offer PLACEMENT-SNIPPETS only after mapping live.
8. **Finish discovery cards T4 and T6** (and preferably T7–T11) before day 11–12 studies.
9. Recruit ≥6 discovery participants / ≥10 comprehension completers.
10. Score RESULTS; apply decision rule; update ROADMAP §2/§7.

---

## Pre-flight checklist

Checkboxes for the maintainer. **Bold = can be done without external humans.**

### Local / product truth

- [ ] **Confirm reference mapping:** `di verify zuraai.xyz` succeeds (mapping to `zuraai`).
- [ ] **Confirm published install:** clean env `npm install --global domaininstall@0.0.3` (or current `latest`) works.
- [ ] **Confirm Node requirement:** Node ≥ 22.14 on machines you’ll use for demos.
- [ ] **Re-read publisher guide against live verify output** — fix any drift in field names/messages (**docs only**).
- [ ] **Optional:** `npm test` / `npm run test:e2e` green so verify isn’t broken mid-beta.

### Kit integrity (no external humans)

- [ ] **CONTACT-TRACKER scoreboard zeroed; row 0 control present** (already true as of 2026-08-04).
- [ ] **RESULTS beta window fields set** (dates can be chosen alone).
- [ ] **Complete discovery cards for T4 and T6** (and ideally T7, T8, T10, T11) using the existing template.
- [ ] **Print or export** control vs treatment packets + runner keys.
- [ ] **Copy diary template** to a private notes location (do not commit personal emails).
- [ ] **Comprehension form** ready (strip answer key for participants).
- [ ] **Personal freeze list:** allowed work = outreach, publisher-doc fixes, verify bugs, tracker — nothing else.
- [ ] **Commitment: no HN/Reddit/Lobsters launch** during the window.
- [ ] **Update ROADMAP §2** M4 line to “in progress” with start date when window opens (**docs**).

### Requires external humans (cannot fake)

- [ ] Draft ≥20 **named** qualified prospects with domain + package + channel.
- [ ] Send first-wave outreach (gate 1 contacted count).
- [ ] Receive setups / live external mappings (gate 1 live count, gate 2).
- [ ] README placements on other projects (gate 3).
- [ ] Discovery participants and scored trials (gate 4).
- [ ] Usage diaries / interviews (gate 5).
- [ ] Comprehension completers after real exposure (gate 6).
- [ ] Fill RESULTS Actual columns from evidence only.
- [ ] Apply continue vs pivot; update ROADMAP.

### Optional engineering (only if measurement blocker)

- [ ] Windows post-publish verify (ROADMAP §4) — **not required to start M4 recruitment**, but do not pretend Windows E2E is done.
- [ ] Do **not** implement growth bets (`di setup`, resolve --json, allowlist) to “make M4 pass” unless verify itself is broken.

---

## Gate-by-gate readiness

| Gate | Materials | Data | Blocker |
| --- | --- | --- | --- |
| 1 Publisher | OUTREACH + tracker **ready** | 0 contacted, 0 external maps | Human prospecting + outreach |
| 2 Unassisted setup | PUBLISHER-GUIDE **ready** | 0 samples | Needs gate 1 converts |
| 3 Placement | PLACEMENT-SNIPPETS **ready** | 0 placements | Needs live external maps |
| 4 Discovery | Protocol **partial** (cards incomplete) | 0 trials | Finish T4/T6 cards + participants |
| 5 Usage | Diary protocol **ready** | 0 users | Needs real external use |
| 6 Comprehension | Instrument **ready** | 0 completers | Needs exposure + people |

---

## What “kit ready” meant in ROADMAP vs this dry-run

ROADMAP §7 marks kit checkboxes for guides/templates/instruments as **[x]** and human thresholds as **[ ]**. That is **correct** for “documents exist.”

This dry-run adds nuance:

- **Publisher path (gates 1–3):** materials are **ready** for use.
- **Study path (gates 4–6):** protocols are **ready**, but gate 4 **artifacts are incomplete** (missing cards).
- **Execution:** **not ready** until prospects exist and pre-flight local checks pass.

---

## Recommended next 48 hours (maintainer-only)

1. Run pre-flight local truth checks (verify + clean install).
2. Write T4 and T6 full stimulus cards into `DISCOVERY-PROTOCOL.md` (or a `docs/m4/cards/` appendix).
3. Build prospect list offline (20 rows) without sending yet.
4. Set beta dates; freeze features; then send wave 1.

Do **not** expand CLI. Do **not** count `zuraai.xyz` as external. Do **not** lower thresholds.

---

## Summary mark

```text
M4 kit: PARTIAL
  - Docs/templates: strong
  - Discovery cards: incomplete (T4/T6+ missing full cards)
  - Tracker/RESULTS: empty (expected)
  - Human gates: not started
  - Ready to recruit: YES after local pre-flight + prospect list
  - Ready to claim M4 pass: NO
```
