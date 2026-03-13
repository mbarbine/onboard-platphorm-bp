import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock the db module
vi.mock('@/lib/db', () => ({
  sql: vi.fn(),
  DEFAULT_TENANT_ID: '00000000-0000-0000-0000-000000000001',
}))

import { GET, POST } from '@/app/api/v1/submissions/route'
import { sql } from '@/lib/db'

const mockSql = vi.mocked(sql)

function createRequest(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), options as any)
}

describe('GET /api/v1/submissions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unauthenticated requests', async () => {
    const request = createRequest('http://localhost:3000/api/v1/submissions')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.success).toBe(false)
    expect(data.error.code).toBe('UNAUTHORIZED')
  })

  it('rejects requests without read scope', async () => {
    mockSql.mockResolvedValueOnce([
      { tenant_id: '00000000-0000-0000-0000-000000000001', scopes: [] },
    ] as never)
    mockSql.mockResolvedValueOnce([] as never) // update last_used_at

    const request = createRequest('http://localhost:3000/api/v1/submissions', {
      headers: { 'Authorization': 'Bearer test_key' },
    })
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error.code).toBe('FORBIDDEN')
  })

  it('returns paginated submissions with valid auth', async () => {
    // Auth
    mockSql.mockResolvedValueOnce([
      { tenant_id: '00000000-0000-0000-0000-000000000001', scopes: ['read'] },
    ] as never)
    mockSql.mockResolvedValueOnce([] as never) // update last_used_at
    // Query
    mockSql.mockResolvedValueOnce([
      { id: 's1', title: 'Sub 1', status: 'pending' },
    ] as never)
    mockSql.mockResolvedValueOnce([{ count: 1 }] as never)

    const request = createRequest('http://localhost:3000/api/v1/submissions', {
      headers: { 'Authorization': 'Bearer test_key' },
    })
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.meta.total).toBe(1)
  })
})

describe('POST /api/v1/submissions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('validates required fields', async () => {
    const request = createRequest('http://localhost:3000/api/v1/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test' }), // missing source_url and content
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error.code).toBe('VALIDATION_ERROR')
  })

  it('validates URL format', async () => {
    const request = createRequest('http://localhost:3000/api/v1/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_url: 'not-a-url',
        title: 'Test',
        content: 'Content',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error.code).toBe('VALIDATION_ERROR')
    expect(data.error.message).toBe('Invalid source_url')
  })

  it('creates submission with valid data (no auth required)', async () => {
    const mockSubmission = {
      id: 's1',
      source_url: 'https://example.com/post',
      source_identifier: 'example.com',
      title: 'Test Post',
      status: 'pending',
      author_name: null,
    }

    // INSERT
    mockSql.mockResolvedValueOnce([mockSubmission] as never)
    // logAudit
    mockSql.mockResolvedValueOnce([] as never)
    // triggerWebhooks
    mockSql.mockResolvedValueOnce([] as never)

    const request = createRequest('http://localhost:3000/api/v1/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_url: 'https://example.com/post',
        title: 'Test Post',
        content: '# My Post',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.success).toBe(true)
    expect(data.data.status).toBe('pending')
    expect(data.data.message).toContain('pending review')
  })
})
