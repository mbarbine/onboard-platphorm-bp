# AI PageInsights Standards Engine V1: Deep‑Research Validation, Hardening Changes, and Official Standards Docs

## Validation summary of the revised plan

Your revised plan is directionally correct and substantially closer to a durable, standards-first “AI + Humans” quality operating system than an “analysis-run store.” The most important architectural shift—separating *definitions* (what the standard is) from *execution targets* (what you audited) from *evidence* (what you observed) from *results* (what you concluded) from *advisory* (how you communicate/guide)—matches how long-lived compliance/assurance systems are usually modeled in relational databases (immutable registries + append-only fact tables + derived rollups). citeturn25search12turn31view0

From a standards standpoint, the plan’s “surface artifacts” are mostly grounded in authoritative specs and de-facto protocols, and your optional/advisory posture for emergent conventions (e.g., `/llms.txt`, `humans.txt`) matches their current status. citeturn27view0turn27view1

That said, there are a few **database-correctness issues that must be fixed before migrations will run cleanly**, plus a handful of hardening changes that will strongly reduce breakage risk:

- **Partitioning + primary keys on `results.test_results`**: PostgreSQL requires that a UNIQUE/PK constraint on a partitioned table include *all* partition key columns; otherwise the DDL will fail. Your current `PRIMARY KEY (id)` on a table partitioned by `created_at` is not valid. citeturn31view0  
- **“CONCURRENTLY” maintenance inside functions**: `REINDEX CONCURRENTLY` (and `CREATE INDEX CONCURRENTLY`) cannot run inside a transaction block; PL/pgSQL functions run inside a transaction context, so a “reindex concurrently” function will fail in typical deployments/migration tooling. citeturn32view0turn33search0  
- **Release semantics** are a correct addition; but you should enforce the invariant “only one current release per profile” via a partial unique index rather than relying on application discipline. citeturn31view0  
- **Legacy alias uniqueness** needs stronger constraints to avoid collisions across alias types and tenants (and to preserve future refactors). (This is integrity hardening, not a standards issue.)

The rest of this report provides (a) standards-backed validation, (b) PostgreSQL/Neon correctness findings, (c) minimal-breakage updates, and then (d) two official markdown documents you can publish: `STANDARDS.md` and `REFERENCES.md`.

## Standards-backed surfaces and what they imply for modeling

A standards engine is only as credible as (1) the authority of the surfaces it evaluates and (2) the clarity about whether each surface is **normative** (must/should per a spec), **de-facto** (widely adopted practice), **proposal** (emergent), or **house standard** (your own V1 expectations).

### Robots, security contact, and well-known placement

- `robots.txt` has been formalized as an IETF RFC (RFC 9309). Importantly, robots/REP rules are **not access authorization** and **not a substitute for real security controls**. This directly impacts scoring language: “blocked by robots” should be treated as *discoverability/intent configuration*, not “security.” citeturn25search12turn25search17turn25search13  
- `security.txt` is an IETF RFC (RFC 9116) and is designed to be machine-discoverable at a predictable location, typically under `/.well-known/`. citeturn24search3turn24search4  
- `/.well-known/` itself is standardized (RFC 8615), and there is ongoing work that can obsolete/update it (e.g., “8615bis” drafts), which reinforces why your **release snapshots** are essential: standards do evolve, and you need historical meaning preserved. citeturn24search4turn24search6  

**Model implication:** Your approach—store these as `evidence.artifacts` and score them with `results.artifact_evaluations`—is correct because these artifacts have multi-dimensional quality (parse validity, policy intent coherence, freshness). citeturn25search12turn24search3turn31view0  

### Sitemaps and discoverability inventory

The sitemap protocol is a real, widely adopted ecosystem protocol defined by sitemaps.org. It includes structural constraints and has explicit sitemap index file support and size/URL-count limits. citeturn26search0turn26search1turn26search5  

**Model implication:** blob storage alone is insufficient if you want explainability like “X high-value URLs were missing,” “lastmod drift,” or “index contains dead URLs.” You added `parsed_stats`, which is good, but if you want long-term queryability, you should plan **either**:
- a relational table such as `evidence.sitemap_entries` keyed to `artifact_version_id`, **or**
- a structured JSON payload with targeted indexing for common questions (coverage, orphan detection, bad locs), which you are already preparing for with JSONB + GIN. citeturn26search0turn31view0turn6search2  

