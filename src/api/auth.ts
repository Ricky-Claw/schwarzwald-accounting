// ============================================
// AUTH API - Simple API Key (Single User)
// ============================================

import { Router } from 'express';
import { DEFAULT_USER_ID, findUserByApiKey, getTenantContext } from '../services/tenant.service.js';

const router = Router();

// Simple API key - survives server restarts!
const API_KEY = process.env.API_KEY || 'lanista-secret-key-2024';
const USER_ID = DEFAULT_USER_ID;

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
export async function authMiddleware(req: any, res: any, next: any) {
  // Skip auth for health and public invite acceptance
  if (req.path === '/health' || (req.method === 'POST' && /^\/api\/accounting\/tenants\/invites\/[^/]+\/accept$/.test(req.path))) {
    return next();
  }

  // Check API key in header
  const apiKey = req.headers['x-api-key'];
  const authHeader = req.headers.authorization;
  
  // Support: x-api-key header OR Authorization: Bearer <key>
  const key = apiKey || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);

  console.log('Auth check:', { 
    path: req.path, 
    hasKey: !!key, 
    keyValid: key === API_KEY,
    apiKeyHeader: apiKey ? 'present' : 'missing',
    authHeader: authHeader ? 'present' : 'missing',
  });

  if (key === API_KEY) {
    req.userId = USER_ID;
    try {
      const tenantId = req.headers['x-tenant-id'] as string | undefined;
      req.tenantContext = await getTenantContext(USER_ID, tenantId);
      req.tenantId = req.tenantContext.tenantId;
    } catch (error) {
      console.error('Tenant context error:', error);
    }
    return next();
  }

  if (key) {
    const user = await findUserByApiKey(key as string);
    if (user) {
      req.userId = user.id;
      req.accountingUser = user;
      try {
        const tenantId = req.headers['x-tenant-id'] as string | undefined;
        req.tenantContext = await getTenantContext(user.id, tenantId);
        req.tenantId = req.tenantContext.tenantId;
      } catch (error) {
        console.error('Tenant context error:', error);
      }
      return next();
    }
  }

  res.status(401).json({ error: 'Unauthorized - Invalid API key' });
}

export default router;
