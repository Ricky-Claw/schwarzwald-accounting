// ============================================
// BUCHHALTUNGSKATEGORIEN MIT SKR04-KONTEN
// ============================================

export interface ExpenseCategory {
  id: string;
  name: string;
  skr04Code: string;
  description: string;
  vatRate: number; // 0, 7, oder 19
  keywords: string[]; // Für automatische Kategorisierung
}

export interface CategoryDecision {
  category: ExpenseCategory;
  confidence: 'high' | 'medium' | 'low';
  needsReview: boolean;
  reason: string;
  suggestedQuestions: string[];
}

// Eingangsrechnungen (Ausgaben)
export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  {
    id: 'buero_material',
    name: 'Büromaterial',
    skr04Code: '4400',
    description: 'Papier, Stifte, Ordner, Verbrauchsmaterial',
    vatRate: 19,
    keywords: ['büro', 'papier', 'stift', 'ordner', 'druckerpatrone', 'toner', 'tinte']
  },
  {
    id: 'it_hardware',
    name: 'IT & Hardware',
    skr04Code: '0440',
    description: 'Computer, Laptop, Monitor, Drucker (Anlagegut > 250€)',
    vatRate: 19,
    keywords: ['computer', 'laptop', 'monitor', 'drucker', 'maus', 'tastatur', 'hardware', 'pc', 'notebook']
  },
  {
    id: 'software',
    name: 'Software & Lizenzen',
    skr04Code: '0460',
    description: 'Programme, Cloud-Dienste, Abonnements',
    vatRate: 19,
    keywords: ['software', 'lizenz', 'cloud', 'abonnement', 'subscription', 'adobe', 'microsoft', 'office']
  },
  {
    id: 'telefon_internet',
    name: 'Telefon & Internet',
    skr04Code: '6800',
    description: 'Handy, Festnetz, DSL, VoIP',
    vatRate: 19,
    keywords: ['telefon', 'internet', 'dsl', 'handy', 'mobil', 'vodafone', 'telekom', 'o2']
  },
  {
    id: 'reisekosten',
    name: 'Reisekosten',
    skr04Code: '4600',
    description: 'Bahn, Hotel, Flug, Taxi, Mietwagen',
    vatRate: 19,
    keywords: ['bahn', 'db', 'hotel', 'flug', 'taxi', 'mietwagen', 'uber', 'reise', 'booking', 'airbnb']
  },
  {
    id: 'fahrzeug_sprit',
    name: 'Fahrzeug - Sprit',
    skr04Code: '6610',
    description: 'Tanken, Kraftstoff',
    vatRate: 19,
    keywords: ['tankstelle', 'sprit', 'diesel', 'benzin', 'aral', 'shell', 'total', 'jet']
  },
  {
    id: 'fahrzeug_wartung',
    name: 'Fahrzeug - Wartung',
    skr04Code: '6620',
    description: 'Reparatur, Inspektion, Reifen, Maut',
    vatRate: 19,
    keywords: ['werkstatt', 'reparatur', 'inspektion', 'reifen', 'maut', 'toll', 'kfz', 'autowerkstatt']
  },
  {
    id: 'werbung_marketing',
    name: 'Werbung & Marketing',
    skr04Code: '6900',
    description: 'Anzeigen, Flyer, Messe, Online-Marketing',
    vatRate: 19,
    keywords: ['werbung', 'marketing', 'flyer', 'messe', 'google ads', 'facebook', 'instagram', 'druck']
  },
  {
    id: 'miete_nebenkosten',
    name: 'Miete & Nebenkosten',
    skr04Code: '6600',
    description: 'Büromiete, Lager, Heizung, Wasser',
    vatRate: 19,
    keywords: ['miete', 'pacht', 'heizung', 'wasser', 'abfall', 'grundstück', 'nebenkosten']
  },
  {
    id: 'strom',
    name: 'Strom',
    skr04Code: '6700',
    description: 'Stromrechnung Büro/Lager',
    vatRate: 19,
    keywords: ['strom', 'elektrizität', 'e.on', 'rwe', 'vattenfall', 'stromrechnung']
  },
  {
    id: 'versicherungen',
    name: 'Versicherungen',
    skr04Code: '6600',
    description: 'Betriebshaftpflicht, Rechtsschutz, Sachversicherung',
    vatRate: 19,
    keywords: ['versicherung', 'haftpflicht', 'rechtsschutz', 'allianz', 'huk', 'axa']
  },
  {
    id: 'fortbildung',
    name: 'Fortbildung & Schulung',
    skr04Code: '6900',
    description: 'Kurse, Seminare, Fachbücher, Coaching',
    vatRate: 19,
    keywords: ['fortbildung', 'schulung', 'seminar', 'kurs', 'coaching', 'buch', 'fachbuch']
  },
  {
    id: 'bewirtung',
    name: 'Bewirtung & Geschenke',
    skr04Code: '6900',
    description: 'Kundenbewirtung, Geschenke (bis 35€ steuerfrei)',
    vatRate: 19,
    keywords: ['restaurant', 'essen', 'geschenk', 'bewirtung', 'kaffee', 'catering']
  },
  {
    id: 'arbeitskleidung',
    name: 'Arbeitskleidung',
    skr04Code: '4980',
    description: 'Beruflich notwendige Schutz- oder Arbeitskleidung',
    vatRate: 19,
    keywords: ['arbeitskleidung', 'schutzkleidung', 'sicherheitsschuhe', 'engelbert', 'strauss', 'workwear']
  },
  {
    id: 'reinigung',
    name: 'Reinigung & Wartung',
    skr04Code: '6600',
    description: 'Gebäudereinigung, Gartenpflege',
    vatRate: 19,
    keywords: ['reinigung', 'gebäudereinigung', 'garten', 'pflege', 'wartung']
  },
  {
    id: 'sonstiges',
    name: 'Sonstige Betriebsausgaben',
    skr04Code: '4900',
    description: 'Alles andere ohne spezielle Kategorie',
    vatRate: 19,
    keywords: []
  }
];

