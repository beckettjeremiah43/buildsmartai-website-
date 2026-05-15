import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';

// Routes
import schedulesRouter       from './routes/schedules.js';
import jobsRouter            from './routes/jobs.js';
import crewRouter            from './routes/crew.js';
import aiRouter              from './routes/ai.js';
import smsRouter             from './routes/sms.js';
import paymentsRouter        from './routes/payments.js';
import emailRouter           from './routes/email.js';
import clientsRouter         from './routes/clients.js';
import subcontractorsRouter  from './routes/subcontractors.js';
import contactsRouter        from './routes/contacts.js';
import contractsRouter       from './routes/contracts.js';

// Scheduler (starts cron jobs on import)
import { startScheduler } from './services/scheduler.js';

// Stripe webhook needs raw body — import before express.json()
import { stripeWebhookHandler } from './routes/payments.js';

const app  = express();
const PORT = process.env.PORT || 3001;

// Trust Railway's reverse proxy so express-rate-limit reads the real client IP
app.set('trust proxy', 1);

// ── Request logger (diagnostic) ──────────────────────────
app.use((req, res, next) => {
  console.log(`[req] ${req.method} ${req.path}`);
  next();
});

// ── CORS: manual headers, runs before everything ──────────
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// ── Security ──────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: false, crossOriginEmbedderPolicy: false }));

// ── Stripe webhook: raw body required before json parser ──
app.post(
  '/webhook/stripe',
  express.raw({ type: 'application/json' }),
  stripeWebhookHandler,
);

// ── Twilio webhook: urlencoded form body ──────────────────
app.use('/webhook/sms', express.urlencoded({ extended: false }), smsRouter);

// ── JSON body for all other routes ────────────────────────
app.use(express.json());

// ── Global rate limit ─────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max:      200,
  standardHeaders: true,
  legacyHeaders:   false,
});
app.use('/api', limiter);

// ── API routes ────────────────────────────────────────────
app.use('/api/clients',        clientsRouter);
app.use('/api/schedules',      schedulesRouter);
app.use('/api/jobs',           jobsRouter);
app.use('/api/crew',           crewRouter);
app.use('/api/ai',             aiRouter);
app.use('/api/payments',       paymentsRouter);
app.use('/api/email',          emailRouter);
app.use('/api/subcontractors', subcontractorsRouter);
app.use('/api/contacts',      contactsRouter);
app.use('/api/contracts',     contractsRouter);

// ── Health check ──────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// ── 404 ───────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ── Global error handler ──────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  const status  = err.status || err.statusCode || 500;
  const message = err.expose ? err.message : 'Internal server error';
  res.status(status).json({ error: message });
});

// ── Start ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`ScheduleAI backend running on port ${PORT}`);
  startScheduler();
});

export default app;
