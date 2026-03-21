import { useRef, useState } from 'react';
import { keyColor } from '../utils/keyColors';
import { useSettings } from '../contexts/SettingsContext';

// ─── Drag data helpers ─────────────────────────────────────────────────────────

function getSongFromDrag(e) {
  const data = e.dataTransfer.getData('application/x-song');
  if (!data) return null;
  try { return JSON.parse(data); } catch { return null; }
}

function getSource(e) {
  return e.dataTransfer.getData('application/x-source') || 'grid';
}

// ─── Time helpers ──────────────────────────────────────────────────────────────

function timeAgo(ts) {
  const d = Date.now() - ts;
  if (d < 60000)    return 'just now';
  if (d < 3600000)  return Math.floor(d / 60000) + 'm ago';
  if (d < 86400000) return Math.floor(d / 3600000) + 'h ago';
  return Math.floor(d / 86400000) + 'd ago';
}

// ─── Suggestions section ──────────────────────────────────────────────────────

function SuggestionsSection({ suggestions, onAddToQueue, onDismiss }) {
  const { palette } = useSettings();
  if (!suggestions.length) return null;
  return (
    <div className="suggest-sec">
      <div className="suggest-hdr">Suggested next</div>
      {suggestions.map(t => {
        const [bg] = keyColor(t.to_key, palette);
        return (
          <div key={t.id} className="suggest-item">
            <span className="qi-dot" style={{ background: bg, flexShrink: 0 }} />
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div className="qi-title">{t.to_title}</div>
              {t.notes && <div className="qi-sub">{t.notes}</div>}
            </div>
            <button className="suggest-add" onClick={() => onAddToQueue(t)} title="Add to queue">+</button>
            <button className="suggest-dismiss" onClick={() => onDismiss(t.id)} title="Dismiss">✕</button>
          </div>
        );
      })}
    </div>
  );
}

// ─── Previously Played section ────────────────────────────────────────────────

