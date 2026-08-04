# Gate 4 — Discovery correctness protocol

**Gate (from ROADMAP):** ≥30 counterbalanced package-discovery tasks; ≥90% correct selection **and** ≥20-point improvement over ordinary discovery.

**Research question:** Does resolving an npm package via **domaininstall** (`di verify <domain>` / domain→package mapping) reduce wrong-package selection compared with **ordinary discovery** (npmjs.com search, web search, or guessing from the project name)?

**Narrow claim this gate tests:** Domain-based resolution improves *name selection accuracy* (picking the intended package string). It does **not** test package safety, malware resistance, or trustworthiness of code.

**Audience / runner:** A single maintainer running a quiet beta with colleagues, students, or remote volunteers. No lab equipment beyond a browser, Node optional, and printed or digital stimulus cards.

---

## 1. Design summary

| Element | Choice |
| --- | --- |
| Design | **Within-subjects**, counterbalanced condition order and task set |
| Conditions | **Treatment** = may use `di verify` / mapping materials; **Control** = ordinary discovery only |
| Primary unit | One **task-trial** = one participant × one task × one condition |
| Target *n* | **≥30 scored task-trials total**, balanced across conditions |
| Practical plan | **6 participants × 6 tasks each = 36 trials** (18 treatment, 18 control) |
| Success metric | Binary: correct package name (success) vs wrong / typosquat-like choice (fail) |
| Gate thresholds | Treatment accuracy **≥90%** *and* (treatment − control) **≥20 percentage points** |

### Why this plan (and honesty about limits)

- **36 trials** meets the ≥30 threshold without requiring 30 separate people.
- Within-subjects maximizes power for a small beta: each person contributes both conditions.
- **This is not a preregistered clinical trial.** With *n* ≈ 6 people, inference is exploratory. Report confidence intervals and do not overclaim “proven.” The gate is a **decision threshold for the project**, not a claim of population effect size.
- Alternative if recruitment is hard: **10 participants × 4 tasks = 40 trials**, or **15 × 2**. Keep condition balance and counterbalancing; do not drop below 30 scored trials.

### Between-subjects fallback

If order contamination is severe (participants clearly reuse treatment knowledge in control), switch to between-subjects: ≥15 trials per arm (≥30 total), random assignment, same task bank. Power is worse; note the design change in RESULTS.md.

---

## 2. Conditions

### Treatment (domaininstall-assisted)

Participant **may** use any of:

1. Live CLI: `di verify <domain>` (when a real mapping exists — currently **zuraai.xyz → zuraai**).
2. Protocol **stimulus cards** with a mock `di verify` output (for hypothetical / simulated mappings).
3. Short domaininstall docs excerpt on the card (what a mapping means: domain owner’s declared npm package name).

They **must not** be told the correct package name in prose outside the mock/live verify surface. The verify output *is* the treatment.

Only live-CLI trials may count toward Gate 4. Stimulus-card trials validate the
materials and may be reported separately, but must never be pooled into the
live correctness numerator or denominator. Gate 4 requires at least 30 scored
LIVE trials in total, including at least 15 treatment and 15 matched control
trials across at least five participants.

### Control (ordinary discovery)

Participant may use **only**:

- npmjs.com search
- Web search (Google, DuckDuckGo, etc.)
- Package READMEs / GitHub search
- Guessing from the product or domain name

**Forbidden in control:** `di`, `domaininstall`, `dnstall`, any DNS TXT lookup for `_dnstall`, any stimulus card with mock verify output, and any verbal tip that “the domain maps to X.”

---

## 3. What counts as a task

1. Participant reads a **scenario** (1–3 sentences): they know a **domain** (or product site) and need the **npm package name** to install (CLI or library).
2. They produce a single answer: the npm package name string (e.g. `zuraai`, `@scope/pkg`).
3. Optional: they may list one “runner-up” if unsure; **primary answer only** is scored.
4. Soft time guidance: about **3–5 minutes per task**. No hard stop; abandon after ~8 minutes counts as **fail** (wrong selection under realistic pressure to ship).

