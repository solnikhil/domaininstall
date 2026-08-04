# Research findings (executed)

Desk research and local validation run **2026-08-04** against the live codebase
and published `domaininstall@0.0.3`. These files answer items in
[`docs/RESEARCH-BACKLOG.md`](../RESEARCH-BACKLOG.md). They are not a substitute
for Milestone 4 human gates.

## Index

| File | Backlog IDs | Result |
| --- | --- | --- |
| [FINDINGS-M4-DRYRUN.md](./FINDINGS-M4-DRYRUN.md) | RB-M4-KIT | Kit materials usable; operational pre-flight partial |
| [FINDINGS-POSITIONING.md](./FINDINGS-POSITIONING.md) | RB-POSITION, RB-GATE6 (copy) | Positioning + pivot tree + badge wording |
| [FINDINGS-NONTTY.md](./FINDINGS-NONTTY.md) | RB-NONTTY | `resolve --json` schema + exit codes (design only) |
| [FINDINGS-DOH.md](./FINDINGS-DOH.md) | RB-DOH | AD bit meaning; dual-provider policy; G3 fallback design |
| [FINDINGS-PIN-AND-TOCTOU.md](./FINDINGS-PIN-AND-TOCTOU.md) | RB-PIN, RB-TOCTOU | Pin v2 fields; exact version+integrity flow |
| [FINDINGS-SCOPE-AND-PURL.md](./FINDINGS-SCOPE-AND-PURL.md) | RB-SCOPE, RB-PURL | Keep refuse scopes; purl forms |
| [FINDINGS-WINDOWS-AND-SCRIPTS.md](./FINDINGS-WINDOWS-AND-SCRIPTS.md) | RB-WIN-NPM, RB-WIN-PIN, RB-SCRIPTS, RB-GLOBAL | Windows launcher probe; scripts; PATH |
| [FINDINGS-RDAP-MAXAGE-FIRSTUSE.md](./FINDINGS-RDAP-MAXAGE-FIRSTUSE.md) | RB-RDAP, RB-MAXAGE, RB-TOFU-FIRST | Pre-M4: do nothing on all three |

## What still needs humans

- RB-GATE1 / RB-GATE2 / RB-GATE6 (full study) / Gates 3–5  
- External publisher outreach (see [`docs/m4/PROSPECT-CANDIDATES.md`](../m4/PROSPECT-CANDIDATES.md))  
- Clean-machine Windows E2E formal ROADMAP §4 checkbox (partial local verify done)

## Local pre-flight notes (2026-08-04)

- `node dist/cli.js verify zuraai.xyz` → mapping `zuraai`, Cloudflare DoH, `DNSSEC: no AD`
- Published `0.0.3` install in a temp dir: `di` / `domaininstall` / `dnstall` all report `0.0.3`; `di verify zuraai.xyz` OK
- Deterministic suite: some failures on this host related to npm 11 + `.npmrc` without `package.json` in scope-registry fixtures (see Windows findings) — product refuse logic still sound for real project roots
