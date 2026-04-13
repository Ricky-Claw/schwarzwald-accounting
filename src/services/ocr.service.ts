// ============================================
// OCR SERVICE - Azure Form Recognizer
// Unterstützt: Quittungen, Rechnungen, Amazon Seller Central
// ============================================

import { DocumentAnalysisClient, AzureKeyCredential } from '@azure/ai-form-recognizer';
import type { OCRResult, AmazonOCRResult, AmazonDocumentType, AmazonTransaction } from '../types/index.js';

const client = new DocumentAnalysisClient(
  process.env.AZURE_FORM_RECOGNIZER_ENDPOINT!,
  new AzureKeyCredential(process.env.AZURE_FORM_RECOGNIZER_KEY!)
);

/**
 * Extrahiert Daten aus einer Quittung/Rechnung
 */
export async function extractReceiptData(fileBuffer: Buffer): Promise<OCRResult> {
  try {
    const poller = await client.beginAnalyzeDocument('prebuilt-receipt', fileBuffer);
    const result = await poller.pollUntilDone();

    if (!result.documents || result.documents.length === 0) {
      return { success: false, confidence: 0, error: 'Kein Dokument erkannt' };
    }

    const doc = result.documents[0];
    const fields = doc.fields;

    return {
      success: true,
      merchant_name: fields['MerchantName']?.content,
      date: fields['TransactionDate']?.content,
      total_amount: parseFloat(fields['Total']?.content || '0'),
      vat_amount: parseFloat(fields['Tax']?.content || '0'),
      confidence: doc.confidence || 0,
      raw: fields,
    };
  } catch (error) {
    console.error('OCR Error:', error);
    return { success: false, confidence: 0, error: (error as Error).message };
  }
}

/**
 * Extrahiert Daten aus Amazon Seller Central Dokumenten
 */
export async function extractAmazonDocumentData(
  fileBuffer: Buffer,
  documentType: AmazonDocumentType
): Promise<AmazonOCRResult> {
  try {
    // Für Amazon-Dokumente nutzen wir das prebuilt-document Modell
    // + spezielle Parsing-Logik für Seller Central Formate
    const poller = await client.beginAnalyzeDocument('prebuilt-document', fileBuffer);
    const result = await poller.pollUntilDone();

    if (!result.documents || result.documents.length === 0) {
      return {
        success: false,
        document_type: documentType,
        currency: 'EUR',
        confidence: 0,
        transactions: [],
        error: 'Kein Dokument erkannt',
      };
    }

    const doc = result.documents[0];
    
    // Je nach Dokumenttyp unterschiedliche Extraktions-Logik
    switch (documentType) {
      case 'settlement_statement':
        return extractSettlementStatement(doc, result.pages);
      case 'transaction_report':
        return extractTransactionReport(doc, result.pages);
      case 'payment_report':
        return extractPaymentReport(doc, result.pages);
      case 'fee_statement':
        return extractFeeStatement(doc, result.pages);
      default:
        return extractGenericAmazonDocument(doc, documentType);
    }
  } catch (error) {
    console.error('Amazon OCR Error:', error);
    return {
      success: false,
      document_type: documentType,
      currency: 'EUR',
      confidence: 0,
      transactions: [],
      error: (error as Error).message,
    };
  }
}

/**
 * Extrahiert Abrechnungsbericht (Settlement Statement)
 */
