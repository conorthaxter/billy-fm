import { keyColor } from '../utils/keyColors';
import { useSettings } from '../contexts/SettingsContext';

export default function SongCell({ song, isNowPlaying, isSelected, isFaded, isMatch, isCursor, isMultiSelected, onMouseEnter, onSelect, onDblClick, onAddToQueue }) {
  const { palette } = useSettings();
  const [bg, fg] = keyColor(song.key, palette);

  const classes = [
    'sc',
    isNowPlaying    ? 'now-playing-cell' : '',
    isSelected      ? 'selected-cell'    : '',
    isFaded         ? 'faded'            : '',
    isMatch         ? 'is-match'         : '',
    isCursor        ? 'cursor-cell'      : '',
    isMultiSelected ? 'multi-cell'       : '',
  ].filter(Boolean).join(' ');

  const cursorStyle = isCursor
    ? { boxShadow: `0 0 0 2px #fff, 0 0 12px 4px ${bg}, 0 0 4px 1px ${bg}`, transform: 'scale(1.03)', zIndex: 2 }
    : {};

  return (
    <div
      className={classes}
      style={{ background: bg, color: fg, position: 'relative', ...cursorStyle }}
      draggable
      onDragStart={e => {
        e.dataTransfer.setData('application/x-song', JSON.stringify(song));
        e.dataTransfer.effectAllowed = 'copy';
      }}
      onMouseEnter={onMouseEnter}
      onClick={onSelect}
      onDoubleClick={e => { e.preventDefault(); onDblClick(); }}
    >
      {isMultiSelected && (
        <span style={{ position: 'absolute', top: 3, right: 3, fontSize: 9, background: 'rgba(0,0,0,0.55)', color: '#fff', borderRadius: '50%', width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3, pointerEvents: 'none' }}>✓</span>
      )}
      <div>
        <div className="sc-title">{song.title}</div>
        <div className="sc-artist">{song.artist}</div>
      </div>
      <div className="sc-foot">
        <span className="sc-key-lbl">{song.key || '?'}</span>
        {song.bpm ? <span className="sc-bpm">{song.bpm}</span> : null}
      </div>
      <button
        className="sc-qbtn"
        title="Add to queue"
        onClick={e => { e.stopPropagation(); onAddToQueue(); }}
      >+</button>
    </div>
  );
}
