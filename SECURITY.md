# Security policy

## Project status

`domaininstall` is early alpha. Only the latest published version and the
current `main` branch get fixes — older versions are not patched. Security
reports are welcome and handled on a best-effort basis by a single maintainer.

## What we actually claim

The security promise is intentionally narrow:

> `domaininstall` verifies continuity of a domain-to-package declaration. It
> does **not** prove that a package or package version is safe.

In practice, the tool currently trusts:

- the domain administrator to publish the intended package declaration
- the configured DNS-over-HTTPS providers and the TLS connection to them
- npm and the effective HTTPS registry reported by your npm configuration
- the local trust-on-first-use (TOFU) store for continuity after the first
  successful install

DNS responses, TXT metadata, package content, package-manager configuration,
and anything shown in the terminal are treated as untrusted inputs.

DNSSEC can authenticate DNS data in transit, but it does **not** prove continued
ownership after a domain transfer, and it does **not** authenticate npm package
contents.

The P0 security gate in [ROADMAP.md](ROADMAP.md) was finished before the first
published release. That file also tracks the hardening work that remains.

### What the alpha already does

- Pins the effective registry into both the preview and the command that runs
- Refuses an install when a scope-specific registry would divert the request
  away from that pinned registry
- Disables dependency lifecycle scripts with `--ignore-scripts`
- Rejects conflicting DNS mappings instead of picking one silently
- Treats corrupt or unsafe TOFU state as a hard error
- On Windows, runs npm’s own CLI entry point with the current Node binary
  instead of routing arguments through `cmd.exe` (so ranges like `^18` are never
  interpreted by a shell)

These controls narrow execution risk. They do **not** make the selected package
trustworthy.

### Trust store notes by platform

Trust-state hardening differs by OS:

- **macOS and Linux** enforce owner-only mode bits and use no-follow file opens.
- **Windows** rejects a symlinked state directory, validates the store, locks
  writers, and uses atomic replacement — but Node doesn’t expose the same
  file-level no-follow and POSIX ownership guarantees. The store also relies on
  the user-profile directory ACL.

## Reporting a vulnerability

Please **don’t** publish exploit details in a public issue.

Use GitHub’s **Report a vulnerability** flow when private reporting is enabled
for the repository. If that option isn’t available, open a minimal issue asking
the maintainer to set up a private contact channel — and leave out reproduction
steps or sensitive details.

Useful reports often cover things like:

- terminal or control-sequence injection
- argument or registry smuggling
- incorrect DNS failure handling or ambiguous-record selection
- TOFU bypass, state corruption, unsafe file handling, or concurrency bugs
- an install happening without the required confirmation
- a mismatch between the package/registry shown and what actually gets installed

When it’s safe to include them, please share the affected commit or version,
platform, Node and package-manager versions, impact, and a minimal reproduction.

## Disclosure

The maintainer will acknowledge reports when practical, validate impact, and
coordinate a fix and disclosure timeline that fits the pre-release status.

No fixed response-time SLA is promised. That doesn’t mean private user data or
active credentials should ever be disclosed publicly.
