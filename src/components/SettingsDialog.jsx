import { useSettings } from '../contexts/SettingsContext';
import { keyColor, MAJOR_KEYS_PREVIEW } from '../utils/keyColors';

const SORT_OPTIONS = [
  { value: 'random',         label: 'Random (default)' },
  { value: 'title',          label: 'Alphabetical' },
  { value: 'artist',         label: 'Artist A–Z' },
  { value: 'key',            label: 'Key' },
  { value: 'bpm',            label: 'BPM' },
  { value: 'era',            label: 'Era' },
  { value: 'most-played',    label: 'Most Played' },
  { value: 'least-played',   label: 'Least Played' },
];

const PALETTE_META = [
  { id: 'festival', label: 'Festival', desc: 'vibrant · outdoor stage' },
  { id: 'session',  label: 'Session',  desc: 'pastel · studio monitor' },
  { id: 'jazzbar',  label: 'Jazz Bar', desc: 'deep · blue velvet' },
  { id: 'cafe',     label: 'Café',     desc: 'muted · earth tones' },
  { id: 'dive',     label: 'Dive',     desc: 'neon · grimy punk' },
];

const BG_OPTIONS = [
  { id: 'white',  label: 'White',  swatch: '#ffffff', border: '#ddd' },
  { id: 'cream',  label: 'Cream',  swatch: '#f5f3ef', border: '#ccc' },
  { id: 'dark',   label: 'Dark',   swatch: '#111111', border: '#555' },
  { id: 'black',  label: 'Black',  swatch: '#000000', border: '#555' },
];

function PaletteSquares({ paletteId }) {
  return (
    <div className="sett-squares">
      {MAJOR_KEYS_PREVIEW.map(k => {
        const [bg] = keyColor(k, paletteId);
        return <div key={k} className="sett-sq" style={{ background: bg }} title={k} />;
      })}
    </div>
  );
}

export default function SettingsDialog({ onClose }) {
  const { palette, setPalette, bg, setBg, defaultSort, setDefaultSort, defaultPublic, setDefaultPublic } = useSettings();

  return (
    <div className="dlg-overlay on">
      <div className="dlg" style={{ maxWidth: 420, width: '100%' }}>
        <div className="dlg-title">Settings</div>

        {/* Song color scheme */}
        <div className="sett-sec">
          <div className="sett-sec-hd">Song Color Scheme</div>
          <div className="sett-palette-grid">
            {PALETTE_META.map(p => (
              <button
                key={p.id}
                className={`sett-palette-btn${palette === p.id ? ' selected' : ''}`}
                onClick={() => setPalette(p.id)}
                title={p.label}
              >
                <PaletteSquares paletteId={p.id} />
                <span className="sett-palette-name">{p.label}</span>
                <span className="sett-palette-desc">{p.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Background color scheme */}
        <div className="sett-sec">
          <div className="sett-sec-hd">Background Color Scheme</div>
          <div className="sett-bg-row">
            {BG_OPTIONS.map(opt => (
              <button
                key={opt.id}
                className={`sett-bg-btn${bg === opt.id ? ' selected' : ''}`}
                onClick={() => setBg(opt.id)}
                title={opt.label}
              >
                <div className="sett-bg-swatch" style={{ background: opt.swatch, borderColor: opt.border }} />
                <span className="sett-bg-label">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Default sort */}
        <div className="sett-sec">
          <div className="sett-sec-hd">Default Sort on Load</div>
          <select
            value={defaultSort}
            onChange={e => setDefaultSort(e.target.value)}
            className="sett-select"
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Song visibility default */}
        <div className="sett-sec">
          <div className="sett-sec-hd">Song Visibility Default</div>
          <label className="sett-toggle-row">
            <div className={`sett-toggle${defaultPublic ? ' on' : ''}`} onClick={() => setDefaultPublic(!defaultPublic)}>
              <div className="sett-toggle-knob" />
            </div>
            <span className="sett-toggle-lbl">
              {defaultPublic ? 'New songs are public by default' : 'New songs are private by default'}
            </span>
          </label>
        </div>

        <div className="dlg-btns">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
