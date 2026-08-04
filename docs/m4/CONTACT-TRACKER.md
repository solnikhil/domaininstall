# Milestone 4 — contact tracker

Fill this during the quiet beta. Definitions and qualification rules live in [OUTREACH.md](./OUTREACH.md). Operational order lives in [RUNBOOK.md](./RUNBOOK.md).

**Last updated:** 2026-08-04 (tracker empty; no external outreach sent yet.
Candidate shortlist for Day 0: [PROSPECT-CANDIDATES.md](./PROSPECT-CANDIDATES.md).)

---

## Scoreboard

Update these counts from the table below. External rows only for gate totals (exclude control / excluded rows).

| Metric | Count | Target |
| --- | --- | --- |
| Contacts (qualified, external) | 0 | 20 |
| External mappings live | 0 | 5 |
| Unassisted completes (gate 2 sample) | 0 | ≥4 of 5 with median setup ≤10 min |
| README / install-doc placements | 0 | 3 |

**Gate 2 notes (fill when ≥5 external mappings exist):**

- Sample size of completed setups used for gate 2: __
- Unassisted among those: __
- Setup times (minutes): __
- Median setup time (minutes): __

**Honest status line:** e.g. “M4 in progress — gate 1 incomplete.”

---

## How to use a row

1. Assign the next free **ID** (1, 2, …). Keep **0** as the control row.
2. Confirm the prospect is **qualified** and not **excluded** before counting them in the scoreboard.
3. Set **Response** to `pending` on contact; flip to `Y` or `N` when known.
4. **Mapping live** only after `di verify <domain>` (or equivalent) succeeds on the public record.
5. Put emails or private handles in **Notes** only if needed; prefer not to commit secrets. If this file is public, avoid personal emails — use “npm contact form” / “GitHub @user” instead.

**Y/N columns:** use `Y`, `N`, or leave blank / `—` if not applicable yet. Response may also be `pending`.

---

## Tracker

| ID | Package | Domain | Homepage | Contact channel | Contacted date | Response (Y/N/pending) | Setup started | Setup completed unassisted (Y/N) | Setup time (minutes) | Maintainer DNS help needed (Y/N) | Mapping live (Y/N) | Record value | README placement (Y/N URL) | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | zuraai | zuraai.xyz | https://zuraai.xyz (or project homepage) | n/a (control) | — | — | Y | — | — | N | Y | `dnstall=pkg:npm/zuraai` | N | **CONTROL — does NOT count toward external gate 1.** Maintainer reference mapping `_dnstall.zuraai.xyz`. |
| 1 | | | | | | pending | | | | | | | | |
| 2 | | | | | | pending | | | | | | | | |
| 3 | | | | | | pending | | | | | | | | |
| 4 | | | | | | pending | | | | | | | | |
| 5 | | | | | | pending | | | | | | | | |
| 6 | | | | | | pending | | | | | | | | |
| 7 | | | | | | pending | | | | | | | | |
| 8 | | | | | | pending | | | | | | | | |
| 9 | | | | | | pending | | | | | | | | |
| 10 | | | | | | pending | | | | | | | | |
| 11 | | | | | | pending | | | | | | | | |
| 12 | | | | | | pending | | | | | | | | |
| 13 | | | | | | pending | | | | | | | | |
| 14 | | | | | | pending | | | | | | | | |
| 15 | | | | | | pending | | | | | | | | |
| 16 | | | | | | pending | | | | | | | | |
| 17 | | | | | | pending | | | | | | | | |
| 18 | | | | | | pending | | | | | | | | |
| 19 | | | | | | pending | | | | | | | | |
| 20 | | | | | | pending | | | | | | | | |

Add rows 21+ if you contact more than 20; gate 1 still needs **≥20 qualified** contacts and **≥5 external** live mappings.

---

## Excluded / non-counting log (optional)

Use this for friend tests, throwaways, or disqualified outreach so they never inflate the scoreboard.

| Date | Package / domain | Why excluded | Notes |
| --- | --- | --- | --- |
| | | | |

---

## Column reference

| Column | Meaning |
| --- | --- |
| Contact channel | email / GitHub issue / GH discussion / X DM / Discord / other |
| Contacted date | ISO date of first real outreach (`YYYY-MM-DD`) |
| Response | `Y` = substantive reply; `N` = declined or timed out; `pending` = waiting |
| Setup started | They began DNS work or equivalent |
| Setup completed unassisted | Live verify without you editing their DNS (`Y`/`N`) |
| Setup time (minutes) | Their estimate or observed wall time to first good `di verify` |
| Maintainer DNS help needed | `Y` if you edited their zone or drove their registrar UI |
| Mapping live | Public external mapping resolves correctly (`Y`/`N`) |
| Record value | e.g. `dnstall=pkg:npm/their-package` |
| README placement | `N` or `Y` + URL to the commit/page |
