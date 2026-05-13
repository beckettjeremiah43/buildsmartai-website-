import { supabase } from '../lib/supabase.js';
import { Router }       from 'express';
import Stripe           from 'stripe';
import { requireAuth }  from '../middleware/auth.js';

const router   = Router();
const stripe   = new Stripe(process.env.STRIPE_SECRET_KEY);

function priceToTier(priceId) {
  if (priceId === process.env.STRIPE_PRICE_STARTER) return 'starter';
  if (priceId === process.env.STRIPE_PRICE_PRO)     return 'pro';
  if (priceId === process.env.STRIPE_PRICE_GROWTH)  return 'growth';
  return 'starter';
}

function stripeStatusToInternal(stripeStatus) {
  switch (stripeStatus) {
    case 'active':              return 'active';
    case 'past_due':            return 'past_due';
    case 'unpaid':              return 'past_due';
    case 'canceled':            return 'cancelled';
    case 'incomplete_expired':  return 'cancelled';
    default:                    return 'trial';
  }
}

// ── POST /api/payments/create-checkout ────────────────────────────────────────
router.post('/create-checkout', requireAuth, async (req, res, next) => {
  try {
    const { tier } = req.body;
    const validTiers = ['starter', 'pro', 'growth'];
    if (!validTiers.includes(tier)) {
      return res.status(400).json({ error: `tier must be one of: ${validTiers.join(', ')}` });
    }

    const priceEnvKey = `STRIPE_PRICE_${tier.toUpperCase()}`;
    const priceId     = process.env[priceEnvKey];
    if (!priceId) {
      return res.status(500).json({ error: `${priceEnvKey} is not configured in environment` });
    }

    const { data: client } = await supabase
      .from('clients')
      .select('email, company_name, stripe_customer_id')
      .eq('id', req.clientId)
      .single();

    let customerId = client?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email:    client.email,
        name:     client.company_name,
        metadata: { supabase_client_id: req.clientId },
      });
      customerId = customer.id;

      await supabase
        .from('clients')
        .update({ stripe_customer_id: customerId })
        .eq('id', req.clientId);
    }

    const session = await stripe.checkout.sessions.create({
      customer:    customerId,
      mode:        'subscription',
      line_items:  [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/dashboard?subscription=success`,
      cancel_url:  `${process.env.FRONTEND_URL}/settings?subscription=cancelled`,
      metadata:    { client_id: req.clientId, tier },
      subscription_data: {
        metadata: { client_id: req.clientId, tier },
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/payments/portal ──────────────────────────────────────────────────
router.get('/portal', requireAuth, async (req, res, next) => {
  try {
    const { data: client } = await supabase
      .from('clients')
      .select('stripe_customer_id')
      .eq('id', req.clientId)
      .single();

    if (!client?.stripe_customer_id) {
      return res.status(404).json({ error: 'No billing account found' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer:   client.stripe_customer_id,
      return_url: `${process.env.FRONTEND_URL}/settings`,
    });

    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/payments/status ──────────────────────────────────────────────────
router.get('/status', requireAuth, async (req, res, next) => {
  try {
    const { data } = await supabase
      .from('clients')
      .select('subscription_tier, subscription_status, stripe_customer_id')
      .eq('id', req.clientId)
      .single();

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ── Stripe webhook handler (exported for use in server.js) ───────────────────
export async function stripeWebhookHandler(req, res) {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error('Stripe webhook signature failure:', err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub     = event.data.object;
        const priceId = sub.items.data[0]?.price?.id;
        const tier    = priceToTier(priceId);
        const status  = stripeStatusToInternal(sub.status);

        await supabase
          .from('clients')
          .update({ subscription_tier: tier, subscription_status: status })
          .eq('stripe_customer_id', sub.customer);

        console.log(`Subscription ${event.type}: customer ${sub.customer} → ${tier}/${status}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await supabase
          .from('clients')
          .update({ subscription_status: 'cancelled' })
          .eq('stripe_customer_id', sub.customer);

        console.log(`Subscription cancelled: customer ${sub.customer}`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        await supabase
          .from('clients')
          .update({ subscription_status: 'past_due' })
          .eq('stripe_customer_id', invoice.customer);

        console.log(`Payment failed: customer ${invoice.customer}`);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        await supabase
          .from('clients')
          .update({ subscription_status: 'active' })
          .eq('stripe_customer_id', invoice.customer)
          .eq('subscription_status', 'past_due');
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error(`Error handling Stripe event ${event.type}:`, err);
  }

  res.json({ received: true });
}

export default router;