function PPSection({ history, collapsed, onToggle, onClear, onRemove, onSelect, onPlay, songs, onDropToPP, onReorderHistory }) {
  const { palette } = useSettings();
  const [dropOver, setDropOver] = useState(false);
  const dragPPIdx = useRef(null);

  function handleDragOver(e) {
    const hasSong = e.dataTransfer.types.includes('application/x-song') ||
                    e.dataTransfer.types.includes('application/x-pp-idx');
    if (!hasSong) return;
    e.preventDefault();
    setDropOver(true);
  }

  function handleDrop(e, toIdx) {
    e.preventDefault();
    setDropOver(false);
    // Internal PP reorder
    const ppIdx = e.dataTransfer.getData('application/x-pp-idx');
    if (ppIdx !== '') {
      const fromIdx = parseInt(ppIdx, 10);
      if (!isNaN(fromIdx) && fromIdx !== toIdx) {
        onReorderHistory?.(fromIdx, toIdx ?? history.length);
      }
      return;
    }
    // External drop
    const song = getSongFromDrag(e);
    const source = getSource(e);
    if (song) onDropToPP?.(song, source);
  }

  return (
    <div
      className={`pp-sec${collapsed ? ' collapsed' : ''}${dropOver ? ' drop-target' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={() => setDropOver(false)}
      onDrop={e => handleDrop(e, history.length)}
    >
      <div className="pp-hdr" onClick={onToggle}>
        <span>PREVIOUSLY PLAYED</span>
        <span style={{ fontWeight: 'normal', color: '#888', fontSize: 10 }}>({history.length})</span>
        <span style={{ fontSize: 10, transition: 'transform .15s', transform: collapsed ? 'rotate(-90deg)' : 'none', marginLeft: 'auto' }}>▼</span>
        <button
          style={{ fontFamily: 'var(--mono)', fontSize: 9, border: '1px solid #000', background: '#fff', padding: '1px 5px', cursor: 'pointer', marginLeft: 4 }}
          onClick={e => { e.stopPropagation(); onClear(); }}
        >CLEAR</button>
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {history.map((ev, origIdx) => {
          const [bg] = keyColor(ev.key, palette);
          const song = songs.find(x => x.song_id === ev.songId);
          return (
            <div
              key={origIdx}
              className="pp-item"
              draggable={!!song}
              onDragStart={e => {
                if (!song) return;
                dragPPIdx.current = origIdx;
                e.dataTransfer.setData('application/x-song', JSON.stringify(song));
                e.dataTransfer.setData('application/x-source', 'pp');
                e.dataTransfer.setData('application/x-pp-idx', String(origIdx));
                e.dataTransfer.effectAllowed = 'move';
                e.currentTarget.classList.add('dragging');
              }}
              onDragEnd={e => { e.currentTarget.classList.remove('dragging'); }}
              onDragOver={e => { e.stopPropagation(); e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
              onDragLeave={e => e.currentTarget.classList.remove('drag-over')}
              onDrop={e => { e.stopPropagation(); e.currentTarget.classList.remove('drag-over'); handleDrop(e, origIdx); }}
              onClick={() => { if (song) onSelect(song); }}
              onDoubleClick={e => { e.preventDefault(); if (song) onPlay(song); }}
            >
              <span style={{ fontSize: 9, color: '#bbb', minWidth: 16, flexShrink: 0 }}>{origIdx + 1}</span>
              <span className="pp-dot" style={{ background: bg }} />
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div className="pp-title">{ev.title}</div>
                <div className="pp-meta">{ev.artist} · {timeAgo(ev.timestamp)}</div>
              </div>
              <span className="pp-rm" onClick={e => { e.stopPropagation(); onRemove(origIdx); }}>✕</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Now Playing section ───────────────────────────────────────────────────────

function NPSection({ nowPlaying, onClear, onClearData, onDropToNP, onDragFromNP, onSelectNP }) {
  const { palette } = useSettings();
  const [dropOver, setDropOver] = useState(false);

  function handleDragOver(e) {
    if (!e.dataTransfer.types.includes('application/x-song')) return;
    e.preventDefault();
    setDropOver(true);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDropOver(false);
    const song = getSongFromDrag(e);
    const source = getSource(e);
    if (song) onDropToNP?.(song, source);
  }

  if (!nowPlaying) {
    return (
      <div
        className={`np-sec${dropOver ? ' drop-target' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={() => setDropOver(false)}
        onDrop={handleDrop}
      >
        <div className="np-lbl">NOW PLAYING</div>
        <div className="np-content">
          <div style={{ color: '#bbb', fontSize: 11 }}>— nothing playing —</div>
        </div>
      </div>
    );
  }

  const [bg, fg] = keyColor(nowPlaying.key, palette);
  const isUrl = u => /^https?:\/\//i.test(u || '');
  const isSearchUrl = u => (u || '').includes('google.com/search');
  const chordSrc = isUrl(nowPlaying.chords_url) ? nowPlaying.chords_url : '';
  const chordsLabel = chordSrc
    ? (isSearchUrl(chordSrc) ? 'Find chords on UG ↗' : 'CHORDS ↗')
    : null;

  return (
    <div
      className={`np-sec${dropOver ? ' drop-target' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={() => setDropOver(false)}
      onDrop={handleDrop}
    >
      <div
        className="np-lbl"
        style={{ cursor: onSelectNP ? 'pointer' : 'default' }}
        onClick={onSelectNP ? () => onSelectNP(nowPlaying) : undefined}
        title={onSelectNP ? 'Click to highlight in songbook' : undefined}
      >
        NOW PLAYING {onSelectNP && <span style={{ fontSize: 9, color: '#aaa' }}>↗</span>}
      </div>
      <div
        className="np-content"
        draggable
        onDragStart={e => {
          e.dataTransfer.setData('application/x-song', JSON.stringify(nowPlaying));
          e.dataTransfer.setData('application/x-source', 'np');
          e.dataTransfer.effectAllowed = 'move';
        }}
        onDragEnd={e => {
          if (e.dataTransfer.dropEffect !== 'none') {
            onDragFromNP?.();
          }
        }}
        style={{ cursor: 'grab' }}
      >
        <div className="np-title">{nowPlaying.title}</div>
        <div className="np-artist">{nowPlaying.artist}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', marginBottom: 5 }}>
          <span className="np-badge" style={{ background: bg, color: fg }}>
            {nowPlaying.key || '?'}
          </span>
          {nowPlaying.bpm && <span style={{ fontSize: 11 }}> {nowPlaying.bpm} BPM</span>}
          {nowPlaying.era && <span style={{ fontSize: 11, color: '#888' }}> {nowPlaying.era}</span>}
          {(nowPlaying.genre || []).map(g => (
            <span key={g} className="np-tag">{g}</span>
          ))}
          {(nowPlaying.tags || []).map(t => (
            <span key={t} className="np-tag">{t}</span>
          ))}
        </div>

        {chordsLabel && (
          <button
            className="np-btn"
            style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 5 }}
            onClick={() => window.open(chordSrc, '_blank', 'noopener')}
          >
            {chordsLabel}
          </button>
        )}

        {nowPlaying.notes && (
          <div style={{ fontSize: 10, color: '#666', lineHeight: 1.5, marginBottom: 5, maxHeight: 48, overflowY: 'auto' }}>
            {nowPlaying.notes}
          </div>
        )}

        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <button className="np-btn" onClick={onClear}>CLEAR</button>
        </div>
      </div>
    </div>
  );
}

// ─── Session section ───────────────────────────────────────────────────────────

function SessionSection({ session, playHistory, onNew, onSave, onClear }) {
  const playedCount = session
    ? [...new Set(playHistory.filter(e => e.timestamp >= session.startTime).map(e => e.songId))].length
    : 0;

  return (
    <div className="session-sec">
      <div className="session-title">
        <span style={{ fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '.5px' }}>Current Set:</span>
        <span className="session-name">{session ? session.title : '—'}</span>
        {session && <span className="session-count">({playedCount} played)</span>}
      </div>
      <div className="session-actions">
        <button className="sess-btn primary" onClick={onNew}>NEW SET</button>
        <button className="sess-btn" onClick={onSave}>SAVE SET AS PLAYLIST</button>
        <button className="sess-btn" onClick={onClear}>CLEAR SET</button>
      </div>
    </div>
  );
}

// ─── Queue section ─────────────────────────────────────────────────────────────

function QueueSection({ queue, onPlay, onRemove, onClear, onReorder, onDropSong }) {
  const { palette } = useSettings();
  const dragIdx = useRef(null);

  function handleDragStart(e, idx) {
    dragIdx.current = idx;
    e.dataTransfer.setData('application/x-queue-idx', String(idx));
    e.dataTransfer.setData('application/x-song', JSON.stringify(queue[idx]));
    e.dataTransfer.setData('application/x-source', 'queue');
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add('dragging');
  }
  function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  }
  function handleDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
    document.querySelectorAll('.qi, .queue-list').forEach(x => x.classList.remove('drag-over'));
  }
  function handleDrop(e, toIdx) {
    e.preventDefault();
    document.querySelectorAll('.qi, .queue-list').forEach(x => x.classList.remove('drag-over'));
    const queueIdx = e.dataTransfer.getData('application/x-queue-idx');
    const songData = e.dataTransfer.getData('application/x-song');
    const source = e.dataTransfer.getData('application/x-source');

    // Internal queue reorder
    if (queueIdx !== '' && source === 'queue') {
      const fromIdx = parseInt(queueIdx, 10);
      if (!isNaN(fromIdx) && fromIdx !== toIdx) onReorder(fromIdx, toIdx);
      dragIdx.current = null;
      return;
    }
    // External drop from grid, NP, or PP
    if (songData) {
      try { onDropSong?.(JSON.parse(songData), toIdx); } catch { /* ignore */ }
    }
  }

  return (
    <div className="queue-sec">
      <div className="queue-hdr">
        QUEUE<span style={{ fontWeight: 'normal', color: '#888', fontSize: 10, marginLeft: 5 }}>({queue.length})</span>
      </div>
      <div
        className="queue-list"
        onDragOver={handleDragOver}
        onDrop={e => handleDrop(e, queue.length)}
      >
        {queue.map((song, idx) => {
          const [bg] = keyColor(song.key, palette);
          return (
            <div
              key={song.song_id + idx}
              className="qi"
              draggable
              onClick={() => onPlay(song)}
              onDragStart={e => handleDragStart(e, idx)}
              onDragOver={e => { e.stopPropagation(); handleDragOver(e); }}
              onDragEnd={handleDragEnd}
              onDrop={e => { e.stopPropagation(); handleDrop(e, idx); }}
            >
              <span className="qi-num">{idx + 1}</span>
              <span className="qi-dot" style={{ background: bg }} />
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div className="qi-title">{song.title}</div>
                <div className="qi-sub">
                  {song.artist}{song.key ? ' · ' + song.key : ''}{song.bpm ? ' · ' + song.bpm : ''}
                </div>
              </div>
              <span className="qi-rm" onClick={e => { e.stopPropagation(); onRemove(idx); }}>✕</span>
            </div>
          );
        })}
      </div>
      <div className="queue-footer">
        <button onClick={onClear}>CLEAR QUEUE</button>
      </div>
    </div>
  );
}

// ─── Main RightPanel ───────────────────────────────────────────────────────────

export default function RightPanel({
  songs,
  nowPlaying,
  playHistory,
  session,
  queue,
  suggestions,
  ppCollapsed,
  onTogglePP,
  onClearHistory,
  onRemoveHistory,
  onSelectSong,
  onPlaySong,
  onClearNP,
  onClearNPData,
  onNewSession,
  onSaveSession,
  onClearSession,
  onRemoveFromQueue,
  onClearQueue,
  onReorderQueue,
  onDropSong,
  onAddSuggestionToQueue,
  onDismissSuggestion,
  onDropToNP,
  onDropToPP,
  onDragFromNP,
  onReorderHistory,
  onSelectNP,
}) {
  return (
    <div className="right-panel">
      <PPSection
        history={playHistory}
        collapsed={ppCollapsed}
        onToggle={onTogglePP}
        onClear={onClearHistory}
        onRemove={onRemoveHistory}
        onSelect={onSelectSong}
        onPlay={onPlaySong}
        songs={songs}
        onDropToPP={onDropToPP}
        onReorderHistory={onReorderHistory}
      />
      <NPSection
        nowPlaying={nowPlaying}
        onClear={onClearNP}
        onClearData={onClearNPData}
        onDropToNP={onDropToNP}
        onDragFromNP={onDragFromNP}
        onSelectNP={onSelectNP}
      />
      <SessionSection
        session={session}
        playHistory={playHistory}
        onNew={onNewSession}
        onSave={onSaveSession}
        onClear={onClearSession}
      />
      <QueueSection
        queue={queue}
        onPlay={onPlaySong}
        onRemove={onRemoveFromQueue}
        onClear={onClearQueue}
        onReorder={onReorderQueue}
        onDropSong={onDropSong}
      />
      <SuggestionsSection
        suggestions={suggestions || []}
        onAddToQueue={onAddSuggestionToQueue}
        onDismiss={onDismissSuggestion}
      />
    </div>
  );
}
