import { describe, it, expect, vi } from 'vitest'

// Mock neon before importing db module
vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(() => vi.fn()),
}))

// Need to set DATABASE_URL before importing
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'

import { DEFAULT_TENANT_ID } from '@/lib/db'

describe('db module', () => {
  it('exports DEFAULT_TENANT_ID as a valid UUID', () => {
    expect(DEFAULT_TENANT_ID).toBe('00000000-0000-0000-0000-000000000001')
    expect(DEFAULT_TENANT_ID).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    )
  })
})
