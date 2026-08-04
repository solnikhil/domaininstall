# Findings: Windows launcher, scripts, trust store, post-publish gate

**Date:** 2026-08-04  
**Machine:** Windows (`process.platform === "win32"`), developer workstation  
**Repo:** `domaininstall` @ workspace `C:\Users\Nikhil\Documents\domaininstall`  
**Scope:** Platform research only — no product code changes.

Anchors: [`src/install.ts`](../../src/install.ts), [`src/pin.ts`](../../src/pin.ts), [`scripts/e2e.ts`](../../scripts/e2e.ts), [`ROADMAP.md`](../../ROADMAP.md) §4 outstanding Windows gate, [`docs/RELEASE.md`](../RELEASE.md), [`SECURITY.md`](../../SECURITY.md), research backlog RB-WIN-NPM / RB-WIN-PIN / RB-SCRIPTS / RB-GLOBAL.

---

## 1. Windows launcher realism on THIS machine

### 1.1 Node and npm locations

| Probe | Result |
| --- | --- |
| `where.exe node` | `C:\Program Files\nodejs\node.exe` |
| `where.exe npm` | `C:\Program Files\nodejs\npm`, `npm.cmd`; also `C:\Users\Nikhil\AppData\Roaming\npm\npm`, `npm.cmd` |
| `process.execPath` | `C:\Program Files\nodejs\node.exe` |
| Node version | `v24.14.1` (satisfies `engines.node >= 22.14.0`) |
| PowerShell `Get-Command npm` | `C:\Program Files\nodejs\npm.ps1` (PowerShell prefers `.ps1` over `.cmd`) |
| `process.env.npm_execpath` (plain shell) | **unset** (`undefined`) |
| `npm_execpath` under `npm exec` | `C:\Users\Nikhil\AppData\Roaming\npm\node_modules\npm\bin\npm-cli.js` |
| `APPDATA` | `C:\Users\Nikhil\AppData\Roaming` |
| fnm / nvm-windows | **Not installed** on this profile |

**PATH order (relevant entries only):**

| Index | Entry |
| --- | --- |
| 29 | `C:\Program Files\nodejs\` |
| 57 | `C:\Program Files\node` (**path present, directory does not exist**) |
| 68 | `C:\Users\Nikhil\AppData\Roaming\npm` |

Also present earlier on PATH: `C:\Users\y.xie\.npm-global` (another user’s prefix remnant). Harmless for discovery if empty, but shows multi-user / migrated PATH clutter is real on Windows.

**PATHEXT:** `.COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC;.CPL` — matches what `resolveNpmLauncher` expects (`.CMD` present). On-disk files under Node’s install dir include extensionless `npm`, `npm.cmd`, and `npm.ps1`.

### 1.2 Candidates `resolveNpmLauncher` would try (this machine)

Algorithm from [`src/install.ts`](../../src/install.ts) (`resolveNpmLauncher`):

1. `npm_execpath` if it ends with `.js` — **skipped** (unset in a normal interactive shell).
2. For each PATH directory that contains an `npm` launcher (any PATHEXT variant), try  
   `{dir}\node_modules\npm\bin\npm-cli.js`.
3. `{dirname(execPath)}\node_modules\npm\bin\npm-cli.js`
4. `{dirname(execPath)}\..\lib\node_modules\npm\bin\npm-cli.js` (POSIX-style layout; rare on Windows)
5. `%APPDATA%\npm\node_modules\npm\bin\npm-cli.js`

**Observed candidates (order) and existence:**

| # | Candidate | Exists? |
| --- | --- | --- |
| 1 | `C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js` | **Yes** (first PATH npm dir) |
| 2 | `C:\Users\Nikhil\AppData\Roaming\npm\node_modules\npm\bin\npm-cli.js` | **Yes** (second PATH npm dir) |
| 3 | same as #1 via `dirname(execPath)` | Yes (duplicate) |
| 4 | `C:\Program Files\nodejs\..\lib\node_modules\npm\bin\npm-cli.js` | **No** |
| 5 | `%APPDATA%\npm\node_modules\npm\bin\npm-cli.js` | Yes (duplicate of #2) |

**Live result from compiled `resolveNpmLauncher()`:**

```text
ok: true
command: C:\Program Files\nodejs\node.exe
prefixArgs: [ C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js ]
```

So on this machine the Windows path is **realistic and succeeds**: shell-free spawn of Node + official `npm-cli.js`, which is exactly the security goal of 0.0.3 (no `cmd.exe` parsing of version ranges).

### 1.3 Important realism gap: which npm binary “wins”

Official `npm.cmd` / `npm.ps1` next to Node do **not** always run the bundled CLI. They:

1. Default to `%~dp0\node_modules\npm\bin\npm-cli.js`
2. Run `npm-prefix.js` and, if `{prefix}\node_modules\npm\bin\npm-cli.js` exists, **prefer the global-prefix npm**

On this machine:

| Invoker | Effective npm version |
| --- | --- |
| Shell `npm -v` (`npm.ps1` → prefix redirect) | **11.5.2** (global prefix copy under `%APPDATA%\npm`) |
| domaininstall launcher (first PATH `npm-cli.js`) | **11.11.0** (Node install bundle) |
| Direct `node …\nodejs\node_modules\npm\bin\npm-cli.js -v` | 11.11.0 |
| Direct `node …\Roaming\npm\node_modules\npm\bin\npm-cli.js -v` | 11.5.2 |

**Config still agrees for the values that matter to domaininstall today:**

| Key | Shell npm | domaininstall-style launcher |
| --- | --- | --- |
| `prefix` | `C:\Users\Nikhil\AppData\Roaming\npm` | same |
| `registry` | `https://registry.npmjs.org/` | same |

