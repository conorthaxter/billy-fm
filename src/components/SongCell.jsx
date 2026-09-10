import { keyColor, darken } from '../utils/keyColors';
import { useSettings } from '../contexts/SettingsContext';
import { chordChartUrl } from '../utils/chordChart';

export default function SongCell({ song, isNowPlaying, isSelected, isFaded, isMatch, isCursor, isMultiSelected, onMouseEnter, onSelect, onDblClick, onAddToQueue, onDragStart, onToggleNeedsWork }) {
  const { palette } = useSettings();
  const [bg, fg] = keyColor(song.key, palette);
  const needsWork = !!song.needs_work;

  const classes = [
    'sc',
    isNowPlaying    ? 'now-playing-cell' : '',
    isSelected      ? 'selected-cell'    : '',
    isFaded         ? 'faded'            : '',
    isMatch         ? 'is-match'         : '',
    isCursor        ? 'cursor-cell'      : '',
    isMultiSelected ? 'multi-cell'       : '',
    needsWork       ? 'needs-work'       : '',
  ].filter(Boolean).join(' ');

  const cursorStyle = isCursor
    ? { boxShadow: `0 0 0 2px #fff, 0 0 12px 4px ${bg}, 0 0 4px 1px ${bg}`, transform: 'scale(1.03)', zIndex: 2 }
    : {};

  const ariaLabel = `${song.title} by ${song.artist}${needsWork ? ', needs work' : ''}`;

  return (
    <div
      className={classes}
      style={{ background: bg, color: fg, position: 'relative', '--fold-color': darken(bg), ...cursorStyle }}
      draggable
      aria-label={ariaLabel}
      onDragStart={onDragStart}
      onMouseEnter={onMouseEnter}
      onClick={onSelect}
      onDoubleClick={e => { e.preventDefault(); onDblClick(); }}
    >
      {isMultiSelected && (
        <span style={{ position: 'absolute', top: 3, right: 3, fontSize: 9, background: 'rgba(0,0,0,0.55)', color: '#fff', borderRadius: '50%', width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3, pointerEvents: 'none' }}>✓</span>
      )}
      {needsWork && (
        <span
          className="sc-fold"
          aria-hidden="true"
          title={song.work_note || undefined}
          onClick={e => { e.stopPropagation(); onToggleNeedsWork?.(); }}
        />
      )}
      <div>
        <div className="sc-title">{song.title}</div>
        <div className="sc-artist">{song.artist}</div>
      </div>
      <div className="sc-foot">
        <span className="sc-key-lbl">{song.key || '?'}</span>
        {song.bpm ? <span className="sc-bpm">{song.bpm}</span> : null}
      </div>
      {needsWork && (
        <a
          className="sc-chords-link"
          href={chordChartUrl(song)}
          target="_blank"
          rel="noopener"
          onClick={e => e.stopPropagation()}
        >chords ↗</a>
      )}
      <button
        className="sc-qbtn"
        title="Add to queue"
        onClick={e => { e.stopPropagation(); onAddToQueue(); }}
      >+</button>
    </div>
  );
}
