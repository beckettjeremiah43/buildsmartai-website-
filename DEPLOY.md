# ScheduleAI — Deployment Guide

Frontend → Vercel | Backend → Railway (or Render) | DB → Supabase

---

## Accounts to Create

| Service     | Free tier?           | Sign-up URL                     |
|-------------|----------------------|---------------------------------|
| Supabase    | Yes (2 projects)     | supabase.com                    |
| Anthropic   | Pay-per-use          | console.anthropic.com           |
| Twilio      | $15 trial credit     | twilio.com/try-twilio           |
| Resend      | Yes (100 emails/day) | resend.com                      |
| Stripe      | Yes (test mode)      | stripe.com                      |
| Vercel      | Yes (Hobby)          | vercel.com                      |
| Railway     | ~$5/mo (Hobby)       | railway.app                     |

---

## Step 1 — Supabase Setup

1. Create a new Supabase project (note the region — pick closest to your users).
2. Go to **SQL Editor** and run the entire contents of `supabase/schema.sql`.
3. Go to **Authentication → Providers → Email** and confirm it is enabled.
   - For testing, disable "Confirm email" under Auth settings so signups work immediately.
4. Go to **Settings → API** and collect:

```
Project URL          → SUPABASE_URL  (also VITE_SUPABASE_URL)
anon / public key    → VITE_SUPABASE_ANON_KEY
service_role key     → SUPABASE_SERVICE_KEY   ← keep secret, backend only
```

---

## Step 2 — Third-Party Services

### Anthropic
1. Create an API key at console.anthropic.com/api-keys.
2. Copy it → `ANTHROPIC_API_KEY`

### Twilio
1. Buy a phone number (SMS-capable) in the Twilio console.
2. From the **Account Info** dashboard collect:
```
Account SID   → TWILIO_ACCOUNT_SID
Auth Token    → TWILIO_AUTH_TOKEN
Phone number  → TWILIO_PHONE_NUMBER  (format: +15551234567)
```
*(Configure the webhook URL after the backend is deployed — see Step 5.)*

### Resend
1. Add and verify your sending domain at resend.com/domains.
   - For testing you can use `onboarding@resend.dev` as the FROM address.
2. Create an API key → `RESEND_API_KEY`
3. Set `EMAIL_FROM` to `Your Company <noreply@yourdomain.com>`

### Stripe
1. In the Stripe Dashboard (test mode first), create three products:

| Product name      | Price       | Billing  |
|-------------------|-------------|----------|
| ScheduleAI Starter | $197.00/mo | Recurring |
| ScheduleAI Pro     | $397.00/mo | Recurring |
| ScheduleAI Growth  | $697.00/mo | Recurring |

2. After creating each product, click into the price and copy its **Price ID** (`price_xxx`):
```
STRIPE_PRICE_STARTER=price_xxxxxxxxxxxxxxxx
STRIPE_PRICE_PRO=price_xxxxxxxxxxxxxxxx
STRIPE_PRICE_GROWTH=price_xxxxxxxxxxxxxxxx
```
3. Go to **Developers → API Keys** and copy the Secret key → `STRIPE_SECRET_KEY`
4. *(Configure the webhook and get `STRIPE_WEBHOOK_SECRET` after the backend is deployed — see Step 5.)*

---

## Step 3 — Deploy Backend to Railway

### Option A: Railway (recommended)

1. Push the repo to GitHub (if not already).
2. Go to railway.app → **New Project → Deploy from GitHub repo**.
3. Select your repo. When asked for the root directory, set it to **`backend`**.
4. Railway detects Node.js via `package.json` and uses the `railway.json` config automatically.
5. Set all environment variables under **Variables** tab (see reference table below).
   - Leave `PORT` unset — Railway injects it automatically.
   - Set `FRONTEND_URL` to your Vercel URL (add it after Step 4, or use a placeholder now).
6. Click **Deploy**. Once live, copy your Railway URL (e.g. `https://scheduleai-production.up.railway.app`).

### Option B: Render

1. New Web Service → connect repo → Root Directory: `backend`.
2. Build command: `npm install`
3. Start command: `node server.js`
4. Set env vars under **Environment**.
5. Free tier spins down after 15 min of inactivity — upgrade to a paid plan for production.

---

## Step 4 — Deploy Frontend to Vercel

1. Go to vercel.com → **New Project → Import Git Repository**.
2. Select your repo. When asked for the **Root Directory**, set it to **`frontend`**.
3. Framework preset: **Vite** (auto-detected).
4. Set environment variables:
```
VITE_SUPABASE_URL      = (your Supabase Project URL)
VITE_SUPABASE_ANON_KEY = (your Supabase anon key)
VITE_BACKEND_URL       = (your Railway URL, no trailing slash)
```
5. Click **Deploy**. Copy your Vercel URL (e.g. `https://scheduleai.vercel.app`).
6. Go back to Railway and update `FRONTEND_URL` to your Vercel URL.
   This is required for CORS and Stripe redirect URLs.

