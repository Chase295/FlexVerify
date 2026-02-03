import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  Shield,
  FileText,
  Scan,
  UserCircle,
  ChevronDown,
  SlidersHorizontal,
} from 'lucide-react';
import clsx from 'clsx';

interface NavItem {
  name: string;
  path: string;
  icon: React.ReactNode;
  permission?: string;
}

const mainNav: NavItem[] = [
  { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
  { name: 'Personen', path: '/persons', icon: <Users className="w-5 h-5" />, permission: 'persons.read' },
  { name: 'Audit-Log', path: '/audit', icon: <FileText className="w-5 h-5" />, permission: 'audit.read' },
];

const adminNav: NavItem[] = [
  { name: 'Felder', path: '/admin/fields', icon: <Settings className="w-5 h-5" />, permission: 'fields.read' },
  { name: 'Benutzer', path: '/admin/users', icon: <Users className="w-5 h-5" />, permission: 'users.read' },
  { name: 'Rollen', path: '/admin/roles', icon: <Shield className="w-5 h-5" />, permission: 'roles.read' },
  { name: 'Einstellungen', path: '/admin/settings', icon: <SlidersHorizontal className="w-5 h-5" />, permission: 'settings.read' },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const filteredMainNav = mainNav.filter((item) => !item.permission || hasPermission(item.permission));
  const filteredAdminNav = adminNav.filter((item) => !item.permission || hasPermission(item.permission));
  const showAdmin = filteredAdminNav.length > 0;

  return (
    <div className="min-h-screen bg-dark-primary flex">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 w-64 glass-dark transform transition-transform duration-300 lg:translate-x-0 lg:static',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-[#334155]">
            <span className="text-xl font-bold gradient-text">FlexVerify</span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-gray-400 hover:text-white p-1 rounded-lg hover:bg-dark-card/50"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {filteredMainNav.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-gradient-primary text-white shadow-glow-sm'
                      : 'text-gray-300 hover:bg-dark-card/50 hover:text-white'
                  )
                }
              >
                {item.icon}
                {item.name}
              </NavLink>
            ))}

            {/* Admin Section */}
            {showAdmin && (
              <div className="pt-4">
                <button
                  onClick={() => setAdminOpen(!adminOpen)}
                  className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
                >
                  <span className="uppercase text-xs tracking-wider">Administration</span>
                  <ChevronDown
                    className={clsx('w-4 h-4 transition-transform duration-200', adminOpen && 'rotate-180')}
                  />
                </button>
                <div
                  className={clsx(
                    'mt-1 space-y-1 overflow-hidden transition-all duration-200',
                    adminOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                  )}
                >
                  {filteredAdminNav.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) =>
                        clsx(
                          'flex items-center gap-3 px-3 py-2.5 pl-6 rounded-xl text-sm font-medium transition-all duration-200',
                          isActive
                            ? 'bg-gradient-primary text-white shadow-glow-sm'
                            : 'text-gray-300 hover:bg-dark-card/50 hover:text-white'
                        )
                      }
                    >
                      {item.icon}
                      {item.name}
                    </NavLink>
                  ))}
                </div>
              </div>
            )}
          </nav>

          {/* Scanner Button */}
          <div className="px-3 pb-4">
            <NavLink
              to="/scanner"
              className="flex items-center justify-center gap-2 w-full py-3 bg-gradient-primary text-white rounded-xl font-medium transition-all duration-200 hover:shadow-glow hover:-translate-y-0.5 active:translate-y-0"
            >
              <Scan className="w-5 h-5" />
              Scanner öffnen
            </NavLink>
          </div>

          {/* User Section */}
          <div className="border-t border-[#334155] p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center shadow-glow-sm">
                <UserCircle className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user?.full_name}</p>
                <p className="text-xs text-gray-400 truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-dark-card/50 rounded-xl transition-all duration-200"
            >
              <LogOut className="w-4 h-4" />
              Abmelden
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile Header */}
        <header className="lg:hidden h-16 bg-dark-secondary/95 backdrop-blur-lg border-b border-[#334155] flex items-center px-4 sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-400 hover:text-white p-2 -ml-2 rounded-lg hover:bg-dark-card/50 transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>
          <span className="ml-3 text-lg font-bold gradient-text">FlexVerify</span>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <div className="animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
