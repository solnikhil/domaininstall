/**
 * Claim-sensitive copy shown in the demo.
 *
 * Keep these strings centralized: the demo is a product surface, and wording
 * that implies a stronger package-origin or safety guarantee would exceed domaininstall's
 * declaration-continuity guarantee. `scripts/tests/claims.test.ts` snapshots
 * this object and audits both it and the consuming story files.
 */
export const DEMO_CLAIM_COPY = {
  hook: {
    headline: ["Which", "package", "does", "the", "domain", "declare?"],
    declaredBadge: "DECLARED BY DOMAIN",
    otherBadge: "NOT DECLARED",
    caption: "Similar names can still be different packages.",
  },
  verify: {
    dnssecFact: "DNSSEC: AD",
    lookupFact: "read-only lookup",
    verdict: "Declaration found.",
    boundary:
      "Checks the domain→package declaration—not package safety or publisher identity.",
  },
} as const;
