// ============================================
// RECEIPTS API ROUTES
// Belege hochladen, OCR, automatisches Matching
// ============================================

import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import multer from 'multer';
import { extractReceiptData } from '../services/ocr.service.js';
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
const upload = multer({ storage: multer.memoryStorage() });

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
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { month, status, unmatched } = req.query;

    let query = supabase
      .from('receipts')
      .select(`
        *,
        transaction:bank_transaction_id (*)
      `)
      .eq('user_id', userId)
      .order('receipt_date', { ascending: false });

    if (month) {
      // Filter by month "2024-02"
      query = query
        .gte('receipt_date', `${month}-01`)
        .lte('receipt_date', `${month}-31`);
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
    const userId = req.headers['x-user-id'] as string;
    const { id } = req.params;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { data, error } = await supabase
      .from('receipts')
      .select(`
        *,
        transaction:bank_transaction_id (*)
      `)
      .eq('id', id)
      .eq('user_id', userId)
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
// Upload + OCR + Automatisches Matching
// ============================================
router.post('/', upload.single('file'), async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Upload to storage
    const fileName = `receipts/${userId}/${Date.now()}_${req.file.originalname}`;
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('accounting-documents')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
      });

    if (uploadError) throw uploadError;

    // OCR processing
    const ocrResult = await extractReceiptData(req.file.buffer);

    // Try auto-matching
    let matchedTransactionId: string | null = null;
    let matchConfidence = 0;

    if (ocrResult.success && ocrResult.total_amount && ocrResult.date) {
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

    // Create receipt record
    const { data: receipt, error: dbError } = await supabase
      .from('receipts')
      .insert({
        user_id: userId,
        merchant_name: ocrResult.merchant_name,
        receipt_date: ocrResult.date,
        total_amount: ocrResult.total_amount,
        vat_amount: ocrResult.vat_amount,
        file_path: uploadData.path,
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
      autoMatched: matchedTransactionId ? {
        transactionId: matchedTransactionId,
        confidence: matchConfidence,
      } : null,
    });
  } catch (error) {
    console.error('Error uploading receipt:', error);
    res.status(500).json({ error: 'Failed to upload receipt' });
  }
});

// ============================================
// PATCH /api/accounting/receipts/:id
// Update receipt data (correct OCR errors)
// ============================================
router.patch('/:id', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { id } = req.params;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const updates: Partial<Receipt> = {};
    const allowedFields = ['merchant_name', 'receipt_date', 'total_amount', 'vat_amount', 'category_id', 'status'];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        (updates as any)[field] = req.body[field];
      }
    }

    const { data, error } = await supabase
      .from('receipts')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
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
    const userId = req.headers['x-user-id'] as string;
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
    const userId = req.headers['x-user-id'] as string;
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
    const userId = req.headers['x-user-id'] as string;
    const { id } = req.params;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Get receipt
    const { data: receipt } = await supabase
      .from('receipts')
      .select('file_path, bank_transaction_id')
      .eq('id', id)
      .eq('user_id', userId)
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
      .eq('id', id)
      .eq('user_id', userId);

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
    const userId = req.headers['x-user-id'] as string;
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
    const userId = req.headers['x-user-id'] as string;
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
    const userId = req.headers['x-user-id'] as string;
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
    const userId = req.headers['x-user-id'] as string;
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

export default router;
