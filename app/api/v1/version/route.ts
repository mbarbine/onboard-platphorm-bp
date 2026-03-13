import { NextResponse } from 'next/server'

const VERSION = '1.0.0'
const BUILD = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'dev'
const TIMESTAMP = process.env.VERCEL_GIT_COMMIT_DATE || new Date().toISOString()

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      version: VERSION,
      build: BUILD,
      timestamp: TIMESTAMP,
      runtime: {
        node: process.version,
        nextjs: '16.x',
        environment: process.env.NODE_ENV,
      },
      compatibility: {
        api: 'v1',
        mcp: '1.0',
        wcag: '2.2',
      },
      vercel: {
        deploymentUrl: process.env.VERCEL_URL || null,
        region: process.env.VERCEL_REGION || null,
        environment: process.env.VERCEL_ENV || null,
      },
    },
  }, {
    headers: {
      'X-Version': VERSION,
      'X-Build': BUILD,
    },
  })
}
