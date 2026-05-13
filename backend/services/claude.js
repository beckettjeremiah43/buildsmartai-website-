import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase  = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

const MODEL = 'claude-sonnet-4-20250514';

// ── Shared helpers ────────────────────────────────────────────────────────────

async function getScheduleSnapshot(clientId, days = 14) {
  const today  = new Date().toISOString().split('T')[0];
  const future = new Date(Date.now() + days * 86_400_000).toISOString().split('T')[0];

  const [{ data: jobs }, { data: assignments }, { data: subSchedules }] =
    await Promise.all([
      supabase
        .from('jobs')
        .select('id, name, address, status, start_date, end_date, phases')
        .eq('client_id', clientId)
        .eq('status', 'active')
        .lte('start_date', future)
        .gte('end_date',   today),

      supabase
        .from('assignments')
        .select('id, job_id, crew_id, date, start_time, end_time, crew(id, name, skills, status)')
        .eq('client_id', clientId)
        .gte('date', today)
        .lte('date', future),

      supabase
        .from('sub_schedules')
        .select('id, sub_id, job_id, scheduled_date, status, subcontractors(id, company_name, trade, reliability_score)')
        .gte('scheduled_date', today)
        .lte('scheduled_date', future)
        .in('job_id', (jobs || []).map(j => j.id)),
    ]);

  return { jobs: jobs || [], assignments: assignments || [], subSchedules: subSchedules || [] };
}

// ── 1. detectConflicts ────────────────────────────────────────────────────────
//
// Sends the next-14-day schedule snapshot to Claude and returns a structured
// array of conflicts with suggested resolutions.

export async function detectConflicts(clientId, scheduleSnapshot = null) {
  const snapshot = scheduleSnapshot ?? await getScheduleSnapshot(clientId);

  const systemPrompt = `You are a scheduling assistant for a construction company.
Analyze the schedule JSON provided and identify:
  1. Crew double-bookings (same crew member assigned to 2+ jobs on the same day)
  2. Subcontractor timing conflicts (sub scheduled before a prerequisite phase is complete)
  3. Delay cascade risks (jobs running behind that will block downstream work)

For EACH conflict return a JSON object with exactly these keys:
  - conflict_type: "double_booking" | "sub_timing" | "delay_cascade"
  - description: plain-English explanation (1-2 sentences)
  - affected_jobs: array of job UUIDs involved
  - affected_crew: array of crew UUIDs involved (empty array if not applicable)
  - suggestions: array of exactly 3 objects, each with:
      - action: short imperative phrase
      - impact: "high" | "medium" | "low"
      - detail: one sentence explaining the fix

Return ONLY a valid JSON array. No markdown, no extra text.
If there are no conflicts return an empty array [].`;

  const message = await anthropic.messages.create({
    model:      MODEL,
    max_tokens: 2048,
    system:     systemPrompt,
    messages: [
      {
        role:    'user',
        content: `Here is the schedule snapshot for the next 14 days:\n\n${JSON.stringify(snapshot, null, 2)}`,
      },
    ],
  });

  const raw = message.content[0].text.trim();

  let conflicts;
  try {
    conflicts = JSON.parse(raw);
  } catch {
    console.error('Claude returned non-JSON for detectConflicts:', raw);
    conflicts = [];
  }

  // Persist detected conflicts to Supabase
  if (conflicts.length > 0) {
    const rows = conflicts.map(c => ({
      client_id:      clientId,
      conflict_type:  c.conflict_type,
      description:    c.description,
      affected_jobs:  c.affected_jobs  || [],
      affected_crew:  c.affected_crew  || [],
      ai_suggestions: c.suggestions    || [],
      resolved:       false,
    }));

    const { error } = await supabase.from('conflicts').insert(rows);
    if (error) console.error('Failed to persist conflicts:', error.message);
  }

  return conflicts;
}

// ── 2. chat ───────────────────────────────────────────────────────────────────
//
// Client-facing AI assistant.  Loads the client's custom system prompt,
// injects the current schedule snapshot as context, and continues the
// conversation using the provided history.

