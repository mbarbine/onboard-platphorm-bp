import { sql, DEFAULT_TENANT_ID, Category } from '@/lib/db'
import { getCategories } from '@/lib/data'
import { DocsLayout } from '@/components/docs-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Copy } from 'lucide-react'
import { ApiCodeBlock } from './api-code-block'

import { SITE_NAME } from '@/lib/site-config'

export const metadata = {
  title: 'API Reference',
  description: `Complete REST API documentation for ${SITE_NAME}. Explore endpoints, authentication, request/response formats, and code examples for programmatic access.`,
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

const endpoints = [
  {
    method: 'GET',
    path: '/api/health',
    description: 'Health check endpoint',
    auth: false,
  },
  {
    method: 'GET',
    path: '/api/v1/documents',
    description: 'List all published documents with pagination',
    auth: false,
    params: ['page', 'per_page', 'status', 'category', 'q', 'tag'],
  },
  {
    method: 'POST',
    path: '/api/v1/documents',
    description: 'Create a new document',
    auth: true,
    scope: 'write',
  },
  {
    method: 'GET',
    path: '/api/v1/documents/{slug}',
    description: 'Get a specific document by slug',
    auth: false,
  },
  {
    method: 'PUT',
    path: '/api/v1/documents/{slug}',
    description: 'Update an existing document',
    auth: true,
    scope: 'write',
  },
  {
    method: 'DELETE',
    path: '/api/v1/documents/{slug}',
    description: 'Delete a document (soft delete)',
    auth: true,
    scope: 'admin',
  },
  {
    method: 'GET',
    path: '/api/v1/submissions',
    description: 'List all submissions',
    auth: true,
    scope: 'read',
    params: ['status', 'source_url'],
  },
  {
    method: 'POST',
    path: '/api/v1/submissions',
    description: 'Submit new content for review (open endpoint)',
    auth: false,
  },
  {
    method: 'GET',
    path: '/api/v1/submissions/{id}',
    description: 'Get a specific submission',
    auth: true,
    scope: 'read',
  },
  {
    method: 'POST',
    path: '/api/v1/submissions/{id}',
    description: 'Approve or reject a submission',
    auth: true,
    scope: 'write',
  },
  {
    method: 'GET',
    path: '/api/v1/categories',
    description: 'List all categories with document counts',
    auth: false,
  },
  {
    method: 'POST',
    path: '/api/v1/categories',
    description: 'Create a new category',
    auth: true,
    scope: 'write',
  },
  {
    method: 'GET',
    path: '/api/v1/search',
    description: 'Full-text search across documents',
    auth: false,
    params: ['q', 'category', 'tag', 'page', 'per_page'],
  },
  {
    method: 'GET',
    path: '/api/v1/webhooks',
    description: 'List webhook endpoints',
    auth: true,
    scope: 'admin',
  },
  {
    method: 'POST',
    path: '/api/v1/webhooks',
    description: 'Create a webhook endpoint',
    auth: true,
    scope: 'admin',
  },
  {
    method: 'GET',
    path: '/api/v1/keys',
    description: 'List API keys',
    auth: true,
    scope: 'admin',
  },
  {
    method: 'POST',
    path: '/api/v1/keys',
    description: 'Create a new API key',
    auth: true,
    scope: 'admin',
  },
  {
    method: 'PUT',
    path: '/api/v1/keys',
    description: 'Bootstrap initial admin API key (only works if no keys exist)',
    auth: false,
  },
]

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    POST: 'bg-green-500/10 text-green-600 dark:text-green-400',
    PUT: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
    DELETE: 'bg-red-500/10 text-red-600 dark:text-red-400',
  }
  return (
    <Badge variant="outline" className={`font-mono ${colors[method] || ''}`}>
      {method}
    </Badge>
  )
}

