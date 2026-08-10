let meta = #{
    name: "feature-research",
    description: "Web-informed multi-agent scoring of domaininstall feature candidates with measurement plans",
    phases: [
        #{ title: "Research", detail: "market and prior-art angles" },
        #{ title: "Score", detail: "one scorer per feature candidate" },
        #{ title: "Skeptic", detail: "adversarial kill-criteria per feature" },
        #{ title: "Measure", detail: "success metrics and experiments per feature" },
        #{ title: "Synthesize", detail: "ranked backlog and decision memo" },
    ],
    when_to_use: "Prioritize possible new features for domaininstall with large multi-agent measurement",
};

// --- schemas ---
let research_schema = #{
    "type": "object",
    "required": ["angle", "insights", "feature_implications", "confidence"],
    "properties": #{
        "angle": #{ "type": "string" },
        "insights": #{ "type": "array", "maxItems": 8, "items": #{ "type": "string" } },
        "feature_implications": #{ "type": "array", "maxItems": 6, "items": #{ "type": "string" } },
        "confidence": #{ "type": "number" },
    },
};

let score_schema = #{
    "type": "object",
    "required": ["feature_id", "title", "strategic_fit", "user_value", "security_value", "effort", "adoption_leverage", "non_goal_risk", "priority_score", "rationale", "depends_on_validation"],
    "properties": #{
        "feature_id": #{ "type": "string" },
        "title": #{ "type": "string" },
        "strategic_fit": #{ "type": "integer", "minimum": 1, "maximum": 10 },
        "user_value": #{ "type": "integer", "minimum": 1, "maximum": 10 },
        "security_value": #{ "type": "integer", "minimum": 1, "maximum": 10 },
        "effort": #{ "type": "integer", "minimum": 1, "maximum": 10 },
        "adoption_leverage": #{ "type": "integer", "minimum": 1, "maximum": 10 },
        "non_goal_risk": #{ "type": "integer", "minimum": 1, "maximum": 10 },
        "priority_score": #{ "type": "number" },
        "rationale": #{ "type": "string" },
        "depends_on_validation": #{ "type": "boolean" },
        "kill_if": #{ "type": "string" },
    },
};

let skeptic_schema = #{
    "type": "object",
    "required": ["feature_id", "should_build", "strongest_objection", "hidden_cost", "revised_priority", "evidence"],
    "properties": #{
        "feature_id": #{ "type": "string" },
        "should_build": #{ "type": "boolean" },
        "strongest_objection": #{ "type": "string" },
        "hidden_cost": #{ "type": "string" },
        "revised_priority": #{ "type": "number" },
        "evidence": #{ "type": "string" },
        "conditions_to_reopen": #{ "type": "string" },
    },
};

let measure_schema = #{
    "type": "object",
    "required": ["feature_id", "north_star", "leading_metrics", "experiment", "success_threshold", "timebox_days"],
    "properties": #{
        "feature_id": #{ "type": "string" },
        "north_star": #{ "type": "string" },
        "leading_metrics": #{ "type": "array", "maxItems": 5, "items": #{ "type": "string" } },
        "experiment": #{ "type": "string" },
        "success_threshold": #{ "type": "string" },
        "timebox_days": #{ "type": "integer" },
        "instrumentation": #{ "type": "string" },
    },
};

let synth_schema = #{
    "type": "object",
    "required": ["summary", "now", "next", "later", "never_or_pivot", "measurement_plan", "agent_count_note"],
    "properties": #{
        "summary": #{ "type": "string" },
        "now": #{ "type": "array", "maxItems": 8, "items": #{ "type": "string" } },
        "next": #{ "type": "array", "maxItems": 8, "items": #{ "type": "string" } },
        "later": #{ "type": "array", "maxItems": 8, "items": #{ "type": "string" } },
        "never_or_pivot": #{ "type": "array", "maxItems": 8, "items": #{ "type": "string" } },
        "measurement_plan": #{ "type": "string" },
        "agent_count_note": #{ "type": "string" },
        "top_risks": #{ "type": "array", "maxItems": 6, "items": #{ "type": "string" } },
    },
};

