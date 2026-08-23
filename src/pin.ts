/**
 * Trust-on-first-use pin storage.
 *
 * Trust continuity is security state: unreadable, malformed, or unsafe storage
 * must stop installation instead of being treated as a new first use.
 */

import { randomUUID } from "node:crypto";
import {
  closeSync,
  constants,
  existsSync,
  fchmodSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { validateDomain, validatePackageName, validateVersionRange } from "./validate.js";

export interface Pin {
  namespace: string;
  package: string;
  registry: string;
  dnsVersion: string | null;
  /** Exact root package version last installed; null means legacy/unknown. */
  resolvedVersion: string | null;
  /** Registry SRI for resolvedVersion; null means legacy/unknown. */
  integrity: string | null;
  /** Canonical registry tarball URL; null means legacy/unknown. */
  tarball: string | null;
  /** Time the artifact metadata was resolved; null means legacy/unknown. */
  resolvedAt: string | null;
  firstSeen: string;
  lastSeen: string;
}

export interface PinChange {
  field: "namespace" | "package" | "registry" | "dnsVersion" | "resolvedVersion" | "integrity" | "tarball";
  was: string;
  now: string;
}

export class PinStoreError extends Error {
  override readonly name = "PinStoreError";

  constructor(message: string) {
    super(message);
  }
}

/**
 * POSIX ownership and permission bits, opening a directory to fsync it, and
 * the O_NOFOLLOW guarantee used for file opens are unavailable on Windows.
 * Windows still rejects a symlinked state directory via lstat, validates the
 * schema, locks writers, and atomically replaces the store, but file-level
 * symlinks or reparse points do not receive the same no-follow guarantee. The
 * Windows store therefore also relies on the per-user profile directory ACL.
 */
const IS_WINDOWS = process.platform === "win32";

const DIR = process.env.DOMAININSTALL_STATE_DIR || join(homedir(), ".domaininstall");
const FILE = join(DIR, "pins.json");
const LOCK_FILE = join(DIR, "pins.lock");
const STORE_VERSION = 2;
const LOCK_WAIT_MS = 5000;

type PinStore = Record<string, Pin>;
interface StoredPinFile {
  version: typeof STORE_VERSION;
  pins: PinStore;
}

const sleeper = new Int32Array(new SharedArrayBuffer(4));

function fail(message: string): never {
  throw new PinStoreError(`${message} Run \`di trust reset --all\` to preserve a backup and recover.`);
}

function currentUid(): number | undefined {
  return typeof process.getuid === "function" ? process.getuid() : undefined;
}

function ensureStateDir(): void {
  if (!existsSync(DIR)) {
    mkdirSync(DIR, { recursive: true, mode: 0o700 });
  }
  const stat = lstatSync(DIR);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    fail(`Unsafe trust-state directory at ${DIR}.`);
  }
  if (IS_WINDOWS) return;
  const uid = currentUid();
  if (uid !== undefined && stat.uid !== uid) fail(`Trust-state directory is not owned by the current user.`);
  if ((stat.mode & 0o077) !== 0) {
    const fd = openSync(DIR, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      fchmodSync(fd, 0o700);
    } finally {
      closeSync(fd);
    }
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value;
}

function normalizeStoredRegistry(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return null;
  const candidate = /^[a-z0-9.-]+(?::\d+)?$/i.test(value) ? `https://${value}/` : value;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !url.hostname || url.username || url.password || url.search || url.hash) {
    return null;
  }
  // Match install.ts canonicalizeRegistryUrl: stable pin equality across npm output shapes.
  url.hostname = url.hostname.toLowerCase();
  if (!url.pathname.endsWith("/")) {
    url.pathname = `${url.pathname}/`;
  }
  return url.href;
}

const EXACT_VERSION =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const SRI_DIGEST_BYTES = { sha256: 32, sha384: 48, sha512: 64 } as const;

