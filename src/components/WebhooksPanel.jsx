import { useState, useEffect } from 'react';
import { Copy, Check, Plus, Trash2, Webhook, Activity, X, ToggleLeft, ToggleRight } from 'lucide-react';
import { getWebhooks, createWebhook, updateWebhook, deleteWebhook, getWebhookLogs } from '../services/api';

const EVENT_OPTIONS = [
  { value: 'order.created', label: 'Order created (order.created)' },
  { value: 'customer.created', label: 'New donor (customer.created)' },
  { value: '*', label: 'All events (*)' }
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
      {copied ? 'Copied' : 'Copy'}
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
      setFormError('Please fill in name, URL and select at least one event.');
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
      const msg = err?.response?.data?.error || 'Failed to create webhook.';
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
    if (!window.confirm('Are you sure you want to delete this webhook?')) return;
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
          <p className="text-sm font-semibold uppercase tracking-[0.26em] text-slate-500">Integrations</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Webhooks &amp; Integrations</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Manage inbound and outbound webhooks to integrate external systems with the IhsanKu platform.
          </p>
        </div>
      </section>

      {/* Inbound Webhooks */}
      <section className="rounded-2xl bg-white p-6 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200">
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-slate-950">Inbound Webhooks / Integrations</h3>
          <p className="mt-1 text-sm text-slate-500">Use the URLs below to send order data from external platforms to this system.</p>
        </div>

        <div className="space-y-3">
          <UrlRow label="Shopify — POST" url={shopifyUrl} />
          <UrlRow label="WooCommerce — POST" url={woocommerceUrl} />
          <UrlRow label="Generic — POST" url={genericUrl} />
          <UrlRow label="Custom Webhook (generated secret) — POST" url={inboundUrl} />
        </div>

        <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <strong>Tip:</strong> For Shopify, configure the <code className="rounded bg-slate-200 px-1">orders/create</code> webhook and point it to the Shopify URL above. For WooCommerce, go to WooCommerce &rarr; Settings &rarr; Advanced &rarr; Webhooks.
        </div>
      </section>

      {/* Outbound Webhooks */}
      <section className="rounded-2xl bg-white p-6 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-slate-950">Outbound Webhooks</h3>
            <p className="mt-1 text-sm text-slate-500">Send notifications to external URLs when events occur in the system.</p>
          </div>
          <button
            type="button"
            onClick={() => { setShowForm(true); setFormError(''); }}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            Add webhook
          </button>
        </div>

        {showForm && (
          <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-slate-900">New webhook</h4>
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
                <label className="block text-sm font-semibold text-slate-700" htmlFor="wh-name">Name</label>
                <input
                  id="wh-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  required
                  placeholder="e.g. Slack Notification"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700" htmlFor="wh-url">Endpoint URL</label>
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
                <label className="block text-sm font-semibold text-slate-700" htmlFor="wh-secret">Secret (optional)</label>
                <input
                  id="wh-secret"
                  type="text"
                  value={form.secret}
                  onChange={(e) => setForm((p) => ({ ...p, secret: e.target.value }))}
                  placeholder="webhook secret token"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
                />
              </div>
              <div>
                <p className="block text-sm font-semibold text-slate-700 mb-2">Events</p>
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
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-full bg-slate-900 px-6 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {submitting ? 'Saving…' : 'Save webhook'}
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-500 py-4">Loading webhooks…</p>
        ) : webhooks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">
            <Webhook className="mx-auto h-8 w-8 mb-2" />
            <p className="text-sm">No webhooks configured.</p>
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
                      {wh.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="mt-0.5 break-all font-mono text-xs text-slate-500">{wh.url}</p>
                  <p className="mt-1 text-xs text-slate-400">Events: {wh.events}</p>
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
                    {wh.active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(wh.id)}
                    className="rounded-full bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100"
                    title="Delete webhook"
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
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-slate-400" />
            <div>
              <h3 className="text-xl font-semibold text-slate-950">Webhook Activity Log</h3>
              <p className="mt-0.5 text-sm text-slate-500">Recent inbound receives and outbound deliveries.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            <Activity className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {recentLogs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-slate-400">
            <Activity className="mx-auto h-7 w-7 mb-2 opacity-40" />
            <p className="text-sm">No activity logged yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto overflow-hidden rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="px-4 py-3 font-semibold">Direction</th>
                  <th className="px-4 py-3 font-semibold">Source / Destination</th>
                  <th className="px-4 py-3 font-semibold">Event</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Code</th>
                  <th className="px-4 py-3 font-semibold">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {recentLogs.map((log) => {
                  const isInbound = log.event?.startsWith('inbound.');
                  const wh = webhooks.find((w) => w.id === log.webhook_id);
                  const sourceLabel = isInbound
                    ? log.event.replace('inbound.', '').replace('receive', 'custom')
                    : (wh?.name || (log.webhook_id ? `#${String(log.webhook_id).slice(0,8)}` : '—'));
                  return (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          isInbound ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {isInbound ? '↓ Inbound' : '↑ Outbound'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800 capitalize">{sourceLabel}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{log.event}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          log.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-400">{log.response_code ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                        {log.created_at ? new Date(log.created_at).toLocaleString('en-MY') : '—'}
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