**Scoring**

| Outcome | Score |
| --- | --- |
| Primary answer matches the key **exactly** (case-sensitive npm name rules; allow common `@scope/name` form) | **Success** |
| Typosquat, similar name, wrong scope, empty, “I don’t know,” or abandoned | **Fail** |
| Package that is “also related” but not the declared/correct one | **Fail** |

Do **not** score partial credit. Gate 4 is about wrong-package selection, not near-misses.

---

## 4. Counterbalancing

### Task sets

Build two disjoint sets of **6 tasks** each from the bank of ≥12 (Set A and Set B). Each participant does **all 6 tasks in one set under treatment** and **all 6 in the other set under control** — wait: that would be 12 tasks × 6 people. For the practical 6×6 plan:

**Recommended Latin-style assignment for 6 participants, 6 tasks, 2 conditions:**

Each participant completes **exactly 6 tasks**: 3 treatment + 3 control.

| Participant | Treatment tasks | Control tasks | Order |
| --- | --- | --- | --- |
| P1 | T1, T2, T3 | T4, T5, T6 | Treatment first |
| P2 | T4, T5, T6 | T1, T2, T3 | Control first |
| P3 | T1, T3, T5 | T2, T4, T6 | Treatment first |
| P4 | T2, T4, T6 | T1, T3, T5 | Control first |
| P5 | T2, T3, T6 | T1, T4, T5 | Treatment first |
| P6 | T1, T4, T5 | T2, T3, T6 | Control first |

- Every task appears in both conditions across the sample.
- Order of condition is balanced (3 treatment-first, 3 control-first).
- Within a condition block, randomize task order per participant.
- **Total trials:** 6 × 6 = **36** (18 per condition).

If you recruit more than 6, continue the pattern: alternate condition order; rotate which half of the task bank is treated.

### Isolation rules

- Complete one full condition block before the other (no interleaving single tasks across conditions).
- Brief washout: 2–5 minutes, or a short unrelated survey item, between blocks.
- After both blocks: optional free comment; then comprehension instrument if co-administered (see `COMPREHENSION.md`).

---

## 5. Environment controls

| Control | Rule |
| --- | --- |
| Node / CLI | Optional. Live `di verify zuraai.xyz` only for the LIVE task when the runner can provide a working install. Otherwise use the mock card for all treatment tasks. |
| Network | Same network quality is ideal but not required; note offline failures. |
| Malware / install | **Never** require installing unknown packages. Answers are **names only**. No `npm install` of participant-chosen packages during the study. |
| Time pressure | Soft 3–5 min; no stopwatch-as-score. Abandoned = fail. |
| Collaboration | Solo. No asking the maintainer mid-task (except tech failures: blank page, CLI crash). |
| Browser | Clean session preferred; history/autocomplete is realistic and allowed in control. |
| Distractors | Listed on cards for scoring keys; **do not show correct answer** on participant-facing side. |

---

## 6. Consent brief (copy-paste)

> You are invited to a short study about how people find the right npm package name when they know a website or product domain.
>
> You will complete several short scenarios. In some, you may use a small tool or card that shows a domain-to-package mapping; in others, only normal web/npm search. We retain a pseudonymous participant id, task id, condition, chosen package answer, whether the task was abandoned, optional notes, and timestamp—not your pins, passwords, private repos, name, or contact details. Raw study data is available only to the maintainer and designated study operators, is retained for 90 days after the final M4 decision, and is then deleted; only aggregated anonymous results remain.
>
> There is no malware exercise and no requirement to install packages. You may stop at any time; incomplete tasks are dropped from analysis per our stop rules.
>
> Results help decide whether this open-source tool is worth developing further. Findings may be summarized anonymously (e.g. “18/20 correct under condition A”).
>
> By continuing you consent to participate under these terms.

---

## 7. Debrief (copy-paste)