export default async function APIDocsPage() {
  const [categories, baseUrl] = await Promise.all([
    getCategories(),
    getBaseUrl(),
  ])

  return (
    <DocsLayout categories={categories}>
      <div className="space-y-2 mb-8">
        <h1 className="text-3xl font-bold tracking-tight">API Reference</h1>
        <p className="text-lg text-muted-foreground text-pretty">
          Complete REST API documentation for programmatic access to {SITE_NAME}.
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
          <TabsTrigger value="auth">Authentication</TabsTrigger>
          <TabsTrigger value="examples">cURL Examples</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Base URL</CardTitle>
              <CardDescription>All API requests should use this base URL</CardDescription>
            </CardHeader>
            <CardContent>
              <ApiCodeBlock code={`${baseUrl}/api/v1`} />
              <p className="mt-3 text-sm text-muted-foreground">
                Replace with your own domain if you have deployed your own instance.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Response Format</CardTitle>
              <CardDescription>All responses follow this structure</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="rounded-lg bg-muted p-4 font-mono text-sm overflow-x-auto">
{`{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 100,
    "total_pages": 5,
    "request_id": "uuid"
  }
}`}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Error Response</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="rounded-lg bg-muted p-4 font-mono text-sm overflow-x-auto">
{`{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Description of the error"
  },
  "meta": {
    "request_id": "uuid"
  }
}`}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="endpoints" className="space-y-4">
          {endpoints.map((endpoint, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <MethodBadge method={endpoint.method} />
                  <code className="font-mono text-sm">{endpoint.path}</code>
                  {endpoint.auth && (
                    <Badge variant="secondary" className="ml-auto">
                      {endpoint.scope || 'auth'}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground">{endpoint.description}</p>
                {endpoint.params && (
                  <div className="mt-2">
                    <span className="text-xs text-muted-foreground">Query params: </span>
                    {endpoint.params.map((p) => (
                      <code key={p} className="ml-1 text-xs bg-muted px-1 rounded">
                        {p}
                      </code>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="auth" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>API Key Authentication</CardTitle>
              <CardDescription>Use Bearer token authentication</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ApiCodeBlock code="Authorization: Bearer od_your_api_key_here" />
              <p className="text-sm text-muted-foreground">
                API keys can have different scopes: <code>read</code>, <code>write</code>, or <code>admin</code>.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bootstrap Your First API Key</CardTitle>
              <CardDescription>Create an initial admin key (only works once)</CardDescription>
            </CardHeader>
            <CardContent>
              <ApiCodeBlock code={`curl -X PUT ${baseUrl}/api/v1/keys \\
  -H "Content-Type: application/json" \\
  -d '{"name": "Admin Key"}'`} />
              <p className="text-sm text-muted-foreground mt-4">
                This endpoint only works if no API keys exist yet. Store the returned key safely!
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Scopes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Badge variant="outline">read</Badge>
                  <p className="text-sm text-muted-foreground">Read access to documents, submissions, and categories</p>
                </div>
                <div className="flex items-start gap-3">
                  <Badge variant="outline">write</Badge>
                  <p className="text-sm text-muted-foreground">Create and update documents, approve submissions</p>
                </div>
                <div className="flex items-start gap-3">
                  <Badge variant="outline">admin</Badge>
                  <p className="text-sm text-muted-foreground">Full access including delete, webhooks, and API key management</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="examples" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>List Documents</CardTitle>
              <CardDescription>GET /api/v1/documents</CardDescription>
            </CardHeader>
            <CardContent>
              <ApiCodeBlock code={`curl "${baseUrl}/api/v1/documents?page=1&per_page=10"`} />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Search Documents</CardTitle>
              <CardDescription>GET /api/v1/search</CardDescription>
            </CardHeader>
            <CardContent>
              <ApiCodeBlock code={`curl "${baseUrl}/api/v1/search?q=getting+started&category=guides"`} />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Create Document</CardTitle>
              <CardDescription>POST /api/v1/documents (requires auth)</CardDescription>
            </CardHeader>
            <CardContent>
              <ApiCodeBlock code={`curl -X POST ${baseUrl}/api/v1/documents \\
  -H "Authorization: Bearer od_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "My New Document",
    "content": "# Hello World\\n\\nThis is my document.",
    "description": "A sample document",
    "category": "guides",
    "tags": ["tutorial", "beginner"],
    "status": "published"
  }'`} />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Submit Content (External)</CardTitle>
              <CardDescription>POST /api/v1/submissions (no auth required)</CardDescription>
            </CardHeader>
            <CardContent>
              <ApiCodeBlock code={`curl -X POST ${baseUrl}/api/v1/submissions \\
  -H "Content-Type: application/json" \\
  -d '{
    "source_url": "https://vanlife.platphormnews.com/my-post",
    "title": "My Blog Post",
    "content": "# My Post\\n\\nContent here...",
    "author_name": "Jane Doe",
    "author_email": "jane@example.com"
  }'`} />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Ingest from URL</CardTitle>
              <CardDescription>POST /api/v1/ingest (auto-fetches and converts content)</CardDescription>
            </CardHeader>
            <CardContent>
              <ApiCodeBlock code={`curl -X POST ${baseUrl}/api/v1/ingest \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://example.com/docs/getting-started",
    "category": "guides",
    "tags": ["imported", "external"],
    "auto_publish": false
  }'`} />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>MCP Tool Call</CardTitle>
              <CardDescription>POST /api/mcp (JSON-RPC 2.0)</CardDescription>
            </CardHeader>
            <CardContent>
              <ApiCodeBlock code={`curl -X POST ${baseUrl}/api/mcp \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "search_documents",
      "arguments": {
        "query": "getting started",
        "limit": 5
      }
    }
  }'`} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </DocsLayout>
  )
}
