# domaininstall roadmap

## About this document

This is the live operational roadmap — the single place for project status. It
records what’s shipped, what’s in flight, what’s knowingly incomplete, and what
would need to be true before the project grows further.

**How status works.** A box is checked only when the work is complete *and*
verifiable from outside the maintainer’s machine — a merged commit, a green CI
run, a published artifact, or a configured repository/registry setting. “It
passed on my laptop” is never enough on its own.

**Related documents**

| Document | Role |
| --- | --- |
| `README.md` | How the tool works for users, and current limits |
| `SECURITY.md` | Threat model and how to report vulnerabilities |
| `SECURITY-domain-ownership.md` | Design research on the ownership-change threat |
| `docs/m4/` | Milestone 4 product-validation kit (quiet beta) |
| `docs/RELEASE.md` | How to release, publish, and roll back |
| `CHANGELOG.md` | User-visible changes, from `0.0.3` onward |
| `docs/RELEASE-CANDIDATE.md` | Snapshot from the `0.0.1` RC — history only |
| `docs/HISTORY-AUDIT.md` | Pre-publication Git history audit — history only |
| `artifacts/` | Generated pre-publication checklist — history only |
| `NOTES.md`, `RESEARCH*.md` | Original research log — history only |
| `docs/RESEARCH-BACKLOG.md` | Open research questions from codebase review (not feature status) |
| `docs/research/` | Executed desk-research findings (2026-08-04+) |

Historical docs are frozen. If they disagree with this file, **this file wins**.

---

## 1. Product promise and non-goals

### Promise

`domaininstall` lets a project declare its official npm package from its own
domain. It checks continuity of that domain-to-package mapping, shows you
exactly what was resolved, and installs through npm with dependency lifecycle
scripts turned off.

The security claim is the same everywhere:

> It verifies continuity of a domain-to-package declaration. It does not prove
> that a package or package version is safe.

### Non-goals

`domaininstall` is not — and is not on a path to become — any of these:

- a package malware scanner or code auditor
- a source or build attestation system
- a package registry, mirror, or proxy
- a replacement for npm provenance, lockfiles, allowlists, or dependency review

These are non-goals, not “maybe later,” so scope creep has a documented answer.

---

## 2. Where the project actually stands

**Last verified 2026-08-04.** Each row was checked against the registry, the
repository, or a local run — not inferred from an older review.

| Dimension | State | Evidence |
| --- | --- | --- |
| npm releases | `0.0.1`, `0.0.2`, `0.0.3`; `latest` = `0.0.3` | Registry metadata; `0.0.3` published 2026-07-27 |
| Supply-chain metadata | SLSA v1 provenance attestation and registry signature on `0.0.3` | `npm view domaininstall@0.0.3 dist` |
| Published artifact | 12 files, 67 KB unpacked, zero production dependencies | Registry metadata; `npm run verify:package` |
| Repository | Public; `main` is default and protected; `v0.0.3` tagged | Repository settings; `git tag -l` |
| Retired branches | `feat/v0` is fully merged into `main` and retired — don’t branch from it | Merge history |
| Deterministic suite | 76 passed, 0 failed | `npm test` on Node 22.14 |
| CI matrix | 6 jobs: `ubuntu` / `macos` / `windows-latest` × Node `22.14.0` / `24.x` | `.github/workflows/ci.yml` |
| Live E2E | Ubuntu only; weekly cron, manual dispatch, and `v*` tags | `.github/workflows/e2e.yml` |
| Reference mapping | `_dnstall.zuraai.xyz` → `dnstall=pkg:npm/zuraai` resolves | Live E2E |
| External adoption | **Zero.** The only published mapping is the maintainer’s own domain | Milestone 4 quiet beta not complete; no external mapping live |
| M4 validation kit | Measurement materials and publisher guide under `docs/m4/` | Kit in progress; human gates not started |
| Maintainership | Single maintainer, best-effort security response, latest version only | `SECURITY.md` |