> Thank you. This study asked whether using a **domain → npm package declaration** (as shown by domaininstall / `di verify`) helps people pick the **correct package name** more often than searching or guessing.
>
> **What we claim if the gate passes:** better *name selection* accuracy under these tasks—not that packages are safe, audited, or free of malware.
>
> **domaininstall** checks continuity of a mapping the domain owner published. It does **not** replace lockfiles, provenance, code review, or security scanners.
>
> Some tasks used **simulated mappings** and mock verify output. Only tasks marked LIVE used real DNS. Simulated answers should not be used as install instructions outside this study.
>
> Questions? Contact the study runner.

---

## 8. Task bank (≥12 stubs)

Legend:

- **LIVE** — real DNS may resolve today (`zuraai.xyz` → `zuraai`). Prefer live `di verify` in treatment.
- **SIM** — simulated mapping for the study only. Treatment uses mock verify card. Do not install based on the fiction.
- **REAL≈** — well-known real package where domain and package are similar; mapping **may not** exist on DNS. Treatment uses mock verify showing the intended real package name. Document: “mapping may not exist in production.”

Distractors are wrong answers participants often pick under control.

| ID | Kind | Scenario (short) | Domain cue | Correct package | Distractors (examples) |
| --- | --- | --- | --- | --- | --- |
| T1 | LIVE | Install the CLI/library declared by the Zura AI project site. | `zuraai.xyz` | `zuraai` | `zura`, `zura-ai`, `zuraai-cli`, `@zura/ai` |
| T2 | SIM | Install the official SDK for “Northwind Analytics” dashboard. | `northwind-analytics.dev` | `@northwind/sdk` | `northwind`, `northwind-analytics`, `analytics-sdk` |
| T3 | SIM | Team chat tool “Threadly”; need the Node bot package the company publishes. | `threadly.app` | `threadly-bot` | `threadly`, `threadly-node`, `@threadly/core` |
| T4 | REAL≈ | Lint JS with the tool whose site is eslint.org (mock maps domain → package). | `eslint.org` | `eslint` | `eslint-cli`, `@eslint/js` *as sole install name if scenario asks for the classic meta-package*, `es-lint` |
| T5 | SIM | Payments startup “Riverpay”; install their server SDK. | `riverpay.io` | `@riverpay/node` | `riverpay`, `river-pay`, `riverpay-sdk` |
| T6 | SIM | Feature flags product “Flagship”; install the React client they declare. | `flagship.tools` | `@flagship/react` | `flagship`, `flagship-react`, `react-flagship` |
| T7 | SIM | Observability “LumenTrace”; install the OpenTelemetry-style exporter package. | `lumentrace.com` | `lumentrace` | `lumen-trace`, `lumentrace-js`, `@lumen/trace` |
| T8 | REAL≈ | CSS utility framework known from tailwindcss.com (mock mapping). | `tailwindcss.com` | `tailwindcss` | `tailwind`, `tailwind-css`, `@tailwindcss/cli` alone if scenario asks for the main package |
| T9 | SIM | Internal-sounding open source “Harbor Charts”; install the CLI. | `harborcharts.dev` | `harbor-charts` | `harborcharts`, `harbor`, `@harbor/charts` |
| T10 | SIM | Auth product “Keynest”; install Passport-style strategy package. | `keynest.security` | `passport-keynest` | `keynest`, `keynest-passport`, `@keynest/auth` |
| T11 | SIM | Docs host “Parchment”; install the MDX plugin they declare. | `parchment.page` | `@parchment/mdx` | `parchment`, `parchment-mdx`, `mdx-parchment` |
| T12 | SIM | Queue product “Bullwork” (easy confusion with `bull`); install their official worker. | `bullwork.run` | `@bullwork/worker` | `bull`, `bullmq`, `bullwork` |

**Notes for REAL≈ tasks (T4, T8):** In production, `_dnstall` may be absent. The study **does not** claim these domains publish dnstall records. Treatment arm **must** use the mock card, not a failed live lookup (a live miss would unfairly punish treatment).

