import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { logger, generateRequestId, getRequestContext } from '@/lib/logger'

describe('logger', () => {
  let consoleSpy: {
    debug: ReturnType<typeof vi.spyOn>
    info: ReturnType<typeof vi.spyOn>
    warn: ReturnType<typeof vi.spyOn>
    error: ReturnType<typeof vi.spyOn>
  }

  beforeEach(() => {
    consoleSpy = {
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs info messages', () => {
    logger.info('Test message')
    expect(consoleSpy.info).toHaveBeenCalled()
    const logged = JSON.parse(consoleSpy.info.mock.calls[0][0] as string)
    expect(logged.level).toBe('info')
    expect(logged.message).toBe('Test message')
    expect(logged.service).toBe('onboard')
  })

  it('logs warn messages', () => {
    logger.warn('Warning message')
    expect(consoleSpy.warn).toHaveBeenCalled()
    const logged = JSON.parse(consoleSpy.warn.mock.calls[0][0] as string)
    expect(logged.level).toBe('warn')
  })

  it('logs error messages', () => {
    logger.error('Error message')
    expect(consoleSpy.error).toHaveBeenCalled()
    const logged = JSON.parse(consoleSpy.error.mock.calls[0][0] as string)
    expect(logged.level).toBe('error')
  })

  it('logs fatal messages', () => {
    logger.fatal('Fatal message')
    expect(consoleSpy.error).toHaveBeenCalled()
    const logged = JSON.parse(consoleSpy.error.mock.calls[0][0] as string)
    expect(logged.level).toBe('fatal')
  })

  it('includes timestamp in log entries', () => {
    logger.info('Test')
    const logged = JSON.parse(consoleSpy.info.mock.calls[0][0] as string)
    expect(logged.timestamp).toBeDefined()
    expect(() => new Date(logged.timestamp)).not.toThrow()
  })

  it('includes context in log entries', () => {
    logger.info('Request received', { method: 'GET', path: '/api/test' })
    const logged = JSON.parse(consoleSpy.info.mock.calls[0][0] as string)
    expect(logged.context.method).toBe('GET')
    expect(logged.context.path).toBe('/api/test')
  })

  it('converts Error objects to message and stack', () => {
    const err = new Error('Something failed')
    logger.error('Failed', { error: err })
    const logged = JSON.parse(consoleSpy.error.mock.calls[0][0] as string)
    expect(logged.context.error).toBe('Something failed')
    expect(logged.context.stack).toBeDefined()
  })

  it('logs HTTP requests at correct levels', () => {
    logger.request('GET', '/api/test', 200, 50)
    expect(consoleSpy.info).toHaveBeenCalled()

    logger.request('GET', '/api/test', 404, 50)
    expect(consoleSpy.warn).toHaveBeenCalled()

    logger.request('GET', '/api/test', 500, 50)
    expect(consoleSpy.error).toHaveBeenCalled()
  })

  it('logs MCP tool calls', () => {
    logger.mcp('search_documents', true, 120)
    expect(consoleSpy.info).toHaveBeenCalled()
    const logged = JSON.parse(consoleSpy.info.mock.calls[0][0] as string)
    expect(logged.message).toContain('search_documents')
    expect(logged.message).toContain('success')
  })

  it('logs failed MCP tool calls as warn', () => {
    logger.mcp('search_documents', false, 120)
    expect(consoleSpy.warn).toHaveBeenCalled()
  })

  it('logs database operations', () => {
    logger.db('SELECT', 'documents', 15)
    // db logs at debug level - may not output depending on LOG_LEVEL
    // Just ensure no error thrown
  })

  describe('child logger', () => {
    it('creates child with base context', () => {
      const child = logger.child({ requestId: 'req_123', sessionId: 'sess_456' })
      child.info('Test from child')
      const logged = JSON.parse(consoleSpy.info.mock.calls[0][0] as string)
      expect(logged.context.requestId).toBe('req_123')
      expect(logged.context.sessionId).toBe('sess_456')
    })

    it('merges child context with call context', () => {
      const child = logger.child({ requestId: 'req_123' })
      child.info('Test', { method: 'GET' })
      const logged = JSON.parse(consoleSpy.info.mock.calls[0][0] as string)
      expect(logged.context.requestId).toBe('req_123')
      expect(logged.context.method).toBe('GET')
    })

    it('supports all log levels', () => {
      const child = logger.child({ requestId: 'req_123' })
      child.debug('debug')
      child.info('info')
      child.warn('warn')
      child.error('error')
      child.fatal('fatal')
      // No errors thrown
    })
  })
})

describe('generateRequestId', () => {
  it('starts with req_ prefix', () => {
    const id = generateRequestId()
    expect(id.startsWith('req_')).toBe(true)
  })

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateRequestId()))
    expect(ids.size).toBe(100)
  })

  it('has correct format with three underscore-separated parts', () => {
    const id = generateRequestId()
    const parts = id.split('_')
    expect(parts.length).toBe(3)
    expect(parts[0]).toBe('req')
  })

  it('contains only alphanumeric characters in the variable parts', () => {
    const id = generateRequestId()
    const parts = id.split('_')
    expect(parts[1]).toMatch(/^[a-z0-9]+$/)
    expect(parts[2]).toMatch(/^[a-z0-9]+$/)
  })
})

describe('getRequestContext', () => {
  it('extracts request context from Request object', () => {
    const request = new Request('https://example.com/api/test', {
      method: 'GET',
      headers: {
        'user-agent': 'TestAgent/1.0',
        'x-forwarded-for': '1.2.3.4',
        'x-vercel-ip-country': 'US',
      },
    })
    const ctx = getRequestContext(request)
    expect(ctx.method).toBe('GET')
    expect(ctx.path).toBe('/api/test')
    expect(ctx.userAgent).toBe('TestAgent/1.0')
    expect(ctx.ip).toBe('1.2.3.4')
    expect(ctx.country).toBe('US')
    expect(ctx.requestId).toBeDefined()
  })

  it('uses provided requestId', () => {
    const request = new Request('https://example.com/api/test')
    const ctx = getRequestContext(request, 'custom_id')
    expect(ctx.requestId).toBe('custom_id')
  })

  it('handles missing headers gracefully', () => {
    const request = new Request('https://example.com/api/test')
    const ctx = getRequestContext(request)
    expect(ctx.userAgent).toBeUndefined()
    expect(ctx.ip).toBeUndefined()
    expect(ctx.country).toBeUndefined()
  })

  it('extracts first IP when x-forwarded-for contains multiple IPs', () => {
    const request = new Request('https://example.com/api/test', {
      headers: {
        'x-forwarded-for': '1.2.3.4, 5.6.7.8, 9.10.11.12',
      },
    })
    const ctx = getRequestContext(request)
    expect(ctx.ip).toBe('1.2.3.4')
  })

  it('falls back to x-real-ip when x-forwarded-for is missing', () => {
    const request = new Request('https://example.com/api/test', {
      headers: {
        'x-real-ip': '5.6.7.8',
      },
    })
    const ctx = getRequestContext(request)
    expect(ctx.ip).toBe('5.6.7.8')
  })

  it('extracts region and city from Vercel headers', () => {
    const request = new Request('https://example.com/api/test', {
      headers: {
        'x-vercel-ip-country-region': 'CA',
        'x-vercel-ip-city': 'San Francisco',
      },
    })
    const ctx = getRequestContext(request)
    expect(ctx.region).toBe('CA')
    expect(ctx.city).toBe('San Francisco')
  })
})
