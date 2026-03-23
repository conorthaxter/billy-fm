import { useEffect, useRef, useState } from 'react';
import SongCell from './SongCell';
import { getSorted, getFilterSorted } from '../utils/filters';
import { keyColor, CHROMATIC_KEYS, CHROMATIC_MINOR_KEYS } from '../utils/keyColors';
import { useSettings } from '../contexts/SettingsContext';

const DETERMINISTIC_SORTS = new Set(['title', 'artist', 'key', 'bpm', 'era']);

export default function SongGrid({
  songs,
  nowPlaying,
  selectedSong,
  fadedIds,
  sortBy,
  shuffleOrder,
  playHistory,
  onSortChange,
  onReshuffle,
  onSelectSong,
  onPlaySong,
  onAddToQueue,
  onDeselect,
  multiSelected = new Set(),
  onClearMultiSelect,
  loading,
  error,
  keyFilter = null,
  onKeyFilterToggle,
  onKeyFilterClear,
  onCursorChange,
  tileZoom = 1,
  onZoomChange,
  onSearchOpen,
  onImportOpen,
}) {
  const { palette } = useSettings();
  const sorted = getSorted(songs, sortBy, shuffleOrder, playHistory);
  const anyFiltersActive = fadedIds instanceof Set
    ? fadedIds.size > 0
    : !!(fadedIds?.faded?.size);
  const display = (selectedSong && anyFiltersActive)
    ? getFilterSorted(sorted, selectedSong, fadedIds)
    : sorted;

  // Key mode
  const [keyMode, setKeyMode] = useState('maj');
  const keyList = keyMode === 'maj' ? CHROMATIC_KEYS : CHROMATIC_MINOR_KEYS;

  // Keyboard cursor (arrow keys only) — shown as glowing outline
  const [kbIdx,        setKbIdx]        = useState(null);
  const [kbVisible,    setKbVisible]    = useState(false);
  // Mouse hover cursor — used for Enter when not in keyboard mode
  const [hoverIdx,     setHoverIdx]     = useState(null);
  // Keyboard mode: true after arrow key press, false after any mouse movement
  const [keyboardMode, setKeyboardMode] = useState(false);

  const displayRef = useRef(display);
  displayRef.current = display;

  // Mouse movement → exit keyboard mode, hide visual cursor
  useEffect(() => {
    function onMouseMove() {
      setKbVisible(false);
      setKeyboardMode(false);
    }
    document.addEventListener('mousemove', onMouseMove);
    return () => document.removeEventListener('mousemove', onMouseMove);
  }, []);

  // Notify parent of the "active" cursor song
  // In keyboard mode: kbIdx controls; otherwise hoverIdx controls
  useEffect(() => {
    const idx = keyboardMode ? kbIdx : hoverIdx;
    const song = idx !== null ? display[idx] : null;
    onCursorChange?.(song ?? null);
  }, [kbIdx, hoverIdx, keyboardMode]); // eslint-disable-line

  // Reset cursors when display changes significantly
  useEffect(() => {
    setKbIdx(null);
    setHoverIdx(null);
    setKeyboardMode(false);
  }, [songs.length, sortBy]); // eslint-disable-line

  // Get grid column count from DOM
  const gridRef = useRef(null);
  function getGridCols() {
    if (!gridRef.current) return 4;
    const tiles = Array.from(gridRef.current.querySelectorAll('.sc'));
    if (tiles.length < 2) return 1;
    const firstTop = tiles[0].getBoundingClientRect().top;
    let cols = 0;
    for (const t of tiles) {
      if (Math.abs(t.getBoundingClientRect().top - firstTop) < 5) cols++;
      else break;
    }
    return cols || 1;
  }

  // Arrow key navigation — enters keyboard mode
  useEffect(() => {
    function onKey(e) {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      const len = displayRef.current.length;
      if (!len) return;
      if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) return;
      e.preventDefault();
      setKbVisible(true);
      setKeyboardMode(true);
      setKbIdx(prev => {
        const cur = prev ?? -1;
        if (e.key === 'ArrowRight') return Math.min(len - 1, cur + 1);
        if (e.key === 'ArrowLeft')  return Math.max(0, (cur === -1 ? len : cur) - 1);
        const cols = getGridCols();
        if (e.key === 'ArrowDown') return Math.min(len - 1, (cur === -1 ? 0 : cur) + cols);
        if (e.key === 'ArrowUp')   return Math.max(0, (cur === -1 ? 0 : cur) - cols);
        return prev;
      });
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []); // eslint-disable-line

  // Scroll keyboard cursor tile into view
  useEffect(() => {
    if (kbIdx === null || !gridRef.current) return;
    const tiles = gridRef.current.querySelectorAll('.sc');
    const el = tiles[kbIdx];
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [kbIdx]);

  // Animation trigger
  const filterKey = `${selectedSong?.song_id ?? ''}-${anyFiltersActive}`;
  const prevKey = useRef(filterKey);
  useEffect(() => {
    if (filterKey !== prevKey.current && gridRef.current) {
      gridRef.current.classList.remove('filter-snap');
      void gridRef.current.offsetWidth;
      gridRef.current.classList.add('filter-snap');
    }
    prevKey.current = filterKey;
  }, [filterKey]);

  // Scroll selected into view
  useEffect(() => {
    if (!selectedSong) return;
    const el = document.querySelector('.sc.selected-cell');
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedSong?.song_id]); // eslint-disable-line

  function handleGridClick(e) {
    if (e.target === e.currentTarget || e.target.classList.contains('song-grid')) {
      onDeselect?.();
    }
  }

  const shuffleDisabled = DETERMINISTIC_SORTS.has(sortBy);

  return (
    <div className="grid-area" style={{ '--tile-zoom': tileZoom }} onClick={handleGridClick}>
      <div className="controls">
        <span style={{ fontSize: 11, fontWeight: 500 }}>Sort:</span>
        <select
          value={sortBy}
          onChange={e => onSortChange(e.target.value)}
          style={{ fontFamily: 'var(--font)', fontSize: 11, border: '1px solid #000', padding: '3px 6px', background: '#fff', outline: 'none', cursor: 'pointer' }}
        >
          <option value="random">Random</option>
          <option value="title">Alphabetical</option>
          <option value="artist">Artist A–Z</option>
          <option value="key">Key</option>
          <option value="bpm">BPM</option>
          <option value="era">Era</option>
          <option value="theme-proximity">Theme Proximity</option>
          <option value="most-played">Most Played</option>
          <option value="least-played">Least Played</option>
        </select>

        <div className="key-filter-row">
          <button
            className={`key-mode-toggle${keyMode === 'min' ? ' on' : ''}`}
            onClick={() => { setKeyMode(m => m === 'maj' ? 'min' : 'maj'); onKeyFilterClear?.(); }}
            title="Toggle major / minor keys"
          >
            {keyMode === 'maj' ? 'maj' : 'min'}
          </button>

          {keyList.map(k => {
            const [bg, fg] = keyColor(k, palette);
            const active = keyFilter === k;
            const dimmed = keyFilter && keyFilter !== k;
            return (
              <button
                key={k}
                className={`key-sq${active ? ' on' : ''}${dimmed ? ' dim' : ''}`}
                style={{ background: bg, color: fg }}
                onClick={() => onKeyFilterToggle?.(k)}
                title={k}
              >
                <span className="key-sq-label">{k.replace('m', '')}</span>
              </button>
            );
          })}

          <button
            className={`nb key-shuffle-btn${shuffleDisabled ? ' disabled' : ''}`}
            onClick={shuffleDisabled ? undefined : onReshuffle}
            title={shuffleDisabled ? 'Shuffle not available for this sort' : 'Reshuffle'}
            disabled={shuffleDisabled}
          >↻</button>
        </div>

        {(onSearchOpen || onImportOpen) && (
          <div style={{ display: 'flex', gap: 3 }}>
            {onSearchOpen && (
              <button className="nb key-shuffle-btn" onClick={onSearchOpen} title="Search (/)">/ search</button>
            )}
            {onImportOpen && (
              <button className="nb key-shuffle-btn" onClick={onImportOpen} title="Import songs">+ import</button>
            )}
          </div>
        )}

        <div className="zoom-controls">
          <button className="zoom-btn" onClick={() => onZoomChange?.(Math.max(0.6, tileZoom - 0.1))} title="Zoom out">−</button>
          <input
            type="range"
            className="zoom-slider"
            min={0.6} max={1.8} step={0.05}
            value={tileZoom}
            onChange={e => onZoomChange?.(parseFloat(e.target.value))}
            title={`Zoom: ${Math.round(tileZoom * 100)}%`}
          />
          <button className="zoom-btn" onClick={() => onZoomChange?.(Math.min(1.8, tileZoom + 0.1))} title="Zoom in">+</button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading && (
        <div className="song-grid">
          {Array.from({ length: 50 }, (_, i) => <div key={i} className="skel" />)}
        </div>
      )}

      {!loading && (
        <div ref={gridRef} className="song-grid">
          {display.map((song, i) => {
            const id = song.song_id;
            const faded = fadedIds instanceof Set
              ? fadedIds.has(id)
              : fadedIds?.faded?.has(id) ?? false;
            const isMatch = selectedSong && anyFiltersActive && !faded && id !== selectedSong?.song_id;
            return (
              <SongCell
                key={id}
                song={song}
                isNowPlaying={nowPlaying?.song_id === id}
                isSelected={selectedSong?.song_id === id}
                isFaded={faded}
                isMatch={isMatch}
                isCursor={kbIdx === i && kbVisible}
                isMultiSelected={multiSelected.has(id)}
                onMouseEnter={() => setHoverIdx(i)}
                onSelect={e => {
                  const isMulti = e.shiftKey || e.ctrlKey || e.metaKey;
                  if (isMulti) { onSelectSong(song, true); }
                  else if (selectedSong?.song_id === id) { onDeselect?.(); }
                  else { onSelectSong(song, false); }
                }}
                onDblClick={() => onPlaySong(song)}
                onAddToQueue={() => onAddToQueue(song)}
                onDragStart={e => {
                  if (multiSelected.has(id)) {
                    const all = songs.filter(s => multiSelected.has(s.song_id));
                    if (all.length > 1) {
                      e.dataTransfer.setData('application/x-songs', JSON.stringify(all));
                    }
                  } else {
                    onClearMultiSelect?.();
                  }
                  e.dataTransfer.setData('application/x-song', JSON.stringify(song));
                  e.dataTransfer.effectAllowed = 'copy';
                }}
              />
            );
          })}
          {display.length === 0 && !loading && (
            <p className="empty-state">No songs in your library yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
