import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Download, Search, TrendingUp, Users, Repeat, Clock, Zap, Activity, PlusCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { getCustomers, getDonationChart } from '../services/api';

const statusBadges = {
  active: 'bg-emerald-100 text-emerald-700',
  repeat: 'bg-sky-100 text-sky-700',
  dormant: 'bg-amber-100 text-amber-700',
  churn: 'bg-rose-100 text-rose-700',
  new: 'bg-slate-100 text-slate-700'
};

const statusLabels = {
  all: 'Semua',
  new: 'Baru',
  active: 'Aktif',
  repeat: 'Ulangan',
  dormant: 'Tidak aktif',
  churn: 'Berhenti'
};

const statusDescriptions = {
  new: 'Pelanggan baru adalah mereka yang membuat pembelian kali pertama.',
  active: 'Pelanggan aktif membuat pembelian secara konsisten.',
  repeat: 'Pelanggan ulangan membuat pesanan lebih daripada sekali.',
  dormant: 'Pelanggan tidak aktif belum membuat pesanan baru dalam tempoh tertentu.',
  churn: 'Pelanggan berhenti tidak lagi membuat pembelian selepas tempoh sebelumnya.'
};

const parseDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
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

const PER_PAGE = 50;

export default function Dashboard({ summary, loading: appLoading }) {
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [page, setPage] = useState(1);

  // Server-side paginated state
  const [customersData, setCustomersData] = useState({ customers: [], total: 0, page: 1, per_page: PER_PAGE, total_pages: 0 });
  const [tableLoading, setTableLoading] = useState(false);

  // Chart data fetched from server
  const [chartSeries, setChartSeries] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);

  const fetchCustomers = useCallback(async (params) => {
    setTableLoading(true);
    const result = await getCustomers(params);
    setCustomersData(result);
    setTableLoading(false);
  }, []);

  useEffect(() => {
    const params = {
      page,
      per_page: PER_PAGE
    };
    if (searchQuery) params.search = searchQuery;
    if (statusFilter && statusFilter !== 'all') params.status = statusFilter;
    if (sourceFilter && sourceFilter !== 'all') params.source = sourceFilter;
    if (startDate) params.from_date = startDate;
    if (endDate) params.to_date = endDate;

    fetchCustomers(params);
  }, [page, searchQuery, statusFilter, sourceFilter, startDate, endDate, fetchCustomers]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, sourceFilter, startDate, endDate]);

  // Fetch chart data from server whenever date range changes
  useEffect(() => {
    setChartLoading(true);
    const params = {};
    if (startDate) params.from_date = startDate;
    if (endDate) params.to_date = endDate;
    getDonationChart(params).then((data) => {
      setChartSeries(data || []);
      setChartLoading(false);
    });
  }, [startDate, endDate]);

  const barData = barChartData(chartSeries.length > 0 ? chartSeries : [{ label: '—', value: 0 }]);

  const formatCsvValue = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

  const exportCustomers = async () => {
    // Fetch all matching records for export (no pagination)
    const params = { page: 1, per_page: 200 };
    if (searchQuery) params.search = searchQuery;
    if (statusFilter && statusFilter !== 'all') params.status = statusFilter;
    if (sourceFilter && sourceFilter !== 'all') params.source = sourceFilter;
    if (startDate) params.from_date = startDate;
    if (endDate) params.to_date = endDate;

    const result = await getCustomers(params);
    const data = result.customers || [];
    if (!data || data.length === 0) return;

    const header = ['Nama', 'Telefon', 'Emel', 'Sumber', 'Pesanan', 'Jumlah', 'Pembelian pertama', 'Pembelian terkini', 'AOV', 'Status'];
    const rows = data.map((customer) => [
      customer.full_name,
      customer.phone || '',
      customer.email || '',
      customer.source || 'Lain-lain',
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
    <div className="space-y-8">
      <section className="rounded-2xl bg-white p-6 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.26em] text-slate-500">Dashboard</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Gambaran keseluruhan sumbangan NGO</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Lihat jumlah dermawan, jumlah sumbangan dan graf bulanan dalam satu tempat.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={exportCustomers}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              Eksport CSV
            </button>
            <Link
              to="/order-input"
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <PlusCircle className="h-4 w-4" />
              Tambah sumbangan
            </Link>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-4">
        {[
          { label: 'Jumlah dermawan', value: summary.total, icon: Users, accent: 'bg-slate-900 text-white' },
          { label: 'Jumlah sumbangan', value: `RM ${(summary.total_collection || 0).toFixed(2)}`, icon: Zap, accent: 'bg-emerald-50 text-emerald-700' },
          { label: 'Purata sumbangan', value: `RM ${(summary.avg_order_value || 0).toFixed(2)}`, icon: TrendingUp, accent: 'bg-sky-50 text-sky-700' },
          { label: 'Transaksi sumbangan', value: summary.total_transactions || 0, icon: Activity, accent: 'bg-amber-50 text-amber-700' }
        ].map((card) => (
          <div key={card.label} className="rounded-2xl bg-white p-5 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">{card.label}</p>
                <p className="mt-4 text-2xl font-semibold text-slate-950">{card.value}</p>
              </div>
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${card.accent}`}>
                <card.icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <section className="rounded-2xl bg-white p-6 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.26em] text-slate-500">Graf sumbangan</p>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">Jumlah sumbangan bulanan</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Graf ini menunjukkan jumlah sumbangan mengikut bulan untuk tempoh enam bulan terakhir.</p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">Jumlah sumbangan: RM {(summary.total_collection || 0).toFixed(2)}</div>
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-5">
          <div className="relative overflow-hidden rounded-xl bg-white p-4 shadow-sm">
            {chartLoading ? (
              <div className="flex h-[280px] items-center justify-center text-sm text-slate-400">Memuatkan graf…</div>
            ) : (
              <svg viewBox={`0 0 ${barData.width} ${barData.height}`} className="w-full h-[280px]">
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" />
                    <stop offset="100%" stopColor="#0284c7" />
                  </linearGradient>
                  <linearGradient id="barGradientHover" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1d4ed8" />
                    <stop offset="100%" stopColor="#0369a1" />
                  </linearGradient>
                </defs>

                {/* Horizontal grid lines + Y-axis labels */}
                {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
                  const y = barData.paddingTop + (1 - tick) * barData.plotHeight;
                  const val = tick * barData.maxValue;
                  const label = val >= 1000000
                    ? `${(val / 1000000).toFixed(1)}M`
                    : val >= 1000
                    ? `${(val / 1000).toFixed(0)}K`
                    : val.toFixed(0);
                  return (
                    <g key={tick}>
                      <line
                        x1={barData.paddingLeft}
                        y1={y}
                        x2={barData.paddingLeft + barData.plotWidth}
                        y2={y}
                        stroke="#e2e8f0"
                        strokeWidth="1"
                      />
                      <text x={barData.paddingLeft - 6} y={y + 4} fill="#94a3b8" fontSize="9" textAnchor="end">
                        {label}
                      </text>
                    </g>
                  );
                })}

                {/* Bars */}
                {barData.bars.map((bar) => (
                  <g key={bar.label} className="group">
                    <title>RM {Number(bar.value).toFixed(2)}</title>
                    <rect
                      x={bar.barX}
                      y={bar.barY}
                      width={bar.barWidth}
                      height={bar.barHeight}
                      fill="url(#barGradient)"
                      rx="3"
                      ry="3"
                    />
                    <text
                      x={bar.barX + bar.barWidth / 2}
                      y={barData.height - barData.paddingBottom + 16}
                      fill="#64748b"
                      fontSize="10"
                      textAnchor="middle"
                    >
                      {bar.label}
                    </text>
                  </g>
                ))}
              </svg>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0 space-y-4">
            <label className="sr-only" htmlFor="dashboard-search">Cari dermawan</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="dashboard-search"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-12 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
                placeholder="Cari dermawan..."
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-slate-700" htmlFor="start-date">Dari tarikh</label>
                <input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700" htmlFor="end-date">Hingga tarikh</label>
                <input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[
              { key: 'all',     active: 'bg-slate-900 text-white',              inactive: 'bg-slate-100 text-slate-600 hover:bg-slate-200' },
              { key: 'new',     active: 'bg-slate-500 text-white',              inactive: 'bg-slate-100 text-slate-600 hover:bg-slate-200' },
              { key: 'active',  active: 'bg-emerald-500 text-white',            inactive: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
              { key: 'repeat',  active: 'bg-sky-500 text-white',                inactive: 'bg-sky-50 text-sky-700 hover:bg-sky-100' },
              { key: 'dormant', active: 'bg-amber-500 text-white',              inactive: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
              { key: 'churn',   active: 'bg-rose-500 text-white',               inactive: 'bg-rose-50 text-rose-700 hover:bg-rose-100' },
            ].map(({ key, active, inactive }) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${statusFilter === key ? active : inactive}`}
              >
                {statusLabels[key]}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-slate-950">Senarai dermawan</h3>
            <p className="mt-1 text-sm text-slate-500">Semak taburan sumbangan, nilai transaksi dan dermawan terkini.</p>
          </div>
          {total > 0 ? (
            <p className="text-sm text-slate-500">
              Memaparkan {startIdx}–{endIdx} daripada {total} dermawan
            </p>
          ) : (
            <p className="text-sm text-slate-500">0 dermawan</p>
          )}
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-4 font-semibold">Dermawan</th>
                <th className="px-4 py-4 font-semibold">Telefon</th>
                <th className="px-4 py-4 font-semibold">Transaksi</th>
                <th className="px-4 py-4 font-semibold">Jumlah</th>
                <th className="px-4 py-4 font-semibold">Sumbangan pertama</th>
                <th className="px-4 py-4 font-semibold">Sumbangan terkini</th>
                <th className="px-4 py-4 font-semibold">Purata</th>
                <th className="px-4 py-4 font-semibold">High Value</th>
                <th className="px-4 py-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {appLoading || tableLoading ? (
                <tr>
                  <td colSpan="9" className="px-4 py-10 text-center text-slate-500">Memuatkan data dermawan…</td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-4 py-10 text-center text-slate-500">Tiada pelanggan sepadan. Tukar penapis atau tambah pesanan baru.</td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr
                    key={customer.id}
                    onClick={() => navigate(`/customer/${customer.id}`)}
                    className="cursor-pointer transition hover:bg-slate-50"
                  >
                    <td className="px-4 py-4">
                      <Link to={`/customer/${customer.id}`} className="flex items-center gap-3 text-slate-900 hover:text-slate-700">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold uppercase text-slate-700">
                          {customer.full_name?.charAt(0) || 'C'}
                        </span>
                        <div>
                          <p className="font-semibold">{customer.full_name}</p>
                          <p className="text-xs text-slate-500">{customer.email || 'Tiada emel'}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-4">{customer.phone || '—'}</td>
                    <td className="px-4 py-4">{customer.total_orders}</td>
                    <td className="px-4 py-4 font-semibold text-slate-900">RM {customer.total_spent.toFixed(2)}</td>
                    <td className="px-4 py-4">{customer.first_purchase_date || '—'}</td>
                    <td className="px-4 py-4">{customer.last_purchase_date || '—'}</td>
                    <td className="px-4 py-4">RM {customer.aov.toFixed(2)}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${customer.highvalue === 'Ya' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                        {customer.highvalue || 'Tidak'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadges[customer.status] || statusBadges.new}`}
                        title={statusDescriptions[customer.status] || 'Status pelanggan tidak diketahui.'}
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
          <div className="mt-4 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
              Sebelum
            </button>
            <span className="text-sm text-slate-500">
              Halaman {currentPage} daripada {total_pages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(total_pages, p + 1))}
              disabled={currentPage >= total_pages}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Seterusnya
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
