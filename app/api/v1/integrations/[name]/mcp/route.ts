import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

const DEFAULT_TENANT = '00000000-0000-0000-0000-000000000001'

// Proxy MCP requests to integrated services
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params
  
  try {
    // Get integration config
    const integrations = await sql`
      SELECT * FROM integrations
      WHERE tenant_id = ${DEFAULT_TENANT} AND name = ${name} AND enabled = true
    `
    
    if (integrations.length === 0) {
      return NextResponse.json(
        { success: false, error: `Integration '${name}' not found or disabled` },
        { status: 404 }
      )
    }
    
    const integration = integrations[0]
    const mcpUrl = `${integration.base_url}${integration.mcp_path}`
    
    // Forward the request to the integration's MCP endpoint
    const body = await request.json()
    
    const response = await fetch(mcpUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-From': 'docs.platphormnews.com',
      },
      body: JSON.stringify(body),
    })
    
    const data = await response.json()
    
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error(`Error proxying MCP to ${name}:`, error)
    return NextResponse.json(
      { 
        jsonrpc: '2.0',
        error: { code: -32603, message: `Failed to connect to ${name} MCP service` },
        id: null,
      },
      { status: 500 }
    )
  }
}

// Get integration info
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params
  
  try {
    const integrations = await sql`
      SELECT id, name, base_url, api_path, mcp_path, enabled
      FROM integrations
      WHERE tenant_id = ${DEFAULT_TENANT} AND name = ${name}
    `
    
    if (integrations.length === 0) {
      return NextResponse.json(
        { success: false, error: `Integration '${name}' not found` },
        { status: 404 }
      )
    }
    
    const integration = integrations[0]
    
    return NextResponse.json({
      success: true,
      data: {
        ...integration,
        mcp_endpoint: `${integration.base_url}${integration.mcp_path}`,
        api_endpoint: `${integration.base_url}${integration.api_path}`,
        docs_endpoint: `${integration.base_url}${integration.api_path}/docs`,
      },
    })
  } catch (error) {
    console.error(`Error fetching integration ${name}:`, error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch integration' },
      { status: 500 }
    )
  }
}