---

## Step 5 — Configure Webhooks

Both webhooks must point to the **live Railway URL**.

### Stripe Webhook

1. Stripe Dashboard → **Developers → Webhooks → Add endpoint**.
2. Endpoint URL: `https://YOUR_RAILWAY_URL/webhook/stripe`
3. Select events to listen for:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
   - `invoice.payment_succeeded`
4. Click **Add endpoint**, then reveal the **Signing secret** → `STRIPE_WEBHOOK_SECRET`
5. Update this variable in Railway and redeploy.

### Twilio SMS Webhook

1. Twilio Console → **Phone Numbers → Manage → Active Numbers → click your number**.
2. Under **Messaging → A message comes in**:
   - Webhook: `https://YOUR_RAILWAY_URL/webhook/sms`
   - Method: **HTTP POST**
3. Save. No secret needed — Twilio signs requests with `X-Twilio-Signature`.

---

## Step 6 — Smoke Tests

Run these after both services are live:

- [ ] `GET https://YOUR_RAILWAY_URL/health` returns `{ "ok": true }`
- [ ] Open your Vercel URL → redirects to `/login`
- [ ] Sign up via `/onboarding` with a real email → lands on Dashboard
- [ ] Dashboard loads: metric cards, empty Gantt, empty Crew panel
- [ ] Open AI Chat → type "hello" → get a response from Claude
- [ ] Text "sick" from a crew member's registered phone → crew status updates in DB
- [ ] Stripe: start a checkout session → complete payment in test mode → client tier updates
- [ ] Stripe: check webhook event log shows `200 OK` responses

---

## Environment Variable Reference

### Backend (Railway Variables tab)

| Variable                | Where to get it                                         | Required |
|-------------------------|---------------------------------------------------------|----------|
| `SUPABASE_URL`          | Supabase → Settings → API → Project URL                | ✅ |
| `SUPABASE_SERVICE_KEY`  | Supabase → Settings → API → service_role key           | ✅ |
| `ANTHROPIC_API_KEY`     | console.anthropic.com → API Keys                       | ✅ |
| `TWILIO_ACCOUNT_SID`    | Twilio Console → Account Info                          | ✅ |
| `TWILIO_AUTH_TOKEN`     | Twilio Console → Account Info                          | ✅ |
| `TWILIO_PHONE_NUMBER`   | Twilio Console → Phone Numbers (format: +1...)         | ✅ |
| `STRIPE_SECRET_KEY`     | Stripe → Developers → API Keys → Secret key            | ✅ |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Developers → Webhooks → your endpoint → secret| ✅ |
| `STRIPE_PRICE_STARTER`  | Stripe → Products → Starter price → Price ID           | ✅ |
| `STRIPE_PRICE_PRO`      | Stripe → Products → Pro price → Price ID               | ✅ |
| `STRIPE_PRICE_GROWTH`   | Stripe → Products → Growth price → Price ID            | ✅ |
| `RESEND_API_KEY`        | resend.com → API Keys                                  | ✅ |
| `EMAIL_FROM`            | `ScheduleAI <noreply@yourdomain.com>`                  | ✅ |
| `FRONTEND_URL`          | Your Vercel URL (no trailing slash)                    | ✅ |
| `PORT`                  | Set automatically by Railway — do NOT set manually     | — |

### Frontend (Vercel Environment Variables)

| Variable               | Where to get it                               | Required |
|------------------------|-----------------------------------------------|----------|
| `VITE_SUPABASE_URL`    | Supabase → Settings → API → Project URL       | ✅ |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon/public key | ✅ |
| `VITE_BACKEND_URL`     | Your Railway URL (no trailing slash)          | ✅ |

---

## Estimated Monthly Cost (production)

| Service         | Plan              | Cost/mo     |
|-----------------|-------------------|-------------|
| Supabase        | Pro               | $25         |
| Anthropic       | Pay-per-use       | ~$10–50     |
| Twilio          | Pay-per-use       | ~$5–20      |
| Resend          | Pro (50k emails)  | $20         |
| Stripe          | 2.9% + 30¢/txn   | ~$0 (from sub revenue) |
| Vercel          | Hobby (free)      | $0          |
| Railway         | Hobby             | ~$5–10      |
| **Total**       |                   | **~$65–125** |

Revenue from even one $197/mo Starter subscriber covers infrastructure costs.
