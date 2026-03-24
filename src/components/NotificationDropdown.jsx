import { useCallback, useEffect, useRef, useState } from 'react';
import { listNotifications, markRead, markAllRead } from '../api/notifications';

const POLL_INTERVAL_MS = 60_000;

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1)  return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24)   return `${diffH}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatBody(notif) {
  if (notif.type === 'client_set_submitted') {
    let meta = {};
    try { meta = JSON.parse(notif.metadata ?? '{}'); } catch { /* ok */ }
    // Try to extract client name + event date from notification body/title
    return notif.body || notif.title;
  }
  return notif.body || notif.title;
}

export default function NotificationDropdown() {
  const [notifs,  setNotifs]  = useState([]);
  const [open,    setOpen]    = useState(false);
  const ref = useRef(null);

  const unread = notifs.filter(n => !n.is_read).length;

  const load = useCallback(async () => {
    try {
      const data = await listNotifications();
      setNotifs(data);
    } catch { /* silent — user may not be logged in */ }
  }, []);

  // Initial load + polling
  useEffect(() => {
    load();
    const id = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [load]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  async function handleMarkRead(id) {
    try {
      await markRead(id);
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    } catch { /* silent */ }
  }

  async function handleMarkAllRead() {
    try {
      await markAllRead();
      setNotifs(prev => prev.map(n => ({ ...n, is_read: 1 })));
    } catch { /* silent */ }
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="nav-notif-btn"
        title="Notifications"
        onClick={() => setOpen(o => !o)}
        style={{ position: 'relative' }}
      >
        🔔
        {unread > 0 && (
          <span style={{
            position: 'absolute',
            top: -4, right: -4,
            background: '#e53e3e',
            color: '#fff',
            fontSize: 9,
            fontWeight: 700,
            borderRadius: '50%',
            minWidth: 14,
            height: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 3px',
            lineHeight: 1,
            pointerEvents: 'none',
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          right: 0,
          width: 320,
          background: '#fff',
          border: '1px solid #000',
          boxShadow: '2px 2px 0 #000',
          zIndex: 1000,
          fontFamily: 'var(--mono)',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            borderBottom: '1px solid #e0e0e0',
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Notifications
            </span>
            {unread > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: '#555', padding: 0 }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {notifs.length === 0 ? (
              <div style={{ padding: '16px 12px', fontSize: 11, color: '#888', textAlign: 'center' }}>
                No notifications
              </div>
            ) : notifs.map(n => (
              <div
                key={n.id}
                onClick={() => !n.is_read && handleMarkRead(n.id)}
                style={{
                  padding: '10px 12px',
                  borderBottom: '1px solid #f0f0f0',
                  background: n.is_read ? '#fff' : '#fafafa',
                  cursor: n.is_read ? 'default' : 'pointer',
                  display: 'flex',
                  gap: 8,
                }}
              >
                {/* Unread dot */}
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: n.is_read ? 'transparent' : '#e53e3e',
                  flexShrink: 0, marginTop: 4,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: n.is_read ? 400 : 600, lineHeight: 1.4 }}>
                    {formatBody(n)}
                  </div>
                  <div style={{ fontSize: 10, color: '#888', marginTop: 3 }}>
                    {formatTime(n.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
