import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getLibrary, updateLibraryEntry, removeFromLibrary, importAllSongs } from '../api/library';
import { createPlaylist, listPlaylists, setPlaylistSongs, getPlaylist, updatePlaylist, deletePlaylist } from '../api/playlists';
import { getTransitions, createTransition as apiCreateTransition } from '../api/transitions';
import { enrichSongs, getFirstWord } from '../utils/enrichment';
import { shuffle, computeFadedIds } from '../utils/filters';
import { RELATIVE_MAP, ENHARMONIC_MAP } from '../utils/keyColors';
import { usePlayState } from '../contexts/PlayStateContext';

import AppHeader      from '../components/AppHeader';
import { useSettings } from '../contexts/SettingsContext';
import SongGrid        from '../components/SongGrid';
import FilterPanel     from '../components/FilterPanel';
import PlaylistsPanel  from '../components/PlaylistsPanel';
import SearchBar       from '../components/SearchBar';
import ImportDialog    from '../components/ImportDialog';

function sessionDateTitle() {
  return new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Notification hook ────────────────────────────────────────────────────────

function useNotify() {
  const [msg, setMsg] = useState('');
  const timer = useRef(null);
  const notify = useCallback(m => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(''), 2600);
  }, []);
  return [msg, notify];
}

// ─── Dialog state ─────────────────────────────────────────────────────────────

function useDialog() {
  const [dlg, setDlg] = useState(null);
  const open = useCallback((title, msg, okCb, okLabel, altCb, altLabel) => {
    setDlg({ title, msg, okCb, okLabel, altCb, altLabel });
  }, []);
  const close = useCallback(() => setDlg(null), []);
  return { dlg, openDialog: open, closeDialog: close };
}

function Dialog({ dlg, onClose }) {
  if (!dlg) return null;
  return (
    <div className="dlg-overlay on">
      <div className="dlg">
        <div className="dlg-title">{dlg.title}</div>
        {dlg.msg && <div className="dlg-msg">{dlg.msg}</div>}
        <div className="dlg-btns">
          {dlg.altCb && (
            <button onClick={() => { onClose(); dlg.altCb(); }}>{dlg.altLabel || 'Skip'}</button>
          )}
          <button onClick={onClose}>Cancel</button>
          <button onClick={() => { onClose(); dlg.okCb?.(); }}>{dlg.okLabel || 'OK'}</button>
        </div>
      </div>
    </div>
  );
}

function NameInputDialog({ defaultValue, onConfirm, onCancel }) {
  const [value, setValue] = useState(defaultValue);
  function handleKeyDown(e) {
    if (e.key === 'Enter') { e.preventDefault(); onConfirm(value); }
    if (e.key === 'Escape') { onCancel(); }
  }
  return (
    <div className="dlg-overlay on">
      <div className="dlg">
        <div className="dlg-title">New Set</div>
        <div className="dlg-msg">Name this set:</div>
        <input
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          style={{ width: '100%', fontFamily: 'var(--mono)', fontSize: 12, padding: '6px 8px', border: '1px solid #000', marginTop: 8, outline: 'none', background: '#fff', color: '#000' }}
        />
        <div className="dlg-btns" style={{ marginTop: 10 }}>
          <button onClick={onCancel}>Cancel</button>
          <button onClick={() => onConfirm(value)}>Start Set</button>
        </div>
      </div>
    </div>
  );
}

// ─── Default import prompt (shown inline when library is empty) ───────────────

