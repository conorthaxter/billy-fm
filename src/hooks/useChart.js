import { useCallback, useEffect, useState } from 'react';
import { getChart } from '../api/library';

// Shared per-song chart cache. The preview panel and focus mode read the same
// entry, so a save in focus mode refreshes the preview without a refetch.
const cache = new Map();      // songId -> { chord_chart }
const listeners = new Set();

function emit(songId) {
  listeners.forEach(fn => fn(songId));
}

export function setCachedChart(songId, chord_chart) {
  cache.set(songId, { chord_chart });
  emit(songId);
}

export function useChart(songId, enabled = true) {
  const [entry, setEntry]     = useState(() => (songId ? cache.get(songId) ?? null : null));
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (!songId || !enabled) return undefined;
    let cancelled = false;

    const cached = cache.get(songId);
    if (cached) {
      setEntry(cached);
    } else {
      setEntry(null);
      setLoading(true);
      setError('');
      getChart(songId)
        .then(data => {
          if (cancelled) return;
          const next = { chord_chart: data.chord_chart ?? null };
          cache.set(songId, next);
          setEntry(next);
        })
        .catch(err => {
          if (cancelled) return;
          // 404 = song has no row to read a chart from (e.g. a private song)
          if (err.status === 404) setEntry({ chord_chart: null });
          else setError(err.message || 'Failed to load chart');
        })
        .finally(() => { if (!cancelled) setLoading(false); });
    }

    const onChange = id => { if (id === songId && cache.has(songId)) setEntry(cache.get(songId)); };
    listeners.add(onChange);
    return () => { cancelled = true; listeners.delete(onChange); };
  }, [songId, enabled]);

  const chart = entry ? entry.chord_chart : undefined;
  return { chart, loading, error };
}
