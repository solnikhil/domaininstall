# Milestone 4 — publisher recruitment kit

**Gate 1:** 20 qualified npm maintainers contacted; target **≥5 external mappings live**.

This is a quiet beta kit, not a launch campaign. Tone stays short, respectful, and honest. The security claim is always narrow (see [Ethics / privacy](#ethics--privacy) and `SECURITY.md`).

**Related**

| Document | Role |
| --- | --- |
| [PUBLISHER-GUIDE.md](./PUBLISHER-GUIDE.md) | How a publisher sets up a mapping (share this) |
| [CONTACT-TRACKER.md](./CONTACT-TRACKER.md) | Log of contacts and outcomes |
| [RUNBOOK.md](./RUNBOOK.md) | Two-week operational order |
| [ROADMAP.md](../../ROADMAP.md) §7 | Gates and decision rule |

GitHub path for links in outreach:

`https://github.com/solnikhil/domaininstall/blob/main/docs/m4/PUBLISHER-GUIDE.md`

---

## Qualified maintainer criteria

A prospect counts toward the “20 contacted” bar only if **all** of the following hold:

1. **They control a real domain**  
   - They own or administer a domain where they can create DNS records (registrar / DNS host they control).  
   - Free subdomains they do **not** control DNS for (e.g. `*.github.io` pages without custom-domain DNS they manage, `*.vercel.app`, random free DNS playgrounds) do **not** qualify unless they demonstrably control the zone for that name.

2. **They maintain a real npm package** — at least one of:
   - Package first published **≥6 months** ago, **or**
   - **≥1k weekly downloads** (npm package page or `npm view`), **or**
   - Clearly a **known OSS / product package** with real users outside the maintainer’s friends (org project, established CLI, library with issues/users in the wild).

3. **They can act**  
   - Contact path exists (public email, maintainer npm contact, GitHub maintainer, security@, or an active discussion channel they own).  
   - Prefer people who are still maintaining the package (recent publish or recent commits), not abandoned orphans.

Practical bar: if you would not trust that domain’s homepage as “this is the real project,” do not count them as qualified.

---

## Exclusion criteria

These do **not** count as **external** for gate 1 (or toward the ≥5 live mappings):

| Exclusion | Why |
| --- | --- |
| Friends-only / sock-puppet “external” mappings set up only to pad the count | Not product demand |
| Maintainer’s own `zuraai.xyz` → `zuraai` (or any other domain the project maintainer already uses as the reference mapping) | Control case only; already live |
| Throwaway packages (empty README, no users, published solely for the beta) | Not a real publisher |
| Domains without real DNS control (can’t add `_dnstall` TXT) | Can’t complete the product loop |
| Packages that exist only under the domaininstall maintainer’s npm account, spun up for the beta | Not external |
| Contacting the same person twice under two package names | One contact, not two |

Internal testing, family, and close collaborators can still try the tool — log them, mark them clearly, and **do not** count them toward external gate totals.

---

## Cold outreach email template

**Subject:** DNS TXT → official npm package (2-minute ask)

```text
Hi <Name>,

I’m Nikhil. I maintain domaininstall (npm: domaininstall) — a small CLI that
reads a DNS TXT record from a domain you control and installs the package that
record declares, after showing you exactly what it found.

It only checks continuity of that domain→package mapping. It does not prove the
package is safe.

If you control DNS for <domain> and maintain <package>, the ask is about two
minutes:

1. Add one TXT record (copy-paste in the guide).
2. Run `di verify <domain>`.
3. Optional: one line in your README if you find it useful.

Publisher guide:
https://github.com/solnikhil/domaininstall/blob/main/docs/m4/PUBLISHER-GUIDE.md

Totally fine to say no or ignore. Tool is 0.0.x; this is a quiet beta, not a
launch.

Thanks for reading,
Nikhil
```

---

## Follow-up template (one week later)

**Subject:** Re: DNS TXT → official npm package

```text
Hi <Name>,

Quick follow-up on domaininstall from last week — no pressure.

If you tried the TXT record and hit DNS friction, I’m happy to help debug
`di verify` output (still won’t edit your zone for you unless you ask).

Guide again:
https://github.com/solnikhil/domaininstall/blob/main/docs/m4/PUBLISHER-GUIDE.md

If it’s not a fit, no need to reply.

Nikhil
```

Send **at most one** follow-up. If no reply, mark Response as `N` after a reasonable window (e.g. two weeks from first contact) or leave `pending` until the beta ends — do not spam.

---

## DM / GitHub issue / discussion (short)

Use when email is unavailable. Keep it shorter; link the same guide.

```text
Hi — I built domaininstall (npm: domaininstall): domain DNS TXT → declared npm
package, with confirm before install. Narrow claim: verifies the mapping, not
package safety.

2-min ask if you control DNS for your project domain: one TXT + `di verify`.
Guide: https://github.com/solnikhil/domaininstall/blob/main/docs/m4/PUBLISHER-GUIDE.md

Quiet 0.0.x beta; fine to ignore. Happy to answer questions here.
```

For a **GitHub issue** on *their* repo: only if they welcome install-docs or tooling issues; prefer Discussions or email. Do not open noisy issues on high-traffic repos without checking contribution norms. Prefer a single polite comment if they already have an “install” or “security” thread that fits.

---

## What we promise beta participants

- **No spam** — one outreach + at most one follow-up; no marketing lists resold or reused.
- **No public naming without consent** — we do not list their domain, package, or quote them in README / social / launch posts unless they opt in.
- **Best-effort support** — single maintainer; reasonable DNS/`di verify` help during the beta window.
- **Honest product status** — tool is **0.0.x**; formats and UX may change; no SLA.
- **Narrow security claim** — never sold as “safe package” or “malware-free.”

---

## What we ask

| Ask | Required? | Notes |
| --- | --- | --- |
| Setup time log (minutes from starting DNS edit to successful `di verify`) | Strongly preferred for gate 2 | Free-text is fine |
| Whether they needed help (and from whom) | Strongly preferred | For “unassisted” scoring |
| Optional README / install-doc placement | Optional | Gate 3 |
| Optional usage feedback (what confused them, what they expected) | Optional | Helps gate 6 design later |
| Consent to be named publicly | Optional, default **no** | Separate from “mapping live” |

We do **not** ask for npm tokens, registrar passwords, or full zone exports.

---

## Ethics / privacy

- **No deceptive claims.** Do not say the tool “secures npm,” “prevents supply-chain attacks,” “replaces lockfiles / provenance,” or “proves package safety.”
- **Always state the narrow security claim** in outreach and answers:

  > It verifies continuity of a domain-to-package declaration. It does not prove that a package or package version is safe.

- Do not pressure maintainers with false urgency, fake scarcity, or implied affiliation with npm/GitHub/registrars.
- Do not scrape private emails from leaks; use published maintainer contact paths only.
- Do not invent downloads, stars, or “everyone is adopting this.”
- Log only what is needed for gate scoring; do not publish the tracker publicly with personal emails if that would surprise participants.

---

## Prospect sourcing ideas

Methods only — **do not** invent a list of real people. Build the contact list yourself and record it in [CONTACT-TRACKER.md](./CONTACT-TRACKER.md).

1. **npm trending / rising** — packages with real traction; check homepage for an official domain.
2. **Homepage field** — `npm view <pkg> homepage repository`; prefer packages whose homepage is a custom domain the org controls (not only a GitHub URL).
3. **Security-conscious tools** — CLIs and libs that already talk about supply chain, provenance, SBOM, or install hygiene (likely to understand a *narrow* mapping claim).
4. **CLI authors** — tools people install globally; domain-based install is easy to explain next to `npm i -g …`.
5. **Org-owned packages** — companies or foundations with stable domains and DNS teams (setup may be slower but more “real”).
6. **Your existing network, carefully** — only if they meet qualification bars; mark relationship in Notes so friend-bias is visible (still don’t count pure favor mappings as external if they fail exclusion rules).
7. **Conference / OSS community lists** — maintainers who already document custom domains for their projects.

For each prospect: confirm DNS control likelihood, package bar, and a single primary contact channel before counting them as a planned “contact.”

---

## Definition of “contacted” vs “responded” vs “mapping live”

| Term | Definition | Counts toward |
| --- | --- | --- |
| **Contacted** | A qualified maintainer received a **specific, intentional** outreach (email sent, DM delivered, or issue/discussion posted) with the ask and link to the publisher guide. Mass-blast to unrelated people does not count. Date logged in the tracker. | Gate 1 “20 contacted” |
| **Responded** | Any substantive reply: yes / no / questions / “I’ll try later.” Auto-replies and silent read receipts do **not** count as responded. | Tracker only (not a hard gate) |
| **Setup started** | They report starting DNS changes, or you see evidence they attempted a record (e.g. partial TXT, wrong name, asked for help mid-setup). | Gate 2 sample |
| **Setup completed unassisted** | Successful `di verify` (or equivalent live resolution of their mapping) **without** the domaininstall maintainer editing their DNS. Advice and guide answers are fine; logging into their registrar for them is assisted. | Gate 2 |
| **Mapping live** | Public DNS resolves `_dnstall.<their-domain>` to a valid `dnstall=pkg:npm/…` for a real package, verified with `di verify <domain>` (or live E2E-equivalent), and the domain is **external** per exclusion criteria. | Gate 1 “≥5 external mappings” |

**Contacted** does not require a reply.  
**Mapping live** does not require a README placement.  
**zuraai.xyz** remains the control mapping and is **never** counted as external.
