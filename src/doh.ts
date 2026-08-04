/**
 * DNS-over-HTTPS TXT resolution.
 *
 * DoH protects transport to the resolver, while DNSSEC's AD bit reports
 * authenticity validation. Resolver failures and authoritative negative
 * answers are deliberately kept separate so callers never mistake an outage
 * for proof that a domain has no record.
 */

const DOH_PROVIDERS = [
  "https://cloudflare-dns.com/dns-query",
  "https://dns.google/resolve",
] as const;

const TXT_TYPE = 16;

/** Max DoH response body size before JSON parse (256 KiB). */
export const MAX_DOH_BODY_BYTES = 262144;
/** Max Answer array length accepted from a DoH response. */
export const MAX_DOH_ANSWER_COUNT = 64;
/** Max characters per Answer data string. */
export const MAX_DOH_DATA_CHARS = 4096;

export type DnsAttemptOutcome =
  | "answer"
  | "nodata"
  | "nxdomain"
  | "servfail"
  | "refused"
  | "timeout"
  | "network_error"
  | "http_error"
  | "malformed"
  | "dns_error";

export type DnsOutcome = "answer" | "nodata" | "nxdomain" | "provider_exhaustion";

export interface DnsAttempt {
  provider: string;
  outcome: DnsAttemptOutcome;
  status?: number;
}

export interface TxtResult {
  outcome: DnsOutcome;
  records: string[];
  authenticated: boolean;
  status: number;
  provider: string | null;
  attempts: DnsAttempt[];
}

