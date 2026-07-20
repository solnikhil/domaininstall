/**
 * Trust-on-first-use (TOFU) pinning.
 *
 * The scariest attack on a domain->package system is a domain expiring or
 * changing hands: an attacker re-registers the domain and repoints the record
 * at a malicious package. DNSSEC does NOT help — it faithfully signs the
 * attacker's record. The defense is continuity: remember what a domain mapped
 * to the first time we saw it, and loudly flag any later change.
 *
 * This is the same idea as Go's go.sum / SSH's known_hosts.
 */

import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";

export interface Pin {
  namespace: string;
  package: string;
  registry: string;
  firstSeen: string; // ISO timestamp
  lastSeen: string; // ISO timestamp
}

export interface PinChange {
  field: "namespace" | "package" | "registry";
  was: string;
  now: string;
}

// Tests and managed environments can isolate state without repurposing HOME.
const DIR = process.env.DOMAININSTALL_STATE_DIR || join(homedir(), ".domaininstall");
const FILE = join(DIR, "pins.json");

type PinStore = Record<string, Pin>;

function load(): PinStore {
  if (!existsSync(FILE)) return {};
  try {
    return JSON.parse(readFileSync(FILE, "utf8")) as PinStore;
  } catch {
    return {}; // corrupt file -> treat as empty rather than crash
  }
}

function save(store: PinStore): void {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(store, null, 2) + "\n", "utf8");
}

export function getPin(domain: string): Pin | undefined {
  return load()[domain];
}

/**
 * Compare the freshly-resolved mapping against the stored pin.
 * Returns the list of changed fields (empty if it matches or is new).
 */
export function diffPin(
  domain: string,
  next: { namespace: string; package: string; registry: string },
): { existing: Pin | undefined; changes: PinChange[] } {
  const existing = getPin(domain);
  if (!existing) return { existing: undefined, changes: [] };
  const changes: PinChange[] = [];
  if (existing.namespace !== next.namespace)
    changes.push({ field: "namespace", was: existing.namespace, now: next.namespace });
  if (existing.package !== next.package)
    changes.push({ field: "package", was: existing.package, now: next.package });
  if (existing.registry !== next.registry)
    changes.push({ field: "registry", was: existing.registry, now: next.registry });
  return { existing, changes };
}

/** Record or refresh the pin after a confirmed install. */
export function savePin(
  domain: string,
  next: { namespace: string; package: string; registry: string },
): void {
  const store = load();
  const now = new Date().toISOString();
  const existing = store[domain];
  store[domain] = {
    namespace: next.namespace,
    package: next.package,
    registry: next.registry,
    firstSeen: existing?.firstSeen ?? now,
    lastSeen: now,
  };
  save(store);
}

export const PIN_FILE = FILE;
