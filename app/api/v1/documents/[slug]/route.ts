import { NextRequest } from 'next/server'
import { sql, DEFAULT_TENANT_ID, Document } from '@/lib/db'
import {
  apiResponse,
  apiError,
  validateApiKey,
  hasScope,
  triggerWebhooks,
  updateSearchIndex,
  logAudit,
} from '@/lib/api-helpers'
import { DocumentUpdateInput } from '@/lib/api-types'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  try {
    const documents = await sql`
      SELECT * FROM documents 
      WHERE tenant_id = ${DEFAULT_TENANT_ID}
        AND slug = ${slug}
        AND deleted_at IS NULL
    ` as Document[]

    if (documents.length === 0) {
      return apiError('NOT_FOUND', 'Document not found', 404)
    }

    return apiResponse(documents[0])
  } catch (error) {
    console.error('Error fetching document:', error)
    return apiError('FETCH_ERROR', 'Failed to fetch document', 500)
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const auth = await validateApiKey(request)

  if (!auth.valid) {
    return apiError('UNAUTHORIZED', 'Invalid or missing API key', 401)
  }

  if (!hasScope(auth.scopes, 'write')) {
    return apiError('FORBIDDEN', 'Insufficient permissions', 403)
  }

  try {
    const body: DocumentUpdateInput = await request.json()

    // Get existing document
    const existing = await sql`
      SELECT * FROM documents 
      WHERE tenant_id = ${auth.tenantId}
        AND slug = ${slug}
        AND deleted_at IS NULL
    ` as Document[]

    if (existing.length === 0) {
      return apiError('NOT_FOUND', 'Document not found', 404)
    }

    const doc = existing[0]

    // Store version
    await sql`
      INSERT INTO document_versions (document_id, version, title, content, metadata, created_by)
      VALUES (${doc.id}, ${doc.version}, ${doc.title}, ${doc.content}, ${JSON.stringify(doc.metadata)}, 'api')
    `

    // Update document
    const result = await sql`
      UPDATE documents SET
        title = COALESCE(${body.title || null}, title),
        description = COALESCE(${body.description || null}, description),
        content = COALESCE(${body.content || null}, content),
        content_format = COALESCE(${body.content_format || null}, content_format),
        source_url = COALESCE(${body.source_url || null}, source_url),
        author_name = COALESCE(${body.author_name || null}, author_name),
        author_email = COALESCE(${body.author_email || null}, author_email),
        author_url = COALESCE(${body.author_url || null}, author_url),
        category = COALESCE(${body.category || null}, category),
        tags = COALESCE(${body.tags ? JSON.stringify(body.tags) : null}::jsonb, tags),
        metadata = COALESCE(${body.metadata ? JSON.stringify(body.metadata) : null}::jsonb, metadata),
        status = COALESCE(${body.status || null}, status),
        published_at = CASE 
          WHEN ${body.status || null} = 'published' AND published_at IS NULL THEN NOW()
          ELSE published_at
        END,
        version = version + 1,
        updated_at = NOW()
      WHERE tenant_id = ${auth.tenantId}
        AND slug = ${slug}
        AND deleted_at IS NULL
      RETURNING *
    ` as Document[]

    const updated = result[0]

    // Update search index
    await updateSearchIndex(
      updated.id,
      auth.tenantId,
      updated.title,
      updated.content,
      updated.description
    )

    // Log audit
    await logAudit(
      auth.tenantId,
      'document.updated',
      'document',
      updated.id,
      null,
      'api_key',
      { slug: updated.slug, version: updated.version },
      request.headers.get('x-forwarded-for'),
      request.headers.get('user-agent')
    )

    // Trigger webhooks
    await triggerWebhooks(auth.tenantId, 'document.updated', {
      document: {
        id: updated.id,
        slug: updated.slug,
        title: updated.title,
        status: updated.status,
        version: updated.version,
      },
    })

    return apiResponse(updated)
  } catch (error) {
    console.error('Error updating document:', error)
    return apiError('UPDATE_ERROR', 'Failed to update document', 500)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const auth = await validateApiKey(request)

  if (!auth.valid) {
    return apiError('UNAUTHORIZED', 'Invalid or missing API key', 401)
  }

  if (!hasScope(auth.scopes, 'admin')) {
    return apiError('FORBIDDEN', 'Insufficient permissions', 403)
  }

  try {
    const result = await sql`
      UPDATE documents SET deleted_at = NOW()
      WHERE tenant_id = ${auth.tenantId}
        AND slug = ${slug}
        AND deleted_at IS NULL
      RETURNING id, slug, title
    ` as { id: string; slug: string; title: string }[]

    if (result.length === 0) {
      return apiError('NOT_FOUND', 'Document not found', 404)
    }

    const deleted = result[0]

    // Log audit
    await logAudit(
      auth.tenantId,
      'document.deleted',
      'document',
      deleted.id,
      null,
      'api_key',
      { slug: deleted.slug },
      request.headers.get('x-forwarded-for'),
      request.headers.get('user-agent')
    )

    // Trigger webhooks
    await triggerWebhooks(auth.tenantId, 'document.deleted', {
      document: { id: deleted.id, slug: deleted.slug, title: deleted.title },
    })

    return apiResponse({ deleted: true, id: deleted.id })
  } catch (error) {
    console.error('Error deleting document:', error)
    return apiError('DELETE_ERROR', 'Failed to delete document', 500)
  }
}
