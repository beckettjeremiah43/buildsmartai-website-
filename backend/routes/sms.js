import { supabase } from '../lib/supabase.js';
import { Router }       from 'express';
import twilio           from 'twilio';
import { chat }         from '../services/claude.js';
import { runAllChecks } from '../services/conflictDetector.js';

const router   = Router();
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
);

// ── Message type parser ───────────────────────────────────────────────────────
function parseMessageType(body) {
  const t = body.toLowerCase().trim();
  if (/\b(sick|ill|not (coming|in)|can'?t make it|won'?t be (in|there)|feeling (bad|unwell))\b/.test(t))  return 'sick';
  if (/\b(delay|delayed|running late|behind schedule|late|held up)\b/.test(t))                            return 'delay';
  if (/\b(done|finished|complete[d]?|wrapped( up)?|all done|heading out|leaving)\b/.test(t))              return 'done';
  if (/\b(on.?site|arrived|here|checked? in|on my way|omw|heading (over|in|there))\b/.test(t))           return 'on_site';
  return 'question';
}

// ── TwiML helper ──────────────────────────────────────────────────────────────
function twimlReply(message) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message}</Message></Response>`;
}

// ── Notify contractor via SMS ─────────────────────────────────────────────────
async function notifyContractor(client, message) {
  if (!client?.phone) return;
  try {
    await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to:   client.phone,
    });
  } catch (err) {
    console.error('Failed to notify contractor:', err.message);
  }
}

// ── POST /webhook/sms ─────────────────────────────────────────────────────────
// Twilio sends urlencoded POST — body parsed by express.urlencoded in server.js
router.post('/', async (req, res) => {
  const { From: rawFrom, Body: rawBody, MessageSid } = req.body;

  if (!rawFrom || !rawBody) {
    return res.set('Content-Type', 'text/xml').send(twimlReply('Unable to process message.'));
  }

  const from = rawFrom.replace(/\s+/g, '');
  const body = rawBody.trim();
  const type = parseMessageType(body);

  // Log the inbound message immediately (crew_id resolved below)
  const smsLogEntry = { direction: 'inbound', body, processed: false };

  try {
    // ── 1. Identify crew member by phone ──────────────────────────────────────
    const { data: crewRows } = await supabase
      .from('crew')
      .select('id, name, client_id, status')
      .or(`phone.eq.${from},phone.eq.${from.replace('+1', '')}`)
      .limit(1);

    const crewMember = crewRows?.[0];

    if (!crewMember) {
      // Unknown sender — log and ignore
      await supabase.from('sms_log').insert({ ...smsLogEntry });
      return res.set('Content-Type', 'text/xml').send(
        twimlReply("Hi! We don't recognise this number. Contact your contractor to get added."),
      );
    }

    await supabase.from('sms_log').insert({
      ...smsLogEntry,
      client_id: crewMember.client_id,
      crew_id:   crewMember.id,
    });

    // Load client for contractor notifications
    const { data: client } = await supabase
      .from('clients')
      .select('id, company_name, owner_name, phone')
      .eq('id', crewMember.client_id)
      .single();

    // ── 2. Handle by message type ─────────────────────────────────────────────
    let replyText = '';

    if (type === 'sick') {
      await supabase
        .from('crew')
        .update({ status: 'sick' })
        .eq('id', crewMember.id);

      // Find today's assignments for this crew member
      const today = new Date().toISOString().split('T')[0];
      const { data: todayAssignments } = await supabase
        .from('assignments')
        .select('*, jobs(name, address)')
        .eq('crew_id', crewMember.id)
        .eq('date', today);

      replyText = `Got it ${crewMember.name} — marked you out sick today. Feel better soon!`;

      if (todayAssignments?.length > 0) {
        const jobList = todayAssignments.map(a => a.jobs?.name).filter(Boolean).join(', ');
        await notifyContractor(
          client,
          `⚠️ CREW ALERT: ${crewMember.name} called in sick today. Had assignments at: ${jobList}. Reassignment needed.`,
        );
        replyText += ' Your contractor has been notified.';
      }

      // Run conflict pre-check now that schedule changed
      const { data: jobs }        = await supabase.from('jobs').select('*').eq('client_id', crewMember.client_id).eq('status', 'active');
      const { data: assignments } = await supabase.from('assignments').select('*, crew(id, name, skills, status)').eq('client_id', crewMember.client_id).gte('date', today);
      runAllChecks({ jobs: jobs || [], assignments: assignments || [], subSchedules: [] });

    } else if (type === 'on_site') {
      await supabase
        .from('crew')
        .update({ status: 'on_site' })
        .eq('id', crewMember.id);

      replyText = `Thanks ${crewMember.name} — checked you in. Have a productive day!`;

    } else if (type === 'done') {
      await supabase
        .from('crew')
        .update({ status: 'available' })
        .eq('id', crewMember.id);

      replyText = `Nice work ${crewMember.name} — marked you as done for the day.`;

    } else if (type === 'delay') {
      // Extract a number if they mentioned hours/minutes
      const hoursMatch = body.match(/(\d+)\s*hour/i);
      const minsMatch  = body.match(/(\d+)\s*min/i);
      const delayStr   = hoursMatch
        ? `~${hoursMatch[1]}h delay`
        : minsMatch
          ? `~${minsMatch[1]}min delay`
          : 'delay';

      await notifyContractor(
        client,
        `🕐 ${crewMember.name} is reporting a ${delayStr}: "${body}"`,
      );

      replyText = `Noted ${crewMember.name} — your contractor has been notified about the delay.`;

    } else {
      // Unknown / question — route to Claude
      const aiResponse = await chat(
        crewMember.client_id,
        `[Crew member ${crewMember.name} texted]: ${body}`,
        [],
      ).catch(() => "I'll pass your message to your contractor. Stand by.");

      // Trim to SMS-safe length
      replyText = aiResponse.slice(0, 1000);
    }

    // Log the outbound reply
    await supabase.from('sms_log').insert({
      client_id:  crewMember.client_id,
      crew_id:    crewMember.id,
      direction:  'outbound',
      body:       replyText,
      processed:  true,
    });

    // Mark inbound as processed
    await supabase
      .from('sms_log')
      .update({ processed: true })
      .eq('client_id', crewMember.client_id)
      .eq('body', body)
      .eq('direction', 'inbound')
      .eq('processed', false);

    return res.set('Content-Type', 'text/xml').send(twimlReply(replyText));

  } catch (err) {
    console.error('SMS webhook error:', err);
    return res.set('Content-Type', 'text/xml').send(
      twimlReply('Something went wrong processing your message. Please contact your contractor directly.'),
    );
  }
});

export default router;
