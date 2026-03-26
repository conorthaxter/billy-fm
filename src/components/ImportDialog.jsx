import { useRef, useState } from 'react';
import { parseCSV, fetchAndParseCSV } from '../utils/csvParser';
import { importCsv, spotifySearch, spotifyConfirm } from '../api/import';
import { createSong } from '../api/songs';
import { addToLibrary, createPrivateSong } from '../api/library';

const CHUNK = 50;

const MAJOR_KEYS = ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
const MINOR_KEYS = ['Am','Bm','Cm','Dm','Em','Fm','Gm','Abm','Bbm','C#m','Ebm','F#m'];
const GENRES     = ['Rock','Pop','R&B','Soul','Country','Folk','Jazz','Electronic','Hip-Hop','Metal','Blues','Funk','Disco','Alternative','Indie','Punk','Classical','Reggae'];

const FIELD_OPTIONS = [
  { value: 'title',      label: 'Title' },
  { value: 'artist',     label: 'Artist' },
  { value: 'key',        label: 'Key' },
  { value: 'bpm',        label: 'BPM' },
  { value: 'chords_url', label: 'Chords URL' },
  { value: 'notes',      label: 'Notes' },
  { value: 'skip',       label: '— skip —' },
];

// ─── Auto-detect column mapping ───────────────────────────────────────────────

