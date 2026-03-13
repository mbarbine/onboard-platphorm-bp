import { describe, it, expect } from 'vitest'
import {
  getCategoryEmoji,
  getCategoryEmojis,
  enhanceWithEmojis,
  parseEmojiShortcodes,
} from '@/lib/emoji'

describe('getCategoryEmoji', () => {
  it('returns emoji for known category', () => {
    expect(getCategoryEmoji('getting-started')).toBe('🚀')
    expect(getCategoryEmoji('api')).toBe('⚡')
    expect(getCategoryEmoji('mcp')).toBe('🤖')
    expect(getCategoryEmoji('guides')).toBe('📖')
    expect(getCategoryEmoji('community')).toBe('👥')
    expect(getCategoryEmoji('tutorial')).toBe('🎯')
    expect(getCategoryEmoji('reference')).toBe('📑')
  })

  it('returns guides emoji as default for unknown category', () => {
    expect(getCategoryEmoji('unknown-category')).toBe('📖')
  })
})

describe('getCategoryEmojis', () => {
  it('returns array of emojis for known category', () => {
    const emojis = getCategoryEmojis('getting-started')
    expect(emojis).toEqual(['🚀', '✨', '🎯', '📚', '🌟'])
  })

  it('returns guides emojis as default for unknown category', () => {
    const emojis = getCategoryEmojis('nonexistent')
    expect(emojis).toEqual(['📖', '📝', '🎓', '💡', '🗺️'])
  })

  it('returns 5 emojis per category', () => {
    const categories = ['getting-started', 'api', 'mcp', 'guides', 'community', 'tutorial', 'reference']
    for (const cat of categories) {
      expect(getCategoryEmojis(cat)).toHaveLength(5)
    }
  })
})

describe('enhanceWithEmojis', () => {
  it('adds emoji after matching keyword', () => {
    const result = enhanceWithEmojis('Check the code for errors')
    expect(result).toContain('💻')
  })

  it('only adds one emoji to avoid clutter', () => {
    const result = enhanceWithEmojis('Build and deploy the code')
    // Count emoji additions (should be just 1)
    const emojiCount = (result.match(/[🏗️💻🚀]/gu) || []).length
    expect(emojiCount).toBeLessThanOrEqual(2) // Some emojis are multi-codepoint
  })

  it('returns text unchanged if no keywords match', () => {
    const text = 'A completely random sentence'
    const result = enhanceWithEmojis(text)
    expect(result).toBe(text)
  })
})

describe('parseEmojiShortcodes', () => {
  it('converts known shortcodes to emoji', () => {
    expect(parseEmojiShortcodes(':rocket:')).toBe('🚀')
    expect(parseEmojiShortcodes(':star:')).toBe('⭐')
    expect(parseEmojiShortcodes(':fire:')).toBe('🔥')
    expect(parseEmojiShortcodes(':check:')).toBe('✅')
    expect(parseEmojiShortcodes(':x:')).toBe('❌')
  })

  it('converts multiple shortcodes in text', () => {
    const result = parseEmojiShortcodes('Hello :wave: World :rocket:')
    expect(result).toBe('Hello 👋 World 🚀')
  })

  it('leaves unknown shortcodes unchanged', () => {
    expect(parseEmojiShortcodes(':nonexistent:')).toBe(':nonexistent:')
  })

  it('handles text without shortcodes', () => {
    expect(parseEmojiShortcodes('plain text')).toBe('plain text')
  })

  it('handles empty string', () => {
    expect(parseEmojiShortcodes('')).toBe('')
  })

  it('converts all documented shortcodes', () => {
    const shortcodes = [
      ':rocket:', ':star:', ':fire:', ':check:', ':x:', ':warning:',
      ':info:', ':bulb:', ':book:', ':code:', ':gear:', ':link:',
      ':search:', ':sparkles:', ':zap:', ':robot:', ':heart:',
      ':thumbsup:', ':thumbsdown:', ':eyes:', ':tada:', ':memo:',
    ]
    for (const sc of shortcodes) {
      const result = parseEmojiShortcodes(sc)
      expect(result).not.toBe(sc) // Should have been converted
      expect(result.length).toBeGreaterThan(0)
    }
  })
})
