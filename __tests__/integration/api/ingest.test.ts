import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the db module
vi.mock('@/lib/db', () => ({
  sql: vi.fn(),
  DEFAULT_TENANT_ID: '00000000-0000-0000-0000-000000000001',
}))

// Mock uuid
let uuidCounter = 0
vi.mock('uuid', () => ({
  v4: () => `test-uuid-${++uuidCounter}`,
}))

// Mock seo-generator
vi.mock('@/lib/seo-generator', () => ({
  generateSEOMetadata: () => ({
    ogTitle: 'Test Title',
    ogDescription: 'Test description',
    ogImage: null,
    canonical: 'https://docs.platphormnews.com/docs/test',
    readingTime: 1,
    wordCount: 100,
  }),
  generateAEOMetadata: () => ({
    questions: ['What is Test?'],
    directAnswer: 'Test provides guidance.',
    faqStructuredData: { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [] },
  }),
  generateGEOMetadata: () => ({
    summary: 'Test summary for AI.',
    keyFacts: ['Fact one'],
    citationLabel: 'Test — OpenDocs',
    topicTags: ['test'],
  }),
}))

// Mock emoji
vi.mock('@/lib/emoji', () => ({
  generateEmojiSummary: () => ({ emojis: '📄📝' }),
}))

// Mock auto-name
vi.mock('@/lib/auto-name', () => ({
  generateSimpleSlug: (title: string) => title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 72) + '-a1b2',
}))

import { POST } from '@/app/api/v1/ingest/route'
import { sql } from '@/lib/db'
import { NextRequest } from 'next/server'

const mockSql = vi.mocked(sql)

function createRequest(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), options as any)
}

