import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, RefreshCw, TrendingUp, DollarSign, BarChart2, Target, Upload, Printer, FileText } from 'lucide-react';
import { getMarketingCosts, createMarketingCost, deleteMarketingCost, getMarketingRoi, bulkUploadMarketingCosts } from '../services/api';

const PLATFORMS = [
  'facebook', 'google', 'instagram', 'tiktok', 'youtube',
  'website', 'email', 'whatsapp', 'phone_call', 'other',
];

const PLATFORM_LABELS = {
  facebook:   'Facebook',
  google:     'Google',
  instagram:  'Instagram',
  tiktok:     'TikTok',
  youtube:    'YouTube',
  website:    'Website',
  email:      'Email',
  whatsapp:   'WhatsApp',
  phone_call: 'Phone Call',
  other:      'Other',
};

const PLATFORM_COLORS = {
  facebook:   'bg-blue-100 text-blue-700',
  google:     'bg-red-100 text-red-700',
  instagram:  'bg-pink-100 text-pink-700',
  tiktok:     'bg-slate-100 text-slate-700',
  youtube:    'bg-rose-100 text-rose-700',
  website:    'bg-emerald-100 text-emerald-700',
  email:      'bg-sky-100 text-sky-700',
  whatsapp:   'bg-green-100 text-green-700',
  phone_call: 'bg-violet-100 text-violet-700',
  other:      'bg-amber-100 text-amber-700',
};

