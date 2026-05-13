import { useState } from 'react';
import { schedules } from '../lib/api.js';

const CONFLICT_CONFIG = {
  double_booking: {
    label: 'Double Booking',
    icon:  '👷',
    bar:   'bg-red-500',
    card:  'border-red-200 bg-red-50',
    badge: 'bg-red-100 text-red-700',
  },
  sub_timing: {
    label: 'Sub Timing',
    icon:  '📅',
    bar:   'bg-amber-500',
    card:  'border-amber-200 bg-amber-50',
    badge: 'bg-amber-100 text-amber-700',
  },
  delay_cascade: {
    label: 'Delay Risk',
    icon:  '⚠️',
    bar:   'bg-orange-500',
    card:  'border-orange-200 bg-orange-50',
    badge: 'bg-orange-100 text-orange-700',
  },
};

function cfg(type) {
  return CONFLICT_CONFIG[type] ?? {
    label: 'Conflict', icon: '⚡',
    bar: 'bg-gray-400', card: 'border-gray-200 bg-gray-50', badge: 'bg-gray-100 text-gray-700',
  };
}

function SuggestionList({ suggestions = [] }) {
  if (!suggestions.length) return null;
  return (
    <div className="mt-3 space-y-1.5">
      <p className="text-xs font-medium text-gray-500">Suggested fixes:</p>
      {suggestions.slice(0, 3).map((s, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className={`mt-0.5 flex-shrink-0 text-xs font-bold px-1.5 rounded
            ${s.impact === 'high' ? 'bg-red-100 text-red-600' :
              s.impact === 'medium' ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-500'}
          `}>
            {s.impact?.toUpperCase()}
          </span>
          <div>
            <p className="text-xs font-medium text-gray-700">{s.action}</p>
            <p className="text-xs text-gray-500">{s.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ConflictCard({ conflict, onResolve, onAskAI }) {
  const c = cfg(conflict.conflict_type);
  const [resolving, setResolving] = useState(false);
  const [expanded, setExpanded]   = useState(false);

  async function handleResolve(e) {
    e.stopPropagation();
    setResolving(true);
    await onResolve(conflict.id);
  }

  function handleAskAI(e) {
    e.stopPropagation();
    onAskAI(
      `I have a ${c.label.toLowerCase()} conflict: "${conflict.description}" What's the best way to resolve this?`
    );
  }

  return (
    <div className={`rounded-lg border ${c.card} overflow-hidden`}>
      {/* Colored left bar */}
      <div className="flex">
        <div className={`w-1 flex-shrink-0 ${c.bar}`} />
        <div className="flex-1 p-3">
          {/* Header row */}
          <div
            className="flex items-start justify-between gap-2 cursor-pointer"
            onClick={() => setExpanded(e => !e)}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base">{c.icon}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.badge}`}>
                {c.label}
              </span>
              <p className="text-sm text-gray-700 flex-1">{conflict.description}</p>
            </div>
            <span className="text-gray-300 text-xs flex-shrink-0">{expanded ? '▲' : '▼'}</span>
          </div>

          {/* Expanded details */}
          {expanded && (
            <div className="mt-2">
              {conflict.ai_suggestions?.length > 0 && (
                <SuggestionList suggestions={conflict.ai_suggestions} />
              )}
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={handleAskAI}
                  className="text-xs font-medium text-brand-600 hover:text-brand-700 border border-brand-300 hover:border-brand-400 bg-white px-2.5 py-1 rounded-md transition-colors"
                >
                  Ask AI
                </button>
                <button
                  onClick={handleResolve}
                  disabled={resolving}
                  className="text-xs font-medium text-gray-600 hover:text-gray-800 border border-gray-300 hover:border-gray-400 bg-white px-2.5 py-1 rounded-md transition-colors disabled:opacity-50"
                >
                  {resolving ? 'Resolving…' : 'Mark resolved'}
                </button>
              </div>
            </div>
          )}

          {/* Quick action row (always visible) */}
          {!expanded && (
            <div className="flex items-center gap-2 mt-2">
              <button onClick={handleAskAI} className="text-xs text-brand-600 hover:text-brand-700 font-medium">
                Ask AI →
              </button>
              <span className="text-gray-200">|</span>
              <button onClick={handleResolve} disabled={resolving} className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-50">
                {resolving ? 'Resolving…' : 'Resolve'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ConflictAlerts({ conflicts = [], onResolve, onAskAI }) {
  const [dismissed, setDismissed] = useState(false);

  if (conflicts.length === 0 || dismissed) return null;

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <h2 className="font-semibold text-gray-900 text-sm">
            {conflicts.length} Conflict{conflicts.length !== 1 ? 's' : ''} Detected
          </h2>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-gray-300 hover:text-gray-500 text-lg leading-none transition-colors"
          aria-label="Dismiss alerts"
        >
          ×
        </button>
      </div>

      <div className="p-3 space-y-2">
        {conflicts.map(conflict => (
          <ConflictCard
            key={conflict.id}
            conflict={conflict}
            onResolve={onResolve}
            onAskAI={onAskAI}
          />
        ))}
      </div>
    </div>
  );
}
