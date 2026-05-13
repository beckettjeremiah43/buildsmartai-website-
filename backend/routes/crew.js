import { Router }       from 'express';
import { createClient } from '@supabase/supabase-js';
import { requireAuth }  from '../middleware/auth.js';

const router   = Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

router.use(requireAuth);

// ── GET /api/crew ─────────────────────────────────────────────────────────────
// List all crew for this client. Optional ?status= filter.
router.get('/', async (req, res, next) => {
  try {
    let query = supabase
      .from('crew')
      .select('*')
      .eq('client_id', req.clientId)
      .order('name', { ascending: true });

    if (req.query.status) query = query.eq('status', req.query.status);

    const { data, error } = await query;
    if (error) throw error;

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/crew/:id ─────────────────────────────────────────────────────────
// Single crew member with their upcoming assignments
router.get('/:id', async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [{ data: member, error: mErr }, { data: assignments, error: aErr }] =
      await Promise.all([
        supabase
          .from('crew')
          .select('*')
          .eq('id', req.params.id)
          .eq('client_id', req.clientId)
          .single(),

        supabase
          .from('assignments')
          .select('*, jobs(id, name, address, status)')
          .eq('crew_id', req.params.id)
          .gte('date', today)
          .order('date', { ascending: true })
          .limit(30),
      ]);

    if (mErr) throw mErr;
    if (!member) return res.status(404).json({ error: 'Crew member not found' });
    if (aErr)  throw aErr;

    res.json({ ...member, upcomingAssignments: assignments || [] });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/crew ────────────────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const { name, phone, skills, status } = req.body;

    if (!name) return res.status(400).json({ error: 'name is required' });

    const { data, error } = await supabase
      .from('crew')
      .insert({
        client_id: req.clientId,
        name,
        phone:  phone  || null,
        skills: Array.isArray(skills) ? skills : [],
        status: status || 'available',
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/crew/:id ───────────────────────────────────────────────────────
router.patch('/:id', async (req, res, next) => {
  try {
    const allowed = ['name', 'phone', 'skills', 'status'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const { data, error } = await supabase
      .from('crew')
      .update(updates)
      .eq('id', req.params.id)
      .eq('client_id', req.clientId)
      .select()
      .single();

    if (error) throw error;
    if (!data)  return res.status(404).json({ error: 'Crew member not found' });

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/crew/:id/status ────────────────────────────────────────────────
// Quick status-only update — used by the SMS webhook when crew texts in.
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    const valid = ['available', 'on_site', 'sick', 'off'];

    if (!valid.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${valid.join(', ')}` });
    }

    const { data, error } = await supabase
      .from('crew')
      .update({ status })
      .eq('id', req.params.id)
      .eq('client_id', req.clientId)
      .select('id, name, status')
      .single();

    if (error) throw error;
    if (!data)  return res.status(404).json({ error: 'Crew member not found' });

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/crew/:id ──────────────────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('crew')
      .delete()
      .eq('id', req.params.id)
      .eq('client_id', req.clientId);

    if (error) throw error;

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
