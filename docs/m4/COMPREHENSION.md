# Gate 6 — Comprehension instrument

**Gate (from ROADMAP):** ≥80% of participants understand that the tool verifies the **mapping**, not **package safety**.

**Risk this gate addresses (R3):** Users over-read the security claim and skip real controls (lockfiles, provenance, review, scanners).

---

## 1. When to administer

Administer **after** both of the following, in order:

1. **README skim** — participant spends ~2–5 minutes on the project README (or a printed excerpt of “Why this exists,” “What is remembered,” and “What it does not promise”).
2. **One verify exposure** — either:
   - live: `di verify zuraai.xyz` (or another live mapping), **or**
   - mock preview card (same style as Gate 4 treatment materials).

Do **not** administer before any exposure (that measures prior belief, not tool communication).  
Do **not** coach answers. Clarifying “what the words mean” is OK; teaching the answer key is not.

**Suggested timing:** same session as Gate 4 debrief, or a short remote form after a demo call. Target **≥10 participants** for a stable percentage; gate is scored on all who complete the instrument under the exposure rules. If n&lt;10, report as provisional.

---

## 2. Instructions (participant-facing)

> Based on the README and the verify preview you just saw, answer the questions below.  
> Choose the **best** answer. This is about what **domaininstall** claims to do—not what you wish it did.  
> There is no grade for your job or course; wrong answers help us fix the docs.

---

## 3. Items (7)

Items **C1, C2, C3** are **critical**. A participant **passes** the instrument only if **all three critical items are correct**. Non-critical items inform doc fixes but do not block “comprehends.”

---

### C1 — Critical — primary claim

**domaininstall’s main security-relevant promise is:**

- A) The npm package code has been audited and is free of malware  
- B) The domain-to-package **mapping** declared in DNS is what the tool shows / uses, with continuity checks after first use  
- C) The domain owner also controls the npm publisher account and GitHub repo  
- D) Lifecycle scripts are a full substitute for reviewing dependencies  

**Correct: B**

---

### C2 — Critical — not a malware scanner

**True or false:** Passing `di verify` means the package is safe to run in production without further review.

- A) True  
- B) False  

**Correct: B (False)**

---

### C3 — Critical — scripts disabled ≠ audited code

**domaininstall installs with dependency lifecycle scripts disabled (`--ignore-scripts`). This means:**

- A) The package and its dependency tree have been audited for vulnerabilities  
- B) Install-time scripts won’t run during that install—**not** that the code is trustworthy or free of later runtime risk  
- C) DNSSEC has validated the JavaScript source  
- D) You can skip lockfiles and provenance  

**Correct: B**

---

### C4 — TOFU limits for first-time users

**Trust-on-first-use (TOFU) pins help most when:**

- A) You have **never** used this domain before—the first mapping is cryptographically proven honest  
- B) You **return** later and the mapping **changed**—you get a warning you can’t casually ignore  
- C) The domain expired and was bought by an attacker on your very first visit—the pin still protects you  
- D) npm removed a typosquat automatically  

**Correct: B**

---

### C5 — Domain expiry / first use

**True or false:** If you mistype the domain or use a domain that recently expired and was re-registered, domaininstall can still fully protect you on **first** use the same way a long-held pin would.

- A) True  
- B) False  

**Correct: B (False)**

---

### C6 — What verify does *not* prove

**Which statement matches the docs?**

- A) `di verify` proves the domain owner controls the npm 2FA account  
- B) `di verify` proves continuity of the published domain→package declaration (as resolved), not package safety  
- C) `di verify` replaces `npm audit`  
- D) `di verify` guarantees the latest version is not malicious  

**Correct: B**

---

### C7 — Appropriate next controls

**After domaininstall resolves a package name, you should still:**

- A) Rely only on the green check from verify  
- B) Use normal supply-chain practice as needed (lockfiles, registry provenance, review, scanners)—domaininstall does not replace them  
- C) Disable your firewall  
- D) Always run with `--yes` and skip the preview  

**Correct: B**

---

## 4. Answer key (summary)

| Item | Critical? | Correct | Theme |
| --- | --- | --- | --- |
| C1 | **Yes** | B | Verifies mapping, not package safety |
| C2 | **Yes** | B (False) | Not a malware / “safe package” stamp |
| C3 | **Yes** | B | Scripts off ≠ audited code |
| C4 | No | B | TOFU helps on change, not first sight |
| C5 | No | B (False) | Domain expiry / first-use risk |
| C6 | No | B | Verify scope restated |
| C7 | No | B | Keep other controls |

---

## 5. Scoring rule

### Participant-level: “comprehends” (binary)

A participant **comprehends** if and only if **C1, C2, and C3 are all correct**.

- Fail any one critical item → participant does **not** count as comprehending (even if C4–C7 are perfect).
- C4–C7 are **diagnostic only** for README/CLI copy.

### Gate-level

\[
\text{Comprehension rate} = \frac{\text{number who comprehend}}{\text{number who completed the instrument after valid exposure}}
\]

**Pass:** rate **≥ 80%**.  
**Fail:** rate **&lt; 80%** with adequate sample.  
**Incomplete:** fewer than 5 completers (too thin to decide; keep recruiting).

### Worked examples

| Completers | Comprehend (critical set) | Rate | Gate |
| --- | --- | --- | --- |
| 10 | 8 | 80% | Pass |
| 10 | 7 | 70% | Fail |
| 12 | 10 | 83% | Pass |
| 5 | 4 | 80% | Pass (minimum honest n; note fragility) |

### Optional secondary score

Report mean number correct out of 7 for doc quality. **Do not** use “≥80% of items correct” as a substitute for the critical-set rule—the gate is about not over-claiming safety.

---

## 6. Administration checklist

1. [ ] Participant skims README / excerpt  
2. [ ] One `di verify` or mock preview  
3. [ ] Instrument without answer key  
4. [ ] Score critical set blind to whether you “like” the participant  
5. [ ] If fail → debrief script below; optionally point to SECURITY.md  
6. [ ] Log: participant id, exposure type (live/mock), C1–C7, comprehend y/n  

### Drop / exclude

| Event | Action |
| --- | --- |
| No README and no verify exposure | Do not score for gate |
| Maintainer coached critical answers | Exclude |
| Incomplete critical items | Exclude from denominator |
| Open-book retest after debrief | Do not use for gate (learning effect) |

---

## 7. Debrief script if they fail

Use a calm, non-shaming tone. Goal: correct the mental model, not “gotcha.”

> Thanks for the answers—this part is hard because a lot of tools blur “verified” and “safe.”
>
> **What domaininstall actually does:** it looks up a DNS record the **domain owner** published and shows which **npm package name** that domain declares. After you’ve seen a mapping once, it can warn you if that mapping **changes** later (trust on first use).
>
> **What it does *not* do:** it does **not** scan for malware, audit source code, prove the domain owner is the npm publisher, or make install-time “scripts disabled” equal to “this dependency tree is safe.”
>
> **First-time risk:** if the domain is wrong, expired, or newly hijacked before you have a pin, TOFU can’t save that first resolution.
>
> Keep using lockfiles, provenance, review, and scanners for package trust. domaininstall is only about **which package name the domain claims**.
>
> If something in the README made it sound stronger than that, please tell us which sentence—that’s a docs bug we want to fix.

---

## 8. If the gate fails

Per ROADMAP: do **not** expand the CLI on the assumption users understand the narrow claim. Prioritize copy changes (README, CLI preview, SECURITY.md), then re-run the instrument with a **new** cohort (or clearly marked retest after substantial doc revision). Log both attempts in `RESULTS.md`.
