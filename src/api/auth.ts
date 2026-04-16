// ============================================
// AUTH API - Simple API Key (Single User)
// ============================================

import { Router } from 'express';

const router = Router();

// Simple API key - survives server restarts!
const API_KEY = process.env.API_KEY || 'lanista-secret-key-2024';
const USER_ID = '00000000-0000-0000-0000-000000000001';

// ============================================
// GET /api/auth/key (get current API key for frontend)
// ============================================
router.get('/key', (req, res) => {
  // Return the key - only works if they already know it (via env)
  // This is for frontend to get the key after login
  res.json({ key: API_KEY, userId: USER_ID });
});

// ============================================
// Auth Middleware Export
// ============================================
export function authMiddleware(req: any, res: any, next: any) {
  // Skip auth for health
  if (req.path === '/health') {
    return next();
  }

  // Check API key in header
  const apiKey = req.headers['x-api-key'];
  const authHeader = req.headers.authorization;
  
  // Support: x-api-key header OR Authorization: Bearer <key>
  const key = apiKey || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);

  if (key === API_KEY) {
    req.userId = USER_ID;
    return next();
  }

  res.status(401).json({ error: 'Unauthorized - Invalid API key' });
}

export default router;
