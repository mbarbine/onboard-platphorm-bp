/**
 * Onboard API Integration Tests
 * 
 * Run with: npx tsx scripts/test-api.ts
 */

import { BASE_URL } from '../lib/site-config'

interface TestResult {
  name: string
  passed: boolean
  error?: string
  duration: number
}

const results: TestResult[] = []

async function runTest(name: string, fn: () => Promise<void>) {
  const start = Date.now()
  try {
    await fn()
    results.push({ name, passed: true, duration: Date.now() - start })
    console.log(`✅ ${name}`)
  } catch (error) {
    results.push({ 
      name, 
      passed: false, 
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start 
    })
    console.log(`❌ ${name}: ${error instanceof Error ? error.message : error}`)
  }
}

async function testHealthEndpoint() {
  const res = await fetch(`${BASE_URL}/api/health`)
  if (!res.ok) throw new Error(`Status: ${res.status}`)
  const data = await res.json()
  if (data.status !== 'healthy') throw new Error('Health check failed: ' + JSON.stringify(data, null, 2))
  if (!data.version) throw new Error('Missing version: ' + JSON.stringify(data, null, 2))
  if (!data.database) throw new Error('Missing database status: ' + JSON.stringify(data, null, 2))
}

async function testListDocuments() {
  const res = await fetch(`${BASE_URL}/api/v1/documents`)
  if (!res.ok) throw new Error(`Status: ${res.status}`)
  const data = await res.json()
  if (!data.success) throw new Error('Response not successful: ' + JSON.stringify(data, null, 2))
  if (!Array.isArray(data.data)) throw new Error('Data is not an array: ' + JSON.stringify(data, null, 2))
  if (!data.meta || typeof data.meta.total !== 'number') throw new Error('Missing meta.total: ' + JSON.stringify(data, null, 2))
}

async function testListDocumentsWithPagination() {
  const res = await fetch(`${BASE_URL}/api/v1/documents?page=1&per_page=5`)
  if (!res.ok) throw new Error(`Status: ${res.status}`)
  const data = await res.json()
  if (!data.success) throw new Error('Response not successful: ' + JSON.stringify(data, null, 2))
  if (data.data.length > 5) throw new Error('Pagination limit not respected: ' + JSON.stringify(data, null, 2))
  if (data.meta.per_page !== 5) throw new Error('per_page meta incorrect: ' + JSON.stringify(data, null, 2))
}

async function testListDocumentsWithStatus() {
  const res = await fetch(`${BASE_URL}/api/v1/documents?status=published`)
  if (!res.ok) throw new Error(`Status: ${res.status}`)
  const data = await res.json()
  if (!data.success) throw new Error('Response not successful: ' + JSON.stringify(data, null, 2))
  for (const doc of data.data) {
    if (doc.status !== 'published') throw new Error('Status filter not working: ' + JSON.stringify(data, null, 2))
  }
}

async function testGetDocumentBySlug() {
  // First get a document slug
  const listRes = await fetch(`${BASE_URL}/api/v1/documents?per_page=1`)
  const listData = await listRes.json()
  if (!listData.data?.[0]?.slug) throw new Error('No documents to test: ' + JSON.stringify(listData, null, 2))
  
  const slug = listData.data[0].slug
  const res = await fetch(`${BASE_URL}/api/v1/documents/${slug}`)
  if (!res.ok) throw new Error(`Status: ${res.status}`)
  const data = await res.json()
  if (!data.success) throw new Error('Response not successful: ' + JSON.stringify(data, null, 2))
  if (data.data.slug !== slug) throw new Error('Slug mismatch: ' + JSON.stringify(data, null, 2))
  if (!data.data.content) throw new Error('Missing content: ' + JSON.stringify(data, null, 2))
}

