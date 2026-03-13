import { headers } from 'next/headers'
import { sql, DEFAULT_TENANT_ID } from './db'
import crypto from 'crypto'

// JA4+ Fingerprint components
export interface FingerprintComponents {
  userAgent: string
  acceptLanguage: string
  acceptEncoding: string
  connection: string
  secChUa: string
  secChUaPlatform: string
  secChUaMobile: string
  secFetchDest: string
  secFetchMode: string
  secFetchSite: string
  ip: string
}

export interface GeoInfo {
  country: string | null
  region: string | null
  city: string | null
}

export interface Session {
  id: string
  tenant_id: string
  fingerprint_ja4: string
  fingerprint_hash: string
  user_agent: string | null
  ip_address: string | null
  geo_country: string | null
  geo_region: string | null
  geo_city: string | null
  locale: string
  preferences: Record<string, unknown>
  draft_content: Record<string, unknown>
  last_activity_at: Date
  expires_at: Date
  created_at: Date
  updated_at: Date
}

// Generate JA4+ style fingerprint from HTTP headers
export function generateJA4Fingerprint(components: FingerprintComponents): string {
  // JA4+ inspired format: protocol_ciphers_extensions_signature
  const parts = [
    // HTTP version indicator (h2 for HTTP/2, h1 for HTTP/1.1)
    'h2',
    // Accept-Language hash (first 4 chars)
    hashString(components.acceptLanguage).substring(0, 4),
    // User-Agent category
    categorizeUserAgent(components.userAgent),
    // Platform indicator
    extractPlatform(components.secChUaPlatform || components.userAgent),
    // Mobile indicator
    components.secChUaMobile === '?1' ? 'm' : 'd',
    // Encoding support
    hashString(components.acceptEncoding).substring(0, 2),
  ]
  
  return parts.join('_')
}

function hashString(str: string): string {
  return crypto.createHash('sha256').update(str || '').digest('hex')
}

function categorizeUserAgent(ua: string): string {
  if (!ua) return 'unk'
  const lower = ua.toLowerCase()
  if (lower.includes('chrome')) return 'chr'
  if (lower.includes('firefox')) return 'ffx'
  if (lower.includes('safari') && !lower.includes('chrome')) return 'saf'
  if (lower.includes('edge')) return 'edg'
  if (lower.includes('bot') || lower.includes('crawler')) return 'bot'
  if (lower.includes('curl') || lower.includes('postman')) return 'api'
  return 'oth'
}

