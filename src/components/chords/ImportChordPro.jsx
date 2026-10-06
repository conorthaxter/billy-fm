import { useState } from 'react';
import { validateChart } from '../../utils/chordPro';

// Paste raw ChordPro. Nothing is accepted until it parses; replacing an existing
// chart needs a confirm.
export default function ImportChordPro({ hasChart, onImport, onCancel }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    const result = validateChart(text);
    if (!result.ok) { setError(result.error); return; }
    if (hasChart && !window.confirm('Replace the existing chart with this one? This cannot be undone.')) return;
    setBusy(true);
    try {
      await onImport(text);
    } catch (err) {
      setError(err.message || 'Import failed');
      setBusy(false);
    }
  }

  return (
    <div className="cc-import">
      <div className="cc-import-title">Import ChordPro</div>
      <textarea
        value={text}
        onChange={e => { setText(e.target.value); setError(''); }}
        placeholder="Paste ChordPro here"
        autoFocus
        spellCheck={false}
      />
      {error && <div className="cc-error">{error}</div>}
      <div className="cc-editor-row">
        <button type="button" className="cc-btn is-primary" onClick={submit} disabled={busy}>Import</button>
        <button type="button" className="cc-btn" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </div>
  );
}