async function testGetNonExistentDocument() {
  const res = await fetch(`${BASE_URL}/api/v1/documents/non-existent-slug-12345`)
  if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`)
  const data = await res.json()
  if (data.success !== false) throw new Error('Should not be successful: ' + JSON.stringify(data, null, 2))
}

async function testListCategories() {
  const res = await fetch(`${BASE_URL}/api/v1/categories`)
  if (!res.ok) throw new Error(`Status: ${res.status}`)
  const data = await res.json()
  if (!data.success) throw new Error('Response not successful: ' + JSON.stringify(data, null, 2))
  if (!Array.isArray(data.data)) throw new Error('Data is not an array: ' + JSON.stringify(data, null, 2))
}

async function testSearchDocuments() {
  const res = await fetch(`${BASE_URL}/api/v1/search?q=introduction`)
  if (!res.ok) throw new Error(`Status: ${res.status}`)
  const data = await res.json()
  if (!data.success) throw new Error('Response not successful: ' + JSON.stringify(data, null, 2))
  if (!Array.isArray(data.data)) throw new Error('Data is not an array: ' + JSON.stringify(data, null, 2))
}

async function testCreateSubmission() {
  const res = await fetch(`${BASE_URL}/api/v1/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source_url: 'https://test.example.com/test-' + Date.now(),
      title: 'Test Submission ' + Date.now(),
      content: '# Test Content\n\nThis is a test submission.',
      author_name: 'Test Author',
      author_email: 'test@example.com'
    })
  })
  if (!res.ok && res.status !== 201) throw new Error(`Status: ${res.status}`)
  const data = await res.json()
  if (!data.success) throw new Error('Response not successful: ' + JSON.stringify(data, null, 2))
  if (!data.data.id) throw new Error('Missing submission ID: ' + JSON.stringify(data, null, 2))
  if (data.data.status !== 'pending') throw new Error('Status should be pending: ' + JSON.stringify(data, null, 2))
}

async function testIngestEndpointInfo() {
  const res = await fetch(`${BASE_URL}/api/v1/ingest`)
  if (!res.ok) throw new Error(`Status: ${res.status}`)
  const data = await res.json()
  if (!data.endpoint) throw new Error('Missing endpoint info: ' + JSON.stringify(data, null, 2))
  if (!data.body?.url) throw new Error('Missing URL parameter info: ' + JSON.stringify(data, null, 2))
}

async function testMCPToolsList() {
  const res = await fetch(`${BASE_URL}/api/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list'
    })
  })
  if (!res.ok) throw new Error(`Status: ${res.status}`)
  const data = await res.json()
  if (data.error) throw new Error(data.error.message + ': ' + JSON.stringify(data, null, 2))
  if (!data.result?.tools) throw new Error('Missing tools list: ' + JSON.stringify(data, null, 2))
  if (!Array.isArray(data.result.tools)) throw new Error('Tools is not an array: ' + JSON.stringify(data, null, 2))
  
  const toolNames = data.result.tools.map((t: { name: string }) => t.name)
  const requiredTools = ['list_documents', 'get_document', 'search_documents', 'submit_content']
  for (const tool of requiredTools) {
    if (!toolNames.includes(tool)) throw new Error(`Missing tool: ${tool}: ` + JSON.stringify(data, null, 2))
  }
}

async function testMCPListDocuments() {
  const res = await fetch(`${BASE_URL}/api/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'list_documents',
        arguments: { limit: 5 }
      }
    })
  })
  if (!res.ok) throw new Error(`Status: ${res.status}`)
  const data = await res.json()
  if (data.error) throw new Error(data.error.message + ': ' + JSON.stringify(data, null, 2))
  if (!data.result?.content) throw new Error('Missing content: ' + JSON.stringify(data, null, 2))
}

