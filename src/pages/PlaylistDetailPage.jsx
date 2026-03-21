import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { getPlaylist, updatePlaylist, deletePlaylist, setPlaylistSongs } from '../api/playlists';
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

// ─── Song row ─────────────────────────────────────────────────────────────────

function SongRow({ song, index, selected, onSelect, checked, onCheck, dragging, onDragStart, onDragOver, onDrop, onDragEnd, hasTransitionAfter }) {
  const { palette } = useSettings();
  const [bg, fg] = song.key ? keyColor(song.key, palette) : ['#eee', '#000'];

  return (
    <>
      <div
        className={`pl-song-row${selected ? ' selected' : ''}${dragging ? ' dragging' : ''}`}
        draggable
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
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
      </div>
      {hasTransitionAfter && (
        <div className="pl-transition-indicator">→ transition</div>
      )}
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PlaylistDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { palette } = useSettings();
  const ctx = usePlayState();

  const [playlist,     setPlaylist]     = useState(null);
  const [songs,        setSongs]        = useState([]);
  const [transitions,  setTransitions]  = useState({}); // { fromSongId: Set<toSongId> }
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [selectedIdx,  setSelectedIdx]  = useState(null);
  const [selectedIds,  setSelectedIds]  = useState(new Set());
  const [dragIdx,      setDragIdx]      = useState(null);
  const [dragOverIdx,  setDragOverIdx]  = useState(null);
  const [notif,        setNotif]        = useState('');
  const notifTimer = useRef(null);

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
      // Refresh transitions display
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

  // Load transitions for each song in the playlist
  useEffect(() => {
    if (!songs.length) return;
    const songIds = songs.map(s => s.song_id);
    // Only fetch transitions for songs that have a next song
    const fromIds = songIds.slice(0, -1);
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
    // Load all songs into queue
    for (const s of songs) {
      // Build a song object compatible with play state
      const song = {
        song_id: s.song_id,
        title:   s.title,
        artist:  s.artist,
        key:     s.key,
        bpm:     s.bpm,
      };
      ctx.addToQueue(song);
    }
    notify(`${songs.length} songs added to queue`);
  }

  // ── Drag to reorder ────────────────────────────────────────────────────────

  function handleDragStart(idx) {
    setDragIdx(idx);
  }

  function handleDragOver(e, idx) {
    e.preventDefault();
    setDragOverIdx(idx);
  }

  function handleDrop(idx) {
    if (dragIdx === null || dragIdx === idx) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }
    const next = [...songs];
    next.splice(idx, 0, next.splice(dragIdx, 1)[0]);
    setSongs(next);
    setDragIdx(null);
    setDragOverIdx(null);
    // Persist reorder
    const payload = next.map((s, i) => ({ song_id: s.song_id, position: i }));
    setPlaylistSongs(id, payload).catch(() => notify('Failed to save order'));
  }

  function handleDragEnd() {
    setDragIdx(null);
    setDragOverIdx(null);
  }

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
            <div className="pl-song-list">
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
                    dragging={dragIdx === i || dragOverIdx === i}
                    onDragStart={() => handleDragStart(i)}
                    onDragOver={e => handleDragOver(e, i)}
                    onDrop={() => handleDrop(i)}
                    onDragEnd={handleDragEnd}
                    hasTransitionAfter={hasTransitionAfter}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>

      {notif && <div className="notif">{notif}</div>}
    </>
  );
}
