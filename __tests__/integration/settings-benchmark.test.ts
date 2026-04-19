import { describe, it, expect, vi } from 'vitest'
import { PUT } from '@/app/api/v1/settings/route'
import { NextRequest } from 'next/server'
import { sql } from '@/lib/db'

vi.mock('@/lib/db', () => {
  return {
    sql: vi.fn().mockImplementation(() => {
      // simulate db latency
      return new Promise(resolve => setTimeout(() => resolve([]), 10))
    }),
    DEFAULT_TENANT_ID: '00000000-0000-0000-0000-000000000001'
  }
})

describe('Settings API Benchmark', () => {
  it('measures performance of PUT request with integrations', async () => {
    const integrations = Array.from({ length: 50 }, (_, i) => ({
      id: `int_${i}`,
      name: `Integration ${i}`,
      base_url: `https://api${i}.example.com`,
      api_path: '/api',
      mcp_path: '/api/mcp',
      enabled: true,
      settings: {}
    }))

    const req = new NextRequest('http://localhost/api/v1/settings', {
      method: 'PUT',
      body: JSON.stringify({
        integrations
      })
    })

    const start = performance.now()
    const res = await PUT(req)
    const end = performance.now()

    const body = await res.json()
    expect(body.success).toBe(true)

    console.log(`Execution time for ${integrations.length} integrations: ${end - start}ms`)
  })
})