function isSupportedSri(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 8192) return false;
  const tokens = value.trim().split(/\s+/);
  if (tokens.length === 0) return false;
  return tokens.every((token) => {
    const match = /^(sha256|sha384|sha512)-([A-Za-z0-9+/]+={0,2})(?:\?[^\s]+)?$/.exec(token);
    if (!match) return false;
    const algorithm = match[1] as keyof typeof SRI_DIGEST_BYTES;
    const encoded = match[2]!;
    const digest = Buffer.from(encoded, "base64");
    return digest.length === SRI_DIGEST_BYTES[algorithm] && digest.toString("base64") === encoded;
  });
}

function normalizeTarballUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 8192) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !url.hostname || url.username || url.password || url.search || url.hash) {
    return null;
  }
  url.hostname = url.hostname.toLowerCase();
  return url.href;
}

function parsePin(value: unknown, schemaVersion: 0 | 1 | 2): Pin | null {
  if (!isPlainObject(value)) return null;
  const namespace = value.namespace;
  const packageName = value.package;
  const registry = value.registry;
  const dnsVersion = value.dnsVersion;
  const resolvedVersion = value.resolvedVersion;
  const integrity = value.integrity;
  const tarball = value.tarball;
  const resolvedAt = value.resolvedAt;
  const firstSeen = value.firstSeen;
  const lastSeen = value.lastSeen;

  if (typeof namespace !== "string" || !/^[a-z0-9]+$/.test(namespace)) return null;
  if (typeof packageName !== "string" || !validatePackageName(packageName).ok) return null;
  const normalizedRegistry = normalizeStoredRegistry(registry);
  if (!normalizedRegistry) return null;
  if (dnsVersion !== null && dnsVersion !== undefined) {
    if (typeof dnsVersion !== "string" || !validateVersionRange(dnsVersion).ok) return null;
  } else if (schemaVersion >= 1 && dnsVersion !== null) {
    return null;
  }
  if (schemaVersion === 2) {
    const allUnknown = resolvedVersion === null && integrity === null && tarball === null && resolvedAt === null;
    const allKnown =
      typeof resolvedVersion === "string" &&
      EXACT_VERSION.test(resolvedVersion) &&
      isSupportedSri(integrity) &&
      normalizeTarballUrl(tarball) !== null &&
      isIsoTimestamp(resolvedAt);
    if (!allUnknown && !allKnown) return null;
  }
  if (!isIsoTimestamp(firstSeen) || !isIsoTimestamp(lastSeen) || firstSeen > lastSeen) return null;

  return {
    namespace,
    package: packageName,
    registry: normalizedRegistry,
    dnsVersion: typeof dnsVersion === "string" ? dnsVersion : null,
    resolvedVersion: schemaVersion === 2 && typeof resolvedVersion === "string" ? resolvedVersion : null,
    integrity: schemaVersion === 2 && typeof integrity === "string" ? integrity : null,
    tarball: schemaVersion === 2 ? normalizeTarballUrl(tarball) : null,
    resolvedAt: schemaVersion === 2 && typeof resolvedAt === "string" ? resolvedAt : null,
    firstSeen,
    lastSeen,
  };
}

function parsePins(value: unknown, schemaVersion: 0 | 1 | 2): PinStore | null {
  if (!isPlainObject(value)) return null;
  const pins: PinStore = Object.create(null) as PinStore;
  for (const [domain, rawPin] of Object.entries(value)) {
    if (!validateDomain(domain).ok) return null;
    const pin = parsePin(rawPin, schemaVersion);
    if (!pin) return null;
    pins[domain] = pin;
  }
  return pins;
}

function decodeStore(raw: string): PinStore {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    fail(`Trust-state file ${FILE} is not valid JSON.`);
  }

  if (!isPlainObject(parsed)) fail(`Trust-state file ${FILE} has an invalid schema.`);
  if (parsed.version === STORE_VERSION && Object.hasOwn(parsed, "pins")) {
    if (Object.keys(parsed).some((key) => key !== "version" && key !== "pins")) {
      fail(`Trust-state file ${FILE} has unexpected top-level fields.`);
    }
    const pins = parsePins(parsed.pins, 2);
    if (!pins) fail(`Trust-state file ${FILE} contains an invalid pin.`);
    return pins;
  }

  // v1 explicitly had no artifact identity. Preserve that fact as four nulls;
  // never infer an SRI from a version or from the current registry.
  if (parsed.version === 1 && Object.hasOwn(parsed, "pins")) {
    if (Object.keys(parsed).some((key) => key !== "version" && key !== "pins")) {
      fail(`Trust-state file ${FILE} has unexpected top-level fields.`);
    }
    const pins = parsePins(parsed.pins, 1);
    if (!pins) fail(`Trust-state file ${FILE} contains an invalid legacy pin.`);
    return pins;
  }

  // Validate the pre-v1 shape for a safe in-place migration on the next write.
  const legacy = parsePins(parsed, 0);
  if (!legacy) fail(`Trust-state file ${FILE} has an unsupported schema.`);
  return legacy;
}

