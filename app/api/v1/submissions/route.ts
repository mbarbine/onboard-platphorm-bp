import { NextRequest } from 'next/server'
import { sql, DEFAULT_TENANT_ID, Submission } from '@/lib/db'
import {
  apiResponse,
  apiError,
  validateApiKey,
  hasScope,
  getPaginationParams,
  triggerWebhooks,
  logAudit,
} from '@/lib/api-helpers'
import { SubmissionCreateInput } from '@/lib/api-types'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request)

  if (!auth.valid) {
    return apiError('UNAUTHORIZED', 'Invalid or missing API key', 401)
  }

  if (!hasScope(auth.scopes, 'read')) {
    return apiError('FORBIDDEN', 'Insufficient permissions', 403)
  }

  const { searchParams } = new URL(request.url)
  const { page, per_page, offset } = getPaginationParams(searchParams)
  const status = searchParams.get('status')
  const sourceUrl = searchParams.get('source_url')

  try {
    let submissions: Submission[]
    let totalResult: { count: number }[]

    if (status && sourceUrl) {
      submissions = await sql`
        SELECT * FROM submissions 
        WHERE tenant_id = ${auth.tenantId}
          AND status = ${status}
          AND source_url = ${sourceUrl}
        ORDER BY created_at DESC
        LIMIT ${per_page} OFFSET ${offset}
      ` as Submission[]

      totalResult = await sql`
        SELECT COUNT(*)::int as count FROM submissions 
        WHERE tenant_id = ${auth.tenantId}
          AND status = ${status}
          AND source_url = ${sourceUrl}
      ` as { count: number }[]
    } else if (status) {
      submissions = await sql`
        SELECT * FROM submissions 
        WHERE tenant_id = ${auth.tenantId}
          AND status = ${status}
        ORDER BY created_at DESC
        LIMIT ${per_page} OFFSET ${offset}
      ` as Submission[]

      totalResult = await sql`
        SELECT COUNT(*)::int as count FROM submissions 
        WHERE tenant_id = ${auth.tenantId}
          AND status = ${status}
      ` as { count: number }[]
    } else if (sourceUrl) {
      submissions = await sql`
        SELECT * FROM submissions 
        WHERE tenant_id = ${auth.tenantId}
          AND source_url = ${sourceUrl}
        ORDER BY created_at DESC
        LIMIT ${per_page} OFFSET ${offset}
      ` as Submission[]

      totalResult = await sql`
        SELECT COUNT(*)::int as count FROM submissions 
        WHERE tenant_id = ${auth.tenantId}
          AND source_url = ${sourceUrl}
      ` as { count: number }[]
    } else {
      submissions = await sql`
        SELECT * FROM submissions 
        WHERE tenant_id = ${auth.tenantId}
        ORDER BY created_at DESC
        LIMIT ${per_page} OFFSET ${offset}
      ` as Submission[]

      totalResult = await sql`
        SELECT COUNT(*)::int as count FROM submissions 
        WHERE tenant_id = ${auth.tenantId}
      ` as { count: number }[]
    }

    const total = totalResult[0]?.count || 0

    return apiResponse(submissions, {
      page,
      per_page,
      total,
      total_pages: Math.ceil(total / per_page),
    })
  } catch (error) {
    console.error('Error fetching submissions:', error)
    return apiError('FETCH_ERROR', 'Failed to fetch submissions', 500)
  }
}

export async function POST(request: NextRequest) {
  // Submissions are open - no API key required
  // This allows external sources to submit content

  try {
    const body: SubmissionCreateInput = await request.json()

    if (!body.source_url || !body.title || !body.content) {
      return apiError(
        'VALIDATION_ERROR',
        'source_url, title, and content are required',
        400
      )
    }

    // Validate URL
    try {
      new URL(body.source_url)
    } catch {
      return apiError('VALIDATION_ERROR', 'Invalid source_url', 400)
    }

    // Generate source identifier from URL
    const sourceIdentifier =
      body.source_identifier ||
      new URL(body.source_url).hostname.replace(/^www\./, '')

    const result = await sql`
      INSERT INTO submissions (
        tenant_id, source_url, source_identifier, title, content, content_format,
        author_name, author_email, metadata, status
      ) VALUES (
        ${DEFAULT_TENANT_ID},
        ${body.source_url},
        ${sourceIdentifier},
        ${body.title},
        ${body.content},
        ${body.content_format || 'markdown'},
        ${body.author_name || null},
        ${body.author_email || null},
        ${JSON.stringify(body.metadata || {})},
        'pending'
      )
      RETURNING *
    ` as Submission[]

    const submission = result[0]

    // Log audit
    await logAudit(
      DEFAULT_TENANT_ID,
      'submission.created',
      'submission',
      submission.id,
      null,
      'external',
      { source_url: submission.source_url, source_identifier: sourceIdentifier },
      request.headers.get('x-forwarded-for'),
      request.headers.get('user-agent')
    )

    // Trigger webhooks
    await triggerWebhooks(DEFAULT_TENANT_ID, 'submission.created', {
      submission: {
        id: submission.id,
        source_url: submission.source_url,
        source_identifier: sourceIdentifier,
        title: submission.title,
        author_name: submission.author_name,
      },
    })

    return apiResponse(
      {
        id: submission.id,
        source_identifier: sourceIdentifier,
        status: submission.status,
        message: 'Submission received and pending review',
      },
      undefined,
      201
    )
  } catch (error) {
    console.error('Error creating submission:', error)
    return apiError('CREATE_ERROR', 'Failed to create submission', 500)
  }
}
