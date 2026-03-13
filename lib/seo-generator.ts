import { sql, DEFAULT_TENANT_ID } from './db'
import { SITE_NAME, ORG_NAME } from './site-config'

// Types for SEO generation
export interface SEOMetadata {
  ogTitle: string
  ogDescription: string
  ogImage: string | null
  twitterCard: 'summary' | 'summary_large_image' | 'app' | 'player'
  canonicalUrl: string
  keywords: string[]
  readingTimeMinutes: number
  wordCount: number
  emojiSummary: string
  structuredData: Record<string, unknown>
}

// AEO — Answer Engine Optimization metadata
export interface AEOMetadata {
  /** Top questions the document answers (max 5) */
  questions: string[]
  /** Direct one-sentence answer for the primary question */
  directAnswer: string
  /** FAQ structured data (JSON-LD FAQPage) */
  faqStructuredData: Record<string, unknown>
}

// GEO — Generative Engine Optimization metadata
export interface GEOMetadata {
  /** Short summary optimized for LLM/AI citation (≤ 300 chars) */
  summary: string
  /** Key facts extracted from the content (max 5) */
  keyFacts: string[]
  /** Content signals that help AI models attribute the source */
  citationLabel: string
  /** Topic classification */
  topicTags: string[]
}

/** Combined SEO + AEO + GEO bundle returned by generateFullOptimization() */
export interface FullOptimization {
  seo: SEOMetadata
  aeo: AEOMetadata
  geo: GEOMetadata
}

export interface ShareLink {
  platform: string
  url: string
  icon: string
}

export interface DocumentMeta {
  title: string
  slug: string
  description?: string
  content: string
  category?: string
  tags?: string[]
  sourceUrl?: string
  authorName?: string
  publishedAt?: Date
}

