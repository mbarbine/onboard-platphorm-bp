import { NextResponse } from 'next/server'
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { z } from 'zod'
import { sql, DEFAULT_TENANT_ID } from '@/lib/db'
import type { Document } from '@/lib/db'
import { generateSEOMetadata, updateDocumentSEO, generateAEOMetadata, generateGEOMetadata, generateFullOptimization } from '@/lib/seo-generator'
import { parseMarkdown, extractTableOfContents } from '@/lib/markdown'
import { generateSimpleSlug } from '@/lib/auto-name'
import crypto from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

// Hardcoded allowlist — user input NEVER flows into file paths (no path traversal possible)
const PROJECT_DOCS: Record<string, { file: string; description: string; category: string }> = {
  'readme':          { file: 'README.md',          description: 'Project overview and quick start guide',              category: 'overview'     },
  'architecture':    { file: 'ARCHITECTURE.md',    description: 'System design and data flow',                         category: 'technical'    },
  'api':             { file: 'API.md',              description: 'REST and MCP API reference',                          category: 'api'          },
  'features':        { file: 'FEATURES.md',         description: 'Detailed feature documentation',                      category: 'features'     },
  'standards':       { file: 'STANDARDS.md',        description: 'Web standards compliance (WCAG, Core Web Vitals)',    category: 'compliance'   },
  'ecosystem':       { file: 'ECOSYSTEM.md',        description: 'Platform ecosystem overview',                         category: 'ecosystem'    },
  'integrations':    { file: 'INTEGRATIONS.md',    description: 'Third-party integration guides',                      category: 'integrations' },
  'use-cases':       { file: 'USE_CASES.md',        description: 'Real-world deployment scenarios',                     category: 'guides'       },
  'roadmap':         { file: 'ROADMAP.md',          description: 'Release plan and milestones',                         category: 'planning'     },
  'testing':         { file: 'TESTING.md',          description: 'Testing strategy and examples',                       category: 'development'  },
  'contributing':    { file: 'CONTRIBUTING.md',    description: 'Contribution guidelines',                             category: 'community'    },
  'changelog':       { file: 'CHANGELOG.md',        description: 'Version history and release notes',                   category: 'releases'     },
  'security':        { file: 'SECURITY.md',         description: 'Security policy and reporting',                       category: 'security'     },
  'support':         { file: 'SUPPORT.md',          description: 'Support channels and funding',                        category: 'community'    },
  'code-of-conduct': { file: 'CODE_OF_CONDUCT.md', description: 'Community guidelines',                               category: 'community'    },
  'contributors':    { file: 'CONTRIBUTORS.md',    description: 'Project contributors',                               category: 'community'    },
  'logging':         { file: 'LOGGING.md',          description: 'Logging strategies and standards',                    category: 'development'  },
  'version':         { file: 'VERSION.md',          description: 'Version information and compatibility',               category: 'releases'     },
  'design':          { file: 'DESIGN.md',           description: 'UI/UX design system and visual language',             category: 'design'       },
  'platform':        { file: 'PLATFORM.md',         description: 'Platform architecture and infrastructure overview',   category: 'technical'    },
  'coding':          { file: 'CODING.md',           description: 'Coding standards and development practices',          category: 'development'  },
}

async function getBaseUrl(): Promise<string> {
  try {
    const result = await sql`SELECT value FROM settings WHERE tenant_id = ${DEFAULT_TENANT_ID} AND key = 'base_url'`
    if (result[0]?.value) return JSON.parse(result[0].value as string)
  } catch { /* ignore */ }
  return 'https://docs.platphormnews.com'
}

// Uses shared auto-name module for slug generation (see lib/auto-name.ts)

// Wrap any value as a well-formed MCP tool content result
function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

// SSRF protection — block private/internal IP ranges (mirrors REST ingest + webhook routes)
const BLOCKED_HOST_PATTERNS = [
  /^localhost$/,
  /^127\.\d+\.\d+\.\d+$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^169\.254\.\d+\.\d+$/,
  /^0\.0\.0\.0$/,
  /^::1?$/,
  /^metadata\.google\.internal$/,
]

function assertExternalUrl(raw: string): URL {
  const parsed = new URL(raw)
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only HTTP and HTTPS URLs are allowed')
  }
  // Strip IPv6 brackets (new URL('http://[::1]').hostname → '[::1]')
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (BLOCKED_HOST_PATTERNS.some(p => p.test(hostname))) {
    throw new Error('URLs pointing to internal or private networks are not allowed')
  }
  return parsed
}

// Content size guard (5 MB, same as REST ingest)
const MAX_CONTENT_BYTES = 5 * 1024 * 1024

function fetchWithTimeout(url: string, init: RequestInit, ms = 30_000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer))
}

// Ensure a category exists in the categories table (mirrors REST ingest auto-creation)
async function ensureCategoryExists(categorySlug: string | null | undefined): Promise<string | null> {
  if (!categorySlug) return null
  try {
    const existing = await sql`
      SELECT id FROM categories WHERE tenant_id = ${DEFAULT_TENANT_ID} AND slug = ${categorySlug}
    `
    if (existing.length === 0) {
      const categoryName = categorySlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      await sql`
        INSERT INTO categories (id, tenant_id, slug, name, description, order_index, metadata)
        VALUES (${crypto.randomUUID()}, ${DEFAULT_TENANT_ID}, ${categorySlug}, ${categoryName}, ${`Auto-created category for ${categoryName} content`}, 100, '{}')
      `
    }
  } catch (catError) {
    // Category creation is best-effort; log and continue with document insertion
    console.warn('Category auto-creation failed:', catError instanceof Error ? catError.message : catError)
  }
  return categorySlug
}

