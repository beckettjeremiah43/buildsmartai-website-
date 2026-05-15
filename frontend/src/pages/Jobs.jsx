import { useCallback, useEffect, useState } from 'react';
import { jobs as jobsApi } from '../lib/api.js';
import Sidebar from '../components/Sidebar.jsx';
import { clients } from '../lib/api.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ['active', 'paused', 'completed'];

const STATUS_STYLE = {
  active:    'pill-green',
  paused:    'pill-amber',
  completed: 'pill-blue',
};

const PHASE_STATUS_OPTIONS = ['pending', 'in_progress', 'complete'];

const PHASE_STATUS_STYLE = {
  pending:     'bg-gray-100 text-gray-500 border-gray-200',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  complete:    'bg-green-50 text-green-700 border-green-200',
};

const JOB_COLORS = ['#47c8ff','#22c55e','#a855f7','#f59e0b','#ec4899','#14b8a6','#f97316','#6366f1'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n) {
  if (!n && n !== 0) return '—';
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n}`;
}

function parseDate(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toIso(date) {
  return date.toISOString().split('T')[0];
}

function daysBetween(a, b) {
  return Math.round((b - a) / 86_400_000);
}

// ── Timeline bar ──────────────────────────────────────────────────────────────

function TimelineBar({ startDate, endDate, color }) {
  const start   = parseDate(startDate);
  const end     = parseDate(endDate);
  const today   = new Date(); today.setHours(0, 0, 0, 0);

  if (!start || !end) {
    return <p className="text-xs text-muted italic">No timeline set</p>;
  }

  const total    = Math.max(daysBetween(start, end), 1);
  const elapsed  = Math.min(Math.max(daysBetween(start, today), 0), total);
  const progress = Math.round((elapsed / total) * 100);

  const isOverdue   = today > end;
  const nearingEnd  = !isOverdue && progress >= 80;
  const barColor    = isOverdue ? '#ef4444' : nearingEnd ? '#f59e0b' : (color ?? '#47c8ff');

  const daysLeft = daysBetween(today, end);
  const statusText = isOverdue
    ? `${Math.abs(daysLeft)}d overdue`
    : daysLeft === 0 ? 'Due today'
    : `${daysLeft}d left`;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-muted">{startDate}</span>
        <span className="text-[10px] font-medium" style={{ color: barColor }}>{statusText}</span>
        <span className="text-[10px] text-muted">{endDate}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${progress}%`, background: barColor }}
        />
      </div>
      <p className="text-[10px] text-muted mt-1">{progress}% through timeline</p>
    </div>
  );
}

// ── Job card ──────────────────────────────────────────────────────────────────

