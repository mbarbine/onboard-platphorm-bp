
# New Internet Quality & Compliance Framework  
## AI + Humans Web Standard Profile v1

**Status:** Draft v1  
**Mode:** Diagnostic and advisory  
**Target:** Human-facing and machine-facing websites, apps, docs portals, APIs, and agent-ready services

## Purpose

This framework defines a production-grade quality and compliance operating model for the AI-and-human web.

It is designed to evaluate whether a site is:

- technically correct
- globally usable
- accessible across human dimensions
- machine-legible
- privacy-aware
- rights-aware
- attributable and trustworthy
- resilient under constrained conditions
- shareable and identity-consistent
- emotionally clear, usable, and joyful

The framework is **diagnostic, not coercive**. It does not block publishing, indexing, crawling, or reuse on its own. It produces scores, guidance, evidence, and optional remediation suggestions.

## Design principles

- standards-first where standards exist
- proposal-aware where the ecosystem is emerging
- human-centered and machine-legible at the same time
- scorable, automatable, and explainable
- safe for creators with different goals, budgets, and values
- artifact-aware and evidence-driven
- implementation-agnostic
- freedom-preserving

## Scoring philosophy

The framework uses **five score layers**.

1. **Normative Compliance Score**  
   Standards-backed technical conformance such as HTTP correctness, WCAG alignment, valid robots rules, and sitemap protocol validity.

2. **Operational Quality Score**  
   Discoverability, robustness, performance, maintainability, resilience, and deployment correctness.

3. **AI + Human Readiness Score**  
   Machine readability, attribution, explainability, privacy transparency, reuse clarity, shareability, and future-facing interoperability.

4. **Experience Quality Score**  
   Clarity, navigation, trust cues, asset quality, brand consistency, and friction reduction.

5. **Joy Score**  
   A non-punitive measure of delight, warmth, confidence, coherence, and sharing readiness.

## Final output model

Every run should return:

- `overall_score`
- `normative_compliance_score`
- `operational_quality_score`
- `ai_human_readiness_score`
- `experience_quality_score`
- `joy_score`
- `critical_failures`
- `high_value_opportunities`
- `advisory_enhancements`
- `implemented_surfaces`
- `missing_optional_surfaces`
- `ai_readiness_grade`
- `human_trust_grade`
- `global_usability_grade`
- `shareability_score`
- `asset_identity_score`
- `privacy_posture_score`
- `licensing_clarity_score`
- `global_legibility_score`
- `accessibility_dimensional_score`
- `agent_legibility_score`
- `human_attribution_score`
- `provenance_traceability_score`
- `claim_verifiability_score`

Per artifact the report should include:

- `exists`
- `fetch_status`
- `content_type`
- `parse_status`
- `schema_status`
- `coverage_score`
- `freshness_score`
- `utility_score`
- `safety_score`
- `notes`
- `evidence`

## Interpretation rules

- Missing optional artifacts are reported as **not implemented**, not hard site failure.
- Standards-backed checks carry stronger normative weight than proposal-backed checks.
- `/llms.txt`, `/llms-full.txt`, `/llms-index.json`, and `humans.txt` are scored as readiness and trust surfaces unless the site declares them required architecture.
- A site can score highly overall while still having advisory gaps in optional surfaces.
- Joy, warmth, and shareability are **quality multipliers**, not blockers.

## Compliance classes

- **Standards Conformant**
- **Globally Legible**
- **Inter-Dimensionally Inclusive**
- **AI Legible**
- **Humanly Attributed**
- **Privacy Literate**
- **Reuse Clear**
- **Share Ready**
- **Joyful by Design**
- **New Internet Ready**

## Artifact surfaces to detect and score

- `/robots.txt`
- `/sitemap.xml`
- `/sitemap_index.xml`
- `/sitemap-main.xml`
- locale-specific sitemaps
- `/llms.txt`
- `/llms-full.txt`
- `/llms-index.json`
- `/humans.txt`
- `/security.txt`
- `/manifest.webmanifest`
- favicon and icon files
- Apple touch icons
- Open Graph images
- Twitter images
- logo assets
- privacy policy URLs
- terms URLs
- accessibility statement URLs
- data policy URLs
- licensing URLs
- RSS and Atom feeds
- OpenAPI specs
- `/api/docs`
- `/api/mcp`
- structured data blocks
- capability manifests
- changelogs and release notes
- provenance statements
- citation and evidence surfaces
- agent guardrail disclosures

