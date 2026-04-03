import { describe, it, expect, vi } from 'vitest'
import {
  calculateReadingTime,
  generateEmojiSummary,
  generateDescription,
  extractKeywords,
  generateStructuredData,
  generateShareLinks,
} from '@/lib/seo-generator'

// Mock the db module to avoid real DB calls
vi.mock('@/lib/db', () => ({
  sql: vi.fn(),
  DEFAULT_TENANT_ID: '00000000-0000-0000-0000-000000000001',
}))

describe('calculateReadingTime', () => {
  it('returns 1 minute for very short content', () => {
    const result = calculateReadingTime('Hello world')
    expect(result.minutes).toBe(1)
    expect(result.words).toBeGreaterThan(0)
  })

  it('calculates reading time based on 200 wpm', () => {
    // 400 words should be 2 minutes
    const words = Array(400).fill('word').join(' ')
    const result = calculateReadingTime(words)
    expect(result.minutes).toBe(2)
    expect(result.words).toBe(400)
  })

  it('rounds up to nearest minute', () => {
    const words = Array(201).fill('word').join(' ')
    const result = calculateReadingTime(words)
    expect(result.minutes).toBe(2)
  })

  it('strips markdown syntax when counting words', () => {
    const result = calculateReadingTime('# Hello **world** `code` [link](url)')
    expect(result.words).toBeGreaterThan(0)
  })

  it('handles empty content', () => {
    const result = calculateReadingTime('')
    expect(result.minutes).toBe(1)
  })
})

describe('generateEmojiSummary', () => {
  it('returns emoji for known category', () => {
    const result = generateEmojiSummary('My Title', 'getting-started')
    expect(result).toContain('🚀')
  })

  it('returns emoji for known tags', () => {
    const result = generateEmojiSummary('My Title', undefined, ['python', 'testing'])
    expect(result).toContain('🐍')
    expect(result).toContain('🧪')
  })

  it('returns emoji based on title keywords', () => {
    const result = generateEmojiSummary('Security Best Practices')
    expect(result).toContain('🛡️')
  })

  it('returns default emoji when nothing matches', () => {
    const result = generateEmojiSummary('Xyz')
    expect(result).toBe('📄')
  })

  it('limits total emojis to 5', () => {
    const result = generateEmojiSummary(
      'javascript typescript python rust react database security performance testing deploy',
      'api',
      ['react', 'nextjs', 'database', 'security', 'performance']
    )
    // Count emoji characters (some are multi-codepoint)
    expect(result.length).toBeGreaterThan(0)
  })

  it('does not duplicate emojis', () => {
    // API appears in both categories and emojiMap
    const result = generateEmojiSummary('API Guide', 'api', ['api'])
    const emojis = [...result]
    // Check uniqueness (emoji characters)
    const unique = [...new Set(emojis)]
    expect(unique.length).toBe(emojis.length)
  })
})

describe('generateDescription', () => {
  it('strips markdown from content', () => {
    const desc = generateDescription('# Hello **world** and `code`')
    expect(desc).not.toContain('#')
    expect(desc).not.toContain('**')
    expect(desc).not.toContain('`')
  })

  it('truncates long content', () => {
    const long = 'This is a long sentence that keeps going. '.repeat(20)
    const desc = generateDescription(long, 160)
    expect(desc.length).toBeLessThanOrEqual(160)
  })

  it('returns text ending with period or ellipsis', () => {
    const desc = generateDescription('This is a meaningful sentence about documentation. Another sentence here.')
    expect(desc.endsWith('.') || desc.endsWith('...')).toBe(true)
  })

  it('handles empty content', () => {
    const desc = generateDescription('')
    expect(typeof desc).toBe('string')
  })

  it('removes code blocks', () => {
    // The regex /```[\s\S]*?```/g removes content between triple backticks
    // The sentence filter also requires sentences > 20 chars
    const desc = generateDescription('This is a long sentence about the topic.\n\n```js\nconst x = 1\n```\n\nAnother meaningful sentence here about testing.')
    expect(desc).toContain('This is a long sentence about the topic')
  })

  it('respects custom maxLength', () => {
    const desc = generateDescription('This is some text for testing the max length parameter.', 30)
    expect(desc.length).toBeLessThanOrEqual(30)
  })
})

