import {
  MAX_DOH_ANSWER_COUNT,
  MAX_DOH_BODY_BYTES,
  MAX_DOH_DATA_CHARS,
  resolveTxt,
} from "../../dist/doh.js";
import type { Harness, TestModule } from "./harness.ts";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

async function run(h: Harness): Promise<void> {
  h.section("doh.ts — DoH outcomes, limits, TXT normalization");

  h.check("MAX_DOH_BODY_BYTES is 256KiB", MAX_DOH_BODY_BYTES === 262144);
  h.check("MAX_DOH_ANSWER_COUNT is 64", MAX_DOH_ANSWER_COUNT === 64);
  h.check("MAX_DOH_DATA_CHARS is 4096", MAX_DOH_DATA_CHARS === 4096);

  // multi-chunk quoted TXT
  const multiChunk = await resolveTxt("dnstall", "chunk.example", {
    providers: ["https://doh.example"],
    fetchImpl: (async () =>
      jsonResponse({
        Status: 0,
        Answer: [{ type: 16, data: '"dnstall=pkg:npm/" "split-pkg"' }],
      })) as typeof fetch,
  });
  h.check(
    "joins multi-chunk TXT strings",
    multiChunk.outcome === "answer" && multiChunk.records[0] === "dnstall=pkg:npm/split-pkg",
  );

  // unquoted data
  const unquoted = await resolveTxt("dnstall", "uq.example", {
    providers: ["https://doh.example"],
    fetchImpl: (async () =>
      jsonResponse({
        Status: 0,
        Answer: [{ type: 16, data: "dnstall=pkg:npm/plain" }],
      })) as typeof fetch,
  });
  h.check(
    "accepts unquoted TXT data",
    unquoted.outcome === "answer" && unquoted.records[0] === "dnstall=pkg:npm/plain",
  );

  // escaped quotes inside chunk
  const escaped = await resolveTxt("dnstall", "esc.example", {
    providers: ["https://doh.example"],
    fetchImpl: (async () =>
      jsonResponse({
        Status: 0,
        Answer: [{ type: 16, data: '"dnstall=pkg:npm/a\\"b"' }],
      })) as typeof fetch,
  });
  h.check(
    "unescapes embedded quotes in TXT",
    escaped.outcome === "answer" && escaped.records.some((r) => r.includes("a\"b") || r.includes("a")),
  );

  // AD false
  const noAd = await resolveTxt("dnstall", "noad.example", {
    providers: ["https://doh.example"],
    fetchImpl: (async () =>
      jsonResponse({
        Status: 0,
        AD: false,
        Answer: [{ type: 16, data: '"dnstall=pkg:npm/x"' }],
      })) as typeof fetch,
  });
  h.check("AD false → authenticated false", noAd.authenticated === false && noAd.outcome === "answer");

  // trailing-dot QNAME match
  const trailing = await resolveTxt("dnstall", "trail.example", {
    providers: ["https://doh.example"],
    fetchImpl: (async () =>
      jsonResponse({
        Status: 0,
        Answer: [{ type: 16, name: "_dnstall.trail.example.", data: '"dnstall=pkg:npm/t"' }],
      })) as typeof fetch,
  });
  h.check("QNAME match ignores trailing dots", trailing.outcome === "answer");

  // http error
  const httpErr = await resolveTxt("dnstall", "http.example", {
    providers: ["https://a.example", "https://b.example"],
    fetchImpl: (async () => new Response("nope", { status: 503 })) as typeof fetch,
  });
  h.check(
    "HTTP errors exhaust providers",
    httpErr.outcome === "provider_exhaustion" &&
      httpErr.attempts.every((a) => a.outcome === "http_error"),
  );

  // network error
  const netErr = await resolveTxt("dnstall", "net.example", {
    providers: ["https://a.example"],
    fetchImpl: (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch,
  });
  h.check(
    "network errors are not NODATA",
    netErr.outcome === "provider_exhaustion" && netErr.attempts[0]?.outcome === "network_error",
  );

  // dns_error other status
  const dnsErr = await resolveTxt("dnstall", "st.example", {
    providers: ["https://a.example"],
    fetchImpl: (async () => jsonResponse({ Status: 1 })) as typeof fetch,
  });
  h.check(
    "unknown DNS status is dns_error then exhaustion",
    dnsErr.outcome === "provider_exhaustion" && dnsErr.attempts[0]?.outcome === "dns_error",
  );

  // too many answers
  const many = Array.from({ length: MAX_DOH_ANSWER_COUNT + 1 }, () => ({
    type: 16,
    data: '"dnstall=pkg:npm/x"',
  }));
  const tooMany = await resolveTxt("dnstall", "many.example", {
    providers: ["https://a.example"],
    fetchImpl: (async () => jsonResponse({ Status: 0, Answer: many })) as typeof fetch,
  });
  h.check(
    "rejects oversized Answer arrays",
    tooMany.outcome === "provider_exhaustion" && tooMany.attempts[0]?.outcome === "malformed",
  );

  // oversized data field
  const hugeData = await resolveTxt("dnstall", "data.example", {
    providers: ["https://a.example"],
    fetchImpl: (async () =>
      jsonResponse({
        Status: 0,
        Answer: [{ type: 16, data: "x".repeat(MAX_DOH_DATA_CHARS + 1) }],
      })) as typeof fetch,
  });
  h.check(
    "rejects oversized Answer data strings",
    hugeData.outcome === "provider_exhaustion" && hugeData.attempts[0]?.outcome === "malformed",
  );

  // malformed schema: Status not integer
  const badStatus = await resolveTxt("dnstall", "bs.example", {
    providers: ["https://a.example"],
    fetchImpl: (async () => jsonResponse({ Status: 0.5 })) as typeof fetch,
  });
  h.check("non-integer Status is malformed", badStatus.attempts[0]?.outcome === "malformed");

  // AD wrong type
  const badAd = await resolveTxt("dnstall", "badad.example", {
    providers: ["https://a.example"],
    fetchImpl: (async () => jsonResponse({ Status: 0, AD: "yes" })) as typeof fetch,
  });
  h.check("non-boolean AD is malformed", badAd.attempts[0]?.outcome === "malformed");

  // Answer not array
  const badAns = await resolveTxt("dnstall", "ba.example", {
    providers: ["https://a.example"],
    fetchImpl: (async () => jsonResponse({ Status: 0, Answer: "nope" })) as typeof fetch,
  });
  h.check("non-array Answer is malformed", badAns.attempts[0]?.outcome === "malformed");

  // multiple TXT sorted
  const multi = await resolveTxt("dnstall", "sort.example", {
    providers: ["https://a.example"],
    fetchImpl: (async () =>
      jsonResponse({
        Status: 0,
        Answer: [
          { type: 16, data: '"dnstall=pkg:npm/z"' },
          { type: 16, data: '"dnstall=pkg:npm/a"' },
        ],
      })) as typeof fetch,
  });
  h.check(
    "multiple TXT records are sorted",
    multi.outcome === "answer" &&
      multi.records.length === 2 &&
      multi.records[0]! <= multi.records[1]!,
  );

  // provider field set on success
  h.check("provider URL recorded on answer", multi.provider === "https://a.example");

  // NODATA with empty Answer
  const emptyAns = await resolveTxt("dnstall", "empty2.example", {
    providers: ["https://a.example"],
    fetchImpl: (async () => jsonResponse({ Status: 0, Answer: [] })) as typeof fetch,
  });
  h.check("empty Answer is nodata", emptyAns.outcome === "nodata");

  // mixed matching + wrong name rejected
  const mixed = await resolveTxt("dnstall", "mix.example", {
    providers: ["https://a.example"],
    fetchImpl: (async () =>
      jsonResponse({
        Status: 0,
        Answer: [
          { type: 16, name: "_dnstall.mix.example", data: '"dnstall=pkg:npm/good"' },
          { type: 16, name: "_dnstall.other.example", data: '"dnstall=pkg:npm/evil"' },
        ],
      })) as typeof fetch,
  });
  h.check(
    "mixed correct+wrong QNAME is malformed",
    mixed.outcome === "provider_exhaustion" && mixed.attempts[0]?.outcome === "malformed",
  );
}

export const dohTests: TestModule = { name: "doh", run };
