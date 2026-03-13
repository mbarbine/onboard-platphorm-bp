import { NextResponse } from 'next/server'
import { sql, DEFAULT_TENANT_ID } from '@/lib/db'

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
  
  const robotsTxt = `# OpenDocs - Documentation platform with MCP integration
# ${baseUrl}

User-agent: *
Allow: /

# Sitemaps
Sitemap: ${baseUrl}/sitemap.xml

# LLM Discovery Files
# Summary: ${baseUrl}/llms.txt
# Full: ${baseUrl}/llms-full.txt
# Structured: ${baseUrl}/llms-index.json

# AI Agent Discovery
# Agent: ${baseUrl}/.well-known/agent.json

# Security Policy
# Security: ${baseUrl}/.well-known/security.txt

# MCP Endpoint (JSON-RPC 2.0)
# POST ${baseUrl}/api/mcp

# Disallow API paths from general crawlers
Disallow: /api/

# Allow discovery endpoints
Allow: /api/docs
Allow: /api/health

# Allow well-known discovery
Allow: /.well-known/

# RSS Feed: ${baseUrl}/rss.xml
# Humans: ${baseUrl}/humans.txt
# Ecosystem: https://platphormnews.com
`

  return new NextResponse(robotsTxt, {
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