// --- product context shared into prompts ---
fn product_brief() {
    let s = "PRODUCT: domaininstall (CLI di). Installs npm packages via DNS TXT ";
    s += "record at _dnstall.<domain> mapping domain -> purl (pkg:npm/name). ";
    s += "Promise: verifies CONTINUITY of domain-to-package declaration (TOFU pins), ";
    s += "shows exact resolve+npm command, installs with --ignore-scripts. ";
    s += "Does NOT prove package safety, malware-free, or publisher account control. ";
    s += "Status 2026-08: npm 0.0.3, zero external publisher adoption, Milestone 4 ";
    s += "(product validation) NOT started. Binding constraint is publisher supply. ";
    s += "Non-goals: malware scanner, attestations system, registry/proxy, replace npm ";
    s += "provenance/lockfiles. Growth bets ranked: (1) publisher onboarding di setup, ";
    s += "(2) resolve --json + verification API, (3) agent/CI allowlist policy, ";
    s += "(4) _dnstall spec as artifact, (5) more ecosystems only after npm demand. ";
    s += "Decision rule: if publisher/correctness/comprehension gates fail, do NOT expand ";
    s += "CLI — pivot to agent/CI policy tool. Known gaps G1-G11 in ROADMAP. ";
    s += "Market context 2026: pnpm/yarn/bun/npm ship min-release-age cool-downs; ";
    s += "pnpm trustPolicy no-downgrade; npm provenance/Sigstore; slopsquatting is hot; ";
    s += "Go DNS vanity proposal rejected; Deno walked back URL imports toward JSR. ";
    s
}

// Feature catalog: id|title|category|source|one_line
// 36 candidates × (score + skeptic + measure) + 15 research + 2 synth = 125 agents
fn feature_catalog() {
    [
        "F01|di setup publisher onboarding|growth|roadmap-bet1|Generate exact TXT + registrar copy-paste so publishers map without reading the repo",
        "F02|README verify badge|growth|roadmap-bet1|Badge/snippet publishers put in README to prove di verify works",
        "F03|di resolve --json|platform|roadmap-bet2-G4|Stable machine-readable resolve schema and exit codes for CI/agents",
        "F04|Hosted verification API|platform|roadmap-bet2|HTTP lookup endpoint so bots check declarations without installing the CLI",
        "F05|Agent/CI allowlist policy mode|platform|roadmap-bet3|Non-interactive: only install packages declared by allowlisted domains",
        "F06|_dnstall record specification|platform|roadmap-bet4|Versioned independent spec so other tools implement the convention",
        "F07|Scope-specific registry support|gap|G1|Resolve and pin @scope:registry honestly instead of refusing",
        "F08|di trust list and forget|gap|G2|List pins and forget one domain without wiping the whole store",
        "F09|System-resolver fallback|gap|G3|Opt-in unauthenticated system DNS when DoH providers fail, labeled in preview",
        "F10|Configurable DoH providers|gap|G3-G6|User-configured DoH endpoints instead of two hard-coded providers",
        "F11|pnpm project support|ecosystem|G5|Scripts-disabled install path for pnpm with adversarial tests",
        "F12|Yarn project support|ecosystem|G5|Scripts-disabled install path for Yarn Berry with adversarial tests",
        "F13|Bun project support|ecosystem|G5|Scripts-disabled install path for Bun with adversarial tests",
        "F14|Pin publisher identity|security|G7-layer1|Pin npm publisher/account identity and block silent publisher change",
        "F15|Pin tarball integrity|security|G7|Pin resolved tarball hash and diff on later installs",
        "F16|Pin provenance state|security|G7-layer6|Pin whether version had provenance and warn on provenance drop",
        "F17|Pin maxAge re-verification|security|G8-layer4|Pins expire and force full re-verification after maxAge",
        "F18|RDAP registration liveness|security|G9-layer3|Block when domain registration/creation date changes (re-reg/transfer)",
        "F19|Transparency log first-use|security|G10-layer5|Public append-only log of domain->package mappings for first-time users",
        "F20|Show resolver used in CLI|privacy|G6|Surface which DoH/resolver answered so domain disclosure is visible",
        "F21|Windows trust-store hardening|platform|G11|Stronger Windows pin-store guarantees closer to POSIX",
        "F22|min-release-age cool-down gate|security|market-2026|Refuse versions younger than N days (align with pnpm/yarn/bun/npm cool-down trend)",
        "F23|Provenance badge in preview|security|market-2026|Surface npm provenance/attestations as signal without claiming safety proof",
        "F24|trustPolicy-style no-downgrade|security|pnpm-parity|Fail when trust signals (DNSSEC/provenance/publisher) weaken vs pin",
        "F25|PyPI ecosystem mapping|ecosystem|roadmap-bet5|Same purl DNS record installing via pip/uv after npm demand proven",
        "F26|crates.io ecosystem mapping|ecosystem|roadmap-bet5|Same purl DNS record for Rust crates after npm demand proven",
        "F27|URI or SRV record support|protocol|deferred|Alternative record types per Go #26160 discussion (higher registrar friction)",
        "F28|DNS resolution cache|perf|deferred|Cache DoH answers with TTL awareness for repeated verifies",
        "F29|Domain expiry warning|security|deferred|Warn when domain is near expiry or pending delete",
        "F30|Rich record metadata|protocol|deferred|Optional homepage/source/maintainer fields in TXT payload",
        "F31|Public package directory|growth|deferred|Website listing domains that publish _dnstall mappings",
        "F32|Pre-install health signals|security|npq-adjacent|Optional README/license/repo age signals before confirm (not a scanner product)",
        "F33|MCP or agent tool for resolve|platform|agent-market|Expose di resolve as MCP tool/skill for coding agents to avoid slopsquatting",
        "F34|GitHub Action verify|platform|ci-market|Official Action: fail CI if domain mapping drifts or fails policy",
        "F35|di doctor diagnostics|ux|ops|One command to diagnose DNS, DoH, pins, npm, platform issues",
        "F36|DNSSEC end-to-end validation|security|research|Client-side chain validation badge beyond resolver AD bit",
        "F37|Pin store export/import|ops|team|Share or migrate TOFU pins across machines for teams",
        "F38|Shell completions|ux|polish|bash/zsh/fish/pwsh completions for di commands",
        "F39|Offline airgap mode|ops|enterprise|Resolve from exported pins only without live DNS",
        "F40|Subpackage UX polish|ux|product|Clearer multi-package domain paths and list-declared-subpackages",
    ]
}

