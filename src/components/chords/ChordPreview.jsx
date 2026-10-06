import { useEffect, useRef, useState } from 'react';
import ChordChartView from './ChordChartView';
import { useChart } from '../../hooks/useChart';

// Read-only chart at the bottom of the right column. When the space left over is
// below the preview minimum, it shows a "view full chart" affordance instead.
export default function ChordPreview({ song, onOpenFocus }) {
  const { chart, loading } = useChart(song.song_id);
  const ref = useRef(null);
  const [tooShort, setTooShort] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const min = parseFloat(getComputedStyle(el).getPropertyValue('--cc-preview-min')) || 0;
    const ro = new ResizeObserver(([entry]) => setTooShort(entry.contentRect.height < min));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="cc-preview" ref={ref}>
      <div className="cc-preview-hdr">
        <span>CHORDS</span>
        {onOpenFocus && <button type="button" className="cc-btn" onClick={onOpenFocus} title="Open full chart">⤢</button>}
      </div>
      {tooShort ? (
        onOpenFocus && <button type="button" className="cc-btn cc-view-full" onClick={onOpenFocus}>VIEW FULL CHART ▸</button>
      ) : (
        <div className="cc-preview-body">
          {loading && !chart ? <div className="cc-msg">Loading…</div> : chart && <ChordChartView chart={chart} offset={song.transpose_offset || 0} />}
        </div>
      )}
    </div>
  );
}
