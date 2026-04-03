import { sql, DEFAULT_TENANT_ID, Document, Category } from '@/lib/db'
import { getCategories } from '@/lib/data'
import { DocsLayout } from '@/components/docs-layout'
import { DocsListClient } from '@/components/docs-list-client'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Documentation',
  description: 'Browse all published documentation pages, organized by category. Find guides, API references, tutorials, and more.',
}

async function getDocuments(): Promise<Document[]> {
  try {
    const docs = await sql`
      SELECT id, slug, title, description, category, tags, author_name, source_identifier, published_at, created_at, target_audience
      FROM documents
      WHERE tenant_id = ${DEFAULT_TENANT_ID}
        AND deleted_at IS NULL
        AND status = 'published'
      ORDER BY 
        CASE WHEN category IS NULL THEN 1 ELSE 0 END,
        category,
        published_at DESC NULLS LAST
    ` as Document[]
    return docs
  } catch {
    return []
  }
}

export default async function DocsPage() {
  const [categories, documents] = await Promise.all([
    getCategories(),
    getDocuments(),
  ])

  const serializedDocs = documents.map((doc) => ({
    id: doc.id,
    slug: doc.slug,
    title: doc.title,
    description: doc.description,
    category: doc.category,
    tags: doc.tags || [],
    author_name: doc.author_name,
    source_identifier: doc.source_identifier,
    published_at: doc.published_at,
    created_at: doc.created_at,
    target_audience: doc.target_audience,
  }))

  const serializedCategories = categories.map((cat) => ({
    slug: cat.slug,
    name: cat.name,
    description: cat.description,
    icon: cat.icon,
    document_count: cat.document_count,
  }))

  return (
    <DocsLayout categories={categories}>
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Documentation</h1>
        <p className="text-lg text-muted-foreground">
          Browse all published documentation pages, organized by category.
        </p>
      </div>
      <DocsListClient documents={serializedDocs} categories={serializedCategories} />
    </DocsLayout>
  )
}