function load(): PinStore {
  if (existsSync(DIR)) ensureStateDir();
  if (!existsSync(FILE)) return Object.create(null) as PinStore;

  let fd: number;
  try {
    fd = openSync(FILE, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch {
    fail(`Trust-state file ${FILE} cannot be opened safely.`);
  }

  try {
    const stat = fstatSync(fd);
    if (!stat.isFile()) fail(`Trust-state path ${FILE} is not a regular file.`);
    const uid = currentUid();
    if (uid !== undefined && stat.uid !== uid) fail(`Trust-state file is not owned by the current user.`);
    if (!IS_WINDOWS && (stat.mode & 0o077) !== 0) fchmodSync(fd, 0o600);
    return decodeStore(readFileSync(fd, "utf8"));
  } finally {
    closeSync(fd);
  }
}

function writeAtomically(pins: PinStore): void {
  ensureStateDir();
  const temp = join(DIR, `.pins-${process.pid}-${randomUUID()}.tmp`);
  let fd: number | undefined;
  try {
    fd = openSync(
      temp,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    );
    const stored: StoredPinFile = { version: STORE_VERSION, pins };
    writeFileSync(fd, JSON.stringify(stored, null, 2) + "\n", "utf8");
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    renameSync(temp, FILE);

    if (!IS_WINDOWS) {
      // Durably record the rename itself. Windows has no directory handle to
      // flush, and its rename already replaces the target atomically.
      const dirFd = openSync(DIR, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        fsyncSync(dirFd);
      } finally {
        closeSync(dirFd);
      }
    }
  } finally {
    if (fd !== undefined) closeSync(fd);
    if (existsSync(temp)) unlinkSync(temp);
  }
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return !(error instanceof Error && "code" in error && error.code === "ESRCH");
  }
}

function removeStaleLock(): boolean {
  try {
    const stat = lstatSync(LOCK_FILE);
    if (stat.isSymbolicLink() || !stat.isFile()) fail(`Unsafe trust-state lock at ${LOCK_FILE}.`);
    const raw = JSON.parse(readFileSync(LOCK_FILE, "utf8")) as unknown;
    if (!isPlainObject(raw) || !Number.isInteger(raw.pid) || typeof raw.pid !== "number") return false;
    if (processIsAlive(raw.pid)) return false;
    unlinkSync(LOCK_FILE);
    return true;
  } catch (error) {
    if (error instanceof PinStoreError) throw error;
    return false;
  }
}

function withLock<T>(operation: () => T): T {
  ensureStateDir();
  const deadline = Date.now() + LOCK_WAIT_MS;
  let lockFd: number | undefined;

  while (lockFd === undefined) {
    try {
      lockFd = openSync(
        LOCK_FILE,
        constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
        0o600,
      );
      writeFileSync(lockFd, JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }), "utf8");
      fsyncSync(lockFd);
    } catch (error) {
      if (lockFd !== undefined) {
        closeSync(lockFd);
        lockFd = undefined;
        if (existsSync(LOCK_FILE)) unlinkSync(LOCK_FILE);
        throw error;
      }
      if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
      if (removeStaleLock()) continue;
      if (Date.now() >= deadline) {
        throw new PinStoreError("Timed out waiting for another domaininstall process to release the trust-state lock.");
      }
      Atomics.wait(sleeper, 0, 0, 25);
    }
  }

  try {
    return operation();
  } finally {
    closeSync(lockFd);
    if (existsSync(LOCK_FILE)) unlinkSync(LOCK_FILE);
  }
}

