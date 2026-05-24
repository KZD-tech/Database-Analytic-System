import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import axios from 'axios';

const api = axios.create({ baseURL: '/api' });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const PER_PAGE = 50;

const ACTION_LABELS = {
  login:           { label: 'Login',           color: 'bg-blue-100 text-blue-700' },
  bulk_upload:     { label: 'Bulk Upload',      color: 'bg-violet-100 text-violet-700' },
  add_donation:    { label: 'Add Donation',     color: 'bg-emerald-100 text-emerald-700' },
  create_user:     { label: 'Create User',      color: 'bg-amber-100 text-amber-700' },
  update_user:     { label: 'Update User',      color: 'bg-amber-100 text-amber-700' },
  deactivate_user: { label: 'Deactivate User',  color: 'bg-rose-100 text-rose-700' },
  merge_donors:    { label: 'Merge Donors',     color: 'bg-slate-100 text-slate-700' },
};

const ALL_ACTIONS = ['all', ...Object.keys(ACTION_LABELS)];

function formatDetails(action, details) {
  if (!details) return '—';
  switch (action) {
    case 'login':
      return `via ${details.method === 'env_fallback' ? 'admin fallback' : 'users table'}`;
    case 'bulk_upload':
      return `${(details.imported || 0).toLocaleString('en-MY')} imported · ${(details.new_donors || 0).toLocaleString('en-MY')} new donors`;
    case 'add_donation':
      return `${details.donor || '—'} · RM ${Number(details.amount || 0).toFixed(2)} · ${details.date || ''}`;
    case 'create_user':
      return `${details.target_email || ''} (${details.role || ''})`;
    case 'update_user':
      return `User #${details.target_id} · changed: ${(details.changes || []).join(', ')}`;
    case 'deactivate_user':
      return `User #${details.target_id}`;
    case 'merge_donors':
      return `Keep #${details.keep_id} · removed #${details.delete_id}`;
    default:
      return JSON.stringify(details);
  }
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function ActivityLog() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('all');
  const [loading, setLoading] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, per_page: PER_PAGE };
      if (actionFilter !== 'all') params.action = actionFilter;
      const { data } = await api.get('/activity-logs', { params });
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (_) {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  useEffect(() => { setPage(1); }, [actionFilter]);

  const totalPages = Math.ceil(total / PER_PAGE);
  const startIdx = (page - 1) * PER_PAGE + 1;
  const endIdx = Math.min(page * PER_PAGE, total);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">System</p>
          <h2 className="mt-1 text-base font-bold text-slate-900">Activity Log</h2>
          <p className="text-xs text-slate-400 mt-0.5">Track all user actions in the system</p>
        </div>
        <button
          type="button"
          onClick={fetchLogs}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2">
        {ALL_ACTIONS.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setActionFilter(a)}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition capitalize ${
              actionFilter === a
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {a === 'all' ? 'All' : (ACTION_LABELS[a]?.label || a)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <p className="text-sm font-bold text-slate-900">
            {total > 0 ? `${startIdx}–${endIdx} of ${total.toLocaleString('en-MY')} logs` : '0 logs'}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="px-5 py-3 text-left">Timestamp</th>
                <th className="px-5 py-3 text-left">User</th>
                <th className="px-5 py-3 text-left">Role</th>
                <th className="px-5 py-3 text-left">Action</th>
                <th className="px-5 py-3 text-left">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-5 py-10 text-center text-slate-400">Loading…</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-5 py-10 text-center text-slate-400">No activity logs found.</td>
                </tr>
              ) : logs.map((log) => {
                const badge = ACTION_LABELS[log.action] || { label: log.action, color: 'bg-slate-100 text-slate-600' };
                return (
                  <tr key={log.id} className="hover:bg-slate-50 transition">
                    <td className="px-5 py-3.5 whitespace-nowrap text-xs text-slate-500">{fmtDate(log.created_at)}</td>
                    <td className="px-5 py-3.5 font-medium text-slate-800">{log.user_email || '—'}</td>
                    <td className="px-5 py-3.5 capitalize text-slate-500">{log.user_role || '—'}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.color}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500 max-w-xs truncate">
                      {formatDetails(log.action, log.details)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-4 px-5 py-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>
            <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
