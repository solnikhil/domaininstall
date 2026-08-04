# Changelog

All notable user-facing changes to `domaininstall` are recorded here.

The project follows [Semantic Versioning](https://semver.org/) from its current
pre-1.0 release line. Until 1.0, minor and patch releases may still refine the
CLI and DNS record behavior — compatibility notes will be called out explicitly
when that happens.

## [Unreleased]

### Added

- `di setup <domain>[/sub] <package>[@range]` prints the exact `_dnstall` TXT
  record a publisher needs to add, including the name relative to the zone, the
  fully-qualified name, and a zone-file line. The command runs entirely offline,
  so the record can be generated before it exists, and every generated record is
  checked back through the record parser before being shown.
- `di trust list` shows every remembered domain mapping with its package,
  version policy, and the date it was last seen.
- `di trust forget <domain>` removes a single remembered mapping and leaves every
  other mapping intact. It shows the mapping it is about to drop and confirms
  first, unless `--force` is supplied.
- Live end-to-end coverage on macOS and Windows in addition to Linux, now
  including a global install into an isolated npm prefix and a trust-pin
  continuity check across two installs.

### Changed

- `--force` now applies to both `trust forget` and `trust reset`.

## [0.0.3] - 2026-07-27

### Added

- Support for `-g` and `--global` installs, including the resolved npm global
  prefix in the confirmation preview
- Support for npm installs on Windows without routing package arguments through
  `cmd.exe`
- Deterministic release gate on Linux, macOS, and Windows with Node.js 22.14
  and 24

### Changed

- CLI version is read from the packaged `package.json`, so hardcoded version
  strings are no longer duplicated
- Warnings and errors go to standard error; previews and success output stay on
  standard output

### Security

- Scoped-package installs are refused when npm’s `@scope:registry` configuration
  would fetch from a registry different from the one `domaininstall` displays
  and pins
- On Windows, npm’s JavaScript CLI entry point is resolved and run with the
  current Node.js binary, so shell metacharacters in version ranges are never
  interpreted by `cmd.exe`

[0.0.3]: https://github.com/solnikhil/domaininstall/compare/v0.0.2...v0.0.3