function DefaultImportPrompt({ onYes, onNo, importing }) {
  return (
    <div style={{ padding: '60px 20px', textAlign: 'center', maxWidth: 420, margin: '0 auto' }}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Import default songbook?</div>
      <div style={{ fontSize: 13, color: '#666', marginBottom: 28, lineHeight: 1.6 }}>
        Your library is empty. Import all songs from the public songbook to get started quickly.
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button
          onClick={onYes}
          disabled={importing}
          style={{ fontFamily: 'var(--font)', fontSize: 12, fontWeight: 700, border: '1px solid #000', background: '#000', color: '#fff', padding: '10px 28px', cursor: importing ? 'wait' : 'pointer', opacity: importing ? 0.6 : 1 }}
        >
          {importing ? 'Importing…' : 'Yes, import'}
        </button>
        <button
          onClick={onNo}
          disabled={importing}
          style={{ fontFamily: 'var(--font)', fontSize: 12, border: '1px solid #ccc', background: '#fff', color: '#000', padding: '10px 28px', cursor: 'pointer' }}
        >
          No thanks
        </button>
      </div>
    </div>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FILTER_LABELS = { key:'Key', bpm:'BPM±15', theme:'Theme', era:'Era', artist:'Artist', genre:'Genre', unplayed:'!Recent', frequent:'Frequent' };

// ─── Main component ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const { defaultSort } = useSettings();
  const ctx = usePlayState();
  const {
    nowPlaying, queue, playHistory, session,
    setNowPlaying, setQueue, setPlayHistory, setSession,
    setDashExtras,
  } = ctx;

  // Songs
  const [songs,        setSongs]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [loadError,    setLoadError]    = useState('');
  const [enrichStatus, setEnrichStatus] = useState('');
  const [enrichPct,    setEnrichPct]    = useState(0);
  const [loadTrigger,  setLoadTrigger]  = useState(0);

  // Selection (local — clears on tab switch)
  const [selectedSong,  setSelectedSong]  = useState(null);
  const [multiSelected, setMultiSelected] = useState([]);

  // Filter / sort
  const [filters,     setFilters]     = useState({ key:false, bpm:false, theme:false, era:false, artist:false, genre:false, unplayed:false, frequent:false });
  const [filterMode,  setFilterMode]  = useState('OR');
  const [sortBy,      setSortBy]      = useState(defaultSort);
  const [shuffleOrder,setShuffleOrder]= useState([]);

  // Search
  const [searchOpen,  setSearchOpen]  = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Key filter (grid control row) — single key or null
  const [keyFilter,   setKeyFilter]   = useState(null);

  // Grid cursor song (set by SongGrid arrow navigation or 1.5s hover snap)
  const [cursorSong,        setCursorSong]        = useState(null);
  const [cursorIsKeyboard,  setCursorIsKeyboard]  = useState(false);

  // Tile zoom (persisted to localStorage)
  const [tileZoom, setTileZoom] = useState(() => {
    const v = localStorage.getItem('bfm_tile_zoom');
    return v ? parseFloat(v) : 1;
  });
  function handleZoomChange(z) {
    const clamped = Math.round(Math.min(1.8, Math.max(0.6, z)) * 100) / 100;
    setTileZoom(clamped);
    localStorage.setItem('bfm_tile_zoom', clamped);
  }

  // UI
  const [centerTab,       setCenterTab]       = useState('library');
  const [ppCollapsed,     setPpCollapsed]     = useState(false);
  const [importOpen,      setImportOpen]      = useState(false);
  const [importDefaultDismissed, setImportDefaultDismissed] = useState(false);
  const [importingDefault, setImportingDefault] = useState(false);
  const [newSetNameOpen,  setNewSetNameOpen]  = useState(false);
  const [linkingMode,  setLinkingMode]  = useState(false);
  const [suggestions,  setSuggestions]  = useState([]);
  const [dismissedSug, setDismissedSug] = useState(new Set());
  const [notifMsg,     notify]          = useNotify();
  const { dlg, openDialog, closeDialog } = useDialog();

  // Playlists (shown in left panel)
  const [playlists,         setPlaylists]         = useState([]);
  const [playlistsLoading,  setPlaylistsLoading]  = useState(false);
  const [openPlaylist,      setOpenPlaylist]      = useState(null);
  const [openPlaylistLoading, setOpenPlaylistLoading] = useState(false);

  // ── Load library from API ─────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError('');
      try {
        const data = await getLibrary();
        if (cancelled) return;

        const normalised = data.map(s => ({
          ...s,
          firstWord: getFirstWord(s.title),
          genre: Array.isArray(s.genre) ? s.genre : [],
          tags:  Array.isArray(s.tags)  ? s.tags  : [],
        }));

        const order = shuffle(normalised.map(s => s.song_id));
        setShuffleOrder(order);
        setSongs(normalised);
        setLoading(false);

        const enriched = normalised.map(s => ({ ...s }));
        setEnrichPct(0);

        await enrichSongs(enriched, (done, total, status) => {
          if (cancelled) return;
          setEnrichPct(Math.round(done / total * 100));
          setEnrichStatus(status);
          setSongs([...enriched]);
        });

        if (!cancelled) {
          setEnrichPct(100);
          setEnrichStatus('');
          setSongs([...enriched]);
          setTimeout(() => setEnrichPct(0), 600);
        }
      } catch (err) {
        if (cancelled) return;
        setLoadError('Failed to load library: ' + err.message);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [loadTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load playlists on mount (shown in left panel) ─────────────────────────

  useEffect(() => {
    setPlaylistsLoading(true);
    listPlaylists()
      .then(data => { setPlaylists(data); setPlaylistsLoading(false); })
      .catch(() => setPlaylistsLoading(false));
  }, []);

  // ── Enriching banner — push panels down ───────────────────────────────────
  useEffect(() => {
    document.body.classList.toggle('enriching', !!enrichStatus);
    return () => document.body.classList.remove('enriching');
  }, [enrichStatus]);

  // ── Warn before leaving if there's an unsaved set ────────────────────────

  useEffect(() => {
    const hasUnsavedSet = !!(nowPlaying || queue.length ||
      (session && playHistory.some(e => e.timestamp >= (session?.startTime || 0))));

    function handleBeforeUnload(e) {
      if (hasUnsavedSet) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [nowPlaying, queue.length, session, playHistory]); // eslint-disable-line

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e) {
      // ESC — dismiss layers in order
      if (e.key === 'Escape') {
        if (dlg)          { closeDialog(); return; }
        if (searchOpen)   { closeSearch(); return; }
        if (nowPlaying)   { clearNP();     return; }
        if (selectedSong) { clearSelectedSong(); return; }
      }

      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;

      // ENTER — select cursor song (keyboard nav only) or play already-selected
      if (e.key === 'Enter' && !searchOpen) {
        e.preventDefault();
        if (cursorIsKeyboard && cursorSong && cursorSong.song_id !== selectedSong?.song_id) {
          selectSong(cursorSong);
        } else if (selectedSong) {
          playSong(selectedSong);
        } else if (cursorSong) {
          selectSong(cursorSong);
        }
        return;
      }

      // TAB — ripple queue: next song in queue → Now Playing
      if (e.key === 'Tab') {
        e.preventDefault();
        if (queue.length > 0) {
          ctx.playSong(queue[0]);
          notify(`▶ ${queue[0].title}`);
        }
        return;
      }

      // Q — add selected song to queue (cursor as fallback only if nothing selected)
      if (e.key === 'q' || e.key === 'Q') {
        const target = selectedSong ?? cursorSong;
        if (target) addToQueue(target);
        return;
      }

      // DELETE / BACKSPACE — clear selection
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedSong) { e.preventDefault(); clearSelectedSong(); }
        return;
      }

      // SPACE — open chords link
      if (e.key === ' ') {
        if (selectedSong?.chords_url) {
          e.preventDefault();
          window.open(selectedSong.chords_url, '_blank', 'noopener');
        }
        return;
      }

      // N — select now playing song in grid
      if (e.key === 'n' || e.key === 'N') {
        if (nowPlaying) selectSong(nowPlaying);
        return;
      }

      // R — reshuffle (only when sort is random)
      if (e.key === 'r' || e.key === 'R') {
        handleReshuffle();
        return;
      }

      // C — clear all filters
      if (e.key === 'c' || e.key === 'C') {
        clearAllFilters();
        return;
      }

      // L — toggle link/transition mode
      if (e.key === 'l' || e.key === 'L') {
        if (selectedSong) setLinkingMode(m => !m);
        return;
      }

      // Filter hotkeys — blur after to prevent spacebar from retaining focus
      const filterKeys = { k: 'key', b: 'bpm', t: 'theme', e: 'era', a: 'artist', g: 'genre' };
      const fk = filterKeys[e.key.toLowerCase()];
      if (fk && selectedSong) {
        setFilters(f => ({ ...f, [fk]: !f[fk] }));
        setTimeout(() => document.activeElement?.blur?.(), 0);
        return;
      }

      // / or Cmd+K — open search
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || e.key === '/') {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }

      // ⌘+- / ⌘+= — zoom tiles
      if (e.metaKey || e.ctrlKey) {
        if (e.key === '-' || e.key === '_') {
          e.preventDefault();
          handleZoomChange(tileZoom - 0.1);
          return;
        }
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          handleZoomChange(tileZoom + 0.1);
          return;
        }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dlg, searchOpen, nowPlaying, selectedSong, cursorSong, queue, tileZoom]); // eslint-disable-line

  // ── Computed faded IDs ────────────────────────────────────────────────────

  const filterResult = useMemo(() =>
    computeFadedIds(songs, selectedSong, filters, filterMode, searchQuery, playHistory),
    [songs, selectedSong, filters, filterMode, searchQuery, playHistory]
  );

  // Key filter — fades songs not in the selected key (+ relative minor/major)
  const keyFilteredResult = useMemo(() => {
    if (!keyFilter) return filterResult;
    const allowed = new Set([keyFilter]);
    // Add enharmonic equivalent (e.g. C# ↔ Db, Eb ↔ D#)
    const enh = ENHARMONIC_MAP[keyFilter];
    if (enh) allowed.add(enh);
    // Add relative minor/major (and its enharmonic)
    const rel = RELATIVE_MAP[keyFilter];
    if (rel) { allowed.add(rel); const relEnh = ENHARMONIC_MAP[rel]; if (relEnh) allowed.add(relEnh); }
    if (enh) { const enhRel = RELATIVE_MAP[enh]; if (enhRel) { allowed.add(enhRel); const e2 = ENHARMONIC_MAP[enhRel]; if (e2) allowed.add(e2); } }
    const keyFaded = new Set(songs.filter(s => s.key && !allowed.has(s.key)).map(s => s.song_id));
    const existingFaded = filterResult instanceof Set
      ? filterResult
      : (filterResult?.faded ?? new Set());
    const mergedFaded = new Set([...existingFaded, ...keyFaded]);
    if (filterResult instanceof Set) return mergedFaded;
    return { ...filterResult, faded: mergedFaded };
  }, [filterResult, keyFilter, songs]); // eslint-disable-line

  const activeFilters = Object.entries(filters)
    .filter(([, v]) => v)
    .map(([k]) => ({ key: k, label: FILTER_LABELS[k] }));
  const matchCount = filterResult?.matchCount ?? null;

  // ── Actions ───────────────────────────────────────────────────────────────

  const CLEAR_FILTERS = { key:false, bpm:false, theme:false, era:false, artist:false, genre:false, unplayed:false, frequent:false };

  function clearSelectedSong() {
    setSelectedSong(null);
    setFilters(CLEAR_FILTERS);
    setMultiSelected([]);
  }

  function clearAllFilters() {
    setFilters(CLEAR_FILTERS);
    setKeyFilter(null);
  }

  function selectSong(song, isMulti = false) {
    if (linkingMode) {
      handleLinkSong(song);
      return;
    }
    if (isMulti) {
      setMultiSelected(prev => {
        const idx = prev.findIndex(s => s.song_id === song.song_id);
        return idx >= 0 ? prev.filter(s => s.song_id !== song.song_id) : [...prev, song];
      });
      return;
    }
    setMultiSelected([]);
    setSelectedSong(song);
  }

  async function handleLinkMultiSelect() {
    if (multiSelected.length < 2) return;
    let linked = 0;
    for (let i = 0; i < multiSelected.length - 1; i++) {
      try {
        await apiCreateTransition(multiSelected[i].song_id, { to_song_id: multiSelected[i + 1].song_id });
        linked++;
      } catch { /* silent */ }
    }
    notify(`Linked ${linked} transition${linked !== 1 ? 's' : ''}`);
    setMultiSelected([]);
  }

  function playSong(song) {
    ctx.playSong(song);
    selectSong(song);
  }

  function clearNP() {
    ctx.clearNP();
    clearSelectedSong();
  }

  function clearNPData() {
    if (!nowPlaying) return;
    setPlayHistory(h => h.filter(e => e.songId !== nowPlaying.song_id));
    ctx.clearNP();
    notify('Play data cleared');
  }

  function addToQueue(song) {
    ctx.addToQueue(song, notify);
  }

  function removeFromQueue(idx) {
    ctx.removeFromQueue(idx);
  }

  function reorderQueue(fromIdx, toIdx) {
    ctx.reorderQueue(fromIdx, toIdx);
  }

  function dropSongIntoQueue(song, atIdx) {
    ctx.dropSongIntoQueue(song, atIdx, notify);
  }

  function handleDropToNP(song, source) {
    ctx.handleDropToNP(song, source);
    selectSong(song);
  }

  function handleDropToPP(song, source) {
    ctx.handleDropToPP(song, source);
    notify(`"${song.title}" → history`);
  }

  function handleDragFromNP() {
    ctx.handleDragFromNP();
  }

  function reorderHistory(fromIdx, toIdx) {
    ctx.reorderHistory(fromIdx, toIdx);
  }

  function clearQueue() {
    if (!queue.length) return;
    openDialog('Clear queue?', '', () => { ctx.clearQueue(); notify('Queue cleared'); });
  }

  function clearHistory() {
    openDialog('Clear play history?', 'This removes all previously played data.', () => {
      ctx.clearHistory();
      notify('History cleared');
    });
  }

  function newSession() {
    setNewSetNameOpen(true);
  }

  function confirmNewSetName(name) {
    setNewSetNameOpen(false);
    const title = (name || '').trim() || sessionDateTitle();
    const hasContent = nowPlaying || queue.length ||
      (session && playHistory.some(e => e.timestamp >= (session?.startTime || 0)));
    if (hasContent) {
      openDialog('Save current set first?', 'Save before starting a new set?',
        () => { doSaveSession(true); startNewSession(title); },
        'Save & Start New',
        () => startNewSession(title),
        'Skip & Start New'
      );
    } else {
      startNewSession(title);
    }
  }

  function startNewSession(title) {
    const t = title || sessionDateTitle();
    ctx.startNewSession(t);
    notify('New session started: ' + t);
  }

  function gatherSessionSongs() {
    const played = playHistory.filter(e => e.timestamp >= (session?.startTime || 0));
    const seen = new Set();
    const sessionSongs = [];
    for (const ev of played) {
      if (!seen.has(ev.songId)) {
        seen.add(ev.songId);
        const s = songs.find(x => x.song_id === ev.songId);
        if (s) sessionSongs.push(s);
      }
    }
    if (nowPlaying && !seen.has(nowPlaying.song_id)) sessionSongs.push(nowPlaying);
    for (const s of queue) if (!seen.has(s.song_id)) { seen.add(s.song_id); sessionSongs.push(s); }
    return sessionSongs;
  }

  async function doSaveSession(silent = false) {
    const sessionSongs = gatherSessionSongs();
    if (!sessionSongs.length && !silent) { notify('Nothing to save yet'); return; }

    try {
      const pl = await createPlaylist({
        title:         session.title,
        playlist_type: 'set',
        notes:         session.notes || undefined,
      });

      const publicSongs = sessionSongs.filter(s => !String(s.song_id).startsWith('private_'));
      if (publicSongs.length) {
        await setPlaylistSongs(pl.id, publicSongs.map((s, i) => ({ song_id: s.song_id, position: i })));
      }

      if (!silent) notify(`"${session.title}" saved as playlist (${sessionSongs.length} songs)`);
    } catch (err) {
      if (!silent) notify(err.message || 'Failed to save playlist');
    }
  }

  function clearSession() {
    openDialog('Clear current set?', 'Clears Now Playing and Queue. Play history is kept.', () => {
      setNowPlaying(null);
      setQueue([]);
      notify('Set cleared');
    });
  }

  // ── Playlist panel handlers ───────────────────────────────────────────────

  async function handleOpenPlaylist(id) {
    setOpenPlaylistLoading(true);
    setOpenPlaylist({ id, title: '', songs: [] }); // optimistic skeleton
    try {
      const data = await getPlaylist(id);
      setOpenPlaylist(data);
    } catch { setOpenPlaylist(null); }
    setOpenPlaylistLoading(false);
  }

  function handleClosePlaylist() { setOpenPlaylist(null); }

  async function handlePlaylistRename(id, title) {
    try {
      await updatePlaylist(id, { title });
      setPlaylists(prev => prev.map(p => p.id === id ? { ...p, title } : p));
      setOpenPlaylist(p => p ? { ...p, title } : p);
    } catch { /* silent */ }
  }

  async function handlePlaylistDelete(id) {
    if (!confirm('Delete this playlist?')) return;
    try {
      await deletePlaylist(id);
      setPlaylists(prev => prev.filter(p => p.id !== id));
      if (openPlaylist?.id === id) setOpenPlaylist(null);
    } catch { /* silent */ }
  }

  async function handlePlaylistToggleFavorite(id, is_favorited) {
    try {
      await updatePlaylist(id, { is_favorited });
      setPlaylists(prev => {
        const updated = prev.map(p => p.id === id ? { ...p, is_favorited } : p);
        return [...updated].sort((a, b) => (b.is_favorited ? 1 : 0) - (a.is_favorited ? 1 : 0));
      });
    } catch { /* silent */ }
  }

  function handlePlaylistPlayAll(songs) {
    for (const s of songs) ctx.addToQueue(s);
    notify(`${songs.length} songs added to queue`);
  }

  function closeSearch() {
    setSearchOpen(false);
    setSearchQuery('');
  }

  async function saveNotes(notes) {
    if (!selectedSong) return;
    try {
      await updateLibraryEntry(selectedSong.song_id, { notes });
      setSongs(prev => prev.map(s => s.song_id === selectedSong.song_id ? { ...s, notes } : s));
      setSelectedSong(prev => prev ? { ...prev, notes } : prev);
    } catch { /* silent */ }
  }

  // Fetch suggestions when nowPlaying changes
  useEffect(() => {
    if (!nowPlaying) { setSuggestions([]); return; }
    getTransitions(nowPlaying.song_id)
      .then(setSuggestions)
      .catch(() => setSuggestions([]));
  }, [nowPlaying?.song_id]); // eslint-disable-line

  async function handleLinkSong(targetSong) {
    if (!selectedSong || targetSong.song_id === selectedSong.song_id) {
      setLinkingMode(false);
      return;
    }
    try {
      await apiCreateTransition(selectedSong.song_id, { to_song_id: targetSong.song_id });
      notify(`Linked: ${selectedSong.title} → ${targetSong.title}`);
    } catch (err) {
      notify(err.message || 'Failed to create transition');
    }
    setLinkingMode(false);
  }

  const visibleSuggestions = suggestions.filter(s => !dismissedSug.has(s.id));

  async function editSong(fields) {
    if (!selectedSong) return;
    try {
      await updateLibraryEntry(selectedSong.song_id, fields);
      setSongs(prev => prev.map(s => s.song_id === selectedSong.song_id ? { ...s, ...fields } : s));
      setSelectedSong(prev => prev ? { ...prev, ...fields } : prev);
    } catch { /* silent */ }
  }

  async function togglePublic() {
    if (!selectedSong) return;
    const is_public = !selectedSong.is_public;
    try {
      await updateLibraryEntry(selectedSong.song_id, { is_public });
      setSongs(prev => prev.map(s => s.song_id === selectedSong.song_id ? { ...s, is_public } : s));
      setSelectedSong(prev => prev ? { ...prev, is_public } : prev);
    } catch { /* silent */ }
  }

  async function saveChordsUrl(chords_url) {
    if (!selectedSong) return;
    try {
      await updateLibraryEntry(selectedSong.song_id, { chords_url });
      setSongs(prev => prev.map(s => s.song_id === selectedSong.song_id ? { ...s, chords_url } : s));
      setSelectedSong(prev => prev ? { ...prev, chords_url } : prev);
    } catch { /* silent */ }
  }

  async function handleDeleteSong(song) {
    if (!confirm(`Remove "${song.title}" from your library?`)) return;
    try {
      await removeFromLibrary(song.song_id);
      setSongs(prev => prev.filter(s => s.song_id !== song.song_id));
      if (selectedSong?.song_id === song.song_id) clearSelectedSong();
      if (nowPlaying?.song_id === song.song_id) ctx.clearNP();
      notify(`"${song.title}" removed from library`);
    } catch (err) {
      notify(err.message || 'Failed to remove song');
    }
  }

  async function handleImportDefault() {
    setImportingDefault(true);
    try {
      await importAllSongs();
      setImportDefaultDismissed(true);
      setLoadTrigger(t => t + 1);
      notify('Library imported!');
    } catch {
      notify('Import failed');
    }
    setImportingDefault(false);
  }

  function handleSortChange(v) {
    setSortBy(v);
    if (v === 'random') setShuffleOrder(shuffle(songs.map(s => s.song_id)));
  }

  function handleReshuffle() {
    setShuffleOrder(shuffle(songs.map(s => s.song_id)));
  }

  // ── Register dashExtras with global context ───────────────────────────────

  useEffect(() => {
    setDashExtras({
      songs,
      suggestions: visibleSuggestions,
      ppCollapsed,
      onTogglePP:  () => setPpCollapsed(c => !c),
      onSelectSong: selectSong,
      onClearNPData: clearNPData,
      onNewSession: newSession,
      onSaveSession: () => doSaveSession(false),
      onClearSession: clearSession,
      onDismissSuggestion: id => setDismissedSug(prev => new Set(prev).add(id)),
      onAddSuggestionToQueue: t => {
        const song = songs.find(s => s.song_id === t.to_song_id);
        if (song) ctx.addToQueue(song, notify);
        setDismissedSug(prev => new Set(prev).add(t.id));
      },
      onOpenDialog: openDialog,
    });
    return () => setDashExtras({});
  }, [songs, visibleSuggestions, ppCollapsed, nowPlaying, session]); // eslint-disable-line


  return (
    <>
      {/* Enrich progress bar */}
      {enrichPct > 0 && enrichPct < 100 && (
        <div className="enrich-bar" style={{ width: enrichPct + '%' }} />
      )}

      {/* Status bar */}
      {enrichStatus && (
        <div className="status-bar on">{enrichStatus}</div>
      )}

      {/* Header */}
      <AppHeader />

      {/* Search bar */}
      <SearchBar
        isOpen={searchOpen}
        songs={songs}
        filterPanelOpen={true}
        searchQuery={searchQuery}
        onSearch={setSearchQuery}
        onClose={closeSearch}
        onSelectSong={song => { selectSong(song); setCursorSong(song); closeSearch(); }}
        onPlaySong={song => { playSong(song); closeSearch(); }}
        onAddToQueue={addToQueue}
      />

      {/* Link mode banner */}
      {linkingMode && (
        <div className="link-mode-banner">
          → Click a song to link as a transition from "{selectedSong?.title}"
          <button onClick={() => setLinkingMode(false)}>Cancel</button>
        </div>
      )}

      {/* Filter panel — always visible */}
      <FilterPanel
        selectedSong={selectedSong}
        nowPlaying={nowPlaying}
        filters={filters}
        filterMode={filterMode}
        onFilterChange={(k, v) => setFilters(f => ({ ...f, [k]: v }))}
        onToggleFilterMode={() => setFilterMode(m => m === 'OR' ? 'AND' : 'OR')}
        onPlayNow={() => selectedSong && playSong(selectedSong)}
        onAddToQueue={() => selectedSong && addToQueue(selectedSong)}
        onSaveNotes={saveNotes}
        onSaveChordsUrl={saveChordsUrl}
        onTogglePublic={togglePublic}
        onEditSong={editSong}
        onDeleteSong={handleDeleteSong}
        onStartLinking={() => setLinkingMode(l => !l)}
        linkingMode={linkingMode}
        onSelectSong={selectSong}
        songs={songs}
        playHistory={playHistory}
        session={session}
        hasActiveFilters={Object.values(filters).some(Boolean) || !!keyFilter}
        onClearFilters={clearAllFilters}
        multiSelected={multiSelected}
        onLinkMultiSelect={handleLinkMultiSelect}
        onClearMultiSelect={() => setMultiSelected([])}
      />

      {/* Main content area */}
      <main className="main-area">
        {/* Center tab strip */}
        <div className="dash-tabs">
          <button
            className={`dash-tab${centerTab === 'library' ? ' active' : ''}`}
            onClick={() => setCenterTab('library')}
          >Library</button>
          <button
            className={`dash-tab${centerTab === 'playlists' ? ' active' : ''}`}
            onClick={() => setCenterTab('playlists')}
          >Playlists</button>
        </div>

        {centerTab === 'library' && (
          !loading && songs.length === 0 && !importDefaultDismissed ? (
            <DefaultImportPrompt
              onYes={handleImportDefault}
              onNo={() => setImportDefaultDismissed(true)}
              importing={importingDefault}
            />
          ) : (
            <SongGrid
              songs={songs}
              nowPlaying={nowPlaying}
              selectedSong={selectedSong}
              fadedIds={keyFilteredResult}
              sortBy={sortBy}
              shuffleOrder={shuffleOrder}
              playHistory={playHistory}
              onSortChange={handleSortChange}
              onReshuffle={handleReshuffle}
              onSelectSong={selectSong}
              onPlaySong={playSong}
              multiSelected={new Set(multiSelected.map(s => s.song_id))}
              onClearMultiSelect={() => setMultiSelected([])}
              onAddToQueue={addToQueue}
              onDeselect={clearSelectedSong}
              loading={loading}
              error={loadError}
              keyFilter={keyFilter}
              onKeyFilterToggle={k => setKeyFilter(prev => prev === k ? null : k)}
              onKeyFilterClear={() => setKeyFilter(null)}
              onCursorChange={(song, isKb) => { setCursorSong(song); setCursorIsKeyboard(!!isKb); }}
              tileZoom={tileZoom}
              onZoomChange={handleZoomChange}
              onSearchOpen={() => setSearchOpen(true)}
              onImportOpen={() => setImportOpen(true)}
            />
          )
        )}

        {centerTab === 'playlists' && (
          <PlaylistsPanel
            playlists={playlists}
            loading={playlistsLoading}
            openPlaylist={openPlaylist}
            openPlaylistLoading={openPlaylistLoading}
            onOpenPlaylist={handleOpenPlaylist}
            onClosePlaylist={handleClosePlaylist}
            onPlaylistRename={handlePlaylistRename}
            onPlaylistDelete={handlePlaylistDelete}
            onPlaylistToggleFavorite={handlePlaylistToggleFavorite}
            onPlaylistPlayAll={handlePlaylistPlayAll}
            onSongClick={(song, isMulti) => {
              const libSong = songs.find(s => s.song_id === song.song_id) || song;
              selectSong(libSong, isMulti);
            }}
            onSongDblClick={song => {
              const libSong = songs.find(s => s.song_id === song.song_id) || song;
              playSong(libSong);
            }}
            multiSelected={new Set(multiSelected.map(s => s.song_id))}
          />
        )}
      </main>

      {/* Dialog */}
      <Dialog dlg={dlg} onClose={closeDialog} />

      {/* New Set name dialog */}
      {newSetNameOpen && (
        <NameInputDialog
          defaultValue={sessionDateTitle()}
          onConfirm={confirmNewSetName}
          onCancel={() => setNewSetNameOpen(false)}
        />
      )}

      {/* Import dialog */}
      {importOpen && (
        <ImportDialog
          onClose={() => setImportOpen(false)}
          onComplete={() => {
            setImportOpen(false);
            setLoadTrigger(t => t + 1);
            notify('Library refreshed');
          }}
        />
      )}

      {/* Notification toast */}
      {notifMsg && <div className="notif">{notifMsg}</div>}
    </>
  );
}
