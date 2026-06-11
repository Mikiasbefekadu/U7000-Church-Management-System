import { useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth, type UserRole } from '../context/AuthContext';
import KcuAttendanceForm from '../pages/attendance/KcuAttendanceForm';
import PastorAttendanceAnalytics from '../pages/attendance/PastorAttendanceAnalytics';
import ZoneAttendanceReport from '../pages/attendance/ZoneAttendanceReport';
import ZoneDashboard from '../pages/attendance/ZoneDashboard';
import AdminDashboard from '../pages/admin/AdminDashboard';
import KcuMemberList from '../pages/kcu/KcuMemberList';
import KcuFollowUpList from '../pages/kcu/KcuFollowUpList';
import KcuDashboard from '../pages/kcu/KcuDashboard';
import ProfileSettings from '../pages/shared/ProfileSettings';
import churchLogo from '../assets/7000.PNG';

// ---------------------------------------------------------------------------
// Nav item definitions — filtered per role
// ---------------------------------------------------------------------------

interface NavItem {
  id: string;
  label: string;
  icon: ReactNode;
  badge?: string;
  /** Roles that can see this item. */
  roles: UserRole[];
}

// Inline SVG icons (stroke-based, 15×15 viewport)
const Icons = {
  Grid: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-[15px] h-[15px] shrink-0 opacity-80">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  Users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-[15px] h-[15px] shrink-0 opacity-80">
      <circle cx="9" cy="7" r="4" /><path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" />
      <path d="M19 8v6M22 11h-6" strokeWidth={2} />
    </svg>
  ),
  Check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-[15px] h-[15px] shrink-0 opacity-80">
      <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  Bell: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-[15px] h-[15px] shrink-0 opacity-80">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  Chart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-[15px] h-[15px] shrink-0 opacity-80">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  Settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-[15px] h-[15px] shrink-0 opacity-80">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  Map: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-[15px] h-[15px] shrink-0 opacity-80">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  ),
  UserPlus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-[15px] h-[15px] shrink-0 opacity-80">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  ),
  Baby: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-[15px] h-[15px] shrink-0 opacity-80">
      <circle cx="12" cy="6" r="3" /><path d="M12 9v6" /><path d="M9 21v-3a3 3 0 0 1 6 0v3" />
    </svg>
  ),
  Heart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-[15px] h-[15px] shrink-0 opacity-80">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ),
  Gear: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-[15px] h-[15px] shrink-0 opacity-80">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
};

/**
 * Nav items per role:
 *
 * PASTOR      — Dashboard, Members, Attendance (Analytics), Follow-Up, Zones & KCUs, Reports, Administration
 * ZONE_LEADER — Dashboard, Members, Attendance (Report), Follow-Up, Registration
 * KCU_LEADER  — Dashboard, Members, Attendance (Form), Follow-Up, Registration
 * ADMIN       — Members (New), Baby Dedications, New Converts, Administration
 *               (NO attendance items)
 */
const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard',      label: 'Dashboard',          icon: Icons.Grid,     roles: ['PASTOR', 'ZONE_LEADER', 'KCU_LEADER'] },
  { id: 'members',        label: 'Members',             icon: Icons.Users,    roles: ['PASTOR', 'ZONE_LEADER', 'KCU_LEADER'] },
  { id: 'attendance',     label: 'Attendance',          icon: Icons.Check,    roles: ['PASTOR', 'ZONE_LEADER', 'KCU_LEADER'] },
  { id: 'followup',       label: 'Follow-Up',           icon: Icons.Bell,     badge: '5', roles: ['PASTOR', 'ZONE_LEADER', 'KCU_LEADER'] },
  { id: 'registration',   label: 'New Members',         icon: Icons.UserPlus, roles: ['ADMIN'] },
  { id: 'baby',           label: 'Baby Dedications',    icon: Icons.Baby,     roles: ['ADMIN'] },
  { id: 'converts',       label: 'New Converts',        icon: Icons.Heart,    roles: ['ADMIN'] },
  { id: 'zones',          label: 'Zones & KCUs',        icon: Icons.Map,      roles: ['PASTOR'] },
  { id: 'reports',        label: 'Reports & Analytics', icon: Icons.Chart,    roles: ['PASTOR', 'ZONE_LEADER'] },
  { id: 'admin',          label: 'Administration',      icon: Icons.Settings, roles: ['PASTOR', 'ADMIN'] },
  { id: 'settings',      label: 'Profile Settings',    icon: Icons.Gear,     roles: ['PASTOR', 'ZONE_LEADER', 'KCU_LEADER', 'ADMIN'] },
];

