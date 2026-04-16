// Migration Script using Supabase REST API
const SUPABASE_URL = 'https://cbtwwgxunyfksopxwglb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNidHd3Z3h1bnlma3NvcHh3Z2xiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE1NjM5OSwiZXhwIjoyMDkxNzMyMzk5fQ.q88YQbEDDQdBPmUGweWGTZaQta5Eo9FMxg9C-o4uSFY';

async function query(sql) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Query failed: ${error}`);
  }
  return await response.json();
}

async function migrate() {
  console.log('Starting migration...');
  
  try {
    // Add columns
    await query(`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS invoice_type TEXT DEFAULT 'incoming' CHECK (invoice_type IN ('incoming', 'outgoing'))`);
    console.log('✓ Added invoice_type column');
    
    await query(`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS category_id TEXT`);
    console.log('✓ Added category_id column');
    
    await query(`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS skr04_code TEXT`);
    console.log('✓ Added skr04_code column');
    
    await query(`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS invoice_number TEXT`);
    console.log('✓ Added invoice_number column');
    
    await query(`ALTER TABLE receipts ADD COLUMN IF NOT EXISTS file_name_display TEXT`);
    console.log('✓ Added file_name_display column');
    
    // Create indexes
    await query(`CREATE INDEX IF NOT EXISTS idx_receipts_category ON receipts(category_id)`);
    console.log('✓ Created idx_receipts_category');
    
    await query(`CREATE INDEX IF NOT EXISTS idx_receipts_invoice_type ON receipts(invoice_type)`);
    console.log('✓ Created idx_receipts_invoice_type');
    
    await query(`CREATE INDEX IF NOT EXISTS idx_receipts_skr04 ON receipts(skr04_code)`);
    console.log('✓ Created idx_receipts_skr04');
    
    // Create categories table
    await query(`CREATE TABLE IF NOT EXISTS expense_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      skr04_code TEXT NOT NULL,
      description TEXT,
      vat_rate INTEGER DEFAULT 19,
      keywords TEXT[],
      is_default BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT now()
    )`);
    console.log('✓ Created expense_categories table');
    
    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

migrate();