**Gap summary:** domaininstall does **not** reimplement `npm-prefix.js` “prefer global npm” selection. That is usually fine (same registry/prefix), but:

- npm **major/minor** behavior can diverge between interactive `npm` and `di` installs on the same box.
- Version managers (fnm, nvm-windows, Volta, company Node trees) that put only a shim on PATH without co-located `node_modules\npm\bin\npm-cli.js` are **not** exercised here; those remain the high-risk discovery failures for RB-WIN-NPM.
- Dual installs (bundled npm + `npm install -g npm`) are common on Windows; this machine is that case.

### 1.4 Local CLI / tests on this machine

| Check | Result |
| --- | --- |
| `node dist/cli.js --version` | `0.0.3` |
| `npm view domaininstall@0.0.3 version` | `0.0.3` (public registry) |
| Unit tests (`npm test`) | **63 passed, 3 failed** |
| Symlink trust-state tests | **Skipped on Windows** (as designed) |
| Live E2E (`npm run test:e2e`) | **Not run** in this research pass (live DNS + install; separate from gate doc commands below) |

**Unit failure note (incidental, not a launcher miss):** the three failures are all under “Scope-specific registries.” Fixtures write a project `.npmrc` **without** a `package.json`. On npm 11 on this machine, `npm local prefix` then walks to the user home, project config is ignored, and `registry` / `@acme:registry` stay public-default — so diverge/agree checks never see the fixture. Adding a minimal `package.json` next to the fixture `.npmrc` makes `resolveEffectiveRegistry` behave as the tests expect. This is a **test fixture / npm project-root discovery** issue, not evidence that the Windows launcher cannot find npm.

### 1.5 Gaps vs “fully supported Windows”

| Covered here | Still open |
| --- | --- |
| Stock Node.js Windows installer layout | fnm / nvm-windows / Volta / Scoop / company images |
| `npm.cmd` discovery + co-located `npm-cli.js` | PATH with only `npm.ps1` and no `.cmd` (unlikely for official installers) |
| `shell: false` spawn of `node` + `npm-cli.js` | Post-publish install of **published** tarball on a **clean** Windows machine |
| Unit tests for launcher resolution | Live E2E workflow is Ubuntu-only (`scripts/e2e.ts` works via `process.execPath` + `dist/cli.js` and is OS-portable in principle, but CI does not run it on Windows) |

---

## 2. Trust store: Windows residual risk (code + docs only)

No exploit work; residual model only.

### 2.1 What ships today (`src/pin.ts`)

On all platforms:

- State dir default: `%USERPROFILE%\.domaininstall` (or `DOMAININSTALL_STATE_DIR`)
- Schema validation, fail-closed on corrupt / unsupported shape
- Exclusive lock file (`pins.lock`) with stale-PID cleanup
- Atomic replace via temp file + `renameSync`
- Directory must be a real directory (symlink state **directory** rejected via `lstat`)

