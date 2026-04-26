// ============================================
// BELEG-MATCHING SERVICE
// Ordnet Belege automatisch Buchungen zu
// ============================================

import { createClient } from '@supabase/supabase-js';
import type { BankTransaction, Receipt } from '../types/index.js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export interface MatchingResult {
  success: boolean;
  transactionId?: string;
  confidence: number; // 0-1
  matchType: 'amount_date' | 'amount_only' | 'date_only' | 'manual';
}

export interface MonthlyOverview {
  month: string; // "2024-02"
  monthName: string; // "Februar 2024"
  totalTransactions: number;
  matchedTransactions: number;
  missingReceipts: number;
  totalAmount: number;
  status: 'complete' | 'incomplete' | 'empty';
  transactions: TransactionWithReceipt[];
}

export interface TransactionWithReceipt extends BankTransaction {
  receipt?: Receipt;
  matchingStatus: 'matched' | 'missing_receipt' | 'no_receipt_needed';
}

// ============================================
// AUTOMATISCHES MATCHING
// ============================================

/**
 * Versucht einen Beleg automatisch einer Buchung zuzuordnen
 * Basierend auf: Betrag + Datum (±3 Tage Toleranz)
 */
export async function findMatchingTransaction(
  userId: string,
  receiptData: {
    amount: number;
    date: string;
    merchantName?: string;
  }
): Promise<MatchingResult> {
  const receiptDate = new Date(receiptData.date);
  const toleranceDays = 3;
  
  // Suche Buchungen im Zeitraum ±3 Tage mit gleichem Betrag
  const startDate = new Date(receiptDate);
  startDate.setDate(startDate.getDate() - toleranceDays);
  
  const endDate = new Date(receiptDate);
  endDate.setDate(endDate.getDate() + toleranceDays);

  const { data: transactions, error } = await supabase
    .from('bank_transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'unmatched') // Nur ungematchte
    .gte('transaction_date', startDate.toISOString().split('T')[0])
    .lte('transaction_date', endDate.toISOString().split('T')[0])
    .order('transaction_date', { ascending: true });

  if (error || !transactions || transactions.length === 0) {
    return { success: false, confidence: 0, matchType: 'manual' };
  }

  // Suche exakte Betrags-Übereinstimmung
  const exactMatch = transactions.find(t => 
    Math.abs(t.amount) === Math.abs(receiptData.amount)
  );

  if (exactMatch) {
    return {
      success: true,
      transactionId: exactMatch.id,
      confidence: 0.95,
      matchType: 'amount_date',
    };
  }

  // Suche mit 1% Toleranz (für Rundungsdifferenzen)
  const toleranceMatch = transactions.find(t => {
    const diff = Math.abs(Math.abs(t.amount) - Math.abs(receiptData.amount));
    const percentDiff = diff / Math.abs(receiptData.amount);
    return percentDiff < 0.01; // 1% Toleranz
  });

  if (toleranceMatch) {
    return {
      success: true,
      transactionId: toleranceMatch.id,
      confidence: 0.85,
      matchType: 'amount_date',
    };
  }

  // Fallback: Nur Datum match, wenn Händlername ähnlich
  if (receiptData.merchantName) {
    const merchantMatch = transactions.find(t => {
      if (!t.counterparty_name) return false;
      return t.counterparty_name
        .toLowerCase()
        .includes(receiptData.merchantName!.toLowerCase().slice(0, 5));
    });

    if (merchantMatch) {
      return {
        success: true,
        transactionId: merchantMatch.id,
        confidence: 0.6,
        matchType: 'date_only',
      };
    }
  }

  return { success: false, confidence: 0, matchType: 'manual' };
}

/**
 * Ordnet einen Beleg einer Buchung zu
 */
export async function matchReceiptToTransaction(
  receiptId: string,
  transactionId: string,
  userId: string
): Promise<boolean> {
  try {
    // Update Receipt
    const { error: receiptError } = await supabase
      .from('receipts')
      .update({
        bank_transaction_id: transactionId,
        status: 'verified',
      })
      .eq('id', receiptId);

    if (receiptError) throw receiptError;

    // Update Transaction
    const { error: transError } = await supabase
      .from('bank_transactions')
      .update({
        receipt_id: receiptId,
        status: 'matched',
      })
      .eq('id', transactionId)
      .eq('user_id', userId);

    if (transError) throw transError;

    return true;
  } catch (error) {
    console.error('Error matching receipt:', error);
    return false;
  }
}

/**
 * Automatisches Matching für alle ungematchten Belege
 */
export async function autoMatchAllReceipts(userId: string): Promise<{
  matched: number;
  unmatched: number;
}> {
  // Hole alle ungematchten Belege
  const { data: receipts, error } = await supabase
    .from('receipts')
    .select('*')
    .is('bank_transaction_id', null)
    .eq('status', 'verified');

  if (error || !receipts) return { matched: 0, unmatched: 0 };

  let matched = 0;

  for (const receipt of receipts) {
    if (!receipt.total_amount || !receipt.receipt_date) continue;

    const match = await findMatchingTransaction(userId, {
      amount: receipt.total_amount,
      date: receipt.receipt_date,
      merchantName: receipt.merchant_name || undefined,
    });

    if (match.success && match.confidence > 0.8) {
      const success = await matchReceiptToTransaction(
        receipt.id,
        match.transactionId!,
        userId
      );
      if (success) matched++;
    }
  }

  return {
    matched,
    unmatched: receipts.length - matched,
  };
}

// ============================================
// MONATS-ÜBERSICHTEN
// ============================================

/**
 * Holt alle Buchungen eines Monats mit Beleg-Status
 */
export async function getMonthlyOverview(
  userId: string,
  year: number,
  month: number
): Promise<MonthlyOverview> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  // Letzter Tag des Monats korrekt berechnen
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  // Hole Buchungen
  const { data: transactions, error } = await supabase
    .from('bank_transactions')
    .select('*')
    .eq('user_id', userId)
    .gte('transaction_date', startDate)
    .lte('transaction_date', endDate)
    .order('transaction_date', { ascending: false });
  
  // Hole zugehörige Belege separat
  const receiptIds = (transactions || []).map(t => t.receipt_id).filter(Boolean);
  const { data: receipts } = await supabase
    .from('receipts')
    .select('*')
    .in('id', receiptIds);

  if (error) throw error;

  const monthNames = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ];

  // Erstelle Map für schnellen Beleg-Lookup
  const receiptMap = new Map((receipts || []).map(r => [r.id, r]));
  
  const enrichedTransactions: TransactionWithReceipt[] = (transactions || []).map(t => {
    // Bestimme ob Beleg nötig ist
    const needsReceipt = shouldHaveReceipt(t);
    const receipt = t.receipt_id ? receiptMap.get(t.receipt_id) : undefined;
    const hasReceipt = !!t.receipt_id && !!receipt;
    
    return {
      ...t,
      receipt: receipt || undefined,
      matchingStatus: hasReceipt 
        ? 'matched' 
        : needsReceipt 
          ? 'missing_receipt' 
          : 'no_receipt_needed',
    };
  });

  const matchedCount = enrichedTransactions.filter(t => t.matchingStatus === 'matched').length;
  const missingCount = enrichedTransactions.filter(t => t.matchingStatus === 'missing_receipt').length;
  const totalAmount = enrichedTransactions.reduce((sum, t) => sum + t.amount, 0);

  let status: 'complete' | 'incomplete' | 'empty' = 'empty';
  if (enrichedTransactions.length > 0) {
    status = missingCount === 0 ? 'complete' : 'incomplete';
  }

  return {
    month: `${year}-${String(month).padStart(2, '0')}`,
    monthName: `${monthNames[month - 1]} ${year}`,
    totalTransactions: enrichedTransactions.length,
    matchedTransactions: matchedCount,
    missingReceipts: missingCount,
    totalAmount,
    status,
    transactions: enrichedTransactions,
  };
}

