import { NextResponse } from 'next/server'
import { sql, DEFAULT_TENANT_ID } from '@/lib/db'
import {
  SITE_NAME,
  SITE_DESCRIPTION,
  BASE_URL as DEFAULT_BASE_URL,
  API_KEY_PREFIX,
  SERVICE_NAME,
} from '@/lib/site-config'

export const dynamic = 'force-dynamic'

async function getBaseUrl(): Promise<string> {
  try {
    const result = await sql`SELECT value FROM settings WHERE tenant_id = ${DEFAULT_TENANT_ID} AND key = 'base_url'`
    if (result[0]?.value) return JSON.parse(result[0].value as string)
  } catch { /* ignore */ }
  return DEFAULT_BASE_URL
}

export async function GET() {
  const baseUrl = await getBaseUrl()
  
  const llmsTxt = `# ${SITE_NAME} - MCP-Enabled Documentation Platform

> ${SITE_DESCRIPTION}

## Overview

${SITE_NAME} is a production-ready documentation platform designed for AI agents and humans alike. It provides:
- **Full MCP Protocol Support** - Tools, resources, prompts for AI agents
- **Auto-Generated SEO** - OG tags, Twitter cards, JSON-LD structured data
- **Session Persistence** - JA4+ fingerprinting, draft auto-save
- **Emoji Support** - Unicode emojis and shortcodes throughout
- **Multi-Source Ingestion** - Accept content from any URL

## Quick Start

### MCP Connection
\`\`\`json
{
  "mcpServers": {
    "${SERVICE_NAME}": {
      "url": "${baseUrl}/api/mcp"
    }
  }
}
\`\`\`

### REST API
\`\`\`bash
# List documents
curl ${baseUrl}/api/v1/documents

# Search
curl "${baseUrl}/api/v1/search?q=getting+started"

# Submit content
curl -X POST ${baseUrl}/api/v1/submissions \\
  -H "Content-Type: application/json" \\
  -d '{"source_url":"https://example.com","title":"My Doc","content":"# Hello"}'
\`\`\`

## MCP Tools (26 Available)

### Document Operations
- \`list_documents\` - List with filtering, search, pagination
- \`get_document\` - Full doc with TOC, share links, metadata
- \`create_document\` - Create with auto SEO generation
- \`update_document\` - Update with SEO regeneration
- \`delete_document\` - Soft or permanent delete

### Search & Discovery
- \`search\` - Full-text with highlighting and facets
- \`list_categories\` - All categories with counts
- \`get_related_docs\` - Find similar content

### Submission & Ingestion
- \`submit_content\` - Submit for review
- \`ingest_url\` - Fetch and convert URL to doc

### Emoji Integration
- \`get_emoji\` - Search emojis via emoji.platphormnews.com
- \`add_emoji_to_doc\` - Add emoji summary to document

### Workflow & Automation
- \`bulk_import\` - Import multiple docs at once
- \`regenerate_seo\` - Regenerate SEO for doc(s)
- \`export_docs\` - Export as JSON/Markdown/HTML
- \`get_stats\` - Documentation statistics
- \`trigger_webhook\` - Manually trigger webhooks
- \`list_integrations\` - View configured integrations
- \`call_integration\` - Call other MCP servers

### Utilities
- \`parse_markdown\` - Convert MD to HTML with emoji
- \`generate_share_links\` - Get social share URLs

## MCP Resources

- \`docs://index\` - Full documentation index
- \`docs://categories\` - All categories
- \`docs://recent\` - Recently updated
- \`docs://popular\` - Most viewed
- \`docs://tags\` - All tags with counts
- \`docs://stats\` - Platform statistics
- \`docs://sitemap\` - Sitemap data
- \`docs://llms\` - LLM-optimized index

## MCP Prompts

- \`explain_doc\` - Explain document simply
- \`summarize_category\` - Summarize category
- \`compare_docs\` - Compare two documents
- \`generate_faq\` - Generate FAQ from content
- \`translate_doc\` - Translate to language
- \`improve_seo\` - SEO improvement suggestions

## API Endpoints

### Documents
- \`GET /api/v1/documents\` - List (search, filter, paginate)
- \`POST /api/v1/documents\` - Create (API key required)
- \`GET /api/v1/documents/{slug}\` - Get document
- \`PUT /api/v1/documents/{slug}\` - Update (API key)
- \`DELETE /api/v1/documents/{slug}\` - Delete (API key)

### Submissions
- \`POST /api/v1/submissions\` - Submit content (open)
- \`GET /api/v1/submissions\` - List (API key)
- \`POST /api/v1/ingest\` - Ingest from URL

### Search & Categories
- \`GET /api/v1/search?q={query}\` - Full-text search
- \`GET /api/v1/categories\` - List categories

### Session & Fingerprinting
- \`GET /api/session\` - Get/create session
- \`POST /api/session\` - Save drafts, preferences

### OG Image Generation
- \`GET /api/og?title=...&emoji=...\` - Generate share image

## Auto-Generated Features

Every document automatically gets:
- OG title, description, image
- Twitter card meta tags
- JSON-LD structured data
- Canonical URL
- Reading time & word count
- Emoji summary
- Keywords extraction
- Social share links

## Authentication

Bearer token for protected endpoints:
\`\`\`
Authorization: Bearer ${API_KEY_PREFIX}your_api_key
\`\`\`

Bootstrap first key (only if none exist):
\`\`\`bash
curl -X PUT ${baseUrl}/api/v1/keys -d '{"name":"Admin"}'
\`\`\`

## Related Resources

- [Full LLM Context](${baseUrl}/llms-full.txt) - Complete doc index
- [LLM Index JSON](${baseUrl}/llms-index.json) - Machine-readable
- [API Docs](${baseUrl}/docs/api) - Interactive reference
- [MCP Guide](${baseUrl}/docs/mcp) - MCP integration

## External Integrations

- Emoji MCP: https://emoji.platphormnews.com/api/mcp
- Calendar, Kanban integrations available

---
${SITE_NAME} v2.0.0 | MCP Protocol 2024-11-05
`

  return new NextResponse(llmsTxt, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
