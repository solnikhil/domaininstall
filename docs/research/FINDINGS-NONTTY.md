# Findings — Non-TTY / machine-readable design

**Date:** 2026-08-04  
**Inputs:** `ROADMAP.md` G4 / §8 bet 2–3, `src/cli.ts` (install, verify, pin + `--yes`), `src/ui.ts` (`confirm` non-TTY → false), `src/args.ts`, `src/pin.ts` (pin fields), `src/doh.ts` (outcomes).  
**Scope:** Design only. **Do not implement** in this research pass.

---

## Goals

Close roadmap gap **G4** and enable growth bets:

1. **`di resolve --json`** — machine-readable resolution without install.
2. **Deterministic exit codes** for scripts, CI, and agents.
3. **Pin-change policy** that never auto-approves a mapping move under `--yes` or non-TTY.
4. Sketch **agent/CI allowlist mode** as the org-level control surface.

Interactive confirmation remains the human safety default. Machine mode is explicit and stricter, not a silent downgrade.

---

## 1. `di resolve --json` — versioned schema

### Command shape (proposed)

```text
di resolve <domain>[/sub][@version] --json
di resolve <domain> --json --schema-version 1
```

- **No install.** No npm spawn. No write to the pin store by default.
- **Stdout:** single JSON document only (no color, no progress lines on stdout).
- **Stderr:** human diagnostics optional; for CI prefer `--json` alone so stderr is empty on success.
- **Default when stdout is not a TTY:** still require `--json` or an explicit `--format json` so accidental piping does not change semantics without opt-in.
- **Schema version:** integer field `schemaVersion` inside the payload; CLI flag `--schema-version` rejects unknown versions.

### Success document (`schemaVersion: 1`)

```json
{
  "schemaVersion": 1,
  "ok": true,
  "command": "resolve",
  "cliVersion": "0.0.3",
  "resolvedAt": "2026-08-04T12:00:00.000Z",
  "input": {
    "target": "example.com/cli@^2",
    "domain": "cli.example.com",
    "apexHint": "example.com",
    "sub": "cli",
    "cliVersionOverride": "^2"
  },
  "dns": {
    "name": "_dnstall.cli.example.com",
    "outcome": "answer",
    "provider": "cloudflare-dns.com",
    "authenticated": false,
    "dnssec": "no_ad",
    "attempts": [
      {
        "provider": "https://cloudflare-dns.com/dns-query",
        "outcome": "answer",
        "status": 0
      }
    ]
  },
  "record": {
    "namespace": "npm",
    "package": "example-cli",
    "dnsVersionPolicy": "^1",
    "effectiveVersion": "^2",
    "versionSource": "cli",
    "metadata": {}
  },
  "installHint": {
    "packageSpec": "example-cli@^2",
    "registry": "https://registry.npmjs.org/",
    "scripts": "disabled",
    "note": "Hint only; resolve does not install. Registry may differ if @scope:registry is set — install path re-resolves."
  },
  "pin": {
    "present": true,
    "matches": true,
    "firstSeen": "2026-07-01T00:00:00.000Z",
    "lastSeen": "2026-08-01T00:00:00.000Z",
    "stored": {
      "namespace": "npm",
      "package": "example-cli",
      "registry": "https://registry.npmjs.org/",
      "dnsVersion": "^1"
    },
    "changes": []
  },
  "policy": {
    "pinChange": "none",
    "requiresInteractiveConfirmForInstall": false,
    "yesWouldBeHonoredForInstall": true
  }
}
```

### Field notes

