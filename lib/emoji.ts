/**
 * Emoji Integration via emoji.platphormnews.com MCP
 * Provides Unicode emoji support for content enhancement
 */

const EMOJI_MCP_URL = 'https://emoji.platphormnews.com/api/mcp'

export interface EmojiResult {
  emoji: string
  name: string
  category: string
  keywords: string[]
}

export interface EmojiSummary {
  emojis: string
  description: string
}

/**
 * Call the emoji MCP service
 */
async function callEmojiMCP(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
  try {
    const response = await fetch(EMOJI_MCP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params,
      }),
    })
    
    if (!response.ok) {
      throw new Error(`Emoji MCP error: ${response.status}`)
    }
    
    const data = await response.json()
    return data.result
  } catch (error) {
    console.error('[Emoji MCP Error]', error)
    return null
  }
}

/**
 * Search for emojis by keyword
 */
export async function searchEmojis(query: string, limit = 10): Promise<EmojiResult[]> {
  const result = await callEmojiMCP('tools/call', {
    name: 'search_emojis',
    arguments: { query, limit },
  })
  
  if (result && typeof result === 'object' && 'content' in result) {
    try {
      const content = (result as { content: Array<{ text: string }> }).content
      if (content?.[0]?.text) {
        return JSON.parse(content[0].text)
      }
    } catch {
      // Fall through to fallback
    }
  }
  
  // Fallback: return common emojis based on query
  return getFallbackEmojis(query)
}

/**
 * Get emoji summary for content (3-5 emojis that represent the content)
 */
export async function generateEmojiSummary(content: string, title: string): Promise<EmojiSummary> {
  const result = await callEmojiMCP('tools/call', {
    name: 'summarize_with_emojis',
    arguments: { text: `${title}\n\n${content.slice(0, 1000)}` },
  })
  
  if (result && typeof result === 'object' && 'content' in result) {
    try {
      const content = (result as { content: Array<{ text: string }> }).content
      if (content?.[0]?.text) {
        return JSON.parse(content[0].text)
      }
    } catch {
      // Fall through to fallback
    }
  }
  
  // Fallback: generate based on keywords
  return generateFallbackSummary(title, content)
}

/**
 * Get random emoji by category
 */
export async function getEmojiByCategory(category: string): Promise<EmojiResult | null> {
  const result = await callEmojiMCP('tools/call', {
    name: 'get_emoji_by_category',
    arguments: { category },
  })
  
  if (result && typeof result === 'object' && 'content' in result) {
    try {
      const content = (result as { content: Array<{ text: string }> }).content
      if (content?.[0]?.text) {
        return JSON.parse(content[0].text)
      }
    } catch {
      // Fall through to null
    }
  }
  
  return null
}

// ============================================
// FALLBACK EMOJI MAPPINGS (when MCP unavailable)
// ============================================

const CATEGORY_EMOJIS: Record<string, string[]> = {
  'getting-started': ['🚀', '✨', '🎯', '📚', '🌟'],
  'api': ['⚡', '🔌', '🛠️', '💻', '🔧'],
  'mcp': ['🤖', '🧠', '🔗', '⚙️', '🌐'],
  'guides': ['📖', '📝', '🎓', '💡', '🗺️'],
  'community': ['👥', '🤝', '💬', '🌍', '❤️'],
  'tutorial': ['🎯', '📋', '✅', '🔄', '📈'],
  'reference': ['📑', '🔍', '📊', '🗂️', '📎'],
}

const KEYWORD_EMOJIS: Record<string, string> = {
  // Tech
  'code': '💻',
  'api': '⚡',
  'database': '🗄️',
  'server': '🖥️',
  'cloud': '☁️',
  'security': '🔒',
  'deploy': '🚀',
  'build': '🏗️',
  'test': '🧪',
  'debug': '🐛',
  
  // Content
  'document': '📄',
  'article': '📰',
  'blog': '✍️',
  'post': '📝',
  'guide': '📖',
  'tutorial': '🎓',
  
  // Actions
  'create': '✨',
  'update': '🔄',
  'delete': '🗑️',
  'search': '🔍',
  'share': '📤',
  'submit': '📨',
  
  // Concepts
  'automation': '🤖',
  'workflow': '⚙️',
  'integration': '🔗',
  'performance': '⚡',
  'scalability': '📈',
  
  // General
  'success': '✅',
  'error': '❌',
  'warning': '⚠️',
  'info': 'ℹ️',
  'tip': '💡',
  'note': '📌',
  'important': '❗',
  'new': '🆕',
  'beta': '🔬',
  'deprecated': '⏰',
}

