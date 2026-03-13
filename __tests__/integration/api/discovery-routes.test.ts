import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the db module
vi.mock('@/lib/db', () => ({
  sql: vi.fn(),
  DEFAULT_TENANT_ID: '00000000-0000-0000-0000-000000000001',
}))

import { sql } from '@/lib/db'

const mockSql = vi.mocked(sql)

// ── Sitemap.xml ─────────────────────────────────────────────────────────────

describe('GET /sitemap.xml', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    delete process.env.NEXT_PUBLIC_BASE_URL
  })

  async function importSitemap() {
    const mod = await import('@/app/sitemap.xml/route')
    return mod.GET
  }

  it('uses localhost:3000 as default domain', async () => {
    // getBaseUrl settings query → empty
    mockSql.mockResolvedValueOnce([] as never)
    // documents query
    mockSql.mockResolvedValueOnce([] as never)
    // categories query
    mockSql.mockResolvedValueOnce([] as never)

    const GET = await importSitemap()
    const response = await GET()
    const xml = await response.text()

    expect(xml).toContain('http://localhost:3000')
    expect(xml).not.toContain('opendocs.example.com')
  })

  it('uses NEXT_PUBLIC_BASE_URL env var when set', async () => {
    process.env.NEXT_PUBLIC_BASE_URL = 'https://custom-domain.com'

    // getBaseUrl settings query → empty
    mockSql.mockResolvedValueOnce([] as never)
    // documents query
    mockSql.mockResolvedValueOnce([] as never)
    // categories query
    mockSql.mockResolvedValueOnce([] as never)

    const GET = await importSitemap()
    const response = await GET()
    const xml = await response.text()

    expect(xml).toContain('https://custom-domain.com')
  })

  it('uses settings table base_url when available', async () => {
    // getBaseUrl settings query → returns value
    mockSql.mockResolvedValueOnce([{ value: '"https://from-settings.com"' }] as never)
    // documents query
    mockSql.mockResolvedValueOnce([] as never)
    // categories query
    mockSql.mockResolvedValueOnce([] as never)

    const GET = await importSitemap()
    const response = await GET()
    const xml = await response.text()

    expect(xml).toContain('https://from-settings.com')
  })

  it('returns valid XML with proper content type', async () => {
    mockSql.mockResolvedValueOnce([] as never)
    mockSql.mockResolvedValueOnce([] as never)
    mockSql.mockResolvedValueOnce([] as never)

    const GET = await importSitemap()
    const response = await GET()

    expect(response.headers.get('Content-Type')).toBe('application/xml')
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600')

    const xml = await response.text()
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')
    expect(xml).toContain('</urlset>')
  })

  it('includes static pages with lastmod', async () => {
    mockSql.mockResolvedValueOnce([] as never)
    mockSql.mockResolvedValueOnce([] as never)
    mockSql.mockResolvedValueOnce([] as never)

    const GET = await importSitemap()
    const response = await GET()
    const xml = await response.text()

    // All static pages should have <lastmod>
    expect(xml).toContain('<loc>http://localhost:3000</loc>')
    expect(xml).toContain('<loc>http://localhost:3000/docs</loc>')
    expect(xml).toContain('<loc>http://localhost:3000/docs/api</loc>')
    expect(xml).toContain('<loc>http://localhost:3000/docs/mcp</loc>')
    expect(xml).toContain('<loc>http://localhost:3000/submit</loc>')
    expect(xml).toContain('<loc>http://localhost:3000/search</loc>')
    expect(xml).toContain('<loc>http://localhost:3000/settings</loc>')

    // Every <url> should have a <lastmod>
    const urlCount = (xml.match(/<url>/g) || []).length
    const lastmodCount = (xml.match(/<lastmod>/g) || []).length
    expect(lastmodCount).toBe(urlCount)
  })

  it('includes document pages with lastmod', async () => {
    const now = new Date()
    mockSql.mockResolvedValueOnce([] as never)
    mockSql.mockResolvedValueOnce([
      { slug: 'getting-started', title: 'Getting Started', description: 'Intro', updated_at: now, published_at: now, category: 'guides' },
      { slug: 'api-reference', title: 'API Reference', description: 'API docs', updated_at: now, published_at: now, category: 'api' },
    ] as never)
    mockSql.mockResolvedValueOnce([] as never)

    const GET = await importSitemap()
    const response = await GET()
    const xml = await response.text()

    expect(xml).toContain('<loc>http://localhost:3000/docs/getting-started</loc>')
    expect(xml).toContain('<loc>http://localhost:3000/docs/api-reference</loc>')
  })

  it('includes category pages for non-empty categories', async () => {
    const now = new Date()
    mockSql.mockResolvedValueOnce([] as never)
    mockSql.mockResolvedValueOnce([] as never)
    mockSql.mockResolvedValueOnce([
      { slug: 'guides', name: 'Guides', updated_at: now, document_count: 3 },
      { slug: 'empty', name: 'Empty', updated_at: now, document_count: 0 },
    ] as never)

    const GET = await importSitemap()
    const response = await GET()
    const xml = await response.text()

    expect(xml).toContain('<loc>http://localhost:3000/docs/category/guides</loc>')
    expect(xml).not.toContain('/docs/category/empty</loc>')
  })

  it('handles database errors gracefully', async () => {
    mockSql.mockResolvedValueOnce([] as never)
    mockSql.mockRejectedValueOnce(new Error('DB error') as never)

    const GET = await importSitemap()
    const response = await GET()
    const xml = await response.text()

    // Should still return valid XML with at least static pages
    expect(response.status).toBe(200)
    expect(xml).toContain('<urlset')
    expect(xml).toContain('</urlset>')
  })
})

