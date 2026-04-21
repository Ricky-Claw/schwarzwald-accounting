// ============================================
// OCR SERVICE - Kimi K2.5 Vision
// Vision-basierte Beleg-Erkennung
// ============================================

import type { OCRResult, AmazonOCRResult, AmazonDocumentType } from '../types/index.js';
import { fromBuffer } from 'pdf2pic';

const MOONSHOT_API_KEY = process.env.MOONSHOT_API_KEY;
const MOONSHOT_BASE_URL = 'https://api.moonshot.ai/v1';

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
 * Konvertiert Buffer zu Base64 Data URL
 */
function createDataUrl(buffer: Buffer, mimeType: string): string {
  const base64 = buffer.toString('base64');
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Konvertiert PDF zu Bildern (PNG)
 * Kimi Vision unterstützt keine PDFs direkt
 * Gibt die ersten 3 Seiten zurück (für mehrseitige Rechnungen)
 */
async function convertPdfToImages(pdfBuffer: Buffer): Promise<Buffer[]> {
  try {
    const convert = fromBuffer(pdfBuffer, {
      density: 150,
      format: 'png',
      width: 1200,
      height: 1600,
    });
    
    // Konvertiere Seiten 1-3 (oder weniger wenn PDF kürzer)
    const results = await convert.bulk([1, 2, 3], { responseType: 'buffer' });
    
    if (!results || results.length === 0) {
      throw new Error('PDF Konvertierung fehlgeschlagen');
    }
    
    // Filtere gültige Buffer
    const validBuffers = results
      .map(r => r.buffer || r)
      .filter(b => Buffer.isBuffer(b)) as Buffer[];
    
    if (validBuffers.length === 0) {
      throw new Error('PDF Konvertierung: Keine gültigen Bilder erhalten');
    }
    
    console.log(`PDF konvertiert: ${validBuffers.length} Seite(n)`);
    return validBuffers;
  } catch (error) {
    console.error('PDF zu Bild Konvertierung fehlgeschlagen:', error);
    throw new Error('PDF konnte nicht konvertiert werden: ' + (error as Error).message);
  }
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
    // Prüfe ob PDF - dann zu Bildern konvertieren
    let imageBuffers: Buffer[] = [fileBuffer];
    let imageMimeType = mimeType;
    
    if (mimeType === 'application/pdf') {
      console.log('PDF erkannt, konvertiere zu Bildern...');
      imageBuffers = await convertPdfToImages(fileBuffer);
      imageMimeType = 'image/png';
      console.log(`PDF erfolgreich zu ${imageBuffers.length} PNG(s) konvertiert`);
    }
    
    // Erstelle Data URLs für alle Bilder (max 3)
    const dataUrls = imageBuffers.slice(0, 3).map(buf => createDataUrl(buf, imageMimeType));

    // Baue Content mit allen Bildern
    const imageContents = dataUrls.map(url => ({
      type: 'image_url' as const,
      image_url: { url }
    }));
    
    const pageInfo = dataUrls.length > 1 ? `(Seiten 1-${dataUrls.length} von PDF)` : '';
    
    const messages: KimiMessage[] = [
      {
        role: 'system',
        content: 'Du bist ein OCR-Assistent für Buchhaltungsbelege. Extrahiere strukturierte Daten aus allen bereitgestellten Bildern.'
      },
      {
        role: 'user',
        content: [
          ...imageContents,
          {
            type: 'text',
            text: `Analysiere diesen Beleg/Rechnung ${pageInfo} und extrahiere folgende Daten im JSON-Format:
{
  "merchant_name": "Name des Händlers/Ladens",
  "date": "Datum im Format YYYY-MM-DD",
  "total_amount": Gesamtbetrag als Zahl,
  "vat_amount": MwSt-Betrag als Zahl (wenn erkennbar),
  "vat_rate": MwSt-Satz als Zahl z.B. 19 (wenn erkennbar),
  "currency": "Währung z.B. EUR",
  "receipt_number": "Belegnummer/Rechnungsnummer",
  "payment_method": "Zahlungsmethode wenn erkennbar",
  "invoice_type": "incoming oder outgoing",
  "page_count": ${dataUrls.length}
}

WICHTIG: Die Gesamtsumme steht oft auf der letzten Seite. Prüfe alle Seiten.
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
        temperature: 1,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Kimi API Error: ${error}`);
    }

    const result: any = await response.json();
    const content = result.choices?.[0]?.message?.content || '';

    console.log('Kimi OCR raw response:', content.substring(0, 500));

    // JSON aus Response extrahieren
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Kimi OCR: No JSON found in response');
      return {
        success: false,
        confidence: 0,
        error: 'Keine gültigen Daten extrahiert',
        raw: content
      };
    }

    const extracted = JSON.parse(jsonMatch[0]);
    console.log('Kimi OCR extracted:', JSON.stringify(extracted, null, 2));

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
    // PDF zu Bildern konvertieren falls nötig
    let imageBuffers: Buffer[] = [fileBuffer];
    let imageMimeType = mimeType;
    
    if (mimeType === 'application/pdf') {
      console.log('Amazon PDF erkannt, konvertiere zu Bildern...');
      imageBuffers = await convertPdfToImages(fileBuffer);
      imageMimeType = 'image/png';
    }
    
    // Erstelle Data URLs für alle Bilder (max 3)
    const dataUrls = imageBuffers.slice(0, 3).map(buf => createDataUrl(buf, imageMimeType));

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

    // Baue Content mit allen Bildern
    const imageContents = dataUrls.map(url => ({
      type: 'image_url' as const,
      image_url: { url }
    }));
    
    const pageInfo = dataUrls.length > 1 ? `(Seiten 1-${dataUrls.length})` : '';
    
    const messages: KimiMessage[] = [
      {
        role: 'system',
        content: 'Du bist ein OCR-Assistent für Amazon Seller Central Dokumente.'
      },
      {
        role: 'user',
        content: [
          ...imageContents,
          {
            type: 'text',
            text: `Analysiere dieses Amazon ${documentType} Dokument ${pageInfo}. ${docTypePrompts[documentType]}

WICHTIG: Summen und Totals stehen oft auf der letzten Seite. Prüfe alle Seiten.
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
        temperature: 1,
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