function extractPlatform(platform: string): string {
  if (!platform) return 'unk'
  const lower = platform.toLowerCase().replace(/"/g, '')
  if (lower.includes('windows')) return 'win'
  if (lower.includes('mac')) return 'mac'
  if (lower.includes('linux')) return 'lnx'
  if (lower.includes('android')) return 'and'
  if (lower.includes('ios') || lower.includes('iphone')) return 'ios'
  return 'oth'
}

// Generate a stable hash from fingerprint + IP for session lookup
export function generateSessionHash(fingerprint: string, ip: string): string {
  return crypto
    .createHash('sha256')
    .update(`${fingerprint}:${ip}:${process.env.SESSION_SALT || 'opendocs-salt'}`)
    .digest('hex')
}

// Extract geo info from Vercel headers
export function extractGeoInfo(headersList: Headers): GeoInfo {
  return {
    country: headersList.get('x-vercel-ip-country') || null,
    region: headersList.get('x-vercel-ip-country-region') || null,
    city: headersList.get('x-vercel-ip-city') || null,
  }
}

// Get or create session based on fingerprint
export async function getOrCreateSession(): Promise<Session | null> {
  try {
    const headersList = await headers()
    
    const components: FingerprintComponents = {
      userAgent: headersList.get('user-agent') || '',
      acceptLanguage: headersList.get('accept-language') || '',
      acceptEncoding: headersList.get('accept-encoding') || '',
      connection: headersList.get('connection') || '',
      secChUa: headersList.get('sec-ch-ua') || '',
      secChUaPlatform: headersList.get('sec-ch-ua-platform') || '',
      secChUaMobile: headersList.get('sec-ch-ua-mobile') || '',
      secFetchDest: headersList.get('sec-fetch-dest') || '',
      secFetchMode: headersList.get('sec-fetch-mode') || '',
      secFetchSite: headersList.get('sec-fetch-site') || '',
      ip: headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || 
          headersList.get('x-real-ip') || 
          'unknown',
    }
    
    const ja4Fingerprint = generateJA4Fingerprint(components)
    const sessionHash = generateSessionHash(ja4Fingerprint, components.ip)
    const geo = extractGeoInfo(headersList)
    
    // Try to find existing session
    const existingSessions = await sql`
      SELECT * FROM sessions 
      WHERE fingerprint_hash = ${sessionHash}
        AND tenant_id = ${DEFAULT_TENANT_ID}
        AND expires_at > NOW()
      ORDER BY last_activity_at DESC
      LIMIT 1
    ` as Session[]
    
    if (existingSessions.length > 0) {
      // Update last activity
      await sql`
        UPDATE sessions 
        SET last_activity_at = NOW(), updated_at = NOW()
        WHERE id = ${existingSessions[0].id}
      `
      return existingSessions[0]
    }
    
    // Create new session
    const newSessions = await sql`
      INSERT INTO sessions (
        tenant_id, fingerprint_ja4, fingerprint_hash, 
        user_agent, ip_address, 
        geo_country, geo_region, geo_city,
        locale, preferences, draft_content
      ) VALUES (
        ${DEFAULT_TENANT_ID}, ${ja4Fingerprint}, ${sessionHash},
        ${components.userAgent}, ${components.ip},
        ${geo.country}, ${geo.region}, ${geo.city},
        ${components.acceptLanguage?.split(',')[0]?.split('-')[0] || 'en'},
        '{}', '{}'
      )
      RETURNING *
    ` as Session[]
    
    return newSessions[0] || null
  } catch (error) {
    console.error('[v0] Session error:', error)
    return null
  }
}

// Update session preferences
export async function updateSessionPreferences(
  sessionId: string, 
  preferences: Record<string, unknown>
): Promise<void> {
  await sql`
    UPDATE sessions 
    SET preferences = preferences || ${JSON.stringify(preferences)}::jsonb,
        updated_at = NOW()
    WHERE id = ${sessionId}
  `
}

// Save draft content to session
export async function saveDraftToSession(
  sessionId: string, 
  draftKey: string, 
  content: Record<string, unknown>
): Promise<void> {
  const draftUpdate = { [draftKey]: { ...content, savedAt: new Date().toISOString() } }
  await sql`
    UPDATE sessions 
    SET draft_content = draft_content || ${JSON.stringify(draftUpdate)}::jsonb,
        updated_at = NOW()
    WHERE id = ${sessionId}
  `
}

// Get draft content from session
export async function getDraftFromSession(
  sessionId: string, 
  draftKey: string
): Promise<Record<string, unknown> | null> {
  const sessions = await sql`
    SELECT draft_content->${draftKey} as draft
    FROM sessions 
    WHERE id = ${sessionId}
  ` as { draft: Record<string, unknown> | null }[]
  
  return sessions[0]?.draft || null
}

// Clear draft from session
export async function clearDraftFromSession(
  sessionId: string, 
  draftKey: string
): Promise<void> {
  await sql`
    UPDATE sessions 
    SET draft_content = draft_content - ${draftKey},
        updated_at = NOW()
    WHERE id = ${sessionId}
  `
}

// ── Returning-user submission tracking ───────────────────────────────────────

/**
 * Link a submission (or document) to the current session so returning users
 * can see their previous activity.
 */
export async function linkSubmissionToSession(
  sessionId: string,
  entityId: string,
  entityType: 'submission' | 'document' = 'submission'
): Promise<void> {
  await sql`
    INSERT INTO session_submissions (session_id, entity_id, entity_type)
    VALUES (${sessionId}, ${entityId}, ${entityType})
    ON CONFLICT DO NOTHING
  `
}

/**
 * Get all submissions / documents created by a returning user (identified by
 * their fingerprint session).
 */
export async function getSessionSubmissions(
  sessionId: string,
  entityType?: 'submission' | 'document'
): Promise<{ entity_id: string; entity_type: string; created_at: Date }[]> {
  if (entityType) {
    return await sql`
      SELECT entity_id, entity_type, created_at
      FROM session_submissions
      WHERE session_id = ${sessionId} AND entity_type = ${entityType}
      ORDER BY created_at DESC
    ` as { entity_id: string; entity_type: string; created_at: Date }[]
  }
  return await sql`
    SELECT entity_id, entity_type, created_at
    FROM session_submissions
    WHERE session_id = ${sessionId}
    ORDER BY created_at DESC
  ` as { entity_id: string; entity_type: string; created_at: Date }[]
}