| Field | Meaning |
| --- | --- |
| `schemaVersion` | Breaking changes bump integer; consumers pin major. |
| `ok` | `true` only when a single supported mapping is usable. |
| `dns.outcome` | Align with `doh.ts`: `answer` \| `nodata` \| `nxdomain` \| `provider_exhaustion`. |
| `dns.dnssec` | Stable enum: `ad` \| `no_ad` (maps from `authenticated`; avoid bare “DNSSEC ✓” in JSON). |
| `record.versionSource` | `cli` \| `dns` \| `none` (effective version precedence matches install today). |
| `pin.changes` | Same fields as `PinChange`: `namespace`, `package`, `registry`, `dnsVersion` with `was` / `now`. |
| `policy.pinChange` | `none` \| `changed` \| `first_use` (no pin yet). |
| `installHint.registry` | Best-effort default registry at resolve time; **install must re-resolve effective registry** (scope config). Document that resolve’s registry is advisory unless `di resolve` is later given cwd + package context like install. |

**v1 recommendation:** include `installHint.registry` only when resolvable without side effects; if scope registry would divert and cannot be pinned honestly, set:

```json
"installHint": {
  "packageSpec": "@scope/name@^1",
  "registry": null,
  "registryError": "scope_registry_divert",
  "scripts": "disabled"
}
```

and still `ok: true` for the **mapping** (resolution of domain→package succeeded). Install path continues to hard-fail on divert.

### Failure document (`ok: false`)

```json
{
  "schemaVersion": 1,
  "ok": false,
  "command": "resolve",
  "cliVersion": "0.0.3",
  "resolvedAt": "2026-08-04T12:00:00.000Z",
  "input": {
    "target": "missing.example",
    "domain": "missing.example",
    "sub": null,
    "cliVersionOverride": null
  },
  "error": {
    "code": "DNS_NODATA",
    "message": "No TXT record exists at _dnstall.missing.example (NODATA).",
    "dnsName": "_dnstall.missing.example",
    "dnsOutcome": "nodata"
  },
  "pin": null
}
```

### Stable `error.code` values (v1)

| Code | When |
| --- | --- |
| `USAGE` | Bad args / unknown flags |
| `INVALID_TARGET` | Domain/target parse failure |
| `DNS_NXDOMAIN` | Name does not exist |
| `DNS_NODATA` | Name exists, no TXT |
| `DNS_PROVIDER_EXHAUSTION` | All resolvers failed transiently |
| `DNS_NO_VALID_RECORD` | TXT present but not valid `dnstall=` |
| `DNS_UNSUPPORTED_NAMESPACE` | Valid record, not npm (v0) |
| `DNS_CONFLICT` | Multiple distinct mappings |
| `INVALID_PACKAGE_NAME` | Mapping package fails validation |
| `INVALID_VERSION` | Version policy/range invalid |
| `PIN_STORE_UNSAFE` | Trust store corrupt/unsafe (fail closed) |
| `INTERNAL` | Unexpected throw |

Emit JSON on failure when `--json` was requested (so agents always parse stdout). Exit code still non-zero.

### Non-goals for resolve v1

- Not a hosted HTTP API (bet 2 “hosted endpoint” is separate).
- Does not run npm install or write pins.
- Does not verify npm package existence, provenance, or tarball hash.
- Does not implement allowlist policy (that is a separate command or flag set).
- Does not support pnpm/Yarn/Bun project detection (install concern).

### Compatibility

- Document schema in a short `docs/resolve-schema-v1.md` (or section of README) when implementing.
- Additive fields allowed without bump; removals/renames require `schemaVersion` bump.
- Consumers should ignore unknown fields.

---

## 2. Exit code table

Align with current behavior where sensible:

- Install abort on decline → **130** (already in `cli.ts`).
- Generic failure → **1**.
- Success → **0**.
- npm failure → npm’s exit code (current install path).

### Proposed stable table (install / verify / resolve)

| Code | Meaning | `install` | `verify` | `resolve --json` |
| --- | --- | --- | --- | --- |
| **0** | Success | Install finished; pin saved | Mapping valid | `ok: true` |
| **1** | Generic / usage / validation / DNS no mapping / conflict / unsafe pin store | Yes | Yes | Yes (`ok: false`) |
| **2** | **Pin mapping or policy changed** (diff non-empty) | **Yes — refuse non-interactive install** | Optional: still 0 if record valid, or **2** if `--strict-pin` | **2** when pin present and `changes.length > 0` (even if `ok: true` for DNS) |
| **3** | DNS resolver exhaustion / transport failure (distinct from “no record”) | Yes | Yes | Yes (`DNS_PROVIDER_EXHAUSTION`) |
| **4** | Project / package-manager refusal (non-npm project, scope registry divert, etc.) | Yes | N/A or soft warn | Soft: may still resolve mapping |
| **5** | Reserved: policy deny (allowlist miss) for agent mode | Future | Future | Future |
| **130** | Aborted interactive confirm (user said no / non-TTY without `--yes`) | Yes | trust reset without force | N/A (resolve never prompts) |

