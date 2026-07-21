# Security policy

## Project status

`domaininstall` is an experimental pre-release project. No published version is
currently supported. Security reports against the current repository are still
welcome and will be handled on a best-effort basis.

## Security boundary

The intended security claim is deliberately narrow:

> `domaininstall` verifies continuity of a domain-to-package declaration. It
> does not prove that a package or package version is safe.

The project currently trusts:

- the domain administrator to publish the intended package declaration;
- the configured DNS-over-HTTPS providers and TLS connection;
- npm and the effective HTTPS registry reported by npm configuration; and
- the local TOFU store for continuity after the first successful install.

DNS responses, TXT metadata, package content, package-manager configuration,
and terminal-facing strings are treated as untrusted inputs. DNSSEC can
authenticate DNS data, but it does not prove continued ownership after a domain
transfer and does not authenticate npm package contents.

Before the first release, the project must complete the P0 security gate in
[ROADMAP.md](ROADMAP.md).

The current alpha supports npm only. It pins the effective registry into the
displayed and executed command, disables dependency lifecycle scripts with
`--ignore-scripts`, rejects conflicting DNS mappings, and treats corrupt or
unsafe TOFU state as a blocking error. These controls narrow execution risk;
they do not make the selected package trustworthy.

## Reporting a vulnerability

Do not publish exploit details in a public issue.

Use GitHub's **Report a vulnerability** flow when private vulnerability
reporting is enabled for the repository. If that option is unavailable, open a
minimal issue asking the maintainer to establish a private contact channel; do
not include reproduction steps or sensitive details in that issue.

Useful reports include:

- terminal/control-sequence injection;
- argument or registry smuggling;
- incorrect DNS failure handling or ambiguous-record selection;
- TOFU bypass, state corruption, unsafe file handling, or concurrency loss;
- an install occurring without the required confirmation; and
- discrepancies between the package/registry shown and what is installed.

Please include the affected commit or version, platform, Node/package-manager
versions, impact, and a minimal reproduction when it is safe to do so.

## Disclosure

The maintainer will acknowledge reports when practical, validate impact, and
coordinate a fix and disclosure timeline appropriate to the pre-release status.
Do not treat the absence of a response-time guarantee as permission to disclose
private user data or active credentials.