fn split_pipe(row, idx) {
    // manual split on | — returns field at 0-based index
    let parts = [];
    let cur = "";
    let i = 0;
    let n = row.len();
    while i < n {
        let ch = row.sub_string(i, 1);
        if ch == "|" {
            parts.push(cur);
            cur = "";
        } else {
            cur += ch;
        }
        i += 1;
    }
    parts.push(cur);
    if idx < parts.len() {
        parts[idx]
    } else {
        ""
    }
}

// ========== PHASE 1: RESEARCH (15 agents) ==========
phase("Research");
log("Phase Research: 15 parallel market/prior-art agents");

let research_angles = [
    "Publisher onboarding friction for DNS TXT records and registrar UX (Cloudflare, Route53, Namecheap, GoDaddy)",
    "Slopsquatting and AI-agent package hallucination mitigations developers actually adopt in 2025-2026",
    "npm provenance, trusted publishers, and Sigstore: how they compete with domain-to-package continuity tools",
    "pnpm/yarn/bun/npm min-release-age cool-down and trustPolicy features: implications for domaininstall",
    "Go vanity imports success vs rejected Go proposal 26160 DNS TXT: lessons for domaininstall",
    "Deno HTTP imports retreat toward JSR: what it means for domain-as-package-identity",
    "CI/agent policy and allowlist tools for dependency installs (Socket, npq, organization allowlists)",
    "MCP and coding-agent package install workflows: demand for resolve-by-domain tools",
    "DNSLink and domain-linked resource patterns: adoption lessons and pitfalls",
    "Multi-package-manager support complexity (pnpm Yarn Bun) for a security-sensitive installer",
    "RDAP domain registration monitoring and domain hijack defenses used by security tools",
    "Transparency logs and first-use TOFU limitations in package ecosystems",
    "Two-sided marketplace adoption for developer tools: publisher supply before consumer demand",
    "Enterprise and offline/airgap constraints for DNS-based package resolution",
    "What would make maintainers put install-by-domain in a README vs sticking with npm i pkg",
];

