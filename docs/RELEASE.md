# Release and rollback procedure

Don’t run any release command from a dirty checkout or an unprotected branch.
Publication is an explicit external action — not part of ordinary development
or CI.

## Release input

Set the version once in a clean release shell, without a leading `v`:

```bash
RELEASE_VERSION=0.0.3
export RELEASE_VERSION
```

Every command below uses that value. Confirm it matches the manifest before you
create a tag:

```bash
test "$(node -p 'require("./package.json").version')" = "$RELEASE_VERSION"
```

## Repository gates

Before creating `v${RELEASE_VERSION}`:

1. Finalize the matching `CHANGELOG.md` entry with the intended release date,
   commit it through the protected branch, and confirm the release checkout is
   that exact `main` commit. The tag must include the finalized changelog.
2. Confirm `main` is the default branch and requires every current `CI` matrix
   check.
3. Confirm force pushes and deletion are disabled for `main` and `v*` tags.
4. Confirm the `npm-production` GitHub environment requires human approval and
   only permits protected release tags.
5. Confirm npm account 2FA is enabled.
6. Confirm npm trusted publishing names repository
   `solnikhil/domaininstall`, workflow `publish.yml`, and environment
   `npm-production`.
7. Run `npm ci`, `npm test`, `npm run test:e2e`,
   `npm audit --omit=dev`, and `npm run verify:package` from the release commit.
8. Run `npm run verify:docs` and confirm the documented command surface matches
   the CLI built from the release commit.
9. Confirm `git status --short` prints nothing.

## First publication only (historical)

The first publication used a short-lived token because a trusted publisher
couldn’t be attached until the package existed. That bootstrap path is retired:
its workflow has been removed, and no supported release path accepts an npm
publication token. Restore neither the workflow nor `NPM_PUBLISH_TOKEN`.

## Later trusted publications

In npm package settings, configure the GitHub trusted publisher for repository
`solnikhil/domaininstall`, workflow `publish.yml`, and environment
`npm-production`. Then:

1. Create the annotated tag from the exact verified `main` commit:

   ```bash
   git tag -a "v${RELEASE_VERSION}" -m "domaininstall ${RELEASE_VERSION}"
   git push origin "v${RELEASE_VERSION}"
   ```

2. The tag push starts **Publish npm package**. In that same workflow run, the
   release graph calls **Live E2E** at the exact tag SHA on Linux, macOS, and
   Windows. The protected publish job does not become eligible for approval
   unless all three jobs succeed. Missing, skipped, cancelled, or failed matrix
   results therefore block publication; results from another SHA or an older
   workflow run cannot satisfy the dependency.
3. Approve the protected `npm-production` deployment after verifying the tag
   and workflow inputs. A retry may be manually dispatched against the exact
   tag; it runs the complete live E2E dependency again before approval.

Release attempts for the same tag are serialized. The E2E call receives only
`contents: read`; the publish job separately receives `contents: read` and
`id-token: write` and does not use a reusable publish token. `npm test` enforces
this dependency graph and fails if another publication workflow or bootstrap
token path is added.

## Post-publication verification

From a clean temporary directory on macOS or Linux, isolate the release check
from user npm configuration and pin every registry operation to the public npm
registry:

```bash
: > empty-npmrc
export NPM_CONFIG_USERCONFIG="$PWD/empty-npmrc"
export PUBLIC_NPM_REGISTRY="https://registry.npmjs.org/"
npm view "domaininstall@${RELEASE_VERSION}" --json --registry="$PUBLIC_NPM_REGISTRY"
npm install --ignore-scripts --save-exact "domaininstall@${RELEASE_VERSION}" \
  --registry="$PUBLIC_NPM_REGISTRY"
npx --no-install di --version
npx --no-install domaininstall --version
npx --no-install dnstall --version
npx --no-install di verify zuraai.xyz
npm audit signatures --registry="$PUBLIC_NPM_REGISTRY"
```

Use an empty `NPM_CONFIG_USERCONFIG` and the same explicit public registry for
the equivalent PowerShell commands on Windows.

Confirm that the registry version, Git tag commit, provenance subject, packed
files, README, license, and all executable aliases match the tested artifact.
Repeat the install and alias checks on Windows. Only then create the GitHub
release from that same tag.

After creating the GitHub release, verify that it is marked latest and that its
README and changelog describe the same commands as the npm artifact. Documentation
on `main` may describe the next release candidate, but released documentation
must remain attached to its immutable tag.

## Rollback

Published registry data is immutable, so never reuse a bad version number.

1. Stop promotion and record the affected version and reason.
2. Prefer `npm deprecate domaininstall@<version> "<reason and safe version>"`.
3. Fix forward with a new patch version and repeat every release gate.
4. Consider `npm unpublish domaininstall@<version>` only if the current npm
   unpublish policy allows it and the impact justifies breaking consumers.

npm currently permits some newly published packages to be unpublished within
72 hours when no package depends on them. Unpublishing is irreversible, the
version can never be reused, and removing every version prevents republishing
the package name for 24 hours. Re-check the live policy before acting:
https://docs.npmjs.com/policies/unpublish/
