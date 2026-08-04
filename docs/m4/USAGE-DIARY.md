# Gate 5 — Usage diary and counting rules

**Gate (from ROADMAP):** ≥10 **external users**, ≥25 **successful uses**, ≥5 **repeat users**.

**Context:** Quiet two-week (or similar) beta before broad promotion. Single maintainer; no product analytics backend.

---

## 1. Definitions

### External user

A person who is **not** the primary maintainer of domaininstall and **not** a throwaway account created only to inflate counts.

**Include:**

- Colleagues, friends, students, open-source acquaintances
- Maintainers who published a mapping and also ran the CLI as a consumer
- People who installed from npm or from a clone and ran `di` / `domaininstall` / `dnstall` themselves

**Exclude:**

- The primary maintainer’s own habitual use (may log separately as “maintainer smoke,” not toward Gate 5)
- Automated CI of *this* repository (e2e jobs)
- Duplicate identities (same human, two emails → one user)
- Sockpuppets created for the gate

**Identity for counting:** stable handle agreed with the person (GitHub login, email hash known only to maintainer, or diary pseudonym). Prefer **self-report + optional corroboration** over covert tracking.

### Successful use

One **successful use** is a single episode where the tool **resolves a domain mapping** in a way that shows real utility—not a failed lookup and not a dry run that never contacted resolution.

**Count as success (pick one primary action per episode):**

| Action | Success when |
| --- | --- |
| `di verify <domain>` | Mapping found and displayed (exit success / clear “mapping found” outcome)—including first-time and already-pinned |
| `di <domain>` (install path) | Mapping resolved and user reached the pre-install preview **or** completed install after confirm |

**Do not count as success:**

- `di --help`, `--version`, install of the `domaininstall` package itself
- Verify/install that fails: no record, ambiguous records, network/DoH failure, invalid name
- Purely reading the README without running the CLI
- Maintainer-only test loops against mocks in unit tests

**Episode boundaries:** Multiple verifies of the **same** domain in one sitting (same hour, debugging) count as **one** successful use unless the user intentionally documents them as separate attempts on different days. Different domains in one sitting count separately (e.g. three domains verified → up to three uses).

### Repeat user

An external user with **≥2 successful uses** that are separated by **either**:

- **different calendar days**, or  
- **different domains** (same day still OK if two distinct domains resolved successfully)

Examples:

| Pattern | Repeat? |
| --- | --- |
| Day 1: verify A; Day 3: verify A again | Yes |
| Day 1: verify A and verify B | Yes (two domains) |
| Day 1: verify A three times while debugging | No (one use) |
| Day 1: verify A; never again | No |

---

## 2. Why there is no automatic telemetry

domaininstall intentionally ships **without** phoning home:

- The trust model is local (DNS via DoH, pins in `~/.domaininstall/pins.json`, npm on the user’s machine).
- Usage telemetry would collect domains, package names, and timing—sensitive supply-chain context—without a clear privacy program or legal review for a single-maintainer alpha.
- Silent telemetry would contradict the project’s narrow, explicit-trust posture and would be hard to disclose honestly in a tiny CLI.
- Gate 5 is a **validation** exercise, not a growth dashboard. Manual, consenting measurement is enough to decide pivot vs continue.

**Therefore:** counts come from **opt-in diaries**, **short interviews**, **publisher anecdotes** (with care), and maintainer-visible signals the user chose to share (e.g. “I ran verify” in a chat). No hidden analytics in the CLI for this gate.

---

## 3. Optional consenting diary template

Share this markdown form with volunteers who agree to log beta use. They keep the file locally or paste entries to the maintainer. **Do not** request the contents of `pins.json` unless the user volunteers a redacted excerpt.

```markdown
# domaininstall usage diary (optional)

## Consent

- I am not the primary maintainer of domaininstall.
- I agree to share the entries below with the maintainer for Milestone 4 Gate 5.
- I will **not** paste secrets, tokens, or full pin files.
- I may stop anytime; I can ask for my diary to be deleted from the maintainer’s notes.

Pseudonym or handle: _______________
Contact (optional): _______________
Approximate environment: OS ________  Node ________  how installed (npm global / clone): ________

---

## Entry

**Date (YYYY-MM-DD):**  
**Command:** `di verify` / `di <domain>` / other:  
**Domain (or “redacted”):**  
**Outcome:** mapping found / no record / error / install completed / stopped at preview  
**Domain same as a previous entry?** yes / no  
**Notes (optional, one line):**  

---

## Entry

**Date (YYYY-MM-DD):**  
**Command:**  
**Domain:**  
**Outcome:**  
**Domain same as a previous entry?**  
**Notes:**  

<!-- duplicate Entry blocks as needed -->

## End of diary

Approximate total successful uses (your count): ___  
Would you use this again? yes / no / not sure  
```

