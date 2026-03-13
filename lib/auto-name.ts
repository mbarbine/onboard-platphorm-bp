/**
 * Shared simple auto-naming / slug generation for ingested documents.
 *
 * Design goals:
 *  1. Human-readable — just the title, lowercased and hyphenated.
 *  2. Short — max 80 characters.
 *  3. Unique — append a 4-character random suffix to avoid collisions.
 *  4. Consistent — one function used by REST ingest, MCP tools, and bulk import.
 */

import crypto from 'crypto'

/**
 * Create a URL-safe slug from a title.
 *
 * "Getting Started with React" → "getting-started-with-react-a1b2"
 */
export function generateSimpleSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 72)

  const suffix = crypto.randomBytes(2).toString('hex') // 2 bytes → 4 hex chars
  return base ? `${base}-${suffix}` : `doc-${suffix}`
}

/**
 * Derive a human-friendly title from a URL when no title is available.
 *
 * "https://example.com/blog/my-cool-post" → "My Cool Post"
 */
export function titleFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname
    const segment = pathname.split('/').filter(Boolean).pop() || 'untitled'
    return segment
      .replace(/[-_]/g, ' ')
      .replace(/\.\w+$/, '')
      .replace(/\b\w/g, c => c.toUpperCase())
      .trim() || 'Untitled'
  } catch {
    return 'Untitled'
  }
}
