-- Add tenant isolation to Amazon Seller Central documents
ALTER TABLE amazon_documents ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES accounting_tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_amazon_documents_tenant_created ON amazon_documents(tenant_id, created_at);
