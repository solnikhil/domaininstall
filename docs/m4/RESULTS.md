# Milestone 4 — Validation scorecard

Quiet beta results for domaininstall. Fill **Actual** columns as evidence lands. Do not mark **Pass** until thresholds are met with definitions in the protocol docs and [ROADMAP.md](../../ROADMAP.md).

| Field | Value |
| --- | --- |
| Beta window | ____-__-__ → ____-__-__ |
| Runner | |
| CLI version(s) tested | |
| Scorecard last updated | |
| Protocols | [DISCOVERY-PROTOCOL.md](./DISCOVERY-PROTOCOL.md) · [USAGE-DIARY.md](./USAGE-DIARY.md) · [COMPREHENSION.md](./COMPREHENSION.md) |

---

## Decision rule (from ROADMAP)

If the **publisher** (Gate 1), **correctness** (Gate 4), or **comprehension** (Gate 6) gates **fail**, do **not** expand the CLI. Pivot toward an agent/CI policy tool or verification API (fewer publishers required).

Gates 2, 3, and 5 inform severity and sequencing but the written decision rule singles out 1, 4, and 6 as hard stops on CLI expansion.

---

## Gate summary

| # | Gate | Threshold | Actual | Pass / Fail / Incomplete | Date scored | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Publisher recruitment | 20 qualified npm maintainers contacted; ≥5 external mappings live | Contacted: ___ / 20<br>Live external mappings: ___ / 5 | | | |
| 2 | Unassisted setup | ≥4 of 5 publishers complete setup without maintainer editing DNS; median setup time ≤10 minutes | Completions: ___ / 5<br>Median minutes: ___ | | | |
| 3 | Documentation placement | ≥3 real README / install-doc placements | Placements: ___ / 3 | | | |
| 4 | Discovery correctness | ≥30 counterbalanced task-trials; treatment accuracy ≥90%; improvement ≥20 pp over control | Trials: ___ / 30<br>A_T: ___%<br>A_C: ___%<br>Δ: ___ pp | | | See § Gate 4 detail |
| 5 | Usage | ≥10 external users; ≥25 successful uses; ≥5 repeat users | Users: ___ / 10<br>Uses: ___ / 25<br>Repeat: ___ / 5 | | | See § Gate 5 detail |
| 6 | Comprehension | ≥80% pass critical item set (mapping ≠ package safety) | Completers: ___<br>Comprehend: ___<br>Rate: ___% | | | See § Gate 6 detail |

**Overall M4 status:** ☐ Not started · ☑ In progress (kit ready; human gates incomplete) · ☐ Complete — continue CLI · ☐ Complete — pivot · ☐ Incomplete (stopped early)

---

## Gate 1 — Publisher recruitment

| Metric | Threshold | Actual | Notes |
| --- | --- | --- | --- |
| Qualified maintainers contacted | ≥20 | | Criteria used: |
| External mappings live | ≥5 | | List domains (public): |
| Contact channel mix | — | | e.g. email / GH issue / social |
| Refusals / no response | — | | |

**Outcome:** ☐ Pass · ☐ Fail · ☐ Incomplete  
**Date:**  
**Evidence links / issue refs:**  

---

## Gate 2 — Unassisted setup

| Metric | Threshold | Actual | Notes |
| --- | --- | --- | --- |
| Publishers in setup sample | 5 attempted | | |
| Completed without maintainer DNS edits | ≥4 | | |
| Median setup time | ≤10 minutes | | Definition of start/stop: |
| Registrar mix | — | | |
| Failure modes | — | | propagation / UI / TXT format / other |

**Outcome:** ☐ Pass · ☐ Fail · ☐ Incomplete  
**Date:**  
**Evidence:**  

---

## Gate 3 — Documentation placement

| # | Project / repo | URL or path to README/install docs | `di` / domaininstall mentioned? | Date live |
| --- | --- | --- | --- | --- |
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| … | | | | |

| Metric | Threshold | Actual |
| --- | --- | --- |
| Real placements | ≥3 | |

