/**
 * Version Information
 * 
 * Exports build-time version data for runtime access.
 */

export const version = '1.0.0'
export const build = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'dev'
export const timestamp = process.env.VERCEL_GIT_COMMIT_DATE || new Date().toISOString()
export const environment = process.env.NODE_ENV || 'development'

export const compatibility = {
  api: 'v1',
  mcp: '1.0',
  wcag: '2.2',
  node: '>=20.0.0',
  nextjs: '>=15.0.0',
}

export const vercel = {
  deploymentUrl: process.env.VERCEL_URL,
  region: process.env.VERCEL_REGION,
  env: process.env.VERCEL_ENV,
  gitCommit: process.env.VERCEL_GIT_COMMIT_SHA,
  gitBranch: process.env.VERCEL_GIT_COMMIT_REF,
}

export default {
  version,
  build,
  timestamp,
  environment,
  compatibility,
  vercel,
}
