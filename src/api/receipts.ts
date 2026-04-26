// ============================================
// RECEIPTS API ROUTES
// Belege hochladen, OCR, automatisches Matching
// ============================================

import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import multer from 'multer';
import crypto from 'crypto';
import { extractReceiptData } from '../services/ocr.service.js';
import { extractReceiptDataWithKimi, isKimiOCRAvailable } from '../services/ocr-kimi.service.js';
import { EXPENSE_CATEGORIES, autoCategorize, generateFileName } from '../types/categories.js';
import {
  findMatchingTransaction,
  matchReceiptToTransaction,
  autoMatchAllReceipts,
  getMonthlyOverview,
  getAllMonths,
  findMissingReceipts,
  getDashboardStats,
} from '../services/matching.service.js';
import type { Receipt } from '../types/index.js';

const router = Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  }
});

// ============================================
// HELPER: File Hash für Duplikat-Erkennung
// (optional - wird nicht in DB gespeichert wenn Spalte fehlt)
// ============================================
function calculateFileHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// ============================================
// GET /api/accounting/receipts
// Liste aller Belege
// ============================================
router.get('/', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { month, status, unmatched } = req.query;

    let query = supabase
      .from('receipts')
      .select('*')
      .order('created_at', { ascending: false });

    if (month) {
      // Filter by month "2024-02" - korrektes Monatsende berechnen
      const [year, monthNum] = (month as string).split('-').map(Number);
      const lastDay = new Date(year, monthNum, 0).getDate();
      query = query
        .gte('receipt_date', `${month}-01`)
        .lte('receipt_date', `${month}-${String(lastDay).padStart(2, '0')}`);
    }

    if (status) query = query.eq('status', status);
    if (unmatched === 'true') query = query.is('bank_transaction_id', null);

    const { data, error } = await query;

    if (error) throw error;

    res.json({ receipts: data || [] });
  } catch (error) {
    console.error('Error fetching receipts:', error);
    res.status(500).json({ error: 'Failed to fetch receipts' });
  }
});

