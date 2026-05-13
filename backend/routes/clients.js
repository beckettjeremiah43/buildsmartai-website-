import { supabase } from '../lib/supabase.js';
import { Router }      from 'express';
import Anthropic        from '@anthropic-ai/sdk';
import { requireAuth, requireJwt } from '../middleware/auth.js';

const router    = Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── POST /api/clients/register ────────────────────────────────────────────────
// Called once during onboarding right after supabase.auth.signUp().
// Only requires a valid JWT — no existing client row needed.
router.post('/register', requireJwt, async (req, res, next) => {
  try {
    const { company_name, owner_name, phone } = req.body;
    if (!company_name || !owner_name) {
      return res.status(400).json({ error: 'company_name and owner_name are required' });
    }

    // Check if client record already exists (idempotent)
    const { data: existing } = await supabase
      .from('clients')
      .select('id')
      .eq('email', req.user.email)
      .single();

    if (existing) return res.status(200).json(existing);

    const { data, error } = await supabase
      .from('clients')
      .insert({ company_name, owner_name, phone: phone || null, email: req.user.email })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/clients/me ───────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('id, company_name, owner_name, email, phone, subscription_tier, subscription_status, ai_system_prompt, created_at')
      .eq('id', req.clientId)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/clients/me ─────────────────────────────────────────────────────
router.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const allowed = ['company_name', 'owner_name', 'phone', 'ai_system_prompt'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const { data, error } = await supabase
      .from('clients')
      .update(updates)
      .eq('id', req.clientId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/clients/generate-prompt ────────────────────────────────────────
// Generates a tailored Claude system prompt from the client's profile and
// saves it to clients.ai_system_prompt. Called at end of onboarding.
router.post('/generate-prompt', requireAuth, async (req, res, next) => {
  try {
    const [{ data: client }, { data: jobs }, { data: crew }] = await Promise.all([
      supabase.from('clients').select('company_name, owner_name').eq('id', req.clientId).single(),
      supabase.from('jobs').select('name, phases').eq('client_id', req.clientId).limit(5),
      supabase.from('crew').select('skills').eq('client_id', req.clientId),
    ]);

    const allSkills = [...new Set((crew || []).flatMap(c => c.skills || []))];
    const jobNames  = (jobs || []).map(j => j.name).join(', ');

    const message = await anthropic.messages.create({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: `Write a custom AI assistant system prompt for a construction contractor with these details:
Company: ${client?.company_name}
Owner: ${client?.owner_name}
Trades/skills on crew: ${allSkills.join(', ') || 'general construction'}
Current projects: ${jobNames || 'various construction projects'}

The prompt should:
- Define the AI as a scheduling and operations assistant specifically for this company
- Mention their trade specialties
- Instruct the AI to be proactive about surfacing scheduling conflicts
- Keep tone professional but direct (contractors are busy)
- Be 3-5 sentences

Return only the system prompt text, no explanation.`,
      }],
    });

    const aiSystemPrompt = message.content[0].text.trim();

    const { data, error } = await supabase
      .from('clients')
      .update({ ai_system_prompt: aiSystemPrompt })
      .eq('id', req.clientId)
      .select('ai_system_prompt')
      .single();

    if (error) throw error;
    res.json({ ai_system_prompt: data.ai_system_prompt });
  } catch (err) {
    next(err);
  }
});

export default router;
