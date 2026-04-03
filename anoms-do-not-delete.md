import { NextRequest, NextResponse } from 'next/server'
import { sql, DEFAULT_TENANT_ID, Document } from '@/lib/db'
import { generateSEOMetadata, updateDocumentSEO } from '@/lib/seo-generator'
import { parseMarkdown, processEmoji, extractTableOfContents } from '@/lib/markdown'
import crypto from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

interface MCPRequest {
  jsonrpc: '2.0'
  id: string | number
  method: string
  params?: Record<string, unknown>
}

interface MCPResponse {
  jsonrpc: '2.0'
  id: string | number
  result?: unknown
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

// Supercharged MCP Tools - comprehensive automation suite
const MCP_TOOLS = [
  // Document Operations
  {
    name: 'list_documents',
    description: 'List published docs with filtering, search, and pagination. Returns title, slug, emoji summary, reading time.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Filter by category slug' },
        search: { type: 'string', description: 'Full-text search query' },
        tag: { type: 'string', description: 'Filter by tag' },
        limit: { type: 'number', description: 'Max results (default 20, max 100)' },
        offset: { type: 'number', description: 'Pagination offset' },
        sort: { type: 'string', enum: ['recent', 'popular', 'alphabetical'], description: 'Sort order' },
      },
    },
  },
  {
    name: 'get_document',
    description: 'Get full document with content, SEO metadata, table of contents, share links',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Document slug (required)' },
        format: { type: 'string', enum: ['full', 'summary', 'toc', 'metadata'], description: 'Response format' },
      },
      required: ['slug'],
    },
  },
  {
    name: 'create_document',
    description: 'Create new document with auto-generated SEO, emoji summary, and search indexing',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Document title (required)' },
        content: { type: 'string', description: 'Markdown content (required)' },
        description: { type: 'string', description: 'Short description' },
        category: { type: 'string', description: 'Category slug' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags array' },
        source_url: { type: 'string', description: 'Original source URL' },
        author_name: { type: 'string', description: 'Author name' },
        target_audience: { type: 'string', description: 'Target audience (e.g., developers, beginners)' },
        status: { type: 'string', enum: ['draft', 'published'], description: 'Initial status' },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'update_document',
    description: 'Update existing document, auto-regenerates SEO and search index',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Document slug (required)' },
        title: { type: 'string' },
        content: { type: 'string' },
        description: { type: 'string' },
        category: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        status: { type: 'string', enum: ['draft', 'published', 'archived'] },
      },
      required: ['slug'],
    },
  },
  {
    name: 'delete_document',
    description: 'Soft delete a document (can be restored)',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Document slug (required)' },
        permanent: { type: 'boolean', description: 'Permanent delete (default false)' },
      },
      required: ['slug'],
    },
  },

  // Search & Discovery
  {
    name: 'search',
    description: 'Powerful full-text search with highlighting, facets, and relevance scoring',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query (required)' },
        categories: { type: 'array', items: { type: 'string' }, description: 'Filter categories' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Filter tags' },
        limit: { type: 'number', description: 'Max results (default 10)' },
        highlight: { type: 'boolean', description: 'Include highlighted excerpts (default true)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'list_categories',
    description: 'Get all categories with document counts and metadata',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_related_docs',
    description: 'Find related documents based on content similarity, tags, and category',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Source document slug (required)' },
        limit: { type: 'number', description: 'Max related docs (default 5)' },
      },
      required: ['slug'],
    },
  },

  // Submission & Ingestion
  {
    name: 'submit_content',
    description: 'Submit content from external sources for review with full metadata tracking',
    inputSchema: {
      type: 'object',
      properties: {
        source_url: { type: 'string', description: 'Original content URL (required)' },
        title: { type: 'string', description: 'Document title (required)' },
        content: { type: 'string', description: 'Markdown content (required)' },
        description: { type: 'string', description: 'Short description' },
        category: { type: 'string', description: 'Suggested category' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Suggested tags' },
        author_name: { type: 'string', description: 'Author name' },
        author_email: { type: 'string', description: 'Author email' },
        target_audience: { type: 'string', description: 'Target audience' },
        metadata: { type: 'object', description: 'Additional metadata' },
      },
      required: ['source_url', 'title', 'content'],
    },
  },
  {
    name: 'ingest_url',
    description: 'Fetch and ingest content from a URL, auto-convert HTML to markdown',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to ingest (required)' },
        category: { type: 'string', description: 'Category for the document' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags to apply' },
        auto_publish: { type: 'boolean', description: 'Auto-publish after ingestion (default false)' },
      },
      required: ['url'],
    },
  },

  // Emoji Integration (via emoji.platphormnews.com)
  {
    name: 'get_emoji',
    description: 'Get emoji by name, category, or search. Leverages emoji.platphormnews.com MCP',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Emoji search query or shortcode' },
        category: { type: 'string', description: 'Emoji category (smileys, animals, food, etc.)' },
        limit: { type: 'number', description: 'Max results (default 10)' },
      },
    },
  },
  {
    name: 'add_emoji_to_doc',
    description: 'Add or update emoji summary for a document',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Document slug (required)' },
        emoji_summary: { type: 'string', description: 'Emoji string (e.g., "🚀📖✨")' },
      },
      required: ['slug'],
    },
  },

  // Workflow & Automation
  {
    name: 'bulk_import',
    description: 'Import multiple documents at once from JSON array',
    inputSchema: {
      type: 'object',
      properties: {
        documents: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              content: { type: 'string' },
              category: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' } },
            },
          },
          description: 'Array of documents to import (required)',
        },
        source_identifier: { type: 'string', description: 'Source identifier for all docs' },
        auto_publish: { type: 'boolean', description: 'Auto-publish all docs' },
      },
      required: ['documents'],
    },
  },
  {
    name: 'regenerate_seo',
    description: 'Regenerate SEO metadata, share cards, and search index for document(s)',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Document slug (or "all" for all docs)' },
      },
      required: ['slug'],
    },
  },
  {
    name: 'export_docs',
    description: 'Export documents in various formats (JSON, markdown, HTML)',
    inputSchema: {
      type: 'object',
      properties: {
        format: { type: 'string', enum: ['json', 'markdown', 'html'], description: 'Export format' },
        category: { type: 'string', description: 'Filter by category' },
        include_drafts: { type: 'boolean', description: 'Include draft documents' },
      },
    },
  },
  {
    name: 'get_stats',
    description: 'Get documentation statistics and analytics',
    inputSchema: { type: 'object', properties: {} },
  },

  // Integration & Workflow
  {
    name: 'trigger_webhook',
    description: 'Manually trigger webhooks for an event',
    inputSchema: {
      type: 'object',
      properties: {
        event: { type: 'string', enum: ['document.created', 'document.updated', 'submission.created'], description: 'Event type' },
        slug: { type: 'string', description: 'Related document slug' },
      },
      required: ['event'],
    },
  },
  {
    name: 'list_integrations',
    description: 'List all configured integrations (calendar, kanban, emoji, etc.)',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'call_integration',
    description: 'Call another MCP integration (e.g., calendar, kanban, emoji)',
    inputSchema: {
      type: 'object',
      properties: {
        integration: { type: 'string', description: 'Integration name (required)' },
        method: { type: 'string', description: 'MCP method to call (required)' },
        params: { type: 'object', description: 'Method parameters' },
      },
      required: ['integration', 'method'],
    },
  },

  // Utilities
  {
    name: 'parse_markdown',
    description: 'Parse markdown to HTML with emoji processing, returns TOC',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Markdown content (required)' },
        enable_emoji: { type: 'boolean', description: 'Process emoji shortcodes (default true)' },
      },
      required: ['content'],
    },
  },
  {
    name: 'generate_share_links',
    description: 'Generate social share links for a document',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Document slug (required)' },
      },
      required: ['slug'],
    },
  },

  // Project Documentation (static root MD files — no auth required)
  {
    name: 'list_project_docs',
    description: 'List all static project documentation files (README, ARCHITECTURE, API, DESIGN, etc.) served publicly via /api/v1/docs. No authentication required.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Filter by category (overview, technical, api, features, compliance, ecosystem, integrations, guides, planning, development, community, releases, security, design)' },
      },
    },
  },
  {
    name: 'get_project_doc',
    description: 'Fetch the content of a static project documentation file by slug (e.g. readme, architecture, api, design, coding, platform). Publicly accessible — no auth needed.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Doc slug: readme | architecture | api | features | standards | ecosystem | integrations | use-cases | roadmap | testing | contributing | changelog | security | support | code-of-conduct | contributors | logging | version | design | platform | coding' },
        format: { type: 'string', enum: ['json', 'raw'], description: 'Response format — json (default) includes metadata; raw returns plain markdown' },
      },
      required: ['slug'],
    },
  },
]

