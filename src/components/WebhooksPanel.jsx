import { useState, useEffect } from 'react';
import { Copy, Check, Plus, Trash2, Webhook, Activity, X, ToggleLeft, ToggleRight } from 'lucide-react';
import { getWebhooks, createWebhook, updateWebhook, deleteWebhook, getWebhookLogs } from '../services/api';

const EVENT_OPTIONS = [
  { value: 'order.created', label: 'Pesanan dibuat (order.created)' },
  { value: 'customer.created', label: 'Pelanggan baharu (customer.created)' },
  { value: '*', label: 'Semua acara (*)' }
];

const BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="ml-2 inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-200"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Disalin' : 'Salin'}
    </button>
  );
}

function UrlRow({ label, url }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
        <p className="mt-0.5 break-all font-mono text-sm text-slate-800">{url}</p>
      </div>
      <CopyButton text={url} />
    </div>
  );
}

const defaultForm = { name: '', url: '', events: [], secret: '' };

export default function WebhooksPanel() {
  const [webhooks, setWebhooks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [inboundSecret] = useState(() => {
    const stored = localStorage.getItem('inbound_webhook_secret');
    if (stored) return stored;
    const generated = Math.random().toString(36).slice(2, 18) + Math.random().toString(36).slice(2, 18);
    localStorage.setItem('inbound_webhook_secret', generated);
    return generated;
  });

  const loadData = async () => {
    setLoading(true);
    const [whData, logData] = await Promise.all([getWebhooks(), getWebhookLogs()]);
    setWebhooks(Array.isArray(whData) ? whData : []);
    setLogs(Array.isArray(logData) ? logData : []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleEventToggle = (value) => {
    setForm((prev) => {
      const events = prev.events.includes(value)
        ? prev.events.filter((e) => e !== value)
        : [...prev.events, value];
      return { ...prev, events };
    });
  };

  const handleCreateWebhook = async (e) => {
    e.preventDefault();
    if (!form.name || !form.url || form.events.length === 0) {
      setFormError('Sila isi nama, URL dan pilih sekurang-kurangnya satu acara.');
      return;
    }
    setSubmitting(true);
    try {
      await createWebhook({
        name: form.name,
        url: form.url,
        events: form.events.join(','),
        secret: form.secret || undefined
      });
      setForm(defaultForm);
      setShowForm(false);
      await loadData();
    } catch (err) {
      const msg = err?.response?.data?.error || 'Gagal mencipta webhook.';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (wh) => {
    try {
      await updateWebhook(wh.id, { active: !wh.active });
      await loadData();
    } catch {
      // ignore
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Adakah anda pasti untuk memadam webhook ini?')) return;
    try {
      await deleteWebhook(id);
      await loadData();
    } catch {
      // ignore
    }
  };

  const inboundUrl = `${BASE_URL}/api/webhooks/receive/${inboundSecret}`;
  const shopifyUrl = `${BASE_URL}/api/integrations/shopify`;
  const woocommerceUrl = `${BASE_URL}/api/integrations/woocommerce`;
  const genericUrl = `${BASE_URL}/api/integrations/generic`;

  const recentLogs = logs.slice(0, 50);

  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-white p-6 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.26em] text-slate-500">Integrasi</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Webhooks &amp; Integrasi</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Urus webhook masuk dan keluar untuk mengintegrasikan sistem luar dengan platform IhsanKu.
          </p>
        </div>
      </section>

      {/* Inbound Webhooks */}
      <section className="rounded-2xl bg-white p-6 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200">
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-slate-950">Webhook Masuk / Integrasi</h3>
          <p className="mt-1 text-sm text-slate-500">Gunakan URL di bawah untuk menghantar data pesanan dari platform luar ke sistem ini.</p>
        </div>

        <div className="space-y-3">
          <UrlRow label="Shopify — POST" url={shopifyUrl} />
          <UrlRow label="WooCommerce — POST" url={woocommerceUrl} />
          <UrlRow label="Generik — POST" url={genericUrl} />
          <UrlRow label="Webhook Tersuai (rahsia dijana) — POST" url={inboundUrl} />
        </div>

        <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <strong>Petua:</strong> Untuk Shopify, konfigurasikan webhook <code className="rounded bg-slate-200 px-1">orders/create</code> dan hantarkan ke URL Shopify di atas. Untuk WooCommerce, gunakan WooCommerce &rarr; Settings &rarr; Advanced &rarr; Webhooks.
        </div>
      </section>

      {/* Outbound Webhooks */}
      <section className="rounded-2xl bg-white p-6 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-slate-950">Webhook Keluar</h3>
            <p className="mt-1 text-sm text-slate-500">Hantar notifikasi ke URL luar apabila acara berlaku dalam sistem.</p>
          </div>
          <button
            type="button"
            onClick={() => { setShowForm(true); setFormError(''); }}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            Tambah webhook
          </button>
        </div>

        {showForm && (
          <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-slate-900">Webhook baharu</h4>
              <button
                type="button"
                onClick={() => { setShowForm(false); setForm(defaultForm); setFormError(''); }}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreateWebhook} className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-slate-700" htmlFor="wh-name">Nama</label>
                <input
                  id="wh-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  required
                  placeholder="cth: Slack Notifikasi"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700" htmlFor="wh-url">URL Endpoint</label>
                <input
                  id="wh-url"
                  type="url"
                  value={form.url}
                  onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))}
                  required
                  placeholder="https://hooks.example.com/..."
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700" htmlFor="wh-secret">Rahsia (pilihan)</label>
                <input
                  id="wh-secret"
                  type="text"
                  value={form.secret}
                  onChange={(e) => setForm((p) => ({ ...p, secret: e.target.value }))}
                  placeholder="token rahsia webhook"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
                />
              </div>
              <div>
                <p className="block text-sm font-semibold text-slate-700 mb-2">Acara</p>
                <div className="space-y-2">
                  {EVENT_OPTIONS.map((opt) => (
                    <label key={opt.value} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={form.events.includes(opt.value)}
                        onChange={() => handleEventToggle(opt.value)}
                        className="h-4 w-4 rounded border-slate-300 text-slate-900"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>
              {formError && (
                <div className="sm:col-span-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{formError}</div>
              )}
              <div className="sm:col-span-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setForm(defaultForm); setFormError(''); }}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-full bg-slate-900 px-6 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {submitting ? 'Menyimpan…' : 'Simpan webhook'}
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-500 py-4">Memuatkan webhooks…</p>
        ) : webhooks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">
            <Webhook className="mx-auto h-8 w-8 mb-2" />
            <p className="text-sm">Tiada webhook dikonfigurasi.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {webhooks.map((wh) => (
              <div
                key={wh.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900">{wh.name}</p>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                        wh.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      {wh.active ? 'Aktif' : 'Tidak aktif'}
                    </span>
                  </div>
                  <p className="mt-0.5 break-all font-mono text-xs text-slate-500">{wh.url}</p>
                  <p className="mt-1 text-xs text-slate-400">Acara: {wh.events}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(wh)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      wh.active
                        ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    {wh.active ? 'Nyahaktif' : 'Aktifkan'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(wh.id)}
                    className="rounded-full bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100"
                    title="Padam webhook"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent Logs */}
      <section className="rounded-2xl bg-white p-6 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200">
        <div className="mb-6 flex items-center gap-3">
          <Activity className="h-5 w-5 text-slate-400" />
          <h3 className="text-xl font-semibold text-slate-950">Log Webhook Terkini</h3>
        </div>

        {recentLogs.length === 0 ? (
          <p className="text-sm text-slate-400 py-4">Tiada log ditemui.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="px-4 py-3 font-semibold">Webhook</th>
                  <th className="px-4 py-3 font-semibold">Acara</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Kod</th>
                  <th className="px-4 py-3 font-semibold">Masa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {recentLogs.map((log) => {
                  const wh = webhooks.find((w) => w.id === log.webhook_id);
                  return (
                    <tr key={log.id}>
                      <td className="px-4 py-3 text-slate-800">{wh?.name || `#${log.webhook_id}`}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{log.event}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                            log.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{log.response_code ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {log.created_at ? new Date(log.created_at).toLocaleString('ms-MY') : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
