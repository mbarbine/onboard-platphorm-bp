import { NextRequest } from 'next/server'
import { sql, DEFAULT_TENANT_ID, Document } from '@/lib/db'
import { apiResponse, apiError, getPaginationParams } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')
  const { page, per_page, offset } = getPaginationParams(searchParams)
  const category = searchParams.get('category')
  const tag = searchParams.get('tag')

  if (!query || query.length < 2) {
    return apiError('VALIDATION_ERROR', 'Query must be at least 2 characters', 400)
  }

  if (query.length > 500) {
    return apiError('VALIDATION_ERROR', 'Query must not exceed 500 characters', 400)
  }

  try {
    let results: (Document & { rank: number; headline: string })[]
    let totalResult: { count: number }[]

    const baseQuery = `
      SELECT 
        d.*,
        ts_rank(si.content_vector, plainto_tsquery('english', $1)) as rank,
        ts_headline('english', d.content, plainto_tsquery('english', $1), 
          'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=25') as headline
      FROM documents d
      JOIN search_index si ON d.id = si.document_id
      WHERE d.tenant_id = $2
        AND d.deleted_at IS NULL
        AND d.status = 'published'
        AND si.content_vector @@ plainto_tsquery('english', $1)
    `

    if (category && tag) {
      results = await sql`
        SELECT 
          d.*,
          ts_rank(si.content_vector, plainto_tsquery('english', ${query})) as rank,
          ts_headline('english', d.content, plainto_tsquery('english', ${query}), 
            'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=25') as headline
        FROM documents d
        JOIN search_index si ON d.id = si.document_id
        WHERE d.tenant_id = ${DEFAULT_TENANT_ID}
          AND d.deleted_at IS NULL
          AND d.status = 'published'
          AND si.content_vector @@ plainto_tsquery('english', ${query})
          AND d.category = ${category}
          AND d.tags @> ${JSON.stringify([tag])}::jsonb
        ORDER BY rank DESC
        LIMIT ${per_page} OFFSET ${offset}
      ` as (Document & { rank: number; headline: string })[]

      totalResult = await sql`
        SELECT COUNT(*)::int as count
        FROM documents d
        JOIN search_index si ON d.id = si.document_id
        WHERE d.tenant_id = ${DEFAULT_TENANT_ID}
          AND d.deleted_at IS NULL
          AND d.status = 'published'
          AND si.content_vector @@ plainto_tsquery('english', ${query})
          AND d.category = ${category}
          AND d.tags @> ${JSON.stringify([tag])}::jsonb
      ` as { count: number }[]
    } else if (category) {
      results = await sql`
        SELECT 
          d.*,
          ts_rank(si.content_vector, plainto_tsquery('english', ${query})) as rank,
          ts_headline('english', d.content, plainto_tsquery('english', ${query}), 
            'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=25') as headline
        FROM documents d
        JOIN search_index si ON d.id = si.document_id
        WHERE d.tenant_id = ${DEFAULT_TENANT_ID}
          AND d.deleted_at IS NULL
          AND d.status = 'published'
          AND si.content_vector @@ plainto_tsquery('english', ${query})
          AND d.category = ${category}
        ORDER BY rank DESC
        LIMIT ${per_page} OFFSET ${offset}
      ` as (Document & { rank: number; headline: string })[]

      totalResult = await sql`
        SELECT COUNT(*)::int as count
        FROM documents d
        JOIN search_index si ON d.id = si.document_id
        WHERE d.tenant_id = ${DEFAULT_TENANT_ID}
          AND d.deleted_at IS NULL
          AND d.status = 'published'
          AND si.content_vector @@ plainto_tsquery('english', ${query})
          AND d.category = ${category}
      ` as { count: number }[]
    } else if (tag) {
      results = await sql`
        SELECT 
          d.*,
          ts_rank(si.content_vector, plainto_tsquery('english', ${query})) as rank,
          ts_headline('english', d.content, plainto_tsquery('english', ${query}), 
            'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=25') as headline
        FROM documents d
        JOIN search_index si ON d.id = si.document_id
        WHERE d.tenant_id = ${DEFAULT_TENANT_ID}
          AND d.deleted_at IS NULL
          AND d.status = 'published'
          AND si.content_vector @@ plainto_tsquery('english', ${query})
          AND d.tags @> ${JSON.stringify([tag])}::jsonb
        ORDER BY rank DESC
        LIMIT ${per_page} OFFSET ${offset}
      ` as (Document & { rank: number; headline: string })[]

      totalResult = await sql`
        SELECT COUNT(*)::int as count
        FROM documents d
        JOIN search_index si ON d.id = si.document_id
        WHERE d.tenant_id = ${DEFAULT_TENANT_ID}
          AND d.deleted_at IS NULL
          AND d.status = 'published'
          AND si.content_vector @@ plainto_tsquery('english', ${query})
          AND d.tags @> ${JSON.stringify([tag])}::jsonb
      ` as { count: number }[]
    } else {
      results = await sql`
        SELECT 
          d.*,
          ts_rank(si.content_vector, plainto_tsquery('english', ${query})) as rank,
          ts_headline('english', d.content, plainto_tsquery('english', ${query}), 
            'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=25') as headline
        FROM documents d
        JOIN search_index si ON d.id = si.document_id
        WHERE d.tenant_id = ${DEFAULT_TENANT_ID}
          AND d.deleted_at IS NULL
          AND d.status = 'published'
          AND si.content_vector @@ plainto_tsquery('english', ${query})
        ORDER BY rank DESC
        LIMIT ${per_page} OFFSET ${offset}
      ` as (Document & { rank: number; headline: string })[]

      totalResult = await sql`
        SELECT COUNT(*)::int as count
        FROM documents d
        JOIN search_index si ON d.id = si.document_id
        WHERE d.tenant_id = ${DEFAULT_TENANT_ID}
          AND d.deleted_at IS NULL
          AND d.status = 'published'
          AND si.content_vector @@ plainto_tsquery('english', ${query})
      ` as { count: number }[]
    }

    const total = totalResult[0]?.count || 0

    // Return formatted results
    const formattedResults = results.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      description: r.description,
      category: r.category,
      tags: r.tags,
      author_name: r.author_name,
      source_identifier: r.source_identifier,
      headline: r.headline,
      relevance: r.rank,
      published_at: r.published_at,
    }))

    return apiResponse(
      {
        query,
        results: formattedResults,
      },
      {
        page,
        per_page,
        total,
        total_pages: Math.ceil(total / per_page),
      }
    )
  } catch (error) {
    console.error('Error searching documents:', error)
    return apiError('SEARCH_ERROR', 'Failed to search documents', 500)
  }
}
