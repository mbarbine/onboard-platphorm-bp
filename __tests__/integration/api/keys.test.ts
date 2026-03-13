import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock the db module
vi.mock('@/lib/db', () => ({
  sql: vi.fn(),
  DEFAULT_TENANT_ID: '00000000-0000-0000-0000-000000000001',
}))

import { GET, POST, PUT } from '@/app/api/v1/keys/route'
import { sql } from '@/lib/db'

const mockSql = vi.mocked(sql)

function createRequest(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), options as any)
}

describe('GET /api/v1/keys', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unauthenticated requests', async () => {
    const request = createRequest('http://localhost:3000/api/v1/keys')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error.code).toBe('UNAUTHORIZED')
  })

  it('requires admin scope', async () => {
    mockSql.mockResolvedValueOnce([
      { tenant_id: '00000000-0000-0000-0000-000000000001', scopes: ['read', 'write'] },
    ] as never)
    mockSql.mockResolvedValueOnce([] as never)

    const request = createRequest('http://localhost:3000/api/v1/keys', {
      headers: { 'Authorization': 'Bearer test_key' },
    })
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error.code).toBe('FORBIDDEN')
  })

  it('returns API keys list for admin', async () => {
    mockSql.mockResolvedValueOnce([
      { tenant_id: '00000000-0000-0000-0000-000000000001', scopes: ['admin'] },
    ] as never)
    mockSql.mockResolvedValueOnce([] as never)
    mockSql.mockResolvedValueOnce([
      { id: 'k1', name: 'Test Key', key_prefix: 'ob_abc', scopes: ['read'] },
    ] as never)

    const request = createRequest('http://localhost:3000/api/v1/keys', {
      headers: { 'Authorization': 'Bearer admin_key' },
    })
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data).toHaveLength(1)
  })
})

describe('POST /api/v1/keys', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('validates name is required', async () => {
    mockSql.mockResolvedValueOnce([
      { tenant_id: '00000000-0000-0000-0000-000000000001', scopes: ['admin'] },
    ] as never)
    mockSql.mockResolvedValueOnce([] as never)

    const request = createRequest('http://localhost:3000/api/v1/keys', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer admin_key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error.code).toBe('VALIDATION_ERROR')
  })

  it('creates API key and returns it', async () => {
    mockSql.mockResolvedValueOnce([
      { tenant_id: '00000000-0000-0000-0000-000000000001', scopes: ['admin'] },
    ] as never)
    mockSql.mockResolvedValueOnce([] as never) // last_used_at
    mockSql.mockResolvedValueOnce([
      { id: 'k1', name: 'New Key', key_prefix: 'ob_xyz', scopes: ['read', 'write'] },
    ] as never)
    mockSql.mockResolvedValueOnce([] as never) // logAudit

    const request = createRequest('http://localhost:3000/api/v1/keys', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer admin_key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'New Key' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.success).toBe(true)
    expect(data.data.key).toBeDefined()
    expect(data.data.key.startsWith('ob_')).toBe(true)
  })
})

describe('PUT /api/v1/keys (Bootstrap)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates bootstrap key when no keys exist', async () => {
    // Check count = 0
    mockSql.mockResolvedValueOnce([{ count: 0 }] as never)
    // INSERT
    mockSql.mockResolvedValueOnce([
      { id: 'k1', name: 'Bootstrap Admin Key', key_prefix: 'ob_boot', scopes: ['admin', 'read', 'write'] },
    ] as never)
    // logAudit
    mockSql.mockResolvedValueOnce([] as never)

    const request = createRequest('http://localhost:3000/api/v1/keys', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    const response = await PUT(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.success).toBe(true)
    expect(data.data.key).toBeDefined()
    expect(data.data.message).toContain('Store this key safely')
  })

  it('rejects bootstrap when keys already exist', async () => {
    mockSql.mockResolvedValueOnce([{ count: 5 }] as never)

    const request = createRequest('http://localhost:3000/api/v1/keys', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    const response = await PUT(request)
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error.code).toBe('FORBIDDEN')
  })
})
