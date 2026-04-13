// ============================================
// SCHWARZWALD ACCOUNTING API
// ============================================

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// Import routes
import statementsRouter from './api/statements.js';
import amazonRouter from './api/amazon.js';
import receiptsRouter from './api/receipts.js';

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

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ============================================
// AUTH MIDDLEWARE
// ============================================
app.use((req, res, next) => {
  // In production, verify JWT from Supabase Auth
  // For now, x-user-id header from frontend
  const userId = req.headers['x-user-id'];
  
  if (!userId && req.path !== '/health') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
});

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
  });
});

// API routes
app.use('/api/accounting/statements', statementsRouter);
app.use('/api/accounting/amazon', amazonRouter);
app.use('/api/accounting/receipts', receiptsRouter);

// TODO: Add more routes
// app.use('/api/accounting/transactions', transactionsRouter);
// app.use('/api/accounting/invoices', invoicesRouter);
// app.use('/api/accounting/export', exportRouter);

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