POSIX-only hardening (`IS_WINDOWS` early-return or skipped):

- Owner-UID checks
- Mode bits `0o700` / `0o600` enforcement via `fchmod`
- Directory `fsync` after rename
- Effective **no-follow** on file opens via `O_NOFOLLOW`

### 2.2 Residual risk on Windows (documented + confirmed on this runtime)

| Residual | Why it remains |
| --- | --- |
| No POSIX ownership check | `process.getuid` is unavailable; code skips UID checks on Windows |
| No mode-bit exclusivity | Windows ACLs are the control plane; Node mode bits are not equivalent |
| No durable directory fsync after rename | Explicit comment in `writeAtomically`; relies on Windows rename replace semantics |
| **`O_NOFOLLOW` is a no-op** | On this machine `fs.constants.O_NOFOLLOW` is **`undefined`**. In JS, `O_RDONLY \| undefined` coerces to `O_RDONLY`. File opens therefore do **not** get a Node-level no-follow guarantee for file reparse points / symlinks |
| File-level reparse points | Directory symlinks are rejected; file-level symlink/reparse behavior is weaker than POSIX `O_NOFOLLOW` (see comments in `pin.ts` and `SECURITY.md`) |
| Shared / non-exclusive profile ACLs | Store “relies on the per-user profile directory ACL.” Admin, SYSTEM, or broken inherited ACLs on `%USERPROFILE%` are outside the tool’s control |
| Multi-user machines | Another local admin can generally read/write user profile data; domaininstall does not claim cross-user isolation on Windows |

**Roadmap alignment:** G11 remains **Low**, acceptable for alpha with honest docs. F21 (Windows trust-store hardening) stays **LATER** / demand-gated; closing G11 likely needs better Node primitives or explicit Windows ACL APIs, not a quick parity patch.

**What is still solid on Windows:** fail-closed schema, lock + atomic write, symlink **directory** rejection, TOFU continuity for same-profile returning users under a normal single-user ACL.

---

## 3. `--ignore-scripts`: still valuable? Native breakage risk

### 3.1 What domaininstall does

`buildInstallPlan` always emits:

```text
npm install --ignore-scripts [--global] --registry=<https registry> <spec>
```

Documented in README, SECURITY.md, and M4 comprehension materials.

### 3.2 Is it still valuable?

**Yes, as a default for this product — even if less differentiating in 2026.**

| Argument for keeping | Argument that value is eroding |
| --- | --- |
| Lifecycle scripts remain a primary install-time payload path for compromised packages | pnpm/Yarn/Bun/npm are moving toward default-deny or allowlisted builds; “we ignore scripts” is no longer unique marketing |
| Aligns with agent/CI advice (sandbox + no ambient scripts) | Selling `di` as “safer npm install” overclaims if the real differentiator is domain continuity |
| Narrow, honest claim: reduce **execution** risk after a domain-mapped name is chosen | Does not validate package content, publisher, or first-use mapping correctness |
| Zero-config for the human confirmation path | Users still need a recovery path when builds need scripts |

**Recommendation:** keep `--ignore-scripts` as a **non-optional alpha default**. Do not re-enable scripts for convenience. Document recovery; do not market it as malware scanning.

### 3.3 Native / postinstall breakage risk

Packages that commonly need install-time work (non-exhaustive classes):

- Native addons: `node-gyp` / `prebuild-install` / `node-addon-api` consumers (`better-sqlite3`, `bcrypt`, older `sharp` paths, etc.)
- Binary downloaders in `postinstall` (some CLI tools, browser binaries, WASM fetchers)
- Packages that compile or download platform assets only in lifecycle scripts

**Failure mode under domaininstall:** npm extracts the tree but skips scripts → missing binaries / “module not found” / “invalid ELF/PE” at runtime, while the install **exit code may still be 0**.

**Recovery path (docs should keep saying this):**

1. Review the package’s scripts and trust boundary yourself.
2. From the same project: `npm rebuild <pkg>` or an explicit, reviewed script run — **outside** domaininstall.
3. Prefer packages that ship prebuilt binaries without requiring postinstall when possible.

