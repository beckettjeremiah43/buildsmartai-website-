import { useState } from 'react';
import { crew as crewApi } from '../lib/api.js';

const STATUS_CONFIG = {
  available: { label: 'Available', dot: 'bg-green-400',  text: 'text-green-700', bg: 'bg-green-50'  },
  on_site:   { label: 'On Site',   dot: 'bg-blue-400',   text: 'text-blue-700',  bg: 'bg-blue-50'   },
  sick:      { label: 'Sick',      dot: 'bg-red-400',    text: 'text-red-700',   bg: 'bg-red-50'    },
  off:       { label: 'Off',       dot: 'bg-gray-300',   text: 'text-gray-500',  bg: 'bg-gray-100'  },
};

function statusCfg(status) {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG.available;
}

function initials(name) {
  return name
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const AVATAR_COLORS = [
  'bg-violet-100 text-violet-700',
  'bg-sky-100 text-sky-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-pink-100 text-pink-700',
];

function avatarColor(name) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffff;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function CrewCard({ member, todayAssignment }) {
  const cfg = statusCfg(member.status);

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors bg-white">
      {/* Avatar */}
      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${avatarColor(member.name)}`}>
        {initials(member.name)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-900 truncate">{member.name}</span>
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        </div>

        {todayAssignment ? (
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            📍 {todayAssignment.jobs?.name ?? 'Assigned'}
          </p>
        ) : (
          member.status === 'available' && (
            <p className="text-xs text-gray-400 mt-0.5">No assignment today</p>
          )
        )}

        {member.skills?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {member.skills.slice(0, 3).map(skill => (
              <span key={skill} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                {skill}
              </span>
            ))}
            {member.skills.length > 3 && (
              <span className="text-xs text-gray-400">+{member.skills.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CrewPanel({ crew = [], assignments = [], onRefresh }) {
  const [filter, setFilter] = useState('all');

  const today = new Date().toISOString().split('T')[0];

  const todayAssignmentsByCrewId = assignments
    .filter(a => a.date === today)
    .reduce((acc, a) => { acc[a.crew_id] = a; return acc; }, {});

  const filtered = filter === 'all'
    ? crew
    : crew.filter(c => c.status === filter);

  const counts = {
    all:       crew.length,
    available: crew.filter(c => c.status === 'available').length,
    on_site:   crew.filter(c => c.status === 'on_site').length,
    sick:      crew.filter(c => c.status === 'sick').length,
  };

  const tabs = [
    { key: 'all',       label: 'All'       },
    { key: 'on_site',   label: 'On Site'   },
    { key: 'available', label: 'Available' },
    { key: 'sick',      label: 'Sick'      },
  ];

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h2 className="font-semibold text-gray-900">Crew</h2>
        {onRefresh && (
          <button onClick={onRefresh} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            ↻ Refresh
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 px-4 pb-3 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors
              ${filter === t.key ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            {t.label}
            {counts[t.key] > 0 && (
              <span className="ml-1 opacity-60">({counts[t.key]})</span>
            )}
          </button>
        ))}
      </div>

      {/* Crew list */}
      <div className="px-4 pb-4 space-y-2">
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            {crew.length === 0 ? 'No crew members added yet.' : 'No crew in this category.'}
          </p>
        ) : (
          filtered.map(member => (
            <CrewCard
              key={member.id}
              member={member}
              todayAssignment={todayAssignmentsByCrewId[member.id]}
            />
          ))
        )}
      </div>
    </div>
  );
}
