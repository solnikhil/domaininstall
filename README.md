# domaininstall

Install an npm package through a domain you already recognize.

```text
di verify zuraai.xyz
di zuraai.xyz
```

The idea is simple: a domain owner publishes a small DNS record that points to
an npm package. `domaininstall` reads that record, shows you exactly what it
found, and asks before installing anything.

> **Release status:** `0.0.1` is a working release candidate, but it has not
> been published to npm yet. If you are trying it today, use the source setup
> below.

## Why this exists

Package names are easy to mistype and unfamiliar scopes are hard to judge. A
domain can be a more recognizable starting point: if you trust `example.com`,
you can ask what package that domain declares instead of guessing its npm name.

That is useful evidence, not a magic safety stamp. `domaininstall` proves that
the current DNS record maps a domain to a package. It does not prove that the
package code is safe.

## A quick tour

A publisher adds one TXT record:

```dns
_dnstall.example.com.  TXT  "dnstall=pkg:npm/example-package"
```

You can inspect it without installing:

```text
di verify example.com
```

When you are ready, run:

```text
di example.com
```

Before the install, `di` prints the resolved package, version policy, registry,
destination, and exact npm command. It waits for confirmation, then installs
with lifecycle scripts disabled.

## What is remembered

On first use, `domaininstall` saves the domain-to-package mapping in
`~/.domaininstall/pins.json`. If the domain later points to a different package,
the change is called out and cannot be accepted with `--yes`.

This is trust on first use (TOFU): it helps returning users notice a changed
mapping. It cannot protect a first-time user from a compromised, expired, or
mistyped domain.

The pin also records the DNS version policy and effective npm registry. A
one-off version override on the command line does not silently replace the
domain's policy.

## What it does not promise

`domaininstall` does not prove that:

- the package is safe, audited, or malware-free;
- you typed the intended domain on first use;
- a newly published package version is trustworthy; or
- the domain owner also controls the npm publisher account or source code.

Keep using lockfiles, registry provenance, dependency review, and security
scanning. They solve different parts of the problem.

## DNS records

The basic record lives at `_dnstall.<domain>`:

```dns
_dnstall.example.com.  TXT  "dnstall=pkg:npm/example-package"
```

Publishers can include a version or range:

```dns
_dnstall.example.com.  TXT  "dnstall=pkg:npm/example-package@^2"
```

A path-like sub-package becomes another DNS label:

```text
di example.com/react
```

That command looks up `_dnstall.react.example.com`.

## Commands

```text
di <domain>[/sub][@version]    resolve, confirm, and install
di verify <domain>             inspect a declaration without installing
di trust reset --all           back up and reset all saved mappings
di --help                      show the complete command reference
di --version                   print the CLI version
```

The npm package exposes `di` as the primary command, with `domaininstall` and
`dnstall` as aliases.

## Requirements and current limits

- Node.js 22.14 or newer
- npm available on `PATH`

The first release deliberately supports npm projects only. pnpm, Yarn, and Bun
are refused until their install behavior has been tested to the same standard.

Every install uses the effective HTTPS npm registry explicitly and includes
`--ignore-scripts`. If a dependency needs a lifecycle script, review that step
and run it yourself afterward; `domaininstall` will not enable it for you.

The trust store is owner-only, schema-validated, symlink-resistant, atomic, and
locked while it is being updated. Corrupt state fails closed. Resetting trust
keeps a backup and requires confirmation unless you intentionally add `--force`.

## Try it from source

Until the npm package is published:

```bash
git clone https://github.com/solnikhil/domaininstall.git
cd domaininstall
npm ci
npm run build
npm link
di --version
```

To work on the project:

```bash
npm test
npm run test:e2e
npm run verify:package
```

`npm test` uses deterministic, mocked DNS responses. The E2E command is kept
separate because it performs a live DNS lookup and a real npm installation.

## Security

The [security policy](SECURITY.md) explains the supported threat model and how
to report a vulnerability. The [release roadmap](ROADMAP.md) tracks the work
required for the first public npm release.

## License

MIT
