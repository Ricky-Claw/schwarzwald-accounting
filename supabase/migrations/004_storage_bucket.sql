-- ============================================
-- MIGRATION 004: Storage Bucket für Dokumente
-- ============================================

-- Storage Bucket erstellen
INSERT INTO storage.buckets (id, name, public)
VALUES ('accounting-documents', 'accounting-documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies für Storage
CREATE POLICY "Users can upload own documents" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'accounting-documents' 
        AND auth.uid() = owner
    );

CREATE POLICY "Users can view own documents" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'accounting-documents' 
        AND auth.uid() = owner
    );

CREATE POLICY "Users can delete own documents" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'accounting-documents' 
        AND auth.uid() = owner
    );

-- Allow public read for authenticated users
CREATE POLICY "Authenticated users can read documents" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'accounting-documents');