// ── Robots.txt ──────────────────────────────────────────────────────────────

describe('GET /robots.txt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    delete process.env.NEXT_PUBLIC_BASE_URL
  })

  async function importRobots() {
    const mod = await import('@/app/robots.txt/route')
    return mod.GET
  }

  it('uses localhost:3000 as default domain', async () => {
    // getBaseUrl settings query
    mockSql.mockResolvedValueOnce([] as never)

    const GET = await importRobots()
    const response = await GET()
    const text = await response.text()

    expect(text).toContain('http://localhost:3000')
    expect(text).not.toContain('opendocs.example.com')
  })

  it('returns proper content type', async () => {
    mockSql.mockResolvedValueOnce([] as never)

    const GET = await importRobots()
    const response = await GET()

    expect(response.headers.get('Content-Type')).toBe('text/plain')
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=86400')
  })

  it('includes sitemap reference', async () => {
    mockSql.mockResolvedValueOnce([] as never)

    const GET = await importRobots()
    const response = await GET()
    const text = await response.text()

    expect(text).toContain('Sitemap: http://localhost:3000/sitemap.xml')
  })

  it('includes proper crawler directives', async () => {
    mockSql.mockResolvedValueOnce([] as never)

    const GET = await importRobots()
    const response = await GET()
    const text = await response.text()

    expect(text).toContain('User-agent: *')
    expect(text).toContain('Allow: /')
    expect(text).toContain('Disallow: /api/')
    expect(text).toContain('Allow: /api/docs')
    expect(text).toContain('Allow: /api/health')
  })

  it('uses settings table base_url when available', async () => {
    mockSql.mockResolvedValueOnce([{ value: '"https://from-settings.com"' }] as never)

    const GET = await importRobots()
    const response = await GET()
    const text = await response.text()

    expect(text).toContain('https://from-settings.com')
    expect(text).toContain('Sitemap: https://from-settings.com/sitemap.xml')
  })
})

// ── RSS.xml ─────────────────────────────────────────────────────────────────

describe('GET /rss.xml', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    delete process.env.NEXT_PUBLIC_BASE_URL
  })

  async function importRss() {
    const mod = await import('@/app/rss.xml/route')
    return mod.GET
  }

  it('uses localhost:3000 as default domain', async () => {
    mockSql.mockResolvedValueOnce([] as never)
    mockSql.mockResolvedValueOnce([] as never)

    const GET = await importRss()
    const response = await GET()
    const xml = await response.text()

    expect(xml).toContain('http://localhost:3000')
    expect(xml).not.toContain('opendocs.example.com')
  })

  it('returns valid RSS XML', async () => {
    mockSql.mockResolvedValueOnce([] as never)
    mockSql.mockResolvedValueOnce([] as never)

    const GET = await importRss()
    const response = await GET()

    expect(response.headers.get('Content-Type')).toBe('application/rss+xml')

    const xml = await response.text()
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xml).toContain('<rss version="2.0"')
    expect(xml).toContain('<channel>')
    expect(xml).toContain('</channel>')
    expect(xml).toContain('</rss>')
  })

  it('includes documents as items', async () => {
    const now = new Date()
    mockSql.mockResolvedValueOnce([] as never)
    mockSql.mockResolvedValueOnce([
      {
        slug: 'test-doc',
        title: 'Test Document',
        description: 'A test',
        content: 'Test content',
        category: 'guides',
        author_name: 'Author',
        source_identifier: null,
        published_at: now,
        updated_at: now,
        created_at: now,
      },
    ] as never)

    const GET = await importRss()
    const response = await GET()
    const xml = await response.text()

    expect(xml).toContain('<title>Test Document</title>')
    expect(xml).toContain('<link>http://localhost:3000/docs/test-doc</link>')
    expect(xml).toContain('<author>Author</author>')
  })
})

