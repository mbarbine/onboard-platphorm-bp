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

export async function GET() {
  const baseUrl = await getBaseUrl()
  
  let documents: Document[] = []
  let categories: Category[] = []
  
  try {
    documents = await sql`
      SELECT id, slug, title, description, category, tags, author_name, source_identifier, published_at, updated_at
      FROM documents
      WHERE tenant_id = ${DEFAULT_TENANT_ID}
        AND deleted_at IS NULL
        AND status = 'published'
      ORDER BY category, title
    ` as Document[]
    
    categories = await sql`
      SELECT id, slug, name, description
      FROM categories
      WHERE tenant_id = ${DEFAULT_TENANT_ID}
      ORDER BY order_index, name
    ` as Category[]
  } catch (error) {
    console.error('Error fetching data for llms-index.json:', error)
  }

  const index = {
    name: 'OpenDocs',
    description: 'AI-native documentation platform with MCP integration',
    version: '1.0.0',
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    
    stats: {
      total_documents: documents.length,
      total_categories: categories.length,
      unique_sources: [...new Set(documents.map(d => d.source_identifier).filter(Boolean))].length,
    },
    
    endpoints: {
      api: {
        documents: `${baseUrl}/api/v1/documents`,
        search: `${baseUrl}/api/v1/search`,
        submissions: `${baseUrl}/api/v1/submissions`,
        categories: `${baseUrl}/api/v1/categories`,
      },
      mcp: `${baseUrl}/api/mcp`,
      discovery: {
        llms_txt: `${baseUrl}/llms.txt`,
        llms_full: `${baseUrl}/llms-full.txt`,
        llms_index: `${baseUrl}/llms-index.json`,
        sitemap: `${baseUrl}/sitemap.xml`,
        rss: `${baseUrl}/rss.xml`,
      },
    },
    
    mcp: {
      protocol_version: '2024-11-05',
      tools: [
        { name: 'list_documents', description: 'List documentation with filtering' },
        { name: 'get_document', description: 'Get a document by slug' },
        { name: 'search_docs', description: 'Full-text search' },
        { name: 'list_categories', description: 'List categories' },
        { name: 'create_submission', description: 'Submit content' },
        { name: 'get_api_schema', description: 'Get OpenAPI schema' },
      ],
      resources: [
        { uri: 'docs://index', name: 'Documentation Index' },
        { uri: 'docs://categories', name: 'Categories' },
        { uri: 'docs://recent', name: 'Recent Documents' },
      ],
      prompts: [
        { name: 'explain_doc', description: 'Explain a document' },
        { name: 'summarize_category', description: 'Summarize a category' },
        { name: 'compare_docs', description: 'Compare two documents' },
      ],
    },
    
    categories: categories.map(cat => ({
      id: cat.id,
      slug: cat.slug,
      name: cat.name,
      description: cat.description,
      url: `${baseUrl}/docs/category/${cat.slug}`,
    })),
    
    documents: documents.map(doc => ({
      id: doc.id,
      slug: doc.slug,
      title: doc.title,
      description: doc.description,
      category: doc.category,
      tags: doc.tags,
      author: doc.author_name,
      source: doc.source_identifier,
      url: `${baseUrl}/docs/${doc.slug}`,
      api_url: `${baseUrl}/api/v1/documents/${doc.slug}`,
      published_at: doc.published_at,
      updated_at: doc.updated_at,
    })),
    
    authentication: {
      type: 'bearer',
      header: 'Authorization',
      format: 'Bearer od_your_api_key_here',
      scopes: ['read', 'write', 'admin'],
      bootstrap_endpoint: `${baseUrl}/api/v1/keys`,
    },
    
    webhooks: {
      events: [
        'document.created',
        'document.updated',
        'document.deleted',
        'submission.created',
        'submission.approved',
        'submission.rejected',
      ],
      signature_header: 'X-OpenDocs-Signature',
      signature_format: 'sha256={hmac}',
    },
  }

  return NextResponse.json(index, {
    headers: {
      'Cache-Control': 'public, max-age=1800',
    },
  })
}
