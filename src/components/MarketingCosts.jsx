import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, RefreshCw, TrendingUp, DollarSign, BarChart2, Target } from 'lucide-react';
import { getMarketingCosts, createMarketingCost, deleteMarketingCost, getMarketingRoi } from '../services/api';

const PLATFORMS = ['facebook', 'google', 'instagram', 'tiktok', 'youtube', 'website', 'other'];

const PLATFORM_COLORS = {
  facebook:  'bg-blue-100 text-blue-700',
  google:    'bg-red-100 text-red-700',
  instagram: 'bg-pink-100 text-pink-700',
  tiktok:    'bg-slate-100 text-slate-700',
  youtube:   'bg-rose-100 text-rose-700',
  website:   'bg-emerald-100 text-emerald-700',
  other:     'bg-amber-100 text-amber-700',
};

const fmtRM = (n) => `RM ${Number(n || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtShort = (n) => {
  const v = Number(n || 0);
  if (v >= 1000000) return `RM ${(v / 1000000).toFixed(2)}M`;
  if (v >= 1000) return `RM ${(v / 1000).toFixed(1)}K`;
  return `RM ${v.toFixed(2)}`;
};

const initialForm = { platform: 'facebook', campaign: '', cost_date: '', amount: '', notes: '' };

export default function MarketingCosts() {
  const [costs, setCosts] = useState([]);
  const [total, setTotal] = useState(0);
  const [roi, setRoi] = useState([]);
  const [loading, setLoading] = useState(false);
  const [roiLoading, setRoiLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [page, setPage] = useState(1);
  const PER_PAGE = 50;

  const fetchCosts = useCallback(async () => {
    setLoading(true);
    const data = await getMarketingCosts({ page, per_page: PER_PAGE });
    setCosts(data.costs || []);
    setTotal(data.total || 0);
    setLoading(false);
  }, [page]);

  const fetchRoi = useCallback(async () => {
    setRoiLoading(true);
    const data = await getMarketingRoi();
    setRoi(data || []);
    setRoiLoading(false);
  }, []);

  useEffect(() => { fetchCosts(); }, [fetchCosts]);
  useEffect(() => { fetchRoi(); }, [fetchRoi]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.platform || !form.campaign.trim() || !form.cost_date || !form.amount) {
      return setError('Semua field wajib diisi.');
    }
    setSaving(true);
    try {
      await createMarketingCost({ ...form, amount: Number(form.amount) });
      setForm(initialForm);
      setShowForm(false);
      fetchCosts();
      fetchRoi();
    } catch (err) {
      setError(err?.response?.data?.error || 'Gagal simpan. Cuba lagi.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    setDeleteId(id);
    try {
      await deleteMarketingCost(id);
      fetchCosts();
      fetchRoi();
    } finally {
      setDeleteId(null);
    }
  };

  const totalCost = roi.reduce((s, r) => s + r.total_cost, 0);
  const totalRevenue = roi.reduce((s, r) => s + r.total_revenue, 0);
  const overallRoas = totalCost > 0 ? totalRevenue / totalCost : 0;

  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Marketing</p>
          <h2 className="mt-1 text-base font-bold text-slate-900">Kos Marketing</h2>
          <p className="text-xs text-slate-400 mt-0.5">Track perbelanjaan marketing dan ROI per campaign</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { fetchCosts(); fetchRoi(); }}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => { setShowForm((v) => !v); setError(''); }}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition"
          >
            <Plus className="h-4 w-4" />
            Tambah Kos
          </button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Rekod Kos Marketing Baru</h3>
          {error && (
            <div className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">{error}</div>
          )}
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Platform</label>
              <select
                name="platform"
                value={form.platform}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 capitalize"
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p} className="capitalize">{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nama Campaign</label>
              <input
                name="campaign"
                value={form.campaign}
                onChange={handleChange}
                placeholder="cth: Ramadan 2024"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Tarikh</label>
              <input
                type="date"
                name="cost_date"
                value={form.cost_date}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Jumlah Kos (RM)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="amount"
                value={form.amount}
                onChange={handleChange}
                placeholder="0.00"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nota (optional)</label>
              <input
                name="notes"
                value={form.notes}
                onChange={handleChange}
                placeholder="Sebarang nota tambahan..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setShowForm(false); setForm(initialForm); setError(''); }}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {saving ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-white border border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500">
              <DollarSign className="h-3.5 w-3.5 text-white" />
            </div>
            <p className="text-xs font-semibold text-slate-500">Total Kos Marketing</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">{fmtShort(totalCost)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{fmtRM(totalCost)}</p>
        </div>
        <div className="rounded-xl bg-white border border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500">
              <TrendingUp className="h-3.5 w-3.5 text-white" />
            </div>
            <p className="text-xs font-semibold text-slate-500">Total Hasil Campaign</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">{fmtShort(totalRevenue)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{fmtRM(totalRevenue)}</p>
        </div>
        <div className="rounded-xl bg-white border border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500">
              <BarChart2 className="h-3.5 w-3.5 text-white" />
            </div>
            <p className="text-xs font-semibold text-slate-500">Overall ROAS</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">{overallRoas.toFixed(2)}x</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {overallRoas >= 1
              ? `Untung RM ${(totalRevenue - totalCost).toLocaleString('en-MY', { minimumFractionDigits: 2 })}`
              : totalCost > 0 ? 'Belum pulang modal' : 'Tiada data'}
          </p>
        </div>
      </div>

      {/* ROI per campaign */}
      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
          <Target className="h-4 w-4 text-slate-400" />
          <h3 className="text-sm font-bold text-slate-900">ROI per Campaign</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="px-5 py-3 text-left">Campaign</th>
                <th className="px-5 py-3 text-left">Platform</th>
                <th className="px-5 py-3 text-right">Kos</th>
                <th className="px-5 py-3 text-right">Donation</th>
                <th className="px-5 py-3 text-right">Net</th>
                <th className="px-5 py-3 text-right">ROAS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {roiLoading ? (
                <tr><td colSpan="6" className="px-5 py-10 text-center text-slate-400">Loading…</td></tr>
              ) : roi.length === 0 ? (
                <tr><td colSpan="6" className="px-5 py-10 text-center text-slate-400">Tiada data ROI. Tambah kos marketing untuk mula.</td></tr>
              ) : roi.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50 transition">
                  <td className="px-5 py-3.5 font-medium text-slate-800 max-w-[200px] truncate">{row.campaign}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${PLATFORM_COLORS[row.platform] || PLATFORM_COLORS.other}`}>
                      {row.platform}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right text-rose-600 font-medium">{fmtRM(row.total_cost)}</td>
                  <td className="px-5 py-3.5 text-right text-emerald-600 font-medium">{fmtRM(row.total_revenue)}</td>
                  <td className={`px-5 py-3.5 text-right font-semibold ${row.net >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {row.net >= 0 ? '+' : ''}{fmtRM(row.net)}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${row.roas >= 2 ? 'bg-emerald-100 text-emerald-700' : row.roas >= 1 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-600'}`}>
                      {row.roas.toFixed(2)}x
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cost entries table */}
      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">
            Senarai Kos {total > 0 && <span className="text-slate-400 font-normal">({total.toLocaleString('en-MY')} rekod)</span>}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="px-5 py-3 text-left">Tarikh</th>
                <th className="px-5 py-3 text-left">Platform</th>
                <th className="px-5 py-3 text-left">Campaign</th>
                <th className="px-5 py-3 text-right">Jumlah</th>
                <th className="px-5 py-3 text-left">Nota</th>
                <th className="px-5 py-3 text-left">Oleh</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr><td colSpan="7" className="px-5 py-10 text-center text-slate-400">Loading…</td></tr>
              ) : costs.length === 0 ? (
                <tr><td colSpan="7" className="px-5 py-10 text-center text-slate-400">Tiada rekod kos. Klik "Tambah Kos" untuk mula.</td></tr>
              ) : costs.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 transition">
                  <td className="px-5 py-3.5 whitespace-nowrap text-slate-500">{c.cost_date}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${PLATFORM_COLORS[c.platform] || PLATFORM_COLORS.other}`}>
                      {c.platform}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-medium text-slate-800 max-w-[200px] truncate">{c.campaign}</td>
                  <td className="px-5 py-3.5 text-right font-semibold text-slate-900">{fmtRM(c.amount)}</td>
                  <td className="px-5 py-3.5 text-slate-400 max-w-[180px] truncate">{c.notes || '—'}</td>
                  <td className="px-5 py-3.5 text-xs text-slate-400">{c.created_by || '—'}</td>
                  <td className="px-5 py-3.5">
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id)}
                      disabled={deleteId === c.id}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40 transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-4 px-5 py-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40 transition"
            >
              Sebelum
            </button>
            <span className="text-sm text-slate-500">Halaman {page} / {totalPages}</span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40 transition"
            >
              Seterusnya
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
