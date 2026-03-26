import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import AppHeader from '../components/AppHeader';
import {
  getPlaylist,
  updatePlaylist,
  deletePlaylist,
  setPlaylistSongs,
  addPlaylistSong,
  removePlaylistSong,
} from '../api/playlists';
import { getLibrary } from '../api/library';
import { getTransitions, createTransition } from '../api/transitions';
import { keyColor } from '../utils/keyColors';
import { useSettings } from '../contexts/SettingsContext';
import { usePlayState } from '../contexts/PlayStateContext';

// ─── Inline editable title ────────────────────────────────────────────────────

function InlineTitle({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => { setDraft(value); }, [value]);

  function commit() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="pl-detail-title-input"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
        autoFocus
      />
    );
  }

  return (
    <div
      className="pl-detail-title"
      title="Click to edit"
      onClick={() => setEditing(true)}
    >
      {value}
      <span className="pl-detail-title-edit">✎</span>
    </div>
  );
}

// ─── Song row (drag-and-drop) ──────────────────────────────────────────────────

function SongRow({ song, index, selected, onSelect, checked, onCheck, hasTransitionAfter, onDelete }) {
  const { palette } = useSettings();
  const [bg, fg] = song.key ? keyColor(song.key, palette) : ['#eee', '#000'];

  return (
    <Draggable draggableId={song.song_id} index={index}>
      {(provided, snapshot) => (
        <>
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            className={`pl-song-row${selected ? ' selected' : ''}${snapshot.isDragging ? ' dragging' : ''}`}
            onClick={onSelect}
          >
            <input
              type="checkbox"
              className="pl-song-check"
              checked={checked}
              onChange={onCheck}
              onClick={e => e.stopPropagation()}
            />
            <span className="pl-song-pos">{index + 1}</span>
            <div className="pl-song-info">
              <span className="pl-song-title">{song.title}</span>
              <span className="pl-song-artist">{song.artist}</span>
            </div>
            {song.key && (
              <span className="pl-song-key" style={{ background: bg, color: fg }}>{song.key}</span>
            )}
            {song.bpm && (
              <span className="pl-song-bpm">{song.bpm}</span>
            )}
            <button
              className="nb pl-song-delete"
              title="Remove from playlist"
              onClick={e => { e.stopPropagation(); onDelete(song.song_id); }}
            >
              ×
            </button>
          </div>
          {hasTransitionAfter && (
            <div className="pl-transition-indicator">→ transition</div>
          )}
        </>
      )}
    </Draggable>
  );
}

// ─── Library song row (for Browse Library mode) ───────────────────────────────

