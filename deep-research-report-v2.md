# V1 Standards Engine Implementation Plan Review With Standards-Backed Validation

## Context and evaluation criteria

Your updated plan correctly reframes the platform from an “analysis-run store” into a **versioned, standards-first quality operating system** with separate layers for (a) definitions, (b) targets, (c) evidence, (d) results, and (e) advisory outputs. This separation matches how durable compliance/quality engines are typically built in relational systems: immutable registries, append-only fact tables, and derived rollups. citeturn1search2turn2search0turn2search3

The deep-research check for accuracy hinges on three questions:

- Whether the “surface artifacts” you intend to score are grounded in real, authoritative standards or widely adopted conventions (RFCs, W3C specs, and de-facto protocols).
- Whether the schema choices will work reliably in entity["organization","PostgreSQL","database project"], including correctness of partitioning, indexing, generated columns, and row-level security primitives. citeturn2search0turn1search2turn2search3
- Whether the plan preserves **historical meaning** as the standard evolves (your “profile release” concept) and minimizes application breakage during migration.

Overall: the updated plan is **substantially closer to “V1 standards engine ready”** than earlier drafts, and the “critical additions” you’ve added map well to both standards requirements and database realities. The remaining improvements are mostly about **hardening invariants**, **tightening constraints that matter**, and ensuring the **minimum-breakage** migration path remains predictable at scale.

## Standards-backed surfaces and what they imply for the model

### robots.txt and “discoverability vs security” semantics

Your plan’s positioning of `robots.txt` as an inspectable artifact is well-founded: the Robots Exclusion Protocol is now formalized as **RFC 9309**. citeturn0search0turn0search4

Crucially, RFC 9309 explicitly states that REP rules are **not access authorization** and “not a substitute for valid content security measures,” which matters directly to how findings are categorized and scored: “blocked-by-robots” is **configuration/discoverability intent**, not a security boundary. citeturn0search0turn0search4

Schema implication (your current plan aligns): keeping `robots` in `evidence.artifacts`, with artifact-level evaluation in `results.artifact_evaluations`, lets you score parse correctness and “intent coherence” without treating it as a security-control failure.

### security.txt and the well-known location rule

Treating `security.txt` as first-class is correct and standards-aligned:

- **RFC 9116** defines `security.txt` as a machine-parsable file at a known location, and states it **MUST** follow the ABNF grammar defined in the RFC. citeturn0search1turn0search9
- The `/.well-known/` URI path prefix is standardized in **RFC 8615**. citeturn0search2turn0search6

Your `is_well_known_path` flag is a good move because “location correctness” is part of the standard’s intended predictability. citeturn0search2turn0search6

One forward-looking nuance: there is an active IETF draft (“8615bis”) that proposes obsoleting RFC 8615. That doesn’t change what you should implement today, but it reinforces the value of your “proposal-aware” posture and release-based versioning. citeturn0search14turn0search2

### Sitemaps and sitemap indexes: snapshot + parsed inventory

Your sitemap modeling is anchored in a real protocol: sitemaps.org defines that the file must be **UTF‑8 encoded**, uses XML tags, and supports **sitemap index files**. citeturn0search3turn0search11turn0search7

This is one place where “standards engine” accuracy requires more than storing blobs. Coverage scoring requires knowing which URLs were present and their properties at run time; in practice that means either:

- parsed entries stored relationally (sitemap entries tied to an artifact version), or
- parsed entries stored as a structured JSON payload with searchable indexing

Your current plan adds `artifact_versions.parsed_stats`, which is a step in the right direction, but if you want explainability like “X important URLs were missing from the sitemap,” parsed entries (even if sampled) should be queryable long after the run. citeturn0search3turn0search11

### Web App Manifest and icon completeness (asset score)

The asset/shareability expansion is grounded in formal and de-facto standards:

- The **Web App Manifest** spec describes icon sizes as **hints** that user agents use to choose a suitable icon in context, and discusses multiple formats and sizes. citeturn3search0turn3search8
- This directly supports your `evidence.asset_instances` table: you can validate declared vs fetched MIME types, sizes, and platform coverage, then roll up into `results.asset_evaluations`. citeturn3search0turn3search4

