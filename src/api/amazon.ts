// ============================================
// AMAZON SELLER CENTRAL API ROUTES
// ============================================

import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import multer from 'multer';
import { extractAmazonDocumentData } from '../services/ocr.service.js';
import { extractAmazonDocumentWithKimi, isKimiOCRAvailable } from '../services/ocr-kimi.service.js';
import type { ProcessAmazonDocumentRequest } from '../types/index.js';

const router = Router();

// Supabase Client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Multer for file upload (memory storage)
const upload = multer({ storage: multer.memoryStorage() });

// ============================================
// GET /api/accounting/amazon/documents
// ============================================
router.get('/documents', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { type, status, limit = 50 } = req.query;

    let query = supabase
      .from('amazon_documents')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit as string));

    if (type) query = query.eq('document_type', type);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;

    if (error) throw error;

    res.json({ documents: data || [] });
  } catch (error) {
    console.error('Error fetching Amazon documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// ============================================
// GET /api/accounting/amazon/documents/:id
// ============================================
router.get('/documents/:id', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { id } = req.params;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { data, error } = await supabase
      .from('amazon_documents')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) throw error;

    res.json({ document: data });
  } catch (error) {
    console.error('Error fetching Amazon document:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// ============================================
// POST /api/accounting/amazon/documents
// Upload and process Amazon Seller Central document
// ============================================
router.post('/documents', upload.single('file'), async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { document_type } = req.body as ProcessAmazonDocumentRequest;
    
    if (!document_type) {
      return res.status(400).json({ error: 'document_type is required' });
    }

    // Upload file to storage
    const fileName = `amazon/${userId}/${Date.now()}_${req.file.originalname}`;
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('accounting-documents')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
      });

    if (uploadError) throw uploadError;

    // Create document record
    const { data: document, error: dbError } = await supabase
      .from('amazon_documents')
      .insert({
        user_id: userId,
        document_type,
        file_path: uploadData.path,
        file_name: req.file.originalname,
        status: 'pending',
      })
      .select()
      .single();

    if (dbError) throw dbError;

    // Start async processing
    processAmazonDocumentAsync(document.id, req.file.buffer, document_type, userId);

    res.status(201).json({ 
      document,
      message: 'Document uploaded and processing started' 
    });
  } catch (error) {
    console.error('Error uploading Amazon document:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

// ============================================
// POST /api/accounting/amazon/documents/:id/reprocess
// Reprocess with different document type
// ============================================
router.post('/documents/:id/reprocess', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { id } = req.params;
    const { document_type } = req.body;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!document_type) return res.status(400).json({ error: 'document_type is required' });

    // Get document
    const { data: document, error: fetchError } = await supabase
      .from('amazon_documents')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError) throw fetchError;

    // Download file
    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from('accounting-documents')
      .download(document.file_path);

    if (downloadError) throw downloadError;

    const buffer = Buffer.from(await fileData.arrayBuffer());

    // Update document type
    await supabase
      .from('amazon_documents')
      .update({ 
        document_type,
        status: 'processing',
        processed_data: null,
      })
      .eq('id', id);

    // Reprocess
    processAmazonDocumentAsync(id, buffer, document_type, userId);

    res.json({ message: 'Reprocessing started' });
  } catch (error) {
    console.error('Error reprocessing document:', error);
    res.status(500).json({ error: 'Failed to reprocess document' });
  }
});

// ============================================
// DELETE /api/accounting/amazon/documents/:id
// ============================================
router.delete('/documents/:id', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { id } = req.params;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Get document
    const { data: document } = await supabase
      .from('amazon_documents')
      .select('file_path')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    // Delete file from storage
    if (document?.file_path) {
      await supabase.storage.from('accounting-documents').remove([document.file_path]);
    }

    // Delete record
    const { error } = await supabase
      .from('amazon_documents')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// ============================================
// GET /api/accounting/amazon/summary
// Summary for dashboard
// ============================================
router.get('/summary', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { period_start, period_end } = req.query;

    // Get all processed documents in period
    let query = supabase
      .from('amazon_documents')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'success');

    if (period_start) query = query.gte('created_at', period_start);
    if (period_end) query = query.lte('created_at', period_end);

    const { data: documents, error } = await query;

    if (error) throw error;

    // Calculate totals
    const summary = {
      total_documents: documents?.length || 0,
      total_sales: 0,
      total_refunds: 0,
      total_fees: 0,
      net_amount: 0,
      by_type: {} as Record<string, { count: number; amount: number }>,
    };

    for (const doc of documents || []) {
      const data = doc.processed_data;
      if (!data) continue;

      summary.total_sales += data.total_sales || 0;
      summary.total_refunds += data.total_refunds || 0;
      summary.total_fees += data.total_fees || 0;
      summary.net_amount += data.net_amount || 0;

      // Group by type
      if (!summary.by_type[doc.document_type]) {
        summary.by_type[doc.document_type] = { count: 0, amount: 0 };
      }
      summary.by_type[doc.document_type].count += 1;
      summary.by_type[doc.document_type].amount += data.net_amount || 0;
    }

    res.json({ summary });
  } catch (error) {
    console.error('Error fetching summary:', error);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// ============================================
// PROCESSING FUNCTIONS
// ============================================

async function processAmazonDocumentAsync(
  documentId: string,
  fileBuffer: Buffer,
  documentType: string,
  userId: string
) {
  try {
    // Update status to processing
    await supabase
      .from('amazon_documents')
      .update({ status: 'processing' })
      .eq('id', documentId);

    // Extract data using OCR - Kimi bevorzugt
    let result;
    if (isKimiOCRAvailable()) {
      console.log(`Processing Amazon ${documentType} with Kimi Vision...`);
      result = await extractAmazonDocumentWithKimi(fileBuffer, 'image/png', documentType as any);
    } else if (process.env.AZURE_FORM_RECOGNIZER_KEY) {
      console.log(`Processing Amazon ${documentType} with Azure...`);
      result = await extractAmazonDocumentData(fileBuffer, documentType as any);
    } else {
      throw new Error('Kein OCR-Service verfügbar');
    }

    if (!result.success) {
      await supabase
        .from('amazon_documents')
        .update({
          status: 'error',
          ocr_confidence: 0,
        })
        .eq('id', documentId);
      return;
    }

    // Update document with processed data
    await supabase
      .from('amazon_documents')
      .update({
        status: 'success',
        processed_data: result,
        ocr_confidence: result.confidence,
      })
      .eq('id', documentId);

    // Optionally: Create transactions from Amazon data
    if (result.transactions && result.transactions.length > 0) {
      await createTransactionsFromAmazon(documentId, result, userId);
    }

  } catch (error) {
    console.error('Error processing Amazon document:', error);
    
    await supabase
      .from('amazon_documents')
      .update({
        status: 'error',
      })
      .eq('id', documentId);
  }
}

async function createTransactionsFromAmazon(
  documentId: string,
  data: any,
  userId: string
) {
  try {
    // Create bank transactions from Amazon transactions
    const transactions = data.transactions.map((t: any) => ({
      user_id: userId,
      transaction_date: t.date,
      amount: t.net_amount,
      currency: data.currency || 'EUR',
      description: `Amazon ${t.order_id} - ${t.product_name || 'Sale'}`,
      counterparty_name: 'Amazon Seller Central',
      reference: t.order_id,
      status: 'unmatched',
      is_split: false,
    }));

    if (transactions.length > 0) {
      await supabase.from('bank_transactions').insert(transactions);
    }
  } catch (error) {
    console.error('Error creating transactions from Amazon:', error);
  }
}

export default router;