**Global CLIs (`-g`):** same flag applies. Many global CLIs are pure JS and work; those that download platform binaries in `postinstall` will break the same way. Showing the global prefix in the preview does not fix script skipping.

**This machine note:** environment currently has `NPM_CONFIG_IGNORE_SCRIPTS=true` as well — so even raw npm on this profile is script-averse; domaininstall is not the only source of that policy here.

---

## 4. Global install PATH caveats (Windows)

### 4.1 What domaininstall shows and runs

- `-g` / `--global` → `npm install --global …`
- Preview target uses `resolveNpmGlobalPrefix()` → `npm config get prefix`
- On this machine prefix is `C:\Users\Nikhil\AppData\Roaming\npm`
- Global bin shims (e.g. `di.cmd`, `di.ps1`) land in that directory

### 4.2 PATH caveats

| Caveat | Detail on this machine / generally |
| --- | --- |
| Prefix dir must be on PATH | `%APPDATA%\npm` **is** on PATH (index 68). After a successful global install, `di` / `domaininstall` / `dnstall` should resolve **if** shims were written there |
| Order vs Node | Node (`…\nodejs\`) is **before** the global prefix. That is normal: `node`/`npm` come from the install, package bins from prefix |
| PowerShell command discovery | Prefers `di.ps1` over `di.cmd` when both exist; execution policy can block `.ps1` shims in locked-down environments |
| Elevated vs user prefix | Elevated “Run as administrator” can bind to a different prefix / profile than the interactive user — surprise install location |
| Multi-prefix PATH clutter | Stale entries (`C:\Program Files\node`, other users’ `.npm-global`) can confuse humans debugging “command not found” |
| `prefix` misconfiguration | Showing the prefix in the preview is the main safety net (RB-GLOBAL). A wrong user `prefix` still installs where npm says; domaininstall will not second-guess it beyond display |
| Empty `NPM_CONFIG_USERCONFIG` isolation | With an empty userconfig file, this machine still resolved `prefix` to `%APPDATA%\npm` (from builtin npmrc `prefix=${APPDATA}\npm` on the Windows Node layout) and `registry` to `https://registry.npmjs.org/` — good for release verification isolation |

**Not observed here:** domaininstall is **not** currently installed globally on this profile.

---

## 5. Closing the Windows post-publish E2E gate

### 5.1 What the gate is

From [`ROADMAP.md`](../../ROADMAP.md) §4:

- [ ] Run post-publication verification from [`docs/RELEASE.md`](../RELEASE.md) on a **clean Windows machine** and record the result in the roadmap.
- Why it matters: 0.0.3 introduced the Windows npm launcher; live E2E CI is **Ubuntu only**.

**Exit criteria:** fresh install of published `0.0.3` works on Windows (and already on macOS/Linux); artifact matches the tag.

### 5.2 Recommended procedure (PowerShell)

Prefer a **clean** Windows profile or VM (no custom `registry`, no leftover `domaininstall` global, stock Node 22.14+ installer). Node **v24.14.1** on this workstation is an acceptable second check after a clean VM.

```powershell
# --- Release identity ---
$RELEASE_VERSION = "0.0.3"
$PUBLIC_NPM_REGISTRY = "https://registry.npmjs.org/"

# --- Clean workdir, isolated userconfig (mirrors docs/RELEASE.md) ---
$work = Join-Path $env:TEMP "domaininstall-postpub-$RELEASE_VERSION"
New-Item -ItemType Directory -Force -Path $work | Out-Null
Set-Location $work
New-Item -ItemType File -Path (Join-Path $work "empty-npmrc") -Force | Out-Null
$env:NPM_CONFIG_USERCONFIG = (Join-Path $work "empty-npmrc")

# Sanity: Node/npm present
node -v
npm -v
where.exe node
where.exe npm

# Optional: record what domaininstall's launcher would use (from a local clone of the tag)
# node -e "..."  or run resolveNpmLauncher after building the tag checkout

# 1) Registry metadata
npm view "domaininstall@$RELEASE_VERSION" --json --registry=$PUBLIC_NPM_REGISTRY

# 2) Local project install of the published package (scripts off, exact version)
npm install --ignore-scripts --save-exact "domaininstall@$RELEASE_VERSION" `
  --registry=$PUBLIC_NPM_REGISTRY

# 3) All published bin aliases
npx --no-install di --version
npx --no-install domaininstall --version
npx --no-install dnstall --version

# 4) Live resolve/verify path (needs network + DNS)
npx --no-install di verify zuraai.xyz

# 5) Provenance / signatures (as in RELEASE.md)
npm audit signatures --registry=$PUBLIC_NPM_REGISTRY

# 6) Global install check (PATH + Windows launcher under di's own npm spawn)
npm install --global --ignore-scripts "domaininstall@$RELEASE_VERSION" `
  --registry=$PUBLIC_NPM_REGISTRY
npm config get prefix
# Confirm %APPDATA%\npm (or the printed prefix) is on PATH, then:
di --version
domaininstall --version
dnstall --version
di verify zuraai.xyz

# 7) Optional: live project E2E using published CLI (or tag-built dist)
# From a separate temp project with package.json only:
#   di zuraai.xyz --yes
# Expect node_modules\zuraai and a pins.json pin under an isolated DOMAININSTALL_STATE_DIR

# 8) Record in ROADMAP.md §4 outstanding gate: OS build, Node, npm, launcher path used,
#    commands run, pass/fail, date, and any PATH caveats.
```

**Cleanup after the run:**

```powershell
npm uninstall --global domaininstall
Remove-Item Env:NPM_CONFIG_USERCONFIG -ErrorAction SilentlyContinue
Set-Location $env:USERPROFILE
Remove-Item -Recurse -Force $work
```

### 5.3 Optional: portable live E2E from a tag checkout

[`scripts/e2e.ts`](../../scripts/e2e.ts) already uses `process.execPath` + `dist/cli.js` with `shell: false` and isolated `DOMAININSTALL_STATE_DIR` — it is not Linux-specific. After `npm ci` / `npm run build` on the release tag:

```powershell
$env:DOMAININSTALL_E2E_DOMAIN = "zuraai.xyz"
$env:DOMAININSTALL_E2E_PACKAGE = "zuraai"
npm run test:e2e
```

That validates Windows **source-built** install behavior (including the launcher). It does **not** replace the post-publish gate, which must use the **registry artifact**.

### 5.4 What to write back into ROADMAP when done

- Checkbox complete under §4 Outstanding exit gate  
- One short evidence line: date, Windows edition, Node version, npm version (shell **and** launcher path if different), pass/fail of local + global alias checks, `di verify zuraai.xyz`  
- Note residual: live E2E CI still Ubuntu-only unless a Windows job is added later  

### 5.5 This research pass vs closing the gate

This memo **documents launcher realism and exact PowerShell commands**. It does **not** claim the ROADMAP checkbox is closed: a deliberate clean-machine post-publish run (and recording) is still required.

---

## 6. Recommendations (concise)

1. **Treat the Windows launcher as correct for stock Node installers** (this machine proves the primary discovery path works).
2. **Close the 0.0.3 gate** with the PowerShell procedure in §5 on a clean Windows VM; record evidence in ROADMAP.
3. **Do not expand product code** for `npm-prefix.js` parity unless a real install fails; document dual-npm version skew as a known Windows footgun.
4. **Keep `--ignore-scripts`**; document `npm rebuild` recovery; avoid “safer install” overclaim.
5. **Leave G11 residual risk documented**; no hardening sprint pre-M4 without demand (F21).
6. **Test fixture follow-up (optional, separate PR):** scope-registry unit fixtures should include `package.json` so npm 11 project config applies on all OSes — product logic already correct when project root is real.
7. **CI:** consider Windows live E2E only after manual post-publish success (RB-WIN-NPM method).

---

## 7. Machine snapshot (quick reference)

```text
OS:              Windows (win32)
Node:            v24.14.1  C:\Program Files\nodejs\node.exe
Shell npm:       11.5.2    (global prefix copy)
Launcher npm:    11.11.0   C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js
prefix:          C:\Users\Nikhil\AppData\Roaming\npm
registry:        https://registry.npmjs.org/
npm_execpath:    unset in interactive shell
fnm/nvm-windows: absent
domaininstall -g: not installed
di --version (dist): 0.0.3
Published 0.0.3: reachable on registry.npmjs.org
```
