# domaininstall DNS record format

## Status and scope

This document specifies the experimental v0 `_dnstall` TXT record implemented
by `domaininstall`. It is detailed enough for another producer or consumer to
interoperate without depending on the CLI's source code.

The format establishes a domain-to-package declaration. It does not establish
that the package is safe, that a package version is trustworthy, or that the
domain owner controls the registry publisher account. See the
[security policy](../SECURITY.md) for the complete security boundary.

`MUST`, `MUST NOT`, `SHOULD`, and `MAY` describe interoperability requirements
in this document.

## Record location

For a target domain `example.com`, a publisher creates a TXT record at:

```text
_dnstall.example.com
```

The optional user-facing sub-package syntax adds one DNS label between
`_dnstall` and the domain:

```text
di example.com/react
```

resolves:

```text
_dnstall.react.example.com
```

The v0 CLI accepts one sub-package label made of ASCII letters, digits, and
hyphens. It lowercases the label before resolution. A producer targeting this
implementation MUST NOT encode a multi-label path in this position.

## Canonical record value

The canonical value is a small, purl-derived package identifier:

```text
dnstall=pkg:<ecosystem>/<package>[@<version>]
```

For npm, publish one of these forms:

```dns
_dnstall.example.com.  IN  TXT  "dnstall=pkg:npm/example-package"
_dnstall.example.com.  IN  TXT  "dnstall=pkg:npm/example-package@^2"
_dnstall.example.com.  IN  TXT  "dnstall=pkg:npm/%40acme/widget@^2"
```

The wire value is only the content inside the DNS TXT record. Quotes and the
`IN TXT` tokens belong to zone-file presentation and are not part of the value.
DNS providers may split a long TXT value into multiple character strings inside
one resource record; a consumer MUST concatenate those strings in order before
parsing the value.

### Fields

`dnstall=` is a case-sensitive marker. Producers MUST emit it in lowercase.

`pkg:` introduces the package payload. The v0 CLI only installs the `npm`
ecosystem. Consumers MUST compare the ecosystem case-insensitively; the
reference implementation normalizes it to lowercase.

`package` is an ecosystem-specific identifier. An npm package MUST be either:

- an unscoped name such as `example-package`; or
- a scoped name such as `@acme/widget`, encoded in the record as
  `%40acme/widget`.

The reference implementation accepts lowercase ASCII letters, digits, `.`,
`_`, and `-` in npm name components. A component must begin with a letter or
digit. Package names beginning with `-`, `.`, or `_` are invalid. Producers
SHOULD use `di setup` instead of constructing scoped identifiers by hand.

`version` is optional. In v0 it is an npm version or range without spaces. The
reference implementation accepts ASCII letters, digits, `.`, `^`, `~`, `*`,
`<`, `>`, `=`, `+`, `|`, and `-`. Producers SHOULD omit the separator as well
as the value when they intend npm's `latest` policy.

This syntax is derived from Package URL, but v0 does not implement the complete
Package URL specification. Qualifiers (`?`) and subpaths (`#`) are ignored by
the reference consumer and MUST NOT be used to communicate install policy.

## Optional metadata

Space-separated `key=value` tokens may follow the package payload:

```text
dnstall=pkg:npm/example-package@^2 repo=https://github.com/acme/example
```

Metadata is advisory. It does not participate in package selection, continuity
pinning, or conflict detection. Keys and values cannot contain whitespace in
v0. Consumers MAY ignore unknown or malformed metadata, and MUST treat all
metadata as untrusted display text. Producers MUST NOT rely on metadata for a
security decision.

`repo` is the only metadata key currently displayed by the CLI. No metadata
keys are reserved as normative protocol fields yet.

## Consumer processing model

A conforming v0 consumer follows this sequence:

1. Normalize and validate the target domain, then query the TXT resource record
   set at the location described above.
2. Reassemble each TXT resource record's character strings into one value.
3. Keep values whose trimmed form begins with the exact `dnstall=` marker.
4. Parse the `pkg:` payload, percent-decode the package identifier, and
   normalize the ecosystem to lowercase.
5. Select records for a supported ecosystem and validate the resulting package
   name and version before passing either value to a package manager.
6. Group declarations by the tuple `(ecosystem, package, version policy)`.
   Metadata does not belong to this tuple.
7. Continue only when exactly one distinct supported mapping remains. Duplicate
   records for that same mapping are harmless; two different packages or
   version policies are a conflict and MUST fail closed.

A TXT resource record set may also contain unrelated values. Their presence is
not an error. If TXT records exist but none is a valid declaration for a
supported ecosystem, the consumer reports that no usable mapping exists.

For installs, the reference CLI applies version precedence in this order:

1. an explicit version on the command line;
2. the version policy in DNS; or
3. npm's `latest` policy.

A command-line override changes that invocation only. It does not replace the
DNS version policy stored in the continuity pin.

## Compatibility input

The reference consumer also accepts the historical DNSLink-style payload:

```text
dnstall=/npm/example-package@^2
```

This form exists for backward compatibility. Producers MUST emit the canonical
`pkg:` form for new records. Consumers that claim full compatibility with the
v0 CLI SHOULD accept both forms.

## Producer and consumer conformance

A conforming v0 producer:

- emits the canonical `dnstall=pkg:` form;
- percent-encodes the leading `@` in scoped npm packages as `%40`;
- emits no empty version separator;
- publishes one install-relevant mapping at a record name; and
- does not assign security meaning to optional metadata.

A conforming v0 consumer:

- implements the processing and ambiguity rules above;
- validates DNS-derived values before invoking a package manager;
- never chooses arbitrarily between conflicting mappings; and
- clearly distinguishes declaration verification from package-safety claims.

`di setup <domain> <package>[@range]` is the reference producer.
`di verify <domain> --json` is the reference diagnostic consumer in the current
unreleased source tree.

## Evolution

The v0 record has no on-wire protocol-version field. Backward-compatible
extensions can add optional metadata that older consumers safely ignore. Any
change that alters package selection, ambiguity handling, or the meaning of the
payload requires a new explicitly distinguishable format rather than a silent
reinterpretation of existing records.
