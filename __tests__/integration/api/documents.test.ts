import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock the db module
vi.mock('@/lib/db', () => ({
  sql: vi.fn(),
  DEFAULT_TENANT_ID: '00000000-0000-0000-0000-000000000001',
}))

import { GET, POST } from '@/app/api/v1/documents/route'
import { sql } from '@/lib/db'

const mockSql = vi.mocked(sql)

function createRequest(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), options as any)
}

describe('GET /api/v1/documents', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockSql.mockReset()
  })

  it('returns paginated list of documents', async () => {
    const mockDocs = [
      { id: '1', slug: 'test-doc', title: 'Test Doc', status: 'published' },
    ]
    // First call returns documents, second returns count
    mockSql
      .mockResolvedValueOnce(mockDocs as never)
      .mockResolvedValueOnce([{ count: 1 }] as never)

    const request = createRequest('http://localhost:3000/api/v1/documents')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(Array.isArray(data.data)).toBe(true)
    expect(data.meta).toBeDefined()
    expect(data.meta.page).toBe(1)
    expect(data.meta.total).toBe(1)
  })

  it('supports pagination parameters', async () => {
    mockSql
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([{ count: 0 }] as never)

    const request = createRequest('http://localhost:3000/api/v1/documents?page=2&per_page=10')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.meta.page).toBe(2)
    expect(data.meta.per_page).toBe(10)
  })

  it('filters by category', async () => {
    mockSql
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([{ count: 0 }] as never)

    const request = createRequest('http://localhost:3000/api/v1/documents?category=guides')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })

  it('supports search query', async () => {
    mockSql
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([{ count: 0 }] as never)

    const request = createRequest('http://localhost:3000/api/v1/documents?q=test')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })

  it('filters by tag', async () => {
    mockSql
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([{ count: 0 }] as never)

    const request = createRequest('http://localhost:3000/api/v1/documents?tag=react')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })

  it('returns 500 on database error', async () => {
    mockSql.mockRejectedValueOnce(new Error('DB error') as never)

    const request = createRequest('http://localhost:3000/api/v1/documents')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.success).toBe(false)
    expect(data.error.code).toBe('FETCH_ERROR')
  })

  it('rejects invalid status parameter', async () => {
    const request = createRequest('http://localhost:3000/api/v1/documents?status=invalid')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.error.code).toBe('VALIDATION_ERROR')
    expect(data.error.message).toContain('Invalid status')
  })

  it('accepts valid status values', async () => {
    for (const status of ['published', 'draft', 'archived']) {
      mockSql.mockReset()
      mockSql
        .mockResolvedValueOnce([{ id: '1', slug: 'test', title: 'Test', status }] as never)
        .mockResolvedValueOnce([{ count: 1 }] as never)

      const request = createRequest(`http://localhost:3000/api/v1/documents?status=${status}`)
      const response = await GET(request)

      expect(response.status).toBe(200)
    }
  })
})

describe('POST /api/v1/documents', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockSql.mockReset()
  })

  it('rejects requests without API key', async () => {
    // validateApiKey uses sql internally - mock to return no results
    mockSql.mockResolvedValueOnce([] as never)

    const request = createRequest('http://localhost:3000/api/v1/documents', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test', content: '# Test' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.success).toBe(false)
    expect(data.error.code).toBe('UNAUTHORIZED')
  })

  it('rejects requests without write scope', async () => {
    // Mock validateApiKey: first SQL call returns a valid key with read-only scope
    mockSql.mockResolvedValueOnce([
      { tenant_id: '00000000-0000-0000-0000-000000000001', scopes: ['read'] },
    ] as never)
    // Mock the UPDATE last_used_at
    mockSql.mockResolvedValueOnce([] as never)

    const request = createRequest('http://localhost:3000/api/v1/documents', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test_key_123',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'Test', content: '# Test' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.success).toBe(false)
    expect(data.error.code).toBe('FORBIDDEN')
  })

  it('validates required fields', async () => {
    // Mock valid API key with write scope
    mockSql.mockResolvedValueOnce([
      { tenant_id: '00000000-0000-0000-0000-000000000001', scopes: ['write'] },
    ] as never)
    mockSql.mockResolvedValueOnce([] as never) // update last_used_at

    const request = createRequest('http://localhost:3000/api/v1/documents', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test_key_123',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: '' }), // missing content
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.error.code).toBe('VALIDATION_ERROR')
  })

  it('creates document with valid data', async () => {
    const mockDoc = {
      id: 'doc-1',
      slug: 'test-document',
      title: 'Test Document',
      content: '# Test',
      status: 'draft',
    }

    // validateApiKey: key lookup
    mockSql.mockResolvedValueOnce([
      { tenant_id: '00000000-0000-0000-0000-000000000001', scopes: ['write'] },
    ] as never)
    // validateApiKey: update last_used_at
    mockSql.mockResolvedValueOnce([] as never)
    // Check slug collision
    mockSql.mockResolvedValueOnce([] as never)
    // INSERT document
    mockSql.mockResolvedValueOnce([mockDoc] as never)
    // updateSearchIndex
    mockSql.mockResolvedValueOnce([] as never)
    // logAudit
    mockSql.mockResolvedValueOnce([] as never)
    // triggerWebhooks
    mockSql.mockResolvedValueOnce([] as never)

    const request = createRequest('http://localhost:3000/api/v1/documents', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test_key_123',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Test Document',
        content: '# Test',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.success).toBe(true)
    expect(data.data.slug).toBe('test-document')
  })

  it('returns 409 for slug conflicts', async () => {
    // validateApiKey
    mockSql.mockResolvedValueOnce([
      { tenant_id: '00000000-0000-0000-0000-000000000001', scopes: ['write'] },
    ] as never)
    mockSql.mockResolvedValueOnce([] as never) // update last_used_at
    // Check slug collision - returns existing doc
    mockSql.mockResolvedValueOnce([{ id: 'existing-id' }] as never)

    const request = createRequest('http://localhost:3000/api/v1/documents', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test_key_123',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        slug: 'existing-slug',
        title: 'Test',
        content: '# Test',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data.error.code).toBe('CONFLICT')
  })
})
