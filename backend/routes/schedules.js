import { supabase } from '../lib/supabase.js';
import { Router }           from 'express';
import { createClient }     from '@supabase/supabase-js';
import { requireAuth }      from '../middleware/auth.js';
import { aiLimiter }        from '../middleware/rateLimit.js';
import { runAllChecks }     from '../services/conflictDetector.js';
import { detectConflicts }  from '../services/claude.js';

const router   = Router();

router.use(requireAuth);

// ── GET /api/schedules/snapshot ───────────────────────────────────────────────
// Returns the full 14-day schedule snapshot used by the dashboard and Claude.
// Registered before /:id so "snapshot" isn't treated as an ID.
router.get('/snapshot', async (req, res, next) => {
  try {
    const days  = parseInt(req.query.days || '14', 10);
    const today = new Date().toISOString().split('T')[0];
    const end   = new Date(Date.now() + days * 86_400_000).toISOString().split('T')[0];

    const { data: jobs } = await supabase
      .from('jobs')
      .select('*')
      .eq('client_id', req.clientId)
      .eq('status', 'active')
      .lte('start_date', end)
      .gte('end_date',   today);

    const jobIds = (jobs || []).map(j => j.id);

    const [{ data: assignments }, { data: subSchedules }] = await Promise.all([
      supabase
        .from('assignments')
        .select('*, crew(id, name, skills, status)')
        .eq('client_id', req.clientId)
        .gte('date', today)
        .lte('date', end),

      jobIds.length > 0
        ? supabase
            .from('sub_schedules')
            .select('*, subcontractors(id, company_name, trade, reliability_score)')
            .in('job_id', jobIds)
            .gte('scheduled_date', today)
            .lte('scheduled_date', end)
        : Promise.resolve({ data: [] }),
    ]);

    res.json({ jobs: jobs || [], assignments: assignments || [], subSchedules: subSchedules || [] });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/schedules ────────────────────────────────────────────────────────
// List assignments with optional date-range filters.
router.get('/', async (req, res, next) => {
  try {
    const { from, to, crew_id, job_id } = req.query;

    let query = supabase
      .from('assignments')
      .select('*, crew(id, name, skills, status), jobs(id, name, address, status)')
      .eq('client_id', req.clientId)
      .order('date',       { ascending: true })
      .order('start_time', { ascending: true });

    if (from)    query = query.gte('date', from);
    if (to)      query = query.lte('date', to);
    if (crew_id) query = query.eq('crew_id', crew_id);
    if (job_id)  query = query.eq('job_id', job_id);

    const { data, error } = await query;
    if (error) throw error;

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/schedules ───────────────────────────────────────────────────────
// Create assignment(s). Runs fast pre-check; returns conflicts if found.
router.post('/', async (req, res, next) => {
  try {
    const { job_id, crew_id, date, start_time, end_time, notes } = req.body;

    if (!job_id || !crew_id || !date) {
      return res.status(400).json({ error: 'job_id, crew_id, and date are required' });
    }

    // Verify both job and crew belong to this client
    const [{ data: job }, { data: crewMember }] = await Promise.all([
      supabase.from('jobs').select('id').eq('id', job_id).eq('client_id', req.clientId).single(),
      supabase.from('crew').select('id').eq('id', crew_id).eq('client_id', req.clientId).single(),
    ]);

    if (!job)        return res.status(404).json({ error: 'Job not found' });
    if (!crewMember) return res.status(404).json({ error: 'Crew member not found' });

    const { data: assignment, error: insertErr } = await supabase
      .from('assignments')
      .insert({ client_id: req.clientId, job_id, crew_id, date, start_time, end_time, notes })
      .select('*, crew(id, name, skills, status), jobs(id, name, address)')
      .single();

    if (insertErr) throw insertErr;

    // Run fast pre-check synchronously so the response includes any instant conflicts
    const snapshot         = await getSnapshot(req.clientId);
    const preCheckConflicts = runAllChecks(snapshot);

    res.status(201).json({ assignment, conflicts: preCheckConflicts });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/schedules/:id ──────────────────────────────────────────────────
router.patch('/:id', async (req, res, next) => {
  try {
    const allowed = ['date', 'start_time', 'end_time', 'notes', 'crew_id', 'job_id'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const { data, error } = await supabase
      .from('assignments')
      .update(updates)
      .eq('id', req.params.id)
      .eq('client_id', req.clientId)
      .select('*, crew(id, name), jobs(id, name)')
      .single();

    if (error) throw error;
    if (!data)  return res.status(404).json({ error: 'Assignment not found' });

    // Re-run pre-check after change
    const snapshot          = await getSnapshot(req.clientId);
    const preCheckConflicts = runAllChecks(snapshot);

    res.json({ assignment: data, conflicts: preCheckConflicts });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/schedules/:id ─────────────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('assignments')
      .delete()
      .eq('id', req.params.id)
      .eq('client_id', req.clientId);

    if (error) throw error;

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ── POST /api/schedules/run-conflict-check ────────────────────────────────────
// Triggers a full AI-powered conflict analysis. Rate-limited separately.
router.post('/run-conflict-check', aiLimiter, async (req, res, next) => {
  try {
    const conflicts = await detectConflicts(req.clientId);
    res.json({ conflicts, count: conflicts.length });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/schedules/conflicts ──────────────────────────────────────────────
// Fetches persisted unresolved conflicts from DB (no new Claude call).
router.get('/conflicts', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('conflicts')
      .select('*')
      .eq('client_id', req.clientId)
      .eq('resolved', false)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/schedules/conflicts/:id/resolve ────────────────────────────────
router.patch('/conflicts/:id/resolve', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('conflicts')
      .update({ resolved: true })
      .eq('id', req.params.id)
      .eq('client_id', req.clientId)
      .select()
      .single();

    if (error) throw error;
    if (!data)  return res.status(404).json({ error: 'Conflict not found' });

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ── Shared helper ─────────────────────────────────────────────────────────────
async function getSnapshot(clientId, days = 14) {
  const today = new Date().toISOString().split('T')[0];
  const end   = new Date(Date.now() + days * 86_400_000).toISOString().split('T')[0];

  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, name, status, start_date, end_date, phases')
    .eq('client_id', clientId)
    .eq('status', 'active')
    .lte('start_date', end)
    .gte('end_date',   today);

  const jobIds = (jobs || []).map(j => j.id);

  const [{ data: assignments }, { data: subSchedules }] = await Promise.all([
    supabase
      .from('assignments')
      .select('*, crew(id, name, skills, status)')
      .eq('client_id', clientId)
      .gte('date', today)
      .lte('date', end),

    jobIds.length > 0
      ? supabase
          .from('sub_schedules')
          .select('*, subcontractors(id, company_name, trade)')
          .in('job_id', jobIds)
          .gte('scheduled_date', today)
          .lte('scheduled_date', end)
      : Promise.resolve({ data: [] }),
  ]);

  return { jobs: jobs || [], assignments: assignments || [], subSchedules: subSchedules || [] };
}

export default router;
