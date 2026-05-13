import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase }    from '../lib/supabase.js';
import { clients, crew as crewApi, jobs as jobsApi, subcontractors as subsApi } from '../lib/api.js';

// ── Step indicator ────────────────────────────────────────────────────────────

const STEPS = ['Company', 'Crew', 'Jobs', 'Subs'];

function StepIndicator({ current }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((label, i) => {
        const done    = i < current;
        const active  = i === current;
        return (
          <div key={label} className="flex items-center gap-2">
            <div className={`
              flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold
              ${done   ? 'bg-brand-500 text-white' : ''}
              ${active ? 'bg-brand-500 text-white ring-4 ring-brand-100' : ''}
              ${!done && !active ? 'bg-gray-200 text-gray-500' : ''}
            `}>
              {done ? '✓' : i + 1}
            </div>
            <span className={`text-sm font-medium hidden sm:block
              ${active ? 'text-brand-600' : done ? 'text-gray-700' : 'text-gray-400'}
            `}>{label}</span>
            {i < STEPS.length - 1 && (
              <div className={`w-8 h-0.5 mx-1 ${i < current ? 'bg-brand-500' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Reusable remove button ────────────────────────────────────────────────────

function RemoveBtn({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-gray-400 hover:text-red-500 transition-colors ml-2 flex-shrink-0"
      aria-label="Remove"
    >
      ✕
    </button>
  );
}

// ── Step 1: Company info ──────────────────────────────────────────────────────

function Step1({ data, onChange }) {
  const set = (field) => (e) => onChange({ ...data, [field]: e.target.value });
  return (
    <div className="space-y-4">
      <div>
        <label className="label">Company name *</label>
        <input className="input" value={data.company_name} onChange={set('company_name')} placeholder="Apex Contracting LLC" required />
      </div>
      <div>
        <label className="label">Your name *</label>
        <input className="input" value={data.owner_name} onChange={set('owner_name')} placeholder="John Smith" required />
      </div>
      <div>
        <label className="label">Phone number</label>
        <input className="input" type="tel" value={data.phone} onChange={set('phone')} placeholder="+1 (555) 000-0000" />
      </div>
      <div>
        <label className="label">Email address *</label>
        <input className="input" type="email" value={data.email} onChange={set('email')} placeholder="john@apexcontracting.com" required />
      </div>
      <div>
        <label className="label">Password *</label>
        <input className="input" type="password" value={data.password} onChange={set('password')} placeholder="8+ characters" minLength={8} required />
      </div>
    </div>
  );
}

// ── Step 2: Crew members ──────────────────────────────────────────────────────

const SKILL_OPTIONS = ['Framing', 'Demo', 'Drywall', 'Painting', 'Flooring', 'Roofing', 'Concrete', 'Electrical', 'Plumbing', 'HVAC', 'Finishing', 'Excavation'];

function Step2({ data, onChange }) {
  function addMember() {
    onChange([...data, { name: '', phone: '', skills: [] }]);
  }

  function updateMember(i, field, value) {
    const next = [...data];
    next[i] = { ...next[i], [field]: value };
    onChange(next);
  }

  function toggleSkill(i, skill) {
    const current = data[i].skills;
    const next    = current.includes(skill)
      ? current.filter(s => s !== skill)
      : [...current, skill];
    updateMember(i, 'skills', next);
  }

  function removeMember(i) {
    onChange(data.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-4">
      {data.map((member, i) => (
        <div key={i} className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-700">Crew Member {i + 1}</h4>
            {data.length > 1 && <RemoveBtn onClick={() => removeMember(i)} />}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Name *</label>
              <input className="input" value={member.name} onChange={e => updateMember(i, 'name', e.target.value)} placeholder="Mike Johnson" />
            </div>
            <div>
              <label className="label">Phone (for SMS)</label>
              <input className="input" type="tel" value={member.phone} onChange={e => updateMember(i, 'phone', e.target.value)} placeholder="+1 555 000 0000" />
            </div>
          </div>
          <div>
            <label className="label">Skills</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {SKILL_OPTIONS.map(skill => (
                <button
                  key={skill}
                  type="button"
                  onClick={() => toggleSkill(i, skill)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors
                    ${member.skills.includes(skill)
                      ? 'bg-brand-500 text-white border-brand-500'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-brand-400'
                    }`}
                >
                  {skill}
                </button>
              ))}
            </div>
          </div>
        </div>
      ))}
      <button type="button" onClick={addMember} className="btn-secondary w-full">
        + Add crew member
      </button>
    </div>
  );
}

