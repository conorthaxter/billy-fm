import { useEffect, useMemo, useState } from 'react';
import ChordChartView from './ChordChartView';
import ChordEditorBar from './ChordEditorBar';
import ImportChordPro from './ImportChordPro';
import { useChart, setCachedChart } from '../../hooks/useChart';
import { putChart } from '../../api/library';
import { buildDisplayModel, serializeModel } from '../../utils/chordPro';
import { normalizeOffset } from '../../utils/transposition';
import { useSettings } from '../../contexts/SettingsContext';
import { keyColor } from '../../utils/keyColors';

// Full-screen chart. Takes the song as a parameter (not always now-playing).
// Only the owner account sees the pencil / import; everyone else gets the chart
// and the transpose stepper.
export default function FocusMode({ song, canEdit, onClose, onOffsetChange, onChartSaved }) {
  const { palette } = useSettings();
  const { chart, loading, error } = useChart(song.song_id);
  const offset = song.transpose_offset || 0;

  const [editing, setEditing]   = useState(false);
  const [importing, setImporting] = useState(false);
  const [lines, setLines]       = useState(null);   // editor model while editing
  const [dirty, setDirty]       = useState(false);
  const [slot, setSlot]         = useState(null);   // { idx, pos, chord }
  const [saving, setSaving]     = useState(false);
  const [saveError, setSaveError] = useState('');

  const hasChart = !!chart;
  const [bg, fg] = keyColor(song.key, palette);

  // Empty state for the owner opens straight onto the (blank) editable surface.
  useEffect(() => {
    if (canEdit && chart === null && !loading) setEditing(true);
  }, [canEdit, chart, loading]);

  // Build the editor model when entering edit mode with a chart.
  useEffect(() => {
    if (!editing) { setLines(null); setSlot(null); setDirty(false); return; }
    if (!chart) { setLines([]); return; }
    try { setLines(buildDisplayModel(chart, offset)); }
    catch { setLines(null); }
  }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function onKey(e) {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      if (importing) { setImporting(false); return; }
      if (slot) { setSlot(null); return; }
      if (editing) { cancelEditing(); return; }
      onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  function cancelEditing() {
    if (dirty && !window.confirm('Discard your chord changes?')) return;
    setEditing(false);
    if (chart === null) onClose();
  }

  function applyChord(chordStr) {
    setLines(prev => prev.map(line => {
      if (line.idx !== slot.idx) return line;
      const others = line.chords.filter(c => c.pos !== slot.pos);
      const existing = line.chords.find(c => c.pos === slot.pos);
      const entry = existing ? { ...existing, chord: chordStr } : { pos: slot.pos, chord: chordStr };
      return { ...line, chords: [...others, entry].sort((a, b) => a.pos - b.pos) };
    }));
    setDirty(true);
    setSlot(null);
  }

  function removeChord() {
    setLines(prev => prev.map(line => (
      line.idx !== slot.idx ? line : { ...line, chords: line.chords.filter(c => c.pos !== slot.pos) }
    )));
    setDirty(true);
    setSlot(null);
  }

  async function persist(text) {
    await putChart(song.song_id, text);
    setCachedChart(song.song_id, text);
    onChartSaved?.(song.song_id);
  }

  async function save() {
    setSaving(true);
    setSaveError('');
    try {
      await persist(serializeModel(chart, lines, offset));
      setEditing(false);
    } catch (err) {
      setSaveError(err.message || 'Save failed');
    }
    setSaving(false);
  }

  async function importChart(text) {
    await persist(text);
    setImporting(false);
    setEditing(false);
  }

  const shownKey = song.key || '?';
  const stepper = useMemo(() => ({
    down: () => onOffsetChange?.(song.song_id, normalizeOffset(offset - 1)),
    up:   () => onOffsetChange?.(song.song_id, normalizeOffset(offset + 1)),
  }), [song.song_id, offset, onOffsetChange]);

  return (
    <div className="cc-focus" role="dialog" aria-label={`Chords for ${song.title}`}>
      <div className="cc-focus-bar">
        <div className="cc-focus-title">
          <b>{song.title}</b>
          <span>{song.artist}</span>
        </div>

        <div className="cc-stepper">
          <button type="button" className="cc-btn" onClick={stepper.down} disabled={editing} title="Down a semitone">♭</button>
          <span className="cc-key" style={{ background: bg, color: fg }}>{shownKey}</span>
          <button type="button" className="cc-btn" onClick={stepper.up} disabled={editing} title="Up a semitone">♯</button>
        </div>

        <div className="cc-focus-actions">
          {canEdit && !editing && (
            <>
              <button type="button" className="cc-btn" onClick={() => setEditing(true)} disabled={!hasChart} title="Edit chords">✎</button>
              <button type="button" className="cc-btn" onClick={() => setImporting(true)}>Import ChordPro</button>
            </>
          )}
          {editing && (
            <>
              <button type="button" className="cc-btn is-primary" onClick={save} disabled={saving || !dirty}>{saving ? 'Saving…' : 'Save'}</button>
              <button type="button" className="cc-btn" onClick={cancelEditing} disabled={saving}>Cancel</button>
              {canEdit && <button type="button" className="cc-btn" onClick={() => setImporting(true)}>Import ChordPro</button>}
            </>
          )}
          <button type="button" className="cc-btn" onClick={onClose} title="Close (Esc)">✕</button>
        </div>
      </div>

      {saveError && <div className="cc-error">{saveError}</div>}

      <div className="cc-focus-body">
        {loading && <div className="cc-msg">Loading…</div>}
        {error && <div className="cc-msg">{error}</div>}

        {!loading && !error && chart === null && !editing && (
          <div className="cc-msg">No chart for this song yet.</div>
        )}
        {!loading && !error && chart === null && editing && (
          <div className="cc-msg">
            No chart yet. Lyrics are fixed in the editor, so start by importing ChordPro.
          </div>
        )}

        {hasChart && !editing && <ChordChartView chart={chart} offset={offset} />}
        {hasChart && editing && lines && (
          <ChordChartView lines={lines} editable activeSlot={slot} onSlotClick={(idx, pos, entry) => setSlot({ idx, pos, chord: entry?.chord ?? '' })} />
        )}
      </div>

      {editing && slot && (
        <ChordEditorBar
          slot={slot}
          onApply={applyChord}
          onRemove={removeChord}
          onCancel={() => setSlot(null)}
        />
      )}

      {importing && (
        <div className="cc-import-overlay">
          <ImportChordPro hasChart={hasChart} onImport={importChart} onCancel={() => setImporting(false)} />
        </div>
      )}
    </div>
  );
}
