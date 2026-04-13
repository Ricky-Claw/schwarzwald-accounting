-- ============================================
-- SCHWARZWALD ACCOUNTING - Initial Schema
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TRANSACTION CATEGORIES (SKR04)
-- ============================================
CREATE TABLE transaction_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    name_en TEXT,
    account_type TEXT CHECK (account_type IN ('income', 'expense', 'asset', 'liability')),
    vat_rate DECIMAL(5,2) DEFAULT 0,
    is_system BOOLEAN DEFAULT false,
    parent_id UUID REFERENCES transaction_categories(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert SKR04 standard categories
INSERT INTO transaction_categories (code, name, account_type, vat_rate, is_system) VALUES
-- Income
('8400', 'Sonstige Einnahmen', 'income', 0, true),
('8300', 'Provisionserlöse', 'income', 19, true),
('8200', 'Erträge aus Warenverkauf', 'income', 19, true),
-- Expenses
('4400', 'Büromaterial', 'expense', 19, true),
('4600', 'Reisekosten', 'expense', 19, true),
('4605', 'Reisekosten (umsatzsteuerfrei)', 'expense', 0, true),
('6300', 'Gehälter', 'expense', 0, true),
('6400', 'Lohn', 'expense', 0, true),
('6500', 'Soziale Abgaben', 'expense', 0, true),
('6600', 'Miete', 'expense', 19, true),
('6605', 'Miete (umsatzsteuerfrei)', 'expense', 0, true),
('6700', 'Strom', 'expense', 19, true),
('6800', 'Telefon/Internet', 'expense', 19, true),
('6900', 'Werbung', 'expense', 19, true),
-- Assets
('0420', 'Büromöbel', 'asset', 19, true),
('0440', 'Computer/Hardware', 'asset', 19, true),
('0460', 'Software', 'asset', 19, true),
('0500', 'Fahrzeuge', 'asset', 19, true);

-- ============================================
-- BANK STATEMENTS
-- ============================================
CREATE TABLE bank_statements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_name TEXT NOT NULL,
    account_iban TEXT,
    statement_date DATE NOT NULL,
    file_path TEXT,
    file_type TEXT CHECK (file_type IN ('pdf', 'csv', 'camt')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'error')),
    total_amount DECIMAL(12,2),
    transaction_count INTEGER,
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- BANK TRANSACTIONS
-- ============================================
CREATE TABLE bank_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    statement_id UUID REFERENCES bank_statements(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    transaction_date DATE NOT NULL,
    booking_date DATE,
    amount DECIMAL(12,2) NOT NULL,
    currency TEXT DEFAULT 'EUR',
    description TEXT,
    counterparty_name TEXT,
    counterparty_iban TEXT,
    reference TEXT,
    category_id UUID REFERENCES transaction_categories(id),
    receipt_id UUID,
    status TEXT DEFAULT 'unmatched' CHECK (status IN ('unmatched', 'matched', 'categorized', 'split')),
    is_split BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- INVOICES
-- ============================================
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    invoice_type TEXT CHECK (invoice_type IN ('incoming', 'outgoing')),
    invoice_number TEXT NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE,
    partner_name TEXT NOT NULL,
    partner_address TEXT,
    partner_vat_id TEXT,
    net_amount DECIMAL(12,2) NOT NULL,
    vat_amount DECIMAL(12,2) NOT NULL,
    gross_amount DECIMAL(12,2) NOT NULL,
    currency TEXT DEFAULT 'EUR',
    vat_rate DECIMAL(5,2) DEFAULT 19,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
    paid_date DATE,
    paid_amount DECIMAL(12,2),
    file_path TEXT,
    bank_transaction_id UUID REFERENCES bank_transactions(id),
    category_id UUID REFERENCES transaction_categories(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- RECEIPTS (OCR)
-- ============================================
CREATE TABLE receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    merchant_name TEXT,
    receipt_date DATE,
    total_amount DECIMAL(12,2),
    vat_amount DECIMAL(12,2),
    currency TEXT DEFAULT 'EUR',
    category_id UUID REFERENCES transaction_categories(id),
    bank_transaction_id UUID REFERENCES bank_transactions(id),
    invoice_id UUID REFERENCES invoices(id),
    file_path TEXT NOT NULL,
    ocr_confidence DECIMAL(3,2),
    ocr_raw JSONB,
    ocr_status TEXT DEFAULT 'pending' CHECK (ocr_status IN ('pending', 'processing', 'success', 'error')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TRANSACTION SPLITS (for partial business use)
-- ============================================
CREATE TABLE transaction_splits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES bank_transactions(id) ON DELETE CASCADE,
    category_id UUID REFERENCES transaction_categories(id),
    amount DECIMAL(12,2) NOT NULL,
    percentage DECIMAL(5,2),
    description TEXT,
    is_business BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- ACCOUNTING EXPORTS
-- ============================================
CREATE TABLE accounting_exports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    export_type TEXT CHECK (export_type IN ('datev', 'csv', 'excel')),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    transaction_count INTEGER,
    total_income DECIMAL(12,2),
    total_expense DECIMAL(12,2),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- RLS POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE transaction_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_exports ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own data
CREATE POLICY "accounting_own_data" ON transaction_categories
    FOR ALL TO authenticated USING (user_id = auth.uid() OR is_system = true);

CREATE POLICY "accounting_own_data" ON bank_statements
    FOR ALL TO authenticated USING (user_id = auth.uid());

CREATE POLICY "accounting_own_data" ON bank_transactions
    FOR ALL TO authenticated USING (user_id = auth.uid());

CREATE POLICY "accounting_own_data" ON invoices
    FOR ALL TO authenticated USING (user_id = auth.uid());

CREATE POLICY "accounting_own_data" ON receipts
    FOR ALL TO authenticated USING (user_id = auth.uid());

CREATE POLICY "accounting_own_data" ON transaction_splits
    FOR ALL TO authenticated USING (transaction_id IN (
        SELECT id FROM bank_transactions WHERE user_id = auth.uid()
    ));

CREATE POLICY "accounting_own_data" ON accounting_exports
    FOR ALL TO authenticated USING (user_id = auth.uid());

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_bank_transactions_user_date ON bank_transactions(user_id, transaction_date);
CREATE INDEX idx_bank_transactions_category ON bank_transactions(category_id);
CREATE INDEX idx_bank_transactions_status ON bank_transactions(status);
CREATE INDEX idx_invoices_user_date ON invoices(user_id, invoice_date);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_receipts_user ON receipts(user_id);
CREATE INDEX idx_receipts_status ON receipts(ocr_status);

-- ============================================
-- TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_transaction_categories_updated_at BEFORE UPDATE ON transaction_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bank_transactions_updated_at BEFORE UPDATE ON bank_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_receipts_updated_at BEFORE UPDATE ON receipts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