function JobCard({ job, color, onEdit }) {
  const profit  = (job.contract_value ?? 0) - (job.cost ?? 0);
  const phases  = Array.isArray(job.phases) ? job.phases : [];
  const done    = phases.filter(p => p.status === 'complete').length;

  return (
    <div
      className="bg-white rounded-xl border border-rule shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onEdit(job)}
    >
      {/* Color accent top */}
      <div className="h-0.5" style={{ background: color }} />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-sm text-ink truncate">{job.name}</h3>
            {job.address && (
              <p className="text-xs text-muted truncate mt-0.5">{job.address}</p>
            )}
          </div>
          <span className={`pill flex-shrink-0 ${STATUS_STYLE[job.status] ?? 'pill-gray'}`}>
            {job.status}
          </span>
        </div>

        {/* Timeline */}
        <div className="mb-3">
          <TimelineBar startDate={job.start_date} endDate={job.end_date} color={color} />
        </div>

        {/* Financials */}
        {(job.contract_value != null || job.cost != null) && (
          <div className="flex items-center gap-3 mb-3 text-xs">
            <div>
              <span className="text-muted">Revenue </span>
              <span className="font-medium text-green-600">{fmt(job.contract_value)}</span>
            </div>
            <div>
              <span className="text-muted">Cost </span>
              <span className="font-medium text-orange-500">{fmt(job.cost)}</span>
            </div>
            <div>
              <span className="text-muted">Profit </span>
              <span className={`font-medium ${profit >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>
                {fmt(profit)}
              </span>
            </div>
          </div>
        )}

        {/* Phases */}
        {phases.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">
                Phases
              </span>
              <span className="text-[10px] text-muted">{done}/{phases.length} done</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {phases.map((p, i) => (
                <span
                  key={i}
                  className={`text-[10px] px-1.5 py-0.5 rounded border ${PHASE_STATUS_STYLE[p.status] ?? PHASE_STATUS_STYLE.pending}`}
                >
                  {p.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Phase editor row ──────────────────────────────────────────────────────────

function PhaseRow({ phase, onChange, onRemove }) {
  return (
    <div className="flex items-center gap-2">
      <input
        className="input flex-1 text-xs py-1.5"
        placeholder="Phase name (e.g. Framing)"
        value={phase.name}
        onChange={e => onChange({ ...phase, name: e.target.value })}
      />
      <select
        className="input text-xs py-1.5 w-32"
        value={phase.status}
        onChange={e => onChange({ ...phase, status: e.target.value })}
      >
        {PHASE_STATUS_OPTIONS.map(s => (
          <option key={s} value={s}>{s.replace('_', ' ')}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={onRemove}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
        title="Remove phase"
      >
        ×
      </button>
    </div>
  );
}

// ── Job panel (create / edit) ─────────────────────────────────────────────────

const EMPTY_FORM = {
  name: '', address: '', status: 'active',
  start_date: '', end_date: '',
  contract_value: '', cost: '',
  phases: [], notes: '',
};

function JobPanel({ job, onClose, onSaved, onDeleted }) {
  const isNew = !job;

  const [form,    setForm]    = useState(() => job ? {
    name:           job.name           ?? '',
    address:        job.address        ?? '',
    status:         job.status         ?? 'active',
    start_date:     job.start_date     ?? '',
    end_date:       job.end_date       ?? '',
    contract_value: job.contract_value != null ? String(job.contract_value) : '',
    cost:           job.cost           != null ? String(job.cost)           : '',
    phases:         Array.isArray(job.phases) ? job.phases : [],
    notes:          job.notes          ?? '',
  } : { ...EMPTY_FORM });

  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [error,     setError]     = useState('');

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  function addPhase() {
    setForm(f => ({ ...f, phases: [...f.phases, { name: '', status: 'pending' }] }));
  }

  function updatePhase(i, val) {
    setForm(f => {
      const phases = [...f.phases];
      phases[i] = val;
      return { ...f, phases };
    });
  }

  function removePhase(i) {
    setForm(f => ({ ...f, phases: f.phases.filter((_, idx) => idx !== i) }));
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Job name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        name:           form.name.trim(),
        address:        form.address.trim() || null,
        status:         form.status,
        start_date:     form.start_date  || null,
        end_date:       form.end_date    || null,
        contract_value: form.contract_value !== '' ? parseFloat(form.contract_value) : null,
        cost:           form.cost           !== '' ? parseFloat(form.cost)           : null,
        phases:         form.phases.filter(p => p.name.trim()),
        notes:          form.notes.trim() || null,
      };
      const saved = isNew
        ? await jobsApi.create(payload)
        : await jobsApi.update(job.id, payload);
      onSaved(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDel) { setConfirmDel(true); return; }
    setDeleting(true);
    try {
      await jobsApi.remove(job.id);
      onDeleted(job.id);
    } catch (err) {
      setError(err.message);
      setDeleting(false);
    }
  }

  const profit = (parseFloat(form.contract_value) || 0) - (parseFloat(form.cost) || 0);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-rule flex-shrink-0">
          <div>
            <h2 className="font-semibold text-ink">{isNew ? 'New job' : 'Edit job'}</h2>
            {!isNew && <p className="text-xs text-muted mt-0.5">{job.name}</p>}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:bg-fog hover:text-ink transition-colors text-lg"
          >×</button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

          {/* Basic info */}
          <section>
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Basic info</h3>
            <div className="space-y-3">
              <div>
                <label className="label">Job name *</label>
                <input className="input" placeholder="e.g. Kitchen Remodel – 123 Oak St" value={form.name} onChange={set('name')} required />
              </div>
              <div>
                <label className="label">Address</label>
                <input className="input" placeholder="123 Oak St, Springfield" value={form.address} onChange={set('address')} />
              </div>
              <div>
                <label className="label">Status</label>
                <select className="input" value={form.status} onChange={set('status')}>
                  {STATUS_OPTIONS.map(s => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea
                  className="input h-20 resize-none text-sm"
                  placeholder="Any relevant notes about this job…"
                  value={form.notes}
                  onChange={set('notes')}
                />
              </div>
            </div>
          </section>

          {/* Timeline */}
          <section>
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Timeline</h3>
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
            {form.start_date && form.end_date && (
              <div className="mt-3 p-3 bg-fog rounded-lg">
                <TimelineBar startDate={form.start_date} endDate={form.end_date} />
              </div>
            )}
          </section>

          {/* Financials */}
          <section>
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Financials</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Contract value ($)</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.contract_value}
                  onChange={set('contract_value')}
                />
              </div>
              <div>
                <label className="label">Estimated cost ($)</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.cost}
                  onChange={set('cost')}
                />
              </div>
            </div>
            {(form.contract_value || form.cost) && (
              <div className="mt-2 flex items-center gap-4 text-xs px-1">
                <span className="text-muted">Projected profit:&nbsp;
                  <span className={`font-semibold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${profit.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </span>
                </span>
                {parseFloat(form.contract_value) > 0 && (
                  <span className="text-muted">Margin:&nbsp;
                    <span className="font-semibold text-ink">
                      {Math.round((profit / parseFloat(form.contract_value)) * 100)}%
                    </span>
                  </span>
                )}
              </div>
            )}
          </section>

          {/* Phases */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">Phases</h3>
              <button
                type="button"
                onClick={addPhase}
                className="text-xs text-brand-500 hover:text-brand-600 font-medium flex items-center gap-1"
              >
                + Add phase
              </button>
            </div>
            {form.phases.length === 0 ? (
              <p className="text-xs text-muted italic">No phases added yet.</p>
            ) : (
              <div className="space-y-2">
                {form.phases.map((phase, i) => (
                  <PhaseRow
                    key={i}
                    phase={phase}
                    onChange={val => updatePhase(i, val)}
                    onRemove={() => removePhase(i)}
                  />
                ))}
              </div>
            )}
          </section>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2">
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}
        </form>

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-rule flex-shrink-0 bg-white">
          {!isNew ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className={`text-xs font-medium px-3 py-2 rounded-lg transition-colors disabled:opacity-50
                ${confirmDel
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'text-red-500 hover:bg-red-50'
                }`}
            >
              {deleting ? 'Deleting…' : confirmDel ? 'Confirm delete' : 'Delete job'}
            </button>
          ) : <div />}

          <div className="flex items-center gap-2">
            {confirmDel && (
              <button type="button" onClick={() => setConfirmDel(false)} className="btn-secondary text-xs py-2">
                Cancel
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary text-xs py-2"
            >
              {saving ? 'Saving…' : isNew ? 'Create job' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Jobs page ─────────────────────────────────────────────────────────────────

const FILTERS = ['all', 'active', 'paused', 'completed'];

export default function Jobs() {
  const [jobList,   setJobList]   = useState([]);
  const [client,    setClient]    = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState('active');
  const [panel,     setPanel]     = useState(null);   // null | 'new' | job object
  const [search,    setSearch]    = useState('');
  const [toast,     setToast]     = useState('');

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  const fetchAll = useCallback(async () => {
    try {
      const [list, clientData] = await Promise.all([
        jobsApi.list(),
        clients.me(),
      ]);
      setJobList(list || []);
      setClient(clientData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = jobList.filter(j => {
    const matchStatus = filter === 'all' || j.status === filter;
    const matchSearch = !search || j.name.toLowerCase().includes(search.toLowerCase()) ||
      (j.address ?? '').toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  // Stable color map
  const colorMap = {};
  jobList.forEach((job, i) => { colorMap[job.id] = JOB_COLORS[i % JOB_COLORS.length]; });

  function handleSaved(saved) {
    setJobList(prev => {
      const idx = prev.findIndex(j => j.id === saved.id);
      return idx >= 0
        ? prev.map(j => j.id === saved.id ? saved : j)
        : [saved, ...prev];
    });
    setPanel(null);
    showToast(saved.name + ' saved');
  }

  function handleDeleted(id) {
    setJobList(prev => prev.filter(j => j.id !== id));
    setPanel(null);
    showToast('Job deleted');
  }

  // Summary stats
  const activeCount    = jobList.filter(j => j.status === 'active').length;
  const completedCount = jobList.filter(j => j.status === 'completed').length;
  const totalRevenue   = jobList.reduce((s, j) => s + (j.contract_value ?? 0), 0);

  return (
    <div className="flex min-h-screen bg-paper">
      <Sidebar
        companyName={client?.company_name}
        ownerName={client?.owner_name}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-rule">
          <div>
            <h1 className="text-sm font-semibold text-ink">Jobs</h1>
            <p className="text-xs text-muted mt-0.5">
              {activeCount} active · {completedCount} completed
              {totalRevenue > 0 && ` · ${totalRevenue >= 1000 ? `$${(totalRevenue/1000).toFixed(0)}k` : `$${totalRevenue}`} total contract value`}
            </p>
          </div>
          <button onClick={() => setPanel('new')} className="btn-primary text-xs py-1.5 px-4">
            + New job
          </button>
        </div>

        <main className="flex-1 p-6">
          {/* Filter + search bar */}
          <div className="flex items-center justify-between gap-4 mb-5">
            <div className="flex items-center gap-1 bg-white border border-rule rounded-lg p-1">
              {FILTERS.map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors
                    ${filter === f ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`}
                >
                  {f}
                  <span className="ml-1.5 text-[10px] opacity-60">
                    {f === 'all' ? jobList.length : jobList.filter(j => j.status === f).length}
                  </span>
                </button>
              ))}
            </div>
            <input
              className="input text-xs py-1.5 w-48"
              placeholder="Search jobs…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Job grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="animate-pulse bg-gray-200 rounded-xl h-48" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-2xl mb-3">🏗️</div>
              <p className="text-sm font-medium text-ink mb-1">
                {search ? 'No jobs match your search' : filter === 'all' ? 'No jobs yet' : `No ${filter} jobs`}
              </p>
              <p className="text-xs text-muted mb-4">
                {!search && 'Create your first job to get started.'}
              </p>
              {!search && (
                <button onClick={() => setPanel('new')} className="btn-primary text-xs">
                  + New job
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(job => (
                <JobCard
                  key={job.id}
                  job={job}
                  color={colorMap[job.id]}
                  onEdit={j => setPanel(j)}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Create / Edit panel */}
      {panel && (
        <JobPanel
          job={panel === 'new' ? null : panel}
          onClose={() => setPanel(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-ink text-white text-sm font-medium px-4 py-2.5 rounded-lg shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
