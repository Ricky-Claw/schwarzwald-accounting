// ============================================
// BANK STATEMENT API ROUTES
// ============================================

import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';
import { parseStringPromise } from 'xml2js';
import type { BankTransaction, UploadStatementRequest } from '../types/index.js';

const router = Router();

// Supabase Client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// ============================================
// GET /api/accounting/statements
// ============================================
router.get('/', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { data, error } = await supabase
      .from('bank_statements')
      .select('*')
      .eq('user_id', userId)
      .order('statement_date', { ascending: false });

    if (error) throw error;

    res.json({ statements: data || [] });
  } catch (error) {
    console.error('Error fetching statements:', error);
    res.status(500).json({ error: 'Failed to fetch statements' });
  }
});

// ============================================
// GET /api/accounting/statements/:id
// ============================================
router.get('/:id', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const { id } = req.params;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Get statement with transactions
    const [statementResult, transactionsResult] = await Promise.all([
      supabase.from('bank_statements').select('*').eq('id', id).eq('user_id', userId).single(),
      supabase
        .from('bank_transactions')
        .select('*, category:category_id(*)')
        .eq('statement_id', id)
        .eq('user_id', userId)
        .order('transaction_date', { ascending: false }),
    ]);

    if (statementResult.error) throw statementResult.error;
    if (transactionsResult.error) throw transactionsResult.error;

    res.json({
      statement: statementResult.data,
      transactions: transactionsResult.data || [],
    });
  } catch (error) {
    console.error('Error fetching statement:', error);
    res.status(500).json({ error: 'Failed to fetch statement' });
  }
});

// ============================================
// POST /api/accounting/statements
// Upload and process bank statement
// ============================================
router.post('/', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { account_name, account_iban, statement_date } = req.body as UploadStatementRequest;
    
    // File upload would be handled by multer middleware
    // For now, assume file is already uploaded to storage
    const filePath = req.body.file_path;
    const fileType = detectFileType(req.body.file_name || '');

    // Create statement record
    const { data: statement, error } = await supabase
      .from('bank_statements')
      .insert({
        user_id: userId,
        account_name,
        account_iban,
        statement_date,
        file_path: filePath,
        file_type: fileType,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    // Start async processing
    processStatementAsync(statement.id, filePath, fileType, userId);

    res.status(201).json({ statement });
  } catch (error) {
    console.error('Error uploading statement:', error);
    res.status(500).json({ error: 'Failed to upload statement' });
  }
});

// ============================================
// DELETE /api/accounting/statements/:id
// ============================================
router.delete('/:id', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const { id } = req.params;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Delete file from storage
    const { data: statement } = await supabase
      .from('bank_statements')
      .select('file_path')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (statement?.file_path) {
      await supabase.storage.from('statements').remove([statement.file_path]);
    }

    // Delete statement (cascades to transactions)
    const { error } = await supabase
      .from('bank_statements')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting statement:', error);
    res.status(500).json({ error: 'Failed to delete statement' });
  }
});

