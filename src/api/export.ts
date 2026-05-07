// ============================================
// EXPORT API ROUTES
// DATEV/CSV Export fuer Steuerbuero
// ============================================

import { Router } from 'express';
import { generateExport } from '../services/export.service.js';
import JSZip from 'jszip';
import { createClient } from '@supabase/supabase-js';

const router = Router();
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

// ============================================
// POST /api/accounting/export
// Haupt Export Endpoint
// ============================================
router.post('/', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const tenantId = (req as any).tenantId as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const {
      year,
      month,
      format = 'csv',
      includeIncomplete = false,
      comment,
    } = req.body;

    // Validierung
    if (!year || !month) {
      return res.status(400).json({ error: 'year and month required' });
    }

    if (month < 1 || month > 12) {
      return res.status(400).json({ error: 'month must be 1-12' });
    }

    if (!['datev', 'csv'].includes(format)) {
      return res.status(400).json({ error: 'format must be datev or csv' });
    }

    // Generiere Export
    const result = await generateExport(userId, {
      tenantId,
      year: parseInt(year),
      month: parseInt(month),
      format,
      includeIncomplete: Boolean(includeIncomplete),
      comment,
    });

    // Sende als Download
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
    res.setHeader('X-Export-Summary', JSON.stringify({
      total: result.summary.totalTransactions,
      withReceipt: result.summary.withReceipt,
      withoutReceipt: result.summary.withoutReceipt,
      period: result.summary.period,
    }));
    
    res.send(result.content);

  } catch (error) {
    console.error('Export error:', error);
    
    // Spezieller Fehler fuer unvollstaendige Daten
    if ((error as Error).message.includes('fehlende Belege')) {
      return res.status(400).json({
        error: 'INCOMPLETE_DATA',
        message: (error as Error).message,
        missingReceipts: true,
      });
    }
    
    res.status(500).json({ error: 'Export failed' });
  }
});

