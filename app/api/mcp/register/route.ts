import { NextRequest, NextResponse } from 'next/server'

/**
 * MCP Registry Registration Endpoint
 * 
 * This endpoint provides metadata for MCP registry services like mcp.platphormnews.com
 * to discover and index this MCP server.
 */

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}` 
  : 'http://localhost:3000'

export async function GET(request: NextRequest) {
  const serverUrl = request.nextUrl.origin || BASE_URL

  return NextResponse.json({
    // MCP Server Metadata
    name: 'OpenDocs',
    description: 'AI-native documentation platform with full MCP integration. Create, search, and manage documentation via MCP tools and resources.',
    version: '1.0.0',
    
    // MCP Endpoint
    mcp_endpoint: `${serverUrl}/api/mcp`,
    protocol: 'JSON-RPC 2.0',
    
    // Capabilities
    capabilities: {
      tools: true,
      resources: true,
      prompts: false,
      logging: false
    },
    
    // Available Tools
    tools: [
      {
        name: 'list_documents',
        description: 'List and filter documentation pages',
        parameters: ['query', 'category', 'status', 'limit', 'offset']
      },
      {
        name: 'get_document',
        description: 'Get a specific document by slug',
        parameters: ['slug']
      },
      {
        name: 'search_documents',
        description: 'Full-text search across all documentation',
        parameters: ['query', 'limit']
      },
      {
        name: 'create_document',
        description: 'Create a new documentation page',
        parameters: ['title', 'content', 'description', 'category', 'tags', 'status']
      },
      {
        name: 'update_document',
        description: 'Update an existing document',
        parameters: ['slug', 'title', 'content', 'description', 'category', 'tags', 'status']
      },
      {
        name: 'submit_content',
        description: 'Submit content for review from external sources',
        parameters: ['source_url', 'title', 'content', 'author_name', 'author_email']
      },
      {
        name: 'ingest_url',
        description: 'Fetch and ingest content from a URL',
        parameters: ['url', 'category', 'tags', 'auto_publish']
      },
      {
        name: 'list_categories',
        description: 'List all documentation categories',
        parameters: []
      }
    ],
    
    // Available Resources
    resources: [
      {
        uri: 'docs://all',
        name: 'All Documents',
        description: 'All published documentation pages',
        mimeType: 'application/json'
      },
      {
        uri: 'docs://categories',
        name: 'Categories',
        description: 'All documentation categories',
        mimeType: 'application/json'
      },
      {
        uri: 'docs://recent',
        name: 'Recent Documents',
        description: 'Recently published documentation',
        mimeType: 'application/json'
      },
      {
        uri: 'docs://{slug}',
        name: 'Document by Slug',
        description: 'Get specific document by slug',
        mimeType: 'text/markdown'
      }
    ],
    
    // API Endpoints (REST)
    api: {
      base_url: `${serverUrl}/api/v1`,
      documentation: `${serverUrl}/api/docs`,
      endpoints: [
        { method: 'GET', path: '/documents', description: 'List documents' },
        { method: 'POST', path: '/documents', description: 'Create document' },
        { method: 'GET', path: '/documents/{slug}', description: 'Get document' },
        { method: 'PUT', path: '/documents/{slug}', description: 'Update document' },
        { method: 'DELETE', path: '/documents/{slug}', description: 'Delete document' },
        { method: 'POST', path: '/submissions', description: 'Submit content' },
        { method: 'POST', path: '/ingest', description: 'Ingest from URL' },
        { method: 'GET', path: '/search', description: 'Search documents' },
        { method: 'GET', path: '/categories', description: 'List categories' }
      ]
    },
    
    // Discovery Files
    discovery: {
      llms_txt: `${serverUrl}/llms.txt`,
      llms_full: `${serverUrl}/llms-full.txt`,
      llms_index: `${serverUrl}/llms-index.json`,
      sitemap: `${serverUrl}/sitemap.xml`,
      rss: `${serverUrl}/rss.xml`,
      robots: `${serverUrl}/robots.txt`,
      openapi: `${serverUrl}/api/docs`
    },
    
    // Contact & Links
    links: {
      documentation: `${serverUrl}/docs`,
      api_docs: `${serverUrl}/docs/api`,
      mcp_docs: `${serverUrl}/docs/mcp`,
      submit: `${serverUrl}/submit`
    },
    
    // Server Info
    server: {
      framework: 'Next.js 16',
      database: 'Neon PostgreSQL',
      features: [
        'Full-text search',
        'Multi-source submissions',
        'URL ingestion',
        'Webhook notifications',
        'API versioning',
        'LLM discovery files'
      ]
    },
    
    // Registration timestamp
    registered_at: new Date().toISOString()
  }, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
      'Content-Type': 'application/json'
    }
  })
}

export async function POST(request: NextRequest) {
  // Handle registration ping from MCP registries
  try {
    const body = await request.json()
    const serverUrl = request.nextUrl.origin || BASE_URL
    
    return NextResponse.json({
      success: true,
      message: 'Registration acknowledged',
      server: {
        name: 'OpenDocs',
        mcp_endpoint: `${serverUrl}/api/mcp`,
        version: '1.0.0'
      },
      received: body,
      timestamp: new Date().toISOString()
    })
  } catch {
    return NextResponse.json({
      success: true,
      message: 'Registration ping received',
      timestamp: new Date().toISOString()
    })
  }
}
