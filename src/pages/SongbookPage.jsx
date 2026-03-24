import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

// ─── Song row ─────────────────────────────────────────────────────────────────

function SongRow({ song }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      padding: '10px 20px', borderBottom: '1px solid #efefef',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#111', lineHeight: 1.3 }}>
          {song.title}
        </div>
        <div style={{ fontSize: 12, color: '#777', marginTop: 2 }}>
          {song.artist}
        </div>
        {song.tags?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
            {song.tags.map(t => (
              <span key={t} style={{
                fontSize: 9, padding: '2px 6px', textTransform: 'uppercase',
                letterSpacing: 0.4, background: '#f3f3f3', color: '#888',
                border: '1px solid #e5e5e5',
              }}>{t}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SongbookPage() {
  const { userId }        = useParams();
  const [searchParams]    = useSearchParams();

  const [artist,   setArtist]   = useState(null);
  const [songs,    setSongs]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [search,   setSearch]   = useState('');

  // Pre-fill tag filter from ?tags= URL param
  const [tagFilter, setTagFilter] = useState(() => searchParams.get('tags') ?? '');

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/api/songbook/${userId}`)
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
        setError(err.message || 'Failed to load songbook');
        setLoading(false);
      });
  }, [userId]);

  const allTags = useMemo(
    () => [...new Set(songs.flatMap(s => s.tags ?? []))].sort(),
    [songs],
  );

  const filtered = useMemo(() => {
    let list = songs;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q),
      );
    }
    if (tagFilter) {
      list = list.filter(s => s.tags?.includes(tagFilter));
    }
    return list;
  }, [songs, search, tagFilter]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100dvh', background: '#fff', fontFamily: 'monospace', color: '#111' }}>

      {/* Header */}
      <header style={{
        borderBottom: '2px solid #000',
        padding: '16px 20px',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12,
        flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: '#999', marginBottom: 4 }}>
            billy fm
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}>
            {artist ? artist.display_name : 'Songbook'}
          </div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
            {loading ? '' : `${songs.length} song${songs.length !== 1 ? 's' : ''}`}
          </div>
        </div>
      </header>

      {/* Filters */}
      <div style={{
        padding: '12px 20px', borderBottom: '1px solid #e5e5e5',
        display: 'flex', flexDirection: 'column', gap: 10,
        position: 'sticky', top: 0, background: '#fff', zIndex: 10,
      }}>
        <input
          type="text"
          placeholder="Search songs…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '9px 12px', fontSize: 13,
            border: '1px solid #ddd', outline: 'none',
            fontFamily: 'inherit', color: '#111', background: '#fafafa',
          }}
        />
        {allTags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            <button
              onClick={() => setTagFilter('')}
              style={{
                fontSize: 9, padding: '3px 9px', fontFamily: 'inherit',
                textTransform: 'uppercase', letterSpacing: 0.4, cursor: 'pointer',
                border: '1px solid #ddd',
                background: !tagFilter ? '#111' : '#fff',
                color: !tagFilter ? '#fff' : '#888',
              }}
            >All</button>
            {allTags.map(t => (
              <button
                key={t}
                onClick={() => setTagFilter(prev => prev === t ? '' : t)}
                style={{
                  fontSize: 9, padding: '3px 9px', fontFamily: 'inherit',
                  textTransform: 'uppercase', letterSpacing: 0.4, cursor: 'pointer',
                  border: '1px solid #ddd',
                  background: tagFilter === t ? '#111' : '#fff',
                  color: tagFilter === t ? '#fff' : '#888',
                }}
              >{t}</button>
            ))}
          </div>
        )}
      </div>

      {/* Song list */}
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        {loading && (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: '#aaa' }}>
            Loading…
          </div>
        )}
        {!loading && error && (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: '#c53030' }}>
            {error}
          </div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: '#aaa' }}>
            {songs.length === 0 ? 'No songs in this songbook yet.' : 'No results for this filter.'}
          </div>
        )}
        {!loading && !error && filtered.map(song => (
          <SongRow key={song.song_id} song={song} />
        ))}
      </div>

      {/* Footer */}
      {!loading && !error && filtered.length > 0 && (
        <div style={{ padding: '20px', textAlign: 'center', fontSize: 10, color: '#ccc', borderTop: '1px solid #f0f0f0', marginTop: 20 }}>
          {filtered.length} song{filtered.length !== 1 ? 's' : ''}
          {(search || tagFilter) && ` · filtered from ${songs.length}`}
        </div>
      )}
    </div>
  );
}
