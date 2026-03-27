import Link from 'next/link'
import { Metadata } from 'next'
import { sql, DEFAULT_TENANT_ID, Document, Category } from '@/lib/db'
import { DocsLayout } from '@/components/docs-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  SITE_NAME,
  SITE_TITLE,
  SITE_DESCRIPTION,
  BASE_URL,
  ORG_URL,
  ORG_NAME,
  GITHUB_REPO as DEFAULT_GITHUB_REPO,
  GITHUB_ORG,
  CONTACT_EMAIL,
} from '@/lib/site-config'
import {
  Book,
  Code,
  Zap,
  FileText,
  ArrowRight,
  Terminal,
  Globe,
  Bot,
  Github,
  ExternalLink,
} from 'lucide-react'

async function getCategories(): Promise<(Category & { document_count: number })[]> {
  try {
    const categories = await sql`
      SELECT c.*, 
        (SELECT COUNT(*)::int FROM documents d WHERE d.category = c.slug AND d.deleted_at IS NULL AND d.status = 'published') as document_count
      FROM categories c
      WHERE c.tenant_id = ${DEFAULT_TENANT_ID}
      ORDER BY c.order_index ASC, c.name ASC
    ` as (Category & { document_count: number })[]
    return categories
  } catch {
    return []
  }
}

async function getRecentDocs(): Promise<(Document & { emoji_summary?: string })[]> {
  try {
    const docs = await sql`
      SELECT id, slug, title, description, category, tags, author_name, source_identifier, published_at, emoji_summary
      FROM documents
      WHERE tenant_id = ${DEFAULT_TENANT_ID}
        AND deleted_at IS NULL
        AND status = 'published'
      ORDER BY published_at DESC NULLS LAST
      LIMIT 6
    ` as (Document & { emoji_summary?: string })[]
    return docs
  } catch {
    return []
  }
}

async function getStats() {
  try {
    const [docs, submissions, sources] = await Promise.all([
      sql`SELECT COUNT(*)::int as count FROM documents WHERE tenant_id = ${DEFAULT_TENANT_ID} AND deleted_at IS NULL AND status = 'published'`,
      sql`SELECT COUNT(*)::int as count FROM submissions WHERE tenant_id = ${DEFAULT_TENANT_ID}`,
      sql`SELECT COUNT(DISTINCT source_identifier)::int as count FROM documents WHERE tenant_id = ${DEFAULT_TENANT_ID} AND source_identifier IS NOT NULL`,
    ])
    return {
      documents: (docs as { count: number }[])[0]?.count || 0,
      submissions: (submissions as { count: number }[])[0]?.count || 0,
      sources: (sources as { count: number }[])[0]?.count || 0,
    }
  } catch {
    return { documents: 0, submissions: 0, sources: 0 }
  }
}

async function getSettings() {
  try {
    const settings = await sql`
      SELECT key, value FROM settings
      WHERE tenant_id = ${DEFAULT_TENANT_ID}
    `
    const result: Record<string, string> = {}
    for (const row of settings) {
      try {
        result[row.key as string] = JSON.parse(row.value as string)
      } catch {
        result[row.key as string] = row.value as string
      }
    }
    return result
  } catch {
    return {
      github_repo: DEFAULT_GITHUB_REPO,
      base_url: BASE_URL,
    }
  }
}

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    type: 'website',
  },
}

