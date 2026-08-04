# Changelog

All notable user-facing changes to `domaininstall` are recorded here.

The project follows [Semantic Versioning](https://semver.org/) from its current
pre-1.0 release line. Until 1.0, minor and patch releases may still refine the
CLI and DNS record behavior — compatibility notes will be called out explicitly
when that happens.

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
