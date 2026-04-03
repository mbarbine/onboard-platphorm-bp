import { NextRequest } from 'next/server'
import { sql, DEFAULT_TENANT_ID, Category } from '@/lib/db'
import {
  apiResponse,
  apiError,
  validateApiKey,
  hasScope,
  logAudit,
} from '@/lib/api-helpers'
import { CategoryCreateInput } from '@/lib/api-types'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const categories = await sql`
      SELECT c.*, 
        (SELECT COUNT(*)::int FROM documents d WHERE d.category = c.slug AND d.deleted_at IS NULL AND d.status = 'published') as document_count
      FROM categories c
      WHERE c.tenant_id = ${DEFAULT_TENANT_ID}
      ORDER BY c.order_index ASC, c.name ASC
    ` as (Category & { document_count: number })[]

    // Build tree structure
    const categoryMap = new Map<string, Category & { children: Category[]; document_count: number }>()
    const rootCategories: (Category & { children: Category[]; document_count: number })[] = []

    for (const cat of categories) {
      categoryMap.set(cat.id, { ...cat, children: [] })
    }

    for (const cat of categories) {
      const category = categoryMap.get(cat.id)!
      if (cat.parent_id && categoryMap.has(cat.parent_id)) {
        categoryMap.get(cat.parent_id)!.children.push(category)
      } else {
        rootCategories.push(category)
      }
    }

    return apiResponse({
      categories: rootCategories,
      flat: categories,
    })
  } catch (error) {
    logger.error('Error fetching categories', { error: error instanceof Error ? error : String(error) })
    return apiError('FETCH_ERROR', 'Failed to fetch categories', 500)
  }
}

export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request)

  if (!auth.valid) {
    return apiError('UNAUTHORIZED', 'Invalid or missing API key', 401)
  }

  if (!hasScope(auth.scopes, 'write')) {
    return apiError('FORBIDDEN', 'Insufficient permissions', 403)
  }

  try {
    const body: CategoryCreateInput = await request.json()

    if (!body.slug || !body.name) {
      return apiError('VALIDATION_ERROR', 'slug and name are required', 400)
    }

    // Check for slug collision
    const existing = await sql`
      SELECT id FROM categories WHERE tenant_id = ${auth.tenantId} AND slug = ${body.slug}
    `

    if (existing.length > 0) {
      return apiError('CONFLICT', 'A category with this slug already exists', 409)
    }

    // Validate parent exists if provided
    if (body.parent_id) {
      const parent = await sql`
        SELECT id FROM categories WHERE tenant_id = ${auth.tenantId} AND id = ${body.parent_id}
      `
      if (parent.length === 0) {
        return apiError('VALIDATION_ERROR', 'Parent category not found', 400)
      }
    }

    const result = await sql`
      INSERT INTO categories (
        tenant_id, parent_id, slug, name, description, icon, order_index, metadata
      ) VALUES (
        ${auth.tenantId},
        ${body.parent_id || null},
        ${body.slug},
        ${body.name},
        ${body.description || null},
        ${body.icon || null},
        ${body.order_index ?? 0},
        ${JSON.stringify(body.metadata || {})}
      )
      RETURNING *
    ` as Category[]

    const category = result[0]

    await logAudit(
      auth.tenantId,
      'category.created',
      'category',
      category.id,
      null,
      'api_key',
      { slug: category.slug },
      request.headers.get('x-forwarded-for'),
      request.headers.get('user-agent')
    )

    return apiResponse(category, undefined, 201)
  } catch (error) {
    logger.error('Error creating category', { error: error instanceof Error ? error : String(error) })
    return apiError('CREATE_ERROR', 'Failed to create category', 500)
  }
}