**LIVE task (T1):** Prefer real `di verify zuraai.xyz`. If DNS/network fails, fall back to the T1 mock card and note “LIVE degraded to mock” in the session log (trial still scores if mock was provided as treatment).

---

## 9. Stimulus cards (participant-facing + key)

Print double-sided or use two files: **PARTICIPANT** (no correct answer highlighted) and **RUNNER KEY**. Below, each card includes scenario, mock verify (treatment only), correct answer, and distractors for the runner.

**Treatment packet:** scenario + mock (or live) verify.  
**Control packet:** scenario only (same wording, no verify block).

---

### Card T1 — LIVE / zuraai.xyz

**PARTICIPANT — Scenario**

> You joined a hackathon team that uses tools from **zuraai.xyz**. They said: “Install our npm package—the one the domain declares.” What is the **exact npm package name** you should install?

**PARTICIPANT — Treatment only (live preferred)**

```text
$ di verify zuraai.xyz

  domain    zuraai.xyz
  package   zuraai
  record    dnstall=pkg:npm/zuraai
  status    mapping found (first look — no prior pin)

  This shows the domain’s declared package name.
  It does not mean the package code is safe or audited.
```

*(If live CLI is available, run it instead of pasting the mock; paste only on failure.)*

**RUNNER KEY**

| Field | Value |
| --- | --- |
| Correct | `zuraai` |
| Distractors | `zura`, `zura-ai`, `zuraai-cli`, `@zura/ai` |
| Kind | LIVE |

---

### Card T2 — SIM / northwind-analytics.dev

**PARTICIPANT — Scenario**

> Your company bought **Northwind Analytics**. The product site is **northwind-analytics.dev**. You need the **official Node SDK** package name from their install docs (domain-declared). What package do you install?

**PARTICIPANT — Treatment only (mock)**

```text
$ di verify northwind-analytics.dev

  domain    northwind-analytics.dev
  package   @northwind/sdk
  record    dnstall=pkg:npm/@northwind/sdk
  status    mapping found (SIMULATED — study material only)

  This shows the domain’s declared package name.
  It does not mean the package code is safe or audited.
```

**RUNNER KEY**

| Field | Value |
| --- | --- |
| Correct | `@northwind/sdk` |
| Distractors | `northwind`, `northwind-analytics`, `analytics-sdk` |
| Kind | SIM |

---

### Card T3 — SIM / threadly.app

**PARTICIPANT — Scenario**

> You are wiring a bot for **Threadly** team chat. Marketing site: **threadly.app**. Ops said to install “whatever package the domain maps to,” not a random GitHub clone. Package name?

**PARTICIPANT — Treatment only (mock)**

```text
$ di verify threadly.app

  domain    threadly.app
  package   threadly-bot
  record    dnstall=pkg:npm/threadly-bot
  status    mapping found (SIMULATED — study material only)
```

**RUNNER KEY**

| Field | Value |
| --- | --- |
| Correct | `threadly-bot` |
| Distractors | `threadly`, `threadly-node`, `@threadly/core` |
| Kind | SIM |

---

### Card T5 — SIM / riverpay.io

**PARTICIPANT — Scenario**

> Finance wants the **Riverpay** server SDK. Homepage: **riverpay.io**. Several similarly named packages appear on npm. What is the domain-declared package name?

**PARTICIPANT — Treatment only (mock)**

```text
$ di verify riverpay.io

  domain    riverpay.io
  package   @riverpay/node
  record    dnstall=pkg:npm/@riverpay/node
  status    mapping found (SIMULATED — study material only)
```

**RUNNER KEY**

| Field | Value |
| --- | --- |
| Correct | `@riverpay/node` |
| Distractors | `riverpay`, `river-pay`, `riverpay-sdk` |
| Kind | SIM |

---

### Card T9 — SIM / harborcharts.dev

