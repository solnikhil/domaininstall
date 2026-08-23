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
  linkSync,
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
  firstSeen: string;
  lastSeen: string;
}

export interface PinChange {
  field: "namespace" | "package" | "registry" | "dnsVersion";
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
const STORE_VERSION = 1;
const LOCK_WAIT_MS = 5000;
// A lock created by older releases was visible before its metadata was
// written. Give an in-flight legacy writer time to finish before treating an
// unchanged malformed file as crash residue. New locks are atomically
// published only after their metadata is durable, so they never need this
// grace period.
const MALFORMED_LOCK_GRACE_MS = 250;
const LOCK_VERSION = 1;

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

function parsePin(value: unknown, allowLegacy: boolean): Pin | null {
  if (!isPlainObject(value)) return null;
  const namespace = value.namespace;
  const packageName = value.package;
  const registry = value.registry;
  const dnsVersion = value.dnsVersion;
  const firstSeen = value.firstSeen;
  const lastSeen = value.lastSeen;

  if (typeof namespace !== "string" || !/^[a-z0-9]+$/.test(namespace)) return null;
  if (typeof packageName !== "string" || !validatePackageName(packageName).ok) return null;
  const normalizedRegistry = normalizeStoredRegistry(registry);
  if (!normalizedRegistry) return null;
  if (dnsVersion !== null && dnsVersion !== undefined) {
    if (typeof dnsVersion !== "string" || !validateVersionRange(dnsVersion).ok) return null;
  } else if (!allowLegacy && dnsVersion !== null) {
    return null;
  }
  if (!isIsoTimestamp(firstSeen) || !isIsoTimestamp(lastSeen) || firstSeen > lastSeen) return null;

  return {
    namespace,
    package: packageName,
    registry: normalizedRegistry,
    dnsVersion: typeof dnsVersion === "string" ? dnsVersion : null,
    firstSeen,
    lastSeen,
  };
}

function parsePins(value: unknown, allowLegacy: boolean): PinStore | null {
  if (!isPlainObject(value)) return null;
  const pins: PinStore = Object.create(null) as PinStore;
  for (const [domain, rawPin] of Object.entries(value)) {
    if (!validateDomain(domain).ok) return null;
    const pin = parsePin(rawPin, allowLegacy);
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
    const pins = parsePins(parsed.pins, false);
    if (!pins) fail(`Trust-state file ${FILE} contains an invalid pin.`);
    return pins;
  }

  // Validate the pre-v1 shape for a safe in-place migration on the next write.
  const legacy = parsePins(parsed, true);
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

interface LockMetadata {
  version: typeof LOCK_VERSION;
  pid: number;
  token: string;
  createdAt: string;
}

interface LockHandle {
  release(): void;
}

interface InspectedLockMetadata {
  pid: number;
  current: LockMetadata | null;
}

function inspectLockMetadata(raw: string): InspectedLockMetadata | null {
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (
    !isPlainObject(value) ||
    typeof value.pid !== "number" ||
    !Number.isSafeInteger(value.pid) ||
    value.pid <= 0
  ) {
    return null;
  }

  // A parseable PID is honored even when the rest of the metadata came from
  // the pre-v1 protocol or is truncated. This intentionally favors waiting
  // over stealing a lock from a process that may still be writing it.
  if (
    value.version !== LOCK_VERSION ||
    typeof value.token !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.token) ||
    !isIsoTimestamp(value.createdAt)
  ) {
    return { pid: value.pid, current: null };
  }
  return { pid: value.pid, current: value as unknown as LockMetadata };
}

function sameFile(a: { dev: number; ino: number }, b: { dev: number; ino: number }): boolean {
  return a.dev === b.dev && a.ino === b.ino;
}

/**
 * Remove a lock only while retaining a hard-link claim to the exact inode we
 * inspected. This prevents a delayed cleanup/release from unlinking a newer
 * owner's lock after the pathname has been reused.
 */
function unlinkClaimedLock(observedFd: number, metadata: LockMetadata | null): boolean {
  const claim = join(DIR, `.pins-lock-claim-${process.pid}-${randomUUID()}.tmp`);
  try {
    linkSync(LOCK_FILE, claim);
    const observed = fstatSync(observedFd);
    const claimed = lstatSync(claim);
    if (!sameFile(observed, claimed)) return false;

    const current = lstatSync(LOCK_FILE);
    if (!sameFile(claimed, current)) return false;
    unlinkSync(LOCK_FILE);

    // New-protocol owners retain their original hard link while holding the
    // lock. Clean it after a crashed owner, but only if it is the inode claimed
    // above; never trust metadata to select an arbitrary path.
    if (metadata) {
      const owner = join(DIR, `.pins-lock-${metadata.token}.owner`);
      try {
        if (sameFile(claimed, lstatSync(owner))) unlinkSync(owner);
      } catch {
        // Missing owner link is harmless: the public lock was reclaimed.
      }
    }
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return true;
    return false;
  } finally {
    try {
      unlinkSync(claim);
    } catch {
      // The claim may not have been created.
    }
  }
}

function removeStaleLock(): boolean {
  let fd: number | undefined;
  try {
    fd = openSync(LOCK_FILE, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = fstatSync(fd);
    if (stat.isSymbolicLink() || !stat.isFile()) fail(`Unsafe trust-state lock at ${LOCK_FILE}.`);
    const inspected = inspectLockMetadata(readFileSync(fd, "utf8"));
    if (inspected && processIsAlive(inspected.pid)) return false;
    if (!inspected?.current && Date.now() - stat.mtimeMs < MALFORMED_LOCK_GRACE_MS) {
      return false;
    }
    return unlinkClaimedLock(fd, inspected?.current ?? null);
  } catch (error) {
    if (error instanceof PinStoreError) throw error;
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return true;
    return false;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

function acquireLock(): LockHandle {
  ensureStateDir();
  const deadline = Date.now() + LOCK_WAIT_MS;
  while (true) {
    const token = randomUUID();
    const owner = join(DIR, `.pins-lock-${token}.owner`);
    let ownerFd: number | undefined;
    try {
      // Construct and flush the owner privately. Publishing it with link(2)
      // is one atomic namespace operation, eliminating the empty/truncated
      // live-lock window of open(O_EXCL) followed by write.
      ownerFd = openSync(
        owner,
        constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
        0o600,
      );
      const metadata: LockMetadata = {
        version: LOCK_VERSION,
        pid: process.pid,
        token,
        createdAt: new Date().toISOString(),
      };
      writeFileSync(ownerFd, JSON.stringify(metadata), "utf8");
      fsyncSync(ownerFd);
      linkSync(owner, LOCK_FILE);

      let released = false;
      const heldFd = ownerFd;
      ownerFd = undefined;
      return {
        release(): void {
          if (released) return;
          released = true;
          try {
            const held = fstatSync(heldFd);
            try {
              const current = lstatSync(LOCK_FILE);
              if (sameFile(held, current)) unlinkSync(LOCK_FILE);
            } catch {
              // Missing/replaced public lock: do not touch the replacement.
            }
          } finally {
            closeSync(heldFd);
            try {
              unlinkSync(owner);
            } catch {
              // The private owner link may already have been reclaimed.
            }
          }
        },
      };
    } catch (error) {
      if (ownerFd !== undefined) closeSync(ownerFd);
      try {
        unlinkSync(owner);
      } catch {
        // Owner may not have been created.
      }
      if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
      if (removeStaleLock()) continue;
      if (Date.now() >= deadline) {
        throw new PinStoreError("Timed out waiting for another domaininstall process to release the trust-state lock.");
      }
      Atomics.wait(sleeper, 0, 0, 25);
    }
  }
}

function withLock<T>(operation: () => T): T {
  const lock = acquireLock();
  try {
    return operation();
  } finally {
    lock.release();
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
  next: { namespace: string; package: string; registry: string; dnsVersion: string | null },
): { existing: Pin | undefined; changes: PinChange[] } {
  const existing = getPin(domain);
  if (!existing) return { existing: undefined, changes: [] };
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
  return { existing, changes };
}

export type SavePinInput = {
  namespace: string;
  package: string;
  registry: string;
  dnsVersion: string | null;
};

export type SavePinResult =
  | { ok: true }
  | { ok: false; reason: "diverged" | "invalid"; message: string; changes?: PinChange[] };

export interface PinCommitReservation {
  /** Persist the validated pin while the reservation still owns the writer lock. */
  commit(): SavePinResult;
  /** Release without changing trust state (for example, after npm fails). */
  release(): void;
}

export type ReservePinCommitResult =
  | { ok: true; reservation: PinCommitReservation }
  | Exclude<SavePinResult, { ok: true }>;

type PinIdentity = {
  namespace: string;
  package: string;
  registry: string;
  dnsVersion: string | null;
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
    a.dnsVersion === b.dnsVersion
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
  return changes;
}

function validateSavePinInput(
  domain: string,
  next: SavePinInput,
): { ok: true; domain: string; next: SavePinInput } | { ok: false; message: string } {
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

  return {
    ok: true,
    domain: domainCheck.value,
    next: {
      namespace: next.namespace,
      package: packageCheck.value,
      registry: normalizedRegistry,
      dnsVersion: next.dnsVersion,
    },
  };
}

/**
 * @param expectedExisting - pin identity observed at confirm time (undefined = expected no pin).
 *   Under lock, if the store's current pin for domain does not match expectedExisting identity
 *   (namespace/package/registry/dnsVersion), return { ok:false, reason:"diverged" } without writing.
 *   Identity match ignores firstSeen/lastSeen.
 */
export function savePin(
  domain: string,
  next: SavePinInput,
  expectedExisting?: Pin | undefined,
): SavePinResult {
  const reserved = reservePinCommit(domain, next, expectedExisting);
  if (!reserved.ok) return reserved;
  try {
    return reserved.reservation.commit();
  } finally {
    reserved.reservation.release();
  }
}

/**
 * Validate and reserve a trust-state transaction before an external install
 * mutates the project. The writer lock remains held until commit/release, so a
 * successful npm run cannot later lose its continuity update to another
 * domaininstall writer or to pre-existing crash residue.
 */
export function reservePinCommit(
  domain: string,
  next: SavePinInput,
  expectedExisting?: Pin | undefined,
): ReservePinCommitResult {
  const validated = validateSavePinInput(domain, next);
  if (!validated.ok) {
    return { ok: false, reason: "invalid", message: validated.message };
  }

  const lock = acquireLock();
  try {
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
        // The identical first-use race is safe, but defer its lastSeen refresh
        // until commit just like every other reserved transaction.
      } else {
        const changes =
          current !== undefined && expectedExisting !== undefined
            ? identityChanges(expectedExisting, current)
            : current !== undefined
              ? identityChanges(current, validated.next)
              : undefined;
        lock.release();
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
    }

    let finished = false;
    let committed = false;
    const release = (): void => {
      if (finished) return;
      finished = true;
      lock.release();
    };

    return {
      ok: true,
      reservation: {
        commit(): SavePinResult {
          if (finished || committed) {
            throw new PinStoreError("Trust-pin transaction is no longer active.");
          }
          const now = new Date().toISOString();
          store[validated.domain] = {
            ...validated.next,
            firstSeen: current?.firstSeen ?? now,
            lastSeen: now,
          };
          writeAtomically(store);
          committed = true;
          return { ok: true };
        },
        release,
      },
    };
  } catch (error) {
    lock.release();
    throw error;
  }
}

/** Preserve the old file as a backup, then create a valid empty v1 store. */
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