**The honest summary.** Release engineering and the security gate are ahead of
where a `0.0.x` project usually is. Product-validation materials are drafted
under `docs/m4/`; the quiet beta itself has not produced external adoption. The
binding constraint is publisher supply, not code quality.

---

## 3. Milestone history

### Milestone 0 — project truth *(shipped)*

No stray production dependencies; complete package metadata, README, MIT
license, security policy, and roadmap.

### Milestone 1 — P0 security gate *(shipped, before first publication)*

- Terminal sanitization of all untrusted text before display
- Distinct DNS outcomes for NODATA, NXDOMAIN, SERVFAIL, REFUSED, timeout,
  malformed response, and provider exhaustion — with fallback only where it’s
  safe. Authoritative answers (including negative ones) stop resolution, so a
  resolver outage can’t be mistaken for “this domain has no record”
- Refusal of conflicting mappings rather than silent selection
- Schema-validated, fail-closed TOFU store (POSIX owner-only, no-follow, atomic,
  lock-protected) with documented recovery and clear Windows ACL limits
- DNS version policy pinned separately from a CLI override, so a one-off
  `@version` can’t silently replace the domain’s declared policy
- Strict argument parsing before any DNS, install, or pin operation
- Deterministic adversarial tests for each of the above

### Milestone 2 — release engineering *(shipped)*

- Deterministic tests separated from live DNS/install tests
- CI with clean install, build, tests, production audit, and packed-artifact
  verification
- Live E2E on a schedule, on manual dispatch, and on release candidates
- Third-party actions pinned by full commit SHA, least privilege
- Git history audited before the repository went public
- Protected first-publish workflow and a written rollback procedure

### Milestone 3 — first publication *(shipped)*

`0.0.1` and `0.0.2` published from a protected workflow with provenance, and
verified from a clean environment.

---

## 4. Release 0.0.3

Published 2026-07-27. Scope: Windows correctness, registry honesty, and output
hygiene. See `CHANGELOG.md` for the user-facing list.

### Delivered

- [x] Support Windows by resolving npm’s own CLI entry point and running it with
      the current Node binary instead of spawning `npm.cmd` — so no npm argument
      is ever parsed by `cmd.exe`. Ranges like `^18` or `>=1 <2` contain
      characters that `cmd.exe` treats as escapes and redirections.
- [x] Refuse an install when `@scope:registry` would divert the request away
      from the registry that is displayed and pinned (npm gives scope-specific
      config precedence over `--registry`).
- [x] Derive the CLI version from `package.json` instead of a hardcoded literal
      in two places.
- [x] Send warnings and errors to standard error; keep standard output for
      previews and results.
- [x] Add `-g` / `--global` so a domain can install a CLI tool, with the
      resolved global prefix shown in the preview.
- [x] Extend CI to macOS and Windows on both supported Node versions.

### Release controls

- [x] Land the changes above on `main` through a PR with green CI on all six
      matrix jobs (including both Windows jobs).
- [x] Protect `main` and `v*` tags from force pushes and deletion.
- [x] Require all six Linux, macOS, and Windows matrix checks on `main`.
- [x] Enable npm account 2FA.
- [x] Protect the `npm-production` environment with staged human approval.
- [x] Confirm npm OIDC trusted publishing targets `publish.yml` and the
      `npm-production` environment.
- [x] Add a `CHANGELOG.md` starting at `0.0.3`.
- [x] Tag `v0.0.3` and publish with provenance.

### Outstanding exit gate

- [ ] Run the post-publication verification in `docs/RELEASE.md` from a clean
      machine on **Windows**, and record the result here.

**Partial evidence (2026-08-04, maintainer Windows workstation — not a clean
VM):** published `domaininstall@0.0.3` installed in a temp directory with empty
user npmrc and public registry; `di`, `domaininstall`, and `dnstall` all reported
`0.0.3`; `di verify zuraai.xyz` resolved `_dnstall.zuraai.xyz` → `zuraai`.
Launcher probe and residual risks:
[`docs/research/FINDINGS-WINDOWS-AND-SCRIPTS.md`](docs/research/FINDINGS-WINDOWS-AND-SCRIPTS.md).
**Gate remains open** until the same checks run on a clean Windows machine and
are recorded here.