let brief = product_brief();
let rjobs = [];
let ri = 0;
for angle in research_angles {
    let p = "You are a skeptical product researcher for domaininstall. ";
    p += brief;
    p += " RESEARCH ANGLE: ";
    p += angle;
    p += " Use web_search and open_page/web_fetch where useful. Do not invent citations. ";
    p += " Return JSON: angle (short name), insights (3-8 concrete findings), ";
    p += "feature_implications (specific domaininstall feature ideas or anti-features), ";
    p += "confidence 0-1. Prefer disconfirming evidence. Empty insights only if tools truly fail.";
    rjobs.push(#{
        prompt: p,
        label: "research-" + ri.to_string(),
        capability_mode: "read-only",
        output_schema: research_schema,
    });
    ri += 1;
}
let research_results = parallel(rjobs);

let research_blob = "";
let r_ok = 0;
for r in research_results {
    if r != () && r.success && r.output != () {
        r_ok += 1;
        if r.output.angle != () {
            research_blob += "ANGLE: ";
            research_blob += r.output.angle;
            research_blob += " | ";
        }
        if r.output.insights != () {
            for ins in r.output.insights {
                research_blob += ins;
                research_blob += "; ";
            }
        }
        research_blob += "\n";
    }
}
log("Research agents succeeded: " + r_ok.to_string() + "/15");
// cap blob size for later prompts
if research_blob.len() > 6000 {
    research_blob = research_blob.sub_string(0, 6000);
}

// ========== PHASE 2: SCORE (40 agents) ==========
phase("Score");
log("Phase Score: 40 feature scorers");

let features = feature_catalog();
let sjobs = [];
let fi = 0;
for row in features {
    let fid = split_pipe(row, 0);
    let title = split_pipe(row, 1);
    let cat = split_pipe(row, 2);
    let src = split_pipe(row, 3);
    let oneline = split_pipe(row, 4);

    let p = "You score ONE feature candidate for domaininstall. ";
    p += brief;
    p += " RESEARCH SNAPSHOT (may be truncated): ";
    p += research_blob;
    p += " FEATURE: id=";
    p += fid;
    p += " title=";
    p += title;
    p += " category=";
    p += cat;
    p += " source=";
    p += src;
    p += " description=";
    p += oneline;
    p += " SCORING RULES (integers 1-10): strategic_fit (matches promise/bets, not non-goals), ";
    p += "user_value (publisher or installer pain), security_value (within narrow claim), ";
    p += "effort (10=hardest), adoption_leverage (helps two-sided network), ";
    p += "non_goal_risk (10=pulls into scanner/registry/infra bloat). ";
    p += "priority_score = (strategic_fit*2 + user_value*2 + security_value + adoption_leverage*2 ";
    p += "- effort - non_goal_risk*1.5). depends_on_validation=true if should wait for Milestone 4. ";
    p += "Read ROADMAP.md and README.md with read_file if available for grounding. ";
    p += "Be harsh on features that expand scope before publishers exist. ";
    p += "Return schema fields only; rationale under 400 chars; kill_if one sentence.";

    sjobs.push(#{
        prompt: p,
        label: "score-" + fid,
        capability_mode: "read-only",
        output_schema: score_schema,
    });
    fi += 1;
}
let score_results = parallel(sjobs);

let scores = [];
let s_ok = 0;
for r in score_results {
    if r != () && r.success && r.output != () && r.output.feature_id != () {
        s_ok += 1;
        scores.push(r.output);
    }
}
log("Score agents succeeded: " + s_ok.to_string() + "/40");

// ========== PHASE 3: SKEPTIC (40 agents) ==========
phase("Skeptic");
log("Phase Skeptic: 40 adversarial reviewers");

let kjobs = [];
// Map scores by building parallel prompts aligned with feature catalog order
let si = 0;
for row in features {
    let fid = split_pipe(row, 0);
    let title = split_pipe(row, 1);
    let oneline = split_pipe(row, 4);

    // find matching score if any
    let score_summary = "no primary score";
    for sc in scores {
        if sc.feature_id == fid {
            score_summary = "priority=";
            if sc.priority_score != () {
                score_summary += sc.priority_score.to_string();
            }
            score_summary += " rationale=";
            if sc.rationale != () {
                score_summary += sc.rationale;
            }
            break;
        }
    }

    let p = "You are an adversarial product skeptic for domaininstall. Your job is to KILL weak features. ";
    p += brief;
    p += " FEATURE ";
    p += fid;
    p += " ";
    p += title;
    p += ": ";
    p += oneline;
    p += " PRIMARY SCORE: ";
    p += score_summary;
    p += " Argue the strongest case against building this now. ";
    p += "should_build=true only if you cannot refute strategic necessity given zero external publishers. ";
    p += "Default should_build=false unless evidence is strong. ";
    p += "revised_priority is your own 0-100 score. evidence must cite product constraints or research, not vibes. ";
    p += "Read ROADMAP.md non-goals if needed.";

    kjobs.push(#{
        prompt: p,
        label: "skeptic-" + fid,
        capability_mode: "read-only",
        output_schema: skeptic_schema,
    });
    si += 1;
}
let skeptic_results = parallel(kjobs);

