import { describe, it, expect } from 'vitest'
import { generateSimpleSlug, titleFromUrl } from '@/lib/auto-name'

describe('generateSimpleSlug', () => {
  it('converts title to lowercase hyphenated slug', () => {
    const slug = generateSimpleSlug('Getting Started with React')
    expect(slug).toMatch(/^getting-started-with-react-[a-f0-9]{4}$/)
  })

  it('appends a 4-char hex suffix for uniqueness', () => {
    const slug = generateSimpleSlug('My Doc')
    const parts = slug.split('-')
    const suffix = parts[parts.length - 1]
    expect(suffix).toMatch(/^[a-f0-9]{4}$/)
  })

  it('generates different slugs for the same title (random suffix)', () => {
    const slug1 = generateSimpleSlug('Same Title')
    const slug2 = generateSimpleSlug('Same Title')
    // The base will be the same, but the suffix should (almost always) differ
    expect(slug1.startsWith('same-title-')).toBe(true)
    expect(slug2.startsWith('same-title-')).toBe(true)
    // Extremely unlikely (1/65536) to collide
  })

  it('strips special characters', () => {
    const slug = generateSimpleSlug('Hello, World! @#$%^&*()')
    expect(slug).toMatch(/^hello-world-[a-f0-9]{4}$/)
  })

  it('collapses multiple hyphens', () => {
    const slug = generateSimpleSlug('A -- B --- C')
    expect(slug).toMatch(/^a-b-c-[a-f0-9]{4}$/)
  })

  it('removes leading and trailing hyphens from the base', () => {
    const slug = generateSimpleSlug('---Leading and Trailing---')
    expect(slug).toMatch(/^leading-and-trailing-[a-f0-9]{4}$/)
  })

  it('truncates long titles to max 72 chars base', () => {
    const longTitle = 'A'.repeat(200)
    const slug = generateSimpleSlug(longTitle)
    // base (72) + '-' (1) + suffix (4) = 77
    expect(slug.length).toBeLessThanOrEqual(77)
  })

  it('handles empty string title', () => {
    const slug = generateSimpleSlug('')
    expect(slug).toMatch(/^doc-[a-f0-9]{4}$/)
  })

  it('handles title with only special characters', () => {
    const slug = generateSimpleSlug('!@#$%')
    expect(slug).toMatch(/^doc-[a-f0-9]{4}$/)
  })

  it('handles unicode characters', () => {
    const slug = generateSimpleSlug('Café au Lait')
    expect(slug).toMatch(/^caf-au-lait-[a-f0-9]{4}$/)
  })

  it('preserves digits in title', () => {
    const slug = generateSimpleSlug('Top 10 Tips')
    expect(slug).toMatch(/^top-10-tips-[a-f0-9]{4}$/)
  })

  it('handles single word title', () => {
    const slug = generateSimpleSlug('Introduction')
    expect(slug).toMatch(/^introduction-[a-f0-9]{4}$/)
  })
})

describe('titleFromUrl', () => {
  it('extracts readable title from URL path', () => {
    expect(titleFromUrl('https://example.com/blog/my-cool-post')).toBe('My Cool Post')
  })

  it('handles URL with file extension', () => {
    expect(titleFromUrl('https://example.com/docs/guide.html')).toBe('Guide')
  })

  it('handles URL with underscores', () => {
    expect(titleFromUrl('https://example.com/getting_started')).toBe('Getting Started')
  })

  it('returns Untitled for root URL', () => {
    expect(titleFromUrl('https://example.com/')).toBe('Untitled')
  })

  it('returns Untitled for invalid URL', () => {
    expect(titleFromUrl('not-a-url')).toBe('Untitled')
  })

  it('handles nested path', () => {
    expect(titleFromUrl('https://example.com/docs/api/authentication')).toBe('Authentication')
  })

  it('handles URL with query string', () => {
    const title = titleFromUrl('https://example.com/docs/setup?v=2')
    expect(title).toBe('Setup')
  })

  it('capitalizes each word', () => {
    const title = titleFromUrl('https://example.com/quick-start-guide')
    expect(title).toBe('Quick Start Guide')
  })
})
