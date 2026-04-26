-- ============================================
-- MIGRATION 007: Accounting learning rules
-- ============================================

CREATE TABLE IF NOT EXISTS accounting_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    company_name TEXT,
    merchant_pattern TEXT,
    keyword_pattern TEXT,
    purpose_pattern TEXT,
    category_id TEXT,
    category_name TEXT NOT NULL,
    skr04_code TEXT NOT NULL,
    vat_rate DECIMAL(5,2) DEFAULT 19,
    needs_review BOOLEAN DEFAULT false,
    reason TEXT,
    source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'system', 'accountant')),
    active BOOLEAN DEFAULT true,
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_accounting_rules_user_active ON accounting_rules(user_id, active);
CREATE INDEX IF NOT EXISTS idx_accounting_rules_merchant ON accounting_rules(merchant_pattern) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_accounting_rules_keyword ON accounting_rules(keyword_pattern) WHERE active = true;

CREATE TRIGGER update_accounting_rules_updated_at BEFORE UPDATE ON accounting_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
