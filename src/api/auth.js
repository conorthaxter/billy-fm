import { get, post } from './client';

export const getMe   = ()  => get('/auth/me');
export const logout  = ()  => post('/auth/logout');

/** Redirects the browser to the Google OAuth flow */
export function redirectToGoogle() {
  window.location.href = '/auth/google';
}
