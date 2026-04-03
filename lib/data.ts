import { cache } from 'react'
import { sql, DEFAULT_TENANT_ID, Category } from './db'

export const getCategories = cache(async (): Promise<(Category & { document_count: number })[]> => {
  try {
    const categories = await sql`
      SELECT c.*,
        (SELECT COUNT(*)::int FROM documents d WHERE d.category = c.slug AND d.deleted_at IS NULL AND d.status = 'published') as document_count
      FROM categories c
      WHERE c.tenant_id = ${DEFAULT_TENANT_ID}
      ORDER BY c.order_index ASC, c.name ASC
    ` as (Category & { document_count: number })[]
    return categories
  } catch (error) {
    console.error('Failed to get categories:', error)
    return []
  }
})

export const getCategory = cache(async (slug: string): Promise<Category | null> => {
  try {
    const categories = await sql`
      SELECT * FROM categories
      WHERE tenant_id = ${DEFAULT_TENANT_ID}
        AND slug = ${slug}
    ` as Category[]
    return categories[0] || null
  } catch (error) {
    console.error('Failed to get category:', error)
    return null
  }
})
