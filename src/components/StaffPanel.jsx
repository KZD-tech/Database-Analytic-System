import { useEffect, useState } from 'react';
import { Plus, User, Mail, CheckCircle2, XCircle } from 'lucide-react';
import { createStaff, getStaff } from '../services/api';

const roles = [
  { value: 'manager', label: 'Pengurus' },
  { value: 'editor', label: 'Penyunting' },
  { value: 'viewer', label: 'Pemerhati' }
];

export default function StaffPanel() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ full_name: '', email: '', role: 'manager' });
  const [saving, setSaving] = useState(false);

  const loadStaff = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getStaff();
      setStaff(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal memuatkan senarai staf.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!form.full_name || !form.email) {
      setError('Sila lengkapkan nama dan emel staf.');
      return;
    }

    setSaving(true);
    try {
      await createStaff(form);
      setSuccess('Staf baru berjaya ditambah.');
      setForm({ full_name: '', email: '', role: 'manager' });
      await loadStaff();
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal menambah staf.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-white p-8 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.26em] text-slate-500">Panel Staf</p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-950">Urus pengguna staff anda</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Tambah dan semak staf yang akan menguruskan data NGO dan sumbangan.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
            <User className="h-4 w-4" />
            Staf sistem
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <p className="text-sm font-semibold text-slate-900">Senarai Staf</p>
              <p className="mt-2 text-sm text-slate-600">Lihat semua team yang dibenarkan menguruskan data dan pelanggan.</p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Nama</th>
                    <th className="px-4 py-3 font-semibold">Emel</th>
                    <th className="px-4 py-3 font-semibold">Peranan</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Tarikh Disenarai</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-slate-500">Memuatkan...</td>
                    </tr>
                  ) : staff.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-slate-500">Tiada staf yang didaftarkan.</td>
                    </tr>
                  ) : (
                    staff.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50">
                        <td className="px-4 py-4 font-medium text-slate-900">{user.full_name}</td>
                        <td className="px-4 py-4 text-slate-600">{user.email}</td>
                        <td className="px-4 py-4 text-slate-600 capitalize">{user.role}</td>
                        <td className="px-4 py-4 text-slate-600 flex items-center gap-2">
                          {user.active ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-rose-500" />
                          )}
                          {user.active ? 'Aktif' : 'Tidak aktif'}
                        </td>
                        <td className="px-4 py-4 text-slate-500">{new Date(user.created_at).toLocaleDateString('ms-MY')}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.26em] text-slate-500">Tambah staf baru</p>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
                <label className="block text-sm font-semibold text-slate-700">Emel</label>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700">Peranan</label>
                <select
                  name="role"
                  value={form.role}
                  onChange={handleChange}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
                >
                  {roles.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Plus className="h-4 w-4" />
                {saving ? 'Menyimpan…' : 'Tambah Staf'}
              </button>

              {error && (
                <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">
                  {error}
                </div>
              )}
              {success && (
                <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 ring-1 ring-emerald-200">
                  {success}
                  <p className="mt-1 text-xs">Kata laluan sementara telah dijana. Tukar kata laluan melalui panel Pengguna.</p>
                </div>
              )}
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
