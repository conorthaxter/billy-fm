import { useCallback, useEffect, useRef, useState } from 'react';
import { listSongs, createSong } from '../api/songs';
import { getLibrary, addToLibrary } from '../api/library';
import { keyColor } from '../utils/keyColors';
import { useSettings } from '../contexts/SettingsContext';
import AppHeader from '../components/AppHeader';

// ─── Constants ────────────────────────────────────────────────────────────────

const GENRES = [
  'Rock','Pop','R&B','Soul','Country','Folk','Jazz',
  'Electronic','Hip-Hop','Metal','Blues','Funk','Disco',
  'Alternative','Indie','Punk','Classical','Reggae',
];

const ERAS = ['50s','60s','70s','80s','90s','2000s','2010s','2020s'];

const MAJOR_KEYS = ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
const MINOR_KEYS = ['Am','Bm','Cm','Dm','Em','Fm','Gm','Abm','Bbm','C#m','Ebm','F#m'];

const LIMIT = 50;

// ─── Debounce hook ────────────────────────────────────────────────────────────

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── Marketplace card ─────────────────────────────────────────────────────────

function MarketplaceCard({ song, inLibrary, adding, onAdd }) {
  const { palette } = useSettings();
  const [bg, fg] = keyColor(song.default_key, palette);
  const isSearchUrl = (u) => (u || '').includes('google.com/search');

  return (
    <div className="mc" style={{ background: bg, color: fg }}>
      {inLibrary && (
        <div className="mc-in-lib">✓ IN LIBRARY</div>
      )}
      <div className="mc-body">
        <div className="mc-title">{song.title}</div>
        <div className="mc-artist">{song.artist}</div>
      </div>
      <div className="mc-foot">
        <div className="mc-meta">
          <span className="mc-key-badge" style={{ background: 'rgba(0,0,0,.18)', color: fg }}>
            {song.default_key || '?'}
          </span>
          {song.default_bpm && (
            <span className="mc-bpm">{song.default_bpm} BPM</span>
          )}
        </div>
        <div className="mc-tags">
          {(song.genre || []).slice(0, 2).map(g => (
            <span key={g} className="mc-tag">{g}</span>
          ))}
        </div>
        <div className="mc-actions">
          <span className="mc-count">
            {song.library_count || 0} performer{song.library_count !== 1 ? 's' : ''}
          </span>
          {inLibrary ? (
            <span className="mc-added">✓ added</span>
          ) : (
            <button
              className="mc-add"
              disabled={adding}
              onClick={onAdd}
            >
              {adding ? '…' : '+ ADD'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Add New Song dialog ──────────────────────────────────────────────────────

function AddSongDialog({ onClose, onAdded }) {
  const [form, setForm]     = useState({ title: '', artist: '', default_key: '', default_bpm: '', chords_url: '' });
  const [genres, setGenres] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  function set(field, val) { setForm(f => ({ ...f, [field]: val })); }

  function toggleGenre(g) {
    setGenres(prev => {
      const next = new Set(prev);
      next.has(g) ? next.delete(g) : next.add(g);
      return next;
    });
  }

  async function handleSubmit() {
    if (!form.title.trim() || !form.artist.trim()) {
      setError('Title and artist are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const body = {
        title:       form.title.trim(),
        artist:      form.artist.trim(),
        default_key: form.default_key || undefined,
        default_bpm: form.default_bpm ? Number(form.default_bpm) : undefined,
        chords_url:  form.chords_url.trim() || undefined,
        genre:       [...genres],
        tags:        [],
      };
      const song = await createSong(body);
      // Auto-add to user's library after creating in global pool
      try { await addToLibrary(song.id); } catch { /* ignore 409 if already there */ }
      onAdded(song);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to add song');
      setSaving(false);
    }
  }

  return (
    <div className="dlg-overlay on">
      <div className="dlg" style={{ maxWidth: 460, width: '100%' }}>
        <div className="dlg-title">Add New Song</div>

        <label className="dlg-lbl">Title *</label>
        <input
          type="text" autoFocus
          value={form.title} onChange={e => set('title', e.target.value)}
          placeholder="Song title"
          style={inputStyle}
        />

        <label className="dlg-lbl">Artist *</label>
        <input
          type="text"
          value={form.artist} onChange={e => set('artist', e.target.value)}
          placeholder="Artist name"
          style={inputStyle}
        />

        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label className="dlg-lbl">Key</label>
            <select
              value={form.default_key}
              onChange={e => set('default_key', e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              <option value="">— any —</option>
              <optgroup label="Major">
                {MAJOR_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
              </optgroup>
              <optgroup label="Minor">
                {MINOR_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
              </optgroup>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label className="dlg-lbl">BPM</label>
            <input
              type="number" min="40" max="300"
              value={form.default_bpm} onChange={e => set('default_bpm', e.target.value)}
              placeholder="e.g. 120"
              style={inputStyle}
            />
          </div>
        </div>

        <label className="dlg-lbl">Chord Chart URL (optional)</label>
        <input
          type="url"
          value={form.chords_url} onChange={e => set('chords_url', e.target.value)}
          placeholder="https://tabs.ultimate-guitar.com/…"
          style={inputStyle}
        />

        <label className="dlg-lbl">Genre</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 10px', marginBottom: 10 }}>
          {GENRES.slice(0, 12).map(g => (
            <label key={g} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, cursor: 'pointer' }}>
              <input type="checkbox" checked={genres.has(g)} onChange={() => toggleGenre(g)} />
              {g}
            </label>
          ))}
        </div>

        {error && <div className="error-banner" style={{ marginBottom: 8 }}>{error}</div>}

        <div className="dlg-btns">
          <button onClick={onClose} disabled={saving}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : 'ADD SONG'}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  fontFamily: 'var(--font)', fontSize: 12,
  border: '1px solid #000', width: '100%',
  padding: '4px 8px', outline: 'none',
  marginBottom: 8, display: 'block', background: '#fff',
};

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ search, onSearch, selectedGenres, onToggleGenre, selectedEras, onToggleEra, selectedKey, onKeyChange, onReset, total }) {
  const hasFilters = search || selectedGenres.size || selectedEras.size || selectedKey;

  return (
    <aside className="mp-sidebar">
      {/* Search */}
      <div className="mp-sb-sec">
        <div className="fp-hd">Search</div>
        <input
          type="text"
          className="search-input"
          placeholder="title, artist, genre, tag…"
          value={search}
          onChange={e => onSearch(e.target.value)}
          style={{ width: '100%', fontSize: 12, marginTop: 4 }}
        />
        {hasFilters && (
          <button
            className="fp-btn"
            style={{ marginTop: 6, width: '100%' }}
            onClick={onReset}
          >
            CLEAR ALL FILTERS
          </button>
        )}
      </div>

      {/* Genre */}
      <div className="mp-sb-sec">
        <div className="fp-hd">Genre</div>
        {GENRES.map(g => (
          <label key={g} className="fp-row">
            <input
              type="checkbox"
              checked={selectedGenres.has(g)}
              onChange={() => onToggleGenre(g)}
            />
            {g}
          </label>
        ))}
      </div>

      {/* Era */}
      <div className="mp-sb-sec">
        <div className="fp-hd">Era</div>
        {ERAS.map(e => (
          <label key={e} className="fp-row">
            <input
              type="checkbox"
              checked={selectedEras.has(e)}
              onChange={() => onToggleEra(e)}
            />
            {e}
          </label>
        ))}
      </div>

      {/* Key */}
      <div className="mp-sb-sec">
        <div className="fp-hd">Key</div>
        <select
          value={selectedKey}
          onChange={e => onKeyChange(e.target.value)}
          style={{ fontFamily: 'var(--font)', fontSize: 11, border: '1px solid #000', padding: '3px 4px', background: '#fff', width: '100%', cursor: 'pointer' }}
        >
          <option value="">— any key —</option>
          <optgroup label="Major">
            {MAJOR_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
          </optgroup>
          <optgroup label="Minor">
            {MINOR_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
          </optgroup>
        </select>
      </div>
    </aside>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MarketplacePage() {

  // Songs
  const [songs,       setSongs]       = useState([]);
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(1);
  const [loading,     setLoading]     = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,       setError]       = useState('');

  // Filters
  const [searchInput,    setSearchInput]    = useState('');
  const [selectedGenres, setSelectedGenres] = useState(new Set());
  const [selectedEras,   setSelectedEras]   = useState(new Set());
  const [selectedKey,    setSelectedKey]    = useState('');
  const [sort,           setSort]           = useState('title');

  // Library membership
  const [libraryIds, setLibraryIds] = useState(new Set());
  const [adding,     setAdding]     = useState(new Set()); // song ids currently being POSTed

  // Modal
  const [addSongOpen, setAddSongOpen] = useState(false);

  // Endless scroll
  const sentinelRef = useRef(null);
  const mainRef     = useRef(null);

  const debouncedSearch = useDebounce(searchInput, 300);

  // ── Load library IDs on mount ──────────────────────────────────────────────

  useEffect(() => {
    getLibrary()
      .then(data => setLibraryIds(new Set(data.map(s => s.song_id))))
      .catch(() => { /* not fatal */ });
  }, []);

  // ── Build API params ───────────────────────────────────────────────────────

  function buildParams(pg) {
    const p = { limit: LIMIT, page: pg, sort };
    if (debouncedSearch)     p.search = debouncedSearch;
    if (selectedGenres.size) p.genre  = [...selectedGenres].join(',');
    if (selectedEras.size)   p.era    = [...selectedEras].join(',');
    if (selectedKey)         p.key    = selectedKey;
    return p;
  }

  // ── Fetch (replace) ────────────────────────────────────────────────────────

  const fetchRef = useRef(0); // cancel stale requests

  const fetchSongs = useCallback(async () => {
    const token = ++fetchRef.current;
    setLoading(true);
    setError('');
    try {
      const data = await listSongs(buildParams(1));
      if (fetchRef.current !== token) return;
      setSongs(data.songs);
      setTotal(data.total);
      setPage(1);
    } catch (err) {
      if (fetchRef.current !== token) return;
      setError(err.message || 'Failed to load songs');
    } finally {
      if (fetchRef.current === token) setLoading(false);
    }
  }, [debouncedSearch, selectedGenres, selectedEras, selectedKey, sort]); // eslint-disable-line

  useEffect(() => { fetchSongs(); }, [fetchSongs]);

  // ── Load more (append) ────────────────────────────────────────────────────

  async function handleLoadMore() {
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const data = await listSongs(buildParams(nextPage));
      setSongs(prev => [...prev, ...data.songs]);
      setPage(nextPage);
    } catch (err) {
      setError(err.message || 'Failed to load more');
    } finally {
      setLoadingMore(false);
    }
  }

  // ── Add to library ────────────────────────────────────────────────────────

  async function handleAdd(song) {
    setAdding(prev => new Set(prev).add(song.id));
    try {
      await addToLibrary(song.id);
      setLibraryIds(prev => new Set(prev).add(song.id));
      // Bump library_count on the local song object
      setSongs(prev => prev.map(s =>
        s.id === song.id ? { ...s, library_count: (s.library_count || 0) + 1 } : s
      ));
    } catch (err) {
      if (err.status === 409) {
        // Already in library — just mark it
        setLibraryIds(prev => new Set(prev).add(song.id));
      }
      // Other errors: silently ignore for now
    } finally {
      setAdding(prev => { const n = new Set(prev); n.delete(song.id); return n; });
    }
  }

  // ── Filter toggles ────────────────────────────────────────────────────────

  function toggleGenre(g) {
    setSelectedGenres(prev => { const n = new Set(prev); n.has(g) ? n.delete(g) : n.add(g); return n; });
  }
  function toggleEra(e) {
    setSelectedEras(prev => { const n = new Set(prev); n.has(e) ? n.delete(e) : n.add(e); return n; });
  }
  function resetFilters() {
    setSearchInput('');
    setSelectedGenres(new Set());
    setSelectedEras(new Set());
    setSelectedKey('');
    setSort('title');
  }

  // ── IntersectionObserver for endless scroll ───────────────────────────────

  useEffect(() => {
    const el  = sentinelRef.current;
    const root = mainRef.current;
    if (!el || !root) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !loadingMore && !loading && hasMore) {
        handleLoadMore();
      }
    }, { root, rootMargin: '200px' });
    obs.observe(el);
    return () => obs.disconnect();
  }); // no deps — re-attaches on every render so closure is always fresh

  // ── After adding a new song ───────────────────────────────────────────────

  function handleSongAdded(newSong) {
    // Add to library IDs and prepend to list (it'll sort correctly on next fetch)
    setLibraryIds(prev => new Set(prev).add(newSong.id));
    fetchSongs(); // refresh to get accurate library_count + sort position
  }

  const hasMore = songs.length < total;

  return (
    <>
      <AppHeader />

      {/* Left sidebar */}
      <Sidebar
        search={searchInput}
        onSearch={setSearchInput}
        selectedGenres={selectedGenres}
        onToggleGenre={toggleGenre}
        selectedEras={selectedEras}
        onToggleEra={toggleEra}
        selectedKey={selectedKey}
        onKeyChange={setSelectedKey}
        onReset={resetFilters}
        total={total}
      />

      {/* Main content */}
      <main ref={mainRef} className="mp-main">
        {/* Toolbar */}
        <div className="mp-toolbar">
          <span className="mp-count">
            {loading ? 'Loading…' : `${total.toLocaleString()} song${total !== 1 ? 's' : ''}`}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11 }}>Sort:</span>
            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              style={{ fontFamily: 'var(--font)', fontSize: 11, border: '1px solid #000', padding: '3px 6px', background: '#fff', outline: 'none', cursor: 'pointer' }}
            >
              <option value="title">Alphabetical</option>
              <option value="popular">Most Popular</option>
              <option value="newest">Newest</option>
              <option value="key">By Key</option>
              <option value="bpm">By BPM</option>
            </select>
          </div>
          <button className="nb accent" onClick={() => setAddSongOpen(true)}>+ ADD NEW SONG</button>
        </div>

        {/* Error */}
        {error && <div className="error-banner" style={{ margin: '0 10px 8px' }}>{error}</div>}

        {/* Skeleton */}
        {loading && (
          <div className="mp-grid">
            {Array.from({ length: 30 }, (_, i) => (
              <div key={i} className="mc-skel" />
            ))}
          </div>
        )}

        {/* Song grid */}
        {!loading && songs.length === 0 && (
          <p className="empty-state">No songs found. Try adjusting your filters.</p>
        )}
        {!loading && songs.length > 0 && (
          <div className="mp-grid">
            {songs.map(song => (
              <MarketplaceCard
                key={song.id}
                song={song}
                inLibrary={libraryIds.has(song.id)}
                adding={adding.has(song.id)}
                onAdd={() => handleAdd(song)}
              />
            ))}
          </div>
        )}

        {/* Sentinel — always in DOM for IntersectionObserver */}
        <div ref={sentinelRef} style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {loadingMore && <span style={{ fontSize: 11, opacity: 0.5 }}>Loading…</span>}
        </div>
      </main>

      {/* Add Song dialog */}
      {addSongOpen && (
        <AddSongDialog
          onClose={() => setAddSongOpen(false)}
          onAdded={handleSongAdded}
        />
      )}
    </>
  );
}
