import { useMemo, useEffect, useRef, useState } from 'react';
import { keyColor, MAJOR_KEYS_PREVIEW } from '../utils/keyColors';
import { useSettings } from '../contexts/SettingsContext';
import { getTransitions, deleteTransition } from '../api/transitions';
import { ALL_KEYS } from '../utils/transposition';

function ChordsLink({ song, onSaveChordsUrl }) {
  const [editing, setEditing] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const url = song?.chords_url;

  function handleSave() {
    if (urlInput.trim()) onSaveChordsUrl(urlInput.trim());
    setEditing(false);
    setUrlInput('');
  }

  if (!song) return null;

  // When URL exists, just show the link — editing happens via the Edit song form
  if (url) {
    const isSearch = url.includes('google.com/search');
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="fp-chords-btn">
        <span className="fp-chords-hotkey">SPACE</span>
        {isSearch ? 'Find chords on UG ↗' : 'View chords ↗'}
      </a>
    );
  }

  if (editing) {
    return (
      <div className="fp-chords-edit">
        <input
          type="url"
          className="fp-chords-input"
          placeholder="https://tabs.ultimate-guitar.com/…"
          value={urlInput}
          onChange={e => setUrlInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
          autoFocus
        />
        <button className="fp-btn" onClick={handleSave}>Save</button>
        <button className="fp-btn" onClick={() => setEditing(false)}>Cancel</button>
      </div>
    );
  }

  return (
    <button className="fp-chords-btn fp-chords-add" onClick={() => { setUrlInput(''); setEditing(true); }}>
      + Add chords link
    </button>
  );
}

