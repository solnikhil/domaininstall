# `di resolve --json` contract

`di resolve <domain>[/sub][@version] --json` is the read-only resolution
interface for CI systems, coding agents, editor integrations, and other machine
consumers. It performs the same declaration, registry, and continuity checks as
`di verify`, then writes exactly one JSON document to stdout.

The command never installs a package, prompts, or writes the trust store. It
does read DNS, npm's effective registry configuration, and an existing local
pin. Expected resolution failures are represented in the JSON document; stderr
is reserved for process-level diagnostics and is empty on success.

Once `resolve` and `--json` are both present, command-specific usage failures
also use this JSON envelope (`error.code: USAGE`) so automation never has to
switch parsers for a missing target, extra argument, or incompatible option.

## Schema

Every document identifies schema major `1`:

```json
{
  "schemaVersion": 1,
  "schema": "https://raw.githubusercontent.com/solnikhil/domaininstall/main/schema/resolve-v1.schema.json"
}
```

The normative JSON Schema is
[`schema/resolve-v1.schema.json`](../schema/resolve-v1.schema.json). The schema
is included in the npm package as `schema/resolve-v1.schema.json`.

Important fields:

- `input` contains both the raw target and its normalized domain, subdomain,
  effective domain, version override, and queried DNS name.
- `dns` reports the authoritative outcome, every provider attempt, the selected
  resolver's URL and identity, and the resolver-reported AD bit. `dnssec.ad`
  does not claim client-side DNSSEC validation or package safety.
- `mappings.supported` contains every distinct npm mapping;
  `mappings.conflicts` is populated when more than one is present.
- `mappings.selected` includes DNS policy, effective version, and whether the
  effective version came from the CLI, DNS, or the implicit `latest` policy.
- `registry` gives the effective HTTPS npm registry or an explicit failure.
- `pin.current` is the existing read-only trust snapshot. `pin.diff` compares
  `namespace`, `package`, `registry`, and `dnsVersion`; the command never
  accepts or writes a changed pin. `pin.status: uncompared` preserves the
  current snapshot when registry resolution fails before a complete diff can
  be computed.
- `error.code` and `outcome` are stable machine enums. `error.message` is safe
  for people but consumers should branch on the enum and exit code.

## Exit codes

| Exit | Outcome | Meaning |
| ---: | --- | --- |
| `0` | `resolved` | One valid mapping; no pin change |
| `2` | `invalid_input` | Target is malformed |
| `3` | `authoritative_absence` | Authoritative NXDOMAIN or NODATA |
| `4` | `provider_exhaustion` | Every configured resolver failed |
| `5` | `conflicting_mappings` | Multiple distinct supported mappings |
| `6` | `registry_failure` | Effective npm registry could not be established |
| `7` | `pin_changed` | Mapping or policy differs from the local pin |
| `8` | `internal_failure` | Unsafe pin state or another unexpected failure |
| `9` | `invalid_declaration` | Invalid/unsupported TXT declaration |

Authoritative NXDOMAIN and NODATA share exit `3` but remain distinguishable as
`error.code: DNS_NXDOMAIN` and `DNS_NODATA`.

## Compatibility policy

`schemaVersion` is a major integer. Within v1, new optional fields or new enum
members may be added only when old consumers can safely ignore them. Existing
fields do not change meaning, type, or requiredness; existing enum values and
exit-code meanings are never reassigned. A removal, rename, type change,
required-field addition, or semantic reinterpretation requires a new schema
major and a new checked-in schema file. Published schema files are immutable.

Consumers should validate the schema major they support, ignore unknown object
properties when not performing strict schema validation, and branch on stable
codes rather than message text. Support for a new major must be explicit; the
CLI never silently negotiates a different document shape.

## Example

```sh
di resolve example.com/cli@^2 --json > resolution.json
```

Exit `7` is a trust event, not a successful approval: the JSON still shows the
selected live mapping and field-level diff so a human can review it out of band.
