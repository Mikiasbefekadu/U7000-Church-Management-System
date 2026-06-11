/**
 * AuthContext.tsx
 *
 * Manages authentication state for the entire app.
 *
 * On mount the provider checks localStorage for a persisted JWT
 * (written there by the login flow via setToken() from api.ts).
 * If a token exists it is kept active; the role, zone, and KCU
 * scope values are parsed from the stored login response so the
 * rest of the app can scope API queries without re-fetching.
 *
 * The role-switcher (PASTOR / ZONE_LEADER / KCU_LEADER) is kept
 * for demo / development purposes and overrides the live role in
 * the UI without touching the token.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { getToken, setToken, clearToken, TOKEN_KEY } from '../services/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** All four roles that exist in the system. */
export type UserRole = 'PASTOR' | 'ADMIN' | 'ZONE_LEADER' | 'KCU_LEADER';

/**
 * Shape of the login response stored in localStorage under
 * TOKEN_KEY + '_profile' after a successful /api/auth/login call.
 * Mirrors LoginResponse.java exactly.
 */
export interface StoredAuthProfile {
  token: string;
  userId: string;
  username: string;
  /** Raw role string from the backend — mapped to UserRole below. */
  role: string;
  assignedZoneId: string | null;
  assignedKcuId: string | null;
}

/** Key used to persist the full login profile alongside the raw token. */
const PROFILE_KEY = `${TOKEN_KEY}_profile`;

// ---------------------------------------------------------------------------
// Role → display mapping (used when no live profile is available)
// ---------------------------------------------------------------------------

interface RoleDefaults {
  fullName: string;
  initials: string;
  label: string;
}

const ROLE_DEFAULTS: Record<UserRole, RoleDefaults> = {
  PASTOR: {
    fullName: 'Pastor Admin',
    initials: 'PA',
    label:    'Pastor',
  },
  ADMIN: {
    fullName: 'System Admin',
    initials: 'SA',
    label:    'Administrator',
  },
  ZONE_LEADER: {
    fullName: 'Zone Leader A',
    initials: 'ZA',
    label:    'Zone Leader',
  },
  KCU_LEADER: {
    fullName: 'KCU Leader B',
    initials: 'KB',
    label:    'KCU Leader',
  },
};

/** Map backend role strings (including ADMIN) to our frontend UserRole. */
function normaliseRole(raw: string): UserRole {
  const upper = raw.toUpperCase();
  if (upper === 'ZONE_LEADER') return 'ZONE_LEADER';
  if (upper === 'KCU_LEADER')  return 'KCU_LEADER';
  if (upper === 'ADMIN')       return 'ADMIN';
  // PASTOR gets full visibility
  return 'PASTOR';
}

/** Derive two-letter initials from a full name. */
function toInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

export interface AuthContextValue {
  /** Currently active role (may be overridden by the role-switcher). */
  role: UserRole;
  /** Full display name of the signed-in user. */
  fullName: string;
  /** Two-letter avatar initials. */
  initials: string;
  /** Human-readable role label for UI badges. */
  roleLabel: string;
  /** Zone ID assigned to this user — non-null for ZONE_LEADER. */
  assignedZoneId: string | null;
  /** KCU ID assigned to this user — non-null for KCU_LEADER. */
  assignedKcuId: string | null;
  /** Whether a valid token is currently held. */
  isAuthenticated: boolean;

  /**
   * Call after a successful POST /api/auth/login.
   * Persists the token + profile and updates context state.
   */
  login: (profile: StoredAuthProfile) => void;

  /** Clears token + profile and resets state. */
  logout: () => void;

  /**
   * Override the active role for demo / development purposes.
   * Does not affect the stored token or scope IDs.
   */
  switchRole: (role: UserRole) => void;
}

// ---------------------------------------------------------------------------
// Context + Provider
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
  /** Seed role used when no token is found in localStorage (dev default). */
  initialRole?: UserRole;
}

export function AuthProvider({
  children,
  initialRole = 'PASTOR',
}: AuthProviderProps) {

  // ── Initialise from localStorage ──────────────────────────────────────────
  // Read once at mount; subsequent changes go through login() / logout().
  const [activeRole, setActiveRole] = useState<UserRole>(() => {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (raw) {
        const profile: StoredAuthProfile = JSON.parse(raw);
        return normaliseRole(profile.role);
      }
    } catch {
      // Corrupt storage — fall through to default
    }
    return initialRole;
  });

  const [fullName, setFullName] = useState<string>(() => {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (raw) {
        const profile: StoredAuthProfile = JSON.parse(raw);
        return profile.username;
      }
    } catch { /* ignore */ }
    return ROLE_DEFAULTS[initialRole].fullName;
  });

  const [assignedZoneId, setAssignedZoneId] = useState<string | null>(() => {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (raw) return (JSON.parse(raw) as StoredAuthProfile).assignedZoneId;
    } catch { /* ignore */ }
    return null;
  });

  const [assignedKcuId, setAssignedKcuId] = useState<string | null>(() => {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (raw) return (JSON.parse(raw) as StoredAuthProfile).assignedKcuId;
    } catch { /* ignore */ }
    return null;
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    () => getToken() !== null,
  );

  // Keep isAuthenticated in sync if the token is wiped externally
  // (e.g. by the 401 interceptor in api.ts).
  useEffect(() => {
    function handleStorageChange(e: StorageEvent) {
      if (e.key === TOKEN_KEY) {
        setIsAuthenticated(e.newValue !== null);
        if (e.newValue === null) {
          // Token was cleared — reset to defaults
          setActiveRole(initialRole);
          setFullName(ROLE_DEFAULTS[initialRole].fullName);
          setAssignedZoneId(null);
          setAssignedKcuId(null);
        }
      }
    }
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [initialRole]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const login = useCallback((profile: StoredAuthProfile) => {
    setToken(profile.token);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    const role = normaliseRole(profile.role);
    setActiveRole(role);
    setFullName(profile.username);
    setAssignedZoneId(profile.assignedZoneId);
    setAssignedKcuId(profile.assignedKcuId);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    localStorage.removeItem(PROFILE_KEY);
    setActiveRole(initialRole);
    setFullName(ROLE_DEFAULTS[initialRole].fullName);
    setAssignedZoneId(null);
    setAssignedKcuId(null);
    setIsAuthenticated(false);
  }, [initialRole]);

  const switchRole = useCallback((role: UserRole) => {
    setActiveRole(role);
    // Reset scope IDs to null when switching roles in demo mode
    setAssignedZoneId(null);
    setAssignedKcuId(null);
    setFullName(ROLE_DEFAULTS[role].fullName);
  }, []);

  // ── Derived display values ─────────────────────────────────────────────────

  const defaults = ROLE_DEFAULTS[activeRole];
  const initials  = isAuthenticated ? toInitials(fullName) : defaults.initials;
  const roleLabel = defaults.label;

  const value: AuthContextValue = {
    role:            activeRole,
    fullName:        fullName || defaults.fullName,
    initials,
    roleLabel,
    assignedZoneId,
    assignedKcuId,
    isAuthenticated,
    login,
    logout,
    switchRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Returns the current auth context.
 * Must be used inside an `<AuthProvider>`.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return ctx;
}
