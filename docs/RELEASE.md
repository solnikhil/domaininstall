# Release and rollback procedure

No release command in this document should be run from a dirty checkout or an
unprotected branch. Publication is an explicit external action and is not part
of ordinary development or CI.

## Repository gates

Before creating `v0.0.1`:

1. Make `main` the default branch and require the `CI` checks for Node 22 and 24.
2. Disable force pushes and deletion for `main` and `v*` tags.
3. Create an `npm-production` GitHub environment with required human approval.
4. Require npm account 2FA and confirm the package name is available.
5. Run `npm ci`, `npm test`, `npm run test:e2e`,
   `npm audit --omit=dev`, and `npm run verify:package` from the release commit.

## First publication only

The first publication uses `.github/workflows/publish-bootstrap.yml` because a
trusted publisher cannot be attached until the package exists.

1. Create a granular npm token limited to publishing `domaininstall`, with the
   shortest practical expiry.
2. Store it as the `NPM_PUBLISH_TOKEN` secret on the protected
   `npm-production` environment.
3. Tag the exact verified commit `v0.0.1`, push the tag, and wait for Live E2E.
4. Manually run **Bootstrap npm publication** while selecting the `v0.0.1` tag.
5. Verify the package, then immediately revoke the token and delete the secret.

The workflow refuses branch refs, checks that the tag matches `package.json`,
reruns deterministic tests/audit/package verification, and publishes with npm
provenance.

## Later trusted publications

In npm package settings, configure the GitHub trusted publisher for repository
`solnikhil/domaininstall`, workflow `publish.yml`, environment
`npm-production`, and the `npm publish` action. Then use the **Publish npm
package** workflow from an exact version tag. It requests only `contents: read`
and `id-token: write` and does not use a reusable publish token.

## Post-publication verification

From a clean temporary directory:

```bash
npm view domaininstall@0.0.1 --json
npm install --ignore-scripts --save-exact domaininstall@0.0.1
npx --no-install di --version
npx --no-install domaininstall --version
npx --no-install dnstall --version
npx --no-install di verify zuraai.xyz
npm audit signatures
```

Confirm that the registry version, Git tag commit, provenance subject, packed
files, README, license, and all executable aliases match the tested artifact.
Only then create the GitHub release from that same tag.

## Rollback

Published registry data is immutable, so never reuse a bad version number.

1. Stop promotion and record the affected version and reason.
2. Prefer `npm deprecate domaininstall@<version> "<reason and safe version>"`.
3. Fix forward with a new patch version and repeat every release gate.
4. Consider `npm unpublish domaininstall@<version>` only if the current npm
   unpublish policy permits it and the impact justifies breaking consumers.

npm currently permits some newly published packages to be unpublished within
72 hours when no package depends on them. Unpublishing is irreversible, the
version can never be reused, and removing every version prevents republishing
the package name for 24 hours. Re-check the live policy before acting:
https://docs.npmjs.com/policies/unpublish/
