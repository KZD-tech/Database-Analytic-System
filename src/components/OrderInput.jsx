import { useState } from 'react';
import { ArrowRight, CalendarDays, DollarSign, Mail, Phone, ShoppingBag, User } from 'lucide-react';
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
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [uploading, setUploading] = useState(false);

  const csvHeaders = ['name', 'phone', 'email', 'donation_date', 'amount', 'source', 'campaign'];

  const formatCsvValue = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

  const downloadTemplate = () => {
    const exampleRow = [
      'Siti Nurhaliza',
      '0123456789',
      'siti@example.com',
      '2026-05-16',
      '120.00',
      'facebook',
      'Kempen Ramadan'
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
      throw new Error('CSV mesti mempunyai baris tajuk dan sekurang-kurangnya satu baris rekod.');
    }

    const header = parseCsvLine(lines[0]).map((value) => value.trim().toLowerCase());
    if (header.length !== csvHeaders.length || csvHeaders.some((column, index) => header[index] !== column)) {
      throw new Error(`Tajuk CSV mesti: ${csvHeaders.join(', ')}.`);
    }

    return lines.slice(1).map((line, index) => {
      const row = parseCsvLine(line);
      if (row.length !== csvHeaders.length) {
        throw new Error(`Baris ${index + 2} tidak mempunyai ${csvHeaders.length} lajur.`);
      }
      return csvHeaders.reduce((acc, column, columnIndex) => {
        acc[column] = row[columnIndex]?.trim() ?? '';
        return acc;
      }, {});
    });
  };

  const handleCsvFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadError('');
    setUploadSuccess('');
    setUploading(true);

    try {
      const text = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Gagal membaca fail CSV.'));
        reader.readAsText(file, 'utf-8');
      });

      const rows = parseCsv(String(text));
      const result = await bulkUploadOrders(String(text));
      setUploadSuccess(`Berjaya memuat naik ${result.imported || rows.length} baris.`);
      setForm(initialForm);
      onOrderCreated();
    } catch (err) {
      setUploadError(err.message || 'Gagal memuat naik CSV. Sila cuba lagi.');
    } finally {
      setUploading(false);
      event.target.value = '';
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
      return setError('Tarikh dan jumlah adalah wajib.');
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
      setError('Tidak dapat menghantar pesanan. Sila cuba lagi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 rounded-2xl bg-white p-8 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.26em] text-slate-500">Tambah pesanan</p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-950">Rekodkan pesanan baru</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Hantar pesanan manual dan padankan pelanggan secara automatik jika ada.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
          <ShoppingBag className="h-4 w-4" />
          Borang pesanan
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
            <label className="block text-sm font-semibold text-slate-700">Tarikh pesanan</label>
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
            <label className="block text-sm font-semibold text-slate-700">Jumlah</label>
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
            <label className="block text-sm font-semibold text-slate-700">Sumber pesanan</label>
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
              <option value="other">Lain-lain</option>
            </select>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
              <User className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Maklumat pelanggan</p>
              <p className="text-sm text-slate-500">Isikan butiran pelanggan untuk padanan.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-slate-700">Nama penuh</label>
              <input
                name="full_name"
                value={form.full_name}
                onChange={handleChange}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700">Telefon</label>
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
              <label className="block text-sm font-semibold text-slate-700">Emel</label>
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
              <label className="block text-sm font-semibold text-slate-700">Kempen</label>
              <input
                name="campaign"
                value={form.campaign}
                onChange={handleChange}
                placeholder="Nama kempen atau sumber promosi"
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
            {saving ? 'Menyimpan…' : 'Simpan pesanan'}
          </button>
        </div>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.26em] text-slate-500">Muat naik CSV berkumpulan</p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-950">Import pesanan dari fail CSV</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Muat naik fail CSV mengikut templat untuk memasukkan banyak pesanan sekaligus.</p>
          </div>
          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
          >
            Muat turun templat CSV
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700">Pilih fail CSV</label>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleCsvFile}
              className="mt-2 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
            />
          </div>
          <div className="rounded-2xl bg-slate-100 p-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-800">Format CSV yang disokong:</p>
            <p className="mt-2">name, phone, email, donation_date, amount, source, campaign</p>
            <p className="mt-2">Tarikh mesti dalam format <span className="font-semibold">YYYY-MM-DD</span>, jumlah dalam nombor desimal.</p>
          </div>

          {uploadError && (
            <div className="rounded-xl bg-rose-50 px-5 py-4 text-sm text-rose-700 ring-1 ring-rose-200">
              {uploadError}
            </div>
          )}

          {uploadSuccess && (
            <div className="rounded-xl bg-emerald-50 px-5 py-4 text-sm text-emerald-700 ring-1 ring-emerald-200">
              {uploadSuccess}
            </div>
          )}

          {uploading && (
            <div className="rounded-xl bg-slate-100 px-5 py-4 text-sm text-slate-700 ring-1 ring-slate-200">
              Memuat naik CSV… Sila tunggu.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
