-- ============================================
-- LANISTA BUCHHALTUNG - Komplettes Setup
-- Alle Tabellen, Buckets, Policies
-- ============================================

-- ============================================
-- EXTENSIONS
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- STORAGE BUCKET (Erst zuerst, da Referenziert)
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('accounting-documents', 'accounting-documents', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- FUNCTION: Update Timestamp
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================
-- TABLE: Transaction Categories (SKR04)
-- ============================================
CREATE TABLE IF NOT EXISTS transaction_categories (
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

-- Standard SKR04 Kategorien
INSERT INTO transaction_categories (code, name, account_type, vat_rate, is_system) VALUES
-- Einnahmen
('8400', 'Sonstige Einnahmen', 'income', 0, true),
('8300', 'Provisionserlöse', 'income', 19, true),
('8200', 'Erträge aus Warenverkauf', 'income', 19, true),
-- Ausgaben
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
-- Anlagevermögen
('0420', 'Büromöbel', 'asset', 19, true),
('0440', 'Computer/Hardware', 'asset', 19, true),
('0460', 'Software', 'asset', 19, true),
('0500', 'Fahrzeuge', 'asset', 19, true)
ON CONFLICT DO NOTHING;

-- ============================================
-- TABLE: Bank Statements (Kontoauszüge)
-- ============================================
CREATE TABLE IF NOT EXISTS bank_statements (
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
-- TABLE: Bank Transactions (Buchungen)
-- ============================================
CREATE TABLE IF NOT EXISTS bank_transactions (
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
-- TABLE: Invoices (Rechnungen)
-- ============================================
CREATE TABLE IF NOT EXISTS invoices (
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
-- TABLE: Receipts (Belege mit OCR)
-- ============================================
CREATE TABLE IF NOT EXISTS receipts (
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
-- TABLE: Transaction Splits (Aufteilung)
-- ============================================
CREATE TABLE IF NOT EXISTS transaction_splits (
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
-- TABLE: Accounting Exports (DATEV/CSV)
-- ============================================
CREATE TABLE IF NOT EXISTS accounting_exports (
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
-- TABLE: Amazon Documents
-- ============================================
CREATE TABLE IF NOT EXISTS amazon_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL CHECK (document_type IN (
        'settlement_statement',
        'transaction_report',
        'inventory_report',
        'payment_report',
        'vat_invoice',
        'fee_statement',
        'advertising_invoice'
    )),
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'success', 'error')),
    processed_data JSONB,
    ocr_confidence DECIMAL(3,2),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- RLS POLICIES - Tables
-- ============================================
ALTER TABLE transaction_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE amazon_documents ENABLE ROW LEVEL SECURITY;

-- Categories
CREATE POLICY IF NOT EXISTS "accounting_own_data" ON transaction_categories
    FOR ALL TO authenticated USING (user_id = auth.uid() OR is_system = true);

-- Bank Statements
CREATE POLICY IF NOT EXISTS "accounting_own_data" ON bank_statements
    FOR ALL TO authenticated USING (user_id = auth.uid());

-- Bank Transactions
CREATE POLICY IF NOT EXISTS "accounting_own_data" ON bank_transactions
    FOR ALL TO authenticated USING (user_id = auth.uid());

-- Invoices
CREATE POLICY IF NOT EXISTS "accounting_own_data" ON invoices
    FOR ALL TO authenticated USING (user_id = auth.uid());

-- Receipts
CREATE POLICY IF NOT EXISTS "accounting_own_data" ON receipts
    FOR ALL TO authenticated USING (user_id = auth.uid());

-- Transaction Splits
CREATE POLICY IF NOT EXISTS "accounting_own_data" ON transaction_splits
    FOR ALL TO authenticated USING (transaction_id IN (
        SELECT id FROM bank_transactions WHERE user_id = auth.uid()
    ));

-- Exports
CREATE POLICY IF NOT EXISTS "accounting_own_data" ON accounting_exports
    FOR ALL TO authenticated USING (user_id = auth.uid());

-- Amazon Documents
CREATE POLICY IF NOT EXISTS "amazon_documents_own_data" ON amazon_documents
    FOR ALL TO authenticated USING (user_id = auth.uid());

-- ============================================
-- RLS POLICIES - Storage
-- ============================================
CREATE POLICY IF NOT EXISTS "Users can upload own documents" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'accounting-documents' 
        AND auth.uid() = owner
    );

CREATE POLICY IF NOT EXISTS "Users can view own documents" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'accounting-documents' 
        AND auth.uid() = owner
    );

CREATE POLICY IF NOT EXISTS "Users can delete own documents" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'accounting-documents' 
        AND auth.uid() = owner
    );

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_bank_transactions_user_date ON bank_transactions(user_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_category ON bank_transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_status ON bank_transactions(status);
CREATE INDEX IF NOT EXISTS idx_invoices_user_date ON invoices(user_id, invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_receipts_user ON receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_receipts_transaction ON receipts(bank_transaction_id);
CREATE INDEX IF NOT EXISTS idx_receipts_status ON receipts(ocr_status);
CREATE INDEX IF NOT EXISTS idx_amazon_docs_user ON amazon_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_amazon_docs_type ON amazon_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_amazon_docs_status ON amazon_documents(status);

-- ============================================
-- TRIGGERS
-- ============================================
CREATE TRIGGER IF NOT EXISTS update_transaction_categories_updated_at 
    BEFORE UPDATE ON transaction_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_bank_transactions_updated_at 
    BEFORE UPDATE ON bank_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_invoices_updated_at 
    BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_receipts_updated_at 
    BEFORE UPDATE ON receipts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_amazon_docs_updated_at 
    BEFORE UPDATE ON amazon_documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VIEWS FÜR DASHBOARD
-- ============================================
CREATE OR REPLACE VIEW monthly_receipt_overview AS
SELECT 
    user_id,
    DATE_TRUNC('month', receipt_date) as month,
    COUNT(*) as total_receipts,
    COUNT(bank_transaction_id) as matched_receipts,
    COUNT(*) - COUNT(bank_transaction_id) as unmatched_receipts,
    SUM(total_amount) as total_amount
FROM receipts
WHERE receipt_date IS NOT NULL
GROUP BY user_id, DATE_TRUNC('month', receipt_date);

CREATE OR REPLACE VIEW missing_receipts_by_month AS
SELECT 
    bt.user_id,
    DATE_TRUNC('month', bt.transaction_date) as month,
    COUNT(*) as missing_count,
    SUM(ABS(bt.amount)) as missing_amount
FROM bank_transactions bt
WHERE bt.amount < 0
  AND bt.receipt_id IS NULL
GROUP BY bt.user_id, DATE_TRUNC('month', bt.transaction_date);

-- ============================================
-- SETUP COMPLETE
-- ============================================
