# 0.0.1 release-candidate readiness

Local implementation and verification completed on 2026-07-20. This document
does not claim that npm publication or remote repository protection has been
performed.

## Verified locally

- Milestone 1 P0 security gate: complete.
- Deterministic security suite: 52 passed, 0 failed on Node 22.14.0 and 24.12.0.
- Live E2E: `zuraai.xyz` resolved to `zuraai`, installed through npm with
  lifecycle scripts disabled, and wrote the expected continuity pin.
- Dependency audit: zero known vulnerabilities, including development tooling.
- Package artifact: required README/license/CLI metadata present; source,
  scripts, demo, and internal artifacts excluded.
- Clean tarball install: zero production dependencies; `di`, `domaininstall`,
  and `dnstall` all report `0.0.1`.
- Reproducibility: two consecutive `npm pack` outputs were byte-for-byte equal.
- Workflow files: valid YAML; every third-party action is pinned to a full
  commit SHA with read-only contents permission outside publishing.
- Reachable Git history: no common credential file or token/private-key pattern
  found. See `docs/HISTORY-AUDIT.md`.
- Public npm lookup: `domaininstall` returned `E404` on 2026-07-20.

## External gates intentionally not performed

1. Commit the intended release-candidate changes without accidentally including
   unrelated demo work, then push and review them.
2. Reconcile `feat/v0` into `main` and make `main` the default branch.
3. Require Node 22/24 CI, disable force pushes, and protect `v*` tags.
4. Enable npm account 2FA and create the protected `npm-production` environment.
5. Make the source repository public before publication if npm provenance is
   required; npm does not generate provenance for private source repositories.
6. Follow `docs/RELEASE.md` for the short-lived bootstrap credential, exact tag,
   protected publication, immediate credential revocation, verification, and
   OIDC trusted-publisher configuration.

These gates require repository/account authority or publish externally and must
not be inferred from the local green test state.
