import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MarkdownRenderer } from '@/components/markdown-renderer'

describe('MarkdownRenderer', () => {
  it('renders without throwing a URIError when given a malformed URI', () => {
    const malformedUrls = [
      '%',
      '%2',
      '%2G',
      'https://example.com/%E0%A4%A',
      'foo%81'
    ]

    for (const url of malformedUrls) {
      expect(() => {
        render(<MarkdownRenderer content={`[malformed](${url})`} />)
      }).not.toThrow()
    }
  })
})