// Calculate reading time (avg 200 words per minute)
export function calculateReadingTime(content: string): { minutes: number; words: number } {
  const text = content.replace(/[#*`\[\]()_~>-]/g, ' ').replace(/\s+/g, ' ').trim()
  const words = text.split(' ').filter(w => w.length > 0).length
  const minutes = Math.max(1, Math.ceil(words / 200))
  return { minutes, words }
}

// Generate emoji summary based on content/category
export function generateEmojiSummary(
  title: string, 
  category?: string, 
  tags?: string[]
): string {
  const emojiMap: Record<string, string> = {
    // Categories
    'getting-started': '🚀',
    'api': '⚡',
    'mcp': '🤖',
    'guides': '📖',
    'community': '👥',
    'tutorial': '📚',
    // Common tags/keywords
    'javascript': '💛',
    'typescript': '💙',
    'python': '🐍',
    'rust': '🦀',
    'react': '⚛️',
    'nextjs': '▲',
    'database': '🗃️',
    'auth': '🔐',
    'security': '🛡️',
    'performance': '⚡',
    'testing': '🧪',
    'deploy': '🚢',
    'docker': '🐳',
    'kubernetes': '☸️',
    'ai': '🧠',
    'ml': '🤖',
    'data': '📊',
    'chart': '📈',
    'mobile': '📱',
    'web': '🌐',
    'css': '🎨',
    'design': '✨',
    'ux': '💫',
    'vanlife': '🚐',
    'travel': '✈️',
    'blog': '✍️',
    'news': '📰',
  }
  
  const emojis: string[] = []
  
  // Add category emoji
  if (category && emojiMap[category.toLowerCase()]) {
    emojis.push(emojiMap[category.toLowerCase()])
  }
  
  // Add tag emojis (max 3)
  if (tags) {
    for (const tag of tags) {
      if (emojis.length >= 4) break
      const emoji = emojiMap[tag.toLowerCase()]
      if (emoji && !emojis.includes(emoji)) {
        emojis.push(emoji)
      }
    }
  }
  
  // Check title for keywords
  const titleLower = title.toLowerCase()
  for (const [keyword, emoji] of Object.entries(emojiMap)) {
    if (emojis.length >= 5) break
    if (titleLower.includes(keyword) && !emojis.includes(emoji)) {
      emojis.push(emoji)
    }
  }
  
  // Default emoji if none found
  if (emojis.length === 0) {
    emojis.push('📄')
  }
  
  return emojis.join('')
}

// Generate SEO-optimized description
export function generateDescription(content: string, maxLength: number = 160): string {
  // Remove markdown syntax
  let text = content
    .replace(/^#+\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#*`\[\]()_~>-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  
  // Get first meaningful paragraph
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20)
  
  if (sentences.length > 0) {
    text = sentences.slice(0, 2).join('. ').trim()
    if (!text.endsWith('.')) text += '.'
  }
  
  if (text.length > maxLength) {
    text = text.substring(0, maxLength - 3).trim() + '...'
  }
  
  return text
}

// Generate keywords from content
export function extractKeywords(
  title: string, 
  content: string, 
  tags?: string[]
): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought',
    'used', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it',
    'we', 'they', 'what', 'which', 'who', 'whom', 'when', 'where', 'why', 'how',
  ])
  
  const text = `${title} ${content}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
  
  const wordFreq: Record<string, number> = {}
  
  for (const word of text.split(' ')) {
    if (word.length > 2 && !stopWords.has(word)) {
      wordFreq[word] = (wordFreq[word] || 0) + 1
    }
  }
  
  // Sort by frequency and get top keywords
  const keywords = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word)
  
  // Add tags as keywords
  if (tags) {
    for (const tag of tags) {
      if (!keywords.includes(tag.toLowerCase())) {
        keywords.push(tag.toLowerCase())
      }
    }
  }
  
  return keywords.slice(0, 15)
}

// Generate structured data (JSON-LD)
export function generateStructuredData(
  doc: DocumentMeta,
  baseUrl: string
): Record<string, unknown> {
  const { minutes, words } = calculateReadingTime(doc.content)
  
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: doc.title,
    description: doc.description || generateDescription(doc.content),
    url: `${baseUrl}/docs/${doc.slug}`,
    datePublished: doc.publishedAt?.toISOString() || new Date().toISOString(),
    dateModified: new Date().toISOString(),
    wordCount: words,
    timeRequired: `PT${minutes}M`,
    author: doc.authorName ? {
      '@type': 'Person',
      name: doc.authorName,
    } : {
      '@type': 'Organization',
      name: SITE_NAME,
    },
    publisher: {
      '@type': 'Organization',
      name: ORG_NAME,
      url: baseUrl,
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${baseUrl}/docs/${doc.slug}`,
    },
    ...(doc.category && {
      articleSection: doc.category,
    }),
    ...(doc.tags && doc.tags.length > 0 && {
      keywords: doc.tags.join(', '),
    }),
    ...(doc.sourceUrl && {
      isBasedOn: doc.sourceUrl,
    }),
  }
}

// Generate share links for all platforms
export function generateShareLinks(
  title: string,
  url: string,
  description?: string
): ShareLink[] {
  const encodedTitle = encodeURIComponent(title)
  const encodedUrl = encodeURIComponent(url)
  const encodedDesc = encodeURIComponent(description || '')
  
  return [
    {
      platform: 'twitter',
      url: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
      icon: '𝕏',
    },
    {
      platform: 'linkedin',
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      icon: '💼',
    },
    {
      platform: 'facebook',
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      icon: '📘',
    },
    {
      platform: 'reddit',
      url: `https://reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`,
      icon: '🔴',
    },
    {
      platform: 'hackernews',
      url: `https://news.ycombinator.com/submitlink?u=${encodedUrl}&t=${encodedTitle}`,
      icon: '🟧',
    },
    {
      platform: 'email',
      url: `mailto:?subject=${encodedTitle}&body=${encodedDesc}%0A%0A${encodedUrl}`,
      icon: '📧',
    },
    {
      platform: 'copy',
      url: url,
      icon: '📋',
    },
  ]
}

