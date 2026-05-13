import { supabase } from '../lib/supabase.js';
import { Router }            from 'express';
import { Resend }            from 'resend';
import { requireAuth }       from '../middleware/auth.js';
import { generateDailySummary } from '../services/claude.js';

const router   = Router();
const resend   = new Resend(process.env.RESEND_API_KEY);

const FROM_ADDRESS = process.env.EMAIL_FROM || 'ScheduleAI <noreply@scheduleai.co>';

// ── Markdown → HTML ───────────────────────────────────────────────────────────

function formatInline(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');
}

function markdownToHtml(text) {
  const lines = text.split('\n');
  let html     = '';
  let listType = '';

  const closeList = () => {
    if (listType) { html += `</${listType}>\n`; listType = ''; }
  };

  for (const raw of lines) {
    const line = raw.trim();

    if (!line) {
      closeList();
      continue;
    }

    if (/^#{1,3}\s/.test(line)) {
      closeList();
      const level   = Math.min(line.match(/^(#+)/)[1].length + 1, 4);
      const content = line.replace(/^#+\s/, '');
      const styles  = level === 2
        ? 'color:#1f2937;font-size:16px;font-weight:700;margin:20px 0 8px;border-bottom:1px solid #e5e7eb;padding-bottom:6px;'
        : 'color:#374151;font-size:14px;font-weight:600;margin:12px 0 4px;';
      html += `<h${level} style="${styles}">${formatInline(content)}</h${level}>\n`;
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      if (listType !== 'ol') { closeList(); html += '<ol style="padding-left:20px;margin:8px 0;">'; listType = 'ol'; }
      html += `<li style="margin:4px 0;color:#374151;">${formatInline(line.replace(/^\d+\.\s/, ''))}</li>\n`;
      continue;
    }

    if (/^[-•*]\s/.test(line)) {
      if (listType !== 'ul') { closeList(); html += '<ul style="padding-left:20px;margin:8px 0;">'; listType = 'ul'; }
      html += `<li style="margin:4px 0;color:#374151;">${formatInline(line.replace(/^[-•*]\s/, ''))}</li>\n`;
      continue;
    }

    closeList();
    html += `<p style="margin:6px 0;color:#374151;font-size:14px;line-height:1.6;">${formatInline(line)}</p>\n`;
  }

  closeList();
  return html;
}

// ── HTML email wrapper ────────────────────────────────────────────────────────

function emailTemplate({ subject, bodyHtml, companyName, footerNote = '' }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
    <div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.07);">

      <!-- Header -->
      <div style="background:#ea580c;padding:20px 24px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:24px;">🏗️</span>
          <div>
            <h1 style="color:#fff;margin:0;font-size:18px;font-weight:700;letter-spacing:-0.3px;">ScheduleAI</h1>
            ${companyName ? `<p style="color:#fed7aa;margin:2px 0 0;font-size:12px;">${companyName}</p>` : ''}
          </div>
        </div>
      </div>

      <!-- Subject line -->
      <div style="padding:16px 24px 0;">
        <h2 style="margin:0;font-size:16px;font-weight:600;color:#111827;">${subject}</h2>
        <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;">${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      <!-- Body -->
      <div style="padding:16px 24px 24px;">
        ${bodyHtml}
      </div>

      <!-- Footer -->
      <div style="padding:14px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;">
        <p style="color:#9ca3af;font-size:11px;margin:0;text-align:center;">
          ${footerNote || 'Sent automatically by ScheduleAI · Reply to this email or use your dashboard to respond.'}
        </p>
      </div>

    </div>
  </div>
</body>
</html>`;
}

// ── Shared send helper ────────────────────────────────────────────────────────

export async function sendEmail({ to, subject, bodyMarkdown, bodyHtml, companyName }) {
  const html = emailTemplate({
    subject,
    bodyHtml: bodyHtml ?? markdownToHtml(bodyMarkdown ?? ''),
    companyName,
  });

  const { data, error } = await resend.emails.send({
    from:    FROM_ADDRESS,
    to:      Array.isArray(to) ? to : [to],
    subject,
    html,
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
  return data;
}

// ── Named send helper used by the scheduler ───────────────────────────────────

export async function sendDailySummaryEmail(clientId) {
  const [{ subject, emailBody }, { data: client }] = await Promise.all([
    generateDailySummary(clientId),
    supabase.from('clients').select('email, company_name, owner_name').eq('id', clientId).single(),
  ]);

  await sendEmail({
    to:           client.email,
    subject,
    bodyMarkdown: emailBody,
    companyName:  client.company_name,
  });
}

// ── POST /api/email/daily-summary ─────────────────────────────────────────────
router.post('/daily-summary', requireAuth, async (req, res, next) => {
  try {
    await sendDailySummaryEmail(req.clientId);
    res.json({ ok: true, message: 'Daily summary sent to your email' });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/email/conflict-alert ────────────────────────────────────────────
router.post('/conflict-alert', requireAuth, async (req, res, next) => {
  try {
    const { conflict_id } = req.body;
    if (!conflict_id) return res.status(400).json({ error: 'conflict_id is required' });

    const [{ data: conflict }, { data: client }] = await Promise.all([
      supabase.from('conflicts').select('*').eq('id', conflict_id).eq('client_id', req.clientId).single(),
      supabase.from('clients').select('email, company_name').eq('id', req.clientId).single(),
    ]);

    if (!conflict) return res.status(404).json({ error: 'Conflict not found' });

    const subject = `⚠️ Schedule Conflict Detected — ${conflict.conflict_type.replace(/_/g, ' ')}`;

    const bodyMarkdown = `
## ${subject}

**Type:** ${conflict.conflict_type.replace(/_/g, ' ')}

**What happened:** ${conflict.description}

${conflict.ai_suggestions?.length > 0 ? `
## Suggested Fixes

${conflict.ai_suggestions.map((s, i) => `${i + 1}. **${s.action}** *(${s.impact} impact)* — ${s.detail}`).join('\n')}
` : ''}

Log into your ScheduleAI dashboard to review and resolve this conflict.
`.trim();

    await sendEmail({ to: client.email, subject, bodyMarkdown, companyName: client.company_name });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/email/send ──────────────────────────────────────────────────────
router.post('/send', requireAuth, async (req, res, next) => {
  try {
    const { to, subject, body } = req.body;
    if (!to || !subject || !body) {
      return res.status(400).json({ error: 'to, subject, and body are required' });
    }

    const { data: client } = await supabase
      .from('clients')
      .select('company_name')
      .eq('id', req.clientId)
      .single();

    await sendEmail({ to, subject, bodyMarkdown: body, companyName: client?.company_name });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
