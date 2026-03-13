import { NextRequest } from 'next/server'
import { sql, Submission, Document } from '@/lib/db'
import {
  apiResponse,
  apiError,
  validateApiKey,
  hasScope,
  generateSlug,
  triggerWebhooks,
  updateSearchIndex,
  logAudit,
} from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await validateApiKey(request)

  if (!auth.valid) {
    return apiError('UNAUTHORIZED', 'Invalid or missing API key', 401)
  }

  try {
    const submissions = await sql`
      SELECT * FROM submissions 
      WHERE tenant_id = ${auth.tenantId}
        AND id = ${id}
    ` as Submission[]

    if (submissions.length === 0) {
      return apiError('NOT_FOUND', 'Submission not found', 404)
    }

    return apiResponse(submissions[0])
  } catch (error) {
    console.error('Error fetching submission:', error)
    return apiError('FETCH_ERROR', 'Failed to fetch submission', 500)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await validateApiKey(request)

  if (!auth.valid) {
    return apiError('UNAUTHORIZED', 'Invalid or missing API key', 401)
  }

  if (!hasScope(auth.scopes, 'write')) {
    return apiError('FORBIDDEN', 'Insufficient permissions', 403)
  }

  try {
    const body = await request.json()
    const action = body.action as 'approve' | 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return apiError('VALIDATION_ERROR', 'action must be approve or reject', 400)
    }

    // Get submission
    const submissions = await sql`
      SELECT * FROM submissions 
      WHERE tenant_id = ${auth.tenantId}
        AND id = ${id}
        AND status = 'pending'
    ` as Submission[]

    if (submissions.length === 0) {
      return apiError('NOT_FOUND', 'Pending submission not found', 404)
    }

    const submission = submissions[0]

    if (action === 'reject') {
      await sql`
        UPDATE submissions SET
          status = 'rejected',
          reviewed_at = NOW(),
          reviewed_by = 'api',
          updated_at = NOW()
        WHERE id = ${id}
      `

      await logAudit(
        auth.tenantId,
        'submission.rejected',
        'submission',
        id,
        null,
        'api_key',
        { reason: body.reason },
        request.headers.get('x-forwarded-for'),
        request.headers.get('user-agent')
      )

      return apiResponse({ status: 'rejected', submission_id: id })
    }

    // Approve - create document from submission
    const slug =
      body.slug ||
      generateSlug(submission.title) + '-' + submission.source_identifier

    // Check for slug collision
    const existing = await sql`
      SELECT id FROM documents WHERE tenant_id = ${auth.tenantId} AND slug = ${slug}
    `

    if (existing.length > 0) {
      return apiError(
        'CONFLICT',
        'A document with this slug already exists. Provide a unique slug.',
        409
      )
    }

    const category = body.category || submission.source_identifier

    const result = await sql`
      INSERT INTO documents (
        tenant_id, slug, title, description, content, content_format,
        source_url, source_identifier, author_name, author_email,
        category, tags, metadata, status, published_at
      ) VALUES (
        ${auth.tenantId},
        ${slug},
        ${submission.title},
        ${body.description || null},
        ${submission.content},
        ${submission.content_format},
        ${submission.source_url},
        ${submission.source_identifier},
        ${submission.author_name},
        ${submission.author_email},
        ${category},
        ${JSON.stringify(body.tags || [])},
        ${JSON.stringify({ ...submission.metadata, submission_id: submission.id })},
        ${body.publish_immediately ? 'published' : 'draft'},
        ${body.publish_immediately ? new Date().toISOString() : null}
      )
      RETURNING *
    ` as Document[]

    const document = result[0]

    // Update submission
    await sql`
      UPDATE submissions SET
        status = 'approved',
        reviewed_at = NOW(),
        reviewed_by = 'api',
        document_id = ${document.id},
        updated_at = NOW()
      WHERE id = ${id}
    `

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
      'submission.approved',
      'submission',
      id,
      null,
      'api_key',
      { document_id: document.id, slug: document.slug },
      request.headers.get('x-forwarded-for'),
      request.headers.get('user-agent')
    )

    // Trigger webhooks
    await triggerWebhooks(auth.tenantId, 'submission.approved', {
      submission: {
        id: submission.id,
        source_url: submission.source_url,
      },
      document: {
        id: document.id,
        slug: document.slug,
        title: document.title,
        status: document.status,
      },
    })

    return apiResponse({
      status: 'approved',
      submission_id: id,
      document: {
        id: document.id,
        slug: document.slug,
        title: document.title,
        status: document.status,
      },
    })
  } catch (error) {
    console.error('Error reviewing submission:', error)
    return apiError('REVIEW_ERROR', 'Failed to review submission', 500)
  }
}
