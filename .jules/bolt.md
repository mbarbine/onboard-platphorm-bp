## 2024-04-01 - React.cache for redundant Next.js Server Component DB Queries
**Learning:** Next.js App Router only deduplicates `fetch()` calls by default. Direct database queries via a client like Neon (`await sql...`) are executed multiple times per request if called in multiple Server Components (e.g. layout + page).
**Action:** Use `React.cache()` to wrap expensive or frequently repeated database queries (like `getCategories()`) in Next.js Server Components to achieve per-request memoization, eliminating redundant DB calls.