// ─────────────────────────────────────────────────────────────────────────────
// Server factory — creates a fresh McpServer per request (stateless serverless)
// ─────────────────────────────────────────────────────────────────────────────
export function createMcpServer(): McpServer {
  const server = new McpServer({ name: 'opendocs-mcp', version: '2.0.0' })

  // ── Document tools ──────────────────────────────────────────────────────────

  server.tool(
    'list_documents',
    'List published docs with filtering, search, and pagination. Returns title, slug, emoji summary, reading time.',
    {
      category: z.string().optional().describe('Filter by category slug'),
      search: z.string().optional().describe('Full-text search query'),
      tag: z.string().optional().describe('Filter by tag'),
      limit: z.number().optional().describe('Max results (default 20, max 100)'),
      offset: z.number().optional().describe('Pagination offset'),
      sort: z.enum(['recent', 'popular', 'alphabetical']).optional().describe('Sort order'),
    },
    async ({ category, search, tag, limit: rawLimit, offset: rawOffset, sort }) => {
      const baseUrl = await getBaseUrl()
      const limit = Math.min(rawLimit ?? 20, 100)
      const offset = rawOffset ?? 0
      const orderBy = sort === 'alphabetical' ? 'title ASC' : 'published_at DESC NULLS LAST'

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
      return ok({
        documents: docs.map(d => ({ ...d, url: `${baseUrl}/docs/${d.slug}`, emoji: d.emoji_summary || '📄' })),
        count: docs.length,
        total: (total[0] as { count: number }).count,
        has_more: offset + docs.length < (total[0] as { count: number }).count,
      })
    },
  )

  server.tool(
    'get_document',
    'Get full document with content, SEO metadata, table of contents, share links',
    {
      slug: z.string().describe('Document slug (required)'),
      format: z.enum(['full', 'summary', 'toc', 'metadata']).optional().describe('Response format'),
    },
    async ({ slug, format = 'full' }) => {
      const baseUrl = await getBaseUrl()
      const docs = await sql`
        SELECT * FROM documents
        WHERE tenant_id = ${DEFAULT_TENANT_ID} AND slug = ${slug} AND deleted_at IS NULL
      ` as Document[]
      if (docs.length === 0) throw new Error(`Document not found: ${slug}`)
      const doc = docs[0]

      if (format === 'toc') return ok({ toc: extractTableOfContents(doc.content) })
      if (format === 'metadata') return ok({
        title: doc.title, description: doc.description, category: doc.category,
        tags: doc.tags, emoji_summary: doc.emoji_summary, reading_time_minutes: doc.reading_time_minutes,
        word_count: doc.word_count, og_image: doc.og_image, canonical_url: doc.canonical_url,
      })

      const url = `${baseUrl}/docs/${slug}`
      const shareLinks = [
        { platform: 'twitter',  url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(doc.title)}&url=${encodeURIComponent(url)}` },
        { platform: 'linkedin', url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` },
        { platform: 'facebook', url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
      ]
      return ok({ ...doc, url, toc: extractTableOfContents(doc.content), share_links: shareLinks, emoji: doc.emoji_summary || '📄' })
    },
  )

  server.tool(
    'create_document',
    'Create new document with auto-generated SEO, emoji summary, and search indexing',
    {
      title: z.string().describe('Document title (required)'),
      content: z.string().describe('Markdown content (required)'),
      description: z.string().optional(),
      category: z.string().optional().describe('Category slug'),
      tags: z.array(z.string()).optional(),
      source_url: z.string().optional().describe('Original source URL'),
      author_name: z.string().optional(),
      target_audience: z.string().optional().describe('e.g. developers, beginners'),
      status: z.enum(['draft', 'published']).optional(),
    },
    async ({ title, content, description, category, tags = [], source_url, author_name, target_audience, status = 'draft' }) => {
      const baseUrl = await getBaseUrl()
      const docCategory = await ensureCategoryExists(category)
      const slug = generateSimpleSlug(title)
      const seo = await generateSEOMetadata({ title, slug, content, description, category: docCategory ?? undefined, tags }, baseUrl)
      const result = await sql`
        INSERT INTO documents (
          tenant_id, slug, title, description, content, content_format,
          category, tags, status, source_url, source_identifier, author_name, target_audience,
          og_title, og_description, og_image, twitter_card, canonical_url,
          reading_time_minutes, word_count, emoji_summary, published_at
        ) VALUES (
          ${DEFAULT_TENANT_ID}, ${slug}, ${title}, ${description || seo.ogDescription},
          ${content}, 'markdown', ${docCategory}, ${JSON.stringify(tags)},
          ${status}, ${source_url || null},
          ${source_url ? new URL(source_url).hostname.replace(/^www\./, '') : null},
          ${author_name || null}, ${target_audience || null},
          ${seo.ogTitle}, ${seo.ogDescription}, ${seo.ogImage}, ${seo.twitterCard}, ${seo.canonicalUrl},
          ${seo.readingTimeMinutes}, ${seo.wordCount}, ${seo.emojiSummary},
          ${status === 'published' ? sql`NOW()` : sql`NULL`}
        )
        RETURNING id, slug, emoji_summary
      `
      await sql`
        INSERT INTO search_index (document_id, tenant_id, content_vector)
        VALUES (${result[0].id}, ${DEFAULT_TENANT_ID}, to_tsvector('english', ${title + ' ' + content}))
      `
      return ok({
        id: result[0].id, slug: result[0].slug, url: `${baseUrl}/docs/${slug}`,
        emoji: result[0].emoji_summary, status,
        message: status === 'published' ? 'Document created and published' : 'Document created as draft',
      })
    },
  )

  server.tool(
    'update_document',
    'Update existing document, auto-regenerates SEO and search index',
    {
      slug: z.string().describe('Document slug (required)'),
      title: z.string().optional(),
      content: z.string().optional(),
      description: z.string().optional(),
      category: z.string().optional(),
      tags: z.array(z.string()).optional(),
      status: z.enum(['draft', 'published', 'archived']).optional(),
    },
    async ({ slug, title, content, description, category, tags, status }) => {
      const baseUrl = await getBaseUrl()
      const existing = await sql`SELECT id FROM documents WHERE slug = ${slug} AND tenant_id = ${DEFAULT_TENANT_ID}`
      if (existing.length === 0) throw new Error(`Document not found: ${slug}`)
      await sql`
        UPDATE documents SET
          title = COALESCE(${title || null}, title),
          content = COALESCE(${content || null}, content),
          description = COALESCE(${description || null}, description),
          category = COALESCE(${category || null}, category),
          tags = COALESCE(${tags ? JSON.stringify(tags) : null}::jsonb, tags),
          status = COALESCE(${status || null}, status),
          updated_at = NOW()
        WHERE slug = ${slug} AND tenant_id = ${DEFAULT_TENANT_ID}
      `
      if (content || title) {
        await sql`
          UPDATE search_index
          SET content_vector = to_tsvector('english', (
            SELECT title || ' ' || content FROM documents WHERE id = ${existing[0].id}
          )), updated_at = NOW()
          WHERE document_id = ${existing[0].id}
        `
      }
      await updateDocumentSEO(slug, baseUrl)
      return ok({ slug, updated: true, url: `${baseUrl}/docs/${slug}` })
    },
  )

  server.tool(
    'delete_document',
    'Soft delete a document (can be restored)',
    {
      slug: z.string().describe('Document slug (required)'),
      permanent: z.boolean().optional().describe('Hard-delete if true'),
    },
    async ({ slug, permanent = false }) => {
      if (permanent) {
        await sql`DELETE FROM documents WHERE slug = ${slug} AND tenant_id = ${DEFAULT_TENANT_ID}`
      } else {
        await sql`UPDATE documents SET deleted_at = NOW() WHERE slug = ${slug} AND tenant_id = ${DEFAULT_TENANT_ID}`
      }
      return ok({ slug, deleted: true, permanent })
    },
  )

  server.tool(
    'search',
    'Full-text search across all published documents',
    {
      query: z.string().describe('Search query (required)'),
      limit: z.number().optional().describe('Max results (default 10, max 50)'),
      highlight: z.boolean().optional().describe('Include highlighted excerpts (default true)'),
    },
    async ({ query, limit: rawLimit, highlight = true }) => {
      const baseUrl = await getBaseUrl()
      const limit = Math.min(rawLimit ?? 10, 50)
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
      return ok({
        query,
        results: results.map((r: Record<string, unknown>) => ({ ...r, url: `${baseUrl}/docs/${r.slug}`, emoji: r.emoji_summary || '📄' })),
        count: results.length,
      })
    },
  )

  server.tool(
    'list_categories',
    'List all documentation categories with document counts',
    {},
    async () => {
      const categories = await sql`
        SELECT slug, name, description, icon,
          (SELECT COUNT(*)::int FROM documents d
           WHERE d.category = categories.slug AND d.deleted_at IS NULL AND d.status = 'published') as doc_count
        FROM categories
        WHERE tenant_id = ${DEFAULT_TENANT_ID}
        ORDER BY order_index ASC, name ASC
      `
      return ok({ categories })
    },
  )

  server.tool(
    'get_related_docs',
    'Get documents related to a given document by category and tags',
    {
      slug: z.string().describe('Document slug (required)'),
      limit: z.number().optional().describe('Max results (default 5, max 20)'),
    },
    async ({ slug, limit: rawLimit }) => {
      const baseUrl = await getBaseUrl()
      const limit = Math.min(rawLimit ?? 5, 20)
      const source = await sql`SELECT category, tags FROM documents WHERE slug = ${slug} AND tenant_id = ${DEFAULT_TENANT_ID}`
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
      return ok({ related: docs.map((d) => ({ ...d, url: `${baseUrl}/docs/${d.slug}` })) })
    },
  )

  server.tool(
    'submit_content',
    'Submit content for review or auto-approve and publish',
    {
      source_url: z.string().describe('Source URL (required)'),
      title: z.string().describe('Document title (required)'),
      content: z.string().describe('Markdown content (required)'),
      description: z.string().optional(),
      category: z.string().optional(),
      tags: z.array(z.string()).optional(),
      author_name: z.string().optional(),
      author_email: z.string().optional(),
      target_audience: z.string().optional(),
      metadata: z.record(z.unknown()).optional(),
    },
    async ({ source_url, title, content, description, category, tags = [], author_name, author_email, target_audience, metadata }) => {
      const baseUrl = await getBaseUrl()
      const sourceIdentifier = new URL(source_url).hostname.replace(/^www\./, '')
      const settings = await sql`SELECT value FROM settings WHERE tenant_id = ${DEFAULT_TENANT_ID} AND key = 'auto_approve_submissions'`
      const autoApprove = settings[0]?.value === 'true' || settings[0]?.value === true

      if (autoApprove) {
        const docCategory = await ensureCategoryExists(category)
        const slug = generateSimpleSlug(title)
        const seo = await generateSEOMetadata({ title, slug, content, category: docCategory ?? undefined, tags }, baseUrl)
        const result = await sql`
          INSERT INTO documents (
            tenant_id, slug, title, description, content, content_format, category, tags, status,
            source_url, source_identifier, author_name, og_title, og_description, og_image,
            canonical_url, reading_time_minutes, word_count, emoji_summary, published_at
          ) VALUES (
            ${DEFAULT_TENANT_ID}, ${slug}, ${title}, ${description || seo.ogDescription},
            ${content}, 'markdown', ${docCategory}, ${JSON.stringify(tags)},
            'published', ${source_url}, ${sourceIdentifier}, ${author_name || null},
            ${seo.ogTitle}, ${seo.ogDescription}, ${seo.ogImage}, ${seo.canonicalUrl},
            ${seo.readingTimeMinutes}, ${seo.wordCount}, ${seo.emojiSummary}, NOW()
          )
          RETURNING id, slug
        `
        await sql`
          INSERT INTO search_index (document_id, tenant_id, content_vector)
          VALUES (${result[0].id}, ${DEFAULT_TENANT_ID}, to_tsvector('english', ${title + ' ' + content}))
        `
        return ok({ auto_approved: true, document_id: result[0].id, slug: result[0].slug, url: `${baseUrl}/docs/${result[0].slug}`, message: 'Content auto-approved and published' })
      }

      const result = await sql`
        INSERT INTO submissions (
          tenant_id, source_url, source_identifier, title, content, content_format,
          author_name, author_email, metadata, status
        ) VALUES (
          ${DEFAULT_TENANT_ID}, ${source_url}, ${sourceIdentifier}, ${title}, ${content}, 'markdown',
          ${author_name || null}, ${author_email || null},
          ${JSON.stringify({ category, tags, target_audience, ...(metadata || {}) })}, 'pending'
        )
        RETURNING id
      `
      return ok({ submission_id: result[0].id, source_identifier: sourceIdentifier, status: 'pending', message: 'Content submitted for review' })
    },
  )

  server.tool(
    'ingest_url',
    'Fetch a URL and ingest its content as a document',
    {
      url: z.string().url().describe('URL to fetch and ingest (required)'),
      category: z.string().optional(),
      tags: z.array(z.string()).optional(),
      auto_publish: z.boolean().optional(),
    },
    async ({ url, category, tags = [], auto_publish = false }) => {
      assertExternalUrl(url)
      const baseUrl = await getBaseUrl()
      const docCategory = await ensureCategoryExists(category)
      const response = await fetchWithTimeout(url, {
        headers: {
          'User-Agent': 'OpenDocs/1.0 (+https://docs.platphormnews.com)',
          'Accept': 'text/html,application/xhtml+xml,text/markdown,text/plain,application/json',
        },
        redirect: 'follow',
      })
      if (!response.ok) throw new Error(`Failed to fetch URL: ${response.status}`)
      const html = await response.text()
      if (new TextEncoder().encode(html).byteLength > MAX_CONTENT_BYTES) throw new Error('Content exceeds maximum size (5 MB)')
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i) || html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
      const title = titleMatch ? titleMatch[1].trim() : new URL(url).pathname.split('/').pop() || 'Untitled'
      const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
      const description = descMatch ? descMatch[1] : undefined
      let content = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
        .replace(/<[^>]+>/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
      const slug = generateSimpleSlug(title)
      const sourceIdentifier = new URL(url).hostname.replace(/^www\./, '')
      const status = auto_publish ? 'published' : 'draft'
      const seo = await generateSEOMetadata({ title, slug, content, description, category: docCategory ?? undefined, tags }, baseUrl)
      const result = await sql`
        INSERT INTO documents (
          tenant_id, slug, title, description, content, content_format,
          category, tags, status, source_url, source_identifier,
          og_title, og_description, og_image, canonical_url,
          reading_time_minutes, word_count, emoji_summary, published_at
        ) VALUES (
          ${DEFAULT_TENANT_ID}, ${slug}, ${title}, ${description || seo.ogDescription},
          ${content}, 'markdown', ${docCategory}, ${JSON.stringify(tags)},
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
      return ok({ id: result[0].id, slug: result[0].slug, url: `${baseUrl}/docs/${result[0].slug}`, source: url, status, word_count: seo.wordCount, emoji: seo.emojiSummary })
    },
  )

  server.tool(
    'get_emoji',
    'Search for emoji by query or category',
    {
      query: z.string().describe('Emoji search query'),
      category: z.string().optional(),
      limit: z.number().optional(),
    },
    async ({ query, category, limit = 10 }) => {
      try {
        const emojiResponse = await fetchWithTimeout('https://emoji.platphormnews.com/api/mcp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'search_emoji', arguments: { query, category, limit } } }),
        }, 10_000)
        const data = await emojiResponse.json() as { result: unknown }
        return { content: [{ type: 'text' as const, text: JSON.stringify(data.result, null, 2) }] }
      } catch {
        const localEmojis: Record<string, string> = {
          smile: '😊', heart: '❤️', rocket: '🚀', star: '⭐', fire: '🔥',
          check: '✅', x: '❌', warning: '⚠️', book: '📖', code: '💻',
        }
        const q = query.toLowerCase()
        return ok({ emojis: Object.entries(localEmojis).filter(([k]) => k.includes(q)).map(([name, emoji]) => ({ name, emoji })), source: 'local' })
      }
    },
  )

  server.tool(
    'add_emoji_to_doc',
    'Set the emoji summary for a document',
    {
      slug: z.string().describe('Document slug (required)'),
      emoji_summary: z.string().describe('Emoji summary string'),
    },
    async ({ slug, emoji_summary }) => {
      await sql`UPDATE documents SET emoji_summary = ${emoji_summary}, updated_at = NOW() WHERE slug = ${slug} AND tenant_id = ${DEFAULT_TENANT_ID}`
      return ok({ slug, emoji_summary, updated: true })
    },
  )

  server.tool(
    'bulk_import',
    'Import multiple documents at once',
    {
      documents: z.array(z.object({
        title: z.string(),
        content: z.string(),
        category: z.string().optional(),
        tags: z.array(z.string()).optional(),
      })).describe('Array of documents to import'),
      source_identifier: z.string().optional(),
      auto_publish: z.boolean().optional(),
    },
    async ({ documents, source_identifier = 'bulk-import', auto_publish = false }) => {
      const baseUrl = await getBaseUrl()
      const status = auto_publish ? 'published' : 'draft'
      const results = []
      for (const doc of documents) {
        const slug = generateSimpleSlug(doc.title)
        const seo = await generateSEOMetadata({ title: doc.title, slug, content: doc.content, category: doc.category, tags: doc.tags }, baseUrl)
        const result = await sql`
          INSERT INTO documents (
            tenant_id, slug, title, content, content_format, category, tags, status,
            source_identifier, og_title, og_description, reading_time_minutes, word_count, emoji_summary,
            published_at
          ) VALUES (
            ${DEFAULT_TENANT_ID}, ${slug}, ${doc.title}, ${doc.content}, 'markdown',
            ${doc.category || null}, ${JSON.stringify(doc.tags || [])}, ${status},
            ${source_identifier}, ${seo.ogTitle}, ${seo.ogDescription},
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
      return ok({ imported: results.filter(r => r.status === 'created').length, total: documents.length, results })
    },
  )

  server.tool(
    'regenerate_seo',
    'Regenerate SEO metadata for a document or all documents',
    {
      slug: z.string().describe('Document slug, or "all" to regenerate for every document'),
    },
    async ({ slug }) => {
      const baseUrl = await getBaseUrl()
      if (slug === 'all') {
        const docs = await sql`SELECT slug FROM documents WHERE tenant_id = ${DEFAULT_TENANT_ID} AND deleted_at IS NULL`
        for (const doc of docs) await updateDocumentSEO(doc.slug as string, baseUrl)
        return ok({ regenerated: docs.length })
      }
      await updateDocumentSEO(slug, baseUrl)
      return ok({ slug, regenerated: true })
    },
  )

  server.tool(
    'generate_optimization',
    'Generate full SEO + AEO (Answer Engine) + GEO (Generative Engine) optimization for a document',
    {
      slug: z.string().describe('Document slug (required)'),
    },
    async ({ slug }) => {
      const baseUrl = await getBaseUrl()
      const docs = await sql`
        SELECT slug, title, description, content, category, tags, source_url, author_name, published_at
        FROM documents
        WHERE tenant_id = ${DEFAULT_TENANT_ID} AND slug = ${slug} AND deleted_at IS NULL
      ` as Document[]
      if (docs.length === 0) throw new Error(`Document not found: ${slug}`)
      const doc = docs[0]
      const opt = await generateFullOptimization({
        title: doc.title,
        slug: doc.slug,
        content: doc.content,
        description: doc.description || undefined,
        category: doc.category || undefined,
        tags: Array.isArray(doc.tags) ? doc.tags : [],
        sourceUrl: doc.source_url || undefined,
        authorName: doc.author_name || undefined,
      }, baseUrl)
      return ok(opt)
    },
  )

  server.tool(
    'export_docs',
    'Export documents in JSON, Markdown, or HTML format',
    {
      format: z.enum(['json', 'markdown', 'html']).optional().describe('Export format (default: json)'),
      category: z.string().optional(),
      include_drafts: z.boolean().optional(),
    },
    async ({ format = 'json', category, include_drafts = false }) => {
      const docs = await sql`
        SELECT * FROM documents
        WHERE tenant_id = ${DEFAULT_TENANT_ID} AND deleted_at IS NULL
          ${!include_drafts ? sql`AND status = 'published'` : sql``}
          ${category ? sql`AND category = ${category}` : sql``}
        ORDER BY category, title
      ` as Document[]
      if (format === 'markdown') return ok({ format: 'markdown', content: docs.map(d => `# ${d.title}\n\n${d.content}`).join('\n\n---\n\n'), count: docs.length })
      if (format === 'html') return ok({ format: 'html', content: docs.map(d => `<article><h1>${d.title}</h1>${parseMarkdown(d.content)}</article>`).join('\n'), count: docs.length })
      return ok({ format: 'json', documents: docs, count: docs.length })
    },
  )

  server.tool(
    'get_stats',
    'Get documentation platform statistics',
    {},
    async () => {
      const [docCount, catCount, subCount, sourceCount, recentDocs] = await Promise.all([
        sql`SELECT COUNT(*)::int as count FROM documents WHERE tenant_id = ${DEFAULT_TENANT_ID} AND deleted_at IS NULL AND status = 'published'`,
        sql`SELECT COUNT(*)::int as count FROM categories WHERE tenant_id = ${DEFAULT_TENANT_ID}`,
        sql`SELECT COUNT(*)::int as count FROM submissions WHERE tenant_id = ${DEFAULT_TENANT_ID}`,
        sql`SELECT COUNT(DISTINCT source_identifier)::int as count FROM documents WHERE tenant_id = ${DEFAULT_TENANT_ID} AND source_identifier IS NOT NULL`,
        sql`SELECT slug, title, updated_at FROM documents WHERE tenant_id = ${DEFAULT_TENANT_ID} AND status = 'published' ORDER BY updated_at DESC LIMIT 5`,
      ])
      return ok({
        documents: (docCount[0] as { count: number }).count,
        categories: (catCount[0] as { count: number }).count,
        submissions: (subCount[0] as { count: number }).count,
        unique_sources: (sourceCount[0] as { count: number }).count,
        recent_updates: recentDocs,
      })
    },
  )

  server.tool(
    'trigger_webhook',
    'Trigger webhooks for a given event',
    {
      event: z.string().describe('Event type (required)'),
      slug: z.string().optional().describe('Document slug associated with the event'),
    },
    async ({ event, slug }) => {
      const webhooks = await sql`
        SELECT id, url, secret FROM webhook_endpoints
        WHERE tenant_id = ${DEFAULT_TENANT_ID} AND active = true
          AND events @> ${JSON.stringify([event])}::jsonb
      `
      const payload = { event, timestamp: new Date().toISOString(), data: slug ? { slug } : {} }
      const results = []
      for (const wh of webhooks) {
        try {
          assertExternalUrl(wh.url as string)
          const signature = crypto.createHmac('sha256', wh.secret as string).update(JSON.stringify(payload)).digest('hex')
          const resp = await fetchWithTimeout(wh.url as string, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Webhook-Signature': signature },
            body: JSON.stringify(payload),
          }, 10_000)
          results.push({ webhook_id: wh.id, status: resp.status })
        } catch (err) {
          results.push({ webhook_id: wh.id, error: (err as Error).message })
        }
      }
      return ok({ event, triggered: webhooks.length, results })
    },
  )

  server.tool(
    'list_integrations',
    'List configured integrations',
    {},
    async () => {
      const integrations = await sql`
        SELECT name, base_url, api_path, mcp_path, enabled
        FROM integrations WHERE tenant_id = ${DEFAULT_TENANT_ID} ORDER BY name
      `
      return ok({ integrations })
    },
  )

  server.tool(
    'call_integration',
    'Call a method on a configured integration via its MCP endpoint',
    {
      integration: z.string().describe('Integration name (required)'),
      method: z.string().describe('MCP method to call (required)'),
      params: z.record(z.unknown()).optional(),
    },
    async ({ integration, method, params = {} }) => {
      const rows = await sql`
        SELECT base_url, mcp_path FROM integrations
        WHERE tenant_id = ${DEFAULT_TENANT_ID} AND name = ${integration} AND enabled = true
      `
      if (rows.length === 0) throw new Error(`Integration not found or disabled: ${integration}`)
      const mcpUrl = `${rows[0].base_url}${rows[0].mcp_path}`
      assertExternalUrl(mcpUrl)
      const resp = await fetchWithTimeout(mcpUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      })
      if (!resp.ok) throw new Error(`Integration request failed: ${resp.status}`)
      return ok({ integration, response: await resp.json() })
    },
  )

  server.tool(
    'parse_markdown',
    'Parse Markdown content and return HTML with table of contents',
    {
      content: z.string().describe('Markdown content to parse'),
      enable_emoji: z.boolean().optional().describe('Process emoji shortcodes (default: true)'),
    },
    async ({ content, enable_emoji = true }) => {
      return ok({ html: parseMarkdown(content, { enableEmoji: enable_emoji }), toc: extractTableOfContents(content), processed_emoji: enable_emoji })
    },
  )

  server.tool(
    'generate_share_links',
    'Generate social share links for a document',
    { slug: z.string().describe('Document slug (required)') },
    async ({ slug }) => {
      const baseUrl = await getBaseUrl()
      const docs = await sql`SELECT title, description FROM documents WHERE slug = ${slug} AND tenant_id = ${DEFAULT_TENANT_ID}`
      if (docs.length === 0) throw new Error(`Document not found: ${slug}`)
      const doc = docs[0]
      const url = `${baseUrl}/docs/${slug}`
      return ok({
        slug, url, links: [
          { platform: 'twitter',    url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(doc.title as string)}&url=${encodeURIComponent(url)}`,                              icon: '𝕏'  },
          { platform: 'linkedin',   url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,                                                               icon: '💼' },
          { platform: 'facebook',   url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,                                                                      icon: '📘' },
          { platform: 'reddit',     url: `https://reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(doc.title as string)}`,                                    icon: '🔴' },
          { platform: 'hackernews', url: `https://news.ycombinator.com/submitlink?u=${encodeURIComponent(url)}&t=${encodeURIComponent(doc.title as string)}`,                            icon: '🟧' },
          { platform: 'email',      url: `mailto:?subject=${encodeURIComponent(doc.title as string)}&body=${encodeURIComponent((doc.description as string || '') + '\n\n' + url)}`,      icon: '📧' },
        ],
      })
    },
  )

  // ── Project docs tools ──────────────────────────────────────────────────────

  server.tool(
    'list_project_docs',
    'List all static project documentation files (README, ARCHITECTURE, API, DESIGN, etc.) served publicly via /api/v1/docs. No authentication required.',
    {
      category: z.string().optional().describe('Filter by category (overview, technical, api, features, compliance, ecosystem, integrations, guides, planning, development, community, releases, security, design)'),
    },
    async ({ category }) => {
      const baseUrl = await getBaseUrl()
      const entries = Object.entries(PROJECT_DOCS)
        .filter(([, meta]) => !category || meta.category === category)
        .map(([slug, meta]) => ({
          slug, file: meta.file, description: meta.description, category: meta.category,
          api_url: `${baseUrl}/api/v1/docs/${slug}`,
          raw_url: `${baseUrl}/api/v1/docs/${slug}?format=raw`,
        }))
      return ok({ docs: entries, total: entries.length })
    },
  )

  server.tool(
    'get_project_doc',
    'Fetch the content of a static project documentation file by slug. Publicly accessible — no auth needed.',
    {
      slug: z.string().describe('Doc slug: readme | architecture | api | features | standards | ecosystem | integrations | use-cases | roadmap | testing | contributing | changelog | security | support | code-of-conduct | contributors | logging | version | design | platform | coding'),
      format: z.enum(['json', 'raw']).optional().describe('Response format — json (default) includes metadata; raw returns plain markdown'),
    },
    async ({ slug, format = 'json' }) => {
      const baseUrl = await getBaseUrl()
      const s = slug.toLowerCase()
      const entry = PROJECT_DOCS[s]
      if (!entry) throw new Error(`Project doc not found: "${s}". Available: ${Object.keys(PROJECT_DOCS).join(', ')}`)
      const filePath = path.join(process.cwd(), entry.file)
      const content = await fs.readFile(filePath, 'utf-8')
      if (format === 'raw') return ok({ slug: s, file: entry.file, content })
      const stats = await fs.stat(filePath)
      const titleMatch = content.match(/^#\s+(.+)$/m)
      const title = titleMatch ? titleMatch[1] : entry.file.replace(/\.md$/, '')
      const wordCount = content.split(/\s+/).length
      return ok({
        slug: s, file: entry.file, title, description: entry.description, category: entry.category,
        content, wordCount, readingTime: Math.ceil(wordCount / 200),
        lastModified: stats.mtime.toISOString(),
        api_url: `${baseUrl}/api/v1/docs/${s}`,
        raw_url: `${baseUrl}/api/v1/docs/${s}?format=raw`,
      })
    },
  )

  // ── Resources ───────────────────────────────────────────────────────────────

  // project-docs://{slug} — covers both the index and individual files
  server.resource(
    'project-docs',
    new ResourceTemplate('project-docs://{slug}', { list: undefined }),
    async (uri, { slug }) => {
      const baseUrl = await getBaseUrl()
      const s = String(slug)
      if (s === 'index') {
        const entries = Object.entries(PROJECT_DOCS).map(([docSlug, meta]) => ({
          slug: docSlug, file: meta.file, description: meta.description, category: meta.category,
          api_url: `${baseUrl}/api/v1/docs/${docSlug}`,
          raw_url: `${baseUrl}/api/v1/docs/${docSlug}?format=raw`,
        }))
        return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify({ docs: entries, total: entries.length, base_url: baseUrl, mcp_endpoint: `${baseUrl}/api/mcp` }, null, 2) }] }
      }
      const entry = PROJECT_DOCS[s]
      if (!entry) throw new Error(`Unknown project-doc resource: ${uri.href}`)
      const filePath = path.join(process.cwd(), entry.file)
      const content = await fs.readFile(filePath, 'utf-8')
      return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text: content }] }
    },
  )

  server.resource('docs-index', 'docs://index', async (uri) => {
    const baseUrl = await getBaseUrl()
    const docs = await sql`
      SELECT slug, title, description, category, tags, emoji_summary, published_at
      FROM documents WHERE tenant_id = ${DEFAULT_TENANT_ID} AND deleted_at IS NULL AND status = 'published'
      ORDER BY category, title
    `
    return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify({ documents: docs, base_url: baseUrl, generated_at: new Date().toISOString() }) }] }
  })

  server.resource('docs-categories', 'docs://categories', async (uri) => {
    const categories = await sql`SELECT slug, name, description, icon FROM categories WHERE tenant_id = ${DEFAULT_TENANT_ID} ORDER BY order_index ASC`
    return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify({ categories }) }] }
  })

  server.resource('docs-recent', 'docs://recent', async (uri) => {
    const docs = await sql`
      SELECT slug, title, description, category, emoji_summary, updated_at
      FROM documents WHERE tenant_id = ${DEFAULT_TENANT_ID} AND deleted_at IS NULL AND status = 'published'
      ORDER BY updated_at DESC LIMIT 20
    `
    return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify({ documents: docs }) }] }
  })

  server.resource('docs-popular', 'docs://popular', async (uri) => {
    const docs = await sql`
      SELECT slug, title, description, category, emoji_summary
      FROM documents WHERE tenant_id = ${DEFAULT_TENANT_ID} AND deleted_at IS NULL AND status = 'published'
      ORDER BY view_count DESC NULLS LAST LIMIT 20
    `
    return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify({ documents: docs }) }] }
  })

  server.resource('docs-tags', 'docs://tags', async (uri) => {
    const tags = await sql`SELECT DISTINCT jsonb_array_elements_text(tags) as tag FROM documents WHERE tenant_id = ${DEFAULT_TENANT_ID} AND deleted_at IS NULL`
    return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify({ tags: tags.map((t) => (t as { tag: string }).tag) }) }] }
  })

  server.resource('docs-stats', 'docs://stats', async (uri) => {
    const [docCount, catCount, subCount, sourceCount] = await Promise.all([
      sql`SELECT COUNT(*)::int as count FROM documents WHERE tenant_id = ${DEFAULT_TENANT_ID} AND deleted_at IS NULL AND status = 'published'`,
      sql`SELECT COUNT(*)::int as count FROM categories WHERE tenant_id = ${DEFAULT_TENANT_ID}`,
      sql`SELECT COUNT(*)::int as count FROM submissions WHERE tenant_id = ${DEFAULT_TENANT_ID}`,
      sql`SELECT COUNT(DISTINCT source_identifier)::int as count FROM documents WHERE tenant_id = ${DEFAULT_TENANT_ID} AND source_identifier IS NOT NULL`,
    ])
    return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify({
      documents: (docCount[0] as { count: number }).count,
      categories: (catCount[0] as { count: number }).count,
      submissions: (subCount[0] as { count: number }).count,
      unique_sources: (sourceCount[0] as { count: number }).count,
    }) }] }
  })

  server.resource('docs-sitemap', 'docs://sitemap', async (uri) => {
    const baseUrl = await getBaseUrl()
    const docs = await sql`
      SELECT slug, title, updated_at FROM documents
      WHERE tenant_id = ${DEFAULT_TENANT_ID} AND deleted_at IS NULL AND status = 'published'
      ORDER BY updated_at DESC
    ` as Document[]
    return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify({
      urls: docs.map(d => ({ loc: `${baseUrl}/docs/${d.slug}`, lastmod: d.updated_at, title: d.title })),
      generated_at: new Date().toISOString(),
    }) }] }
  })

  server.resource('docs-llms', 'docs://llms', async (uri) => {
    const baseUrl = await getBaseUrl()
    const docs = await sql`
      SELECT slug, title, description, category FROM documents
      WHERE tenant_id = ${DEFAULT_TENANT_ID} AND deleted_at IS NULL AND status = 'published'
      ORDER BY category, title
    ` as Document[]
    const text = [
      '# OpenDocs - MCP-Enabled Documentation Platform',
      '',
      `Base URL: ${baseUrl}`,
      `MCP Endpoint: ${baseUrl}/api/mcp`,
      '',
      '## Documents',
      '',
      ...docs.map(d => `- [${d.title}](${baseUrl}/docs/${d.slug}): ${d.description || 'No description'}`),
    ].join('\n')
    return { contents: [{ uri: uri.href, mimeType: 'text/plain', text }] }
  })

  // ── Prompts ─────────────────────────────────────────────────────────────────

  server.prompt('explain_doc', 'Explain a documentation page in simple terms',
    { slug: z.string() },
    async ({ slug }) => {
      const docs = await sql`SELECT title, content FROM documents WHERE tenant_id = ${DEFAULT_TENANT_ID} AND slug = ${slug} AND deleted_at IS NULL`
      if (docs.length === 0) throw new Error('Document not found')
      return { messages: [{ role: 'user' as const, content: { type: 'text' as const, text: `Please explain the following documentation page in simple, clear terms:\n\n# ${docs[0].title}\n\n${docs[0].content}` } }] }
    },
  )

  server.prompt('summarize_category', 'Summarize all documents in a category',
    { category: z.string() },
    async ({ category }) => {
      const docs = await sql`SELECT title, description, slug FROM documents WHERE tenant_id = ${DEFAULT_TENANT_ID} AND category = ${category} AND deleted_at IS NULL AND status = 'published' ORDER BY title`
      const list = docs.map((d) => `- ${d.title}: ${d.description || 'No description'}`).join('\n')
      return { messages: [{ role: 'user' as const, content: { type: 'text' as const, text: `Please provide a comprehensive summary of the "${category}" documentation category. Here are the documents:\n\n${list}` } }] }
    },
  )

  server.prompt('compare_docs', 'Compare two documentation pages',
    { slug1: z.string(), slug2: z.string() },
    async ({ slug1, slug2 }) => {
      const [doc1, doc2] = await Promise.all([
        sql`SELECT title, content FROM documents WHERE slug = ${slug1} AND deleted_at IS NULL`,
        sql`SELECT title, content FROM documents WHERE slug = ${slug2} AND deleted_at IS NULL`,
      ])
      if (doc1.length === 0 || doc2.length === 0) throw new Error('One or both documents not found')
      return { messages: [{ role: 'user' as const, content: { type: 'text' as const, text: `Please compare these two documentation pages:\n\n## ${doc1[0].title}\n${doc1[0].content}\n\n## ${doc2[0].title}\n${doc2[0].content}` } }] }
    },
  )

  server.prompt('generate_faq', 'Generate FAQ from document content',
    { slug: z.string() },
    async ({ slug }) => {
      const docs = await sql`SELECT title, content FROM documents WHERE slug = ${slug} AND deleted_at IS NULL`
      if (docs.length === 0) throw new Error('Document not found')
      return { messages: [{ role: 'user' as const, content: { type: 'text' as const, text: `Generate a FAQ (Frequently Asked Questions) section based on this documentation:\n\n# ${docs[0].title}\n\n${docs[0].content}` } }] }
    },
  )

  server.prompt('translate_doc', 'Translate document to another language',
    { slug: z.string(), language: z.string() },
    async ({ slug, language }) => {
      const docs = await sql`SELECT title, content FROM documents WHERE slug = ${slug} AND deleted_at IS NULL`
      if (docs.length === 0) throw new Error('Document not found')
      return { messages: [{ role: 'user' as const, content: { type: 'text' as const, text: `Translate this documentation to ${language}:\n\n# ${docs[0].title}\n\n${docs[0].content}` } }] }
    },
  )

  server.prompt('improve_seo', 'Suggest SEO improvements for a document',
    { slug: z.string() },
    async ({ slug }) => {
      const docs = await sql`SELECT title, description, content, tags FROM documents WHERE slug = ${slug} AND deleted_at IS NULL`
      if (docs.length === 0) throw new Error('Document not found')
      return { messages: [{ role: 'user' as const, content: { type: 'text' as const, text: `Analyze this documentation and suggest SEO improvements:\n\nTitle: ${docs[0].title}\nDescription: ${docs[0].description || 'None'}\nTags: ${JSON.stringify(docs[0].tags || [])}\n\nContent:\n${docs[0].content}` } }] }
    },
  )

  return server
}

