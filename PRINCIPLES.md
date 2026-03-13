# Platphorm News Network — Principles

> **Version:** 1.0 — March 2026  
> **Owner:** Michael Barbine, Platphorm News Network  
> **Live:** https://polymarkets.platphormnews.com

---

## Why We Exist

The world runs on predictions. Markets are conversations about the future.  
**Platphorm News Network** exists to surface those conversations — clearly, openly, and without gatekeeping — so that anyone, human or AI, can understand what the world actually believes will happen next.

We build infrastructure for forecasting intelligence: feeds, APIs, MCP servers, and interfaces that make prediction market data as accessible as the weather.

---

## Our Principles

### 1. Open by Default

Every piece of data we serve is machine-readable first.  
- RSS 2.0, Atom 1.0, JSON Feed 1.1 — all free, no key required  
- MCP tools — open to any compliant AI agent  
- Docs — this file, ARCHITECTURE.md, API.md — all public, all versioned  

We believe open data compounds. A feed read by one agent today becomes context for ten thousand decisions tomorrow.

### 2. Standards First, Always

We follow and implement web standards because they outlive every framework.

| Standard | Applies to |
|---|---|
| RSS 2.0 (Harvard, 2009) | Feed format |
| Atom 1.0 (RFC 4287) | Feed format |
| JSON Feed 1.1 | Feed format |
| JSON-LD + Schema.org | Structured data / AEO |
| MCP 2024-11-05 | AI agent protocol |
| Unicode 15.1+ | All text and emoji |
| W3C WCAG 2.2 AA | Accessibility |
| W3C CSS Color Level 5 | Visual design tokens |
| W3C Navigation Timing 2 | Performance |
| OpenGraph Protocol | Social sharing |
| robots.txt + llms.txt | Crawlers and LLMs |
| HTTP/2, Brotli | Transport |

When a draft W3C standard matures we adopt it early. We do not wait for ecosystem pressure.

### 3. Emoji as Data, Not Decoration

Emoji are Unicode characters. We treat them with the same rigor as any other character:
- All emoji reference [Unicode CLDR](https://cldr.unicode.org/) names and sequences
- Skin tone, gender, and ZWJ sequences are fully supported
- Emoji in API responses carry their Unicode codepoint alongside the rendered glyph
- No proprietary shortcodes. `:fire:` is `U+1F525 🔥`
- We track [Unicode releases](https://unicode.org/versions/) and ship new characters within 30 days of standard publication
- Emoji served via https://emoji.platphormnews.com follow the MCP tool protocol, making them queryable by AI agents

### 4. AI-Native Architecture

We build for AI agents as primary consumers, humans as secondary.  
- Every data response carries enough context to be interpreted without prior knowledge  
- MCP tools follow the JSON-RPC 2.0 spec exactly — no proprietary extensions  
- Responses include `as_of` timestamps so agents can reason about staleness  
- llms.txt, humans.txt, and structured sitemap.xml are all maintained  
- We publish AEO (Answer Engine Optimization) metadata on every page  

### 5. Prediction Markets are Public Goods

Polymarket, Kalshi, Manifold, and their successors aggregate genuine human forecasting. This information should be as available as stock prices or weather data. We do not paywalled, we do not rate-limit researchers, and we credit source data clearly.

### 6. Speed is a Feature

Every millisecond of latency is a failure mode.  
- L1: in-memory cache (hot paths, TTL 5 min)  
- L2: Neon PostgreSQL edge cache  
- L3: Vercel Edge CDN  
- Target: p95 feed response < 150ms globally  

We measure, we instrument, we optimize. Slow is broken.

### 7. Correctness Over Completeness

We would rather return three accurate markets than fifty noisy ones.  
- All prices normalized through `normalizeMarket()` before serving  
- CLOB real-time prices override Gamma API estimates when available  
- Unknown categories never silently swallowed — they surface in `get_categories`  
- Errors return structured JSON-RPC error objects, never HTML 500 pages  

### 8. Developer Experience is User Experience

If a developer can't understand our API in five minutes, our API is wrong.  
- Every route documented in API.md  
- Every MCP tool has a description readable by both humans and LLMs  
- `GET /api/mcp` returns the full manifest — no registration required  
- All docs available at `/api/docs/:document` — live, not a stale PDF  

### 9. Privacy by Architecture

We do not collect user data we don't need. We don't need much.  
- No third-party analytics scripts  
- Vercel Analytics: aggregate page view counts only  
- MCP sessions: ephemeral, not persisted beyond TTL  
- No cookies without consent. No fingerprinting. No tracking pixels.  

### 10. Iterate in Public

This platform is a living codebase. Our roadmap (IMPLEMENTATION_PLAN.md), architecture (ARCHITECTURE.md), and changelog (CHANGELOG.md) are in the public repo.  

We ship M1 before we plan M2 perfectly. We commit often. We break things in development, never in production.

---

## What We Are Not

- **Not a trading platform.** We surface data. We do not execute trades.  
- **Not a financial advisor.** Prediction market prices are probabilities, not investment advice.  
- **Not extractive.** We credit Polymarket, Kalshi, Manifold, and other sources explicitly.  
- **Not opaque.** Our architecture, decisions, and tradeoffs are documented and public.

---

## Network Properties

| Property | Value |
|---|---|
| Brand | Platphorm News Network |
| Primary domain | polymarkets.platphormnews.com |
| Feed subdomains | xml.platphormnews.com · json.platphormnews.com |
| Emoji service | emoji.platphormnews.com |
| Protocol | MCP 2024-11-05, HTTP/2, JSON-RPC 2.0 |
| Data source | Polymarket Gamma API + CLOB API |
| Infrastructure | Vercel + Neon PostgreSQL |
| License | MIT |

---

## Revision Policy

This document is versioned in git. Amendments require a PR with rationale.  
Principles do not change for convenience — they change when we learn something fundamental.

*Last revised: March 2026*
