import { performance } from 'perf_hooks';

// Mock generateSEOMetadata to simulate CPU/async work
const generateSEOMetadata = async (doc: any, baseUrl: string) => {
  await new Promise(resolve => setTimeout(resolve, 5)); // simulate 5ms work
  return {
    ogTitle: `${doc.title} - SEO`,
    ogDescription: doc.description,
    ogImage: 'image.png',
    canonicalUrl: `${baseUrl}/${doc.slug}`,
    readingTimeMinutes: 2,
    wordCount: 500,
  };
};

// Mock SQL for SELECT and UPDATE
const sql = async (strings: any, ...values: any[]) => {
  const query = strings.join('?');
  if (query.includes('SELECT')) {
    // Return 50 mock documents
    return Array.from({ length: 50 }).map((_, i) => ({
      id: `doc-${i}`,
      title: `Document ${i}`,
      description: `Description ${i}`,
      content: `Content ${i}`,
      slug: `slug-${i}`,
      category: 'test'
    }));
  } else if (query.includes('UPDATE')) {
    // Simulate DB update latency (10ms)
    await new Promise(resolve => setTimeout(resolve, 10));
    return [];
  }
  return [];
};

const DEFAULT_TENANT_ID = 'test-tenant';

// The function to benchmark (we will swap this implementation conceptually)
async function executeSEORefresh(input: Record<string, unknown>, baseUrl: string) {
  const { document_ids, category, all } = input as {
    document_ids?: string[]
    category?: string
    all?: boolean
  }

  let documents: any[];
  if (all) {
    documents = await sql`
      SELECT id, slug, title, description, content, category
      FROM documents WHERE tenant_id = ${DEFAULT_TENANT_ID} AND deleted_at IS NULL
      LIMIT 100
    `
  } else {
    throw new Error('Provide all=true for benchmark');
  }

  const CHUNK_SIZE = 10
  const seoUpdates = []

  for (let i = 0; i < documents.length; i += CHUNK_SIZE) {
    const chunk = documents.slice(i, i + CHUNK_SIZE)
    const chunkUpdates = await Promise.all(
      chunk.map(async (doc) => {
        const seo = await generateSEOMetadata({
          title: doc.title as string,
          description: doc.description as string || '',
          content: doc.content as string,
          slug: doc.slug as string,
          category: doc.category as string,
        }, baseUrl)
        return { id: doc.id, seo }
      })
    )
    seoUpdates.push(...chunkUpdates)
  }

  if (seoUpdates.length > 0) {
    const ids = seoUpdates.map(u => u.id as string)
    const ogTitles = seoUpdates.map(u => u.seo.ogTitle)
    const ogDescriptions = seoUpdates.map(u => u.seo.ogDescription)
    const ogImages = seoUpdates.map(u => u.seo.ogImage)
    const canonicalUrls = seoUpdates.map(u => u.seo.canonicalUrl)
    const readingTimes = seoUpdates.map(u => u.seo.readingTimeMinutes)
    const wordCounts = seoUpdates.map(u => u.seo.wordCount)

    await sql`
      UPDATE documents AS d
      SET
        og_title = u.og_title,
        og_description = u.og_description,
        og_image = u.og_image,
        canonical_url = u.canonical_url,
        reading_time_minutes = u.reading_time_minutes,
        word_count = u.word_count,
        updated_at = NOW()
      FROM UNNEST(
        ${ids}::uuid[],
        ${ogTitles}::text[],
        ${ogDescriptions}::text[],
        ${ogImages}::text[],
        ${canonicalUrls}::text[],
        ${readingTimes}::int[],
        ${wordCounts}::int[]
      ) AS u(id, og_title, og_description, og_image, canonical_url, reading_time_minutes, word_count)
      WHERE d.id = u.id
    `
  }

  const updated = documents.length

  return { updated }
}

async function runBenchmark() {
  console.log('Running executeSEORefresh benchmark (Optimized)...');

  // Warmup
  await executeSEORefresh({ all: true }, 'http://localhost');

  const iterations = 3;
  let totalTime = 0;

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await executeSEORefresh({ all: true }, 'http://localhost');
    const end = performance.now();
    totalTime += (end - start);
    console.log(`Iteration ${i + 1}: ${(end - start).toFixed(2)} ms`);
  }

  console.log(`Average time: ${(totalTime / iterations).toFixed(2)} ms`);
}

runBenchmark().catch(console.error);
