import { useEffect, useState } from 'react';
import { composeChord, decomposeChord, isValidChord } from '../../utils/chordPro';

// Roots and the modifier palette are only pick-lists; whether a combination is a
// real chord is always decided by the chordsheetjs parser (isValidChord).
const ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const MODIFIER_PALETTE = ['m', 'maj7', '7', 'sus2', 'sus4', 'add9', 'dim', 'aug', '6', '9', '11', '13', 'b5', '#9'];

function startState(chord) {
  const d = chord ? decomposeChord(chord) : null;
  return {
    root: d?.root ?? '',
    mods: d?.mods ? [d.mods] : [],
    bass: d?.bass ?? '',
    free: chord ?? '',
  };
}

// Dropdown/stack controls and the freeform field are two front-ends to one parser:
// both end up as { root, mods[], bass } and a composed chord string.
export default function ChordEditorBar({ slot, onApply, onRemove, onCancel }) {
  const [state, setState] = useState(() => startState(slot.chord));
  const [freeError, setFreeError] = useState(false);

  useEffect(() => {
    setState(startState(slot.chord));
    setFreeError(false);
  }, [slot.idx, slot.pos]); // eslint-disable-line react-hooks/exhaustive-deps

  const composed = state.root ? composeChord({ root: state.root, mods: state.mods.join(''), bass: state.bass }) : '';
  const valid = !!composed && isValidChord(composed);

  function update(next) {
    const merged = { ...state, ...next };
    const str = merged.root ? composeChord({ root: merged.root, mods: merged.mods.join(''), bass: merged.bass }) : '';
    setState({ ...merged, free: str });
    setFreeError(false);
  }

  function onFreeChange(value) {
    const d = decomposeChord(value);
    if (d) {
      setState({ root: d.root, mods: d.mods ? [d.mods] : [], bass: d.bass, free: value });
      setFreeError(false);
    } else {
      setState(s => ({ ...s, free: value }));
      setFreeError(value.trim() !== '');
    }
  }

  const rootOptions = state.root && !ROOTS.includes(state.root) ? [state.root, ...ROOTS] : ROOTS;
  const bassOptions = state.bass && !ROOTS.includes(state.bass) ? [state.bass, ...ROOTS] : ROOTS;

  return (
    <div className="cc-editor">
      <div className="cc-editor-row">
        <label className="cc-field">
          <span>Root</span>
          <select value={state.root} onChange={e => update({ root: e.target.value })}>
            <option value="">—</option>
            {rootOptions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>

        <label className="cc-field">
          <span>Bass</span>
          <select value={state.bass} onChange={e => update({ bass: e.target.value })} disabled={!state.root}>
            <option value="">none</option>
            {bassOptions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>

        <label className="cc-field cc-field-free">
          <span>Type a chord</span>
          <input
            type="text"
            value={state.free}
            onChange={e => onFreeChange(e.target.value)}
            placeholder="Cmaj7, F#m7b5, Bb/D"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>

        <div className="cc-preview-chord" aria-live="polite">
          {freeError ? "didn't recognize that" : (valid ? composed : '')}
        </div>
      </div>

      <div className="cc-editor-row">
        <span className="cc-field-label">Modifiers</span>
        {state.mods.map((m, i) => (
          <button
            key={m + i}
            type="button"
            className="cc-btn cc-mod is-on"
            onClick={() => update({ mods: state.mods.filter((_, k) => k !== i) })}
            title="Remove modifier"
          >{m} ×</button>
        ))}
        {MODIFIER_PALETTE.map(m => {
          const candidate = composeChord({ root: state.root, mods: state.mods.join('') + m, bass: state.bass });
          const ok = !!state.root && isValidChord(candidate);
          return (
            <button
              key={m}
              type="button"
              className="cc-btn cc-mod"
              disabled={!ok}
              onClick={() => update({ mods: [...state.mods, m] })}
            >{m}</button>
          );
        })}
      </div>

      <div className="cc-editor-row">
        <button type="button" className="cc-btn is-primary" disabled={!valid} onClick={() => onApply(composed)}>
          {slot.chord ? 'Update chord' : 'Add chord'}
        </button>
        {slot.chord && <button type="button" className="cc-btn" onClick={onRemove}>Remove chord</button>}
        <button type="button" className="cc-btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