// ── llms-index.json ─────────────────────────────────────────────────────────

describe('GET /llms-index.json', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    delete process.env.NEXT_PUBLIC_BASE_URL
  })

  async function importLlmsIndex() {
    const mod = await import('@/app/llms-index.json/route')
    return mod.GET
  }

  it('uses localhost:3000 as default domain', async () => {
    mockSql.mockResolvedValueOnce([] as never)
    mockSql.mockResolvedValueOnce([] as never)
    mockSql.mockResolvedValueOnce([] as never)

    const GET = await importLlmsIndex()
    const response = await GET()
    const data = await response.json()

    expect(data.base_url).toBe('http://localhost:3000')
    expect(data.endpoints.mcp).toBe('http://localhost:3000/api/mcp')
  })

  it('returns valid JSON with proper structure', async () => {
    mockSql.mockResolvedValueOnce([] as never)
    mockSql.mockResolvedValueOnce([] as never)
    mockSql.mockResolvedValueOnce([] as never)

    const GET = await importLlmsIndex()
    const response = await GET()
    const data = await response.json()

    expect(data.name).toBe('Onboard')
    expect(data.stats).toBeDefined()
    expect(data.endpoints).toBeDefined()
    expect(data.mcp).toBeDefined()
    expect(data.categories).toBeInstanceOf(Array)
    expect(data.documents).toBeInstanceOf(Array)
  })

  it('uses settings table base_url when available', async () => {
    mockSql.mockResolvedValueOnce([{ value: '"https://from-settings.com"' }] as never)
    mockSql.mockResolvedValueOnce([] as never)
    mockSql.mockResolvedValueOnce([] as never)

    const GET = await importLlmsIndex()
    const response = await GET()
    const data = await response.json()

    expect(data.base_url).toBe('https://from-settings.com')
  })
})

// ── OpenAPI /api/docs ───────────────────────────────────────────────────────

describe('GET /api/docs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    delete process.env.NEXT_PUBLIC_BASE_URL
  })

  async function importDocs() {
    const mod = await import('@/app/api/docs/route')
    return mod.GET
  }

  it('uses localhost:3000 as default server URL', async () => {
    const GET = await importDocs()
    const response = await GET()
    const spec = await response.json()

    expect(spec.servers[0].url).toBe('http://localhost:3000/api/v1')
    expect(spec.servers[0].url).not.toContain('opendocs.example.com')
  })

  it('uses NEXT_PUBLIC_BASE_URL env var when set', async () => {
    process.env.NEXT_PUBLIC_BASE_URL = 'https://custom-domain.com'

    const GET = await importDocs()
    const response = await GET()
    const spec = await response.json()

    expect(spec.servers[0].url).toBe('https://custom-domain.com/api/v1')
  })
})

// ── .well-known/agent.json ──────────────────────────────────────────────────

