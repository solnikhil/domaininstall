import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

import type { Harness, TestModule } from "./harness.ts";

function run(h: Harness): void {
  h.section("cli.ts — process integration (mocked DNS + fake npm)");

  const cli = join(import.meta.dirname, "..", "..", "dist", "cli.js");
  const root = mkdtempSync(join(tmpdir(), "dnstall-cli-extra-"));
  const fakeBin = join(root, "bin");
  mkdirSync(fakeBin);

  const fakeArtifactBytes = "deterministic CLI fixture tarball";
  const fakeArtifactIntegrity = `sha512-${createHash("sha512").update(fakeArtifactBytes).digest("base64")}`;
  const fakeNpmBody = `const fs = require("node:fs");
const path = require("node:path");
if (process.argv.includes("config") && process.argv.includes("get")) {
  const key = process.argv[process.argv.indexOf("get") + 1];
  if (key === "registry" || (key && key.endsWith(":registry"))) {
    process.stdout.write("https://registry.npmjs.org/\\n");
    process.exit(0);
  }
  if (key === "prefix") {
    process.stdout.write("${join(root, "prefix").replace(/\\/g, "\\\\")}\\n");
    process.exit(0);
  }
  process.stdout.write("undefined\\n");
  process.exit(0);
}
if (process.argv[2] === "view") {
  const counterPath = process.env.DOMAININSTALL_METADATA_COUNTER;
  let count = 0;
  if (counterPath) {
    try { count = Number(fs.readFileSync(counterPath, "utf8")); } catch {}
    fs.writeFileSync(counterPath, String(count + 1));
  }
  const integrity = process.env.DOMAININSTALL_MUTATE_METADATA_AFTER_FIRST === "1" && count > 0
    ? "sha512-${Buffer.alloc(64, 9).toString("base64")}"
    : ${JSON.stringify(fakeArtifactIntegrity)};
  process.stdout.write(JSON.stringify({ version: "2.4.1", "dist.integrity": integrity, "dist.tarball": "https://registry.npmjs.org/safe-package/-/safe-package-2.4.1.tgz" }));
  process.exit(0);
}
if (process.argv[2] === "pack") {
  const outputArg = process.argv.find((arg) => arg.startsWith("--pack-destination="));
  const output = outputArg.slice("--pack-destination=".length);
  fs.writeFileSync(path.join(output, "safe-package-2.4.1.tgz"), ${JSON.stringify(fakeArtifactBytes)});
  process.stdout.write(JSON.stringify([{ filename: "safe-package-2.4.1.tgz" }]));
  process.exit(0);
}
if (process.argv[2] === "cache") process.exit(0);
fs.appendFileSync(process.env.DOMAININSTALL_TEST_MARKER || "", (process.argv.slice(2).join(" ")) + "\\n");
process.exit(0);
`;
  writeFileSync(join(fakeBin, "npm"), `#!/usr/bin/env node\n${fakeNpmBody}`);
  try {
    chmodSync(join(fakeBin, "npm"), 0o755);
  } catch {
    /* windows */
  }
  writeFileSync(join(fakeBin, "npm.cmd"), "@echo off\r\nnode \"%~dp0node_modules\\npm\\bin\\npm-cli.js\" %*\r\n");
  mkdirSync(join(fakeBin, "node_modules", "npm", "bin"), { recursive: true });
  writeFileSync(join(fakeBin, "node_modules", "npm", "bin", "npm-cli.js"), fakeNpmBody);

  const mockDns = join(root, "mock-dns.mjs");
  writeFileSync(
    mockDns,
    `const mode = process.env.DOMAININSTALL_TEST_DNS_MODE || "single";
const table = {
  single: [{ type: 16, data: '"dnstall=pkg:npm/safe-package"' }],
  versioned: [{ type: 16, data: '"dnstall=pkg:npm/safe-package@^2"' }],
  scoped: [{ type: 16, data: '"dnstall=pkg:npm/%40acme/widget"' }],
  empty: [],
  nx: null,
  badpkg: [{ type: 16, data: '"dnstall=pkg:npm/--evil"' }],
  foreign: [{ type: 16, data: '"dnslink=/ipfs/abc"' }],
  multi: [
    { type: 16, data: '"dnstall=pkg:npm/a"' },
    { type: 16, data: '"dnstall=pkg:npm/b"' },
  ],
};
globalThis.fetch = async () => {
  if (mode === "nx") {
    return new Response(JSON.stringify({ Status: 3 }), { status: 200, headers: { "content-type": "application/json" } });
  }
  if (mode === "servfail") {
    return new Response(JSON.stringify({ Status: 2 }), { status: 200, headers: { "content-type": "application/json" } });
  }
  const answers = table[mode] ?? table.single;
  return new Response(JSON.stringify({
    Status: 0,
    AD: true,
    Answer: (answers || []).map((a) => a),
  }), { status: 200, headers: { "content-type": "application/json" } });
};
`,
  );
  const mockDnsUrl = pathToFileURL(mockDns).href;
  const marker = join(root, "install-marker");
  const gatePath = `${fakeBin}${delimiter}${process.env.PATH ?? process.env.Path ?? ""}`;

  const runCli = (args: string[], env: Record<string, string | undefined> = {}) => {
    const stateDir = env.DOMAININSTALL_STATE_DIR ?? join(root, "state-default");
    mkdirSync(stateDir, { recursive: true });
    const pathEnv =
      process.platform === "win32"
        ? { Path: gatePath, PATH: gatePath }
        : { PATH: gatePath };
    return spawnSync(process.execPath, ["--import", mockDnsUrl, cli, ...args], {
      encoding: "utf8",
      env: {
        ...process.env,
        ...pathEnv,
        npm_execpath: "",
        DOMAININSTALL_TEST_MARKER: marker,
        DOMAININSTALL_STATE_DIR: stateDir,
        DOMAININSTALL_TEST_DNS_MODE: "single",
        ...env,
      },
    });
  };

  // verify success
  const verifyState = join(root, "verify-state");
  const verify = runCli(["verify", "example.com"], {
    DOMAININSTALL_STATE_DIR: verifyState,
    DOMAININSTALL_TEST_DNS_MODE: "single",
  });
  h.check(
    "verify succeeds for valid mapping",
    verify.status === 0 &&
      (verify.stdout.includes("safe-package") || verify.stdout.includes("dnstall") || verify.stdout.length > 0),
  );
  h.check("verify does not install", !existsSync(marker));

  // verify NXDOMAIN
  const nx = runCli(["verify", "missing.example"], {
    DOMAININSTALL_STATE_DIR: join(root, "nx-state"),
    DOMAININSTALL_TEST_DNS_MODE: "nx",
  });
  h.check("verify NXDOMAIN exits non-zero", nx.status !== 0);

  // verify no dnstall record (foreign only / empty)
  const foreign = runCli(["verify", "empty.example"], {
    DOMAININSTALL_STATE_DIR: join(root, "foreign-state"),
    DOMAININSTALL_TEST_DNS_MODE: "foreign",
  });
  h.check("verify with only foreign TXT fails", foreign.status !== 0);

  const empty = runCli(["verify", "nodata.example"], {
    DOMAININSTALL_STATE_DIR: join(root, "empty-state"),
    DOMAININSTALL_TEST_DNS_MODE: "empty",
  });
  h.check("verify NODATA fails", empty.status !== 0);

  // verify conflicting
  const multi = runCli(["verify", "multi.example"], {
    DOMAININSTALL_STATE_DIR: join(root, "multi-state"),
    DOMAININSTALL_TEST_DNS_MODE: "multi",
  });
  h.check("verify conflicting mappings fails", multi.status !== 0);

  // install first-use with --yes
  if (existsSync(marker)) rmSync(marker);
  const installState = join(root, "install-state");
  const project = join(root, "project");
  mkdirSync(project);
  writeFileSync(join(project, "package.json"), JSON.stringify({ name: "proj", version: "1.0.0" }));

  const install = spawnSync(
    process.execPath,
    ["--import", mockDnsUrl, cli, "example.com", "--yes"],
    {
      encoding: "utf8",
      cwd: project,
      env: {
        ...process.env,
        ...(process.platform === "win32" ? { Path: gatePath, PATH: gatePath } : { PATH: gatePath }),
        npm_execpath: "",
        DOMAININSTALL_TEST_MARKER: marker,
        DOMAININSTALL_STATE_DIR: installState,
        DOMAININSTALL_TEST_DNS_MODE: "single",
      },
    },
  );
  h.check(
    "install --yes first-use runs npm install",
    install.status === 0 && existsSync(marker),
  );
  h.check(
    "preview exposes exact version, full SRI, and canonical tarball",
    install.stdout.includes("2.4.1") &&
      install.stdout.includes(fakeArtifactIntegrity) &&
      install.stdout.includes("safe-package-2.4.1.tgz"),
  );
  const installArgv = existsSync(marker) ? readFileSync(marker, "utf8") : "";
  h.check(
    "npm handoff is exact and never uses a range or local file dependency",
    installArgv.includes("safe-package@2.4.1") &&
      installArgv.includes("--save-exact") &&
      !installArgv.includes("safe-package@^2") &&
      !installArgv.includes("file:"),
  );
  if (existsSync(join(installState, "pins.json"))) {
    const pins = JSON.parse(readFileSync(join(installState, "pins.json"), "utf8")) as {
      version: number;
      pins: Record<string, { package: string; resolvedVersion: string; integrity: string; tarball: string }>;
    };
    h.check(
      "install writes v2 artifact identity pin for domain",
      pins.version === 2 &&
        pins.pins["example.com"]?.package === "safe-package" &&
        pins.pins["example.com"]?.resolvedVersion === "2.4.1" &&
        pins.pins["example.com"]?.integrity === fakeArtifactIntegrity &&
        pins.pins["example.com"]?.tarball.endsWith("safe-package-2.4.1.tgz"),
    );
  } else {
    h.check("install writes TOFU pin for domain", false, "pins.json missing");
  }

  // second install same mapping ok
  if (existsSync(marker)) rmSync(marker);
  const install2 = spawnSync(
    process.execPath,
    ["--import", mockDnsUrl, cli, "example.com", "--yes"],
    {
      encoding: "utf8",
      cwd: project,
      env: {
        ...process.env,
        ...(process.platform === "win32" ? { Path: gatePath, PATH: gatePath } : { PATH: gatePath }),
        npm_execpath: "",
        DOMAININSTALL_TEST_MARKER: marker,
        DOMAININSTALL_STATE_DIR: installState,
        DOMAININSTALL_TEST_DNS_MODE: "single",
      },
    },
  );
  h.check("install second time with same pin succeeds", install2.status === 0);

  // Registry metadata is re-fetched after confirmation. Any exact artifact
  // change between preview and handoff must stop before npm install.
  if (existsSync(marker)) rmSync(marker);
  const metadataCounter = join(root, "metadata-counter");
  const metadataToctou = spawnSync(
    process.execPath,
    ["--import", mockDnsUrl, cli, "example.com", "--yes"],
    {
      encoding: "utf8",
      cwd: project,
      env: {
        ...process.env,
        ...(process.platform === "win32" ? { Path: gatePath, PATH: gatePath } : { PATH: gatePath }),
        npm_execpath: "",
        DOMAININSTALL_TEST_MARKER: marker,
        DOMAININSTALL_STATE_DIR: join(root, "metadata-toctou-state"),
        DOMAININSTALL_TEST_DNS_MODE: "single",
        DOMAININSTALL_METADATA_COUNTER: metadataCounter,
        DOMAININSTALL_MUTATE_METADATA_AFTER_FIRST: "1",
      },
    },
  );
  h.check(
    "post-confirmation registry metadata mutation fails before install",
    metadataToctou.status === 1 &&
      metadataToctou.stderr.includes("changed after confirmation") &&
      !existsSync(marker),
  );

  const changeState = join(root, "artifact-change-state");
  mkdirSync(changeState);
  const pinTime = "2026-08-01T00:00:00.000Z";
  writeFileSync(join(changeState, "pins.json"), JSON.stringify({ version: 2, pins: {
    "example.com": {
      namespace: "npm", package: "safe-package", registry: "https://registry.npmjs.org/", dnsVersion: null,
      resolvedVersion: "2.3.0", integrity: `sha512-${Buffer.alloc(64, 3).toString("base64")}`,
      tarball: "https://registry.npmjs.org/safe-package/-/safe-package-2.3.0.tgz", resolvedAt: pinTime,
      firstSeen: pinTime, lastSeen: pinTime,
    },
  } }), "utf8");
  const exactVersionChange = spawnSync(process.execPath, ["--import", mockDnsUrl, cli, "example.com", "--yes"], {
    encoding: "utf8", cwd: project,
    env: {
      ...process.env,
      ...(process.platform === "win32" ? { Path: gatePath, PATH: gatePath } : { PATH: gatePath }),
      npm_execpath: "", DOMAININSTALL_TEST_MARKER: marker, DOMAININSTALL_STATE_DIR: changeState,
      DOMAININSTALL_TEST_DNS_MODE: "single",
    },
  });
  h.check(
    "--yes cannot bypass an exact-version artifact change",
    exactVersionChange.status === 130 && exactVersionChange.stderr.includes("Ignoring --yes") && !existsSync(marker),
  );

  const mutationState = join(root, "same-version-mutation-state");
  mkdirSync(mutationState);
  writeFileSync(join(mutationState, "pins.json"), JSON.stringify({ version: 2, pins: {
    "example.com": {
      namespace: "npm", package: "safe-package", registry: "https://registry.npmjs.org/", dnsVersion: null,
      resolvedVersion: "2.4.1", integrity: `sha512-${Buffer.alloc(64, 4).toString("base64")}`,
      tarball: "https://registry.npmjs.org/safe-package/-/safe-package-2.4.1.tgz", resolvedAt: pinTime,
      firstSeen: pinTime, lastSeen: pinTime,
    },
  } }), "utf8");
  const sameVersionMutation = spawnSync(process.execPath, ["--import", mockDnsUrl, cli, "example.com", "--yes"], {
    encoding: "utf8", cwd: project,
    env: {
      ...process.env,
      ...(process.platform === "win32" ? { Path: gatePath, PATH: gatePath } : { PATH: gatePath }),
      npm_execpath: "", DOMAININSTALL_TEST_MARKER: marker, DOMAININSTALL_STATE_DIR: mutationState,
      DOMAININSTALL_TEST_DNS_MODE: "single",
    },
  });
  h.check(
    "same-version SRI mutation fails closed without a confirmation path",
    sameVersionMutation.status === 1 && sameVersionMutation.stderr.includes("never confirmable") && !existsSync(marker),
  );

  // install without --yes on non-tty should refuse
  if (existsSync(marker)) rmSync(marker);
  const noYes = spawnSync(process.execPath, ["--import", mockDnsUrl, cli, "fresh.example"], {
    encoding: "utf8",
    cwd: project,
    env: {
      ...process.env,
      ...(process.platform === "win32" ? { Path: gatePath, PATH: gatePath } : { PATH: gatePath }),
      npm_execpath: "",
      DOMAININSTALL_TEST_MARKER: marker,
      DOMAININSTALL_STATE_DIR: join(root, "noyes-state"),
      DOMAININSTALL_TEST_DNS_MODE: "single",
    },
  });
  // non-interactive without --yes should not install
  h.check(
    "install without --yes does not run npm in non-interactive mode",
    !existsSync(marker) || noYes.status !== 0,
  );

  // yarn project refused
  const yarnProj = join(root, "yarn-proj");
  mkdirSync(yarnProj);
  writeFileSync(join(yarnProj, "package.json"), JSON.stringify({ name: "y", version: "1.0.0" }));
  writeFileSync(join(yarnProj, "yarn.lock"), "");
  if (existsSync(marker)) rmSync(marker);
  const yarnInstall = spawnSync(
    process.execPath,
    ["--import", mockDnsUrl, cli, "example.com", "--yes"],
    {
      encoding: "utf8",
      cwd: yarnProj,
      env: {
        ...process.env,
        ...(process.platform === "win32" ? { Path: gatePath, PATH: gatePath } : { PATH: gatePath }),
        npm_execpath: "",
        DOMAININSTALL_TEST_MARKER: marker,
        DOMAININSTALL_STATE_DIR: join(root, "yarn-state"),
        DOMAININSTALL_TEST_DNS_MODE: "single",
      },
    },
  );
  h.check(
    "refuses install in yarn.lock project",
    yarnInstall.status !== 0 && !existsSync(marker),
  );

  // global install
  if (existsSync(marker)) rmSync(marker);
  const globalInstall = spawnSync(
    process.execPath,
    ["--import", mockDnsUrl, cli, "example.com", "--yes", "--global"],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        ...(process.platform === "win32" ? { Path: gatePath, PATH: gatePath } : { PATH: gatePath }),
        npm_execpath: "",
        DOMAININSTALL_TEST_MARKER: marker,
        DOMAININSTALL_STATE_DIR: join(root, "global-state"),
        DOMAININSTALL_TEST_DNS_MODE: "single",
      },
    },
  );
  const markerBody = existsSync(marker) ? readFileSync(marker, "utf8") : "";
  h.check(
    "global install invokes npm with --global",
    globalInstall.status === 0 && markerBody.includes("--global"),
  );

  // subpackage target
  if (existsSync(marker)) rmSync(marker);
  // mock DNS always returns same answer regardless of QNAME in our simple mock —
  // still ensures CLI accepts domain/sub syntax
  const sub = runCli(["verify", "example.com/react"], {
    DOMAININSTALL_STATE_DIR: join(root, "sub-state"),
    DOMAININSTALL_TEST_DNS_MODE: "single",
  });
  h.check("verify accepts domain/sub target", sub.status === 0 || sub.status === 1); // 0 if mapping found
  // with single mode always returns a package for any query, so should succeed
  h.check("verify domain/sub with mock answer succeeds", sub.status === 0);

  // CLI version override on target
  const verTarget = runCli(["verify", "example.com@1.2.3"], {
    DOMAININSTALL_STATE_DIR: join(root, "ver-state"),
    DOMAININSTALL_TEST_DNS_MODE: "versioned",
  });
  h.check("verify accepts domain@version", verTarget.status === 0);

  // trust reset force empty
  const tr = runCli(["trust", "reset", "--all", "--force"], {
    DOMAININSTALL_STATE_DIR: join(root, "trust-empty"),
  });
  h.check("trust reset --force on empty/new state succeeds", tr.status === 0);

  // invalid target
  const bad = runCli(["not a domain", "--yes"], {
    DOMAININSTALL_STATE_DIR: join(root, "bad-target"),
  });
  h.check("invalid domain target fails", bad.status !== 0);

  rmSync(root, { recursive: true, force: true });
}

export const cliTests: TestModule = { name: "cli", run };
