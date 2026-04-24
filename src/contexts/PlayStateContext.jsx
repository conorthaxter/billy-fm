/**
 * PlayStateContext — global play state (now playing, queue, history, session).
 * Lives above the router so state persists across tab navigation.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const LS = {
  get: k => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

function sessionDateTitle() {
  return new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export const PlayStateContext = createContext(null);

export function PlayStateProvider({ children }) {
  const [nowPlaying,   setNowPlaying]   = useState(null);
  const [queue,        setQueue]        = useState(() => LS.get('bfm_queue')   || []);
  const [playHistory,  setPlayHistory]  = useState(() => LS.get('bfm_history') || []);
  const [session,      setSession]      = useState(() => {
    const s = LS.get('bfm_session');
    if (!s) return { id: Date.now() + '', title: sessionDateTitle(), startTime: Date.now(), notes: '' };
    // If the saved title is a date string from a previous calendar day, refresh it to today
    const today = sessionDateTitle();
    const savedDate = new Date(s.startTime || 0).toDateString();
    const nowDate   = new Date().toDateString();
    if (savedDate !== nowDate && s.title !== today) {
      return { ...s, title: today };
    }
    return s;
  });

  // Dashboard-provided extras (suggestions, complex handlers)
  const [dashExtras, setDashExtras] = useState({});

  // Persist to localStorage
  useEffect(() => { LS.set('bfm_queue',   queue);       }, [queue]);
  useEffect(() => { LS.set('bfm_history', playHistory); }, [playHistory]);
  useEffect(() => { LS.set('bfm_session', session);     }, [session]);

  const playSong = useCallback((song) => {
    setQueue(q => q.filter(x => x.song_id !== song.song_id));
    setNowPlaying(prev => {
      if (prev && prev.song_id !== song.song_id) {
        const entry = { songId: prev.song_id, title: prev.title, artist: prev.artist, key: prev.key, timestamp: Date.now() };
        setPlayHistory(h => [...h, entry]);
      }
      return song;
    });
  }, []);

  const clearNP = useCallback(() => {
    setNowPlaying(null);
  }, []);

  const addToQueue = useCallback((song, notify) => {
    setQueue(q => {
      if (q.some(x => x.song_id === song.song_id)) { notify?.('Already in queue'); return q; }
      return [...q, song];
    });
    notify?.(`"${song.title}" → queue`);
  }, []);

  const removeFromQueue = useCallback((idx) => {
    setQueue(q => q.filter((_, i) => i !== idx));
  }, []);

  const reorderQueue = useCallback((fromIdx, toIdx) => {
    setQueue(q => {
      const next = [...q];
      next.splice(toIdx, 0, next.splice(fromIdx, 1)[0]);
      return next;
    });
  }, []);

  const dropSongIntoQueue = useCallback((song, atIdx, notify) => {
    setQueue(q => {
      if (q.some(x => x.song_id === song.song_id)) { notify?.('Already in queue'); return q; }
      const next = [...q];
      next.splice(atIdx, 0, song);
      return next;
    });
    notify?.(`"${song.title}" → queue`);
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  const clearHistory = useCallback(() => {
    setPlayHistory([]);
  }, []);

  const removeFromHistory = useCallback((idx) => {
    setPlayHistory(h => h.filter((_, i) => i !== idx));
  }, []);

  const reorderHistory = useCallback((fromIdx, toIdx) => {
    setPlayHistory(h => {
      const next = [...h];
      next.splice(toIdx, 0, next.splice(fromIdx, 1)[0]);
      return next;
    });
  }, []);

  const startNewSession = useCallback((title) => {
    const t = title || sessionDateTitle();
    setSession({ id: Date.now() + '', title: t, startTime: Date.now(), notes: '' });
    setNowPlaying(null);
    setQueue([]);
  }, []);

  const handleDropToNP = useCallback((song, source) => {
    if (source === 'queue') setQueue(q => q.filter(x => x.song_id !== song.song_id));
    playSong(song);
  }, [playSong]);

  const handleDropToPP = useCallback((song, source) => {
    const entry = { songId: song.song_id, title: song.title, artist: song.artist, key: song.key, timestamp: Date.now() };
    setPlayHistory(h => [...h, entry]);
    if (source === 'np') setNowPlaying(null);
    if (source === 'queue') setQueue(q => q.filter(x => x.song_id !== song.song_id));
  }, []);

  const handleDragFromNP = useCallback(() => {
    setNowPlaying(null);
  }, []);

  return (
    <PlayStateContext.Provider value={{
      nowPlaying, setNowPlaying,
      queue, setQueue,
      playHistory, setPlayHistory,
      session, setSession,
      dashExtras, setDashExtras,
      // Actions
      playSong,
      clearNP,
      addToQueue,
      removeFromQueue,
      reorderQueue,
      dropSongIntoQueue,
      clearQueue,
      clearHistory,
      removeFromHistory,
      reorderHistory,
      startNewSession,
      handleDropToNP,
      handleDropToPP,
      handleDragFromNP,
    }}>
      {children}
    </PlayStateContext.Provider>
  );
}

export const usePlayState = () => useContext(PlayStateContext);