### Manifest icons, shareability images, and asset correctness

The Web App Manifest spec explicitly treats icons and their sizes as hints for user agents to select appropriate icons in different contexts; this supports your choice to validate multiple icon sizes and not treat any single size as universally normative across all platforms/browsers. citeturn34search0turn34search5  

For social sharing, the Open Graph protocol is de-facto and recommends completeness fields such as `og:image:alt` when specifying `og:image` (a “should” style recommendation), and it defines type/width/height properties. citeturn20search0turn20search1  
However, there is real ecosystem caution that auto-populating alt text can backfire if the alt text is wrong or misleading; this is a perfect example of a field that should be scored **as an advisory enhancement**, not a hard failure. citeturn20search2turn20search0  

**Model implication:** keeping extracted OG/Twitter/manifest/icon data in evidence tables and rolling up platform coverage/quality in `results.asset_evaluations` is sound and aligns with the “diagnostic-only” ethos. citeturn34search0turn20search0  

### Accessibility and internationalization foundations

WCAG 2.2 is a W3C Recommendation and should remain your accessibility “hard anchor” (“normative” scoring domain). citeturn1search0  
ARIA is also standardized through W3C work, making ARIA semantics checks in your test registry justifiable as standards-first validation. citeturn1search1  

For inter-global readiness, Unicode and its annexes matter operationally (text direction, normalization, and script behavior), and language tagging is grounded in IETF BCPs (e.g., BCP 47 language tags). citeturn1search2turn1search3turn8search0turn8search1  
Locale correctness also typically relies on CLDR data semantics (dates, numbers, pluralization rules). citeturn8search0  

### AI agent discovery conventions

`/llms.txt` is explicitly presented as a proposal to help LLMs use a website at inference time and includes definitional structure for parseability. Its use by projects like FastHTML is documented by the proposal itself, which supports your treatment of `/llms.txt` as an **advisory readiness layer** (optional suite) rather than a required web standard. citeturn27view0turn30view2  

`humans.txt` is explicitly positioned as a voluntary initiative (“The internet is for humans… why not a file for ourselves?”) and should remain an optional trust/attribution surface. citeturn27view1  

### Archival durability as a “new internet” layer

If your ambition is truly “the new internet,” archival and time-based verifiability should be first-class in your standards map:
- The Internet Archive states a mission of broad access/preservation (useful as a quality benchmark for “preservability”). citeturn17search0turn17search1  
- WARC (Web ARChive format) exists as an ISO standard (commonly used for web preservation workflows). citeturn15search0  
- RFC 7089 (Memento) defines a protocol for time-based access to past representations of web resources—highly aligned with reproducibility and evidence retention in an audit engine. citeturn11search0  

### JA4+ as a cross-domain security/observability reference

JA4+ is published as a suite of network fingerprinting methods and is being incorporated into major platforms; for example, AWS WAF exposes JA4 fingerprint matching for requests. This is not a W3C/IETF web standard, but it is relevant as an **operational security/observability reference** for your “quality OS.” citeturn30view0turn30view1  

## PostgreSQL and Neon correctness findings that affect migration safety

### UUID generation and `gen_random_uuid()`

Modern PostgreSQL includes `gen_random_uuid()` as a built-in (not only via extensions), but the availability depends on PostgreSQL version; your engine should explicitly document the minimum supported PostgreSQL version, and your Neon deployment should be pinned accordingly. citeturn14search0turn14search3  

### JSONB indexing with `jsonb_path_ops`

GIN indexing with `jsonb_path_ops` is appropriate when your query patterns are containment-heavy and structured around JSON paths; it does not magically speed all JSONB workloads. Your plan’s use is correct, but you should document the expected query patterns (containment vs general operators) to avoid surprise performance regressions. citeturn6search2  

### TOAST limits and “heavy evidence” storage

Storing Lighthouse JSON as JSONB is valid and will use TOAST for large values, but PostgreSQL TOASTed fields have a practical maximum (~1GB per field), which supports your dual pattern: store either the JSONB blob or an external `report_url` for very large reports. citeturn6search3turn34search7  

### Partitioning gotchas you must fix now

Your plan’s partitioning intent is correct, but the DDL must be corrected:

