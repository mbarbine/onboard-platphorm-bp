import { neon } from '@neondatabase/serverless'

// Lazily initialise so importing this module during `next build` (when
// DATABASE_URL is absent in CI / local builds without .env.local) doesn't
// throw at module-evaluation time. The real client is created on first call.
type InternalClient = ReturnType<typeof neon>
let _client: InternalClient | null = null

function getClient(): InternalClient {
  if (!_client) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL environment variable is not set')
    _client = neon(url)
  }
  return _client
}

// We always use the default neon() options (arrayMode: false, fullResults: false)
// so the resolved return type is Record<string, any>[].  The conditional union
// that TypeScript infers through the Proxy wrapper is too wide for strict mode,
// hence the explicit call-signature below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>
export interface SqlClient {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<Row[]>
  /** Inject raw SQL into a template literal (not a standalone query) */
  unsafe(rawSql: string): unknown
}

export const sql: SqlClient = new Proxy(
  (() => {}) as unknown as SqlClient,
  {
    apply(_t, thisArg, args) {
      return Reflect.apply(getClient() as unknown as (...a: unknown[]) => unknown, thisArg, args)
    },
    get(_t, prop: string | symbol) {
      return Reflect.get(getClient() as object, prop)
    },
  },
)

export type Tenant = {
  id: string
  name: string
  slug: string
  domain: string | null
  settings: Record<string, unknown>
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
}

export type Document = {
  id: string
  tenant_id: string
  slug: string
  title: string
  description: string | null
  content: string
  content_format: string
  source_url: string | null
  source_identifier: string | null
  author_name: string | null
  author_email: string | null
  author_url: string | null
  category: string | null
  tags: string[]
  metadata: Record<string, unknown>
  version: number
  status: 'draft' | 'published' | 'archived'
  published_at: Date | null
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
  og_title: string | null
  og_description: string | null
  og_image: string | null
  twitter_card: string | null
  canonical_url: string | null
  keywords: string[]
  reading_time_minutes: number | null
  word_count: number | null
  emoji_summary: string | null
  target_audience: string | null
  backlinks: Record<string, unknown>[] | null
}

export type Submission = {
  id: string
  tenant_id: string
  source_url: string
  source_identifier: string | null
  title: string
  content: string
  content_format: string
  author_name: string | null
  author_email: string | null
  metadata: Record<string, unknown>
  status: 'pending' | 'approved' | 'rejected'
  reviewed_at: Date | null
  reviewed_by: string | null
  document_id: string | null
  created_at: Date
  updated_at: Date
}

export type Category = {
  id: string
  tenant_id: string
  parent_id: string | null
  slug: string
  name: string
  description: string | null
  icon: string | null
  order_index: number
  metadata: Record<string, unknown>
  created_at: Date
  updated_at: Date
}

export type ApiKey = {
  id: string
  tenant_id: string
  name: string
  key_hash: string
  key_prefix: string
  scopes: string[]
  rate_limit: number
  last_used_at: Date | null
  expires_at: Date | null
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
}

export type MCPSession = {
  id: string
  tenant_id: string
  session_token: string
  agent_name: string | null
  agent_version: string | null
  capabilities: string[]
  last_activity_at: Date
  expires_at: Date | null
  created_at: Date
}

export type AuditLog = {
  id: string
  tenant_id: string
  action: string
  entity_type: string
  entity_id: string | null
  actor_id: string | null
  actor_type: string | null
  metadata: Record<string, unknown>
  ip_address: string | null
  user_agent: string | null
  created_at: Date
}

// Default tenant ID for single-tenant mode
export const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'
