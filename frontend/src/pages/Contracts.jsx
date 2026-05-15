import { useCallback, useEffect, useState } from 'react';
import { contracts as contractsApi, contacts as contactsApi, jobs as jobsApi, clients } from '../lib/api.js';
import Sidebar from '../components/Sidebar.jsx';

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUSES = ['draft', 'sent', 'signed', 'active', 'completed', 'cancelled'];
const FILTERS  = ['all', ...STATUSES];

const STATUS_STYLE = {
  draft:     { pill: 'bg-gray-100 text-gray-600 border border-gray-200',         icon: '📝' },
  sent:      { pill: 'bg-blue-50 text-blue-700 border border-blue-200',          icon: '📤' },
  signed:    { pill: 'bg-indigo-50 text-indigo-700 border border-indigo-200',    icon: '✍️' },
  active:    { pill: 'bg-green-50 text-green-700 border border-green-200',       icon: '✅' },
  completed: { pill: 'bg-teal-50 text-teal-700 border border-teal-200',          icon: '🏁' },
  cancelled: { pill: 'bg-red-50 text-red-700 border border-red-200',             icon: '❌' },
};

const STATUS_BAR = {
  draft: 1, sent: 2, signed: 3, active: 4, completed: 5, cancelled: 0,
};

function fmt(n) {
  if (!n && n !== 0) return null;
  if (Math.abs(n) >= 1000000) return `$${(n/1000000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000)    return `$${(n/1000).toFixed(0)}k`;
  return `$${n}`;
}

function formatDate(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Status progress bar ───────────────────────────────────────────────────────

function StatusProgress({ status }) {
  if (status === 'cancelled') return null;
  const steps = ['draft', 'sent', 'signed', 'active', 'completed'];
  const current = STATUS_BAR[status] ?? 0;
  return (
    <div className="flex items-center gap-0.5">
      {steps.map((step, i) => (
        <div key={step} className={`h-1 flex-1 rounded-full transition-colors
          ${i < current ? 'bg-brand-500' : i === current - 1 ? 'bg-brand-400' : 'bg-gray-100'}`}
        />
      ))}
    </div>
  );
}

// ── Contract card ─────────────────────────────────────────────────────────────

function ContractCard({ contract, onEdit }) {
  const s = STATUS_STYLE[contract.status] ?? STATUS_STYLE.draft;
  const contactName = contract.contacts?.name ?? null;
  const jobName     = contract.jobs?.name ?? null;
  const value       = fmt(contract.value);

  return (
    <div
      onClick={() => onEdit(contract)}
      className="bg-white rounded-xl border border-rule shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
    >
      {/* Color top bar */}
      <div className="h-0.5 w-full" style={{ background: contract.status === 'cancelled' ? '#ef4444' : contract.status === 'completed' ? '#14b8a6' : contract.status === 'active' ? '#22c55e' : '#6366f1' }} />

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink truncate">{contract.title}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {jobName     && <span className="text-[10px] text-muted truncate">📋 {jobName}</span>}
              {contactName && <span className="text-[10px] text-muted truncate">👤 {contactName}</span>}
            </div>
          </div>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize flex-shrink-0 ${s.pill}`}>
            {s.icon} {contract.status}
          </span>
        </div>

        {/* Status progress */}
        <div className="mb-3">
          <StatusProgress status={contract.status} />
        </div>

        {/* Value + dates */}
        <div className="flex items-end justify-between gap-2">
          <div>
            {value && (
              <p className="text-xl font-bold text-ink leading-none" style={{ fontFamily: 'Instrument Serif, Georgia, serif', fontStyle: 'italic' }}>
                {value}
              </p>
            )}
            {contract.start_date && contract.end_date && (
              <p className="text-[10px] text-muted mt-1">
                {formatDate(contract.start_date)} – {formatDate(contract.end_date)}
              </p>
            )}
          </div>
          {contract.signed_at && (
            <div className="text-right flex-shrink-0">
              <p className="text-[10px] text-green-600 font-medium">✓ Signed</p>
              <p className="text-[10px] text-muted">{formatDate(contract.signed_at)}</p>
            </div>
          )}
        </div>

        {contract.notes && (
          <p className="text-[11px] text-muted mt-2 pt-2 border-t border-gray-50 line-clamp-2">{contract.notes}</p>
        )}
      </div>
    </div>
  );
}