---

# Weighted Suite Model

## Suite 1. HTTP Status, Reachability & Crawlability Integrity  
**Priority:** Critical  
**Weight:** 9%

### Purpose
Basic fetchability and protocol correctness for people, crawlers, validators, and AI agents.

### Sub-tests
- HTTP-200-PRIMARY
- HTTP-METHODS
- CONTENT-TYPE-VALIDITY
- UTF8-ENCODING
- CRAWLER-REACHABILITY
- ROBOTS-BASELINE
- TIMEOUT-RESILIENCE
- TLS-BASIC-INTEGRITY
- ERROR-PAGE-HYGIENE
- SOFT404-DETECTION
- AI-FETCH-PARITY

### Notes
Includes localized error handling quality and parity between browser fetches and agent fetches.

---

## Suite 2. Redirect, Canonical & URL Precision  
**Priority:** Critical  
**Weight:** 8%

### Sub-tests
- REDIRECT-CHAIN-LENGTH
- HTTPS-ENFORCEMENT
- HOST-CONSOLIDATION
- TRAILING-SLASH-CONSISTENCY
- CANONICAL-SELF-CONSISTENCY
- CANONICAL-REDIRECT-ALIGNMENT
- PARAMETER-NORMALIZATION
- DUPLICATE-PATH-COLLAPSE
- XDEFAULT-CANONICAL-ALIGNMENT
- AI-ENTRYPOINT-STABILITY

---

## Suite 3. Indexing Control, Exclusion & Search Visibility  
**Priority:** Critical  
**Weight:** 8%

### Sub-tests
- META-ROBOTS-CORRECTNESS
- XROBOTS-HEADER-CORRECTNESS
- NOINDEX-CANONICAL-CONSISTENCY
- ROBOTS-DISALLOW-SAFETY
- INDEXABLE-TEMPLATE-CHECK
- STAGING-LEAKAGE-DETECTION
- SEARCH-SNIPPET-ELIGIBILITY
- AI-DISCOVERY-BLOCKERS
- EMBED-AND-PREVIEW-ELIGIBILITY

---

## Suite 4. Sitemap, Inventory & Discoverability Graph  
**Priority:** High  
**Weight:** 8%

### Sub-tests
- SITEMAP-PRESENCE
- SITEMAP-PROTOCOL-VALIDITY
- SITEMAP-INDEX-DETECTION
- SITEMAP-MAIN-DETECTION
- SITEMAP-URL-COVERAGE
- SITEMAP-LASTMOD-QUALITY
- SITEMAP-ORPHAN-DETECTION
- SITEMAP-DEAD-URL-DETECTION
- SITEMAP-LOCALE-PARTITIONING
- SITEMAP-IMAGE-VIDEO-NEWS-EXTENSIONS
- SITEMAP-ROBOTS-DECLARATION
- SITEMAP-AI-CRAWL-UTILITY

---

## Suite 5. Multilingual, Multiscript & Global Reach Precision  
**Priority:** Critical  
**Weight:** 9%

### Sub-tests
- HREFLANG-MAP
- XDEFAULT-PRESENCE
- LANG-ATTRIBUTE-CORRECTNESS
- LOCALE-METADATA-CONSISTENCY
- TRANSLATION-COVERAGE
- TRANSLATION-DRIFT
- RTL-BIDI-FIDELITY
- CJK-INDIC-COMPLEX-SCRIPT-FIDELITY
- FONT-FALLBACK-SAFETY
- DATE-NUMBER-CURRENCY-LOCALIZATION
- REGION-APPROPRIATE-EXAMPLES
- SEARCH-DISCOVERABILITY-GLOBAL
- LANGUAGE-SWITCHER-USABILITY
- LOCALE-FALLBACK-BEHAVIOR
- MULTILINGUAL-READABILITY
- CULTURAL-LOCALIZATION

### Success target
- Structural compliance target: 100
- Experience compliance target: 95

---

## Suite 6. Accessibility & Inter-Dimensional Inclusivity  
**Priority:** Critical  
**Weight:** 12%

