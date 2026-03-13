// @vitest-environment node
/**
 * 🌮 REAL MCP INTEGRATION TESTS — opendocs-mcp
 *
 * Uses @modelcontextprotocol/sdk InMemoryTransport to wire a real MCP Client
 * directly to the real McpServer factory (`createMcpServer`) — no HTTP, no
 * faked JSON-RPC. The full MCP initialize/negotiate handshake runs in-process.
 *
 * Test theme: taco docs 🌮 — the tastiest documentation on the internet.
 *
 * ── SQL Mock Design ─────────────────────────────────────────────────────────
 * The sql mock uses a queue rather than mockResolvedValueOnce, with two
 * categories of calls auto-handled WITHOUT consuming from the queue:
 *
 *   1. getBaseUrl() pattern: queries containing "'base_url'" in template strings.
 *      The base_url settings lookup always returns [] and falls through to the
 *      hardcoded default https://docs.platphormnews.com.
 *
 *   2. SQL fragment calls: used inside template literals for conditional WHERE
 *      clauses (e.g. `${cat ? sql`AND cat=${cat}` : sql``}`). Real queries
 *      start with SELECT/INSERT/UPDATE/DELETE/WITH — everything else is a
 *      fragment and auto-skipped.
 *
 * ── Error Assertion Design ───────────────────────────────────────────────────
 * callTool() NEVER rejects. When the handler throws, the MCP SDK returns:
 *   { isError: true, content: [{ type: 'text', text: error.message }] }
 * getPrompt() and readResource() DO reject on handler throw.
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import type { Client } from '@modelcontextprotocol/sdk/client/index.js'

// ─── Hoisted mock factories ───────────────────────────────────────────────────
// vi.hoisted ensures these values exist in both the vi.mock() factory (hoisted
// before imports) and the rest of the test file.

const {
  sqlMock,
  sqlQueue,
  generateSEOMetadataMock,
  updateDocumentSEOMock,
  parseMarkdownMock,
  extractTOCMock,
  readFileMock,
  statMock,
} = vi.hoisted(() => {
  // Queue of results consumed by real SQL queries.
  const sqlQueue: unknown[][] = []

  const sqlMock = Object.assign(
    vi.fn((...args: unknown[]) => {
      const strings = args[0] as TemplateStringsArray | undefined

      // Non-template call safety guard
      if (!Array.isArray(strings)) return Promise.resolve([])

      // ── getBaseUrl() auto-detection ────────────────────────────────────────
      // The base_url settings query has the literal string "'base_url'" in its
      // template parts. Always return [] so the helper falls through to the
      // default URL 'https://docs.platphormnews.com'.
      if (strings.some((s: unknown) => typeof s === 'string' && (s as string).includes("'base_url'"))) {
        return Promise.resolve([])
      }

      // ── SQL fragment auto-detection ────────────────────────────────────────
      // Real queries start with SQL command keywords.
      // Fragments (AND …, OR …, NOW(), NULL, empty string, comma-prefix, …)
      // don't start with those keywords and are returned as undefined so the
      // outer sql call treats them as plain values (which it ignores anyway).
      const first = ((strings[0] as string) ?? '').trimStart()
      if (!/^(SELECT|INSERT|UPDATE|DELETE|WITH|CREATE)/i.test(first)) {
        return undefined
      }

      // ── Real query: pop next result from queue (or empty fallback) ─────────
      return Promise.resolve(sqlQueue.length > 0 ? sqlQueue.shift()! : [])
    }),
    // sql.unsafe(str) is used for dynamic ORDER BY fragments — always a no-op
    { unsafe: vi.fn((s: string) => s) },
  )

  const generateSEOMetadataMock = vi.fn().mockResolvedValue({
    ogTitle: '🌮 The Ultimate Taco Guide',
    ogDescription: 'Everything you never knew you needed to know about tacos.',
    ogImage: 'https://docs.platphormnews.com/og/taco-guide.png',
    twitterCard: 'summary_large_image',
    canonicalUrl: 'https://docs.platphormnews.com/docs/the-ultimate-taco-guide',
    readingTimeMinutes: 2,
    wordCount: 420,
    emojiSummary: '🌮🔥✨',
  })
  const updateDocumentSEOMock = vi.fn().mockResolvedValue(undefined)
  const parseMarkdownMock = vi.fn((content: string) => `<p>${content}</p>`)
  const extractTOCMock = vi.fn().mockReturnValue([
    { id: 'ingredients', text: 'Ingredients', level: 2 },
    { id: 'method', text: 'Method', level: 2 },
  ])
  const readFileMock = vi.fn().mockResolvedValue(
    '# OpenDocs 🌮\n\nThe tastiest documentation platform.\n\n## Features\n\n- Real MCP\n- Taco emoji 🌮🔥',
  )
  const statMock = vi.fn().mockResolvedValue({ mtime: new Date('2026-01-01T00:00:00Z') })

  return {
    sqlMock, sqlQueue,
    generateSEOMetadataMock, updateDocumentSEOMock,
    parseMarkdownMock, extractTOCMock,
    readFileMock, statMock,
  }
})

vi.mock('@/lib/db', () => ({
  sql: sqlMock,
  DEFAULT_TENANT_ID: '00000000-0000-0000-0000-000000000001',
}))
vi.mock('@/lib/seo-generator', () => ({
  generateSEOMetadata: generateSEOMetadataMock,
  updateDocumentSEO: updateDocumentSEOMock,
  generateAEOMetadata: vi.fn().mockReturnValue({
    questions: ['What is the ultimate taco guide?'],
    directAnswer: 'The ultimate taco guide covers everything about tacos.',
    faqStructuredData: { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [] },
  }),
  generateGEOMetadata: vi.fn().mockReturnValue({
    summary: 'A comprehensive guide to tacos.',
    keyFacts: ['Tacos are delicious'],
    citationLabel: 'The Ultimate Taco Guide — OpenDocs',
    topicTags: ['tacos', 'food'],
  }),
  generateFullOptimization: vi.fn().mockResolvedValue({
    seo: {
      ogTitle: '🌮 The Ultimate Taco Guide',
      ogDescription: 'Everything about tacos.',
      ogImage: null,
      twitterCard: 'summary_large_image',
      canonicalUrl: 'https://docs.platphormnews.com/docs/the-ultimate-taco-guide',
      keywords: ['tacos'],
      readingTimeMinutes: 2,
      wordCount: 420,
      emojiSummary: '🌮🔥✨',
      structuredData: {},
    },
    aeo: {
      questions: ['What is the ultimate taco guide?'],
      directAnswer: 'The ultimate taco guide covers everything about tacos.',
      faqStructuredData: {},
    },
    geo: {
      summary: 'A comprehensive guide to tacos.',
      keyFacts: ['Tacos are delicious'],
      citationLabel: 'The Ultimate Taco Guide — OpenDocs',
      topicTags: ['tacos'],
    },
  }),
}))
vi.mock('@/lib/auto-name', () => ({
  generateSimpleSlug: vi.fn((title: string) => title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 72) + '-a1b2'),
}))
vi.mock('@/lib/markdown', () => ({
  parseMarkdown: parseMarkdownMock,
  extractTableOfContents: extractTOCMock,
}))
vi.mock('fs', () => ({
  // route uses: import { promises as fs } from 'fs'
  promises: { readFile: readFileMock, stat: statMock },
}))

// ─── Real server factory (imported AFTER mocks so deps are intercepted) ───────
// eslint-disable-next-line import/order
import { createMcpServer } from '@/app/api/mcp/route'

// ─── Shared MCP client ────────────────────────────────────────────────────────

let client: Client

beforeAll(async () => {
  // Stub global fetch before server creation so all tool fetch() calls are intercepted
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: vi.fn().mockResolvedValue(
      '<html><head><title>Taco Blog</title><meta name="description" content="Best tacos."/></head><body><p>🌮</p></body></html>',
    ),
    json: vi.fn().mockResolvedValue({
      result: { emojis: [{ name: 'taco', emoji: '🌮' }] },
    }),
  } as unknown as Response))

  const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js')
  const { Client: MClient } = await import('@modelcontextprotocol/sdk/client/index.js')

  // ── Wire real McpServer ↔ real Client via in-memory transport ───────────────
  const server = createMcpServer()
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)

  client = new MClient({ name: 'opendocs-test-client', version: '1.0.0' })
  await client.connect(clientTransport) // triggers full MCP initialize handshake ✅
})

afterAll(async () => {
  await client?.close()
})

beforeEach(() => {
  // Clear the SQL queue between tests
  sqlQueue.length = 0
  sqlMock.mockClear()
  sqlMock.unsafe.mockClear()
  // Reset fetch stub
  vi.mocked(global.fetch).mockResolvedValue({
    ok: true,
    status: 200,
    text: vi.fn().mockResolvedValue(
      '<html><head><title>Taco Blog</title></head><body><p>🌮</p></body></html>',
    ),
    json: vi.fn().mockResolvedValue({
      result: { emojis: [{ name: 'taco', emoji: '🌮' }] },
    }),
  } as unknown as Response)
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Seed the SQL query queue with sequential result rows.
 * getBaseUrl() and fragment calls are auto-handled by the smart mock and do
 * NOT consume from this queue — only real SELECT/INSERT/UPDATE/DELETE queries do.
 */
