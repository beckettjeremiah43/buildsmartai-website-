import { supabase } from '../lib/supabase.js';
import cron          from 'node-cron';
import twilio           from 'twilio';
import { generateDailySummary } from './claude.js';
import { detectConflicts }      from './claude.js';
import { runAllChecks }         from './conflictDetector.js';
import { sendDailySummaryEmail } from '../routes/email.js';


let _twilioClient = null;
function getTwilio() {
  if (!_twilioClient) {
    _twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return _twilioClient;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getActiveClients() {
  const { data, error } = await supabase
    .from('clients')
    .select('id, email, phone, company_name, owner_name')
    .in('subscription_status', ['active', 'trial']);

  if (error) throw error;
  return data ?? [];
}

async function getScheduleSnapshot(clientId) {
  const today = new Date().toISOString().split('T')[0];
  const end   = new Date(Date.now() + 14 * 86_400_000).toISOString().split('T')[0];

  const [{ data: jobs }, { data: assignments }, { data: subSchedules }] =
    await Promise.all([
      supabase.from('jobs').select('id, name, status, start_date, end_date, phases').eq('client_id', clientId).eq('status', 'active').lte('start_date', end).gte('end_date', today),
      supabase.from('assignments').select('*, crew(id, name, skills, status)').eq('client_id', clientId).gte('date', today).lte('date', end),
      supabase.from('sub_schedules').select('*, subcontractors(id, company_name, trade)').gte('scheduled_date', today).lte('scheduled_date', end),
    ]);

  return { jobs: jobs ?? [], assignments: assignments ?? [], subSchedules: subSchedules ?? [] };
}

async function sendSms(to, body) {
  if (!to || !process.env.TWILIO_PHONE_NUMBER) return;
  try {
    await getTwilio().messages.create({
      body,
      from: process.env.TWILIO_PHONE_NUMBER,
      to,
    });
  } catch (err) {
    console.error(`SMS send failed to ${to}:`, err.message);
  }
}

// ── Per-client morning routine ────────────────────────────────────────────────

async function runMorningRoutineForClient(client) {
  console.log(`[scheduler] Processing client: ${client.company_name} (${client.id})`);

  try {
    // 1. Get snapshot and run cheap pre-check first
    const snapshot       = await getScheduleSnapshot(client.id);
    const preCheckIssues = runAllChecks(snapshot);

    // 2. Run full AI conflict detection (Claude) — persists results to conflicts table
    const aiConflicts = await detectConflicts(client.id, snapshot);
    const allConflicts = [...preCheckIssues, ...aiConflicts];

    // 3. Generate daily summary email
    const { subject, emailBody, smsBody } = await generateDailySummary(client.id);

    // 4. Send email via Resend
    await sendDailySummaryEmail(client.id);
    console.log(`[scheduler] Email sent to ${client.email}`);

    // 5. If critical conflicts exist, also send SMS to contractor
    const criticalConflicts = allConflicts.filter(c =>
      c.conflict_type === 'double_booking' ||
      (c.suggestions ?? c.ai_suggestions ?? []).some(s => s.impact === 'high'),
    );

    if (criticalConflicts.length > 0 && client.phone) {
      const conflictSummary = `⚠️ ScheduleAI: ${criticalConflicts.length} critical conflict(s) need attention today. ${smsBody}`;
      await sendSms(client.phone, conflictSummary.slice(0, 1600));
      console.log(`[scheduler] Critical conflict SMS sent to ${client.phone}`);
    } else if (smsBody && client.phone) {
      // Send the regular morning SMS brief
      await sendSms(client.phone, `📋 ScheduleAI Morning Brief: ${smsBody}`);
    }

  } catch (err) {
    // Log error per-client but don't let one failure stop others
    console.error(`[scheduler] Error for client ${client.company_name}:`, err.message);
  }
}

// ── Main scheduler ────────────────────────────────────────────────────────────

export function startScheduler() {
  // Daily morning brief — 6:30 AM every day
  cron.schedule('30 6 * * *', async () => {
    console.log('[scheduler] Starting daily morning routine:', new Date().toISOString());

    let clients;
    try {
      clients = await getActiveClients();
    } catch (err) {
      console.error('[scheduler] Failed to fetch clients:', err.message);
      return;
    }

    console.log(`[scheduler] Processing ${clients.length} active client(s)`);

    // Process clients sequentially to avoid hammering the Claude API
    for (const client of clients) {
      await runMorningRoutineForClient(client);
      // Small delay between clients to avoid rate limits
      await new Promise(r => setTimeout(r, 2000));
    }

    console.log('[scheduler] Daily morning routine complete');
  }, {
    timezone: 'America/New_York', // adjust as needed or make configurable
  });

  // Conflict scan — every weekday at noon (lightweight pre-check only, no Claude)
  cron.schedule('0 12 * * 1-5', async () => {
    console.log('[scheduler] Running midday conflict pre-check:', new Date().toISOString());

    let clients;
    try {
      clients = await getActiveClients();
    } catch (err) {
      console.error('[scheduler] Midday check: failed to fetch clients:', err.message);
      return;
    }

    for (const client of clients) {
      try {
        const snapshot = await getScheduleSnapshot(client.id);
        const issues   = runAllChecks(snapshot);

        if (issues.length > 0) {
          // Persist new pre-check conflicts (avoid duplicates by checking description)
          const { data: existing } = await supabase
            .from('conflicts')
            .select('description')
            .eq('client_id', client.id)
            .eq('resolved', false);

          const existingDescriptions = new Set((existing ?? []).map(c => c.description));

          const newIssues = issues.filter(i => !existingDescriptions.has(i.description));
          if (newIssues.length > 0) {
            await supabase.from('conflicts').insert(
              newIssues.map(i => ({
                client_id:      client.id,
                conflict_type:  i.conflict_type,
                description:    i.description,
                affected_jobs:  i.affected_jobs  ?? [],
                affected_crew:  i.affected_crew  ?? [],
                ai_suggestions: i.suggestions    ?? [],
                resolved:       false,
              })),
            );
            console.log(`[scheduler] Persisted ${newIssues.length} new conflict(s) for ${client.company_name}`);
          }
        }
      } catch (err) {
        console.error(`[scheduler] Midday check error for ${client.company_name}:`, err.message);
      }
    }
  }, {
    timezone: 'America/New_York',
  });

  console.log('[scheduler] Cron jobs registered: daily brief at 6:30 AM, conflict scan at 12:00 PM (ET)');
}
