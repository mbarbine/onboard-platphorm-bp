import { sql, DEFAULT_TENANT_ID } from '@/lib/db'

async function benchmark() {
  const urls = Array.from({ length: 10 }, (_, i) => `https://example.com/page${i}`)
  const params = { urls }

  // Need to mock fetch and route
}
