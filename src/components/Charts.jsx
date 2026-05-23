import { useState, useEffect } from 'react';
import { TrendingUp, Users, PieChart, BarChart2, RefreshCw } from 'lucide-react';
import { getDonorGrowthChart, getNewVsReturningChart, getSourceBreakdown, getYoyComparison } from '../services/api';

const fmtRM = (n) => `RM ${Number(n || 0).toLocaleString('en-MY', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtMonth = (s) => {
  const [y, m] = s.split('-');
  return new Date(Number(y), Number(m) - 1).toLocaleString('en-MY', { month: 'short', year: '2-digit' });
};
const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const SOURCE_COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#f97316','#84cc16','#ec4899','#6366f1'];

export function DonorGrowthChart() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState(12);

  useEffect(() => {
    setLoading(true);
    getDonorGrowthChart({ months }).then(rows => { setData(rows); setLoading(false); });
  }, [months]);

  const W = 900, H = 300, PL = 56, PR = 16, PT = 16, PB = 36;
  const chartW = W - PL - PR;
  const chartH = H - PT - PB;
  const maxNew = data.length ? Math.max(...data.map(d => d.new_donors), 1) : 1;
  const maxCum = data.length ? Math.max(...data.map(d => d.cumulative), 1) : 1;
  const barW = data.length ? Math.max(6, chartW / data.length - 4) : 20;
  const xPos = (i) => PL + (i + 0.5) * (chartW / (data.length || 1));
  const newYScale = (v) => PT + chartH - (v / maxNew) * chartH;
  const cumYScale = (v) => PT + chartH - (v / maxCum) * chartH;
  const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xPos(i)},${cumYScale(d.cumulative)}`).join(' ');

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
            <TrendingUp className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <p className="font-bold text-slate-900 text-sm">Donor Growth</p>
            <p className="text-xs text-slate-400">New donors per month + cumulative total</p>
          </div>
        </div>
        <div className="flex gap-1">
          {[6, 12, 24].map(m => (
            <button key={m} type="button" onClick={() => setMonths(m)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${months === m ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {m}M
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="flex items-center justify-center h-56 text-slate-400 text-sm">Loading…</div>
      ) : data.length === 0 ? (
        <div className="flex items-center justify-center h-56 text-slate-400 text-sm">No data available</div>
      ) : (
        <>
          <div className="flex items-center gap-4 mb-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded bg-blue-400" />New donors</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-5 bg-emerald-500" />Cumulative</span>
          </div>
          <div className="overflow-x-auto">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: Math.max(280, data.length * 36) }}>
              {[0, 0.25, 0.5, 0.75, 1].map(t => (
                <g key={t}>
                  <line x1={PL} y1={PT + chartH * (1 - t)} x2={W - PR} y2={PT + chartH * (1 - t)} stroke="#f1f5f9" strokeWidth="1" />
                  <text x={PL - 4} y={PT + chartH * (1 - t) + 4} textAnchor="end" fontSize="9" fill="#94a3b8">{Math.round(maxNew * t)}</text>
                </g>
              ))}
              {data.map((d, i) => (
                <rect key={i} x={xPos(i) - barW / 2} y={newYScale(d.new_donors)} width={barW}
                  height={Math.max(0, PT + chartH - newYScale(d.new_donors))} rx="3" fill="#93c5fd" />
              ))}
              {data.length > 1 && <path d={linePath} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
              {data.map((d, i) => <circle key={i} cx={xPos(i)} cy={cumYScale(d.cumulative)} r="3" fill="#10b981" />)}
              {data.map((d, i) => (
                <text key={i} x={xPos(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="#94a3b8">{fmtMonth(d.month)}</text>
              ))}
            </svg>
          </div>
        </>
      )}
    </div>
  );
}

export function NewVsReturningChart() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState(12);

  useEffect(() => {
    setLoading(true);
    getNewVsReturningChart({ months }).then(rows => { setData(rows); setLoading(false); });
  }, [months]);

  const W = 900, H = 300, PL = 40, PR = 16, PT = 16, PB = 36;
  const chartW = W - PL - PR;
  const chartH = H - PT - PB;
  const maxVal = data.length ? Math.max(...data.map(d => d.new + d.returning), 1) : 1;
  const barW = data.length ? Math.max(6, chartW / data.length - 5) : 20;
  const xPos = (i) => PL + (i + 0.5) * (chartW / (data.length || 1));
  const yScale = (v) => (v / maxVal) * chartH;

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
            <Users className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <p className="font-bold text-slate-900 text-sm">New vs Returning Donors</p>
            <p className="text-xs text-slate-400">Monthly breakdown of donor segments</p>
          </div>
        </div>
        <div className="flex gap-1">
          {[6, 12, 24].map(m => (
            <button key={m} type="button" onClick={() => setMonths(m)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${months === m ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {m}M
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="flex items-center justify-center h-56 text-slate-400 text-sm">Loading…</div>
      ) : data.length === 0 ? (
        <div className="flex items-center justify-center h-56 text-slate-400 text-sm">No data available</div>
      ) : (
        <>
          <div className="flex items-center gap-4 mb-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded bg-blue-400" />New</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded bg-emerald-400" />Returning</span>
          </div>
          <div className="overflow-x-auto">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: Math.max(280, data.length * 36) }}>
              {[0, 0.25, 0.5, 0.75, 1].map(t => (
                <g key={t}>
                  <line x1={PL} y1={PT + chartH * (1 - t)} x2={W - PR} y2={PT + chartH * (1 - t)} stroke="#f1f5f9" strokeWidth="1" />
                  <text x={PL - 4} y={PT + chartH * (1 - t) + 4} textAnchor="end" fontSize="9" fill="#94a3b8">{Math.round(maxVal * t)}</text>
                </g>
              ))}
              {data.map((d, i) => {
                const rH = yScale(d.returning);
                const nH = yScale(d.new);
                const baseY = PT + chartH;
                return (
                  <g key={i}>
                    <rect x={xPos(i) - barW / 2} y={baseY - rH} width={barW} height={rH} fill="#6ee7b7" />
                    <rect x={xPos(i) - barW / 2} y={baseY - rH - nH} width={barW} height={nH} rx="3" fill="#93c5fd" />
                    <text x={xPos(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="#94a3b8">{fmtMonth(d.month)}</text>
                  </g>
                );
              })}
            </svg>
          </div>
        </>
      )}
    </div>
  );
}

export function SourceDonutChart() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSourceBreakdown().then(rows => { setData(rows); setLoading(false); });
  }, []);

  const total = data.reduce((s, d) => s + d.total, 0);
  const R = 72, CX = 100, CY = 100, inner = 44;
  const slices = [];
  let angle = -Math.PI / 2;
  data.forEach((d, i) => {
    const frac = total > 0 ? d.total / total : 0;
    const sweep = frac * 2 * Math.PI;
    const x1 = CX + R * Math.cos(angle), y1 = CY + R * Math.sin(angle);
    const x2 = CX + R * Math.cos(angle + sweep), y2 = CY + R * Math.sin(angle + sweep);
    const xi1 = CX + inner * Math.cos(angle), yi1 = CY + inner * Math.sin(angle);
    const xi2 = CX + inner * Math.cos(angle + sweep), yi2 = CY + inner * Math.sin(angle + sweep);
    const large = sweep > Math.PI ? 1 : 0;
    slices.push({
      d: `M${xi1},${yi1} A${inner},${inner} 0 ${large} 1 ${xi2},${yi2} L${x2},${y2} A${R},${R} 0 ${large} 0 ${x1},${y1} Z`,
      color: SOURCE_COLORS[i % SOURCE_COLORS.length], frac, label: d.source, total: d.total,
    });
    angle += sweep;
  });

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center gap-3 mb-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50">
          <PieChart className="h-5 w-5 text-violet-500" />
        </div>
        <div>
          <p className="font-bold text-slate-900 text-sm">Source Breakdown</p>
          <p className="text-xs text-slate-400">Donation amount by acquisition source</p>
        </div>
      </div>
      {loading ? (
        <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Loading…</div>
      ) : data.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-slate-400 text-sm">No data available</div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <svg viewBox="0 0 200 200" className="w-44 shrink-0">
            {slices.map((s, i) => <path key={i} d={s.d} fill={s.color} />)}
            <circle cx={CX} cy={CY} r={inner - 2} fill="white" />
            <text x={CX} y={CY - 6} textAnchor="middle" fontSize="10" fill="#475569" fontWeight="600">Total</text>
            <text x={CX} y={CY + 10} textAnchor="middle" fontSize="9" fill="#94a3b8">{fmtRM(total)}</text>
          </svg>
          <div className="flex-1 space-y-2 w-full">
            {slices.map((s, i) => (
              <div key={i} className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                  <span className="text-slate-700 truncate capitalize">{s.label}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-slate-500">{fmtRM(s.total)}</span>
                  <span className="text-slate-400 w-9 text-right">{(s.frac * 100).toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const YEAR_COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#f97316','#ec4899'];

export function YoyChart() {
  const [result, setResult] = useState({ years: [], data: [] });
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(new Set());

  useEffect(() => {
    getYoyComparison().then(r => { setResult(r); setLoading(false); });
  }, []);

  const { years, data } = result;
  const visibleYears = years.filter(y => !hidden.has(y));

  const toggleYear = (y) => setHidden(prev => {
    const next = new Set(prev);
    next.has(y) ? next.delete(y) : next.add(y);
    return next;
  });

  const W = 620, H = 240, PL = 64, PR = 16, PT = 16, PB = 36;
  const chartW = W - PL - PR;
  const chartH = H - PT - PB;
  const fmtK = (v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(Math.round(v));

  const maxVal = data.length && visibleYears.length
    ? Math.max(...data.map(d => Math.max(...visibleYears.map(y => d[y] || 0))), 1)
    : 1;

  const groupW = chartW / 12;
  const gap = 2;
  const barW = visibleYears.length > 0 ? Math.max(4, (groupW - gap * (visibleYears.length + 1)) / visibleYears.length) : groupW * 0.6;
  const totalBarBlock = visibleYears.length * barW + (visibleYears.length - 1) * gap;
  const groupX = (i) => PL + i * groupW + groupW / 2 - totalBarBlock / 2;
  const barX = (monthIdx, yearIdx) => groupX(monthIdx) + yearIdx * (barW + gap);
  const barH = (v) => Math.max(0, (v / maxVal) * chartH);
  const barY = (v) => PT + chartH - barH(v);

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
            <BarChart2 className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <p className="font-bold text-slate-900 text-sm">Year-over-Year Comparison</p>
            <p className="text-xs text-slate-400">Monthly donation totals — all years in data</p>
          </div>
        </div>
        {years.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {years.map((y, i) => {
              const color = YEAR_COLORS[i % YEAR_COLORS.length];
              const isHidden = hidden.has(y);
              return (
                <button key={y} type="button" onClick={() => toggleYear(y)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold border transition ${isHidden ? 'border-slate-200 bg-white text-slate-400' : 'border-transparent text-white'}`}
                  style={isHidden ? {} : { backgroundColor: color }}>
                  <span className="inline-block h-2 w-2 rounded-sm" style={{ background: isHidden ? '#cbd5e1' : '#fff' }} />
                  {y}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-56 text-slate-400 text-sm">Loading…</div>
      ) : data.length === 0 || years.length === 0 ? (
        <div className="flex items-center justify-center h-56 text-slate-400 text-sm">No data available</div>
      ) : (
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 420 }}>
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map(t => (
              <g key={t}>
                <line x1={PL} y1={PT + chartH * (1 - t)} x2={W - PR} y2={PT + chartH * (1 - t)} stroke="#f1f5f9" strokeWidth="1" />
                <text x={PL - 6} y={PT + chartH * (1 - t) + 4} textAnchor="end" fontSize="9" fill="#94a3b8">{fmtK(maxVal * t)}</text>
              </g>
            ))}
            {/* Bars */}
            {data.map((d, mi) =>
              visibleYears.map((year, yi) => {
                const color = YEAR_COLORS[years.indexOf(year) % YEAR_COLORS.length];
                const v = d[year] || 0;
                const h = barH(v);
                return h > 0 ? (
                  <rect key={`${mi}-${year}`}
                    x={barX(mi, yi)} y={barY(v)}
                    width={barW} height={h}
                    rx="2" fill={color} fillOpacity="0.85"
                  />
                ) : null;
              })
            )}
            {/* Month labels */}
            {MONTH_LABELS.map((lbl, i) => (
              <text key={i} x={PL + i * groupW + groupW / 2} y={H - 8} textAnchor="middle" fontSize="9" fill="#94a3b8">{lbl}</text>
            ))}
          </svg>
        </div>
      )}
    </div>
  );
}

export default function Charts() {
  const [key, setKey] = useState(0);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div>
          <p className="font-bold text-slate-900">Advanced Charts</p>
          <p className="text-sm text-slate-400">Visual analytics across donor behaviour and donation trends</p>
        </div>
        <button type="button" onClick={() => setKey(k => k + 1)}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">
          <RefreshCw className="h-4 w-4" />
          Refresh all
        </button>
      </div>
      <div key={key} className="space-y-6">
        <DonorGrowthChart />
        <NewVsReturningChart />
        <SourceDonutChart />
        <YoyChart />
      </div>
    </div>
  );
}
