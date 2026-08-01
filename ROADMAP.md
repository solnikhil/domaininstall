# domaininstall roadmap

This file is the operational roadmap and the live source of status. The
generated checklist under `artifacts/` and `docs/RELEASE-CANDIDATE.md` are
point-in-time snapshots from before the first publication; treat them as
history.

## Product promise

`domaininstall` lets a software project declare its official npm package from
its own domain. It verifies continuity of that domain-to-package declaration and
then installs through npm with dependency lifecycle scripts disabled.

It is not a package malware scanner, source/build attestation system, registry,
or replacement for npm provenance, lockfiles, allowlists, and dependency review.

## Where the project actually stands

Last reviewed 2026-08-01. Every claim below was verified against npm, git, and
the working tree on that date.

- `domaininstall` is published on npm: `0.0.1`, `0.0.2`, and `0.0.3`, each with
  a SLSA v1 provenance attestation and registry signatures. `dist-tags.latest`
  is `0.0.3`.
- The GitHub repository is public and `main` is the default branch. `main` is
  the commit the published `0.0.3` tarball was built from, and the local
  checkout is level with `origin/main` with no uncommitted source changes.
- Tags `v0.0.1`, `v0.0.2`, and `v0.0.3` are pushed. GitHub *releases* exist only
  for `v0.0.1` and `v0.0.2`, so the releases page still shows `v0.0.2` as
  Latest. See the close-out list below.
- The deterministic suite passes: 70 passed, 0 failed, on Node 24.12 with
  npm 11.6.
- The live example mapping works: `_dnstall.zuraai.xyz` resolves to
  `dnstall=pkg:npm/zuraai`, answered by `cloudflare-dns.com` without DNSSEC
  authentication, and matches the pin first seen 2026-07-20.
- Retired branches — do not branch from any of these. `feat/v0` is fully merged
  into `main`. The four local `codex/*` branches (`demo-refresh`, `v0.0.3`,
  `v0.0.3-release-state`, `v0.0.3-snapshot`) are pre-squash snapshots whose work
  landed on `main` through PRs #5, #6, and #7; `main` supersedes all of them.
- Real external adoption is zero. The only published mapping is the author's own
  domain, so Milestone 5 below has not started.

## Shipped

- **Milestone 0 — project truth.** No stray production dependency, complete
  package metadata, README, MIT license, security policy, roadmap.
- **Milestone 1 — P0 security gate.** Terminal sanitization of untrusted text;
  distinct DNS outcomes for NODATA, NXDOMAIN, SERVFAIL, REFUSED, timeout,
  malformed response, and provider exhaustion, with fallback only where it is
  safe; refusal of conflicting mappings; schema-validated, fail-closed,
  POSIX owner-only, no-follow, atomic, lock-protected TOFU store with documented
  recovery and explicit Windows ACL limitations; DNS version policy pinned
  separately from a CLI override; strict
  argument parsing before any DNS, install, or pin operation; deterministic
  adversarial tests for each item.
- **Milestone 2 — release engineering.** Deterministic tests separated from live
  DNS/install tests; CI on Node 22 and 24 with clean install, build, tests,
  production audit, and packed-artifact verification; live E2E on schedule,
  manual dispatch, and release candidates; third-party actions pinned by commit
  SHA with least privilege; Git history audited before going public; protected
  first-publish workflow and a written rollback procedure.
- **Milestone 3 — first publication.** `0.0.1` and `0.0.2` published from a
  protected workflow with provenance, and verified from a clean environment.
- **Milestone 4 — `0.0.3` hardening and publication.** Delivered in full; the
  original checklists are preserved below.

### Milestone 4 detail — code and CI changes

- [x] Support Windows: resolve npm's own CLI entry point and run it with the
      current Node binary instead of spawning `npm.cmd`, so no npm argument is
      ever parsed by `cmd.exe`.
- [x] Refuse an install when `@scope:registry` would divert the request away
      from the registry that is displayed and pinned, since npm gives
      scope-specific configuration precedence over `--registry`.
- [x] Derive the CLI version from `package.json` instead of a hardcoded literal
      in two places.
- [x] Send warnings and errors to standard error, keeping standard output for
      previews and results.
- [x] Add `-g` / `--global` so a domain can install a command-line tool, with
      the resolved global prefix shown in the preview.
- [x] Extend CI to macOS and Windows on both supported Node versions. The
      matrix is `[ubuntu, macos, windows] × [22.14.0, 24.x]` — six jobs.

### Milestone 4 detail — release controls

- [x] Land the changes above on `main` through a pull request with green CI on
      all six matrix jobs, including the two Windows jobs.
- [x] Protect `main` and `v*` tags from force pushes and deletion.
- [x] Require all six current Linux, macOS, and Windows matrix checks on `main`.
- [x] Enable npm account 2FA.
- [x] Protect the `npm-production` environment with staged human approval.
- [x] Confirm npm OIDC trusted publishing targets `publish.yml` and the
      `npm-production` environment.
- [x] Add a `CHANGELOG.md` starting at `0.0.3`.
- [x] Tag `v0.0.3` and publish with provenance.
- [x] Run the post-publication verification in `docs/RELEASE.md` on macOS.

## Open: close out the `0.0.3` release

Two items from Milestone 4 are still outstanding. Neither blocks users who
install from npm today.

