import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Metadata } from 'next'
import { sql, DEFAULT_TENANT_ID, Document, Category } from '@/lib/db'
import { extractFAQFromContent } from '@/lib/seo-generator'
import { SITE_NAME, ORG_NAME } from '@/lib/site-config'
import { DocsLayout } from '@/components/docs-layout'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ShareButtons } from '@/components/share-buttons'
import {
  Calendar,
  User,
  ExternalLink,
  ChevronLeft,
  Tag,
  Clock,
  BookOpen,
  FileText,
} from 'lucide-react'

interface PageProps {
  params: Promise<{ slug: string }>
}

async function getBaseUrl(): Promise<string> {
  try {
    const result = await sql`SELECT value FROM settings WHERE tenant_id = ${DEFAULT_TENANT_ID} AND key = 'base_url'`
    if (result[0]?.value) return JSON.parse(result[0].value as string)
  } catch { /* ignore */ }
  return 'https://docs.platphormnews.com'
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

async function getDocument(slug: string): Promise<Document | null> {
  try {
    const docs = await sql`
      SELECT * FROM documents
      WHERE tenant_id = ${DEFAULT_TENANT_ID}
        AND slug = ${slug}
        AND deleted_at IS NULL
    ` as Document[]
    return docs[0] || null
  } catch {
    return null
  }
}

async function getRelatedDocs(category: string | null, currentId: string, tags: string[] | null): Promise<Document[]> {
  if (!category && (!tags || tags.length === 0)) return []
  try {
    const docs = await sql`
      SELECT id, slug, title, description, emoji_summary, reading_time_minutes
      FROM documents
      WHERE tenant_id = ${DEFAULT_TENANT_ID}
        AND id != ${currentId}
        AND deleted_at IS NULL
        AND status = 'published'
        AND (category = ${category} ${tags && tags.length > 0 ? sql`OR tags ?| ${tags}` : sql``})
      ORDER BY 
        CASE WHEN category = ${category} THEN 0 ELSE 1 END,
        published_at DESC
      LIMIT 5
    ` as Document[]
    return docs
  } catch {
    return []
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const [doc, baseUrl] = await Promise.all([
    getDocument(slug),
    getBaseUrl(),
  ])
  
  if (!doc) {
    return { title: 'Not Found' }
  }

  const canonicalUrl = doc.canonical_url || `${baseUrl}/docs/${slug}`
  const ogImage = doc.og_image || `${baseUrl}/api/og?title=${encodeURIComponent(doc.title)}&emoji=${encodeURIComponent(doc.emoji_summary || '📄')}&category=${encodeURIComponent(doc.category || '')}`
  const description = doc.og_description || doc.description || `Read ${doc.title} on ${SITE_NAME}`

  return {
    title: doc.og_title || doc.title,
    description,
    keywords: doc.keywords || (doc.tags as string[]) || [],
    authors: doc.author_name ? [{ name: doc.author_name, url: doc.author_url || undefined }] : undefined,
    openGraph: {
      title: doc.og_title || doc.title,
      description,
      type: 'article',
      publishedTime: doc.published_at?.toString(),
      modifiedTime: doc.updated_at?.toString(),
      authors: doc.author_name ? [doc.author_name] : undefined,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: doc.title,
        },
      ],
      url: canonicalUrl,
      siteName: SITE_NAME,
      locale: 'en_US',
    },
    twitter: {
      card: (doc.twitter_card as 'summary' | 'summary_large_image') || 'summary_large_image',
      title: doc.og_title || doc.title,
      description,
      images: [ogImage],
      creator: doc.author_name ? `@${doc.author_name.replace(/\s/g, '')}` : undefined,
    },
    alternates: {
      canonical: canonicalUrl,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  }
}

export default async function DocumentPage({ params }: PageProps) {
  const { slug } = await params
  const [categories, doc, baseUrl] = await Promise.all([
    getCategories(),
    getDocument(slug),
    getBaseUrl(),
  ])

  if (!doc) {
    notFound()
  }

  const relatedDocs = await getRelatedDocs(doc.category, doc.id, doc.tags as string[] | null)

  // Use stored reading time or calculate
  const readingTime = doc.reading_time_minutes || Math.max(1, Math.ceil((doc.word_count || doc.content.split(/\s+/).length) / 200))
  const wordCount = doc.word_count || doc.content.split(/\s+/).length

  // Generate structured data
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: doc.title,
    description: doc.description || doc.og_description,
    image: doc.og_image || `${baseUrl}/api/og?title=${encodeURIComponent(doc.title)}`,
    datePublished: doc.published_at?.toString(),
    dateModified: doc.updated_at?.toString(),
    wordCount,
    timeRequired: `PT${readingTime}M`,
    author: doc.author_name ? {
      '@type': 'Person',
      name: doc.author_name,
      url: doc.author_url,
    } : {
      '@type': 'Organization',
      name: SITE_NAME,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: baseUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${baseUrl}/logo.svg`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${baseUrl}/docs/${slug}`,
    },
    articleSection: doc.category,
    keywords: (doc.tags as string[])?.join(', '),
    isBasedOn: doc.source_url,
  }

  const pageUrl = `${baseUrl}/docs/${slug}`

  // BreadcrumbList structured data for rich snippets
  const breadcrumbItems = [
    { name: 'Home', url: baseUrl },
    { name: 'Documentation', url: `${baseUrl}/docs` },
  ]
  if (doc.category) {
    breadcrumbItems.push({ name: doc.category, url: `${baseUrl}/docs/category/${doc.category}` })
  }
  breadcrumbItems.push({ name: doc.title, url: pageUrl })

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbItems.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }

  // FAQ schema from headings that are questions
  const faqEntries = extractFAQFromContent(doc.content)

  const faqSchema = faqEntries.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqEntries.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: answer,
      },
    })),
  } : null

  return (
    <DocsLayout categories={categories}>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}

      {/* Back link */}
      <div className="mb-6">
        <Link href="/docs">
          <Button variant="ghost" size="sm" className="gap-1 -ml-2">
            <ChevronLeft className="h-4 w-4" />
            Back to docs
          </Button>
        </Link>
      </div>

      {/* Article header */}
      <article>
        <header className="space-y-4 mb-8">
          <div className="flex flex-wrap items-center gap-2">
            {doc.emoji_summary && (
              <span className="text-2xl" title="Emoji Summary">{doc.emoji_summary}</span>
            )}
            {doc.category && (
              <Link href={`/docs/category/${doc.category}`}>
                <Badge variant="outline" className="hover:bg-accent">
                  {doc.category}
                </Badge>
              </Link>
            )}
            {doc.source_identifier && (
              <Badge variant="secondary">
                Source: {doc.source_identifier}
              </Badge>
            )}
            {doc.target_audience && (
              <Badge variant="secondary" className="gap-1">
                <User className="h-3 w-3" />
                {doc.target_audience}
              </Badge>
            )}
          </div>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl text-balance">
            {doc.title}
          </h1>

          {doc.description && (
            <p className="text-xl text-muted-foreground text-pretty">
              {doc.description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {doc.author_name && (
              <span className="flex items-center gap-1.5">
                <User className="h-4 w-4" />
                {doc.author_url ? (
                  <a
                    href={doc.author_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-foreground"
                  >
                    {doc.author_name}
                  </a>
                ) : (
                  doc.author_name
                )}
              </span>
            )}
            {doc.published_at && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                <time dateTime={new Date(doc.published_at).toISOString()}>
                  {new Date(doc.published_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </time>
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {readingTime} min read
            </span>
            <span className="flex items-center gap-1.5">
              <FileText className="h-4 w-4" />
              {wordCount.toLocaleString()} words
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {doc.source_url && (
              <a
                href={doc.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View original source
              </a>
            )}
            
            {/* Share Buttons */}
            <ShareButtons 
              url={pageUrl}
              title={doc.title}
              description={doc.description || ''}
            />
          </div>
        </header>

        <Separator className="my-8" />

        {/* Article content */}
        <div className="prose-container">
          <MarkdownRenderer content={doc.content} />
        </div>

        {/* Tags */}
        {doc.tags && (doc.tags as string[]).length > 0 && (
          <>
            <Separator className="my-8" />
            <div className="flex items-center gap-2 flex-wrap">
              <Tag className="h-4 w-4 text-muted-foreground" />
              {(doc.tags as string[]).map((tag) => (
                <Link key={tag} href={`/docs?tag=${encodeURIComponent(tag)}`}>
                  <Badge variant="secondary" className="hover:bg-accent">
                    {tag}
                  </Badge>
                </Link>
              ))}
            </div>
          </>
        )}

        {/* Backlinks */}
        {doc.backlinks && (doc.backlinks as { url: string; title: string }[]).length > 0 && (
          <>
            <Separator className="my-8" />
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <ExternalLink className="h-5 w-5" />
                Backlinks
              </h2>
              <div className="grid gap-2">
                {(doc.backlinks as { url: string; title: string }[]).map((link, idx) => (
                  <a
                    key={idx}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {link.title || link.url}
                  </a>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Related docs */}
        {relatedDocs.length > 0 && (
          <>
            <Separator className="my-8" />
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Related Documentation
              </h2>
              <div className="grid gap-3">
                {relatedDocs.map((related) => (
                  <Link
                    key={related.id}
                    href={`/docs/${related.slug}`}
                    className="block p-4 rounded-lg border hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      {related.emoji_summary && (
                        <span className="text-lg">{related.emoji_summary}</span>
                      )}
                      <div className="flex-1">
                        <h3 className="font-medium">{related.title}</h3>
                        {related.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                            {related.description}
                          </p>
                        )}
                        {related.reading_time_minutes && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {related.reading_time_minutes} min read
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Version info */}
        <Separator className="my-8" />
        <footer className="text-sm text-muted-foreground flex flex-wrap items-center justify-between gap-4">
          <p>
            Version {doc.version} &middot; Last updated{' '}
            <time dateTime={new Date(doc.updated_at).toISOString()}>
              {new Date(doc.updated_at).toLocaleDateString()}
            </time>
          </p>
          <ShareButtons 
            url={pageUrl}
            title={doc.title}
            description={doc.description || ''}
            compact
          />
        </footer>
      </article>
    </DocsLayout>
  )
}
