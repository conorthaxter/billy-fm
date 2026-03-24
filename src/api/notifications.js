import { get, patch } from './client';

export const listNotifications  = (unreadOnly = false) =>
  get(`/api/notifications${unreadOnly ? '?unread=true' : ''}`);

export const markRead    = (id)  => patch(`/api/notifications/${id}`, {});
export const markAllRead = ()    => patch('/api/notifications/read-all', {});