/** Section groupings */
const SECTION_MAP: Record<string, string> = {
  dashboard:    'Overview',
  members:      'People',
  attendance:   'Activity',
  followup:     'Activity',
  registration: 'Activity',
  baby:         'Activity',
  converts:     'Activity',
  zones:        'Structure',
  reports:      'Insights',
  admin:        'System',
  settings:     'Account',
};

// ---------------------------------------------------------------------------
// Role-based attendance page titles
// ---------------------------------------------------------------------------

const ATTENDANCE_LABELS: Record<UserRole, string> = {
  PASTOR:      'Attendance Analytics',
  ZONE_LEADER: 'Zone Attendance Report',
  KCU_LEADER:  'Attendance Register',
  ADMIN:       '',
};

// ---------------------------------------------------------------------------
// Attendance view router — mounts the correct component per role
// ---------------------------------------------------------------------------

function AttendanceView({ role }: { role: UserRole }) {
  switch (role) {
    case 'PASTOR':      return <PastorAttendanceAnalytics />;
    case 'ZONE_LEADER': return <ZoneAttendanceReport />;
    case 'KCU_LEADER':  return <KcuAttendanceForm />;
    case 'ADMIN':
      // ADMIN should never reach here — attendance is hidden from their nav
      return null;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AppLayoutProps {
  children?: ReactNode;
  /** Initially active page id — drives the first highlighted nav item. */
  activePage?: string;
}

export default function AppLayout({ activePage: initialPage = 'attendance' }: AppLayoutProps) {
  const { role, fullName, initials, roleLabel, logout } = useAuth();

  // Lift activePage into local state so sidebar clicks drive navigation
  const [activePage, setActivePage] = useState(initialPage);

  const visibleNav = NAV_ITEMS.filter((item) => item.roles.includes(role));

  // Build nav with section headers injected
  const navWithSections: Array<{ type: 'section'; label: string } | { type: 'item'; item: NavItem }> = [];
  let lastSection = '';
  for (const item of visibleNav) {
    const section = SECTION_MAP[item.id] ?? '';
    if (section !== lastSection) {
      navWithSections.push({ type: 'section', label: section });
      lastSection = section;
    }
    navWithSections.push({ type: 'item', item });
  }

  // Determine what to render in the main area
  const isAttendancePage = activePage === 'attendance';
  const isAdminPage      = activePage === 'admin';
  const pageTitle = isAttendancePage
    ? ATTENDANCE_LABELS[role]
    : isAdminPage
    ? 'Administration'
    : visibleNav.find((n) => n.id === activePage)?.label ?? 'Dashboard';

  /** Render the correct content for the active nav item */
  function renderContent() {
    switch (activePage) {
      // ── Attendance ── role-specific grid/report views
      case 'attendance':
        return <AttendanceView role={role} />;

      // ── Dashboard ── role-specific summary/overview components
      case 'dashboard':
        if (role === 'KCU_LEADER')  return <KcuDashboard />;
        if (role === 'ZONE_LEADER') return <ZoneDashboard />;
        if (role === 'PASTOR')      return <PastorAttendanceAnalytics />;
        return <AdminDashboard />;

      // ── Admin ──
      case 'admin':
        return <AdminDashboard />;

      // ── Members ── read-only roster per role
      case 'members':
        if (role === 'KCU_LEADER')  return <KcuMemberList />;
        if (role === 'ZONE_LEADER') return <ZoneAttendanceReport initialTab="directory" />;
        return <AdminDashboard />;

      // ── Follow-Up ──
      case 'followup':
        if (role === 'KCU_LEADER')  return <KcuFollowUpList />;
        if (role === 'ZONE_LEADER') return <ZoneAttendanceReport initialTab="followup" />;
        return <AdminDashboard />;

      // ── Reports ── Zone Leader only
      case 'reports':
        return <ZoneAttendanceReport initialTab="reports" />;

      // ── Admin-only pages ──
      case 'registration':
      case 'zones':
      case 'baby':
      case 'converts':
        return <AdminDashboard />;

      // ── Profile Settings — all roles ──
      case 'settings':
        return <ProfileSettings />;

      default:
        return <AttendanceView role={role} />;
    }
  }

  return (
    <div className="flex h-screen bg-gray-100 font-sans overflow-hidden">
      {/* ------------------------------------------------------------------ */}
      {/* Sidebar                                                              */}
      {/* ------------------------------------------------------------------ */}
      <aside className="w-[220px] bg-sidebar flex flex-col shrink-0">
        {/* Logo */}
        <div className="px-4 pt-5 pb-4 border-b border-white/10">
          <img
            src={churchLogo}
            alt="Gospel Believers Unique 7000 Church"
            className="w-10 h-10 rounded-full object-cover mb-2"
          />
          <h1 className="font-serif text-sm font-normal text-white leading-tight">
            Gospel Believers Unique 7000 Church
          </h1>
          <p className="text-[10px] text-white/50 mt-0.5">Management System</p>
        </div>

        {/* Role badge */}
        <div className="mx-3 mt-3 mb-2 bg-white/[0.08] rounded-lg px-2.5 py-2">
          <p className="text-[9px] text-white/40 uppercase tracking-[0.08em]">Signed in as</p>
          <p className="text-xs text-white/90 font-medium mt-0.5">{roleLabel}</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-1 scrollbar-none">
          {navWithSections.map((entry, idx) =>
            entry.type === 'section' ? (
              <p
                key={`section-${idx}`}
                className="text-[9px] text-white/35 uppercase tracking-[0.1em] px-4 pt-3 pb-1"
              >
                {entry.label}
              </p>
            ) : (
              <button
                key={entry.item.id}
                onClick={() => setActivePage(entry.item.id)}
                className={[
                  'flex items-center gap-[9px] w-[calc(100%-16px)] mx-2 px-3 py-2 rounded-md text-[12.5px] transition-all duration-150 cursor-pointer',
                  activePage === entry.item.id
                    ? 'bg-primary text-white font-medium [&_svg]:opacity-100'
                    : 'text-white/65 hover:bg-white/[0.08] hover:text-white/90',
                ].join(' ')}
              >
                {entry.item.icon}
                <span>{entry.item.label}</span>
                {entry.item.badge && (
                  <span className="ml-auto bg-red-500/30 text-red-300 text-[10px] px-1.5 py-px rounded-full">
                    {entry.item.badge}
                  </span>
                )}
              </button>
            ),
          )}
        </nav>

        {/* Footer / user info + logout */}
        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-[30px] h-[30px] rounded-full bg-gold flex items-center justify-center text-[11px] font-medium text-navy-deep shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-white/80 font-medium truncate">{fullName}</p>
              <span className="text-[10px] text-white/40">{roleLabel}</span>
            </div>
            <button
              onClick={logout}
              aria-label="Sign out"
              title="Sign out"
              className="shrink-0 text-white/40 hover:text-white/80 transition-colors cursor-pointer"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* ------------------------------------------------------------------ */}
      {/* Main area                                                            */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-[52px] bg-white border-b border-gray-200 px-5 flex items-center justify-between shrink-0">
          <span className="text-[15px] font-medium text-gray-800">{pageTitle}</span>

          {/* User profile info + logout */}
          <div className="flex items-center gap-3">
            {/* Avatar + name + role */}
            <div className="flex items-center gap-2">
              <div className="w-[30px] h-[30px] rounded-full bg-sidebar flex items-center justify-center text-[11px] font-medium text-white shrink-0">
                {initials}
              </div>
              <div className="text-right">
                <p className="text-[12px] font-medium text-gray-800 leading-tight">{fullName}</p>
                <p className="text-[10px] text-gray-400 leading-tight">{roleLabel}</p>
              </div>
            </div>

            {/* Divider */}
            <div className="w-px h-5 bg-gray-200" />

            {/* Logout button */}
            <button
              onClick={logout}
              aria-label="Sign out"
              title="Sign out"
              className="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sign out
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-5 bg-gray-50">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