For practical “installed app” expectations, modern guidance like web.dev’s manifest article (Chromium-oriented) describes minimum icon requirements (e.g., 192×192 and 512×512). This kind of requirement is not a W3C normative MUST across all browsers, but it’s valuable for an operational “platform compatibility” score. citeturn3search20turn3search0

### Open Graph, Twitter images, and the alt-text controversy you should encode as “advisory”

Open Graph is a real protocol layer in the ecosystem. The Open Graph protocol explicitly states that if a page specifies `og:image`, it “should” specify `og:image:alt`, and it defines `og:image:type`, width and height attributes. citeturn3search1turn3search9

But there is a real ecosystem dispute: producers like Yoast have argued they removed support for automatically setting `og:image:alt` because it can harm accessibility if the alt text is wrong or misleading. citeturn3search13

This is exactly where your standard’s “diagnostic-only, freedom-preserving” philosophy matters. The plan should treat OG/Twitter alt text as:

- a **positive quality signal** when it is accurate, and
- a **risk signal** (not a hard fail) when absent, because blindly forcing it can be counterproductive. citeturn3search1turn3search13turn3search9

Your schema supports this: store the extracted values and score it in an advisory dimension under asset/shareability without making it a normative failure.

### humans.txt and llms.txt: advisory readiness layers

Your standards references correctly categorize these as non-normative ecosystem signals:

- `humans.txt` is an initiative to document the people behind a site; the humans.txt “quick start” explicitly recommends UTF‑8 encoding. citeturn3search2turn3search6
- `/llms.txt` is explicitly described as a proposal to help LLMs use sites at inference time; it is not an Internet standard, and its semantics are still emergent. citeturn3search3turn3search7

The plan’s approach of scoring these under optional suites (AI Discovery, Human Attribution) is consistent with the nature of the signals: advisory quality enhancement, not hard compliance. citeturn3search3turn3search6

## Database design correctness in PostgreSQL and implications for Neon

### UUID generation: gen_random_uuid availability and versioning

Your plan depends heavily on `gen_random_uuid()`. This is valid in PostgreSQL 13+ because PostgreSQL 13 added a built-in `gen_random_uuid()` function, and the release notes explicitly state that previously UUID generation was only in external modules like `uuid-ossp` and `pgcrypto`. citeturn4view0

If your deployment target includes Postgres < 13, you’d need extensions; if it’s Postgres ≥ 13 (typical for modern managed Postgres providers like entity["company","Neon","serverless postgres provider"]), you are aligned. citeturn4view0

### JSONB indexing: jsonb_path_ops tradeoffs

Your plan uses GIN indexes with `jsonb_path_ops` for JSONB evidence. This is consistent with PostgreSQL documentation: `jsonb_path_ops` supports fewer operators than the default `jsonb_ops` but can offer better performance for the operators it supports (notably containment-style queries). citeturn1search1turn5search7turn1search5

V1 implication: keep `jsonb_path_ops` for containment-heavy queries, but do not assume it speeds up arbitrary JSONB patterns; it’s best when your query patterns match the supported operators. citeturn1search1turn1search5

### TOAST and evidence storage strategy

Storing Lighthouse JSON in-table is valid but must be treated as “heavy evidence.” PostgreSQL uses TOAST to store large field values because tuples cannot span multiple pages; oversized values are compressed and/or moved out-of-line. citeturn2search3turn5search6

Also, PostgreSQL notes that TOASTed fields can be at most **1 GB**, while large objects can scale higher (up to TBs). That supports your dual storage strategy (`report_json` plus `report_url`) and your retention/partitioning emphasis. citeturn5search2turn2search11

### Partitioning and indexes on partitioned tables

Your plan’s partitioning of `results.test_results` by `created_at` is consistent with PostgreSQL’s declarative partitioning approach. citeturn2search0

