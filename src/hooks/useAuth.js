import { useContext } from 'react';
import { AuthContext } from '../App';

/**
 * Returns { user, isLoading, login, logout }
 *
 * user     — null while loading or unauthenticated, User object when logged in
 * isLoading — true during the initial /auth/me check
 * login()  — redirects to Google OAuth
 * logout() — calls POST /auth/logout, clears state
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
