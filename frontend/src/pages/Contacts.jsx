import { useCallback, useEffect, useState } from 'react';
import { contacts as contactsApi, clients } from '../lib/api.js';
import Sidebar from '../components/Sidebar.jsx';

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPES = ['client', 'subcontractor', 'vendor', 'supplier', 'other'];
const FILTERS = ['all', ...TYPES];

const TYPE_STYLE = {
  client:        { pill: 'bg-blue-50 text-blue-700 border border-blue-200',       dot: 'bg-blue-400'   },
  subcontractor: { pill: 'bg-purple-50 text-purple-700 border border-purple-200', dot: 'bg-purple-400' },
  vendor:        { pill: 'bg-amber-50 text-amber-700 border border-amber-200',    dot: 'bg-amber-400'  },
  supplier:      { pill: 'bg-green-50 text-green-700 border border-green-200',    dot: 'bg-green-400'  },
  other:         { pill: 'bg-gray-100 text-gray-600 border border-gray-200',      dot: 'bg-gray-400'   },
};

const AVATAR_COLORS = [
  'bg-violet-100 text-violet-700', 'bg-sky-100 text-sky-700',
  'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700',
  'bg-pink-100 text-pink-700', 'bg-indigo-100 text-indigo-700',
];

function avatarColor(name = '') {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function initials(name = '') {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

// ── Contact card ──────────────────────────────────────────────────────────────

function ContactCard({ contact, onEdit }) {
  const s = TYPE_STYLE[contact.type] ?? TYPE_STYLE.other;
  return (
    <div
      onClick={() => onEdit(contact)}
      className="bg-white rounded-xl border border-rule shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow flex flex-col gap-3"
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${avatarColor(contact.name)}`}>
          {initials(contact.name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink truncate">{contact.name}</p>
          {contact.company && <p className="text-xs text-muted truncate">{contact.company}</p>}
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize flex-shrink-0 ${s.pill}`}>
          {contact.type}
        </span>
      </div>

      <div className="space-y-1.5 text-xs">
        {contact.email && (
          <a
            href={`mailto:${contact.email}`}
            onClick={e => e.stopPropagation()}
            className="flex items-center gap-2 text-muted hover:text-brand-500 transition-colors group"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 opacity-50 group-hover:opacity-100">
              <rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M1 5l7 5 7-5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
            </svg>
            <span className="truncate">{contact.email}</span>
          </a>
        )}
        {contact.phone && (
          <a
            href={`tel:${contact.phone}`}
            onClick={e => e.stopPropagation()}
            className="flex items-center gap-2 text-muted hover:text-brand-500 transition-colors group"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 opacity-50 group-hover:opacity-100">
              <path d="M3 1h3l1.5 4-2 1.5a9 9 0 004 4L11 8.5l4 1.5v3a1 1 0 01-1 1A13 13 0 012 2a1 1 0 011-1z"
                stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
            </svg>
            <span className="truncate">{contact.phone}</span>
          </a>
        )}
        {contact.notes && (
          <p className="text-muted line-clamp-2 leading-relaxed pt-0.5 border-t border-gray-50">{contact.notes}</p>
        )}
      </div>
    </div>
  );
}

// ── Contact panel ─────────────────────────────────────────────────────────────

const EMPTY = { name: '', company: '', email: '', phone: '', type: 'client', notes: '' };

function ContactPanel({ contact, onClose, onSaved, onDeleted }) {
  const isNew = !contact;
  const [form,       setForm]       = useState(contact ? { ...EMPTY, ...contact } : { ...EMPTY });
  const [saving,     setSaving]     = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [error,      setError]      = useState('');

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        name:    form.name.trim(),
        company: form.company.trim() || null,
        email:   form.email.trim()   || null,
        phone:   form.phone.trim()   || null,
        type:    form.type,
        notes:   form.notes.trim()   || null,
      };
      const saved = isNew
        ? await contactsApi.create(payload)
        : await contactsApi.update(contact.id, payload);
      onSaved(saved);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!confirmDel) { setConfirmDel(true); return; }
    setDeleting(true);
    try { await contactsApi.remove(contact.id); onDeleted(contact.id); }
    catch (err) { setError(err.message); setDeleting(false); }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-rule flex-shrink-0">
          <div>
            <h2 className="font-semibold text-ink">{isNew ? 'New contact' : 'Edit contact'}</h2>
            {!isNew && <p className="text-xs text-muted mt-0.5">{contact.name}</p>}
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:bg-fog hover:text-ink transition-colors text-lg">×</button>
        </div>

        <form onSubmit={handleSave} className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <div>
            <label className="label">Name *</label>
            <input className="input" placeholder="Jane Smith" value={form.name} onChange={set('name')} required />
          </div>
          <div>
            <label className="label">Company</label>
            <input className="input" placeholder="Acme Construction" value={form.company} onChange={set('company')} />
          </div>
          <div>
            <label className="label">Type</label>
            <select className="input" value={form.type} onChange={set('type')}>
              {TYPES.map(t => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" placeholder="jane@example.com" value={form.email} onChange={set('email')} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" type="tel" placeholder="+1 555 000 0000" value={form.phone} onChange={set('phone')} />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input h-24 resize-none text-sm" placeholder="Any notes…" value={form.notes} onChange={set('notes')} />
          </div>
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
              {saving ? 'Saving…' : isNew ? 'Add contact' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Contacts page ─────────────────────────────────────────────────────────────

export default function Contacts() {
  const [list,    setList]    = useState([]);
  const [client,  setClient]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('all');
  const [search,  setSearch]  = useState('');
  const [panel,   setPanel]   = useState(null);
  const [toast,   setToast]   = useState('');

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  const fetchAll = useCallback(async () => {
    try {
      const [data, c] = await Promise.all([contactsApi.list(), clients.me()]);
      setList(data || []);
      setClient(c);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = list.filter(c => {
    const matchType   = filter === 'all' || c.type === filter;
    const matchSearch = !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.company ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (c.email   ?? '').toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  function handleSaved(saved) {
    setList(prev => {
      const idx = prev.findIndex(c => c.id === saved.id);
      return idx >= 0 ? prev.map(c => c.id === saved.id ? saved : c) : [saved, ...prev];
    });
    setPanel(null);
    showToast(saved.name + ' saved');
  }
  function handleDeleted(id) { setList(p => p.filter(c => c.id !== id)); setPanel(null); showToast('Contact deleted'); }

  const counts = FILTERS.reduce((acc, f) => {
    acc[f] = f === 'all' ? list.length : list.filter(c => c.type === f).length;
    return acc;
  }, {});

  return (
    <div className="flex min-h-screen bg-paper">
      <Sidebar companyName={client?.company_name} ownerName={client?.owner_name} />

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-rule">
          <div>
            <h1 className="text-sm font-semibold text-ink">Contacts</h1>
            <p className="text-xs text-muted mt-0.5">{list.length} contact{list.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => setPanel('new')} className="btn-primary text-xs py-1.5 px-4">+ New contact</button>
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
            <input className="input text-xs py-1.5 w-48" placeholder="Search contacts…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1,2,3,4,5,6].map(i => <div key={i} className="animate-pulse bg-gray-200 rounded-xl h-36" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-2xl mb-3">👤</div>
              <p className="text-sm font-medium text-ink mb-1">{search ? 'No contacts match your search' : 'No contacts yet'}</p>
              {!search && <button onClick={() => setPanel('new')} className="btn-primary text-xs mt-3">+ Add your first contact</button>}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(c => (
                <ContactCard key={c.id} contact={c} onEdit={setPanel} />
              ))}
            </div>
          )}
        </main>
      </div>

      {panel && (
        <ContactPanel
          contact={panel === 'new' ? null : panel}
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