**PARTICIPANT — Scenario**

> You need the **Harbor Charts** CLI for CI snapshots. Site: **harborcharts.dev**. Name is easy to mangle (hyphenation, scope). What exact package should you install per domain declaration?

**PARTICIPANT — Treatment only (mock)**

```text
$ di verify harborcharts.dev

  domain    harborcharts.dev
  package   harbor-charts
  record    dnstall=pkg:npm/harbor-charts
  status    mapping found (SIMULATED — study material only)
```

**RUNNER KEY**

| Field | Value |
| --- | --- |
| Correct | `harbor-charts` |
| Distractors | `harborcharts`, `harbor`, `@harbor/charts` |
| Kind | SIM |

---

### Card T12 — SIM / bullwork.run

**PARTICIPANT — Scenario**

> A vendor demo mentions **Bullwork** job queues at **bullwork.run**. You already know popular packages named `bull` / `bullmq`. You want **their** declared worker package, not a lookalike. Package name?

**PARTICIPANT — Treatment only (mock)**

```text
$ di verify bullwork.run

  domain    bullwork.run
  package   @bullwork/worker
  record    dnstall=pkg:npm/@bullwork/worker
  status    mapping found (SIMULATED — study material only)
```

**RUNNER KEY**

| Field | Value |
| --- | --- |
| Correct | `@bullwork/worker` |
| Distractors | `bull`, `bullmq`, `bullwork` |
| Kind | SIM |

---

### Card T4 — REAL≈ / eslint.org

**PARTICIPANT — Scenario**

> You need to **lint JavaScript** with the tool whose site is **eslint.org**. Several related names appear on npm (`eslint-cli`, scoped packages, hyphen variants). What is the **exact npm package name** the domain declares (classic meta-package for install)?

**PARTICIPANT — Treatment only (mock required)**

*(Mock required: do not run live `di verify` — production `_dnstall` mapping may be absent. A live miss would unfairly punish treatment.)*

```text
$ di verify eslint.org

  domain    eslint.org
  package   eslint
  record    dnstall=pkg:npm/eslint
  status    mapping found (SIMULATED — study material only)

  This shows the domain’s declared package name.
  It does not mean the package code is safe or audited.
```

**RUNNER KEY**

| Field | Value |
| --- | --- |
| Correct | `eslint` |
| Distractors | `eslint-cli`, `@eslint/js` (as sole install name when scenario asks for the classic meta-package), `es-lint` |
| Kind | REAL≈ |
| Note | Mapping may not exist in production; always use mock card in treatment |

---

### Card T6 — SIM / flagship.tools

**PARTICIPANT — Scenario**

> Product wants **Flagship** feature flags. Site: **flagship.tools**. You need the **React client** package they declare for the domain—not a community wrapper. Exact package name?

**PARTICIPANT — Treatment only (mock)**

```text
$ di verify flagship.tools

  domain    flagship.tools
  package   @flagship/react
  record    dnstall=pkg:npm/@flagship/react
  status    mapping found (SIMULATED — study material only)

  This shows the domain’s declared package name.
  It does not mean the package code is safe or audited.
```

**RUNNER KEY**

| Field | Value |
| --- | --- |
| Correct | `@flagship/react` |
| Distractors | `flagship`, `flagship-react`, `react-flagship` |
| Kind | SIM |

---

### Card T7 — SIM / lumentrace.com

**PARTICIPANT — Scenario**

> You’re adding observability for **LumenTrace**. Product site: **lumentrace.com**. Ops wants the OpenTelemetry-style **exporter package** the domain maps to. What package do you install?

**PARTICIPANT — Treatment only (mock)**

```text
$ di verify lumentrace.com

  domain    lumentrace.com
  package   lumentrace
  record    dnstall=pkg:npm/lumentrace
  status    mapping found (SIMULATED — study material only)

  This shows the domain’s declared package name.
  It does not mean the package code is safe or audited.
```

**RUNNER KEY**

