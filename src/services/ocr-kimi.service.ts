// ============================================
// OCR SERVICE - Kimi K2.5 Vision
// Vision-basierte Beleg-Erkennung
// ============================================

import type { OCRResult, AmazonOCRResult, AmazonDocumentType } from '../types/index.js';

const MOONSHOT_API_KEY = process.env.MOONSHOT_API_KEY;
const MOONSHOT_BASE_URL = 'https://api.moonshot.cn/v1';

interface KimiMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }>;
}

/**
 * Prüft ob Kimi OCR verfügbar ist
 */
export function isKimiOCRAvailable(): boolean {
  return !!MOONSHOT_API_KEY;
}

/**
 * Konvertiert PDF zu Base64 Data URL für Kimi
 * Kimi unterstützt PDFs direkt als base64
 */
function createDataUrl(buffer: Buffer, mimeType: string): string {
  const base64 = buffer.toString('base64');
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Extrahiert Daten aus Beleg mit Kimi Vision
 */
export async function extractReceiptDataWithKimi(
  fileBuffer: Buffer,
  mimeType: string
): Promise<OCRResult> {
  if (!MOONSHOT_API_KEY) {
    return {
      success: false,
      confidence: 0,
      error: 'Kimi API Key nicht konfiguriert'
    };
  }

  try {
    // Prüfe ob PDF oder Bild
    const isPdf = mimeType === 'application/pdf';
    const dataUrl = createDataUrl(fileBuffer, mimeType);
    
    const fileTypeDescription = isPdf ? 'PDF-Rechnung' : 'Beleg';

    const messages: KimiMessage[] = [
      {
        role: 'system',
        content: 'Du bist ein OCR-Assistent für Buchhaltungsbelege. Extrahiere strukturierte Daten aus dem Bild.'
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: dataUrl }
          },
          {
            type: 'text',
            text: `Analysiere diese ${fileTypeDescription} und extrahiere folgende Daten im JSON-Format:
{
  "merchant_name": "Name des Händlers/Ladens",
  "date": "Datum im Format YYYY-MM-DD",
  "total_amount": Gesamtbetrag als Zahl,
  "vat_amount": MwSt-Betrag als Zahl (wenn erkennbar),
  "vat_rate": MwSt-Satz als Zahl z.B. 19 (wenn erkennbar),
  "currency": "Währung z.B. EUR",
  "receipt_number": "Belegnummer/Rechnungsnummer/Rechnungsnummer",
  "payment_method": "Zahlungsmethode wenn erkennbar",
  "invoice_type": "incoming oder outgoing (nur bei Rechnungen)"
}

Gib NUR das JSON zurück, ohne Erklärungen.`
          }
        ]
      }
    ];

    const response = await fetch(`${MOONSHOT_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MOONSHOT_API_KEY}`
      },
      body: JSON.stringify({
        model: 'kimi-k2.5',
        messages,
        temperature: 0.1,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Kimi API Error: ${error}`);
    }

    const result: any = await response.json();
    const content = result.choices?.[0]?.message?.content || '';

    // JSON aus Response extrahieren
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        success: false,
        confidence: 0,
        error: 'Keine gültigen Daten extrahiert'
      };
    }

    const extracted = JSON.parse(jsonMatch[0]);

    return {
      success: true,
      merchant_name: extracted.merchant_name,
      date: extracted.date,
      total_amount: parseFloat(extracted.total_amount) || 0,
      vat_amount: parseFloat(extracted.vat_amount) || undefined,
      vat_rate: parseFloat(extracted.vat_rate) || undefined,
      currency: extracted.currency || 'EUR',
      receipt_number: extracted.receipt_number,
      payment_method: extracted.payment_method,
      confidence: 0.85, // Kimi ist zuverlässig
      raw: extracted
    };

  } catch (error) {
    console.error('Kimi OCR Error:', error);
    return {
      success: false,
      confidence: 0,
      error: (error as Error).message
    };
  }
}

/**
 * Extrahiert Amazon Dokument mit Kimi
 */
export async function extractAmazonDocumentWithKimi(
  fileBuffer: Buffer,
  mimeType: string,
  documentType: AmazonDocumentType
): Promise<AmazonOCRResult> {
  if (!MOONSHOT_API_KEY) {
    return {
      success: false,
      document_type: documentType,
      currency: 'EUR',
      confidence: 0,
      transactions: [],
      error: 'Kimi API Key nicht konfiguriert'
    };
  }

  try {
    const base64Image = fileBuffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Image}`;

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

    const messages: KimiMessage[] = [
      {
        role: 'system',
        content: 'Du bist ein OCR-Assistent für Amazon Seller Central Dokumente.'
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: dataUrl }
          },
          {
            type: 'text',
            text: `Analysiere dieses Amazon ${documentType} Dokument. ${docTypePrompts[documentType]}

Gib NUR das JSON zurück.`
          }
        ]
      }
    ];

    const response = await fetch(`${MOONSHOT_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MOONSHOT_API_KEY}`
      },
      body: JSON.stringify({
        model: 'kimi-k2.5',
        messages,
        temperature: 0.1,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Kimi API Error: ${error}`);
    }

    const result: any = await response.json();
    const content = result.choices?.[0]?.message?.content || '';

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        success: false,
        document_type: documentType,
        currency: 'EUR',
        confidence: 0,
        transactions: [],
        error: 'Keine gültigen Daten extrahiert'
      };
    }

    const extracted = JSON.parse(jsonMatch[0]);

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
      success: false,
      document_type: documentType,
      currency: 'EUR',
      confidence: 0,
      transactions: [],
      error: (error as Error).message
    };
  }
}
