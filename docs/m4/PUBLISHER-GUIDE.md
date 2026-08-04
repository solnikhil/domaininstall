# Publisher guide: map your domain to an npm package

This guide is for npm package maintainers who control a domain. Goal: go from
zero to a working `_dnstall` TXT mapping in about ten minutes, without anyone
from this project editing your DNS.

## What domaininstall is

`domaininstall` lets a domain declare its official npm package in DNS. Users run
`di <domain>`; the tool looks up that declaration, shows exactly what it found,
and can install through npm with lifecycle scripts disabled.

The claim is narrow:

> It verifies **continuity of a domain-to-package mapping**. It does **not**
> prove that a package or package version is safe.

Keep lockfiles, registry provenance, dependency review, and security scanning.
They solve different problems. For the full boundary, see
[SECURITY.md](../../SECURITY.md) and the main [README](../../README.md).

## Prerequisites

- A domain you control (apex is fine; a subdomain you own also works)
- An npm package you publish (or co-publish)
- Access to that domain’s DNS at your registrar or DNS host
- Node.js 22.14+ and npm on `PATH` are **not** needed to create or publish the
  TXT record. They are required to install or run domaininstall for the later
  `di verify` and install steps.

You do **not** need a hosting account, a website on the domain, or any
domaininstall server. This is one public TXT record.

## Record format

| Piece | Value |
| --- | --- |
| Type | `TXT` |
| Name / host | `_dnstall.<your-domain>` |
| Value | `dnstall=pkg:npm/<package-name>` |

Preferred payload is a Package URL (`pkg:npm/...`). Optional version range is
allowed after the package name.

### Examples

Unscoped package:

```dns
_dnstall.example.com.  TXT  "dnstall=pkg:npm/example-package"
```

Scoped package (URL-encode `@` as `%40`):

```dns
_dnstall.example.com.  TXT  "dnstall=pkg:npm/%40acme/sdk"
```

Version range pin:

```dns
_dnstall.example.com.  TXT  "dnstall=pkg:npm/example-package@^2"
```

Scoped package with a range:

```dns
_dnstall.example.com.  TXT  "dnstall=pkg:npm/%40acme/sdk@^1"
```

### Live reference

The project’s own reference mapping:

```dns
_dnstall.zuraai.xyz.  TXT  "dnstall=pkg:npm/zuraai"
```

Anyone can inspect it without installing:

```text
di verify zuraai.xyz
```

## Step-by-step setup

### 1. Choose the domain

Pick the domain users already recognize as yours. Prefer the apex
(`example.com`) if that is what people type. If the product lives only under a
subdomain you control (`app.example.com`), you can map that instead — the TXT
name becomes `_dnstall.app.example.com`.

### 2. Build the TXT name

```text
_dnstall.<domain>
```

Examples:

| Domain users will type | TXT name to create |
| --- | --- |
| `example.com` | `_dnstall.example.com` |
| `app.example.com` | `_dnstall.app.example.com` |
| `zuraai.xyz` | `_dnstall.zuraai.xyz` |

### 3. Build the TXT value

```text
dnstall=pkg:npm/<name>
```

| Package on npm | TXT value |
| --- | --- |
| `zuraai` | `dnstall=pkg:npm/zuraai` |
| `example-package` | `dnstall=pkg:npm/example-package` |
| `@acme/sdk` | `dnstall=pkg:npm/%40acme/sdk` |
| `example-package@^2` (range pin) | `dnstall=pkg:npm/example-package@^2` |

Do not add quotes inside the value field if your DNS UI already wraps the
string. One continuous string is enough:

```text
dnstall=pkg:npm/zuraai
```

### 4. Add the record at your DNS host

In your registrar or DNS provider:

1. Create a new **TXT** record.
2. Set the **host / name** according to the registrar notes below (often just
   `_dnstall`, not the full FQDN).
3. Set the **value / content** to the `dnstall=...` string from step 3.
4. Leave TTL at the default, or use something short (300s) while testing.
5. Save.

