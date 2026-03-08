import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, LogOut, ChevronLeft } from 'lucide-react';
import ThemeToggle from '../../components/ui/ThemeToggle';
import { useAuth } from '../../context/AuthContext';

export default function PortalLayout({ navItems, accentColor = 'blue', portalLabel = 'Portal' }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const accentClasses = {
    blue: 'bg-blue-500',
    green: 'bg-emerald-500',
    purple: 'bg-purple-500',
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col border-r overflow-hidden flex-shrink-0"
            style={{ background: 'var(--bg-card-solid)', borderColor: 'var(--border-default)' }}
          >
            {/* Brand */}
            <div className="flex items-center gap-3 px-5 py-5 border-b" style={{ borderColor: 'var(--border-default)' }}>
              <img
                src="/logo.png"
                alt="SwayamShield logo"
                className="w-9 h-9 rounded-xl object-cover flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate" style={{ color: 'var(--text-primary)' }}>SwayamShield</p>
                <p className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>{portalLabel}</p>
              </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 py-3 px-3 overflow-y-auto">
              {navItems.map(item => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium mb-1 transition-colors ${
                        isActive ? 'bg-blue-500/10 text-blue-500 font-semibold' : ''
                      }`
                    }
                    style={({ isActive }) => isActive ? {} : { color: 'var(--text-secondary)' }}
                  >
                    <Icon size={18} />
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white ${accentClasses[item.badgeColor || accentColor]}`}>
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </nav>

            {/* User */}
            <div className="px-3 py-4 border-t" style={{ borderColor: 'var(--border-default)' }}>
              <div className="flex items-center gap-3 px-3 py-2">
                <div className={`w-8 h-8 rounded-full ${accentClasses[accentColor]} flex items-center justify-center`}>
                  <span className="text-white text-xs font-bold">
                    {user?.full_name?.charAt(0) || 'U'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                    {user?.full_name || 'User'}
                  </p>
                  <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                    {user?.email || ''}
                  </p>
                </div>
                <button onClick={handleLogout} className="p-1.5 rounded-lg hover:bg-red-100 text-red-500 transition-colors" title="Logout">
                  <LogOut size={16} />
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center gap-3 px-4 py-3 border-b" style={{ background: 'var(--bg-card-solid)', borderColor: 'var(--border-default)' }}>
          <button
            onClick={() => setSidebarOpen(prev => !prev)}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            {sidebarOpen ? <ChevronLeft size={20} /> : <Menu size={20} />}
          </button>

          <div className="flex-1 flex items-center justify-center">
             {/* Prominent SwayamShield Header Branding */}
             <div className="flex items-center gap-2">
                <img src="/logo.png" alt="Logo" className="w-6 h-6 rounded-md drop-shadow-sm md:hidden" />
                <h1 className="text-xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  SwayamShield <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 capitalize align-middle hidden md:inline-block border border-blue-500/20 ml-2">{portalLabel}</span>
                </h1>
             </div>
          </div>

          <ThemeToggle />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
