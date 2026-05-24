import { useEffect, useState } from 'react';
import { Routes, Route, Link, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, PlusCircle, Database, Webhook, Shield, LogOut, ChevronRight, BarChart2, GitMerge, LineChart, Menu, X, ClipboardList } from 'lucide-react';
import { getSummary, adminLogin } from './services/api';
import Dashboard from './components/Dashboard';
import CustomerDetail from './components/CustomerDetail';
import OrderInput from './components/OrderInput';
import StaffPanel from './components/StaffPanel';
import Login from './components/Login';
import UserManagement from './components/UserManagement';
import WebhooksPanel from './components/WebhooksPanel';
import Analytics from './components/Analytics';
import Charts from './components/Charts';
import Duplicates from './components/Duplicates';
import Donors from './components/Donors';
import ActivityLog from './components/ActivityLog';

const PAGE_TITLES = {
  '/': { title: 'Dashboard', breadcrumb: 'Home / Dashboard' },
  '/donors': { title: 'Donors', breadcrumb: 'Home / Donors' },
  '/analytics': { title: 'Analytics', breadcrumb: 'Home / Analytics' },
  '/duplicates': { title: 'Duplicate Donors', breadcrumb: 'Home / Duplicate Donors' },
  '/order-input': { title: 'Add Donation', breadcrumb: 'Home / Add Donation' },
  '/staff': { title: 'Staff', breadcrumb: 'Home / Staff' },
  '/users': { title: 'User Management', breadcrumb: 'Home / Users' },
  '/webhooks': { title: 'Webhooks', breadcrumb: 'Home / Webhooks' },
  '/charts': { title: 'Charts', breadcrumb: 'Home / Charts' },
  '/activity-log': { title: 'Activity Log', breadcrumb: 'Home / Activity Log' },
};

function NavItem({ to, icon: Icon, label, active, onClick }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
        active
          ? 'bg-blue-50 text-blue-700'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
      {label}
    </Link>
  );
}

