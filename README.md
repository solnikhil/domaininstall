# domaininstall

Install an npm package using a domain you already know.

```text
di verify zuraai.xyz
di zuraai.xyz
```

Here’s the idea: a domain owner publishes a small DNS record that points to an
npm package. `domaininstall` reads that record, shows you exactly what it found,
and asks before installing anything.

> **Status:** available on npm as an early release. The command and DNS format
> are intentionally small while real-world use shapes what comes next.

## Install

```bash
npm install --global domaininstall
```

Then check a domain without installing its package:

```text
di verify zuraai.xyz
```

## Why this exists

Package names are easy to mistype, and unfamiliar scopes are hard to judge. A
domain is often a clearer starting point: if you already trust `example.com`,
you can ask what package that domain declares instead of guessing its npm name.

That’s useful evidence — not a magic safety stamp. `domaininstall` proves that
the current DNS record maps a domain to a package. It does **not** prove that
the package code is safe.

## A quick tour

A publisher adds one TXT record:

```dns
_dnstall.example.com.  TXT  "dnstall=pkg:npm/example-package"
```

You can inspect it without installing:

```text
di verify example.com
```

When you’re ready:

```text
di example.com
```

Before anything is installed, `di` prints the resolved package, version policy,
registry, destination, and the exact npm command it will run. It waits for your
confirmation, then installs with lifecycle scripts disabled.

To install a command-line tool for your whole machine (instead of the current
project), add `--global`:

```text
di example.com --global
```

## What is remembered

On first use, `domaininstall` saves the domain-to-package mapping in
`~/.domaininstall/pins.json`. If the domain later points to a different package,
you’ll see a clear warning — and you can’t wave it away with `--yes`.

This is trust on first use (TOFU). It helps returning users notice a changed
mapping. It can’t protect a first-time user from a compromised, expired, or
mistyped domain.

The pin also records the DNS version policy and the effective npm registry. A
one-off version override on the command line won’t silently replace the
domain’s policy.

`di trust list` shows what is remembered, and `di trust forget <domain>` removes
a single mapping without disturbing the others. Both confirm before changing
anything, and forgetting a domain means its next install is treated as a first
use again.

## What it does not promise

`domaininstall` does **not** prove that:

- the package is safe, audited, or free of malware
- you typed the intended domain on first use
- a newly published package version is trustworthy
- the domain owner also controls the npm publisher account or source code

Keep using lockfiles, registry provenance, dependency review, and security
scanning. They solve different parts of the problem.

## Publishing a package from your own domain

If you own a domain and an npm package, `di setup` prints the exact record to
add at your DNS provider:

```text
di setup example.com my-package
di setup example.com my-package@^2      declare a version policy
di setup example.com/react @acme/ui     declare a sub-package
```

It runs entirely offline, so you can generate the record before it exists. It
reports the name relative to your zone (what most DNS provider forms expect),
the fully-qualified name, and a zone-file line. Once the record is live,
`di verify example.com` confirms it resolves.

## DNS records

The basic record lives at `_dnstall.<domain>`:

```dns
_dnstall.example.com.  TXT  "dnstall=pkg:npm/example-package"
```

Publishers can pin a version or range:

```dns
_dnstall.example.com.  TXT  "dnstall=pkg:npm/example-package@^2"
```

A path-like sub-package becomes another DNS label:

```text
di example.com/react
```

That looks up `_dnstall.react.example.com`.

## For package publishers

Publishing a mapping is a DNS TXT record and a quick check with
`di verify <your-domain>`. Step-by-step unassisted setup lives in the
[publisher guide](docs/m4/PUBLISHER-GUIDE.md). The project is in a quiet beta —
if you maintain an npm package and want to try a domain mapping, start there.

The [DNS record format](docs/RECORD-FORMAT.md) is the implementation-oriented
reference for record location, scoped package encoding, version policy,
metadata, duplicate and conflict handling, and producer/consumer conformance.

## Commands

```text
di <domain>[/sub][@version]    resolve, confirm, and install
di <domain> --global           install globally instead of into this project
di verify <domain>             inspect a declaration without installing
di setup <domain> <package>    print the TXT record a publisher must add
di trust list                  show every remembered mapping
di trust forget <domain>       remove one remembered mapping
di trust reset --all           back up and reset all saved mappings
di --help                      show the complete command reference
di --version                   print the CLI version
```

The npm package exposes `di` as the primary command, with `domaininstall` and
`dnstall` as aliases.

Progress and previews go to standard output; warnings and errors go to standard
error — so `di` plays nicely with scripts and CI logs.

## Requirements and current limits

- Node.js 22.14 or newer
- npm available on `PATH`
- macOS, Linux, or Windows

The first release supports **npm projects only**. pnpm, Yarn, and Bun are
refused until their install behavior has been tested to the same standard.

Every install uses the effective HTTPS npm registry explicitly and includes
`--ignore-scripts`. If a dependency needs a lifecycle script, review that step
and run it yourself afterward — `domaininstall` won’t enable it for you.

If your npm config routes a package’s scope to a different registry than the
default (`@scope:registry`), `di` refuses the install instead of showing one
registry and fetching from another. Install that package with npm directly until
scope-specific registries are supported.

The trust store is schema-validated, written atomically, and locked while it’s
being updated. On macOS and Linux it also enforces owner-only permissions and
no-follow file access. Windows relies on the user-profile ACL, because Node
doesn’t expose the same POSIX ownership and no-follow guarantees there. Corrupt
state fails closed. Resetting trust keeps a backup and asks for confirmation
unless you intentionally pass `--force`.

## Development

To work on the project locally:

```bash
git clone https://github.com/solnikhil/domaininstall.git
cd domaininstall
npm ci
npm test
npm run test:e2e
npm run verify:package
```

`npm test` uses deterministic, mocked DNS responses. The E2E command is
separate because it performs a live DNS lookup and a real npm installation.

## Documentation

The [documentation index](docs/README.md) links the protocol reference,
security boundary, roadmap, release runbook, changelog, and historical design
material. The roadmap is the live source of project status; older release
checklists are retained as snapshots.

## Security

The [security policy](SECURITY.md) explains what we claim, what we don’t, and
how to report a vulnerability. The [release roadmap](ROADMAP.md) tracks
hardening and validation work still in progress.

## License

MIT
