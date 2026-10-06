import { useMemo } from 'react';
import { buildDisplayModel, groupLine } from '../../utils/chordPro';
import './chord-chart.css';

// Shared render core for the preview panel and focus mode: chords over lyrics.
// Read-only unless `editable` is set. Pass either `chart` + `offset` (parsed and
// transposed here) or a ready-made `lines` model (the editor owns its model).
export default function ChordChartView({
  chart,
  offset = 0,
  lines,
  editable = false,
  activeSlot = null,
  onSlotClick,
}) {
  const model = useMemo(() => {
    if (lines) return lines;
    if (!chart) return [];
    try { return buildDisplayModel(chart, offset); }
    catch { return null; }
  }, [lines, chart, offset]);

  if (model === null) return <div className="cc-msg">This chart could not be read.</div>;

  return (
    <div className="cc-chart">
      {model.map(line => {
        if (line.kind === 'blank') return <div key={line.idx} className="cc-blank" />;
        if (line.kind === 'comment') return <div key={line.idx} className="cc-section">{line.text}</div>;
        if (line.kind !== 'lyrics') return null;
        return (
          <Line
            key={line.idx}
            line={line}
            editable={editable}
            activeSlot={activeSlot}
            onSlotClick={onSlotClick}
          />
        );
      })}
    </div>
  );
}

function Line({ line, editable, activeSlot, onSlotClick }) {
  const groups = useMemo(() => {
    const g = groupLine(line);
    // In the editor, make sure the end of the line is a clickable slot.
    if (editable && !g.some(x => x.start === line.lyrics.length)) {
      g.push({ start: line.lyrics.length, text: '', chords: [] });
    }
    return g;
  }, [line, editable]);

  const hasChords = line.chords.length > 0;
  const isActive = pos => activeSlot && activeSlot.idx === line.idx && activeSlot.pos === pos;

  return (
    <div className={`cc-line${hasChords || editable ? ' has-chords' : ''}`}>
      {groups.map(g => {
        const chordEntry = g.chords[0] ?? null;
        const label = g.chords.map(c => c.chord).join(' ');
        return (
          <span key={g.start} className="cc-grp">
            {(hasChords || editable) && (
              <span
                className={`cc-chord${editable ? ' is-editable' : ''}${isActive(g.start) ? ' is-active' : ''}`}
                onClick={editable ? () => onSlotClick?.(line.idx, g.start, chordEntry) : undefined}
              >
                {label || ' '}
              </span>
            )}
            <span className="cc-lyr">
              {editable
                ? g.text.split('').map((ch, i) => (
                    <span
                      key={i}
                      className={`cc-ch${isActive(g.start + i) ? ' is-active' : ''}`}
                      onClick={() => {
                        const pos = g.start + i;
                        onSlotClick?.(line.idx, pos, line.chords.find(c => c.pos === pos) ?? null);
                      }}
                    >{ch}</span>
                  ))
                : g.text || ' '}
              {editable && g.text === '' && (
                <span
                  className={`cc-ch cc-end${isActive(g.start) ? ' is-active' : ''}`}
                  onClick={() => onSlotClick?.(line.idx, g.start, chordEntry)}
                >{' '}</span>
              )}
            </span>
          </span>
        );
      })}
    </div>
  );
}