// ─────────────────────────────────────────────────────────────────────────────
// Route handlers
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  const server = createMcpServer()
  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true })
  await server.connect(transport)

  // The MCP SDK requires the Accept header to include both application/json
  // and text/event-stream. Ensure these are present so clients that only send
  // one (or neither) are not rejected with a 406 Not Acceptable error.
  const accept = req.headers.get('accept') ?? ''
  const needsJson = !accept.includes('application/json')
  const needsSse = !accept.includes('text/event-stream')

  if (needsJson || needsSse) {
    const parts: string[] = accept ? [accept] : []
    if (needsJson) parts.push('application/json')
    if (needsSse) parts.push('text/event-stream')
    const headers = new Headers(req.headers)
    headers.set('accept', parts.join(', '))
    req = new Request(req.url, {
      method: req.method,
      headers,
      body: req.body,
      // @ts-expect-error — duplex is required for streaming request bodies
      duplex: 'half',
    })
  }

  return transport.handleRequest(req)
}

export async function GET(): Promise<NextResponse> {
  const baseUrl = await getBaseUrl()
  return NextResponse.json({
    name: 'opendocs-mcp',
    version: '2.0.0',
    protocol_version: '2024-11-05',
    endpoint: `${baseUrl}/api/mcp`,
    sdk: '@modelcontextprotocol/sdk@1.27.1',
    transport: 'WebStandardStreamableHTTP',
    capabilities: {
      tools: 24,
      resources: 9,
      prompts: 6,
    },
    tools: [
      'list_documents', 'get_document', 'create_document', 'update_document', 'delete_document',
      'search', 'list_categories', 'get_related_docs', 'submit_content', 'ingest_url',
      'get_emoji', 'add_emoji_to_doc', 'bulk_import', 'regenerate_seo', 'generate_optimization',
      'export_docs', 'get_stats', 'trigger_webhook', 'list_integrations', 'call_integration',
      'parse_markdown', 'generate_share_links', 'list_project_docs', 'get_project_doc',
    ],
    resources: [
      'project-docs://{slug}',
      'docs://index', 'docs://categories', 'docs://recent', 'docs://popular',
      'docs://tags', 'docs://stats', 'docs://sitemap', 'docs://llms',
    ],
    prompts: ['explain_doc', 'summarize_category', 'compare_docs', 'generate_faq', 'translate_doc', 'improve_seo'],
  })
}
