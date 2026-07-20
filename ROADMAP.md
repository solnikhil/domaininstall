# domaininstall roadmap

This file is the operational roadmap. The generated project checklist under
`artifacts/` is a point-in-time report and should not be used as the live source
of status.

## Product promise

`domaininstall` lets a software project declare its official npm package from
its own domain. It verifies continuity of that domain-to-package declaration
and then installs through npm with dependency lifecycle scripts disabled.

It is not a package malware scanner, source/build attestation system, registry,
or replacement for npm provenance, lockfiles, allowlists, and dependency review.

## Milestone 0 — restore project truth

- [x] Remove the unintended `zuraai` production dependency.
- [x] Add repository, homepage, issue-tracker, engine, and public-access metadata.
- [x] Add a root README, MIT license, security policy, and durable roadmap.
- [x] Mark historical research that still describes `dpm`, `_dpm`, a
      pre-code project, 19 tests, or zero dependencies.

Exit gate: a clean tarball install adds only `domaininstall`; the packed artifact
contains the intended README, license, compiled CLI, and package metadata.

## Milestone 1 — P0 security gate

- [x] Sanitize all terminal-bound untrusted input, including ANSI/OSC, control,
      newline, and bidirectional characters.
- [x] Distinguish NODATA, NXDOMAIN, SERVFAIL, REFUSED, timeout, malformed
      response, and provider exhaustion; fall back only when appropriate.
- [x] Reject multiple distinct supported mappings instead of choosing the first.
- [x] Make the TOFU store schema-validated, fail-closed, permission-restricted,
      symlink-safe, atomic, and concurrency-safe; add explicit recovery.
- [x] Pin the version policy declared by DNS separately from a CLI override.
- [x] Make the displayed and pinned registry match the registry actually used.
- [x] Choose and document an install-script policy. If equivalent cross-manager
      behavior cannot be guaranteed, limit the initial release to npm.
- [x] Reject unknown flags, surplus positionals, conflicting modes, and invalid
      `--` usage before any DNS, install, or pin operation.
- [x] Add deterministic adversarial tests for every item above.

Exit gate: malformed or hostile inputs never invoke a package manager or modify
trust state, and `--yes` cannot bypass ambiguity, corruption, or mapping changes.

## Milestone 2 — release engineering

- [x] Split deterministic unit/security tests from live DNS and install tests.
- [x] Add CI for Node 22 and 24: clean install, build, tests, production audit,
      pack inspection, tarball install, and all three executable aliases.
- [x] Run live DNS/E2E separately on schedule, manual dispatch, and release
      candidates.
- [ ] Reconcile `feat/v0` into `main` and set `main` as the default branch.
- [ ] Protect `main` and `v*` tags with required CI and no force pushes.
- [x] Pin third-party GitHub Actions by full commit SHA with minimal permissions.
- [x] Audit Git history before deciding whether to make the repository public.
- [x] Add a protected first-publish workflow and a documented rollback procedure.

Exit gate: protected `main` is green, a fresh tarball installation passes on the
supported Node matrix, and the release artifact is reproducible from its tag.

## Milestone 3 — quiet 0.0.1 alpha

- [ ] Enable npm account 2FA.
- [ ] Bootstrap the first publication with a short-lived credential and
      provenance from a protected workflow; revoke the credential immediately.
- [ ] Verify registry metadata, provenance/signatures, the exact installed
      version, all aliases, and `di verify` from a clean environment.
- [ ] Create the GitHub release from the exact tested `v0.0.1` commit.
- [ ] Configure OIDC trusted publishing for later versions, preferably with
      staged human approval.

Exit gate: the public artifact and source tag match, post-publication verification
passes, and no reusable publish credential remains.

## Milestone 4 — two-week product validation

Run a quiet beta before broad promotion.

- Recruit 20 qualified npm maintainers and obtain at least 5 external mappings.
- Observe at least 4 of 5 publishers completing setup without the team editing
  DNS, with median setup time of 10 minutes or less.
- Obtain at least 3 real README/install-documentation placements.
- Run at least 30 counterbalanced package-discovery tasks; require at least 90%
  correct selection and a 20-point improvement over ordinary discovery.
- Reach at least 10 external users, 25 successful uses, and 5 repeat users.
- Confirm at least 80% of participants understand that the tool verifies the
  mapping, not package safety.

If the publisher, correctness, or comprehension gates fail, pivot toward an
agent policy tool or verification badge/API instead of expanding the CLI.

## Deferred until validation passes

- additional package ecosystems;
- URI/SRV record support;
- caching, federation, transparency, or domain-expiry infrastructure;
- a package directory or rich record-metadata system;
- a formal open-standard campaign;
- full MCP/agent integration; and
- broad launch promotion.
