import { useEffect, useState } from 'react';
import { clients, payments }  from '../lib/api.js';
import Navbar from '../components/Navbar.jsx';

// ── Section wrapper ────────────────────────────────────────────────────────────

function Section({ title, description, children }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
      </div>
      <div className="md:col-span-2 card p-6 space-y-4">
        {children}
      </div>
    </div>
  );
}

// ── Field ─────────────────────────────────────────────────────────────────────

function Field({ label, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message, type }) {
  if (!message) return null;
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium transition-all
      ${type === 'error' ? 'bg-red-600 text-white' : 'bg-gray-900 text-white'}`}>
      {message}
    </div>
  );
}

// ── Tier badge ────────────────────────────────────────────────────────────────

const TIER_COLORS = {
  starter: 'bg-gray-100 text-gray-700',
  pro:     'bg-blue-100 text-blue-700',
  growth:  'bg-purple-100 text-purple-700',
};

function TierBadge({ tier, status }) {
  const color = TIER_COLORS[tier] ?? 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${color}`}>
      {tier ?? 'free'}
      {status === 'trial' && (
        <span className="bg-yellow-400 text-yellow-900 rounded-full px-1.5 py-0.5 text-[10px] font-bold ml-0.5">
          TRIAL
        </span>
      )}
    </span>
  );
}

// ── Settings page ─────────────────────────────────────────────────────────────

export default function Settings() {
  const [client,        setClient]        = useState(null);
  const [loading,       setLoading]       = useState(true);

  // profile form state
  const [companyName,   setCompanyName]   = useState('');
  const [ownerName,     setOwnerName]     = useState('');
  const [phone,         setPhone]         = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // AI prompt state
  const [prompt,        setPrompt]        = useState('');
  const [savingPrompt,  setSavingPrompt]  = useState(false);
  const [regen,         setRegen]         = useState(false);

  // subscription state
  const [subStatus,     setSubStatus]     = useState(null);
  const [portalLoading, setPortalLoading] = useState(false);

  // toast
  const [toast, setToast] = useState({ message: '', type: 'success' });

  function showToast(message, type = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast({ message: '', type: 'success' }), 3000);
  }

  useEffect(() => {
    async function load() {
      try {
        const [c, s] = await Promise.all([clients.me(), payments.status()]);
        setClient(c);
        setCompanyName(c.company_name ?? '');
        setOwnerName(c.owner_name ?? '');
        setPhone(c.phone ?? '');
        setPrompt(c.ai_system_prompt ?? '');
        setSubStatus(s);
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function saveProfile(e) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const updated = await clients.update({
        company_name: companyName,
        owner_name:   ownerName,
        phone:        phone || null,
      });
      setClient(updated);
      showToast('Profile saved');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePrompt(e) {
    e.preventDefault();
    setSavingPrompt(true);
    try {
      await clients.update({ ai_system_prompt: prompt });
      showToast('AI prompt saved');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingPrompt(false);
    }
  }

  async function regeneratePrompt() {
    setRegen(true);
    try {
      const result = await clients.generatePrompt();
      setPrompt(result.ai_system_prompt);
      showToast('Prompt regenerated');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setRegen(false);
    }
  }

  async function openBillingPortal() {
    setPortalLoading(true);
    try {
      const { url } = await payments.portal();
      window.location.href = url;
    } catch (err) {
      if (err.status === 404) {
        showToast('No billing account yet — subscribe to a plan first', 'error');
      } else {
        showToast(err.message, 'error');
      }
      setPortalLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar companyName={client?.company_name} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your account, subscription, and AI assistant.</p>
        </div>

        {loading ? (
          <div className="space-y-10">
            {[1, 2, 3].map(i => (
              <div key={i} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="animate-pulse bg-gray-200 rounded-lg h-12" />
                <div className="md:col-span-2 animate-pulse bg-gray-200 rounded-xl h-40" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* ── Profile ── */}
            <Section
              title="Profile"
              description="Your company info appears in reports and AI-generated summaries."
            >
              <form onSubmit={saveProfile} className="space-y-4">
                <Field label="Company name">
                  <input
                    className="input"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    required
                  />
                </Field>
                <Field label="Owner name">
                  <input
                    className="input"
                    value={ownerName}
                    onChange={e => setOwnerName(e.target.value)}
                    required
                  />
                </Field>
                <Field label="Phone (SMS alerts)">
                  <input
                    className="input"
                    type="tel"
                    placeholder="+1 555 000 0000"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                  />
                </Field>
                <Field label="Email">
                  <input className="input bg-gray-50 text-gray-400 cursor-not-allowed" value={client?.email ?? ''} readOnly />
                </Field>
                <div className="flex justify-end pt-2">
                  <button type="submit" className="btn-primary" disabled={savingProfile}>
                    {savingProfile ? 'Saving…' : 'Save profile'}
                  </button>
                </div>
              </form>
            </Section>

            <hr className="border-gray-200" />

            {/* ── Subscription ── */}
            <Section
              title="Subscription"
              description="Manage your plan and billing through the Stripe portal."
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">Current plan</p>
                  <div className="flex items-center gap-2 mt-1">
                    <TierBadge
                      tier={subStatus?.subscription_tier ?? client?.subscription_tier}
                      status={subStatus?.subscription_status ?? client?.subscription_status}
                    />
                    {(subStatus?.subscription_status ?? client?.subscription_status) && (
                      <span className={`text-xs capitalize font-medium ${
                        (subStatus?.subscription_status ?? client?.subscription_status) === 'active'   ? 'text-green-600' :
                        (subStatus?.subscription_status ?? client?.subscription_status) === 'trial'    ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {subStatus?.subscription_status ?? client?.subscription_status}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={openBillingPortal}
                  disabled={portalLoading}
                  className="btn-secondary"
                >
                  {portalLoading ? 'Redirecting…' : 'Manage billing'}
                </button>
              </div>
            </Section>

            <hr className="border-gray-200" />

            {/* ── AI Prompt ── */}
            <Section
              title="AI assistant prompt"
              description="This system prompt shapes how the AI assistant responds to your questions. Edit it to fit your workflow."
            >
              <form onSubmit={savePrompt} className="space-y-4">
                <textarea
                  className="input h-40 resize-y font-mono text-xs leading-relaxed"
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder="No custom prompt set — click Regenerate to create one."
                />
                <div className="flex items-center justify-between gap-3 pt-1">
                  <button
                    type="button"
                    onClick={regeneratePrompt}
                    disabled={regen}
                    className="btn-secondary"
                  >
                    {regen ? 'Regenerating…' : 'Regenerate with AI'}
                  </button>
                  <button type="submit" className="btn-primary" disabled={savingPrompt}>
                    {savingPrompt ? 'Saving…' : 'Save prompt'}
                  </button>
                </div>
              </form>
            </Section>
          </>
        )}
      </main>

      <Toast message={toast.message} type={toast.type} />
    </div>
  );
}
