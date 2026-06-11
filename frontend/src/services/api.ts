/**
 * api.ts — Axios instance for the Spring Boot backend.
 *
 * Responsibilities:
 *  - Base URL pointing at the local Spring Boot server
 *  - Request interceptor: attach JWT from localStorage on every request
 *  - Response interceptor: handle 401 (token expired / invalid) by clearing
 *    the stored token and redirecting to the login page
 */

import axios, {
  type AxiosInstance,
  type InternalAxiosRequestConfig,
  type AxiosResponse,
  type AxiosError,
} from 'axios';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Key used to persist the JWT in localStorage (matches API_SPECIFICATION.md). */
export const TOKEN_KEY = 'cms_token';

/**
 * Base URL for all API calls.
 * The backend uses two root prefixes:
 *   /api/auth/...   — public auth endpoints (no /v1)
 *   /api/...        — all protected resource endpoints
 * We set the base to the server root and use full paths in each service.
 */
const BASE_URL = 'http://localhost:8080';

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Reasonable timeout so the UI doesn't hang indefinitely when the backend
  // is not running during development.
  timeout: 15_000,
});

// ---------------------------------------------------------------------------
// Request interceptor — attach JWT
// ---------------------------------------------------------------------------

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`);
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error),
);

// ---------------------------------------------------------------------------
// Response interceptor — handle 401 (token expired / bad credentials)
// ---------------------------------------------------------------------------

api.interceptors.response.use(
  // Pass successful responses straight through.
  (response: AxiosResponse): AxiosResponse => response,

  // On error, inspect the status code.
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token is missing, expired, or revoked.
      // 1. Wipe the stored credential so the next page load starts clean.
      localStorage.removeItem(TOKEN_KEY);

      // 2. Log for debugging — replace with a toast/notification in production.
      console.warn(
        '[api] 401 Unauthorized — token cleared. Redirecting to login.',
      );

      // 3. Hard-redirect to the login route.
      //    Using window.location.href instead of a router push so this works
      //    outside of React component context (e.g. background polling).
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  },
);

// ---------------------------------------------------------------------------
// Auth helpers — used by AuthContext / login form
// ---------------------------------------------------------------------------

/** Persist a JWT after a successful login response. */
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

/** Remove the JWT (logout). */
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/** Read the current JWT without triggering a request. */
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export default api;
