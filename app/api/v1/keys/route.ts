import { NextRequest } from 'next/server'
import { sql, DEFAULT_TENANT_ID } from '@/lib/db'
import {
  apiResponse,
  apiError,
  validateApiKey,
  hasScope,
  generateApiKey,
  logAudit,
} from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

type ApiKeyRow = {
  id: string
  name: string
  key_prefix: string
  scopes: string[]
  rate_limit: number
  last_used_at: Date | null
  expires_at: Date | null
  created_at: Date
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
    const keys = await sql`
      SELECT id, name, key_prefix, scopes, rate_limit, last_used_at, expires_at, created_at
      FROM api_keys
      WHERE tenant_id = ${auth.tenantId}
        AND deleted_at IS NULL
      ORDER BY created_at DESC
    ` as ApiKeyRow[]

    return apiResponse(keys)
  } catch (error) {
    console.error('Error fetching API keys:', error)
    return apiError('FETCH_ERROR', 'Failed to fetch API keys', 500)
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
    const body = await request.json()

    if (!body.name) {
      return apiError('VALIDATION_ERROR', 'name is required', 400)
    }

    const { key, hash, prefix } = generateApiKey()
    const scopes = body.scopes || ['read', 'write']
    const rateLimit = body.rate_limit || 1000
    const expiresAt = body.expires_in_days
      ? new Date(Date.now() + body.expires_in_days * 24 * 60 * 60 * 1000)
      : null

    const result = await sql`
      INSERT INTO api_keys (tenant_id, name, key_hash, key_prefix, scopes, rate_limit, expires_at)
      VALUES (
        ${auth.tenantId},
        ${body.name},
        ${hash},
        ${prefix},
        ${JSON.stringify(scopes)}::jsonb,
        ${rateLimit},
        ${expiresAt?.toISOString() || null}
      )
      RETURNING id, name, key_prefix, scopes, rate_limit, expires_at, created_at
    ` as ApiKeyRow[]

    await logAudit(
      auth.tenantId,
      'api_key.created',
      'api_key',
      result[0].id,
      null,
      'api_key',
      { name: body.name },
      request.headers.get('x-forwarded-for'),
      request.headers.get('user-agent')
    )

    return apiResponse(
      {
        ...result[0],
        key, // Only returned on creation - store it safely!
      },
      undefined,
      201
    )
  } catch (error) {
    console.error('Error creating API key:', error)
    return apiError('CREATE_ERROR', 'Failed to create API key', 500)
  }
}

// Bootstrap endpoint - creates initial admin key (only works if no keys exist)
export async function PUT(request: NextRequest) {
  try {
    // Check if any keys exist
    const existing = await sql`
      SELECT COUNT(*)::int as count FROM api_keys WHERE tenant_id = ${DEFAULT_TENANT_ID}
    ` as { count: number }[]

    if (existing[0].count > 0) {
      return apiError('FORBIDDEN', 'API keys already exist. Use authenticated endpoint.', 403)
    }

    const body = await request.json()
    const { key, hash, prefix } = generateApiKey()

    const result = await sql`
      INSERT INTO api_keys (tenant_id, name, key_hash, key_prefix, scopes, rate_limit)
      VALUES (
        ${DEFAULT_TENANT_ID},
        ${body.name || 'Bootstrap Admin Key'},
        ${hash},
        ${prefix},
        '["admin", "read", "write"]'::jsonb,
        10000
      )
      RETURNING id, name, key_prefix, scopes, rate_limit, created_at
    ` as ApiKeyRow[]

    await logAudit(
      DEFAULT_TENANT_ID,
      'api_key.bootstrapped',
      'api_key',
      result[0].id,
      null,
      'bootstrap',
      {},
      request.headers.get('x-forwarded-for'),
      request.headers.get('user-agent')
    )

    return apiResponse(
      {
        ...result[0],
        key,
        message: 'Store this key safely - it will not be shown again!',
      },
      undefined,
      201
    )
  } catch (error) {
    console.error('Error bootstrapping API key:', error)
    return apiError('CREATE_ERROR', 'Failed to create bootstrap key', 500)
  }
}