const MCP_RESOURCES = [
  { uri: 'project-docs://index', name: 'Project Documentation Index', description: 'Index of all static root MD files publicly accessible via /api/v1/docs', mimeType: 'application/json' },
  { uri: 'docs://index', name: 'Documentation Index', description: 'Full index of all documentation', mimeType: 'application/json' },
  { uri: 'docs://categories', name: 'Categories', description: 'All documentation categories', mimeType: 'application/json' },
  { uri: 'docs://recent', name: 'Recent Documents', description: 'Recently updated documentation', mimeType: 'application/json' },
  { uri: 'docs://popular', name: 'Popular Documents', description: 'Most viewed documents', mimeType: 'application/json' },
  { uri: 'docs://tags', name: 'All Tags', description: 'All tags with counts', mimeType: 'application/json' },
  { uri: 'docs://stats', name: 'Statistics', description: 'Documentation statistics', mimeType: 'application/json' },
  { uri: 'docs://sitemap', name: 'Sitemap', description: 'XML sitemap data', mimeType: 'application/json' },
  { uri: 'docs://llms', name: 'LLM Index', description: 'LLM-optimized documentation index', mimeType: 'text/plain' },
]

const MCP_PROMPTS = [
  { name: 'explain_doc', description: 'Explain a documentation page in simple terms', arguments: [{ name: 'slug', required: true }] },
  { name: 'summarize_category', description: 'Summarize all documents in a category', arguments: [{ name: 'category', required: true }] },
  { name: 'compare_docs', description: 'Compare two documentation pages', arguments: [{ name: 'slug1', required: true }, { name: 'slug2', required: true }] },
  { name: 'generate_faq', description: 'Generate FAQ from document content', arguments: [{ name: 'slug', required: true }] },
  { name: 'translate_doc', description: 'Translate document to another language', arguments: [{ name: 'slug', required: true }, { name: 'language', required: true }] },
  { name: 'improve_seo', description: 'Suggest SEO improvements for a document', arguments: [{ name: 'slug', required: true }] },
]

// Hardcoded allowlist — user input NEVER flows into file paths (no path traversal possible)
const PROJECT_DOCS: Record<string, { file: string; description: string; category: string }> = {
  'readme':           { file: 'README.md',          description: 'Project overview and quick start guide',              category: 'overview'     },
  'architecture':     { file: 'ARCHITECTURE.md',    description: 'System design and data flow',                         category: 'technical'    },
  'api':              { file: 'API.md',              description: 'REST and MCP API reference',                          category: 'api'          },
  'features':         { file: 'FEATURES.md',         description: 'Detailed feature documentation',                      category: 'features'     },
  'standards':        { file: 'STANDARDS.md',        description: 'Web standards compliance (WCAG, Core Web Vitals)',    category: 'compliance'   },
  'ecosystem':        { file: 'ECOSYSTEM.md',        description: 'Platform ecosystem overview',                         category: 'ecosystem'    },
  'integrations':     { file: 'INTEGRATIONS.md',    description: 'Third-party integration guides',                      category: 'integrations' },
  'use-cases':        { file: 'USE_CASES.md',        description: 'Real-world deployment scenarios',                     category: 'guides'       },
  'roadmap':          { file: 'ROADMAP.md',          description: 'Release plan and milestones',                         category: 'planning'     },
  'testing':          { file: 'TESTING.md',          description: 'Testing strategy and examples',                       category: 'development'  },
  'contributing':     { file: 'CONTRIBUTING.md',    description: 'Contribution guidelines',                            category: 'community'    },
  'changelog':        { file: 'CHANGELOG.md',        description: 'Version history and release notes',                   category: 'releases'     },
  'security':         { file: 'SECURITY.md',         description: 'Security policy and reporting',                       category: 'security'     },
  'support':          { file: 'SUPPORT.md',          description: 'Support channels and funding',                        category: 'community'    },
  'code-of-conduct':  { file: 'CODE_OF_CONDUCT.md', description: 'Community guidelines',                               category: 'community'    },
  'contributors':     { file: 'CONTRIBUTORS.md',    description: 'Project contributors',                               category: 'community'    },
  'logging':          { file: 'LOGGING.md',          description: 'Logging strategies and standards',                    category: 'development'  },
  'version':          { file: 'VERSION.md',          description: 'Version information and compatibility',               category: 'releases'     },
  'design':           { file: 'DESIGN.md',           description: 'UI/UX design system and visual language',             category: 'design'       },
  'platform':         { file: 'PLATFORM.md',         description: 'Platform architecture and infrastructure overview',   category: 'technical'    },
  'coding':           { file: 'CODING.md',           description: 'Coding standards and development practices',          category: 'development'  },
}

