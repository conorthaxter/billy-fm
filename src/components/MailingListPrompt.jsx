import { useContext, useState } from 'react';
import { AuthContext } from '../App';

const STORAGE_KEY = 'bfm_ml_prompted';

export default function MailingListPrompt() {
  const { user, updateUser } = useContext(AuthContext);
  const [visible,  setVisible]  = useState(() => {
    if (typeof window === 'undefined') return false;
    return !localStorage.getItem(STORAGE_KEY);
  });
  const [checked,  setChecked]  = useState(false);
  const [saving,   setSaving]   = useState(false);

  // Only show to logged-in users who haven't opted in yet and haven't been prompted
  if (!visible || !user || user.mailing_list_opt_in) return null;

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  }

  async function handleContinue() {
    if (checked) {
      setSaving(true);
      try {
        await updateUser({ mailing_list_opt_in: true });
      } catch { /* ignore */ }
    }
    dismiss();
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: 20, boxSizing: 'border-box',
    }}>
      <div style={{
        background: '#111', color: '#e8e8e8',
        maxWidth: 480, width: '100%',
        padding: 40, borderRadius: 12,
        boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
        fontFamily: 'Inter, sans-serif',
      }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 10, color: '#fff' }}>
          Stay in the loop
        </div>
        <div style={{ fontSize: 14, color: '#aaa', marginBottom: 28, lineHeight: 1.6 }}>
          Receive updates from the developer of billy-fm.
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 28 }}>
          <input
            type="checkbox"
            checked={checked}
            onChange={e => setChecked(e.target.checked)}
            style={{ width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }}
          />
          <span style={{ fontSize: 13, color: '#ccc' }}>Yes, add me to the list</span>
        </label>

        <button
          onClick={handleContinue}
          disabled={saving}
          style={{
            width: '100%', padding: '13px 0',
            fontSize: 13, fontWeight: 700, letterSpacing: 0.5,
            background: '#e8e8e8', color: '#111',
            border: 'none', borderRadius: 6,
            cursor: saving ? 'wait' : 'pointer',
            fontFamily: 'inherit',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving…' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
