# Milestone 4 — two-week quiet beta runbook

Operational checklist for the **maintainer** of domaininstall. Goal: run product validation honestly before any broad promotion.

**Authority:** [ROADMAP.md](../../ROADMAP.md) §7 (gates + decision rule). If this runbook and the roadmap disagree, **the roadmap wins** — then fix this file.

**Related:** [OUTREACH.md](./OUTREACH.md) · [CONTACT-TRACKER.md](./CONTACT-TRACKER.md) · [PUBLISHER-GUIDE.md](./PUBLISHER-GUIDE.md)

---

## Non-negotiables

1. **Do not** do a broad HN / Reddit / Lobsters / Twitter “launch” during M4. Quiet beta only. (Roadmap §9 defers broad launch promotion; growth bets wait until after validation.)
2. **Do not** expand the CLI feature surface to “make M4 pass.” Freeze product work unless a **blocker** prevents measurement (e.g. verify is broken for everyone).
3. **Do not** pad external adoption with friends-only or throwaway mappings. Control mapping `zuraai.xyz` never counts as external.
4. Always use the **narrow security claim** in every human touchpoint:

   > It verifies continuity of a domain-to-package declaration. It does not prove that a package or package version is safe.

5. Log reality in [CONTACT-TRACKER.md](./CONTACT-TRACKER.md). Unchecked optimism does not move gates.

---

## Decision rule (from ROADMAP §7)

If the **publisher**, **correctness**, or **comprehension** gates fail:

