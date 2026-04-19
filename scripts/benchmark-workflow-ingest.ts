const simulateDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const fetchMock = async (url: string) => {
  await simulateDelay(100); // 100ms network delay
  return {
    ok: true,
    text: async () => `<html><head><title>Page ${url}</title><meta name="description" content="Desc ${url}"></head><body><p>Content for ${url}</p></body></html>`,
    status: 200,
  };
};

const generateSEOMetadataMock = async () => {
  await simulateDelay(10);
  return { ogTitle: 'SEO', ogDescription: 'SEO', ogImage: '', canonicalUrl: '', readingTimeMinutes: 1, wordCount: 10 };
};

const sqlMock = async (strings: TemplateStringsArray, ...values: any[]) => {
  await simulateDelay(10);
  return [{ id: '1', slug: 'slug' }];
};

// --- BASELINE ---
async function baselineWorkflowIngest(urls: string[]) {
  const results = [];

  for (const url of urls.slice(0, 10)) {
    try {
      const response = await fetchMock(url);
      if (!response.ok) {
        results.push({ url, status: 'error' });
        continue;
      }
      const html = await response.text();
      const seo = await generateSEOMetadataMock();
      const insertResult = await sqlMock``;
      results.push({ url, status: 'success' });
    } catch (e) {
      results.push({ url, status: 'error' });
    }
  }
  return results;
}

// --- OPTIMIZED ---
async function optimizedWorkflowIngest(urls: string[]) {
  const results: any[] = [];

  await Promise.all(urls.slice(0, 10).map(async (url) => {
    try {
      const response = await fetchMock(url);
      if (!response.ok) {
        results.push({ url, status: 'error' });
        return;
      }
      const html = await response.text();
      const seo = await generateSEOMetadataMock();
      const insertResult = await sqlMock``;
      results.push({ url, status: 'success' });
    } catch (e) {
      results.push({ url, status: 'error' });
    }
  }));
  return results;
}

async function run() {
  const urls = Array.from({ length: 10 }, (_, i) => `http://example.com/${i}`);

  console.log('--- Baseline ---');
  let start = Date.now();
  await baselineWorkflowIngest(urls);
  let duration = Date.now() - start;
  console.log(`Time: ${duration}ms`);
  const baselineTime = duration;

  console.log('--- Optimized ---');
  start = Date.now();
  await optimizedWorkflowIngest(urls);
  duration = Date.now() - start;
  console.log(`Time: ${duration}ms`);

  const improvement = ((baselineTime - duration) / baselineTime) * 100;
  console.log(`Improvement: ${improvement.toFixed(2)}%`);
}

run();
