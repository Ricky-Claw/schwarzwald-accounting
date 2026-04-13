-- ============================================
-- MIGRATION 002: Receipts & Amazon Documents
-- ============================================

-- ============================================
-- RECEIPTS (Belege mit OCR)
-- ============================================
CREATE TABLE receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- OCR-Daten
    merchant_name TEXT,
    receipt_date DATE,
    total_amount DECIMAL(12,2),
    vat_amount DECIMAL(12,2),
    currency TEXT DEFAULT 'EUR',
    
    -- Kategorie & Verknüpfung
    category_id UUID REFERENCES transaction_categories(id),
    bank_transaction_id UUID REFERENCES bank_transactions(id),
    
    -- Datei
    file_path TEXT NOT NULL,
    ocr_confidence DECIMAL(3,2),
    ocr_raw JSONB,
    ocr_status TEXT DEFAULT 'pending' CHECK (ocr_status IN ('pending', 'processing', 'success', 'error')),
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- AMAZON SELLER CENTRAL DOCUMENTS
-- ============================================
CREATE TABLE amazon_documents (
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
    
    -- Extrahierte Daten
    processed_data JSONB,
    ocr_confidence DECIMAL(3,2),
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE amazon_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "receipts_own_data" ON receipts
    FOR ALL TO authenticated USING (user_id = auth.uid());

CREATE POLICY "amazon_documents_own_data" ON amazon_documents
    FOR ALL TO authenticated USING (user_id = auth.uid());

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_receipts_user_date ON receipts(user_id, receipt_date);
CREATE INDEX idx_receipts_transaction ON receipts(bank_transaction_id);
CREATE INDEX idx_receipts_status ON receipts(ocr_status);
CREATE INDEX idx_amazon_docs_user ON amazon_documents(user_id);
CREATE INDEX idx_amazon_docs_type ON amazon_documents(document_type);
CREATE INDEX idx_amazon_docs_status ON amazon_documents(status);

-- ============================================
-- TRIGGERS
-- ============================================
CREATE TRIGGER update_receipts_updated_at BEFORE UPDATE ON receipts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_amazon_docs_updated_at BEFORE UPDATE ON amazon_documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- STORAGE BUCKET
-- ============================================
-- Buckets müssen über Supabase Dashboard oder CLI erstellt werden:
-- supabase storage create accounting-documents --public

-- ============================================
-- VIEWS FÜR DASHBOARD
-- ============================================

-- Monatliche Übersicht
CREATE VIEW monthly_receipt_overview AS
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

-- Fehlende Belege pro Monat (Ausgaben ohne Beleg)
CREATE VIEW missing_receipts_by_month AS
SELECT 
    bt.user_id,
    DATE_TRUNC('month', bt.transaction_date) as month,
    COUNT(*) as missing_count,
    SUM(ABS(bt.amount)) as missing_amount
FROM bank_transactions bt
WHERE bt.amount < 0
  AND bt.receipt_id IS NULL
GROUP BY bt.user_id, DATE_TRUNC('month', bt.transaction_date);
