import { useState, useRef } from 'react';
import { ArrowRight, CalendarDays, DollarSign, Mail, Phone, ShoppingBag, User, Upload } from 'lucide-react';
import { createOrder, bulkUploadOrders } from '../services/api';

const initialForm = {
  full_name: '',
  phone: '',
  email: '',
  order_date: '',
  amount: '',
  source: 'facebook',
  campaign: ''
};

export default function OrderInput({ onOrderCreated }) {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadResult, setUploadResult] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const fileInputRef = useRef(null);

  const csvHeaders = ['name', 'phone', 'email', 'donation_date', 'amount', 'source', 'campaign'];

  const formatCsvValue = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

  const downloadTemplate = () => {
    const exampleRow = [
      'John Smith',
      '0123456789',
      'john@example.com',
      '2026-05-16',
      '120.00',
      'facebook',
      'Ramadan Campaign'
    ];
    const csv = [csvHeaders.join(','), exampleRow.map(formatCsvValue).join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'bulk-upload-template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const parseCsvLine = (line) => {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];

      if (inQuotes) {
        if (char === '"') {
          if (line[i + 1] === '"') {
            current += '"';
            i += 1;
          } else {
            inQuotes = false;
          }
        } else {
          current += char;
        }
        continue;
      }

      if (char === '"') {
        inQuotes = true;
        continue;
      }

      if (char === ',') {
        values.push(current);
        current = '';
        continue;
      }

      current += char;
    }

    values.push(current);
    return values;
  };

  const parseCsv = (text) => {
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length < 2) {
      throw new Error('CSV must have a header row and at least one data row.');
    }

    const header = parseCsvLine(lines[0]).map((value) => value.trim().toLowerCase());
    if (header.length !== csvHeaders.length || csvHeaders.some((column, index) => header[index] !== column)) {
      throw new Error(`CSV headers must be: ${csvHeaders.join(', ')}.`);
    }

    return lines.slice(1).map((line, index) => {
      const row = parseCsvLine(line);
      if (row.length !== csvHeaders.length) {
        throw new Error(`Row ${index + 2} does not have ${csvHeaders.length} columns.`);
      }
      return csvHeaders.reduce((acc, column, columnIndex) => {
        acc[column] = row[columnIndex]?.trim() ?? '';
        return acc;
      }, {});
    });
  };

  const handleFileSelect = (file) => {
    if (!file) return;
    setUploadError('');
    setUploadResult(null);
    setPendingFile(file);
  };

  const handleCsvFile = (event) => handleFileSelect(event.target.files?.[0]);

  const handleDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    handleFileSelect(event.dataTransfer.files?.[0]);
  };

  const handleUpload = async () => {
    if (!pendingFile) return;
    setUploadError('');
    setUploadResult(null);
    setUploading(true);
    try {
      const text = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read CSV file.'));
        reader.readAsText(pendingFile, 'utf-8');
      });
      const rows = parseCsv(String(text));
      const result = await bulkUploadOrders(String(text));
      setUploadResult({
        rows: result.imported ?? rows.length,
        newDonors: result.new_donors ?? 0,
        transactions: result.imported ?? rows.length,
      });
      setPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onOrderCreated();
    } catch (err) {
      setUploadError(err.message || 'Failed to upload CSV. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (!form.order_date || !form.amount) {
      return setError('Date and amount are required.');
    }
    setSaving(true);
    try {
      await createOrder({
        customer: {
          full_name: form.full_name,
          phone: form.phone,
          email: form.email,
          campaign: form.campaign
        },
        order_date: form.order_date,
        amount: Number(form.amount),
        source: form.source
      });
      setForm(initialForm);
      onOrderCreated();
    } catch (err) {
      setError('Unable to submit donation. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 rounded-2xl bg-white p-8 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.26em] text-slate-500">Add donation</p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-950">Record a new donation</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Submit a manual donation and automatically match the donor if they already exist.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
          <ShoppingBag className="h-4 w-4" />
          Donation form
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 px-5 py-4 text-sm text-rose-700 ring-1 ring-rose-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-semibold text-slate-700">Donation date</label>
            <div className="relative mt-2">
              <CalendarDays className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                name="order_date"
                value={form.order_date}
                onChange={handleChange}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-12 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700">Amount</label>
            <div className="relative mt-2">
              <DollarSign className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="number"
                step="0.01"
                name="amount"
                value={form.amount}
                onChange={handleChange}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-12 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
              />
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <label className="block text-sm font-semibold text-slate-700">Donation source</label>
            <select
              name="source"
              value={form.source}
              onChange={handleChange}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
            >
              <option value="facebook">Facebook</option>
              <option value="google">Google</option>
              <option value="youtube">YouTube</option>
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
              <option value="website">Website</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
              <User className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Donor information</p>
              <p className="text-sm text-slate-500">Fill in donor details for matching.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-slate-700">Full name</label>
              <input
                name="full_name"
                value={form.full_name}
                onChange={handleChange}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700">Phone</label>
              <div className="relative mt-2">
                <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-12 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
                />
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700">Email</label>
              <div className="relative mt-2">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-12 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
                />
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700">Campaign</label>
              <input
                name="campaign"
                value={form.campaign}
                onChange={handleChange}
                placeholder="Campaign name or promotion source"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <ArrowRight className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save donation'}
          </button>
        </div>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span>📁</span> CSV Bulk Upload
          </h2>
          <button
            type="button"
            onClick={downloadTemplate}
            className="text-xs font-semibold text-blue-600 hover:underline"
          >
            Download template
          </button>
        </div>

        {/* Drop zone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`cursor-pointer rounded-2xl border-2 border-dashed px-6 py-10 text-center transition
            ${dragging ? 'border-blue-400 bg-blue-100' : pendingFile ? 'border-emerald-400 bg-emerald-50' : 'border-blue-200 bg-blue-50 hover:bg-blue-100'}`}
        >
          <div className="text-4xl mb-3">📂</div>
          {pendingFile ? (
            <>
              <p className="text-sm font-bold text-emerald-700">{pendingFile.name}</p>
              <p className="text-xs text-emerald-500 mt-1">File ready to upload</p>
            </>
          ) : (
            <>
              <p className="text-sm font-bold text-blue-700">Drag &amp; drop a CSV file</p>
              <p className="text-xs text-slate-400 mt-1">or click to browse</p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleCsvFile}
            className="hidden"
          />
        </div>

        {/* Format hint */}
        <div className="mt-4 rounded-xl bg-slate-50 p-4 text-xs text-slate-500 font-mono leading-relaxed">
          <p className="font-semibold text-slate-700 not-italic mb-1">Format CSV:</p>
          <p>name,phone,email,donation_date,amount,source,campaign</p>
          <p className="text-slate-400">Ahmad,60112345678,a@gmail.com,2024-01-15,50.00,Facebook,FB-ramadan</p>
        </div>

        {/* Error */}
        {uploadError && (
          <div className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">
            {uploadError}
          </div>
        )}

        {/* Result */}
        {uploadResult && (
          <div className="mt-4 rounded-xl bg-emerald-50 px-5 py-4 space-y-1.5 ring-1 ring-emerald-200">
            <p className="text-sm text-emerald-800">✅ <span className="font-semibold">{uploadResult.rows.toLocaleString('en-MY')}</span> rows processed successfully</p>
            <p className="text-sm text-emerald-800">✅ <span className="font-semibold">{uploadResult.newDonors.toLocaleString('en-MY')}</span> new donors added</p>
            <p className="text-sm text-emerald-800">✅ <span className="font-semibold">{uploadResult.transactions.toLocaleString('en-MY')}</span> transactions recorded</p>
          </div>
        )}

        {/* Upload button */}
        <button
          type="button"
          onClick={handleUpload}
          disabled={!pendingFile || uploading}
          className="mt-5 w-full rounded-2xl bg-blue-600 py-3.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {uploading ? 'Processing… Please wait' : 'Upload & Process CSV'}
        </button>
      </div>
    </div>
  );
}
