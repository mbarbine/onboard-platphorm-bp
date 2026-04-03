import { NextRequest, NextResponse } from 'next/server'
import { sql, DEFAULT_TENANT_ID } from '@/lib/db'
import dns from 'dns/promises'
import { v4 as uuidv4 } from 'uuid'
import { generateSEOMetadata, generateAEOMetadata, generateGEOMetadata } from '@/lib/seo-generator'
import { generateEmojiSummary } from '@/lib/emoji'
import { generateSimpleSlug } from '@/lib/auto-name'
import { logger } from '@/lib/logger'
import { SITE_NAME } from '@/lib/site-config'

async function getBaseUrl(): Promise<string> {
  try {
    const result = await sql`SELECT value FROM settings WHERE tenant_id = ${DEFAULT_TENANT_ID} AND key = 'base_url'`
    if (result[0]?.value) return JSON.parse(result[0].value as string)
  } catch { /* ignore */ }
  return 'https://docs.platphormnews.com'
}

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.hostname
  } catch {
    return 'unknown'
  }
}

function htmlToMarkdown(html: string, sourceUrl?: string): string {
  // Resolve relative URLs to absolute using the source URL
  function resolveUrl(relative: string): string {
    if (!sourceUrl || !relative) return relative
    if (relative.startsWith('http://') || relative.startsWith('https://') || relative.startsWith('data:')) return relative
    try {
      return new URL(relative, sourceUrl).href
    } catch {
      return relative
    }
  }

  // Safely strip all HTML tags from a string, running repeatedly to handle nested/malformed tags
  function stripTags(text: string): string {
    let result = text
    let prev = ''
    // Loop until stable to prevent incomplete sanitization of nested tags
    while (result !== prev) {
      prev = result
      result = result.replace(/<[^>]+>/g, '')
    }
    return result
  }

  // Decode common HTML entities in code block content.
  // Order matters: decode &lt;/&gt; before &amp; to prevent double-decoding &amp;lt; → &lt; → <
  function decodeCodeEntities(text: string): string {
    return text
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
  }

  let md = html
    // Remove scripts, styles, nav, footer, and header elements
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    // Horizontal rules
    .replace(/<hr[^>]*\/?>/gi, '\n\n---\n\n')
    // Headers (use [\s\S]*? for multiline content)
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, content) => `# ${stripTags(content).trim()}\n\n`)
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, content) => `## ${stripTags(content).trim()}\n\n`)
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, content) => `### ${stripTags(content).trim()}\n\n`)
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, (_, content) => `#### ${stripTags(content).trim()}\n\n`)
    .replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, (_, content) => `##### ${stripTags(content).trim()}\n\n`)
    .replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, (_, content) => `###### ${stripTags(content).trim()}\n\n`)
    // Code blocks (pre before code to preserve structure)
    .replace(/<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi, (_, content) => {
      return '```\n' + decodeCodeEntities(content).trim() + '\n```\n\n'
    })
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, content) => {
      return '```\n' + decodeCodeEntities(stripTags(content)).trim() + '\n```\n\n'
    })
    // Inline code
    .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
    // Bold and italic
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*')
    .replace(/<del[^>]*>([\s\S]*?)<\/del>/gi, '~~$1~~')
    .replace(/<s[^>]*>([\s\S]*?)<\/s>/gi, '~~$1~~')
    // Images - resolve relative URLs and handle various attribute orders
    .replace(/<img[^>]*?src="([^"]*)"[^>]*?alt="([^"]*)"[^>]*?\/?>/gi, (_, src, alt) => `![${alt}](${resolveUrl(src)})`)
    .replace(/<img[^>]*?alt="([^"]*)"[^>]*?src="([^"]*)"[^>]*?\/?>/gi, (_, alt, src) => `![${alt}](${resolveUrl(src)})`)
    .replace(/<img[^>]*?src="([^"]*)"[^>]*?\/?>/gi, (_, src) => `![](${resolveUrl(src)})`)
    // Links - resolve relative URLs
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, text) => `[${stripTags(text).trim()}](${resolveUrl(href)})`)
    // Tables
    .replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_, tableContent) => {
      const rows: string[] = []
      const rowMatches = tableContent.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || []
      let isHeader = true
      for (const row of rowMatches) {
        const cells = (row.match(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi) || [])
          .map((cell: string) => stripTags(cell.replace(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/i, '$1')).trim())
        rows.push('| ' + cells.join(' | ') + ' |')
        if (isHeader && (row.includes('<th') || rows.length === 1)) {
          rows.push('| ' + cells.map(() => '---').join(' | ') + ' |')
          isHeader = false
        }
      }
      return '\n' + rows.join('\n') + '\n\n'
    })
    // Paragraphs (multiline)
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n')
    // Lists
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, content) => `- ${stripTags(content).trim()}\n`)
    .replace(/<\/?[uo]l[^>]*>/gi, '\n')
    // Blockquotes
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, content) => {
      const text = stripTags(content).trim()
      return text.split('\n').map((line: string) => `> ${line.trim()}`).join('\n') + '\n\n'
    })
    // Definition lists
    .replace(/<dt[^>]*>([\s\S]*?)<\/dt>/gi, (_, content) => `**${stripTags(content).trim()}**\n`)
    .replace(/<dd[^>]*>([\s\S]*?)<\/dd>/gi, (_, content) => `: ${stripTags(content).trim()}\n\n`)
    // Line breaks
    .replace(/<br\s*\/?>/gi, '\n')
    // Remove remaining HTML tags (loop to handle nested/malformed tags)
    // Decode HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    // Clean up whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  // Final pass: strip any remaining HTML tags that survived conversion
  md = stripTags(md)

  return md
}