let skeptics = [];
let k_ok = 0;
for r in skeptic_results {
    if r != () && r.success && r.output != () && r.output.feature_id != () {
        k_ok += 1;
        skeptics.push(r.output);
    }
}
log("Skeptic agents succeeded: " + k_ok.to_string() + "/40");

// ========== PHASE 4: MEASURE (40 agents) ==========
phase("Measure");
log("Phase Measure: 40 measurement-design agents");

let mjobs = [];
for row in features {
    let fid = split_pipe(row, 0);
    let title = split_pipe(row, 1);
    let oneline = split_pipe(row, 4);

    let score_summary = "n/a";
    for sc in scores {
        if sc.feature_id == fid {
            score_summary = "priority=";
            if sc.priority_score != () {
                score_summary += sc.priority_score.to_string();
            }
            break;
        }
    }
    let sk_summary = "n/a";
    for sk in skeptics {
        if sk.feature_id == fid {
            sk_summary = "should_build=";
            if sk.should_build != () {
                sk_summary += sk.should_build.to_string();
            }
            sk_summary += " objection=";
            if sk.strongest_objection != () {
                sk_summary += sk.strongest_objection;
            }
            break;
        }
    }

    let p = "Design how to MEASURE success for this domaininstall feature before/while building. ";
    p += brief;
    p += " FEATURE ";
    p += fid;
    p += " ";
    p += title;
    p += ": ";
    p += oneline;
    p += " SCORE: ";
    p += score_summary;
    p += " SKEPTIC: ";
    p += sk_summary;
    p += " Define north_star metric, 2-5 leading_metrics, a concrete experiment, ";
    p += "success_threshold, timebox_days (7-90), instrumentation (what to log, no PII). ";
    p += "If feature should not ship yet, design a measurement that proves demand FIRST. ";
    p += "Align with Milestone 4 gates where relevant (publishers, setup time, comprehension).";

    mjobs.push(#{
        prompt: p,
        label: "measure-" + fid,
        capability_mode: "read-only",
        output_schema: measure_schema,
    });
}
let measure_results = parallel(mjobs);

let measures = [];
let m_ok = 0;
for r in measure_results {
    if r != () && r.success && r.output != () && r.output.feature_id != () {
        m_ok += 1;
        measures.push(r.output);
    }
}
log("Measure agents succeeded: " + m_ok.to_string() + "/40");

// ========== PHASE 5: SYNTHESIZE (2 agents) ==========
phase("Synthesize");
log("Phase Synthesize: ranking + decision memo");

// Build compact payload for synthesizers
let payload = "SCORES:\n";
for sc in scores {
    payload += sc.feature_id;
    payload += " prio=";
    if sc.priority_score != () { payload += sc.priority_score.to_string(); }
    payload += " fit=";
    if sc.strategic_fit != () { payload += sc.strategic_fit.to_string(); }
    payload += " val=";
    if sc.user_value != () { payload += sc.user_value.to_string(); }
    payload += " sec=";
    if sc.security_value != () { payload += sc.security_value.to_string(); }
    payload += " eff=";
    if sc.effort != () { payload += sc.effort.to_string(); }
    payload += " adopt=";
    if sc.adoption_leverage != () { payload += sc.adoption_leverage.to_string(); }
    payload += " ng=";
    if sc.non_goal_risk != () { payload += sc.non_goal_risk.to_string(); }
    payload += " wait_m4=";
    if sc.depends_on_validation != () { payload += sc.depends_on_validation.to_string(); }
    payload += " | ";
    if sc.rationale != () { payload += sc.rationale; }
    payload += "\n";
}
payload += "SKEPTICS:\n";
for sk in skeptics {
    payload += sk.feature_id;
    payload += " build=";
    if sk.should_build != () { payload += sk.should_build.to_string(); }
    payload += " rev=";
    if sk.revised_priority != () { payload += sk.revised_priority.to_string(); }
    payload += " | ";
    if sk.strongest_objection != () { payload += sk.strongest_objection; }
    payload += "\n";
}
payload += "MEASURES:\n";
for mv in measures {
    payload += mv.feature_id;
    payload += " star=";
    if mv.north_star != () { payload += mv.north_star; }
    payload += " thr=";
    if mv.success_threshold != () { payload += mv.success_threshold; }
    payload += " days=";
    if mv.timebox_days != () { payload += mv.timebox_days.to_string(); }
    payload += "\n";
}
if payload.len() > 14000 {
    payload = payload.sub_string(0, 14000);
}

