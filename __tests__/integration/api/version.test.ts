import { describe, it, expect } from 'vitest'
import { GET } from '@/app/api/v1/version/route'

describe('GET /api/v1/version', () => {
  it('returns success with version data', async () => {
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.version).toBeDefined()
    expect(data.data.build).toBeDefined()
    expect(data.data.timestamp).toBeDefined()
  })

  it('returns runtime info', async () => {
    const response = await GET()
    const data = await response.json()

    expect(data.data.runtime).toBeDefined()
    expect(data.data.runtime.node).toBeDefined()
    expect(data.data.runtime.nextjs).toBe('16.x')
  })

  it('returns compatibility info', async () => {
    const response = await GET()
    const data = await response.json()

    expect(data.data.compatibility).toBeDefined()
    expect(data.data.compatibility.api).toBe('v1')
    expect(data.data.compatibility.mcp).toBe('1.0')
    expect(data.data.compatibility.wcag).toBe('2.2')
  })

  it('includes version headers', async () => {
    const response = await GET()

    expect(response.headers.get('X-Version')).toBeDefined()
    expect(response.headers.get('X-Build')).toBeDefined()
  })

  it('includes Vercel deployment info', async () => {
    const response = await GET()
    const data = await response.json()

    expect(data.data.vercel).toBeDefined()
    expect(data.data.vercel).toHaveProperty('deploymentUrl')
    expect(data.data.vercel).toHaveProperty('region')
    expect(data.data.vercel).toHaveProperty('environment')
  })
})
