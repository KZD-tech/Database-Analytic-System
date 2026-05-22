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
  const [summary, setSummary] = useState({ total: 0, new: 0, active: 0, repeat: 0, dormant: 0, churn: 0, total_collection: 0, total_transactions: 0, avg_order_value: 0 });
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
          <aside
            className="hidden w-full shrink-0 rounded-2xl p-6 text-white shadow-xl lg:block lg:w-72"
            style={{ background: 'linear-gradient(to bottom, #2563eb, #0284c7)' }}
          >
            <Link to="/" className="flex items-center justify-center rounded-2xl p-3 shadow-sm ring-1 ring-white/20 transition hover:bg-white/10" style={{ background: 'rgba(255,255,255,0.12)' }}>
              <img src="/Logo%20IhsanKu.png" alt="IhsanKu logo" className="h-10 w-auto max-w-full" />
            </Link>

            <nav className="mt-10 space-y-1">
              <Link
                to="/"
                className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                style={{ background: 'rgba(255,255,255,0.15)' }}
              >
                <LayoutDashboard className="h-4 w-4 text-white/80" />
                Home
              </Link>
              <Link
                to="/"
                className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/10"
              >
                <Users className="h-4 w-4 text-white/70" />
                Donors
              </Link>
              <Link
                to="/staff"
                className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/10"
              >
                <Database className="h-4 w-4 text-white/70" />
                Staff
              </Link>
              {isManagerOrAbove && (
                <Link
                  to="/webhooks"
                  className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/10"
                >
                  <Webhook className="h-4 w-4 text-white/70" />
                  Webhooks
                </Link>
              )}
              {isAdmin && (
                <Link
                  to="/users"
                  className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/10"
                >
                  <Shield className="h-4 w-4 text-white/70" />
                  Users
                </Link>
              )}
            </nav>

            {adminToken && (
              <div className="mt-8 border-t border-white/20 pt-4">
                {currentUser && (
                  <div className="mb-3 px-2">
                    <p className="text-xs text-white/80 truncate">{currentUser.full_name || currentUser.email}</p>
                    <p className="text-xs text-white/60 capitalize">{currentUser.role || 'admin'}</p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                  style={{ background: 'rgba(255,255,255,0.12)' }}
                >
                  Log out
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
