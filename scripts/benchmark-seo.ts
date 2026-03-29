/**
 * Benchmark SEO Regeneration
 *
 * Run with: npx tsx scripts/benchmark-seo.ts
 */

// Mock DB
const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
let queryCount = 0;
const simulateDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function sql(strings: TemplateStringsArray, ...values: any[]) {
  queryCount++;
  const query = strings.join('?');
  // console.log(`[SQL] ${query}`);
  await simulateDelay(10); // 10ms simulated latency

  if (query.includes('SELECT slug FROM documents')) {
    return Array.from({ length: 50 }, (_, i) => ({ slug: `doc-${i}` }));
  }

  if (query.includes('SELECT slug, title, description, content')) {
    return [{
      slug: 'doc-X',
      title: 'Title X',
      description: 'Desc X',
      content: 'Content X',
      category: 'cat-X',
      tags: ['tag-X'],
      source_url: 'http://example.com',
      author_name: 'Author X',
      published_at: new Date()
    }];
  }

  return [];
}

// Mock SEO Generator
async function generateSEOMetadata(doc: any, baseUrl: string) {
  return {
    ogTitle: doc.title,
    ogDescription: doc.description,
    ogImage: `${baseUrl}/og`,
    twitterCard: 'summary',
    canonicalUrl: `${baseUrl}/docs/${doc.slug}`,
    readingTimeMinutes: 1,
    wordCount: 100,
    emojiSummary: '📄'
  };
}

async function updateDocumentSEO(slug: string, baseUrl: string) {
  const docs = await sql`
    SELECT slug, title, description, content, category, tags,
           source_url, author_name, published_at
    FROM documents
    WHERE slug = ${slug} AND tenant_id = ${DEFAULT_TENANT_ID}
  `;

  if (docs.length === 0) return;

  const doc = docs[0];
  const seo = await generateSEOMetadata(doc, baseUrl);

  await sql`
    UPDATE documents SET og_title = ${seo.ogTitle} WHERE slug = ${slug}
  `;
}

// Current Implementation logic
async function regenerate_seo_all() {
  const baseUrl = 'https://docs.example.com';
  const docs = await sql`SELECT slug FROM documents WHERE tenant_id = ${DEFAULT_TENANT_ID} AND deleted_at IS NULL`;
  for (const doc of docs) {
    await updateDocumentSEO(doc.slug as string, baseUrl);
  }
  return { regenerated: docs.length };
}

async function runBenchmark() {
  console.log('--- Baseline SEO Regeneration Benchmark ---');
  queryCount = 0;
  const start = Date.now();

  const result = await regenerate_seo_all();

  const duration = Date.now() - start;
  console.log(`Regenerated: ${result.regenerated} documents`);
  console.log(`Total Queries: ${queryCount}`);
  console.log(`Total Time: ${duration}ms`);
  console.log('-------------------------------------------');
}

runBenchmark();
