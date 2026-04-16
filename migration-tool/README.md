# Supabase Migration Tool

SQL Migrationen direkt in Supabase ausführen - ohne Dashboard, ohne psql.

## Quick Start

```bash
cd migration-tool
npm install
npm run migrate
```

## Neue Migration erstellen

```bash
node cli.js create "add invoice type column"
```

Erstellt: `migrations/20260416_105800_add_invoice_type_column.sql`

## Migration bearbeiten

Öffne die generierte `.sql` Datei und füge dein SQL ein:

```sql
-- Migration: add invoice type column
ALTER TABLE receipts ADD COLUMN invoice_type TEXT DEFAULT 'incoming';
```

## Migrationen ausführen

```bash
npm run migrate
```

Das Tool:
- Verbindet direkt zur PostgreSQL DB
- Führt nur neue Migrationen aus (Tracking in `_migrations` Tabelle)
- Rollback bei Fehlern (Transaktionen)
- Zeigt Dauer pro Migration

## Konfiguration

`.env` Datei:
```
DB_HOST=db.cbtwwgxunyfksopxwglb.supabase.co
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=dein-passwort
DB_SSL=true
```

## Features

✅ Automatische Tracking-Tabelle (`_migrations`)  
✅ Transaktions-Sicherheit (Rollback bei Fehler)  
✅ Checksum-Validierung  
✅ Zeitmessung pro Migration  
✅ Keine doppelte Ausführung  
