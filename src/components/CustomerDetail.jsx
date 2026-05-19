import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, CalendarDays, CheckCircle2, Mail, Phone, RefreshCw, ShoppingBag, User } from 'lucide-react';
import { getCustomerDetail, updateCustomer } from '../services/api';

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
  const [profile, setProfile] = useState({ full_name: '', phone: '', email: '', source: 'other', campaign: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const loadCustomer = async () => {
    const data = await getCustomerDetail(id);
    if (data) {
      setDetail(data);
      setProfile({
        full_name: data.customer.full_name || '',
        phone: data.customer.phone || '',
        email: data.customer.email || '',
        source: data.customer.source || 'other',
        campaign: data.customer.campaign || ''
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    loadCustomer();
  }, [id]);

  if (loading) {
    return <div className="py-10 text-center text-slate-500">Memuatkan butiran pelanggan…</div>;
  }

  if (!detail) {
    return <div className="py-10 text-center text-slate-500">Pelanggan tidak dijumpai.</div>;
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
      setMessage('Profil pelanggan berjaya dikemaskini.');
      loadCustomer();
    } catch (error) {
      setMessage('Tidak dapat menyimpan profil pelanggan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 rounded-2xl bg-white p-8 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.26em] text-slate-500">Butiran pelanggan</p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-950">{customer.full_name}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Profil pelanggan, maklumat hubungan, dan sejarah pesanan dalam satu tempat.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke papan pemuka
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
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Profil</p>
              <p className="mt-1 text-sm text-slate-500">Kemaskini butiran pelanggan, kempen dan sumber.</p>
            </div>
          </div>

          {message && (
            <div className="mt-6 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {message}
            </div>
          )}

          <div className="mt-6 space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700">Nama penuh</label>
              <input
                name="full_name"
                value={profile.full_name}
                onChange={handleProfileChange}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-slate-700">Telefon</label>
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
            <div>
              <label className="block text-sm font-semibold text-slate-700">Kempen</label>
              <input
                name="campaign"
                value={profile.campaign}
                onChange={handleProfileChange}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700">Sumber</label>
              <select
                name="source"
                value={profile.source}
                onChange={handleProfileChange}
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
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-slate-500" />
                <span>Disertai:</span>
              </div>
              <p className="mt-2 font-semibold text-slate-900">{customer.created_at || 'Unknown'}</p>
            </div>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              onClick={handleSaveProfile}
              disabled={saving}
            >
              <RefreshCw className="h-4 w-4" />
              {saving ? 'Menyimpan…' : 'Simpan profil'}
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
              <p className="mt-2 text-2xl font-semibold text-slate-950">{customer.total_orders}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Total spent</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">RM {customer.total_spent.toFixed(2)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Average order value</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">RM {customer.aov.toFixed(2)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Lifetime value</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">RM {customer.ltv.toFixed(2)}</p>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-2xl bg-white p-6 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Sejarah pesanan</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">Pesanan terkini</h2>
          </div>
          <p className="text-sm text-slate-500">{orders.length} pesanan</p>
        </div>

        {orders.length === 0 ? (
          <div className="mt-6 rounded-xl bg-slate-50 p-6 text-slate-600">Tiada pesanan untuk pelanggan ini.</div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="px-4 py-4 font-semibold">Tarikh</th>
                  <th className="px-4 py-4 font-semibold">Jumlah</th>
                  <th className="px-4 py-4 font-semibold">Sumber</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50">
                    <td className="px-4 py-4">{order.order_date}</td>
                    <td className="px-4 py-4">RM {order.amount.toFixed(2)}</td>
                    <td className="px-4 py-4">{order.source || 'lain-lain'}</td>
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