// Ausgangsrechnungen (Einnahmen)
export const INCOME_CATEGORIES: ExpenseCategory[] = [
  {
    id: 'warenverkauf',
    name: 'Warenverkauf',
    skr04Code: '8200',
    description: 'Verkauf von Waren/Produkten',
    vatRate: 19,
    keywords: ['verkauf', 'waren', 'produkt']
  },
  {
    id: 'dienstleistungen',
    name: 'Dienstleistungen',
    skr04Code: '8400',
    description: 'Erbrachte Dienstleistungen',
    vatRate: 19,
    keywords: ['dienstleistung', 'service', 'beratung', 'honorar']
  },
  {
    id: 'sonstige_einnahmen',
    name: 'Sonstige Einnahmen',
    skr04Code: '8400',
    description: 'Nicht reguläre Einnahmen',
    vatRate: 19,
    keywords: []
  }
];

// Automatische Kategorisierung basierend auf Händlername
export function autoCategorize(merchantName: string): ExpenseCategory {
  const lowerMerchant = merchantName.toLowerCase();
  
  for (const category of EXPENSE_CATEGORIES) {
    for (const keyword of category.keywords) {
      if (lowerMerchant.includes(keyword.toLowerCase())) {
        return category;
      }
    }
  }
  
  // Default: Sonstiges
  return EXPENSE_CATEGORIES.find(c => c.id === 'sonstiges')!;
}

