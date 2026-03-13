import { NextRequest, NextResponse } from 'next/server'
import { sql, DEFAULT_TENANT_ID } from '@/lib/db'
import { generateSEOMetadata } from '@/lib/seo-generator'
import { generateEmojiSummary, parseEmojiShortcodes } from '@/lib/emoji'

/**
 * Workflow API - Async job processing and platform consumption
 * 
 * POST /api/v1/workflow
 * 
 * Designed for n8n, Zapier, Make.com, and other automation platforms
 */

interface WorkflowJob {
  id: string
  type: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  input: Record<string, unknown>
  output?: Record<string, unknown>
  error?: string
  created_at: string
  completed_at?: string
}

// In-memory job queue (in production, use Redis/Upstash)
const jobQueue = new Map<string, WorkflowJob>()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { workflow, input = {}, async = false } = body

    // Generate job ID
    const jobId = `wf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

    const job: WorkflowJob = {
      id: jobId,
      type: workflow,
      status: 'pending',
      input,
      created_at: new Date().toISOString(),
    }

    if (async) {
      // Queue for async processing
      jobQueue.set(jobId, job)
      processJobAsync(job).catch(console.error)
      
      return NextResponse.json({
        success: true,
        data: {
          job_id: jobId,
          status: 'queued',
          poll_url: `/api/v1/workflow/jobs/${jobId}`,
        },
      }, { status: 202 })
    }

    // Sync processing
    const result = await executeWorkflow(workflow, input)
    
    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('[Workflow API Error]', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const jobId = searchParams.get('job_id')

  if (jobId) {
    const job = jobQueue.get(jobId)
    if (!job) {
      return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: job })
  }

  // Return available workflows
  return NextResponse.json({
    success: true,
    data: {
      available_workflows: [
        {
          name: 'content_pipeline',
          description: 'Full content processing: ingest, SEO, emoji, index, publish',
          input: { url: 'string', category: 'string?', auto_publish: 'boolean?' },
        },
        {
          name: 'batch_import',
          description: 'Import multiple documents from URLs',
          input: { urls: 'string[]', category: 'string?', source: 'string?' },
        },
        {
          name: 'seo_refresh',
          description: 'Regenerate SEO metadata for documents',
          input: { document_ids: 'string[]?', category: 'string?', all: 'boolean?' },
        },
        {
          name: 'content_enhance',
          description: 'Enhance content with emojis and metadata',
          input: { document_id: 'string' },
        },
        {
          name: 'cross_post',
          description: 'Submit content to external platforms',
          input: { document_id: 'string', targets: 'string[]' },
        },
        {
          name: 'mcp_sync',
          description: 'Sync documents with MCP integrations',
          input: { integration: 'string', action: 'string' },
        },
      ],
    },
  })
}

async function processJobAsync(job: WorkflowJob) {
  job.status = 'processing'
  
  try {
    const result = await executeWorkflow(job.type, job.input)
    job.status = 'completed'
    job.output = result
    job.completed_at = new Date().toISOString()
  } catch (error) {
    job.status = 'failed'
    job.error = error instanceof Error ? error.message : 'Unknown error'
    job.completed_at = new Date().toISOString()
  }
}

async function executeWorkflow(workflow: string, input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const baseUrl = await getBaseUrl()

  switch (workflow) {
    case 'content_pipeline':
      return executeContentPipeline(input, baseUrl)
    case 'batch_import':
      return executeBatchImport(input, baseUrl)
    case 'seo_refresh':
      return executeSEORefresh(input, baseUrl)
    case 'content_enhance':
      return executeContentEnhance(input)
    case 'cross_post':
      return executeCrossPost(input, baseUrl)
    case 'mcp_sync':
      return executeMCPSync(input)
    default:
      throw new Error(`Unknown workflow: ${workflow}`)
  }
}

async function executeContentPipeline(input: Record<string, unknown>, baseUrl: string) {
  const { url, category = 'community', auto_publish = false } = input as {
    url: string
    category?: string
    auto_publish?: boolean
  }

  if (!url) throw new Error('URL is required')

  // 1. Fetch content
  const response = await fetch(url, {
    headers: { 'User-Agent': `${SITE_NAME}-Workflow/1.0` },
  })
  
  if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`)
  
  const html = await response.text()

  // 2. Extract content
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
  const title = titleMatch?.[1]?.trim() || h1Match?.[1]?.trim() || 'Untitled'
  
  const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
  const description = metaDescMatch?.[1] || ''

  // Simple content extraction
  let content = html.replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 10000)

  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 100)
  const hostname = new URL(url).hostname

  // 3. Generate SEO
  const seo = await generateSEOMetadata({ title, description, content, slug, category }, baseUrl)

  // 4. Generate emoji summary
  const emojiSummary = await generateEmojiSummary(content, title)

  // 5. Insert document
  const doc = await sql`
    INSERT INTO documents (
      tenant_id, slug, title, description, content, content_format,
      source_url, source_identifier, category, status, published_at,
      og_title, og_description, og_image, canonical_url,
      reading_time_minutes, word_count, emoji_summary
    ) VALUES (
      ${DEFAULT_TENANT_ID}, ${slug}, ${title}, ${description}, ${content}, 'markdown',
      ${url}, ${hostname}, ${category},
      ${auto_publish ? 'published' : 'draft'},
      ${auto_publish ? sql`NOW()` : null},
      ${seo.ogTitle}, ${seo.ogDescription}, ${seo.ogImage}, ${seo.canonicalUrl},
      ${seo.readingTimeMinutes}, ${seo.wordCount}, ${emojiSummary.emojis}
    )
    ON CONFLICT (tenant_id, slug) DO UPDATE SET
      content = EXCLUDED.content,
      updated_at = NOW()
    RETURNING id, slug, status
  `

  // 6. Update search index
  const searchText = `${title} ${description} ${content}`
  await sql`
    INSERT INTO search_index (document_id, tenant_id, content_vector)
    VALUES (${doc[0].id}, ${DEFAULT_TENANT_ID}, to_tsvector('english', ${searchText}))
    ON CONFLICT (document_id) DO UPDATE SET
      content_vector = to_tsvector('english', ${searchText}),
      updated_at = NOW()
  `

  return {
    document: doc[0],
    seo: { og_title: seo.ogTitle, og_image: seo.ogImage },
    emoji_summary: emojiSummary.emojis,
    indexed: true,
    url: `${baseUrl}/docs/${doc[0].slug}`,
  }
}