This is the one incomplete item on the `0.0.3` line. It matters more than usual
because `0.0.3` introduced the Windows npm launcher, and because live E2E runs
on Ubuntu only — so no automated job exercises a real Windows install. Until
this is done, Windows support is covered by unit tests and the CI build, but not
by a clean-machine end-to-end install from the published artifact.

**Exit gate.** A fresh global install of `0.0.3` works on macOS, Linux, and
Windows, and the published artifact is reproducible from its tag.

---

## 5. Known gaps

Ordered by priority. Each gap says why it’s acceptable today and what would
close it — so a future decision doesn’t have to re-derive the reasoning.

| ID | Gap | Severity | Why acceptable now | Closed when |
| --- | --- | --- | --- | --- |
| G1 | Scope-specific registries (`@scope:registry`) are refused, not supported | High | Refusing is honest; the alternative was showing one registry and fetching from another | The per-scope registry is resolved and pinned as the effective registry for that package |
| G2 | `di trust` can only reset everything | High | Recovery exists and keeps a backup | `di trust list` and `di trust forget <domain>` ship, with tests for partial reset |
| G3 | Resolution depends on two hard-coded DoH providers with no fallback | High | Fail-closed beats an unauthenticated silent downgrade | An opt-in system-resolver fallback exists and is labelled unauthenticated in the preview, or providers are configurable |
| G4 | No non-interactive / machine-readable mode | High | Interactive confirmation is the core safety property for humans | `di resolve --json` ships with a stable schema and exit codes (see bet 2) |
| G5 | pnpm, Yarn, and Bun projects are refused | Medium | Non-npm lockfiles are detected and refused rather than mishandled | Each has a scripts-disabled install path plus its own adversarial tests |
| G6 | Every lookup discloses the requested domain to a third-party resolver | Medium | Documented in `SECURITY.md`; install and verify both show the DoH host | Closed for transparency (resolver shown). Disclosure itself is inherent to third-party DoH |
| G7 | Pins record mapping, registry, and DNS version policy only | Medium | Defeats the headline repoint attack for returning users | Publisher identity and tarball integrity are pinned and diffed (see §6) |
| G8 | Pins never expire | Medium | Continuity checks still run on every install | Pins carry a `maxAge` that forces full re-verification |
| G9 | No registration-liveness (RDAP) check | Medium | Needs per-TLD handling and degrades under privacy proxies | A changed registration/creation date blocks and requires re-confirmation |
| G10 | First-time users have nothing to compare against | Low (by design) | Inherent to TOFU and stated plainly in the README | Deferred to the transparency-log design; needs infrastructure |
| G11 | Windows trust store has weaker guarantees than POSIX | Low | Documented; symlinked directories are still rejected and writes are still atomic and locked | Node exposes equivalent no-follow/ownership primitives on Windows |

---

## 6. Security-design implementation status

`SECURITY-domain-ownership.md` proposes a layered defense against domain
expiry, transfer, and hostile repointing. That document is design research;
this table is what actually ships today — so the two don’t get mixed up.

| Layer | Design intent | Shipped? |
| --- | --- | --- |
| 0 — Authentic resolution | DoH transport; prefer DNSSEC, don’t require it | **Yes.** DoH with `do=1`; AD bit shows as `DNSSEC (resolver AD) ✓ / —` (resolver-reported, not client-validated) |
| 1 — TOFU local pin | Pin the full resolved identity | **Partial.** Namespace, package, registry, DNS version policy, first/last seen are pinned. Publisher, tarball integrity, provenance state, and DNSSEC state are not |
| 2 — Re-verify and diff | Block loudly on any identity change | **Partial.** Diffs the four pinned fields and can’t be bypassed with `--yes`. Can’t detect publisher or integrity changes it doesn’t pin |
| 3 — RDAP liveness | Detect re-registration and transfer | **No.** See G9 |
| 4 — Short trust window | Pins expire and force re-verification | **No.** See G8 |
| 5 — Transparency log | Protect first-time users | **No.** Needs infrastructure; conflicts with the zero-infra stance. See G10 |
| 6 — Provenance signal | Surface provenance and publisher match | **No.** See G7 |
| Anti-TOCTOU | Resolve once, never re-resolve after confirmation | **Yes.** Resolution happens before the preview; the confirmed values are what get executed |