| Field | Value |
| --- | --- |
| Correct | `lumentrace` |
| Distractors | `lumen-trace`, `lumentrace-js`, `@lumen/trace` |
| Kind | SIM |

---

### Card T8 — REAL≈ / tailwindcss.com

**PARTICIPANT — Scenario**

> Design asked for the **CSS utility framework** known from **tailwindcss.com**. You need the **main package** for install—not only a CLI or a short nickname. What exact npm name does the domain declare?

**PARTICIPANT — Treatment only (mock required)**

*(Mock required: do not run live `di verify` — production `_dnstall` mapping may be absent. A live miss would unfairly punish treatment.)*

```text
$ di verify tailwindcss.com

  domain    tailwindcss.com
  package   tailwindcss
  record    dnstall=pkg:npm/tailwindcss
  status    mapping found (SIMULATED — study material only)

  This shows the domain’s declared package name.
  It does not mean the package code is safe or audited.
```

**RUNNER KEY**

| Field | Value |
| --- | --- |
| Correct | `tailwindcss` |
| Distractors | `tailwind`, `tailwind-css`, `@tailwindcss/cli` alone (when scenario asks for the main package) |
| Kind | REAL≈ |
| Note | Mapping may not exist in production; always use mock card in treatment |

---

### Card T10 — SIM / keynest.security

**PARTICIPANT — Scenario**

> Auth product **Keynest** lives at **keynest.security**. You need their **Passport-style strategy** package (the one the domain declares), not a generic auth lib or a re-scoped clone. Package name?

**PARTICIPANT — Treatment only (mock)**

```text
$ di verify keynest.security

  domain    keynest.security
  package   passport-keynest
  record    dnstall=pkg:npm/passport-keynest
  status    mapping found (SIMULATED — study material only)

  This shows the domain’s declared package name.
  It does not mean the package code is safe or audited.
```

**RUNNER KEY**

| Field | Value |
| --- | --- |
| Correct | `passport-keynest` |
| Distractors | `keynest`, `keynest-passport`, `@keynest/auth` |
| Kind | SIM |

---

### Card T11 — SIM / parchment.page

**PARTICIPANT — Scenario**

> Docs host **Parchment** is at **parchment.page**. You need the **MDX plugin** package they declare for domain install—not a similarly named community package. Exact name?

**PARTICIPANT — Treatment only (mock)**

```text
$ di verify parchment.page

  domain    parchment.page
  package   @parchment/mdx
  record    dnstall=pkg:npm/@parchment/mdx
  status    mapping found (SIMULATED — study material only)

  This shows the domain’s declared package name.
  It does not mean the package code is safe or audited.
```

**RUNNER KEY**

| Field | Value |
| --- | --- |
| Correct | `@parchment/mdx` |
| Distractors | `parchment`, `parchment-mdx`, `mdx-parchment` |
| Kind | SIM |

---

## 10. Session procedure (runner checklist)

1. [ ] Assign participant id (P1…), task assignment, condition order from the table.
2. [ ] Consent brief; answer logistics only (no “the answer is…”).
3. [ ] Environment: browser available; optional `domaininstall` global install for LIVE task.
4. [ ] **Block 1** — first condition: deliver control or treatment packets; collect answers on a form (task id, condition, package string, time band optional).
5. [ ] Short washout.
6. [ ] **Block 2** — other condition.
7. [ ] Debrief; if running Gate 6 same day, administer comprehension **after** README skim + one verify exposure (see `COMPREHENSION.md`)—do not leak Gate 4 keys during comprehension.
8. [ ] Log drops, LIVE→mock fallbacks, tech failures.

### Answer collection form (fields)

```text
participant_id:
task_id:
condition: treatment | control
package_answer:
abandoned: yes | no
notes:
timestamp:
```

---

## 11. Analysis plan

### Primary endpoints

1. **Treatment accuracy**

   \( A_T = \frac{\text{successes in LIVE treatment}}{\text{scored LIVE treatment trials}} \)

   Gate needs \( A_T \geq 0.90 \).