- [ ] Run the post-publication verification in `docs/RELEASE.md` from a clean
      Windows machine. Windows is a supported platform and the Windows npm
      execution path shipped in `0.0.3`, but that path has only been exercised
      by CI, never by a real global install.
- [ ] Create the GitHub release for `v0.0.3` from the existing tag, so the
      releases page stops advertising `v0.0.2` as Latest.

Exit gate: a fresh global install of `0.0.3` works on macOS, Linux, and Windows,
and the published artifact is reproducible from its tag. macOS and Linux are
confirmed; Windows is the remaining leg.

## Unreleased — publisher onboarding and machine-readable output

Landed after `0.0.3`, not yet released. 109 deterministic tests pass.

- [x] `di setup <domain> <package>[@range]` generates the exact TXT record in all
      three shapes registrars ask for (fully-qualified name, host-only, zone
      line), with per-registrar guidance, a propagation warning, and a README
      snippet. Scoped names are percent-encoded so the generated record
      round-trips through the real record parser.
- [x] `di verify --json` emits a versioned (`schema: 1`) machine-readable object
      on stdout, with human formatting suppressed so CI, bots, and agents can
      parse it. NODATA and other failures stay structured.
- [x] `di trust list [--json]` and `di trust forget <domain>`, so an unexpected
      mapping change no longer forces `trust reset --all`.
- [x] `di setup --json` for the same reasons as verify.
- [x] Tell pnpm, Yarn, and Bun users that `di <domain> --global` already works in
      their projects. The global path never ran project detection, so this was a
      message-only change to a working code path.
- [ ] Release as `0.0.4`: changelog entry, tag, publish, GitHub release.

## Known gaps, in priority order

Re-confirmed against the source on 2026-08-01, then re-ordered by how many users
each one actually affects.

1. pnpm, Yarn, and Bun projects cannot receive a *project* install; the refusal
   now points at `--global`, which works, but that is a workaround rather than
   support. Each needs an equivalent scripts-disabled install path and its own
   adversarial tests before it ships. This is the largest excluded group.
2. DNS resolution depends on two DoH providers, `cloudflare-dns.com` and
   `dns.google` (`src/doh.ts`). A network that blocks both leaves no path
   forward at all; consider an opt-in system-resolver fallback that is clearly
   labelled as unauthenticated in the preview.
3. Every lookup discloses the requested domain to a third-party resolver. The
   CLI names the resolver that answered and shows a DNSSEC badge, but never
   states that the domain was disclosed to that resolver. This is documented in
   the security policy only.
4. Scope-specific registries are refused rather than supported. Support them by
   resolving the per-scope registry and pinning it as the effective registry for
   that package. Demoted from first place: it requires both a domain declaring a
   scoped package and local `@scope:registry` configuration pointing elsewhere,
   so it affects the fewest users of anything on this list.
5. Nothing helps a user discover which domains publish a mapping. The README
   snippet from `di setup` makes adoption visible at the publisher's end, which
   is a partial answer.

## Milestone 5 — two-week product validation

Run a quiet beta before any broad promotion. This is the gate that decides
whether the CLI keeps growing. Not started: it depends on publisher onboarding
existing, and growth bet 1 below is unbuilt.

- Recruit 20 qualified npm maintainers and obtain at least 5 external mappings.
- Observe at least 4 of 5 publishers completing setup without the maintainer
  editing DNS, with median setup time of 10 minutes or less.
- Obtain at least 3 real README/install-documentation placements.
- Run at least 30 counterbalanced package-discovery tasks; require at least 90%
  correct selection and a 20-point improvement over ordinary discovery.
- Reach at least 10 external users, 25 successful uses, and 5 repeat users.
- Confirm at least 80% of participants understand that the tool verifies the
  mapping, not package safety.

If the publisher, correctness, or comprehension gates fail, pivot toward an
agent/CI policy tool or a verification API instead of expanding the CLI.

## Growth bets, ranked

Pursue these only in this order. Bet 1 is the exception to "only after the
validation gate": the validation gate cannot run without it, because its own
success criterion is publishers completing setup unaided.

1. **Publisher onboarding.** Mostly shipped \u2014 `di setup` generates the record,
   explains where it goes per registrar, and emits a README snippet. What remains
   is a real `di verify` status badge and measuring actual setup time with a
   publisher who is not the author.
2. **A verification API and machine-readable resolver.** The local half shipped as
   `di verify --json` and `di setup --json`. What remains is the hosted lookup
   endpoint so a checker does not need the CLI installed.
3. **Agent and CI policy mode.** A non-interactive allowlist mode:
   "only install packages declared by these domains", which turns the tool from
   a convenience into a control an organization can require. `--json` is the
   foundation this builds on.
4. **The record specification as its own artifact.** A short spec page for the
   `_dnstall` TXT format so other tools can implement it. This reframes the
   project from one CLI to an interoperable convention.
5. **More ecosystems.** PyPI and crates.io reuse the same purl payload; add them
   only once one ecosystem has proven publisher demand.

## Deferred until the bets above pay off

- URI/SRV record support;
- caching, federation, transparency logs, or domain-expiry infrastructure;
- a package directory or rich record-metadata system;
- a formal open-standard campaign; and
- broad launch promotion.
