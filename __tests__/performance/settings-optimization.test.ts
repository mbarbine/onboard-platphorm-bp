import { describe, it, expect, vi, beforeEach } from 'vitest'

const { sqlMock } = vi.hoisted(() => {
  return {
    sqlMock: Object.assign(
      vi.fn().mockResolvedValue([]),
      { unsafe: vi.fn() }
    )
  }
})

vi.mock('@/lib/db', () => ({
  sql: sqlMock,
}))

// Mock other dependencies
vi.mock('@/lib/site-config', () => ({
  SITE_NAME: 'Test Site',
  BASE_URL: 'http://localhost:3000',
  GITHUB_REPO: 'test/repo',
}))

import { PUT } from '@/app/api/v1/settings/route'
import { NextRequest } from 'next/server'

describe('Settings API Performance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('measures the number of SQL calls for updating integrations', async () => {
    const numIntegrations = 5
    const integrations = Array.from({ length: numIntegrations }, (_, i) => ({
      id: `00000000-0000-0000-0000-00000000000${i + 1}`,
      base_url: `http://api${i}.example.com`,
      api_path: '/api',
      mcp_path: '/api/mcp',
      enabled: true,
      settings: { key: `val${i}` }
    }))

    const request = new NextRequest('http://localhost:3000/api/v1/settings', {
      method: 'PUT',
      body: JSON.stringify({
        integrations
      })
    })

    await PUT(request)

    const updateCalls = sqlMock.mock.calls.filter(call => {
      const query = call[0][0] as string
      return query.includes('UPDATE integrations')
    })

    console.log(`Number of UPDATE integrations calls for ${numIntegrations} integrations: ${updateCalls.length}`)

    // The optimized implementation should perform exactly 1 bulk update call
    expect(updateCalls.length).toBe(1)
  })
})
