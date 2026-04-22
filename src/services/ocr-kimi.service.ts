// ============================================
// OCR SERVICE - Kimi K2.5 Vision + Text
// Vision für Bilder, Text für PDFs
// Render-kompatibel: keine System-Dependencies
// ============================================

import type { OCRResult, AmazonOCRResult, AmazonDocumentType } from '../types/index.js';

// Lazy-load Module (Render-kompatibel)
let pdf2pic: typeof import('pdf2pic') | null = null;
let pdfParse: typeof import('pdf-parse') | null = null;
let modulesLoaded = false;

async function loadModules(): Promise<void> {
  if (modulesLoaded) return;
  modulesLoaded = true;
  
  try {
    pdf2pic = await import('pdf2pic');
  } catch {
    console.log('pdf2pic nicht verfügbar (ImageMagick fehlt) - PDF-Textmodus aktiv');
  }
  
  try {
    const pdfParseModule = await import('pdf-parse');
    pdfParse = (pdfParseModule as any).PDFParse || pdfParseModule;
    console.log('pdf-parse loaded:', typeof pdfParse);
  } catch (err) {
    console.error('pdf-parse load failed:', (err as Error).message);
  }
}

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
 * Prüft ob PDF-Text-Extraktion verfügbar ist
 */
export async function isPdfTextExtractionAvailable(): Promise<boolean> {
  await loadModules();
  return !!pdfParse;
}

/**
 * Prüft ob PDF-zu-Bild verfügbar ist (ImageMagick nötig)
 */
export async function isPdfToImageAvailable(): Promise<boolean> {
  await loadModules();
  return !!pdf2pic;
}

/**
 * Konvertiert Buffer zu Base64 Data URL
 */
function createDataUrl(buffer: Buffer, mimeType: string): string {
  const base64 = buffer.toString('base64');
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Extrahiert Text aus PDF mit pdf-parse
 * Keine System-Dependencies nötig
 */
async function extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
  await loadModules();
  if (!pdfParse) {
    throw new Error('pdf-parse nicht installiert');
  }
  
  try {
    const result = await (pdfParse as any)(pdfBuffer);
    console.log(`PDF Text extrahiert: ${result.text.length} Zeichen, ${result.numpages} Seiten`);
    return result.text;
  } catch (error) {
    console.error('PDF Text-Extraktion fehlgeschlagen:', error);
    throw new Error('PDF Text konnte nicht extrahiert werden: ' + (error as Error).message);
  }
}

/**
 * Konvertiert PDF zu Bildern (PNG) via pdf2pic
 * BRAUCHT ImageMagick/GraphicsMagick - auf Render meist nicht verfügbar
 */