### Pin-change + exit code interaction (install)

| Situation | Interactive | `--yes` | Non-TTY without `--yes` |
| --- | --- | --- | --- |
| First use (no pin) | Confirm → 0/1/130 | Skip confirm → 0/1 | No confirm → **130** (today: `confirm` returns false) |
| Pin matches | Confirm → 0/1/130 | Skip confirm → 0/1 | Needs `--yes` else **130** |
| Pin **changed** | Force interactive; ignore `--yes` | **Ignore `--yes`**; still need human yes | **Hard fail: exit 2** — never treat as first use, never auto-save new pin without explicit override |

**Today:** pin change sets `requireInteractive`, warns, ignores `--yes`, and on non-TTY `confirm` returns false → exit **130**. That is safe but **ambiguous** (looks like “user cancelled”). **Design change:** use **exit 2** for pin-change denial in non-TTY / agent paths so CI can alert on *trust event* vs *user abort*.

### Verify exit codes

Keep verify non-mutating and simple:

| Outcome | Exit |
| --- | --- |
| Valid single mapping | 0 |
| No/invalid/conflict/DNS fail | 1 or 3 per table |
| Pin mismatch (optional `--strict-pin`) | 2 with message; still print current mapping |

Default verify without `--strict-pin`: exit 0 on valid record even if pin differs (diagnostic tool); show pin diff on stderr/stdout as today.

### Resolve exit codes

| Outcome | Exit | `ok` |
| --- | --- | --- |
| Mapping resolved, no pin or pin matches | 0 | true |
| Mapping resolved, pin **changed** | **2** | true (DNS ok; policy attention) |
| Mapping resolved, first use | 0 | true (`policy.pinChange: first_use`) |
| No mapping / invalid / conflict | 1 | false |
| Resolver exhaustion | 3 | false |
| Bad usage | 1 | false |

**Rationale for exit 2 + `ok: true`:** agents can branch: “DNS says X, but local trust says changed — do not install.” JSON remains parseable without treating DNS as failed.

---

## 3. Pin-change policy for CI

### Hard rules (non-negotiable)

1. **Never honor `--yes` through a mapping or pinned-policy change.**  
   Already true for interactive install; must remain true for any future `--ci` / `--agent` mode.
2. **Never auto-update the pin on change in non-interactive mode.**  
   New identity must not become trusted because a pipeline passed a flag.
3. **CI must fail closed on pin change** with exit **2** and a machine-readable reason (`PIN_CHANGED` in JSON if applicable).
4. **No “approve pin change” flag in v1 CI mode** such as `--accept-pin-change` shipped casually. If ever added:
   - Require a **second** explicit flag (e.g. `--i-accept-mapping-change`) plus logging of old/new.
   - Prefer **out-of-band** pin refresh: human runs interactive install or `di trust …` after review.
5. **dnsVersion / registry / namespace / package** all count as change fields (current `diffPin`). Treat equally.

### Recommended CI pattern

```text
# 1) Resolve and enforce pin continuity
di resolve example.com --json
# exit 0 → mapping OK and pin OK (or first_use — see below)
# exit 2 → PIN_CHANGED: stop pipeline, human review
# exit 1/3 → no mapping or DNS failure

# 2) Only if exit 0 and org policy allows, install with scripts still disabled
di example.com --yes
```

### First-use in CI

First use has **no pin to compare**. Options (pick one org policy; document both):

