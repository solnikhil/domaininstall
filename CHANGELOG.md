# Changelog

All notable user-facing changes to `domaininstall` are recorded here.

The project follows [Semantic Versioning](https://semver.org/) from its current
pre-1.0 release line. Until 1.0, minor and patch releases may still refine the
CLI and DNS record behavior, with compatibility notes called out explicitly.

## [Unreleased]

### Added

- `di setup <domain> <package>[@range]` prints the exact TXT record a publisher
  must create, in fully-qualified, host-only, and zone-file forms, with
  per-registrar guidance, a DNS propagation note, and a README snippet.
- `di trust list` shows every remembered domain mapping.
- `di trust forget <domain>` forgets one domain instead of all of them.
- `--json` output for `di verify`, `di setup`, and `di trust list`, carrying a
  versioned `schema` field so CI, bots, and agents can depend on the shape.

### Changed

- When a project install is refused because the project uses pnpm, Yarn, or Bun,
  the message now points at `di <domain> --global`, which already works in those
  projects because a global install does not read the project directory.

## [0.0.3] - 2026-07-27

### Added

- Support `-g` and `--global` installs, including the resolved npm global prefix
  in the confirmation preview.
- Support npm installs on Windows without routing package arguments through
  `cmd.exe`.
- Run the deterministic release gate on Linux, macOS, and Windows with Node.js
  22.14 and 24.

### Changed

- Read the CLI version from the packaged `package.json`, removing duplicate
  hardcoded version strings.
- Send warnings and errors to standard error while keeping previews and success
  output on standard output.

### Security

- Refuse scoped-package installs when npm's `@scope:registry` configuration
  would fetch from a registry different from the registry displayed and pinned
  by `domaininstall`.
- Resolve npm's JavaScript CLI entry point on Windows and execute it with the
  current Node.js binary so shell metacharacters in version ranges are never
  interpreted by `cmd.exe`.

[0.0.3]: https://github.com/solnikhil/domaininstall/compare/v0.0.2...v0.0.3