/**
 * Liste aller Monate mit Status (für Navigation)
 */
export async function getAllMonths(
  userId: string
): Promise<Array<{
  month: string;
  monthName: string;
  total: number;
  matched: number;
  missing: number;
  status: 'complete' | 'incomplete' | 'empty';
}>> {
  // Hole alle Buchungen mit Datum
  const { data: transactions, error } = await supabase
    .from('bank_transactions')
    .select('transaction_date, receipt_id, amount')
    .eq('user_id', userId)
    .order('transaction_date', { ascending: false });

  if (error || !transactions) return [];

  // Gruppiere nach Monat
  const monthMap = new Map<string, {
    total: number;
    matched: number;
    missing: number;
  }>();

  for (const t of transactions) {
    const month = t.transaction_date.slice(0, 7); // "2024-02"
    
    if (!monthMap.has(month)) {
      monthMap.set(month, { total: 0, matched: 0, missing: 0 });
    }
    
    const stats = monthMap.get(month)!;
    stats.total++;
    
    if (t.receipt_id || !shouldHaveReceipt(t as BankTransaction)) {
      stats.matched++;
    } else {
      stats.missing++;
    }
  }

  const monthNames = [
    'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun',
    'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'
  ];

  return Array.from(monthMap.entries()).map(([month, stats]) => {
    const [y, m] = month.split('-').map(Number);
    let status: 'complete' | 'incomplete' | 'empty' = 'empty';
    if (stats.total > 0) {
      status = stats.missing === 0 ? 'complete' : 'incomplete';
    }

    return {
      month,
      monthName: `${monthNames[m - 1]} ${y}`,
      total: stats.total,
      matched: stats.matched,
      missing: stats.missing,
      status,
    };
  });
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Bestimmt ob eine Buchung einen Beleg braucht
 * (Ausgaben ja, Einnahmen/Eigenübertragungen nein)
 */
function shouldHaveReceipt(transaction: BankTransaction): boolean {
  // Negative Beträge = Ausgaben = Beleg nötig
  if (transaction.amount < 0) return true;
  
  // Positive Beträge = Einnahmen (kein Beleg nötig, aber Rechnung)
  // Werden separat behandelt
  return false;
}

/**
 * Sucht fehlende Belege für einen Monat
 */
export async function findMissingReceipts(
  userId: string,
  year: number,
  month: number
): Promise<BankTransaction[]> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

  const { data: transactions, error } = await supabase
    .from('bank_transactions')
    .select('*')
    .eq('user_id', userId)
    .is('receipt_id', null)
    .lt('amount', 0) // Nur Ausgaben
    .gte('transaction_date', startDate)
    .lte('transaction_date', endDate)
    .order('transaction_date', { ascending: false });

  if (error) throw error;
  return transactions || [];
}

