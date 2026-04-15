// ============================================
// AUTH API - Simple Single User
// ============================================

import { Router } from 'express';
import crypto from 'crypto';

const router = Router();

// Single user config (in production: use env vars)
const USERNAME = process.env.APP_USERNAME || 'admin';
const PASSWORD = process.env.APP_PASSWORD || 'lanista2024';
const USER_ID = '00000000-0000-0000-0000-000000000001';

// Simple token storage (in memory - reset on restart)
const validTokens = new Set<string>();

/**
 * Hash password with salt
 */
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

/**
 * Generate random token
 */
function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// ============================================
// POST /api/auth/login
// ============================================
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  if (username !== USERNAME || password !== PASSWORD) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = generateToken();
  validTokens.add(token);

  res.json({
    success: true,
    token,
    userId: USER_ID,
  });
});

// ============================================
// POST /api/auth/logout
// ============================================
router.post('/logout', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    validTokens.delete(token);
  }
  res.json({ success: true });
});

// ============================================
// Auth Middleware Export
// ============================================
export function authMiddleware(req: any, res: any, next: any) {
  // Skip auth for health and login
  if (req.path === '/health' || req.path === '/api/auth/login') {
    return next();
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  const userId = req.headers['x-user-id'];

  // Check token OR x-user-id for backward compatibility
  if (token && validTokens.has(token)) {
    req.userId = USER_ID;
    return next();
  }

  if (userId) {
    req.userId = userId;
    return next();
  }

  res.status(401).json({ error: 'Unauthorized' });
}

export default router;
