import { describe, it, expect, vi } from 'vitest'

// Mock db module to avoid requiring DATABASE_URL
vi.mock('@/lib/db', () => ({
  sql: vi.fn(),
  DEFAULT_TENANT_ID: '00000000-0000-0000-0000-000000000001',
}))

import {
  generateAEOMetadata,
  generateGEOMetadata,
  generateFullOptimization,
  extractQuestions,
  generateDirectAnswer,
  extractKeyFacts,
  extractFAQFromContent,
  type AEOMetadata,
  type GEOMetadata,
} from '@/lib/seo-generator'

// ── AEO Tests ─────────────────────────────────────────────────────────────────

describe('extractQuestions', () => {
  it('extracts explicit questions from content', () => {
    const content = '# FAQ\n\nHow do I install this package?\n\nWhat platforms are supported?'
    const questions = extractQuestions(content, 'FAQ')
    expect(questions.length).toBeGreaterThan(0)
    expect(questions.some(q => q.includes('install'))).toBe(true)
  })

  it('generates questions from headings when no explicit questions exist', () => {
    const content = '# Guide\n\n## Installation\n\nRun npm install.\n\n## Configuration\n\nEdit your config.'
    const questions = extractQuestions(content, 'Guide')
    expect(questions.length).toBeGreaterThan(0)
  })

  it('falls back to title-based question when no headings or questions exist', () => {
    const content = 'This is plain text content with no headings or questions.'
    const questions = extractQuestions(content, 'My Document')
    expect(questions).toContain('What is My Document?')
  })

  it('returns at most 5 questions', () => {
    const content = Array.from({ length: 10 }, (_, i) => `What is item ${i}?`).join('\n')
    const questions = extractQuestions(content, 'Test')
    expect(questions.length).toBeLessThanOrEqual(5)
  })

  it('filters out very short questions', () => {
    const content = 'Why?\nHow do I configure the advanced settings for this platform?'
    const questions = extractQuestions(content, 'Test')
    // "Why?" is too short (< 10 chars), should be filtered
    expect(questions.every(q => q.length > 10)).toBe(true)
  })

  it('deduplicates questions', () => {
    const content = 'How do I install? How do I install?'
    const questions = extractQuestions(content, 'Test')
    const unique = new Set(questions)
    expect(questions.length).toBe(unique.size)
  })
})

describe('generateDirectAnswer', () => {
  it('returns a concise answer from content', () => {
    const content = '# Installation\n\nYou can install this package using npm. Run npm install my-package to get started.'
    const answer = generateDirectAnswer(content, 'Installation')
    expect(answer.length).toBeGreaterThan(0)
    expect(answer.length).toBeLessThanOrEqual(300)
  })

  it('strips markdown formatting from the answer', () => {
    const content = '# Title\n\n**Bold text** and `code` are stripped for the answer. This is important content.'
    const answer = generateDirectAnswer(content, 'Title')
    expect(answer).not.toContain('**')
    expect(answer).not.toContain('`')
  })

  it('falls back to generic answer for empty content', () => {
    const answer = generateDirectAnswer('', 'My Document')
    expect(answer).toContain('My Document')
  })

  it('handles code blocks gracefully', () => {
    const content = '# API\n\n```javascript\nconst x = 1;\n```\n\nThe API provides methods for data access and manipulation.'
    const answer = generateDirectAnswer(content, 'API')
    expect(answer).not.toContain('```')
  })
})

describe('generateAEOMetadata', () => {
  const doc = {
    title: 'Getting Started with TypeScript',
    slug: 'getting-started-typescript',
    content: '# Getting Started with TypeScript\n\n## What is TypeScript?\n\nTypeScript is a typed superset of JavaScript. It compiles to plain JavaScript and adds type safety to your codebase.\n\n## Installation\n\nRun `npm install typescript` to get started.\n\n## Why use TypeScript?\n\nTypeScript catches errors at compile time rather than runtime.',
    category: 'tutorial',
    tags: ['typescript', 'javascript'],
  }

  it('returns valid AEO metadata structure', () => {
    const aeo = generateAEOMetadata(doc)
    expect(aeo).toHaveProperty('questions')
    expect(aeo).toHaveProperty('directAnswer')
    expect(aeo).toHaveProperty('faqStructuredData')
  })

  it('extracts relevant questions', () => {
    const aeo = generateAEOMetadata(doc)
    expect(aeo.questions.length).toBeGreaterThan(0)
    expect(aeo.questions.length).toBeLessThanOrEqual(5)
  })

  it('provides a non-empty direct answer', () => {
    const aeo = generateAEOMetadata(doc)
    expect(aeo.directAnswer.length).toBeGreaterThan(0)
  })

  it('generates FAQ structured data with @context and @type', () => {
    const aeo = generateAEOMetadata(doc)
    expect(aeo.faqStructuredData['@context']).toBe('https://schema.org')
    expect(aeo.faqStructuredData['@type']).toBe('FAQPage')
    expect(aeo.faqStructuredData).toHaveProperty('mainEntity')
  })

  it('FAQ mainEntity contains Question entries', () => {
    const aeo = generateAEOMetadata(doc)
    const mainEntity = aeo.faqStructuredData.mainEntity as Record<string, unknown>[]
    expect(Array.isArray(mainEntity)).toBe(true)
    if (mainEntity.length > 0) {
      expect(mainEntity[0]['@type']).toBe('Question')
      expect(mainEntity[0]).toHaveProperty('name')
      expect(mainEntity[0]).toHaveProperty('acceptedAnswer')
    }
  })

  it('handles document with no questions in content', () => {
    const simpleDoc = {
      title: 'Simple Guide',
      slug: 'simple-guide',
      content: 'This guide explains the basics of our platform. Follow the steps below to get started.',
    }
    const aeo = generateAEOMetadata(simpleDoc)
    expect(aeo.questions.length).toBeGreaterThan(0)
    // Should generate a fallback question
  })
})

