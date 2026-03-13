import Link from 'next/link'
import { sql, DEFAULT_TENANT_ID, Document, Category } from '@/lib/db'
import { DocsLayout } from '@/components/docs-layout'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, FileText } from 'lucide-react'

interface SearchPageProps {
  searchParams: Promise<{ q?: string; page?: string }>
}

export const metadata = {
  title: 'Search',
  description: 'Search across all OpenDocs documentation. Find guides, API references, tutorials, and community-contributed content using full-text search.',
}

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

async function searchDocuments(query: string, page: number = 1) {
  if (!query || query.length < 2) return { results: [], total: 0 }
  
  const perPage = 20
  const offset = (page - 1) * perPage

  try {
    const results = await sql`
      SELECT 
        d.id, d.slug, d.title, d.description, d.category, d.tags, d.author_name, d.source_identifier,
        ts_headline('english', d.content, plainto_tsquery('english', ${query}), 
          'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=25') as headline,
        ts_rank(si.content_vector, plainto_tsquery('english', ${query})) as rank
      FROM documents d
      JOIN search_index si ON d.id = si.document_id
      WHERE d.tenant_id = ${DEFAULT_TENANT_ID}
        AND d.deleted_at IS NULL
        AND d.status = 'published'
        AND si.content_vector @@ plainto_tsquery('english', ${query})
      ORDER BY rank DESC
      LIMIT ${perPage} OFFSET ${offset}
    ` as (Document & { headline: string; rank: number })[]

    const totalResult = await sql`
      SELECT COUNT(*)::int as count
      FROM documents d
      JOIN search_index si ON d.id = si.document_id
      WHERE d.tenant_id = ${DEFAULT_TENANT_ID}
        AND d.deleted_at IS NULL
        AND d.status = 'published'
        AND si.content_vector @@ plainto_tsquery('english', ${query})
    ` as { count: number }[]

    return {
      results,
      total: totalResult[0]?.count || 0,
    }
  } catch (error) {
    console.error('Search error:', error)
    return { results: [], total: 0 }
  }
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q: query, page: pageParam } = await searchParams
  const page = parseInt(pageParam || '1', 10)
  
  const [categories, searchResults] = await Promise.all([
    getCategories(),
    query ? searchDocuments(query, page) : Promise.resolve({ results: [], total: 0 }),
  ])

  const { results, total } = searchResults
  const totalPages = Math.ceil(total / 20)

  return (
    <DocsLayout categories={categories}>
      <div className="space-y-2 mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Search Documentation</h1>
        <p className="text-lg text-muted-foreground">
          Find what you&apos;re looking for across all documentation.
        </p>
      </div>

      {/* Search form */}
      <form action="/search" method="GET" className="mb-8">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              name="q"
              placeholder="Search docs..."
              defaultValue={query}
              className="pl-10"
              autoFocus
            />
          </div>
          <Button type="submit">Search</Button>
        </div>
      </form>

      {/* Results */}
      {query ? (
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            {total > 0 ? (
              <>
                Found <strong>{total}</strong> result{total !== 1 ? 's' : ''} for &quot;<strong>{query}</strong>&quot;
              </>
            ) : (
              <>No results found for &quot;<strong>{query}</strong>&quot;</>
            )}
          </p>

          {results.length > 0 ? (
            <div className="space-y-4">
              {results.map((doc) => (
                <Link key={doc.id} href={`/docs/${doc.slug}`}>
                  <Card className="hover:bg-accent/50 transition-colors">
                    <CardHeader>
                      <div className="space-y-2">
                        <CardTitle className="text-lg">{doc.title}</CardTitle>
                        {doc.description && (
                          <CardDescription>{doc.description}</CardDescription>
                        )}
                        {doc.headline && (
                          <div className="text-sm text-muted-foreground [&_mark]:bg-yellow-200 [&_mark]:text-foreground dark:[&_mark]:bg-yellow-800">
                            ...
                            {doc.headline.split(/(<mark>.*?<\/mark>)/g).map((part, index) => {
                              if (part.startsWith('<mark>') && part.endsWith('</mark>')) {
                                return (
                                  <mark key={index}>
                                    {part.slice(6, -7)}
                                  </mark>
                                )
                              }
                              return <span key={index}>{part}</span>
                            })}
                            ...
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {doc.category && (
                            <Badge variant="outline">{doc.category}</Badge>
                          )}
                          {doc.source_identifier && (
                            <Badge variant="secondary" className="text-xs">
                              {doc.source_identifier}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card>
              <CardHeader className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <CardTitle>No results found</CardTitle>
                <CardDescription>
                  Try adjusting your search terms or browse the documentation.
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              {page > 1 && (
                <Link href={`/search?q=${encodeURIComponent(query)}&page=${page - 1}`}>
                  <Button variant="outline" size="sm">Previous</Button>
                </Link>
              )}
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              {page < totalPages && (
                <Link href={`/search?q=${encodeURIComponent(query)}&page=${page + 1}`}>
                  <Button variant="outline" size="sm">Next</Button>
                </Link>
              )}
            </div>
          )}
        </div>
      ) : (
        <Card>
          <CardHeader className="text-center py-12">
            <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <CardTitle>Enter a search query</CardTitle>
            <CardDescription>
              Search across all documentation to find what you need.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </DocsLayout>
  )
}