const fmtRM = (n) => `RM ${Number(n || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtShort = (n) => {
  const v = Number(n || 0);
  if (v >= 1000000) return `RM ${(v / 1000000).toFixed(2)}M`;
  if (v >= 1000) return `RM ${(v / 1000).toFixed(1)}K`;
  return `RM ${v.toFixed(2)}`;
};
const fmt = (n) => Number(n || 0).toLocaleString('en-MY');

function todayMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const CSV_HEADERS = ['platform', 'campaign', 'date_from', 'date_to', 'amount', 'notes'];

const initialForm = { platform: 'facebook', campaign: '', cost_date: '', date_to: '', amount: '', notes: '' };

export default function MarketingCosts() {
  const [costs, setCosts] = useState([]);
  const [total, setTotal] = useState(0);
  const [roi, setRoi] = useState([]);
  const [loading, setLoading] = useState(false);
  const [roiLoading, setRoiLoading] = useState(false);

  // Manual form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Bulk upload
  const [showUpload, setShowUpload] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadResult, setUploadResult] = useState(null);
  const fileInputRef = useRef(null);

  // Monthly report
  const [showReport, setShowReport] = useState(false);
  const [reportMonth, setReportMonth] = useState(todayMonth);
  const [reportRoi, setReportRoi] = useState([]);
  const [reportCosts, setReportCosts] = useState([]);
  const [reportLoading, setReportLoading] = useState(false);

  // Date range filter
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo]     = useState('');
  const [activeFrom, setActiveFrom] = useState('');
  const [activeTo, setActiveTo]     = useState('');

  // Table
  const [deleteId, setDeleteId] = useState(null);
  const [page, setPage] = useState(1);
  const PER_PAGE = 50;

  const fetchCosts = useCallback(async () => {
    setLoading(true);
    const params = { page, per_page: PER_PAGE };
    if (activeFrom) params.from_date = activeFrom;
    if (activeTo)   params.to_date   = activeTo;
    const data = await getMarketingCosts(params);
    setCosts(data.costs || []);
    setTotal(data.total || 0);
    setLoading(false);
  }, [page, activeFrom, activeTo]);

  const fetchRoi = useCallback(async () => {
    setRoiLoading(true);
    const params = {};
    if (activeFrom) params.from_date = activeFrom;
    if (activeTo)   params.to_date   = activeTo;
    const data = await getMarketingRoi(params);
    setRoi(data || []);
    setRoiLoading(false);
  }, [activeFrom, activeTo]);

  useEffect(() => { fetchCosts(); }, [fetchCosts]);
  useEffect(() => { fetchRoi(); }, [fetchRoi]);

  // ── Monthly report fetch ──────────────────────────────────────────────────
  useEffect(() => {
    if (!showReport) return;
    setReportLoading(true);
    const [year, mon] = reportMonth.split('-');
    const from_date = `${year}-${mon}-01`;
    const lastDay = new Date(Number(year), Number(mon), 0).getDate();
    const to_date = `${year}-${mon}-${lastDay}`;
    Promise.all([
      getMarketingRoi({ from_date, to_date }),
      getMarketingCosts({ per_page: 500, from_date, to_date }),
    ]).then(([roiData, costsData]) => {
      setReportRoi(roiData || []);
      setReportCosts(costsData.costs || []);
      setReportLoading(false);
    });
  }, [showReport, reportMonth]);

  // ── Manual form ───────────────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.platform || !form.campaign.trim() || !form.cost_date || !form.amount) {
      return setFormError('Platform, campaign, start date, and amount are required.');
    }
    if (form.date_to && form.date_to < form.cost_date) {
      return setFormError('End date cannot be before start date.');
    }
    setSaving(true);
    try {
      await createMarketingCost({ ...form, amount: Number(form.amount), date_to: form.date_to || null });
      setForm(initialForm);
      setShowForm(false);
      fetchCosts();
      fetchRoi();
    } catch (err) {
      setFormError(err?.response?.data?.error || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── CSV bulk upload ───────────────────────────────────────────────────────
  const parseCsvLine = (line) => {
    const values = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
        else cur += ch;
      } else if (ch === '"') { inQ = true; }
      else if (ch === ',') { values.push(cur); cur = ''; }
      else cur += ch;
    }
    values.push(cur);
    return values;
  };

  const parseCsv = (text) => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row.');
    const header = parseCsvLine(lines[0]).map((v) => v.trim().toLowerCase());
    // Accept both new (date_from/date_to) and legacy (cost_date) formats
    const isLegacy = header[2] === 'cost_date';
    const expectedNew = CSV_HEADERS;
    const expectedLegacy = ['platform', 'campaign', 'cost_date', 'amount', 'notes'];
    const expected = isLegacy ? expectedLegacy : expectedNew;
    if (expected.some((h, i) => header[i] !== h)) {
      throw new Error(`CSV headers must be: ${CSV_HEADERS.join(', ')}`);
    }
    return lines.slice(1).map((line, idx) => {
      const row = parseCsvLine(line);
      if (row.length < 4) throw new Error(`Row ${idx + 2}: insufficient columns.`);
      if (isLegacy) {
        return { platform: row[0]?.trim() ?? '', campaign: row[1]?.trim() ?? '', date_from: row[2]?.trim() ?? '', date_to: '', amount: row[3]?.trim() ?? '', notes: row[4]?.trim() ?? '' };
      }
      return CSV_HEADERS.reduce((acc, h, i) => { acc[h] = row[i]?.trim() ?? ''; return acc; }, {});
    });
  };

  const downloadTemplate = () => {
    const example = [['facebook', 'Ramadan 2024', '2024-03-10', '2024-03-16', '500.00', 'FB Ads Week 2']];
    const csv = [CSV_HEADERS.join(','), ...example.map((r) => r.map((v) => `"${v}"`).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'marketing-costs-template.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const handleFileSelect = (file) => {
    if (!file) return;
    setUploadError(''); setUploadResult(null); setPendingFile(file);
  };

  const handleUpload = async () => {
    if (!pendingFile) return;
    setUploading(true); setUploadError(''); setUploadResult(null);
    try {
      const text = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read file.'));
        reader.readAsText(pendingFile, 'utf-8');
      });
      const rows = parseCsv(String(text));
      const result = await bulkUploadMarketingCosts(rows);
      setUploadResult(result.imported);
      setPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchCosts(); fetchRoi();
    } catch (err) {
      setUploadError(err?.response?.data?.error || err.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    setDeleteId(id);
    try { await deleteMarketingCost(id); fetchCosts(); fetchRoi(); }
    finally { setDeleteId(null); }
  };

  // ── Monthly report print ──────────────────────────────────────────────────
  const handlePrintReport = () => {
    const monthLabel = new Date(reportMonth + '-02').toLocaleString('en-MY', { month: 'long', year: 'numeric' });
    const totalCostM = reportRoi.reduce((s, r) => s + r.total_cost, 0);
    const totalRevM  = reportRoi.reduce((s, r) => s + r.total_revenue, 0);
    const roasM = totalCostM > 0 ? totalRevM / totalCostM : 0;

    const roiRows = reportRoi.map((r) => `<tr>
      <td style="padding:9px 14px;border-bottom:1px solid #f1f5f9;font-weight:500;">${r.campaign}</td>
      <td style="padding:9px 14px;border-bottom:1px solid #f1f5f9;">${PLATFORM_LABELS[r.platform] || r.platform}</td>
      <td style="padding:9px 14px;border-bottom:1px solid #f1f5f9;text-align:right;color:#e11d48;">${fmtRM(r.total_cost)}</td>
      <td style="padding:9px 14px;border-bottom:1px solid #f1f5f9;text-align:right;color:#059669;">${fmtRM(r.total_revenue)}</td>
      <td style="padding:9px 14px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600;color:${r.net >= 0 ? '#059669' : '#e11d48'};">${r.net >= 0 ? '+' : ''}${fmtRM(r.net)}</td>
      <td style="padding:9px 14px;border-bottom:1px solid #f1f5f9;text-align:right;"><span style="background:${r.roas >= 2 ? '#d1fae5' : r.roas >= 1 ? '#fef3c7' : '#fee2e2'};color:${r.roas >= 2 ? '#065f46' : r.roas >= 1 ? '#92400e' : '#991b1b'};padding:2px 8px;border-radius:999px;font-weight:700;font-size:12px;">${r.roas.toFixed(2)}x</span></td>
    </tr>`).join('');

    const costRows = reportCosts.map((c) => `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;">${c.cost_date}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;">${PLATFORM_LABELS[c.platform] || c.platform}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-weight:500;">${c.campaign}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600;">${fmtRM(c.amount)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#94a3b8;">${c.notes || '—'}</td>
    </tr>`).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>Marketing Report — ${monthLabel}</title>
<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:system-ui,-apple-system,sans-serif;color:#0f172a;background:#fff;padding:32px 40px;}table{width:100%;border-collapse:collapse;font-size:13px;}thead th{background:#f8fafc;padding:9px 14px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;border-bottom:1px solid #e2e8f0;}@media print{body{padding:20px 24px;}}</style>
</head><body>
<img src="${window.location.origin}/Logo%20IhsanKu.png" alt="IhsanKu" style="height:34px;margin-bottom:20px;"/>
<h1 style="font-size:22px;font-weight:700;margin-bottom:4px;">Marketing Cost Report</h1>
<p style="font-size:14px;color:#64748b;margin-bottom:24px;">${monthLabel}</p>
<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:28px;">
  <div style="flex:1;min-width:140px;background:#fff0f0;border:1px solid #fecaca;border-radius:10px;padding:14px;">
    <p style="font-size:10px;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:6px;">Total Cost</p>
    <p style="font-size:20px;font-weight:700;color:#e11d48;">${fmtRM(totalCostM)}</p>
  </div>
  <div style="flex:1;min-width:140px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px;">
    <p style="font-size:10px;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:6px;">Total Revenue</p>
    <p style="font-size:20px;font-weight:700;color:#059669;">${fmtRM(totalRevM)}</p>
  </div>
  <div style="flex:1;min-width:140px;background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;padding:14px;">
    <p style="font-size:10px;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:6px;">ROAS</p>
    <p style="font-size:20px;font-weight:700;color:#7c3aed;">${roasM.toFixed(2)}x</p>
  </div>
</div>
${reportRoi.length > 0 ? `<h3 style="font-size:13px;font-weight:700;margin-bottom:10px;">ROI per Campaign</h3>
<table style="margin-bottom:28px;">
<thead><tr><th>Campaign</th><th>Platform</th><th style="text-align:right;">Cost</th><th style="text-align:right;">Donation</th><th style="text-align:right;">Net</th><th style="text-align:right;">ROAS</th></tr></thead>
<tbody>${roiRows}</tbody>
</table>` : ''}
${reportCosts.length > 0 ? `<h3 style="font-size:13px;font-weight:700;margin-bottom:10px;">Cost Entries (${fmt(reportCosts.length)} records)</h3>
<table>
<thead><tr><th>Date</th><th>Platform</th><th>Campaign</th><th style="text-align:right;">Amount</th><th>Notes</th></tr></thead>
<tbody>${costRows}</tbody>
</table>` : ''}
<p style="margin-top:24px;font-size:11px;color:#94a3b8;">Generated on ${new Date().toLocaleDateString('en-MY', { dateStyle: 'long' })}</p>
<script>window.onload=function(){window.print();};<\/script>
</body></html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
  };

  // ── Derived ───────────────────────────────────────────────────────────────
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
          <h2 className="mt-1 text-base font-bold text-slate-900">Marketing Costs</h2>
          <p className="text-xs text-slate-400 mt-0.5">Track marketing spend and ROI per campaign</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => { fetchCosts(); fetchRoi(); }}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition">
            <RefreshCw className="h-4 w-4" />Refresh
          </button>
          <button type="button" onClick={() => { setShowReport((v) => !v); setShowUpload(false); setShowForm(false); }}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition border ${showReport ? 'bg-violet-600 text-white border-violet-600 hover:bg-violet-700' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}>
            <FileText className="h-4 w-4" />Monthly Report
          </button>
          <button type="button" onClick={() => { setShowUpload((v) => !v); setShowForm(false); setShowReport(false); }}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition border ${showUpload ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}>
            <Upload className="h-4 w-4" />Bulk Upload
          </button>
          <button type="button" onClick={() => { setShowForm((v) => !v); setShowUpload(false); setShowReport(false); setFormError(''); }}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition">
            <Plus className="h-4 w-4" />Add Cost
          </button>
        </div>
      </div>

      {/* Date range filter */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">From Date</label>
          <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">To Date</label>
          <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
        </div>
        <div className="flex gap-2">
          <button type="button"
            onClick={() => { setPage(1); setActiveFrom(filterFrom); setActiveTo(filterTo); }}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition">
            Apply
          </button>
          {(activeFrom || activeTo) && (
            <button type="button"
              onClick={() => { setFilterFrom(''); setFilterTo(''); setActiveFrom(''); setActiveTo(''); setPage(1); }}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">
              Clear
            </button>
          )}
        </div>
        {(activeFrom || activeTo) && (
          <p className="text-xs text-blue-600 font-medium ml-1 self-end pb-2">
            Showing: {activeFrom || '—'} → {activeTo || '—'}
          </p>
        )}
      </div>

      {/* Monthly report panel */}
      {showReport && (
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Monthly Report — Marketing</h3>
              <p className="text-xs text-slate-400 mt-0.5">Cost and ROI summary for the selected month</p>
            </div>
            <div className="flex items-center gap-3">
              <input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
              <button type="button" onClick={handlePrintReport} disabled={reportLoading || reportRoi.length === 0}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40 transition">
                <Printer className="h-4 w-4" />Print / PDF
              </button>
            </div>
          </div>
          {reportLoading ? (
            <p className="text-center text-sm text-slate-400 py-8">Loading…</p>
          ) : reportRoi.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-8">No marketing costs found for this month.</p>
          ) : (
            <>
              {/* Summary */}
              <div className="grid gap-3 sm:grid-cols-3 mb-5">
                {[
                  { label: 'Total Cost', value: fmtRM(reportRoi.reduce((s, r) => s + r.total_cost, 0)), color: 'text-rose-600', bg: 'bg-rose-50' },
                  { label: 'Total Campaign Revenue', value: fmtRM(reportRoi.reduce((s, r) => s + r.total_revenue, 0)), color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { label: 'Monthly ROAS', value: (() => { const c = reportRoi.reduce((s, r) => s + r.total_cost, 0); const rv = reportRoi.reduce((s, r) => s + r.total_revenue, 0); return c > 0 ? `${(rv / c).toFixed(2)}x` : '—'; })(), color: 'text-violet-600', bg: 'bg-violet-50' },
                ].map((s) => (
                  <div key={s.label} className={`rounded-xl ${s.bg} border border-slate-200 px-4 py-3`}>
                    <p className="text-xs font-semibold text-slate-500 mb-1">{s.label}</p>
                    <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>
              {/* ROI table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Campaign</th>
                      <th className="px-4 py-3 text-left">Platform</th>
                      <th className="px-4 py-3 text-right">Cost</th>
                      <th className="px-4 py-3 text-right">Donation</th>
                      <th className="px-4 py-3 text-right">Net</th>
                      <th className="px-4 py-3 text-right">ROAS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {reportRoi.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-800">{row.campaign}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${PLATFORM_COLORS[row.platform] || PLATFORM_COLORS.other}`}>
                            {PLATFORM_LABELS[row.platform] || row.platform}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-rose-600 font-medium">{fmtRM(row.total_cost)}</td>
                        <td className="px-4 py-3 text-right text-emerald-600 font-medium">{fmtRM(row.total_revenue)}</td>
                        <td className={`px-4 py-3 text-right font-semibold ${row.net >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {row.net >= 0 ? '+' : ''}{fmtRM(row.net)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${row.roas >= 2 ? 'bg-emerald-100 text-emerald-700' : row.roas >= 1 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-600'}`}>
                            {row.roas.toFixed(2)}x
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Bulk upload panel */}
      {showUpload && (
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900">Bulk Upload CSV</h3>
            <button type="button" onClick={downloadTemplate} className="text-xs font-semibold text-blue-600 hover:underline">
              Download template
            </button>
          </div>
          {/* Format hint */}
          <div className="mb-4 rounded-xl bg-slate-50 p-3 text-xs font-mono text-slate-500">
            <p className="font-semibold text-slate-700 not-italic mb-1">CSV Format (date range per row):</p>
            <p>platform,campaign,date_from,date_to,amount,notes</p>
            <p className="text-slate-400">facebook,Ramadan 2024,2024-03-10,2024-03-16,500.00,Week 2</p>
            <p className="text-slate-400 mt-1 not-italic">• <span className="font-semibold text-slate-600">date_from</span> = start of period &nbsp;•&nbsp; <span className="font-semibold text-slate-600">date_to</span> = end of period (leave blank for single day)</p>
            <p className="text-slate-400 mt-0.5 not-italic">• Platform: {PLATFORMS.join(', ')}</p>
          </div>
          {/* Drop zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); handleFileSelect(e.dataTransfer.files?.[0]); }}
            className={`cursor-pointer rounded-xl border-2 border-dashed px-6 py-8 text-center transition
              ${dragging ? 'border-blue-400 bg-blue-100' : pendingFile ? 'border-emerald-400 bg-emerald-50' : 'border-blue-200 bg-blue-50 hover:bg-blue-100'}`}
          >
            <div className="text-3xl mb-2">📂</div>
            {pendingFile ? (
              <><p className="text-sm font-bold text-emerald-700">{pendingFile.name}</p>
              <p className="text-xs text-emerald-500 mt-1">File ready to upload</p></>
            ) : (
              <><p className="text-sm font-bold text-blue-700">Drag &amp; drop a CSV file</p>
              <p className="text-xs text-slate-400 mt-1">or click to browse</p></>
            )}
            <input ref={fileInputRef} type="file" accept=".csv,text/csv"
              onChange={(e) => handleFileSelect(e.target.files?.[0])} className="hidden" />
          </div>
          {uploadError && (
            <div className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">{uploadError}</div>
          )}
          {uploadResult != null && (
            <div className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
              ✅ <span className="font-semibold">{fmt(uploadResult)}</span> records imported successfully
            </div>
          )}
          <button type="button" onClick={handleUpload} disabled={!pendingFile || uploading}
            className="mt-4 w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40 transition">
            {uploading ? 'Processing…' : 'Upload & Process CSV'}
          </button>
        </div>
      )}

      {/* Manual form */}
      {showForm && (
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h3 className="text-sm font-bold text-slate-900 mb-4">New Marketing Cost Entry</h3>
          {formError && (
            <div className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">{formError}</div>
          )}
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Platform</label>
              <select name="platform" value={form.platform} onChange={handleChange}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100">
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Campaign Name</label>
              <input name="campaign" value={form.campaign} onChange={handleChange} placeholder="e.g. Ramadan 2024"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Start Date</label>
              <div className="flex flex-col gap-1.5">
                <input type="date" name="cost_date" value={form.cost_date} onChange={handleChange}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
                <div className="flex gap-1.5">
                  {[
                    { label: 'This week', fn: () => {
                      const d = new Date(); const day = d.getDay(); const diff = day === 0 ? -6 : 1 - day;
                      const mon = new Date(d); mon.setDate(d.getDate() + diff);
                      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
                      const fmt2 = (x) => x.toISOString().slice(0, 10);
                      setForm((f) => ({ ...f, cost_date: fmt2(mon), date_to: fmt2(sun) }));
                    }},
                    { label: 'Last week', fn: () => {
                      const d = new Date(); const day = d.getDay(); const diff = day === 0 ? -6 : 1 - day;
                      const mon = new Date(d); mon.setDate(d.getDate() + diff - 7);
                      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
                      const fmt2 = (x) => x.toISOString().slice(0, 10);
                      setForm((f) => ({ ...f, cost_date: fmt2(mon), date_to: fmt2(sun) }));
                    }},
                  ].map(({ label, fn }) => (
                    <button key={label} type="button" onClick={fn}
                      className="flex-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-100 transition">
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">End Date <span className="font-normal text-slate-400">(optional)</span></label>
              <input type="date" name="date_to" value={form.date_to} onChange={handleChange}
                min={form.cost_date || undefined}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
              {form.cost_date && form.date_to && form.date_to >= form.cost_date && (
                <p className="text-xs text-slate-400 mt-1">
                  {Math.round((new Date(form.date_to) - new Date(form.cost_date)) / 86400000) + 1} day(s)
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Amount (RM)</label>
              <input type="number" step="0.01" min="0" name="amount" value={form.amount} onChange={handleChange} placeholder="0.00"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Notes (optional)</label>
              <input name="notes" value={form.notes} onChange={handleChange} placeholder="Any additional notes..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
            </div>
            <div className="sm:col-span-2 lg:col-span-4 flex justify-end gap-2">
              <button type="button" onClick={() => { setShowForm(false); setForm(initialForm); setFormError(''); }}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">Cancel</button>
              <button type="submit" disabled={saving}
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-white border border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500"><DollarSign className="h-3.5 w-3.5 text-white" /></div>
            <p className="text-xs font-semibold text-slate-500">Total Marketing Cost</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">{fmtShort(totalCost)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{fmtRM(totalCost)}</p>
        </div>
        <div className="rounded-xl bg-white border border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500"><TrendingUp className="h-3.5 w-3.5 text-white" /></div>
            <p className="text-xs font-semibold text-slate-500">Total Campaign Revenue</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">{fmtShort(totalRevenue)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{fmtRM(totalRevenue)}</p>
        </div>
        <div className="rounded-xl bg-white border border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500"><BarChart2 className="h-3.5 w-3.5 text-white" /></div>
            <p className="text-xs font-semibold text-slate-500">Overall ROAS</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">{overallRoas.toFixed(2)}x</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {overallRoas >= 1 ? `Profit RM ${(totalRevenue - totalCost).toLocaleString('en-MY', { minimumFractionDigits: 2 })}` : totalCost > 0 ? 'Below break-even' : 'No data'}
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
                <th className="px-5 py-3 text-right">Cost</th>
                <th className="px-5 py-3 text-right">Donation</th>
                <th className="px-5 py-3 text-right">Net</th>
                <th className="px-5 py-3 text-right">ROAS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {roiLoading ? (
                <tr><td colSpan="6" className="px-5 py-10 text-center text-slate-400">Loading…</td></tr>
              ) : roi.length === 0 ? (
                <tr><td colSpan="6" className="px-5 py-10 text-center text-slate-400">No ROI data. Add marketing costs to get started.</td></tr>
              ) : roi.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50 transition">
                  <td className="px-5 py-3.5 font-medium text-slate-800 max-w-[200px] truncate">{row.campaign}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${PLATFORM_COLORS[row.platform] || PLATFORM_COLORS.other}`}>
                      {PLATFORM_LABELS[row.platform] || row.platform}
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
            Cost Entries {total > 0 && <span className="text-slate-400 font-normal">({fmt(total)} records)</span>}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="px-5 py-3 text-left">Date</th>
                <th className="px-5 py-3 text-left">Platform</th>
                <th className="px-5 py-3 text-left">Campaign</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3 text-left">Notes</th>
                <th className="px-5 py-3 text-left">Added by</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr><td colSpan="7" className="px-5 py-10 text-center text-slate-400">Loading…</td></tr>
              ) : costs.length === 0 ? (
                <tr><td colSpan="7" className="px-5 py-10 text-center text-slate-400">No cost records. Click "Add Cost" to get started.</td></tr>
              ) : costs.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 transition">
                  <td className="px-5 py-3.5 whitespace-nowrap text-slate-500">
                    {c.date_to && c.date_to !== c.cost_date
                      ? <span>{c.cost_date} <span className="text-slate-300 mx-0.5">→</span> {c.date_to}</span>
                      : c.cost_date}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${PLATFORM_COLORS[c.platform] || PLATFORM_COLORS.other}`}>
                      {PLATFORM_LABELS[c.platform] || c.platform}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-medium text-slate-800 max-w-[200px] truncate">{c.campaign}</td>
                  <td className="px-5 py-3.5 text-right font-semibold text-slate-900">{fmtRM(c.amount)}</td>
                  <td className="px-5 py-3.5 text-slate-400 max-w-[180px] truncate">{c.notes || '—'}</td>
                  <td className="px-5 py-3.5 text-xs text-slate-400">{c.created_by || '—'}</td>
                  <td className="px-5 py-3.5">
                    <button type="button" onClick={() => handleDelete(c.id)} disabled={deleteId === c.id}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40 transition">
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
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40 transition">
              Previous
            </button>
            <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
            <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40 transition">
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