let total_agents = 15 + 40 + 40 + 40 + 2;

let p1 = "Synthesize a ranked domaininstall feature backlog from multi-agent scores. ";
p1 += brief;
p1 += " AGENT COUNTS: research=15 score=40 skeptic=40 measure=40 synth=2 total=";
p1 += total_agents.to_string();
p1 += " DATA:\n";
p1 += payload;
p1 += "\nProduce now/next/later/never_or_pivot arrays of feature ids with short why. ";
p1 += "Respect: zero external publishers; Milestone 4 first; non-goals; bets order. ";
p1 += "measurement_plan: how maintainer should track progress weekly. ";
p1 += "agent_count_note: confirm panel sizes. top_risks: up to 6. summary: 3-5 sentences.";

let p2 = "Second independent synthesizer. Same rules. Prefer fewer NOW items. ";
p2 += "If scores disagree with roadmap bet order, explain. ";
p2 += brief;
p2 += " DATA:\n";
p2 += payload;
p2 += "\nReturn same schema. Be more conservative than the average score.";

let synth_jobs = [
    #{
        prompt: p1,
        label: "synth-primary",
        capability_mode: "read-only",
        output_schema: synth_schema,
    },
    #{
        prompt: p2,
        label: "synth-conservative",
        capability_mode: "read-only",
        output_schema: synth_schema,
    },
];
let synth_results = parallel(synth_jobs);

// Build markdown report
let report = "# domaininstall feature research — multi-agent evaluation\n\n";
report += "Generated by workflow `feature-research`.\n\n";
report += "## Method\n\n";
report += "- Research agents: 15 (market, prior art, security trends)\n";
report += "- Score agents: 40 (one per feature candidate)\n";
report += "- Skeptic agents: 40 (adversarial kill-criteria)\n";
report += "- Measure agents: 40 (north-star + experiment design)\n";
report += "- Synthesize agents: 2 (primary + conservative)\n";
report += "- **Total logical agents: ";
report += total_agents.to_string();
report += "**\n\n";
report += "## Product constraints (fixed)\n\n";
report += "- Zero external publisher adoption; Milestone 4 not started\n";
report += "- Non-goals: malware scanner, attestation system, registry, replace provenance\n";
report += "- Bets: setup → resolve/API → CI policy → spec → other ecosystems\n\n";

report += "## Research highlights\n\n";
let rcount = 0;
for r in research_results {
    if r != () && r.success && r.output != () {
        rcount += 1;
        report += "### ";
        if r.output.angle != () { report += r.output.angle; } else { report += "angle"; }
        report += "\n\n";
        if r.output.insights != () {
            for ins in r.output.insights {
                report += "- ";
                report += ins;
                report += "\n";
            }
        }
        report += "\n";
    }
}
if rcount == 0 {
    report += "_No research outputs captured._\n\n";
}

report += "## Feature scoreboard\n\n";
report += "| ID | Title | Prio | Fit | Value | Sec | Effort | Adopt | NG-risk | Wait M4 | Skeptic |\n";
report += "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n";