async function executeBatchImport(input: Record<string, unknown>, baseUrl: string) {
  const { urls, category = 'community', source } = input as {
    urls: string[]
    category?: string
    source?: string
  }

  if (!urls?.length) throw new Error('URLs array is required')

  const results = []
  for (const url of urls.slice(0, 20)) {
    try {
      const result = await executeContentPipeline({ url, category, auto_publish: false }, baseUrl)
      results.push({ ...result, url, status: 'success' })
    } catch (error) {
      results.push({ url, status: 'error', error: error instanceof Error ? error.message : 'Failed' })
    }
  }

  return {
    total: urls.length,
    processed: results.length,
    successful: results.filter(r => r.status === 'success').length,
    results,
  }
}

async function executeSEORefresh(input: Record<string, unknown>, baseUrl: string) {
  const { document_ids, category, all } = input as {
    document_ids?: string[]
    category?: string
    all?: boolean
  }

  let documents
  if (all) {
    documents = await sql`
      SELECT id, slug, title, description, content, category
      FROM documents WHERE tenant_id = ${DEFAULT_TENANT_ID} AND deleted_at IS NULL
      LIMIT 100
    `
  } else if (category) {
    documents = await sql`
      SELECT id, slug, title, description, content, category
      FROM documents WHERE tenant_id = ${DEFAULT_TENANT_ID} AND category = ${category} AND deleted_at IS NULL
    `
  } else if (document_ids?.length) {
    documents = await sql`
      SELECT id, slug, title, description, content, category
      FROM documents WHERE tenant_id = ${DEFAULT_TENANT_ID} AND id = ANY(${document_ids}::uuid[]) AND deleted_at IS NULL
    `
  } else {
    throw new Error('Provide document_ids, category, or set all=true')
  }

  let updated = 0
  for (const doc of documents) {
    const seo = await generateSEOMetadata({
      title: doc.title as string,
      description: doc.description as string || '',
      content: doc.content as string,
      slug: doc.slug as string,
      category: doc.category as string,
    }, baseUrl)

    await sql`
      UPDATE documents SET
        og_title = ${seo.ogTitle}, og_description = ${seo.ogDescription},
        og_image = ${seo.ogImage}, canonical_url = ${seo.canonicalUrl},
        reading_time_minutes = ${seo.readingTimeMinutes}, word_count = ${seo.wordCount},
        updated_at = NOW()
      WHERE id = ${doc.id}
    `
    updated++
  }

  return { updated }
}

