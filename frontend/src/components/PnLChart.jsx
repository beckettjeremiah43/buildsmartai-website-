import { useEffect, useState } from 'react';
import { jobs as jobsApi } from '../lib/api.js';

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmt(n) {
  if (n === 0) return '$0';
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `$${n}`;
}

function monthLabel(iso) {
  const [, m] = iso.split('-');
  return MONTH_ABBR[parseInt(m, 10) - 1];
}

// ── SVG bar chart ─────────────────────────────────────────────────────────────

function Chart({ data }) {
  const [hovered, setHovered] = useState(null);

  const W = 600, H = 200;
  const PAD = { top: 16, right: 16, bottom: 28, left: 48 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top  - PAD.bottom;

  const maxVal = Math.max(...data.flatMap(d => [d.revenue, d.cost]), 1);
  // Round up to a clean ceiling
  const ceil   = Math.ceil(maxVal / 1000) * 1000 || 1000;

  const n      = data.length;
  const groupW = innerW / n;
  const barW   = Math.min(groupW * 0.3, 22);
  const gap    = 4;

  function barX(i, which) {
    const cx = PAD.left + groupW * i + groupW / 2;
    return which === 'revenue' ? cx - barW - gap / 2 : cx + gap / 2;
  }
  function barH(val)  { return (val / ceil) * innerH; }
  function barY(val)  { return PAD.top + innerH - barH(val); }

  // Y-axis ticks
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(ceil * f));

  // Profit line points
  const linePoints = data.map((d, i) => {
    const cx = PAD.left + groupW * i + groupW / 2;
    const y  = PAD.top + innerH - (d.profit / ceil) * innerH;
    return `${cx},${y}`;
  }).join(' ');

  const hoveredItem = hovered !== null ? data[hovered] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: 200, overflow: 'visible' }}
      >
        {/* Y-axis grid + labels */}
        {ticks.map(tick => {
          const y = PAD.top + innerH - (tick / ceil) * innerH;
          return (
            <g key={tick}>
              <line
                x1={PAD.left} y1={y} x2={PAD.left + innerW} y2={y}
                stroke="#e8e8e8" strokeWidth="1" strokeDasharray={tick === 0 ? '0' : '3,3'}
              />
              <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize="9" fill="#8c8c8c">
                {fmt(tick)}
              </text>
            </g>
          );
        })}

        {/* Zero line bold */}
        <line
          x1={PAD.left} y1={PAD.top + innerH}
          x2={PAD.left + innerW} y2={PAD.top + innerH}
          stroke="#c8c8c8" strokeWidth="1.5"
        />

        {/* Bars */}
        {data.map((d, i) => (
          <g
            key={i}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: 'default' }}
          >
            {/* Hover highlight */}
            <rect
              x={PAD.left + groupW * i + 2}
              y={PAD.top}
              width={groupW - 4}
              height={innerH}
              fill={hovered === i ? 'rgba(71,200,255,0.04)' : 'transparent'}
              rx="4"
            />

            {/* Revenue bar */}
            <rect
              x={barX(i, 'revenue')}
              y={barY(d.revenue)}
              width={barW}
              height={barH(d.revenue)}
              rx="3"
              fill={hovered === i ? '#22c55e' : '#4ade80'}
              opacity={hovered !== null && hovered !== i ? 0.4 : 1}
            />

            {/* Cost bar */}
            <rect
              x={barX(i, 'cost')}
              y={barY(d.cost)}
              width={barW}
              height={barH(d.cost)}
              rx="3"
              fill={hovered === i ? '#f97316' : '#fb923c'}
              opacity={hovered !== null && hovered !== i ? 0.4 : 1}
            />

            {/* X label */}
            <text
              x={PAD.left + groupW * i + groupW / 2}
              y={H - 6}
              textAnchor="middle"
              fontSize="9"
              fill={hovered === i ? '#0d0d0d' : '#8c8c8c'}
              fontWeight={hovered === i ? '600' : '400'}
            >
              {monthLabel(d.month)}
            </text>
          </g>
        ))}

        {/* Profit line */}
        <polyline
          points={linePoints}
          fill="none"
          stroke="#6366f1"
          strokeWidth="1.5"
          strokeLinejoin="round"
          opacity="0.8"
        />

        {/* Profit dots */}
        {data.map((d, i) => {
          const cx = PAD.left + groupW * i + groupW / 2;
          const cy = PAD.top + innerH - (d.profit / ceil) * innerH;
          return (
            <circle
              key={i}
              cx={cx} cy={cy} r={hovered === i ? 4 : 2.5}
              fill={d.profit >= 0 ? '#6366f1' : '#ef4444'}
              stroke="white" strokeWidth="1"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'default', transition: 'r 0.15s' }}
            />
          );
        })}
      </svg>

      {/* Tooltip */}
      {hoveredItem && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none
          bg-ink text-white rounded-lg shadow-xl px-3 py-2 text-xs z-10 whitespace-nowrap"
          style={{ marginTop: -8 }}>
          <p className="font-semibold mb-1">{monthLabel(hoveredItem.month)}</p>
          <div className="space-y-0.5">
            <p><span className="text-green-400">●</span> Revenue <span className="font-medium ml-1">{fmt(hoveredItem.revenue)}</span></p>
            <p><span className="text-orange-400">●</span> Cost    <span className="font-medium ml-1">{fmt(hoveredItem.cost)}</span></p>
            <p className={`font-semibold ${hoveredItem.profit >= 0 ? 'text-indigo-300' : 'text-red-400'}`}>
              <span>●</span> Profit <span className="ml-1">{fmt(hoveredItem.profit)}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-xl mb-3">📊</div>
      <p className="text-sm font-medium text-ink mb-1">No financial data yet</p>
      <p className="text-xs text-muted max-w-[220px]">
        Add a <span className="font-medium text-ink">Contract Value</span> and <span className="font-medium text-ink">Cost</span> to your jobs to track P&amp;L here.
      </p>
    </div>
  );
}

// ── PnLChart ──────────────────────────────────────────────────────────────────

export default function PnLChart() {
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    jobsApi.pnl(6)
      .then(rows => setData(rows || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const hasData = data.some(d => d.revenue > 0 || d.cost > 0);

  // Summary totals
  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
  const totalCost    = data.reduce((s, d) => s + d.cost,    0);
  const totalProfit  = totalRevenue - totalCost;
  const margin       = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : null;

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div>
          <h2 className="font-semibold text-gray-900">Profit &amp; Loss</h2>
          <p className="text-xs text-gray-400 mt-0.5">Last 6 months</p>
        </div>

        {hasData && (
          <div className="flex items-center gap-4 text-right">
            <div>
              <p className="text-[10px] text-muted uppercase tracking-wider">Revenue</p>
              <p className="text-sm font-semibold text-green-600">{fmt(totalRevenue)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted uppercase tracking-wider">Cost</p>
              <p className="text-sm font-semibold text-orange-500">{fmt(totalCost)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted uppercase tracking-wider">Profit</p>
              <p className={`text-sm font-semibold ${totalProfit >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>
                {fmt(totalProfit)}
                {margin !== null && <span className="text-[10px] font-normal text-muted ml-1">({margin}%)</span>}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      {hasData && (
        <div className="flex items-center gap-4 px-4 pt-3">
          {[
            ['bg-green-400',  'Revenue'],
            ['bg-orange-400', 'Cost'],
            ['bg-indigo-500', 'Profit'],
          ].map(([cls, label]) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-sm ${cls}`} />
              <span className="text-xs text-gray-500">{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Body */}
      <div className="px-2 pb-3 pt-2">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : hasData ? (
          <Chart data={data} />
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}