export async function chat(clientId, userMessage, conversationHistory = []) {
  // Load client system prompt + today's snapshot in parallel
  const [{ data: client }, snapshot] = await Promise.all([
    supabase
      .from('clients')
      .select('company_name, owner_name, ai_system_prompt')
      .eq('id', clientId)
      .single(),
    getScheduleSnapshot(clientId, 7),
  ]);

  const basePrompt = client?.ai_system_prompt ||
    `You are a helpful scheduling assistant for ${client?.company_name || 'a construction company'}.
Help the contractor manage jobs, crew, and subcontractors.
Be concise, proactive about surfacing conflicts, and always suggest actionable next steps.`;

  const systemPrompt = `${basePrompt}

--- CURRENT SCHEDULE CONTEXT (next 7 days) ---
${JSON.stringify(snapshot, null, 2)}
--- END CONTEXT ---

Today's date: ${new Date().toISOString().split('T')[0]}
Contractor: ${client?.owner_name || 'Unknown'}`;

  // Build message array: history + new user turn
  const messages = [
    ...conversationHistory.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];

  const response = await anthropic.messages.create({
    model:      MODEL,
    max_tokens: 1024,
    system:     systemPrompt,
    messages,
  });

  const assistantText = response.content[0].text;

  // Persist both turns to Supabase
  await supabase.from('chat_messages').insert([
    { client_id: clientId, role: 'user',      content: userMessage    },
    { client_id: clientId, role: 'assistant', content: assistantText  },
  ]);

  return assistantText;
}

// ── 3. generateDailySummary ───────────────────────────────────────────────────
//
// Produces a morning briefing suitable for email/SMS delivery.
// Returns { subject, emailBody, smsBody }.

export async function generateDailySummary(clientId) {
  const today    = new Date().toISOString().split('T')[0];
  const snapshot = await getScheduleSnapshot(clientId, 1);

  const [{ data: client }, { data: unresolvedConflicts }] = await Promise.all([
    supabase.from('clients').select('company_name, owner_name').eq('id', clientId).single(),
    supabase.from('conflicts').select('*').eq('client_id', clientId).eq('resolved', false),
  ]);

  const prompt = `You are a scheduling assistant generating a daily morning briefing.

Client: ${client?.owner_name} at ${client?.company_name}
Date: ${today}

Schedule data:
${JSON.stringify(snapshot, null, 2)}

Unresolved conflicts: ${JSON.stringify(unresolvedConflicts || [], null, 2)}

Generate a morning briefing with these sections:
1. TODAY'S JOBS — list each active job, address, assigned crew count
2. CREW STATUS — any crew marked sick or off
3. SUBS ON SITE — any subcontractors scheduled today
4. CONFLICTS TO RESOLVE — brief list of open conflicts (or "None" if clear)
5. TOP PRIORITY — one action item the contractor should handle first

Format for email: use clear headings and bullet points.
Then on a new line write: SMS_SUMMARY: followed by a ≤160-character plain-text summary for SMS.`;

  const message = await anthropic.messages.create({
    model:      MODEL,
    max_tokens: 1024,
    messages:   [{ role: 'user', content: prompt }],
  });

  const full = message.content[0].text;

  // Split email body from SMS summary line
  const smsSplit   = full.split('SMS_SUMMARY:');
  const emailBody  = smsSplit[0].trim();
  const smsBody    = (smsSplit[1] || '').trim().slice(0, 160);
  const subject    = `ScheduleAI Morning Brief — ${today} — ${client?.company_name}`;

  return { subject, emailBody, smsBody };
}

// ── 4. draftDocument ─────────────────────────────────────────────────────────
//
// Drafts a professional construction document from job context.
// docType: 'change_order' | 'client_update' | 'punch_list'

export async function draftDocument(clientId, docType, context = {}) {
  const { data: client } = await supabase
    .from('clients')
    .select('company_name, owner_name')
    .eq('id', clientId)
    .single();

  const templates = {
    change_order:  'a professional Change Order document including description of change, reason, cost impact, and schedule impact',
    client_update: 'a concise client progress update covering work completed, work in progress, upcoming milestones, and any items needing client decision',
    punch_list:    'a detailed Punch List with numbered items grouped by area/trade, each item describing the deficiency and required resolution',
  };

  const docDescription = templates[docType] || 'a professional construction document';

  const prompt = `Draft ${docDescription} for ${client?.company_name}.

Contractor: ${client?.owner_name}
Date: ${new Date().toISOString().split('T')[0]}

Context provided:
${JSON.stringify(context, null, 2)}

Use professional construction industry language. Format clearly with headings and numbered/bulleted lists where appropriate.`;

  const message = await anthropic.messages.create({
    model:      MODEL,
    max_tokens: 2048,
    messages:   [{ role: 'user', content: prompt }],
  });

  return message.content[0].text;
}
