# domaininstall

Install the npm package that a project declares from its own domain.

```text
di verify zuraai.xyz
di zuraai.xyz
```

`domaininstall` resolves a TXT record published by the domain owner, rejects
ambiguous mappings, shows the exact npm command and effective registry, asks
for confirmation, and installs with lifecycle scripts disabled.

> **Status:** experimental and not yet published to npm. The current code is a
> working prototype being hardened for an initial `0.0.1` release.

## What it verifies

`domaininstall` verifies a **domain-to-package declaration** and remembers that
mapping locally using trust on first use (TOFU). A changed mapping produces a
warning and cannot be accepted non-interactively.

It does **not** prove that:

- the package code is safe, audited, or malware-free;
- the domain was the one the user intended to type on first use;
- a new version of an already-mapped package is trustworthy; or
- DNS ownership is equivalent to npm publisher or source-code ownership.

The DNS-declared version policy and effective npm registry are stored in the
local continuity pin. A one-off CLI version override does not replace the DNS
policy in that pin. Use registry provenance, lockfiles, dependency review, and
security scanning as separate controls.

## Requirements

- Node.js 22.14 or newer
- npm available on `PATH`

The `0.0.1` alpha intentionally refuses pnpm, Yarn, and Bun projects because
equivalent installation behavior has not been established across managers.

## DNS record

Publish a TXT record at `_dnstall.<domain>`:

```dns
_dnstall.example.com.  TXT  "dnstall=pkg:npm/example-package"
```

An optional version or range may be included:

```dns
_dnstall.example.com.  TXT  "dnstall=pkg:npm/example-package@^2"
```

Sub-packages use a label beneath `_dnstall`:

```text
di example.com/react
```

This resolves `_dnstall.react.example.com`.

## Commands

```text
di <domain>[/sub][@version]    resolve, confirm, and install
di verify <domain>             inspect the DNS declaration without installing
di trust reset --all           back up and reset all TOFU pins
di --help                      show the full command reference
di --version                   show the CLI version
```

The package exposes `di` as the primary command plus `domaininstall` and
`dnstall` aliases. Installs pass npm's effective HTTPS registry explicitly and
always include `--ignore-scripts`. If a dependency requires lifecycle scripts,
review it and run the required build step separately; `domaininstall` will not
enable scripts for that installation.

Trust pins live in `~/.domaininstall/pins.json`. The store is owner-only,
schema-validated, symlink-resistant, atomic, and locked across concurrent
writers. Corruption fails closed. `di trust reset --all` requires confirmation,
preserves the previous file as a backup, and treats every domain as a new first
use; add `--force` only for an intentional non-interactive reset.

## Development

```bash
npm ci
npm run build
npm test
npm run test:e2e
npm run verify:package
npm pack --dry-run
```

`npm test` is deterministic and uses mocked DNS providers. `npm run test:e2e`
performs the live DNS and real npm installation path separately.

## Security

Read the [security policy](https://github.com/solnikhil/domaininstall/blob/main/SECURITY.md)
for the supported threat model and reporting instructions. Detailed pre-release
work is tracked in the
[release roadmap](https://github.com/solnikhil/domaininstall/blob/main/ROADMAP.md).

## License

MIT