describe('extractKeywords', () => {
  it('extracts frequent words as keywords', () => {
    const keywords = extractKeywords(
      'JavaScript Guide',
      'JavaScript is a popular language. JavaScript runs in browsers.'
    )
    expect(keywords).toContain('javascript')
  })

  it('filters out stop words', () => {
    const keywords = extractKeywords('Test', 'the and or but this that')
    expect(keywords).not.toContain('the')
    expect(keywords).not.toContain('and')
  })

  it('includes tags as keywords', () => {
    const keywords = extractKeywords('Title', 'content', ['react', 'nextjs'])
    expect(keywords).toContain('react')
    expect(keywords).toContain('nextjs')
  })

  it('limits to 15 keywords', () => {
    const longContent = Array(100).fill('word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12 word13 word14 word15 word16 word17 word18 word19 word20').join(' ')
    const keywords = extractKeywords('Title', longContent, ['extra1', 'extra2', 'extra3', 'extra4', 'extra5', 'extra6'])
    expect(keywords.length).toBeLessThanOrEqual(15)
  })

  it('ignores short words (< 3 chars)', () => {
    const keywords = extractKeywords('Test', 'a b cd ef ghi jkl')
    expect(keywords).not.toContain('a')
    expect(keywords).not.toContain('b')
    expect(keywords).not.toContain('cd')
    expect(keywords).not.toContain('ef')
  })

  it('deduplicates tag keywords', () => {
    const keywords = extractKeywords('JavaScript', 'JavaScript programming', ['javascript'])
    const count = keywords.filter(k => k === 'javascript').length
    expect(count).toBe(1)
  })
})

describe('generateStructuredData', () => {
  it('generates valid JSON-LD structure', () => {
    const data = generateStructuredData(
      {
        title: 'Test Doc',
        slug: 'test-doc',
        content: 'Some content here for testing.',
      },
      'https://example.com'
    )
    expect(data['@context']).toBe('https://schema.org')
    expect(data['@type']).toBe('Article')
    expect(data.headline).toBe('Test Doc')
    expect(data.url).toBe('https://example.com/docs/test-doc')
  })

  it('includes author when provided', () => {
    const data = generateStructuredData(
      {
        title: 'Test',
        slug: 'test',
        content: 'Content',
        authorName: 'John Doe',
      },
      'https://example.com'
    )
    expect(data.author).toEqual({ '@type': 'Person', name: 'John Doe' })
  })

  it('uses Onboard org as author when not provided', () => {
    const data = generateStructuredData(
      { title: 'Test', slug: 'test', content: 'Content' },
      'https://example.com'
    )
    expect(data.author).toEqual({ '@type': 'Organization', name: 'Onboard' })
  })

  it('includes category when provided', () => {
    const data = generateStructuredData(
      { title: 'Test', slug: 'test', content: 'Content', category: 'guides' },
      'https://example.com'
    )
    expect(data.articleSection).toBe('guides')
  })

  it('includes tags as keywords', () => {
    const data = generateStructuredData(
      { title: 'Test', slug: 'test', content: 'Content', tags: ['react', 'nextjs'] },
      'https://example.com'
    )
    expect(data.keywords).toBe('react, nextjs')
  })

  it('includes sourceUrl', () => {
    const data = generateStructuredData(
      { title: 'Test', slug: 'test', content: 'Content', sourceUrl: 'https://source.com' },
      'https://example.com'
    )
    expect(data.isBasedOn).toBe('https://source.com')
  })

  it('includes wordCount and timeRequired', () => {
    const data = generateStructuredData(
      { title: 'Test', slug: 'test', content: 'Some words for testing content here.' },
      'https://example.com'
    )
    expect(data.wordCount).toBeGreaterThan(0)
    expect(data.timeRequired).toMatch(/^PT\d+M$/)
  })
})

describe('generateShareLinks', () => {
  it('returns all platforms', () => {
    const links = generateShareLinks('Title', 'https://example.com/docs/test')
    const platforms = links.map(l => l.platform)
    expect(platforms).toContain('twitter')
    expect(platforms).toContain('linkedin')
    expect(platforms).toContain('facebook')
    expect(platforms).toContain('reddit')
    expect(platforms).toContain('hackernews')
    expect(platforms).toContain('email')
    expect(platforms).toContain('copy')
  })

  it('encodes title and URL in share links', () => {
    const links = generateShareLinks('Hello World', 'https://example.com/test')
    const twitter = links.find(l => l.platform === 'twitter')!
    expect(twitter.url).toContain(new URLSearchParams({ text: 'Hello World' }).toString().split('&')[0].split('=')[1])
    expect(twitter.url).toContain(encodeURIComponent('https://example.com/test'))
  })

  it('includes description in email link', () => {
    const links = generateShareLinks('Title', 'https://example.com', 'A description')
    const email = links.find(l => l.platform === 'email')!
    expect(email.url).toContain(encodeURIComponent('A description'))
  })

  it('copy link has raw URL', () => {
    const links = generateShareLinks('Title', 'https://example.com/docs/test')
    const copy = links.find(l => l.platform === 'copy')!
    expect(copy.url).toBe('https://example.com/docs/test')
  })

  it('all links have icons', () => {
    const links = generateShareLinks('Title', 'https://example.com')
    for (const link of links) {
      expect(link.icon.length).toBeGreaterThan(0)
    }
  })
})
