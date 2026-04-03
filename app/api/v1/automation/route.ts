import { NextRequest, NextResponse } from 'next/server'
import { sql, DEFAULT_TENANT_ID } from '@/lib/db'
import { generateSEOMetadata, generateShareLinks, generateStructuredData } from '@/lib/seo-generator'
import { generateEmojiSummary } from '@/lib/emoji'
import { parseMarkdown, extractTableOfContents } from '@/lib/markdown'
import {  SITE_NAME , BASE_URL } from '@/lib/site-config'

/**
 * Automation API - Batch operations and workflow integration
 * 
 * POST /api/v1/automation
 * 
 * Supports multiple actions for streamlined workflows:
 * - batch_seo: Generate SEO for multiple documents
 * - batch_index: Update search index for multiple documents
 * - batch_publish: Publish multiple draft documents
 * - workflow_ingest: Ingest multiple URLs
 * - generate_sitemap: Force regenerate sitemap
 * - sync_integrations: Sync with external MCP services
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, params = {} } = body

    switch (action) {
      case 'batch_seo':
        return handleBatchSEO(params)
      case 'batch_index':
        return handleBatchIndex(params)
      case 'batch_publish':
        return handleBatchPublish(params)
      case 'workflow_ingest':
        return handleWorkflowIngest(params)
      case 'generate_emoji_summaries':
        return handleEmojiSummaries(params)
      case 'health_check':
        return handleHealthCheck()
      case 'stats':
        return handleStats()
      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('[Automation API Error]', { error: error instanceof Error ? error : String(error) })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function handleBatchSEO(params: { document_ids?: string[], all?: boolean }) {
  const baseUrl = await getBaseUrl()
  let documents

  if (params.all) {
    documents = await sql`
      SELECT id, slug, title, description, content, category
      FROM documents
      WHERE tenant_id = ${DEFAULT_TENANT_ID}
        AND deleted_at IS NULL
      LIMIT 100
    `
  } else if (params.document_ids?.length) {
    documents = await sql`
      SELECT id, slug, title, description, content, category
      FROM documents
      WHERE tenant_id = ${DEFAULT_TENANT_ID}
        AND id = ANY(${params.document_ids}::uuid[])
        AND deleted_at IS NULL
    `
  } else {
    return NextResponse.json({ success: false, error: 'Provide document_ids or set all=true' }, { status: 400 })
  }

  const results: Array<{ id: string, slug: string, status: string }> = []
  const CHUNK_SIZE = 10

  for (let i = 0; i < documents.length; i += CHUNK_SIZE) {
    const chunk = documents.slice(i, i + CHUNK_SIZE)

    await Promise.all(chunk.map(async (doc) => {
      const seo = await generateSEOMetadata({
        title: doc.title as string,
        description: doc.description as string || '',
        content: doc.content as string,
        slug: doc.slug as string,
        category: doc.category as string,
      }, baseUrl)

      await sql`
        UPDATE documents SET
          og_title = ${seo.ogTitle},
          og_description = ${seo.ogDescription},
          og_image = ${seo.ogImage},
          canonical_url = ${seo.canonicalUrl},
          reading_time_minutes = ${seo.readingTimeMinutes},
          word_count = ${seo.wordCount},
          updated_at = NOW()
        WHERE id = ${doc.id}
      `

      results.push({ id: doc.id as string, slug: doc.slug as string, status: 'updated' })
    }))
  }

  return NextResponse.json({
    success: true,
    data: { processed: results.length, results },
  })
}

async function handleBatchIndex(params: { document_ids?: string[], all?: boolean }) {
  let documents

  if (params.all) {
    documents = await sql`
      SELECT id, tenant_id, title, description, content
      FROM documents
      WHERE tenant_id = ${DEFAULT_TENANT_ID}
        AND deleted_at IS NULL
      LIMIT 500
    `
  } else if (params.document_ids?.length) {
    documents = await sql`
      SELECT id, tenant_id, title, description, content
      FROM documents
      WHERE tenant_id = ${DEFAULT_TENANT_ID}
        AND id = ANY(${params.document_ids}::uuid[])
        AND deleted_at IS NULL
    `
  } else {
    return NextResponse.json({ success: false, error: 'Provide document_ids or set all=true' }, { status: 400 })
  }

  let indexed = 0
  for (const doc of documents) {
    const searchText = `${doc.title} ${doc.description || ''} ${doc.content}`
    
    // Upsert search index
    await sql`
      INSERT INTO search_index (document_id, tenant_id, content_vector)
      VALUES (${doc.id}, ${doc.tenant_id}, to_tsvector('english', ${searchText}))
      ON CONFLICT (document_id) DO UPDATE SET
        content_vector = to_tsvector('english', ${searchText}),
        updated_at = NOW()
    `
    indexed++
  }

  return NextResponse.json({
    success: true,
    data: { indexed },
  })
}

async function handleBatchPublish(params: { document_ids: string[] }) {
  if (!params.document_ids?.length) {
    return NextResponse.json({ success: false, error: 'Provide document_ids array' }, { status: 400 })
  }

  const result = await sql`
    UPDATE documents SET
      status = 'published',
      published_at = NOW(),
      updated_at = NOW()
    WHERE tenant_id = ${DEFAULT_TENANT_ID}
      AND id = ANY(${params.document_ids}::uuid[])
      AND status = 'draft'
      AND deleted_at IS NULL
    RETURNING id, slug
  `

  return NextResponse.json({
    success: true,
    data: { published: result.length, documents: result },
  })
}

async function handleWorkflowIngest(params: { urls: string[], category?: string, auto_publish?: boolean }) {
  if (!params.urls?.length) {
    return NextResponse.json({ success: false, error: 'Provide urls array' }, { status: 400 })
  }

  const results = []
  const baseUrl = await getBaseUrl()

  for (const url of params.urls.slice(0, 10)) { // Limit to 10 URLs per batch
    try {
      // Fetch the URL
      const response = await fetch(url, {
        headers: { 'User-Agent': `${SITE_NAME}-Bot/1.0` },
      })
      
      if (!response.ok) {
        results.push({ url, status: 'error', error: `HTTP ${response.status}` })
        continue
      }

      const html = await response.text()
      
      // Extract title from HTML
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
      const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
      const title = titleMatch?.[1] || h1Match?.[1] || new URL(url).pathname.split('/').pop() || 'Untitled'

      // Extract meta description
      const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
      const description = metaDescMatch?.[1] || ''

      // Extract main content (simplified)
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)
      let content = bodyMatch?.[1] || html
      
      // Strip scripts and styles
      content = content.replace(/<script[\s\S]*?<\/script>/gi, '')
      content = content.replace(/<style[\s\S]*?<\/style>/gi, '')
      content = content.replace(/<[^>]+>/g, ' ')
      content = content.replace(/\s+/g, ' ').trim()
      
      // Truncate content
      content = content.slice(0, 5000)

      // Generate slug
      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 100)

      // Generate SEO
      const seo = await generateSEOMetadata({
        title,
        description,
        content,
        slug,
        category: params.category || 'community',
      }, baseUrl)

      // Insert document
      const hostname = new URL(url).hostname

      const insertResult = await sql`
        INSERT INTO documents (
          tenant_id, slug, title, description, content, content_format,
          source_url, source_identifier, category, status, published_at,
          og_title, og_description, og_image, canonical_url,
          reading_time_minutes, word_count
        ) VALUES (
          ${DEFAULT_TENANT_ID}, ${slug}, ${title}, ${description}, ${content}, 'markdown',
          ${url}, ${hostname}, ${params.category || 'community'},
          ${params.auto_publish ? 'published' : 'draft'},
          ${params.auto_publish ? sql`NOW()` : null},
          ${seo.ogTitle}, ${seo.ogDescription}, ${seo.ogImage}, ${seo.canonicalUrl},
          ${seo.readingTimeMinutes}, ${seo.wordCount}
        )
        ON CONFLICT (tenant_id, slug) DO UPDATE SET
          content = EXCLUDED.content,
          updated_at = NOW()
        RETURNING id, slug
      `

      results.push({
        url,
        status: 'success',
        document: insertResult[0],
      })
    } catch (error) {
      results.push({
        url,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      total: params.urls.length,
      processed: results.length,
      successful: results.filter(r => r.status === 'success').length,
      results,
    },
  })
}

async function handleEmojiSummaries(params: { document_ids?: string[], all?: boolean }) {
  let documents

  if (params.all) {
    documents = await sql`
      SELECT id, title, content
      FROM documents
      WHERE tenant_id = ${DEFAULT_TENANT_ID}
        AND deleted_at IS NULL
        AND emoji_summary IS NULL
      LIMIT 50
    `
  } else if (params.document_ids?.length) {
    documents = await sql`
      SELECT id, title, content
      FROM documents
      WHERE tenant_id = ${DEFAULT_TENANT_ID}
        AND id = ANY(${params.document_ids}::uuid[])
        AND deleted_at IS NULL
    `
  } else {
    return NextResponse.json({ success: false, error: 'Provide document_ids or set all=true' }, { status: 400 })
  }

  const results = []
  for (const doc of documents) {
    const summary = await generateEmojiSummary(doc.content as string, doc.title as string)
    
    await sql`
      UPDATE documents SET
        emoji_summary = ${summary.emojis},
        updated_at = NOW()
      WHERE id = ${doc.id}
    `

    results.push({ id: doc.id, emoji_summary: summary.emojis })
  }

  return NextResponse.json({
    success: true,
    data: { processed: results.length, results },
  })
}

async function handleHealthCheck() {
  try {
    await sql`SELECT 1`
    
    return NextResponse.json({
      success: true,
      data: {
        status: 'healthy',
        database: 'connected',
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      data: {
        status: 'unhealthy',
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    }, { status: 503 })
  }
}

async function handleStats() {
  const [docs, submissions, sources, categories, sessions] = await Promise.all([
    sql`SELECT COUNT(*)::int as count FROM documents WHERE tenant_id = ${DEFAULT_TENANT_ID} AND deleted_at IS NULL`,
    sql`SELECT COUNT(*)::int as count FROM submissions WHERE tenant_id = ${DEFAULT_TENANT_ID}`,
    sql`SELECT COUNT(DISTINCT source_identifier)::int as count FROM documents WHERE tenant_id = ${DEFAULT_TENANT_ID} AND source_identifier IS NOT NULL`,
    sql`SELECT COUNT(*)::int as count FROM categories WHERE tenant_id = ${DEFAULT_TENANT_ID}`,
    sql`SELECT COUNT(*)::int as count FROM sessions WHERE tenant_id = ${DEFAULT_TENANT_ID} AND expires_at > NOW()`,
  ])

  const statusBreakdown = await sql`
    SELECT status, COUNT(*)::int as count
    FROM documents
    WHERE tenant_id = ${DEFAULT_TENANT_ID} AND deleted_at IS NULL
    GROUP BY status
  `

  return NextResponse.json({
    success: true,
    data: {
      documents: {
        total: (docs as { count: number }[])[0]?.count || 0,
        by_status: Object.fromEntries(statusBreakdown.map(r => [r.status, r.count])),
      },
      submissions: (submissions as { count: number }[])[0]?.count || 0,
      unique_sources: (sources as { count: number }[])[0]?.count || 0,
      categories: (categories as { count: number }[])[0]?.count || 0,
      active_sessions: (sessions as { count: number }[])[0]?.count || 0,
      timestamp: new Date().toISOString(),
    },
  })
}

async function getBaseUrl(): Promise<string> {
  try {
    const result = await sql`
      SELECT value FROM settings 
      WHERE tenant_id = ${DEFAULT_TENANT_ID} AND key = 'base_url'
    `
    if (result[0]?.value) {
      return JSON.parse(result[0].value as string)
    }
  } catch {
    // ignore
  }
  return BASE_URL
}

// GET endpoint for simple health/stats
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') || 'health_check'

  if (action === 'stats') {
    return handleStats()
  }
  return handleHealthCheck()
}