function getFallbackEmojis(query: string): EmojiResult[] {
  const queryLower = query.toLowerCase()
  const results: EmojiResult[] = []
  
  for (const [keyword, emoji] of Object.entries(KEYWORD_EMOJIS)) {
    if (keyword.includes(queryLower) || queryLower.includes(keyword)) {
      results.push({
        emoji,
        name: keyword,
        category: 'general',
        keywords: [keyword],
      })
    }
  }
  
  return results.slice(0, 10)
}

function generateFallbackSummary(title: string, content: string): EmojiSummary {
  const text = `${title} ${content}`.toLowerCase()
  const emojis: string[] = []
  
  // Check for keyword matches
  for (const [keyword, emoji] of Object.entries(KEYWORD_EMOJIS)) {
    if (text.includes(keyword) && !emojis.includes(emoji)) {
      emojis.push(emoji)
      if (emojis.length >= 5) break
    }
  }
  
  // Add default if not enough
  while (emojis.length < 3) {
    const defaults = ['📄', '✨', '🔗', '💡', '🚀']
    for (const d of defaults) {
      if (!emojis.includes(d)) {
        emojis.push(d)
        break
      }
    }
  }
  
  return {
    emojis: emojis.slice(0, 5).join(''),
    description: `Content about ${title.split(' ').slice(0, 3).join(' ')}`,
  }
}

/**
 * Category to emoji mapping
 */
export function getCategoryEmoji(category: string): string {
  const emojis = CATEGORY_EMOJIS[category] || CATEGORY_EMOJIS['guides']
  return emojis[0]
}

/**
 * Get multiple emojis for a category
 */
export function getCategoryEmojis(category: string): string[] {
  return CATEGORY_EMOJIS[category] || CATEGORY_EMOJIS['guides']
}

/**
 * Enhance text with emoji suggestions
 */
export function enhanceWithEmojis(text: string): string {
  let enhanced = text
  
  for (const [keyword, emoji] of Object.entries(KEYWORD_EMOJIS)) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi')
    if (regex.test(enhanced) && !enhanced.includes(emoji)) {
      // Add emoji after first occurrence
      enhanced = enhanced.replace(regex, `$& ${emoji}`)
      break // Only add one emoji to avoid clutter
    }
  }
  
  return enhanced
}

/**
 * Parse emoji shortcodes like :rocket: to Unicode
 */
export function parseEmojiShortcodes(text: string): string {
  const shortcodeMap: Record<string, string> = {
    ':rocket:': '🚀',
    ':star:': '⭐',
    ':fire:': '🔥',
    ':check:': '✅',
    ':x:': '❌',
    ':warning:': '⚠️',
    ':info:': 'ℹ️',
    ':bulb:': '💡',
    ':book:': '📖',
    ':code:': '💻',
    ':gear:': '⚙️',
    ':link:': '🔗',
    ':search:': '🔍',
    ':sparkles:': '✨',
    ':zap:': '⚡',
    ':robot:': '🤖',
    ':heart:': '❤️',
    ':thumbsup:': '👍',
    ':thumbsdown:': '👎',
    ':eyes:': '👀',
    ':tada:': '🎉',
    ':memo:': '📝',
    ':pencil:': '✏️',
    ':hammer:': '🔨',
    ':wrench:': '🔧',
    ':key:': '🔑',
    ':lock:': '🔒',
    ':unlock:': '🔓',
    ':globe:': '🌐',
    ':earth:': '🌍',
    ':sun:': '☀️',
    ':moon:': '🌙',
    ':cloud:': '☁️',
    ':lightning:': '⚡',
    ':wave:': '👋',
    ':clap:': '👏',
    ':pray:': '🙏',
    ':muscle:': '💪',
    ':brain:': '🧠',
    ':package:': '📦',
    ':truck:': '🚚',
    ':airplane:': '✈️',
    ':ship:': '🚢',
    ':house:': '🏠',
    ':office:': '🏢',
    ':hospital:': '🏥',
    ':school:': '🏫',
    ':bank:': '🏦',
    ':hotel:': '🏨',
    ':100:': '💯',
    ':1st:': '🥇',
    ':2nd:': '🥈',
    ':3rd:': '🥉',
    ':trophy:': '🏆',
    ':medal:': '🏅',
    ':gift:': '🎁',
    ':balloon:': '🎈',
    ':confetti:': '🎊',
    ':party:': '🥳',
  }
  
  let result = text
  for (const [shortcode, emoji] of Object.entries(shortcodeMap)) {
    result = result.split(shortcode).join(emoji)
  }
  
  return result
}