async function executeContentEnhance(input: Record<string, unknown>) {
  const { document_id } = input as { document_id: string }
  if (!document_id) throw new Error('document_id is required')

  const docs = await sql`
    SELECT id, title, content FROM documents
    WHERE id = ${document_id} AND tenant_id = ${DEFAULT_TENANT_ID}
  `
  
  if (!docs.length) throw new Error('Document not found')
  const doc = docs[0]

  // Parse emoji shortcodes in content
  const enhancedContent = parseEmojiShortcodes(doc.content as string)
  
  // Generate emoji summary
  const emojiSummary = await generateEmojiSummary(doc.content as string, doc.title as string)

  await sql`
    UPDATE documents SET
      content = ${enhancedContent},
      emoji_summary = ${emojiSummary.emojis},
      updated_at = NOW()
    WHERE id = ${document_id}
  `

  return {
    document_id,
    emoji_summary: emojiSummary.emojis,
    content_enhanced: enhancedContent !== doc.content,
  }
}

async function executeCrossPost(input: Record<string, unknown>, baseUrl: string) {
  const { document_id, targets } = input as { document_id: string, targets: string[] }
  if (!document_id || !targets?.length) throw new Error('document_id and targets required')

  const docs = await sql`
    SELECT * FROM documents WHERE id = ${document_id} AND tenant_id = ${DEFAULT_TENANT_ID}
  `
  if (!docs.length) throw new Error('Document not found')
  const doc = docs[0]

  const results = []
  for (const target of targets) {
    const integration = await sql`
      SELECT * FROM integrations
      WHERE tenant_id = ${DEFAULT_TENANT_ID} AND name = ${target} AND enabled = true
    `
    
    if (!integration.length) {
      results.push({ target, status: 'skipped', reason: 'Integration not found or disabled' })
      continue
    }

    try {
      const mcpUrl = `${integration[0].base_url}${integration[0].mcp_path}`
      const response = await fetch(mcpUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: {
            name: 'submit_content',
            arguments: {
              title: doc.title,
              content: doc.content,
              source_url: `${baseUrl}/docs/${doc.slug}`,
              source_identifier: 'docs.platphormnews.com',
            },
          },
        }),
      })

      results.push({
        target,
        status: response.ok ? 'success' : 'failed',
        response_status: response.status,
      })
    } catch (error) {
      results.push({
        target,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return { document_id, cross_posts: results }
}

async function executeMCPSync(input: Record<string, unknown>) {
  const { integration, action } = input as { integration: string, action: string }
  if (!integration) throw new Error('integration name required')

  const integrations = await sql`
    SELECT * FROM integrations
    WHERE tenant_id = ${DEFAULT_TENANT_ID} AND name = ${integration} AND enabled = true
  `
  
  if (!integrations.length) throw new Error(`Integration ${integration} not found`)
  const int = integrations[0]

  const mcpUrl = `${int.base_url}${int.mcp_path}`
  const response = await fetch(mcpUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: action || 'tools/list',
    }),
  })

  const data = await response.json()
  return { integration, action, response: data }
}

async function getBaseUrl(): Promise<string> {
  try {
    const result = await sql`
      SELECT value FROM settings WHERE tenant_id = ${DEFAULT_TENANT_ID} AND key = 'base_url'
    `
    if (result[0]?.value) return JSON.parse(result[0].value as string)
  } catch { /* ignore */ }
  return 'https://docs.platphormnews.com'
}
