import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

// ─── Song row ─────────────────────────────────────────────────────────────────

function SongRow({ song }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      height: 48,
      borderBottom: '1px solid #1e1e1e',
      gap: 12,
      minWidth: 0,
    }}>
      {/* Title + artist */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13,
          fontWeight: 600,
          color: '#e8e8e8',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          lineHeight: 1.3,
        }}>
          {song.title}
        </div>
        <div style={{
          fontSize: 11,
          color: '#555',
          marginTop: 1,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {song.artist}
        </div>
      </div>

      {/* Tags */}
      {song.tags?.length > 0 && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          justifyContent: 'flex-end',
          flexShrink: 0,
          maxWidth: '45%',
        }}>
          {song.tags.map(t => (
            <span key={t} style={{
              fontSize: 8,
              padding: '2px 5px',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              border: '1px solid #2a2a2a',
              color: '#444',
              lineHeight: 1.4,
              whiteSpace: 'nowrap',
            }}>{t}</span>
          ))}
        </div>
      )}
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

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#0a0a0a',
      fontFamily: 'monospace',
      color: '#e8e8e8',
    }}>

      {/* Header */}
      <header style={{
        borderBottom: '1px solid #1e1e1e',
        padding: '20px 20px 16px',
      }}>
        <div style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: 3,
          textTransform: 'uppercase',
          color: '#333',
          marginBottom: 6,
        }}>
          billy fm
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.1, color: '#e8e8e8' }}>
          {loading ? '' : (artist?.display_name ?? 'Songbook')}
        </div>
        <div style={{ fontSize: 11, color: '#3a3a3a', marginTop: 6 }}>
          {loading ? '' : `${songs.length} song${songs.length !== 1 ? 's' : ''}`}
        </div>
      </header>

      {/* Sticky filters */}
      <div style={{
        position: 'sticky',
        top: 0,
        background: '#0a0a0a',
        borderBottom: '1px solid #1a1a1a',
        padding: '10px 20px',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        <input
          type="text"
          placeholder="Search songs…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '8px 12px',
            fontSize: 12,
            background: '#111',
            border: '1px solid #222',
            color: '#e8e8e8',
            outline: 'none',
            fontFamily: 'monospace',
          }}
        />
        {allTags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <button
              onClick={() => setTagFilter('')}
              style={{
                fontSize: 9, padding: '3px 8px',
                fontFamily: 'monospace',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                cursor: 'pointer',
                border: '1px solid #333',
                background: !tagFilter ? '#e8e8e8' : 'transparent',
                color: !tagFilter ? '#000' : '#444',
              }}
            >All</button>
            {allTags.map(t => (
              <button
                key={t}
                onClick={() => setTagFilter(prev => prev === t ? '' : t)}
                style={{
                  fontSize: 9, padding: '3px 8px',
                  fontFamily: 'monospace',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  cursor: 'pointer',
                  border: '1px solid #333',
                  background: tagFilter === t ? '#e8e8e8' : 'transparent',
                  color: tagFilter === t ? '#000' : '#444',
                }}
              >{t}</button>
            ))}
          </div>
        )}
      </div>

      {/* Song list */}
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        {loading && (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 11, color: '#333' }}>
            Loading…
          </div>
        )}
        {!loading && error && (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 11, color: '#8b3333' }}>
            {error}
          </div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 11, color: '#333' }}>
            {songs.length === 0 ? 'No songs in this songbook yet.' : 'No results for this filter.'}
          </div>
        )}
        {!loading && !error && filtered.map(song => (
          <SongRow key={song.song_id} song={song} />
        ))}
      </div>

      {/* Footer count */}
      {!loading && !error && filtered.length > 0 && (
        <div style={{
          padding: '16px 20px',
          textAlign: 'center',
          fontSize: 9,
          color: '#2a2a2a',
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          borderTop: '1px solid #1a1a1a',
          marginTop: 20,
        }}>
          {filtered.length} song{filtered.length !== 1 ? 's' : ''}
          {(search || tagFilter) && ` · filtered from ${songs.length}`}
        </div>
      )}
    </div>
  );
}
