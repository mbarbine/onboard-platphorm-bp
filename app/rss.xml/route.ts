import { NextResponse } from 'next/server'
import { sql, DEFAULT_TENANT_ID, Document } from '@/lib/db'
import { SITE_NAME, SITE_DESCRIPTION, BASE_URL as DEFAULT_BASE_URL } from '@/lib/site-config'

export const dynamic = 'force-dynamic'

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

async function getBaseUrl(): Promise<string> {
  try {
    const result = await sql`SELECT value FROM settings WHERE tenant_id = ${DEFAULT_TENANT_ID} AND key = 'base_url'`
    if (result[0]?.value) return JSON.parse(result[0].value as string)
  } catch { /* ignore */ }
  return DEFAULT_BASE_URL
}

export async function GET() {
  const baseUrl = await getBaseUrl()
  
  let documents: Document[] = []
  
  try {
    documents = await sql`
      SELECT slug, title, description, content, category, author_name, source_identifier, published_at, updated_at
      FROM documents
      WHERE tenant_id = ${DEFAULT_TENANT_ID}
        AND deleted_at IS NULL
        AND status = 'published'
      ORDER BY published_at DESC NULLS LAST
      LIMIT 50
    ` as Document[]
  } catch (error) {
    console.error('Error fetching data for RSS:', error)
  }

  const lastBuildDate = documents.length > 0 
    ? new Date(documents[0].published_at || documents[0].updated_at).toUTCString()
    : new Date().toUTCString()

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(SITE_NAME)}</title>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <link>${baseUrl}</link>
    <atom:link href="${baseUrl}/rss.xml" rel="self" type="application/rss+xml"/>
    <language>en-us</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <generator>${escapeXml(SITE_NAME)}</generator>
`

  for (const doc of documents) {
    const pubDate = doc.published_at 
      ? new Date(doc.published_at).toUTCString()
      : new Date(doc.created_at).toUTCString()
    
    const description = doc.description || doc.content.slice(0, 300) + '...'
    
    xml += `    <item>
      <title>${escapeXml(doc.title)}</title>
      <link>${baseUrl}/docs/${doc.slug}</link>
      <guid isPermaLink="true">${baseUrl}/docs/${doc.slug}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(description)}</description>
${doc.author_name ? `      <author>${escapeXml(doc.author_name)}</author>` : ''}
${doc.category ? `      <category>${escapeXml(doc.category)}</category>` : ''}
${doc.source_identifier ? `      <source url="${doc.source_url || ''}">${escapeXml(doc.source_identifier)}</source>` : ''}
    </item>
`
  }

  xml += `  </channel>
</rss>`

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/rss+xml',
      'Cache-Control': 'public, max-age=1800',
    },
  })
}
