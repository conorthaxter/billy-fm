import { useRef, useEffect, useState } from 'react';
import { keyColor } from '../utils/keyColors';
import { useSettings } from '../contexts/SettingsContext';

export default function SearchBar({ isOpen, songs, filterPanelOpen, onSearch, onClose, onSelectSong, onPlaySong, onAddToQueue, searchQuery }) {
  const inputRef    = useRef(null);
  const barRef      = useRef(null);
  const sugRef      = useRef(null);
  const { palette } = useSettings();
  const [activeIdx, setActiveIdx] = useState(-1);

  useEffect(() => {
    if (isOpen) { inputRef.current?.focus(); setActiveIdx(-1); }
  }, [isOpen]);

  // Click-outside closes search
  useEffect(() => {
    if (!isOpen) return;
    function onMouseDown(e) {
      const inBar = barRef.current?.contains(e.target);
      const inSug = sugRef.current?.contains(e.target);
      if (!inBar && !inSug) onClose();
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [isOpen, onClose]);

  // Reset active index when query changes
  useEffect(() => { setActiveIdx(-1); }, [searchQuery]);

  const leftOffset = filterPanelOpen ? 180 : 0;

  if (!isOpen) return null;

  const q = searchQuery.toLowerCase();
  const suggestions = q
    ? songs.filter(s => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q)).slice(0, 8)
    : [];

  function handleKeyDown(e) {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'Backspace' && searchQuery === '') { onClose(); return; }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, suggestions.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, -1));
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation(); // prevent global Enter→play handler from firing
      const target = activeIdx >= 0 ? suggestions[activeIdx] : suggestions[0];
      if (!target) return;
      onSelectSong?.(target);
      onClose();
    }
  }

  return (
    <>
      <div ref={barRef} className="search-bar on" style={{ left: leftOffset, right: 'var(--rp)' }}>
        <span style={{ fontSize: 11, fontWeight: 'bold' }}>SEARCH:</span>
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder="song, artist, genre, tag… · ↑↓ navigate · Enter select"
          autoComplete="off"
          value={searchQuery}
          onChange={e => onSearch(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button className="nb" onClick={onClose}>✕</button>
      </div>

      {suggestions.length > 0 && (
        <div ref={sugRef} className="search-sug on" style={{ left: leftOffset, right: 'var(--rp)' }}>
          {suggestions.map((s, idx) => {
            const [bg] = keyColor(s.key, palette);
            return (
              <div
                key={s.song_id}
                className={`si${idx === activeIdx ? ' si-active' : ''}`}
                onMouseEnter={() => setActiveIdx(idx)}
                onClick={() => { onSelectSong(s); onClose(); }}
                onDoubleClick={e => { e.preventDefault(); onPlaySong?.(s); onClose(); }}
              >
                <span className="si-dot" style={{ background: bg }} />
                <div className="si-info">
                  <div className="si-title">{s.title}</div>
                  <div className="si-sub">{s.artist}</div>
                </div>
                <button
                  className="si-qbtn"
                  onClick={e => { e.stopPropagation(); onAddToQueue(s); onClose(); }}
                >+ QUEUE</button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