async function testMCPResourcesList() {
  const res = await fetch(`${BASE_URL}/api/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 3,
      method: 'resources/list'
    })
  })
  if (!res.ok) throw new Error(`Status: ${res.status}`)
  const data = await res.json()
  if (data.error) throw new Error(data.error.message + ': ' + JSON.stringify(data, null, 2))
  if (!data.result?.resources) throw new Error('Missing resources list: ' + JSON.stringify(data, null, 2))
}

async function testLLMSTxt() {
  const res = await fetch(`${BASE_URL}/llms.txt`)
  if (!res.ok) throw new Error(`Status: ${res.status}`)
  const text = await res.text()
  if (!text.includes('Onboard')) throw new Error('Missing site identifier: ' + text.slice(0, 100))
  if (!text.includes('/api/v1')) throw new Error('Missing API reference: ' + text.slice(0, 100))
}

async function testLLMSFullTxt() {
  const res = await fetch(`${BASE_URL}/llms-full.txt`)
  if (!res.ok) throw new Error(`Status: ${res.status}`)
  const text = await res.text()
  if (!text.includes('Onboard')) throw new Error('Missing site identifier: ' + text.slice(0, 100))
  if (text.length < 500) throw new Error('Content too short: ' + text.slice(0, 100))
}

async function testLLMSIndexJson() {
  const res = await fetch(`${BASE_URL}/llms-index.json`)
  if (!res.ok) throw new Error(`Status: ${res.status}`)
  const data = await res.json()
  if (!data.name) throw new Error('Missing name: ' + JSON.stringify(data, null, 2))
  if (!data.api) throw new Error('Missing API info: ' + JSON.stringify(data, null, 2))
  if (!data.mcp) throw new Error('Missing MCP info: ' + JSON.stringify(data, null, 2))
}

async function testSitemapXml() {
  const res = await fetch(`${BASE_URL}/sitemap.xml`)
  if (!res.ok) throw new Error(`Status: ${res.status}`)
  const text = await res.text()
  if (!text.includes('<?xml')) throw new Error('Invalid XML: ' + text.slice(0, 100))
  if (!text.includes('<urlset')) throw new Error('Missing urlset: ' + text.slice(0, 100))
}

async function testRssFeed() {
  const res = await fetch(`${BASE_URL}/rss.xml`)
  if (!res.ok) throw new Error(`Status: ${res.status}`)
  const text = await res.text()
  if (!text.includes('<?xml')) throw new Error('Invalid XML: ' + text.slice(0, 100))
  if (!text.includes('<rss') && !text.includes('<feed')) throw new Error('Missing RSS/Atom feed: ' + text.slice(0, 100))
}

async function testRobotsTxt() {
  const res = await fetch(`${BASE_URL}/robots.txt`)
  if (!res.ok) throw new Error(`Status: ${res.status}`)
  const text = await res.text()
  if (!text.includes('User-agent')) throw new Error('Missing User-agent: ' + text.slice(0, 100))
  if (!text.includes('Sitemap')) throw new Error('Missing Sitemap: ' + text.slice(0, 100))
}

async function testAPIDocsEndpoint() {
  const res = await fetch(`${BASE_URL}/api/docs`)
  if (!res.ok) throw new Error(`Status: ${res.status}`)
  const data = await res.json()
  if (!data.openapi) throw new Error('Missing OpenAPI version: ' + JSON.stringify(data, null, 2))
  if (!data.paths) throw new Error('Missing paths: ' + JSON.stringify(data, null, 2))
}

async function main() {
  console.log('\n🧪 Onboard API Integration Tests\n')
  console.log(`Testing: ${BASE_URL}\n`)

  // Health & Discovery
  await runTest('Health endpoint returns healthy status', testHealthEndpoint)
  
  // Documents API
  await runTest('List documents returns array', testListDocuments)
  await runTest('List documents with pagination', testListDocumentsWithPagination)
  await runTest('List documents with status filter', testListDocumentsWithStatus)
  await runTest('Get document by slug', testGetDocumentBySlug)
  await runTest('Get non-existent document returns 404', testGetNonExistentDocument)
  
  // Categories API
  await runTest('List categories returns array', testListCategories)
  
  // Search API
  await runTest('Search documents', testSearchDocuments)
  
  // Submissions API
  await runTest('Create submission', testCreateSubmission)
  
  // Ingest API
  await runTest('Ingest endpoint info', testIngestEndpointInfo)
  
  // MCP API
  await runTest('MCP tools/list returns tools', testMCPToolsList)
  await runTest('MCP list_documents tool works', testMCPListDocuments)
  await runTest('MCP resources/list returns resources', testMCPResourcesList)
  
  // LLM Discovery Files
  await runTest('llms.txt is accessible', testLLMSTxt)
  await runTest('llms-full.txt is accessible', testLLMSFullTxt)
  await runTest('llms-index.json is valid', testLLMSIndexJson)
  
  // SEO/Discovery
  await runTest('sitemap.xml is valid XML', testSitemapXml)
  await runTest('rss.xml is valid feed', testRssFeed)
  await runTest('robots.txt is valid', testRobotsTxt)
  await runTest('API docs endpoint returns OpenAPI spec', testAPIDocsEndpoint)

  // Summary
  console.log('\n' + '='.repeat(50))
  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`)
  
  if (failed > 0) {
    console.log('❌ Failed tests:')
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   - ${r.name}: ${r.error}`)
    })
    process.exit(1)
  }
  
  console.log('✅ All tests passed!\n')
}

main().catch(console.error)
