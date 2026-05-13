import { useState } from 'react';

const STATUS_STYLES = {
  active:    { dot: 'bg-green-400',  badge: 'bg-green-50 text-green-700 border-green-200',  label: 'Active'    },
  paused:    { dot: 'bg-amber-400',  badge: 'bg-amber-50 text-amber-700 border-amber-200',  label: 'Paused'    },
  completed: { dot: 'bg-gray-300',   badge: 'bg-gray-50  text-gray-600  border-gray-200',   label: 'Completed' },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.active;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium border px-2 py-0.5 rounded-full ${s.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function daysLeft(endDateStr) {
  if (!endDateStr) return null;
  const [y, m, d] = endDateStr.split('-').map(Number);
  const end   = new Date(y, m - 1, d);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff  = Math.ceil((end - today) / 86400000);
  return diff;
}

function DaysChip({ endDate, status }) {
  if (status !== 'active' || !endDate) return null;
  const n = daysLeft(endDate);
  if (n === null) return null;
  if (n < 0)  return <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">{Math.abs(n)}d overdue</span>;
  if (n <= 3) return <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{n}d left</span>;
  return <span className="text-xs text-gray-400">{n}d left</span>;
}

function JobRow({ job }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className="hover:bg-gray-50 cursor-pointer transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900">{job.name}</span>
            <DaysChip endDate={job.end_date} status={job.status} />
          </div>
          {job.address && (
            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{job.address}</p>
          )}
        </td>
        <td className="px-4 py-3">
          <StatusBadge status={job.status} />
        </td>
        <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">
          {formatDate(job.start_date)}
        </td>
        <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">
          {formatDate(job.end_date)}
        </td>
        <td className="px-4 py-3 text-right">
          <span className="text-gray-300 text-xs">{expanded ? '▲' : '▼'}</span>
        </td>
      </tr>

      {expanded && (
        <tr className="bg-gray-50 border-t border-gray-100">
          <td colSpan={5} className="px-4 py-3">
            {Array.isArray(job.phases) && job.phases.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Phases</p>
                <div className="flex flex-wrap gap-2">
                  {job.phases.map((phase, i) => (
                    <span
                      key={i}
                      className={`text-xs px-2 py-1 rounded-full border font-medium
                        ${phase.status === 'complete' ? 'bg-green-50 text-green-700 border-green-200' :
                          phase.status === 'in_progress' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          'bg-gray-100 text-gray-600 border-gray-200'}`}
                    >
                      {phase.name}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400">No phases defined.</p>
            )}
            {job.notes && (
              <p className="text-xs text-gray-500 mt-2 italic">Note: {job.notes}</p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export default function JobBoard({ jobs = [] }) {
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all' ? jobs : jobs.filter(j => j.status === filter);

  const counts = {
    all:       jobs.length,
    active:    jobs.filter(j => j.status === 'active').length,
    paused:    jobs.filter(j => j.status === 'paused').length,
    completed: jobs.filter(j => j.status === 'completed').length,
  };

  const tabs = [
    { key: 'all',       label: 'All'       },
    { key: 'active',    label: 'Active'    },
    { key: 'paused',    label: 'Paused'    },
    { key: 'completed', label: 'Completed' },
  ];

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h2 className="font-semibold text-gray-900">Job Board</h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 pb-3 border-b border-gray-100">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors
              ${filter === t.key
                ? 'bg-gray-900 text-white'
                : 'text-gray-500 hover:bg-gray-100'
              }`}
          >
            {t.label}
            <span className="ml-1 opacity-60">({counts[t.key]})</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-sm text-gray-400">No jobs found.</p>
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Job</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider hidden sm:table-cell">Start</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider hidden sm:table-cell">End</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map(job => <JobRow key={job.id} job={job} />)}
          </tbody>
        </table>
      )}
    </div>
  );
}
