import { useEffect, useState } from 'react';
import { Plus, User, CheckCircle2, XCircle, Trash2 } from 'lucide-react';
import { createStaff, getStaff, deleteStaff } from '../services/api';

const roles = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'editor', label: 'Editor' },
  { value: 'viewer', label: 'Viewer' }
];

export default function StaffPanel() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ full_name: '', email: '', role: 'manager', password: '' });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const loadStaff = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getStaff();
      setStaff(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load staff list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStaff(); }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (!form.full_name || !form.email) {
      setError('Please complete staff name and email.');
      return;
    }
    if (!form.password || form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setSaving(true);
    try {
      await createStaff(form);
      setSuccess('New staff member added successfully.');
      setForm({ full_name: '', email: '', role: 'manager', password: '' });
      await loadStaff();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add staff.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Deactivate this staff member?')) return;
    setDeletingId(id);
    try {
      await deleteStaff(id);
      await loadStaff();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove staff.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-white p-8 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.26em] text-slate-500">Staff Panel</p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-950">Manage your staff</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Add and manage staff who will handle NGO data and donations.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
            <User className="h-4 w-4" />
            System staff
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Staff list */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <p className="text-sm font-semibold text-slate-900">Staff List</p>
              <p className="mt-2 text-sm text-slate-600">View all team members authorised to manage data and donors.</p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Name</th>
                    <th className="px-4 py-3 font-semibold">Email</th>
                    <th className="px-4 py-3 font-semibold">Role</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Date Added</th>
                    <th className="px-4 py-3 font-semibold"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {loading ? (
                    <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">Loading...</td></tr>
                  ) : staff.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">No staff registered.</td></tr>
                  ) : (
                    staff.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50">
                        <td className="px-4 py-4 font-medium text-slate-900">{user.full_name}</td>
                        <td className="px-4 py-4 text-slate-600">{user.email}</td>
                        <td className="px-4 py-4 text-slate-600 capitalize">{user.role}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center gap-1.5 text-sm ${user.active ? 'text-emerald-600' : 'text-rose-500'}`}>
                            {user.active
                              ? <CheckCircle2 className="h-4 w-4" />
                              : <XCircle className="h-4 w-4" />}
                            {user.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-slate-500">{new Date(user.created_at).toLocaleDateString('en-MY')}</td>
                        <td className="px-4 py-4 text-right">
                          {user.active && (
                            <button
                              type="button"
                              onClick={() => handleDelete(user.id)}
                              disabled={deletingId === user.id}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              {deletingId === user.id ? '...' : 'Remove'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add staff form */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.26em] text-slate-500">Add new staff</p>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
                <label className="block text-sm font-semibold text-slate-700">Email</label>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700">Password</label>
                <input
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Min. 6 characters"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700">Role</label>
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
                {saving ? 'Saving…' : 'Add Staff'}
              </button>

              {error && (
                <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">{error}</div>
              )}
              {success && (
                <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 ring-1 ring-emerald-200">{success}</div>
              )}
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
