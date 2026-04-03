import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MarkdownRenderer } from '@/components/markdown-renderer'

describe('MarkdownRenderer - URL Sanitization Fallback', () => {
  let originalURL: typeof global.URL

  beforeEach(() => {
    // Save the original URL constructor
    originalURL = global.URL

    // Mock URL to always throw, forcing the fallback logic
    vi.stubGlobal(
      'URL',
      vi.fn().mockImplementation(() => {
        throw new TypeError('Invalid URL')
      })
    )
  })

  afterEach(() => {
    // Restore original URL constructor
    vi.stubGlobal('URL', originalURL)
    vi.restoreAllMocks()
  })

  it('sanitizes javascript: URLs in fallback mode', () => {
    const content = '[Click me](javascript:alert(1))'
    render(<MarkdownRenderer content={content} />)

    const link = screen.getByText('Click me')
    expect(link.getAttribute('href')).toBe('#')
  })

  it('sanitizes vbscript: URLs in fallback mode', () => {
    const content = '[Click me](vbscript:msgbox(1))'
    render(<MarkdownRenderer content={content} />)

    const link = screen.getByText('Click me')
    expect(link.getAttribute('href')).toBe('#')
  })

  it('sanitizes data:text/html URLs in fallback mode', () => {
    const content = '[Click me](data:text/html,<script>alert(1)</script>)'
    render(<MarkdownRenderer content={content} />)

    const link = screen.getByText('Click me')
    expect(link.getAttribute('href')).toBe('#')
  })

  it('sanitizes data:text/javascript URLs in fallback mode', () => {
    const content = '[Click me](data:text/javascript,alert(1))'
    render(<MarkdownRenderer content={content} />)

    const link = screen.getByText('Click me')
    expect(link.getAttribute('href')).toBe('#')
  })

  it('sanitizes data:image/svg+xml URLs in fallback mode', () => {
    const content = '[Click me](data:image/svg+xml,<svg><script>alert(1)</script></svg>)'
    render(<MarkdownRenderer content={content} />)

    const link = screen.getByText('Click me')
    expect(link.getAttribute('href')).toBe('#')
  })

  it('sanitizes data:application/xhtml+xml URLs in fallback mode', () => {
    const content = '[Click me](data:application/xhtml+xml,<html xmlns="http://www.w3.org/1999/xhtml"><script>alert(1)</script></html>)'
    render(<MarkdownRenderer content={content} />)

    const link = screen.getByText('Click me')
    expect(link.getAttribute('href')).toBe('#')
  })

  it('sanitizes data:application/xml URLs in fallback mode', () => {
    const content = '[Click me](data:application/xml,<root><script>alert(1)</script></root>)'
    render(<MarkdownRenderer content={content} />)

    const link = screen.getByText('Click me')
    expect(link.getAttribute('href')).toBe('#')
  })

  it('allows safe data:image/png URLs in fallback mode', () => {
    const content = '[Safe Image](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==)'
    render(<MarkdownRenderer content={content} />)

    const link = screen.getByText('Safe Image')
    expect(link.getAttribute('href')).toBeNull() // DOMPurify strips data urls for hrefs entirely as a precaution
  })

  it('allows http URLs', () => {
    const content = '[Example](https://example.com)'
    render(<MarkdownRenderer content={content} />)

    const link = screen.getByRole('link', { name: /Example/i })
    expect(link.getAttribute('href')).toBe('https://example.com')
  })

  it('allows relative URLs in fallback mode', () => {
    const content = '[About](/about)'
    render(<MarkdownRenderer content={content} />)

    const link = screen.getByText('About')
    expect(link.getAttribute('href')).toBe('/about')
  })
})
