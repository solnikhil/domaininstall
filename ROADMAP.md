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

Last reviewed 2026-07-27.

- `domaininstall` is published on npm: `0.0.1` and `0.0.2`, both with SLSA
  provenance attestations and registry signatures.
- The GitHub repository is public and `main` is the default branch. `main` is
  the commit the published `0.0.2` tarball was built from.
- `feat/v0` is fully merged into `main` and is retired; do not branch from it.
- The live example mapping works: `_dnstall.zuraai.xyz` resolves to
  `dnstall=pkg:npm/zuraai`.
- Real external adoption is zero. The only published mapping is the author's own
  domain, so Milestone 4 below has not started.

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

## Release candidate (targets `0.0.3`)

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
- [x] Extend CI to macOS and Windows on both supported Node versions.

## Next: release `0.0.3`

- [x] Land the changes above on `main` through a pull request with green CI on
      all six matrix jobs, including the two Windows jobs.
- [x] Protect `main` and `v*` tags from force pushes and deletion.
- [x] Require all six current Linux, macOS, and Windows matrix checks on `main`.
- [x] Enable npm account 2FA.
- [x] Protect the `npm-production` environment with staged human approval.
- [x] Confirm npm OIDC trusted publishing targets `publish.yml` and the
      `npm-production` environment.
- [ ] Tag `v0.0.3`, publish with provenance, and run the post-publication
      verification in `docs/RELEASE.md` from a clean machine, including a
      Windows machine.
- [x] Add a `CHANGELOG.md` starting at `0.0.3`.

Exit gate: a fresh global install of `0.0.3` works on macOS, Linux, and Windows,
and the published artifact is reproducible from its tag.

## Known gaps, in priority order

1. Scope-specific registries are refused rather than supported. Support them by
   resolving the per-scope registry and pinning it as the effective registry for
   that package.
2. `di trust` can only reset everything. Add `di trust list` and
   `di trust forget <domain>`.
3. DNS resolution depends on two DoH providers. Networks that block them have no
   path forward; consider an opt-in system-resolver fallback that is clearly
   labelled as unauthenticated in the preview.
4. pnpm, Yarn, and Bun projects are refused. Each needs an equivalent
   scripts-disabled install path and its own adversarial tests before it ships.
5. Every lookup discloses the requested domain to a third-party resolver. This is
   documented in the security policy but not surfaced in the CLI.

## Milestone 4 — two-week product validation

Run a quiet beta before any broad promotion. This is the gate that decides
whether the CLI keeps growing.

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

Pursue these only in this order, and only after the validation gate.

1. **Publisher onboarding.** `di setup` that generates the exact TXT record for
   a package, plus copy-paste instructions for the major registrars and a
   `di verify` badge a publisher can put in their README. Supply comes before
   demand: without publishers, nothing else matters.
2. **A verification API and machine-readable resolver.** `di resolve --json` and
   a hosted lookup endpoint so CI, bots, and agents can check a domain's
   declaration without installing. This is the highest-leverage surface if
   agents, not humans, become the main consumers of package names.
3. **Agent and CI policy mode.** A non-interactive allowlist mode:
   "only install packages declared by these domains", which turns the tool from
   a convenience into a control an organization can require.
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