// Generate full SEO metadata for a document
export async function generateSEOMetadata(
  doc: DocumentMeta,
  baseUrl: string
): Promise<SEOMetadata> {
  const { minutes, words } = calculateReadingTime(doc.content)
  const description = doc.description || generateDescription(doc.content)
  const keywords = extractKeywords(doc.title, doc.content, doc.tags)
  const emojiSummary = generateEmojiSummary(doc.title, doc.category, doc.tags)
  
  return {
    ogTitle: doc.title,
    ogDescription: description,
    ogImage: `${baseUrl}/api/og?title=${encodeURIComponent(doc.title)}&emoji=${encodeURIComponent(emojiSummary)}`,
    twitterCard: 'summary_large_image',
    canonicalUrl: `${baseUrl}/docs/${doc.slug}`,
    keywords,
    readingTimeMinutes: minutes,
    wordCount: words,
    emojiSummary,
    structuredData: generateStructuredData(doc, baseUrl),
  }
}

// Update document with generated SEO metadata
export async function updateDocumentSEO(
  slug: string,
  baseUrl: string
): Promise<void> {
  // Fetch the document
  const docs = await sql`
    SELECT slug, title, description, content, category, tags, 
           source_url, author_name, published_at
    FROM documents
    WHERE slug = ${slug} AND tenant_id = ${DEFAULT_TENANT_ID}
  ` as DocumentMeta[]
  
  if (docs.length === 0) return
  
  const doc = docs[0]
  const seo = await generateSEOMetadata({
    ...doc,
    tags: Array.isArray(doc.tags) ? doc.tags : JSON.parse((doc.tags as unknown as string) || '[]'),
    sourceUrl: doc.sourceUrl,
    authorName: doc.authorName,
    publishedAt: doc.publishedAt ? new Date(doc.publishedAt) : undefined,
  }, baseUrl)
  
  await sql`
    UPDATE documents
    SET og_title = ${seo.ogTitle},
        og_description = ${seo.ogDescription},
        og_image = ${seo.ogImage},
        twitter_card = ${seo.twitterCard},
        canonical_url = ${seo.canonicalUrl},
        reading_time_minutes = ${seo.readingTimeMinutes},
        word_count = ${seo.wordCount},
        emoji_summary = ${seo.emojiSummary},
        updated_at = NOW()
    WHERE slug = ${slug} AND tenant_id = ${DEFAULT_TENANT_ID}
  `
}

// Batch update SEO for all documents
export async function updateAllDocumentsSEO(baseUrl: string): Promise<number> {
  const docs = await sql`
    SELECT slug FROM documents
    WHERE tenant_id = ${DEFAULT_TENANT_ID}
      AND status = 'published'
      AND deleted_at IS NULL
  ` as { slug: string }[]
  
  for (const doc of docs) {
    await updateDocumentSEO(doc.slug, baseUrl)
  }
  
  return docs.length
}

// ── AEO — Answer Engine Optimization ─────────────────────────────────────────

/**
 * Extract question-style sentences from content (headings phrased as questions,
 * or sentences ending with "?").  Falls back to generating questions from
 * headings (e.g. "## Installation" → "How do I handle Installation?").
 */