function extractSettlementStatement(doc: any, pages: any[]): AmazonOCRResult {
  const fields = doc.fields;
  const kvPairs = extractKeyValuePairs(pages);
  
  // Amazon Settlement ID finden
  const settlementId = findPattern(kvPairs, /\d{9}-\d{9}/) || 
                       fields['SettlementId']?.content ||
                       findPattern(kvPairs, /Settlement[\s#:]*(\d+)/i);
  
  // Zeitraum extrahieren
  const periodMatch = findPattern(kvPairs, /(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/);
  const periodStart = periodMatch ? formatAmazonDate(periodMatch[1]) : undefined;
  const periodEnd = periodMatch ? formatAmazonDate(periodMatch[2]) : undefined;
  
  // Beträge extrahieren
  const totalSales = extractAmount(kvPairs, ['Total Sales', 'Gesamtumsatz', 'Product Sales']);
  const totalRefunds = extractAmount(kvPairs, ['Refunds', 'Erstattungen', 'Refund']);
  const totalFees = extractAmount(kvPairs, ['Total Fees', 'Gebühren', 'Amazon Fees']);
  const netAmount = extractAmount(kvPairs, ['Net Amount', 'Netto', 'Amount to be Paid']);
  
  // Transaktionen extrahieren (aus Tabellen)
  const transactions = extractTransactionsFromTables(pages);
  
  return {
    success: true,
    document_type: 'settlement_statement',
    settlement_id: settlementId,
    period_start: periodStart,
    period_end: periodEnd,
    total_sales: totalSales,
    total_refunds: totalRefunds,
    total_fees: totalFees,
    net_amount: netAmount,
    currency: detectCurrency(kvPairs) || 'EUR',
    confidence: doc.confidence || 0.8,
    transactions,
    raw: { fields, kvPairs },
  };
}

/**
 * Extrahiert Transaktionsbericht
 */
function extractTransactionReport(doc: any, pages: any[]): AmazonOCRResult {
  const kvPairs = extractKeyValuePairs(pages);
  const tables = extractTables(pages);
  
  const transactions: AmazonTransaction[] = [];
  
  // Amazon Transaktionstabellen haben typischerweise:
  // order_id, date, transaction_type, sku, quantity, product_name, price, fees
  for (const table of tables) {
    for (const row of table.rows.slice(1)) { // Skip header
      if (row.length >= 5) {
        transactions.push({
          order_id: row[0] || '',
          date: parseAmazonDate(row[1]) || new Date().toISOString(),
          transaction_type: detectTransactionType(row[2]),
          sku: row[3],
          quantity: parseInt(row[4]) || 1,
          product_name: row[5] || '',
          sales_price: parseFloat(row[6]?.replace(/[^0-9.,-]/g, '').replace(',', '.') || '0'),
          fees: parseFloat(row[7]?.replace(/[^0-9.,-]/g, '').replace(',', '.') || '0'),
          net_amount: parseFloat(row[8]?.replace(/[^0-9.,-]/g, '').replace(',', '.') || '0'),
        });
      }
    }
  }
  
  // Summen berechnen
  const totalSales = transactions
    .filter(t => t.transaction_type === 'order')
    .reduce((sum, t) => sum + t.sales_price, 0);
  const totalRefunds = transactions
    .filter(t => t.transaction_type === 'refund')
    .reduce((sum, t) => sum + Math.abs(t.sales_price), 0);
  
  return {
    success: true,
    document_type: 'transaction_report',
    total_sales: totalSales,
    total_refunds: totalRefunds,
    currency: detectCurrency(kvPairs) || 'EUR',
    confidence: doc.confidence || 0.75,
    transactions,
    raw: { kvPairs, tableCount: tables.length },
  };
}

/**
 * Extrahiert Zahlungsbericht
 */
function extractPaymentReport(doc: any, pages: any[]): AmazonOCRResult {
  const kvPairs = extractKeyValuePairs(pages);
  
  const netAmount = extractAmount(kvPairs, ['Payment Amount', 'Zahlungsbetrag', 'Amount Transferred']);
  const totalFees = extractAmount(kvPairs, ['Fees', 'Gebühren', 'Total Fees']);
  
  return {
    success: true,
    document_type: 'payment_report',
    net_amount: netAmount,
    total_fees: totalFees,
    currency: detectCurrency(kvPairs) || 'EUR',
    confidence: doc.confidence || 0.8,
    transactions: [],
    raw: kvPairs,
  };
}

/**
 * Extrahiert Gebührenübersicht
 */
function extractFeeStatement(doc: any, pages: any[]): AmazonOCRResult {
  const kvPairs = extractKeyValuePairs(pages);
  const tables = extractTables(pages);
  
  const fees: Array<{ fee_type: string; description: string; amount: number }> = [];
  
  for (const table of tables) {
    for (const row of table.rows.slice(1)) {
      if (row.length >= 2) {
        fees.push({
          fee_type: row[0] || 'Unknown',
          description: row[1] || '',
          amount: parseFloat(row[row.length - 1]?.replace(/[^0-9.,-]/g, '').replace(',', '.') || '0'),
        });
      }
    }
  }
  
  const totalFees = fees.reduce((sum, f) => sum + f.amount, 0);
  
  return {
    success: true,
    document_type: 'fee_statement',
    total_fees: totalFees,
    currency: detectCurrency(kvPairs) || 'EUR',
    confidence: doc.confidence || 0.75,
    transactions: [],
    raw: { fees, kvPairs },
  };
}

/**
 * Generische Extraktion für unbekannte Amazon-Dokumente
 */
function extractGenericAmazonDocument(doc: any, documentType: AmazonDocumentType): AmazonOCRResult {
  const fields = doc.fields;
  
  return {
    success: true,
    document_type: documentType,
    total_sales: parseFloat(fields['Total']?.content || '0'),
    currency: fields['Currency']?.content || 'EUR',
    confidence: doc.confidence || 0.6,
    transactions: [],
    raw: fields,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function extractKeyValuePairs(pages: any[]): Record<string, string> {
  const pairs: Record<string, string> = {};
  
  for (const page of pages) {
    if (page.keyValuePairs) {
      for (const pair of page.keyValuePairs) {
        const key = pair.key?.content?.trim();
        const value = pair.value?.content?.trim();
        if (key && value) {
          pairs[key] = value;
        }
      }
    }
  }
  
  return pairs;
}

function extractTables(pages: any[]): Array<{ rows: string[][] }> {
  const tables: Array<{ rows: string[][] }> = [];
  
  for (const page of pages) {
    if (page.tables) {
      for (const table of page.tables) {
        const rows: string[][] = [];
        for (const row of table.cells) {
          // Group by row index
          if (!rows[row.rowIndex]) rows[row.rowIndex] = [];
          rows[row.rowIndex][row.columnIndex] = row.content;
        }
        tables.push({ rows });
      }
    }
  }
  
  return tables;
}

function findPattern(kvPairs: Record<string, string>, regex: RegExp): string | undefined {
  for (const [key, value] of Object.entries(kvPairs)) {
    const match = value.match(regex) || key.match(regex);
    if (match) return match[1] || match[0];
  }
  return undefined;
}

function extractAmount(kvPairs: Record<string, string>, keys: string[]): number | undefined {
  for (const key of keys) {
    for (const [k, v] of Object.entries(kvPairs)) {
      if (k.toLowerCase().includes(key.toLowerCase())) {
        const amount = parseFloat(v.replace(/[^0-9.,-]/g, '').replace(',', '.'));
        if (!isNaN(amount)) return amount;
      }
    }
  }
  return undefined;
}

function detectCurrency(kvPairs: Record<string, string>): string | undefined {
  const currencyKeys = ['Currency', 'Währung', 'Currency Code'];
  for (const key of currencyKeys) {
    for (const [k, v] of Object.entries(kvPairs)) {
      if (k.toLowerCase().includes(key.toLowerCase())) {
        if (v.includes('EUR') || v.includes('€')) return 'EUR';
        if (v.includes('USD') || v.includes('$')) return 'USD';
        if (v.includes('GBP') || v.includes('£')) return 'GBP';
      }
    }
  }
  return 'EUR'; // Default
}

function detectTransactionType(text: string): 'order' | 'refund' | 'adjustment' {
  const lower = text?.toLowerCase() || '';
  if (lower.includes('refund') || lower.includes('erstattung') || lower.includes('return')) {
    return 'refund';
  }
  if (lower.includes('adjustment') || lower.includes('anpassung')) {
    return 'adjustment';
  }
  return 'order';
}

function parseAmazonDate(dateStr: string): string | undefined {
  if (!dateStr) return undefined;
  
  // Verschiedene Amazon-Formate
  // MM/DD/YYYY
  // DD.MM.YYYY
  // YYYY-MM-DD
  
  const usMatch = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (usMatch) {
    return `${usMatch[3]}-${usMatch[1]}-${usMatch[2]}`;
  }
  
  const deMatch = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (deMatch) {
    return `${deMatch[3]}-${deMatch[2]}-${deMatch[1]}`;
  }
  
  const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return dateStr;
  
  return undefined;
}

function formatAmazonDate(dateStr: string): string | undefined {
  return parseAmazonDate(dateStr);
}

function extractTransactionsFromTables(pages: any[]): AmazonTransaction[] {
  const tables = extractTables(pages);
  const transactions: AmazonTransaction[] = [];
  
  for (const table of tables) {
    // Header identifizieren
    const headers = table.rows[0]?.map((h: string) => h.toLowerCase()) || [];
    
    const orderIdIdx = headers.findIndex((h: string) => h.includes('order'));
    const dateIdx = headers.findIndex((h: string) => h.includes('date') || h.includes('datum'));
    const typeIdx = headers.findIndex((h: string) => h.includes('type') || h.includes('typ'));
    const skuIdx = headers.findIndex((h: string) => h.includes('sku'));
    const qtyIdx = headers.findIndex((h: string) => h.includes('quantity') || h.includes('menge'));
    const productIdx = headers.findIndex((h: string) => h.includes('product') || h.includes('description'));
    const priceIdx = headers.findIndex((h: string) => h.includes('price') || h.includes('betrag'));
    const feesIdx = headers.findIndex((h: string) => h.includes('fee') || h.includes('gebühr'));
    const netIdx = headers.findIndex((h: string) => h.includes('net') || h.includes('total'));
    
    for (let i = 1; i < table.rows.length; i++) {
      const row = table.rows[i];
      if (row.length < 3) continue;
      
      transactions.push({
        order_id: orderIdIdx >= 0 ? row[orderIdIdx] : '',
        date: parseAmazonDate(row[dateIdx]) || new Date().toISOString(),
        transaction_type: detectTransactionType(typeIdx >= 0 ? row[typeIdx] : 'order'),
        sku: skuIdx >= 0 ? row[skuIdx] : undefined,
        quantity: qtyIdx >= 0 ? parseInt(row[qtyIdx]) || 1 : 1,
        product_name: productIdx >= 0 ? row[productIdx] : undefined,
        sales_price: priceIdx >= 0 ? parseFloat(row[priceIdx]?.replace(/[^0-9.,-]/g, '').replace(',', '.')) || 0 : 0,
        fees: feesIdx >= 0 ? parseFloat(row[feesIdx]?.replace(/[^0-9.,-]/g, '').replace(',', '.')) || 0 : 0,
        net_amount: netIdx >= 0 ? parseFloat(row[netIdx]?.replace(/[^0-9.,-]/g, '').replace(',', '.')) || 0 : 0,
      });
    }
  }
  
  return transactions;
}