// ── Step 3: Jobs ──────────────────────────────────────────────────────────────

function Step3({ data, onChange }) {
  function addJob() {
    if (data.length >= 5) return;
    onChange([...data, { name: '', address: '', start_date: '', end_date: '' }]);
  }

  function updateJob(i, field, value) {
    const next = [...data];
    next[i] = { ...next[i], [field]: value };
    onChange(next);
  }

  function removeJob(i) {
    onChange(data.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-4">
      {data.map((job, i) => (
        <div key={i} className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-700">Job {i + 1}</h4>
            {data.length > 1 && <RemoveBtn onClick={() => removeJob(i)} />}
          </div>
          <div>
            <label className="label">Job name *</label>
            <input className="input" value={job.name} onChange={e => updateJob(i, 'name', e.target.value)} placeholder="Kitchen Remodel — Main St" />
          </div>
          <div>
            <label className="label">Site address</label>
            <input className="input" value={job.address} onChange={e => updateJob(i, 'address', e.target.value)} placeholder="123 Main St, Springfield" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Start date</label>
              <input className="input" type="date" value={job.start_date} onChange={e => updateJob(i, 'start_date', e.target.value)} />
            </div>
            <div>
              <label className="label">End date</label>
              <input className="input" type="date" value={job.end_date} onChange={e => updateJob(i, 'end_date', e.target.value)} />
            </div>
          </div>
        </div>
      ))}
      {data.length < 5 && (
        <button type="button" onClick={addJob} className="btn-secondary w-full">
          + Add job
        </button>
      )}
    </div>
  );
}

// ── Step 4: Subcontractors ────────────────────────────────────────────────────

const TRADES = ['Electrical', 'Plumbing', 'HVAC', 'Roofing', 'Flooring', 'Painting', 'Concrete', 'Landscaping', 'Other'];

function Step4({ data, onChange }) {
  function addSub() {
    onChange([...data, { company_name: '', trade: '', phone: '', email: '' }]);
  }

  function updateSub(i, field, value) {
    const next = [...data];
    next[i] = { ...next[i], [field]: value };
    onChange(next);
  }

  function removeSub(i) {
    onChange(data.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Add the subcontractors you regularly work with. You can always add more later.</p>
      {data.map((sub, i) => (
        <div key={i} className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-700">Subcontractor {i + 1}</h4>
            <RemoveBtn onClick={() => removeSub(i)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Company name *</label>
              <input className="input" value={sub.company_name} onChange={e => updateSub(i, 'company_name', e.target.value)} placeholder="Sparks Electric Co." />
            </div>
            <div>
              <label className="label">Trade</label>
              <select className="input" value={sub.trade} onChange={e => updateSub(i, 'trade', e.target.value)}>
                <option value="">Select trade…</option>
                {TRADES.map(t => <option key={t} value={t.toLowerCase()}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" type="tel" value={sub.phone} onChange={e => updateSub(i, 'phone', e.target.value)} placeholder="+1 555 000 0000" />
            </div>
            <div className="col-span-2">
              <label className="label">Email</label>
              <input className="input" type="email" value={sub.email} onChange={e => updateSub(i, 'email', e.target.value)} placeholder="contact@sparkselectric.com" />
            </div>
          </div>
        </div>
      ))}
      <button type="button" onClick={addSub} className="btn-secondary w-full">
        + Add subcontractor
      </button>
    </div>
  );
}

// ── Main Onboarding component ─────────────────────────────────────────────────

export default function Onboarding() {
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const [company, setCompany] = useState({
    company_name: '', owner_name: '', phone: '', email: '', password: '',
  });
  const [crewList, setCrewList]   = useState([{ name: '', phone: '', skills: [] }]);
  const [jobList,  setJobList]    = useState([{ name: '', address: '', start_date: '', end_date: '' }]);
  const [subList,  setSubList]    = useState([]);

  function validateStep() {
    if (step === 0) {
      if (!company.company_name.trim()) return 'Company name is required';
      if (!company.owner_name.trim())   return 'Your name is required';
      if (!company.email.trim())        return 'Email is required';
      if (company.password.length < 8)  return 'Password must be at least 8 characters';
    }
    if (step === 1) {
      if (crewList.some(c => !c.name.trim())) return 'All crew members need a name';
    }
    if (step === 2) {
      if (jobList.some(j => !j.name.trim())) return 'All jobs need a name';
    }
    return null;
  }

  function next() {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError('');
    setStep(s => s + 1);
  }

  function back() {
    setError('');
    setStep(s => s - 1);
  }

  async function handleSubmit() {
    setError('');
    setLoading(true);

    try {
      // 1. Create Supabase auth user
      setStatusMsg('Creating your account…');
      const { data: { session }, error: signUpError } = await supabase.auth.signUp({
        email:    company.email.trim().toLowerCase(),
        password: company.password,
      });
      if (signUpError) throw new Error(signUpError.message);
      if (!session)    throw new Error('Sign-up succeeded but no session returned. Check your email to confirm, then log in.');

      // 2. Create client record
      setStatusMsg('Setting up your company…');
      await clients.register({
        company_name: company.company_name.trim(),
        owner_name:   company.owner_name.trim(),
        phone:        company.phone.trim() || null,
      });

      // 3. Add crew members (filter blanks)
      setStatusMsg('Adding crew…');
      const validCrew = crewList.filter(c => c.name.trim());
      await Promise.all(validCrew.map(c =>
        crewApi.create({ name: c.name.trim(), phone: c.phone.trim() || null, skills: c.skills }),
      ));

      // 4. Add jobs
      setStatusMsg('Adding jobs…');
      const validJobs = jobList.filter(j => j.name.trim());
      await Promise.all(validJobs.map(j =>
        jobsApi.create({
          name:       j.name.trim(),
          address:    j.address.trim() || null,
          start_date: j.start_date || null,
          end_date:   j.end_date   || null,
        }),
      ));

      // 5. Add subcontractors (if any)
      const validSubs = subList.filter(s => s.company_name.trim());
      if (validSubs.length > 0) {
        setStatusMsg('Adding subcontractors…');
        await Promise.all(validSubs.map(s =>
          subsApi.create({
            company_name: s.company_name.trim(),
            trade:        s.trade  || null,
            phone:        s.phone  || null,
            email:        s.email  || null,
          }),
        ));
      }

      // 6. Generate custom AI system prompt
      setStatusMsg('Generating your AI assistant…');
      await clients.generatePrompt().catch(() => {}); // non-blocking

      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
      setLoading(false);
      setStatusMsg('');
    }
  }

  const stepTitles = [
    'Tell us about your company',
    'Add your crew',
    'Add your current jobs',
    'Add your subcontractors',
  ];

  const stepDescriptions = [
    'This sets up your account and workspace.',
    'Crew members can text updates directly from the job site.',
    'Add the jobs you\'re actively working on.',
    'Optional — you can always add more later.',
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6">
      <div className="mx-auto w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <span className="text-3xl">🏗️</span>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">
            Schedule<span className="text-brand-500">AI</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">Set up your account in 4 quick steps</p>
        </div>

        <StepIndicator current={step} />

        <div className="card px-6 py-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900">{stepTitles[step]}</h2>
            <p className="text-sm text-gray-500 mt-1">{stepDescriptions[step]}</p>
          </div>

          {step === 0 && <Step1 data={company}  onChange={setCompany}  />}
          {step === 1 && <Step2 data={crewList} onChange={setCrewList} />}
          {step === 2 && <Step3 data={jobList}  onChange={setJobList}  />}
          {step === 3 && <Step4 data={subList}  onChange={setSubList}  />}

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {loading && statusMsg && (
            <div className="mt-4 flex items-center gap-2 text-sm text-brand-600">
              <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              {statusMsg}
            </div>
          )}

          <div className="flex justify-between mt-8">
            {step > 0 ? (
              <button type="button" onClick={back} className="btn-secondary" disabled={loading}>
                Back
              </button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <button type="button" onClick={next} className="btn-primary">
                Continue
              </button>
            ) : (
              <button type="button" onClick={handleSubmit} disabled={loading} className="btn-primary">
                {loading ? 'Setting up…' : 'Complete Setup'}
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-sm text-gray-400 mt-4">
          Already have an account?{' '}
          <a href="/login" className="text-brand-500 hover:text-brand-600 font-medium">Sign in</a>
        </p>
      </div>
    </div>
  );
}
