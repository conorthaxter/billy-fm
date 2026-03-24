import { useContext, useState } from 'react';
import { AuthContext } from '../App';

const STORAGE_KEY = 'bfm_ml_prompted';

export default function MailingListPrompt() {
  const { user, updateUser } = useContext(AuthContext);
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !localStorage.getItem(STORAGE_KEY);
  });
  const [saving, setSaving] = useState(false);

  // Only show to logged-in users who haven't opted in yet and haven't been prompted
  if (!visible || !user || user.mailing_list_opt_in) return null;

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  }

  async function optIn() {
    setSaving(true);
    try {
      await updateUser({ mailing_list_opt_in: true });
    } catch { /* ignore */ }
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  }

  return (
    <div style={{
      position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
      background: '#111', color: '#fff', padding: '14px 18px',
      maxWidth: 380, width: 'calc(100% - 40px)',
      boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
      zIndex: 9999, fontFamily: 'monospace',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ fontSize: 12, lineHeight: 1.5 }}>
        Want updates on new music, shows, and releases? Join the mailing list.
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={optIn}
          disabled={saving}
          style={{
            flex: 1, background: '#fff', color: '#111',
            border: 'none', padding: '7px 0', fontSize: 11,
            fontFamily: 'monospace', cursor: 'pointer', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: 0.5,
          }}
        >
          {saving ? '…' : 'Yes, sign me up'}
        </button>
        <button
          onClick={dismiss}
          style={{
            background: 'transparent', color: '#888',
            border: '1px solid #444', padding: '7px 12px', fontSize: 11,
            fontFamily: 'monospace', cursor: 'pointer',
          }}
        >
          No thanks
        </button>
      </div>
    </div>
  );
}
