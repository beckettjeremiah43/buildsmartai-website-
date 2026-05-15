import { supabase }    from '../lib/supabase.js';
import { Router }      from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const ALLOWED = ['title', 'job_id', 'contact_id', 'value', 'status', 'start_date', 'end_date', 'signed_at', 'notes'];

// GET /api/contracts
router.get('/', async (req, res, next) => {
  try {
    const { status } = req.query;
    let query = supabase
      .from('contracts')
      .select('*, jobs(id,name), contacts(id,name,company)')
      .eq('client_id', req.clientId)
      .order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (err) { next(err); }
});

// GET /api/contracts/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('contracts')
      .select('*, jobs(id,name), contacts(id,name,company)')
      .eq('id', req.params.id)
      .eq('client_id', req.clientId)
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Contract not found' });
    res.json(data);
  } catch (err) { next(err); }
});

// POST /api/contracts
router.post('/', async (req, res, next) => {
  try {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    const payload = { client_id: req.clientId };
    for (const key of ALLOWED) {
      if (req.body[key] !== undefined) {
        const val = req.body[key];
        payload[key] = (val === '' || val === null) ? null : val;
      }
    }
    payload.title = title;
    if (payload.value !== undefined && payload.value !== null) payload.value = Number(payload.value);

    const { data, error } = await supabase
      .from('contracts')
      .insert(payload)
      .select('*, jobs(id,name), contacts(id,name,company)')
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { next(err); }
});

// PATCH /api/contracts/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const updates = {};
    for (const key of ALLOWED) {
      if (req.body[key] !== undefined) {
        const val = req.body[key];
        updates[key] = (val === '' || val === null) ? null : val;
      }
    }
    if (updates.value !== undefined && updates.value !== null) updates.value = Number(updates.value);
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'No valid fields' });

    const { data, error } = await supabase
      .from('contracts')
      .update(updates)
      .eq('id', req.params.id)
      .eq('client_id', req.clientId)
      .select('*, jobs(id,name), contacts(id,name,company)')
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Contract not found' });
    res.json(data);
  } catch (err) { next(err); }
});

// DELETE /api/contracts/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('contracts')
      .delete()
      .eq('id', req.params.id)
      .eq('client_id', req.clientId);
    if (error) throw error;
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