export function getPin(domain: string): Pin | undefined {
  return load()[domain];
}

export interface PinEntry extends Pin {
  domain: string;
}

/**
 * Every remembered mapping, sorted by domain for deterministic output.
 *
 * Read-only: a corrupt or unsafe store still fails closed here, because
 * reporting "no pins" for an unreadable store would misrepresent trust state as
 * absent rather than broken.
 */
export function listPins(): PinEntry[] {
  const store = load();
  return Object.keys(store)
    .sort()
    .map((domain) => ({ domain, ...store[domain]! }));
}

/**
 * Remove a single domain's pin, leaving every other mapping intact.
 *
 * Returns the removed pin, or undefined when the domain disappeared or its
 * security-relevant identity changed after the caller displayed it. The
 * compare-and-delete happens under the same lock as savePin, so confirmation
 * can never delete a different mapping written concurrently.
 */
export function forgetPin(domain: string, expectedExisting: Pin): Pin | undefined {
  return withLock(() => {
    const store = load();
    const existing = store[domain];
    if (!existing || !pinIdentityEqual(existing, expectedExisting)) return undefined;
    delete store[domain];
    writeAtomically(store);
    return existing;
  });
}

export function diffPin(
  domain: string,
  next: {
    namespace: string;
    package: string;
    registry: string;
    dnsVersion: string | null;
    resolvedVersion?: string;
    integrity?: string;
    tarball?: string;
  },
): { existing: Pin | undefined; changes: PinChange[]; blockedArtifactMutation: boolean } {
  const existing = getPin(domain);
  if (!existing) return { existing: undefined, changes: [], blockedArtifactMutation: false };
  const changes: PinChange[] = [];
  if (existing.namespace !== next.namespace) {
    changes.push({ field: "namespace", was: existing.namespace, now: next.namespace });
  }
  if (existing.package !== next.package) {
    changes.push({ field: "package", was: existing.package, now: next.package });
  }
  const existingRegistry = normalizeStoredRegistry(existing.registry);
  const nextRegistry = normalizeStoredRegistry(next.registry);
  if (
    existingRegistry === null ||
    nextRegistry === null ||
    existingRegistry !== nextRegistry
  ) {
    changes.push({
      field: "registry",
      was: existing.registry,
      now: nextRegistry ?? next.registry,
    });
  }
  if (existing.dnsVersion !== next.dnsVersion) {
    changes.push({
      field: "dnsVersion",
      was: existing.dnsVersion ?? "latest",
      now: next.dnsVersion ?? "latest",
    });
  }
  if (next.resolvedVersion !== undefined && existing.resolvedVersion !== next.resolvedVersion) {
    changes.push({ field: "resolvedVersion", was: existing.resolvedVersion ?? "unknown", now: next.resolvedVersion });
  }
  if (next.integrity !== undefined && existing.integrity !== next.integrity) {
    changes.push({ field: "integrity", was: existing.integrity ?? "unknown", now: next.integrity });
  }
  if (next.tarball !== undefined && existing.tarball !== next.tarball) {
    changes.push({ field: "tarball", was: existing.tarball ?? "unknown", now: next.tarball });
  }
  const sameKnownVersion =
    next.resolvedVersion !== undefined &&
    existing.resolvedVersion !== null &&
    existing.resolvedVersion === next.resolvedVersion;
  const sameArtifactSubject =
    existing.namespace === next.namespace &&
    existing.package === next.package &&
    existingRegistry !== null &&
    nextRegistry !== null &&
    existingRegistry === nextRegistry;
  const blockedArtifactMutation =
    sameArtifactSubject &&
    sameKnownVersion &&
    ((next.integrity !== undefined && existing.integrity !== next.integrity) ||
      (next.tarball !== undefined && existing.tarball !== next.tarball));
  return { existing, changes, blockedArtifactMutation };
}

export type SavePinInput = {
  namespace: string;
  package: string;
  registry: string;
  dnsVersion: string | null;
  resolvedVersion?: string;
  integrity?: string;
  tarball?: string;
  resolvedAt?: string;
};

