import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Download, Search, Users, Banknote, TrendingUp, Receipt, PlusCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { getCustomers, getDonationChart } from '../services/api';

const fmt = (n) => Number(n || 0).toLocaleString('en-MY');
const fmtRM = (n) => `RM ${Number(n || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const statusBadges = {
  active: 'bg-emerald-100 text-emerald-700',
  repeat: 'bg-sky-100 text-sky-700',
  dormant: 'bg-amber-100 text-amber-700',
  churn: 'bg-rose-100 text-rose-700',
  new: 'bg-slate-100 text-slate-700'
};

const statusLabels = {
  all: 'All',
  new: 'New',
  active: 'Active',
  repeat: 'Repeat',
  dormant: 'Dormant',
  churn: 'Churned'
};

const statusDescriptions = {
  new: 'New donors are those who made their first donation.',
  active: 'Active donors donate consistently.',
  repeat: 'Repeat donors have donated more than once.',
  dormant: 'Dormant donors have not made a new donation within a certain period.',
  churn: 'Churned donors have stopped donating after a previous period.'
};

const barChartData = (series) => {
  const width = 680;
  const height = 280;
  const paddingLeft = 56;
  const paddingRight = 16;
  const paddingTop = 24;
  const paddingBottom = 48;
  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  const values = series.map((item) => item.value);
  const maxValue = Math.max(...values, 1);

  const slotWidth = plotWidth / Math.max(series.length, 1);
  const barWidth = Math.max(6, slotWidth * 0.6);

  const bars = series.map((item, index) => {
    const slotX = paddingLeft + index * slotWidth;
    const barX = slotX + (slotWidth - barWidth) / 2;
    const barHeight = Math.max(2, (item.value / maxValue) * plotHeight);
    const barY = paddingTop + plotHeight - barHeight;
    return { ...item, barX, barY, barWidth, barHeight };
  });

  return { width, height, paddingLeft, paddingTop, paddingBottom, plotWidth, plotHeight, bars, maxValue };
};

const pieChartData = (summary) => {
  const slices = [
    { key: 'new',     label: 'New',     value: summary.new || 0,     color: '#64748b' },
    { key: 'active',  label: 'Active',  value: summary.active || 0,  color: '#10b981' },
    { key: 'repeat',  label: 'Repeat',  value: summary.repeat || 0,  color: '#0ea5e9' },
    { key: 'dormant', label: 'Dormant', value: summary.dormant || 0, color: '#f59e0b' },
    { key: 'churn',   label: 'Churned', value: summary.churn || 0,   color: '#f43f5e' },
  ];
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return { slices, paths: [], total: 0 };

  const cx = 110; const cy = 110; const r = 88; const innerR = 44;
  let currentAngle = -Math.PI / 2;

  const paths = slices
    .filter((s) => s.value > 0)
    .map((s) => {
      const angle = (s.value / total) * 2 * Math.PI;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle = endAngle;
      const x1o = cx + r * Math.cos(startAngle); const y1o = cy + r * Math.sin(startAngle);
      const x2o = cx + r * Math.cos(endAngle);   const y2o = cy + r * Math.sin(endAngle);
      const x1i = cx + innerR * Math.cos(endAngle);   const y1i = cy + innerR * Math.sin(endAngle);
      const x2i = cx + innerR * Math.cos(startAngle); const y2i = cy + innerR * Math.sin(startAngle);
      const largeArc = angle > Math.PI ? 1 : 0;
      const d = `M ${x1o} ${y1o} A ${r} ${r} 0 ${largeArc} 1 ${x2o} ${y2o} L ${x1i} ${y1i} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x2i} ${y2i} Z`;
      return { ...s, d, percent: ((s.value / total) * 100).toFixed(1) };
    });

  return { slices, paths, total };
};

const CHART_PERIODS = [
  { key: 'all', label: 'ALL' },
  { key: '3m',  label: '3M' },
  { key: '6m',  label: '6M' },
  { key: '1y',  label: '1Y' },
];

const getPeriodDates = (period) => {
  if (period === 'all') return { from: '', to: '' };
  const now = new Date();
  const from = new Date(now);
  if (period === '3m') from.setMonth(from.getMonth() - 3);
  else if (period === '6m') from.setMonth(from.getMonth() - 6);
  else if (period === '1y') from.setFullYear(from.getFullYear() - 1);
  return {
    from: from.toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10),
  };
};

const PER_PAGE = 50;

const STAT_CARDS = [
  {
    key: 'total',
    label: 'Total Donors',
    icon: Users,
    iconBg: 'bg-blue-500',
    iconColor: 'text-white',
    valueFn: (s) => fmt(s.total),
  },
  {
    key: 'collection',
    label: 'Total Donations',
    icon: Banknote,
    iconBg: 'bg-emerald-500',
    iconColor: 'text-white',
    valueFn: (s) => fmtRM(s.total_collection),
  },
  {
    key: 'aov',
    label: 'Average Donation',
    icon: TrendingUp,
    iconBg: 'bg-violet-500',
    iconColor: 'text-white',
    valueFn: (s) => fmtRM(s.avg_order_value),
  },
  {
    key: 'transactions',
    label: 'Transactions',
    icon: Receipt,
    iconBg: 'bg-amber-500',
    iconColor: 'text-white',
    valueFn: (s) => fmt(s.total_transactions),
  },
];

export default function Dashboard({ summary, loading: appLoading }) {
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [chartPeriod, setChartPeriod] = useState('all');

  const [customersData, setCustomersData] = useState({ customers: [], total: 0, page: 1, per_page: PER_PAGE, total_pages: 0 });
  const [tableLoading, setTableLoading] = useState(false);

  const [chartSeries, setChartSeries] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);

  const fetchCustomers = useCallback(async (params) => {
    setTableLoading(true);
    const result = await getCustomers(params);
    setCustomersData(result);
    setTableLoading(false);
  }, []);

  useEffect(() => {
    const params = { page, per_page: PER_PAGE };
    if (searchQuery) params.search = searchQuery;
    if (statusFilter && statusFilter !== 'all') params.status = statusFilter;
    if (sourceFilter && sourceFilter !== 'all') params.source = sourceFilter;
    if (startDate) params.from_date = startDate;
    if (endDate) params.to_date = endDate;
    fetchCustomers(params);
  }, [page, searchQuery, statusFilter, sourceFilter, startDate, endDate, fetchCustomers]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, sourceFilter, startDate, endDate]);

  useEffect(() => {
    setChartLoading(true);
    const { from, to } = getPeriodDates(chartPeriod);
    const params = {};
    if (from) params.from_date = from;
    if (to) params.to_date = to;
    getDonationChart(params).then((data) => {
      setChartSeries(data || []);
      setChartLoading(false);
    });
  }, [chartPeriod]);

  const barData = barChartData(chartSeries.length > 0 ? chartSeries : [{ label: '—', value: 0 }]);

  const formatCsvValue = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

  const exportCustomers = async () => {
    const params = { page: 1, per_page: 200 };
    if (searchQuery) params.search = searchQuery;
    if (statusFilter && statusFilter !== 'all') params.status = statusFilter;
    if (sourceFilter && sourceFilter !== 'all') params.source = sourceFilter;
    if (startDate) params.from_date = startDate;
    if (endDate) params.to_date = endDate;

    const result = await getCustomers(params);
    const data = result.customers || [];
    if (!data || data.length === 0) return;

    const header = ['Name', 'Phone', 'Email', 'Transactions', 'Total', 'First Donation', 'Latest Donation', 'AOV', 'Status'];
    const rows = data.map((customer) => [
      customer.full_name,
      customer.phone || '',
      customer.email || '',
      customer.total_orders,
      customer.total_spent.toFixed(2),
      customer.first_purchase_date || '',
      customer.last_purchase_date || '',
      customer.aov.toFixed(2),
      customer.status
    ]);
    const csv = [header, ...rows].map((row) => row.map(formatCsvValue).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'customers-export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const { customers, total, total_pages } = customersData;
  const currentPage = customersData.page || 1;
  const startIdx = (currentPage - 1) * PER_PAGE + 1;
  const endIdx = Math.min(currentPage * PER_PAGE, total);

  return (
    <div className="space-y-6">
      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          onClick={exportCustomers}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
        <Link
          to="/order-input"
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          <PlusCircle className="h-4 w-4" />
          Add Donation
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STAT_CARDS.map((card) => (
          <div key={card.key} className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${card.iconBg}`}>
              <card.icon className={`h-6 w-6 ${card.iconColor}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 truncate">{card.label}</p>
              <p className="mt-1.5 text-2xl font-bold text-slate-900 leading-none">{card.valueFn(summary)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid gap-6 xl:grid-cols-[1fr_280px]">
        {/* Bar chart */}
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Monthly Donation Totals</h3>
              <p className="mt-1 text-sm text-slate-500">Donation revenue grouped by month.</p>
            </div>
            {/* Period tabs */}
            <div className="flex items-center rounded-xl bg-slate-100 p-1 gap-0.5 self-start">
              {CHART_PERIODS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setChartPeriod(p.key)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    chartPeriod === p.key
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            {chartLoading ? (
              <div className="flex h-[280px] items-center justify-center text-sm text-slate-400">Loading chart…</div>
            ) : (
              <svg viewBox={`0 0 ${barData.width} ${barData.height}`} className="w-full h-[280px]">
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#0ea5e9" />
                  </linearGradient>
                </defs>
                {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
                  const y = barData.paddingTop + (1 - tick) * barData.plotHeight;
                  const val = tick * barData.maxValue;
                  const lbl = val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : val >= 1000 ? `${(val / 1000).toFixed(0)}K` : val.toFixed(0);
                  return (
                    <g key={tick}>
                      <line x1={barData.paddingLeft} y1={y} x2={barData.paddingLeft + barData.plotWidth} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                      <text x={barData.paddingLeft - 6} y={y + 4} fill="#94a3b8" fontSize="9" textAnchor="end">{lbl}</text>
                    </g>
                  );
                })}
                {barData.bars.map((bar) => (
                  <g key={bar.label}>
                    <title>{fmtRM(bar.value)}</title>
                    <rect x={bar.barX} y={bar.barY} width={bar.barWidth} height={bar.barHeight} fill="url(#barGradient)" rx="4" ry="4" />
                    <text x={bar.barX + bar.barWidth / 2} y={barData.height - barData.paddingBottom + 16} fill="#94a3b8" fontSize="10" textAnchor="middle">{bar.label}</text>
                  </g>
                ))}
              </svg>
            )}
          </div>
        </div>

        {/* Donut chart */}
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h3 className="text-base font-bold text-slate-900">Donor Status</h3>
          <p className="mt-1 text-sm text-slate-500">Breakdown by current status.</p>

          <div className="mt-5 flex flex-col items-center gap-4">
            {(() => {
              const pie = pieChartData(summary);
              return (
                <>
                  <svg viewBox="0 0 220 220" className="w-full max-w-[180px]">
                    {pie.total === 0 ? (
                      <circle cx="110" cy="110" r="88" fill="#f1f5f9" />
                    ) : (
                      pie.paths.map((seg) => (
                        <path key={seg.key} d={seg.d} fill={seg.color}>
                          <title>{seg.label}: {seg.value} ({seg.percent}%)</title>
                        </path>
                      ))
                    )}
                    <circle cx="110" cy="110" r="44" fill="white" />
                    <text x="110" y="106" textAnchor="middle" fill="#0f172a" fontSize="18" fontWeight="700">{pie.total.toLocaleString('en-MY')}</text>
                    <text x="110" y="122" textAnchor="middle" fill="#94a3b8" fontSize="9">donors</text>
                  </svg>
                  <div className="w-full space-y-2.5">
                    {pie.paths.map((seg) => (
                      <div key={seg.key} className="flex items-center justify-between gap-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: seg.color }} />
                          <span className="text-slate-600">{seg.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{seg.value.toLocaleString('en-MY')}</span>
                          <span className="text-slate-400 text-xs w-10 text-right">{seg.percent}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-4 flex-1 min-w-0">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-12 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                placeholder="Search donor by name, email or phone…"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 sm:max-w-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">From date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">To date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[
              { key: 'all',     active: 'bg-slate-900 text-white',         inactive: 'bg-slate-100 text-slate-600 hover:bg-slate-200' },
              { key: 'new',     active: 'bg-slate-500 text-white',         inactive: 'bg-slate-100 text-slate-600 hover:bg-slate-200' },
              { key: 'active',  active: 'bg-emerald-500 text-white',       inactive: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
              { key: 'repeat',  active: 'bg-sky-500 text-white',           inactive: 'bg-sky-50 text-sky-700 hover:bg-sky-100' },
              { key: 'dormant', active: 'bg-amber-500 text-white',         inactive: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
              { key: 'churn',   active: 'bg-rose-500 text-white',          inactive: 'bg-rose-50 text-rose-700 hover:bg-rose-100' },
            ].map(({ key, active, inactive }) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition ${statusFilter === key ? active : inactive}`}
              >
                {statusLabels[key]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Donor table */}
      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">Donor List</h3>
            <p className="mt-0.5 text-sm text-slate-500">All donors with donation totals and status.</p>
          </div>
          {total > 0 ? (
            <p className="text-sm text-slate-500">
              {fmt(startIdx)}–{fmt(endIdx)} of {fmt(total)} donors
            </p>
          ) : (
            <p className="text-sm text-slate-500">0 donors</p>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Donor</th>
                <th className="px-5 py-3.5 font-semibold">Phone</th>
                <th className="px-5 py-3.5 font-semibold">Transactions</th>
                <th className="px-5 py-3.5 font-semibold">Total</th>
                <th className="px-5 py-3.5 font-semibold">First Donation</th>
                <th className="px-5 py-3.5 font-semibold">Latest Donation</th>
                <th className="px-5 py-3.5 font-semibold">Average</th>
                <th className="px-5 py-3.5 font-semibold">High Value</th>
                <th className="px-5 py-3.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {appLoading || tableLoading ? (
                <tr>
                  <td colSpan="9" className="px-5 py-10 text-center text-slate-400">Loading donor data…</td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-5 py-10 text-center text-slate-400">No donors found. Adjust filters or add a new donation.</td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr
                    key={customer.id}
                    onClick={() => navigate(`/customer/${customer.id}`)}
                    className="cursor-pointer transition hover:bg-slate-50"
                  >
                    <td className="px-5 py-4">
                      <Link to={`/customer/${customer.id}`} className="flex items-center gap-3 text-slate-900 hover:text-slate-700">
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold uppercase text-blue-700">
                          {customer.full_name?.charAt(0) || 'C'}
                        </span>
                        <div>
                          <p className="font-semibold">{customer.full_name}</p>
                          <p className="text-xs text-slate-400">{customer.email || 'No email'}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-5 py-4">{customer.phone || '—'}</td>
                    <td className="px-5 py-4">{fmt(customer.total_orders)}</td>
                    <td className="px-5 py-4 font-semibold text-slate-900">{fmtRM(customer.total_spent)}</td>
                    <td className="px-5 py-4">{customer.first_purchase_date || '—'}</td>
                    <td className="px-5 py-4">{customer.last_purchase_date || '—'}</td>
                    <td className="px-5 py-4">{fmtRM(customer.aov)}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${customer.highvalue === 'Ya' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                        {customer.highvalue || 'Tidak'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadges[customer.status] || statusBadges.new}`}
                        title={statusDescriptions[customer.status] || 'Unknown donor status.'}
                      >
                        {statusLabels[customer.status] || customer.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {total_pages > 1 && (
          <div className="flex items-center justify-between gap-4 px-5 py-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            <span className="text-sm text-slate-500">
              Page {currentPage} of {total_pages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(total_pages, p + 1))}
              disabled={currentPage >= total_pages}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
