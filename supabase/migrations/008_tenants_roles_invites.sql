-- ============================================
-- MIGRATION 008: Tenants, roles, invites
-- ============================================

CREATE TABLE IF NOT EXISTS accounting_tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    legal_name TEXT,
    tax_number TEXT,
    vat_id TEXT,
    address TEXT,
    fiscal_year_start_month INTEGER DEFAULT 1 CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS accounting_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE,
    display_name TEXT,
    first_login_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS accounting_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES accounting_tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES accounting_users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'accountant', 'member')),
    can_upload BOOLEAN DEFAULT true,
    can_export BOOLEAN DEFAULT true,
    can_manage_rules BOOLEAN DEFAULT false,
    can_manage_users BOOLEAN DEFAULT false,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS accounting_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token TEXT UNIQUE NOT NULL,
    tenant_id UUID REFERENCES accounting_tenants(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'accountant', 'member')),
    email TEXT,
    can_upload BOOLEAN DEFAULT true,
    can_export BOOLEAN DEFAULT true,
    can_manage_rules BOOLEAN DEFAULT false,
    can_manage_users BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'revoked', 'expired')),
    accepted_by UUID REFERENCES accounting_users(id),
    accepted_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE bank_statements ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES accounting_tenants(id);
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES accounting_tenants(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES accounting_tenants(id);
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES accounting_tenants(id);
ALTER TABLE accounting_exports ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES accounting_tenants(id);
ALTER TABLE accounting_rules ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES accounting_tenants(id);

CREATE INDEX IF NOT EXISTS idx_accounting_memberships_user ON accounting_memberships(user_id, active);
CREATE INDEX IF NOT EXISTS idx_accounting_memberships_tenant ON accounting_memberships(tenant_id, active);
CREATE INDEX IF NOT EXISTS idx_accounting_invites_token ON accounting_invites(token, status);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_tenant_date ON bank_transactions(tenant_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_receipts_tenant_date ON receipts(tenant_id, receipt_date);
CREATE INDEX IF NOT EXISTS idx_accounting_rules_tenant_active ON accounting_rules(tenant_id, active);

DROP TRIGGER IF EXISTS update_accounting_tenants_updated_at ON accounting_tenants;
CREATE TRIGGER update_accounting_tenants_updated_at BEFORE UPDATE ON accounting_tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_accounting_users_updated_at ON accounting_users;
CREATE TRIGGER update_accounting_users_updated_at BEFORE UPDATE ON accounting_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_accounting_memberships_updated_at ON accounting_memberships;
CREATE TRIGGER update_accounting_memberships_updated_at BEFORE UPDATE ON accounting_memberships
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_accounting_invites_updated_at ON accounting_invites;
CREATE TRIGGER update_accounting_invites_updated_at BEFORE UPDATE ON accounting_invites
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
