# Schwarzwald Accounting

Buchhaltungs-Management für Schwarzwald Agent - Kontoauszüge, Rechnungen, Belege mit OCR.

## Features

- 📄 **Kontoauszüge** - PDF/CSV/CAMT hochladen & verarbeiten
- 🧾 **Rechnungen** - Eingehend & ausgehend verwalten
- 📸 **Belege** - OCR-gestützte Erfassung (Azure/AWS)
- 📤 **Export** - DATEV, CSV, Excel für Steuerberater
- 🏷️ **Kategorien** - SKR04 Standard für Deutschland

## Tech Stack

| Komponente | Technologie |
|------------|-------------|
| Frontend | Next.js 14 + TypeScript |
| Backend | Express.js + TypeScript |
| Database | PostgreSQL (Supabase) |
| OCR | Azure Form Recognizer |
| Storage | Supabase Storage |
| Auth | Supabase Auth |

## Datenbank Schema

```
bank_statements       - Kontoauszüge
bank_transactions     - Einzeltransaktionen
transaction_categories - SKR04 Kategorien
invoices              - Rechnungen
receipts              - Belege/Quittungen
accounting_exports    - Export-History
```

## API Endpoints

```
GET    /api/accounting/statements
POST   /api/accounting/statements
GET    /api/accounting/transactions
PATCH  /api/accounting/transactions/:id
GET    /api/accounting/invoices
POST   /api/accounting/invoices
GET    /api/accounting/receipts
POST   /api/accounting/receipts
POST   /api/accounting/export
```

## Installation

```bash
# Clone
git clone https://github.com/Ricky-Claw/schwarzwald-accounting.git
cd schwarzwald-accounting

# Backend
npm install
npm run dev

# Frontend
cd src/frontend
npm install
npm run dev
```

## Umgebungsvariablen

```env
# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
SUPABASE_ANON_KEY=

# OCR (Azure)
AZURE_FORM_RECOGNIZER_KEY=
AZURE_FORM_RECOGNIZER_ENDPOINT=

# Storage
STORAGE_BUCKET=receipts
```

## Roadmap

- [x] Repository Setup
- [ ] Phase 1: DB Schema & Basis-API
- [ ] Phase 2: Kontoauszug-Upload
- [ ] Phase 3: Rechnungsverwaltung
- [ ] Phase 4: OCR Integration
- [ ] Phase 5: DATEV Export

## Lizenz

MIT