function SidebarContent({ location, isAdmin, isManagerOrAbove, adminToken, currentUser, handleLogout, onNavClick }) {
  return (
    <>
      {/* Logo */}
      <div className="flex items-center justify-center px-6 py-5 border-b border-slate-100">
        <Link to="/" onClick={onNavClick}>
          <img src="/Logo%20IhsanKu.png" alt="IhsanKu" className="h-10 w-auto max-w-full" />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        <div>
          <p className="px-3 mb-2 text-[10px] font-bold tracking-[0.18em] uppercase text-slate-400">General</p>
          <div className="space-y-0.5">
            <NavItem to="/" icon={LayoutDashboard} label="Dashboard" active={location.pathname === '/'} onClick={onNavClick} />
            <NavItem to="/donors" icon={Users} label="Donors" active={location.pathname === '/donors'} onClick={onNavClick} />
            <NavItem to="/analytics" icon={BarChart2} label="Analytics" active={location.pathname === '/analytics'} onClick={onNavClick} />
            <NavItem to="/charts" icon={LineChart} label="Charts" active={location.pathname === '/charts'} onClick={onNavClick} />
          </div>
        </div>

        <div>
          <p className="px-3 mb-2 text-[10px] font-bold tracking-[0.18em] uppercase text-slate-400">Management</p>
          <div className="space-y-0.5">
            <NavItem to="/order-input" icon={PlusCircle} label="Add Donation" active={location.pathname === '/order-input'} onClick={onNavClick} />
            {isAdmin && <NavItem to="/staff" icon={Database} label="Staff" active={location.pathname === '/staff'} onClick={onNavClick} />}
            <NavItem to="/duplicates" icon={GitMerge} label="Duplicates" active={location.pathname === '/duplicates'} onClick={onNavClick} />
          </div>
        </div>

        {(isManagerOrAbove || isAdmin) && (
          <div>
            <p className="px-3 mb-2 text-[10px] font-bold tracking-[0.18em] uppercase text-slate-400">Admin</p>
            <div className="space-y-0.5">
              {isManagerOrAbove && (
                <NavItem to="/webhooks" icon={Webhook} label="Webhooks" active={location.pathname === '/webhooks'} onClick={onNavClick} />
              )}
              {isAdmin && (
                <NavItem to="/users" icon={Shield} label="Users" active={location.pathname === '/users'} onClick={onNavClick} />
              )}
              {isManagerOrAbove && (
                <NavItem to="/activity-log" icon={ClipboardList} label="Activity Log" active={location.pathname === '/activity-log'} onClick={onNavClick} />
              )}
            </div>
          </div>
        )}
      </nav>

      {/* User / logout */}
      {adminToken && (
        <div className="px-4 py-4 border-t border-slate-100">
          {currentUser && (
            <div className="mb-3 px-3">
              <p className="text-sm font-semibold text-slate-800 truncate">{currentUser.full_name || currentUser.email}</p>
              <p className="text-xs text-slate-400 capitalize">{currentUser.role || 'admin'}</p>
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <LogOut className="h-4 w-4 text-slate-400" />
            Log out
          </button>
        </div>
      )}
    </>
  );
}

function App() {
  const [summary, setSummary] = useState({ total: 0, new: 0, active: 0, repeat: 0, dormant: 0, churn: 0, total_collection: 0, total_transactions: 0, avg_order_value: 0 });
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

  // Close mobile sidebar on route change
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  // Prevent body scroll when sidebar open
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  const loadData = async () => {
    setLoading(true);
    const summaryData = await getSummary();
    setSummary(summaryData);
    setLoading(false);
  };

  useEffect(() => {
    if (adminToken) loadData();
    else setLoading(false);
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

  const pageInfo = PAGE_TITLES[location.pathname] || { title: 'IhsanKu', breadcrumb: 'Home' };
  const isCustomerRoute = location.pathname.startsWith('/customer/');

  if (isLoginRoute) {
    return (
      <div className="min-h-screen bg-slate-100">
        <Routes>
          <Route path="/login" element={adminToken ? <Navigate to="/" replace /> : <Login onLogin={handleLogin} />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    );
  }

  const sidebarProps = { location, isAdmin, isManagerOrAbove, adminToken, currentUser, handleLogout };

  return (
    <div className="flex min-h-screen bg-slate-100">

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-white border-r border-slate-200 transition-transform duration-300 ease-in-out lg:hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
        >
          <X className="h-4 w-4" />
        </button>
        <SidebarContent {...sidebarProps} onNavClick={() => setSidebarOpen(false)} />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-slate-200 z-30">
        <SidebarContent {...sidebarProps} onNavClick={() => {}} />
      </aside>

      {/* Main content */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Top header */}
        <header className="bg-white border-b border-slate-200 px-4 py-4 lg:px-8 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            {/* Hamburger — mobile only */}
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">
                {isCustomerRoute ? 'Donor Details' : pageInfo.title}
              </h1>
              <div className="hidden sm:flex items-center gap-1 mt-0.5 text-xs text-slate-400">
                <span>Home</span>
                <ChevronRight className="h-3 w-3" />
                <span className="text-slate-600">{isCustomerRoute ? 'Donor Details' : pageInfo.title}</span>
              </div>
            </div>
          </div>
          {currentUser && (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col items-end">
                <p className="text-sm font-semibold text-slate-800">{currentUser.full_name || currentUser.email}</p>
                <p className="text-xs text-slate-400 capitalize">{currentUser.role || 'admin'}</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white shrink-0">
                {(currentUser.full_name || currentUser.email || 'U').charAt(0).toUpperCase()}
              </div>
            </div>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-8">
          <Routes>
            <Route path="/" element={<PrivateRoute><Dashboard summary={summary} loading={loading} onLogout={handleLogout} currentUser={currentUser} /></PrivateRoute>} />
            <Route path="/donors" element={<PrivateRoute><Donors /></PrivateRoute>} />
            <Route path="/charts" element={<PrivateRoute><Charts /></PrivateRoute>} />
            <Route path="/duplicates" element={<PrivateRoute minRole="manager"><Duplicates /></PrivateRoute>} />
            <Route path="/analytics" element={<PrivateRoute><Analytics /></PrivateRoute>} />
            <Route path="/customer/:id" element={<PrivateRoute><CustomerDetail /></PrivateRoute>} />
            <Route path="/order-input" element={<PrivateRoute><OrderInput onOrderCreated={onOrderCreated} /></PrivateRoute>} />
            <Route path="/staff" element={<PrivateRoute minRole="admin"><StaffPanel /></PrivateRoute>} />
            <Route path="/users" element={<PrivateRoute minRole="admin"><UserManagement /></PrivateRoute>} />
            <Route path="/webhooks" element={<PrivateRoute minRole="manager"><WebhooksPanel /></PrivateRoute>} />
            <Route path="/activity-log" element={<PrivateRoute minRole="manager"><ActivityLog /></PrivateRoute>} />
            <Route path="*" element={<Navigate to={adminToken ? '/' : '/login'} replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;