### Sub-tests
- WCAG-CORE
- COLOR-CONTRAST-GLOBAL
- ALT-TEXT-QUALITY
- MEDIA-ACCESSIBILITY
- ARIA-SEMANTICS
- KEYBOARD-MOTOR-FULL
- SCREEN-READER-COMPAT
- FORM-ACCESSIBILITY
- COGNITIVE-READABILITY
- MOTION-SENSITIVITY
- DEVICE-LOW-RESOURCE
- LANGUAGE-SCRIPT-DIRECTION
- VOICE-SEARCH-ASSISTANT
- FUTURE-DIMENSIONAL
- TOUCH-TARGET-SPACING
- ZOOM-REFLOW-ROBUSTNESS
- ERROR-RECOVERY-CLARITY
- ASSISTIVE-TECH-PARSING-ROBUSTNESS

---

## Suite 7. Semantic Meaning, Structured Data & Content Integrity  
**Priority:** High  
**Weight:** 8%

### Sub-tests
- TITLE-DESCRIPTION-QUALITY
- HEADING-INTENT-INTEGRITY
- MAIN-CONTENT-DETECTION
- NAV-FOOTER-REPETITION-REDUCTION
- ENTITY-CLARITY
- AUTHORSHIP-SIGNALING
- STRUCTURED-DATA-PRESENCE
- STRUCTURED-DATA-VALIDITY
- SPEAKABLE-AND-VOICE-ELIGIBILITY
- FAQ-HOWTO-ARTICLE-PATTERN-ACCURACY
- CONTENT-FRESHNESS-SIGNALING
- CLAIM-CONSISTENCY
- SUMMARIZABILITY
- AGENT-CONTEXT-EXTRACTABILITY
- E-E-A-T-SIGNALS
- CULTURAL-SENSITIVITY
- ORIGINALITY-QUALITY

---

## Suite 8. AI Discovery, Agent Legibility & LLM Interface Surfaces  
**Priority:** Critical  
**Weight:** 9%

### `/llms.txt`
- LLMS-PRESENCE
- LLMS-FETCHABILITY
- LLMS-FORMAT-VALIDITY
- LLMS-COVERAGE-MAP
- LLMS-CANONICAL-ALIGNMENT
- LLMS-CONTENT-UTILITY
- LLMS-FRESHNESS
- LLMS-SAFETY-BOUNDARIES
- LLMS-READABILITY
- LLMS-PATH-DISCOVERY

### `/llms-full.txt`
- LLMS-FULL-PRESENCE
- LLMS-FULL-FETCHABILITY
- LLMS-FULL-COVERAGE
- LLMS-FULL-CANONICAL-ALIGNMENT
- LLMS-FULL-CONTENT-UTILITY
- LLMS-FULL-SAFETY-BOUNDARIES
- LLMS-FULL-READABILITY

### `/llms-index.json`
- LLMS-INDEX-PRESENCE
- LLMS-INDEX-JSON-VALIDITY
- LLMS-INDEX-SCHEMA-CONSISTENCY
- LLMS-INDEX-REFERENCE-INTEGRITY
- LLMS-INDEX-CANONICAL-ALIGNMENT
- LLMS-INDEX-COVERAGE-COMPLETENESS
- LLMS-INDEX-CHANGE-FRESHNESS
- LLMS-INDEX-MACHINE-UTILITY
- LLMS-INDEX-SAFETY-BOUNDARIES

### Additional agent-facing surfaces
- API-DOCS-DISCOVERY
- MCP-ENDPOINT-DISCOVERY
- OPENAPI-PRESENCE
- ACTION-MANIFEST-PRESENCE
- AGENT-ENTRYPOINT-CONSISTENCY
- MACHINE-READABLE-CAPABILITY-DISCLOSURE
- AGENT-GUARDRAILS-DISCLOSURE

---

## Suite 9. Human Attribution, Stewardship & Trust Surfaces  
**Priority:** High  
**Weight:** 5%

### Sub-tests
- HUMANS-PRESENCE
- HUMANS-FETCHABILITY
- HUMANS-STRUCTURE
- HUMANS-AUTHENTICITY
- HUMANS-ATTRIBUTION-COVERAGE
- HUMANS-MULTILINGUAL-INCLUSION
- HUMANS-MAINTENANCE-FRESHNESS
- HUMANS-CONTACT-SAFETY
- HUMAN-STEWARDSHIP-SIGNALING
- GOVERNANCE-OR-MAINTAINER-DISCLOSURE
- SECURITY-TXT-PRESENCE
- SECURITY-TXT-VALIDITY
- SECURITY-CONTACT-USEFULNESS

