import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  CreditCard,
  PlaySquare,
  KeyRound,
  Webhook,
  Settings,
  LogOut,
  ShieldCheck,
  Building2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const DashboardLayout: React.FC = () => {
  const { user, merchant, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { label: 'Overview', to: '/', icon: LayoutDashboard },
    { label: 'Payments', to: '/payments', icon: CreditCard },
    { label: 'Checkout Demo', to: '/checkout-demo', icon: PlaySquare, highlight: true },
    { label: 'API Keys', to: '/api-keys', icon: KeyRound },
    { label: 'Webhooks', to: '/webhooks', icon: Webhook },
    { label: 'Settings', to: '/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900/50 flex flex-col justify-between shrink-0">
        <div>
          {/* Logo */}
          <div className="h-16 flex items-center px-6 border-b border-slate-800/80 gap-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-sky-500/20">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <span className="font-bold text-lg text-white tracking-tight">NexusPay</span>
              <span className="ml-2 text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800/60">
                Sandbox
              </span>
            </div>
          </div>

          {/* Merchant Info Banner */}
          <div className="p-4 mx-3 my-3 rounded-lg bg-slate-800/40 border border-slate-800 flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-slate-700/60 flex items-center justify-center text-slate-300">
              <Building2 className="h-4 w-4" />
            </div>
            <div className="overflow-hidden">
              <p className="text-xs text-slate-400 font-medium truncate">Merchant</p>
              <p className="text-sm font-semibold text-slate-200 truncate">
                {merchant?.businessName || 'My Organization'}
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="px-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                        : item.highlight
                        ? 'text-sky-400 hover:bg-sky-950/40 hover:text-sky-300'
                        : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                    }`
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                  {item.highlight && (
                    <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-semibold">
                      Live
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* User Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/30 flex items-center justify-between">
          <div className="overflow-hidden pr-2">
            <p className="text-xs font-medium text-slate-200 truncate">{user?.email}</p>
            <p className="text-[11px] text-slate-500 uppercase tracking-wider">{user?.role || 'Admin'}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Log out"
            className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="h-16 border-b border-slate-800/80 px-8 flex items-center justify-between bg-slate-900/20 shrink-0">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-medium text-slate-400">Gateway Engine Online</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-slate-400 bg-slate-800/60 px-3 py-1.5 rounded-full border border-slate-700/50">
              Default Currency: <span className="font-semibold text-slate-200">{merchant?.currency || 'INR'}</span>
            </div>
          </div>
        </header>

        <main className="p-8 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
