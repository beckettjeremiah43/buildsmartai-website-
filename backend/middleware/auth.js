import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

// Lightweight: verifies JWT only — no client record lookup.
// Used for the registration endpoint where no client row exists yet.
export async function requireJwt(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }
  const { data: { user }, error } = await supabase.auth.getUser(header.slice(7));
  if (error || !user) return res.status(401).json({ error: 'Invalid or expired token' });
  req.user = user;
  next();
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  const token = header.slice(7);

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id, subscription_status, subscription_tier')
    .eq('email', user.email)
    .single();

  if (clientError || !client) {
    return res.status(403).json({ error: 'No client account found for this user' });
  }

  if (client.subscription_status === 'cancelled') {
    return res.status(403).json({ error: 'Subscription cancelled — please reactivate to continue' });
  }

  req.user       = user;
  req.clientId   = client.id;
  req.subscription = {
    tier:   client.subscription_tier,
    status: client.subscription_status,
  };

  next();
}

// Middleware that restricts an endpoint to a minimum subscription tier.
// Usage: router.post('/...', requireAuth, requireTier('pro'), handler)
const TIER_RANK = { starter: 1, pro: 2, growth: 3 };

export function requireTier(minimumTier) {
  return (req, res, next) => {
    const rank = TIER_RANK[req.subscription?.tier] ?? 0;
    if (rank < (TIER_RANK[minimumTier] ?? 99)) {
      return res.status(403).json({
        error: `This feature requires the ${minimumTier} plan or higher`,
      });
    }
    next();
  };
}
