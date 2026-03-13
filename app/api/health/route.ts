import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const startTime = Date.now()
  
  try {
    await sql`SELECT 1`
    const dbLatency = Date.now() - startTime

    return NextResponse.json({
      status: 'healthy',
      version: process.env.npm_package_version || '1.0.0',
      timestamp: new Date().toISOString(),
      checks: {
        database: {
          status: 'healthy',
          latency_ms: dbLatency,
        },
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        version: process.env.npm_package_version || '1.0.0',
        timestamp: new Date().toISOString(),
        checks: {
          database: {
            status: 'unhealthy',
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        },
      },
      { status: 503 }
    )
  }
}