function detectColumns(rows) {
  if (rows.length < 2) return {};
  const headers  = rows[0];
  const dataRows = rows.slice(1, Math.min(rows.length, 11));
  const colCount = headers.length;

  const scores = {};
  for (let c = 0; c < colCount; c++) {
    const hdr = (headers[c] || '').trim().toUpperCase().replace(/\s+/g, ' ');
    const vals = dataRows.map(r => (r[c] || '').trim());
    const nonEmpty = vals.filter(Boolean);

    scores[c] = { title: 0, artist: 0, key: 0, bpm: 0, chords_url: 0, notes: 0 };

    // Header name bonuses
    if (['SONG','TITLE','SONG TITLE','NAME'].includes(hdr)) scores[c].title += 10;
    if (['ARTIST','PERFORMER','BAND','BY'].includes(hdr))   scores[c].artist += 10;
    if (['KEY','MUSICAL KEY'].includes(hdr))                scores[c].key += 10;
    if (['BPM','TEMPO','BEATS PER MINUTE'].includes(hdr))   scores[c].bpm += 10;
    if (['CHORDS','CHORD','CHORD URL','TABS'].includes(hdr)) scores[c].chords_url += 10;
    if (['NOTES','NOTE','COMMENTS','COMMENT'].includes(hdr)) scores[c].notes += 10;

    // Data heuristics
    const isKey = v => /^[A-G][#b]?m?$/.test(v);
    const isBpm = v => { const n = parseFloat(v); return !isNaN(n) && n >= 40 && n <= 300; };
    const isUrl = v => /^https?:\/\//i.test(v);

    const ne = nonEmpty.length || 1;
    const keyHits = nonEmpty.filter(isKey).length / ne;
    const bpmHits = nonEmpty.filter(isBpm).length / ne;
    const urlHits = nonEmpty.filter(isUrl).length / ne;
    const avgLen  = nonEmpty.reduce((s, v) => s + v.length, 0) / ne;
    const uniq    = new Set(nonEmpty).size / ne;

    if (keyHits > 0.5) scores[c].key += 8;
    if (bpmHits > 0.5) scores[c].bpm += 8;
    if (urlHits > 0.5) scores[c].chords_url += 8;
    if (avgLen > 4 && avgLen < 60 && uniq > 0.75) scores[c].title  += 4;
    if (avgLen > 3 && avgLen < 35 && uniq < 0.75) scores[c].artist += 3;
    if (avgLen > 25)                               scores[c].notes  += 3;
  }

  // Greedy assignment — best un-taken field per column
  const assigned = {};
  const used = new Set();
  for (let c = 0; c < colCount; c++) {
    const ranked = Object.entries(scores[c]).sort(([,a],[,b]) => b - a);
    let picked = 'skip';
    for (const [f, s] of ranked) {
      if (s > 0 && !used.has(f)) { picked = f; used.add(f); break; }
    }
    assigned[c] = picked;
  }
  return assigned;
}

// Convert raw CSV rows + a column mapping into song objects
function mapRowsToSongs(rows, mapping) {
  const songs = [];
  for (let i = 1; i < rows.length; i++) {
    const r    = rows[i];
    const song = { title: '', artist: '', key: null, bpm: null, chords_url: null, notes: null };
    for (const [colIdx, field] of Object.entries(mapping)) {
      if (field === 'skip') continue;
      const val = (r[Number(colIdx)] || '').trim() || null;
      if (!val) continue;
      if (field === 'bpm') song.bpm = parseFloat(val) || null;
      else song[field] = val;
    }
    if (!song.title) continue;
    songs.push(song);
  }
  return songs;
}

// ─── Tab: Add One Song ────────────────────────────────────────────────────────

function AddSongTab({ onClose, onComplete }) {
  const [form,      setForm]     = useState({ title: '', artist: '', key: '', bpm: '', chords_url: '', notes: '' });
  const [genres,    setGenres]   = useState(new Set());
  const [isPublic,  setIsPublic] = useState(true);
  const [saving,    setSaving]   = useState(false);
  const [error,     setError]    = useState('');

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));

  function toggleGenre(g) {
    setGenres(prev => { const n = new Set(prev); n.has(g) ? n.delete(g) : n.add(g); return n; });
  }

  async function handleSubmit() {
    if (!form.title.trim() || !form.artist.trim()) {
      setError('Title and artist are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const title  = form.title.trim();
      const artist = form.artist.trim();
      const autoChordUrl = form.chords_url.trim() ||
        `https://www.google.com/search?q=${encodeURIComponent(title)}+${encodeURIComponent(artist)}+chords`;

      if (isPublic) {
        // Public: add to global marketplace + user library
        const body = {
          title,
          artist,
          default_key: form.key    || undefined,
          default_bpm: form.bpm   ? Number(form.bpm) : undefined,
          chords_url:  autoChordUrl,
          genre:       [...genres],
          tags:        [],
        };
        const song = await createSong(body);
        try { await addToLibrary(song.id); } catch { /* 409 if already in lib */ }
      } else {
        // Private: add only to user library (not marketplace)
        await createPrivateSong({
          title,
          artist,
          key:        form.key || undefined,
          bpm:        form.bpm ? Number(form.bpm) : undefined,
          chords_url: autoChordUrl,
          notes:      form.notes.trim() || undefined,
          genre:      [...genres],
          tags:       [],
        });
      }
      onComplete?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to add song');
      setSaving(false);
    }
  }

  const inp = { fontFamily: 'var(--font)', fontSize: 12, border: '1px solid #000', width: '100%', padding: '4px 8px', outline: 'none', marginBottom: 8, display: 'block', background: '#fff' };

  return (
    <>
      <label className="dlg-lbl">Title *</label>
      <input type="text" autoFocus value={form.title} onChange={e => set('title', e.target.value)} placeholder="Song title" style={inp} />

      <label className="dlg-lbl">Artist *</label>
      <input type="text" value={form.artist} onChange={e => set('artist', e.target.value)} placeholder="Artist name" style={inp} />

      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label className="dlg-lbl">Key</label>
          <select value={form.key} onChange={e => set('key', e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
            <option value="">— any —</option>
            <optgroup label="Major">{MAJOR_KEYS.map(k => <option key={k} value={k}>{k}</option>)}</optgroup>
            <optgroup label="Minor">{MINOR_KEYS.map(k => <option key={k} value={k}>{k}</option>)}</optgroup>
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label className="dlg-lbl">BPM</label>
          <input type="number" min="40" max="300" value={form.bpm} onChange={e => set('bpm', e.target.value)} placeholder="120" style={inp} />
        </div>
      </div>

      <label className="dlg-lbl">Chord Chart URL (optional)</label>
      <input type="url" value={form.chords_url} onChange={e => set('chords_url', e.target.value)} placeholder="https://tabs.ultimate-guitar.com/…" style={inp} />

      <label className="dlg-lbl">Notes</label>
      <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any notes about this song…" style={{ ...inp, resize: 'vertical' }} rows={2} />

      <label className="dlg-lbl">Genre</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 10px', marginBottom: 12 }}>
        {GENRES.slice(0, 12).map(g => (
          <label key={g} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, cursor: 'pointer' }}>
            <input type="checkbox" checked={genres.has(g)} onChange={() => toggleGenre(g)} /> {g}
          </label>
        ))}
      </div>

      <label className="dlg-lbl">Visibility</label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, cursor: 'pointer', fontSize: 11 }}>
        <div
          className={`sett-toggle${isPublic ? ' on' : ''}`}
          onClick={() => setIsPublic(p => !p)}
          style={{ flexShrink: 0 }}
        >
          <div className="sett-toggle-knob" />
        </div>
        <span>{isPublic ? '🌐 Public — added to marketplace' : '🔒 Private — your library only'}</span>
      </label>

      {error && <div className="error-banner" style={{ marginBottom: 8 }}>{error}</div>}

      <div className="dlg-btns">
        <button onClick={onClose} disabled={saving}>Cancel</button>
        <button onClick={handleSubmit} disabled={saving}>{saving ? 'Saving…' : 'ADD TO LIBRARY'}</button>
      </div>
    </>
  );
}

