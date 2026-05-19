import { useState, useEffect } from 'react';
import { Shield, Plus, X, Check, UserX } from 'lucide-react';
import { getUsers, createUser, updateUser, deleteUser } from '../services/api';

const roleBadge = {
  admin: 'bg-rose-100 text-rose-700',
  manager: 'bg-blue-100 text-blue-700',
  editor: 'bg-amber-100 text-amber-700',
  viewer: 'bg-slate-100 text-slate-600'
};

const roleLabel = {
  admin: 'Admin',
  manager: 'Pengurus',
  editor: 'Editor',
  viewer: 'Penonton'
};

const ROLES = ['admin', 'manager', 'editor', 'viewer'];

const defaultForm = { email: '', password: '', full_name: '', role: 'viewer' };

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingRole, setEditingRole] = useState(null); // { id, role }

  const loadUsers = async () => {
    setLoading(true);
    const data = await getUsers();
    setUsers(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFormError('');
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password || !form.full_name) {
      setFormError('Sila isi semua medan yang diperlukan.');
      return;
    }
    setSubmitting(true);
    try {
      await createUser(form);
      setForm(defaultForm);
      setShowForm(false);
      await loadUsers();
    } catch (err) {
      const msg = err?.response?.data?.error || 'Gagal mencipta pengguna.';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (user) => {
    try {
      await updateUser(user.id, { active: !user.active });
      await loadUsers();
    } catch {
      // ignore
    }
  };

  const handleRoleChange = async (userId, role) => {
    try {
      await updateUser(userId, { role });
      setEditingRole(null);
      await loadUsers();
    } catch {
      // ignore
    }
  };

  const handleDeactivate = async (userId) => {
    if (!window.confirm('Adakah anda pasti untuk nyahaktifkan pengguna ini?')) return;
    try {
      await deleteUser(userId);
      await loadUsers();
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-white p-6 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.26em] text-slate-500">Pentadbiran</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Pengurusan Pengguna</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Urus akaun pengguna, peranan dan akses sistem.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setShowForm(true); setFormError(''); }}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            Tambah pengguna
          </button>
        </div>
      </section>

      {showForm && (
        <section className="rounded-2xl bg-white p-6 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-950">Pengguna baharu</h3>
            <button
              type="button"
              onClick={() => { setShowForm(false); setForm(defaultForm); setFormError(''); }}
              className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={handleCreateUser} className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-slate-700" htmlFor="user-full-name">Nama penuh</label>
              <input
                id="user-full-name"
                name="full_name"
                type="text"
                value={form.full_name}
                onChange={handleFormChange}
                required
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
                placeholder="Ahmad bin Ali"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700" htmlFor="user-email">Emel</label>
              <input
                id="user-email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleFormChange}
                required
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
                placeholder="pengguna@ihsanku.local"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700" htmlFor="user-password">Kata laluan</label>
              <input
                id="user-password"
                name="password"
                type="password"
                value={form.password}
                onChange={handleFormChange}
                required
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
                placeholder="Min. 8 aksara"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700" htmlFor="user-role">Peranan</label>
              <select
                id="user-role"
                name="role"
                value={form.role}
                onChange={handleFormChange}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{roleLabel[r]}</option>
                ))}
              </select>
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
                {submitting ? 'Menyimpan…' : 'Simpan pengguna'}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="rounded-2xl bg-white p-6 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200">
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-4 font-semibold">Nama</th>
                <th className="px-4 py-4 font-semibold">Emel</th>
                <th className="px-4 py-4 font-semibold">Peranan</th>
                <th className="px-4 py-4 font-semibold">Status</th>
                <th className="px-4 py-4 font-semibold">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-4 py-10 text-center text-slate-500">Memuatkan pengguna…</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-4 py-10 text-center text-slate-500">Tiada pengguna ditemui.</td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="transition hover:bg-slate-50">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold uppercase text-slate-700">
                          {user.full_name?.charAt(0) || 'U'}
                        </span>
                        <span className="font-semibold text-slate-900">{user.full_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-slate-600">{user.email}</td>
                    <td className="px-4 py-4">
                      {editingRole?.id === user.id ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={editingRole.role}
                            onChange={(e) => setEditingRole({ id: user.id, role: e.target.value })}
                            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1 text-sm outline-none focus:border-slate-400"
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>{roleLabel[r]}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => handleRoleChange(user.id, editingRole.role)}
                            className="rounded-full bg-emerald-50 p-1.5 text-emerald-600 hover:bg-emerald-100"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingRole(null)}
                            className="rounded-full bg-slate-100 p-1.5 text-slate-500 hover:bg-slate-200"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditingRole({ id: user.id, role: user.role })}
                          className={`inline-flex cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition hover:opacity-80 ${roleBadge[user.role] || roleBadge.viewer}`}
                          title="Klik untuk tukar peranan"
                        >
                          <Shield className="mr-1 h-3 w-3" />
                          {roleLabel[user.role] || user.role}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          user.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {user.active ? 'Aktif' : 'Tidak aktif'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(user)}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                            user.active
                              ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          {user.active ? 'Nyahaktif' : 'Aktifkan'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeactivate(user.id)}
                          className="rounded-full bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100"
                          title="Nyahaktifkan pengguna"
                        >
                          <UserX className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