- **Unique/primary key constraints on partitioned tables must include all partition key columns**, otherwise PostgreSQL rejects the constraint. This means `PRIMARY KEY (id)` on a table partitioned by `created_at` is invalid. citeturn31view0  
- Creating indexes on a partitioned table will create corresponding indexes on the leaf partitions (good), but **you cannot use `CONCURRENTLY` on the partitioned parent**; PostgreSQL documents a workaround using “create invalid index on ONLY parent + create concurrently per-partition + attach.” That matters for “online” index maintenance at scale. citeturn31view0turn33search0  

### “CONCURRENTLY” cannot run in your maintenance functions

Both `CREATE INDEX CONCURRENTLY` and `REINDEX CONCURRENTLY` cannot be executed inside a transaction block. Many migration frameworks wrap migrations in a transaction by default, and PL/pgSQL functions are executed within a transaction context, so your “maintenance function” must be redesigned (run as an out-of-band job/script or use non-concurrent DDL in migration windows). citeturn33search0turn32view0  

### RLS scaffolding is correct but needs operational clarity

PostgreSQL RLS and policies are implemented correctly in your plan, but the critical operational requirement is that your application must set the session variable (e.g., `app.tenant_id`) per connection/session, or the RLS policy will not isolate tenants as intended. PostgreSQL’s RLS model supports this approach, but you should explicitly define the runtime contract in your app/db layer. citeturn6search5  

## Minimal-breakage hardening updates to incorporate before V1 rollout

These are the adjustments that most reduce migration risk while keeping your architecture intact:

### Fix partitioning without breaking references

You have three viable options (choose one explicitly in V1):

- **Option A (lowest breakage, recommended for V1):** Don’t partition `results.test_results` yet. Use BRIN on `created_at` + btree indexes on `analysis_id`, and revisit partitioning in V1.1 when you have real data volume and query patterns. BRIN is specifically intended for large tables with naturally time-correlated columns. citeturn6search7turn34search7  
- **Option B (keep partitioning, keep integrity):** Partition by time but change PK and any FKs to align with PostgreSQL’s “partition key in unique constraints” rule; this will increase key complexity in referencing tables. citeturn31view0  
- **Option C (keep partitioning + keep simple external references):** Introduce an unpartitioned “key table” that provides a global uniqueness anchor for `test_result_id`, then store heavy details in the partitioned table. (More complex; best reserved for later.)

Because you explicitly want “minimize breakage,” **Option A** is typically the best V1 move.

### Enforce release invariants in the database

Your `registry.profile_releases` design is correct; add a partial unique index enforcing one current release per profile, and treat `spec_hash` as a real digest of canonicalized registry content (computed in-app during release). The need for release snapshots is reinforced by the ongoing “8615bis” effort that can obsolete/update `.well-known` semantics—proof that standards evolve. citeturn24search4turn24search6  

### Remove/relocate “concurrent maintenance functions”

Replace the `maintenance.reindex_evidence_jsonb()` function with:
- a documented **runbook** (`scripts/maintenance/reindex.sql`) executed outside a transaction, or
- an app-level job that calls `REINDEX CONCURRENTLY` in autocommit mode. citeturn32view0  

### Strengthen legacy alias constraints

Update `registry.test_aliases` constraints to avoid collisions across alias types and identifiers (e.g., unique on `(alias_type, legacy_slug)` and `(alias_type, legacy_id)` where not null). This preserves compatibility when you rename tests or refactor test taxonomy.

### Add mandatory “profile_release_tag” everywhere comparisons exist

You already added this to the compatibility views; keep it *in every API contract that supports comparisons*. Without it, comparisons across runs can silently compare different standards definitions—which is unacceptable for a standards engine.

## Official site documents

Below are two markdown documents you can publish as-is. The first is the “one document” that unifies (a) operating principles, (b) the layered architecture, (c) migration invariants and breakage-minimizing strategy, and (d) a standards+quality reference map that remains proposal-aware and future-compatible. The second is a curated `REFERENCES.md` including the requested “saint.”

The standards claims embedded in these documents are grounded in authoritative specifications and documentation: RFC robots/REP guidance, RFC security.txt and well-known placement, sitemap protocol rules, W3C WCAG/ARIA/manifest specs, “INP replaces FID,” PostgreSQL partitioning and concurrently constraints, and the llms.txt/humans.txt initiatives. citeturn25search12turn24search3turn26search0turn1search0turn34search0turn19search0turn31view0turn33search0turn27view0turn27view1turn29search0turn29search2  

