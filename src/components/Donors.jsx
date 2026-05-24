import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Download, X } from 'lucide-react';
import { getCustomers } from '../services/api';

const PER_PAGE = 50;

const fmt = (n) => Number(n || 0).toLocaleString('en-MY');
const fmtRM = (n) => `RM ${Number(n || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS_OPTIONS = [
  { value: 'all',     label: 'All Status' },
  { value: 'new',     label: 'New' },
  { value: 'active',  label: 'Active' },
  { value: 'repeat',  label: 'Repeat' },
  { value: 'dormant', label: 'Dormant' },
  { value: 'churn',   label: 'Churned' },
];

const SOURCE_OPTIONS = [
  { value: 'all',              label: 'All Source' },
  { value: 'Facebook',         label: 'Facebook' },
  { value: 'Youtube / Google', label: 'Youtube / Google' },
  { value: 'TikTok',           label: 'TikTok' },
  { value: 'DRM',              label: 'DRM' },
  { value: 'Others',           label: 'Others' },
];

const HIGHVALUE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'Ya',  label: 'High Value ✅' },
  { value: 'Tidak', label: 'Regular ❌' },
];

const STATUS_BADGE = {
  new:     'bg-slate-100 text-slate-600',
  active:  'bg-emerald-100 text-emerald-700',
  repeat:  'bg-sky-100 text-sky-700',
  dormant: 'bg-amber-100 text-amber-700',
  churn:   'bg-rose-100 text-rose-700',
};

const SORT_KEYS = {
  name:       'full_name',
  transactions: 'total_orders',
  total:      'total_spent',
  first:      'first_purchase_date',
  latest:     'last_purchase_date',
  average:    'aov',
  highvalue:  'highvalue',
  status:     'status',
  source:     'source',
};

export default function Donors() {
  const navigate = useNavigate();

  // Filters
  const [search, setSearch]         = useState('');
  const [status, setStatus]         = useState('all');
  const [source, setSource]         = useState('all');
  const [highvalue, setHighvalue]   = useState('all');
  const [fromDate, setFromDate]     = useState('');
  const [toDate, setToDate]         = useState('');
  const [page, setPage]             = useState(1);

  // Sort
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  // Data
  const [data, setData]       = useState({ customers: [], total: 0, total_pages: 0, page: 1 });
  const [loading, setLoading] = useState(false);

  const activeFilters = [
    search && { key: 'search', label: `"${search}"`, clear: () => setSearch('') },
    status !== 'all' && { key: 'status', label: STATUS_OPTIONS.find(o => o.value === status)?.label, clear: () => setStatus('all') },
    source !== 'all' && { key: 'source', label: source, clear: () => setSource('all') },
    highvalue !== 'all' && { key: 'highvalue', label: HIGHVALUE_OPTIONS.find(o => o.value === highvalue)?.label, clear: () => setHighvalue('all') },
    fromDate && { key: 'from', label: `From ${fromDate}`, clear: () => setFromDate('') },
    toDate   && { key: 'to',   label: `To ${toDate}`,   clear: () => setToDate('') },
  ].filter(Boolean);

  const fetch = useCallback(async (params) => {
    setLoading(true);
    const result = await getCustomers(params);
    setData(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    const params = { page, per_page: PER_PAGE };
    if (search)              params.search    = search;
    if (status !== 'all')    params.status    = status;
    if (source !== 'all')    params.source    = source;
    if (highvalue !== 'all') params.highvalue = highvalue;
    if (fromDate)            params.from_date = fromDate;
    if (toDate)              params.to_date   = toDate;
    fetch(params);
  }, [page, search, status, source, highvalue, fromDate, toDate, fetch]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [search, status, source, highvalue, fromDate, toDate]);

  let customers = data.customers || [];

  // Client-side sort
  if (sortCol) {
    const key = SORT_KEYS[sortCol] || sortCol;
    customers = [...customers].sort((a, b) => {
      let va = a[key] ?? ''; let vb = b[key] ?? '';
      const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const SortIcon = ({ col }) => sortCol !== col
    ? <ChevronUp className="h-3 w-3 opacity-20" />
    : sortDir === 'asc'
      ? <ChevronUp className="h-3 w-3 text-blue-500" />
      : <ChevronDown className="h-3 w-3 text-blue-500" />;

  const Th = ({ col, children, className = '' }) => (
    <th
      onClick={() => handleSort(col)}
      className={`px-5 py-3.5 font-semibold cursor-pointer select-none hover:bg-slate-100 transition whitespace-nowrap ${className}`}
    >
      <span className="inline-flex items-center gap-1">{children}<SortIcon col={col} /></span>
    </th>
  );

  const exportCsv = () => {
    const header = ['Name', 'Phone', 'Email', 'Source', 'Transactions', 'Total', 'First Donation', 'Latest Donation', 'Average', 'High Value', 'Status'];
    const rows = customers.map(c => [
      c.full_name, c.phone || '', c.email || '', c.source || '',
      c.total_orders, c.total_spent?.toFixed(2),
      c.first_purchase_date || '', c.last_purchase_date || '',
      c.aov?.toFixed(2), c.highvalue === 'Ya' ? 'Yes' : 'No', c.status
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'donors-export.csv';
    a.click();
  };

  const { total, total_pages } = data;
  const currentPage = data.page || 1;

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Donors</h1>
          <p className="text-sm text-slate-500 mt-0.5">Full donor list with advanced filters.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          />
          <span className="text-slate-400">—</span>
          <input
            type="date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          />
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-wrap gap-3">

          {/* Search */}
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, email, phone…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            />
          </div>

          {/* Status */}
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          >
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          {/* Source */}
          <select
            value={source}
            onChange={e => setSource(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          >
            {SOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          {/* High Value */}
          <select
            value={highvalue}
            onChange={e => setHighvalue(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          >
            {HIGHVALUE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

        </div>

        {/* Active filter chips */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-100">
            {activeFilters.map(f => (
              <span key={f.key} className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                {f.label}
                <button onClick={f.clear}><X className="h-3 w-3" /></button>
              </span>
            ))}
            <button
              onClick={() => { setSearch(''); setStatus('all'); setSource('all'); setHighvalue('all'); setFromDate(''); setToDate(''); }}
              className="text-xs text-slate-400 hover:text-slate-600 underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-700">
            {total > 0 ? `${fmt((currentPage - 1) * PER_PAGE + 1)}–${fmt(Math.min(currentPage * PER_PAGE, total))} of ${fmt(total)} donors` : '0 donors'}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 text-left">
              <tr>
                <Th col="name">Donor</Th>
                <th className="px-5 py-3.5 font-semibold whitespace-nowrap">Phone</th>
                <Th col="source">Source</Th>
                <Th col="transactions">Transactions</Th>
                <Th col="total">Total</Th>
                <Th col="first">First Donation</Th>
                <Th col="latest">Latest Donation</Th>
                <Th col="average">Average</Th>
                <Th col="highvalue">High Value</Th>
                <Th col="status">Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr><td colSpan={10} className="px-5 py-12 text-center text-slate-400">Loading…</td></tr>
              ) : customers.length === 0 ? (
                <tr><td colSpan={10} className="px-5 py-12 text-center text-slate-400">No donors found. Try adjusting your filters.</td></tr>
              ) : customers.map(c => (
                <tr
                  key={c.id}
                  onClick={() => navigate(`/customer/${c.id}`)}
                  className="cursor-pointer hover:bg-slate-50 transition"
                >
                  <td className="px-5 py-4">
                    <Link to={`/customer/${c.id}`} className="flex items-center gap-3">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                        {(c.full_name || 'D').charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <p className="font-semibold text-slate-900">{c.full_name}</p>
                        <p className="text-xs text-slate-400">{c.email || '—'}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">{c.phone || '—'}</td>
                  <td className="px-5 py-4 whitespace-nowrap">{c.source || '—'}</td>
                  <td className="px-5 py-4">{fmt(c.total_orders)}</td>
                  <td className="px-5 py-4 font-semibold text-slate-900 whitespace-nowrap">{fmtRM(c.total_spent)}</td>
                  <td className="px-5 py-4 whitespace-nowrap">{c.first_purchase_date || '—'}</td>
                  <td className="px-5 py-4 whitespace-nowrap">{c.last_purchase_date || '—'}</td>
                  <td className="px-5 py-4 whitespace-nowrap">{fmtRM(c.aov)}</td>
                  <td className="px-5 py-4 text-center">{c.highvalue === 'Ya' ? '✅' : '❌'}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGE[c.status] || 'bg-slate-100 text-slate-600'}`}>
                      {c.status || 'new'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total_pages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </button>
            <span className="text-sm text-slate-500">Page {currentPage} of {fmt(total_pages)}</span>
            <button
              onClick={() => setPage(p => Math.min(total_pages, p + 1))}
              disabled={currentPage >= total_pages}
              className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
