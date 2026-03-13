import { notFound } from 'next/navigation'
import Link from 'next/link'
import { sql, DEFAULT_TENANT_ID, Document, Category } from '@/lib/db'
import { DocsLayout } from '@/components/docs-layout'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronLeft, Calendar, User, FileText } from 'lucide-react'
import { SITE_NAME } from '@/lib/site-config'

interface PageProps {
  params: Promise<{ slug: string }>
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

async function getCategory(slug: string): Promise<Category | null> {
  try {
    const categories = await sql`
      SELECT * FROM categories
      WHERE tenant_id = ${DEFAULT_TENANT_ID}
        AND slug = ${slug}
    ` as Category[]
    return categories[0] || null
  } catch {
    return null
  }
}

async function getDocumentsByCategory(categorySlug: string): Promise<Document[]> {
  try {
    const docs = await sql`
      SELECT id, slug, title, description, category, tags, author_name, source_identifier, published_at
      FROM documents
      WHERE tenant_id = ${DEFAULT_TENANT_ID}
        AND category = ${categorySlug}
        AND deleted_at IS NULL
        AND status = 'published'
      ORDER BY published_at DESC NULLS LAST
    ` as Document[]
    return docs
  } catch {
    return []
  }
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const category = await getCategory(slug)
  
  if (!category) {
    return { title: 'Category Not Found' }
  }

  return {
    title: category.name,
    description: category.description || `Browse all documentation pages in the ${category.name} category on ${SITE_NAME}.`,
  }
}

export default async function CategoryPage({ params }: PageProps) {
  const { slug } = await params
  const [categories, category, documents] = await Promise.all([
    getCategories(),
    getCategory(slug),
    getDocumentsByCategory(slug),
  ])

  if (!category) {
    notFound()
  }

  return (
    <DocsLayout categories={categories}>
      {/* Back link */}
      <div className="mb-6">
        <Link href="/docs">
          <Button variant="ghost" size="sm" className="gap-1 -ml-2">
            <ChevronLeft className="h-4 w-4" />
            All documentation
          </Button>
        </Link>
      </div>

      <div className="space-y-2 mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{category.name}</h1>
        {category.description && (
          <p className="text-lg text-muted-foreground">{category.description}</p>
        )}
        <p className="text-sm text-muted-foreground">
          {documents.length} document{documents.length !== 1 ? 's' : ''} in this category
        </p>
      </div>

      {documents.length === 0 ? (
        <Card>
          <CardHeader className="text-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <CardTitle>No documents yet</CardTitle>
            <CardDescription>
              No documentation has been published in this category yet.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4">
          {documents.map((doc) => (
            <Link key={doc.id} href={`/docs/${doc.slug}`}>
              <Card className="hover:bg-accent/50 transition-colors">
                <CardHeader className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <CardTitle className="text-base font-medium line-clamp-1">
                        {doc.title}
                      </CardTitle>
                      {doc.description && (
                        <CardDescription className="line-clamp-2">
                          {doc.description}
                        </CardDescription>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                      {doc.author_name && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {doc.author_name}
                        </span>
                      )}
                      {doc.published_at && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(doc.published_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  {(doc.tags && doc.tags.length > 0) || doc.source_identifier ? (
                    <div className="flex flex-wrap items-center gap-1.5 pt-2">
                      {doc.source_identifier && (
                        <Badge variant="outline" className="text-xs">
                          {doc.source_identifier}
                        </Badge>
                      )}
                      {doc.tags?.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </DocsLayout>
  )
}
