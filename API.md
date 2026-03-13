# API Reference

## Base URL

```
Production: https://onboard.platphormnews.com/api
Development: http://localhost:3000/api
```

## Authentication

Most read operations are public. Write operations require an API key.

```http
Authorization: Bearer ob_your_api_key_here
```

### Bootstrap API Key

Create the first API key (only works once):

```bash
curl -X PUT https://onboard.platphormnews.com/api/v1/keys \
  -H "Content-Type: application/json" \
  -d '{"name": "Admin Key"}'
```

---

## REST API v1

### Documents

#### List Documents

```http
GET /api/v1/documents
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| per_page | number | 20 | Items per page (max 100) |
| status | string | published | draft, published, archived |
| category | string | - | Filter by category slug |
| tag | string | - | Filter by tag |
| q | string | - | Search query |
| sort | string | published_at | Field to sort by |
| order | string | desc | asc or desc |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "slug": "getting-started",
      "title": "Getting Started",
      "description": "Introduction to the platform",
      "category": "guides",
      "tags": ["tutorial", "beginner"],
      "emoji_summary": "rocket-sparkles-book",
      "author_name": "John Doe",
      "source_identifier": "docs.example.com",
      "reading_time_minutes": 5,
      "word_count": 1200,
      "published_at": "2024-01-15T10:00:00Z",
      "created_at": "2024-01-15T09:00:00Z",
      "updated_at": "2024-01-15T10:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 150,
    "total_pages": 8
  }
}
```

#### Create Document

```http
POST /api/v1/documents
Authorization: Bearer ob_xxx
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "My Document",
  "content": "# Hello World\n\nThis is my document.",
  "description": "A sample document",
  "category": "guides",
  "tags": ["tutorial", "sample"],
  "source_url": "https://example.com/original",
  "source_identifier": "example.com",
  "author_name": "Jane Doe",
  "author_email": "jane@example.com",
  "target_audience": "developers",
  "status": "published"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "slug": "my-document-abc123",
    "title": "My Document",
    "emoji_summary": "page_facing_up-sparkles",
    "og_title": "My Document | Onboard",
    "og_description": "A sample document",
    "og_image": "https://onboard.platphormnews.com/api/og?title=My+Document",
    "canonical_url": "https://onboard.platphormnews.com/docs/my-document-abc123",
    "reading_time_minutes": 1,
    "word_count": 5,
    "created_at": "2024-01-15T10:00:00Z"
  }
}
```

#### Get Document

```http
GET /api/v1/documents/{slug}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "slug": "getting-started",
    "title": "Getting Started",
    "description": "Introduction to the platform",
    "content": "# Getting Started\n\n...",
    "content_format": "markdown",
    "category": "guides",
    "tags": ["tutorial"],
    "version": 3,
    "og_title": "Getting Started | Onboard",
    "og_description": "Introduction to the platform",
    "og_image": "https://onboard.platphormnews.com/api/og?title=Getting+Started",
    "canonical_url": "https://onboard.platphormnews.com/docs/getting-started",
    "reading_time_minutes": 5,
    "word_count": 1200,
    "emoji_summary": "rocket-sparkles-book",
    "author_name": "Onboard Team",
    "source_url": null,
    "source_identifier": "onboard-core",
    "published_at": "2024-01-15T10:00:00Z",
    "created_at": "2024-01-10T09:00:00Z",
    "updated_at": "2024-01-15T10:00:00Z"
  }
}
```

#### Update Document

```http
PUT /api/v1/documents/{slug}
Authorization: Bearer ob_xxx
Content-Type: application/json
```

#### Delete Document

```http
DELETE /api/v1/documents/{slug}
Authorization: Bearer ob_xxx
```

---

### Search

```http
GET /api/v1/search
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| q | string | Search query (required) |
| category | string | Filter by category |
| tag | string | Filter by tag |
| limit | number | Max results (default 20) |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "slug": "getting-started",
      "title": "Getting Started",
      "description": "Introduction to the platform",
      "headline": "...full-text <b>search</b> powered by...",
      "rank": 0.95,
      "category": "guides"
    }
  ],
  "meta": {
    "query": "search",
    "total": 5
  }
}
```

---

### Submissions

#### Submit Content

```http
POST /api/v1/submissions
Content-Type: application/json
```

**Request Body:**
```json
{
  "source_url": "https://vanlife.platphormnews.com/posts/my-adventure",
  "title": "My Van Life Adventure",
  "content": "# My Adventure\n\nStarted in California...",
  "author_name": "Traveler Jane",
  "author_email": "jane@vanlife.com",
  "metadata": {
    "original_id": "post-123",
    "category": "travel"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "pending",
    "message": "Submission received and pending review"
  }
}
```

---

### URL Ingestion

```http
POST /api/v1/ingest
Content-Type: application/json
```

**Request Body:**
```json
{
  "url": "https://example.com/docs/getting-started",
  "category": "guides",
  "tags": ["imported", "external"],
  "auto_publish": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "slug": "getting-started-abc123",
    "title": "Getting Started - Example Docs",
    "source_url": "https://example.com/docs/getting-started",
    "source_identifier": "example.com",
    "status": "draft",
    "word_count": 850
  }
}
```

---

### Automation

```http
POST /api/v1/automation
Authorization: Bearer ob_xxx
Content-Type: application/json
```

**Operations:**
- `bulk_create` - Create multiple documents
- `bulk_update` - Update multiple documents
- `bulk_delete` - Delete multiple documents
- `reindex_search` - Rebuild search index
- `generate_seo` - Regenerate SEO for all docs

**Example:**
```json
{
  "operation": "bulk_create",
  "documents": [
    { "title": "Doc 1", "content": "..." },
    { "title": "Doc 2", "content": "..." }
  ]
}
```

---

### Webhooks

#### Create Webhook

```http
POST /api/v1/webhooks
Authorization: Bearer ob_xxx
Content-Type: application/json
```

**Request Body:**
```json
{
  "url": "https://your-site.com/webhook",
  "events": ["document.created", "document.updated"],
  "secret": "your-webhook-secret"
}
```

**Events:**
- `document.created`
- `document.updated`
- `document.deleted`
- `submission.created`
- `submission.reviewed`

---

## MCP Protocol

### Endpoint

```http
POST /api/mcp
Content-Type: application/json
```

### List Tools

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
}
```

### Call Tool

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "search_documents",
    "arguments": {
      "query": "getting started",
      "limit": 5
    }
  }
}
```

### Read Resource

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "resources/read",
  "params": {
    "uri": "docs://getting-started"
  }
}
```

---

## Error Responses

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Document not found",
    "details": {
      "slug": "nonexistent-doc"
    }
  }
}
```

**Error Codes:**
| Code | HTTP Status | Description |
|------|-------------|-------------|
| VALIDATION_ERROR | 400 | Invalid request data |
| UNAUTHORIZED | 401 | Missing/invalid API key |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| RATE_LIMITED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Server error |

---

## Rate Limits

| Tier | Requests/Hour | Burst |
|------|---------------|-------|
| Free | 1000 | 50/min |
| Pro | 10000 | 500/min |
| Enterprise | Unlimited | Custom |