### 5. Wait for propagation

DNS is eventually consistent. Many providers update in under a minute; some
take the full TTL. If verify fails immediately after save, wait a few minutes
and try again before changing anything else.

### 6. Install the CLI and verify

```bash
npm install --global domaininstall
di verify <domain>
```

Example with the live reference:

```bash
npm install --global domaininstall
di verify zuraai.xyz
```

There is no `di setup` command yet. Creating the record is a manual DNS step.

## Success criteria

`di verify <domain>` should:

- look up `_dnstall.<domain>`
- show a single valid domaininstall mapping
- display the package name you intended (and version policy, if you set one)

You should **not** see:

- NXDOMAIN or NODATA for `_dnstall.<domain>`
- “TXT records exist, but none are valid domaininstall records”
- “Conflicting domaininstall mappings” (two different packages on the same name)

When verify looks clean, users can install with:

```text
di <domain>
```

That step still confirms before running npm. Mapping continuity is what was
checked — not package safety.

## Registrar-specific notes

DNS UIs differ on one detail: whether the **name** field wants the short host
label or the full name.

Rule of thumb: if the UI shows your zone next to the field (for example
`.example.com`), enter only `_dnstall`. If the UI wants a full name, enter
`_dnstall.example.com` (trailing dot optional, depending on the product).

### Cloudflare DNS

1. Open the zone → **DNS** → **Records** → **Add record**.
2. Type: **TXT**.
3. Name: `_dnstall` (Cloudflare appends the zone; do not type the full FQDN
   unless you mean a different zone).
4. Content: `dnstall=pkg:npm/<package>`.
5. Proxy status does not apply to TXT; leave defaults.
6. Save. Recheck with `di verify` after a short wait.

If the domain is only used with Cloudflare for a site elsewhere, still add the
TXT in the zone that is **authoritative** for the domain — not only in a CDN
dashboard that does not own DNS.

### Namecheap

1. Domain List → **Manage** → **Advanced DNS**.
2. **Add new record** → type **TXT Record**.
3. Host: `_dnstall` (Namecheap appends your domain).
4. Value: `dnstall=pkg:npm/<package>`.
5. TTL: Automatic or 5 min while testing.
6. Save. Propagation on Namecheap can take several minutes.

If DNS is pointed away from Namecheap (custom nameservers), add the record at
the provider those nameservers belong to, not in Namecheap’s Advanced DNS.

### Google Domains / Squarespace Domains

Google Domains accounts moved to Squarespace. In Squarespace Domains:

1. Domains → select domain → **DNS** (or **DNS settings**).
2. Custom records → **Add record**.
3. Type: **TXT**.
4. Host: `_dnstall`.
5. Data: `dnstall=pkg:npm/<package>`.
6. Save.

If nameservers point to another host (Cloudflare, Route 53, etc.), edit DNS
there instead.

### AWS Route 53

1. Hosted zone for the domain → **Create record**.
2. Record name: `_dnstall` (Route 53 shows the zone suffix).
3. Record type: **TXT**.
4. Value: `"dnstall=pkg:npm/<package>"` — Route 53 often wants the value in
   double quotes in the console.
5. Routing: Simple. Create.

CLI-style example (quotes matter for the shell and for TXT):

```text
Name:  _dnstall.example.com
Type:  TXT
TTL:   300
Value: "dnstall=pkg:npm/example-package"
```

### GoDaddy

1. Domain → **DNS** → **Add** / **Add new record**.
2. Type: **TXT**.
3. Name: `_dnstall`.
4. Value: `dnstall=pkg:npm/<package>`.
5. TTL: default or 600s.
6. Save. GoDaddy propagation is often a few minutes; it can take longer.

If the domain uses non-GoDaddy nameservers, the GoDaddy DNS panel is not
authoritative — use the active DNS host.

### GitHub Pages and “custom domain” edge cases

