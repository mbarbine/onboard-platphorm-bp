# Onboard

MCP-enabled documentation platform. No auth. No ads. Just docs.

## Quick Start

```bash
git clone https://github.com/mbarbine/onboard-platphorm-bp.git
cd onboard-platphorm-bp
pnpm install
cp .env.example .env.local
# Add your DATABASE_URL (Neon PostgreSQL)
pnpm dev
```



## What It Does

- **MCP Integration** — AI agents connect via JSON-RPC 2.0
- **REST API** — Full CRUD with search, webhooks, and versioning
- **Multi-Source** — Submit content from any URL
- **Full-Text Search** — PostgreSQL tsvector-powered
- **Accessible** — WCAG 2.2 AA compliant (including robust keyboard navigation)
- **i18n** — 10 languages

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string |
| `NEXT_PUBLIC_BASE_URL` | No | Public URL (defaults to localhost) |

## API

```
GET/POST    /api/v1/documents          # List / Create
GET/PUT/DEL /api/v1/documents/:slug    # Read / Update / Delete
GET         /api/v1/search             # Full-text search
POST        /api/v1/submissions        # Submit external content
POST        /api/v1/ingest             # Ingest from URL
POST        /api/mcp                   # MCP JSON-RPC endpoint
GET         /api/docs                  # OpenAPI schema
GET         /api/health                # Health check
GET         /api/version               # Runtime/version metadata
GET         /api/capabilities          # Discoverability capability contract
```

See [API.md](API.md) for full reference.

## Docs

- [API.md](API.md) — REST & MCP API reference
- [ARCHITECTURE.md](ARCHITECTURE.md) — System design
- [CONTRIBUTING.md](CONTRIBUTING.md) — How to contribute
- [CHANGELOG.md](CHANGELOG.md) — Version history
- [SECURITY.md](SECURITY.md) — Security policy
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) — Community guidelines
- [docs/ops/minimum-discoverability-matrix.md](docs/ops/minimum-discoverability-matrix.md) — Required discovery surfaces and MCP contract

## Ops Bootstrap

Create kanban tasks, provision a project, and register this service to MCP/network graph:

```bash
pnpm ops:provision
```

Artifacts are written to `docs/ops/*.json`.

## License

MIT — See [LICENSE](LICENSE)

---

Created by [Michael Barbine](https://platphormnews.com)
# onboard-platphorm-bp
