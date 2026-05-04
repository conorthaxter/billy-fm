import { get, post, patch } from './client';

export const getMe   = ()       => get('/auth/me');
export const logout  = async () => {
  try { localStorage.removeItem('bfm_token'); } catch { /* ignore */ }
  return post('/auth/logout');
};
export const patchMe = (fields) => patch('/auth/me', fields);

/** Redirects the browser to the Google OAuth flow */
export function redirectToGoogle() {
  window.location.href = (import.meta.env.VITE_API_URL || '') + '/auth/google';
}
