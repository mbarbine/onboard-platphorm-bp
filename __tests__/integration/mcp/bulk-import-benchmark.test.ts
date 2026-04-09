// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import type { Client } from '@modelcontextprotocol/sdk/client/index.js'

const {
  sqlMock,
  sqlQueue,
  generateSEOMetadataMock,
} = vi.hoisted(() => {
  const sqlQueue: unknown[][] = []
  const sqlMock = Object.assign(
    vi.fn((...args: unknown[]) => {
      const strings = args[0] as TemplateStringsArray | undefined
      if (!Array.isArray(strings)) return Promise.resolve([])
      if (strings.some((s: unknown) => typeof s === 'string' && (s as string).includes("'base_url'"))) {
        return Promise.resolve([])
      }
      const first = ((strings[0] as string) ?? '').trimStart()
      if (!/^(SELECT|INSERT|UPDATE|DELETE|WITH|CREATE)/i.test(first)) {
        return undefined
      }
      return Promise.resolve(sqlQueue.length > 0 ? sqlQueue.shift()! : [])
    }),
    { unsafe: vi.fn((s: string) => s) },
  )

  const generateSEOMetadataMock = vi.fn().mockResolvedValue({
    ogTitle: 'SEO Title',
    ogDescription: 'SEO Description',
    ogImage: 'https://example.com/og.png',
    twitterCard: 'summary_large_image',
    canonicalUrl: 'https://example.com/canonical',
    readingTimeMinutes: 2,
    wordCount: 400,
    emojiSummary: '📄',
  })

  return { sqlMock, sqlQueue, generateSEOMetadataMock }
})

vi.mock('@/lib/db', () => ({
  sql: sqlMock,
  DEFAULT_TENANT_ID: '00000000-0000-0000-0000-000000000001',
}))

vi.mock('@/lib/seo-generator', () => ({
  generateSEOMetadata: generateSEOMetadataMock,
  updateDocumentSEO: vi.fn(),
  updateDocumentSEOFromMeta: vi.fn(),
}))

import { createMcpServer } from '@/app/api/mcp/route'

let client: Client

beforeAll(async () => {
  const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js')
  const { Client: MClient } = await import('@modelcontextprotocol/sdk/client/index.js')

  const server = createMcpServer()
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)

  client = new MClient({ name: 'benchmark-client', version: '1.0.0' })
  await client.connect(clientTransport)
})

afterAll(async () => {
  await client?.close()
})

beforeEach(() => {
  sqlQueue.length = 0
  sqlMock.mockClear()
})

describe('📥 bulk_import benchmark', () => {
  it('measures SQL call count for bulk_import', async () => {
    const numDocs = 10
    const documents = Array.from({ length: numDocs }, (_, i) => ({
      title: `Doc ${i}`,
      content: `Content ${i}`,
    }))

    // Optimized implementation should do:
    // 1 SELECT for base_url (auto-handled)
    // 1 Bulk INSERT for documents
    // 1 Bulk INSERT for search_index

    // Seed the queue with returns for each INSERT
    const insertedDocs = documents.map((_, i) => ({ id: `id-${i}`, slug: `doc-${i}-a1b2` }))
    sqlQueue.push(insertedDocs) // Bulk INSERT INTO documents

    await client.callTool({
      name: 'bulk_import',
      arguments: { documents },
    })

    const sqlCalls = sqlMock.mock.calls.length
    console.log(`SQL calls for ${numDocs} documents: ${sqlCalls}`)

    // Base URL call + 1 Bulk Insert Doc + 1 Bulk Insert Index
    expect(sqlCalls).toBe(2)
  })
})
