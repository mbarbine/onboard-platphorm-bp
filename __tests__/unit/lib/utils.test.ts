import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz')
  })

  it('merges tailwind classes correctly', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2')
  })

  it('handles undefined and null values', () => {
    expect(cn('foo', undefined, null, 'bar')).toBe('foo bar')
  })

  it('handles empty input', () => {
    expect(cn()).toBe('')
  })

  it('deduplicates conflicting tailwind utilities', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  it('handles array inputs via clsx', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar')
  })

  it('handles object inputs via clsx', () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz')
  })

  it('handles nested arrays', () => {
    expect(cn(['foo', ['bar', 'baz']])).toBe('foo bar baz')
  })

  it('handles complex mixed inputs', () => {
    expect(cn('foo', [1 && 'bar', { baz: false, bat: null }, ['hello', ['world']]], 'cya')).toBe('foo bar hello world cya')
  })

  it('handles tailwind variants correctly', () => {
    expect(cn('hover:bg-red-500', 'hover:bg-blue-500')).toBe('hover:bg-blue-500')
    expect(cn('focus:text-red-500', 'focus:text-blue-500')).toBe('focus:text-blue-500')
    expect(cn('dark:bg-red-500', 'dark:bg-blue-500')).toBe('dark:bg-blue-500')
  })

  it('preserves non-conflicting tailwind utilities', () => {
    expect(cn('text-red-500', 'bg-blue-500', 'p-4')).toBe('text-red-500 bg-blue-500 p-4')
  })

  it('handles all falsy values', () => {
    expect(cn('', null, undefined, 0, false, NaN)).toBe('')
  })
})