---

## Suite 10. Privacy, Data Use, Consent & User Agency  
**Priority:** Critical  
**Weight:** 8%

### Sub-tests
- PRIVACY-POLICY-PRESENCE
- PRIVACY-POLICY-FETCHABILITY
- PRIVACY-POLICY-PLAINLANGUAGE
- DATA-COLLECTION-DISCLOSURE
- DATA-TYPE-DISCLOSURE
- PURPOSE-OF-PROCESSING-DISCLOSURE
- THIRD-PARTY-SHARING-DISCLOSURE
- RETENTION-DISCLOSURE
- USER-RIGHTS-DISCLOSURE
- CONTACT-FOR-PRIVACY-REQUESTS
- CONSENT-MECHANISM-CLARITY
- COOKIE-OR-TRACKING-DISCLOSURE
- SENSITIVE-DATA-DISCLOSURE
- CHILDREN-OR-MINOR-DATA-HANDLING
- AI-TRAINING-DATA-DISCLOSURE
- MODEL-INTERACTION-DISCLOSURE
- AUTOMATED-DECISIONING-DISCLOSURE
- DO-NOT-SELL-SHARE-SIGNALING
- DATA-EXPORT-DELETION-REQUEST-SUPPORT
- PRIVACY-METADATA-MACHINE-LEGIBILITY
- DATA-EXISTENCE-INVENTORY
- DATA-FLOW-MAP
- DATA-STORAGE-LOCATION-DISCLOSURE
- DATA-PROCESSOR-INVENTORY
- TELEMETRY-AND-LOGGING-DISCLOSURE
- EMBEDDINGS-VECTORS-AND-DERIVED-DATA-DISCLOSURE
- BACKUP-AND-DELETION-REALISM

---

## Suite 11. Licensing, Reuse, Attribution & Rights Clarity  
**Priority:** High  
**Weight:** 4%

### Sub-tests
- LICENSE-PRESENCE
- LICENSE-FETCHABILITY
- COPYRIGHT-NOTICE-PRESENCE
- CONTENT-LICENSE-CLARITY
- CODE-LICENSE-CLARITY
- MEDIA-ASSET-LICENSE-CLARITY
- API-TERMS-CLARITY
- USER-GENERATED-CONTENT-RIGHTS-CLARITY
- ATTRIBUTION-REQUIREMENTS-CLARITY
- COMMERCIAL-USE-CLARITY
- AI-TRAINING-USE-CLARITY
- AI-SUMMARIZATION-USE-CLARITY
- ROBOTS-VS-LICENSE-CONSISTENCY
- REUSE-METADATA-MACHINE-LEGIBILITY

---

## Suite 12. Performance, Resilience & Low-Resource Reality  
**Priority:** High  
**Weight:** 4%

### Sub-tests
- CORE-ASSET-BUDGET
- JS-DEPENDENCY-CRITICALITY
- NO-JS-DEGRADATION
- OFFLINE-READINESS
- DATA-SAVER-RESPECT
- MOBILE-EXTREME-CONDITIONS
- HIGH-LATENCY-TOLERANCE
- FAILURE-MODE-GRACEFULNESS
- CONTENT-FIRST-RENDER
- TEXT-FIRST-SURVIVABILITY
- SUSTAINABILITY-SIGNALING
- CARBON-AWARE-CLARITY

---

## Suite 13. Asset, Identity & Shareability Surfaces  
**Priority:** High  
**Weight:** 4%

### Purpose
This suite validates whether site identity and public-sharing assets exist, are correctly typed, sized, linked, and coherent across platforms.

