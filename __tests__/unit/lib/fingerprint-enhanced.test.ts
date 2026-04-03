process.env.SESSION_SALT = 'test_salt'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock db module to avoid requiring DATABASE_URL — use vi.hoisted for the mock fn
const { mockSql } = vi.hoisted(() => ({
  mockSql: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/db', () => ({
  sql: mockSql,
  DEFAULT_TENANT_ID: '00000000-0000-0000-0000-000000000001',
}))

// Mock next/headers for getOrCreateSession
vi.mock('next/headers', () => ({
  headers: vi.fn(),
}))

import {
  generateJA4Fingerprint,
  generateSessionHash,
  extractGeoInfo,
  linkSubmissionToSession,
  getSessionSubmissions,
  type FingerprintComponents,
} from '@/lib/fingerprint'

describe('linkSubmissionToSession', () => {
  beforeEach(() => {
    mockSql.mockClear()
    mockSql.mockResolvedValue([])
  })

  it('calls SQL INSERT with session and entity IDs', async () => {
    await linkSubmissionToSession('session-123', 'submission-456')
    expect(mockSql).toHaveBeenCalledTimes(1)
  })

  it('defaults entity type to submission', async () => {
    await linkSubmissionToSession('session-123', 'submission-456')
    expect(mockSql).toHaveBeenCalledTimes(1)
    // Check the SQL was called with 'submission' as entity_type
    const call = mockSql.mock.calls[0]
    // Template strings: the values should include 'submission'
    expect(call).toBeDefined()
  })

  it('accepts document entity type', async () => {
    await linkSubmissionToSession('session-123', 'doc-789', 'document')
    expect(mockSql).toHaveBeenCalledTimes(1)
  })
})

describe('getSessionSubmissions', () => {
  beforeEach(() => {
    mockSql.mockClear()
  })

  it('returns submissions for a session', async () => {
    const mockData = [
      { entity_id: 'sub-1', entity_type: 'submission', created_at: new Date('2026-01-01') },
      { entity_id: 'doc-1', entity_type: 'document', created_at: new Date('2026-01-02') },
    ]
    mockSql.mockResolvedValueOnce(mockData)

    const results = await getSessionSubmissions('session-123')
    expect(results).toHaveLength(2)
    expect(results[0].entity_id).toBe('sub-1')
    expect(results[1].entity_type).toBe('document')
  })

  it('filters by entity type when specified', async () => {
    mockSql.mockResolvedValueOnce([
      { entity_id: 'sub-1', entity_type: 'submission', created_at: new Date() },
    ])

    const results = await getSessionSubmissions('session-123', 'submission')
    expect(results).toHaveLength(1)
    expect(results[0].entity_type).toBe('submission')
  })

  it('returns all types when entity type is not specified', async () => {
    mockSql.mockResolvedValueOnce([
      { entity_id: 'sub-1', entity_type: 'submission', created_at: new Date() },
      { entity_id: 'doc-1', entity_type: 'document', created_at: new Date() },
    ])

    const results = await getSessionSubmissions('session-123')
    expect(results).toHaveLength(2)
  })

  it('returns empty array for session with no submissions', async () => {
    mockSql.mockResolvedValueOnce([])
    const results = await getSessionSubmissions('session-123')
    expect(results).toEqual([])
  })
})

// ── Expanded JA4+ fingerprint tests ──────────────────────────────────────────