for row in features {
    let fid = split_pipe(row, 0);
    let title = split_pipe(row, 1);
    let prio = "—";
    let fit = "—";
    let val = "—";
    let sec = "—";
    let eff = "—";
    let ad = "—";
    let ng = "—";
    let wait = "—";
    let skb = "—";

    for sc in scores {
        if sc.feature_id == fid {
            if sc.priority_score != () { prio = sc.priority_score.to_string(); }
            if sc.strategic_fit != () { fit = sc.strategic_fit.to_string(); }
            if sc.user_value != () { val = sc.user_value.to_string(); }
            if sc.security_value != () { sec = sc.security_value.to_string(); }
            if sc.effort != () { eff = sc.effort.to_string(); }
            if sc.adoption_leverage != () { ad = sc.adoption_leverage.to_string(); }
            if sc.non_goal_risk != () { ng = sc.non_goal_risk.to_string(); }
            if sc.depends_on_validation != () { wait = sc.depends_on_validation.to_string(); }
            break;
        }
    }
    for sk in skeptics {
        if sk.feature_id == fid {
            if sk.should_build != () { skb = sk.should_build.to_string(); }
            break;
        }
    }

    report += "| ";
    report += fid;
    report += " | ";
    report += title;
    report += " | ";
    report += prio;
    report += " | ";
    report += fit;
    report += " | ";
    report += val;
    report += " | ";
    report += sec;
    report += " | ";
    report += eff;
    report += " | ";
    report += ad;
    report += " | ";
    report += ng;
    report += " | ";
    report += wait;
    report += " | ";
    report += skb;
    report += " |\n";
}
report += "\n";

report += "## Measurement plans (per feature)\n\n";
for mv in measures {
    report += "### ";
    report += mv.feature_id;
    report += "\n\n";
    if mv.north_star != () {
        report += "- **North star:** ";
        report += mv.north_star;
        report += "\n";
    }
    if mv.success_threshold != () {
        report += "- **Success threshold:** ";
        report += mv.success_threshold;
        report += "\n";
    }
    if mv.timebox_days != () {
        report += "- **Timebox:** ";
        report += mv.timebox_days.to_string();
        report += " days\n";
    }
    if mv.experiment != () {
        report += "- **Experiment:** ";
        report += mv.experiment;
        report += "\n";
    }
    if mv.leading_metrics != () {
        report += "- **Leading metrics:**\n";
        for lm in mv.leading_metrics {
            report += "  - ";
            report += lm;
            report += "\n";
        }
    }
    report += "\n";
}

report += "## Syntheses\n\n";
let synth_i = 0;
for r in synth_results {
    synth_i += 1;
    report += "### Synthesizer ";
    report += synth_i.to_string();
    report += "\n\n";
    if r != () && r.success && r.output != () {
        if r.output.summary != () {
            report += r.output.summary;
            report += "\n\n";
        }
        if r.output.now != () {
            report += "**NOW:**\n";
            for x in r.output.now { report += "- "; report += x; report += "\n"; }
            report += "\n";
        }
        if r.output.next != () {
            report += "**NEXT:**\n";
            for x in r.output.next { report += "- "; report += x; report += "\n"; }
            report += "\n";
        }
        if r.output.later != () {
            report += "**LATER:**\n";
            for x in r.output.later { report += "- "; report += x; report += "\n"; }
            report += "\n";
        }
        if r.output.never_or_pivot != () {
            report += "**NEVER / PIVOT:**\n";
            for x in r.output.never_or_pivot { report += "- "; report += x; report += "\n"; }
            report += "\n";
        }
        if r.output.measurement_plan != () {
            report += "**Measurement plan:** ";
            report += r.output.measurement_plan;
            report += "\n\n";
        }
        if r.output.top_risks != () {
            report += "**Top risks:**\n";
            for x in r.output.top_risks { report += "- "; report += x; report += "\n"; }
            report += "\n";
        }
    } else {
        report += "_Synthesizer failed or returned empty._\n\n";
    }
}

report += "## Coverage stats\n\n";
report += "- Research OK: ";
report += r_ok.to_string();
report += "/15\n- Score OK: ";
report += s_ok.to_string();
report += "/40\n- Skeptic OK: ";
report += k_ok.to_string();
report += "/40\n- Measure OK: ";
report += m_ok.to_string();
report += "/40\n- Total planned agents: ";
report += total_agents.to_string();
report += "\n";

let path = write_scratch_file("feature-research-report.md", report);
log("Wrote report to " + path);

// Prefer primary synth as complete value
let primary = #{};
if synth_results.len() > 0 && synth_results[0] != () && synth_results[0].success {
    primary = synth_results[0].output;
}

complete(#{
    path: path,
    total_agents: total_agents,
    research_ok: r_ok,
    score_ok: s_ok,
    skeptic_ok: k_ok,
    measure_ok: m_ok,
    synthesis: primary,
    summary: "Evaluated 40 feature candidates with " + total_agents.to_string() + " logical agents; report at " + path,
});