async function convertPdfToImages(pdfBuffer: Buffer): Promise<Buffer[]> {
  await loadModules();
  if (!pdf2pic) {
    throw new Error('pdf2pic nicht verfügbar - ImageMagick/GraphicsMagick nicht installiert');
  }

  try {
    const convert = pdf2pic.fromBuffer(pdfBuffer, {
      density: 150,
      format: 'png',
      width: 1200,
      height: 1600,
    });
    
    const results = await convert.bulk([1, 2, 3], { responseType: 'buffer' });
    
    if (!results || results.length === 0) {
      throw new Error('PDF Konvertierung fehlgeschlagen');
    }
    
    const validBuffers = results
      .map(r => (r as any).buffer || r)
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
 * Ruft Kimi API mit Text-Prompt auf
 */
async function callKimiText(messages: KimiMessage[], maxTokens: number = 1000): Promise<string> {
  const response = await fetch(`${MOONSHOT_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MOONSHOT_API_KEY}`
    },
    body: JSON.stringify({
      model: 'kimi-k2.5',
      messages,
      temperature: 0.3,
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

/**
 * Ruft Kimi API mit Vision (Bildern) auf
 */
async function callKimiVision(
  imageDataUrls: string[], 
  prompt: string, 
  maxTokens: number = 1000
): Promise<string> {
  const imageContents = imageDataUrls.map(url => ({
    type: 'image_url' as const,
    image_url: { url }
  }));

  const messages: KimiMessage[] = [
    {
      role: 'system',
      content: 'Du bist ein OCR-Assistent für Buchhaltungsbelege. Extrahiere strukturierte Daten aus allen bereitgestellten Bildern.'
    },
    {
      role: 'user',
      content: [
        ...imageContents,
        { type: 'text', text: prompt }
      ]
    }
  ];

  return callKimiText(messages, maxTokens);
}

/**
 * Parsed JSON aus Kimi Response
 */
function parseKimiJson(content: string): any {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Kein JSON in Response gefunden');
  }
  return JSON.parse(jsonMatch[0]);
}

/**
 * Extrahiert Daten aus PDF-Text mit Kimi
 * Render-kompatibel - keine Bildkonvertierung nötig
 */
async function extractReceiptDataFromPdfText(
  pdfText: string,
  pageCount: number
): Promise<OCRResult> {
  const messages: KimiMessage[] = [
    {
      role: 'system',
      content: 'Du bist ein OCR-Assistent für Buchhaltungsbelege. Extrahiere strukturierte Daten aus dem bereitgestellten Text.'
    },
    {
      role: 'user',
      content: `Analysiere folgenden Beleg/Rechnung-Text (${pageCount} Seite(n)) und extrahiere folgende Daten im JSON-Format:

TEXT:
---
${pdfText.substring(0, 15000)}
---

JSON-Format:
{
  "merchant_name": "Name des Händlers/Ladens",
  "date": "Datum im Format YYYY-MM-DD",
  "total_amount": Gesamtbetrag als Zahl,
  "vat_amount": MwSt-Betrag als Zahl (wenn erkennbar),
  "vat_rate": MwSt-Satz als Zahl z.B. 19 (wenn erkennbar),
  "currency": "Währung z.B. EUR",
  "receipt_number": "Belegnummer/Rechnungsnummer",
  "payment_method": "Zahlungsmethode wenn erkennbar",
  "invoice_type": "incoming oder outgoing"
}

WICHTIG: 
- Die Gesamtsumme ist oft am Ende des Textes.
- Wenn das Datum nicht klar ist, verwende das aktuelle Datum.
- Gib NUR das JSON zurück, ohne Erklärungen.`
    }
  ];

  const content = await callKimiText(messages, 1000);
  console.log('Kimi OCR (PDF Text) raw response:', content.substring(0, 500));

  const extracted = parseKimiJson(content);
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
    confidence: 0.85,
    raw: extracted
  };
}

/**
 * Extrahiert Daten aus Bild mit Kimi Vision
 */
async function extractReceiptDataFromImage(
  imageBuffer: Buffer,
  mimeType: string
): Promise<OCRResult> {
  const dataUrl = createDataUrl(imageBuffer, mimeType);
  
  const prompt = `Analysiere diesen Beleg/Rechnung und extrahiere folgende Daten im JSON-Format:
{
  "merchant_name": "Name des Händlers/Ladens",
  "date": "Datum im Format YYYY-MM-DD",
  "total_amount": Gesamtbetrag als Zahl,
  "vat_amount": MwSt-Betrag als Zahl (wenn erkennbar),
  "vat_rate": MwSt-Satz als Zahl z.B. 19 (wenn erkennbar),
  "currency": "Währung z.B. EUR",
  "receipt_number": "Belegnummer/Rechnungsnummer",
  "payment_method": "Zahlungsmethode wenn erkennbar",
  "invoice_type": "incoming oder outgoing"
}

Gib NUR das JSON zurück, ohne Erklärungen.`;

  const content = await callKimiVision([dataUrl], prompt, 1000);
  console.log('Kimi OCR (Vision) raw response:', content.substring(0, 500));

  const extracted = parseKimiJson(content);
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
    confidence: 0.9,
    raw: extracted
  };
}

/**
 * Extrahiert Daten aus Beleg mit Kimi
 * PDF -> Text-Modus (Render-kompatibel)
 * Bilder -> Vision-Modus
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
    // PDF: Text-Extraktion (Render-kompatibel)
    if (mimeType === 'application/pdf') {
      console.log('PDF erkannt, starte Text-Extraktion...');
      
      if (!pdfParse) {
        return {
          success: false,
          confidence: 0,
          error: 'pdf-parse nicht verfügbar. Bitte "npm install pdf-parse" ausführen.'
        };
      }

      try {
        const pdfText = await extractTextFromPdf(fileBuffer);
        
        // Wenn PDF scheinbar leer ist (gescanntes PDF), versuche pdf2pic Fallback
        if (pdfText.trim().length < 50 && pdf2pic) {
          console.log('PDF scheint gescannt zu sein, versuche Bild-Konvertierung...');
          const images = await convertPdfToImages(fileBuffer);
          const dataUrls = images.slice(0, 3).map(buf => createDataUrl(buf, 'image/png'));
          const pageInfo = dataUrls.length > 1 ? `(Seiten 1-${dataUrls.length})` : '';
          
          const prompt = `Analysiere diesen Beleg/Rechnung ${pageInfo} und extrahiere folgende Daten im JSON-Format:
{
  "merchant_name": "Name des Händlers/Ladens",
  "date": "Datum im Format YYYY-MM-DD",
  "total_amount": Gesamtbetrag als Zahl,
  "vat_amount": MwSt-Betrag als Zahl (wenn erkennbar),
  "vat_rate": MwSt-Satz als Zahl z.B. 19 (wenn erkennbar),
  "currency": "Währung z.B. EUR",
  "receipt_number": "Belegnummer/Rechnungsnummer",
  "payment_method": "Zahlungsmethode wenn erkennbar",
  "invoice_type": "incoming oder outgoing"
}
WICHTIG: Die Gesamtsumme steht oft auf der letzten Seite. Prüfe alle Seiten.
Gib NUR das JSON zurück, ohne Erklärungen.`;

          const content = await callKimiVision(dataUrls, prompt, 1000);
          const extracted = parseKimiJson(content);
          
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
            confidence: 0.85,
            raw: extracted
          };
        }
        
        // Standard: Text-Modus
        if (pdfText.trim().length < 20) {
          return {
            success: false,
            confidence: 0,
            error: 'PDF enthält keinen extrahierbaren Text. Möglicherweise ein gescanntes PDF ohne OCR. ImageMagick für Bild-Konvertierung nicht verfügbar auf Render.'
          };
        }

        return await extractReceiptDataFromPdfText(pdfText, 1);
        
      } catch (pdfError) {
        console.error('PDF Verarbeitung fehlgeschlagen:', pdfError);
        return {
          success: false,
          confidence: 0,
          error: 'PDF Verarbeitung fehlgeschlagen: ' + (pdfError as Error).message
        };
      }
    }
    
    // Bilder: Vision-Modus
    if (mimeType.startsWith('image/')) {
      return await extractReceiptDataFromImage(fileBuffer, mimeType);
    }
    
    return {
      success: false,
      confidence: 0,
      error: `Nicht unterstützter Dateityp: ${mimeType}`
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

// ============================================
// AMAZON DOKUMENTE
// ============================================

/**
 * Extrahiert Amazon Dokument mit Kimi
 * PDF -> Text, Bilder -> Vision
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

  try {
    let content = '';

    // PDF: Text-Extraktion
    if (mimeType === 'application/pdf') {
      if (!pdfParse) {
        return {
          success: false,
          document_type: documentType,
          currency: 'EUR',
          confidence: 0,
          transactions: [],
          error: 'pdf-parse nicht verfügbar'
        };
      }

      const pdfText = await extractTextFromPdf(fileBuffer);
      
      // Gescanntes PDF Fallback
      if (pdfText.trim().length < 50 && pdf2pic) {
        const images = await convertPdfToImages(fileBuffer);
        const dataUrls = images.slice(0, 3).map(buf => createDataUrl(buf, 'image/png'));
        const pageInfo = dataUrls.length > 1 ? `(Seiten 1-${dataUrls.length})` : '';
        
        const prompt = `Analysiere dieses Amazon ${documentType} Dokument ${pageInfo}. ${docTypePrompts[documentType]}

WICHTIG: Summen und Totals stehen oft auf der letzten Seite. Prüfe alle Seiten.
Gib NUR das JSON zurück.`;

        content = await callKimiVision(dataUrls, prompt, 2000);
      } else if (pdfText.trim().length < 20) {
        return {
          success: false,
          document_type: documentType,
          currency: 'EUR',
          confidence: 0,
          transactions: [],
          error: 'PDF enthält keinen extrahierbaren Text. ImageMagick nicht verfügbar auf Render.'
        };
      } else {
        // Text-Modus
        const messages: KimiMessage[] = [
          {
            role: 'system',
            content: 'Du bist ein OCR-Assistent für Amazon Seller Central Dokumente.'
          },
          {
            role: 'user',
            content: `Analysiere folgendes Amazon ${documentType} Dokument und extrahiere die Daten:

TEXT:
---
${pdfText.substring(0, 15000)}
---

${docTypePrompts[documentType]}

Gib NUR das JSON zurück.`
          }
        ];
        content = await callKimiText(messages, 2000);
      }
    } else if (mimeType.startsWith('image/')) {
      // Bild: Vision
      const dataUrl = createDataUrl(fileBuffer, mimeType);
      const prompt = `Analysiere dieses Amazon ${documentType} Dokument. ${docTypePrompts[documentType]}

Gib NUR das JSON zurück.`;
      content = await callKimiVision([dataUrl], prompt, 2000);
    } else {
      return {
        success: false,
        document_type: documentType,
        currency: 'EUR',
        confidence: 0,
        transactions: [],
        error: `Nicht unterstützter Dateityp: ${mimeType}`
      };
    }

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
      success: false,
      document_type: documentType,
      currency: 'EUR',
      confidence: 0,
      transactions: [],
      error: (error as Error).message
    };
  }
}
