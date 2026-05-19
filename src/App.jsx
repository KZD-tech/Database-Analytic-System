import { useEffect, useState } from 'react';
import { Routes, Route, Link, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { Database, LayoutDashboard, PlusCircle, Users } from 'lucide-react';
import { getSummary, getCustomers, getOrders, adminLogin } from './services/api';
import Dashboard from './components/Dashboard';
import CustomerDetail from './components/CustomerDetail';
import OrderInput from './components/OrderInput';
import StaffPanel from './components/StaffPanel';
import Login from './components/Login';

function App() {
  const [summary, setSummary] = useState({ total: 0, active: 0, repeat: 0, dormant: 0, churn: 0, total_collection: 0, avg_order_value: 0, donation_count: 0 });
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem('admin_token'));
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('admin_user');
    return saved ? JSON.parse(saved) : null;
  });
  const navigate = useNavigate();
  const location = useLocation();
  const isLoginRoute = location.pathname === '/login';

  const loadData = async () => {
    setLoading(true);
    const [summaryData, customersData, ordersData] = await Promise.all([getSummary(), getCustomers(), getOrders()]);
    setSummary(summaryData);
    setCustomers(customersData);
    setOrders(ordersData);
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
    localStorage.setItem('admin_user', JSON.stringify({ email }));
    setAdminToken(response.token);
    setCurrentUser({ email });
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

  const PrivateRoute = ({ children }) => {
    return adminToken ? children : <Navigate to="/login" replace />;
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
            </nav>
            {adminToken && (
              <div className="mt-8 border-t border-slate-200 pt-4">
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
                    customers={customers}
                    orders={orders}
                    loading={loading}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    statusFilter={statusFilter}
                    setStatusFilter={setStatusFilter}
                    sourceFilter={sourceFilter}
                    setSourceFilter={setSourceFilter}
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
            <Route path="*" element={<Navigate to={adminToken ? '/' : '/login'} replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default App;
