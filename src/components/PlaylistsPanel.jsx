import { useEffect, useRef, useState } from 'react';
import { keyColor } from '../utils/keyColors';
import { useSettings } from '../contexts/SettingsContext';

function TypeBadge({ type }) {
  return (
    <span style={{ fontSize: 8, background: '#000', color: '#fff', padding: '1px 5px', textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0 }}>
      {type || 'set'}
    </span>
  );
}

function PlaylistCard({ pl, onOpen, onDelete, onToggleFavorite }) {
  const date = pl.updated_at
    ? new Date(pl.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <div
      style={{ border: '1px solid #e0e0e0', padding: '10px 12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6, background: '#fff', transition: 'border-color 0.1s' }}
      onClick={() => onOpen(pl.id)}
      onMouseEnter={e => e.currentTarget.style.borderColor = '#000'}
      onMouseLeave={e => e.currentTarget.style.borderColor = '#e0e0e0'}
    >
      {/* Top row: type + delete */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <TypeBadge type={pl.playlist_type} />
        <button
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#bbb', padding: 0, lineHeight: 1 }}
          title="Delete"
          onClick={e => { e.stopPropagation(); onDelete(pl.id); }}
        >✕</button>
      </div>
      {/* Title */}
      <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>{pl.title}</div>
      {/* Bottom row: star + meta */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
        <button
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 16, color: pl.is_favorited ? '#f0b429' : '#ddd', lineHeight: 1 }}
          title={pl.is_favorited ? 'Unfavorite' : 'Favorite'}
          onClick={e => { e.stopPropagation(); onToggleFavorite(pl.id, !pl.is_favorited); }}
        >★</button>
        <span style={{ fontSize: 10, color: '#888' }}>
          {pl.song_count ?? 0} song{pl.song_count !== 1 ? 's' : ''}
          {date ? ` · ${date}` : ''}
        </span>
      </div>
    </div>
  );
}

// Inline song search for a playlist. Matches the top search bar: title/artist
// substring, first 8 results, arrow keys + Enter, hover highlight.
function AddSongSearch({ songs, onAdd, onClose }) {
  const { palette } = useSettings();
  const wrapRef = useRef(null);
  const [query,        setQuery]        = useState('');
  const [kbIdx,        setKbIdx]        = useState(-1);
  const [hoverIdx,     setHoverIdx]     = useState(-1);
  const [keyboardMode, setKeyboardMode] = useState(false);
  const activeIdx = keyboardMode ? kbIdx : hoverIdx;

  const q = query.toLowerCase();
  const suggestions = q
    ? songs.filter(s => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q)).slice(0, 8)
    : [];

  useEffect(() => { setKbIdx(-1); setHoverIdx(-1); setKeyboardMode(false); }, [query]);

  useEffect(() => {
    function onMouseDown(e) { if (!wrapRef.current?.contains(e.target)) onClose(); }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [onClose]);

  function pick(song) { onAdd(song); onClose(); }

  function onKeyDown(e) {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
    if (e.key === 'Backspace' && query === '') { onClose(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault(); setKeyboardMode(true);
      setKbIdx(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); setKeyboardMode(true);
      setKbIdx(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault(); e.stopPropagation();
      const target = activeIdx >= 0 ? suggestions[activeIdx] : suggestions[0];
      if (target) pick(target);
    }
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="text"
          className="search-input"
          placeholder="song or artist… · ↑↓ navigate · Enter add"
          autoComplete="off"
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button className="nb" onClick={onClose}>✕</button>
      </div>
      {suggestions.length > 0 && (
        <div
          className="search-sug on"
          style={{ position: 'absolute', top: '100%', left: 0, right: 0 }}
          onMouseMove={() => setKeyboardMode(false)}
        >
          {suggestions.map((s, idx) => {
            const [bg] = keyColor(s.key, palette);
            return (
              <div
                key={s.song_id}
                className={`si${idx === activeIdx ? ' si-active' : ''}`}
                onMouseEnter={() => setHoverIdx(idx)}
                onClick={() => pick(s)}
              >
                <span className="si-dot" style={{ background: bg }} />
                <div className="si-info">
                  <div className="si-title">{s.title}</div>
                  <div className="si-sub">{s.artist}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PlaylistDetail({
  playlist,
  loading,
  onClose,
  onRename,
  onDelete,
  onToggleFavorite,
  onRemoveSong,
  onAddSong,
  librarySongs,
  onPlayAll,
  onSongClick,
  onSongDblClick,
  multiSelected = new Set(),
}) {
  const { palette } = useSettings();
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft,   setTitleDraft]   = useState('');
  const [adding,        setAdding]        = useState(false);

  useEffect(() => {
    setTitleEditing(false);
    setAdding(false);
  }, [playlist?.id]); // eslint-disable-line

  function commitTitle() {
    const t = titleDraft.trim();
    if (t && t !== playlist.title) onRename?.(playlist.id, t);
    setTitleEditing(false);
  }

  const songs = playlist.songs || [];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button
          style={{ fontFamily: 'var(--font)', fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', border: '1px solid #000', background: '#fff', cursor: 'pointer', padding: '3px 10px' }}
          onClick={onClose}
        >← playlists</button>
        <div style={{ flex: 1 }} />
        <TypeBadge type={playlist.playlist_type} />
        <button
          style={{ fontFamily: 'var(--font)', fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', border: '1px solid #c00', color: '#c00', background: '#fff', cursor: 'pointer', padding: '3px 10px' }}
          onClick={() => onDelete?.(playlist.id)}
        >delete</button>
      </div>

      {/* Editable title */}
      {titleEditing ? (
        <input
          style={{ width: '100%', fontFamily: 'var(--font)', fontSize: 20, fontWeight: 700, border: 'none', borderBottom: '2px solid #000', padding: '2px 0', background: 'transparent', outline: 'none', marginBottom: 8 }}
          value={titleDraft}
          autoFocus
          onChange={e => setTitleDraft(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={e => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') setTitleEditing(false); }}
        />
      ) : (
        <div
          style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.3, marginBottom: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
          title="Click to rename"
          onClick={() => { setTitleDraft(playlist.title); setTitleEditing(true); }}
        >
          <span>{playlist.title}</span>
          <span style={{ fontSize: 12, color: '#bbb', fontWeight: 400 }}>✎</span>
        </div>
      )}

      {/* Meta + favorite */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 12, color: '#666' }}>
          {songs.length} song{songs.length !== 1 ? 's' : ''}
        </span>
        <button
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 18, color: playlist.is_favorited ? '#f0b429' : '#ccc', lineHeight: 1 }}
          title={playlist.is_favorited ? 'Unfavorite' : 'Favorite'}
          onClick={() => onToggleFavorite?.(playlist.id, !playlist.is_favorited)}
        >★</button>
        {songs.length > 0 && (
          <button
            style={{ fontFamily: 'var(--font)', fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', border: '1px solid #000', background: '#000', color: '#fff', cursor: 'pointer', padding: '3px 12px', marginLeft: 'auto' }}
            onClick={() => onPlayAll?.(songs)}
          >▶ play all</button>
        )}
      </div>

      {adding ? (
        <AddSongSearch
          songs={librarySongs || []}
          onAdd={song => onAddSong?.(playlist.id, song)}
          onClose={() => setAdding(false)}
        />
      ) : (
        <button
          style={{ fontFamily: 'var(--font)', fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', border: '1px solid #000', background: '#fff', cursor: 'pointer', padding: '3px 10px', marginBottom: 16 }}
          onClick={() => setAdding(true)}
        >+ add song</button>
      )}

      {/* Song list */}
      {loading && (
        <div style={{ color: '#888', fontSize: 12 }}>Loading…</div>
      )}
      {!loading && songs.length === 0 && (
        <div style={{ color: '#aaa', fontSize: 12, fontStyle: 'italic' }}>No songs in this playlist yet.</div>
      )}
      {!loading && songs.length > 0 && (
        <div style={{ borderTop: '1px solid #e8e8e8' }}>
          {songs.map((song, i) => {
            const [bg, fg] = song.key ? keyColor(song.key, palette) : ['#e0e0e0', '#000'];
            const isMultiSel = multiSelected.has(song.song_id);
            const s = { song_id: song.song_id, title: song.title, artist: song.artist, key: song.key, bpm: song.bpm };
            return (
              <div
                key={song.song_id}
                draggable
                onDragStart={e => {
                  e.dataTransfer.setData('application/x-song', JSON.stringify(s));
                  e.dataTransfer.setData('application/x-source', 'playlist');
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', borderBottom: '1px solid #f0f0f0', cursor: 'grab', background: isMultiSel ? '#f0f4ff' : '', position: 'relative' }}
                onClick={e => onSongClick?.(s, e.shiftKey || e.ctrlKey || e.metaKey)}
                onDoubleClick={e => { e.preventDefault(); onSongDblClick?.(s); }}
                onMouseEnter={e => { if (!isMultiSel) e.currentTarget.style.background = '#fafafa'; }}
                onMouseLeave={e => { if (!isMultiSel) e.currentTarget.style.background = ''; }}
              >
                <span style={{ fontSize: 10, color: '#bbb', width: 20, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.title}</div>
                  <div style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.artist}</div>
                </div>
                {isMultiSel && (
                  <span style={{ fontSize: 9, background: 'rgba(0,0,0,0.5)', color: '#fff', borderRadius: '50%', width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✓</span>
                )}
                {song.key && (
                  <span style={{ background: bg, color: fg, fontSize: 9, padding: '2px 6px', flexShrink: 0, fontWeight: 700 }}>{song.key}</span>
                )}
                {song.bpm && (
                  <span style={{ fontSize: 10, color: '#aaa', flexShrink: 0, width: 36, textAlign: 'right' }}>{song.bpm}</span>
                )}
                <button
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 16, color: '#c00', lineHeight: 1, flexShrink: 0 }}
                  title="Remove from playlist"
                  onClick={e => { e.stopPropagation(); onRemoveSong?.(playlist.id, song); }}
                >×</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function PlaylistsPanel({
  playlists = [],
  loading = false,
  openPlaylist = null,
  openPlaylistLoading = false,
  onOpenPlaylist,
  onClosePlaylist,
  onPlaylistRename,
  onPlaylistDelete,
  onPlaylistToggleFavorite,
  onPlaylistPlayAll,
  onPlaylistRemoveSong,
  onPlaylistAddSong,
  librarySongs = [],
  onSongClick,
  onSongDblClick,
  multiSelected = new Set(),
}) {
  return (
    <div className="dash-playlists">
      {openPlaylist ? (
        <PlaylistDetail
          playlist={openPlaylist}
          loading={openPlaylistLoading}
          onClose={onClosePlaylist}
          onRename={onPlaylistRename}
          onDelete={onPlaylistDelete}
          onToggleFavorite={onPlaylistToggleFavorite}
          onRemoveSong={onPlaylistRemoveSong}
          onAddSong={onPlaylistAddSong}
          librarySongs={librarySongs}
          onPlayAll={onPlaylistPlayAll}
          onSongClick={onSongClick}
          onSongDblClick={onSongDblClick}
          multiSelected={multiSelected}
        />
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
              {loading ? 'Loading…' : `${playlists.length} playlist${playlists.length !== 1 ? 's' : ''}`}
            </span>
          </div>
          {!loading && playlists.length === 0 && (
            <div style={{ color: '#aaa', fontSize: 13, fontStyle: 'italic' }}>
              No playlists yet. Save a set from the right panel to get started.
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {playlists.map(pl => (
              <PlaylistCard
                key={pl.id}
                pl={pl}
                onOpen={onOpenPlaylist}
                onDelete={onPlaylistDelete}
                onToggleFavorite={onPlaylistToggleFavorite}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