- **GitHub Pages** does not host arbitrary TXT records for your apex. Add
  `_dnstall` at whatever DNS host owns the domain (Cloudflare, Route 53,
  registrar DNS, etc.). Pages only needs its usual `A` / `CNAME` / verification
  records; domaininstall is separate.
- **Cloudflare + external site**: put the TXT in the Cloudflare zone if
  Cloudflare nameservers are authoritative.
- **Apex vs `www`**: `di example.com` looks up `_dnstall.example.com`. It does
  **not** automatically use `_dnstall.www.example.com`. Map the name users will
  type. If both matter, publish two records with the same value.
- **Host field mistakes**: entering `dnstall` or `dnstall.example.com` without
  the leading underscore creates the wrong name. The label is `_dnstall`.
- **FQDN in a short-host UI**: entering `_dnstall.example.com` where the UI
  already appends `example.com` can produce `_dnstall.example.com.example.com`.
  Prefer the short host `_dnstall` in those UIs.

## Sub-packages (path-style names)

Users can request a path segment:

```text
di example.com/cli
```

That looks up a **different** DNS name:

```text
_dnstall.cli.example.com
```

Publish a separate TXT record for each sub-package:

| User runs | TXT name | Example value |
| --- | --- | --- |
| `di example.com` | `_dnstall.example.com` | `dnstall=pkg:npm/example` |
| `di example.com/cli` | `_dnstall.cli.example.com` | `dnstall=pkg:npm/example-cli` |
| `di example.com/react` | `_dnstall.react.example.com` | `dnstall=pkg:npm/%40example/react` |

In short-host UIs, the name is often `_dnstall.cli` (provider appends
`.example.com`).

## Common failures

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| NXDOMAIN / no such name | Wrong host; forgot `_dnstall` | Create TXT at `_dnstall.<domain>` |
| NODATA on the right name | Record missing or wrong zone | Confirm authoritative DNS; re-add TXT |
| Verify works for `www` but not apex (or reverse) | Only one of apex / www was mapped | Publish the name users actually type |
| “none are valid domaininstall records” | Typo in value (`dnstall=` missing, wrong prefix) | Value must start with `dnstall=pkg:npm/` |
| Scoped package fails | `@` not encoded | Use `%40` → `pkg:npm/%40scope/name` |
| Conflicting mappings | Two different `dnstall=` packages on the same name | Keep one mapping per DNS name |
| Multi-string / split TXT | UI or API split a long string oddly | Keep value short; one string: `dnstall=pkg:npm/name` |
| Edited registrar DNS but nameservers point elsewhere | CDN or third-party DNS is authoritative | Edit the provider listed in `whois` / NS records |
| Works later, failed right after save | Propagation delay | Wait for TTL; retry `di verify` |
| Quotes stored as part of the data | Value includes extra `"` characters | Store `dnstall=...` only; follow provider rules (Route 53 often wraps once) |

### Multi-string TXT detail

Some DNS systems store a TXT record as multiple quoted chunks. Short
domaininstall values almost never need that. Prefer a single chunk. If a
provider forces quotes in the UI, follow their docs once — do not paste nested
quotes into the middle of the payload.

### Conflicting records

If more than one valid `dnstall=` mapping is present for the same name and they
disagree, `di` refuses to choose. Delete or correct extras so exactly one
intended mapping remains.

## After it works

Optional next steps for adoption (gate 3):

- Add a short install note to your README — see [PLACEMENT-SNIPPETS.md](./PLACEMENT-SNIPPETS.md)
- Link users to `di verify <your-domain>` so they can inspect before install

## Claim boundaries (read these)

- Main product docs: [README.md](../../README.md)
- Threat model and reporting: [SECURITY.md](../../SECURITY.md)
- Project status and non-goals: [ROADMAP.md](../../ROADMAP.md) §1

Again: a green `di verify` means the domain currently declares that package. It
does not mean the package code is safe, audited, or free of malware.
