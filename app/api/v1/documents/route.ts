import { NextRequest } from 'next/server'
import { sql, DEFAULT_TENANT_ID, Document } from '@/lib/db'
import {
  apiResponse,
  apiError,
  validateApiKey,
  hasScope,
  getPaginationParams,
  generateSlug,
  triggerWebhooks,
  updateSearchIndex,
  logAudit,
} from '@/lib/api-helpers'
import { DocumentCreateInput } from '@/lib/api-types'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const { page, per_page, offset } = getPaginationParams(searchParams)
  
  const status = searchParams.get('status') || 'published'
  const category = searchParams.get('category')
  const search = searchParams.get('q')
  const tag = searchParams.get('tag')

  // Validate status parameter
  const validStatuses = ['published', 'draft', 'archived']
  if (!validStatuses.includes(status)) {
    return apiError('VALIDATION_ERROR', `Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400)
  }

  try {
    let documents: Document[]
    let totalResult: { count: number }[]

    if (search) {
      // Full-text search
      documents = await sql`
        SELECT d.* FROM documents d
        JOIN search_index si ON d.id = si.document_id
        WHERE d.tenant_id = ${DEFAULT_TENANT_ID}
          AND d.deleted_at IS NULL
          AND d.status = ${status}
          AND si.content_vector @@ plainto_tsquery('english', ${search})
        ORDER BY ts_rank(si.content_vector, plainto_tsquery('english', ${search})) DESC
        LIMIT ${per_page} OFFSET ${offset}
      ` as Document[]

      totalResult = await sql`
        SELECT COUNT(*)::int as count FROM documents d
        JOIN search_index si ON d.id = si.document_id
        WHERE d.tenant_id = ${DEFAULT_TENANT_ID}
          AND d.deleted_at IS NULL
          AND d.status = ${status}
          AND si.content_vector @@ plainto_tsquery('english', ${search})
      ` as { count: number }[]
    } else if (category) {
      documents = await sql`
        SELECT * FROM documents 
        WHERE tenant_id = ${DEFAULT_TENANT_ID}
          AND deleted_at IS NULL
          AND status = ${status}
          AND category = ${category}
        ORDER BY created_at DESC
        LIMIT ${per_page} OFFSET ${offset}
      ` as Document[]

      totalResult = await sql`
        SELECT COUNT(*)::int as count FROM documents 
        WHERE tenant_id = ${DEFAULT_TENANT_ID}
          AND deleted_at IS NULL
          AND status = ${status}
          AND category = ${category}
      ` as { count: number }[]
    } else if (tag) {
      documents = await sql`
        SELECT * FROM documents 
        WHERE tenant_id = ${DEFAULT_TENANT_ID}
          AND deleted_at IS NULL
          AND status = ${status}
          AND tags @> ${JSON.stringify([tag])}::jsonb
        ORDER BY created_at DESC
        LIMIT ${per_page} OFFSET ${offset}
      ` as Document[]

      totalResult = await sql`
        SELECT COUNT(*)::int as count FROM documents 
        WHERE tenant_id = ${DEFAULT_TENANT_ID}
          AND deleted_at IS NULL
          AND status = ${status}
          AND tags @> ${JSON.stringify([tag])}::jsonb
      ` as { count: number }[]
    } else {
      documents = await sql`
        SELECT * FROM documents 
        WHERE tenant_id = ${DEFAULT_TENANT_ID}
          AND deleted_at IS NULL
          AND status = ${status}
        ORDER BY created_at DESC
        LIMIT ${per_page} OFFSET ${offset}
      ` as Document[]

      totalResult = await sql`
        SELECT COUNT(*)::int as count FROM documents 
        WHERE tenant_id = ${DEFAULT_TENANT_ID}
          AND deleted_at IS NULL
          AND status = ${status}
      ` as { count: number }[]
    }

    const total = totalResult[0]?.count || 0

    return apiResponse(documents, {
      page,
      per_page,
      total,
      total_pages: Math.ceil(total / per_page),
    })
  } catch (error) {
    console.error('Error fetching documents:', error)
    return apiError('FETCH_ERROR', 'Failed to fetch documents', 500)
  }
}

export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request)
  
  if (!auth.valid) {
    return apiError('UNAUTHORIZED', 'Invalid or missing API key', 401)
  }

  if (!hasScope(auth.scopes, 'write')) {
    return apiError('FORBIDDEN', 'Insufficient permissions', 403)
  }

  try {
    const body: DocumentCreateInput = await request.json()

    if (!body.title || !body.content) {
      return apiError('VALIDATION_ERROR', 'Title and content are required', 400)
    }

    const slug = body.slug || generateSlug(body.title)
    
    // Check for slug collision
    const existing = await sql`
      SELECT id FROM documents WHERE tenant_id = ${auth.tenantId} AND slug = ${slug}
    `
    
    if (existing.length > 0) {
      return apiError('CONFLICT', 'A document with this slug already exists', 409)
    }

    const result = await sql`
      INSERT INTO documents (
        tenant_id, slug, title, description, content, content_format,
        source_url, source_identifier, author_name, author_email, author_url,
        category, tags, metadata, status, published_at
      ) VALUES (
        ${auth.tenantId},
        ${slug},
        ${body.title},
        ${body.description || null},
        ${body.content},
        ${body.content_format || 'markdown'},
        ${body.source_url || null},
        ${body.source_identifier || null},
        ${body.author_name || null},
        ${body.author_email || null},
        ${body.author_url || null},
        ${body.category || null},
        ${JSON.stringify(body.tags || [])},
        ${JSON.stringify(body.metadata || {})},
        ${body.status || 'draft'},
        ${body.status === 'published' ? new Date().toISOString() : null}
      )
      RETURNING *
    ` as Document[]

    const document = result[0]

    // Update search index
    await updateSearchIndex(
      document.id,
      auth.tenantId,
      document.title,
      document.content,
      document.description
    )

    // Log audit
    await logAudit(
      auth.tenantId,
      'document.created',
      'document',
      document.id,
      null,
      'api_key',
      { slug: document.slug },
      request.headers.get('x-forwarded-for'),
      request.headers.get('user-agent')
    )

    // Trigger webhooks
    await triggerWebhooks(auth.tenantId, 'document.created', {
      document: {
        id: document.id,
        slug: document.slug,
        title: document.title,
        status: document.status,
      },
    })

    return apiResponse(document, undefined, 201)
  } catch (error) {
    console.error('Error creating document:', error)
    return apiError('CREATE_ERROR', 'Failed to create document', 500)
  }
}