Your index strategy is also aligned with PostgreSQL behavior: the PostgreSQL docs note that creating an index on a partitioned table automatically creates matching indexes on each partition, and partitions created/attached later will also have the index. citeturn2search0turn2search20

Your BRIN index choice for time-correlated queries is grounded: BRIN is designed for very large tables where columns have natural correlation with physical location (like append-only timestamps). citeturn2search1turn2search17

### REINDEX CONCURRENTLY correctness and version requirement

Your maintenance functions call `REINDEX ... CONCURRENTLY`. That capability was introduced in PostgreSQL 12; release notes explicitly mention “REINDEX CONCURRENTLY can rebuild an index without blocking writes to its table.” citeturn5search0

The docs also describe the locking characteristics of REINDEX CONCURRENTLY (e.g., it avoids the most restrictive locks and is designed for availability). citeturn5search5turn5search1

V1 implication: you should document that `REINDEX CONCURRENTLY` requires PostgreSQL 12+ so environments below that baseline need different maintenance routines. citeturn5search0turn5search5

### RLS scaffolding correctness

Your RLS scaffolding is aligned with PostgreSQL features:

- PostgreSQL supports enabling row level security with `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`. citeturn1search2turn1search6
- Policies are created with `CREATE POLICY`, and row security must be enabled for policies to apply. citeturn1search6turn1search2

The “current_setting('app.tenant_id')" pattern is a common application-level mechanism for passing tenant context, but your plan should state explicitly that the application must set that value per connection/session, or RLS policies won’t behave as intended. citeturn1search2turn1search6

## Accuracy check on the V1 additions and recommended hardening changes

### Target model: core.analysis_targets

Your addition of `core.analysis_targets` is correct and directly addresses a common failure mode of audit platforms: not being able to concretely answer “what was examined?” The new model supports multi-page audits, locale alternates, and explicit artifact probes. This is consistent with your goals of explainability and standards evolution. citeturn0search3turn0search0

Hardening recommendation: consider a “target_set_id” or “sampling_plan” field in metadata, so you can reproduce sampling behavior across reruns, comparisons, and regression tests.

### Artifact evaluation rollups: results.artifact_evaluations

This is a key correctness improvement. Many artifacts are multi-dimensional:

- sitemaps: parse validity + encoding correctness + coverage + bad URLs citeturn0search3turn0search11  
- security.txt: ABNF validity + required fields presence, and correct well-known placement citeturn0search1turn0search2  
- robots: parse validity + crawler outcomes + “not access authorization” warnings citeturn0search0turn0search4  
- llms.txt: not a standard, but can be scored for completeness and usefulness at inference time citeturn3search3turn3search7  

Hardening recommendation: treat `artifact_evaluations` as the canonical place for cross-test artifact outcomes and keep `test_results` for atomic checks. This avoids having to recompute rollups every time you render a report.

### Asset/shareability validation: evidence.asset_instances + results.asset_evaluations

This is aligned with your asset score goals and grounded in specs for manifest icons and OG structured properties. citeturn3search0turn3search1

Hardening recommendations:
- Preserve both “declared URL” and “resolved URL” (you already do).
- Store a boolean “content-sniff mismatch” when declared type differs from actual mime type; this often breaks previews and installability.
- Store the “source surface” (head rel icon / manifest / og / twitter / json-ld) so you can attribute failures to the correct producer layer.

### Profile/version snapshot semantics: registry.profile_releases

This is the biggest improvement for standards credibility. It aligns with your requirement to keep historical meaning stable as the standard evolves. You are effectively implementing “semantic versioning for the standard itself.” citeturn3search3turn0search14

Hardening recommendations:
- Add a **partial unique index** ensuring only one `is_current = TRUE` per profile. (Without that, multiple rows can be flagged current.)
- Make `spec_hash` a strong digest of canonicalized definitions rather than a placeholder; PostgreSQL can store digests via extensions, or you can compute in-app and store as hex/base64. citeturn4view0turn5search0

### Legacy test mapping: registry.test_aliases