function QuickStats({ songs, playHistory, session, palette }) {
  const stats = useMemo(() => {
    if (!songs.length) return null;

    // Play counts per song
    const playCounts = {};
    for (const e of playHistory) {
      playCounts[e.songId] = (playCounts[e.songId] || 0) + 1;
    }

    // Session plays
    const sessionStart = session?.startTime || 0;
    const sessionPlayed = new Set(
      playHistory.filter(e => e.timestamp >= sessionStart).map(e => e.songId)
    ).size;

    // Most / least played
    const sorted = [...songs].sort((a, b) => (playCounts[b.song_id] || 0) - (playCounts[a.song_id] || 0));
    const mostPlayed  = sorted[0];
    const leastPlayed = [...sorted].reverse().find(s => (playCounts[s.song_id] || 0) > 0) || sorted[sorted.length - 1];

    // Key distribution (major keys only for chart)
    const keyDist = {};
    for (const s of songs) {
      const k = s.key || '?';
      keyDist[k] = (keyDist[k] || 0) + 1;
    }
    const chartKeys = MAJOR_KEYS_PREVIEW.filter(k => keyDist[k]);
    const maxKeyCount = Math.max(1, ...chartKeys.map(k => keyDist[k] || 0));

    // Genre top 5
    const genreDist = {};
    for (const s of songs) {
      for (const g of (s.genre || [])) {
        genreDist[g] = (genreDist[g] || 0) + 1;
      }
    }
    const topGenres = Object.entries(genreDist)
      .sort(([,a],[,b]) => b - a)
      .slice(0, 5);

    return { total: songs.length, sessionPlayed, mostPlayed, leastPlayed, playCounts, keyDist, chartKeys, maxKeyCount, topGenres };
  }, [songs, playHistory, session?.startTime]); // eslint-disable-line

  if (!stats) return null;

  return (
    <div className="fp-sec fp-stats">
      <div className="fp-hd">Quick Stats</div>

      <div className="qs-row">
        <span className="qs-lbl">Library</span>
        <span className="qs-val">{stats.total} songs</span>
      </div>
      <div className="qs-row">
        <span className="qs-lbl">This set</span>
        <span className="qs-val">{stats.sessionPlayed} played</span>
      </div>
      {stats.mostPlayed && (stats.playCounts[stats.mostPlayed.song_id] || 0) > 0 && (
        <div className="qs-row">
          <span className="qs-lbl">Top song</span>
          <span className="qs-val qs-trunc" title={stats.mostPlayed.title}>
            {stats.mostPlayed.title} ({stats.playCounts[stats.mostPlayed.song_id]}×)
          </span>
        </div>
      )}

      {/* Key distribution mini bar chart */}
      {stats.chartKeys.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div className="fp-hd" style={{ marginBottom: 4, fontSize: 9 }}>Keys</div>
          <div className="qs-key-chart">
            {stats.chartKeys.map(k => {
              const [bg] = keyColor(k, palette);
              const pct  = Math.max(4, Math.round((stats.keyDist[k] / stats.maxKeyCount) * 100));
              return (
                <div key={k} className="qs-key-bar-wrap" title={`${k}: ${stats.keyDist[k]}`}>
                  <div className="qs-key-bar" style={{ height: pct + '%', background: bg }} />
                  <div className="qs-key-lbl">{k}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top genres */}
      {stats.topGenres.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div className="fp-hd" style={{ marginBottom: 4, fontSize: 9 }}>Top Genres</div>
          {stats.topGenres.map(([g, count]) => (
            <div key={g} className="qs-genre-row">
              <span className="qs-genre-name">{g}</span>
              <span className="qs-genre-count">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TagsEditor({ tags = [], onSave }) {
  const [adding, setAdding] = useState(false);
  const [input, setInput]   = useState('');

  function removeTag(tag) {
    onSave((tags || []).filter(t => t !== tag));
  }

  function addTag() {
    const val = input.trim();
    if (!val || (tags || []).includes(val)) { setAdding(false); setInput(''); return; }
    onSave([...(tags || []), val]);
    setInput('');
    setAdding(false);
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div className="fp-hd" style={{ marginBottom: 4 }}>Theme Tags</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center' }}>
        {(tags || []).map(tag => (
          <span key={tag} className="tag-chip">
            {tag}
            <span className="tag-chip-rm" onClick={() => removeTag(tag)}>✕</span>
          </span>
        ))}
        {adding ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <input
              className="tag-chip-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addTag(); if (e.key === 'Escape') { setAdding(false); setInput(''); } }}
              placeholder="tag…"
              autoFocus
            />
            <button className="fp-btn" style={{ padding: '1px 5px' }} onClick={addTag}>ok</button>
          </span>
        ) : (
          <button className="tag-add-btn" onClick={() => setAdding(true)}>+ add</button>
        )}
      </div>
    </div>
  );
}

export default function FilterPanel({
  selectedSong,
  nowPlaying,
  filters,
  filterMode,
  onFilterChange,
  onToggleFilterMode,
  onPlayNow,
  onAddToQueue,
  onSaveNotes,
  onSaveChordsUrl,
  onTogglePublic,
  onEditSong,
  onDeleteSong,
  onStartLinking,
  linkingMode,
  songs,
  playHistory,
  session,
  hasActiveFilters,
  onClearFilters,
  onSelectSong,
  multiSelected = [],
  onLinkMultiSelect,
  onClearMultiSelect,
}) {
  const { palette } = useSettings();
  const [bg, fg] = selectedSong ? keyColor(selectedSong.key, palette) : ['#888', '#fff'];
  const isNP = nowPlaying?.song_id === selectedSong?.song_id;
  const noSong = !selectedSong;

  // Inline edit state
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});

  function startEdit() {
    setEditForm({
      title:     selectedSong.title     || '',
      artist:    selectedSong.artist    || '',
      key:       selectedSong.key       || '',
      bpm:       selectedSong.bpm       ? String(selectedSong.bpm) : '',
      chordsUrl: selectedSong.chords_url || '',
    });
    setEditing(true);
  }

  function cancelEdit() { setEditing(false); }

  function saveEdit() {
    onEditSong?.({
      title:  editForm.title.trim()  || undefined,
      artist: editForm.artist.trim() || undefined,
      key:    editForm.key           || undefined,
      bpm:    editForm.bpm ? Number(editForm.bpm) : undefined,
    });
    if (editForm.chordsUrl.trim() !== (selectedSong.chords_url || '')) {
      if (editForm.chordsUrl.trim()) onSaveChordsUrl?.(editForm.chordsUrl.trim());
    }
    setEditing(false);
  }

  // Reset edit state when song changes
  useEffect(() => { setEditing(false); }, [selectedSong?.song_id]); // eslint-disable-line

  // Notes local state
  const [notesValue, setNotesValue] = useState(selectedSong?.notes || '');
  const notesRef = useRef(notesValue);
  notesRef.current = notesValue;

  useEffect(() => {
    setNotesValue(selectedSong?.notes || '');
  }, [selectedSong?.song_id]); // eslint-disable-line

  function handleNotesBlur() {
    const current = notesRef.current;
    if (current !== (selectedSong?.notes || '')) {
      onSaveNotes?.(current);
    }
  }

  // Transitions for selected song
  const [transitions, setTransitions] = useState([]);

  useEffect(() => {
    if (!selectedSong) { setTransitions([]); return; }
    getTransitions(selectedSong.song_id)
      .then(setTransitions)
      .catch(() => setTransitions([]));
  }, [selectedSong?.song_id]); // eslint-disable-line

  async function handleDeleteTransition(id) {
    try {
      await deleteTransition(id);
      setTransitions(prev => prev.filter(t => t.id !== id));
    } catch { /* silent */ }
  }

  return (
    <div className="filter-panel">
      {/* Selected song info */}
      <div className="fp-sec">
        <div className="fp-hd">Selected Song</div>
        {selectedSong ? (
          <div className="fp-info">
            {editing ? (
              <div className="fp-edit-form">
                <input
                  className="fp-edit-input"
                  value={editForm.title}
                  onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Title"
                  autoFocus
                />
                <input
                  className="fp-edit-input"
                  value={editForm.artist}
                  onChange={e => setEditForm(f => ({ ...f, artist: e.target.value }))}
                  placeholder="Artist"
                />
                <div style={{ display: 'flex', gap: 4 }}>
                  <select
                    className="fp-edit-select"
                    value={editForm.key}
                    onChange={e => setEditForm(f => ({ ...f, key: e.target.value }))}
                  >
                    <option value="">— Key —</option>
                    {ALL_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                  <input
                    className="fp-edit-input"
                    style={{ width: 60 }}
                    type="number"
                    min="40" max="300"
                    value={editForm.bpm}
                    onChange={e => setEditForm(f => ({ ...f, bpm: e.target.value }))}
                    placeholder="BPM"
                  />
                </div>
                <input
                  className="fp-edit-input"
                  style={{ marginTop: 4 }}
                  type="url"
                  value={editForm.chordsUrl}
                  onChange={e => setEditForm(f => ({ ...f, chordsUrl: e.target.value }))}
                  placeholder="Chords URL (optional)"
                />
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  <button className="fp-btn primary" onClick={saveEdit}>Save</button>
                  <button className="fp-btn" onClick={cancelEdit}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <b style={{ fontSize: 12, lineHeight: 1.3, display: 'block', marginBottom: 1 }}>
                  {selectedSong.title}
                </b>
                <span style={{ fontSize: 11, color: '#888' }}>{selectedSong.artist}</span>
                <br />
                <span
                  className="np-badge"
                  style={{ background: bg, color: fg, fontSize: 10, padding: '1px 6px', marginTop: 4, display: 'inline-block' }}
                >
                  {selectedSong.key || '?'}
                </span>
                {selectedSong.bpm && (
                  <span style={{ fontSize: 10, marginLeft: 5 }}>{selectedSong.bpm} BPM</span>
                )}
                <div className="fp-actions">
                  <button className="fp-btn" onClick={onAddToQueue}>+ QUEUE</button>
                  <button className="fp-btn primary" onClick={onPlayNow}>
                    {isNP ? '▶ PLAYING' : '▶ PLAY NOW'}
                  </button>
                </div>
                <div className="fp-actions fp-actions-row2">
                  <button className="fp-btn" onClick={startEdit} title="Edit song info">✎ Edit</button>
                  <button
                    className={`fp-btn fp-visibility-btn${selectedSong.is_public ? ' public' : ''}`}
                    onClick={onTogglePublic}
                    title={selectedSong.is_public ? 'Public — click to make private' : 'Private — click to make public'}
                  >
                    {selectedSong.is_public ? '🌐 Public' : '🔒 Private'}
                  </button>
                </div>
                <div className="fp-actions" style={{ marginTop: 4 }}>
                  <button
                    className="fp-btn fp-delete-btn"
                    onClick={() => onDeleteSong?.(selectedSong)}
                    title="Remove from library"
                  >
                    ✕ Delete from library
                  </button>
                </div>
              </>
            )}

            {/* Chords link — full width */}
            <div style={{ marginTop: 6 }}>
              <ChordsLink song={selectedSong} onSaveChordsUrl={onSaveChordsUrl} />
            </div>

            {/* Theme tags */}
            <TagsEditor
              tags={selectedSong.tags}
              onSave={newTags => onEditSong?.({ tags: newTags })}
            />

            {/* Notes */}
            <div style={{ marginTop: 8 }}>
              <div className="fp-hd" style={{ marginBottom: 3 }}>Notes</div>
              <textarea
                className="fp-notes"
                value={notesValue}
                onChange={e => setNotesValue(e.target.value)}
                onBlur={handleNotesBlur}
                placeholder="Add notes…"
                rows={3}
              />
            </div>
          </div>
        ) : (
          <div className="fp-no-song">Select a song to filter by similarity</div>
        )}
      </div>

      {/* Match filters */}
      <div className="fp-sec">
        <div className="fp-hd-row">
          <span className="fp-hd">Match Filters</span>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {hasActiveFilters && (
              <button
                className="fp-clear-btn"
                onClick={onClearFilters}
                title="Clear all filters"
              >✕ clear</button>
            )}
            <button
              className={`fp-mode-btn${filterMode === 'AND' ? ' on' : ''}`}
              onClick={onToggleFilterMode}
              title="OR = any filter matches; AND = all filters must match"
            >
              {filterMode}
            </button>
          </div>
        </div>
        {[
          ['key',    'Same key / relative'],
          ['bpm',    'BPM ±15'],
          ['theme',  'Same theme tags'],
          ['era',    'Same era'],
          ['artist', 'Same artist'],
          ['genre',  'Same genre'],
        ].map(([k, label]) => (
          <label key={k} className={`fp-row${noSong ? ' fp-row-dim' : ''}`}>
            <input
              type="checkbox"
              checked={!!filters[k]}
              onChange={e => onFilterChange(k, e.target.checked)}
              disabled={noSong}
            />
            {label}
          </label>
        ))}
      </div>

      {/* Play frequency — always available */}
      <div className="fp-sec">
        <div className="fp-hd">Play Frequency</div>
        <label className="fp-row">
          <input
            type="checkbox"
            checked={!!filters.unplayed}
            onChange={e => onFilterChange('unplayed', e.target.checked)}
          />
          Not played recently
        </label>
        <label className="fp-row">
          <input
            type="checkbox"
            checked={!!filters.frequent}
            onChange={e => onFilterChange('frequent', e.target.checked)}
          />
          Played frequently (3+)
        </label>
      </div>

      {/* Quick stats — shown when no song selected */}
      {!selectedSong && (
        <QuickStats songs={songs || []} playHistory={playHistory || []} session={session} palette={palette} />
      )}

      {/* Transitions */}
      {selectedSong && (
        <div className="fp-sec">
          <div className="fp-hd">Transitions</div>
          {transitions.length === 0 && (
            <div className="fp-no-song">No transitions linked yet</div>
          )}
          {transitions.map(t => (
            <div key={t.id} className="fp-transition">
              <span className="fp-tr-arrow">→</span>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div
                  className="fp-tr-title"
                  style={{ cursor: 'pointer' }}
                  title="Select this song"
                  onClick={() => {
                    const song = songs?.find(s => s.song_id === t.to_song_id);
                    if (song) onSelectSong?.(song);
                  }}
                >{t.to_title}</div>
                {t.notes && <div className="fp-tr-note">{t.notes}</div>}
              </div>
              <button
                className="fp-tr-rm"
                onClick={() => handleDeleteTransition(t.id)}
                title="Remove transition"
              >✕</button>
            </div>
          ))}
          <button
            className={`fp-btn fp-link-btn${linkingMode ? ' on' : ''}`}
            style={{ marginTop: 6, width: '100%' }}
            onClick={onStartLinking}
          >
            {linkingMode ? '✕ Cancel link' : '→ Link transition'}
          </button>
        </div>
      )}

      {/* ── Multi-select ─────────────────────────────────────────── */}
      {multiSelected.length >= 2 && (
        <div className="fp-sec">
          <div className="fp-hd-row">
            <span className="fp-hd">Multi-Select ({multiSelected.length})</span>
            <button className="fp-clear-btn" onClick={onClearMultiSelect}>✕ clear</button>
          </div>
          <div style={{ fontSize: 10, color: '#666', marginBottom: 6, lineHeight: 1.5 }}>
            {multiSelected.map((s, i) => (
              <span key={s.song_id}>{s.title}{i < multiSelected.length - 1 ? ' → ' : ''}</span>
            ))}
          </div>
          <button className="fp-btn primary" style={{ width: '100%' }} onClick={onLinkMultiSelect}>
            → Link Transitions
          </button>
        </div>
      )}

      {/* ── Sticky bottom footer ──────────────────────────────────── */}
      <div className="fp-footer">
        <a className="fp-footer-by" href="https://conor.bio" target="_blank" rel="noopener noreferrer">by conor</a>
        <a className="fp-footer-tip" href="venmo://paycharge?txn=pay&recipients=conorthaxter" rel="noopener noreferrer">tip ♥</a>
      </div>

    </div>
  );
}
