/**
 * Site Configuration — Boilerplate Anchors
 *
 * All brand-specific values live here. When spinning up a new site on the
 * Platphorm News Network, duplicate this file and change these values.
 *
 * Environment variables override the defaults at runtime.
 */

// ── Core Identity ────────────────────────────────────────────────────────────

/** Display name shown in the UI, metadata, and structured data */
export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || 'Onboard'

/** Tagline shown in metadata and hero sections */
export const SITE_TAGLINE = process.env.NEXT_PUBLIC_SITE_TAGLINE || 'MCP-Enabled Documentation Platform'

/** Full title used in <title> and OG tags */
export const SITE_TITLE = `${SITE_NAME} — ${SITE_TAGLINE}`

/** Short description for SEO and manifests */
export const SITE_DESCRIPTION =
  process.env.NEXT_PUBLIC_SITE_DESCRIPTION ||
  'A modern, AI-native documentation platform with full MCP integration. Submit, discover, and explore documentation from any source.'

/** Generator meta tag */
export const SITE_GENERATOR = SITE_NAME

// ── URLs ─────────────────────────────────────────────────────────────────────

/** Canonical base URL (no trailing slash) */
export const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

/** Organization / parent company website */
export const ORG_URL =
  process.env.NEXT_PUBLIC_ORG_URL || 'https://platphormnews.com'

/** GitHub repository URL */
export const GITHUB_REPO =
  process.env.NEXT_PUBLIC_GITHUB_REPO || 'https://github.com/mbarbine/onboard-platphorm-bp'

/** GitHub organization URL */
export const GITHUB_ORG =
  process.env.NEXT_PUBLIC_GITHUB_ORG || 'https://github.com/mbarbine'

// ── Organization / Publisher ─────────────────────────────────────────────────

/** Legal / display name of the organization */
export const ORG_NAME =
  process.env.NEXT_PUBLIC_ORG_NAME || 'Platphorm News Network'

/** Primary contact email */
export const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'hello@platphormnews.com'

/** Security reporting email */
export const SECURITY_EMAIL =
  process.env.NEXT_PUBLIC_SECURITY_EMAIL || 'security@platphormnews.com'

/** Code of conduct email */
export const CONDUCT_EMAIL =
  process.env.NEXT_PUBLIC_CONDUCT_EMAIL || 'conduct@platphormnews.com'

/** Open-source / support email */
export const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@platphormnews.com'

/** Discord invite URL */
export const DISCORD_URL =
  process.env.NEXT_PUBLIC_DISCORD_URL || ''

// ── Technical Anchors ────────────────────────────────────────────────────────

/** Service name used in structured logs */
export const SERVICE_NAME = process.env.SERVICE_NAME || SITE_NAME.toLowerCase().replace(/\s+/g, '-')

/** API key prefix (e.g. "od_abc123...") */
export const API_KEY_PREFIX = process.env.API_KEY_PREFIX || 'ob_'

/** Webhook signature header name */
export const WEBHOOK_SIGNATURE_HEADER =
  process.env.WEBHOOK_SIGNATURE_HEADER || `X-${SITE_NAME}-Signature`

/** Webhook event header name */
export const WEBHOOK_EVENT_HEADER =
  process.env.WEBHOOK_EVENT_HEADER || `X-${SITE_NAME}-Event`

/** localStorage key prefix for theme / accessibility prefs */
export const STORAGE_PREFIX = process.env.NEXT_PUBLIC_STORAGE_PREFIX || SERVICE_NAME

/** Default salt for session fingerprinting */
export const SESSION_SALT = process.env.SESSION_SALT || `${SERVICE_NAME}-salt`

// ── Ecosystem Integration URLs ───────────────────────────────────────────────

export const ECOSYSTEM = {
  emoji: process.env.EMOJI_API_URL || '',
  mcp: process.env.MCP_HUB_URL || '',
  svg: process.env.SVG_API_URL || '',
  json: process.env.JSON_API_URL || '',
  xml: process.env.XML_API_URL || '',
  calendar: process.env.CALENDAR_API_URL || '',
  kanban: process.env.KANBAN_API_URL || '',
} as const

// ── SEO Keywords ─────────────────────────────────────────────────────────────

export const DEFAULT_KEYWORDS = [
  'documentation',
  'MCP',
  'API',
  'developer tools',
  'knowledge base',
  'model context protocol',
  'AI documentation',
  'open source',
]

// ── Docker / Local Dev Defaults ──────────────────────────────────────────────

export const DB_DEFAULTS = {
  user: 'platform',
  password: 'platform',
  name: 'platform',
} as const
