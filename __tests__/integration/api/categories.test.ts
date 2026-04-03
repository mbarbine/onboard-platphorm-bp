import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the db module
vi.mock('@/lib/db', () => ({
  sql: vi.fn(),
  DEFAULT_TENANT_ID: '00000000-0000-0000-0000-000000000001',
}))

import { GET, POST } from '@/app/api/v1/categories/route'
import { sql } from '@/lib/db'
import { NextRequest } from 'next/server'

const mockSql = vi.mocked(sql)

function createRequest(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), options as any)
}

describe('GET /api/v1/categories', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns category tree with document counts', async () => {
    const mockCategories = [
      {
        id: 'c1',
        slug: 'guides',
        name: 'Guides',
        parent_id: null,
        document_count: 5,
        order_index: 0,
      },
      {
        id: 'c2',
        slug: 'api',
        name: 'API',
        parent_id: null,
        document_count: 3,
        order_index: 1,
      },
    ]

    mockSql.mockResolvedValueOnce(mockCategories as never)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.categories).toBeDefined()
    expect(data.data.flat).toBeDefined()
    expect(data.data.flat).toHaveLength(2)
  })

  it('builds tree structure for nested categories', async () => {
    const mockCategories = [
      { id: 'c1', slug: 'guides', name: 'Guides', parent_id: null, document_count: 3, order_index: 0 },
      { id: 'c2', slug: 'getting-started', name: 'Getting Started', parent_id: 'c1', document_count: 2, order_index: 0 },
    ]

    mockSql.mockResolvedValueOnce(mockCategories as never)

    const response = await GET()
    const data = await response.json()

    expect(data.data.categories).toHaveLength(1) // Only root categories
    expect(data.data.categories[0].children).toHaveLength(1) // Nested child
  })

  it('handles database errors', async () => {
    mockSql.mockRejectedValueOnce(new Error('DB error') as never)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.success).toBe(false)
    expect(data.error.code).toBe('FETCH_ERROR')
  })
})

describe('POST /api/v1/categories', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unauthenticated requests', async () => {
    const request = createRequest('http://localhost:3000/api/v1/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'test', name: 'Test' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error.code).toBe('UNAUTHORIZED')
  })

  it('validates required fields', async () => {
    // Auth with write scope
    mockSql.mockResolvedValueOnce([
      { tenant_id: '00000000-0000-0000-0000-000000000001', scopes: ['write'] },
    ] as never)
    mockSql.mockResolvedValueOnce([] as never) // last_used_at

    const request = createRequest('http://localhost:3000/api/v1/categories', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test_key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ slug: '' }), // missing name
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error.code).toBe('VALIDATION_ERROR')
  })

  it('creates category with valid data', async () => {
    const mockCategory = {
      id: 'c1',
      slug: 'new-cat',
      name: 'New Category',
    }

    // Auth
    mockSql.mockResolvedValueOnce([
      { tenant_id: '00000000-0000-0000-0000-000000000001', scopes: ['write'] },
    ] as never)
    mockSql.mockResolvedValueOnce([] as never) // last_used_at
    // Check slug collision
    mockSql.mockResolvedValueOnce([] as never)
    // INSERT
    mockSql.mockResolvedValueOnce([mockCategory] as never)
    // logAudit
    mockSql.mockResolvedValueOnce([] as never)

    const request = createRequest('http://localhost:3000/api/v1/categories', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test_key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ slug: 'new-cat', name: 'New Category' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.success).toBe(true)
    expect(data.data.slug).toBe('new-cat')
  })

  it('returns 409 for duplicate slug', async () => {
    // Auth
    mockSql.mockResolvedValueOnce([
      { tenant_id: '00000000-0000-0000-0000-000000000001', scopes: ['write'] },
    ] as never)
    mockSql.mockResolvedValueOnce([] as never) // last_used_at
    // Slug exists
    mockSql.mockResolvedValueOnce([{ id: 'existing' }] as never)

    const request = createRequest('http://localhost:3000/api/v1/categories', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test_key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ slug: 'existing-cat', name: 'Existing' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data.error.code).toBe('CONFLICT')
  })

  it('returns 500 when database insertion fails', async () => {
    // Auth
    mockSql.mockResolvedValueOnce([
      { tenant_id: '00000000-0000-0000-0000-000000000001', scopes: ['write'] },
    ] as never)
    mockSql.mockResolvedValueOnce([] as never) // last_used_at
    // Check slug collision
    mockSql.mockResolvedValueOnce([] as never)
    // INSERT throws error
    mockSql.mockRejectedValueOnce(new Error('DB error') as never)

    const request = createRequest('http://localhost:3000/api/v1/categories', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test_key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ slug: 'error-cat', name: 'Error Category' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error.code).toBe('CREATE_ERROR')
  })
})
