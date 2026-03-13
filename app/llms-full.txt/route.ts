import { NextResponse } from 'next/server'
import { sql, DEFAULT_TENANT_ID, Document, Category } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function getBaseUrl(): Promise<string> {
  try {
    const result = await sql`SELECT value FROM settings WHERE tenant_id = ${DEFAULT_TENANT_ID} AND key = 'base_url'`
    if (result[0]?.value) return JSON.parse(result[0].value as string)
  } catch { /* ignore */ }
  return 'https://docs.platphormnews.com'
}

export async function GET() {
  const baseUrl = await getBaseUrl()
  
  let documents: (Document & { emoji_summary?: string })[] = []
  let categories: Category[] = []
  
  try {
    documents = await sql`
      SELECT slug, title, description, category, tags, author_name, source_identifier, published_at, content, emoji_summary
      FROM documents
      WHERE tenant_id = ${DEFAULT_TENANT_ID} AND deleted_at IS NULL AND status = 'published'
      ORDER BY category, title
    ` as (Document & { emoji_summary?: string })[]
    
    categories = await sql`
      SELECT slug, name, description FROM categories
      WHERE tenant_id = ${DEFAULT_TENANT_ID}
      ORDER BY order_index, name
    ` as Category[]
  } catch (error) {
    console.error('Error fetching documents for llms-full.txt:', error)
  }

  let content = `# OpenDocs - Full Documentation Index for LLMs

> AI-native documentation platform with MCP integration
> This file contains complete documentation for AI consumption
> Source: ${baseUrl}

Generated: ${new Date().toISOString()}
Documents: ${documents.length}
Categories: ${categories.length}

---

## Quick Reference

### Base URL
${baseUrl}

### MCP Endpoint
POST ${baseUrl}/api/mcp

### REST API
${baseUrl}/api/v1

---

## Categories

${categories.map(cat => `### ${cat.name}
Slug: ${cat.slug}
${cat.description || 'Documentation category'}
URL: ${baseUrl}/docs/category/${cat.slug}
`).join('\n')}

---

## Complete Document Index

`

  // Group documents by category
  const grouped: Record<string, (Document & { emoji_summary?: string })[]> = {}
  for (const doc of documents) {
    const cat = doc.category || 'uncategorized'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(doc)
  }

  for (const [category, docs] of Object.entries(grouped)) {
    content += `\n### ${category.toUpperCase()}\n\n`
    
    for (const doc of docs) {
      content += `#### ${doc.emoji_summary || ''} ${doc.title}

URL: ${baseUrl}/docs/${doc.slug}
Slug: ${doc.slug}
${doc.description ? `Description: ${doc.description}` : ''}
${doc.author_name ? `Author: ${doc.author_name}` : ''}
${doc.source_identifier ? `Source: ${doc.source_identifier}` : ''}
${doc.tags && doc.tags.length > 0 ? `Tags: ${doc.tags.join(', ')}` : ''}
${doc.published_at ? `Published: ${new Date(doc.published_at).toISOString().split('T')[0]}` : ''}

Content:
\`\`\`markdown
${doc.content.slice(0, 3000)}${doc.content.length > 3000 ? '\n... [truncated - full content at URL]' : ''}
\`\`\`

---

`
    }
  }

  content += `
## API Reference

### Authentication
Bearer token authentication for write operations:
\`Authorization: Bearer od_your_api_key_here\`

Read operations are public.

### Endpoints

#### Documents
- GET  ${baseUrl}/api/v1/documents - List documents (paginated)
- POST ${baseUrl}/api/v1/documents - Create document (auth)
- GET  ${baseUrl}/api/v1/documents/{slug} - Get document
- PUT  ${baseUrl}/api/v1/documents/{slug} - Update document (auth)
- DELETE ${baseUrl}/api/v1/documents/{slug} - Delete document (auth)

#### Submissions (No Auth Required)
- POST ${baseUrl}/api/v1/submissions - Submit content for review
- GET  ${baseUrl}/api/v1/submissions/{id} - Check submission status

#### Search
- GET ${baseUrl}/api/v1/search?q={query} - Full-text search
- GET ${baseUrl}/api/v1/search?q={query}&category={cat} - Search with filter

#### URL Ingestion
- POST ${baseUrl}/api/v1/ingest - Ingest content from URL
  Body: { "url": "https://...", "category": "guides", "auto_publish": false }

#### Automation
- POST ${baseUrl}/api/v1/automation - Batch operations
  Actions: batch_seo, batch_index, batch_publish, workflow_ingest, generate_emoji_summaries
- GET  ${baseUrl}/api/v1/automation?action=stats - Get statistics

#### Workflow
- POST ${baseUrl}/api/v1/workflow - Execute workflows
  Workflows: content_pipeline, batch_import, seo_refresh, content_enhance, cross_post, mcp_sync

### MCP Protocol

Endpoint: POST ${baseUrl}/api/mcp
Protocol: JSON-RPC 2.0

#### Available Tools
- list_documents - List and filter documents
- get_document - Get document by slug
- create_document - Create new document
- update_document - Update existing document
- delete_document - Delete document
- search_documents - Full-text search
- submit_content - Submit content for review
- list_categories - List all categories
- ingest_url - Ingest content from URL
- get_stats - Get platform statistics
- batch_operation - Run batch operations
- generate_share_links - Generate social share links
- get_emoji_for_content - Get emoji summary for text

#### Available Resources
- docs://all - All published documents
- docs://{slug} - Specific document
- docs://categories - All categories
- docs://recent - Recently published (last 20)
- docs://stats - Platform statistics

#### Available Prompts
- explain_doc - Explain a document in simple terms
- summarize_category - Summarize all docs in a category
- compare_docs - Compare two documents
- suggest_related - Suggest related documents

### Example Requests

#### cURL: List Documents
\`\`\`bash
curl "${baseUrl}/api/v1/documents?page=1&per_page=10"
\`\`\`

#### cURL: Submit Content
\`\`\`bash
curl -X POST ${baseUrl}/api/v1/submissions \\
  -H "Content-Type: application/json" \\
  -d '{
    "source_url": "https://example.com/my-post",
    "title": "My Article",
    "content": "# Content here...",
    "author_name": "Author Name",
    "tags": ["topic1", "topic2"],
    "category": "guides"
  }'
\`\`\`

#### cURL: MCP Tool Call
\`\`\`bash
curl -X POST ${baseUrl}/api/mcp \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "search_documents",
      "arguments": { "query": "getting started", "limit": 5 }
    }
  }'
\`\`\`

---

## Platphorm News Ecosystem

This platform integrates with the Platphorm News ecosystem:
- MCP Hub: https://mcp.platphormnews.com
- Emoji API: https://emoji.platphormnews.com
- SVG API: https://svg.platphormnews.com
- JSON API: https://json.platphormnews.com
- XML API: https://xml.platphormnews.com
- Calendar: https://calendar.platphormnews.com
- Kanban: https://kanban.platphormnews.com

---

## Discovery Files

- ${baseUrl}/llms.txt - Summary for LLMs
- ${baseUrl}/llms-full.txt - This file (complete index)
- ${baseUrl}/llms-index.json - JSON structured index
- ${baseUrl}/sitemap.xml - Sitemap for crawlers
- ${baseUrl}/rss.xml - RSS feed
- ${baseUrl}/robots.txt - Crawler instructions
- ${baseUrl}/api/docs - OpenAPI specification

---

End of documentation index.
Last updated: ${new Date().toISOString()}
`

  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=1800',
    },
  })
}