// ── GEO Tests ─────────────────────────────────────────────────────────────────

describe('extractKeyFacts', () => {
  it('extracts bold statements as key facts', () => {
    const content = 'This is some text. **TypeScript adds type safety to JavaScript.** More text here.'
    const facts = extractKeyFacts(content)
    expect(facts).toContain('TypeScript adds type safety to JavaScript.')
  })

  it('extracts list items as key facts', () => {
    const content = '## Features\n\n- Automatic SEO generation for all documents\n- Real-time search with full-text indexing\n- MCP integration for AI agents'
    const facts = extractKeyFacts(content)
    expect(facts.length).toBeGreaterThan(0)
    expect(facts.some(f => f.includes('SEO') || f.includes('search') || f.includes('MCP'))).toBe(true)
  })

  it('returns at most 5 facts', () => {
    const content = Array.from({ length: 10 }, (_, i) =>
      `**This is bold fact number ${i} with sufficient length to pass the filter.**`
    ).join('\n')
    const facts = extractKeyFacts(content)
    expect(facts.length).toBeLessThanOrEqual(5)
  })

  it('falls back to first sentences when no bold/list items exist', () => {
    const content = 'This is a plain paragraph with enough detail to be considered a fact. It contains useful information about the platform.'
    const facts = extractKeyFacts(content)
    expect(facts.length).toBeGreaterThan(0)
  })

  it('handles empty content', () => {
    const facts = extractKeyFacts('')
    expect(Array.isArray(facts)).toBe(true)
  })
})

describe('generateGEOMetadata', () => {
  const doc = {
    title: 'API Authentication Guide',
    slug: 'api-auth-guide',
    content: '# API Authentication Guide\n\n**API keys are the primary method of authentication.** Each key has scopes that limit access.\n\n## Getting a Key\n\n- Visit the settings page to generate a new API key\n- Copy the key immediately as it cannot be retrieved later\n- Use the key in the Authorization header\n\n## Rate Limits\n\nEach API key has a configurable rate limit. The default is 100 requests per minute.',
    category: 'api',
    tags: ['authentication', 'api', 'security'],
  }

  it('returns valid GEO metadata structure', () => {
    const geo = generateGEOMetadata(doc)
    expect(geo).toHaveProperty('summary')
    expect(geo).toHaveProperty('keyFacts')
    expect(geo).toHaveProperty('citationLabel')
    expect(geo).toHaveProperty('topicTags')
  })

  it('generates a summary within 300 characters', () => {
    const geo = generateGEOMetadata(doc)
    expect(geo.summary.length).toBeGreaterThan(0)
    expect(geo.summary.length).toBeLessThanOrEqual(300)
  })

  it('extracts key facts as an array', () => {
    const geo = generateGEOMetadata(doc)
    expect(Array.isArray(geo.keyFacts)).toBe(true)
    expect(geo.keyFacts.length).toBeGreaterThan(0)
    expect(geo.keyFacts.length).toBeLessThanOrEqual(5)
  })

  it('generates citation label with title and OpenDocs', () => {
    const geo = generateGEOMetadata(doc)
    expect(geo.citationLabel).toContain('API Authentication Guide')
    expect(geo.citationLabel).toContain('OpenDocs')
  })

  it('extracts topic tags from keywords', () => {
    const geo = generateGEOMetadata(doc)
    expect(Array.isArray(geo.topicTags)).toBe(true)
    expect(geo.topicTags.length).toBeGreaterThan(0)
    expect(geo.topicTags.length).toBeLessThanOrEqual(8)
  })

  it('handles minimal document', () => {
    const minDoc = {
      title: 'Quick Note',
      slug: 'quick-note',
      content: 'A short note.',
    }
    const geo = generateGEOMetadata(minDoc)
    expect(geo.summary.length).toBeGreaterThan(0)
    expect(geo.citationLabel).toBe('Quick Note — OpenDocs')
  })
})

