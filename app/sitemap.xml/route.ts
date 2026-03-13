import { NextResponse } from 'next/server'
import { sql, DEFAULT_TENANT_ID, Document, Category } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function getBaseUrl(): Promise<string> {
  try {
    const result = await sql`SELECT value FROM settings WHERE tenant_id = ${DEFAULT_TENANT_ID} AND key = 'base_url'`
    if (result[0]?.value) return JSON.parse(result[0].value as string)
  } catch { /* ignore */ }
  return process.env.NEXT_PUBLIC_BASE_URL || 'https://docs.platphormnews.com'
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function GET() {
  const baseUrl = await getBaseUrl()
  const now = new Date().toISOString()
  
  let documents: Document[] = []
  let categories: (Category & { document_count?: number })[] = []
  
  try {
    documents = await sql`
      SELECT slug, title, description, updated_at, published_at, category
      FROM documents
      WHERE tenant_id = ${DEFAULT_TENANT_ID}
        AND deleted_at IS NULL
        AND status = 'published'
      ORDER BY updated_at DESC
    ` as Document[]
    
    categories = await sql`
      SELECT c.slug, c.name, c.updated_at,
        (SELECT COUNT(*)::int FROM documents d WHERE d.category = c.slug AND d.deleted_at IS NULL AND d.status = 'published') as document_count
      FROM categories c
      WHERE c.tenant_id = ${DEFAULT_TENANT_ID}
      ORDER BY c.order_index ASC, c.name ASC
    ` as (Category & { document_count?: number })[]
  } catch (error) {
    console.error('Error fetching data for sitemap:', error)
  }

  // Determine most recent document update for static page lastmod
  const latestDocUpdate = documents.length > 0
    ? new Date(documents[0].updated_at).toISOString()
    : now

  const staticPages = [
    { url: '', priority: 1.0, changefreq: 'daily', lastmod: latestDocUpdate },
    { url: '/docs', priority: 0.9, changefreq: 'daily', lastmod: latestDocUpdate },
    { url: '/docs/api', priority: 0.8, changefreq: 'weekly', lastmod: now },
    { url: '/docs/mcp', priority: 0.8, changefreq: 'weekly', lastmod: now },
    { url: '/submit', priority: 0.5, changefreq: 'monthly', lastmod: now },
    { url: '/search', priority: 0.5, changefreq: 'daily', lastmod: now },
    { url: '/settings', priority: 0.3, changefreq: 'monthly', lastmod: now },
    { url: '/llms.txt', priority: 0.4, changefreq: 'daily', lastmod: latestDocUpdate },
    { url: '/rss.xml', priority: 0.4, changefreq: 'daily', lastmod: latestDocUpdate },
  ]

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
`

  // Static pages
  for (const page of staticPages) {
    xml += `  <url>
    <loc>${baseUrl}${page.url}</loc>
    <lastmod>${page.lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>
`
  }

  // Category pages
  for (const category of categories) {
    if ((category.document_count ?? 0) === 0) continue
    xml += `  <url>
    <loc>${baseUrl}/docs/category/${escapeXml(category.slug)}</loc>
    <lastmod>${new Date(category.updated_at).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
`
  }

  // Document pages — each doc gets its own entry with lastmod and OG image for AEO/GEO
  for (const doc of documents) {
    const lastmod = doc.updated_at || doc.published_at || new Date()
    const docTitle = escapeXml(doc.title || '')
    xml += `  <url>
    <loc>${baseUrl}/docs/${escapeXml(doc.slug)}</loc>
    <lastmod>${new Date(lastmod).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
    <image:image>
      <image:loc>${baseUrl}/api/og?title=${encodeURIComponent(doc.title || '')}</image:loc>
      <image:title>${docTitle}</image:title>
    </image:image>
  </url>
`
  }

  xml += `</urlset>`

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