The aliasing idea is correct and necessary for backward compatibility. However, the current uniqueness constraint (`UNIQUE(legacy_slug)`) is not sufficient to cover alias types “id” and “name,” and it doesn’t prevent collisions across alias types.

Hardening recommendation: enforce uniqueness on `(alias_type, legacy_id)` and/or `(alias_type, legacy_slug)` as appropriate, and allow multiple aliases per test. (This is a database integrity hardening issue, not a standards issue.)

### INP-first scoring

Your plan is accurate. Google documented that INP replaces FID in March 2024 and Search Console will stop showing FID and use INP as the responsiveness metric. citeturn1search3turn1search7

Hardening recommendation: encode “FID is deprecated” as metadata and ensure UI/reporting labels treat FID as historical only, which your `fid_deprecated boolean` already supports. citeturn1search3turn1search7

### Scale controls: partitioning and retention

You are correct to treat partitioning as foundational for large append-only tables, and PostgreSQL’s docs explicitly describe partitioning behavior and indexing on partitioned tables. citeturn2search0turn2search20

Hardening recommendation: the `drop_old_partitions` function in your update is currently a stub (it prints notices but doesn’t actually detach/drop partitions safely). Consider a safer approach that reads partition bounds (not names) before dropping and is gated behind a “dry-run” mode.

### Multi-tenant safety: RLS scaffolding

The RLS approach is grounded in PostgreSQL’s core model. citeturn1search2turn1search6

Hardening recommendation: policies that use subqueries against `core.analyses` are correct but can become a performance hotspot. Many multi-tenant systems denormalize `tenant_id` into child tables (e.g., `evidence.artifacts.tenant_id`) specifically to make RLS predicates cheap and indexable. The plan can remain as-is for V1 (to minimize migration complexity), but this should be explicitly tracked as a V1.1 optimization. citeturn1search2turn1search6turn2search0

## Minimal-breakage rollout strategy that matches your plan

Your “compatibility views first” strategy is the correct lever to minimize breakage. The updated `public.analyses_v2`, `public.analysis_tests_v2`, and `public.public_timeline_v2` views are exactly what you want: keep existing API contracts stable while internally moving the system to the layered model.

Two practical, standards-engine-specific improvements:

- Always include `profile_release_tag` in the view and API responses for comparisons. Without it, runs produced under different definitions are conflated. This is essential given your use of emergent/proposal surfaces like llms.txt and the possibility of changes to standards like well-known URI processing over time. citeturn3search3turn0search14
- Make the history API’s sorting and filtering pull from `results.scores` and `results.core_web_vitals` (INP-first), not from duplicated score fields in analyses, to prevent drift between “computed scores” and “displayed scores.” citeturn1search3turn2search0turn2search1

## Bottom-line conclusion on this update

This current update is now **accurate as a V1 standards engine implementation plan** in the sense that it:

- is grounded in real standards for core surface artifacts (`robots.txt`, `security.txt`, well-known URIs, sitemaps, manifests, OG metadata) citeturn0search0turn0search1turn0search2turn0search3turn3search0turn3search1  
- uses PostgreSQL features correctly (schemas, generated columns, partitioning, GIN jsonb_path_ops indexing, BRIN for time correlation, RLS scaffolding, and REINDEX CONCURRENTLY constraints) citeturn2search0turn1search1turn2search1turn1search2turn5search0turn2search3  
- incorporates the essential review additions that a standards engine needs (targets, artifact rollups, asset validation, release snapshots, legacy mapping, INP-first scoring) citeturn1search3turn3search3turn3search6  

The remaining work is **hardening**—not re-architecture. The most important hardening items are:

- enforce “single current release per profile” invariant
- strengthen legacy alias uniqueness constraints
- complete retention/drop partition logic safely
- explicitly treat OG/Twitter alt-text as advisory (given ecosystem controversy) citeturn3search1turn3search13  

If you want, I can produce an “amended plan appendix” that includes those hardening tweaks as concrete migrations (SQL), while keeping your numbering and minimizing application changes (views-first, then cutover).