type NormalizedPinInput = {
  namespace: string;
  package: string;
  registry: string;
  dnsVersion: string | null;
  resolvedVersion: string | null;
  integrity: string | null;
  tarball: string | null;
  resolvedAt: string | null;
};

export type SavePinResult =
  | { ok: true }
  | { ok: false; reason: "diverged" | "invalid"; message: string; changes?: PinChange[] };

type PinIdentity = {
  namespace: string;
  package: string;
  registry: string;
  dnsVersion: string | null;
  resolvedVersion: string | null;
  integrity: string | null;
  tarball: string | null;
};

function pinIdentityEqual(a: PinIdentity, b: PinIdentity): boolean {
  const registryA = normalizeStoredRegistry(a.registry);
  const registryB = normalizeStoredRegistry(b.registry);
  return (
    a.namespace === b.namespace &&
    a.package === b.package &&
    registryA !== null &&
    registryB !== null &&
    registryA === registryB &&
    a.dnsVersion === b.dnsVersion &&
    a.resolvedVersion === b.resolvedVersion &&
    a.integrity === b.integrity &&
    a.tarball === b.tarball
  );
}

function identityChanges(was: PinIdentity, now: PinIdentity): PinChange[] {
  const changes: PinChange[] = [];
  if (was.namespace !== now.namespace) {
    changes.push({ field: "namespace", was: was.namespace, now: now.namespace });
  }
  if (was.package !== now.package) {
    changes.push({ field: "package", was: was.package, now: now.package });
  }
  if (was.registry !== now.registry) {
    changes.push({ field: "registry", was: was.registry, now: now.registry });
  }
  if (was.dnsVersion !== now.dnsVersion) {
    changes.push({
      field: "dnsVersion",
      was: was.dnsVersion ?? "latest",
      now: now.dnsVersion ?? "latest",
    });
  }
  if (was.resolvedVersion !== now.resolvedVersion) {
    changes.push({ field: "resolvedVersion", was: was.resolvedVersion ?? "unknown", now: now.resolvedVersion ?? "unknown" });
  }
  if (was.integrity !== now.integrity) {
    changes.push({ field: "integrity", was: was.integrity ?? "unknown", now: now.integrity ?? "unknown" });
  }
  if (was.tarball !== now.tarball) {
    changes.push({ field: "tarball", was: was.tarball ?? "unknown", now: now.tarball ?? "unknown" });
  }
  return changes;
}

function validateSavePinInput(
  domain: string,
  next: SavePinInput,
): { ok: true; domain: string; next: NormalizedPinInput } | { ok: false; message: string } {
  const domainCheck = validateDomain(domain);
  if (!domainCheck.ok) {
    return { ok: false, message: `Invalid domain for pin store: ${domainCheck.error}` };
  }

  if (typeof next.namespace !== "string" || !/^[a-z0-9]+$/.test(next.namespace)) {
    return {
      ok: false,
      message: `Invalid pin namespace ${JSON.stringify(next.namespace)} (must match /^[a-z0-9]+$/).`,
    };
  }

  if (typeof next.package !== "string") {
    return { ok: false, message: "Invalid pin package: package name must be a string." };
  }
  const packageCheck = validatePackageName(next.package);
  if (!packageCheck.ok) {
    return { ok: false, message: `Invalid pin package: ${packageCheck.error}` };
  }

  const normalizedRegistry = normalizeStoredRegistry(next.registry);
  if (!normalizedRegistry) {
    return {
      ok: false,
      message: `Invalid pin registry ${JSON.stringify(next.registry)} (must be a valid https registry URL).`,
    };
  }

  if (next.dnsVersion !== null) {
    if (typeof next.dnsVersion !== "string") {
      return { ok: false, message: "Invalid pin dnsVersion: must be a string or null." };
    }
    const versionCheck = validateVersionRange(next.dnsVersion);
    if (!versionCheck.ok) {
      return { ok: false, message: `Invalid pin dnsVersion: ${versionCheck.error}` };
    }
  }

  const artifactValues = [next.resolvedVersion, next.integrity, next.tarball, next.resolvedAt];
  const artifactUnknown = artifactValues.every((value) => value === undefined);
  const artifactKnown = artifactValues.every((value) => typeof value === "string");
  if (!artifactUnknown && !artifactKnown) {
    return { ok: false, message: "Invalid pin artifact: identity fields must be all known or all unknown." };
  }
  let normalizedTarball: string | null = null;
  if (artifactKnown) {
    if (!EXACT_VERSION.test(next.resolvedVersion!)) {
      return { ok: false, message: "Invalid pin resolvedVersion: must be one exact npm version." };
    }
    if (!isSupportedSri(next.integrity)) {
      return { ok: false, message: "Invalid pin integrity: must contain a supported SRI digest." };
    }
    normalizedTarball = normalizeTarballUrl(next.tarball);
    if (!normalizedTarball) {
      return { ok: false, message: "Invalid pin tarball: must be a credential-free HTTPS URL." };
    }
    if (!isIsoTimestamp(next.resolvedAt)) {
      return { ok: false, message: "Invalid pin resolvedAt: must be an ISO timestamp." };
    }
  }

  return {
    ok: true,
    domain: domainCheck.value,
    next: {
      namespace: next.namespace,
      package: packageCheck.value,
      registry: normalizedRegistry,
      dnsVersion: next.dnsVersion,
      resolvedVersion: next.resolvedVersion ?? null,
      integrity: next.integrity ?? null,
      tarball: normalizedTarball,
      resolvedAt: next.resolvedAt ?? null,
    },
  };
}