export function extractQuestions(content: string, title: string): string[] {
  const questions: string[] = []

  // 1. Explicit questions in the content
  const questionMatches = content.match(/[^.!?\n]*\?/g) || []
  for (const q of questionMatches) {
    const cleaned = q.replace(/^[#*>\s-]+/, '').trim()
    if (cleaned.length > 10 && cleaned.length < 200 && !questions.includes(cleaned)) {
      questions.push(cleaned)
    }
    if (questions.length >= 5) break
  }

  // 2. Derive questions from headings if we still need more
  const headingMatches = content.match(/^#{1,3}\s+(.+)$/gm) || []
  for (const heading of headingMatches) {
    if (questions.length >= 5) break
    const text = heading.replace(/^#+\s+/, '').trim()
    if (text.endsWith('?')) continue // Already captured
    const q = `What is ${text}?`
    if (!questions.includes(q)) questions.push(q)
  }

  // 3. Always include a question about the title itself
  if (questions.length === 0) {
    questions.push(`What is ${title}?`)
  }

  return questions.slice(0, 5)
}

/**
 * Generate a concise direct answer from the first meaningful paragraph.
 */
export function generateDirectAnswer(content: string, title: string): string {
  const plainText = content
    .replace(/^#+\s+.+$/gm, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`~#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  const sentences = plainText.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 20)
  const answer = sentences.slice(0, 2).join(' ').trim()
  if (answer.length > 0) return answer.slice(0, 300)
  return `${title} provides detailed documentation and guidance.`
}

/**
 * Generate AEO metadata: FAQ-style structured data, questions, direct answers.
 */
export function generateAEOMetadata(doc: DocumentMeta): AEOMetadata {
  const questions = extractQuestions(doc.content, doc.title)
  const directAnswer = generateDirectAnswer(doc.content, doc.title)

  const faqEntries = questions.map(q => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: {
      '@type': 'Answer',
      text: directAnswer,
    },
  }))

  return {
    questions,
    directAnswer,
    faqStructuredData: {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqEntries,
    },
  }
}

// ── GEO — Generative Engine Optimization ─────────────────────────────────────

/**
 * Extract up to 5 key facts / highlights from the content.
 */
export function extractKeyFacts(content: string): string[] {
  const facts: string[] = []

  // Look for bold statements, list items with substance, and leading sentences
  const boldMatches = content.match(/\*\*([^*]{15,120})\*\*/g) || []
  for (const b of boldMatches) {
    if (facts.length >= 5) break
    const text = b.replace(/\*\*/g, '').trim()
    if (!facts.includes(text)) facts.push(text)
  }

  // List items
  const listItems = content.match(/^[-*]\s+(.{15,120})$/gm) || []
  for (const li of listItems) {
    if (facts.length >= 5) break
    const text = li.replace(/^[-*]\s+/, '').trim()
    if (!facts.includes(text)) facts.push(text)
  }

  // First sentences as fallback
  if (facts.length === 0) {
    const plain = content
      .replace(/^#+\s+.+$/gm, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/[*_`~#>]/g, '')
      .trim()
    const sentences = plain.split(/(?<=[.!?])\s+/).filter(s => s.length > 20)
    for (const s of sentences.slice(0, 3)) {
      facts.push(s.slice(0, 120))
    }
  }

  return facts.slice(0, 5)
}

/**
 * Generate GEO metadata: summary for AI consumption, key facts, citation label.
 */
export function generateGEOMetadata(doc: DocumentMeta): GEOMetadata {
  const description = doc.description || generateDescription(doc.content, 300)
  const summary = description.slice(0, 300)
  const keyFacts = extractKeyFacts(doc.content)
  const keywords = extractKeywords(doc.title, doc.content, doc.tags)
  const citationLabel = `${doc.title} — ${SITE_NAME}`

  return {
    summary,
    keyFacts,
    citationLabel,
    topicTags: keywords.slice(0, 8),
  }
}

// ── Combined optimization ────────────────────────────────────────────────────

/**
 * Generate the full SEO + AEO + GEO optimization bundle for a document.
 * This is the recommended single call for new document creation.
 */
export async function generateFullOptimization(
  doc: DocumentMeta,
  baseUrl: string
): Promise<FullOptimization> {
  const seo = await generateSEOMetadata(doc, baseUrl)
  const aeo = generateAEOMetadata(doc)
  const geo = generateGEOMetadata(doc)
  return { seo, aeo, geo }
}

// ── FAQ extraction for page-level JSON-LD ────────────────────────────────────

/**
 * Extract FAQ entries from content by finding headings phrased as questions
 * and collecting the subsequent paragraph text as answers.
 * Returns entries suitable for a FAQPage JSON-LD schema.
 */
export function extractFAQFromContent(content: string): { question: string; answer: string }[] {
  const entries: { question: string; answer: string }[] = []
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].trim().match(/^#{1,3}\s+(.+\?)\s*$/)
    if (!match) continue

    // Collect non-heading, non-empty lines immediately following the question heading
    const answerParts: string[] = []
    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j].trim()
      if (next.match(/^#{1,3}\s/)) break      // stop at next heading
      if (!next) {
        if (answerParts.length > 0) break      // blank line after content = end of answer
        continue                                // skip leading blank lines
      }
      // Strip leading markdown list/quote markers for cleaner answer text
      answerParts.push(next.replace(/^[-*>]+\s*/, ''))
    }

    if (answerParts.length > 0) {
      entries.push({
        question: match[1],
        answer: answerParts.join(' ').slice(0, 300),
      })
    }
    if (entries.length >= 5) break
  }

  return entries
}