| Mode | Behavior |
| --- | --- |
| **A — Fail first use in CI (recommended default for agents)** | Exit **5** or dedicated code later; require pre-seeded pin store or allowlist entry before install. |
| **B — Allow first use with `--yes`** | Current human `--yes` behavior; acceptable only if the domain list is already constrained by allowlist mode. |

Design recommendation: **agent/CI allowlist mode implies first-use is allowed only if the domain is on the allowlist**; the pin is written after successful install. Still never auto-accept *change*.

### What CI should not do

- `di example.com --yes` as the only gate without a prior pin or allowlist.
- Parsing human preview text instead of `--json`.
- Treating DNSSEC AD as package approval.
- Sharing a writable pin store across untrusted jobs without locking/ACLs.

---

## 4. Agent / CI allowlist mode sketch

### Intent

Turn domaininstall from “convenient install by domain” into **“only install packages declared by these domains.”** One organization can adopt without public publisher network effects.

### Proposed UX (sketch)

```text
di policy check --allowlist ./domains.txt --json
di install example.com --ci --allowlist ./domains.txt
# or
di example.com --ci --allow-from example.com,other.org
```

**Allowlist file (example):**

```text
# domains that may be resolved/installed
example.com
payments.example.com
# optional: pin expected package
# example.com = payments-sdk
```

### Evaluation order

1. Parse target domain (after sub-label rules).
2. Domain (or parent rule, if we ever support suffixes — **v1: exact domain match only**) must appear on allowlist → else exit **5** `POLICY_DENY`.
3. Resolve DNS mapping (same as today).
4. Optional expected-package line: if allowlist pins package name, mismatch → exit **5**.
5. Pin store: change → exit **2**; match → continue.
6. Install only with same safety properties: effective registry honesty, `--ignore-scripts`, no shell interpolation of DNS text.
7. `--yes` / `--ci` skips *human* confirm only when steps 2–5 pass.

### Non-goals (explicit)

| Non-goal | Why |
| --- | --- |
| Replace npm provenance / Sigstore | Different layer; complementary |
| Full malware scanning / SBOM gate | Out of scope; non-goal in ROADMAP §1 |
| Remote centralized allowlist SaaS in v1 | Org ships file or config in repo |
| Automatic pin acceptance on change | Trust regression |
| Silent multi-package resolution from one domain | Still one mapping per DNS name; conflicts fail |
| Network-wide “app store” of domains | M4 supply problem; not required for org mode |
| Disabling `--ignore-scripts` in CI mode | Safety property stays |
| Supporting pnpm/Yarn/Bun before their install paths exist | Same refuse as today |

### Minimal viable agent loop

```text
agent plans: need SDK for vendor at vendor.example
→ di resolve vendor.example --json
→ if ok && package in allowlist domain set && pin ok
→ di vendor.example --yes --ci
→ else refuse and ask human
```

### Relationship to resolve

- **`resolve --json`** is the read-only primitive.
- **Allowlist mode** is policy *around* resolve/install.
- Hosted verification API (bet 2) can expose the same JSON schema over HTTP later; exit codes map to HTTP 200 / 409 (pin change) / 404 (no record) / 502 (resolver).

---

## 5. Implementation sequencing (when code is allowed)

Not part of this research deliverable — order for later:

1. Schema doc + `di resolve --json` + exit codes 0/1/2/3 (no install).
2. Align install non-TTY pin-change to exit **2** (breaking for scripts that treated 130 as pin-change — document in CHANGELOG).
3. Allowlist file + `--ci` policy check.
4. Hosted API only if third-party demand appears post-M4.

---

## 6. Summary

| Topic | Design choice |
| --- | --- |
| Resolve JSON | Versioned `schemaVersion: 1`, single stdout object, stable `error.code` |
| Pin change | Hard fail; never `--yes` through; CI exit **2**; no auto pin update |
| First use in CI | Prefer allowlist-required; optional fail-closed without pre-seed |
| Agent mode | Org allowlist + resolve + install; not a malware product |
| Non-goals | No provenance replacement, no silent trust upgrades, no telemetry |
