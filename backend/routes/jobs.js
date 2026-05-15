import { supabase } from '../lib/supabase.js';
import { Router }       from 'express';
import { requireAuth }  from '../middleware/auth.js';

const router   = Router();

// All routes require authentication
router.use(requireAuth);

// ── GET /api/jobs/pnl ────────────────────────────────────────────────────────
// Monthly P&L summary for the last N months (default 6).
// Groups by the month of end_date (when job revenue is recognised).
router.get('/pnl', async (req, res, next) => {
  try {
    const months = Math.min(parseInt(req.query.months || '6', 10), 24);

    // Fetch all jobs that have at least one financial field set
    const { data: jobRows, error } = await supabase
      .from('jobs')
      .select('end_date, contract_value, cost')
      .eq('client_id', req.clientId)
      .not('end_date', 'is', null);

    if (error) throw error;

    // Build a map of the last `months` month-keys
    const result = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      result.push({
        month:   d.toISOString().slice(0, 7), // "YYYY-MM"
        revenue: 0,
        cost:    0,
      });
    }

    for (const job of jobRows || []) {
      const monthKey = job.end_date?.slice(0, 7);
      const bucket   = result.find(r => r.month === monthKey);
      if (!bucket) continue;
      bucket.revenue += Number(job.contract_value) || 0;
      bucket.cost    += Number(job.cost)           || 0;
    }

    res.json(result.map(r => ({
      ...r,
      profit: r.revenue - r.cost,
    })));
  } catch (err) {
    next(err);
  }
});

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
    const { name, address, status, start_date, end_date, phases, notes, contract_value, cost } = req.body;

    if (!name) return res.status(400).json({ error: 'name is required' });

    const { data, error } = await supabase
      .from('jobs')
      .insert({
        client_id:      req.clientId,
        name,
        address,
        status:         status     || 'active',
        start_date:     start_date || null,
        end_date:       end_date   || null,
        phases:         phases     || [],
        notes,
        contract_value: contract_value != null ? Number(contract_value) : null,
        cost:           cost           != null ? Number(cost)           : null,
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
    const allowed  = ['name', 'address', 'status', 'start_date', 'end_date', 'phases', 'notes', 'contract_value', 'cost'];
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
