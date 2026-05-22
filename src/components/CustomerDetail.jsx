import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, CalendarDays, CheckCircle2, Mail, Phone, RefreshCw, ShoppingBag, User, StickyNote, Trash2, Send } from 'lucide-react';
import { getCustomerDetail, updateCustomer, getDonorNotes, addDonorNote, deleteDonorNote } from '../services/api';

const fmt = (n) => Number(n || 0).toLocaleString('en-MY');
const fmtRM = (n) => `RM ${Number(n || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const statusBadges = {
  active: 'bg-emerald-100 text-emerald-700',
  repeat: 'bg-sky-100 text-sky-700',
  dormant: 'bg-amber-100 text-amber-700',
  churn: 'bg-rose-100 text-rose-700',
  new: 'bg-slate-100 text-slate-700'
};

export default function CustomerDetail() {
  const { id } = useParams();
  const [detail, setDetail] = useState(null);
  const [profile, setProfile] = useState({ full_name: '', phone: '', email: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);

  const loadCustomer = async () => {
    const data = await getCustomerDetail(id);
    if (data) {
      setDetail(data);
      setProfile({
        full_name: data.customer.full_name || '',
        phone: data.customer.phone || '',
        email: data.customer.email || ''
      });
    }
    setLoading(false);
  };

  const loadNotes = () => getDonorNotes(id).then(setNotes);

  useEffect(() => {
    loadCustomer();
    loadNotes();
  }, [id]);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setNoteSaving(true);
    try {
      await addDonorNote(id, newNote.trim());
      setNewNote('');
      loadNotes();
    } finally {
      setNoteSaving(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    await deleteDonorNote(id, noteId);
    loadNotes();
  };

  if (loading) {
    return <div className="py-10 text-center text-slate-500">Loading donor details…</div>;
  }

  if (!detail) {
    return <div className="py-10 text-center text-slate-500">Donor not found.</div>;
  }

  const { customer, orders } = detail;

  const handleProfileChange = (event) => {
    const { name, value } = event.target;
    setProfile((current) => ({ ...current, [name]: value }));
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setMessage('');
    try {
      await updateCustomer(id, profile);
      setMessage('Donor profile updated successfully.');
      loadCustomer();
    } catch (error) {
      setMessage('Unable to save donor profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 rounded-2xl bg-white p-8 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.26em] text-slate-500">Donor details</p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-950">{customer.full_name}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Donor profile, contact information, and donation history in one place.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
          <span className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold ${statusBadges[customer.status] || statusBadges.new}`}>
            <CheckCircle2 className="h-4 w-4" />
            {customer.status}
          </span>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl bg-white p-6 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200">
          <div className="flex items-center gap-3 text-slate-900">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <User className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Profile</p>
              <p className="mt-1 text-sm text-slate-500">Update donor details, campaign and source.</p>
            </div>
          </div>

          {message && (
            <div className="mt-6 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {message}
            </div>
          )}

          <div className="mt-6 space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700">Full name</label>
              <input
                name="full_name"
                value={profile.full_name}
                onChange={handleProfileChange}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-slate-700">Phone</label>
                <div className="relative mt-2">
                  <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    name="phone"
                    value={profile.phone}
                    onChange={handleProfileChange}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-12 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700">Email</label>
                <div className="relative mt-2">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    name="email"
                    value={profile.email}
                    onChange={handleProfileChange}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-12 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
                  />
                </div>
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-slate-500" />
                <span>Joined:</span>
              </div>
              <p className="mt-2 font-semibold text-slate-900">{customer.created_at || 'Unknown'}</p>
            </div>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              onClick={handleSaveProfile}
              disabled={saving}
            >
              <RefreshCw className="h-4 w-4" />
              {saving ? 'Saving…' : 'Save profile'}
            </button>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200">
          <div className="flex items-center gap-3 text-slate-900">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Metrics</p>
              <p className="mt-1 text-sm text-slate-500">Order value and customer spend overview.</p>
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Total orders</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{fmt(customer.total_orders)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Total spent</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{fmtRM(customer.total_spent)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Average order value</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{fmtRM(customer.aov)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Lifetime value</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{fmtRM(customer.ltv)}</p>
            </div>
          </div>
        </section>
      </div>

      {/* Notes section */}
      <section className="rounded-2xl bg-white p-6 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200">
        <div className="flex items-center gap-3 mb-5 text-slate-900">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50">
            <StickyNote className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Staff Notes</p>
            <p className="mt-1 text-sm text-slate-500">Internal remarks visible to staff only.</p>
          </div>
        </div>

        {notes.length > 0 && (
          <div className="mb-5 space-y-3">
            {notes.map((note) => (
              <div key={note.id} className="flex items-start justify-between gap-3 rounded-xl bg-amber-50 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800 whitespace-pre-wrap">{note.content}</p>
                  <p className="mt-1.5 text-xs text-slate-400">
                    {note.created_by && <span className="font-medium">{note.created_by} · </span>}
                    {note.created_at ? new Date(note.created_at).toLocaleString('en-MY') : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteNote(note.id)}
                  className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-rose-100 hover:text-rose-600 transition"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3">
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAddNote(); }}
            placeholder="Add a note… (Ctrl+Enter to save)"
            rows={2}
            className="flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
          />
          <button
            type="button"
            onClick={handleAddNote}
            disabled={noteSaving || !newNote.trim()}
            className="inline-flex items-center gap-2 self-end rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {noteSaving ? 'Saving…' : 'Add'}
          </button>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Donation history</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">Recent donations</h2>
          </div>
          <p className="text-sm text-slate-500">{orders.length} donations</p>
        </div>

        {orders.length === 0 ? (
          <div className="mt-6 rounded-xl bg-slate-50 p-6 text-slate-600">No donations found for this donor.</div>
        ) : (
          <div className="mt-6 overflow-x-auto overflow-hidden rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="px-4 py-4 font-semibold">Donation Date</th>
                  <th className="px-4 py-4 font-semibold">Amount</th>
                  <th className="px-4 py-4 font-semibold">Source</th>
                  <th className="px-4 py-4 font-semibold">Campaign</th>
                  <th className="px-4 py-4 font-semibold">Created At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50">
                    <td className="px-4 py-4">{order.order_date || order.donation_date || '—'}</td>
                    <td className="px-4 py-4 font-semibold text-slate-900">{fmtRM(order.amount)}</td>
                    <td className="px-4 py-4 capitalize">{order.source || '—'}</td>
                    <td className="px-4 py-4">{order.campaign_name || '—'}</td>
                    <td className="px-4 py-4 text-slate-500">
                      {order.created_at ? new Date(order.created_at).toLocaleDateString('ms-MY') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
