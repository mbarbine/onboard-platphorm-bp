import { NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { apiResponse, apiError } from '@/lib/api-helpers'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, slug, domain } = body

    if (!name || !slug) {
      return apiError('VALIDATION_ERROR', 'Name and slug are required', 400)
    }

    const id = uuidv4()

    const result = await sql`
      INSERT INTO tenants (id, name, slug, domain)
      VALUES (${id}, ${name}, ${slug}, ${domain || null})
      RETURNING id, name, slug, domain
    `

    const tenant = result[0]

    // Create a Vercel domain if token and project ID are configured
    // Note: VERCEL_API_TOKEN and VERCEL_PROJECT_ID must be set in Vercel environment variables
    const vercelToken = process.env.VERCEL_API_TOKEN
    const vercelProjectId = process.env.VERCEL_PROJECT_ID
    const vercelTeamId = process.env.VERCEL_TEAM_ID

    if (vercelToken && vercelProjectId && domain) {
      try {
        let url = `https://api.vercel.com/v10/projects/${vercelProjectId}/domains`
        if (vercelTeamId) {
          url += `?teamId=${vercelTeamId}`
        }

        const domainRes = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${vercelToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: domain }),
        })

        if (!domainRes.ok) {
          const errorData = await domainRes.json()
          logger.error('Failed to create Vercel domain:', { errorData })
          // We don't fail the entire request, just log it
        } else {
          logger.info(`Successfully created Vercel domain ${domain}`)
        }
      } catch (err: unknown) {
        logger.error('Vercel API error:', { error: err instanceof Error ? err : String(err) })
      }
    }

    return apiResponse(tenant, undefined, 201)
  } catch (error: unknown) {
    logger.error('Error creating tenant:', { error: error instanceof Error ? error : String(error) })
    if (typeof error === 'object' && error !== null && 'code' in error && (error as any).code === '23505') { // Postgres unique violation
      return apiError('CONFLICT', 'Tenant with this slug already exists', 409)
    }
    return apiError('CREATE_ERROR', 'Failed to create tenant', 500)
  }
}
