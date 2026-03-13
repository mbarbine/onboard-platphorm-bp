import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock the db module
vi.mock('@/lib/db', () => ({
  sql: vi.fn(),
  DEFAULT_TENANT_ID: '00000000-0000-0000-0000-000000000001',
}))

import { GET } from '@/app/api/v1/search/route'
import { sql } from '@/lib/db'

const mockSql = vi.mocked(sql)

function createRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'))
}

describe('GET /api/v1/search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects query shorter than 2 characters', async () => {
    const request = createRequest('http://localhost:3000/api/v1/search?q=a')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects empty query', async () => {
    const request = createRequest('http://localhost:3000/api/v1/search')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
  })

  it('rejects query exceeding 500 characters', async () => {
    const longQuery = 'a'.repeat(501)
    const request = createRequest(`http://localhost:3000/api/v1/search?q=${longQuery}`)
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.error.code).toBe('VALIDATION_ERROR')
    expect(data.error.message).toContain('500')
  })

  it('returns search results for valid query', async () => {
    const mockResults = [
      {
        id: '1',
        slug: 'test-doc',
        title: 'Test Document',
        description: 'A test',
        category: 'guides',
        tags: ['test'],
        author_name: 'John',
        source_identifier: 'example.com',
        headline: 'This is a <mark>test</mark> document',
        rank: 0.95,
        published_at: new Date().toISOString(),
      },
    ]

    mockSql
      .mockResolvedValueOnce(mockResults as never)
      .mockResolvedValueOnce([{ count: 1 }] as never)

    const request = createRequest('http://localhost:3000/api/v1/search?q=test')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.query).toBe('test')
    expect(data.data.results).toHaveLength(1)
    expect(data.data.results[0].title).toBe('Test Document')
    expect(data.data.results[0].headline).toBeDefined()
    expect(data.data.results[0].relevance).toBeDefined()
  })

  it('returns empty results when no matches', async () => {
    mockSql
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([{ count: 0 }] as never)

    const request = createRequest('http://localhost:3000/api/v1/search?q=nonexistent')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data.results).toHaveLength(0)
    expect(data.meta.total).toBe(0)
  })

  it('supports category filter', async () => {
    mockSql
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([{ count: 0 }] as never)

    const request = createRequest('http://localhost:3000/api/v1/search?q=test&category=guides')
    const response = await GET(request)

    expect(response.status).toBe(200)
  })

  it('supports tag filter', async () => {
    mockSql
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([{ count: 0 }] as never)

    const request = createRequest('http://localhost:3000/api/v1/search?q=test&tag=react')
    const response = await GET(request)

    expect(response.status).toBe(200)
  })

  it('supports combined category and tag filters', async () => {
    mockSql
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([{ count: 0 }] as never)

    const request = createRequest('http://localhost:3000/api/v1/search?q=test&category=guides&tag=react')
    const response = await GET(request)

    expect(response.status).toBe(200)
  })

  it('returns pagination metadata', async () => {
    mockSql
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([{ count: 50 }] as never)

    const request = createRequest('http://localhost:3000/api/v1/search?q=test&page=2&per_page=10')
    const response = await GET(request)
    const data = await response.json()

    expect(data.meta.page).toBe(2)
    expect(data.meta.per_page).toBe(10)
    expect(data.meta.total).toBe(50)
    expect(data.meta.total_pages).toBe(5)
  })

  it('handles database errors', async () => {
    mockSql.mockRejectedValueOnce(new Error('DB error') as never)

    const request = createRequest('http://localhost:3000/api/v1/search?q=test')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.success).toBe(false)
    expect(data.error.code).toBe('SEARCH_ERROR')
  })
})
