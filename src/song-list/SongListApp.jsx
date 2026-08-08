import { useEffect, useMemo, useState } from 'react';
import { keyColor } from '../utils/keyColors';
import { useSettings } from '../contexts/SettingsContext';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

// Conor's user id — this page is a public, read-only view of his songbook.
const ARTIST_USER_ID = '10ad75af-e184-4935-939c-441fbc07fc58';

// ─── Song tile — visually identical to the main app's SongCell, minus the
// interactive bits (queue button, drag, select) that don't apply here. ─────────

function SongTile({ song, palette }) {
  const [bg, fg] = keyColor(song.key, palette);
  return (
    <div className="sc" style={{ background: bg, color: fg, cursor: 'default' }}>
      <div>
        <div className="sc-title">{song.title}</div>
        <div className="sc-artist">{song.artist}</div>
      </div>
      <div className="sc-foot">
        <span className="sc-key-lbl">{song.key || '?'}</span>
        {song.bpm ? <span className="sc-bpm">{song.bpm}</span> : null}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SongListApp() {
  const { palette } = useSettings();

  const [artist,  setArtist]  = useState(null);
  const [songs,   setSongs]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [search,  setSearch]  = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/api/songbook/${ARTIST_USER_ID}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(body => {
        setArtist(body.artist ?? null);
        setSongs(Array.isArray(body.songs) ? body.songs : []);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Failed to load song list');
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    if (!search) return songs;
    const q = search.toLowerCase();
    return songs.filter(s =>
      s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q),
    );
  }, [songs, search]);

  return (
    <>
      {/* Header — matches main app nav bar */}
      <nav className="nav">
        <div className="nav-brand-cell">
          <span className="nav-title">
            <span className="nav-title-desktop">billy-fm</span>
            <span className="nav-title-mobile">bfm</span>
          </span>
        </div>
        <div className="nav-center" />
        <div className="nav-right">
          {!loading && !error && (
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: '#888' }}>
              {songs.length} song{songs.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </nav>

      {/* Content — same fixed-below-nav layout as main app, full width (no side panels) */}
      <div style={{ position: 'fixed', top: 42, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column' }}>
        <div className="grid-area">
          <div className="controls">
            <span style={{ fontSize: 11, fontWeight: 500 }}>
              {artist?.display_name ?? 'Song List'}
            </span>
            <input
              type="text"
              className="search-input"
              placeholder="search songs, artists…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ maxWidth: 320 }}
            />
          </div>

          {error && <div className="error-banner">{error}</div>}

          {loading && (
            <div className="song-grid">
              {Array.from({ length: 50 }, (_, i) => <div key={i} className="skel" />)}
            </div>
          )}

          {!loading && !error && (
            <div className="song-grid">
              {filtered.map(song => (
                <SongTile key={song.song_id} song={song} palette={palette} />
              ))}
              {filtered.length === 0 && (
                <p className="empty-state">
                  {songs.length === 0 ? 'No songs yet.' : 'No results.'}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
