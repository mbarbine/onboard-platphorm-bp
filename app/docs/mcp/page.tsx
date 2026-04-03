import { sql, DEFAULT_TENANT_ID, Category } from '@/lib/db'
import { getCategories } from '@/lib/data'
import { DocsLayout } from '@/components/docs-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Zap, Wrench, Database, MessageSquare } from 'lucide-react'

import { SITE_NAME } from '@/lib/site-config'

export const metadata = {
  title: 'MCP Integration',
  description: `Model Context Protocol integration guide for ${SITE_NAME}. Connect AI agents like Claude, GPT, and other MCP-compatible tools to your documentation.`,
}

async function getBaseUrl(): Promise<string> {
  try {
    const result = await sql`
      SELECT value FROM settings 
      WHERE tenant_id = ${DEFAULT_TENANT_ID} AND key = 'base_url'
    `
    if (result[0]?.value) {
      return JSON.parse(result[0].value as string)
    }
  } catch {
    // ignore
  }
  return 'https://docs.platphormnews.com'
}

const mcpTools = [
  {
    name: 'list_documents',
    description: 'List all published documentation pages with optional filtering',
    params: ['category', 'search', 'limit'],
  },
  {
    name: 'get_document',
    description: 'Get a specific document by slug with full content',
    params: ['slug (required)'],
  },
  {
    name: 'search_docs',
    description: 'Full-text search across all documentation',
    params: ['query (required)', 'limit'],
  },
  {
    name: 'list_categories',
    description: 'List all documentation categories',
    params: [],
  },
  {
    name: 'create_submission',
    description: 'Submit new content for review from an external source',
    params: ['source_url (required)', 'title (required)', 'content (required)', 'author_name', 'author_email'],
  },
  {
    name: 'get_api_schema',
    description: 'Get the OpenAPI schema for the documentation API',
    params: [],
  },
]

const mcpResources = [
  {
    uri: 'docs://index',
    name: 'Documentation Index',
    description: 'Full index of all documentation',
  },
  {
    uri: 'docs://categories',
    name: 'Categories',
    description: 'All documentation categories',
  },
  {
    uri: 'docs://recent',
    name: 'Recent Documents',
    description: 'Recently updated documentation',
  },
]

const mcpPrompts = [
  {
    name: 'explain_doc',
    description: 'Explain a specific documentation page in simple terms',
    args: ['slug (required)'],
  },
  {
    name: 'summarize_category',
    description: 'Summarize all documents in a category',
    args: ['category (required)'],
  },
  {
    name: 'compare_docs',
    description: 'Compare two documentation pages',
    args: ['slug1 (required)', 'slug2 (required)'],
  },
]

export default async function MCPDocsPage() {
  const [categories, baseUrl] = await Promise.all([
    getCategories(),
    getBaseUrl(),
  ])

  return (
    <DocsLayout categories={categories}>
      <div className="space-y-2 mb-8">
        <div className="flex items-center gap-2">
          <Zap className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">MCP Integration</h1>
        </div>
        <p className="text-lg text-muted-foreground text-pretty">
          Connect AI agents to {SITE_NAME} using the Model Context Protocol (MCP).
          Full support for tools, resources, and prompts.
        </p>
      </div>

      <Tabs defaultValue="quickstart" className="space-y-6">
        <TabsList>
          <TabsTrigger value="quickstart">Quick Start</TabsTrigger>
          <TabsTrigger value="tools">Tools</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="prompts">Prompts</TabsTrigger>
        </TabsList>

        <TabsContent value="quickstart" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>MCP Endpoint</CardTitle>
              <CardDescription>Connect your AI agent to this endpoint</CardDescription>
            </CardHeader>
            <CardContent>
              <code className="block rounded-lg bg-muted p-4 font-mono text-sm">
                {baseUrl}/api/mcp
              </code>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Initialize Connection</CardTitle>
              <CardDescription>Start an MCP session</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="rounded-lg bg-muted p-4 font-mono text-sm overflow-x-auto">
{`{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize"
}`}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Get Session Info</CardTitle>
              <CardDescription>Optional: Get a session token for tracking</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="rounded-lg bg-muted p-4 font-mono text-sm overflow-x-auto">
{`GET /api/mcp

Response:
{
  "session_token": "uuid",
  "endpoint": "/api/mcp",
  "protocol_version": "2024-11-05",
  "capabilities": {
    "tools": ["list_documents", "get_document", ...],
    "resources": ["docs://index", ...],
    "prompts": ["explain_doc", ...]
  }
}`}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Example: List Tools</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="rounded-lg bg-muted p-4 font-mono text-sm overflow-x-auto">
{`// Request
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list"
}

// Response
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": [
      {
        "name": "list_documents",
        "description": "List all published documentation...",
        "inputSchema": { ... }
      },
      ...
    ]
  }
}`}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Example: Call a Tool</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="rounded-lg bg-muted p-4 font-mono text-sm overflow-x-auto">
{`// Request
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "search_docs",
    "arguments": {
      "query": "getting started",
      "limit": 5
    }
  }
}

// Response
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [{
      "type": "text",
      "text": "{ results: [...] }"
    }]
  }
}`}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tools" className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Wrench className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Available Tools</h2>
          </div>
          
          {mcpTools.map((tool) => (
            <Card key={tool.name}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-mono">{tool.name}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground mb-2">{tool.description}</p>
                {tool.params.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {tool.params.map((param) => (
                      <Badge key={param} variant="outline" className="font-mono text-xs">
                        {param}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="resources" className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Database className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Available Resources</h2>
          </div>
          
          {mcpResources.map((resource) => (
            <Card key={resource.uri}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-mono">{resource.uri}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="font-medium text-sm">{resource.name}</p>
                <p className="text-sm text-muted-foreground">{resource.description}</p>
              </CardContent>
            </Card>
          ))}

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Reading a Resource</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="rounded-lg bg-muted p-4 font-mono text-sm overflow-x-auto">
{`{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "resources/read",
  "params": {
    "uri": "docs://index"
  }
}`}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prompts" className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Available Prompts</h2>
          </div>
          
          {mcpPrompts.map((prompt) => (
            <Card key={prompt.name}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-mono">{prompt.name}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground mb-2">{prompt.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  {prompt.args.map((arg) => (
                    <Badge key={arg} variant="outline" className="font-mono text-xs">
                      {arg}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Getting a Prompt</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="rounded-lg bg-muted p-4 font-mono text-sm overflow-x-auto">
{`{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "prompts/get",
  "params": {
    "name": "explain_doc",
    "arguments": {
      "slug": "getting-started"
    }
  }
}`}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </DocsLayout>
  )
}
