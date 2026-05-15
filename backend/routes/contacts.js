import { supabase }    from '../lib/supabase.js';
import { Router }      from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const ALLOWED = ['name', 'company', 'email', 'phone', 'type', 'notes'];

// GET /api/contacts
router.get('/', async (req, res, next) => {
  try {
    const { type } = req.query;
    let query = supabase
      .from('contacts')
      .select('*')
      .eq('client_id', req.clientId)
      .order('name', { ascending: true });
    if (type) query = query.eq('type', type);
    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (err) { next(err); }
});

// GET /api/contacts/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', req.params.id)
      .eq('client_id', req.clientId)
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Contact not found' });
    res.json(data);
  } catch (err) { next(err); }
});

// POST /api/contacts
router.post('/', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const payload = { client_id: req.clientId };
    for (const key of ALLOWED) {
      if (req.body[key] !== undefined) payload[key] = req.body[key] || null;
    }
    payload.name = name;

    const { data, error } = await supabase.from('contacts').insert(payload).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { next(err); }
});

// PATCH /api/contacts/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const updates = {};
    for (const key of ALLOWED) {
      if (req.body[key] !== undefined) updates[key] = req.body[key] || null;
    }
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'No valid fields' });

    const { data, error } = await supabase
      .from('contacts')
      .update(updates)
      .eq('id', req.params.id)
      .eq('client_id', req.clientId)
      .select()
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Contact not found' });
    res.json(data);
  } catch (err) { next(err); }
});

// DELETE /api/contacts/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', req.params.id)
      .eq('client_id', req.clientId);
    if (error) throw error;
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
