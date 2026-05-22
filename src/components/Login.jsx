import { useState } from 'react';
import { AtSign, Lock } from 'lucide-react';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSaving(true);

    try {
      await onLogin({ email, password });
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid email or password.');
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-md rounded-2xl bg-white p-8 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200">
        <div className="text-center">
          <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-700">
            <AtSign className="h-6 w-6" />
          </div>
          <h1 className="mt-6 text-2xl font-semibold text-slate-950">Staff Login</h1>
          <p className="mt-2 text-sm text-slate-500">Please sign in to access the staff panel and manage NGO data.</p>
          <p className="mt-3 text-xs text-slate-400">Use admin@ihsanku.local / admin123 or set ADMIN_EMAIL / ADMIN_PASSWORD in .env.</p>
        </div>

        {error && (
          <div className="mt-6 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-slate-700">
              Email
            </label>
            <div className="mt-2 relative rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-200">
              <AtSign className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full border-0 bg-transparent pl-10 text-sm text-slate-900 outline-none"
                placeholder="admin@domain.com"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
              Password
            </label>
            <div className="mt-2 relative rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-200">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full border-0 bg-transparent pl-10 text-sm text-slate-900 outline-none"
                placeholder="Enter password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