The design doc’s inherited convention “never error on invalid records — ignore
and move on” deliberately does **not** apply to ownership-change signals. Those
fail loud and fail closed.

---

## 7. Milestone 4 — product validation

**In progress (kit).** Measurement materials and publisher guide live under
`docs/m4/`. Quiet beta not yet complete; no gate has passed. External adoption
still zero until contacts convert.

This gate decides whether the CLI keeps growing. Run a quiet two-week beta
before any broad promotion. Index: [`docs/m4/README.md`](docs/m4/README.md).

### Why this gate exists

The tool’s value is a network effect: it’s worth using only if publishers
declare mappings. With one mapping — the maintainer’s own — every quality metric
above measures a tool nobody yet needs. This milestone tests demand before more
engineering is spent.

### Validation kit

Materials under `docs/m4/` — checkboxes reflect kit readiness, not human-gate
pass/fail. Do not mark a human threshold done without evidence in the scoreboard.

- [x] Publisher guide (unassisted setup docs)
- [x] Outreach templates + contact tracker
- [x] Placement snippets
- [x] Discovery protocol + task bank
- [x] Usage diary protocol
- [x] Comprehension instrument
- [x] Results scorecard
- [ ] 20 qualified maintainers contacted
- [ ] ≥5 external mappings live
- [ ] Gate 2 unassisted setup threshold
- [ ] ≥3 documentation placements
- [ ] Discovery study complete
- [ ] Usage thresholds
- [ ] Comprehension ≥80%
- [ ] Decision rule applied (continue vs pivot)

### Gates

| # | Gate | Threshold | Tests |
| --- | --- | --- | --- |
| 1 | Publisher recruitment | 20 qualified npm maintainers contacted; ≥5 external mappings live | Whether anyone will publish a record |
| 2 | Unassisted setup | ≥4 of 5 publishers complete setup without the maintainer editing DNS; median setup time ≤10 minutes | Whether DNS onboarding friction is fatal |
| 3 | Documentation placement | ≥3 real README / install-doc placements | Whether publishers will recommend it |
| 4 | Discovery correctness | ≥30 counterbalanced package-discovery tasks; ≥90% correct selection and ≥20-point improvement over ordinary discovery | Whether it actually reduces wrong-package installs |
| 5 | Usage | ≥10 external users, ≥25 successful uses, ≥5 repeat users | Whether it is used more than once |
| 6 | Comprehension | ≥80% of participants understand that the tool verifies the mapping, not package safety | Whether the narrow claim survives contact with users |

Gate 2 is the one most likely to fail. The original research flagged registrar
UX, propagation delay, and debuggability as the objections that carry over from
Go proposal #26160 — and unlike the others, they can’t be fixed in the CLI
alone.

### Decision rule

If the publisher, correctness, or comprehension gates fail, **do not expand the
CLI.** Pivot toward an agent/CI policy tool or a verification API, which need
far fewer publishers to be useful because a single organization can adopt them
on its own.

---

## 8. Growth bets, ranked

Pursue in this order — and only after the validation gate.

1. **Publisher onboarding.** `di setup` generates the exact TXT record for a
   package, with copy-paste instructions for the major registrars, plus a
   `di verify` badge for a publisher’s README. Supply comes before demand:
   without publishers, nothing else matters. *Done when a publisher can go from
   zero to a working mapping without reading this repository.*
