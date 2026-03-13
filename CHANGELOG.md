# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-03-05

### Added

**Core Platform**
- Document CRUD API with versioning
- Full-text search powered by PostgreSQL tsvector
- Category management with hierarchical support
- Multi-source content submissions
- URL ingestion with HTML-to-Markdown conversion

**MCP Integration**
- JSON-RPC 2.0 server at `/api/mcp`
- 15 tools: list_documents, get_document, create_document, update_document, delete_document, search_documents, submit_content, ingest_url, list_categories, get_stats, generate_seo, get_emoji_summary, trigger_workflow, bulk_import, generate_share_card
- MCP resources: docs://all, docs://{slug}, docs://categories, docs://recent
- Registration endpoint for MCP hub discovery

**AI Discovery**
- `/llms.txt` - Concise LLM discovery file
- `/llms-full.txt` - Complete documentation for AI agents
- `/llms-index.json` - Structured JSON index

**SEO & Sharing**
- Dynamic OG image generation
- Auto-generated meta tags and descriptions
- JSON-LD structured data
- Twitter card support
- Canonical URLs
- Reading time and word count

**Accessibility**
- WCAG 2.2 Level AAA compliance
- High-contrast light mode
- High-contrast dark mode
- Keyboard navigation throughout
- Screen reader optimization
- Skip-to-content links
- Focus management
- Reduced motion support

**Internationalization**
- 10 languages: en, es, fr, de, ja, zh, pt, ar, ru, ko
- RTL support for Arabic
- Locale-aware formatting

**Session Management**
- JA4+ fingerprinting for persistence
- Draft saving without authentication
- Preference storage
- Locale persistence

**Automation**
- Webhook endpoints with delivery tracking
- Exponential backoff retry
- Workflow triggers for n8n/Zapier
- Bulk operations API

**Integrations**
- emoji.platphormnews.com
- mcp.platphormnews.com
- svg.platphormnews.com
- json.platphormnews.com
- xml.platphormnews.com
- calendar.platphormnews.com
- kanban.platphormnews.com

**Discovery & SEO**
- Dynamic sitemap.xml
- RSS feed
- robots.txt
- manifest.json for PWA

**UI Components**
- Accessible theme switcher with spectrum selector
- Share buttons with copy-to-clipboard
- Markdown renderer with syntax highlighting
- Code blocks with copy functionality
- Responsive docs layout
- Mobile-first design

### Technical Details

**Stack**
- Next.js 16 with App Router
- React 19 with Server Components
- TypeScript 5.x strict mode
- Tailwind CSS 4.x
- shadcn/ui components
- Neon serverless PostgreSQL

**Database Tables**
- tenants, documents, document_versions
- categories, submissions
- sessions, api_keys, mcp_sessions
- settings, integrations
- webhook_endpoints, webhook_deliveries
- search_index, audit_logs

---

## [Unreleased]

### Planned for v1.1
- Comprehensive test suite
- CI/CD pipeline
- Rate limiting with Redis
- SDK generation
