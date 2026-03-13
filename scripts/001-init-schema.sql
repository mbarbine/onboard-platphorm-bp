-- OpenDocs Schema - MCP-Enabled Documentation Platform
-- Version: 1.0.0

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tenants table (multi-tenant support)
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  domain VARCHAR(255),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- API Keys for external access
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  key_hash VARCHAR(255) NOT NULL UNIQUE,
  key_prefix VARCHAR(10) NOT NULL,
  scopes JSONB DEFAULT '["read"]',
  rate_limit INTEGER DEFAULT 1000,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Documents table (core docs storage)
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  slug VARCHAR(500) NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  content_format VARCHAR(50) DEFAULT 'markdown',
  source_url VARCHAR(2000),
  source_identifier VARCHAR(500),
  author_name VARCHAR(255),
  author_email VARCHAR(255),
  author_url VARCHAR(2000),
  category VARCHAR(255),
  tags JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  version INTEGER DEFAULT 1,
  status VARCHAR(50) DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(tenant_id, slug)
);

-- Document versions (history)
CREATE TABLE IF NOT EXISTS document_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Submissions (external contributions)
CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  source_url VARCHAR(2000) NOT NULL,
  source_identifier VARCHAR(500),
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  content_format VARCHAR(50) DEFAULT 'markdown',
  author_name VARCHAR(255),
  author_email VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'pending',
  reviewed_at TIMESTAMPTZ,
  reviewed_by VARCHAR(255),
  document_id UUID REFERENCES documents(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categories/Collections
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES categories(id),
  slug VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(100),
  order_index INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, slug)
);

-- Webhooks for external integrations
CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  url VARCHAR(2000) NOT NULL,
  secret VARCHAR(255) NOT NULL,
  events JSONB DEFAULT '["document.created", "document.updated"]',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook deliveries (audit log)
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id UUID REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  delivered_at TIMESTAMPTZ,
  attempts INTEGER DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Search index (for full-text search)
CREATE TABLE IF NOT EXISTS search_index (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  content_vector TSVECTOR,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id UUID,
  actor_id VARCHAR(255),
  actor_type VARCHAR(50),
  metadata JSONB DEFAULT '{}',
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- MCP Sessions (for AI agent connections)
CREATE TABLE IF NOT EXISTS mcp_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  session_token VARCHAR(255) NOT NULL UNIQUE,
  agent_name VARCHAR(255),
  agent_version VARCHAR(50),
  capabilities JSONB DEFAULT '[]',
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_documents_tenant ON documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_documents_slug ON documents(slug);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_source ON documents(source_identifier);
CREATE INDEX IF NOT EXISTS idx_submissions_tenant ON submissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_source ON submissions(source_identifier);
CREATE INDEX IF NOT EXISTS idx_search_vector ON search_index USING GIN(content_vector);
CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);

-- Insert default tenant
INSERT INTO tenants (id, name, slug, domain) 
VALUES ('00000000-0000-0000-0000-000000000001', 'Default', 'default', NULL)
ON CONFLICT (slug) DO NOTHING;
