import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Printer, Trophy, BarChart2, CalendarDays } from 'lucide-react';
import { getTopDonors, getCampaigns, getCampaignChart, getMonthlyReport } from '../services/api';

const fmt = (n) => Number(n || 0).toLocaleString('en-MY');
const fmtRM = (n) => `RM ${Number(n || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const RANK_STYLE = {
  1: 'bg-amber-400 text-white',
  2: 'bg-slate-400 text-white',
  3: 'bg-orange-500 text-white',
};

const CAMPAIGN_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
  '#f43f5e', '#06b6d4', '#84cc16', '#ec4899',
];

function todayMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ─── Top Donors ───────────────────────────────────────────────────────────────
function TopDonors({ campaigns }) {
  const [campaignFilter, setCampaignFilter] = useState('');
  const [donors, setDonors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getTopDonors({ limit: 10, ...(campaignFilter ? { campaign: campaignFilter } : {}) })
      .then(setDonors)
      .finally(() => setLoading(false));
  }, [campaignFilter]);

  return (
    <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
            <Trophy className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Top Donors Leaderboard</h3>
            <p className="text-xs text-slate-500">Top 10 donors ranked by total donation amount.</p>
          </div>
        </div>
        <select
          value={campaignFilter}
          onChange={(e) => setCampaignFilter(e.target.value)}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
        >
          <option value="">All Campaigns</option>
          {campaigns.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">Rank</th>
              <th className="px-5 py-3">Donor</th>
              <th className="px-5 py-3">Total Donated</th>
              <th className="px-5 py-3">Transactions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {loading ? (
              <tr><td colSpan="4" className="px-5 py-8 text-center text-slate-400">Loading…</td></tr>
            ) : donors.length === 0 ? (
              <tr><td colSpan="4" className="px-5 py-8 text-center text-slate-400">No data found.</td></tr>
            ) : (
              donors.map((d) => (
                <tr key={d.donor_id} className="hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${RANK_STYLE[d.rank] || 'bg-slate-100 text-slate-600'}`}>
                      {d.rank}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <Link to={`/customer/${d.donor_id}`} className="flex items-center gap-3 hover:opacity-80">
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold uppercase text-blue-700">
                        {(d.full_name || 'U').charAt(0)}
                      </span>
                      <div>
                        <p className="font-semibold text-slate-900">{d.full_name}</p>
                        <p className="text-xs text-slate-400">{d.email || 'No email'}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-5 py-4 font-bold text-slate-900">{fmtRM(d.total_spent)}</td>
                  <td className="px-5 py-4 text-slate-600">{fmt(d.total_orders)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Campaign Breakdown ───────────────────────────────────────────────────────
function CampaignBreakdown() {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (fromDate) params.from_date = fromDate;
    if (toDate) params.to_date = toDate;
    getCampaignChart(params).then(setData).finally(() => setLoading(false));
  }, [fromDate, toDate]);

  const maxTotal = Math.max(...data.map((d) => d.total), 1);
  const grandTotal = data.reduce((s, d) => s + d.total, 0);

  return (
    <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
            <BarChart2 className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Donation Trend by Campaign</h3>
            <p className="text-xs text-slate-500">Total donations collected per campaign.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
          <span className="text-slate-400 text-sm">—</span>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
        </div>
      </div>

      <div className="p-5">
        {loading ? (
          <div className="py-10 text-center text-sm text-slate-400">Loading…</div>
        ) : data.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">No campaign data found.</div>
        ) : (
          <div className="space-y-3">
            {data.map((item, i) => {
              const pct = grandTotal > 0 ? ((item.total / grandTotal) * 100).toFixed(1) : 0;
              const barPct = ((item.total / maxTotal) * 100).toFixed(1);
              const color = CAMPAIGN_COLORS[i % CAMPAIGN_COLORS.length];
              return (
                <div key={item.campaign}>
                  <div className="mb-1.5 flex items-center justify-between gap-4 text-sm">
                    <span className="flex items-center gap-2 font-medium text-slate-700 truncate">
                      <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                      {item.campaign}
                    </span>
                    <div className="flex items-center gap-3 shrink-0 text-right">
                      <span className="font-bold text-slate-900">{fmtRM(item.total)}</span>
                      <span className="text-xs text-slate-400 w-12">{pct}%</span>
                      <span className="text-xs text-slate-400">{fmt(item.count)} txn</span>
                    </div>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-slate-100">
                    <div
                      className="h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${barPct}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && data.length > 0 && (
          <div className="mt-5 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm">
            <span className="font-semibold text-slate-700">Grand Total</span>
            <span className="font-bold text-slate-900">{fmtRM(grandTotal)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Monthly Report ───────────────────────────────────────────────────────────
function MonthlyReport() {
  const [month, setMonth] = useState(todayMonth);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getMonthlyReport({ month }).then(setReport).finally(() => setLoading(false));
  }, [month]);

  const handlePrint = () => {
    window.print();
  };

  const STAT_CARDS = report ? [
    { label: 'Total Collection', value: fmtRM(report.total_collection), color: 'text-emerald-600' },
    { label: 'Transactions', value: fmt(report.total_transactions), color: 'text-blue-600' },
    { label: 'Unique Donors', value: fmt(report.unique_donors), color: 'text-violet-600' },
    { label: 'New Donors', value: fmt(report.new_donors), color: 'text-amber-600' },
    { label: 'Avg Donation', value: fmtRM(report.avg_donation), color: 'text-sky-600' },
  ] : [];

  const monthLabel = month
    ? new Date(month + '-01').toLocaleString('en-MY', { month: 'long', year: 'numeric' })
    : '';

  return (
    <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 print:shadow-none print:ring-0">
      <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50">
            <CalendarDays className="h-5 w-5 text-violet-500" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Monthly Report</h3>
            <p className="text-xs text-slate-500">Donation summary for selected month.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          />
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <Printer className="h-4 w-4" />
            Print / PDF
          </button>
        </div>
      </div>

      <div className="p-5 print:p-0">
        {/* Print header — only visible when printing */}
        <div className="hidden print:block mb-6">
          <img src="/Logo%20IhsanKu.png" alt="IhsanKu" className="h-8 mb-4" />
          <h2 className="text-2xl font-bold text-slate-900">Monthly Donation Report</h2>
          <p className="text-slate-500">{monthLabel}</p>
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-slate-400">Loading report…</div>
        ) : !report ? (
          <div className="py-10 text-center text-sm text-slate-400">No data available.</div>
        ) : (
          <>
            <div className="mb-2 print:hidden">
              <p className="text-sm font-semibold text-slate-500">{monthLabel}</p>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {STAT_CARDS.map((card) => (
                <div key={card.label} className="rounded-xl bg-slate-50 p-4 print:border print:border-slate-200">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
                  <p className={`mt-2 text-xl font-bold leading-none ${card.color}`}>{card.value}</p>
                </div>
              ))}
            </div>

            {/* Campaign breakdown */}
            {report.campaigns.length > 0 && (
              <div className="mt-5">
                <h4 className="mb-3 text-sm font-bold text-slate-700">Campaign Breakdown</h4>
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-100 text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3 text-left">Campaign</th>
                        <th className="px-4 py-3 text-right">Transactions</th>
                        <th className="px-4 py-3 text-right">Total</th>
                        <th className="px-4 py-3 text-right">Share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {report.campaigns.map((c, i) => (
                        <tr key={c.name} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-800">
                            <span className="inline-flex items-center gap-2">
                              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: CAMPAIGN_COLORS[i % CAMPAIGN_COLORS.length] }} />
                              {c.name}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600">{fmt(c.count)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">{fmtRM(c.total)}</td>
                          <td className="px-4 py-3 text-right text-slate-400">
                            {report.total_collection > 0
                              ? `${((c.total / report.total_collection) * 100).toFixed(1)}%`
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50">
                      <tr>
                        <td className="px-4 py-3 font-bold text-slate-700">Total</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-700">{fmt(report.total_transactions)}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900">{fmtRM(report.total_collection)}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-700">100%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            <p className="mt-4 text-xs text-slate-400 print:hidden">
              Generated on {new Date().toLocaleDateString('en-MY', { dateStyle: 'long' })}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Analytics page ──────────────────────────────────────────────────────
export default function Analytics() {
  const [campaigns, setCampaigns] = useState([]);

  useEffect(() => {
    getCampaigns().then(setCampaigns);
  }, []);

  return (
    <div className="space-y-6">
      <TopDonors campaigns={campaigns} />
      <CampaignBreakdown />
      <MonthlyReport />
    </div>
  );
}