export default async function HomePage() {
  const [categories, recentDocs, stats, settings] = await Promise.all([
    getCategories(),
    getRecentDocs(),
    getStats(),
    getSettings(),
  ])
  
  const githubRepo = settings.github_repo || DEFAULT_GITHUB_REPO
  const baseUrl = settings.base_url || BASE_URL

  // JSON-LD structured data for homepage
  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: baseUrl,
    description: SITE_DESCRIPTION,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${baseUrl}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
    publisher: {
      '@type': 'Organization',
      name: ORG_NAME,
      url: ORG_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${baseUrl}/icon-512.png`,
      },
    },
  }

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: ORG_NAME,
    url: ORG_URL,
    logo: `${baseUrl}/icon-512.png`,
    sameAs: [
      GITHUB_ORG,
      githubRepo,
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      email: CONTACT_EMAIL,
      contactType: 'customer support',
    },
  }

  return (
    <DocsLayout categories={categories}>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />

      {/* Hero Section */}
      <div className="space-y-6 pb-8 pt-6 md:pb-12 md:pt-10">
        <div className="flex flex-col items-start gap-4">
          <Badge variant="secondary" className="rounded-lg px-3.5 py-1.5">
            <Zap className="mr-1.5 h-3.5 w-3.5" />
            MCP-Enabled
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl text-balance">
            The AI-Native Documentation Platform
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground text-pretty">
            A modern documentation hub with full MCP integration. Connect AI agents,
            submit content from any source, and discover knowledge through natural
            language search.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href="/docs">
            <Button size="lg" className="gap-2">
              <Book className="h-4 w-4" />
              Browse Docs
            </Button>
          </Link>
          <Link href="/docs/api">
            <Button variant="outline" size="lg" className="gap-2">
              <Code className="h-4 w-4" />
              API Reference
            </Button>
          </Link>
          <Link href="/submit">
            <Button variant="outline" size="lg" className="gap-2">
              <FileText className="h-4 w-4" />
              Submit Content
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3 my-8">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Documents</CardDescription>
            <CardTitle className="text-3xl">{stats.documents}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Published documentation pages</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Submissions</CardDescription>
            <CardTitle className="text-3xl">{stats.submissions}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Content submissions received</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sources</CardDescription>
            <CardTitle className="text-3xl">{stats.sources}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Unique content sources</p>
          </CardContent>
        </Card>
      </div>

      {/* Features */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 my-12">
        <Card className="border-2">
          <CardHeader>
            <Bot className="h-10 w-10 text-primary mb-2" />
            <CardTitle>MCP Integration</CardTitle>
            <CardDescription>
              Full Model Context Protocol support. Connect Claude, GPT, or any
              MCP-compatible AI agent directly to your docs.
            </CardDescription>
          </CardHeader>
        </Card>
        <Card className="border-2">
          <CardHeader>
            <Globe className="h-10 w-10 text-primary mb-2" />
            <CardTitle>Multi-Source Submissions</CardTitle>
            <CardDescription>
              Accept content from any external source with unique identifiers.
              Perfect for aggregating community knowledge.
            </CardDescription>
          </CardHeader>
        </Card>
        <Card className="border-2">
          <CardHeader>
            <Terminal className="h-10 w-10 text-primary mb-2" />
            <CardTitle>Full REST API</CardTitle>
            <CardDescription>
              Complete CRUD API with search, webhooks, and versioning.
              Integrate with any workflow or automation.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Recent Documents */}
      {recentDocs.length > 0 && (
        <div className="my-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Recent Documentation</h2>
            <Link href="/docs">
              <Button variant="ghost" className="gap-1">
                View all
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {recentDocs.map((doc) => (
              <Link key={doc.id} href={`/docs/${doc.slug}`}>
                <Card className="h-full hover:bg-accent/50 transition-colors group">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          {doc.emoji_summary && (
                            <span className="text-lg" title="Content summary">{doc.emoji_summary}</span>
                          )}
                          <CardTitle className="line-clamp-1 group-hover:text-primary transition-colors">{doc.title}</CardTitle>
                        </div>
                        <CardDescription className="line-clamp-2">
                          {doc.description || 'No description available'}
                        </CardDescription>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex-shrink-0" />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      {doc.category && (
                        <Badge variant="outline">{doc.category}</Badge>
                      )}
                      {doc.source_identifier && (
                        <Badge variant="secondary" className="text-xs">
                          {doc.source_identifier}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* MCP Quick Start */}
      <Card className="my-12 border-2 border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Quick Start: Connect Your AI Agent
          </CardTitle>
          <CardDescription>
            Use the MCP endpoint to connect any compatible AI agent
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4 font-mono text-sm overflow-x-auto">
            <pre>{`# MCP Connection
curl -X POST ${baseUrl}/api/mcp \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}'

# Or use the REST API
curl "${baseUrl}/api/v1/documents" \\
  -H "Authorization: Bearer your_api_key"`}</pre>
          </div>
          <div className="flex gap-3">
            <Link href="/docs/mcp">
              <Button variant="outline" size="sm">
                MCP Documentation
              </Button>
            </Link>
            <Link href="/docs/api">
              <Button variant="outline" size="sm">
                API Reference
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Clone & Deploy Banner */}
      <Card className="my-12 border-2 border-dashed">
        <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6">
          <div className="flex items-center gap-4">
            <Github className="h-8 w-8 text-muted-foreground" />
            <div>
              <h3 className="font-semibold">Deploy Your Own Instance</h3>
              <p className="text-sm text-muted-foreground">
                Clone this open-source project and deploy to Vercel in minutes
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href={githubRepo} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="gap-2">
                <Github className="h-4 w-4" />
                Clone Repo
              </Button>
            </Link>
            <Link 
              href={`https://vercel.com/new/clone?repository-url=${encodeURIComponent(githubRepo)}`}
              target="_blank" 
              rel="noopener noreferrer"
            >
              <Button className="gap-2">
                Deploy to Vercel
                <ExternalLink className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Footer CTA */}
      <div className="my-12 text-center space-y-4">
        <h2 className="text-2xl font-bold">Ready to contribute?</h2>
        <p className="text-muted-foreground">
          Submit your documentation, blog posts, or tutorials from any source.
        </p>
        <Link href="/submit">
          <Button size="lg" className="gap-2">
            <FileText className="h-4 w-4" />
            Submit Content
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </DocsLayout>
  )
}
