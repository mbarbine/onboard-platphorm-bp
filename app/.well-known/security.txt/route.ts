import { NextResponse } from 'next/server'
import { sql, DEFAULT_TENANT_ID } from '@/lib/db'
import { SITE_NAME, SECURITY_EMAIL, ORG_URL } from '@/lib/site-config'

export const dynamic = 'force-dynamic'

async function getBaseUrl(): Promise<string> {
  try {
    const result = await sql`SELECT value FROM settings WHERE tenant_id = ${DEFAULT_TENANT_ID} AND key = 'base_url'`
    if (result[0]?.value) return JSON.parse(result[0].value as string)
  } catch { /* ignore */ }
  return process.env.NEXT_PUBLIC_BASE_URL || 'https://docs.platphormnews.com'
}

export async function GET() {
  const baseUrl = await getBaseUrl()

  const securityTxt = `# ${SITE_NAME} Security Policy
# https://securitytxt.org/

Contact: mailto:${SECURITY_EMAIL}
Expires: 2027-12-31T23:59:59.000Z
Preferred-Languages: en
Canonical: ${baseUrl}/.well-known/security.txt
Policy: ${baseUrl}/docs/security
Hiring: ${ORG_URL}/careers
`

  return new NextResponse(securityTxt, {
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