async function getBaseUrl(): Promise<string> {
  try {
    const result = await sql`SELECT value FROM settings WHERE tenant_id = ${DEFAULT_TENANT_ID} AND key = 'base_url'`
    if (result[0]?.value) return JSON.parse(result[0].value as string)
  } catch { /* ignore */ }
  return '${BASE_URL}'
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 100)
}

async function handleToolCall(name: string, args: Record<string, unknown>): Promise<unknown> {
  const baseUrl = await getBaseUrl()
  
  switch (name) {
    case 'list_documents': {
      const limit = Math.min((args.limit as number) || 20, 100)
      const offset = (args.offset as number) || 0
      const category = args.category as string | undefined
      const search = args.search as string | undefined
      const tag = args.tag as string | undefined
      const sort = (args.sort as string) || 'recent'

      let orderBy = 'published_at DESC NULLS LAST'
      if (sort === 'alphabetical') orderBy = 'title ASC'

      let docs: Document[]
      if (search) {
        docs = await sql`
          SELECT d.id, d.slug, d.title, d.description, d.category, d.tags, 
                 d.emoji_summary, d.reading_time_minutes, d.author_name, d.published_at, d.source_identifier
          FROM documents d
          JOIN search_index si ON d.id = si.document_id
          WHERE d.tenant_id = ${DEFAULT_TENANT_ID}
            AND d.deleted_at IS NULL AND d.status = 'published'
            AND si.content_vector @@ plainto_tsquery('english', ${search})
          ORDER BY ts_rank(si.content_vector, plainto_tsquery('english', ${search})) DESC
          LIMIT ${limit} OFFSET ${offset}
        ` as Document[]
      } else {
        docs = await sql`
          SELECT id, slug, title, description, category, tags, 
                 emoji_summary, reading_time_minutes, author_name, published_at, source_identifier
          FROM documents
          WHERE tenant_id = ${DEFAULT_TENANT_ID}
            AND deleted_at IS NULL AND status = 'published'
            ${category ? sql`AND category = ${category}` : sql``}
            ${tag ? sql`AND tags @> ${JSON.stringify([tag])}::jsonb` : sql``}
          ORDER BY ${sql.unsafe(orderBy)}
          LIMIT ${limit} OFFSET ${offset}
        ` as Document[]
      }

      const total = await sql`
        SELECT COUNT(*)::int as count FROM documents
        WHERE tenant_id = ${DEFAULT_TENANT_ID} AND deleted_at IS NULL AND status = 'published'
      `

      return { 
        documents: docs.map(d => ({
          ...d,
          url: `${baseUrl}/docs/${d.slug}`,
          emoji: d.emoji_summary || '📄',
        })), 
        count: docs.length,
        total: (total[0] as { count: number }).count,
        has_more: offset + docs.length < (total[0] as { count: number }).count,
      }
    }

    case 'get_document': {
      const slug = args.slug as string
      const format = (args.format as string) || 'full'

      const docs = await sql`
        SELECT * FROM documents
        WHERE tenant_id = ${DEFAULT_TENANT_ID} AND slug = ${slug} AND deleted_at IS NULL
      ` as Document[]

      if (docs.length === 0) throw new Error(`Document not found: ${slug}`)
      const doc = docs[0]

      if (format === 'toc') {
        return { toc: extractTableOfContents(doc.content) }
      }

      if (format === 'metadata') {
        return {
          title: doc.title,
          description: doc.description,
          category: doc.category,
          tags: doc.tags,
          emoji_summary: doc.emoji_summary,
          reading_time_minutes: doc.reading_time_minutes,
          word_count: doc.word_count,
          og_image: doc.og_image,
          canonical_url: doc.canonical_url,
        }
      }

      const shareLinks = [
        { platform: 'twitter', url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(doc.title)}&url=${encodeURIComponent(`${baseUrl}/docs/${slug}`)}` },
        { platform: 'linkedin', url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`${baseUrl}/docs/${slug}`)}` },
        { platform: 'facebook', url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${baseUrl}/docs/${slug}`)}` },
      ]

      return {
        ...doc,
        url: `${baseUrl}/docs/${slug}`,
        toc: extractTableOfContents(doc.content),
        share_links: shareLinks,
        emoji: doc.emoji_summary || '📄',
      }
    }

    case 'create_document': {
      const title = args.title as string
      const content = args.content as string
      const slug = generateSlug(title)
      const status = (args.status as string) || 'draft'
      const tags = (args.tags as string[]) || []
      
      // Generate SEO metadata
      const seo = await generateSEOMetadata({
        title,
        slug,
        content,
        description: args.description as string,
        category: args.category as string,
        tags,
      }, baseUrl)

      const result = await sql`
        INSERT INTO documents (
          tenant_id, slug, title, description, content, content_format,
          category, tags, status, source_url, source_identifier, author_name, target_audience,
          og_title, og_description, og_image, twitter_card, canonical_url,
          reading_time_minutes, word_count, emoji_summary,
          published_at
        ) VALUES (
          ${DEFAULT_TENANT_ID}, ${slug}, ${title}, ${args.description || seo.ogDescription},
          ${content}, 'markdown', ${args.category || null}, ${JSON.stringify(tags)},
          ${status}, ${args.source_url || null}, 
          ${args.source_url ? new URL(args.source_url as string).hostname.replace(/^www\./, '') : null},
          ${args.author_name || null}, ${args.target_audience || null},
          ${seo.ogTitle}, ${seo.ogDescription}, ${seo.ogImage}, ${seo.twitterCard}, ${seo.canonicalUrl},
          ${seo.readingTimeMinutes}, ${seo.wordCount}, ${seo.emojiSummary},
          ${status === 'published' ? sql`NOW()` : sql`NULL`}
        )
        RETURNING id, slug, emoji_summary
      `

      // Add to search index
      await sql`
        INSERT INTO search_index (document_id, tenant_id, content_vector)
        VALUES (${result[0].id}, ${DEFAULT_TENANT_ID}, to_tsvector('english', ${title + ' ' + content}))
      `

      return {
        id: result[0].id,
        slug: result[0].slug,
        url: `${baseUrl}/docs/${slug}`,
        emoji: result[0].emoji_summary,
        status,
        message: status === 'published' ? 'Document created and published' : 'Document created as draft',
      }
    }

    case 'update_document': {
      const slug = args.slug as string
      
      // Get existing doc
      const existing = await sql`SELECT id FROM documents WHERE slug = ${slug} AND tenant_id = ${DEFAULT_TENANT_ID}`
      if (existing.length === 0) throw new Error(`Document not found: ${slug}`)

      const updates: string[] = []
      const values: unknown[] = []

      if (args.title) { updates.push('title'); values.push(args.title) }
      if (args.content) { updates.push('content'); values.push(args.content) }
      if (args.description) { updates.push('description'); values.push(args.description) }
      if (args.category) { updates.push('category'); values.push(args.category) }
      if (args.tags) { updates.push('tags'); values.push(JSON.stringify(args.tags)) }
      if (args.status) { 
        updates.push('status'); values.push(args.status)
        if (args.status === 'published') {
          updates.push('published_at'); values.push(new Date())
        }
      }

      if (updates.length === 0) throw new Error('No fields to update')

      // Build dynamic update
      await sql`
        UPDATE documents SET
          title = COALESCE(${args.title || null}, title),
          content = COALESCE(${args.content || null}, content),
          description = COALESCE(${args.description || null}, description),
          category = COALESCE(${args.category || null}, category),
          tags = COALESCE(${args.tags ? JSON.stringify(args.tags) : null}::jsonb, tags),
          status = COALESCE(${args.status || null}, status),
          updated_at = NOW()
        WHERE slug = ${slug} AND tenant_id = ${DEFAULT_TENANT_ID}
      `

      // Regenerate SEO
      await updateDocumentSEO(slug, baseUrl)

      // Update search index if content changed
      if (args.content || args.title) {
        await sql`
          UPDATE search_index 
          SET content_vector = to_tsvector('english', (
            SELECT title || ' ' || content FROM documents WHERE id = ${existing[0].id}
          )), updated_at = NOW()
          WHERE document_id = ${existing[0].id}
        `
      }

      return { slug, updated: true, url: `${baseUrl}/docs/${slug}` }
    }

    case 'delete_document': {
      const slug = args.slug as string
      const permanent = args.permanent as boolean || false

      if (permanent) {
        await sql`DELETE FROM documents WHERE slug = ${slug} AND tenant_id = ${DEFAULT_TENANT_ID}`
      } else {
        await sql`UPDATE documents SET deleted_at = NOW() WHERE slug = ${slug} AND tenant_id = ${DEFAULT_TENANT_ID}`
      }

      return { slug, deleted: true, permanent }
    }

    case 'search': {
      const query = args.query as string
      const limit = Math.min((args.limit as number) || 10, 50)
      const highlight = args.highlight !== false

      const results = await sql`
        SELECT 
          d.id, d.slug, d.title, d.description, d.category, d.tags, d.emoji_summary,
          d.reading_time_minutes, d.author_name,
          ts_rank(si.content_vector, plainto_tsquery('english', ${query})) as relevance
          ${highlight ? sql`, ts_headline('english', d.content, plainto_tsquery('english', ${query}), 
            'StartSel=****, StopSel=****, MaxWords=35, MinWords=20') as excerpt` : sql``}
        FROM documents d
        JOIN search_index si ON d.id = si.document_id
        WHERE d.tenant_id = ${DEFAULT_TENANT_ID}
          AND d.deleted_at IS NULL AND d.status = 'published'
          AND si.content_vector @@ plainto_tsquery('english', ${query})
        ORDER BY relevance DESC
        LIMIT ${limit}
      `

      return {
        query,
        results: results.map((r: Record<string, unknown>) => ({
          ...r,
          url: `${baseUrl}/docs/${r.slug}`,
          emoji: r.emoji_summary || '📄',
        })),
        count: results.length,
      }
    }

    case 'list_categories': {
      const categories = await sql`
        SELECT slug, name, description, icon,
          (SELECT COUNT(*)::int FROM documents d 
           WHERE d.category = categories.slug AND d.deleted_at IS NULL AND d.status = 'published') as doc_count
        FROM categories
        WHERE tenant_id = ${DEFAULT_TENANT_ID}
        ORDER BY order_index ASC, name ASC
      `
      return { categories }
    }

    case 'get_related_docs': {
      const slug = args.slug as string
      const limit = Math.min((args.limit as number) || 5, 20)

      // Get source doc
      const source = await sql`
        SELECT category, tags FROM documents WHERE slug = ${slug} AND tenant_id = ${DEFAULT_TENANT_ID}
      `
      if (source.length === 0) throw new Error(`Document not found: ${slug}`)

      const docs = await sql`
        SELECT slug, title, description, category, emoji_summary, reading_time_minutes
        FROM documents
        WHERE tenant_id = ${DEFAULT_TENANT_ID}
          AND slug != ${slug}
          AND deleted_at IS NULL AND status = 'published'
          AND (category = ${source[0].category} OR tags ?| ${JSON.parse(JSON.stringify(source[0].tags || []))})
        ORDER BY 
          CASE WHEN category = ${source[0].category} THEN 0 ELSE 1 END,
          published_at DESC
        LIMIT ${limit}
      `

      return { related: docs.map((d: Document) => ({ ...d, url: `${baseUrl}/docs/${d.slug}` })) }
    }

    case 'submit_content': {
      const sourceUrl = args.source_url as string
      const title = args.title as string
      const content = args.content as string
      const sourceIdentifier = new URL(sourceUrl).hostname.replace(/^www\./, '')

      // Check auto-approve setting
      const settings = await sql`SELECT value FROM settings WHERE tenant_id = ${DEFAULT_TENANT_ID} AND key = 'auto_approve_submissions'`
      const autoApprove = settings[0]?.value === 'true' || settings[0]?.value === true

      if (autoApprove) {
        // Create document directly
        const slug = generateSlug(title)
        const seo = await generateSEOMetadata({ title, slug, content, category: args.category as string, tags: args.tags as string[] }, baseUrl)

        const result = await sql`
          INSERT INTO documents (
            tenant_id, slug, title, description, content, content_format,
            category, tags, status, source_url, source_identifier, author_name,
            og_title, og_description, og_image, canonical_url,
            reading_time_minutes, word_count, emoji_summary, published_at
          ) VALUES (
            ${DEFAULT_TENANT_ID}, ${slug}, ${title}, ${args.description || seo.ogDescription},
            ${content}, 'markdown', ${args.category || null}, ${JSON.stringify(args.tags || [])},
            'published', ${sourceUrl}, ${sourceIdentifier}, ${args.author_name || null},
            ${seo.ogTitle}, ${seo.ogDescription}, ${seo.ogImage}, ${seo.canonicalUrl},
            ${seo.readingTimeMinutes}, ${seo.wordCount}, ${seo.emojiSummary}, NOW()
          )
          RETURNING id, slug
        `

        await sql`
          INSERT INTO search_index (document_id, tenant_id, content_vector)
          VALUES (${result[0].id}, ${DEFAULT_TENANT_ID}, to_tsvector('english', ${title + ' ' + content}))
        `

        return {
          auto_approved: true,
          document_id: result[0].id,
          slug: result[0].slug,
          url: `${baseUrl}/docs/${result[0].slug}`,
          message: 'Content auto-approved and published',
        }
      }

      // Create submission for review
      const result = await sql`
        INSERT INTO submissions (
          tenant_id, source_url, source_identifier, title, content, content_format,
          author_name, author_email, metadata, status
        ) VALUES (
          ${DEFAULT_TENANT_ID}, ${sourceUrl}, ${sourceIdentifier}, ${title}, ${content}, 'markdown',
          ${args.author_name || null}, ${args.author_email || null},
          ${JSON.stringify({ category: args.category, tags: args.tags, target_audience: args.target_audience, ...(args.metadata as object || {}) })},
          'pending'
        )
        RETURNING id
      `

      return {
        submission_id: result[0].id,
        source_identifier: sourceIdentifier,
        status: 'pending',
        message: 'Content submitted for review',
      }
    }

    case 'ingest_url': {
      const url = args.url as string
      const category = args.category as string | undefined
      const tags = (args.tags as string[]) || []
      const autoPublish = args.auto_publish as boolean || false

      // Fetch the URL
      const response = await fetch(url, {
        headers: { 'User-Agent': 'OpenDocs/1.0 (+${BASE_URL})' },
      })
      if (!response.ok) throw new Error(`Failed to fetch URL: ${response.status}`)

      const html = await response.text()
      
      // Extract title
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i) || html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
      const title = titleMatch ? titleMatch[1].trim() : new URL(url).pathname.split('/').pop() || 'Untitled'

      // Extract meta description
      const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
      const description = descMatch ? descMatch[1] : undefined

      // Simple HTML to Markdown conversion
      let content = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
        .replace(/<[^>]+>/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()

      // Create document
      const slug = generateSlug(title)
      const sourceIdentifier = new URL(url).hostname.replace(/^www\./, '')
      const status = autoPublish ? 'published' : 'draft'

      const seo = await generateSEOMetadata({ title, slug, content, description, category, tags }, baseUrl)

      const result = await sql`
        INSERT INTO documents (
          tenant_id, slug, title, description, content, content_format,
          category, tags, status, source_url, source_identifier,
          og_title, og_description, og_image, canonical_url,
          reading_time_minutes, word_count, emoji_summary,
          published_at
        ) VALUES (
          ${DEFAULT_TENANT_ID}, ${slug}, ${title}, ${description || seo.ogDescription},
          ${content}, 'markdown', ${category || null}, ${JSON.stringify(tags)},
          ${status}, ${url}, ${sourceIdentifier},
          ${seo.ogTitle}, ${seo.ogDescription}, ${seo.ogImage}, ${seo.canonicalUrl},
          ${seo.readingTimeMinutes}, ${seo.wordCount}, ${seo.emojiSummary},
          ${status === 'published' ? sql`NOW()` : sql`NULL`}
        )
        RETURNING id, slug
      `

      await sql`
        INSERT INTO search_index (document_id, tenant_id, content_vector)
        VALUES (${result[0].id}, ${DEFAULT_TENANT_ID}, to_tsvector('english', ${title + ' ' + content}))
      `

      return {
        id: result[0].id,
        slug: result[0].slug,
        url: `${baseUrl}/docs/${result[0].slug}`,
        source: url,
        status,
        word_count: seo.wordCount,
        emoji: seo.emojiSummary,
      }
    }

    case 'get_emoji': {
      // Proxy to emoji.platphormnews.com MCP
      try {
        const emojiResponse = await fetch('https://emoji.platphormnews.com/api/mcp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: {
              name: 'search_emoji',
              arguments: { query: args.query, category: args.category, limit: args.limit || 10 },
            },
          }),
        })
        const data = await emojiResponse.json()
        return data.result
      } catch {
        // Fallback to local emoji lookup
        const query = (args.query as string || '').toLowerCase()
        const localEmojis: Record<string, string> = {
          smile: '😊', heart: '❤️', rocket: '🚀', star: '⭐', fire: '🔥',
          check: '✅', x: '❌', warning: '⚠️', book: '📖', code: '💻',
        }
        const matches = Object.entries(localEmojis)
          .filter(([k]) => k.includes(query))
          .map(([name, emoji]) => ({ name, emoji }))
        return { emojis: matches, source: 'local' }
      }
    }

    case 'add_emoji_to_doc': {
      const slug = args.slug as string
      const emojiSummary = args.emoji_summary as string

      await sql`
        UPDATE documents SET emoji_summary = ${emojiSummary}, updated_at = NOW()
        WHERE slug = ${slug} AND tenant_id = ${DEFAULT_TENANT_ID}
      `

      return { slug, emoji_summary: emojiSummary, updated: true }
    }

    case 'bulk_import': {
      const documents = args.documents as { title: string; content: string; category?: string; tags?: string[] }[]
      const sourceIdentifier = args.source_identifier as string || 'bulk-import'
      const autoPublish = args.auto_publish as boolean || false
      const status = autoPublish ? 'published' : 'draft'

      const results = []
      for (const doc of documents) {
        const slug = generateSlug(doc.title)
        const seo = await generateSEOMetadata({ title: doc.title, slug, content: doc.content, category: doc.category, tags: doc.tags }, baseUrl)

        const result = await sql`
          INSERT INTO documents (
            tenant_id, slug, title, content, content_format, category, tags, status,
            source_identifier, og_title, og_description, reading_time_minutes, word_count, emoji_summary,
            published_at
          ) VALUES (
            ${DEFAULT_TENANT_ID}, ${slug}, ${doc.title}, ${doc.content}, 'markdown',
            ${doc.category || null}, ${JSON.stringify(doc.tags || [])}, ${status},
            ${sourceIdentifier}, ${seo.ogTitle}, ${seo.ogDescription},
            ${seo.readingTimeMinutes}, ${seo.wordCount}, ${seo.emojiSummary},
            ${status === 'published' ? sql`NOW()` : sql`NULL`}
          )
          ON CONFLICT (tenant_id, slug) DO NOTHING
          RETURNING id, slug
        `

        if (result.length > 0) {
          await sql`
            INSERT INTO search_index (document_id, tenant_id, content_vector)
            VALUES (${result[0].id}, ${DEFAULT_TENANT_ID}, to_tsvector('english', ${doc.title + ' ' + doc.content}))
          `
          results.push({ slug: result[0].slug, status: 'created' })
        } else {
          results.push({ slug, status: 'skipped (exists)' })
        }
      }

      return { imported: results.filter(r => r.status === 'created').length, total: documents.length, results }
    }

    case 'regenerate_seo': {
      const slug = args.slug as string

      if (slug === 'all') {
        const docs = await sql`SELECT slug FROM documents WHERE tenant_id = ${DEFAULT_TENANT_ID} AND deleted_at IS NULL`
        for (const doc of docs) {
          await updateDocumentSEO(doc.slug as string, baseUrl)
        }
        return { regenerated: docs.length }
      }

      await updateDocumentSEO(slug, baseUrl)
      return { slug, regenerated: true }
    }

    case 'export_docs': {
      const format = (args.format as string) || 'json'
      const category = args.category as string | undefined
      const includeDrafts = args.include_drafts as boolean || false

      const docs = await sql`
        SELECT * FROM documents
        WHERE tenant_id = ${DEFAULT_TENANT_ID}
          AND deleted_at IS NULL
          ${!includeDrafts ? sql`AND status = 'published'` : sql``}
          ${category ? sql`AND category = ${category}` : sql``}
        ORDER BY category, title
      `

      if (format === 'markdown') {
        const md = docs.map((d: Document) => `# ${d.title}\n\n${d.content}`).join('\n\n---\n\n')
        return { format: 'markdown', content: md, count: docs.length }
      }

      if (format === 'html') {
        const html = docs.map((d: Document) => `<article><h1>${d.title}</h1>${parseMarkdown(d.content)}</article>`).join('\n')
        return { format: 'html', content: html, count: docs.length }
      }

      return { format: 'json', documents: docs, count: docs.length }
    }

    case 'get_stats': {
      const [docCount, catCount, subCount, sourceCount, recentDocs] = await Promise.all([
        sql`SELECT COUNT(*)::int as count FROM documents WHERE tenant_id = ${DEFAULT_TENANT_ID} AND deleted_at IS NULL AND status = 'published'`,
        sql`SELECT COUNT(*)::int as count FROM categories WHERE tenant_id = ${DEFAULT_TENANT_ID}`,
        sql`SELECT COUNT(*)::int as count FROM submissions WHERE tenant_id = ${DEFAULT_TENANT_ID}`,
        sql`SELECT COUNT(DISTINCT source_identifier)::int as count FROM documents WHERE tenant_id = ${DEFAULT_TENANT_ID} AND source_identifier IS NOT NULL`,
        sql`SELECT slug, title, updated_at FROM documents WHERE tenant_id = ${DEFAULT_TENANT_ID} AND status = 'published' ORDER BY updated_at DESC LIMIT 5`,
      ])

      return {
        documents: (docCount[0] as { count: number }).count,
        categories: (catCount[0] as { count: number }).count,
        submissions: (subCount[0] as { count: number }).count,
        unique_sources: (sourceCount[0] as { count: number }).count,
        recent_updates: recentDocs,
      }
    }

    case 'trigger_webhook': {
      const event = args.event as string
      const slug = args.slug as string | undefined

      const webhooks = await sql`
        SELECT id, url, secret FROM webhook_endpoints
        WHERE tenant_id = ${DEFAULT_TENANT_ID}
          AND active = true
          AND events @> ${JSON.stringify([event])}::jsonb
      `

      const payload = {
        event,
        timestamp: new Date().toISOString(),
        data: slug ? { slug } : {},
      }

      const results = []
      for (const wh of webhooks) {
        try {
          const signature = crypto.createHmac('sha256', wh.secret as string).update(JSON.stringify(payload)).digest('hex')
          const response = await fetch(wh.url as string, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Webhook-Signature': signature,
            },
            body: JSON.stringify(payload),
          })
          results.push({ webhook_id: wh.id, status: response.status })
        } catch (err) {
          results.push({ webhook_id: wh.id, error: (err as Error).message })
        }
      }

      return { event, triggered: webhooks.length, results }
    }

    case 'list_integrations': {
      const integrations = await sql`
        SELECT name, base_url, api_path, mcp_path, enabled
        FROM integrations
        WHERE tenant_id = ${DEFAULT_TENANT_ID}
        ORDER BY name
      `
      return { integrations }
    }

    case 'call_integration': {
      const integrationName = args.integration as string
      const method = args.method as string
      const params = args.params as Record<string, unknown> || {}

      const integrations = await sql`
        SELECT base_url, mcp_path FROM integrations
        WHERE tenant_id = ${DEFAULT_TENANT_ID} AND name = ${integrationName} AND enabled = true
      `

      if (integrations.length === 0) throw new Error(`Integration not found or disabled: ${integrationName}`)

      const mcpUrl = `${integrations[0].base_url}${integrations[0].mcp_path}`
      const response = await fetch(mcpUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      })

      const data = await response.json()
      return { integration: integrationName, response: data }
    }

    case 'parse_markdown': {
      const content = args.content as string
      const enableEmoji = args.enable_emoji !== false

      const html = parseMarkdown(content, { enableEmoji })
      const toc = extractTableOfContents(content)

      return { html, toc, processed_emoji: enableEmoji }
    }

    case 'generate_share_links': {
      const slug = args.slug as string
      const docs = await sql`SELECT title, description FROM documents WHERE slug = ${slug} AND tenant_id = ${DEFAULT_TENANT_ID}`
      if (docs.length === 0) throw new Error(`Document not found: ${slug}`)

      const doc = docs[0]
      const url = `${baseUrl}/docs/${slug}`

      return {
        slug,
        url,
        links: [
          { platform: 'twitter', url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(doc.title as string)}&url=${encodeURIComponent(url)}`, icon: '𝕏' },
          { platform: 'linkedin', url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, icon: '💼' },
          { platform: 'facebook', url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, icon: '📘' },
          { platform: 'reddit', url: `https://reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(doc.title as string)}`, icon: '🔴' },
          { platform: 'hackernews', url: `https://news.ycombinator.com/submitlink?u=${encodeURIComponent(url)}&t=${encodeURIComponent(doc.title as string)}`, icon: '🟧' },
          { platform: 'email', url: `mailto:?subject=${encodeURIComponent(doc.title as string)}&body=${encodeURIComponent((doc.description || '') + '\n\n' + url)}`, icon: '📧' },
        ],
      }
    }

    // Project Documentation (static root MD files — allowlist-validated, no user input in file paths)
    case 'list_project_docs': {
      const category = args.category as string | undefined
      const entries = Object.entries(PROJECT_DOCS)
        .filter(([, meta]) => !category || meta.category === category)
        .map(([slug, meta]) => ({
          slug,
          file: meta.file,
          description: meta.description,
          category: meta.category,
          api_url: `${baseUrl}/api/v1/docs/${slug}`,
          raw_url: `${baseUrl}/api/v1/docs/${slug}?format=raw`,
        }))
      return { docs: entries, total: entries.length }
    }

    case 'get_project_doc': {
      const slug = (args.slug as string).toLowerCase()
      const format = (args.format as string) || 'json'
      // Validate against allowlist — file path is never user-controlled
      const entry = PROJECT_DOCS[slug]
      if (!entry) throw new Error(`Project doc not found: "${slug}". Available: ${Object.keys(PROJECT_DOCS).join(', ')}`)
      const filePath = path.join(process.cwd(), entry.file)
      const content = await fs.readFile(filePath, 'utf-8')
      if (format === 'raw') return { slug, file: entry.file, content }
      const stats = await fs.stat(filePath)
      const titleMatch = content.match(/^#\s+(.+)$/m)
      const title = titleMatch ? titleMatch[1] : entry.file.replace(/\.md$/, '')
      const wordCount = content.split(/\s+/).length
      return {
        slug,
        file: entry.file,
        title,
        description: entry.description,
        category: entry.category,
        content,
        wordCount,
        readingTime: Math.ceil(wordCount / 200),
        lastModified: stats.mtime.toISOString(),
        api_url: `${baseUrl}/api/v1/docs/${slug}`,
        raw_url: `${baseUrl}/api/v1/docs/${slug}?format=raw`,
      }
    }

    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}

