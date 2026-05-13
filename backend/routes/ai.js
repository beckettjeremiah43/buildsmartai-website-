import { Router }            from 'express';
import { createClient }      from '@supabase/supabase-js';
import { requireAuth }       from '../middleware/auth.js';
import { aiLimiter }         from '../middleware/rateLimit.js';
import { chat, draftDocument } from '../services/claude.js';

const router   = Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

router.use(requireAuth);

// ── POST /api/ai/chat ─────────────────────────────────────────────────────────
router.post('/chat', aiLimiter, async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'message is required' });

    // Load last 20 messages for conversation history
    const { data: history } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('client_id', req.clientId)
      .order('created_at', { ascending: true })
      .limit(20);

    const response = await chat(req.clientId, message, history || []);
    res.json({ response });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/ai/chat/history ──────────────────────────────────────────────────
router.get('/chat/history', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);

    const { data, error } = await supabase
      .from('chat_messages')
      .select('id, role, content, created_at')
      .eq('client_id', req.clientId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/ai/draft ────────────────────────────────────────────────────────
router.post('/draft', aiLimiter, async (req, res, next) => {
  try {
    const { doc_type, context } = req.body;
    const valid = ['change_order', 'client_update', 'punch_list'];

    if (!valid.includes(doc_type)) {
      return res.status(400).json({ error: `doc_type must be one of: ${valid.join(', ')}` });
    }

    const document = await draftDocument(req.clientId, doc_type, context || {});
    res.json({ document });
  } catch (err) {
    next(err);
  }
});

export default router;
