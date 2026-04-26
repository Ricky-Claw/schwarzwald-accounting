-- ============================================
-- MIGRATION 009: Minimal user access keys
-- ============================================

ALTER TABLE accounting_users ADD COLUMN IF NOT EXISTS api_key TEXT UNIQUE;
ALTER TABLE accounting_users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_accounting_users_api_key ON accounting_users(api_key) WHERE api_key IS NOT NULL;
