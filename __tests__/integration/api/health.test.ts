import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the db module
vi.mock('@/lib/db', () => ({
  sql: vi.fn(),
  DEFAULT_TENANT_ID: '00000000-0000-0000-0000-000000000001',
}))

import { GET } from '@/app/api/health/route'
import { sql } from '@/lib/db'

const mockSql = vi.mocked(sql)

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns healthy status when DB is connected', async () => {
    mockSql.mockResolvedValueOnce([{ '?column?': 1 }] as never)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe('healthy')
    expect(data.checks.database.status).toBe('healthy')
    expect(data.checks.database.latency_ms).toBeDefined()
    expect(typeof data.checks.database.latency_ms).toBe('number')
    expect(data.version).toBeDefined()
    expect(data.timestamp).toBeDefined()
  })

  it('returns unhealthy status when DB fails', async () => {
    mockSql.mockRejectedValueOnce(new Error('Connection refused') as never)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(503)
    expect(data.status).toBe('unhealthy')
    expect(data.checks.database.status).toBe('unhealthy')
    expect(data.checks.database.error).toBe('Connection refused')
  })

  it('includes version in response', async () => {
    mockSql.mockResolvedValueOnce([{ '?column?': 1 }] as never)

    const response = await GET()
    const data = await response.json()

    expect(typeof data.version).toBe('string')
  })

  it('includes ISO timestamp', async () => {
    mockSql.mockResolvedValueOnce([{ '?column?': 1 }] as never)

    const response = await GET()
    const data = await response.json()

    expect(() => new Date(data.timestamp)).not.toThrow()
  })
})