### Sub-tests
- FAVICON-PRESENCE
- FAVICON-FORMAT-VALIDITY
- FAVICON-SIZE-VALIDITY
- APP-ICON-PRESENCE
- APPLE-TOUCH-ICON-PRESENCE
- APPLE-TOUCH-ICON-SIZE-VALIDITY
- MANIFEST-PRESENCE
- MANIFEST-ICON-COVERAGE
- MANIFEST-NAME-CONSISTENCY
- BRAND-LOGO-PRESENCE
- BRAND-LOGO-FORMAT-VALIDITY
- OG-TAGS-PRESENCE
- OG-IMAGE-PRESENCE
- OG-IMAGE-DIMENSION-VALIDITY
- OG-IMAGE-ASPECT-QUALITY
- TWITTER-CARD-PRESENCE
- TWITTER-IMAGE-PRESENCE
- TWITTER-IMAGE-DIMENSION-VALIDITY
- BROWSER-THEME-COLOR-PRESENCE
- SOCIAL-TITLE-CONSISTENCY
- SOCIAL-DESCRIPTION-CONSISTENCY
- SHARE-URL-CANONICAL-CONSISTENCY
- PUBLIC-ASSET-FETCHABILITY
- ASSET-MIME-CORRECTNESS
- ASSET-CACHEABILITY
- ASSET-BRANDING-COHERENCE
- RSS-BRAND-COHERENCE

---

## Suite 14. Joy, Clarity & Human Warmth  
**Priority:** Advisory  
**Weight:** 4%

### Purpose
This suite rewards clarity, approachability, emotional confidence, delight, and the ease with which a page can be understood, trusted, and shared.

### Sub-tests
- HERO-CLARITY
- CTA-CLARITY
- NAVIGATION-CALMNESS
- COPY-WARMTH
- VISUAL-COHERENCE
- SHAREABILITY-CUES
- TRUST-CUE-DENSITY
- DELIGHT-WITHOUT-FRICTION
- LEARNING-CURVE-GENTLENESS
- FIRST-IMPRESSION-CONFIDENCE
- ONBOARDING-EXPLAINABILITY
- EMOTIONAL-TONE-CONSISTENCY
- BRAND-JOY-SIGNAL
- HUMAN-CENTERED-MICROCOPY
- FUN-WITHOUT-CONFUSION

---

## Weight summary

| Suite | Weight |
|---|---:|
| 1. HTTP Status, Reachability & Crawlability Integrity | 9 |
| 2. Redirect, Canonical & URL Precision | 8 |
| 3. Indexing Control, Exclusion & Search Visibility | 8 |
| 4. Sitemap, Inventory & Discoverability Graph | 8 |
| 5. Multilingual, Multiscript & Global Reach Precision | 9 |
| 6. Accessibility & Inter-Dimensional Inclusivity | 12 |
| 7. Semantic Meaning, Structured Data & Content Integrity | 8 |
| 8. AI Discovery, Agent Legibility & LLM Interface Surfaces | 9 |
| 9. Human Attribution, Stewardship & Trust Surfaces | 5 |
| 10. Privacy, Data Use, Consent & User Agency | 8 |
| 11. Licensing, Reuse, Attribution & Rights Clarity | 4 |
| 12. Performance, Resilience & Low-Resource Reality | 4 |
| 13. Asset, Identity & Shareability Surfaces | 4 |
| 14. Joy, Clarity & Human Warmth | 4 |
| **Total** | **100** |

## Badge rules

- **New Internet Ready**: overall score ≥ 95 and no critical suite under 85
- **AI Legible**: Suite 8 ≥ 90
- **Humanly Attributed**: Suite 9 ≥ 85
- **Privacy Literate**: Suite 10 ≥ 90
- **Share Ready**: Suite 13 ≥ 90
- **Joyful by Design**: Suite 14 ≥ 85
- **Inter-Dimensionally Inclusive**: Suite 6 ≥ 95
- **Globally Legible**: Suite 5 ≥ 90

## Advisory remediation language

Suggested wording pattern for all outputs:

> This framework is diagnostic and advisory.  
> Standards-aligned checks highlight conformance-related issues.  
> Proposal-based and readiness checks highlight discoverability, interpretability, trust, and future compatibility opportunities.

## Recommended implementation bundle

1. Full normative framework document  
2. Machine-readable scoring schema  
3. Gherkin/Cucumber scenarios for every suite  
4. OpenAPI schema for scoring results  
5. JSON Schema for artifacts such as `/llms-index.json`  
6. Reference implementation checklist  
7. Badge issuance rules  
8. Advisory remediation language library  
9. Next.js 16 reference audit package  
10. Rendered-browser validation layer for v1.1