/**
 * @param expectedExisting - pin identity observed at confirm time (undefined = expected no pin).
 *   Under lock, if the store's current pin for domain does not match expectedExisting identity
 *   (mapping plus immutable artifact identity), return { ok:false, reason:"diverged" } without writing.
 *   Identity match ignores firstSeen/lastSeen.
 */
export function savePin(
  domain: string,
  next: SavePinInput,
  expectedExisting?: Pin | undefined,
): SavePinResult {
  return withLock(() => {
    const validated = validateSavePinInput(domain, next);
    if (!validated.ok) {
      return { ok: false, reason: "invalid", message: validated.message };
    }

    const store = load();
    const current = store[validated.domain];

    const expectedAbsent = expectedExisting === undefined;
    const identityMatches =
      expectedAbsent
        ? current === undefined
        : current !== undefined && pinIdentityEqual(current, expectedExisting);

    if (!identityMatches) {
      // Concurrent first-use of the same mapping: another process already wrote
      // the identity we intended. Treat as success (refresh lastSeen) instead of
      // failing a completed install over a race on an identical pin.
      if (expectedAbsent && current !== undefined && pinIdentityEqual(current, validated.next)) {
        const now = new Date().toISOString();
        store[validated.domain] = {
          ...validated.next,
          firstSeen: current.firstSeen,
          lastSeen: now,
        };
        writeAtomically(store);
        return { ok: true };
      }

      const changes =
        current !== undefined && expectedExisting !== undefined
          ? identityChanges(expectedExisting, current)
          : current !== undefined
            ? identityChanges(current, validated.next)
            : undefined;
      return {
        ok: false,
        reason: "diverged",
        message: expectedAbsent
          ? `Trust pin for ${validated.domain} appeared while confirming; store was not updated.`
          : current === undefined
            ? `Trust pin for ${validated.domain} was removed while confirming; store was not updated.`
            : `Trust pin for ${validated.domain} changed while confirming; store was not updated.`,
        ...(changes !== undefined && changes.length > 0 ? { changes } : {}),
      };
    }

    const now = new Date().toISOString();
    store[validated.domain] = {
      ...validated.next,
      firstSeen: current?.firstSeen ?? now,
      lastSeen: now,
    };
    writeAtomically(store);
    return { ok: true };
  });
}

/** Preserve the old file as a backup, then create a valid empty v2 store. */
export function resetPinStore(): string | null {
  return withLock(() => {
    let backup: string | null = null;
    if (existsSync(FILE)) {
      const suffix = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}`;
      backup = join(DIR, `pins.backup-${suffix}.json`);
      renameSync(FILE, backup);
    }
    writeAtomically(Object.create(null) as PinStore);
    return backup;
  });
}

export const PIN_FILE = FILE;
