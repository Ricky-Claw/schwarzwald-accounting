import { Router } from 'express';
import { acceptInvite, createInvite, ensureDefaultTenant, getTenantContext, listOpenInvites, listTenantMembers, listTenants } from '../services/tenant.service.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    await ensureDefaultTenant();
    const tenants = await listTenants(userId);
    res.json({ tenants });
  } catch (error) {
    console.error('Tenants list error:', error);
    res.status(500).json({ error: 'Failed to list tenants' });
  }
});

router.get('/members', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const tenantId = (req as any).tenantId as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const ctx = await getTenantContext(userId, tenantId);
    const [members, invites] = await Promise.all([
      listTenantMembers(ctx),
      listOpenInvites(ctx),
    ]);

    const frontendUrl = process.env.FRONTEND_URL?.split(',')[0] || 'https://lanista-buchhaltung.vercel.app';
    res.json({
      members,
      invites: invites.map((invite) => ({
        ...invite,
        inviteUrl: `${frontendUrl}/onboarding?invite=${invite.token}`,
      })),
    });
  } catch (error) {
    console.error('Members list error:', error);
    res.status(500).json({ error: (error as Error).message || 'Failed to list members' });
  }
});

router.post('/invites', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const ctx = await getTenantContext(userId, req.body.tenant_id || (req as any).tenantId);
    const invite = await createInvite(ctx, req.body);
    const frontendUrl = process.env.FRONTEND_URL?.split(',')[0] || 'https://lanista-buchhaltung.vercel.app';

    res.status(201).json({
      invite,
      inviteUrl: `${frontendUrl}/onboarding?invite=${invite.token}`,
    });
  } catch (error) {
    console.error('Invite create error:', error);
    res.status(500).json({ error: (error as Error).message || 'Failed to create invite' });
  }
});

router.post('/invites/:token/accept', async (req, res) => {
  try {
    const result = await acceptInvite(req.params.token, req.body);
    res.json(result);
  } catch (error) {
    console.error('Invite accept error:', error);
    res.status(400).json({ error: (error as Error).message || 'Failed to accept invite' });
  }
});

export default router;
