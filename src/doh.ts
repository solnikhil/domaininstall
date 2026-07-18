/**
 * DNS-over-HTTPS TXT resolution.
 *
 * We resolve over DoH (rather than the system resolver) so a hostile local
 * network can't tamper with the lookup in transit. We query Cloudflare first,
 * then fall back to Google — both speak the same DoH JSON schema.
 *
 * DoH encrypts the query; it does NOT by itself prove authenticity. The `AD`
 * (Authenticated Data) flag tells us the upstream resolver DNSSEC-validated the
 * answer. We surface that as a trust badge, never as a hard gate (DNSSEC
 * deployment is still low).
 */

const DOH_PROVIDERS = [
  "https://cloudflare-dns.com/dns-query",
  "https://dns.google/resolve",
] as const;

const TXT_TYPE = 16; // DNS TXT record type

export interface TxtResult {
  /** Logical TXT record values (multi-string chunks already concatenated). */
  records: string[];
  /** True if the resolver reported the answer as DNSSEC-authenticated. */
  authenticated: boolean;
  /** DNS response status: 0 = NOERROR, 3 = NXDOMAIN. */
  status: number;
  /** Which provider answered. */
  provider: string | null;
}

interface DohAnswer {
  name: string;
  type: number;
  TTL?: number;
  data: string;
}

interface DohResponse {
  Status: number;
  AD?: boolean;
  Answer?: DohAnswer[];
}

/**
 * A DoH JSON `data` field wraps each 255-byte character-string in quotes and
 * escapes inner quotes. Strip the wrapping quotes and join multiple strings
 * into one logical value (per the TXT record spec).
 */
function normalizeTxtData(raw: string): string {
  let s = raw.trim();
  // Split into quoted chunks if present: "abc" "def" -> abcdef
  const chunks = s.match(/"(?:\\.|[^"\\])*"/g);
  if (chunks && chunks.length > 0) {
    return chunks
      .map((chunk) => chunk.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\"))
      .join("");
  }
  // No surrounding quotes — return as-is.
  return s;
}

async function queryProvider(provider: string, name: string): Promise<TxtResult | null> {
  const url = `${provider}?name=${encodeURIComponent(name)}&type=TXT&do=1`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { accept: "application/dns-json" },
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    return null; // network/timeout — let caller try the next provider
  }
  if (!res.ok) return null;

  let json: DohResponse;
  try {
    json = (await res.json()) as DohResponse;
  } catch {
    return null;
  }

  const answers = Array.isArray(json.Answer) ? json.Answer : [];
  const records = answers
    .filter((a) => a.type === TXT_TYPE)
    .map((a) => normalizeTxtData(a.data))
    .sort(); // lexicographic sort for deterministic results (DNSLink convention)

  return {
    records,
    authenticated: json.AD === true,
    status: typeof json.Status === "number" ? json.Status : -1,
    provider,
  };
}

/**
 * Resolve TXT records for `_<prefix>.<domain>` via DoH.
 * Returns the first successful provider response.
 */
export async function resolveTxt(prefix: string, domain: string): Promise<TxtResult> {
  const name = `_${prefix}.${domain}`;
  for (const provider of DOH_PROVIDERS) {
    const result = await queryProvider(provider, name);
    if (result) return result;
  }
  return { records: [], authenticated: false, status: -1, provider: null };
}