function LibrarySongRow({ song, onAdd }) {
  return (
    <div
      className="pl-lib-row"
      onDoubleClick={() => onAdd(song)}
      title="Double-click or press Enter to add"
    >
      <div className="pl-lib-info">
        <span className="pl-lib-title">{song.title}</span>
        <span className="pl-lib-artist">{song.artist}</span>
      </div>
      <button className="nb pl-lib-add" onClick={e => { e.stopPropagation(); onAdd(song); }}>+</button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PlaylistDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  useSettings();
  const ctx = usePlayState();

  const [playlist,     setPlaylist]     = useState(null);
  const [songs,        setSongs]        = useState([]);
  const [transitions,  setTransitions]  = useState({});
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [selectedIdx,  setSelectedIdx]  = useState(null);
  const [selectedIds,  setSelectedIds]  = useState(new Set());
  const [notif,        setNotif]        = useState('');
  const notifTimer = useRef(null);

  // Add Songs state
  const [addMode,      setAddMode]      = useState(null); // null | 'search' | 'browse'
  const [searchQuery,  setSearchQuery]  = useState('');
  const [searchInput,  setSearchInput]  = useState('');
  const [library,      setLibrary]      = useState([]);
  const [libLoading,   setLibLoading]   = useState(false);
  const searchRef = useRef(null);

  function notify(msg) {
    setNotif(msg);
    clearTimeout(notifTimer.current);
    notifTimer.current = setTimeout(() => setNotif(''), 2600);
  }

  function toggleCheck(songId) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(songId) ? next.delete(songId) : next.add(songId);
      return next;
    });
  }

  async function handleLinkTransitions() {
    const ordered = songs.filter(s => selectedIds.has(s.song_id));
    if (ordered.length < 2) return;
    try {
      for (let i = 0; i < ordered.length - 1; i++) {
        await createTransition(ordered[i].song_id, { to_song_id: ordered[i + 1].song_id });
      }
      notify(`Linked ${ordered.length} songs as transitions`);
      setSelectedIds(new Set());
      const fromIds = songs.slice(0, -1).map(s => s.song_id);
      const results = await Promise.all(
        fromIds.map(sid => getTransitions(sid).then(ts => ({ sid, ts })).catch(() => ({ sid, ts: [] })))
      );
      const map = {};
      for (const { sid, ts } of results) {
        map[sid] = new Set(ts.map(t => t.to_song_id));
      }
      setTransitions(map);
    } catch (err) {
      notify(err.message || 'Failed to link transitions');
    }
  }

  // Load playlist + songs
  useEffect(() => {
    setLoading(true);
    getPlaylist(id)
      .then(data => {
        setPlaylist(data);
        setSongs(data.songs ?? []);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Failed to load playlist');
        setLoading(false);
      });
  }, [id]);

  // Load transitions
  useEffect(() => {
    if (!songs.length) return;
    const fromIds = songs.slice(0, -1).map(s => s.song_id);
    if (!fromIds.length) return;

    Promise.all(fromIds.map(sid => getTransitions(sid).then(ts => ({ sid, ts })).catch(() => ({ sid, ts: [] }))))
      .then(results => {
        const map = {};
        for (const { sid, ts } of results) {
          map[sid] = new Set(ts.map(t => t.to_song_id));
        }
        setTransitions(map);
      });
  }, [songs.length, id]); // eslint-disable-line

  // Load library when entering browse mode
  useEffect(() => {
    if (addMode !== 'browse') return;
    setLibLoading(true);
    getLibrary()
      .then(data => { setLibrary(data ?? []); setLibLoading(false); })
      .catch(() => setLibLoading(false));
  }, [addMode]);

  // Focus search input when entering search mode
  useEffect(() => {
    if (addMode === 'search') {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [addMode]);

  // Escape closes add mode
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && addMode) {
        setAddMode(null);
        setSearchInput('');
        setSearchQuery('');
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [addMode]);

  async function handleSaveTitle(title) {
    try {
      await updatePlaylist(id, { title });
      setPlaylist(p => ({ ...p, title }));
    } catch { notify('Failed to save title'); }
  }

  async function handleSaveNotes(notes) {
    try {
      await updatePlaylist(id, { notes });
      setPlaylist(p => ({ ...p, notes }));
    } catch { notify('Failed to save notes'); }
  }

  async function handleTogglePublic() {
    const is_public = !playlist.is_public;
    try {
      await updatePlaylist(id, { is_public });
      setPlaylist(p => ({ ...p, is_public }));
    } catch { notify('Failed to update visibility'); }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${playlist.title}"?`)) return;
    try {
      await deletePlaylist(id);
      navigate('/playlists');
    } catch (err) {
      notify(err.message || 'Failed to delete');
    }
  }

  function handlePlayPlaylist() {
    if (!songs.length) { notify('No songs in this playlist'); return; }
    for (const s of songs) {
      ctx.addToQueue({ song_id: s.song_id, title: s.title, artist: s.artist, key: s.key, bpm: s.bpm });
    }
    notify(`${songs.length} songs added to queue`);
  }

  // ── Delete song from playlist ───────────────────────────────────────────────

  async function handleDeleteSong(songId) {
    try {
      await removePlaylistSong(id, songId);
      setSongs(prev => {
        const next = prev.filter(s => s.song_id !== songId);
        return next;
      });
      notify('Song removed');
    } catch (err) {
      notify(err.message || 'Failed to remove song');
    }
  }

  // ── Drag to reorder (@hello-pangea/dnd) ────────────────────────────────────

  function handleDragEnd(result) {
    if (!result.destination || result.destination.index === result.source.index) return;

    const next = [...songs];
    const [moved] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, moved);
    setSongs(next);

    const payload = next.map((s, i) => ({ song_id: s.song_id, position: i }));
    setPlaylistSongs(id, payload).catch(() => notify('Failed to save order'));
  }

  // ── Add song (both modes) ───────────────────────────────────────────────────

  const inPlaylistIds = new Set(songs.map(s => s.song_id));

  async function handleAddSong(song) {
    if (inPlaylistIds.has(song.song_id || song.id)) {
      notify('Already in playlist');
      return;
    }
    const songId = song.song_id || song.id;
    try {
      await addPlaylistSong(id, songId);
      // Optimistically append with basic info
      setSongs(prev => [
        ...prev,
        {
          song_id:  songId,
          title:    song.title,
          artist:   song.artist,
          key:      song.key ?? song.default_key ?? null,
          bpm:      song.bpm ?? song.default_bpm ?? null,
          position: prev.length,
        },
      ]);
      notify(`"${song.title}" added`);
    } catch (err) {
      notify(err.message || 'Failed to add song');
    }
  }

  // Quick search — filter library client-side against the query
  const searchResults = searchQuery.trim().length > 0
    ? library.filter(s => {
        const q = searchQuery.toLowerCase();
        return (
          s.title?.toLowerCase().includes(q) ||
          s.artist?.toLowerCase().includes(q)
        );
      }).slice(0, 12)
    : [];

  // Browse library — filter out songs already in the playlist
  const browseList = library.filter(s => !inPlaylistIds.has(s.song_id || s.id));
  const browseFiltered = searchInput.trim()
    ? browseList.filter(s => {
        const q = searchInput.toLowerCase();
        return s.title?.toLowerCase().includes(q) || s.artist?.toLowerCase().includes(q);
      })
    : browseList;

  // Load library on first "search" open too (needed for client-side filter)
  useEffect(() => {
    if (addMode === 'search' && library.length === 0) {
      getLibrary().then(data => setLibrary(data ?? [])).catch(() => {});
    }
  }, [addMode]); // eslint-disable-line

  // ── Notes blur save ────────────────────────────────────────────────────────

  const [notesDraft, setNotesDraft] = useState('');
  useEffect(() => { setNotesDraft(playlist?.notes ?? ''); }, [playlist?.notes]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return (
    <>
      <AppHeader />
      <div className="pl-page"><div className="empty-state">Loading…</div></div>
    </>
  );

  if (error) return (
    <>
      <AppHeader />
      <div className="pl-page"><div className="error-banner">{error}</div></div>
    </>
  );

  // ── Browse Library mode — split-pane layout ────────────────────────────────

  if (addMode === 'browse') {
    return (
      <>
        <AppHeader />
        <div className="pl-browse-layout">
          {/* Left: library */}
          <div className="pl-browse-left">
            <div className="pl-browse-hd">
              <span className="pl-browse-hd-title">Library</span>
              <input
                className="pl-browse-search"
                placeholder="Search…"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                autoFocus
              />
              <button className="nb pl-browse-done" onClick={() => { setAddMode(null); setSearchInput(''); }}>
                Done
              </button>
            </div>
            <div className="pl-browse-list">
              {libLoading && <p className="empty-state">Loading library…</p>}
              {!libLoading && browseFiltered.length === 0 && (
                <p className="empty-state">{searchInput ? 'No matches' : 'All songs already in playlist'}</p>
              )}
              {!libLoading && browseFiltered.map(song => (
                <LibrarySongRow key={song.song_id || song.id} song={song} onAdd={handleAddSong} />
              ))}
            </div>
          </div>

          {/* Right: current playlist */}
          <div className="pl-browse-right">
            <div className="pl-browse-hd">
              <span className="pl-browse-hd-title">{playlist.title}</span>
              <span className="pl-browse-count">{songs.length} songs</span>
            </div>
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="playlist-browse">
                {provided => (
                  <div className="pl-song-list" ref={provided.innerRef} {...provided.droppableProps}>
                    {songs.length === 0 && <p className="empty-state" style={{ padding: '1rem' }}>No songs yet</p>}
                    {songs.map((song, i) => (
                      <SongRow
                        key={song.song_id}
                        song={song}
                        index={i}
                        selected={false}
                        onSelect={() => {}}
                        checked={false}
                        onCheck={() => {}}
                        hasTransitionAfter={false}
                        onDelete={handleDeleteSong}
                      />
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </div>
        </div>
        {notif && <div className="notif">{notif}</div>}
      </>
    );
  }

  // ── Normal mode ────────────────────────────────────────────────────────────

  return (
    <>
      <AppHeader />

      <div className="pl-page">
        {/* Header row */}
        <div className="pl-detail-hd">
          <button className="nb pl-detail-back" onClick={() => navigate('/playlists')}>← playlists</button>
          <div className="pl-detail-actions">
            <button
              className={`nb pl-detail-share${playlist.is_public ? ' on' : ''}`}
              onClick={handleTogglePublic}
              title={playlist.is_public ? 'Make private' : 'Make public'}
            >
              {playlist.is_public ? '🔗 public' : '🔒 private'}
            </button>
            <button className="nb pl-detail-play" onClick={handlePlayPlaylist}>▶ play all</button>
            <button className="nb pl-detail-delete" onClick={handleDelete}>delete</button>
          </div>
        </div>

        {/* Title */}
        <InlineTitle value={playlist.title} onSave={handleSaveTitle} />

        {/* Type / meta */}
        <div className="pl-detail-meta">
          <span className="pl-detail-type">{playlist.playlist_type || 'set'}</span>
          <span>{songs.length} song{songs.length !== 1 ? 's' : ''}</span>
          {playlist.updated_at && (
            <span>{new Date(playlist.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          )}
        </div>

        {/* Notes */}
        <textarea
          className="pl-detail-notes"
          placeholder="Add notes about this set…"
          value={notesDraft}
          onChange={e => setNotesDraft(e.target.value)}
          onBlur={() => { if (notesDraft !== (playlist.notes ?? '')) handleSaveNotes(notesDraft); }}
        />

        {/* Add Songs controls */}
        <div className="pl-add-hd">
          {addMode === null && (
            <>
              <button className="nb pl-add-btn" onClick={() => setAddMode('search')}>+ Add Songs</button>
              <button className="nb pl-add-browse-btn" onClick={() => setAddMode('browse')}>Browse Library</button>
            </>
          )}

          {addMode === 'search' && (
            <div className="pl-add-search-wrap">
              <input
                ref={searchRef}
                className="pl-add-search"
                placeholder="Search your library…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                autoFocus
              />
              <button className="nb pl-add-dismiss" onClick={() => { setAddMode(null); setSearchQuery(''); }}>✕</button>
              {searchResults.length > 0 && (
                <div className="pl-add-results">
                  {searchResults.map(song => (
                    <div
                      key={song.song_id || song.id}
                      className="pl-add-result-row"
                      onClick={() => handleAddSong(song)}
                    >
                      <span className="pl-add-result-title">{song.title}</span>
                      <span className="pl-add-result-artist">{song.artist}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Song list */}
        {songs.length === 0 && (
          <p className="empty-state">No songs in this playlist.</p>
        )}

        {songs.length > 0 && (
          <>
            {selectedIds.size >= 2 && (
              <button className="nb pl-link-btn" onClick={handleLinkTransitions}>
                Link Transitions ({selectedIds.size})
              </button>
            )}
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="playlist-songs">
                {provided => (
                  <div className="pl-song-list" ref={provided.innerRef} {...provided.droppableProps}>
                    {songs.map((song, i) => {
                      const nextSong = songs[i + 1];
                      const hasTransitionAfter = nextSong
                        ? (transitions[song.song_id]?.has(nextSong.song_id) ?? false)
                        : false;
                      return (
                        <SongRow
                          key={song.song_id}
                          song={song}
                          index={i}
                          selected={selectedIdx === i}
                          onSelect={() => {
                            ctx.playSong({ song_id: song.song_id, title: song.title, artist: song.artist, key: song.key, bpm: song.bpm });
                            setSelectedIdx(selectedIdx === i ? null : i);
                          }}
                          checked={selectedIds.has(song.song_id)}
                          onCheck={() => toggleCheck(song.song_id)}
                          hasTransitionAfter={hasTransitionAfter}
                          onDelete={handleDeleteSong}
                        />
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </>
        )}
      </div>

      {notif && <div className="notif">{notif}</div>}
    </>
  );
}
