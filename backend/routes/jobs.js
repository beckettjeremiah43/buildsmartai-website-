import { Router }       from 'express';
import { createClient } from '@supabase/supabase-js';
import { requireAuth }  from '../middleware/auth.js';

const router   = Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

// All routes require authentication
router.use(requireAuth);

// ── GET /api/jobs ─────────────────────────────────────────────────────────────
// List jobs for this client. Optional query params: status, from, to
router.get('/', async (req, res, next) => {
  try {
    const { status, from, to } = req.query;

    let query = supabase
      .from('jobs')
      .select('*')
      .eq('client_id', req.clientId)
      .order('start_date', { ascending: true });

    if (status) query = query.eq('status', status);
    if (from)   query = query.gte('start_date', from);
    if (to)     query = query.lte('start_date', to);

    const { data, error } = await query;
    if (error) throw error;

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/jobs/:id ─────────────────────────────────────────────────────────
// Single job with its assignments and sub schedules
router.get('/:id', async (req, res, next) => {
  try {
    const [{ data: job, error: jobErr }, { data: assignments, error: aErr }, { data: subSchedules, error: sErr }] =
      await Promise.all([
        supabase
          .from('jobs')
          .select('*')
          .eq('id', req.params.id)
          .eq('client_id', req.clientId)
          .single(),

        supabase
          .from('assignments')
          .select('*, crew(id, name, skills, status)')
          .eq('job_id', req.params.id)
          .order('date', { ascending: true }),

        supabase
          .from('sub_schedules')
          .select('*, subcontractors(id, company_name, trade, reliability_score)')
          .eq('job_id', req.params.id)
          .order('scheduled_date', { ascending: true }),
      ]);

    if (jobErr) throw jobErr;
    if (!job)   return res.status(404).json({ error: 'Job not found' });
    if (aErr)   throw aErr;
    if (sErr)   throw sErr;

    res.json({ ...job, assignments: assignments || [], subSchedules: subSchedules || [] });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/jobs ────────────────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const { name, address, status, start_date, end_date, phases, notes } = req.body;

    if (!name) return res.status(400).json({ error: 'name is required' });

    const { data, error } = await supabase
      .from('jobs')
      .insert({
        client_id:  req.clientId,
        name,
        address,
        status:     status     || 'active',
        start_date: start_date || null,
        end_date:   end_date   || null,
        phases:     phases     || [],
        notes,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/jobs/:id ───────────────────────────────────────────────────────
router.patch('/:id', async (req, res, next) => {
  try {
    // Only allow updating fields that belong to the client
    const allowed  = ['name', 'address', 'status', 'start_date', 'end_date', 'phases', 'notes'];
    const updates  = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const { data, error } = await supabase
      .from('jobs')
      .update(updates)
      .eq('id', req.params.id)
      .eq('client_id', req.clientId)
      .select()
      .single();

    if (error) throw error;
    if (!data)  return res.status(404).json({ error: 'Job not found' });

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/jobs/:id ──────────────────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('jobs')
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