async function handleResourceRead(uri: string): Promise<{ contents: { uri: string; mimeType: string; text: string }[] }> {
  const baseUrl = await getBaseUrl()

  // Project-docs URI handler — slug resolved only through hardcoded PROJECT_DOCS allowlist
  if (uri.startsWith('project-docs://')) {
    const slug = uri.replace('project-docs://', '')
    if (slug === 'index') {
      const entries = Object.entries(PROJECT_DOCS).map(([s, meta]) => ({
        slug: s,
        file: meta.file,
        description: meta.description,
        category: meta.category,
        api_url: `${baseUrl}/api/v1/docs/${s}`,
        raw_url: `${baseUrl}/api/v1/docs/${s}?format=raw`,
      }))
      return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify({ docs: entries, total: entries.length, base_url: baseUrl, mcp_endpoint: `${baseUrl}/api/mcp` }, null, 2) }] }
    }
    const entry = PROJECT_DOCS[slug]
    if (!entry) throw new Error(`Unknown project-doc resource: ${uri}`)
    const filePath = path.join(process.cwd(), entry.file)
    const content = await fs.readFile(filePath, 'utf-8')
    return { contents: [{ uri, mimeType: 'text/markdown', text: content }] }
  }

  switch (uri) {
    case 'docs://index': {
      const docs = await sql`
        SELECT slug, title, description, category, tags, emoji_summary, published_at
        FROM documents WHERE tenant_id = ${DEFAULT_TENANT_ID} AND deleted_at IS NULL AND status = 'published'
        ORDER BY category, title
      `
      return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify({ documents: docs, base_url: baseUrl, generated_at: new Date().toISOString() }) }] }
    }
    case 'docs://categories': {
      const categories = await sql`SELECT slug, name, description, icon FROM categories WHERE tenant_id = ${DEFAULT_TENANT_ID} ORDER BY order_index ASC`
      return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify({ categories }) }] }
    }
    case 'docs://recent': {
      const docs = await sql`SELECT slug, title, description, category, emoji_summary, updated_at FROM documents WHERE tenant_id = ${DEFAULT_TENANT_ID} AND deleted_at IS NULL AND status = 'published' ORDER BY updated_at DESC LIMIT 20`
      return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify({ documents: docs }) }] }
    }
    case 'docs://tags': {
      const tags = await sql`SELECT DISTINCT jsonb_array_elements_text(tags) as tag FROM documents WHERE tenant_id = ${DEFAULT_TENANT_ID} AND deleted_at IS NULL`
      return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify({ tags: tags.map((t: { tag: string }) => t.tag) }) }] }
    }
    case 'docs://stats': {
      const stats = await handleToolCall('get_stats', {})
      return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(stats) }] }
    }
    case 'docs://llms': {
      const docs = await sql`SELECT slug, title, description, category FROM documents WHERE tenant_id = ${DEFAULT_TENANT_ID} AND deleted_at IS NULL AND status = 'published' ORDER BY category, title`
      const text = `# OpenDocs - MCP-Enabled Documentation Platform\n\nBase URL: ${baseUrl}\nMCP Endpoint: ${baseUrl}/api/mcp\n\n## Documents\n\n${docs.map((d: Document) => `- [${d.title}](${baseUrl}/docs/${d.slug}): ${d.description || 'No description'}`).join('\n')}`
      return { contents: [{ uri, mimeType: 'text/plain', text }] }
    }
    default:
      throw new Error(`Unknown resource: ${uri}`)
  }
}