## STANDARDS.md

```md
# AI PageInsights Platform Standards Engine — V1
AI + Humans Web Standard Profile (Inter‑Global, Inter‑Dimensional)

Status: Draft for V1 publication
Last updated: 2026‑03‑17
Owner: PlatphormNews / PageInsights

## Purpose
This document defines the foundational operating model for the AI-and-human web:
a versioned, standards-first quality system that is:
- diagnostic (never coercive)
- standards-backed where standards exist
- convention-aware where the ecosystem is emergent
- globally usable across languages, scripts, locales, and cultures
- inter-dimensionally accessible across human sensory, cognitive, motor, situational, and device dimensions
- machine-legible and human-legible at the same time
- scorable, automatable, explainable, and reproducible

## Normative vs Advisory: four levels of authority
We label each evaluated surface and test with one of these authority levels:

1) Normative Standard (MUST/SHOULD)
   Backed by an authoritative spec (IETF RFC, W3C Recommendation, ISO standard).

2) De-facto Protocol / Widely Adopted Convention
   Not formally standardized, but strongly ecosystem-defining (e.g., Open Graph).

3) Proposal / Emerging Convention
   Intentional experiments meant to improve agent and human usability.
   These are NEVER hard blockers (e.g., /llms.txt, humans.txt).

4) House Standard
   Our own V1 expectations designed to improve safety, usability, shareability,
   and joy — while preserving creative freedom and diversity of implementation.

## Scoring philosophy (three families + two optional overlays)
Every audit produces these score families:

A) Normative Compliance Score
   “Are you correct according to authoritative standards?”

B) Operational Quality Score
   “Are you robust in real-world conditions?”

C) AI + Human Readiness Score
   “Are you legible, attributable, and reusable for agents and humans?”

Optional overlays (not gatekeepers):
- Asset & Shareability Score (icons, previews, manifests, brand assets)
- Joy Score (UX, design coherence, delight — diagnostic only)

## Output contract (per run)
Each run MUST return:
- overall_score (0–100)
- normative_compliance_score
- operational_quality_score
- ai_human_readiness_score
- critical_failures (human-readable, machine readable)
- high_value_opportunities
- advisory_enhancements
- global_usability_grade
- ai_readiness_grade
- human_trust_grade
- profile_release_tag (required for comparison validity)

## Data model: five-layer architecture
We store the standards engine as five layers (plus ops):

- registry.*   What the standard IS (profiles, suites, tests, badges, releases)
- core.*       What was run and what targets were evaluated
- evidence.*   What was observed (artifacts, snapshots, extracts, screenshots, assets)
- results.*    What the engine concluded (test results, scores, artifact/asset rollups)
- advisory.*   What the system recommends (findings, suggestions, badges)
- ops.*        Operational tables (jobs, rate limits, audit logs, webhooks)

### Immutability rules
- registry.tests is append-only. Do not UPDATE test definitions.
- Every analysis run must pin to a registry.profile_release_id (snapshot semantics).
- evidence is append-only for reproducibility; new captures become new versions.
- results are derived and MUST remain recomputable from evidence + registry.

## What an analysis run is (core.analyses)
A run is an envelope that answers:
- who ran it (tenant/user)
- what profile release was used
- what URL/site was evaluated
- what strategy/context was used (mobile/desktop, locale)
- tracing identifiers for reproducibility/debug
- timestamps and status

## Targets: what exactly was evaluated (core.analysis_targets)
Every run MUST explicitly record targets:
- primary_url (requested URL)
- canonical_url (declared canonical)
- alternate_locale (hreflang alternates)
- sampled_page (multi-page samples)
- artifact_probe (robots, sitemaps, llms, humans, security.txt, etc.)
- asset_probe (favicon, manifest icon, OG image, etc.)

This makes runs explainable and comparable.

## Evidence: artifact-first modeling
Artifacts are protocol-backed or convention-backed surfaces such as:

### Crawl/discovery surfaces
- /robots.txt (IETF RFC Robots Exclusion Protocol)
- /sitemap.xml, sitemap index files (sitemaps.org protocol)
- sitemap-main.xml (optional convention — scored if present)

### Trust + security disclosure surfaces
- /.well-known/security.txt (IETF RFC security.txt)
- /.well-known/ location (IETF well-known URI path prefix)

### AI + human transparency surfaces (advisory)
- /llms.txt (proposal)
- /llms-index.json (house schema for V1; proposal-aware)
- /humans.txt (initiative)

### Legal/rights surfaces
- /privacy, /terms, /license (varies by site)

### API surfaces
- OpenAPI documents
- MCP endpoints (if present; proposal-aware)

Each artifact capture creates:
- evidence.artifacts (identity + fetch metadata)
- evidence.artifact_versions (content snapshots + parse/schema results)

## Results: atomic tests plus rollups
- results.test_results: atomic outcomes, tied to registry tests and evidence
- results.suite_scores: rollups per suite
- results.scores: overall + family scores (normative/operational/ai_human)
- results.artifact_evaluations: multi-dimensional artifact scoring
- results.asset_evaluations: shareability/asset platform scoring

### Important PostgreSQL constraint note (V1)
If results.test_results is partitioned, Postgres requires UNIQUE/PK constraints to include
all partition key columns. For V1 “minimize breakage,” partitioning is recommended as a V1.1 step.

## Asset & shareability expectations (S13_ASSET)
We validate “site assets” (not content):
- favicon coverage (rel=icon, favicon.ico behavior, PNG/SVG/ICO support)
- apple-touch-icon coverage
- web app manifest + icons coverage (multiple sizes + purposes)
- Open Graph image completeness (width/height/type, and advisory alt)
- twitter preview surface (image + card type where used)
Outputs must clearly distinguish:
- required-by-spec vs best-practice vs advisory-only

## Joy & design expectations (S14_JOY)
Joy is diagnostic-only:
- clarity, coherence, perceived responsiveness, navigation comfort
- “delight without harm” (no motion sickness defaults; respects reduced motion)
- inter-global readability and inter-dimensional inclusion

Implementations must avoid enforcing creative sameness.

## Standards lifecycle and change management
We treat standards as living:
- Some standards are stable (RFCs, W3C Recs).
- Some are living standards (WHATWG).
- Some are proposals (llms.txt).
- Some are house standards (our V1 additions).

Rule:
- Changing the rules MUST require a new profile release.
- Historical comparisons MUST include profile_release_tag.

## The SAINT principle (house standard)
We include an explicit human-anchored principle for the AI + Humans web:

SAINT = Stewardship, Accessibility, Integrity, Neutrality, Transparency

This is a house standard guiding remediation language:
- “diagnostic, not coercive”
- “clarity without gatekeeping”
- “global-first, inclusive-by-design”
- “truthful metadata and honest limits”

## Suites in V1 (14)
S01_HTTP         HTTP & Crawlability
S02_REDIRECT     Redirect & Canonical
S03_INDEXING     Indexing Control
S04_SITEMAP      Sitemap Discoverability
S05_I18N         Multilingual & Localization
S06_A11Y         Accessibility
S07_SEMANTIC     Semantic Meaning & Structured Data
S08_AI_DISCOVERY AI Discovery Surfaces (llms*)
S09_HUMAN        Human Attribution (humans.txt)
S10_PRIVACY      Privacy & Consent Transparency
S11_LICENSE      Licensing & Reuse Clarity
S12_PERF         Performance & Resilience
S13_ASSET        Asset & Shareability
S14_JOY          Joy & Design

## Minimal-breakage rollout strategy (required)
V1 rollout MUST:
- create layered schemas alongside legacy
- backfill incrementally
- publish compatibility views (public.*_v2)
- switch reads to views first
- adopt dual-write only where necessary (short-lived)
- ensure APIs always return profile_release_tag for comparisons

## Compliance posture (always voluntary)
Badges and labels are self-awarded.
Missing proposal surfaces (llms.txt, humans.txt) are “not implemented,” not “failed.”
All guidance is optional.
```