// ============================================
// GET /api/accounting/receipts/:id
// ============================================
router.get('/:id', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const { id } = req.params;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { data, error } = await supabase
      .from('receipts')
      .select(`
        *,
        transaction:bank_transaction_id (*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    res.json({ receipt: data });
  } catch (error) {
    console.error('Error fetching receipt:', error);
    res.status(500).json({ error: 'Failed to fetch receipt' });
  }
});

// ============================================
// POST /api/accounting/receipts
// Upload + OCR + Automatisches Matching + Kategorisierung
// ============================================
router.post('/', upload.single('file'), async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // DEBUG: Logge Datei-Details
    console.log('Upload Debug:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      bufferFirstBytes: req.file.buffer.slice(0, 8).toString('hex'),
      bufferPreview: req.file.buffer.slice(0, 50).toString().replace(/\n/g, '\\n')
    });

    // Validiere Dateityp (Bilder und PDFs)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'application/pdf'];
    
    // Prüfe Magic Numbers
    const hex = req.file.buffer.slice(0, 8).toString('hex');
    const isJpeg = hex.startsWith('ffd8');
    const isPng = hex.startsWith('89504e47');
    const isGif = hex.startsWith('474946');
    const isBmp = hex.startsWith('424d');
    const isPdf = hex.startsWith('25504446'); // %PDF
    const isWebp = hex.startsWith('52494646'); // RIFF (WebP)
    
    const isValidImage = isJpeg || isPng || isGif || isBmp || isPdf || isWebp;
    
    if (!allowedTypes.includes(req.file.mimetype) || !isValidImage) {
      console.error(`Invalid file upload: mimetype=${req.file.mimetype}, valid=${isValidImage}, hex=${hex}`);
      return res.status(400).json({ 
        error: `Invalid file type: ${req.file.mimetype}. Only JPG, PNG, WebP, GIF, BMP, PDF allowed`,
        details: `File appears to be: ${isJpeg ? 'JPEG' : isPng ? 'PNG' : isPdf ? 'PDF' : isGif ? 'GIF' : isBmp ? 'BMP' : isWebp ? 'WebP' : 'Unknown/Invalid'}`
      });
    }
    
    // Korrekten Mime-Type setzen basierend auf Magic Number
    let detectedMimeType = req.file.mimetype;
    if (isJpeg) detectedMimeType = 'image/jpeg';
    else if (isPng) detectedMimeType = 'image/png';
    else if (isGif) detectedMimeType = 'image/gif';
    else if (isBmp) detectedMimeType = 'image/bmp';
    else if (isWebp) detectedMimeType = 'image/webp';
    else if (isPdf) detectedMimeType = 'application/pdf';
    
    if (detectedMimeType !== req.file.mimetype) {
      console.log(`Mime-type corrected: ${req.file.mimetype} -> ${detectedMimeType}`);
    }

    // Rechnungstyp aus Request (incoming=Ausgabe, outgoing=Einnahme)
    const invoiceType = req.body.invoice_type === 'outgoing' ? 'outgoing' : 'incoming';
    const manualCategory = req.body.category_id as string | undefined;

    // OCR processing - Kimi Vision bevorzugt, dann Azure Fallback
    let ocrResult;
    
    console.log('OCR Check - Kimi available:', isKimiOCRAvailable());
    console.log('OCR Check - Azure available:', !!process.env.AZURE_FORM_RECOGNIZER_KEY);
    
    if (isKimiOCRAvailable()) {
      console.log('Using Kimi Vision for OCR with mimetype:', detectedMimeType);
      ocrResult = await extractReceiptDataWithKimi(req.file.buffer, detectedMimeType);
      console.log('Kimi OCR result:', JSON.stringify(ocrResult, null, 2));
    } else if (process.env.AZURE_FORM_RECOGNIZER_KEY) {
      console.log('Using Azure OCR...');
      ocrResult = await extractReceiptData(req.file.buffer);
    } else {
      console.log('No OCR service available, using manual mode');
      ocrResult = {
        success: false,
        confidence: 0,
        error: 'OCR nicht verfügbar - manuelle Eingabe erforderlich'
      };
    }

    // Automatische Kategorisierung
    const category = manualCategory 
      ? EXPENSE_CATEGORIES.find(c => c.id === manualCategory)
      : (ocrResult.merchant_name ? autoCategorize(ocrResult.merchant_name) : EXPENSE_CATEGORIES.find(c => c.id === 'sonstiges'));

    // Generiere sinnvollen Dateinamen
    const displayFileName = generateFileName(
      ocrResult.date || new Date().toISOString().split('T')[0],
      ocrResult.merchant_name || 'Unbekannt',
      ocrResult.total_amount || 0,
      ocrResult.invoice_number,
      category
    );

    // Upload to storage mit neuem Dateinamen
    const fileName = `receipts/${userId}/${Date.now()}_${displayFileName}`;
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('accounting-documents')
      .upload(fileName, req.file.buffer, {
        contentType: detectedMimeType,
      });

    if (uploadError) throw uploadError;

    // Try auto-matching (nur für Eingangsrechnungen)
    let matchedTransactionId: string | null = null;
    let matchConfidence = 0;

    if (invoiceType === 'incoming' && ocrResult.success && ocrResult.total_amount && ocrResult.date) {
      const match = await findMatchingTransaction(userId, {
        amount: ocrResult.total_amount,
        date: ocrResult.date,
        merchantName: ocrResult.merchant_name,
      });

      if (match.success && match.confidence > 0.8) {
        matchedTransactionId = match.transactionId || null;
        matchConfidence = match.confidence;

        // Auto-match if high confidence
        if (matchedTransactionId) {
          await matchReceiptToTransaction(
            '', // Will be updated after insert
            matchedTransactionId,
            userId
          );
        }
      }
    }

    // Create receipt record mit allen neuen Feldern
    // category_id wird nicht gesetzt - DB erwartet UUID, wir haben nur String-ID
    // skr04_code reicht für die Buchhaltung
    const { data: receipt, error: dbError } = await supabase
      .from('receipts')
      .insert({
        // user_id removed - FK constraint dropped
        merchant_name: ocrResult.merchant_name,
        receipt_date: ocrResult.date,
        total_amount: ocrResult.total_amount,
        vat_amount: ocrResult.vat_amount,
        file_path: uploadData.path,
        file_name_display: displayFileName,
        // file_hash: fileHash, // Spalte fehlt in DB
        invoice_number: ocrResult.invoice_number,
        invoice_type: invoiceType,
        skr04_code: category?.skr04Code,
        ocr_confidence: ocrResult.confidence,
        ocr_raw: ocrResult.raw,
        ocr_status: ocrResult.success ? 'success' : 'error',
        bank_transaction_id: matchedTransactionId,
        status: 'verified',
      })
      .select()
      .single();

    if (dbError) throw dbError;

    // If auto-matched, update the match with correct receipt ID
    if (matchedTransactionId) {
      await matchReceiptToTransaction(receipt.id, matchedTransactionId, userId);
    }

    res.status(201).json({
      receipt,
      ocr: ocrResult,
      category: category,
      fileName: displayFileName,
      autoMatched: matchedTransactionId ? {
        transactionId: matchedTransactionId,
        confidence: matchConfidence,
      } : null,
    });
  } catch (error: any) {
    console.error('Error uploading receipt:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
    });
    res.status(500).json({ 
      error: 'Failed to upload receipt',
      details: error.message,
      code: error.code,
    });
  }
});

// ============================================
// PATCH /api/accounting/receipts/:id
// Update receipt data (correct OCR errors)
// ============================================
router.patch('/:id', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const { id } = req.params;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const updates: Partial<Receipt> & { skr04_code?: string } = {};
    const allowedFields = ['merchant_name', 'receipt_date', 'total_amount', 'vat_amount', 'category_id', 'status', 'invoice_type', 'invoice_number'];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        (updates as any)[field] = req.body[field];
      }
    }

    // Wenn Kategorie geändert wird, auch SKR04-Code aktualisieren
    if (req.body.category_id) {
      const newCategory = EXPENSE_CATEGORIES.find(c => c.id === req.body.category_id);
      if (newCategory) {
        updates.skr04_code = newCategory.skr04Code;
      }
    }

    const { data, error } = await supabase
      .from('receipts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ receipt: data });
  } catch (error) {
    console.error('Error updating receipt:', error);
    res.status(500).json({ error: 'Failed to update receipt' });
  }
});

// ============================================
// POST /api/accounting/receipts/:id/match
// Manuelles Matching zu Buchung
// ============================================
router.post('/:id/match', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const { id } = req.params;
    const { transaction_id } = req.body;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!transaction_id) return res.status(400).json({ error: 'transaction_id required' });

    const success = await matchReceiptToTransaction(id, transaction_id, userId);

    if (!success) {
      return res.status(400).json({ error: 'Failed to match' });
    }

    res.json({ success: true, message: 'Receipt matched to transaction' });
  } catch (error) {
    console.error('Error matching receipt:', error);
    res.status(500).json({ error: 'Failed to match receipt' });
  }
});

// ============================================
// POST /api/accounting/receipts/auto-match
// Batch auto-matching für alle ungematchten
// ============================================
router.post('/auto-match', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const result = await autoMatchAllReceipts(userId);

    res.json({
      success: true,
      matched: result.matched,
      unmatched: result.unmatched,
    });
  } catch (error) {
    console.error('Error auto-matching:', error);
    res.status(500).json({ error: 'Failed to auto-match' });
  }
});

// ============================================
// DELETE /api/accounting/receipts/:id
// ============================================
router.delete('/:id', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const { id } = req.params;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Get receipt
    const { data: receipt } = await supabase
      .from('receipts')
      .select('file_path, bank_transaction_id')
      .eq('id', id)
      .single();

    // Delete file from storage
    if (receipt?.file_path) {
      await supabase.storage.from('accounting-documents').remove([receipt.file_path]);
    }

    // Unlink from transaction if matched
    if (receipt?.bank_transaction_id) {
      await supabase
        .from('bank_transactions')
        .update({ receipt_id: null, status: 'unmatched' })
        .eq('id', receipt.bank_transaction_id);
    }

    // Delete receipt
    const { error } = await supabase
      .from('receipts')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting receipt:', error);
    res.status(500).json({ error: 'Failed to delete receipt' });
  }
});

// ============================================
// DASHBOARD & MONTHLY VIEWS
// ============================================

// GET /api/accounting/dashboard
router.get('/dashboard/stats', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const stats = await getDashboardStats(userId);

    res.json(stats);
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

// GET /api/accounting/months
// Liste aller Monate mit Status
router.get('/months/list', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const months = await getAllMonths(userId);

    res.json({ months });
  } catch (error) {
    console.error('Error fetching months:', error);
    res.status(500).json({ error: 'Failed to fetch months' });
  }
});

// GET /api/accounting/months/:year/:month
// Detaillierte Übersicht für einen Monat
router.get('/months/:year/:month', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const year = parseInt(req.params.year);
    const month = parseInt(req.params.month);

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const overview = await getMonthlyOverview(userId, year, month);

    res.json(overview);
  } catch (error) {
    console.error('Error fetching month overview:', error);
    res.status(500).json({ error: 'Failed to fetch month overview' });
  }
});

// GET /api/accounting/months/:year/:month/missing
// Fehlende Belege für einen Monat
router.get('/months/:year/:month/missing', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const year = parseInt(req.params.year);
    const month = parseInt(req.params.month);

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const missing = await findMissingReceipts(userId, year, month);

    res.json({
      year,
      month,
      count: missing.length,
      transactions: missing,
    });
  } catch (error) {
    console.error('Error fetching missing receipts:', error);
    res.status(500).json({ error: 'Failed to fetch missing receipts' });
  }
});

// ============================================
// GET /api/accounting/receipts/categories
// Liste aller Kategorien mit SKR04-Konten
// ============================================
router.get('/categories/list', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Gruppiere nach Eingang/Ausgang
    const incoming = EXPENSE_CATEGORIES.filter(c => 
      !['warenverkauf', 'dienstleistungen', 'sonstige_einnahmen'].includes(c.id)
    );
    const outgoing = EXPENSE_CATEGORIES.filter(c => 
      ['warenverkauf', 'dienstleistungen', 'sonstige_einnahmen'].includes(c.id)
    );

    res.json({
      incoming: { name: 'Eingangsrechnungen (Ausgaben)', categories: incoming },
      outgoing: { name: 'Ausgangsrechnungen (Einnahmen)', categories: outgoing },
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

export default router;