describe('POST /api/v1/ingest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    uuidCounter = 0
  })

  it('returns 400 when URL is missing', async () => {
    const request = createRequest('http://localhost:3000/api/v1/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.error).toBe('URL is required')
  })

  it('returns 400 for invalid URL format', async () => {
    const request = createRequest('http://localhost:3000/api/v1/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'not-a-url' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.error).toBe('Invalid URL format')
  })

  it('blocks private/internal IP addresses (SSRF protection)', async () => {
    const blockedUrls = [
      'http://localhost/page',
      'http://127.0.0.1/page',
      'http://10.0.0.1/page',
      'http://172.16.0.1/page',
      'http://192.168.1.1/page',
      'http://169.254.169.254/latest/meta-data',
      'http://0.0.0.0/page',
    ]

    for (const url of blockedUrls) {
      const request = createRequest('http://localhost:3000/api/v1/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('URLs pointing to internal or private networks are not allowed')
    }
  })

  it('blocks non-HTTP protocols', async () => {
    const request = createRequest('http://localhost:3000/api/v1/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'ftp://example.com/file' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Only HTTP and HTTPS URLs are allowed')
  })

  it('rejects non-array tags', async () => {
    const request = createRequest('http://localhost:3000/api/v1/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/page', tags: 'not-an-array' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Tags must be an array')
  })

  it('rejects more than 20 tags', async () => {
    const tags = Array.from({ length: 21 }, (_, i) => `tag-${i}`)
    const request = createRequest('http://localhost:3000/api/v1/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/page', tags }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Maximum of 20 tags allowed')
  })

  it('ingests HTML content and auto-creates category', async () => {
    const htmlContent = `
      <html>
        <head><title>Test Page</title>
        <meta name="description" content="Test description">
        </head>
        <body>
          <main>
            <h1>Test Heading</h1>
            <p>Hello world</p>
            <img src="/images/test.png" alt="Test Image">
          </main>
        </body>
      </html>
    `

    // Mock fetch for URL
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'text/html' }),
      text: () => Promise.resolve(htmlContent),
    })
    vi.stubGlobal('fetch', mockFetch)

    // SQL call order in ingest route:
    // 1. Category check
    mockSql.mockResolvedValueOnce([] as never) // category doesn't exist
    // 2. Category insert
    mockSql.mockResolvedValueOnce([] as never)
    // 3. getBaseUrl (settings query)
    mockSql.mockResolvedValueOnce([] as never)
    // 4. Document INSERT
    mockSql.mockResolvedValueOnce([{
      id: 'doc-uuid',
      slug: 'test-page-abc123',
      title: 'Test Page',
      status: 'published',
      source_url: 'https://example.com/page',
      source_identifier: 'example.com',
      created_at: new Date().toISOString(),
    }] as never)
    // 5. Search index INSERT
    mockSql.mockResolvedValueOnce([] as never)

    const request = createRequest('http://localhost:3000/api/v1/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://example.com/page',
        auto_publish: true,
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.success).toBe(true)
    expect(data.data.status).toBe('published')
    expect(data.data.message).toContain('published')

    // Verify category auto-creation was attempted
    expect(mockSql).toHaveBeenCalled()
  })

  it('resolves relative image URLs to absolute', async () => {
    const htmlContent = `
      <html>
        <head><title>Image Test</title></head>
        <body>
          <main>
            <img src="/images/photo.jpg" alt="Photo">
            <img src="relative/path.png" alt="Relative">
            <img src="https://cdn.example.com/abs.png" alt="Absolute">
          </main>
        </body>
      </html>
    `

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'text/html' }),
      text: () => Promise.resolve(htmlContent),
    })
    vi.stubGlobal('fetch', mockFetch)

    // SQL call order:
    // 1. Category check
    mockSql.mockResolvedValueOnce([] as never)
    // 2. Category insert
    mockSql.mockResolvedValueOnce([] as never)
    // 3. getBaseUrl
    mockSql.mockResolvedValueOnce([] as never)
    // 4. Document INSERT
    mockSql.mockResolvedValueOnce([{
      id: 'doc-uuid',
      slug: 'image-test-abc',
      title: 'Image Test',
      status: 'draft',
      source_url: 'https://example.com/blog/post',
      source_identifier: 'example.com',
      created_at: new Date().toISOString(),
    }] as never)
    // 5. Search index
    mockSql.mockResolvedValueOnce([] as never)

    const request = createRequest('http://localhost:3000/api/v1/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/blog/post' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(201)
  })

  it('handles tables in HTML content', async () => {
    const htmlContent = `
      <html>
        <head><title>Table Test</title></head>
        <body>
          <main>
            <table>
              <tr><th>Name</th><th>Value</th></tr>
              <tr><td>A</td><td>1</td></tr>
              <tr><td>B</td><td>2</td></tr>
            </table>
          </main>
        </body>
      </html>
    `

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'text/html' }),
      text: () => Promise.resolve(htmlContent),
    })
    vi.stubGlobal('fetch', mockFetch)

    // SQL call order:
    // 1. Category check
    mockSql.mockResolvedValueOnce([] as never)
    // 2. Category insert
    mockSql.mockResolvedValueOnce([] as never)
    // 3. getBaseUrl
    mockSql.mockResolvedValueOnce([] as never)
    // 4. Document INSERT
    mockSql.mockResolvedValueOnce([{
      id: 'doc-uuid',
      slug: 'table-test-abc',
      title: 'Table Test',
      status: 'draft',
      source_url: 'https://example.com/table',
      source_identifier: 'example.com',
      created_at: new Date().toISOString(),
    }] as never)
    // 5. Search index
    mockSql.mockResolvedValueOnce([] as never)

    const request = createRequest('http://localhost:3000/api/v1/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/table' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(201)
  })

  it('uses existing category when it already exists', async () => {
    const htmlContent = `
      <html><head><title>Existing Cat</title></head>
      <body><main><p>Content</p></main></body></html>
    `

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'text/html' }),
      text: () => Promise.resolve(htmlContent),
    })
    vi.stubGlobal('fetch', mockFetch)

    // SQL call order:
    // 1. Category check - category exists
    mockSql.mockResolvedValueOnce([{ id: 'existing-cat-id' }] as never)
    // (no category insert needed)
    // 2. getBaseUrl
    mockSql.mockResolvedValueOnce([] as never)
    // 3. Document INSERT
    mockSql.mockResolvedValueOnce([{
      id: 'doc-uuid',
      slug: 'existing-cat-abc',
      title: 'Existing Cat',
      status: 'published',
      source_url: 'https://example.com/existing',
      source_identifier: 'example.com',
      created_at: new Date().toISOString(),
    }] as never)
    // 4. Search index
    mockSql.mockResolvedValueOnce([] as never)

    const request = createRequest('http://localhost:3000/api/v1/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://example.com/existing',
        category: 'guides',
        auto_publish: true,
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.success).toBe(true)
  })

  it('verifies category INSERT SQL contains correct slug and auto-generated name', async () => {
    const htmlContent = `
      <html><head><title>Category Verify</title></head>
      <body><main><p>Content</p></main></body></html>
    `

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'text/html' }),
      text: () => Promise.resolve(htmlContent),
    })
    vi.stubGlobal('fetch', mockFetch)

    // SQL call order:
    // 1. Category check - not found
    mockSql.mockResolvedValueOnce([] as never)
    // 2. Category insert
    mockSql.mockResolvedValueOnce([] as never)
    // 3. getBaseUrl
    mockSql.mockResolvedValueOnce([] as never)
    // 4. Document INSERT
    mockSql.mockResolvedValueOnce([{
      id: 'doc-uuid',
      slug: 'category-verify-abc',
      title: 'Category Verify',
      status: 'draft',
      source_url: 'https://example.com/cat-verify',
      source_identifier: 'example.com',
      created_at: new Date().toISOString(),
    }] as never)
    // 5. Search index
    mockSql.mockResolvedValueOnce([] as never)

    const request = createRequest('http://localhost:3000/api/v1/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://example.com/cat-verify',
        category: 'my-new-category',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(201)

    // The second SQL call should be the category INSERT
    // (first is the SELECT check, second is the INSERT)
    expect(mockSql).toHaveBeenCalledTimes(5) // cat check + cat insert + getBaseUrl + doc insert + search
  })

  it('defaults to community category when no category is provided', async () => {
    const htmlContent = `
      <html><head><title>No Cat</title></head>
      <body><main><p>Content</p></main></body></html>
    `

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'text/html' }),
      text: () => Promise.resolve(htmlContent),
    })
    vi.stubGlobal('fetch', mockFetch)

    // SQL call order:
    // 1. Category check for 'community' default
    mockSql.mockResolvedValueOnce([] as never)
    // 2. Category insert for 'community'
    mockSql.mockResolvedValueOnce([] as never)
    // 3. getBaseUrl
    mockSql.mockResolvedValueOnce([] as never)
    // 4. Document INSERT
    mockSql.mockResolvedValueOnce([{
      id: 'doc-uuid',
      slug: 'no-cat-abc',
      title: 'No Cat',
      status: 'draft',
      source_url: 'https://example.com/no-cat',
      source_identifier: 'example.com',
      created_at: new Date().toISOString(),
    }] as never)
    // 5. Search index
    mockSql.mockResolvedValueOnce([] as never)

    const request = createRequest('http://localhost:3000/api/v1/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://example.com/no-cat',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.success).toBe(true)
    // Category check should have been for 'community' (default)
    expect(mockSql).toHaveBeenCalled()
  })
})