describe('GET /.well-known/agent.json', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    delete process.env.NEXT_PUBLIC_BASE_URL
  })

  async function importAgentJson() {
    const mod = await import('@/app/.well-known/agent.json/route')
    return mod.GET
  }

  it('uses localhost:3000 as default domain', async () => {
    mockSql.mockResolvedValueOnce([] as never)

    const GET = await importAgentJson()
    const response = await GET()
    const data = await response.json()

    expect(data.url).toBe('http://localhost:3000')
  })

  it('returns valid JSON with proper structure', async () => {
    mockSql.mockResolvedValueOnce([] as never)

    const GET = await importAgentJson()
    const response = await GET()
    const data = await response.json()

    expect(data.name).toBe('Onboard')
    expect(data.schema_version).toBe('1.0.0')
    expect(data.provider).toBeDefined()
    expect(data.provider.organization).toBe('Platphorm News Network')
    expect(data.provider.url).toBe('https://platphormnews.com')
    expect(data.capabilities).toBeDefined()
    expect(data.capabilities.mcp).toBeDefined()
    expect(data.capabilities.mcp.endpoint).toContain('/api/mcp')
    expect(data.capabilities.rest_api).toBeDefined()
    expect(data.discovery).toBeDefined()
    expect(data.discovery.sitemap).toContain('/sitemap.xml')
    expect(data.discovery.llms_txt).toContain('/llms.txt')
    expect(data.ecosystem).toBeDefined()
    expect(data.ecosystem.parent).toBe('https://platphormnews.com')
  })

  it('uses settings table base_url when available', async () => {
    mockSql.mockResolvedValueOnce([{ value: '"https://from-settings.com"' }] as never)

    const GET = await importAgentJson()
    const response = await GET()
    const data = await response.json()

    expect(data.url).toBe('https://from-settings.com')
    expect(data.capabilities.mcp.endpoint).toBe('https://from-settings.com/api/mcp')
  })

  it('returns proper content type and cache headers', async () => {
    mockSql.mockResolvedValueOnce([] as never)

    const GET = await importAgentJson()
    const response = await GET()

    expect(response.headers.get('Cache-Control')).toBe('public, max-age=86400')
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })

  it('includes MCP tools and resources', async () => {
    mockSql.mockResolvedValueOnce([] as never)

    const GET = await importAgentJson()
    const response = await GET()
    const data = await response.json()

    expect(data.capabilities.mcp.tools).toBeInstanceOf(Array)
    expect(data.capabilities.mcp.tools.length).toBeGreaterThan(0)
    expect(data.capabilities.mcp.resources).toBeInstanceOf(Array)
    expect(data.capabilities.mcp.prompts).toBeInstanceOf(Array)
    expect(data.capabilities.mcp.protocol).toBe('JSON-RPC 2.0')
  })

  it('includes all discovery URLs', async () => {
    mockSql.mockResolvedValueOnce([] as never)

    const GET = await importAgentJson()
    const response = await GET()
    const data = await response.json()

    expect(data.discovery.sitemap).toBeDefined()
    expect(data.discovery.robots).toBeDefined()
    expect(data.discovery.rss).toBeDefined()
    expect(data.discovery.llms_txt).toBeDefined()
    expect(data.discovery.llms_full).toBeDefined()
    expect(data.discovery.llms_index).toBeDefined()
    expect(data.discovery.openapi).toBeDefined()
    expect(data.discovery.humans_txt).toBeDefined()
    expect(data.discovery.security_txt).toBeDefined()
    expect(data.discovery.manifest).toBeDefined()
  })
})

// ── .well-known/security.txt ────────────────────────────────────────────────

describe('GET /.well-known/security.txt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    delete process.env.NEXT_PUBLIC_BASE_URL
  })

  async function importSecurityTxt() {
    const mod = await import('@/app/.well-known/security.txt/route')
    return mod.GET
  }

  it('returns proper content type', async () => {
    mockSql.mockResolvedValueOnce([] as never)

    const GET = await importSecurityTxt()
    const response = await GET()

    expect(response.headers.get('Content-Type')).toBe('text/plain')
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=86400')
  })

  it('includes required security.txt fields', async () => {
    mockSql.mockResolvedValueOnce([] as never)

    const GET = await importSecurityTxt()
    const response = await GET()
    const text = await response.text()

    expect(text).toContain('Contact: mailto:security@platphormnews.com')
    expect(text).toContain('Expires:')
    expect(text).toContain('Preferred-Languages: en')
    expect(text).toContain('Canonical:')
    expect(text).toContain('Policy:')
  })

  it('uses localhost:3000 as default domain', async () => {
    mockSql.mockResolvedValueOnce([] as never)

    const GET = await importSecurityTxt()
    const response = await GET()
    const text = await response.text()

    expect(text).toContain('http://localhost:3000')
  })

  it('uses settings table base_url when available', async () => {
    mockSql.mockResolvedValueOnce([{ value: '"https://from-settings.com"' }] as never)

    const GET = await importSecurityTxt()
    const response = await GET()
    const text = await response.text()

    expect(text).toContain('https://from-settings.com')
  })
})
