import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/site-config', () => ({ SESSION_SALT: 'test-salt-for-tests' }))

// Mock db module to avoid requiring DATABASE_URL
vi.mock('@/lib/db', () => ({
  sql: vi.fn(),
  DEFAULT_TENANT_ID: '00000000-0000-0000-0000-000000000001',
}))

import {
  generateJA4Fingerprint,
  generateSessionHash,
  extractGeoInfo,
} from '@/lib/fingerprint'

describe('generateJA4Fingerprint', () => {
  const baseComponents = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120',
    acceptLanguage: 'en-US,en;q=0.9',
    acceptEncoding: 'gzip, deflate, br',
    connection: 'keep-alive',
    secChUa: '"Chromium";v="120"',
    secChUaPlatform: '"Windows"',
    secChUaMobile: '?0',
    secFetchDest: 'document',
    secFetchMode: 'navigate',
    secFetchSite: 'none',
    ip: '127.0.0.1',
  }

  it('returns a string with underscore-separated parts', () => {
    const fp = generateJA4Fingerprint(baseComponents)
    expect(fp).toContain('_')
    const parts = fp.split('_')
    expect(parts.length).toBe(6)
  })

  it('starts with h2 protocol indicator', () => {
    const fp = generateJA4Fingerprint(baseComponents)
    expect(fp.startsWith('h2')).toBe(true)
  })

  it('detects Chrome user agent', () => {
    const fp = generateJA4Fingerprint(baseComponents)
    expect(fp).toContain('chr')
  })

  it('detects Firefox user agent', () => {
    const fp = generateJA4Fingerprint({
      ...baseComponents,
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0',
    })
    expect(fp).toContain('ffx')
  })

  it('detects Safari user agent', () => {
    const fp = generateJA4Fingerprint({
      ...baseComponents,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/605 Safari/537.36',
    })
    expect(fp).toContain('saf')
  })

  it('detects bot user agent', () => {
    const fp = generateJA4Fingerprint({
      ...baseComponents,
      userAgent: 'Googlebot/2.1',
    })
    expect(fp).toContain('bot')
  })

  it('detects API client user agent', () => {
    const fp = generateJA4Fingerprint({
      ...baseComponents,
      userAgent: 'curl/7.81.0',
    })
    expect(fp).toContain('api')
  })

  it('returns unk for empty user agent', () => {
    const fp = generateJA4Fingerprint({
      ...baseComponents,
      userAgent: '',
    })
    expect(fp).toContain('unk')
  })

  it('detects Windows platform', () => {
    const fp = generateJA4Fingerprint(baseComponents)
    expect(fp).toContain('win')
  })

  it('detects Mac platform', () => {
    const fp = generateJA4Fingerprint({
      ...baseComponents,
      secChUaPlatform: '"macOS"',
    })
    expect(fp).toContain('mac')
  })

  it('detects Linux platform', () => {
    const fp = generateJA4Fingerprint({
      ...baseComponents,
      secChUaPlatform: '"Linux"',
    })
    expect(fp).toContain('lnx')
  })

  it('detects Android platform', () => {
    const fp = generateJA4Fingerprint({
      ...baseComponents,
      secChUaPlatform: '"Android"',
    })
    expect(fp).toContain('and')
  })

  it('detects mobile devices', () => {
    const fp = generateJA4Fingerprint({
      ...baseComponents,
      secChUaMobile: '?1',
    })
    expect(fp).toContain('_m_')
  })

  it('detects desktop devices', () => {
    const fp = generateJA4Fingerprint({
      ...baseComponents,
      secChUaMobile: '?0',
    })
    expect(fp).toContain('_d_')
  })

  it('produces different fingerprints for different browsers', () => {
    const chromeFp = generateJA4Fingerprint(baseComponents)
    const firefoxFp = generateJA4Fingerprint({
      ...baseComponents,
      userAgent: 'Mozilla/5.0 Firefox/120.0',
    })
    expect(chromeFp).not.toBe(firefoxFp)
  })
})

describe('generateSessionHash', () => {
  it('returns a hex string', () => {
    const hash = generateSessionHash('fp_test', '127.0.0.1')
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('produces consistent output for same input', () => {
    const hash1 = generateSessionHash('fp_test', '127.0.0.1')
    const hash2 = generateSessionHash('fp_test', '127.0.0.1')
    expect(hash1).toBe(hash2)
  })

  it('produces different output for different fingerprints', () => {
    const hash1 = generateSessionHash('fp_a', '127.0.0.1')
    const hash2 = generateSessionHash('fp_b', '127.0.0.1')
    expect(hash1).not.toBe(hash2)
  })

  it('produces different output for different IPs', () => {
    const hash1 = generateSessionHash('fp_test', '127.0.0.1')
    const hash2 = generateSessionHash('fp_test', '192.168.1.1')
    expect(hash1).not.toBe(hash2)
  })
})

describe('extractGeoInfo', () => {
  it('extracts Vercel geo headers', () => {
    const headers = new Headers({
      'x-vercel-ip-country': 'US',
      'x-vercel-ip-country-region': 'CA',
      'x-vercel-ip-city': 'San Francisco',
    })
    const geo = extractGeoInfo(headers)
    expect(geo).toEqual({
      country: 'US',
      region: 'CA',
      city: 'San Francisco',
    })
  })

  it('returns nulls when headers are missing', () => {
    const headers = new Headers()
    const geo = extractGeoInfo(headers)
    expect(geo).toEqual({
      country: null,
      region: null,
      city: null,
    })
  })

  it('handles partial headers', () => {
    const headers = new Headers({
      'x-vercel-ip-country': 'DE',
    })
    const geo = extractGeoInfo(headers)
    expect(geo.country).toBe('DE')
    expect(geo.region).toBeNull()
    expect(geo.city).toBeNull()
  })
})
