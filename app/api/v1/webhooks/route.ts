import { NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import {
  apiResponse,
  apiError,
  validateApiKey,
  hasScope,
  logAudit,
} from '@/lib/api-helpers'
import { WebhookCreateInput } from '@/lib/api-types'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

type Webhook = {
  id: string
  tenant_id: string
  url: string
  secret: string
  events: string[]
  active: boolean
  created_at: Date
  updated_at: Date
}

export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request)

  if (!auth.valid) {
    return apiError('UNAUTHORIZED', 'Invalid or missing API key', 401)
  }

  if (!hasScope(auth.scopes, 'admin')) {
    return apiError('FORBIDDEN', 'Insufficient permissions', 403)
  }

  try {
    const webhooks = await sql`
      SELECT id, url, events, active, created_at, updated_at
      FROM webhook_endpoints
      WHERE tenant_id = ${auth.tenantId}
      ORDER BY created_at DESC
    ` as Omit<Webhook, 'secret' | 'tenant_id'>[]

    return apiResponse(webhooks)
  } catch (error) {
    console.error('Error fetching webhooks:', error)
    return apiError('FETCH_ERROR', 'Failed to fetch webhooks', 500)
  }
}

export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request)

  if (!auth.valid) {
    return apiError('UNAUTHORIZED', 'Invalid or missing API key', 401)
  }

  if (!hasScope(auth.scopes, 'admin')) {
    return apiError('FORBIDDEN', 'Insufficient permissions', 403)
  }

  try {
    const body: WebhookCreateInput = await request.json()

    if (!body.url) {
      return apiError('VALIDATION_ERROR', 'url is required', 400)
    }

    // Validate URL
    try {
      const parsed = new URL(body.url)
      // Only allow https for webhook endpoints
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return apiError('VALIDATION_ERROR', 'Only HTTP and HTTPS URLs are allowed', 400)
      }
      // Block private/internal IPs
      const hostname = parsed.hostname.toLowerCase()
      const blockedPatterns = [
        /^localhost$/,
        /^127\.\d+\.\d+\.\d+$/,
        /^10\.\d+\.\d+\.\d+$/,
        /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
        /^192\.168\.\d+\.\d+$/,
        /^169\.254\.\d+\.\d+$/,
        /^0\.0\.0\.0$/,
        /^::1?$/,
      ]
      if (blockedPatterns.some(pattern => pattern.test(hostname))) {
        return apiError('VALIDATION_ERROR', 'URLs pointing to internal or private networks are not allowed', 400)
      }
    } catch {
      return apiError('VALIDATION_ERROR', 'Invalid URL', 400)
    }

    const secret = `whsec_${crypto.randomBytes(32).toString('hex')}`
    const events = body.events || ['document.created', 'document.updated', 'submission.created']

    const result = await sql`
      INSERT INTO webhook_endpoints (tenant_id, url, secret, events, active)
      VALUES (
        ${auth.tenantId},
        ${body.url},
        ${secret},
        ${JSON.stringify(events)}::jsonb,
        ${body.active ?? true}
      )
      RETURNING id, url, events, active, created_at
    ` as Omit<Webhook, 'secret' | 'tenant_id' | 'updated_at'>[]

    const webhook = result[0]

    await logAudit(
      auth.tenantId,
      'webhook.created',
      'webhook',
      webhook.id,
      null,
      'api_key',
      { url: webhook.url },
      request.headers.get('x-forwarded-for'),
      request.headers.get('user-agent')
    )

    return apiResponse(
      {
        ...webhook,
        secret, // Only returned on creation
      },
      undefined,
      201
    )
  } catch (error) {
    console.error('Error creating webhook:', error)
    return apiError('CREATE_ERROR', 'Failed to create webhook', 500)
  }
}
