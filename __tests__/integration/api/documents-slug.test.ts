import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock the db module
vi.mock('@/lib/db', () => ({
  sql: vi.fn(),
  DEFAULT_TENANT_ID: '00000000-0000-0000-0000-000000000001',
}))

import { GET, PUT } from '@/app/api/v1/documents/[slug]/route'
import { sql } from '@/lib/db'

const mockSql = vi.mocked(sql)

function createRequest(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), options as any)
}

describe('GET /api/v1/documents/[slug]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns document by slug', async () => {
    const mockDoc = {
      id: 'doc-1',
      slug: 'hello-world',
      title: 'Hello World',
      content: '# Hello',
      status: 'published',
    }

    mockSql.mockResolvedValueOnce([mockDoc] as never)

    const request = createRequest('http://localhost:3000/api/v1/documents/hello-world')
    const response = await GET(request, { params: Promise.resolve({ slug: 'hello-world' }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.slug).toBe('hello-world')
    expect(data.data.title).toBe('Hello World')
  })

  it('returns 404 for nonexistent document', async () => {
    mockSql.mockResolvedValueOnce([] as never)

    const request = createRequest('http://localhost:3000/api/v1/documents/nonexistent')
    const response = await GET(request, { params: Promise.resolve({ slug: 'nonexistent' }) })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.success).toBe(false)
    expect(data.error.code).toBe('NOT_FOUND')
  })

  it('handles database errors', async () => {
    mockSql.mockRejectedValueOnce(new Error('DB error') as never)

    const request = createRequest('http://localhost:3000/api/v1/documents/test')
    const response = await GET(request, { params: Promise.resolve({ slug: 'test' }) })
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error.code).toBe('FETCH_ERROR')
  })
})

describe('PUT /api/v1/documents/[slug]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unauthenticated requests', async () => {
    const request = createRequest('http://localhost:3000/api/v1/documents/test', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated' }),
    })

    const response = await PUT(request, { params: Promise.resolve({ slug: 'test' }) })
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error.code).toBe('UNAUTHORIZED')
  })

  it('updates document with valid auth', async () => {
    const updatedDoc = {
      id: 'doc-1',
      slug: 'test',
      title: 'Updated Title',
      content: '# Updated',
      version: 2,
      status: 'published',
      description: null,
    }

    // Auth
    mockSql.mockResolvedValueOnce([
      { tenant_id: '00000000-0000-0000-0000-000000000001', scopes: ['write'] },
    ] as never)
    mockSql.mockResolvedValueOnce([] as never) // last_used_at
    // Get existing doc
    mockSql.mockResolvedValueOnce([{
      id: 'doc-1', slug: 'test', title: 'Old Title', content: '# Old',
      version: 1, metadata: {}, status: 'published',
    }] as never)
    // Store version
    mockSql.mockResolvedValueOnce([] as never)
    // UPDATE
    mockSql.mockResolvedValueOnce([updatedDoc] as never)
    // updateSearchIndex
    mockSql.mockResolvedValueOnce([] as never)
    // logAudit
    mockSql.mockResolvedValueOnce([] as never)
    // triggerWebhooks
    mockSql.mockResolvedValueOnce([] as never)

    const request = createRequest('http://localhost:3000/api/v1/documents/test', {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer test_key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'Updated Title' }),
    })

    const response = await PUT(request, { params: Promise.resolve({ slug: 'test' }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.title).toBe('Updated Title')
  })

  it('returns 404 when document not found', async () => {
    // Auth
    mockSql.mockResolvedValueOnce([
      { tenant_id: '00000000-0000-0000-0000-000000000001', scopes: ['write'] },
    ] as never)
    mockSql.mockResolvedValueOnce([] as never) // last_used_at
    // Get existing doc - not found
    mockSql.mockResolvedValueOnce([] as never)

    const request = createRequest('http://localhost:3000/api/v1/documents/nonexistent', {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer test_key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'Updated' }),
    })

    const response = await PUT(request, { params: Promise.resolve({ slug: 'nonexistent' }) })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error.code).toBe('NOT_FOUND')
  })
})
