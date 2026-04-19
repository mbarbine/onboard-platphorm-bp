import { NextRequest, NextResponse } from 'next/server'
import { sql, DEFAULT_TENANT_ID } from './db'
import { APIResponse } from './api-types'
import { API_KEY_PREFIX, WEBHOOK_SIGNATURE_HEADER, WEBHOOK_EVENT_HEADER } from './site-config'
import crypto from 'crypto'
import { logger, generateRequestId as loggerGenerateRequestId } from './logger'

export function generateRequestId(): string {
  return loggerGenerateRequestId()
}

export function apiResponse<T>(
  data: T,
  meta?: APIResponse<T>['meta'],
  status = 200
): NextResponse<APIResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      meta: {
        ...meta,
        request_id: generateRequestId(),
      },
    },
    { status }
  )
}

export function apiError(
  code: string,
  message: string,
  status = 400,
  details?: Record<string, unknown>
): NextResponse<APIResponse<never>> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        details,
      },
      meta: {
        request_id: generateRequestId(),
      },
    },
    { status }
  )
}

export async function validateApiKey(
  request: NextRequest
): Promise<{ valid: boolean; tenantId: string; scopes: string[] }> {
  const authHeader = request.headers.get('authorization')
  
  if (!authHeader?.startsWith('Bearer ')) {
    return { valid: false, tenantId: DEFAULT_TENANT_ID, scopes: [] }
  }

  const token = authHeader.slice(7)
  const keyHash = crypto.createHash('sha256').update(token).digest('hex')

  try {
    const result = await sql`
      SELECT tenant_id, scopes FROM api_keys 
      WHERE key_hash = ${keyHash} 
        AND deleted_at IS NULL 
        AND (expires_at IS NULL OR expires_at > NOW())
    `
    
    if (result.length === 0) {
      return { valid: false, tenantId: DEFAULT_TENANT_ID, scopes: [] }
    }

    // Update last used
    await sql`UPDATE api_keys SET last_used_at = NOW() WHERE key_hash = ${keyHash}`

    return {
      valid: true,
      tenantId: result[0].tenant_id as string,
      scopes: (result[0].scopes as string[]) || ['read'],
    }
  } catch {
    return { valid: false, tenantId: DEFAULT_TENANT_ID, scopes: [] }
  }
}

export function hasScope(scopes: string[], required: string): boolean {
  return scopes.includes('admin') || scopes.includes(required)
}

export async function logAudit(
  tenantId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  actorId: string | null,
  actorType: string | null,
  metadata: Record<string, unknown>,
  ipAddress: string | null,
  userAgent: string | null
): Promise<void> {
  try {
    await sql`
      INSERT INTO audit_logs (tenant_id, action, entity_type, entity_id, actor_id, actor_type, metadata, ip_address, user_agent)
      VALUES (${tenantId}, ${action}, ${entityType}, ${entityId}, ${actorId}, ${actorType}, ${JSON.stringify(metadata)}, ${ipAddress}, ${userAgent})
    `
  } catch (error) {
    logger.error('Failed to log audit', { error: error instanceof Error ? error : String(error) })
  }
}

export function getPaginationParams(searchParams: URLSearchParams): {
  page: number
  per_page: number
  offset: number
  sort_by: string
  sort_order: 'asc' | 'desc'
} {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const per_page = Math.min(100, Math.max(1, parseInt(searchParams.get('per_page') || '20', 10)))
  const offset = (page - 1) * per_page
  const sort_by = searchParams.get('sort_by') || 'created_at'
  const rawOrder = searchParams.get('sort_order') || 'desc'
  const sort_order: 'asc' | 'desc' = rawOrder === 'asc' ? 'asc' : 'desc'

  return { page, per_page, offset, sort_by, sort_order }
}

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200)
}

export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const key = `${API_KEY_PREFIX}${crypto.randomBytes(32).toString('hex')}`
  const hash = crypto.createHash('sha256').update(key).digest('hex')
  const prefix = key.slice(0, 10)
  return { key, hash, prefix }
}

export async function triggerWebhooks(
  tenantId: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    const webhooks = await sql`
      SELECT id, url, secret FROM webhook_endpoints 
      WHERE tenant_id = ${tenantId} 
        AND active = true 
        AND events @> ${JSON.stringify([eventType])}::jsonb
    `

    for (const webhook of webhooks) {
      const signature = crypto
        .createHmac('sha256', webhook.secret as string)
        .update(JSON.stringify(payload))
        .digest('hex')

      await sql`
        INSERT INTO webhook_deliveries (webhook_id, event_type, payload)
        VALUES (${webhook.id}, ${eventType}, ${JSON.stringify(payload)})
      `

      // Fire and forget with timeout - in production you'd use a queue
      const deliveryController = new AbortController()
      const deliveryTimeout = setTimeout(() => deliveryController.abort(), 10000) // 10s timeout
      fetch(webhook.url as string, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [WEBHOOK_SIGNATURE_HEADER]: `sha256=${signature}`,
          [WEBHOOK_EVENT_HEADER]: eventType,
        },
        body: JSON.stringify(payload),
        signal: deliveryController.signal,
      }).catch(() => {}).finally(() => clearTimeout(deliveryTimeout))
    }
  } catch (error) {
    logger.error('Failed to trigger webhooks', { error: error instanceof Error ? error : String(error) })
  }
}

export async function updateSearchIndex(
  documentId: string,
  tenantId: string,
  title: string,
  content: string,
  description: string | null
): Promise<void> {
  const searchText = [title, description || '', content].join(' ')
  
  await sql`
    INSERT INTO search_index (document_id, tenant_id, content_vector)
    VALUES (${documentId}, ${tenantId}, to_tsvector('english', ${searchText}))
    ON CONFLICT (document_id) DO UPDATE
    SET content_vector = to_tsvector('english', ${searchText}), updated_at = NOW()
  `
}
