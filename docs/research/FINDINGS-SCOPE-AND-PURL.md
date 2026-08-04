# Findings: scope registries, purl forms, version-range validation

**Status:** research complete  
**Date:** 2026-08-04  
**Anchors:** `src/install.ts` (`resolveEffectiveRegistry`, `npmScopeOf`, `buildInstallPlan`), `src/record.ts` (purl parse), `src/validate.ts` (`validateVersionRange`, `validatePackageName`), ROADMAP G1, RESEARCH-BACKLOG RB-SCOPE / RB-PURL

---

## npm `@scope:registry` vs `--registry`

### How npm routes packages

From npm documentation:

- Default registry comes from the `registry` config (public default `https://registry.npmjs.org/`).
- A **scope** may be associated with a registry via `npm login --scope=…` or  
  `npm config set @myco:registry https://reg.example.com`.
- Once associated, **installs of packages under that scope use that registry** instead of the default.
- Official registry docs: the registry URL used is determined by the **scope of the package**; if there is no scope, the default `registry` config applies.

### Precedence vs CLI `--registry`

Long-standing npm behavior (confirmed in historical npm issues and operator experience domaininstall already encoded in comments): for a **scoped** package, the **`@scope:registry` config wins over a command-line `--registry` flag**. Passing `--registry=https://registry.npmjs.org/` does **not** reliably force a scoped package away from a private `@scope:registry` entry in `.npmrc`.

That is why `buildInstallPlan`’s `--registry=${registry}` cannot, by itself, guarantee the host the user saw in the preview for `@foo/bar` when `@foo:registry` points elsewhere.

### What domaininstall does today (0.0.3)

`resolveEffectiveRegistry(pkg)`:

1. Resolves the default registry (`npm config get registry`), HTTPS-only, no credentials/query/fragment.
2. If `pkg` is scoped, reads `npm config get @scope:registry`.
3. If unset → use default.
4. If set and **equal** to default → OK.
5. If set and **different** → **refuse** the install with an explicit error (do not preview default while npm would fetch private).

This closed the honesty bug: never show and pin registry A while npm uses registry B.

---

## Recommendation: keep refuse vs support path

### Keep refuse (recommended for now)

**Verdict: keep refusing mismatched `@scope:registry` until product validation needs private-scope installs.**

Reasons:

1. **Honesty over features.** Refuse is correct and already shipped; supporting diversion is a feature, not a bugfix.
2. **Threat model.** Domaininstall pins a single effective registry per domain mapping. Private registries introduce auth tokens, different packument shapes, and a second trust root. Expanding there without demand violates “narrow claim” and zero-infra posture.
3. **Adoption constraint.** M4 still has zero external mappings; G1 is high severity on paper but low incident rate until scoped private packages appear in real `_dnstall` use.
4. **Workaround exists.** Users can install with npm directly when they intentionally use a private scope registry—the error message already says so.

When refuse is the right permanent answer: if domaininstall’s audience is “public npm + public DNS mappings” only. Document that as a non-goal if M4 confirms it.

### Support path (only if G1 must close for real users)

If/when a real publisher needs `@scope` on a non-default registry:

1. **Resolve effective registry first** (already done) and treat **that** URL as the only registry for preview, pin, and argv—not the default.
2. **Stop passing a conflicting strategy:** either:
   - **Preferred:** pass `--registry={effective}` *and* ensure scope config agrees (it will, by construction); or  
   - For stubborn npm versions: pass nothing for default registry and rely on scope config **only when** effective came from scope—but still **display and pin** the resolved URL after `npm config get`.
