-- ============================================
-- MIGRATION 003: Export & Comments
-- ============================================

-- ============================================
-- ADD NOTES TO TRANSACTIONS
-- ============================================
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS notes TEXT;

-- ============================================
-- ADD NOTES TO RECEIPTS
-- ============================================
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS notes TEXT;

-- ============================================
-- EXPORT LOG (Tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS export_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    period_month INTEGER NOT NULL,
    period_year INTEGER NOT NULL,
    format TEXT NOT NULL CHECK (format IN ('datev', 'csv')),
    include_incomplete BOOLEAN DEFAULT false,
    comment TEXT,
    file_name TEXT NOT NULL,
    summary JSONB NOT NULL,
    downloaded_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS fuer Export Logs
ALTER TABLE export_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "export_logs_own_data" ON export_logs
    FOR ALL TO authenticated USING (user_id = auth.uid());

CREATE INDEX idx_export_logs_user ON export_logs(user_id, period_year, period_month);

-- ============================================
-- VIEW: Export-Status pro Monat
-- ============================================
CREATE OR REPLACE VIEW monthly_export_status AS
SELECT 
    bt.user_id,
    EXTRACT(YEAR FROM bt.transaction_date)::INTEGER as year,
    EXTRACT(MONTH FROM bt.transaction_date)::INTEGER as month,
    COUNT(*) as total_transactions,
    COUNT(bt.receipt_id) as with_receipt,
    COUNT(*) - COUNT(bt.receipt_id) as without_receipt,
    SUM(CASE WHEN bt.amount > 0 THEN bt.amount ELSE 0 END) as total_income,
    SUM(CASE WHEN bt.amount < 0 THEN ABS(bt.amount) ELSE 0 END) as total_expense,
    CASE 
        WHEN COUNT(*) = 0 THEN 'empty'
        WHEN COUNT(*) = COUNT(bt.receipt_id) THEN 'complete'
        ELSE 'incomplete'
    END as status
FROM bank_transactions bt
GROUP BY bt.user_id, EXTRACT(YEAR FROM bt.transaction_date), EXTRACT(MONTH FROM bt.transaction_date);

-- ============================================
-- FUNCTION: Transaction mit Notiz updaten
-- ============================================
CREATE OR REPLACE FUNCTION update_transaction_notes(
    p_transaction_id UUID,
    p_user_id UUID,
    p_notes TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE bank_transactions
    SET notes = p_notes,
        updated_at = now()
    WHERE id = p_transaction_id
      AND user_id = p_user_id;
    
    RETURN FOUND;
END;
$$;
