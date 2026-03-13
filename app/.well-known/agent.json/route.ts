import { NextResponse } from 'next/server'
import { sql, DEFAULT_TENANT_ID } from '@/lib/db'
import { SITE_NAME, SITE_DESCRIPTION, ORG_NAME, ORG_URL, CONTACT_EMAIL, SUPPORT_EMAIL, SECURITY_EMAIL, GITHUB_REPO } from '@/lib/site-config'

export const dynamic = 'force-dynamic'

async function getBaseUrl(): Promise<string> {
  try {
    const result = await sql`SELECT value FROM settings WHERE tenant_id = ${DEFAULT_TENANT_ID} AND key = 'base_url'`
    if (result[0]?.value) return JSON.parse(result[0].value as string)
  } catch { /* ignore */ }
  return process.env.NEXT_PUBLIC_BASE_URL || 'https://docs.platphormnews.com'
}

export async function GET() {
  const baseUrl = await getBaseUrl()

  const agentJson = {
    schema_version: '1.0.0',
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: baseUrl,
    provider: {
      organization: ORG_NAME,
      url: ORG_URL,
    },
    logo: `${baseUrl}/icon-512.png`,
    contacts: {
      email: CONTACT_EMAIL,
      support: SUPPORT_EMAIL,
      security: SECURITY_EMAIL,
    },
    capabilities: {
      mcp: {
        endpoint: `${baseUrl}/api/mcp`,
        protocol: 'JSON-RPC 2.0',
        transport: 'Streamable HTTP',
        version: '2025-03-26',
        tools: [
          'list_documents', 'get_document', 'search_documents', 'create_document',
          'update_document', 'list_categories', 'submit_content', 'ingest_url',
          'list_submissions', 'review_submission', 'get_emoji', 'search_emoji',
          'get_stats', 'get_version', 'list_project_docs', 'get_project_doc',
        ],
        resources: [
          'docs://index', 'docs://categories', 'docs://recent',
          'docs://popular', 'docs://stats', 'project-docs://index',
        ],
        prompts: [
          'explain_document', 'summarize_document', 'compare_documents',
          'generate_faq', 'translate_document', 'improve_seo',
        ],
      },
      rest_api: {
        base_url: `${baseUrl}/api/v1`,
        documentation: `${baseUrl}/api/docs`,
        authentication: 'Bearer token (optional)',
      },
      webhooks: {
        endpoint: `${baseUrl}/api/v1/webhooks`,
        events: ['document.created', 'document.updated', 'document.deleted', 'submission.created'],
        signature: 'HMAC-SHA256',
      },
    },
    discovery: {
      sitemap: `${baseUrl}/sitemap.xml`,
      robots: `${baseUrl}/robots.txt`,
      rss: `${baseUrl}/rss.xml`,
      llms_txt: `${baseUrl}/llms.txt`,
      llms_full: `${baseUrl}/llms-full.txt`,
      llms_index: `${baseUrl}/llms-index.json`,
      openapi: `${baseUrl}/api/docs`,
      humans_txt: `${baseUrl}/humans.txt`,
      security_txt: `${baseUrl}/.well-known/security.txt`,
      manifest: `${baseUrl}/manifest.json`,
    },
    authentication: {
      type: 'bearer',
      required: false,
      description: 'API key authentication is optional. Read operations are public.',
    },
    rate_limits: {
      default: '100 requests per minute',
      authenticated: '1000 requests per minute',
    },
    ecosystem: {
      parent: ORG_URL,
      documentation: `${baseUrl}`,
      github: GITHUB_REPO,
    },
  }

  return NextResponse.json(agentJson, {
    headers: {
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
