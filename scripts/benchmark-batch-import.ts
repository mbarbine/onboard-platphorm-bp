const simulateDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function executeContentPipelineMock(input: any) {
  // Simulate network fetch and DB operations
  await simulateDelay(100);
  return { id: `doc-${input.url}`, status: 'success' };
}

async function executeBatchImportSequential(urls: string[]) {
  const results = [];
  for (const url of urls.slice(0, 20)) {
    try {
      const result = await executeContentPipelineMock({ url });
      results.push({ ...result, url, status: 'success' });
    } catch (error) {
      results.push({ url, status: 'error' });
    }
  }
  return results;
}

// Write the concurrent version to compare
async function executeBatchImportConcurrent(urls: string[]) {
  const results: any[] = [];
  const chunkLimit = 5;
  const urlsToProcess = urls.slice(0, 20);

  for (let i = 0; i < urlsToProcess.length; i += chunkLimit) {
    const chunk = urlsToProcess.slice(i, i + chunkLimit);
    const chunkResults = await Promise.all(
      chunk.map(async (url) => {
        try {
          const result = await executeContentPipelineMock({ url });
          return { ...result, url, status: 'success' };
        } catch (error) {
          return { url, status: 'error' };
        }
      })
    );
    results.push(...chunkResults);
  }
  return results;
}

async function runBenchmark() {
  const urls = Array.from({ length: 20 }, (_, i) => `http://example.com/page${i}`);

  console.log('--- Sequential Benchmark ---');
  let start = Date.now();
  await executeBatchImportSequential(urls);
  let duration = Date.now() - start;
  console.log(`Sequential Total Time: ${duration}ms`);

  console.log('\n--- Concurrent Benchmark ---');
  start = Date.now();
  await executeBatchImportConcurrent(urls);
  duration = Date.now() - start;
  console.log(`Concurrent Total Time: ${duration}ms`);
}

runBenchmark();