3. **Pin `registry` = effective scoped registry** so a later flip of `@scope:registry` diffs as a pin change (high value).
4. **Validate HTTPS** the same way; refuse HTTP and credential-in-URL.
5. **Do not** invent a second pin key per scope; the domain pin’s registry field is enough if it stores the effective URL.
6. **Auth:** do not handle tokens. If npm’s existing `.npmrc` auth makes `npm install` work, domaininstall only needs the registry URL to be honest. If install fails for 401, surface npm’s exit code.
7. **Tests:** unit-test matrix:
   - unscoped + default  
   - scoped + unset scope registry  
   - scoped + scope registry === default  
   - scoped + scope registry !== default → refuse **or** accept-with-pin depending on the chosen product flag  

Optional escape hatch: `--allow-scope-registry` to enable the support path while default remains refuse—mirrors DoH’s opt-in system DNS philosophy.

### Decision bias

| Option | When |
| --- | --- |
| **Keep refuse** | Default until a real M4/user need | 
| **Support effective registry** | Close G1 when private-scope domain mappings exist |
| **Always force public npm** | Reject — breaks legitimate private scopes if support is attempted; refuse is clearer |

---

## purl npm type forms

### Spec shape (package-url / purl-spec)

General form:

```text
pkg:<type>/<namespace>/<name>@<version>?<qualifiers>#<subpath>
```

For **npm** (purl type definition):

- **type:** `npm`
- **namespace:** optional; for scoped packages this is the **scope**, with the `@` **always percent-encoded** as `%40`
- **name:** package name within the scope (or the unscoped name when namespace is absent)
- **version:** optional
- Examples from the type definition:
  - `pkg:npm/foobar@12.3.1`
  - `pkg:npm/%40angular/animation@12.3.1`
  - (qualifiers allowed; domaininstall ignores `?` / `#` today)

Sonatype and other SBOM tools document the same rule: scoped packages use `pkg:npm/%40scope/name@version`, not a raw `@` in the URI path.

### What domaininstall accepts today (`record.ts`)

Preferred:

```text
dnstall=pkg:npm/stripe@^18
dnstall=pkg:npm/%40stripe/react-stripe-js@^2
```

Legacy DNSLink-style still accepted:

```text
dnstall=/npm/stripe@^18
```

Parsing notes:

- Strips purl qualifiers/subpath at `?` or `#`.
- Takes type as `namespace` (ecosystem), remainder as identifier, then `splitPackageVersion` on last `@` (scope-aware: leading `@` is not a version separator).
- `safeDecode` percent-decodes the identifier so `%40scope/name` becomes `@scope/name`.
- Package name is then validated with `validatePackageName` (scoped or unscoped grammar).

### Forms and recommendations

| Form | Example | Recommendation |
| --- | --- | --- |
| Unscoped purl | `pkg:npm/lodash@4.17.21` | **Canonical** for unscoped |
| Scoped purl (encoded) | `pkg:npm/%40scope/name@1.0.0` | **Canonical** for scoped; document in publisher guide |
| Scoped purl (raw `@`) | `pkg:npm/@scope/name@1.0.0` | Often works after decode/split but is **non-canonical**; prefer not to document; no need to reject if parse+validate succeed |
| Unencoded scope as path mess | `pkg:npm/@scope/name` without encoding | Ambiguous for generic purl parsers; keep accepting only if current parser+validate stay strict |
| Missing type slash | `pkg:npm` | Reject (already) |
| Qualifiers | `pkg:npm/foo@1?checksum=…` | **Ignore** for v0 (already); do not treat checksum qualifiers as integrity pins unless deliberately specified later |
| Other ecosystems | `pkg:pypi/…` | Parse OK, install refused (npm only)—correct |
| Legacy `/npm/…` | still useful for DNSLink-familiar publishers | Keep accepting; purl preferred in docs |

### Publisher guidance (copy-ready)

- Prefer: `dnstall=pkg:npm/<name>` or `dnstall=pkg:npm/%40scope/<name>`.
- Optional version policy: `@^1.2.0` on the purl.
- Do not put registry URLs in the TXT record; registry comes from the user’s npm config / effective registry logic.

### Parser gaps to be aware of (not blockers)