// ============================================
// POST /api/accounting/export/package
// Steuerberater-Paket: DATEV + CSV + Prüfbericht als ZIP
// ============================================
router.post('/package', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const tenantId = (req as any).tenantId as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { year, month, comment } = req.body;
    if (!year || !month) return res.status(400).json({ error: 'year and month required' });

    const base = { tenantId, year: parseInt(year), month: parseInt(month), includeIncomplete: true, comment };
    const csv = await generateExport(userId, { ...base, format: 'csv' });
    const datev = await generateExport(userId, { ...base, format: 'datev' });

    const s = csv.summary;
    const report = [
      'Lanista Buchhaltung - Steuerberater-Prüfbericht',
      `Zeitraum: ${s.period}`,
      `Erstellt: ${new Date().toLocaleString('de-DE')}`,
      '',
      'Status:',
      s.withoutReceipt === 0 ? '✅ Beleglage vollständig' : `⚠️ ${s.withoutReceipt} fehlende Belege`,
      '',
      'Zusammenfassung:',
      `Buchungen gesamt: ${s.totalTransactions}`,
      `Mit Beleg: ${s.withReceipt}`,
      `Ohne Beleg: ${s.withoutReceipt}`,
      `Einnahmen: ${s.totalIncome.toFixed(2)} EUR`,
      `Ausgaben: ${s.totalExpense.toFixed(2)} EUR`,
      `Saldo: ${(s.totalIncome - s.totalExpense).toFixed(2)} EUR`,
      '',
      'Kommentar:',
      comment || '-',
      '',
      'Fehlende Belege:',
      ...(s.missingReceipts.length
        ? s.missingReceipts.map(m => `- ${m.date} | ${m.amount.toFixed(2)} EUR | ${m.description}${m.comment ? ` | ${m.comment}` : ''}`)
        : ['- keine']),
      '',
      'Hinweis: OCR/Kategorie-Vorschläge fachlich prüfen, besonders Bewirtung, Arbeitskleidung und gemischte Warenkörbe.',
    ].join('\n');

    const zip = new JSZip();
    zip.file(csv.fileName, csv.content);
    zip.file(datev.fileName, datev.content);
    zip.file(`Lanista_Pruefbericht_${year}_${String(month).padStart(2, '0')}.txt`, report);

    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    const fileName = `Lanista_Steuerberaterpaket_${year}_${String(month).padStart(2, '0')}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  } catch (error) {
    console.error('Package export error:', error);
    res.status(500).json({ error: 'Package export failed' });
  }
});

// ============================================
// POST /api/accounting/export/preview
// Zeigt Vorschau was exportiert wird
// ============================================
router.post('/preview', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const tenantId = (req as any).tenantId as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { year, month } = req.body;

    if (!year || !month) {
      return res.status(400).json({ error: 'year and month required' });
    }

    // Generiere CSV fuer Vorschau (nicht download)
    const result = await generateExport(userId, {
      tenantId,
      year: parseInt(year),
      month: parseInt(month),
      format: 'csv',
      includeIncomplete: true, // Immer anzeigen
    });

    // Sende nur Summary zurueck
    res.json({
      preview: true,
      fileName: result.fileName,
      summary: result.summary,
      canExport: result.summary.withoutReceipt === 0,
      warnings: result.summary.withoutReceipt > 0 
        ? [`${result.summary.withoutReceipt} fehlende Belege`] 
        : [],
      sample: result.content.split('\n').slice(0, 10).join('\n'), // Erste 10 Zeilen
    });

  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({ error: 'Preview failed' });
  }
});

// ============================================
// GET /api/accounting/export/status/:year/:month
// Zeigt Export-Status fuer einen Monat
// ============================================
router.get('/status/:year/:month', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const tenantId = (req as any).tenantId as string | undefined;
    const year = parseInt(req.params.year);
    const month = parseInt(req.params.month);

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Generiere kurze Vorschau
    const result = await generateExport(userId, {
      tenantId,
      year,
      month,
      format: 'csv',
      includeIncomplete: true,
    });

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    let receiptsQuery = supabase
      .from('receipts')
      .select('id, merchant_name, receipt_date, total_amount, vat_amount, skr04_code, invoice_number, ocr_status, ocr_raw')
      .gte('receipt_date', startDate)
      .lte('receipt_date', endDate);
    receiptsQuery = tenantId ? receiptsQuery.eq('tenant_id', tenantId) : receiptsQuery.eq('user_id', userId);
    const { data: receipts } = await receiptsQuery;

    const reviewReceipts = (receipts || []).filter((receipt: any) => {
      const decision = receipt.ocr_raw?.category_decision;
      return receipt.ocr_status !== 'success'
        || !receipt.receipt_date
        || !receipt.total_amount
        || !receipt.skr04_code
        || !receipt.invoice_number
        || decision?.needsReview;
    });

    let status = 'complete';
    if (result.summary.withoutReceipt > 0) {
      status = 'incomplete';
    }
    if (result.summary.totalTransactions === 0) {
      status = 'empty';
    }

    res.json({
      year,
      month,
      status,
      summary: result.summary,
      readyForExport: true, // Immer moeglich mit includeIncomplete
      readyForTaxOffice: result.summary.withoutReceipt === 0 && reviewReceipts.length === 0,
      review: {
        count: reviewReceipts.length,
        receipts: reviewReceipts.slice(0, 25).map((receipt: any) => ({
          id: receipt.id,
          merchant_name: receipt.merchant_name,
          receipt_date: receipt.receipt_date,
          total_amount: receipt.total_amount,
          skr04_code: receipt.skr04_code,
          reasons: [
            receipt.ocr_status !== 'success' ? 'OCR prüfen' : null,
            !receipt.receipt_date ? 'Datum fehlt' : null,
            !receipt.total_amount ? 'Betrag fehlt' : null,
            !receipt.skr04_code ? 'SKR04 fehlt' : null,
            !receipt.invoice_number ? 'Rechnungsnummer fehlt' : null,
            receipt.ocr_raw?.category_decision?.needsReview ? (receipt.ocr_raw.category_decision.reviewReason || 'Kategorie prüfen') : null,
          ].filter(Boolean),
        })),
      },
      checklist: [
        { key: 'transactions', label: 'Bankbuchungen vorhanden', ok: result.summary.totalTransactions > 0 },
        { key: 'receipts', label: 'Alle Ausgaben haben Beleg', ok: result.summary.withoutReceipt === 0 },
        { key: 'review', label: 'Keine offenen OCR/Kategorie-Prüfungen', ok: reviewReceipts.length === 0 },
        { key: 'export', label: 'DATEV/CSV Export möglich', ok: true },
      ],
    });

  } catch (error) {
    console.error('Status error:', error);
    res.status(500).json({ error: 'Status check failed' });
  }
});

export default router;
