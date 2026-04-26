import { Router } from 'express';
import { createRule, listRules, updateRule } from '../services/rules.service.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const tenantId = (req as any).tenantId as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const rules = await listRules(userId, tenantId);
    res.json({ rules });
  } catch (error) {
    console.error('Rules list error:', error);
    res.status(500).json({ error: 'Failed to list rules' });
  }
});

router.post('/', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const tenantId = (req as any).tenantId as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { category_name, skr04_code } = req.body;
    if (!category_name || !skr04_code) {
      return res.status(400).json({ error: 'category_name and skr04_code required' });
    }

    const rule = await createRule(userId, req.body, tenantId);
    res.status(201).json({ rule });
  } catch (error) {
    console.error('Rules create error:', error);
    res.status(500).json({ error: 'Failed to create rule' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const tenantId = (req as any).tenantId as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const rule = await updateRule(userId, req.params.id, req.body, tenantId);
    res.json({ rule });
  } catch (error) {
    console.error('Rules update error:', error);
    res.status(500).json({ error: 'Failed to update rule' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const tenantId = (req as any).tenantId as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const rule = await updateRule(userId, req.params.id, { active: false }, tenantId);
    res.json({ rule });
  } catch (error) {
    console.error('Rules delete error:', error);
    res.status(500).json({ error: 'Failed to delete rule' });
  }
});

export default router;
