import { useEffect, useMemo, useRef, useState } from 'react';
import ChordChartView from './ChordChartView';
import ChordEditorBar from './ChordEditorBar';
import ImportChordPro from './ImportChordPro';
import { useChart, setCachedChart } from '../../hooks/useChart';
import { putChart } from '../../api/library';
import { buildDisplayModel, serializeModel } from '../../utils/chordPro';
import { normalizeOffset } from '../../utils/transposition';
import { useSettings } from '../../contexts/SettingsContext';
import { keyColor } from '../../utils/keyColors';
import SongCell from '../SongCell';

// Left pane: the chart for one song. Only the owner account sees the pencil /
// import; everyone else gets the chart and the transpose stepper.
function ChartPane({ song, canEdit, onClose, onOffsetChange, onChartSaved, dirtyRef }) {
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

  // Lets the library pane ask whether switching songs would lose edits.
  dirtyRef.current = editing && dirty;

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
    <div className="cc-focus-main">
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

// Full-screen focus mode: chart for the selected song on the left (2/3), the
// library as tiles on the right. Picking a tile only selects it — it never
// changes Now Playing.
export default function FocusMode({ song, songs, nowPlaying, canEdit, onClose, onSelectSong, onAddToQueue, onPlayNext, onOffsetChange, onChartSaved }) {
  const dirtyRef = useRef(false);
  const searchRef = useRef(null);
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const visible = useMemo(() => {
    if (!q) return songs;
    return songs.filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.artist.toLowerCase().includes(q) ||
      (s.genre || []).some(g => g.toLowerCase().includes(q)) ||
      (s.tags || []).some(t => t.toLowerCase().includes(q)));
  }, [songs, q]);

  function select(next) {
    if (song && next.song_id === song.song_id) return;
    if (dirtyRef.current && !window.confirm('Discard your chord changes?')) return;
    onSelectSong(next);
  }

  // Space closes; "/" jumps to search; Tab ripples the queue (next song becomes Now Playing and selected).
  // Both are ignored while typing in a field.
  useEffect(() => {
    function onKey(e) {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      if (e.key === ' ') {
        e.preventDefault();
        if (dirtyRef.current && !window.confirm('Discard your chord changes?')) return;
        onClose();
      } else if (e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        if (dirtyRef.current && !window.confirm('Discard your chord changes?')) return;
        onPlayNext?.();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onPlayNext, onClose]);

  function onSearchKeyDown(e) {
    if (e.key === 'Escape') {
      // Escape in the search box clears it; it does not close focus mode.
      e.stopPropagation();
      setQuery('');
      e.currentTarget.blur();
    } else if (e.key === 'Enter' && visible[0]) {
      e.preventDefault();
      select(visible[0]);
      e.currentTarget.blur();
    }
  }

  useEffect(() => {
    if (song) return undefined;   // ChartPane handles Escape when a chart is open
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [song, onClose]);

  return (
    <div className="cc-focus" role="dialog" aria-label="Chords">
      {song ? (
        <ChartPane
          key={song.song_id}
          song={song}
          canEdit={canEdit}
          onClose={onClose}
          onOffsetChange={onOffsetChange}
          onChartSaved={onChartSaved}
          dirtyRef={dirtyRef}
        />
      ) : (
        <div className="cc-focus-main">
          <div className="cc-focus-bar">
            <div className="cc-focus-title" />
            <div className="cc-focus-actions">
              <button type="button" className="cc-btn" onClick={onClose} title="Close (Esc)">✕</button>
            </div>
          </div>
          <div className="cc-focus-body"><div className="cc-msg">No song selected. Pick one from the library.</div></div>
        </div>
      )}

      <div className="cc-focus-lib">
        <div className="cc-preview-hdr"><span>LIBRARY</span></div>
        <div className="cc-search">
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onSearchKeyDown}
            placeholder="Search songs  ( / )"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
        <div className="cc-focus-lib-body">
          <div className="song-grid">
            {visible.map(s => (
              <SongCell
                key={s.song_id}
                song={s}
                isNowPlaying={nowPlaying?.song_id === s.song_id}
                isSelected={song?.song_id === s.song_id}
                onSelect={() => select(s)}
                onDblClick={() => {}}
                onAddToQueue={() => onAddToQueue?.(s)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