// ── Full Optimization Tests ──────────────────────────────────────────────────

describe('generateFullOptimization', () => {
  const doc = {
    title: 'MCP Integration Tutorial',
    slug: 'mcp-integration',
    content: '# MCP Integration Tutorial\n\nLearn how to integrate with the Model Context Protocol.\n\n## Prerequisites\n\n- Node.js 18+\n- An API key\n\n## Setup\n\nInstall the SDK: `npm install @modelcontextprotocol/sdk`',
    category: 'tutorial',
    tags: ['mcp', 'integration'],
  }

  it('returns SEO, AEO, and GEO in one call', async () => {
    const opt = await generateFullOptimization(doc, 'https://docs.example.com')
    expect(opt).toHaveProperty('seo')
    expect(opt).toHaveProperty('aeo')
    expect(opt).toHaveProperty('geo')
  })

  it('SEO has expected properties', async () => {
    const { seo } = await generateFullOptimization(doc, 'https://docs.example.com')
    expect(seo).toHaveProperty('ogTitle')
    expect(seo).toHaveProperty('ogDescription')
    expect(seo).toHaveProperty('canonicalUrl')
    expect(seo).toHaveProperty('readingTimeMinutes')
    expect(seo).toHaveProperty('wordCount')
    expect(seo).toHaveProperty('emojiSummary')
    expect(seo).toHaveProperty('structuredData')
  })

  it('AEO has expected properties', async () => {
    const { aeo } = await generateFullOptimization(doc, 'https://docs.example.com')
    expect(aeo.questions.length).toBeGreaterThan(0)
    expect(aeo.directAnswer.length).toBeGreaterThan(0)
    expect(aeo.faqStructuredData['@type']).toBe('FAQPage')
  })

  it('GEO has expected properties', async () => {
    const { geo } = await generateFullOptimization(doc, 'https://docs.example.com')
    expect(geo.summary.length).toBeGreaterThan(0)
    expect(geo.citationLabel).toContain('MCP Integration Tutorial')
    expect(geo.topicTags.length).toBeGreaterThan(0)
  })
})

// ── extractFAQFromContent Tests ──────────────────────────────────────────────

describe('extractFAQFromContent', () => {
  it('extracts FAQ entries from question headings', () => {
    const content = `# Getting Started

Some intro text.

## How do I install?

Run npm install to get started with the package.

## What platforms are supported?

We support Windows, macOS, and Linux.
`
    const entries = extractFAQFromContent(content)
    expect(entries).toHaveLength(2)
    expect(entries[0].question).toBe('How do I install?')
    expect(entries[0].answer).toContain('npm install')
    expect(entries[1].question).toBe('What platforms are supported?')
    expect(entries[1].answer).toContain('Windows')
  })

  it('returns empty array when no question headings exist', () => {
    const content = `# Installation

Run npm install.

## Configuration

Edit the config file.
`
    const entries = extractFAQFromContent(content)
    expect(entries).toHaveLength(0)
  })

  it('limits to 5 entries maximum', () => {
    const lines = Array.from({ length: 8 }, (_, i) =>
      `## Question ${i + 1}?\n\nAnswer to question ${i + 1}.`
    ).join('\n\n')
    const entries = extractFAQFromContent(lines)
    expect(entries.length).toBeLessThanOrEqual(5)
  })

  it('truncates long answers to 300 characters', () => {
    const content = `## What is this?\n\n${'A'.repeat(500)}`
    const entries = extractFAQFromContent(content)
    expect(entries).toHaveLength(1)
    expect(entries[0].answer.length).toBeLessThanOrEqual(300)
  })

  it('skips question headings with no answer content', () => {
    const content = `## What is this?\n\n## Another question?\n\nThis one has an answer.`
    const entries = extractFAQFromContent(content)
    expect(entries).toHaveLength(1)
    expect(entries[0].question).toBe('Another question?')
  })

  it('strips leading markdown list markers from answers', () => {
    const content = `## How do I use it?\n\n- Step one\n- Step two`
    const entries = extractFAQFromContent(content)
    expect(entries).toHaveLength(1)
    expect(entries[0].answer).not.toMatch(/^-/)
    expect(entries[0].answer).toContain('Step one')
  })
})
