-- ============================================
-- KATEGORIEN & RECHNUNGSTYP (Eingang/Ausgang)
-- ============================================

-- Invoice type für receipts
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS invoice_type TEXT DEFAULT 'incoming' 
  CHECK (invoice_type IN ('incoming', 'outgoing'));

-- Kategorie-ID
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS category_id TEXT;

-- SKR04 Kontonummer
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS skr04_code TEXT;

-- Rechnungsnummer (für Dateinamen)
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS invoice_number TEXT;

-- Umbenannter Dateiname
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS file_name_display TEXT;

-- Index für schnelle Kategorie-Filter
CREATE INDEX IF NOT EXISTS idx_receipts_category ON receipts(category_id);
CREATE INDEX IF NOT EXISTS idx_receipts_invoice_type ON receipts(invoice_type);
CREATE INDEX IF NOT EXISTS idx_receipts_skr04 ON receipts(skr04_code);

-- Tabelle für Kategorien (lokal im Code definiert, aber optional erweiterbar)
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

-- Standard-Kategorien einfügen
INSERT INTO expense_categories (id, name, skr04_code, description, vat_rate, keywords, is_default) VALUES
('buero_material', 'Büromaterial', '4400', 'Papier, Stifte, Ordner', 19, ARRAY['büro', 'papier', 'stift', 'ordner'], true),
('it_hardware', 'IT & Hardware', '0440', 'Computer, Laptop, Monitor', 19, ARRAY['computer', 'laptop', 'hardware'], true),
('software', 'Software & Lizenzen', '0460', 'Programme, Cloud', 19, ARRAY['software', 'cloud', 'lizenz'], true),
('telefon_internet', 'Telefon & Internet', '6800', 'Handy, DSL, VoIP', 19, ARRAY['telefon', 'internet', 'handy'], true),
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
