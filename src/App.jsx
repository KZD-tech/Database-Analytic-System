import { useEffect, useState } from 'react';
import { Routes, Route, Link, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { Database, LayoutDashboard, PlusCircle, Users, Webhook, Shield } from 'lucide-react';
import { getSummary, adminLogin } from './services/api';
import Dashboard from './components/Dashboard';
import CustomerDetail from './components/CustomerDetail';
import OrderInput from './components/OrderInput';
import StaffPanel from './components/StaffPanel';
import Login from './components/Login';
import UserManagement from './components/UserManagement';
import WebhooksPanel from './components/WebhooksPanel';

function App() {
  const [summary, setSummary] = useState({ total: 0, active: 0, repeat: 0, dormant: 0, churn: 0, total_collection: 0, total_transactions: 0, avg_order_value: 0 });
  const [loading, setLoading] = useState(false);
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem('admin_token'));
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('admin_user');
    return saved ? JSON.parse(saved) : null;
  });
  const navigate = useNavigate();
  const location = useLocation();
  const isLoginRoute = location.pathname === '/login';

  const isAdmin = currentUser?.role === 'admin';
  const isManagerOrAbove = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  const loadData = async () => {
    setLoading(true);
    const summaryData = await getSummary();
    setSummary(summaryData);
    setLoading(false);
  };

  useEffect(() => {
    if (adminToken) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [adminToken]);

  const onOrderCreated = async () => {
    await loadData();
    navigate('/');
  };

  const handleLogin = async ({ email, password }) => {
    setLoading(true);
    const response = await adminLogin({ email, password });
    localStorage.setItem('admin_token', response.token);
    const user = response.user || { email, role: 'admin' };
    localStorage.setItem('admin_user', JSON.stringify(user));
    setAdminToken(response.token);
    setCurrentUser(user);
    await loadData();
    navigate('/');
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    setAdminToken(null);
    setCurrentUser(null);
    navigate('/login');
  };

  const PrivateRoute = ({ children, minRole }) => {
    if (!adminToken) return <Navigate to="/login" replace />;
    if (minRole && currentUser) {
      const levels = { admin: 4, manager: 3, editor: 2, viewer: 1 };
      const userLevel = levels[currentUser.role] || 0;
      const minLevel = levels[minRole] || 1;
      if (userLevel < minLevel) return <Navigate to="/" replace />;
    }
    return children;
  };

  return (
    <div className="app-shell min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-6 px-4 py-6 lg:flex-row lg:px-8">
          {!isLoginRoute && (
          <aside className="hidden w-full shrink-0 rounded-2xl border border-slate-800/50 bg-slate-950/95 p-6 text-slate-200 shadow-xl shadow-slate-950/10 lg:block lg:w-72">
            <Link to="/" className="flex items-center justify-center rounded-2xl bg-slate-900/80 p-3 shadow-sm ring-1 ring-slate-700 transition hover:bg-slate-800">
              <img src="/Logo-IhsanKu-02.png" alt="IhsanKu logo" className="h-14 w-auto max-w-full" />
            </Link>

            <nav className="mt-10 space-y-2">
              <Link
                to="/"
                className="flex items-center gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-800"
              >
                <LayoutDashboard className="h-4 w-4 text-slate-300" />
                Laman Utama
              </Link>
              <Link
                to="/"
                className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
              >
                <Users className="h-4 w-4 text-slate-300" />
                Dermawan
              </Link>
              <Link
                to="/staff"
                className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
              >
                <Database className="h-4 w-4 text-slate-300" />
                Staf
              </Link>
              {isManagerOrAbove && (
                <Link
                  to="/webhooks"
                  className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
                >
                  <Webhook className="h-4 w-4 text-slate-300" />
                  Webhooks
                </Link>
              )}
              {isAdmin && (
                <Link
                  to="/users"
                  className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
                >
                  <Shield className="h-4 w-4 text-slate-300" />
                  Pengguna
                </Link>
              )}
            </nav>

            {adminToken && (
              <div className="mt-8 border-t border-slate-700 pt-4">
                {currentUser && (
                  <div className="mb-3 px-2">
                    <p className="text-xs text-slate-400 truncate">{currentUser.full_name || currentUser.email}</p>
                    <p className="text-xs text-slate-500 capitalize">{currentUser.role || 'admin'}</p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Log keluar
                </button>
              </div>
            )}
          </aside>
        )}

        <div className="flex-1">
          <Routes>
            <Route
              path="/login"
              element={adminToken ? <Navigate to="/" replace /> : <Login onLogin={handleLogin} />}
            />
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Dashboard
                    summary={summary}
                    loading={loading}
                    onLogout={handleLogout}
                    currentUser={currentUser}
                  />
                </PrivateRoute>
              }
            />
            <Route
              path="/customer/:id"
              element={
                <PrivateRoute>
                  <CustomerDetail />
                </PrivateRoute>
              }
            />
            <Route
              path="/order-input"
              element={
                <PrivateRoute>
                  <OrderInput onOrderCreated={onOrderCreated} />
                </PrivateRoute>
              }
            />
            <Route
              path="/staff"
              element={
                <PrivateRoute>
                  <StaffPanel />
                </PrivateRoute>
              }
            />
            <Route
              path="/users"
              element={
                <PrivateRoute minRole="admin">
                  <UserManagement />
                </PrivateRoute>
              }
            />
            <Route
              path="/webhooks"
              element={
                <PrivateRoute minRole="manager">
                  <WebhooksPanel />
                </PrivateRoute>
              }
            />
            <Route path="*" element={<Navigate to={adminToken ? '/' : '/login'} replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default App;
