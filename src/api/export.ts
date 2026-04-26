// ============================================
// EXPORT API ROUTES
// DATEV/CSV Export fuer Steuerbuero
// ============================================

import { Router } from 'express';
import { generateExport } from '../services/export.service.js';

const router = Router();

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
      readyForTaxOffice: result.summary.withoutReceipt === 0,
    });

  } catch (error) {
    console.error('Status error:', error);
    res.status(500).json({ error: 'Status check failed' });
  }
});

export default router;