## REFERENCES.md

```md
# References (Standards + Core Conventions + Proposal Surfaces)
Curated for AI PageInsights Standards Engine V1.
Last updated: 2026‑03‑17

## IETF / RFC (Internet standards)
- RFC 9309 — Robots Exclusion Protocol (robots.txt)
  https://www.rfc-editor.org/info/rfc9309
- RFC 9116 — security.txt
  https://www.rfc-editor.org/info/rfc9116
- RFC 8615 — /.well-known/ URI path prefix
  https://www.rfc-editor.org/info/rfc8615
- draft-ietf-httpapi-rfc8615bis — well-known evolution (proposal-aware change tracking)
  https://datatracker.ietf.org/doc/draft-ietf-httpapi-rfc8615bis/
- RFC 7089 — Memento (time-based content negotiation / “web time travel”)
  https://www.rfc-editor.org/info/rfc7089
- RFC 5646 / RFC 4647 — BCP 47 language tags
  https://www.rfc-editor.org/info/rfc5646
- RFC 3629 — UTF‑8
  https://www.rfc-editor.org/info/rfc3629
- RFC 3986 — URI generic syntax
  https://www.rfc-editor.org/info/rfc3986

## W3C / WHATWG (Web platform standards)
- WCAG 2.2 (W3C Recommendation)
  https://www.w3.org/TR/WCAG22/
- WAI‑ARIA (W3C Recommendation)
  https://www.w3.org/TR/wai-aria/
- Web Application Manifest (W3C TR)
  https://www.w3.org/TR/appmanifest/
- Content Security Policy Level 3 (W3C TR)
  https://www.w3.org/TR/CSP3/
- Ethical Web Principles (W3C TAG; values/quality reference)
  https://www.w3.org/TR/ethical-web-principles/
- HTML Living Standard (WHATWG)
  https://html.spec.whatwg.org/

## Unicode + internationalization foundations
- The Unicode Standard (core)
  https://www.unicode.org/standard/standard.html
- UAX #9 — Unicode Bidirectional Algorithm (RTL/BiDi behavior)
  https://www.unicode.org/reports/tr9/
- UAX #15 — Unicode Normalization
  https://unicode.org/reports/tr15/
- UTS #35 — Unicode CLDR (locale data)
  https://unicode.org/reports/tr35/

## Sitemaps (discovery protocol)
- Sitemap Protocol (sitemaps.org)
  https://www.sitemaps.org/protocol.html
- Google Search Central — building and submitting sitemaps
  https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap

## Open Graph + preview conventions (de-facto)
- The Open Graph protocol (og:image and og:image:alt recommendations)
  https://ogp.me/
- Note (ecosystem caution):
  Yoast discussion about the risks of og:image:alt automation and accessibility failures.

## AI + agent discovery surfaces (proposal-aware)
- /llms.txt proposal (llmstxt.org)
  https://llmstxt.org/
- humans.txt initiative (humanstxt.org)
  https://humanstxt.org/
- FastHTML project (reference implementation of llms proposal patterns)
  https://github.com/AnswerDotAI/fasthtml

## Network fingerprinting (cross-domain observability reference)
- JA4+ Network Fingerprinting (FoxIO)
  https://github.com/FoxIO-LLC/ja4
- AWS WAF JA4Fingerprint API docs (industry adoption)
  https://docs.aws.amazon.com/waf/latest/APIReference/API_JA4Fingerprint.html

## Archives and preservation (durability reference)
- Internet Archive / Wayback Machine (preservation benchmark)
  https://archive.org/
- WARC file format (ISO web archiving standard; commonly referenced as ISO 28500)
  (ISO publication; public summaries exist in archives/preservation communities)

## PostgreSQL (engine correctness references)
- Table partitioning + unique/PK rules
  https://www.postgresql.org/docs/current/ddl-partitioning.html
- CREATE INDEX (CONCURRENTLY constraints)
  https://www.postgresql.org/docs/current/sql-createindex.html
- REINDEX (CONCURRENTLY constraints)
  https://www.postgresql.org/docs/current/sql-reindex.html
- Row-level security (RLS)
  https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- JSONB indexing (GIN and jsonb_path_ops)
  https://www.postgresql.org/docs/current/datatype-json.html

## The Saint (human anchor for SAINT principle)
- Saint Carlo Acutis — canonized 2025‑09‑07 (digital-age witness; human meaning anchor)
  Vatican News / Vatican.va coverage:
  https://www.vaticannews.va/
  https://www.vatican.va/
```

### Why the “saint” belongs in a standards repo
A standards engine that claims to be “AI + Humans” benefits from at least one explicitly human anchor that is not a protocol or database feature. You asked for “the saint,” and **Saint entity["people","Carlo Acutis","italian catholic saint"]** is now canonized (September 7, 2025) and explicitly presented in official Vatican communications, making him a historically grounded cultural reference for “the internet is for humans” commitments. citeturn29search0turn29search2turn29search1