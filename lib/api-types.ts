export interface APIResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
  meta?: {
    page?: number
    per_page?: number
    total?: number
    total_pages?: number
    request_id?: string
  }
}

export interface PaginationParams {
  page?: number
  per_page?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface DocumentCreateInput {
  slug: string
  title: string
  description?: string
  content: string
  content_format?: 'markdown' | 'html' | 'text'
  source_url?: string
  source_identifier?: string
  author_name?: string
  author_email?: string
  author_url?: string
  category?: string
  tags?: string[]
  metadata?: Record<string, unknown>
  status?: 'draft' | 'published'
}

export interface DocumentUpdateInput {
  title?: string
  description?: string
  content?: string
  content_format?: 'markdown' | 'html' | 'text'
  source_url?: string
  author_name?: string
  author_email?: string
  author_url?: string
  category?: string
  tags?: string[]
  metadata?: Record<string, unknown>
  status?: 'draft' | 'published' | 'archived'
}

export interface SubmissionCreateInput {
  source_url: string
  source_identifier?: string
  title: string
  content: string
  content_format?: 'markdown' | 'html' | 'text'
  author_name?: string
  author_email?: string
  metadata?: Record<string, unknown>
}

export interface CategoryCreateInput {
  slug: string
  name: string
  description?: string
  parent_id?: string
  icon?: string
  order_index?: number
  metadata?: Record<string, unknown>
}

export interface WebhookCreateInput {
  url: string
  events?: string[]
  active?: boolean
}

export interface MCPTool {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

export interface MCPResource {
  uri: string
  name: string
  description?: string
  mimeType?: string
}

export interface MCPPrompt {
  name: string
  description?: string
  arguments?: {
    name: string
    description?: string
    required?: boolean
  }[]
}

export const API_VERSION = 'v1'
export const OPENAPI_VERSION = '3.1.0'
