import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="flex min-h-screen">
      {/* Left panel — illustration */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center bg-slate-50 p-12">
        <div className="w-full max-w-md space-y-6 text-center">
          {/* Abstract illustration using SVG shapes */}
          <svg viewBox="0 0 400 320" className="w-full max-w-sm mx-auto" fill="none">
            {/* Background circles */}
            <circle cx="200" cy="160" r="140" fill="#eff6ff" />
            <circle cx="200" cy="160" r="100" fill="#dbeafe" />
            {/* Phone mockup left */}
            <rect x="60" y="60" width="90" height="160" rx="12" fill="white" stroke="#bfdbfe" strokeWidth="2"/>
            <rect x="70" y="80" width="70" height="10" rx="3" fill="#3b82f6" opacity="0.3"/>
            <rect x="70" y="98" width="50" height="8" rx="3" fill="#93c5fd" opacity="0.5"/>
            <rect x="70" y="114" width="70" height="40" rx="4" fill="#3b82f6" opacity="0.15"/>
            <rect x="70" y="162" width="70" height="8" rx="3" fill="#93c5fd" opacity="0.4"/>
            <rect x="70" y="178" width="40" height="8" rx="3" fill="#93c5fd" opacity="0.3"/>
            <rect x="70" y="194" width="30" height="14" rx="7" fill="#3b82f6" opacity="0.6"/>
            {/* Phone mockup right */}
            <rect x="250" y="80" width="90" height="160" rx="12" fill="white" stroke="#bfdbfe" strokeWidth="2"/>
            <rect x="260" y="100" width="70" height="40" rx="4" fill="#3b82f6" opacity="0.15"/>
            <rect x="260" y="150" width="70" height="10" rx="3" fill="#93c5fd" opacity="0.4"/>
            <rect x="260" y="168" width="50" height="8" rx="3" fill="#93c5fd" opacity="0.3"/>
            <rect x="272" y="192" width="46" height="18" rx="9" fill="#3b82f6" opacity="0.7"/>
            {/* Center phone mockup */}
            <rect x="148" y="40" width="104" height="200" rx="14" fill="white" stroke="#93c5fd" strokeWidth="2.5"/>
            <rect x="160" y="60" width="80" height="12" rx="4" fill="#3b82f6" opacity="0.25"/>
            <rect x="160" y="80" width="80" height="50" rx="6" fill="#3b82f6" opacity="0.18"/>
            <rect x="160" y="138" width="80" height="10" rx="3" fill="#93c5fd" opacity="0.5"/>
            <rect x="160" y="156" width="55" height="8" rx="3" fill="#93c5fd" opacity="0.35"/>
            <rect x="160" y="172" width="80" height="50" rx="6" fill="#3b82f6" opacity="0.12"/>
            {/* Gear icons */}
            <circle cx="320" cy="55" r="18" fill="none" stroke="#cbd5e1" strokeWidth="2.5"/>
            <circle cx="320" cy="55" r="8" fill="none" stroke="#cbd5e1" strokeWidth="2.5"/>
            <circle cx="100" cy="50" r="14" fill="none" stroke="#cbd5e1" strokeWidth="2"/>
            <circle cx="100" cy="50" r="6" fill="none" stroke="#cbd5e1" strokeWidth="2"/>
            {/* Dots */}
            <circle cx="155" cy="245" r="5" fill="#3b82f6" opacity="0.5"/>
            <circle cx="246" cy="245" r="5" fill="#3b82f6" opacity="0.3"/>
            <circle cx="200" cy="255" r="4" fill="#93c5fd" opacity="0.5"/>
            {/* Plant stems */}
            <path d="M75 240 Q65 220 80 200" stroke="#94a3b8" strokeWidth="2" fill="none"/>
            <ellipse cx="72" cy="205" rx="10" ry="7" fill="#94a3b8" opacity="0.4" transform="rotate(-20 72 205)"/>
            <ellipse cx="83" cy="215" rx="10" ry="7" fill="#94a3b8" opacity="0.3" transform="rotate(10 83 215)"/>
          </svg>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Welcome to IhsanKu</h2>
            <p className="mt-2 text-sm text-slate-500">Manage your NGO donations and donors in one place.</p>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col items-center justify-center bg-white px-6 py-12 lg:px-16">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="mb-8 flex justify-center lg:justify-start">
            <img src="/Logo%20IhsanKu.png" alt="IhsanKu" className="h-10 w-auto" />
          </div>

          <h1 className="text-2xl font-bold text-slate-900">Sign In</h1>
          <p className="mt-2 text-sm text-slate-500">Enter your email address and password to access admin panel.</p>

          {error && (
            <div className="mt-5 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">
              {error}
            </div>
          )}

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@ihsanku.org"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
                  Password
                </label>
              </div>
              <div className="relative mt-2">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Sign in button */}
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-400">
            IhsanKu Admin Panel — authorised access only
          </p>
        </div>
      </div>
    </div>
  );
}
