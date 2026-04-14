// ============================================
// EXPORT SERVICE
// DATEV, CSV, Excel mit Kommentaren fuer Steuerbuero
// ============================================

import { createClient } from '@supabase/supabase-js';
// BankTransaction type not currently used

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export interface ExportOptions {
  year: number;
  month: number;
  format: 'datev' | 'csv';
  includeIncomplete: boolean;
  comment?: string;
}

export interface ExportResult {
  success: boolean;
  fileName: string;
  content: string;
  contentType: string;
  summary: ExportSummary;
}

export interface ExportSummary {
  period: string;
  totalTransactions: number;
  withReceipt: number;
  withoutReceipt: number;
  totalIncome: number;
  totalExpense: number;
  missingReceipts: MissingReceipt[];
  userComment?: string;
}

export interface MissingReceipt {
  date: string;
  amount: number;
  description: string;
  comment?: string;
}

// ============================================
// HAUPT EXPORT
// ============================================

export async function generateExport(
  userId: string,
  options: ExportOptions
): Promise<ExportResult> {
  const { year, month, format, includeIncomplete, comment } = options;
  
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-31`;
  
  const { data: transactions, error } = await supabase
    .from('bank_transactions')
    .select(`*, receipt:receipt_id (*), category:category_id (*)`)
    .eq('user_id', userId)
    .gte('transaction_date', startDate)
    .lte('transaction_date', endDate)
    .order('transaction_date', { ascending: true });

  if (error) throw error;

  const txs = transactions || [];
  const missingReceipts = txs.filter(t => t.amount < 0 && !t.receipt_id);
  
  if (missingReceipts.length > 0 && !includeIncomplete) {
    throw new Error(
      `${missingReceipts.length} fehlende Belege. ` +
      `Option "Unvollstaendig exportieren" aktivieren oder Belege nachreichen.`
    );
  }
  
  const summary: ExportSummary = {
    period: `${month}.${year}`,
    totalTransactions: txs.length,
    withReceipt: txs.filter(t => t.receipt_id).length,
    withoutReceipt: missingReceipts.length,
    totalIncome: txs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0),
    totalExpense: txs.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0),
    missingReceipts: missingReceipts.map(t => ({
      date: t.transaction_date,
      amount: Math.abs(t.amount),
      description: t.description || t.counterparty_name || 'Unbekannt',
      comment: t.notes || undefined,
    })),
    userComment: comment,
  };
  
  if (format === 'datev') {
    return generateDATEV(txs, summary, year, month);
  } else {
    return generateCSV(txs, summary, year, month);
  }
}

// ============================================
// DATEV EXPORT
// ============================================

function generateDATEV(
  transactions: any[],
  summary: ExportSummary,
  year: number,
  month: number
): ExportResult {
  const lines: string[] = [];
  
  // Header
  lines.push('DATEV Export;Schwarzwald Accounting');
  lines.push(`Zeitraum;${summary.period}`);
  lines.push(`Erstellt;${new Date().toLocaleDateString('de-DE')}`);
  lines.push('');
  
  // Warnung bei unvollstaendigen Daten
  if (summary.withoutReceipt > 0) {
    lines.push('!!! UNVOLLSTAENDIGER EXPORT !!!');
    lines.push(`Fehlende Belege;${summary.withoutReceipt}`);
    lines.push('');
  }
  
  // Kommentar
  if (summary.userComment) {
    lines.push('KOMMENTAR:');
    lines.push(`"${summary.userComment}"`);
    lines.push('');
  }
  
  // Fehlende Belege Liste
  if (summary.missingReceipts.length > 0) {
    lines.push('FEHLENDE BELEGE:');
    lines.push('Datum;Betrag;Beschreibung;Kommentar');
    summary.missingReceipts.forEach(m => {
      lines.push(`${m.date};${m.amount.toFixed(2)};"${m.description}";"${m.comment || ''}"`);
    });
    lines.push('');
  }
  
  // Buchungen
  lines.push('BUCHUNGEN:');
  lines.push('Datum;Belegnr;Buchungstext;Konto;Gegenkonto;Betrag;Steuer;Beleg;Status');
  
  let nr = 1;
  for (const tx of transactions) {
    const isExpense = tx.amount < 0;
    const konto = tx.category?.code || (isExpense ? '4400' : '8400');
    const gegenkonto = '1200';
    const beleg = tx.receipt_id ? 'JA' : 'NEIN';
    const status = !tx.receipt_id && isExpense ? 'BELEG FEHLEND' : 'OK';
    
    lines.push(
      `${formatDate(tx.transaction_date)};` +
      `B${String(nr++).padStart(4, '0')};` +
      `"${tx.description || tx.counterparty_name || ''}";` +
      `${konto};${gegenkonto};` +
      `${Math.abs(tx.amount).toFixed(2)};` +
      `${tx.category?.vat_rate || 19}%;` +
      `${beleg};${status}`
    );
  }
  
  // Zusammenfassung
  lines.push('');
  lines.push('ZUSAMMENFASSUNG:');
  lines.push(`Gesamteinnahmen;${summary.totalIncome.toFixed(2)} EUR`);
  lines.push(`Gesamtausgaben;${summary.totalExpense.toFixed(2)} EUR`);
  lines.push(`Saldo;${(summary.totalIncome - summary.totalExpense).toFixed(2)} EUR`);
  lines.push(`;`);
  lines.push(`Buchungen gesamt;${summary.totalTransactions}`);
  lines.push(`Mit Beleg;${summary.withReceipt}`);
  lines.push(`Ohne Beleg;${summary.withoutReceipt}`);
  
  const content = lines.join('\n');
  
  return {
    success: true,
    fileName: `DATEV_${year}_${String(month).padStart(2, '0')}.csv`,
    content,
    contentType: 'text/csv; charset=utf-8',
    summary,
  };
}

// ============================================
// CSV EXPORT (einfacher)
// ============================================

function generateCSV(
  transactions: any[],
  summary: ExportSummary,
  year: number,
  month: number
): ExportResult {
  const lines: string[] = [];
  
  // Header mit Warnung
  lines.push('# Schwarzwald Accounting Export');
  lines.push(`# Zeitraum: ${summary.period}`);
  if (summary.withoutReceipt > 0) {
    lines.push(`# WARNUNG: ${summary.withoutReceipt} fehlende Belege!`);
  }
  if (summary.userComment) {
    lines.push(`# Kommentar: ${summary.userComment}`);
  }
  lines.push('');
  
  // CSV Header
  lines.push('Datum,Bezeichnung,Kategorie,Betrag,Typ,Beleg vorhanden,Kommentar');
  
  for (const tx of transactions) {
    const isExpense = tx.amount < 0;
    const typ = isExpense ? 'Ausgabe' : 'Einnahme';
    const beleg = tx.receipt_id ? 'Ja' : 'Nein';
    const kommentar = !tx.receipt_id && isExpense 
      ? 'BELEG FEHLT - ' + (tx.notes || '') 
      : (tx.notes || '');
    
    lines.push(
      `${tx.transaction_date},` +
      `"${tx.description || tx.counterparty_name || ''}",` +
      `"${tx.category?.name || ''}",` +
      `${Math.abs(tx.amount).toFixed(2)},` +
      `${typ},` +
      `${beleg},` +
      `"${kommentar}"`
    );
  }
  
  // Fehlende Belege am Ende
  if (summary.missingReceipts.length > 0) {
    lines.push('');
    lines.push('# FEHLENDE BELEGE:');
    summary.missingReceipts.forEach(m => {
      lines.push(`# ${m.date} | ${m.amount.toFixed(2)} EUR | ${m.description}${m.comment ? ' | ' + m.comment : ''}`);
    });
  }
  
  return {
    success: true,
    fileName: `Buchungen_${year}_${String(month).padStart(2, '0')}.csv`,
    content: lines.join('\n'),
    contentType: 'text/csv; charset=utf-8',
    summary,
  };
}

// ============================================
// HELPER
// ============================================

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}