- purl **namespace** vs **name** are separate segments in the spec (`pkg:npm/%40scope/name`); domaininstall flattens to a single npm package string `@scope/name`. That is fine for install, but a future strict purl emitter should re-split on first `/` after decode.
- Case sensitivity: npm type definition notes mixed-case grandfathered names; `validatePackageName` allows lowercase only—**stricter than npm’s historical set**. Keep strict unless a real package is blocked.
- Multiple TXT records with the same mapping are collapsed via `distinctRecordMappings`; conflicting package/version pairs refuse—keep.

---

## Version range validation recommendation

### Current behavior

`validateVersionRange` allows a conservative charset:

```text
^[a-zA-Z0-9.^~*<>=+|-]+$
```

No spaces, no shell metacharacters. Used for CLI `@version`, DNS record versions, and pin `dnsVersion`. It is **not** a semver satisfaction engine.

`splitPackageVersion` / CLI `parseTarget` use last `@` with scope awareness so `@scope/pkg@^1` works.

### Recommendations

1. **Keep the charset gate** as the security boundary against argv/flag smuggling (`--registry=…`, spaces, quotes, `$()`, etc.). Do not loosen to allow whitespace or shell characters even if npm ranges support spaces in some contexts (`>=1.0.0 <2.0.0`)—those forms should stay **unsupported** in DNS/CLI until there is a quoted/structured record format.
2. **Document supported range subset** for publishers:
   - exact: `1.2.3`
   - caret/tilde: `^1.2.3`, `~1.2.3`
   - simple comparators without spaces: `>=1.2.3`, `<2.0.0` (single token only)
   - dist-tags: `latest`, `next` (alpha letters already allowed)
3. **Refuse or ignore** empty version tokens; already refused.
4. **Do not** treat version validation as integrity validation.
5. When G7 exact-resolve ships, validation remains the gate **before** packument/`npm view`; resolution failures become a separate error (“no version satisfies …”).
6. **Pin field:** continue storing the **policy string** (`dnsVersion`), not only the last resolved exact version—both are needed (policy drift vs artifact drift).

### Optional tightening (later)

- Cap length (e.g. 64–128 chars) to bound pin/display size.
- Reject consecutive operators that are never valid (`^^`, `===`).
- If `npm view` is used for resolution, let npm be the arbiter of range legality after charset checks pass.

---

## Decision

- **Scope registries:** **Keep refuse** on `@scope:registry` ≠ default as the default product behavior. It is the honest fix for npm’s precedence rules. Close G1 with a **support path that pins the effective scoped registry** only when real demand appears; optional flag if needed.
- **purl:** Treat `pkg:npm/name` and `pkg:npm/%40scope/name` as canonical; keep legacy `/npm/…`; ignore qualifiers; keep strict package-name grammar.
- **Versions:** Keep charset-only validation; no spaces; pair with exact-resolve later for security properties, not for loosening the grammar.

## Recommended next code change

- **None required** for scope/purl correctness in alpha beyond documentation.
- When G1 is scheduled: implement effective-registry accept path (or `--allow-scope-registry`) + tests; update pin diffs to treat scoped registry flips as first-class.
- Publisher guide: one short “scoped packages” note with `%40` example and “private `@scope:registry` is refused unless it matches the registry we show.”
- Align any M4 publisher snippets with canonical purl forms.

## Residual unknowns

- Exact npm CLI version matrix: does every npm on the CI matrix (and Windows) still give `@scope:registry` precedence over `--registry`? (Behavior is long-standing; worth one explicit integration assertion if support path is built.)
- Whether any target publisher uses GitHub Packages / GitLab / Verdaccio scopes for packages they would map from a public domain (drives G1 priority).
- Whether DNS TXT length limits push publishers toward short legacy `/npm/…` forms more than purl.
- Demand for space-separated semver ranges in DNS (probably low; multi-constraint policies may belong in a future record version, not free text).
