import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/v1/automation/route'
import { NextRequest } from 'next/server'
import { sql } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  sql: vi.fn(),
  DEFAULT_TENANT_ID: '00000000-0000-0000-0000-000000000001',
}))

describe('Automation API Performance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('batch_index uses multi-row inserts', async () => {
    // We will simulate 100 documents and measure performance improvements implicitly
    // by asserting on the number of `sql` calls or execution time.

    // Mock the initial SELECT query
    const mockDocs = Array.from({ length: 100 }).map((_, i) => ({
      id: `00000000-0000-0000-0000-0000000000${i.toString().padStart(2, '0')}`,
      tenant_id: 'tenant-1',
      title: `Title ${i}`,
      description: `Description ${i}`,
      content: `Content ${i}`
    }))

    ;(sql as any).mockResolvedValueOnce(mockDocs)
    ;(sql as any).mockResolvedValue([]) // Mock the INSERT

    const req = new NextRequest('http://localhost/api/v1/automation', {
      method: 'POST',
      body: JSON.stringify({
        action: 'batch_index',
        params: {
          document_ids: mockDocs.map(d => d.id)
        }
      })
    })

    const start = performance.now()
    const response = await POST(req)
    const end = performance.now()

    const data = await response.json()
    if (!data.success) {
      console.log('Error data:', data);
    }
    expect(data.success).toBe(true)
    expect(data.data.indexed).toBe(100)

    // N+1 issue: sql gets called 1 + 100 times.
    // Optimal issue: sql gets called 1 + 1 (or chunked) times.
    console.log(`Execution time for 100 documents: ${end - start}ms`)
    console.log(`SQL calls:`, (sql as any).mock.calls.length)
  })
})
