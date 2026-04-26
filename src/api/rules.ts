import { Router } from 'express';
import { createRule, listRules, updateRule } from '../services/rules.service.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const rules = await listRules(userId);
    res.json({ rules });
  } catch (error) {
    console.error('Rules list error:', error);
    res.status(500).json({ error: 'Failed to list rules' });
  }
});

router.post('/', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { category_name, skr04_code } = req.body;
    if (!category_name || !skr04_code) {
      return res.status(400).json({ error: 'category_name and skr04_code required' });
    }

    const rule = await createRule(userId, req.body);
    res.status(201).json({ rule });
  } catch (error) {
    console.error('Rules create error:', error);
    res.status(500).json({ error: 'Failed to create rule' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const rule = await updateRule(userId, req.params.id, req.body);
    res.json({ rule });
  } catch (error) {
    console.error('Rules update error:', error);
    res.status(500).json({ error: 'Failed to update rule' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const rule = await updateRule(userId, req.params.id, { active: false });
    res.json({ rule });
  } catch (error) {
    console.error('Rules delete error:', error);
    res.status(500).json({ error: 'Failed to delete rule' });
  }
});

export default router;
