import { useState, useEffect } from 'react';
import { TrendingUp, Users, PieChart, BarChart2, RefreshCw } from 'lucide-react';
import { getDonorGrowthChart, getNewVsReturningChart, getSourceBreakdown, getYoyComparison } from '../services/api';

const fmtRM = (n) => `RM ${Number(n || 0).toLocaleString('en-MY', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtMonth = (s) => {
  const [y, m] = s.split('-');
  return new Date(Number(y), Number(m) - 1).toLocaleString('en-MY', { month: 'short', year: '2-digit' });
};
const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const SOURCE_COLORS = [
  '#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#f97316','#84cc16','#ec4899','#6366f1',
];

// ── Donor Growth Line Chart ────────────────────────────────────────────────────
export function DonorGrowthChart() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState(12);

  const load = async (m) => {
    setLoading(true);
    const rows = await getDonorGrowthChart({ months: m });
    setData(rows);
    setLoading(false);
  };

  useEffect(() => { load(months); }, [months]);

  const W = 560, H = 220, PL = 56, PR = 16, PT = 16, PB = 36;
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
              {/* Y gridlines */}
              {[0, 0.25, 0.5, 0.75, 1].map(t => (
                <g key={t}>
                  <line x1={PL} y1={PT + chartH * (1 - t)} x2={W - PR} y2={PT + chartH * (1 - t)}
                    stroke="#f1f5f9" strokeWidth="1" />
                  <text x={PL - 4} y={PT + chartH * (1 - t) + 4} textAnchor="end" fontSize="9" fill="#94a3b8">
                    {Math.round(maxNew * t)}
                  </text>
                </g>
              ))}
              {/* Bars for new donors */}
              {data.map((d, i) => (
                <rect key={i}
                  x={xPos(i) - barW / 2}
                  y={newYScale(d.new_donors)}
                  width={barW}
                  height={Math.max(0, PT + chartH - newYScale(d.new_donors))}
                  rx="3" fill="#93c5fd" />
              ))}
              {/* Cumulative line */}
              {data.length > 1 && (
                <path d={linePath} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
              )}
              {/* Dots on cumulative */}
              {data.map((d, i) => (
                <circle key={i} cx={xPos(i)} cy={cumYScale(d.cumulative)} r="3" fill="#10b981" />
              ))}
              {/* X labels */}
              {data.map((d, i) => (
                <text key={i} x={xPos(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="#94a3b8">
                  {fmtMonth(d.month)}
                </text>
              ))}
            </svg>
          </div>
        </>
      )}
    </div>
  );
}

// ── New vs Returning Stacked Bar ──────────────────────────────────────────────
export function NewVsReturningChart() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState(12);

  const load = async (m) => {
    setLoading(true);
    const rows = await getNewVsReturningChart({ months: m });
    setData(rows);
    setLoading(false);
  };

  useEffect(() => { load(months); }, [months]);

  const W = 560, H = 220, PL = 40, PR = 16, PT = 16, PB = 36;
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
                  <text x={PL - 4} y={PT + chartH * (1 - t) + 4} textAnchor="end" fontSize="9" fill="#94a3b8">
                    {Math.round(maxVal * t)}
                  </text>
                </g>
              ))}
              {data.map((d, i) => {
                const returningH = yScale(d.returning);
                const newH = yScale(d.new);
                const total = returningH + newH;
                const baseY = PT + chartH;
                return (
                  <g key={i}>
                    <rect x={xPos(i) - barW / 2} y={baseY - returningH} width={barW} height={returningH} rx="0" fill="#6ee7b7" />
                    <rect x={xPos(i) - barW / 2} y={baseY - total} width={barW} height={newH} rx="3" fill="#93c5fd" />
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

// ── Source Breakdown Donut ────────────────────────────────────────────────────
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
    const x1 = CX + R * Math.cos(angle);
    const y1 = CY + R * Math.sin(angle);
    const x2 = CX + R * Math.cos(angle + sweep);
    const y2 = CY + R * Math.sin(angle + sweep);
    const xi1 = CX + inner * Math.cos(angle);
    const yi1 = CY + inner * Math.sin(angle);
    const xi2 = CX + inner * Math.cos(angle + sweep);
    const yi2 = CY + inner * Math.sin(angle + sweep);
    const large = sweep > Math.PI ? 1 : 0;
    slices.push({
      d: `M${xi1},${yi1} A${inner},${inner} 0 ${large} 1 ${xi2},${yi2} L${x2},${y2} A${R},${R} 0 ${large} 0 ${x1},${y1} Z`,
      color: SOURCE_COLORS[i % SOURCE_COLORS.length],
      frac, label: d.source, total: d.total,
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
            {slices.map((s, i) => (
              <path key={i} d={s.d} fill={s.color} />
            ))}
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

// ── Year-over-Year Comparison ─────────────────────────────────────────────────
export function YoyChart() {
  const [result, setResult] = useState({ data: [], current_year: new Date().getFullYear(), previous_year: new Date().getFullYear() - 1 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getYoyComparison().then(r => { setResult(r); setLoading(false); });
  }, []);

  const { data, current_year, previous_year } = result;
  const W = 560, H = 220, PL = 60, PR = 16, PT = 16, PB = 36;
  const chartW = W - PL - PR;
  const chartH = H - PT - PB;
  const maxVal = data.length ? Math.max(...data.map(d => Math.max(d.current, d.previous)), 1) : 1;
  const groupW = chartW / (data.length || 1);
  const barW = Math.max(5, groupW * 0.35);

  const xCur = (i) => PL + i * groupW + groupW * 0.2;
  const xPrev = (i) => PL + i * groupW + groupW * 0.2 + barW + 3;
  const yScale = (v) => PT + chartH - (v / maxVal) * chartH;
  const barH = (v) => Math.max(0, (v / maxVal) * chartH);

  const yTicks = [0, 0.25, 0.5, 0.75, 1];

  const fmtK = (v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v));

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
            <BarChart2 className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <p className="font-bold text-slate-900 text-sm">Year-over-Year Comparison</p>
            <p className="text-xs text-slate-400">Monthly donations: {current_year} vs {previous_year}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-56 text-slate-400 text-sm">Loading…</div>
      ) : (
        <>
          <div className="flex items-center gap-4 mb-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded bg-blue-400" />{current_year}</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded bg-slate-300" />{previous_year}</span>
          </div>
          <div className="overflow-x-auto">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 360 }}>
              {yTicks.map(t => (
                <g key={t}>
                  <line x1={PL} y1={PT + chartH * (1 - t)} x2={W - PR} y2={PT + chartH * (1 - t)} stroke="#f1f5f9" strokeWidth="1" />
                  <text x={PL - 4} y={PT + chartH * (1 - t) + 4} textAnchor="end" fontSize="9" fill="#94a3b8">
                    {fmtK(maxVal * t)}
                  </text>
                </g>
              ))}
              {data.map((d, i) => (
                <g key={i}>
                  <rect x={xCur(i)} y={yScale(d.current)} width={barW} height={barH(d.current)} rx="3" fill="#93c5fd" />
                  <rect x={xPrev(i)} y={yScale(d.previous)} width={barW} height={barH(d.previous)} rx="3" fill="#cbd5e1" />
                  <text x={PL + i * groupW + groupW / 2} y={H - 6} textAnchor="middle" fontSize="9" fill="#94a3b8">
                    {MONTH_LABELS[i]}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Charts Page ──────────────────────────────────────────────────────────
export default function Charts() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div>
          <p className="font-bold text-slate-900">Advanced Charts</p>
          <p className="text-sm text-slate-400">Visual analytics across donor behaviour and donation trends</p>
        </div>
        <button
          type="button"
          onClick={() => setRefreshKey(k => k + 1)}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh all
        </button>
      </div>

      <div key={refreshKey} className="grid gap-6 xl:grid-cols-2">
        <DonorGrowthChart />
        <NewVsReturningChart />
        <SourceDonutChart />
        <YoyChart />
      </div>
    </div>
  );
}
