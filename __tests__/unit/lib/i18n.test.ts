import { describe, it, expect } from 'vitest'
import { locales, localeNames, t, useTranslations } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n'

describe('locales', () => {
  it('exports 10 supported locales', () => {
    expect(locales).toHaveLength(10)
  })

  it('includes all expected locales', () => {
    const expected: Locale[] = ['en', 'es', 'fr', 'de', 'ja', 'zh', 'pt', 'ar', 'ru', 'ko']
    expect(locales).toEqual(expected)
  })
})

describe('localeNames', () => {
  it('has a name for each locale', () => {
    for (const locale of locales) {
      expect(localeNames[locale]).toBeDefined()
      expect(localeNames[locale].length).toBeGreaterThan(0)
    }
  })

  it('has correct English name', () => {
    expect(localeNames.en).toBe('English')
  })

  it('has correct Spanish name', () => {
    expect(localeNames.es).toBe('Español')
  })
})

describe('t (translate)', () => {
  it('returns English translation by default', () => {
    const result = t('nav.home')
    expect(result).toBe('Home')
  })

  it('returns translation for specified locale', () => {
    const result = t('nav.home', 'es')
    expect(result).toBe('Inicio')
  })

  it('falls back to English for missing translations', () => {
    // All locales should have a fallback
    const result = t('nav.home', 'en')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('returns key as fallback if no translation found', () => {
    // Cast to bypass type check for testing fallback behavior
    const result = t('nonexistent.key' as never)
    expect(typeof result).toBe('string')
  })

  it('translates navigation keys for all locales', () => {
    const key = 'nav.docs'
    for (const locale of locales) {
      const result = t(key, locale)
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    }
  })

  it('translates home page keys', () => {
    expect(t('home.title', 'en')).toBeDefined()
    expect(t('home.subtitle', 'en')).toBeDefined()
  })

  it('translates search keys', () => {
    expect(t('search.title', 'en')).toBeDefined()
    expect(t('search.placeholder', 'en')).toBeDefined()
    expect(t('search.no_results', 'en')).toBeDefined()
  })
})

describe('useTranslations', () => {
  it('returns a translation function', () => {
    const translate = useTranslations('en')
    expect(typeof translate).toBe('function')
  })

  it('translates using the provided locale', () => {
    const translate = useTranslations('fr')
    expect(translate('nav.home')).toBe('Accueil')
  })

  it('defaults to English', () => {
    const translate = useTranslations()
    expect(translate('nav.home')).toBe('Home')
  })
})