// ── Contract panel ────────────────────────────────────────────────────────────

const EMPTY = {
  title: '', job_id: '', contact_id: '', value: '',
  status: 'draft', start_date: '', end_date: '', signed_at: '', notes: '',
};

function ContractPanel({ contract, jobsList, contactsList, onClose, onSaved, onDeleted }) {
  const isNew = !contract;
  const [form,       setForm]       = useState(contract ? {
    title:      contract.title      ?? '',
    job_id:     contract.job_id     ?? '',
    contact_id: contract.contact_id ?? '',
    value:      contract.value      != null ? String(contract.value) : '',
    status:     contract.status     ?? 'draft',
    start_date: contract.start_date ?? '',
    end_date:   contract.end_date   ?? '',
    signed_at:  contract.signed_at  ?? '',
    notes:      contract.notes      ?? '',
  } : { ...EMPTY });

  const [saving,     setSaving]     = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [error,      setError]      = useState('');

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));

  async function handleSave(e) {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        title:      form.title.trim(),
        job_id:     form.job_id     || null,
        contact_id: form.contact_id || null,
        value:      form.value !== '' ? parseFloat(form.value) : null,
        status:     form.status,
        start_date: form.start_date || null,
        end_date:   form.end_date   || null,
        signed_at:  form.signed_at  || null,
        notes:      form.notes.trim() || null,
      };
      const saved = isNew
        ? await contractsApi.create(payload)
        : await contractsApi.update(contract.id, payload);
      onSaved(saved);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!confirmDel) { setConfirmDel(true); return; }
    setDeleting(true);
    try { await contractsApi.remove(contract.id); onDeleted(contract.id); }
    catch (err) { setError(err.message); setDeleting(false); }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-rule flex-shrink-0">
          <div>
            <h2 className="font-semibold text-ink">{isNew ? 'New contract' : 'Edit contract'}</h2>
            {!isNew && <p className="text-xs text-muted mt-0.5">{contract.title}</p>}
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:bg-fog hover:text-ink transition-colors text-lg">×</button>
        </div>

        <form onSubmit={handleSave} className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">Details</h3>
            <div>
              <label className="label">Contract title *</label>
              <input className="input" placeholder="e.g. Kitchen Remodel Agreement" value={form.title} onChange={set('title')} required />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={set('status')}>
                {STATUSES.map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Contract value ($)</label>
              <input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={form.value} onChange={set('value')} />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">Links</h3>
            <div>
              <label className="label">Linked job</label>
              <select className="input" value={form.job_id} onChange={set('job_id')}>
                <option value="">— None —</option>
                {jobsList.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Linked contact</label>
              <select className="input" value={form.contact_id} onChange={set('contact_id')}>
                <option value="">— None —</option>
                {contactsList.map(c => (
                  <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ''}</option>
                ))}
              </select>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">Dates</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Start date</label>
                <input className="input" type="date" value={form.start_date} onChange={set('start_date')} />
              </div>
              <div>
                <label className="label">End date</label>
                <input className="input" type="date" value={form.end_date} onChange={set('end_date')} />
              </div>
            </div>
            <div>
              <label className="label">Signed date</label>
              <input className="input" type="date" value={form.signed_at} onChange={set('signed_at')} />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">Notes</h3>
            <textarea className="input h-24 resize-none text-sm" placeholder="Contract terms, payment schedule, scope notes…" value={form.notes} onChange={set('notes')} />
          </section>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2">
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}
        </form>

        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-rule flex-shrink-0 bg-white">
          {!isNew ? (
            <button
              type="button" onClick={handleDelete} disabled={deleting}
              className={`text-xs font-medium px-3 py-2 rounded-lg transition-colors disabled:opacity-50
                ${confirmDel ? 'bg-red-500 text-white hover:bg-red-600' : 'text-red-500 hover:bg-red-50'}`}
            >
              {deleting ? 'Deleting…' : confirmDel ? 'Confirm delete' : 'Delete'}
            </button>
          ) : <div />}
          <div className="flex items-center gap-2">
            {confirmDel && <button type="button" onClick={() => setConfirmDel(false)} className="btn-secondary text-xs py-2">Cancel</button>}
            <button onClick={handleSave} disabled={saving} className="btn-primary text-xs py-2">
              {saving ? 'Saving…' : isNew ? 'Create contract' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Contracts page ────────────────────────────────────────────────────────────

export default function Contracts() {
  const [list,         setList]         = useState([]);
  const [jobsList,     setJobsList]     = useState([]);
  const [contactsList, setContactsList] = useState([]);
  const [client,       setClient]       = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [filter,       setFilter]       = useState('all');
  const [search,       setSearch]       = useState('');
  const [panel,        setPanel]        = useState(null);
  const [toast,        setToast]        = useState('');

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  const fetchAll = useCallback(async () => {
    try {
      const [data, jobs, ctcts, c] = await Promise.all([
        contractsApi.list(),
        jobsApi.list(),
        contactsApi.list(),
        clients.me(),
      ]);
      setList(data || []);
      setJobsList(jobs || []);
      setContactsList(ctcts || []);
      setClient(c);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = list.filter(c => {
    const matchStatus = filter === 'all' || c.status === filter;
    const matchSearch = !search ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      (c.jobs?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (c.contacts?.name ?? '').toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  function handleSaved(saved) {
    setList(prev => {
      const idx = prev.findIndex(c => c.id === saved.id);
      return idx >= 0 ? prev.map(c => c.id === saved.id ? saved : c) : [saved, ...prev];
    });
    setPanel(null);
    showToast(saved.title + ' saved');
  }
  function handleDeleted(id) { setList(p => p.filter(c => c.id !== id)); setPanel(null); showToast('Contract deleted'); }

  const counts = FILTERS.reduce((acc, f) => {
    acc[f] = f === 'all' ? list.length : list.filter(c => c.status === f).length;
    return acc;
  }, {});

  const totalValue = list
    .filter(c => c.status !== 'cancelled')
    .reduce((s, c) => s + (c.value ?? 0), 0);

  return (
    <div className="flex min-h-screen bg-paper">
      <Sidebar companyName={client?.company_name} ownerName={client?.owner_name} />

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-rule">
          <div>
            <h1 className="text-sm font-semibold text-ink">Contracts</h1>
            <p className="text-xs text-muted mt-0.5">
              {list.length} contract{list.length !== 1 ? 's' : ''}
              {totalValue > 0 && ` · ${fmt(totalValue)} total value`}
            </p>
          </div>
          <button onClick={() => setPanel('new')} className="btn-primary text-xs py-1.5 px-4">+ New contract</button>
        </div>

        <main className="flex-1 p-6">
          <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
            <div className="flex items-center gap-1 bg-white border border-rule rounded-lg p-1 overflow-x-auto">
              {FILTERS.map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors whitespace-nowrap
                    ${filter === f ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`}>
                  {f}
                  {counts[f] > 0 && <span className="ml-1.5 text-[10px] opacity-60">{counts[f]}</span>}
                </button>
              ))}
            </div>
            <input className="input text-xs py-1.5 w-48" placeholder="Search contracts…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1,2,3,4,5,6].map(i => <div key={i} className="animate-pulse bg-gray-200 rounded-xl h-44" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-2xl mb-3">📄</div>
              <p className="text-sm font-medium text-ink mb-1">{search ? 'No contracts match your search' : 'No contracts yet'}</p>
              {!search && <button onClick={() => setPanel('new')} className="btn-primary text-xs mt-3">+ Create your first contract</button>}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(c => (
                <ContractCard key={c.id} contract={c} onEdit={setPanel} />
              ))}
            </div>
          )}
        </main>
      </div>

      {panel && (
        <ContractPanel
          contract={panel === 'new' ? null : panel}
          jobsList={jobsList}
          contactsList={contactsList}
          onClose={() => setPanel(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-ink text-white text-sm font-medium px-4 py-2.5 rounded-lg shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