async function handlePromptGet(name: string, args: Record<string, string>): Promise<{ messages: { role: string; content: { type: string; text: string } }[] }> {
  switch (name) {
    case 'explain_doc': {
      const docs = await sql`SELECT title, content FROM documents WHERE tenant_id = ${DEFAULT_TENANT_ID} AND slug = ${args.slug} AND deleted_at IS NULL`
      if (docs.length === 0) throw new Error('Document not found')
      return { messages: [{ role: 'user', content: { type: 'text', text: `Please explain the following documentation page in simple, clear terms:\n\n# ${docs[0].title}\n\n${docs[0].content}` } }] }
    }
    case 'summarize_category': {
      const docs = await sql`SELECT title, description, slug FROM documents WHERE tenant_id = ${DEFAULT_TENANT_ID} AND category = ${args.category} AND deleted_at IS NULL AND status = 'published' ORDER BY title`
      const docList = docs.map((d: Document) => `- ${d.title}: ${d.description || 'No description'}`).join('\n')
      return { messages: [{ role: 'user', content: { type: 'text', text: `Please provide a comprehensive summary of the "${args.category}" documentation category. Here are the documents:\n\n${docList}` } }] }
    }
    case 'compare_docs': {
      const doc1 = await sql`SELECT title, content FROM documents WHERE slug = ${args.slug1} AND deleted_at IS NULL`
      const doc2 = await sql`SELECT title, content FROM documents WHERE slug = ${args.slug2} AND deleted_at IS NULL`
      if (doc1.length === 0 || doc2.length === 0) throw new Error('One or both documents not found')
      return { messages: [{ role: 'user', content: { type: 'text', text: `Please compare these two documentation pages:\n\n## ${doc1[0].title}\n${doc1[0].content}\n\n## ${doc2[0].title}\n${doc2[0].content}` } }] }
    }
    case 'generate_faq': {
      const docs = await sql`SELECT title, content FROM documents WHERE slug = ${args.slug} AND deleted_at IS NULL`
      if (docs.length === 0) throw new Error('Document not found')
      return { messages: [{ role: 'user', content: { type: 'text', text: `Generate a FAQ (Frequently Asked Questions) section based on this documentation:\n\n# ${docs[0].title}\n\n${docs[0].content}` } }] }
    }
    case 'translate_doc': {
      const docs = await sql`SELECT title, content FROM documents WHERE slug = ${args.slug} AND deleted_at IS NULL`
      if (docs.length === 0) throw new Error('Document not found')
      return { messages: [{ role: 'user', content: { type: 'text', text: `Translate this documentation to ${args.language}:\n\n# ${docs[0].title}\n\n${docs[0].content}` } }] }
    }
    case 'improve_seo': {
      const docs = await sql`SELECT title, description, content, tags FROM documents WHERE slug = ${args.slug} AND deleted_at IS NULL`
      if (docs.length === 0) throw new Error('Document not found')
      return { messages: [{ role: 'user', content: { type: 'text', text: `Analyze this documentation and suggest SEO improvements:\n\nTitle: ${docs[0].title}\nDescription: ${docs[0].description || 'None'}\nTags: ${JSON.stringify(docs[0].tags || [])}\n\nContent:\n${docs[0].content}` } }] }
    }
    default:
      throw new Error(`Unknown prompt: ${name}`)
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<MCPResponse>> {
  try {
    const body: MCPRequest = await request.json()
    let result: unknown

    switch (body.method) {
      case 'initialize':
        result = {
          protocolVersion: '2024-11-05',
          serverInfo: { name: 'opendocs-mcp', version: '2.0.0' },
          capabilities: { tools: {}, resources: { subscribe: false, listChanged: false }, prompts: { listChanged: false } },
        }
        break
      case 'tools/list':
        result = { tools: MCP_TOOLS }
        break
      case 'tools/call':
        const toolParams = body.params as { name: string; arguments: Record<string, unknown> }
        result = { content: [{ type: 'text', text: JSON.stringify(await handleToolCall(toolParams.name, toolParams.arguments || {}), null, 2) }] }
        break
      case 'resources/list':
        result = { resources: MCP_RESOURCES }
        break
      case 'resources/read':
        result = await handleResourceRead((body.params as { uri: string }).uri)
        break
      case 'prompts/list':
        result = { prompts: MCP_PROMPTS }
        break
      case 'prompts/get':
        const promptParams = body.params as { name: string; arguments: Record<string, string> }
        result = await handlePromptGet(promptParams.name, promptParams.arguments || {})
        break
      default:
        return NextResponse.json({ jsonrpc: '2.0', id: body.id, error: { code: -32601, message: `Method not found: ${body.method}` } })
    }

    return NextResponse.json({ jsonrpc: '2.0', id: body.id, result })
  } catch (error) {
    console.error('MCP error:', error)
    return NextResponse.json({ jsonrpc: '2.0', id: 0, error: { code: -32603, message: error instanceof Error ? error.message : 'Internal error' } })
  }
}

export async function GET() {
  const baseUrl = await getBaseUrl()
  return NextResponse.json({
    name: 'opendocs-mcp',
    version: '2.0.0',
    protocol_version: '2024-11-05',
    endpoint: `${baseUrl}/api/mcp`,
    capabilities: {
      tools: MCP_TOOLS.length,
      resources: MCP_RESOURCES.length,
      prompts: MCP_PROMPTS.length,
    },
    tools: MCP_TOOLS.map(t => t.name),
    resources: MCP_RESOURCES.map(r => r.uri),
    prompts: MCP_PROMPTS.map(p => p.name),
  })
}