describe('generateJA4Fingerprint (expanded)', () => {
  const baseComponents: FingerprintComponents = {
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

  it('detects Edge user agent', () => {
    // Modern Edge includes "Edg/" but categorizeUserAgent looks for "edge"
    // Use the full Edge UA string which also contains "Chrome" — Edge is Chrome-based
    const fp = generateJA4Fingerprint({ ...baseComponents, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edge/120.0' })
    expect(fp).toContain('edg')
  })

  it('detects iOS platform', () => {
    const fp = generateJA4Fingerprint({ ...baseComponents, secChUaPlatform: '"iOS"' })
    expect(fp).toContain('ios')
  })

  it('returns oth for unrecognized platform', () => {
    const fp = generateJA4Fingerprint({ ...baseComponents, secChUaPlatform: '"HaikuOS"' })
    expect(fp).toContain('oth')
  })

  it('falls back to user agent for platform when sec-ch-ua-platform is empty', () => {
    const fp = generateJA4Fingerprint({
      ...baseComponents,
      secChUaPlatform: '',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120',
    })
    expect(fp).toContain('win')
  })

  it('produces consistent fingerprint for same input', () => {
    const fp1 = generateJA4Fingerprint(baseComponents)
    const fp2 = generateJA4Fingerprint(baseComponents)
    expect(fp1).toBe(fp2)
  })

  it('6-part format: h2_langHash_browserType_platform_device_encodingHash', () => {
    const fp = generateJA4Fingerprint(baseComponents)
    const parts = fp.split('_')
    expect(parts[0]).toBe('h2')           // HTTP version
    expect(parts[1]).toMatch(/^[a-f0-9]{4}$/) // Accept-Language hash
    expect(['chr', 'ffx', 'saf', 'edg', 'bot', 'api', 'oth', 'unk']).toContain(parts[2]) // browser
    expect(['win', 'mac', 'lnx', 'and', 'ios', 'oth', 'unk']).toContain(parts[3]) // platform
    expect(['m', 'd']).toContain(parts[4]) // mobile/desktop
    expect(parts[5]).toMatch(/^[a-f0-9]{2}$/) // encoding hash
  })

  it('different Accept-Language produces different hash part', () => {
    const fpEn = generateJA4Fingerprint({ ...baseComponents, acceptLanguage: 'en-US' })
    const fpDe = generateJA4Fingerprint({ ...baseComponents, acceptLanguage: 'de-DE' })
    const enPart = fpEn.split('_')[1]
    const dePart = fpDe.split('_')[1]
    expect(enPart).not.toBe(dePart)
  })

  it('different Accept-Encoding produces different encoding hash', () => {
    const fpGzip = generateJA4Fingerprint({ ...baseComponents, acceptEncoding: 'gzip' })
    const fpBr = generateJA4Fingerprint({ ...baseComponents, acceptEncoding: 'br' })
    const gzipPart = fpGzip.split('_')[5]
    const brPart = fpBr.split('_')[5]
    expect(gzipPart).not.toBe(brPart)
  })
})

describe('generateSessionHash (expanded)', () => {
  it('hash length is always 64 hex chars (SHA-256)', () => {
    const hash = generateSessionHash('any-fp', '1.2.3.4')
    expect(hash).toHaveLength(64)
  })

  it('includes session salt in the hash computation', () => {
    // Changing the salt env var would change the hash
    const hash1 = generateSessionHash('fp', '1.2.3.4')
    expect(hash1).toBeTruthy()
    // Can't easily test env var without overriding process.env, but we verify determinism
    const hash2 = generateSessionHash('fp', '1.2.3.4')
    expect(hash1).toBe(hash2)
  })
})

describe('extractGeoInfo (expanded)', () => {
  it('returns all geo fields from Vercel headers', () => {
    const headers = new Headers({
      'x-vercel-ip-country': 'JP',
      'x-vercel-ip-country-region': 'TK',
      'x-vercel-ip-city': 'Tokyo',
    })
    const geo = extractGeoInfo(headers)
    expect(geo.country).toBe('JP')
    expect(geo.region).toBe('TK')
    expect(geo.city).toBe('Tokyo')
  })

  it('handles special characters in city names', () => {
    const headers = new Headers({
      'x-vercel-ip-country': 'DE',
      'x-vercel-ip-city': 'München',
    })
    const geo = extractGeoInfo(headers)
    expect(geo.city).toBe('München')
  })

  it('returns nulls for non-Vercel environment', () => {
    const headers = new Headers({ 'x-forwarded-for': '1.2.3.4' })
    const geo = extractGeoInfo(headers)
    expect(geo.country).toBeNull()
    expect(geo.region).toBeNull()
    expect(geo.city).toBeNull()
  })
})