// ─── Tab: Import Spreadsheet ──────────────────────────────────────────────────

function ImportTab({ onClose, onComplete }) {
  const [csvUrl,    setCsvUrl]    = useState('');
  const [status,    setStatus]    = useState('idle'); // idle | parsing | preview | importing | done | error
  const [progress,  setProgress]  = useState({ done: 0, total: 0 });
  const [result,    setResult]    = useState(null);
  const [errorMsg,  setErrorMsg]  = useState('');
  const [rawRows,   setRawRows]   = useState([]);
  const [mapping,   setMapping]   = useState({});
  const fileRef = useRef(null);

  const parsedSongs = status === 'preview' ? mapRowsToSongs(rawRows, mapping) : [];

  async function runImport(songs) {
    if (!songs.length) { setErrorMsg('No valid songs found.'); setStatus('error'); return; }
    setStatus('importing');
    setProgress({ done: 0, total: songs.length });
    let imported = 0, skipped = 0;
    try {
      for (let i = 0; i < songs.length; i += CHUNK) {
        const chunk = songs.slice(i, i + CHUNK);
        const res = await importCsv({ songs: chunk });
        imported += res.imported;
        skipped  += res.skipped;
        setProgress({ done: Math.min(i + CHUNK, songs.length), total: songs.length });
      }
      setResult({ imported, skipped });
      setStatus('done');
    } catch (err) {
      setErrorMsg(err.message || 'Import failed');
      setStatus('error');
    }
  }

  function goToPreview(rows) {
    setRawRows(rows);
    setMapping(detectColumns(rows));
    setStatus('preview');
  }

  async function handleUrl() {
    if (!csvUrl.trim()) return;
    setStatus('parsing');
    setErrorMsg('');
    try {
      const sep  = csvUrl.includes('?') ? '&' : '?';
      const resp = await fetch(csvUrl.trim() + sep + '_=' + Date.now());
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();
      goToPreview(parseCSV(text));
    } catch (err) {
      setErrorMsg(err.message || 'Failed to fetch CSV');
      setStatus('error');
    }
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus('parsing');
    setErrorMsg('');
    try {
      const text = await file.text();
      goToPreview(parseCSV(text));
    } catch (err) {
      setErrorMsg(err.message || 'Failed to read file');
      setStatus('error');
    }
  }

  function handleDone() { onComplete?.(); onClose(); }

  const headers = rawRows[0] || [];

  if (status === 'preview') {
    return (
      <>
        <div className="dlg-msg" style={{ marginBottom: 10 }}>
          Found <b>{rawRows.length - 1}</b> songs. Map each column below, then import.
        </div>

        <div style={{ overflowX: 'auto', marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {headers.map((h, c) => (
              <div key={c} style={{ minWidth: 90 }}>
                <div style={{ fontSize: 9, color: '#888', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h || `Col ${c+1}`}</div>
                <select
                  value={mapping[c] ?? 'skip'}
                  onChange={e => setMapping(m => ({ ...m, [c]: e.target.value }))}
                  style={{ fontFamily: 'var(--font)', fontSize: 10, border: '1px solid #ccc', padding: '2px 4px', width: '100%', background: '#fff' }}
                >
                  {FIELD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>

        <div className="dlg-btns">
          <button onClick={() => setStatus('idle')}>← Back</button>
          <button onClick={() => runImport(parsedSongs)} disabled={!parsedSongs.length}>
            IMPORT {parsedSongs.length} SONGS
          </button>
        </div>
      </>
    );
  }

  if (status === 'importing') {
    return (
      <>
        <div className="dlg-msg">
          Importing {Math.min(progress.done, progress.total)} / {progress.total} songs…
        </div>
        <div style={{ margin: '12px 0', background: '#eee', height: 6, position: 'relative' }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, background: '#000',
            width: `${Math.round(progress.done / progress.total * 100)}%`,
            transition: 'width 0.2s',
          }} />
        </div>
      </>
    );
  }

  if (status === 'done' && result) {
    return (
      <>
        <div className="dlg-msg">
          Import complete.<br />
          <b>{result.imported}</b> song{result.imported !== 1 ? 's' : ''} added to your library
          {result.skipped > 0 && <>, <b>{result.skipped}</b> already existed (skipped)</>}.
        </div>
        <div className="dlg-btns">
          <button onClick={handleDone}>DONE</button>
        </div>
      </>
    );
  }

  // Idle / error
  return (
    <>
      <div style={{ fontSize: 11, marginBottom: 10, lineHeight: 1.6 }}>
        <b>Google Sheets:</b> File → Share → Publish to web → select <i>Comma-separated values (.csv)</i> → Publish. Paste the published URL below.<br />
        Or upload any CSV file directly.
      </div>

      <label className="dlg-lbl">Published CSV URL</label>
      <input
        type="text"
        value={csvUrl}
        onChange={e => setCsvUrl(e.target.value)}
        placeholder="https://docs.google.com/spreadsheets/d/e/…/pub?output=csv"
        style={{ fontFamily: 'var(--font)', fontSize: 12, border: '1px solid #000', width: '100%', padding: '4px 8px', outline: 'none', marginBottom: 8, display: 'block', background: '#fff' }}
        onKeyDown={e => { if (e.key === 'Enter') handleUrl(); }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <button className="fp-btn primary" onClick={handleUrl} disabled={status === 'parsing'}>
          {status === 'parsing' ? 'LOADING…' : 'LOAD FROM URL'}
        </button>
        <span style={{ fontSize: 10, color: '#999' }}>or</span>
        <button className="fp-btn" onClick={() => fileRef.current?.click()}>UPLOAD FILE</button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={handleFile} />
      </div>

      {(status === 'error') && errorMsg && (
        <div className="error-banner" style={{ marginBottom: 8 }}>{errorMsg}</div>
      )}

      <div className="dlg-btns">
        <button onClick={onClose}>Cancel</button>
      </div>
    </>
  );
}

// ─── Tab: Spotify Search ──────────────────────────────────────────────────────

function SpotifyTab({ onClose, onComplete }) {
  const [query,    setQuery]    = useState('');
  const [results,  setResults]  = useState([]);
  const [selected, setSelected] = useState(new Set()); // spotify_ids
  const [status,   setStatus]   = useState('idle'); // idle | searching | importing | done | error
  const [errorMsg, setErrorMsg] = useState('');
  const [imported, setImported] = useState(0);

  async function handleSearch() {
    if (!query.trim()) return;
    setStatus('searching');
    setErrorMsg('');
    setSelected(new Set());
    try {
      const data = await spotifySearch(query.trim());
      setResults(data.results ?? []);
      setStatus('idle');
    } catch (err) {
      setErrorMsg(err.message || 'Search failed');
      setStatus('error');
    }
  }

  function toggleSelect(id) {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  async function handleImport() {
    const tracks = results.filter(r => selected.has(r.spotify_id));
    if (!tracks.length) return;
    setStatus('importing');
    setErrorMsg('');
    try {
      const res = await spotifyConfirm(tracks);
      setImported(res.imported ?? tracks.length);
      setStatus('done');
    } catch (err) {
      setErrorMsg(err.message || 'Import failed');
      setStatus('error');
    }
  }

  if (status === 'done') {
    return (
      <>
        <div className="dlg-msg">
          Added <b>{imported}</b> song{imported !== 1 ? 's' : ''} to your library (public by default).
        </div>
        <div className="dlg-btns">
          <button onClick={() => { onComplete?.(); onClose(); }}>DONE</button>
        </div>
      </>
    );
  }

  const inp = { fontFamily: 'var(--font)', fontSize: 12, border: '1px solid #000', padding: '4px 8px', outline: 'none', background: '#fff' };

  return (
    <>
      <div className="dlg-msg" style={{ marginBottom: 8 }}>
        Search Spotify for a song. Selected songs are added to your library and the public songbook.
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <input
          type="text"
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
          placeholder="Song title or artist…"
          style={{ ...inp, flex: 1 }}
        />
        <button
          className="fp-btn primary"
          onClick={handleSearch}
          disabled={status === 'searching' || !query.trim()}
        >
          {status === 'searching' ? 'SEARCHING…' : 'SEARCH'}
        </button>
      </div>

      {results.length > 0 && (
        <div style={{ maxHeight: 280, overflowY: 'auto', marginBottom: 10, border: '1px solid #eee' }}>
          {results.map(r => (
            <label
              key={r.spotify_id}
              className={`sp-result${selected.has(r.spotify_id) ? ' selected' : ''}`}
            >
              {r.image_url && (
                <img src={r.image_url} alt="" style={{ width: 40, height: 40, objectFit: 'cover', flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                <div style={{ fontSize: 11, color: '#888' }}>{r.artist}</div>
              </div>
              <input
                type="checkbox"
                checked={selected.has(r.spotify_id)}
                onChange={() => toggleSelect(r.spotify_id)}
                style={{ flexShrink: 0, cursor: 'pointer', width: 16, height: 16 }}
              />
            </label>
          ))}
        </div>
      )}

      {errorMsg && <div className="error-banner" style={{ marginBottom: 8 }}>{errorMsg}</div>}

      <div className="dlg-btns">
        <button onClick={onClose}>Cancel</button>
        {selected.size > 0 && (
          <button onClick={handleImport} disabled={status === 'importing'}>
            {status === 'importing' ? 'IMPORTING…' : `ADD ${selected.size} TO LIBRARY`}
          </button>
        )}
      </div>
    </>
  );
}

// ─── Main dialog ──────────────────────────────────────────────────────────────

export default function ImportDialog({ onClose, onComplete }) {
  const [tab, setTab] = useState('add'); // 'add' | 'spotify' | 'import'

  return (
    <div className="dlg-overlay on">
      <div className="dlg" style={{ minWidth: 360, maxWidth: 520, width: '100%' }}>
        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 14, borderBottom: '1px solid #000' }}>
          {[['add', '+ Add Song'], ['spotify', '♫ Spotify'], ['import', '↑ Spreadsheet']].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 11,
                border: 'none',
                borderBottom: tab === id ? '2px solid #000' : '2px solid transparent',
                background: 'none',
                padding: '6px 14px 8px',
                cursor: 'pointer',
                fontWeight: tab === id ? 700 : 400,
                color: tab === id ? '#000' : '#888',
                marginBottom: -1,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'add'     && <AddSongTab    onClose={onClose} onComplete={onComplete} />}
        {tab === 'spotify' && <SpotifyTab    onClose={onClose} onComplete={onComplete} />}
        {tab === 'import'  && <ImportTab     onClose={onClose} onComplete={onComplete} />}
      </div>
    </div>
  );
}