### Maintainer ingest

When a diary arrives:

1. Confirm external user (new row in user table if needed).  
2. Count successful uses per definitions.  
3. Mark repeat user when criteria met.  
4. Store only what is needed for Gate 5; delete raw diaries on request.

---

## 4. Interview questions (5)

Use after at least one successful use, or at end of beta. Keep to ~10 minutes.

1. **Trigger:** What made you run `di verify` or install-by-domain the first time (docs, friend, mapping in a README, curiosity)?  
2. **Replacement:** What would you have done instead (npm search, Google, copy-paste from memory, other)?  
3. **Trust:** After using it, what do you believe it proves—and what are you still unsure about?  
4. **Friction:** What almost stopped you (install, DNS, Node version, unclear output, no mapping for the domain you cared about)?  
5. **Return:** Would you run it again on another day or another domain? Why or why not?

**Notes for the interviewer:** Do not lead toward “it’s a security scanner.” If they over-claim, gently correct and consider inviting them to Gate 6 items. Interview answers do not replace diary counts but can **corroborate** a successful use (“I verified example.com last Tuesday”).

---

## 5. Publisher-side anecdotal counts (“someone ran verify”)

Publishers who added `_dnstall` may say “a user ran verify” without that user joining the diary program.

**Allowed with care:**

- Count **at most one external user** and **at most one successful use** per independent anecdote that includes a **plausible, first-hand** report (e.g. “Alex on our team ran `di verify our.domain` and it showed `our-pkg`”).
- Prefer the **user** filing a diary entry when possible; anecdote is a fallback.

**Do not:**

- Count page views, README badge impressions, or DNS query volume as successful uses (those are not verified human CLI successes).
- Count the publisher verifying **their own** domain toward “external user” if they are only testing publish—unless they are not the domaininstall maintainer and clearly act as a consumer later.
- Stack multiple vague “people tried it” comments into many uses without names/dates.
- Double-count the same person via anecdote **and** diary.

**Logging template for anecdotes:**

```text
date_heard:
source_publisher:
alleged_user:
domain:
evidence_quality: first-hand / second-hand / vague
counted_as: user_id? use_id? / not counted
reason:
```

---

## 6. Privacy

| Data | Rule |
| --- | --- |
| Pins (`~/.domaininstall/pins.json`) | **Do not collect** unless the user explicitly consents and redacts unrelated domains |
| Domains tried | Optional in diary; allow “redacted” |
| Package names resolved | Optional; useful for debugging mappings |
| Contact info | Optional; for follow-up only |
| Interview notes | Store minimally; no public naming without permission |
| Public writeups | Aggregate only (“12 external users, 28 successful uses”) unless someone agrees to be quoted |

If a user pastes a full pin file by mistake: delete it from chat/email, ask them to rotate nothing (pins are local trust state, not credentials), and re-request a redacted diary.

---

## 7. Maintainer scorecard (running tally)

Copy into notes or fill `RESULTS.md` at the end of beta.

```text
## Gate 5 running tally

External users (unique): 0 / 10
  list: 

Successful uses: 0 / 25
  (verify: 0, install-path: 0)

Repeat users: 0 / 5
  list:

Anecdotes counted (subset of above): 0
Protocol deviations:
```

### Pass / fail

| Requirement | Threshold | Pass when |
| --- | --- | --- |
| External users | ≥10 | Unique external users with ≥1 successful use each |
| Successful uses | ≥25 | Sum of successful uses across external users |
| Repeat users | ≥5 | Users meeting repeat definition |

All three must pass. Hitting 25 uses from 3 power users **without** 10 users or 5 repeaters still **fails**.

---

## 8. Practical tips for a quiet beta

- Ask each publisher recruit (Gate 1) whether they or a teammate will diary one verify.  
- Bundle Gate 5 with Gate 4 sessions: discovery participants who run live `di verify` can consent to one diary entry.  
- Prefer quality of definition over rushing to 25—**failed** verifies do not help the product story and must not be counted as successes.  
- If the beta ends under threshold: mark Gate 5 **fail** or **incomplete** honestly; do not lower definitions post hoc.
