import { describe, it, expect } from 'vitest'
import { API_VERSION, OPENAPI_VERSION } from '@/lib/api-types'

describe('api-types', () => {
  it('exports API_VERSION', () => {
    expect(API_VERSION).toBe('v1')
  })

  it('exports OPENAPI_VERSION', () => {
    expect(OPENAPI_VERSION).toBe('3.1.0')
  })
})
