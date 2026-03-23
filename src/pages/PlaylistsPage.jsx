import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { listPlaylists, deletePlaylist, updatePlaylist } from '../api/playlists';

function PlaylistCard({ playlist, onDelete, onToggleFavorite, onRename }) {
  const navigate = useNavigate();
  const date = playlist.updated_at
    ? new Date(playlist.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(playlist.title);

  function commitRename() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== playlist.title) onRename(playlist.id, trimmed);
    setRenaming(false);
  }

  return (
    <div className="pl-card" onClick={() => !renaming && navigate(`/playlists/${playlist.id}`)}>
      {/* Top row: type badge + delete */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div className="pl-card-type">{playlist.playlist_type || 'set'}</div>
        <button
          className="pl-card-del"
          title="Delete playlist"
          onClick={e => { e.stopPropagation(); onDelete(playlist.id); }}
        >✕</button>
      </div>

      {/* Title — click pencil to rename */}
      {renaming ? (
        <input
          className="pl-card-rename-input"
          value={draft}
          autoFocus
          onChange={e => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(false); }}
          onClick={e => e.stopPropagation()}
          style={{ width: '100%', fontFamily: 'var(--font)', fontSize: 12, border: '1px solid #000', padding: '2px 4px', background: '#fff', outline: 'none', marginBottom: 4 }}
        />
      ) : (
        <div className="pl-card-title" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ flex: 1 }}>{playlist.title}</span>
          <button
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 10, color: '#aaa', flexShrink: 0 }}
            title="Rename"
            onClick={e => { e.stopPropagation(); setDraft(playlist.title); setRenaming(true); }}
          >✎</button>
        </div>
      )}

      {/* Bottom row: star (left) + meta (right) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
        <button
          className={`pl-card-fav${playlist.is_favorited ? ' on' : ''}`}
          title={playlist.is_favorited ? 'Unfavorite' : 'Favorite'}
          onClick={e => { e.stopPropagation(); onToggleFavorite(playlist.id, !playlist.is_favorited); }}
        >★</button>
        <div className="pl-card-meta" style={{ textAlign: 'right' }}>
          <span>{playlist.song_count ?? 0} song{playlist.song_count !== 1 ? 's' : ''}</span>
          {date && <span>{date}</span>}
          {playlist.is_public ? <span className="pl-card-pub">public</span> : null}
        </div>
      </div>
    </div>
  );
}

export default function PlaylistsPage() {
  const [playlists, setPlaylists] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');

  useEffect(() => {
    listPlaylists()
      .then(data => { setPlaylists(data); setLoading(false); })
      .catch(err  => { setError(err.message || 'Failed to load playlists'); setLoading(false); });
  }, []);

  async function handleDelete(id) {
    if (!confirm('Delete this playlist?')) return;
    try {
      await deletePlaylist(id);
      setPlaylists(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      alert(err.message || 'Failed to delete');
    }
  }

  async function handleToggleFavorite(id, is_favorited) {
    try {
      await updatePlaylist(id, { is_favorited });
      setPlaylists(prev => {
        const updated = prev.map(p => p.id === id ? { ...p, is_favorited } : p);
        return [...updated].sort((a, b) => (b.is_favorited ? 1 : 0) - (a.is_favorited ? 1 : 0));
      });
    } catch { /* silent */ }
  }

  async function handleRename(id, title) {
    try {
      await updatePlaylist(id, { title });
      setPlaylists(prev => prev.map(p => p.id === id ? { ...p, title } : p));
    } catch { /* silent */ }
  }

  return (
    <>
      <AppHeader />

      <div className="pl-page">
        <div className="pl-page-hd">
          <div className="pl-page-title">Playlists</div>
          <div className="pl-page-sub">Sets are saved here when you click "Save Set as Playlist"</div>
        </div>

        {loading && <div className="empty-state">Loading…</div>}
        {error && <div className="error-banner">{error}</div>}

        {!loading && !error && playlists.length === 0 && (
          <p className="empty-state">No playlists yet. Save a set from the dashboard to get started.</p>
        )}

        {!loading && playlists.length > 0 && (
          <div className="pl-grid">
            {playlists.map(pl => (
              <PlaylistCard key={pl.id} playlist={pl} onDelete={handleDelete} onToggleFavorite={handleToggleFavorite} onRename={handleRename} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
