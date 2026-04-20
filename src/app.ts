// ============================================
// SCHWARZWALD ACCOUNTING API
// ============================================

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// Import routes
import statementsRouter from './api/statements.js';
import amazonRouter from './api/amazon.js';
import receiptsRouter from './api/receipts.js';
import exportRouter from './api/export.js';
import authRouter, { authMiddleware } from './api/auth.js';
import migrateRouter from './api/migrate.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================
// MIDDLEWARE
// ============================================

// Security headers
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Body parsing (NICHT für multipart/form-data - das macht multer)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// AUTH MIDDLEWARE
// ============================================
app.use(authMiddleware);

// ============================================
// ROUTES
// ============================================

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'schwarzwald-accounting',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    ocr: {
      kimi: !!process.env.MOONSHOT_API_KEY,
      azure: !!process.env.AZURE_FORM_RECOGNIZER_KEY,
    }
  });
});

// API routes
app.use('/api/auth', authRouter);
app.use('/api/accounting/statements', statementsRouter);
app.use('/api/accounting/amazon', amazonRouter);
app.use('/api/accounting/receipts', receiptsRouter);
app.use('/api/accounting/export', exportRouter);
app.use('/api/migrate', migrateRouter);

// TODO: Add more routes
// app.use('/api/accounting/transactions', transactionsRouter);
// app.use('/api/accounting/invoices', invoicesRouter);

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
  console.log(`🚀 Accounting API running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
