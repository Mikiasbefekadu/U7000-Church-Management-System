import { AuthProvider } from './context/AuthContext';
import AppLayout from './layouts/AppLayout';
import LoginView from './pages/LoginView';
import { useAuth } from './context/AuthContext';

/**
 * Inner shell — reads auth state and renders either the login screen
 * or the main application layout. Kept separate from AuthProvider so
 * useAuth() can be called here without violating the context rules.
 *
 * AppLayout handles role-based attendance routing internally:
 *   PASTOR      → <PastorAttendanceAnalytics />
 *   ZONE_LEADER → <ZoneAttendanceReport />
 *   KCU_LEADER  → <KcuAttendanceForm />
 *   ADMIN       → attendance nav item hidden; sees provisioning links only
 */
function AppShell() {
  const { isAuthenticated, role } = useAuth();

  if (!isAuthenticated) {
    return <LoginView />;
  }

  // ADMIN has no attendance view — land them on the admin page by default
  const defaultPage = role === 'ADMIN' ? 'admin' : 'dashboard';

  return <AppLayout activePage={defaultPage} />;
}

export default function App() {
  return (
    <AuthProvider initialRole="PASTOR">
      <AppShell />
    </AuthProvider>
  );
}