2. **Improvement over control**  
   \( \Delta = A_T - A_C \) (in percentage points)  
   Gate needs \( \Delta \geq 20 \) points (e.g. 0.92 − 0.70 = 22 pp).

Both must pass.

The primary Gate 4 calculation includes only the predeclared LIVE subset and
requires the minimum live sample stated in §2. Compute simulated-card accuracy
as a separate materials-validation result; it cannot rescue or fail Gate 4.

### Secondary (report, not gate)

- Per-task accuracy (which scenarios are hard under control).
- Order effects (treatment-first vs control-first).
- SIM stimulus-card accuracy as a separate materials-validation result.
- Qualitative: where control users looked (npm search vs Google).

### Statistical honesty

- Because trials repeat within participants, label raw percentages as
  **descriptive** unless uncertainty is participant-aware.
- If reporting intervals, use a participant-cluster bootstrap or another
  predeclared clustered/paired method. Do not use standalone Wilson or exact
  binomial intervals that assume independent trials.
- Improvement example: treatment 17/18 (94%), control 12/18 (67%) → Δ = 27 pp;
  the descriptive thresholds pass, while uncertainty must still respect the
  participant clusters.
- Do **not** claim significance without a planned participant-aware test;
  paired analyses such as McNemar must also account for repeated tasks within
  each participant or be labeled exploratory.

### Aggregation rules

- Report the predeclared LIVE trial-level gate metrics and the participant-level
  distribution together so one participant cannot dominate the narrative.
- Pre-specify: if a participant completes fewer than 4 of 6 tasks, drop that participant’s trials (see stop rules).

---

## 12. Pre-registration-style rules

### Stop rule

- **Target:** 36 scored trials (6 participants × 6 tasks). Minimum for gate: **30 scored trials** with **roughly equal** treatment/control counts (difference ≤ 2 trials).
- **Stop recruiting** when 36 scored trials are in hand **or** two-week quiet beta ends—whichever comes first. If end date hits with 30–35 trials, analyze what you have; if &lt;30, gate is **incomplete**, not fail.
- **Do not** peek and stop early because treatment looks good (no optional stopping for success). Hard floor 30 only for “complete enough to score the gate.”

### What counts as a drop

| Event | Action |
| --- | --- |
| Consent withdrawn | Drop all of that participant’s trials |
| Tech failure (CLI crash, blank npm, no network) with no recovery | Unscored; replace trial if possible |
| Participant used `di` during control | Drop that trial; note protocol deviation; if systemic, mark condition contaminated |
| Participant saw answer key | Drop remaining tasks for that person |
| &lt;4 tasks completed | Drop participant |
| LIVE fallback to mock | Keep trial; flag in notes |

### Exclusion after scoring starts

Do not exclude slow-but-finished trials. Do not exclude “too wrong” outliers.

### Amendments

Log any change to task bank keys, design (within→between), or thresholds in `RESULTS.md` with date. Thresholds themselves are fixed by ROADMAP unless the project formally revises the gate.

---

## 13. Materials checklist for the maintainer

- [ ] Printed/PDF participant scenarios (control + treatment variants)
- [ ] Runner keys (this doc §8–9)
- [ ] Consent + debrief text
- [ ] Spreadsheet or markdown log for answers
- [ ] Optional: global `domaininstall` + Node ≥22.14 for T1 live verify
- [ ] Link to short README excerpt for same-day comprehension study

---

## 14. How this gate feeds the decision

If Gate 4 **fails** (treatment &lt;90% or Δ &lt;20 pp) with adequate n: evidence is weak that domaininstall reduces wrong-package selection in this protocol—**do not expand the CLI** on discovery grounds alone (see ROADMAP decision rule; also consider Gates 1 and 6).

If Gate 4 **passes**: discovery benefit is supported for quiet-beta purposes; still require other gates for “continue CLI.”
