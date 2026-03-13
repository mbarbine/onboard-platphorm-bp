# PACKAGES

> Ecosystem reference for the Platphorm News / OpenDocs stack.  
> Use this as a baseline when bootstrapping new projects in the ecosystem.  
> All version pins here reflect the live state of this repo; check `package.json`
> for the canonical source of truth before copying ranges.

---

## Contents

1. [Runtime & Framework](#1-runtime--framework)
2. [Vercel Platform](#2-vercel-platform)
3. [MCP / AI Protocol](#3-mcp--ai-protocol)
4. [UI Components — Radix](#4-ui-components--radix)
5. [Styling](#5-styling)
6. [Forms & Validation](#6-forms--validation)
7. [Data & Database](#7-data--database)
8. [Utilities](#8-utilities)
9. [Dev & Testing](#9-dev--testing)
10. [Standards & Compliance](#10-standards--compliance)
11. [Upgrade Guidance](#11-upgrade-guidance)

---

## 1. Runtime & Framework

| Package | Version | Purpose | License |
|---|---|---|---|
| `next` | 16.1.6 | App Router, Turbopack, RSC, Edge runtime | MIT |
| `react` | 19.2.4 | UI runtime with concurrent features | MIT |
| `react-dom` | 19.2.4 | DOM renderer | MIT |
| `typescript` | 5.7.3 | Static typing, strict mode | Apache-2.0 |

**Notes:**
- Next.js 16 App Router is the required pattern — no `pages/` directory.
- All routes use `export const runtime = 'edge'` or `force-dynamic` server
  functions; no static ISR that would bypass rate-limiting.
- React 19 concurrent features (`use`, `useOptimistic`, `useTransition`) are
  available and encouraged.

---

## 2. Vercel Platform

These packages are the default integration layer for all Platphorm News projects
deployed on Vercel. Add them by default; opt out only with documented rationale.

| Package | Version | Purpose | Default |
|---|---|---|---|
| `@vercel/analytics` | 1.6.1 | Web vitals + pageview telemetry | **on** |
| `@vercel/speed-insights` | ^1.3.1 | Core Web Vitals RUM | **on** |
| `@vercel/og` | ^0.11.1 | Edge-rendered OG image generation | **on** |
| `@vercel/mcp-adapter` | ^0.3.2 | MCP protocol adapter stub (Vercel) | **on** |
| `@vercel/nft` | ^0.29.5 | Node File Tracing for minimal deploys | build |
| `@vercel/error-utils` | ^2.0.3 | Typed error parsing helpers | as-needed |
| `@vercel/oidc` | ^3.2.0 | OIDC tokens for Vercel deployments | as-needed |
| `@vercel/functions` | ^2.4.7 | Vercel Functions runtime helpers | as-needed |
| `@vercel/edge` | ^1.2.2 | Edge runtime utilities (geolocation etc.) | as-needed |
| `@vercel/routing-utils` | ^3.2.0 | URL routing helpers shared with `vercel.json` | as-needed |
| `@vercel/toolbar` | ^0.1.x | Vercel deployment toolbar | **off** |

### `@vercel/toolbar` — disabled by default

The toolbar ships a floating UI overlay useful during preview deployments.
It **must not** appear in production. Control it with:

```bash
# .env.local (never commit)
NEXT_PUBLIC_VERCEL_TOOLBAR_ENABLED=false
```

```tsx
// app/layout.tsx — only mount in preview
import { VercelToolbar } from '@vercel/toolbar/next'

{process.env.VERCEL_ENV === 'preview' && <VercelToolbar />}
```

### `@vercel/og` vs `next/og`

Always prefer `@vercel/og` over `next/og`. They share the same `ImageResponse`
API but `@vercel/og` is the Vercel-maintained fork with faster cold-starts and
ongoing improvements.

```tsx
// ✅ preferred
import { ImageResponse } from '@vercel/og'

// ❌ avoid
import { ImageResponse } from 'next/og'
```

---

## 3. MCP / AI Protocol

| Package | Version | Purpose |
|---|---|---|
| `@modelcontextprotocol/sdk` | ^1.27.1 | Official MCP SDK — `McpServer`, transports |
| `@vercel/mcp-adapter` | ^0.3.2 | Vercel-specific MCP routing adapter |

### Using the MCP SDK

All new MCP endpoints must use `McpServer` + `WebStandardStreamableHTTPServerTransport`
from `@modelcontextprotocol/sdk`. The hand-rolled JSON-RPC approach is deprecated inside
this ecosystem.

```ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport }
  from '@modelcontextprotocol/sdk/server/web.js'

const server = new McpServer({ name: 'my-service', version: '1.0.0' })

server.tool('my_tool', 'Description', { param: z.string() }, async ({ param }) => ({
  content: [{ type: 'text', text: `Result: ${param}` }],
}))

export async function POST(req: Request) {
  const transport = new WebStandardStreamableHTTPServerTransport({ endpoint: '/api/mcp' })
  await server.connect(transport)
  return transport.handleRequest(req)
}
```

`@vercel/mcp-adapter` wraps this for Vercel's routing layer — use it when you need
session management or the `/sse` fallback transport.

---

## 4. UI Components — Radix

All component primitives come from [`@radix-ui`](https://www.radix-ui.com/).
Primitives are unstyled, accessible, and WCAG 2.2 compliant out of the box.

| Package | Version | Component |
|---|---|---|
| `@radix-ui/react-accordion` | 1.2.12 | Accordion |
| `@radix-ui/react-alert-dialog` | 1.1.15 | Alert Dialog |
| `@radix-ui/react-aspect-ratio` | 1.1.8 | Aspect Ratio |
| `@radix-ui/react-avatar` | 1.1.11 | Avatar |
| `@radix-ui/react-checkbox` | 1.3.3 | Checkbox |
| `@radix-ui/react-collapsible` | 1.1.12 | Collapsible |
| `@radix-ui/react-context-menu` | 2.2.16 | Context Menu |
| `@radix-ui/react-dialog` | 1.1.15 | Dialog / Modal |
| `@radix-ui/react-dropdown-menu` | 2.1.16 | Dropdown Menu |
| `@radix-ui/react-hover-card` | 1.1.15 | Hover Card |
| `@radix-ui/react-label` | 2.1.8 | Label |
| `@radix-ui/react-menubar` | 1.1.16 | Menubar |
| `@radix-ui/react-navigation-menu` | 1.2.14 | Navigation Menu |
| `@radix-ui/react-popover` | 1.1.15 | Popover |
| `@radix-ui/react-progress` | 1.1.8 | Progress |
| `@radix-ui/react-radio-group` | 1.3.8 | Radio Group |
| `@radix-ui/react-scroll-area` | 1.2.10 | Scroll Area |
| `@radix-ui/react-select` | 2.2.6 | Select |
| `@radix-ui/react-separator` | 1.1.8 | Separator |
| `@radix-ui/react-slider` | 1.3.6 | Slider |
| `@radix-ui/react-slot` | 1.2.4 | Slot (composition) |
| `@radix-ui/react-switch` | 1.2.6 | Switch |
| `@radix-ui/react-tabs` | 1.1.13 | Tabs |
| `@radix-ui/react-toast` | 1.2.15 | Toast |
| `@radix-ui/react-toggle` | 1.1.10 | Toggle |
| `@radix-ui/react-toggle-group` | 1.1.11 | Toggle Group |
| `@radix-ui/react-tooltip` | 1.2.8 | Tooltip |

**Companion UI packages:**

| Package | Version | Purpose |
|---|---|---|
| `cmdk` | 1.1.1 | Command palette (Command Menu) |
| `vaul` | ^1.1.2 | Mobile-friendly drawer |
| `input-otp` | 1.4.2 | OTP input field |
| `embla-carousel-react` | 8.6.0 | Accessible carousel |
| `react-resizable-panels` | ^2.1.9 | Resizable panel layouts |
| `lucide-react` | ^0.564.0 | Icon library (MIT, tree-shakeable) |
| `next-themes` | ^0.4.6 | Dark/light/system theme management |

---

## 5. Styling

| Package | Version | Purpose |
|---|---|---|
| `tailwindcss` | ^4.2.1 | Utility-first CSS engine (v4 CSS-native) |
| `@tailwindcss/postcss` | ^4.2.1 | PostCSS integration for Tailwind v4 |
| `tw-animate-css` | 1.3.3 | CSS animation utilities for Tailwind |
| `tailwind-merge` | ^3.5.0 | Deduplicate conflicting Tailwind class names |
| `class-variance-authority` | ^0.7.1 | Type-safe variant API (used in `cva()`) |
| `clsx` | ^2.1.1 | Conditional class name utility |
| `autoprefixer` | ^10.4.27 | Adds vendor prefixes via PostCSS |
| `postcss` | ^8.5.8 | CSS transformation pipeline |

**Tailwind v4 notes:**
- Configuration is in `app/globals.css` via `@theme` — no `tailwind.config.*` file.
- Import `tailwindcss` directly in PostCSS config; do not use `@tailwindcss/vite`
  (incompatible with Next.js Turbopack in this setup).
- Use `tailwind-merge` + `clsx` together via the `cn()` helper in `lib/utils.ts`.

---

## 6. Forms & Validation

| Package | Version | Purpose |
|---|---|---|
| `react-hook-form` | ^7.71.2 | Performant, uncontrolled forms |
| `@hookform/resolvers` | ^3.10.0 | Schema validation adapters for RHF |
| `zod` | ^3.25.76 | TypeScript-first schema validation |
| `react-day-picker` | 9.13.2 | Accessible date/range picker |
| `date-fns` | 4.1.0 | Date utility library (tree-shakeable) |

**Standard pattern:**

```ts
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({ email: z.string().email() })
type FormData = z.infer<typeof schema>

const form = useForm<FormData>({ resolver: zodResolver(schema) })
```

**Zod compatibility:**
The MCP SDK (`@modelcontextprotocol/sdk@1.27.1`) ships a Zod v3/v4 compatibility
shim. This ecosystem uses Zod v3 (`^3.25.76`) and it works transparently with
the SDK's tool registration API.

---

## 7. Data & Database

| Package | Version | Purpose |
|---|---|---|
| `@neondatabase/serverless` | ^1.0.2 | Neon PostgreSQL over HTTP/WebSocket |
| `recharts` | 2.15.0 | Composable chart library (React) |

### Neon client — lazy initialisation pattern

**Never** call `neon(process.env.DATABASE_URL!)` at module evaluation time —
it crashes `next build` when `DATABASE_URL` is absent.  
Always use the lazy proxy pattern established in `lib/db.ts`:

```ts
import { neon, type NeonQueryFunction } from '@neondatabase/serverless'

type SqlClient = NeonQueryFunction<false, false>
let _client: SqlClient | null = null

function getClient(): SqlClient {
  if (!_client) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL is not set')
    _client = neon(url)
  }
  return _client
}

export const sql: SqlClient = new Proxy({} as SqlClient, {
  apply: (_t, _this, args) => Reflect.apply(getClient(), _this, args),
  get: (_t, prop) => Reflect.get(getClient(), prop),
})
```

---

## 8. Utilities

| Package | Version | Purpose |
|---|---|---|
| `uuid` | ^13.0.0 | RFC-4122 UUID generation |
| `botid` | ^1.5.11 | Bot/crawler detection fingerprinting |
| `sonner` | ^1.7.4 | Toast notification system |

---

## 9. Dev & Testing

| Package | Version | Purpose |
|---|---|---|
| `vitest` | ^4.0.18 | Unit & integration test runner |
| `@vitejs/plugin-react` | ^5.1.4 | React transforms for Vitest |
| `@testing-library/react` | ^16.3.2 | Component testing utilities |
| `@testing-library/jest-dom` | ^6.9.1 | Custom jest/vitest DOM matchers |
| `jsdom` | ^28.1.0 | DOM environment for Vitest |
| `@types/node` | ^22.19.15 | Node.js type definitions |
| `@types/react` | 19.2.14 | React type definitions |
| `@types/react-dom` | 19.2.3 | ReactDOM type definitions |

**Test structure:**

```
__tests__/
  unit/         # lib/, hooks/ — pure logic, no network
  integration/  # API route handlers — mocked DB/fetch
```

Run all tests:

```bash
pnpm test              # vitest run (CI)
pnpm test:watch        # vitest (interactive)
pnpm test:coverage     # with coverage report
```

See [TESTING.md](TESTING.md) for conventions and coverage requirements.

---

## 10. Standards & Compliance

All packages in this ecosystem are evaluated against:

| Standard | Requirement |
|---|---|
| **WCAG 2.2 / ISO 40500:2025** | All interactive components must meet Level AA |
| **OWASP Top 10** | Input validation via Zod at all API boundaries; no raw SQL string interpolation |
| **EU AI Act** | Transparency layer exposed via MCP endpoint (`/api/mcp`) and `llms.txt` |
| **Core Web Vitals 2026** | LCP < 2.5s, INP < 200ms, CLS < 0.1 — measured via `@vercel/speed-insights` |
| **ADA Title II** | WCAG 2.1 AA compliance required by April 2026 |
| **Open Source** | MIT-licensed packages only unless explicitly documented below |

**Non-MIT exceptions:** None currently. Evaluate license compatibility before
adding new packages — `botid`, Radix UI, Recharts, and all Vercel packages are MIT.

---

## 11. Upgrade Guidance

When a package has a major version bump available, document the migration path
here before upgrading across the ecosystem.

### Tracked upgrade paths

| Package | Current | Next major | Notes |
|---|---|---|---|
| `typescript` | 5.7.3 | 5.9.x | Drop-in; bump `tsconfig.json` `target` if needed |
| `sonner` | ^1.7.4 | ^2.x | API changes in `toast()` options; see [sonner changelog](https://github.com/emilkowalski/sonner) |
| `recharts` | 2.15.0 | ^3.x | `<ResponsiveContainer>` removed; use CSS sizing |
| `@hookform/resolvers` | ^3.10.0 | ^5.x | Peer dep changes with RHF v8 |
| `react-resizable-panels` | ^2.1.9 | ^4.x | Only rename `defaultSize` → review changelogs |
| `zod` | ^3.25.76 | ^4.x | Breaking changes in `.parse()` error shape; MCP SDK supports both via compat shim |
| `react-day-picker` | 9.13.2 | 9.14.x | Patch — safe to upgrade |
| `tw-animate-css` | 1.3.3 | 1.4.x | Patch — safe to upgrade |
| `lucide-react` | ^0.564.0 | ^0.577.x | Icon renames possible; grep before upgrading |

### Adding a new package checklist

1. Is it MIT (or compatible)? Check `license` field via `pnpm info <pkg> license`.
2. Does it support React 19 + Next.js 16 App Router?
3. Does it have an Edge runtime build (no Node.js `fs`/`crypto` in the module entry)?  
   Use `@vercel/nft` or `pnpm why` to audit the tree.
4. Add it to `PACKAGES.md` before or alongside the PR.
5. If it adds WCAG-interactive UI, verify keyboard navigation and `aria-*` attributes.

---

*Last updated: 2026-03-06 — reflects `package.json` at commit `2ca10bc`.*
