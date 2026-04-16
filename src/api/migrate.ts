// ============================================
// MIGRATION API - Run SQL migrations via backend
// ============================================

import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const MIGRATION_SQL = `
-- Migration: Add categories and invoice type
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS invoice_type TEXT DEFAULT 'incoming' CHECK (invoice_type IN ('incoming', 'outgoing'));
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS category_id TEXT;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS skr04_code TEXT;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS file_name_display TEXT;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_receipts_category ON receipts(category_id);
CREATE INDEX IF NOT EXISTS idx_receipts_invoice_type ON receipts(invoice_type);
CREATE INDEX IF NOT EXISTS idx_receipts_skr04 ON receipts(skr04_code);

-- Create categories table
CREATE TABLE IF NOT EXISTS expense_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  skr04_code TEXT NOT NULL,
  description TEXT,
  vat_rate INTEGER DEFAULT 19,
  keywords TEXT[],
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default categories
INSERT INTO expense_categories (id, name, skr04_code, description, vat_rate, keywords, is_default) VALUES
('buero_material', 'Büromaterial', '4400', 'Papier, Stifte, Ordner', 19, ARRAY['büro', 'papier', 'stift', 'ordner'], true),
('it_hardware', 'IT & Hardware', '0440', 'Computer, Laptop, Monitor', 19, ARRAY['computer', 'laptop', 'hardware'], true),
('software', 'Software & Lizenzen', '0460', 'Programme, Cloud', 19, ARRAY['software', 'cloud', 'lizenz'], true),
('telefon_internet', 'Telefon & Internet', '6800', 'Handy, Festnetz, DSL', 19, ARRAY['telefon', 'internet', 'handy'], true),
('reisekosten', 'Reisekosten', '4600', 'Bahn, Hotel, Flug', 19, ARRAY['bahn', 'hotel', 'flug', 'taxi'], true),
('fahrzeug_sprit', 'Fahrzeug - Sprit', '6610', 'Tanken, Kraftstoff', 19, ARRAY['tankstelle', 'sprit', 'benzin'], true),
('fahrzeug_wartung', 'Fahrzeug - Wartung', '6620', 'Reparatur, Inspektion', 19, ARRAY['werkstatt', 'reparatur', 'reifen'], true),
('werbung_marketing', 'Werbung & Marketing', '6900', 'Anzeigen, Flyer', 19, ARRAY['werbung', 'marketing', 'flyer'], true),
('miete_nebenkosten', 'Miete & Nebenkosten', '6600', 'Büromiete, Heizung', 19, ARRAY['miete', 'heizung', 'nebenkosten'], true),
('strom', 'Strom', '6700', 'Stromrechnung', 19, ARRAY['strom', 'elektrizität'], true),
('versicherungen', 'Versicherungen', '6600', 'Haftpflicht, Rechtsschutz', 19, ARRAY['versicherung', 'haftpflicht'], true),
('fortbildung', 'Fortbildung & Schulung', '6900', 'Kurse, Seminare', 19, ARRAY['fortbildung', 'schulung', 'kurs'], true),
('bewirtung', 'Bewirtung & Geschenke', '6900', 'Kundenbewirtung', 19, ARRAY['restaurant', 'essen', 'geschenk'], true),
('reinigung', 'Reinigung & Wartung', '6600', 'Gebäudereinigung', 19, ARRAY['reinigung', 'garten'], true),
('sonstiges', 'Sonstige Betriebsausgaben', '4900', 'Alles andere', 19, ARRAY[], true),
('warenverkauf', 'Warenverkauf (Einnahme)', '8200', 'Verkauf von Waren', 19, ARRAY[], true),
('dienstleistungen', 'Dienstleistungen (Einnahme)', '8400', 'Erbrachte Leistungen', 19, ARRAY[], true)
ON CONFLICT (id) DO NOTHING;
`;

// ============================================
// POST /api/migrate
// Run pending migrations
// ============================================
router.post('/', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    console.log('🚀 Running database migration...');

    // Execute migration SQL
    const { error } = await supabase.rpc('exec_sql', { sql: MIGRATION_SQL });

    if (error) {
      console.error('Migration error:', error);
      
      // Fallback: Try executing statements one by one
      const statements = MIGRATION_SQL.split(';').filter(s => s.trim());
      const results = [];
      
      for (const stmt of statements) {
        if (!stmt.trim() || stmt.trim().startsWith('--')) continue;
        
        const { error: stmtError } = await supabase.rpc('exec_sql', { 
          sql: stmt.trim() + ';' 
        });
        
        results.push({
          statement: stmt.trim().substring(0, 50) + '...',
          success: !stmtError,
          error: stmtError?.message
        });
      }

      return res.json({ 
        success: true, 
        message: 'Migration completed with individual statements',
        results 
      });
    }

    console.log('✅ Migration completed successfully');
    res.json({ success: true, message: 'Migration completed' });

  } catch (error: any) {
    console.error('Migration failed:', error);
    res.status(500).json({ error: 'Migration failed', details: error.message });
  }
});

// ============================================
// GET /api/migrate/status
// Check migration status
// ============================================
router.get('/status', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Check if columns exist
    const { data: columns, error } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'receipts')
      .eq('table_schema', 'public');

    if (error) throw error;

    const columnNames = columns?.map(c => c.column_name) || [];
    
    res.json({
      has_invoice_type: columnNames.includes('invoice_type'),
      has_category_id: columnNames.includes('category_id'),
      has_skr04_code: columnNames.includes('skr04_code'),
      has_invoice_number: columnNames.includes('invoice_number'),
      has_file_name_display: columnNames.includes('file_name_display'),
      columns: columnNames
    });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
