import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';

// Pages
import Login from './components/common/Login';
import Layout from './components/common/Layout';
import Dashboard from './components/management/Dashboard';
import PersonList from './components/management/PersonList';
import PersonDetail from './components/management/PersonDetail';
import FieldManager from './components/admin/FieldManager';
import UserManager from './components/admin/UserManager';
import RoleManager from './components/admin/RoleManager';
import Settings from './components/admin/Settings';
import ScannerHome from './components/scanner/ScannerHome';
import AuditLog from './components/management/AuditLog';

// Loading spinner
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-dark-primary flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-glow opacity-30" />
      <div className="absolute top-1/4 -left-32 w-64 h-64 bg-primary-500/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 -right-32 w-64 h-64 bg-primary-600/20 rounded-full blur-3xl animate-pulse" />

      {/* Spinner */}
      <div className="relative z-10">
        <div className="animate-spin rounded-full h-14 w-14 border-4 border-primary-500/30 border-t-primary-500"></div>
      </div>
      <p className="mt-4 text-gray-400 text-sm relative z-10">Laden...</p>
    </div>
  );
}

// Permission-based route wrapper with scanner fallback
interface PermissionRouteProps {
  children: React.ReactNode;
  requiredPermission?: string;
  scannerFallback?: boolean;
}

function PermissionRoute({
  children,
  requiredPermission,
  scannerFallback = false,
}: PermissionRouteProps) {
  const { isAuthenticated, isLoading, hasPermission, isScannerOnly } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Scanner-only users get redirected to /scanner from non-scanner pages
  if (isScannerOnly() && scannerFallback) {
    return <Navigate to="/scanner" replace />;
  }

  // Check required permission
  if (requiredPermission && !hasPermission(requiredPermission)) {
    // If user has no dashboard permission, redirect to scanner
    if (!hasPermission('dashboard.view')) {
      return <Navigate to="/scanner" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function App() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />

      {/* Protected routes - with dashboard permission check */}
      <Route
        path="/"
        element={
          <PermissionRoute requiredPermission="dashboard.view" scannerFallback>
            <Layout />
          </PermissionRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />

        {/* Management */}
        <Route path="persons" element={<PersonList />} />
        <Route path="persons/:id" element={<PersonDetail />} />
        <Route path="audit" element={<AuditLog />} />

        {/* Admin */}
        <Route path="admin/fields" element={<FieldManager />} />
        <Route path="admin/users" element={<UserManager />} />
        <Route path="admin/roles" element={<RoleManager />} />
        <Route path="admin/settings" element={<Settings />} />
      </Route>

      {/* Scanner (standalone PWA mode) - requires recognition permission */}
      <Route
        path="/scanner"
        element={
          <PermissionRoute requiredPermission="recognition.face">
            <ScannerHome />
          </PermissionRoute>
        }
      />

      {/* 404 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
