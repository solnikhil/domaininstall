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

const DIR = process.env.DOMAININSTALL_STATE_DIR || join(homedir(), ".domaininstall");
const FILE = join(DIR, "pins.json");
const LOCK_FILE = join(DIR, "pins.lock");
const STORE_VERSION = 1;
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
    if ((stat.mode & 0o077) !== 0) fchmodSync(fd, 0o600);
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

    const dirFd = openSync(DIR, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      fsyncSync(dirFd);
    } finally {
      closeSync(dirFd);
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
  if (existing.registry !== next.registry) {
    changes.push({ field: "registry", was: existing.registry, now: next.registry });
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

export function savePin(
  domain: string,
  next: { namespace: string; package: string; registry: string; dnsVersion: string | null },
): void {
  withLock(() => {
    const store = load();
    const now = new Date().toISOString();
    const existing = store[domain];
    store[domain] = {
      ...next,
      firstSeen: existing?.firstSeen ?? now,
      lastSeen: now,
    };
    writeAtomically(store);
  });
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