/**
 * Status-Übersicht für Dashboard
 */
export async function getDashboardStats(userId: string): Promise<{
  totalReceipts: number;
  unmatchedReceipts: number;
  totalTransactions: number;
  matchedTransactions: number;
  missingReceipts: number;
  currentMonth: {
    month: string;
    status: 'complete' | 'incomplete';
    missing: number;
  };
}> {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Parallel queries
  const [
    receiptsResult,
    transactionsResult,
    currentMonthResult,
  ] = await Promise.all([
    supabase.from('receipts').select('id, bank_transaction_id', { count: 'exact' }),
    supabase.from('bank_transactions').select('id, receipt_id, amount', { count: 'exact' }).eq('user_id', userId),
    getMonthlyOverview(userId, now.getFullYear(), now.getMonth() + 1),
  ]);

  const receipts = receiptsResult.data || [];
  const transactions = transactionsResult.data || [];

  return {
    totalReceipts: receipts.length,
    unmatchedReceipts: receipts.filter(r => !r.bank_transaction_id).length,
    totalTransactions: transactions.length,
    matchedTransactions: transactions.filter(t => t.receipt_id).length,
    missingReceipts: transactions.filter(t => !t.receipt_id && t.amount < 0).length,
    currentMonth: {
      month: currentMonth,
      status: currentMonthResult.status === 'complete' ? 'complete' : 'incomplete',
      missing: currentMonthResult.missingReceipts,
    },
  };
}