// ============================================
// PATCH /api/accounting/statements/transactions/:id
// Update transaction notes (for missing receipts)
// ============================================
router.patch('/transactions/:id', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const { id } = req.params;
    const { notes } = req.body;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { data, error } = await supabase
      .from('bank_transactions')
      .update({ notes, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    res.json({ transaction: data });
  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

// ============================================
// PROCESSING FUNCTIONS
// ============================================

async function processStatementAsync(
  statementId: string,
  filePath: string,
  fileType: 'pdf' | 'csv' | 'camt',
  userId: string
) {
  try {
    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from('statements')
      .download(filePath);

    if (downloadError) throw downloadError;

    const buffer = Buffer.from(await fileData.arrayBuffer());
    let transactions: Partial<BankTransaction>[] = [];

    // Parse based on file type
    switch (fileType) {
      case 'csv':
        transactions = parseCSV(buffer.toString());
        break;
      case 'camt':
        transactions = await parseCAMT(buffer.toString());
        break;
      case 'pdf':
        // PDF parsing would require additional library
        transactions = [];
        break;
    }

    // Insert transactions
    if (transactions.length > 0) {
      const { error } = await supabase.from('bank_transactions').insert(
        transactions.map((t) => ({
          ...t,
          statement_id: statementId,
          user_id: userId,
          status: 'unmatched',
          is_split: false,
        }))
      );

      if (error) throw error;
    }

    // Update statement status
    const totalAmount = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    
    await supabase
      .from('bank_statements')
      .update({
        status: 'processed',
        transaction_count: transactions.length,
        total_amount: totalAmount,
        processed_at: new Date().toISOString(),
      })
      .eq('id', statementId);

  } catch (error) {
    console.error('Error processing statement:', error);
    
    await supabase
      .from('bank_statements')
      .update({
        status: 'error',
        error_message: (error as Error).message,
      })
      .eq('id', statementId);
  }
}

function detectFileType(filename: string): 'pdf' | 'csv' | 'camt' {
  const ext = filename.toLowerCase().split('.').pop();
  if (ext === 'csv') return 'csv';
  if (ext === 'xml' || filename.toLowerCase().includes('camt')) return 'camt';
  return 'pdf';
}

function parseCSV(content: string): Partial<BankTransaction>[] {
  // Parse CSV with different formats (German/International)
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    delimiter: ';', // German CSV uses semicolon
  });

  return records.map((record: any) => ({
    transaction_date: parseDate(record.Buchungstag || record.Date || record.Datum),
    booking_date: parseDate(record.Valutadatum || record['Value Date']),
    amount: parseAmount(record.Betrag || record.Amount || record['Gutschrift in EUR']),
    currency: record.Währung || record.Currency || 'EUR',
    description: record.Verwendungszweck || record.Description || record.Buchungstext,
    counterparty_name: record.Auftraggeber || record.Name || record.Beguenstigter,
    counterparty_iban: record.IBAN || record['Kontonummer'],
    reference: record.Kundenreferenz || record.Reference,
  }));
}

async function parseCAMT(xmlContent: string): Promise<Partial<BankTransaction>[]> {
  const result = await parseStringPromise(xmlContent);
  const entries = result?.Document?.BkToCstmrStmt?.[0]?.Stmt?.[0]?.Ntry || [];

  return entries.map((entry: any) => ({
    transaction_date: entry.ValDt?.[0]?.Dt?.[0],
    booking_date: entry.BookgDt?.[0]?.Dt?.[0],
    amount: parseFloat(entry.Amt?.[0]?._ || 0),
    currency: entry.Amt?.[0]?.$?.Ccy || 'EUR',
    description: entry.AddtlNtryInf?.[0],
    counterparty_name: entry.NtryDtls?.[0]?.TxDtls?.[0]?.RltdPties?.[0]?.Cdtr?.[0]?.Nm?.[0],
    counterparty_iban: entry.NtryDtls?.[0]?.TxDtls?.[0]?.RltdPties?.[0]?.CdtrAcct?.[0]?.Id?.[0]?.IBAN?.[0],
    reference: entry.NtryDtls?.[0]?.TxDtls?.[0]?.Refs?.[0]?.EndToEndId?.[0],
  }));
}

function parseDate(dateStr: string): string | undefined {
  if (!dateStr) return undefined;
  
  // Try DD.MM.YYYY (German)
  const deMatch = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (deMatch) return `${deMatch[3]}-${deMatch[2]}-${deMatch[1]}`;
  
  // Try YYYY-MM-DD (ISO)
  const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return dateStr;
  
  return undefined;
}

function parseAmount(amountStr: string): number {
  if (!amountStr) return 0;
  
  // Handle German format: 1.234,56 -> 1234.56
  // Handle negative: (100,00) or -100,00
  const cleaned = amountStr
    .replace(/\./g, '') // Remove thousand separator
    .replace(/,/g, '.') // Convert decimal comma to dot
    .replace(/[()]/g, '-'); // Convert parentheses to negative
  
  return parseFloat(cleaned) || 0;
}

export default router;