function db(...rows: unknown[][]): void {
  sqlQueue.length = 0
  rows.forEach(row => sqlQueue.push(row))
}

/** Extract text from a callTool result's first content block */
function toolText(result: Awaited<ReturnType<Client['callTool']>>): string {
  const block = (result.content as any)[0]
  if (!block || block.type !== 'text') throw new Error(`Expected text block, got: ${JSON.stringify((result.content as any)[0])}`)
  return block.text
}

/** Parse callTool result as JSON */
function toolJSON(result: Awaited<ReturnType<Client['callTool']>>): Record<string, unknown> {
  return JSON.parse(toolText(result)) as Record<string, unknown>
}

/**
 * Assert a callTool result is an error (isError:true) with matching message.
 * callTool() NEVER rejects — it wraps errors as { isError:true, content:[...] }.
 */
function expectToolError(result: Awaited<ReturnType<Client['callTool']>>, pattern?: string | RegExp): void {
  expect(result.isError, `Expected isError:true, got: ${JSON.stringify(result)}`).toBe(true)
  if (pattern) {
    const text = toolText(result)
    if (typeof pattern === 'string') expect(text).toContain(pattern)
    else expect(text).toMatch(pattern)
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 🔧 TOOLS/LIST
// ═════════════════════════════════════════════════════════════════════════════

describe('🔧 tools/list', () => {
  const EXPECTED_TOOLS = [
    'list_documents', 'get_document', 'create_document', 'update_document', 'delete_document',
    'search', 'list_categories', 'get_related_docs', 'submit_content', 'ingest_url',
    'get_emoji', 'add_emoji_to_doc', 'bulk_import', 'regenerate_seo', 'export_docs',
    'get_stats', 'trigger_webhook', 'list_integrations', 'call_integration',
    'parse_markdown', 'generate_share_links', 'list_project_docs', 'get_project_doc',
  ]

  it('advertises exactly 24 tools', async () => {
    const { tools } = await client.listTools()
    expect(tools).toHaveLength(24)
  })

  it('includes all expected tool names', async () => {
    const { tools } = await client.listTools()
    const names = tools.map(t => t.name)
    expect(names).toEqual(expect.arrayContaining(EXPECTED_TOOLS))
  })

  it('every tool has a non-empty description and an inputSchema', async () => {
    const { tools } = await client.listTools()
    for (const tool of tools) {
      expect(tool.description, `${tool.name} missing description`).toBeTruthy()
      expect(tool.inputSchema, `${tool.name} missing inputSchema`).toBeDefined()
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 📄 list_documents
// ═════════════════════════════════════════════════════════════════════════════

describe('📄 list_documents', () => {
  const tacoDoc = {
    id: 'taco-001', slug: 'the-ultimate-taco-guide', title: 'The Ultimate Taco Guide 🌮',
    category: 'taco-docs', emoji_summary: '🌮🔥', reading_time_minutes: 2,
  }

  it('returns a paginated document list', async () => {
    // getBaseUrl() → auto | SELECT docs | SELECT COUNT
    db([tacoDoc], [{ count: 1 }])
    const result = toolJSON(await client.callTool({ name: 'list_documents', arguments: {} }))
    expect(result.documents).toHaveLength(1)
    expect((result.documents as typeof tacoDoc[])[0].slug).toBe('the-ultimate-taco-guide')
    expect(result.count).toBe(1)
    expect(result.total).toBe(1)
    expect(result.has_more).toBe(false)
  })

  it('filters by category', async () => {
    db([tacoDoc], [{ count: 1 }])
    const result = toolJSON(await client.callTool({ name: 'list_documents', arguments: { category: 'taco-docs' } }))
    expect((result.documents as typeof tacoDoc[])).toHaveLength(1)
  })

  it('returns empty list when no documents', async () => {
    db([], [{ count: 0 }])
    const result = toolJSON(await client.callTool({ name: 'list_documents', arguments: {} }))
    expect((result.documents as unknown[])).toHaveLength(0)
    expect(result.total).toBe(0)
    expect(result.has_more).toBe(false)
  })

  it('accepts sort=alphabetical', async () => {
    db([tacoDoc], [{ count: 1 }])
    const result = toolJSON(await client.callTool({ name: 'list_documents', arguments: { sort: 'alphabetical' } }))
    expect(Array.isArray(result.documents)).toBe(true)
  })

  it('accepts sort=popular', async () => {
    db([tacoDoc], [{ count: 1 }])
    const result = toolJSON(await client.callTool({ name: 'list_documents', arguments: { sort: 'popular' } }))
    expect(Array.isArray(result.documents)).toBe(true)
  })

  it('executes full-text search code path', async () => {
    // search path has no inner fragments — just search query + count
    db([tacoDoc], [{ count: 1 }])
    const result = toolJSON(await client.callTool({ name: 'list_documents', arguments: { search: 'taco' } }))
    expect(result.count).toBe(1)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 📝 create_document
// ═════════════════════════════════════════════════════════════════════════════

describe('📝 create_document', () => {
  it('returns slug, emoji, status, and url', async () => {
    // ensureCategoryExists: SELECT categories (not found) | INSERT categories
    // getBaseUrl() → auto | INSERT INTO documents RETURNING | INSERT search_index
    db([], [], [{ id: 'taco-001', slug: 'the-ultimate-taco-guide', emoji_summary: '🌮🔥✨' }])
    const result = toolJSON(await client.callTool({
      name: 'create_document',
      arguments: {
        title: 'The Ultimate Taco Guide 🌮',
        content: '## Ingredients\n\nTortilla, carnitas, salsa.\n\n## Method\n\nAssemble taco.',
        category: 'taco-docs',
        tags: ['tacos', 'food', 'mexico'],
        status: 'published',
      },
    }))
    expect(result.slug).toBe('the-ultimate-taco-guide')
    expect(result.status).toBe('published')
    expect(String(result.url)).toContain('the-ultimate-taco-guide')
  })

  it('auto-creates category in categories table when it does not exist', async () => {
    // ensureCategoryExists: SELECT categories (not found) | INSERT categories
    // getBaseUrl() → auto | INSERT doc | INSERT search_index
    db([], [], [{ id: 'taco-new', slug: 'new-taco-recipe', emoji_summary: '🌮' }])
    await client.callTool({
      name: 'create_document',
      arguments: {
        title: 'New Taco Recipe',
        content: 'A brand new taco.',
        category: 'new-tacos',
        status: 'published',
      },
    })
    // Verify category check SELECT was called
    const categoryCalls = sqlMock.mock.calls.filter(
      (call) => {
        const strings = call[0] as TemplateStringsArray | undefined
        if (!Array.isArray(strings)) return false
        const joined = strings.join('')
        return joined.includes('SELECT') && joined.includes('categories')
      }
    )
    expect(categoryCalls.length).toBeGreaterThanOrEqual(1)
    // Verify category INSERT was called
    const categoryInserts = sqlMock.mock.calls.filter(
      (call) => {
        const strings = call[0] as TemplateStringsArray | undefined
        if (!Array.isArray(strings)) return false
        const joined = strings.join('')
        return joined.includes('INSERT') && joined.includes('categories')
      }
    )
    expect(categoryInserts.length).toBeGreaterThanOrEqual(1)
  })

  it('skips category creation when category already exists', async () => {
    // ensureCategoryExists: SELECT categories (found) — no INSERT
    // getBaseUrl() → auto | INSERT doc | INSERT search_index
    db([{ id: 'existing-cat' }], [{ id: 'taco-existing', slug: 'existing-taco', emoji_summary: '🌮' }])
    await client.callTool({
      name: 'create_document',
      arguments: {
        title: 'Existing Taco',
        content: 'Taco with existing category.',
        category: 'taco-docs',
        status: 'published',
      },
    })
    // Only one INSERT into categories should NOT happen (category already exists)
    const categoryInserts = sqlMock.mock.calls.filter(
      (call) => {
        const strings = call[0] as TemplateStringsArray | undefined
        if (!Array.isArray(strings)) return false
        const joined = strings.join('')
        return joined.includes('INSERT INTO categories')
      }
    )
    expect(categoryInserts.length).toBe(0)
  })

  it('calls generateSEOMetadata for every new document', async () => {
    generateSEOMetadataMock.mockClear()
    db([{ id: 'taco-002', slug: 'birria-tacos', emoji_summary: '🌮🍖' }])
    await client.callTool({
      name: 'create_document',
      arguments: { title: 'Birria Tacos', content: 'Slow-braised beef.' },
    })
    expect(generateSEOMetadataMock).toHaveBeenCalledOnce()
  })

  it('derives slug from title (lowercased, hyphenated)', async () => {
    db([{ id: 'taco-003', slug: 'al-pastor-the-pineapple-king', emoji_summary: '🍍🌮' }])
    const result = toolJSON(await client.callTool({
      name: 'create_document',
      arguments: { title: 'Al Pastor: The Pineapple King', content: 'Pineapple on top.' },
    }))
    expect(String(result.slug)).toMatch(/^[a-z0-9-]+$/)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 🔍 get_document
// ═════════════════════════════════════════════════════════════════════════════

describe('🔍 get_document', () => {
  const doc = {
    id: 'taco-001', slug: 'the-ultimate-taco-guide', title: 'The Ultimate Taco Guide 🌮',
    description: 'Everything you need to know about tacos',
    content: '## Ingredients\n\nTortilla\n\n## Method\n\nEat it.',
    category: 'taco-docs', emoji_summary: '🌮🔥✨', updated_at: '2026-03-06T00:00:00Z',
  }

  it('full format returns content, toc, and url', async () => {
    // getBaseUrl() → auto | SELECT * FROM documents
    db([doc])
    const result = toolJSON(await client.callTool({ name: 'get_document', arguments: { slug: 'the-ultimate-taco-guide' } }))
    expect(result.title).toContain('Taco Guide')
    expect(Array.isArray(result.toc)).toBe(true)
    expect(String(result.url)).toContain('/docs/the-ultimate-taco-guide')
  })

  it('toc format returns toc array without full content', async () => {
    db([doc])
    const result = toolJSON(await client.callTool({ name: 'get_document', arguments: { slug: 'the-ultimate-taco-guide', format: 'toc' } }))
    expect(Array.isArray(result.toc)).toBe(true)
    expect(result.content).toBeUndefined()
  })

  it('metadata format returns title and category but not content', async () => {
    db([doc])
    const result = toolJSON(await client.callTool({ name: 'get_document', arguments: { slug: 'the-ultimate-taco-guide', format: 'metadata' } }))
    expect(result.title).toBeDefined()
    expect(result.category).toBeDefined()
    expect(result.content).toBeUndefined()
  })

  it('returns isError:true for unknown slug', async () => {
    // queue empty → SELECT returns [] → "Document not found" error
    const result = await client.callTool({ name: 'get_document', arguments: { slug: 'ghost-taco' } })
    expectToolError(result, 'Document not found')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// ✏️ update_document
// ═════════════════════════════════════════════════════════════════════════════

describe('✏️ update_document', () => {
  it('returns updated=true and calls updateDocumentSEO', async () => {
    updateDocumentSEOMock.mockClear()
    // getBaseUrl() → auto | SELECT existing | UPDATE docs | maybe UPDATE search_index
    db([{ id: 'taco-001' }])
    const result = toolJSON(await client.callTool({
      name: 'update_document',
      arguments: { slug: 'the-ultimate-taco-guide', title: 'The GREAT Taco Guide 🏆' },
    }))
    expect(result.updated).toBe(true)
    expect(result.slug).toBe('the-ultimate-taco-guide')
    expect(updateDocumentSEOMock).toHaveBeenCalledWith('the-ultimate-taco-guide', expect.any(String))
  })

  it('returns isError:true for unknown slug', async () => {
    // queue empty → SELECT returns [] → "Document not found"
    const result = await client.callTool({ name: 'update_document', arguments: { slug: 'ghost-taco' } })
    expectToolError(result, 'Document not found')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 🗑️ delete_document
// ═════════════════════════════════════════════════════════════════════════════

describe('🗑️ delete_document', () => {
  it('soft-deletes by default (permanent=false)', async () => {
    const result = toolJSON(await client.callTool({ name: 'delete_document', arguments: { slug: 'the-ultimate-taco-guide' } }))
    expect(result.deleted).toBe(true)
    expect(result.permanent).toBe(false)
  })

  it('permanently deletes when permanent=true', async () => {
    const result = toolJSON(await client.callTool({ name: 'delete_document', arguments: { slug: 'the-ultimate-taco-guide', permanent: true } }))
    expect(result.deleted).toBe(true)
    expect(result.permanent).toBe(true)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 🔎 search
// ═════════════════════════════════════════════════════════════════════════════

describe('🔎 search', () => {
  it('returns relevance-ranked results with url', async () => {
    // getBaseUrl() → auto | ${ highlight ? sql`ts_headline...` : sql`` } → fragment auto
    // | main search SELECT
    db([{ slug: 'al-pastor', title: 'Al Pastor 🌮', category: 'taco-docs', emoji_summary: '🌮', relevance: 0.95 }])
    const result = toolJSON(await client.callTool({ name: 'search', arguments: { query: 'pastor' } }))
    expect(result.query).toBe('pastor')
    expect((result.results as unknown[]).length).toBe(1)
    expect(result.count).toBe(1)
    const first = (result.results as Array<{ url: string; slug: string }>)[0]
    expect(first.url).toContain('/docs/al-pastor')
  })

  it('returns empty results for no match', async () => {
    // queue empty → search SELECT returns [] → count 0
    const result = toolJSON(await client.callTool({ name: 'search', arguments: { query: 'sushi' } }))
    expect(result.count).toBe(0)
    expect((result.results as unknown[]).length).toBe(0)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 🗂️ list_categories
// ═════════════════════════════════════════════════════════════════════════════

describe('🗂️ list_categories', () => {
  it('returns categories with doc_count', async () => {
    // No getBaseUrl() | SELECT from categories
    db([
      { slug: 'taco-docs', name: 'Taco Docs 🌮', description: 'All things tacos', doc_count: 7 },
      { slug: 'burrito-docs', name: 'Burrito Docs 🌯', description: 'All things burritos', doc_count: 3 },
    ])
    const result = toolJSON(await client.callTool({ name: 'list_categories', arguments: {} }))
    const cats = result.categories as Array<{ slug: string; doc_count: number }>
    expect(cats).toHaveLength(2)
    expect(cats[0].slug).toBe('taco-docs')
    expect(cats[0].doc_count).toBe(7)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 🔗 get_related_docs
// ═════════════════════════════════════════════════════════════════════════════

describe('🔗 get_related_docs', () => {
  it('returns docs in same category', async () => {
    // getBaseUrl() → auto | SELECT source doc | SELECT related docs
    db(
      [{ category: 'taco-docs', tags: ['tacos', 'food'] }],
      [{ slug: 'birria-tacos', title: 'Birria Tacos 🌮', category: 'taco-docs', emoji_summary: '🌮🍖' }],
    )
    const result = toolJSON(await client.callTool({
      name: 'get_related_docs',
      arguments: { slug: 'the-ultimate-taco-guide' },
    }))
    const related = result.related as Array<{ slug: string; url: string }>
    expect(related[0].slug).toBe('birria-tacos')
    expect(related[0].url).toContain('/docs/birria-tacos')
  })

  it('returns isError:true for unknown source slug', async () => {
    // queue empty → SELECT source returns [] → throws
    const result = await client.callTool({ name: 'get_related_docs', arguments: { slug: 'ghost-taco' } })
    expectToolError(result)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 📬 submit_content
// ═════════════════════════════════════════════════════════════════════════════

describe('📬 submit_content', () => {
  it('queues as pending when auto-approve is off', async () => {
    // getBaseUrl() → auto | SELECT settings(auto_approve) | INSERT submission
    db([{ value: 'false' }], [{ id: 'sub-taco-001' }])
    const result = toolJSON(await client.callTool({
      name: 'submit_content',
      arguments: {
        source_url: 'https://tacostand.example.com/recipe',
        title: 'Street Taco Secrets 🌮',
        content: '## The Secret\n\nLard. Always lard.',
        category: 'taco-docs',
        author_name: 'Chef Taco',
        author_email: 'chef@tacostand.example.com',
      },
    }))
    expect(result.status).toBe('pending')
    expect((result as { submission_id: string }).submission_id).toBeDefined()
  })

  it('auto-approves and creates document when setting is true', async () => {
    // getBaseUrl() → auto | SELECT settings | INSERT doc | INSERT search_index(fallback)
    db([{ value: 'true' }], [{ id: 'doc-taco-001', slug: 'street-taco-secrets' }])
    const result = toolJSON(await client.callTool({
      name: 'submit_content',
      arguments: {
        source_url: 'https://tacostand.example.com/recipe',
        title: 'Street Taco Secrets 🌮',
        content: 'All the secrets.',
      },
    }))
    expect(result.auto_approved).toBe(true)
    expect(result.slug).toBeDefined()
  })

  it('auto-creates category when auto-approved with a category', async () => {
    // getBaseUrl() → auto | SELECT settings(auto_approve=true)
    // ensureCategoryExists: SELECT categories (not found) | INSERT categories
    // INSERT doc | INSERT search_index
    db([{ value: 'true' }], [], [], [{ id: 'doc-cat-001', slug: 'taco-with-cat' }])
    const result = toolJSON(await client.callTool({
      name: 'submit_content',
      arguments: {
        source_url: 'https://tacostand.example.com/recipe',
        title: 'Taco With Category',
        content: 'Auto-approved taco with category.',
        category: 'submit-cat',
      },
    }))
    expect(result.auto_approved).toBe(true)
    // Verify category INSERT was called
    const categoryInserts = sqlMock.mock.calls.filter(
      (call) => {
        const strings = call[0] as TemplateStringsArray | undefined
        if (!Array.isArray(strings)) return false
        const joined = strings.join('')
        return joined.includes('INSERT') && joined.includes('categories')
      }
    )
    expect(categoryInserts.length).toBeGreaterThanOrEqual(1)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 🌐 ingest_url
// ═════════════════════════════════════════════════════════════════════════════

describe('🌐 ingest_url', () => {
  it('fetches URL with OpenDocs User-Agent and creates a draft', async () => {
    // ensureCategoryExists: SELECT categories (not found) | INSERT categories
    // getBaseUrl() → auto | sql`NULL` fragment auto | INSERT doc | INSERT idx(fallback)
    db([], [], [{ id: 'ing-001', slug: 'taco-blog' }])
    const result = toolJSON(await client.callTool({
      name: 'ingest_url',
      arguments: { url: 'https://tacostand.example.com/blog', category: 'taco-docs' },
    }))
    expect(result.slug).toBe('taco-blog')
    expect(result.status).toBe('draft')
    expect(result.source).toBe('https://tacostand.example.com/blog')
    // Verify the route sends a well-behaved User-Agent when crawling
    expect(fetch).toHaveBeenCalledWith(
      'https://tacostand.example.com/blog',
      expect.objectContaining({
        headers: expect.objectContaining({ 'User-Agent': expect.stringContaining('OpenDocs') }),
      }),
    )
  })

  it('auto-creates category when ingesting with a new category', async () => {
    // ensureCategoryExists: SELECT categories (not found) | INSERT categories
    // getBaseUrl() → auto | INSERT doc | INSERT idx
    db([], [], [{ id: 'ing-cat-001', slug: 'taco-blog-cat' }])
    await client.callTool({
      name: 'ingest_url',
      arguments: { url: 'https://tacostand.example.com/blog', category: 'new-ingest-cat' },
    })
    const categoryInserts = sqlMock.mock.calls.filter(
      (call) => {
        const strings = call[0] as TemplateStringsArray | undefined
        if (!Array.isArray(strings)) return false
        const joined = strings.join('')
        return joined.includes('INSERT') && joined.includes('categories')
      }
    )
    expect(categoryInserts.length).toBeGreaterThanOrEqual(1)
  })

  it('auto-publishes when auto_publish=true', async () => {
    // getBaseUrl() → auto | sql`NOW()` fragment auto | INSERT doc
    db([{ id: 'ing-002', slug: 'taco-blog' }])
    const result = toolJSON(await client.callTool({
      name: 'ingest_url',
      arguments: { url: 'https://tacostand.example.com/blog', auto_publish: true },
    }))
    expect(result.status).toBe('published')
  })

  it('returns isError:true when fetch returns a non-ok status', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({ ok: false, status: 404 } as Response)
    const result = await client.callTool({ name: 'ingest_url', arguments: { url: 'https://tacostand.example.com/404' } })
    expectToolError(result, 'Failed to fetch')
  })

  it('blocks private/internal URLs (SSRF protection)', async () => {
    const blocked = [
      'http://localhost/secret',
      'http://127.0.0.1/admin',
      'http://10.0.0.1/internal',
      'http://172.16.0.1/private',
      'http://192.168.1.1/lan',
      'http://169.254.169.254/metadata',
      'http://0.0.0.0/zero',
      'http://metadata.google.internal/computeMetadata',
      'http://[::1]/ipv6-loopback',
    ]
    for (const url of blocked) {
      const result = await client.callTool({ name: 'ingest_url', arguments: { url } })
      expectToolError(result, 'internal or private')
    }
  })

  it('blocks non-HTTP protocols (SSRF protection)', async () => {
    const result = await client.callTool({ name: 'ingest_url', arguments: { url: 'ftp://example.com/file' } })
    expectToolError(result, 'Only HTTP and HTTPS')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 😄 get_emoji
// ═════════════════════════════════════════════════════════════════════════════

describe('😄 get_emoji', () => {
  it('delegates to remote emoji MCP service and returns result', async () => {
    const result = toolJSON(await client.callTool({ name: 'get_emoji', arguments: { query: 'taco' } }))
    expect(result).toBeDefined()
    expect(typeof result).toBe('object')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 🎨 add_emoji_to_doc
// ═════════════════════════════════════════════════════════════════════════════

describe('🎨 add_emoji_to_doc', () => {
  it('stores emoji and returns updated=true', async () => {
    const result = toolJSON(await client.callTool({
      name: 'add_emoji_to_doc',
      arguments: { slug: 'the-ultimate-taco-guide', emoji_summary: '🌮🔥🫔🎉🏆' },
    }))
    expect(result.updated).toBe(true)
    expect(result.slug).toBe('the-ultimate-taco-guide')
    expect(result.emoji_summary).toBe('🌮🔥🫔🎉🏆')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 📥 bulk_import
// ═════════════════════════════════════════════════════════════════════════════

describe('📥 bulk_import', () => {
  it('reports created and skipped counts when a slug conflicts', async () => {
    // getBaseUrl() → auto
    // Doc 1: sql`NULL` frag auto | INSERT doc1 RETURNING → created | INSERT idx(fallback)
    // Doc 2: sql`NULL` frag auto | INSERT doc2 ON CONFLICT DO NOTHING → [] → skipped
    db([{ id: 'bulk-001', slug: 'taco-al-pastor' }])
    const result = toolJSON(await client.callTool({
      name: 'bulk_import',
      arguments: {
        documents: [
          { title: 'Taco Al Pastor', content: 'Pineapple. Always.', category: 'taco-docs' },
          { title: 'Taco Al Pastor', content: 'Duplicate!', category: 'taco-docs' },
        ],
        auto_publish: true,
      },
    }))
    expect(result.total).toBe(2)
    expect(result.imported).toBe(1)
    const results = result.results as Array<{ status: string }>
    expect(results.some(r => r.status === 'created')).toBe(true)
    expect(results.some(r => r.status.startsWith('skipped'))).toBe(true)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 🔄 regenerate_seo
// ═════════════════════════════════════════════════════════════════════════════

describe('🔄 regenerate_seo', () => {
  it('regenerates for a single slug', async () => {
    updateDocumentSEOMock.mockClear()
    // getBaseUrl() → auto, then just calls updateDocumentSEO (no extra DB)
    const result = toolJSON(await client.callTool({ name: 'regenerate_seo', arguments: { slug: 'the-ultimate-taco-guide' } }))
    expect(result.regenerated).toBe(true)
    expect(result.slug).toBe('the-ultimate-taco-guide')
    expect(updateDocumentSEOMock).toHaveBeenCalledWith('the-ultimate-taco-guide', expect.any(String))
  })

  it('regenerates all docs when slug="all"', async () => {
    updateDocumentSEOMock.mockClear()
    // getBaseUrl() → auto | SELECT all slugs
    db([{ slug: 'taco-1' }, { slug: 'taco-2' }, { slug: 'taco-3' }])
    const result = toolJSON(await client.callTool({ name: 'regenerate_seo', arguments: { slug: 'all' } }))
    expect(result.regenerated).toBe(3)
    expect(updateDocumentSEOMock).toHaveBeenCalledTimes(3)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 📦 export_docs
// ═════════════════════════════════════════════════════════════════════════════

describe('📦 export_docs', () => {
  const docs = [
    { id: '1', title: 'Taco Guide 🌮', content: '## Ingredients\n\nTortilla', category: 'taco-docs' },
    { id: '2', title: 'Salsa Recipe 🍅', content: '## Steps\n\nBlend everything', category: 'taco-docs' },
  ]

  it('exports JSON with document array', async () => {
    // No getBaseUrl() in export_docs
    // sql`AND status='published'` frag auto | sql`` frag auto | SELECT docs
    db(docs)
    const result = toolJSON(await client.callTool({ name: 'export_docs', arguments: { format: 'json' } }))
    expect(result.format).toBe('json')
    expect(result.count).toBe(2)
    expect(Array.isArray(result.documents)).toBe(true)
  })

  it('exports markdown joined by separators', async () => {
    db(docs)
    const result = toolJSON(await client.callTool({ name: 'export_docs', arguments: { format: 'markdown' } }))
    expect(result.format).toBe('markdown')
    expect(String(result.content)).toContain('# Taco Guide')
    expect(String(result.content)).toContain('---')
    expect(result.count).toBe(2)
  })

  it('exports HTML wrapped in article tags', async () => {
    db(docs)
    const result = toolJSON(await client.callTool({ name: 'export_docs', arguments: { format: 'html' } }))
    expect(result.format).toBe('html')
    expect(String(result.content)).toContain('<article>')
    expect(String(result.content)).toContain('<h1>Taco Guide')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 📊 get_stats
// ═════════════════════════════════════════════════════════════════════════════

describe('📊 get_stats', () => {
  it('returns all aggregate counts and recent updates', async () => {
    // 5 concurrent queries (Promise.all) — no getBaseUrl() in get_stats
    db(
      [{ count: 42 }],
      [{ count: 7 }],
      [{ count: 3 }],
      [{ count: 12 }],
      [{ slug: 'fresh-tacos', title: 'Fresh Tacos 🌮', updated_at: '2026-03-06' }],
    )
    const result = toolJSON(await client.callTool({ name: 'get_stats', arguments: {} }))
    expect(result.documents).toBe(42)
    expect(result.categories).toBe(7)
    expect(result.submissions).toBe(3)
    expect(result.unique_sources).toBe(12)
    expect(Array.isArray(result.recent_updates)).toBe(true)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 🪝 trigger_webhook
// ═════════════════════════════════════════════════════════════════════════════

describe('🪝 trigger_webhook', () => {
  it('sends HMAC-signed POST to each registered webhook', async () => {
    // No getBaseUrl() | SELECT webhooks
    db([{ id: 'wh-001', url: 'https://hooks.example.com/tacos', secret: 'super-taco-secret' }])
    const result = toolJSON(await client.callTool({
      name: 'trigger_webhook',
      arguments: { event: 'document.published', slug: 'the-ultimate-taco-guide' },
    }))
    expect(result.event).toBe('document.published')
    expect(result.triggered).toBe(1)
    const results = result.results as Array<{ webhook_id: string; status: number }>
    expect(results[0].webhook_id).toBe('wh-001')
    expect(results[0].status).toBe(200)
    expect(fetch).toHaveBeenCalledWith(
      'https://hooks.example.com/tacos',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-Webhook-Signature': expect.any(String) }),
      }),
    )
  })

  it('reports 0 triggered when no webhooks match the event', async () => {
    db([]) // SELECT webhooks → empty
    const result = toolJSON(await client.callTool({ name: 'trigger_webhook', arguments: { event: 'ghost.event' } }))
    expect(result.triggered).toBe(0)
    expect((result.results as unknown[]).length).toBe(0)
  })

  it('blocks webhook URLs pointing to private networks (SSRF)', async () => {
    db([{ id: 'wh-bad', url: 'http://127.0.0.1/steal', secret: 's' }])
    const result = toolJSON(await client.callTool({
      name: 'trigger_webhook',
      arguments: { event: 'document.published' },
    }))
    const results = result.results as Array<{ webhook_id: string; error?: string }>
    expect(results[0].error).toMatch(/internal or private/)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 🔌 list_integrations + call_integration
// ═════════════════════════════════════════════════════════════════════════════

describe('🔌 list_integrations', () => {
  it('returns integration rows', async () => {
    db([{
      name: 'taco-emoji-service', base_url: 'https://emoji.platphormnews.com',
      api_path: '/api', mcp_path: '/api/mcp', enabled: true,
    }])
    const result = toolJSON(await client.callTool({ name: 'list_integrations', arguments: {} }))
    const integrations = result.integrations as Array<{ name: string; enabled: boolean }>
    expect(integrations[0].name).toBe('taco-emoji-service')
    expect(integrations[0].enabled).toBe(true)
  })
})

describe('📡 call_integration', () => {
  it('proxies a method call to the integration MCP endpoint', async () => {
    db([{ base_url: 'https://emoji.platphormnews.com', mcp_path: '/api/mcp' }])
    const result = toolJSON(await client.callTool({
      name: 'call_integration',
      arguments: { integration: 'taco-emoji-service', method: 'tools/list', params: {} },
    }))
    expect(result.integration).toBe('taco-emoji-service')
    expect(result.response).toBeDefined()
    expect(fetch).toHaveBeenCalledWith('https://emoji.platphormnews.com/api/mcp', expect.objectContaining({ method: 'POST' }))
  })

  it('returns isError:true for unknown integration name', async () => {
    // queue empty → SELECT returns [] → "Integration not found"
    const result = await client.callTool({ name: 'call_integration', arguments: { integration: 'ghost-service', method: 'tools/list' } })
    expectToolError(result, 'Integration not found')
  })

  it('blocks integration URLs pointing to private networks (SSRF)', async () => {
    db([{ base_url: 'http://10.0.0.5', mcp_path: '/mcp' }])
    const result = await client.callTool({
      name: 'call_integration',
      arguments: { integration: 'evil-internal', method: 'tools/list' },
    })
    expectToolError(result, 'internal or private')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 📝 parse_markdown
// ═════════════════════════════════════════════════════════════════════════════

describe('📝 parse_markdown', () => {
  it('returns html string and toc array with emoji enabled by default', async () => {
    const result = toolJSON(await client.callTool({
      name: 'parse_markdown',
      arguments: { content: '## Ingredients\n\nTortilla\n\n## Method\n\nEat it.' },
    }))
    expect(typeof result.html).toBe('string')
    expect(String(result.html)).toContain('<p>')
    expect(Array.isArray(result.toc)).toBe(true)
    expect(result.processed_emoji).toBe(true)
  })

  it('respects enable_emoji=false flag', async () => {
    const result = toolJSON(await client.callTool({
      name: 'parse_markdown',
      arguments: { content: 'Hello :taco:', enable_emoji: false },
    }))
    expect(result.processed_emoji).toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 🔗 generate_share_links
// ═════════════════════════════════════════════════════════════════════════════

describe('🔗 generate_share_links', () => {
  it('returns exactly 6 platforms (X, LinkedIn, Facebook, Reddit, HN, email)', async () => {
    // getBaseUrl() → auto | SELECT title,description FROM documents
    db([{ title: 'The Ultimate Taco Guide 🌮', description: 'Best tacos ever.' }])
    const result = toolJSON(await client.callTool({ name: 'generate_share_links', arguments: { slug: 'the-ultimate-taco-guide' } }))
    const links = result.links as Array<{ platform: string; url: string; icon: string }>
    expect(links).toHaveLength(6)
    const platforms = links.map(l => l.platform)
    expect(platforms).toEqual(expect.arrayContaining(['twitter', 'linkedin', 'facebook', 'reddit', 'hackernews', 'email']))
  })

  it('encodes slug URL in every share link', async () => {
    db([{ title: 'Taco Guide 🌮', description: 'Best.' }])
    const result = toolJSON(await client.callTool({ name: 'generate_share_links', arguments: { slug: 'the-ultimate-taco-guide' } }))
    const links = result.links as Array<{ url: string }>
    for (const link of links) {
      expect(link.url).toContain('taco')
    }
  })

  it('returns isError:true for unknown slug', async () => {
    // queue empty → SELECT returns [] → "Document not found"
    const result = await client.callTool({ name: 'generate_share_links', arguments: { slug: 'ghost-taco' } })
    expectToolError(result, 'Document not found')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 📚 list_project_docs + get_project_doc
// ═════════════════════════════════════════════════════════════════════════════

describe('📚 list_project_docs', () => {
  it('returns all static docs with expected slugs', async () => {
    // getBaseUrl() → auto | no DB (pure static PROJECT_DOCS list)
    const result = toolJSON(await client.callTool({ name: 'list_project_docs', arguments: {} }))
    expect(result.total).toBeGreaterThanOrEqual(10)
    const slugs = (result.docs as Array<{ slug: string }>).map(d => d.slug)
    expect(slugs).toEqual(expect.arrayContaining(['readme', 'api', 'architecture', 'features', 'roadmap']))
  })

  it('filters by category', async () => {
    const result = toolJSON(await client.callTool({ name: 'list_project_docs', arguments: { category: 'overview' } }))
    const docs = result.docs as Array<{ category: string }>
    expect(docs.length).toBeGreaterThan(0)
    expect(docs.every(d => d.category === 'overview')).toBe(true)
  })

  it('includes api_url and raw_url for each entry', async () => {
    const result = toolJSON(await client.callTool({ name: 'list_project_docs', arguments: {} }))
    const first = (result.docs as Array<{ api_url: string; raw_url: string }>)[0]
    expect(first.api_url).toContain('/api/v1/docs/')
    expect(first.raw_url).toContain('format=raw')
  })
})

describe('📖 get_project_doc', () => {
  it('json format returns metadata + content + readingTime', async () => {
    // getBaseUrl() → auto | fs.readFile, fs.stat mocked
    const result = toolJSON(await client.callTool({ name: 'get_project_doc', arguments: { slug: 'readme', format: 'json' } }))
    expect(result.slug).toBe('readme')
    expect(result.file).toBe('README.md')
    expect(result.title).toBeTruthy()
    expect(typeof result.content).toBe('string')
    expect(String(result.content)).toContain('OpenDocs')
    expect(Number(result.wordCount)).toBeGreaterThan(0)
    expect(result.readingTime).toBeGreaterThan(0)
    expect(result.lastModified).toBe('2026-01-01T00:00:00.000Z')
    expect(String(result.api_url)).toContain('/api/v1/docs/readme')
  })

  it('raw format returns content without derived metadata', async () => {
    const result = toolJSON(await client.callTool({ name: 'get_project_doc', arguments: { slug: 'readme', format: 'raw' } }))
    expect(result.content).toBeTruthy()
    expect(result.wordCount).toBeUndefined()
    expect(result.readingTime).toBeUndefined()
  })

  it('works for architecture slug', async () => {
    const result = toolJSON(await client.callTool({ name: 'get_project_doc', arguments: { slug: 'architecture' } }))
    expect(result.file).toBe('ARCHITECTURE.md')
  })

  it('returns isError:true with helpful message for unknown slugs', async () => {
    const result = await client.callTool({ name: 'get_project_doc', arguments: { slug: 'ghost-doc' } })
    expectToolError(result, /not found/i)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 📦 RESOURCES
// ═════════════════════════════════════════════════════════════════════════════

describe('📦 resources/list', () => {
  it('advertises 8 static resource URIs', async () => {
    const { resources } = await client.listResources()
    const uris = resources.map(r => r.uri)
    expect(uris).toEqual(expect.arrayContaining([
      'docs://index', 'docs://categories', 'docs://recent', 'docs://popular',
      'docs://tags', 'docs://stats', 'docs://sitemap', 'docs://llms',
    ]))
    expect(uris).toHaveLength(8)
  })

  it('advertises the project-docs://{slug} resource template', async () => {
    const { resourceTemplates } = await client.listResourceTemplates()
    const templates = resourceTemplates ?? []
    expect(templates.some(t => t.uriTemplate === 'project-docs://{slug}')).toBe(true)
  })
})

describe('📖 docs://index', () => {
  it('returns document array with base_url', async () => {
    // getBaseUrl() → auto | SELECT docs
    db([{ slug: 'the-ultimate-taco-guide', title: 'Taco Guide 🌮', category: 'taco-docs' }])
    const result = await client.readResource({ uri: 'docs://index' })
    const data = JSON.parse((result.contents[0] as any).text as string) as Record<string, unknown>
    expect(Array.isArray(data.documents)).toBe(true)
    expect(data.base_url).toBeTruthy()
  })
})

describe('📂 docs://categories', () => {
  it('returns category list', async () => {
    // No getBaseUrl() | SELECT categories
    db([{ slug: 'taco-docs', name: 'Taco Docs 🌮' }])
    const result = await client.readResource({ uri: 'docs://categories' })
    const data = JSON.parse((result.contents[0] as any).text as string) as Record<string, unknown>
    expect((data.categories as Array<{ slug: string }>)[0].slug).toBe('taco-docs')
  })
})

describe('🆕 docs://recent', () => {
  it('returns recently updated documents', async () => {
    db([{ slug: 'fresh-tacos', title: 'Fresh Tacos 🌮', updated_at: '2026-03-06T00:00:00Z' }])
    const result = await client.readResource({ uri: 'docs://recent' })
    const data = JSON.parse((result.contents[0] as any).text as string) as Record<string, unknown>
    expect((data.documents as Array<{ slug: string }>)[0].slug).toBe('fresh-tacos')
  })
})

describe('🔥 docs://popular', () => {
  it('returns document list ordered by popularity', async () => {
    db([{ slug: 'viral-taco-guide', title: 'Viral Taco Guide 🔥🌮' }])
    const result = await client.readResource({ uri: 'docs://popular' })
    const data = JSON.parse((result.contents[0] as any).text as string) as Record<string, unknown>
    expect(Array.isArray(data.documents)).toBe(true)
  })
})

describe('🏷️  docs://tags', () => {
  it('returns distinct tag strings', async () => {
    db([{ tag: 'tacos' }, { tag: 'mexico' }, { tag: 'food' }])
    const result = await client.readResource({ uri: 'docs://tags' })
    const data = JSON.parse((result.contents[0] as any).text as string) as Record<string, unknown>
    expect(data.tags).toEqual(expect.arrayContaining(['tacos', 'mexico', 'food']))
  })
})

describe('📈 docs://stats', () => {
  it('returns aggregate stats object', async () => {
    // 4 concurrent SELECTs — no getBaseUrl() in docs-stats handler
    db([{ count: 42 }], [{ count: 7 }], [{ count: 3 }], [{ count: 12 }])
    const result = await client.readResource({ uri: 'docs://stats' })
    const data = JSON.parse((result.contents[0] as any).text as string) as Record<string, unknown>
    expect(data.documents).toBe(42)
    expect(data.categories).toBe(7)
    expect(data.unique_sources).toBe(12)
  })
})

describe('🗺️  docs://sitemap', () => {
  it('returns urls[] with loc, lastmod, and title', async () => {
    // getBaseUrl() → auto | SELECT slug,title,updated_at
    db([{ slug: 'the-ultimate-taco-guide', title: 'Taco Guide 🌮', updated_at: '2026-03-01T00:00:00Z' }])
    const result = await client.readResource({ uri: 'docs://sitemap' })
    const data = JSON.parse((result.contents[0] as any).text as string) as Record<string, unknown>
    expect(Array.isArray(data.urls)).toBe(true)
    const url = (data.urls as Array<{ loc: string; lastmod: unknown; title: string }>)[0]
    expect(url.loc).toContain('/docs/the-ultimate-taco-guide')
    expect(url.lastmod).toBeDefined()
    expect(url.title).toBe('Taco Guide 🌮')
    expect(data.generated_at).toBeDefined()
  })
})

describe('🤖 docs://llms', () => {
  it('returns llms.txt plain-text format listing all docs', async () => {
    // getBaseUrl() → auto | SELECT docs
    db([{ slug: 'the-ultimate-taco-guide', title: 'Taco Guide 🌮', description: 'Best tacos.', category: 'taco-docs' }])
    const result = await client.readResource({ uri: 'docs://llms' })
    expect(result.contents[0].mimeType).toBe('text/plain')
    const text = (result.contents[0] as any).text as string
    expect(text).toContain('# OpenDocs')
    expect(text).toContain('MCP Endpoint:')
    expect(text).toContain('## Documents')
    expect(text).toContain('Taco Guide')
  })
})

describe('📁 project-docs://{slug}', () => {
  it('project-docs://index returns full doc registry as JSON', async () => {
    // getBaseUrl() → auto | no DB (static list)
    const result = await client.readResource({ uri: 'project-docs://index' })
    const data = JSON.parse((result.contents[0] as any).text as string) as Record<string, unknown>
    expect(Array.isArray(data.docs)).toBe(true)
    expect(Number(data.total)).toBeGreaterThanOrEqual(10)
    expect(String(data.mcp_endpoint)).toContain('/api/mcp')
  })

  it('project-docs://readme returns markdown content', async () => {
    // getBaseUrl() → auto | fs.readFile mocked
    const result = await client.readResource({ uri: 'project-docs://readme' })
    expect(result.contents[0].mimeType).toBe('text/markdown')
    expect(String((result.contents[0] as any).text)).toContain('OpenDocs')
  })

  it('project-docs://api returns API.md content', async () => {
    const result = await client.readResource({ uri: 'project-docs://api' })
    expect(result.contents[0].mimeType).toBe('text/markdown')
    expect(typeof (result.contents[0] as any).text).toBe('string')
  })

  it('rejects for unknown project-doc slug', async () => {
    // getBaseUrl() → auto | entry not found → throws
    await expect(
      client.readResource({ uri: 'project-docs://ghost-doc' }),
    ).rejects.toThrow()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 💭 PROMPTS
// ═════════════════════════════════════════════════════════════════════════════

describe('💭 prompts/list', () => {
  it('advertises exactly 6 prompts', async () => {
    const { prompts } = await client.listPrompts()
    expect(prompts).toHaveLength(6)
  })

  it('includes all expected prompt names', async () => {
    const { prompts } = await client.listPrompts()
    const names = prompts.map(p => p.name)
    expect(names).toEqual(expect.arrayContaining([
      'explain_doc', 'summarize_category', 'compare_docs',
      'generate_faq', 'translate_doc', 'improve_seo',
    ]))
  })

  it('every prompt has a non-empty description', async () => {
    const { prompts } = await client.listPrompts()
    for (const p of prompts) {
      expect(p.description, `${p.name} missing description`).toBeTruthy()
    }
  })
})

describe('💬 explain_doc', () => {
  const tacoDoc = {
    title: 'The Ultimate Taco Guide 🌮',
    content: '## Ingredients\n\nTortilla, carnitas.\n\n## Method\n\nAssemble. Eat.',
  }

  it('returns a user-role message asking for plain-language explanation', async () => {
    db([tacoDoc])
    const result = await client.getPrompt({ name: 'explain_doc', arguments: { slug: 'the-ultimate-taco-guide' } })
    expect(result.messages).toHaveLength(1)
    expect(result.messages[0].role).toBe('user')
    const text = (result.messages[0].content as { text: string }).text
    expect(text).toContain('Taco Guide')
    expect(text.toLowerCase()).toContain('explain')
  })

  it('rejects for unknown doc slug (getPrompt propagates errors)', async () => {
    // queue empty → SELECT returns [] → handler throws → getPrompt rejects
    await expect(
      client.getPrompt({ name: 'explain_doc', arguments: { slug: 'ghost-taco' } }),
    ).rejects.toThrow()
  })
})

describe('💬 summarize_category', () => {
  it('includes all doc titles from the category in the message', async () => {
    db([
      { title: 'Al Pastor Tacos', description: 'Pineapple heaven 🍍' },
      { title: 'Birria Tacos', description: 'Dipping heaven 🥩' },
      { title: 'Carnitas Tacos', description: 'Pork heaven 🐷' },
    ])
    const result = await client.getPrompt({ name: 'summarize_category', arguments: { category: 'taco-docs' } })
    const text = (result.messages[0].content as { text: string }).text
    expect(text).toContain('taco-docs')
    expect(text).toContain('Al Pastor Tacos')
    expect(text).toContain('Birria Tacos')
    expect(text).toContain('Carnitas Tacos')
  })
})

describe('💬 compare_docs', () => {
  it('includes both document titles in comparison message', async () => {
    db(
      [{ title: 'Al Pastor 🌮', content: 'Pineapple and achiote marinade.' }],
      [{ title: 'Birria 🌮', content: 'Beef shin, chile guajillo.' }],
    )
    const result = await client.getPrompt({
      name: 'compare_docs',
      arguments: { slug1: 'al-pastor', slug2: 'birria' },
    })
    const text = (result.messages[0].content as { text: string }).text
    expect(text).toContain('Al Pastor')
    expect(text).toContain('Birria')
  })

  it('rejects when either doc is missing', async () => {
    db([{ title: 'Al Pastor', content: '...' }], []) // slug2 returns nothing
    await expect(
      client.getPrompt({ name: 'compare_docs', arguments: { slug1: 'al-pastor', slug2: 'ghost' } }),
    ).rejects.toThrow()
  })
})

describe('💬 generate_faq', () => {
  it('includes FAQ keyword and document title in message', async () => {
    db([{ title: 'The Ultimate Taco Guide 🌮', content: '## Ingredients\n\nTortilla.' }])
    const result = await client.getPrompt({ name: 'generate_faq', arguments: { slug: 'the-ultimate-taco-guide' } })
    const text = (result.messages[0].content as { text: string }).text
    expect(text.toUpperCase()).toContain('FAQ')
    expect(text).toContain('Taco Guide')
  })
})

describe('💬 translate_doc', () => {
  it('injects target language into the prompt message', async () => {
    db([{ title: 'The Ultimate Taco Guide 🌮', content: '## Ingredients\n\nTortilla.' }])
    const result = await client.getPrompt({ name: 'translate_doc', arguments: { slug: 'the-ultimate-taco-guide', language: 'Spanish' } })
    const text = (result.messages[0].content as { text: string }).text
    expect(text).toContain('Spanish')
    expect(text).toContain('Taco Guide')
  })
})

describe('💬 improve_seo', () => {
  it('includes title and tags sections in the SEO analysis prompt', async () => {
    db([{
      title: 'The Ultimate Taco Guide 🌮',
      description: 'Everything about tacos',
      content: '## Ingredients\n\nTortilla.',
      tags: ['tacos', 'food'],
    }])
    const result = await client.getPrompt({ name: 'improve_seo', arguments: { slug: 'the-ultimate-taco-guide' } })
    const text = (result.messages[0].content as { text: string }).text
    expect(text).toContain('Title:')
    expect(text).toContain('Tags:')
    expect(text).toContain('Taco Guide')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 🌮 E2E: Full taco document lifecycle
// ═════════════════════════════════════════════════════════════════════════════

describe('🌮 E2E — full taco document lifecycle', () => {
  it('create → get → update → add emoji → share links → export → stats → delete (soft + hard)', async () => {
    const slug = 'crispy-carnitas-tacos'

    // 1. create_document ───────────────────────────────────────────────────────
    // ensureCategoryExists: SELECT categories (not found) | INSERT categories
    db([], [], [{ id: 'e2e-001', slug, emoji_summary: '🌮🥩🔥' }])
    const created = toolJSON(await client.callTool({
      name: 'create_document',
      arguments: {
        title: 'Crispy Carnitas Tacos 🥩',
        content: '## Carnitas\n\nSlow-cook the pork. Render the fat. Crisp it up. Assemble.',
        category: 'taco-docs',
        tags: ['carnitas', 'crispy', 'tacos', 'pork'],
        status: 'published',
      },
    }))
    expect(created.slug).toBe(slug)
    expect(created.status).toBe('published')

    // 2. get_document ──────────────────────────────────────────────────────────
    db([{
      id: 'e2e-001', slug, title: 'Crispy Carnitas Tacos 🥩',
      content: '## Carnitas\n\nSlow-cook...', category: 'taco-docs', emoji_summary: '🌮🥩🔥',
    }])
    const fetched = toolJSON(await client.callTool({ name: 'get_document', arguments: { slug } }))
    expect(String(fetched.title)).toContain('Carnitas')
    expect(Array.isArray(fetched.toc)).toBe(true)

    // 3. update_document (description only) ───────────────────────────────────
    updateDocumentSEOMock.mockClear()
    db([{ id: 'e2e-001' }])
    const updated = toolJSON(await client.callTool({
      name: 'update_document',
      arguments: { slug, description: 'The crispiest carnitas tacos in the observable universe.' },
    }))
    expect(updated.updated).toBe(true)
    expect(updateDocumentSEOMock).toHaveBeenCalledOnce()

    // 4. add_emoji_to_doc ──────────────────────────────────────────────────────
    const emojied = toolJSON(await client.callTool({
      name: 'add_emoji_to_doc',
      arguments: { slug, emoji_summary: '🌮🥩🔥🫔🏆🥇' },
    }))
    expect(emojied.emoji_summary).toBe('🌮🥩🔥🫔🏆🥇')

    // 5. generate_share_links ──────────────────────────────────────────────────
    db([{ title: 'Crispy Carnitas Tacos 🥩', description: 'The crispiest.' }])
    const shared = toolJSON(await client.callTool({ name: 'generate_share_links', arguments: { slug } }))
    expect((shared.links as unknown[]).length).toBe(6)

    // 6. export_docs (markdown, category filter) ───────────────────────────────
    db([{ id: 'e2e-001', slug, title: 'Crispy Carnitas Tacos 🥩', content: '## Carnitas\n\nSlow-cook...', category: 'taco-docs' }])
    const exported = toolJSON(await client.callTool({ name: 'export_docs', arguments: { format: 'markdown', category: 'taco-docs' } }))
    expect(String(exported.content)).toContain('Carnitas')

    // 7. get_stats ─────────────────────────────────────────────────────────────
    db([{ count: 1 }], [{ count: 1 }], [{ count: 0 }], [{ count: 1 }], [])
    const stats = toolJSON(await client.callTool({ name: 'get_stats', arguments: {} }))
    expect(stats.documents).toBe(1)

    // 8. soft-delete 🧹 ────────────────────────────────────────────────────────
    const softDeleted = toolJSON(await client.callTool({ name: 'delete_document', arguments: { slug } }))
    expect(softDeleted.deleted).toBe(true)
    expect(softDeleted.permanent).toBe(false)

    // 9. hard-delete 💀 ────────────────────────────────────────────────────────
    const hardDeleted = toolJSON(await client.callTool({ name: 'delete_document', arguments: { slug, permanent: true } }))
    expect(hardDeleted.deleted).toBe(true)
    expect(hardDeleted.permanent).toBe(true)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 🌐 POST route handler — Accept header normalisation
// ═════════════════════════════════════════════════════════════════════════════

import { POST } from '@/app/api/mcp/route'

describe('🌐 POST route handler — Accept header normalisation', () => {
  const jsonRpcInit = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '1.0.0' },
    },
  })

  it('succeeds when Accept already contains both required types', async () => {
    const req = new Request('http://localhost/api/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: jsonRpcInit,
    })
    const res = await POST(req)
    expect(res.status).not.toBe(406)
  })

  it('succeeds when Accept contains only application/json (SSE added)', async () => {
    const req = new Request('http://localhost/api/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: jsonRpcInit,
    })
    const res = await POST(req)
    expect(res.status).not.toBe(406)
  })

  it('succeeds when Accept contains only text/event-stream (JSON added)', async () => {
    const req = new Request('http://localhost/api/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: jsonRpcInit,
    })
    const res = await POST(req)
    expect(res.status).not.toBe(406)
  })

  it('succeeds when no Accept header is provided (both added)', async () => {
    const req = new Request('http://localhost/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: jsonRpcInit,
    })
    const res = await POST(req)
    expect(res.status).not.toBe(406)
  })
})
