import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DocsListClient } from '@/components/docs-list-client'

// Mock next/link since it needs router context
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

const mockDocuments = [
  {
    id: '1',
    slug: 'api-guide',
    title: 'API Guide',
    description: 'How to use the API',
    category: 'api',
    tags: ['rest', 'http'],
    author_name: 'Alice',
    source_identifier: 'example.com',
    published_at: new Date('2026-01-01'),
    created_at: new Date('2026-01-01'),
    target_audience: 'developers',
  },
  {
    id: '2',
    slug: 'getting-started',
    title: 'Getting Started',
    description: 'A beginners guide',
    category: 'guides',
    tags: ['intro', 'tutorial'],
    author_name: 'Bob',
    source_identifier: 'docs.example.com',
    published_at: new Date('2026-01-02'),
    created_at: new Date('2026-01-02'),
    target_audience: 'beginners',
  },
  {
    id: '3',
    slug: 'design-system',
    title: 'Design System',
    description: 'Component library overview',
    category: 'api',
    tags: ['design', 'components'],
    author_name: 'Charlie',
    source_identifier: null,
    published_at: new Date('2026-01-03'),
    created_at: new Date('2026-01-03'),
    target_audience: null,
  },
]

const mockCategories = [
  { slug: 'api', name: 'API', description: 'API docs', icon: null, document_count: 2 },
  { slug: 'guides', name: 'Guides', description: 'User guides', icon: null, document_count: 1 },
]

describe('DocsListClient', () => {
  it('renders all documents grouped by category', () => {
    render(<DocsListClient documents={mockDocuments} categories={mockCategories} />)

    expect(screen.getByText('API Guide')).toBeDefined()
    expect(screen.getByText('Getting Started')).toBeDefined()
    expect(screen.getByText('Design System')).toBeDefined()
  })

  it('shows the search input', () => {
    render(<DocsListClient documents={mockDocuments} categories={mockCategories} />)

    expect(screen.getByPlaceholderText('Search docs...')).toBeDefined()
  })

  it('filters documents by search query', () => {
    render(<DocsListClient documents={mockDocuments} categories={mockCategories} />)

    const searchInput = screen.getByPlaceholderText('Search docs...')
    fireEvent.change(searchInput, { target: { value: 'API' } })

    expect(screen.getByText('API Guide')).toBeDefined()
    expect(screen.queryByText('Getting Started')).toBeNull()
  })

  it('filters documents by tag search', () => {
    render(<DocsListClient documents={mockDocuments} categories={mockCategories} />)

    const searchInput = screen.getByPlaceholderText('Search docs...')
    fireEvent.change(searchInput, { target: { value: 'tutorial' } })

    expect(screen.getByText('Getting Started')).toBeDefined()
    expect(screen.queryByText('API Guide')).toBeNull()
    expect(screen.queryByText('Design System')).toBeNull()
  })

  it('filters documents by author search', () => {
    render(<DocsListClient documents={mockDocuments} categories={mockCategories} />)

    const searchInput = screen.getByPlaceholderText('Search docs...')
    fireEvent.change(searchInput, { target: { value: 'Alice' } })

    expect(screen.getByText('API Guide')).toBeDefined()
    expect(screen.queryByText('Getting Started')).toBeNull()
  })

  it('shows empty state when search returns no results', () => {
    render(<DocsListClient documents={mockDocuments} categories={mockCategories} />)

    const searchInput = screen.getByPlaceholderText('Search docs...')
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } })

    expect(screen.getByText('No matching documents')).toBeDefined()
    expect(screen.getByText('Clear all filters')).toBeDefined()
  })

  it('shows empty state when no documents exist', () => {
    render(<DocsListClient documents={[]} categories={[]} />)

    expect(screen.getByText('No documentation yet')).toBeDefined()
  })

  it('displays target audience badge when present', () => {
    render(<DocsListClient documents={mockDocuments} categories={mockCategories} />)

    expect(screen.getByText('Developers')).toBeDefined()
    expect(screen.getByText('Beginners')).toBeDefined()
  })

  it('displays source identifier badge', () => {
    render(<DocsListClient documents={mockDocuments} categories={mockCategories} />)

    expect(screen.getByText('example.com')).toBeDefined()
    expect(screen.getByText('docs.example.com')).toBeDefined()
  })

  it('displays document tags', () => {
    render(<DocsListClient documents={mockDocuments} categories={mockCategories} />)

    expect(screen.getByText('rest')).toBeDefined()
    expect(screen.getByText('http')).toBeDefined()
    expect(screen.getByText('intro')).toBeDefined()
  })

  it('shows result count when filters are active', () => {
    render(<DocsListClient documents={mockDocuments} categories={mockCategories} />)

    const searchInput = screen.getByPlaceholderText('Search docs...')
    fireEvent.change(searchInput, { target: { value: 'API' } })

    expect(screen.getByText(/Showing 1 of 3 documents/)).toBeDefined()
  })

  it('renders links to individual doc pages', () => {
    render(<DocsListClient documents={mockDocuments} categories={mockCategories} />)

    const links = screen.getAllByRole('link')
    const docLinks = links.filter((l) => l.getAttribute('href')?.startsWith('/docs/'))
    expect(docLinks.length).toBe(3)
    expect(docLinks.map((l) => l.getAttribute('href'))).toContain('/docs/api-guide')
    expect(docLinks.map((l) => l.getAttribute('href'))).toContain('/docs/getting-started')
    expect(docLinks.map((l) => l.getAttribute('href'))).toContain('/docs/design-system')
  })
})