- **Do not expand the CLI.**
- Pivot toward an **agent/CI policy tool** or a **verification API** (fewer publishers required; a single org can adopt alone).
- Record the pivot explicitly in ROADMAP §2 and §7 (see [Updating the roadmap](#updating-the-roadmap-2-and-7)).

Do not re-run the same beta with lower bars and call it a pass.

---

## Order of work (do not reorder casually)

Recommended sequence — later gates depend on earlier ones having something real to measure:

```text
1. Freeze feature work
2. Close optional “windows / platform” engineering gates only if already nearly done
   and they block measurement — otherwise leave them for later (don’t use M4 to
   absorb scope)
3. Recruit publishers (gate 1)          → OUTREACH + CONTACT-TRACKER
4. Measure setup (gate 2)               → times, unassisted Y/N
5. Placements (gate 3)                  → README / install docs
6. Discovery study (gate 4)             → only with live mappings / materials ready
7. Usage signals (gate 5)               → external users if any appear organically
8. Comprehension (gate 6)               → survey / interview after people used it
9. Score honestly                       → update ROADMAP §2 / §7
```

**Supply before demand:** without external mappings, discovery/usage numbers are mostly noise. Prioritize gate 1–3 in week 1–2; schedule studies only when you have enough surface area.

Optional engineering (“windows gate,” polish) is **not** a substitute for recruitment. If you must choose, recruit.

---

## Pre-flight (day 0, before first outreach)

- [ ] Confirm reference mapping still works: `di verify zuraai.xyz` (or live E2E).
- [ ] Choose and record the tested version in `RESULTS.md` (for example,
      `0.0.3`), then confirm that exact artifact on a clean machine with both
      `npm install --global domaininstall@<version>` and
      `npx --yes domaininstall@<version> --version`.
- [ ] Publisher guide is accurate for the current TXT format (`_dnstall`, `dnstall=pkg:npm/…`).
- [ ] [CONTACT-TRACKER.md](./CONTACT-TRACKER.md) scoreboard reset; row 0 control present.
- [ ] Prospect list drafted (≥20 **qualified** names per OUTREACH criteria) — methods only until you fill real rows.
- [ ] Templates ready; no hype language; claim is narrow.
- [ ] Feature freeze: no new roadmap “growth bet” implementation unless it unblocks setup measurement (`di setup` is a bet for *after* validation unless setup is already failing everyone).
- [ ] Explicit commitment: **no broad HN/Reddit launch this window.**

---

## Week 1 — freeze, recruit, first setups

### Day 1 — freeze and open the window

- [ ] Announce to yourself (and any collaborators): M4 quiet beta start date / end date (two weeks).
- [ ] Cut a short personal checklist of “allowed work”: outreach, docs fixes for publishers, verify bugs, tracker updates. Everything else → backlog.
- [ ] Update ROADMAP §2 **External adoption** / M4 status to “in progress” with the date (honest, not aspirational).

### Days 2–4 — recruit to 20 contacted

- [ ] Send first-wave outreach (aim for enough volume that 20 **qualified** contacts are real, not padded).
- [ ] Log every contact the same day in CONTACT-TRACKER (channel, date, package, domain).
- [ ] Answer replies within a reasonable time; do not edit their DNS unless they ask and you mark **assisted**.
- [ ] Collect setup time and “needed help?” as soon as someone succeeds or abandons.

### Days 5–7 — deepen, don’t spam

- [ ] One follow-up only for non-responders (per OUTREACH), then stop.
- [ ] Help stuck publishers using `di verify` diagnostics; fix guide gaps if the same confusion repeats.
- [ ] Target progress check: contacts ≥15–20; at least some setup attempts underway.
- [ ] Mid-week honesty check: if zero interest, note it — do not invent urgency or expand marketing surface (still no HN/Reddit blast).

---

## Week 2 — measure, placements, studies, score

### Days 8–10 — setup quality and placements

- [ ] Push for complete `di verify` on domains that started setup.
- [ ] Mark **Mapping live** only when public DNS is correct and external.
- [ ] Ask willing publishers for optional README / install-doc lines (gate 3); never require naming you in marketing.
- [ ] Fill setup times; compute unassisted rate and median for gate 2 when sample allows.

### Days 11–12 — discovery and comprehension (if feasible)

Only if you have enough live context (external mappings and/or clear task materials):

- [ ] Gate 4: package-discovery tasks (counterbalanced), log correct selection rates vs ordinary discovery.
- [ ] Gate 6: after use, ask whether participants understand **mapping continuity vs package safety**; target ≥80% comprehension of the narrow claim.
- [ ] Gate 5: count external users / successful uses / repeats **without** buying traffic or doing a launch thread.

If materials aren’t ready, **do not** fake study results. Record “not run / blocked on supply” and score what you have.

### Days 13–14 — score and write the decision

- [ ] Freeze the tracker for the window (or snapshot counts with a date).
- [ ] Score each gate pass / fail / incomplete against ROADMAP §7 thresholds.
- [ ] Apply the decision rule:
  - Publisher (1), correctness (4), or comprehension (6) **fail** → pivot; **do not expand CLI**.
  - Gates incomplete solely due to time → say so; either extend quiet beta **once** with the same bars, or pause — do not silently lower thresholds.
- [ ] Update ROADMAP §2 and §7 (below).
- [ ] Optional: short note in NOTES or a private log of what to change in the publisher guide — not a public launch post.

---

## Daily loop (10–20 minutes)

While the window is open:

1. Check replies; update Response / setup columns.
2. Re-verify any “live” mapping that changed (`di verify`).
3. Fix only **measurement blockers** (broken verify, wrong docs).
4. Send scheduled follow-ups (max one per prospect).
5. Resist feature ideas that “would help adoption later.” Capture them for post-M4 bets.

---

## What “done” looks like for this runbook

Not “product is successful.” Done means:

- ≥20 qualified contacts attempted and logged, **or** a documented stop with reasons.
- External live mappings counted without self-deception.
- Gate 2–3 data recorded where publishers actually tried.
- A written pass / fail / pivot decision aligned with ROADMAP §7.
- §2 reflects adoption reality; no broad launch performed during the window.

---

## Updating the roadmap 2 and 7

### When gates **move** (start, pass, fail, or pivot)

**§2 — Where the project actually stands**

- Bump **Last verified** date.
- Update **External adoption** from “Zero / M4 not started” to concrete numbers, e.g. “N external mappings live; M4 in progress” or “M4 complete: gates …”.
- Keep evidence checkable (tracker snapshot date, example domains only with consent).
- Refresh the **honest summary** if the binding constraint changed (e.g. still supply, or now comprehension, or pivot).

**§7 — Milestone 4**

- Change **Not started** to **In progress** or **Complete (date)** / **Failed (date)** / **Pivoted (date)**.
- For each gate row, note outcome: pass / fail / incomplete + measured numbers (e.g. “12 contacted, 2 live — fail”).
- If pivoting, state the chosen direction (agent/CI policy vs verification API) and that **CLI expansion is stopped** per the decision rule.
- Do not delete failed gates; record them so the project cannot quietly rewrite history.

### What not to do

- Don’t mark gate 1 passed with only `zuraai.xyz`.
- Don’t check boxes because “people seemed positive.”
- Don’t expand §8 growth bets into active engineering until M4 decision says the CLI thesis still holds.

### Commands / checks useful when refreshing §2

```bash
npm view domaininstall versions dist-tags time --json
di verify zuraai.xyz
# plus di verify <each external domain you claim is live>
npm ci && npm test
```

---

## Explicit anti-patterns during M4

| Anti-pattern | Why it’s banned here |
| --- | --- |
| Show HN / r/programming / viral launch | Contaminates quiet demand signal; deferred in roadmap |
| Shipping large CLI features mid-beta | Confounds whether the product or the pitch failed |
| Counting friends as external | Fails the actual cold-start test |
| Claiming “safe installs” in outreach | Violates narrow claim; poisons comprehension gate |
| Lowering thresholds after a miss | Makes the gate meaningless |
| Editing prospects’ DNS and calling it unassisted | Falsifies gate 2 |

---

## After the window

- If **CLI thesis holds:** pursue growth bets in ROADMAP §8 order (publisher onboarding first).
- If **pivot:** stop treating “more CLI surface” as progress; write the new thesis into §1/§2 and narrow security docs if the product shape changes.
- Either way: thank participants who opted in; honor no-public-naming defaults.

This runbook is process, not theater. Empty mappings and failed gates are acceptable outcomes; dishonest ones are not.
