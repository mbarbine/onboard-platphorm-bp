# Local / Self-Hosted Development

Run the full OpenDocs stack locally with Docker — no Vercel account required.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (v20+) with Compose

## Quick Start

```bash
docker compose up --build
```

Open **http://localhost:3000**. The database schema is applied automatically on
first run via `scripts/001-init-schema.sql`.

To run in the background:

```bash
docker compose up --build -d
```

## What's Included

| Service | Description                        | Port |
|---------|------------------------------------|------|
| **app** | Next.js production server          | 3000 |
| **db**  | PostgreSQL 17 with init schema     | 5432 |

## Environment Variables

All defaults work out of the box. The default database credentials
(`opendocs`/`opendocs`) are for **local development only** — change them before
exposing any ports to an untrusted network.

Override any variable by creating a `.env` file in the project root (Docker
Compose loads it automatically):

```dotenv
# Already set by docker-compose.yml — override only if needed
DATABASE_URL=postgresql://opendocs:opendocs@db:5432/opendocs
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

See `.env.example` for the full list of optional variables (logging, external
integrations, etc.).

## Connecting to the Database

```bash
# Via Docker
docker compose exec db psql -U opendocs

# Or from your host (requires psql client)
psql postgresql://opendocs:opendocs@localhost:5432/opendocs
```

## Developing Without Docker

If you prefer running Next.js on your host machine and only want the database:

```bash
# Start just PostgreSQL
docker compose up db -d

# Point your local app at the container
echo 'DATABASE_URL=postgresql://opendocs:opendocs@localhost:5432/opendocs' >> .env.local

npm install
npm run dev
```

## Vercel Feature Compatibility

These Vercel-specific packages are included in the codebase and behave
gracefully when self-hosted:

| Package                  | Self-Hosted Behavior                                |
|--------------------------|-----------------------------------------------------|
| `@vercel/analytics`      | No-op — no data sent                                |
| `@vercel/speed-insights` | No-op — no data sent                                |
| `@vercel/og`             | Works — generates OG images via the built-in runtime |
| `@vercel/mcp-adapter`    | Works — MCP routes are standard HTTP handlers        |

No mocking or patching is needed.

## Resetting the Database

```bash
docker compose down -v   # removes the data volume
docker compose up --build
```

## Stopping

```bash
docker compose down       # stop and remove containers (data preserved)
docker compose down -v    # also delete the database volume
```