export function decideCategory(
  merchantName: string | undefined,
  purposeNote?: string,
  manualCategoryId?: string
): CategoryDecision {
  const allCategories = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

  if (manualCategoryId) {
    const manualCategory = allCategories.find(c => c.id === manualCategoryId);
    if (manualCategory) {
      return {
        category: manualCategory,
        confidence: 'high',
        needsReview: false,
        reason: 'Kategorie manuell gewählt.',
        suggestedQuestions: []
      };
    }
  }

  const combined = `${merchantName || ''} ${purposeNote || ''}`.toLowerCase();
  const fallback = EXPENSE_CATEGORIES.find(c => c.id === 'sonstiges')!;

  const ambiguousRules: Array<{
    match: string[];
    categoryId: string;
    reason: string;
    questions: string[];
  }> = [
    {
      match: ['kaffee', 'cafe', 'café', 'bäcker', 'baecker', 'restaurant', 'essen', 'starbucks'],
      categoryId: 'bewirtung',
      reason: 'Verpflegung/Bewirtung braucht meistens Anlass und ggf. Teilnehmer.',
      questions: ['War es Kundentermin, Mitarbeiterverpflegung oder privat?', 'Bitte Anlass/Teilnehmer in der Notiz ergänzen.']
    },
    {
      match: ['kleidung', 'hose', 'shirt', 'jacke', 'schuhe', 'zalando', 'h&m', 'c&a'],
      categoryId: 'arbeitskleidung',
      reason: 'Kleidung ist nur abziehbar, wenn sie klar beruflich/Schutzkleidung ist.',
      questions: ['Ist es Arbeits-/Schutzkleidung?', 'Falls ja: Zweck ergänzen, z.B. Lager, Baustelle, Messe.']
    },
    {
      match: ['amazon', 'metro', 'kaufland', 'edeka', 'rewe', 'lidl', 'aldi'],
      categoryId: 'sonstiges',
      reason: 'Gemischte Händler/Warenkörbe sind ohne Zweck oft nicht eindeutig.',
      questions: ['Welche Artikel waren betrieblich?', 'Bitte Zweck oder Positionen ergänzen.']
    }
  ];

  for (const rule of ambiguousRules) {
    if (rule.match.some(keyword => combined.includes(keyword))) {
      const category = EXPENSE_CATEGORIES.find(c => c.id === rule.categoryId) || fallback;
      const hasUsefulNote = !!purposeNote && purposeNote.trim().length >= 8;
      return {
        category,
        confidence: hasUsefulNote ? 'medium' : 'low',
        needsReview: !hasUsefulNote,
        reason: hasUsefulNote ? `${rule.reason} Zweck wurde ergänzt.` : rule.reason,
        suggestedQuestions: hasUsefulNote ? [] : rule.questions
      };
    }
  }

  if (merchantName) {
    const category = autoCategorize(merchantName);
    return {
      category,
      confidence: category.id === 'sonstiges' ? 'low' : 'high',
      needsReview: category.id === 'sonstiges',
      reason: category.id === 'sonstiges' ? 'Keine eindeutige Kategorie erkannt.' : 'Kategorie über Händler/Keywords erkannt.',
      suggestedQuestions: category.id === 'sonstiges' ? ['Bitte betrieblichen Zweck ergänzen.'] : []
    };
  }

  return {
    category: fallback,
    confidence: 'low',
    needsReview: true,
    reason: 'OCR konnte keinen eindeutigen Händler erkennen.',
    suggestedQuestions: ['Bitte Händler, Betrag und Zweck prüfen.']
  };
}

// Dateinamen generieren
export function generateFileName(
  receiptDate: string, // YYYY-MM-DD
  merchantName: string,
  totalAmount: number,
  invoiceNumber?: string,
  category?: ExpenseCategory
): string {
  // Format: YYYYMMDD_RechnungNr_Betrag_Kategorie_Händler.pdf
  // Beispiel: 20260415_RE12345_199.99_Buero_MediaMarkt.pdf
  
  const date = receiptDate.replace(/-/g, '');
  const amount = totalAmount.toFixed(2).replace('.', '_');
  const invNum = invoiceNumber ? `_${invoiceNumber}` : '';
  const cat = category ? `_${category.id.replace('_', '')}` : '';
  const merchant = merchantName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
  
  return `${date}${invNum}_${amount}${cat}_${merchant}.pdf`;
}
