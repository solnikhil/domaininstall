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

interface ProviderResult {
  attempt: DnsAttempt;
  records: string[];
  authenticated: boolean;
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

function isTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

function isDohResponse(value: unknown): value is {
  Status: number;
  AD?: boolean;
  Answer?: Array<{ type: number; data: string }>;
} {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.Status !== "number" || !Number.isInteger(candidate.Status)) return false;
  if (candidate.AD !== undefined && typeof candidate.AD !== "boolean") return false;
  if (candidate.Answer === undefined) return true;
  if (!Array.isArray(candidate.Answer)) return false;
  return candidate.Answer.every(
    (answer) =>
      typeof answer === "object" &&
      answer !== null &&
      typeof (answer as Record<string, unknown>).type === "number" &&
      typeof (answer as Record<string, unknown>).data === "string",
  );
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

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return {
      attempt: { provider, outcome: "malformed" },
      records: [],
      authenticated: false,
    };
  }

  if (!isDohResponse(json)) {
    return {
      attempt: { provider, outcome: "malformed" },
      records: [],
      authenticated: false,
    };
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

  const answers = json.Answer ?? [];
  const records = answers
    .filter((answer) => answer.type === TXT_TYPE)
    .map((answer) => normalizeTxtData(answer.data))
    .sort();
  return {
    attempt: { provider, outcome: records.length > 0 ? "answer" : "nodata", status },
    records,
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