function extractTitle(html: string, url: string): string {
  // Try to extract from title tag
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (titleMatch) return titleMatch[1].trim()

  // Try h1
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
  if (h1Match) return h1Match[1].trim()

  // Try og:title
  const ogMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i)
  if (ogMatch) return ogMatch[1].trim()

  // Fallback to URL path
  const path = new URL(url).pathname.split('/').pop() || 'untitled'
  return path.replace(/-/g, ' ').replace(/\.\w+$/, '')
}

function extractDescription(html: string): string | null {
  // Try meta description
  const metaMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i)
  if (metaMatch) return metaMatch[1].trim()

  // Try og:description
  const ogMatch = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i)
  if (ogMatch) return ogMatch[1].trim()

  return null
}

function extractMainContent(html: string): string {
  // Try to find main content areas
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
  if (mainMatch) return mainMatch[1]

  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
  if (articleMatch) return articleMatch[1]

  // Look for common content divs
  const contentMatch = html.match(/<div[^>]*class="[^"]*(?:content|post|entry|article)[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
  if (contentMatch) return contentMatch[1]

  // Fallback to body
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  if (bodyMatch) return bodyMatch[1]

  return html
}

function extractAuthor(html: string): string | null {
  // Try meta author
  const metaMatch = html.match(/<meta[^>]*name="author"[^>]*content="([^"]+)"/i)
  if (metaMatch) return metaMatch[1].trim()

  // Try article:author
  const articleMatch = html.match(/<meta[^>]*property="article:author"[^>]*content="([^"]+)"/i)
  if (articleMatch) return articleMatch[1].trim()

  return null
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url, category, tags = [], auto_publish = false, target_audience } = body

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      )
    }

    // Validate URL
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid URL format' },
        { status: 400 }
      )
    }

    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json(
        { success: false, error: 'Only HTTP and HTTPS URLs are allowed' },
        { status: 400 }
      )
    }

    // Block private/internal IP ranges to prevent SSRF via DNS rebinding / malicious resolution
    const hostname = parsedUrl.hostname.toLowerCase()

    let resolvedIp = hostname
    try {
      const lookupResult = await dns.lookup(hostname)
      resolvedIp = lookupResult.address
    } catch {
      // If DNS lookup fails, proceed and let fetch handle the resolution error,
      // but still run patterns against the hostname.
    }

    const blockedPatterns = [
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

    if (
      blockedPatterns.some(pattern => pattern.test(hostname)) ||
      blockedPatterns.some(pattern => pattern.test(resolvedIp))
    ) {
      return NextResponse.json(
        { success: false, error: 'URLs pointing to internal or private networks are not allowed' },
        { status: 400 }
      )
    }

    // Validate tags if provided
    if (!Array.isArray(tags)) {
      return NextResponse.json(
        { success: false, error: 'Tags must be an array' },
        { status: 400 }
      )
    }

    if (tags.length > 20) {
      return NextResponse.json(
        { success: false, error: 'Maximum of 20 tags allowed' },
        { status: 400 }
      )
    }

    // Fetch the URL content
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000) // 30s timeout
    let fetchResponse: Response
    try {
      fetchResponse = await fetch(url, {
        headers: {
          'User-Agent': `${SITE_NAME} Ingestion Bot/1.0`,
          'Accept': 'text/html,application/xhtml+xml,text/markdown,text/plain,application/json'
        },
        redirect: 'follow',
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }

    if (!fetchResponse.ok) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Failed to fetch URL: ${fetchResponse.status} ${fetchResponse.statusText}` 
        },
        { status: 400 }
      )
    }

    const contentType = fetchResponse.headers.get('content-type') || ''
    const rawContent = await fetchResponse.text()

    // Limit content size to 5MB
    const MAX_CONTENT_SIZE = 5 * 1024 * 1024
    if (rawContent.length > MAX_CONTENT_SIZE) {
      return NextResponse.json(
        { success: false, error: 'Content exceeds maximum size of 5MB' },
        { status: 400 }
      )
    }
    
    let title: string
    let content: string
    let description: string | null = null
    let author: string | null = null
    let contentFormat = 'markdown'

    if (contentType.includes('text/html') || contentType.includes('application/xhtml')) {
      // HTML content
      title = extractTitle(rawContent, url)
      description = extractDescription(rawContent)
      author = extractAuthor(rawContent)
      const mainContent = extractMainContent(rawContent)
      content = htmlToMarkdown(mainContent, url)
    } else if (contentType.includes('text/markdown') || url.endsWith('.md')) {
      // Markdown content
      content = rawContent
      // Try to extract title from first heading
      const h1Match = content.match(/^#\s+(.+)$/m)
      title = h1Match ? h1Match[1] : parsedUrl.pathname.split('/').pop() || 'Untitled'
    } else if (contentType.includes('application/json')) {
      // JSON content - try to extract structured data
      try {
        const json = JSON.parse(rawContent)
        title = json.title || json.name || 'Untitled'
        content = json.content || json.body || json.text || JSON.stringify(json, null, 2)
        description = json.description || json.summary
        author = json.author?.name || json.author
        if (typeof content === 'object') {
          content = '```json\n' + JSON.stringify(content, null, 2) + '\n```'
        }
      } catch {
        title = 'JSON Document'
        content = '```json\n' + rawContent + '\n```'
      }
    } else {
      // Plain text or unknown
      content = rawContent
      title = parsedUrl.pathname.split('/').pop() || 'Untitled'
    }

    // Generate slug using shared auto-naming
    const uniqueSlug = generateSimpleSlug(title)

    const sourceIdentifier = extractDomain(url)
    const status = auto_publish ? 'published' : 'draft'
    const publishedAt = auto_publish ? new Date().toISOString() : null

    // Ensure category exists in the categories table
    const docCategory = category || 'community'
    try {
      const existingCat = await sql`
        SELECT id FROM categories WHERE tenant_id = ${DEFAULT_TENANT_ID} AND slug = ${docCategory}
      `
      if (existingCat.length === 0) {
        const categoryName = docCategory.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
        await sql`
          INSERT INTO categories (id, tenant_id, slug, name, description, order_index, metadata)
          VALUES (${uuidv4()}, ${DEFAULT_TENANT_ID}, ${docCategory}, ${categoryName}, ${`Auto-created category for ${categoryName} content`}, 100, '{}')
        `
      }
    } catch (catError) {
      // Category creation is best-effort; log and continue with document insertion
      logger.warn('Category auto-creation failed', { error: catError instanceof Error ? catError : String(catError) })
    }

    // Generate SEO metadata
    const baseUrl = await getBaseUrl()
    const seo = await generateSEOMetadata({
      title,
      description: description || '',
      content,
      slug: uniqueSlug,
      category: docCategory,
    }, baseUrl)

    // Generate AEO + GEO metadata (injected by default)
    const docMeta = { title, slug: uniqueSlug, content, description: description || '', category: docCategory }
    const aeo = generateAEOMetadata(docMeta)
    const geo = generateGEOMetadata(docMeta)

    // Generate emoji summary
    const emojiSummary = await generateEmojiSummary(content, title)

    // Insert into database
    const result = await sql`
      INSERT INTO documents (
        id,
        tenant_id,
        slug,
        title,
        description,
        content,
        content_format,
        source_url,
        source_identifier,
        author_name,
        category,
        tags,
        status,
        published_at,
        metadata,
        og_title,
        og_description,
        og_image,
        canonical_url,
        reading_time_minutes,
        word_count,
        emoji_summary,
        target_audience,
        created_at,
        updated_at
      ) VALUES (
        ${uuidv4()},
        ${DEFAULT_TENANT_ID},
        ${uniqueSlug},
        ${title},
        ${description},
        ${content},
        ${contentFormat},
        ${url},
        ${sourceIdentifier},
        ${author},
        ${docCategory},
        ${JSON.stringify(tags)},
        ${status},
        ${publishedAt},
        ${JSON.stringify({
          ingested_at: new Date().toISOString(),
          original_url: url,
          content_type: contentType,
          content_length: rawContent.length,
          aeo: { questions: aeo.questions, direct_answer: aeo.directAnswer },
          geo: { summary: geo.summary, key_facts: geo.keyFacts, citation_label: geo.citationLabel, topic_tags: geo.topicTags },
        })},
        ${seo.ogTitle},
        ${seo.ogDescription},
        ${seo.ogImage},
        ${seo.canonicalUrl},
        ${seo.readingTimeMinutes},
        ${seo.wordCount},
        ${emojiSummary.emojis},
        ${target_audience || null},
        NOW(),
        NOW()
      )
      RETURNING id, slug, title, status, source_url, source_identifier, created_at
    `

    // Update search index
    if (result.length > 0) {
      await sql`
        INSERT INTO search_index (document_id, tenant_id, content_vector)
        VALUES (
          ${result[0].id},
          ${DEFAULT_TENANT_ID},
          to_tsvector('english', ${title + ' ' + (description || '') + ' ' + content})
        )
      `
    }

    return NextResponse.json({
      success: true,
      data: {
        id: result[0].id,
        slug: result[0].slug,
        title: result[0].title,
        status: result[0].status,
        source_url: result[0].source_url,
        source_identifier: result[0].source_identifier,
        created_at: result[0].created_at,
        message: auto_publish 
          ? 'Document ingested and published successfully'
          : 'Document ingested as draft. Review and publish when ready.'
      }
    }, { status: 201 })

  } catch (error) {
    logger.error('Ingest error', { error: error instanceof Error ? error : String(error) })
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to ingest URL',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/v1/ingest',
    method: 'POST',
    description: 'Ingest content from an external URL',
    body: {
      url: { type: 'string', required: true, description: 'URL to fetch and ingest' },
      category: { type: 'string', required: false, description: 'Category slug for the document' },
      tags: { type: 'array', required: false, description: 'Tags for the document' },
      auto_publish: { type: 'boolean', required: false, default: false, description: 'Publish immediately or save as draft' },
      target_audience: { type: 'string', required: false, description: 'Target audience (developers, beginners, designers, business, everyone)' }
    },
    example: {
      url: 'https://example.com/blog/post',
      category: 'guides',
      tags: ['tutorial', 'external'],
      auto_publish: false,
      target_audience: 'developers'
    }
  })
}
