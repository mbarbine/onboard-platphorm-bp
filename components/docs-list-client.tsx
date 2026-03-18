'use client'

import { useState, useMemo, useRef } from 'react'
import Link from 'next/link'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FileText, Calendar, User, Search, Filter, X } from 'lucide-react'

interface DocItem {
  id: string
  slug: string
  title: string
  description: string | null
  category: string | null
  tags: string[]
  author_name: string | null
  source_identifier: string | null
  published_at: Date | null
  created_at: Date
  target_audience: string | null
}

interface CategoryItem {
  slug: string
  name: string
  description: string | null
  icon: string | null
  document_count: number
}

interface DocsListClientProps {
  documents: DocItem[]
  categories: CategoryItem[]
}

const AUDIENCE_LABELS: Record<string, string> = {
  developers: 'Developers',
  beginners: 'Beginners',
  designers: 'Designers',
  business: 'Business Users',
  everyone: 'Everyone',
}

function groupByCategory(docs: DocItem[]): Record<string, DocItem[]> {
  const grouped: Record<string, DocItem[]> = {}
  for (const doc of docs) {
    const category = doc.category || 'Uncategorized'
    if (!grouped[category]) {
      grouped[category] = []
    }
    grouped[category].push(doc)
  }
  return grouped
}

export function DocsListClient({ documents, categories }: DocsListClientProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const inputRef = useRef<HTMLInputElement>(null)
  const [selectedAudience, setSelectedAudience] = useState('all')

  const audienceOptions = useMemo(() => {
    const audiences = new Set<string>()
    for (const doc of documents) {
      if (doc.target_audience) {
        audiences.add(doc.target_audience)
      }
    }
    return Array.from(audiences).sort()
  }, [documents])

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matchesTitle = doc.title?.toLowerCase().includes(q)
        const matchesDescription = doc.description?.toLowerCase().includes(q)
        const matchesTags = doc.tags?.some((tag) => tag.toLowerCase().includes(q))
        const matchesAuthor = doc.author_name?.toLowerCase().includes(q)
        const matchesSource = doc.source_identifier?.toLowerCase().includes(q)
        if (!matchesTitle && !matchesDescription && !matchesTags && !matchesAuthor && !matchesSource) {
          return false
        }
      }

      // Category filter
      if (selectedCategory !== 'all') {
        if ((doc.category || 'Uncategorized') !== selectedCategory) {
          return false
        }
      }

      // Audience filter
      if (selectedAudience !== 'all') {
        if (doc.target_audience !== selectedAudience) {
          return false
        }
      }

      return true
    })
  }, [documents, searchQuery, selectedCategory, selectedAudience])

  const groupedDocs = groupByCategory(filteredDocuments)
  const categoryNames = Object.keys(groupedDocs).sort((a, b) => {
    if (a === 'Uncategorized') return 1
    if (b === 'Uncategorized') return -1
    return a.localeCompare(b)
  })

  const hasActiveFilters = searchQuery || selectedCategory !== 'all' || selectedAudience !== 'all'

  return (
    <>
      {/* Filter bar */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Search docs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('')
                inputRef.current?.focus()
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[160px]">
              <Filter className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.slug} value={cat.slug}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {audienceOptions.length > 0 && (
            <Select value={selectedAudience} onValueChange={setSelectedAudience}>
              <SelectTrigger className="w-[160px]">
                <User className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue placeholder="Audience" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Audiences</SelectItem>
                {audienceOptions.map((audience) => (
                  <SelectItem key={audience} value={audience}>
                    {AUDIENCE_LABELS[audience] || audience}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Results */}
      {filteredDocuments.length === 0 ? (
        <Card className="mt-8">
          <CardHeader className="text-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <CardTitle>
              {hasActiveFilters ? 'No matching documents' : 'No documentation yet'}
            </CardTitle>
            <CardDescription>
              {hasActiveFilters ? (
                <>
                  Try adjusting your search or filters.{' '}
                  <button
                    onClick={() => {
                      setSearchQuery('')
                      setSelectedCategory('all')
                      setSelectedAudience('all')
                    }}
                    className="text-primary underline"
                  >
                    Clear all filters
                  </button>
                </>
              ) : (
                <>
                  Documentation pages will appear here once they are published.
                  <br />
                  <Link href="/submit" className="text-primary underline mt-2 inline-block">
                    Submit content to get started
                  </Link>
                </>
              )}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="mt-6 space-y-10">
          {hasActiveFilters && (
            <p className="text-sm text-muted-foreground">
              Showing {filteredDocuments.length} of {documents.length} document{documents.length !== 1 ? 's' : ''}
            </p>
          )}
          {categoryNames.map((categoryName) => (
            <div key={categoryName} id={`category-${categoryName}`}>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                {categoryName}
                <Badge variant="secondary" className="font-normal">
                  {groupedDocs[categoryName].length}
                </Badge>
              </h2>
              <div className="grid gap-3">
                {groupedDocs[categoryName].map((doc) => (
                  <Link key={doc.id} href={`/docs/${doc.slug}`}>
                    <Card className="hover:bg-accent/50 transition-colors">
                      <CardHeader className="py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1 min-w-0">
                            <CardTitle className="text-base font-medium line-clamp-1">
                              {doc.title}
                            </CardTitle>
                            {doc.description && (
                              <CardDescription className="line-clamp-1">
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
                        {(doc.tags && doc.tags.length > 0) || doc.source_identifier || doc.target_audience ? (
                          <div className="flex flex-wrap items-center gap-1.5 pt-2">
                            {doc.source_identifier && (
                              <Badge variant="outline" className="text-xs">
                                {doc.source_identifier}
                              </Badge>
                            )}
                            {doc.target_audience && (
                              <Badge variant="outline" className="text-xs">
                                {AUDIENCE_LABELS[doc.target_audience] || doc.target_audience}
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
            </div>
          ))}
        </div>
      )}
    </>
  )
}
