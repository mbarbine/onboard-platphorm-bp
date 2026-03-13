import { NextResponse } from 'next/server'
import { SITE_NAME, BASE_URL } from '@/lib/site-config'

export function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || BASE_URL
  
  const openApiSpec = {
    openapi: '3.1.0',
    info: {
      title: `${SITE_NAME} API`,
      version: '1.0.0',
      description: 'AI-native documentation platform with MCP integration',
      contact: {
        name: SITE_NAME,
        url: baseUrl,
      },
    },
    servers: [
      { url: `${baseUrl}/api/v1`, description: 'Production' },
    ],
    security: [{ bearerAuth: [] }],
    paths: {
      '/documents': {
        get: {
          summary: 'List documents',
          description: 'List all published documents with pagination and filtering',
          tags: ['Documents'],
          security: [],
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'per_page', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
            { name: 'status', in: 'query', schema: { type: 'string', default: 'published' } },
            { name: 'category', in: 'query', schema: { type: 'string' } },
            { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Search query' },
            { name: 'tag', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            200: { description: 'List of documents', content: { 'application/json': { schema: { $ref: '#/components/schemas/DocumentList' } } } },
          },
        },
        post: {
          summary: 'Create document',
          description: 'Create a new document',
          tags: ['Documents'],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/DocumentCreate' } } } },
          responses: {
            201: { description: 'Document created' },
            401: { description: 'Unauthorized' },
          },
        },
      },
      '/documents/{slug}': {
        get: {
          summary: 'Get document',
          description: 'Get a specific document by slug',
          tags: ['Documents'],
          security: [],
          parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Document details' },
            404: { description: 'Not found' },
          },
        },
        put: {
          summary: 'Update document',
          description: 'Update an existing document',
          tags: ['Documents'],
          parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/DocumentUpdate' } } } },
          responses: {
            200: { description: 'Document updated' },
            401: { description: 'Unauthorized' },
            404: { description: 'Not found' },
          },
        },
        delete: {
          summary: 'Delete document',
          description: 'Soft delete a document',
          tags: ['Documents'],
          parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Document deleted' },
            401: { description: 'Unauthorized' },
            403: { description: 'Forbidden - requires admin scope' },
            404: { description: 'Not found' },
          },
        },
      },
      '/submissions': {
        get: {
          summary: 'List submissions',
          description: 'List all submissions',
          tags: ['Submissions'],
          parameters: [
            { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'approved', 'rejected'] } },
            { name: 'source_url', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            200: { description: 'List of submissions' },
            401: { description: 'Unauthorized' },
          },
        },
        post: {
          summary: 'Create submission',
          description: 'Submit new content for review (open endpoint)',
          tags: ['Submissions'],
          security: [],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SubmissionCreate' } } } },
          responses: {
            201: { description: 'Submission created' },
            400: { description: 'Validation error' },
          },
        },
      },
      '/submissions/{id}': {
        get: {
          summary: 'Get submission',
          tags: ['Submissions'],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: {
            200: { description: 'Submission details' },
            404: { description: 'Not found' },
          },
        },
        post: {
          summary: 'Review submission',
          description: 'Approve or reject a submission',
          tags: ['Submissions'],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SubmissionReview' } } } },
          responses: {
            200: { description: 'Submission reviewed' },
          },
        },
      },
      '/search': {
        get: {
          summary: 'Search documents',
          description: 'Full-text search across all documents',
          tags: ['Search'],
          security: [],
          parameters: [
            { name: 'q', in: 'query', required: true, schema: { type: 'string', minLength: 2 } },
            { name: 'category', in: 'query', schema: { type: 'string' } },
            { name: 'tag', in: 'query', schema: { type: 'string' } },
            { name: 'page', in: 'query', schema: { type: 'integer' } },
            { name: 'per_page', in: 'query', schema: { type: 'integer' } },
          ],
          responses: {
            200: { description: 'Search results' },
          },
        },
      },
      '/categories': {
        get: {
          summary: 'List categories',
          tags: ['Categories'],
          security: [],
          responses: {
            200: { description: 'List of categories' },
          },
        },
        post: {
          summary: 'Create category',
          tags: ['Categories'],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CategoryCreate' } } } },
          responses: {
            201: { description: 'Category created' },
          },
        },
      },
      '/webhooks': {
        get: {
          summary: 'List webhooks',
          tags: ['Webhooks'],
          responses: {
            200: { description: 'List of webhooks' },
          },
        },
        post: {
          summary: 'Create webhook',
          tags: ['Webhooks'],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/WebhookCreate' } } } },
          responses: {
            201: { description: 'Webhook created' },
          },
        },
      },
      '/keys': {
        get: {
          summary: 'List API keys',
          tags: ['Authentication'],
          responses: {
            200: { description: 'List of API keys' },
          },
        },
        post: {
          summary: 'Create API key',
          tags: ['Authentication'],
          responses: {
            201: { description: 'API key created' },
          },
        },
        put: {
          summary: 'Bootstrap API key',
          description: 'Create initial admin key (only works if no keys exist)',
          tags: ['Authentication'],
          security: [],
          responses: {
            201: { description: 'Bootstrap key created' },
            403: { description: 'Keys already exist' },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'API key in format: od_xxx',
        },
      },
      schemas: {
        DocumentCreate: {
          type: 'object',
          required: ['title', 'content'],
          properties: {
            slug: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            content: { type: 'string' },
            content_format: { type: 'string', enum: ['markdown', 'html', 'text'] },
            source_url: { type: 'string', format: 'uri' },
            source_identifier: { type: 'string' },
            author_name: { type: 'string' },
            author_email: { type: 'string', format: 'email' },
            category: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            status: { type: 'string', enum: ['draft', 'published'] },
          },
        },
        DocumentUpdate: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            content: { type: 'string' },
            status: { type: 'string', enum: ['draft', 'published', 'archived'] },
          },
        },
        DocumentList: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array', items: { type: 'object' } },
            meta: { type: 'object' },
          },
        },
        SubmissionCreate: {
          type: 'object',
          required: ['source_url', 'title', 'content'],
          properties: {
            source_url: { type: 'string', format: 'uri' },
            source_identifier: { type: 'string' },
            title: { type: 'string' },
            content: { type: 'string' },
            author_name: { type: 'string' },
            author_email: { type: 'string', format: 'email' },
          },
        },
        SubmissionReview: {
          type: 'object',
          required: ['action'],
          properties: {
            action: { type: 'string', enum: ['approve', 'reject'] },
            slug: { type: 'string' },
            category: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            publish_immediately: { type: 'boolean' },
            reason: { type: 'string' },
          },
        },
        CategoryCreate: {
          type: 'object',
          required: ['slug', 'name'],
          properties: {
            slug: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            parent_id: { type: 'string', format: 'uuid' },
            icon: { type: 'string' },
            order_index: { type: 'integer' },
          },
        },
        WebhookCreate: {
          type: 'object',
          required: ['url'],
          properties: {
            url: { type: 'string', format: 'uri' },
            events: { type: 'array', items: { type: 'string' } },
            active: { type: 'boolean' },
          },
        },
      },
    },
    tags: [
      { name: 'Documents', description: 'Document management' },
      { name: 'Submissions', description: 'Content submissions from external sources' },
      { name: 'Search', description: 'Full-text search' },
      { name: 'Categories', description: 'Category management' },
      { name: 'Webhooks', description: 'Webhook management' },
      { name: 'Authentication', description: 'API key management' },
    ],
  }

  return NextResponse.json(openApiSpec, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
