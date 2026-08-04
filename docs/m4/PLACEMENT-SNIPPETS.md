# Placement snippets (Milestone 4, gate 3)

Copy-paste blocks for publishers who already have a working `_dnstall` TXT
record. Goal: a short, honest install note in a README or install doc — not a
safety claim.

**Claim to keep intact wherever you paste:**

> domaininstall verifies continuity of a domain-to-package mapping. It does
> **not** prove that a package is safe.

Full setup instructions: [PUBLISHER-GUIDE.md](./PUBLISHER-GUIDE.md).  
Project docs: [README](../../README.md) · [SECURITY.md](../../SECURITY.md).

---

## Beta ask (one sentence)

Please add a short install note to your README or install docs so users can
discover the domain-based path (`di verify <your-domain>` / `di <your-domain>`)
alongside your normal `npm install` instructions.

---

## Short README install section

Replace placeholders: `YOUR.DOMAIN`, `your-package`.

````markdown
### Install via domain

If you already know **YOUR.DOMAIN**, you can resolve the official npm package
from DNS with [domaininstall](https://www.npmjs.com/package/domaininstall):

```bash
npm install --global domaininstall
di verify YOUR.DOMAIN
di YOUR.DOMAIN
```

This checks that the domain currently maps to `your-package`. It does **not**
prove the package is safe — keep using lockfiles and your usual review process.
````

---

## Longer “Install via domain” section

````markdown
## Install via domain

[domaininstall](https://www.npmjs.com/package/domaininstall) reads a public DNS
TXT record on **YOUR.DOMAIN** that points at this package. Useful when someone
already trusts the domain name more than an unfamiliar npm name.

### Prerequisites

- Node.js 22.14 or newer
- npm on your `PATH`

### Inspect first (no install)

```bash
npm install --global domaininstall
di verify YOUR.DOMAIN
```

You should see a mapping to `your-package` (and a version policy if one is
published in DNS).

### Install into the current project

```bash
di YOUR.DOMAIN
```

`di` prints the resolved package, registry, and exact npm command, then waits
for confirmation. Installs run with dependency lifecycle scripts disabled
(`--ignore-scripts`).

### Global CLI install (optional)

```bash
di YOUR.DOMAIN --global
```

### What this does and does not mean

domaininstall verifies **continuity of the domain→package declaration**. It
does **not** prove that package code is safe, audited, or free of malware. Use
it together with lockfiles, registry provenance, and dependency review — not
instead of them.

### DNS record (for operators)

```dns
_dnstall.YOUR.DOMAIN.  TXT  "dnstall=pkg:npm/your-package"
```

Reference mapping used by the domaininstall project itself:

```text
di verify zuraai.xyz
```
````

---

## Markdown badges (static)

No hosted badge API is required. These use shields.io-style static labels and
should link to your install section or to the publisher guide.

### Compact

```markdown
[![domaininstall](https://img.shields.io/badge/domaininstall-di%20verify%20YOUR.DOMAIN-0a0a0a?style=flat-square)](https://github.com/solnikhil/domaininstall#install)
```

### Explicit mapping

```markdown
[![Install via domain](https://img.shields.io/badge/install-di%20YOUR.DOMAIN-informational?style=flat-square)](https://github.com/solnikhil/domaininstall)
```

### Honest claim badge (preferred when space allows)

```markdown
[![domain→package mapping](https://img.shields.io/badge/domaininstall-mapping%20only%20—%20not%20package%20safety-lightgrey?style=flat-square)](https://github.com/solnikhil/domaininstall/blob/main/SECURITY.md)
```

### Live project reference (example)

```markdown
[![di verify zuraai.xyz](https://img.shields.io/badge/di%20verify-zuraai.xyz-success?style=flat-square)](https://github.com/solnikhil/domaininstall)
```

Replace `YOUR.DOMAIN` in the badge URL path encoding (`%20` for spaces) and in
the link target. Point the link at **your** README install heading when you have
one.

---

## Command examples with placeholders

### Verify only

```bash
npm install --global domaininstall
di verify YOUR.DOMAIN
```

### Resolve and install (project-local)

```bash
di YOUR.DOMAIN
```

### Global install

```bash
di YOUR.DOMAIN --global
```

### Sub-package path

```bash
di YOUR.DOMAIN/cli
# looks up _dnstall.cli.YOUR.DOMAIN
```

### Version override on the CLI (does not rewrite DNS)

```bash
di YOUR.DOMAIN@^2
```

### Scoped package in DNS (publisher side)

```dns
_dnstall.YOUR.DOMAIN.  TXT  "dnstall=pkg:npm/%40scope/name"
```

### Live smoke-test (project reference)

```bash
di verify zuraai.xyz
```

Expected idea: mapping to `zuraai` via `_dnstall.zuraai.xyz` →
`dnstall=pkg:npm/zuraai`.

---

## Minimal one-liner blurb

For a crowded README “Install” list:

```markdown
- **Domain:** `di verify YOUR.DOMAIN` then `di YOUR.DOMAIN`
  ([domaininstall](https://www.npmjs.com/package/domaininstall) — mapping
  continuity, not a safety scan)
```

---

## What not to write

Avoid phrasing that over-claims:

| Avoid | Prefer |
| --- | --- |
| “Secure install from our domain” | “Install by resolving our domain’s published package mapping” |
| “Verified safe package” | “Verified domain→package declaration” |
| “Trusted because of DNS” | “Useful when you already trust the domain name as a starting point” |

If you only have room for one caveat, keep: **mapping continuity, not package
safety.**
