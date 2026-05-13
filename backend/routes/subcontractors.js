import { Router }       from 'express';
import { createClient } from '@supabase/supabase-js';
import { requireAuth }  from '../middleware/auth.js';

const router   = Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

router.use(requireAuth);

// ── GET /api/subcontractors ───────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { trade } = req.query;
    let query = supabase
      .from('subcontractors')
      .select('*')
      .eq('client_id', req.clientId)
      .order('company_name', { ascending: true });

    if (trade) query = query.eq('trade', trade);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/subcontractors/:id ───────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const [{ data: sub, error: subErr }, { data: schedules, error: schErr }] =
      await Promise.all([
        supabase
          .from('subcontractors')
          .select('*')
          .eq('id', req.params.id)
          .eq('client_id', req.clientId)
          .single(),

        supabase
          .from('sub_schedules')
          .select('*, jobs(id, name, address)')
          .eq('sub_id', req.params.id)
          .order('scheduled_date', { ascending: false })
          .limit(20),
      ]);

    if (subErr) throw subErr;
    if (!sub)   return res.status(404).json({ error: 'Subcontractor not found' });
    if (schErr) throw schErr;

    res.json({ ...sub, schedules: schedules || [] });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/subcontractors ──────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const { company_name, trade, phone, email, reliability_score } = req.body;
    if (!company_name) return res.status(400).json({ error: 'company_name is required' });

    const { data, error } = await supabase
      .from('subcontractors')
      .insert({
        client_id:         req.clientId,
        company_name,
        trade:             trade             || null,
        phone:             phone             || null,
        email:             email             || null,
        reliability_score: reliability_score ?? 5,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/subcontractors/:id ─────────────────────────────────────────────
router.patch('/:id', async (req, res, next) => {
  try {
    const allowed = ['company_name', 'trade', 'phone', 'email', 'reliability_score'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const { data, error } = await supabase
      .from('subcontractors')
      .update(updates)
      .eq('id', req.params.id)
      .eq('client_id', req.clientId)
      .select()
      .single();

    if (error) throw error;
    if (!data)  return res.status(404).json({ error: 'Subcontractor not found' });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/subcontractors/:id ────────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('subcontractors')
      .delete()
      .eq('id', req.params.id)
      .eq('client_id', req.clientId);

    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Sub schedule routes — nested under /api/subcontractors/:id/schedules
// ═══════════════════════════════════════════════════════════════════════════════

// ── GET /api/subcontractors/:id/schedules ─────────────────────────────────────
router.get('/:id/schedules', async (req, res, next) => {
  try {
    const { from, to, status } = req.query;

    let query = supabase
      .from('sub_schedules')
      .select('*, jobs(id, name, address)')
      .eq('sub_id', req.params.id)
      .order('scheduled_date', { ascending: true });

    if (from)   query = query.gte('scheduled_date', from);
    if (to)     query = query.lte('scheduled_date', to);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/subcontractors/:id/schedules ────────────────────────────────────
router.post('/:id/schedules', async (req, res, next) => {
  try {
    const { job_id, scheduled_date, status, notes } = req.body;
    if (!job_id || !scheduled_date) {
      return res.status(400).json({ error: 'job_id and scheduled_date are required' });
    }

    // Verify job belongs to this client
    const { data: job } = await supabase
      .from('jobs')
      .select('id')
      .eq('id', job_id)
      .eq('client_id', req.clientId)
      .single();

    if (!job) return res.status(404).json({ error: 'Job not found' });

    const { data, error } = await supabase
      .from('sub_schedules')
      .insert({
        sub_id:         req.params.id,
        job_id,
        scheduled_date,
        status:         status || 'confirmed',
        notes:          notes  || null,
      })
      .select('*, jobs(id, name)')
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/subcontractors/schedules/:scheduleId ───────────────────────────
router.patch('/schedules/:scheduleId', async (req, res, next) => {
  try {
    const allowed = ['scheduled_date', 'status', 'notes'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const { data, error } = await supabase
      .from('sub_schedules')
      .update(updates)
      .eq('id', req.params.scheduleId)
      .select()
      .single();

    if (error) throw error;
    if (!data)  return res.status(404).json({ error: 'Schedule not found' });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/subcontractors/schedules/:scheduleId ──────────────────────────
router.delete('/schedules/:scheduleId', async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('sub_schedules')
      .delete()
      .eq('id', req.params.scheduleId);

    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