**Outcome:** ☐ Pass · ☐ Fail · ☐ Incomplete  
**Date:**  
**Notes:**  

---

## Gate 4 — Discovery correctness

Protocol: [DISCOVERY-PROTOCOL.md](./DISCOVERY-PROTOCOL.md)

| Metric | Threshold | Actual |
| --- | --- | --- |
| Design | Within-subjects counterbalanced (or noted fallback) | |
| Scored task-trials | ≥30 | |
| Treatment trials | — | |
| Control trials | — | |
| Treatment accuracy \(A_T\) | ≥90% | |
| Control accuracy \(A_C\) | — | |
| Improvement \(\Delta = A_T - A_C\) | ≥20 pp | |
| Participants | — | |
| LIVE task degradations (mock fallback) | — | |
| Protocol deviations | — | |

**Primary result:** both \(A_T \geq 90\%\) and \(\Delta \geq 20\) pp required to pass.

**Outcome:** ☐ Pass · ☐ Fail · ☐ Incomplete  
**Date:**  
**Notes / CI for accuracy (optional):**  
**Raw data location (private):**  

---

## Gate 5 — Usage

Protocol: [USAGE-DIARY.md](./USAGE-DIARY.md)

| Metric | Threshold | Actual |
| --- | --- | --- |
| External users (≥1 success each) | ≥10 | |
| Successful uses | ≥25 | |
| — of which verify | — | |
| — of which install-path | — | |
| Repeat users | ≥5 | |
| Anecdote-sourced uses (subset) | use with care | |
| Maintainer-only uses (excluded) | — | |

**Outcome:** ☐ Pass · ☐ Fail · ☐ Incomplete  
**Date:**  
**Notes:**  
**Privacy check:** ☐ No pin files collected without consent  

---

## Gate 6 — Comprehension

Protocol: [COMPREHENSION.md](./COMPREHENSION.md)

| Metric | Threshold | Actual |
| --- | --- | --- |
| Completers (valid exposure) | ≥5 to decide; prefer ≥10 | |
| Exposure type | README + verify/mock | live ___ / mock ___ |
| Passed critical set (C1∧C2∧C3) | — | |
| Comprehension rate | ≥80% | |
| Item miss rates (optional) | — | C1: · C2: · C3: · C4: · C5: · C6: · C7: |

**Outcome:** ☐ Pass · ☐ Fail · ☐ Incomplete  
**Date:**  
**Doc fixes triggered:**  

---

## Final decision

Complete after all gates are Pass, Fail, or explicitly waived with written reason (waivers should be rare; do not waive 1 / 4 / 6 to force a “continue”).

### Checklist

| Question | Answer |
| --- | --- |
| Gate 1 publisher recruitment | ☐ Pass · ☐ Fail · ☐ Incomplete |
| Gate 4 discovery correctness | ☐ Pass · ☐ Fail · ☐ Incomplete |
| Gate 6 comprehension | ☐ Pass · ☐ Fail · ☐ Incomplete |
| Any hard-stop gate failed? | ☐ Yes · ☐ No |
| Gates 2, 3, 5 summary | 2: ___ · 3: ___ · 5: ___ |

### Decision

Select **one**:

- [ ] **Continue CLI** — hard-stop gates (1, 4, 6) passed; proceed with ranked growth bets in ROADMAP (publisher onboarding, resolve API, etc.).
- [ ] **Pivot** — Gate 1, 4, or 6 failed (or equivalent evidence). Stop expanding human CLI surface; pursue agent/CI policy tool and/or verification API as primary path.
- [ ] **Hold / incomplete** — beta ended without enough data; no expansion claim; schedule another quiet window or narrow the question.

**Decision date:**  
**Rationale (short paragraph):**  

```text




```

**Next actions:**  

1.  
2.  
3.  

**Sign-off (maintainer):**  

---

## Amendment log

| Date | Change | Reason |
| --- | --- | --- |
| | | |
