// ============================================
// OCR SERVICE - Kimi K2.5 Vision
// PDFs + Bilder direkt an Kimi (base64)
// Render-kompatibel: ZERO native dependencies
// ============================================

import type { OCRResult, AmazonOCRResult, AmazonDocumentType } from '../types/index.js';

const MOONSHOT_API_KEY = process.env.MOONSHOT_API_KEY;
const MOONSHOT_BASE_URL = 'https://api.moonshot.ai/v1';

interface KimiMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }>;
}

/** Prüft ob Kimi OCR verfügbar ist */
export function isKimiOCRAvailable(): boolean {
  return !!MOONSHOT_API_KEY;
}

/** Buffer zu Base64 Data URL */
function createDataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

/** Kimi API call (Vision oder Text) */
async function callKimi(messages: KimiMessage[], maxTokens: number = 1000): Promise<string> {
  const response = await fetch(`${MOONSHOT_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MOONSHOT_API_KEY}`
    },
    body: JSON.stringify({
      model: 'kimi-k2.6',
      messages,
      // Moonshot currently only accepts temperature=1 for Kimi K2.x models.
      temperature: 1,
      max_tokens: maxTokens
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Kimi API Error: ${error}`);
  }

  const result: any = await response.json();
  return result.choices?.[0]?.message?.content || '';
}

function parseAmount(value: unknown): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return undefined;

  const normalized = value
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeDate(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;

  const iso = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];

  const german = value.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (german) {
    const [, day, month, year] = german;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return undefined;
}

/** Parsed JSON aus Kimi Response */
function parseKimiJson(content: string): any {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Kein JSON in Response gefunden');
  return JSON.parse(jsonMatch[0]);
}

/** Baut Vision-Message mit Bildern/PDFs */
function buildVisionMessage(
  dataUrls: string[],
  prompt: string,
  systemPrompt: string
): KimiMessage[] {
  const imageContents = dataUrls.map(url => ({
    type: 'image_url' as const,
    image_url: { url }
  }));

  return [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: [
        ...imageContents,
        { type: 'text', text: prompt }
      ]
    }
  ];
}

// ============================================
// RECEIPT OCR
// ============================================

export async function extractReceiptDataWithKimi(
  fileBuffer: Buffer,
  mimeType: string
): Promise<OCRResult> {
  if (!MOONSHOT_API_KEY) {
    return { success: false, confidence: 0, error: 'Kimi API Key nicht konfiguriert' };
  }

  try {
    const dataUrl = createDataUrl(fileBuffer, mimeType);
    const isPdf = mimeType === 'application/pdf';

    const systemPrompt = 'Du bist ein OCR-Assistent für Buchhaltungsbelege. Antworte ausschließlich mit kompaktem JSON.';

    const prompt = `Extrahiere aus diesem ${isPdf ? 'PDF-Beleg' : 'Beleg'} diese Felder als JSON:
{
  "merchant_name": "Händlername",
  "date": "YYYY-MM-DD",
  "total_amount": 0.00,
  "vat_amount": 0.00,
  "vat_rate": 19,
  "currency": "EUR",
  "receipt_number": "Rechnungsnummer",
  "payment_method": "",
  "invoice_type": "incoming"
}
Nur JSON. Keine Markdown-Codeblöcke. Zahlen mit Punkt als Dezimaltrenner.`;

    const messages = buildVisionMessage([dataUrl], prompt, systemPrompt);
    const content = await callKimi(messages, 4000);

    console.log('Kimi OCR raw:', content.substring(0, 500));
    const extracted = parseKimiJson(content);
    console.log('Kimi OCR extracted:', JSON.stringify(extracted, null, 2));

    return {
      success: true,
      merchant_name: extracted.merchant_name,
      date: normalizeDate(extracted.date),
      total_amount: parseAmount(extracted.total_amount) || 0,
      vat_amount: parseAmount(extracted.vat_amount),
      vat_rate: parseAmount(extracted.vat_rate),
      currency: extracted.currency || 'EUR',
      receipt_number: extracted.receipt_number,
      payment_method: extracted.payment_method,
      confidence: 0.85,
      raw: extracted
    };

  } catch (error) {
    console.error('Kimi OCR Error:', error);
    return { success: false, confidence: 0, error: (error as Error).message };
  }
}

// ============================================
// AMAZON DOKUMENTE
// ============================================

const docTypePrompts: Partial<Record<AmazonDocumentType, string>> = {
  settlement_statement: `Extrahiere Amazon Settlement Statement Daten:
{
  "settlement_id": "Settlement ID",
  "period_start": "Startdatum YYYY-MM-DD",
  "period_end": "Enddatum YYYY-MM-DD", 
  "total_sales": Gesamtumsatz als Zahl,
  "total_refunds": Erstattungen als Zahl,
  "total_fees": Gebühren als Zahl,
  "net_amount": Nettobetrag als Zahl,
  "currency": "EUR"
}`,
  transaction_report: `Extrahiere Amazon Transaktions-Report als Array:
{
  "transactions": [
    {
      "order_id": "Order ID",
      "date": "Datum YYYY-MM-DD",
      "transaction_type": "order/refund/adjustment",
      "sku": "SKU",
      "product_name": "Produktname",
      "sales_price": Preis als Zahl,
      "fees": Gebühren als Zahl,
      "net_amount": Netto als Zahl
    }
  ],
  "total_sales": Summe Verkäufe,
  "total_refunds": Summe Erstattungen
}`,
  payment_report: `Extrahiere Amazon Zahlungsbericht:
{
  "net_amount": Zahlungsbetrag als Zahl,
  "total_fees": Gebühren als Zahl,
  "currency": "EUR"
}`,
  fee_statement: `Extrahiere Amazon Gebührenübersicht:
{
  "total_fees": Summe Gebühren als Zahl,
  "currency": "EUR"
}`,
  inventory_report: `Extrahiere Amazon Bestandsbericht:
{
  "total_fees": 0,
  "currency": "EUR"
}`,
  vat_invoice: `Extrahiere Amazon USt-Rechnung:
{
  "total_fees": USt-Betrag als Zahl,
  "currency": "EUR"
}`,
  advertising_invoice: `Extrahiere Amazon Werberechnung:
{
  "total_fees": Werbekosten als Zahl,
  "currency": "EUR"
}`
};

export async function extractAmazonDocumentWithKimi(
  fileBuffer: Buffer,
  mimeType: string,
  documentType: AmazonDocumentType
): Promise<AmazonOCRResult> {
  if (!MOONSHOT_API_KEY) {
    return {
      success: false, document_type: documentType, currency: 'EUR',
      confidence: 0, transactions: [], error: 'Kimi API Key nicht konfiguriert'
    };
  }

  try {
    const dataUrl = createDataUrl(fileBuffer, mimeType);
    const prompt = `Analysiere dieses Amazon ${documentType} Dokument. ${docTypePrompts[documentType]}

WICHTIG: Summen und Totals stehen oft auf der letzten Seite. Prüfe alle Seiten.
Gib NUR das JSON zurück.`;

    const messages = buildVisionMessage(
      [dataUrl],
      prompt,
      'Du bist ein OCR-Assistent für Amazon Seller Central Dokumente.'
    );

    const content = await callKimi(messages, 2000);
    const extracted = parseKimiJson(content);

    return {
      success: true,
      document_type: documentType,
      settlement_id: extracted.settlement_id,
      period_start: extracted.period_start,
      period_end: extracted.period_end,
      total_sales: parseFloat(extracted.total_sales) || 0,
      total_refunds: parseFloat(extracted.total_refunds) || 0,
      total_fees: parseFloat(extracted.total_fees) || 0,
      net_amount: parseFloat(extracted.net_amount) || 0,
      currency: extracted.currency || 'EUR',
      confidence: 0.8,
      transactions: extracted.transactions || [],
      raw: extracted
    };

  } catch (error) {
    console.error('Kimi Amazon OCR Error:', error);
    return {
      success: false, document_type: documentType, currency: 'EUR',
      confidence: 0, transactions: [], error: (error as Error).message
    };
  }
}
