import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock the db module
vi.mock('@/lib/db', () => ({
  sql: vi.fn(),
  DEFAULT_TENANT_ID: '00000000-0000-0000-0000-000000000001',
}))

import { GET, POST } from '@/app/api/v1/webhooks/route'
import { sql } from '@/lib/db'

const mockSql = vi.mocked(sql)

function createRequest(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), options as any)
}

describe('GET /api/v1/webhooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unauthenticated requests', async () => {
    const request = createRequest('http://localhost:3000/api/v1/webhooks')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error.code).toBe('UNAUTHORIZED')
  })

  it('requires admin scope', async () => {
    mockSql.mockResolvedValueOnce([
      { tenant_id: '00000000-0000-0000-0000-000000000001', scopes: ['read', 'write'] },
    ] as never)
    mockSql.mockResolvedValueOnce([] as never) // last_used_at

    const request = createRequest('http://localhost:3000/api/v1/webhooks', {
      headers: { 'Authorization': 'Bearer test_key' },
    })
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error.code).toBe('FORBIDDEN')
  })

  it('returns webhooks list for admin', async () => {
    mockSql.mockResolvedValueOnce([
      { tenant_id: '00000000-0000-0000-0000-000000000001', scopes: ['admin'] },
    ] as never)
    mockSql.mockResolvedValueOnce([] as never) // last_used_at
    mockSql.mockResolvedValueOnce([
      { id: 'w1', url: 'https://example.com/hook', events: ['document.created'], active: true },
    ] as never)

    const request = createRequest('http://localhost:3000/api/v1/webhooks', {
      headers: { 'Authorization': 'Bearer admin_key' },
    })
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data).toHaveLength(1)
  })
})

describe('POST /api/v1/webhooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('validates URL is required', async () => {
    mockSql.mockResolvedValueOnce([
      { tenant_id: '00000000-0000-0000-0000-000000000001', scopes: ['admin'] },
    ] as never)
    mockSql.mockResolvedValueOnce([] as never)

    const request = createRequest('http://localhost:3000/api/v1/webhooks', {
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

  it('validates URL format', async () => {
    mockSql.mockResolvedValueOnce([
      { tenant_id: '00000000-0000-0000-0000-000000000001', scopes: ['admin'] },
    ] as never)
    mockSql.mockResolvedValueOnce([] as never)

    const request = createRequest('http://localhost:3000/api/v1/webhooks', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer admin_key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: 'not-a-url' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error.message).toBe('Invalid URL')
  })

  it('creates webhook with secret', async () => {
    mockSql.mockResolvedValueOnce([
      { tenant_id: '00000000-0000-0000-0000-000000000001', scopes: ['admin'] },
    ] as never)
    mockSql.mockResolvedValueOnce([] as never) // last_used_at
    mockSql.mockResolvedValueOnce([
      { id: 'w1', url: 'https://example.com/hook', events: ['document.created'], active: true },
    ] as never)
    mockSql.mockResolvedValueOnce([] as never) // logAudit

    const request = createRequest('http://localhost:3000/api/v1/webhooks', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer admin_key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: 'https://example.com/hook' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.success).toBe(true)
    expect(data.data.secret).toBeDefined()
    expect(data.data.secret.startsWith('whsec_')).toBe(true)
  })

  it('blocks private/internal webhook URLs (SSRF protection)', async () => {
    const blockedUrls = [
      'http://localhost/hook',
      'http://127.0.0.1/hook',
      'http://10.0.0.1/hook',
      'http://192.168.1.1/hook',
    ]

    for (const url of blockedUrls) {
      mockSql.mockReset()
      mockSql.mockResolvedValueOnce([
        { tenant_id: '00000000-0000-0000-0000-000000000001', scopes: ['admin'] },
      ] as never)
      mockSql.mockResolvedValueOnce([] as never) // last_used_at

      const request = createRequest('http://localhost:3000/api/v1/webhooks', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer admin_key',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.message).toBe('URLs pointing to internal or private networks are not allowed')
    }
  })
})
