# Hernies Buchhaltung - Frontend

## 🌈 Dein freundlicher Accounting-Helper im Cartoon-Stil!

### Features

- **Hernie** - Ein animierter Maskottchen-Charakter mit verschiedenen Stimmungen
- **Drag & Drop Upload** - Belege hochladen mit Live-OCR-Fortschritt
- **Monatsübersicht** - Bunte Karten zeigen Status (vollständig/unvollständig)
- **Export für Steuerbüro** - Mit Kommentaren für fehlende Belege

### Pages

| Route | Beschreibung |
|-------|-------------|
| `/dashboard` | Übersicht mit Hernie, Monatskarten, Statistiken |
| `/upload` | Belege hochladen (Foto/PDF), OCR Erkennung |
| `/export` | DATEV/CSV Export mit Vorschau |

### Design

- Pastell-Farbverläufe (Rosa/Lila/Blau/Orange/Grün)
- Abgerundete Ecken (2xl-3xl)
- Dicke Borders (4px)
- Framer Motion Animationen
- Responsive Grid Layout

### Hernie

- SVG-Charakter mit morphing Blob-Körper
- Blinkende Augen Animation
- Stimmungsbasierte Farben und Ausdrücke
- Sprechblasen-Nachrichten
- Schwebende Funken

### Installation

```bash
cd src/frontend
npm install
npm run dev
```

### Build

```bash
npm run build
# Output in dist/ für statisches Hosting
```

### Umgebungsvariablen

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```
