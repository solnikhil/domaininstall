# Findings — Positioning

**Date:** 2026-08-04  
**Inputs:** `README.md`, `SECURITY.md`, `ROADMAP.md` §7–8, `RESEARCH-demand-and-prior-art.md`, `docs/m4/COMPREHENSION.md`, `docs/m4/PLACEMENT-SNIPPETS.md`, `src/cli.ts` (DNSSEC badge, `--yes`/pin-change), `src/ui.ts` (non-TTY confirm).  
**Scope:** Product positioning only — no code changes.

---

## One-paragraph honest positioning

**domaininstall is not a competitor to npm provenance or Sigstore.** Provenance cryptographically binds a published tarball to a source repo and build identity (who built what, from which commit, under which CI). Sigstore/SLSA answer *build integrity* and *publisher CI identity*. **domaininstall answers a different question:** “Which npm package name does this *domain* currently declare, and has that declaration *changed* since I last trusted it?” It resolves a public DNS TXT mapping (`_dnstall.<domain>` → `pkg:npm/...`), shows an exact install plan, pins the mapping under trust-on-first-use, and refuses to let `--yes` wave away a pin change. It does **not** prove the package is safe, that the domain owner controls the npm 2FA account, or that a new version is trustworthy. Use it **alongside** lockfiles, provenance, allowlists, and review — never instead of them. The product thesis is a network of domain→package *declarations* (publisher supply); without external mappings, the CLI is a well-engineered demo of one maintainer’s domain.

---

## Killer one-liner for publishers

> **Publish one DNS TXT so anyone who already trusts your domain can install the exact package name you declare — without guessing your npm name.**

Alternate (slightly more security-literate):

> **Make your domain the canonical pointer to your official npm package name — mapping continuity, not a safety scan.**

---

## Killer one-liner for security buyers

> **Policy control for agents and CI: only install packages whose domain-to-package mapping matches an allowlist — and hard-fail if the mapping moves.**

Alternate (for humans / install hygiene):

> **Stop agents and humans from guessing package names: resolve from a domain you already trust, pin the mapping, and never auto-approve a repoint.**

---

## Continue vs pivot decision tree

Mirror of `ROADMAP.md` §7 decision rule, made operational.

```text
                    START M4 quiet beta
                            │
                            ▼
              ┌─────────────────────────────┐
              │ Gate 1 — Publisher supply   │
              │ ≥20 contacted, ≥5 external  │
              │ live mappings               │
              └─────────────┬───────────────┘
                            │
              fail / clearly will not hit ──► PIVOT
                            │
                          pass / on track
                            │
                            ▼
              ┌─────────────────────────────┐
              │ Gate 4 — Discovery benefit  │
              │ ≥30 trials, A_T≥90%,        │
              │ Δ≥20pp vs ordinary search   │
              └─────────────┬───────────────┘
                            │
                         fail ────────────────► PIVOT
                            │
                          pass
                            │
                            ▼
              ┌─────────────────────────────┐
              │ Gate 6 — Comprehension      │
              │ ≥80% critical set: mapping  │
              │ ≠ package safety            │
              └─────────────┬───────────────┘
                            │
                         fail ────────────────► PIVOT
                            │
                          pass
                            │
                            ▼
              Gates 2 / 3 / 5 (setup, place, usage)
              inform severity and sequencing
                            │
                            ▼
              ┌─────────────────────────────┐
              │ CONTINUE CLI thesis         │
              │ Pursue growth bets §8 order │
              │ 1) publisher onboarding     │
              │ 2) resolve --json / API     │
              │ 3) agent/CI policy mode     │
              └─────────────────────────────┘
```

### When to **freeze the interactive CLI** and go agent/CI (or verification API)

| Signal | Action |
| --- | --- |
| Gate 1 fails (no real external mappings after honest outreach) | **Pivot.** Network-effect install CLI has no graph. Ship **org-local** value: allowlist + `di resolve --json` so one company can adopt without public supply. |
| Gate 4 fails (domain path does not beat ordinary discovery) | **Pivot.** Human “install by domain” convenience is weak. Keep resolution as a **policy primitive**, not a consumer install UX. |
| Gate 6 fails (users read “safe package”) | **Do not expand CLI surface.** Fix copy / badges first; if still fails, **pivot** — a misread security product is worse than a narrow CI check. |
| Gate 1 passes but 2 fails (setup friction) | Do **not** expand install features. Only invest in **publisher onboarding** (`di setup`, registrar guides) — or accept low supply and still lean agent/CI. |
| Gate 1 + 4 + 6 pass | **Continue CLI.** Then grow: onboarding → machine-readable resolve → agent/CI policy → record spec. |
| Incomplete solely due to time | **Hold** once with same bars. Do not lower thresholds. Do not expand CLI on “vibes.” |