2. **Verification API and machine-readable resolver.** `di resolve --json` plus a
   hosted lookup endpoint so CI, bots, and agents can check a declaration
   without installing. Highest-leverage surface if agents, not humans, become the
   main consumers of package names. Also closes G4. *Done when a third party can
   integrate against a documented, versioned schema.*
3. **Agent and CI policy mode.** Non-interactive allowlist mode — “only install
   packages declared by these domains” — which turns the tool from a convenience
   into a control an organization can require. *Done when it runs unattended in
   CI with deterministic exit codes and no TTY.*
4. **The record specification as its own artifact.** A short spec page for the
   `_dnstall` TXT format so other tools can implement it. Reframes the project
   from one CLI into an interoperable convention. *Done when the spec is
   versioned and separable from this implementation.*
5. **More ecosystems.** PyPI and crates.io reuse the same purl payload; add them
   only once one ecosystem has proven publisher demand.

---

## 9. Deferred until the bets above pay off

- URI/SRV record support. The author of Go proposal #26160 suggested URI records
  (RFC 7553); registrar UI support and DoH JSON handling of URI records are both
  weaker than TXT, and both worsen the onboarding friction that is already the
  top risk.
- Caching, federation, transparency logs, or domain-expiry infrastructure.
- A package directory or rich record-metadata system.
- A formal open-standard campaign.
- Broad launch promotion.

---

## 10. Risk register

| ID | Risk | Impact | Mitigation | Trigger to act |
| --- | --- | --- | --- | --- |
| R1 | No publisher adopts a mapping | Fatal to the CLI thesis | Milestone 4 gate 1; bet 1 exists to reduce setup cost | Gate 1 fails |
| R2 | DNS onboarding friction blocks setup | Publishers start and abandon | `di verify` diagnostics; registrar-specific instructions | Median setup time exceeds 10 minutes |
| R3 | Users over-read the security claim | Reputational; users skip real controls | Narrow claim repeated in README, `SECURITY.md`, and the CLI preview | Gate 6 falls below 80% |
| R4 | Both DoH providers blocked or degraded | Tool unusable on that network | Fail closed with a distinct outcome rather than downgrading | Reported by any real user (G3) |
| R5 | A mapped domain expires and is re-registered | Hijack of first-time installs | Layers 1–2 today; Layers 3–5 unbuilt | Any real external mapping exists (raises G9 priority) |
| R6 | Single-maintainer bus factor | Unpatched vulnerability | Stated plainly in `SECURITY.md`; narrow scope; zero dependencies | External adoption reaches gate 5 thresholds |
| R7 | Windows-only regression ships undetected | Broken installs on a supported platform | Six-job CI matrix | Live E2E remains Linux-only while §4’s Windows gate is open |

---

## 11. Definition of done for 1.0 *(proposed, not committed)*

Recorded so “when is this 1.0?” has an answer that doesn’t drift. Adopt or revise
after Milestone 4.

1. Milestone 4 passes, or the project has formally pivoted per the decision rule.
2. G1–G4 are closed: scope registries supported, granular trust management, a
   resolution path for networks that block DoH, and a machine-readable mode.
3. The `_dnstall` record format is versioned and specified independently of this
   implementation, so a 1.0 promise about the format means something.
4. The post-publication verification runs on all three platforms for a release,
   Windows included.
5. Security-response expectations are either backed by more than one maintainer
   or explicitly scoped down in `SECURITY.md`.

---

## 12. Maintaining this document

- Update §2 whenever a release is published, a repository/registry control
  changes, or adoption changes. Re-verify each row; don’t carry rows forward
  unchecked.
- Move completed work into §3 with the release it shipped in.
- When a gap closes, remove it from §5 and note it in `CHANGELOG.md` if it’s
  user-visible. Don’t silently delete a gap.
- Commands used to verify §2:

  ```bash
  npm view domaininstall versions dist-tags time --json
  npm view domaininstall@<version> dist --json     # provenance and signatures
  npm ci && npm test && npm run verify:package
  npm run test:e2e                                 # live DNS and real install
  git tag -l
  ```
