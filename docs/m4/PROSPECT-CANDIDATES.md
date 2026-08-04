# Gate 1 — prospect candidates (research seed)

**Status:** identified only — **not contacted**.  
**Date:** 2026-08-04  
**Purpose:** Give the quiet beta a starting shortlist so Day 0 is not blank.
Does **not** count toward gate 1 until a real outreach lands in
[CONTACT-TRACKER.md](./CONTACT-TRACKER.md).

Qualification rules: [OUTREACH.md](./OUTREACH.md). Prefer maintainers who own a
brand domain and publish a recognizable npm package.

## How to use

1. Pick a row; confirm they still maintain the package and control DNS.
2. Send a template from OUTREACH.md.
3. Copy into CONTACT-TRACKER with a real **Contacted date** and channel.
4. Never mark mapping live until `di verify <domain>` succeeds.

## Candidate shortlist (≥20)

| # | Package (likely) | Domain angle | Why candidate | Channel idea | Contacted? |
| --- | --- | --- | --- | --- | --- |
| 1 | `zod` | colinhacks / project domain | Huge brand, clear official package | GitHub / X | N |
| 2 | `hono` | hono.dev | Modern framework, owns domain | GitHub Discussions | N |
| 3 | `drizzle-orm` | orm.drizzle.team | Domain-branded product | GitHub / Discord | N |
| 4 | `trpc` | trpc.io | Strong domain ↔ package link | GitHub | N |
| 5 | `astro` | astro.build | Docs-heavy; placement likely | GitHub | N |
| 6 | `biome` | biomejs.dev | CLI tool (global install story) | GitHub | N |
| 7 | `vitest` | vitest.dev | Clear domain | GitHub | N |
| 8 | `playwright` | playwright.dev | Microsoft-backed; may be slow | GitHub issues / blog | N |
| 9 | `prisma` | prisma.io | Enterprise-aware | Partner / GitHub | N |
| 10 | `supabase-js` | supabase.com | Platform + JS client | Discord / GitHub | N |
| 11 | `clerk` | clerk.com | Auth brand domain | GitHub | N |
| 12 | `resend` | resend.com | Small/fast product team | GitHub / X | N |
| 13 | `inngest` | inngest.com | Devtools, cares about install DX | GitHub | N |
| 14 | `trigger.dev` | trigger.dev | Domain is the product name | GitHub | N |
| 15 | `cal.com` | cal.com | Open-source + domain brand | GitHub | N |
| 16 | `novu` | novu.co | Notification platform | GitHub | N |
| 17 | `medusa` | medusajs.com | Commerce OSS | GitHub | N |
| 18 | `payload` | payloadcms.com | CMS brand domain | GitHub | N |
| 19 | `effect` | effect.website | Strong typed community | Discord / GitHub | N |
| 20 | `bun` | bun.sh | High attention; may decline | GitHub | N |
| 21 | `pnpm` | pnpm.io | Package manager meta-interest | GitHub | N |
| 22 | `turbo` | turbo.build | Monorepo brand | GitHub | N |
| 23 | `sentry` | sentry.io | Security-aware buyers | Partner path | N |
| 24 | `posthog` | posthog.com | Product analytics OSS | GitHub | N |
| 25 | `tldraw` | tldraw.com | Small team, clear domain | GitHub | N |

**Notes for the maintainer**

- Swap any row that fails qualification (no DNS control, wrong package, inactive).
- Prefer **independent** maintainers over giant corps for the first five live mappings.
- Record declines in CONTACT-TRACKER notes; they still count as “contacted.”
- Do not cold-email personal addresses scraped from git history; use project channels.

## Outreach queue suggestion (first week)

1. resend, inngest, trigger.dev, tldraw, novu (likely faster replies)  
2. hono, vitest, biome, drizzle-orm, trpc  
3. Larger brands only after two live external mappings exist (social proof)