**Pivot shape (preferred order if hard-stop gates fail):**

1. **`di resolve --json`** — versioned, documented schema (see `FINDINGS-NONTTY.md`).
2. **Agent/CI allowlist mode** — “only packages declared by these domains,” deterministic exit codes, no TTY.
3. Optional later: hosted lookup API for orgs that will not run the CLI.

**What to stop spending on after pivot:** human install UX polish, multi-PM install paths as growth, broad launch marketing, “more CLI commands for humans.”

---

## DNSSEC badge wording — recommendation

### Problem

Today (`src/cli.ts`):

- Authenticated (DoH JSON `AD === true`): green **`DNSSEC ✓`**
- Not authenticated: gray **`DNSSEC —`**

Risks (aligned with `SECURITY.md`, comprehension C3 distractor, research backlog RB-GATE6):

1. **`DNSSEC ✓` reads as “cryptographically verified / safe package.”** It is only the **resolver’s AD bit** over DoH — not client-side chain validation, not package integrity, not ownership continuity after transfer.
2. **`DNSSEC —` looks like a failure.** Most domains are unsigned; “dash” can feel like a broken check.
3. The product does **not** pin DNSSEC state (Layer 1 partial). A green badge today does not re-check later.

### Decision: **change the badge strings**

Prefer explicit, low-ceremony labels that match what the code actually knows.

### Recommended preview strings (exact)

| Condition | Current | **Recommended (primary)** | Rationale |
| --- | --- | --- | --- |
| `authenticated === true` | `DNSSEC ✓` | `DNSSEC: AD` | Says “AD bit set,” not “package signed.” Short enough for the domain line. |
| `authenticated === false` | `DNSSEC —` | `DNSSEC: no AD` | Neutral absence, not a red fail. |

**Alternate if “AD” is too jargon-heavy for humans** (slightly longer; still honest):

| Condition | Recommended alternate |
| --- | --- |
| authenticated | `resolver: DNSSEC AD` |
| not authenticated | `resolver: unsigned/insecure` |

**Avoid:**

| Avoid | Why |
| --- | --- |
| `DNSSEC ✓` / green check alone | Over-reads as end-to-end validated |
| `Secure` / `Verified DNS` | Collides with package safety language |
| `DNSSEC failed` for unsigned zones | Most zones are unsigned; false alarm |
| Hiding the field entirely | Loses a real (limited) authenticity signal for power users |

### Recommended verify-mode one-liner (when authenticated)

After the badge line, optional dim detail (not required for install summary):

```text
  DNSSEC: AD  — resolver reported authenticated data (not package safety)
```

When not authenticated:

```text
  DNSSEC: no AD  — transport is DoH; answer not DNSSEC-authenticated
```

### Placement-snippet / marketing note

Static README badges in `PLACEMENT-SNIPPETS.md` should **not** say DNSSEC. Keep preferred claim badge:

> domaininstall — mapping only — not package safety

Do not add a “DNSSEC verified” shields.io badge.

### Comprehension probe (for Gate 6 / RB-GATE6)

Optional extra item after exposure to the preview:

> True or false: `DNSSEC: AD` (or a green DNSSEC mark) means the npm package source was audited.  
> **Correct: False.**

If that item fails often, prefer the longer “resolver: …” wording over `DNSSEC: AD`.

---

## Positioning checklist (do / don’t)

| Do | Don’t |
| --- | --- |
| “Domain → declared package name” | “Secure install from our domain” |
| “Mapping continuity / TOFU” | “Provenance alternative” |
| “Works with lockfiles and npm provenance” | “Replaces Sigstore / SLSA” |
| “Useful when you already trust the domain” | “Trust because of DNS” |
| Agent/CI: “allow only domain-declared packages” | “Malware-free allowlist” |

---

## Bottom line

- **Human CLI thesis** lives or dies on **publisher supply + comprehension** (M4 gates 1/4/6).  
- **Differentiation vs Sigstore** is *identity of package name via domain declaration + continuity*, not build attestation.  
- **Highest-leverage wedge if M4 fails:** freeze consumer install growth; ship **non-TTY resolve + org policy** so one buyer can get value without a two-sided market.  
- **DNSSEC badge should be reworded now in design intent** (`DNSSEC: AD` / `DNSSEC: no AD`) so Gate 6 is not fighting a green checkmark.