export interface ResolveTxtOptions {
  providers?: readonly string[];
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

interface DohAnswer {
  type: number;
  data: string;
  /** Optional owner name from the resolver (QNAME binding when present). */
  name?: string;
}

interface DohResponse {
  Status: number;
  AD?: boolean;
  Answer?: DohAnswer[];
}

interface ProviderResult {
  attempt: DnsAttempt;
  records: string[];
  authenticated: boolean;
}

function malformed(provider: string): ProviderResult {
  return {
    attempt: { provider, outcome: "malformed" },
    records: [],
    authenticated: false,
  };
}

function normalizeTxtData(raw: string): string {
  const s = raw.trim();
  const chunks = s.match(/"(?:\\.|[^"\\])*"/g);
  if (chunks && chunks.length > 0) {
    return chunks
      .map((chunk) => chunk.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\"))
      .join("");
  }
  return s;
}

/** Case-insensitive DNS name compare; trailing dots ignored. */
function dnsNamesEqual(a: string, b: string): boolean {
  const norm = (s: string) => s.replace(/\.+$/u, "").toLowerCase();
  return norm(a) === norm(b);
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

function isDohResponse(value: unknown): value is DohResponse {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.Status !== "number" || !Number.isInteger(candidate.Status)) return false;
  if (candidate.AD !== undefined && typeof candidate.AD !== "boolean") return false;
  if (candidate.Answer === undefined) return true;
  if (!Array.isArray(candidate.Answer)) return false;
  return candidate.Answer.every((answer) => {
    if (typeof answer !== "object" || answer === null) return false;
    const row = answer as Record<string, unknown>;
    if (typeof row.type !== "number" || typeof row.data !== "string") return false;
    if (row.name !== undefined && typeof row.name !== "string") return false;
    return true;
  });
}

/**
 * For Status===0 TXT answers: drop nothing silently when a wrong owner name
 * appears (malformed). Answers without `name` stay allowed for fixture compat.
 */
function bindTxtAnswers(
  answers: DohAnswer[],
  queriedName: string,
): { ok: true; records: string[] } | { ok: false } {
  const txt = answers.filter((answer) => answer.type === TXT_TYPE);

  let sawWrongName = false;
  const accepted: DohAnswer[] = [];

  for (const answer of txt) {
    if (answer.name === undefined) {
      accepted.push(answer);
      continue;
    }
    if (dnsNamesEqual(answer.name, queriedName)) {
      accepted.push(answer);
    } else {
      sawWrongName = true;
    }
  }

  // Any wrong-name TXT is unusable; wrong-name-only sets are malformed.
  // (Matching + wrong-name in the same response is also rejected.)
  if (sawWrongName) {
    return { ok: false };
  }

  return {
    ok: true,
    records: accepted.map((answer) => normalizeTxtData(answer.data)).sort(),
  };
}

async function queryProvider(
  provider: string,
  name: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<ProviderResult> {
  const url = `${provider}?name=${encodeURIComponent(name)}&type=TXT&do=1`;
  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: { accept: "application/dns-json" },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "error",
    });
  } catch (error) {
    return {
      attempt: { provider, outcome: isTimeout(error) ? "timeout" : "network_error" },
      records: [],
      authenticated: false,
    };
  }

  if (!response.ok) {
    return {
      attempt: { provider, outcome: "http_error", status: response.status },
      records: [],
      authenticated: false,
    };
  }

  const reader = response.body?.getReader();
  if (!reader) {
    return malformed(provider);
  }

  const chunks: Uint8Array[] = [];
  let bodyBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bodyBytes += value.byteLength;
      if (bodyBytes > MAX_DOH_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        return malformed(provider);
      }
      chunks.push(value);
    }
  } catch {
    await reader.cancel().catch(() => undefined);
    return malformed(provider);
  }

  const bytes = new Uint8Array(bodyBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let body: string;
  try {
    body = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return malformed(provider);
  }

  let json: unknown;
  try {
    json = JSON.parse(body) as unknown;
  } catch {
    return malformed(provider);
  }

  if (!isDohResponse(json)) {
    return malformed(provider);
  }

  const answers = json.Answer ?? [];
  if (answers.length > MAX_DOH_ANSWER_COUNT) {
    return malformed(provider);
  }
  if (answers.some((answer) => answer.data.length > MAX_DOH_DATA_CHARS)) {
    return malformed(provider);
  }

  const status = json.Status;
  if (status === 2) {
    return { attempt: { provider, outcome: "servfail", status }, records: [], authenticated: false };
  }
  if (status === 5) {
    return { attempt: { provider, outcome: "refused", status }, records: [], authenticated: false };
  }
  if (status === 3) {
    return {
      attempt: { provider, outcome: "nxdomain", status },
      records: [],
      authenticated: json.AD === true,
    };
  }
  if (status !== 0) {
    return { attempt: { provider, outcome: "dns_error", status }, records: [], authenticated: false };
  }

  const bound = bindTxtAnswers(answers, name);
  if (!bound.ok) {
    return malformed(provider);
  }

  return {
    attempt: { provider, outcome: bound.records.length > 0 ? "answer" : "nodata", status },
    records: bound.records,
    authenticated: json.AD === true,
  };
}

/**
 * Resolve `_<prefix>.<domain>`. Authoritative answers (including NXDOMAIN and
 * NODATA) stop resolution. Provider-local, transient, and malformed responses
 * fall through to the next configured provider.
 */
export async function resolveTxt(
  prefix: string,
  domain: string,
  options: ResolveTxtOptions = {},
): Promise<TxtResult> {
  const name = `_${prefix}.${domain}`;
  const providers = options.providers ?? DOH_PROVIDERS;
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 5000;
  const attempts: DnsAttempt[] = [];

  for (const provider of providers) {
    const result = await queryProvider(provider, name, fetchImpl, timeoutMs);
    attempts.push(result.attempt);

    if (
      result.attempt.outcome === "answer" ||
      result.attempt.outcome === "nodata" ||
      result.attempt.outcome === "nxdomain"
    ) {
      return {
        outcome: result.attempt.outcome,
        records: result.records,
        authenticated: result.authenticated,
        status: result.attempt.status ?? -1,
        provider,
        attempts,
      };
    }
  }

  return {
    outcome: "provider_exhaustion",
    records: [],
    authenticated: false,
    status: -1,
    provider: null,
    attempts,
  };
}
