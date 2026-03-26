import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import {
  verifySet, getSet, addSong, removeSong,
  reorderSet, patchSong, submitRequest, submitSet,
} from '../api/sets';

// ─── Color schemes ────────────────────────────────────────────────────────────

const SCHEMES = {
  standard: {
    '--cs-bg':       '#0a0a0a',
    '--cs-card':     '#141414',
    '--cs-accent':   '#e8e8e8',
    '--cs-text':     '#e8e8e8',
    '--cs-border':   '#222222',
    '--cs-muted':    '#555555',
    '--cs-bank-bg':  '#0f0f0f',
    '--cs-hdr-bg':   '#111111',
    '--cs-hdr-text': '#e8e8e8',
    '--cs-btn-text': '#000000',
  },
  wedding: {
    '--cs-bg':       '#faf7f2',
    '--cs-card':     '#f2ece2',
    '--cs-accent':   '#b8960c',
    '--cs-text':     '#1a1a1a',
    '--cs-border':   '#ddd3c0',
    '--cs-muted':    '#8a7a60',
    '--cs-bank-bg':  '#f5f0e8',
    '--cs-hdr-bg':   '#1a1a1a',
    '--cs-hdr-text': '#faf7f2',
    '--cs-btn-text': '#ffffff',
  },
  corporate: {
    '--cs-bg':       '#ffffff',
    '--cs-card':     '#f4f6f9',
    '--cs-accent':   '#1e3a8a',
    '--cs-text':     '#1e3a8a',
    '--cs-border':   '#dde3ef',
    '--cs-muted':    '#6b7fa0',
    '--cs-bank-bg':  '#f8f9fc',
    '--cs-hdr-bg':   '#1e3a8a',
    '--cs-hdr-text': '#ffffff',
    '--cs-btn-text': '#ffffff',
  },
  birthday: {
    '--cs-bg':       '#fff8f0',
    '--cs-card':     '#ffeedd',
    '--cs-accent':   '#e8734a',
    '--cs-text':     '#1a1a1a',
    '--cs-border':   '#f0d8c4',
    '--cs-muted':    '#a07858',
    '--cs-bank-bg':  '#fff4e8',
    '--cs-hdr-bg':   '#1a1a1a',
    '--cs-hdr-text': '#fff8f0',
    '--cs-btn-text': '#ffffff',
  },
  residency: {
    '--cs-bg':       '#0a0a0a',
    '--cs-card':     '#12101f',
    '--cs-accent':   '#6366f1',
    '--cs-text':     '#e8e8f4',
    '--cs-border':   '#1e1a30',
    '--cs-muted':    '#5a5580',
    '--cs-bank-bg':  '#0c0a14',
    '--cs-hdr-bg':   '#0c0a14',
    '--cs-hdr-text': '#e8e8f4',
    '--cs-btn-text': '#ffffff',
  },
};

function getScheme(name) {
  return SCHEMES[name] ?? SCHEMES.standard;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL ?? '';

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch { return iso; }
}

function formatLockedAt(isoDatetime) {
  if (!isoDatetime) return '';
  try {
    return new Date(isoDatetime).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch { return isoDatetime; }
}

function songToItem(song) {
  return { id: song.song_id, type: 'song', song: { ...song } };
}

function makeDivider() {
  return { id: `div-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type: 'divider', label: '' };
}

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const h = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return mobile;
}

// ─── Password gate ────────────────────────────────────────────────────────────

function PasswordGate({ slug, onSuccess }) {
  const [pwd, setPwd] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await verifySet(slug, pwd);
      onSuccess();
    } catch (ex) {
      setErr(ex.message || 'Incorrect password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', background: 'var(--cs-bg)' }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--cs-muted)', marginBottom: 10 }}>billy fm</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--cs-text)' }}>Enter password</div>
          <div style={{ fontSize: 12, color: 'var(--cs-muted)', marginTop: 6, lineHeight: 1.6 }}>
            This set is private. Enter the password provided by your artist.
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="Password"
            value={pwd}
            onChange={e => setPwd(e.target.value)}
            autoFocus
            style={{
              width: '100%', boxSizing: 'border-box', padding: '12px 14px',
              fontSize: 14, border: '1px solid var(--cs-border)', borderRadius: 0,
              background: 'var(--cs-card)', color: 'var(--cs-text)',
              outline: 'none', fontFamily: 'inherit', marginBottom: 10,
            }}
          />
          {err && <div style={{ color: '#c53030', fontSize: 12, marginBottom: 10 }}>{err}</div>}
          <button
            type="submit"
            disabled={busy || !pwd}
            style={{
              width: '100%', padding: '12px 0', fontSize: 12, fontWeight: 700,
              letterSpacing: 1, textTransform: 'uppercase',
              background: 'var(--cs-accent)', color: 'var(--cs-btn-text)', border: 'none',
              cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit',
              opacity: (!pwd || busy) ? 0.5 : 1,
            }}
          >
            {busy ? 'Checking…' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Bank song card ───────────────────────────────────────────────────────────

function BankSong({ song, inSet, locked, onAdd }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      padding: '9px 14px', borderBottom: '1px solid var(--cs-border)',
      background: 'var(--cs-bg)', opacity: inSet ? 0.4 : 1,
    }}>
      <div style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--cs-text)', lineHeight: 1.3 }}>{song.title}</div>
        <div style={{ fontSize: 11, color: 'var(--cs-muted)', marginTop: 1 }}>{song.artist}</div>
        {song.tags?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 5 }}>
            {song.tags.map(t => (
              <span key={t} style={{
                fontSize: 8, padding: '1px 5px', textTransform: 'uppercase', letterSpacing: 0.3,
                background: 'var(--cs-card)', color: 'var(--cs-muted)',
                border: '1px solid var(--cs-border)',
              }}>{t}</span>
            ))}
          </div>
        )}
      </div>
      {!locked && (
        <button
          onClick={inSet ? undefined : onAdd}
          disabled={inSet}
          style={{
            flexShrink: 0, padding: '5px 10px', fontSize: 10, fontWeight: 700,
            letterSpacing: 0.3, textTransform: 'uppercase',
            background: inSet ? 'transparent' : 'var(--cs-accent)',
            color: inSet ? 'var(--cs-muted)' : 'var(--cs-btn-text)',
            border: `1px solid ${inSet ? 'var(--cs-border)' : 'var(--cs-accent)'}`,
            cursor: inSet ? 'default' : 'pointer', fontFamily: 'inherit',
          }}
        >
          {inSet ? '✓' : '+ Add'}
        </button>
      )}
    </div>
  );
}

// ─── Set song row ─────────────────────────────────────────────────────────────

function SetSongRow({ item, provided, snapshot, locked, onRemove, onNoteChange }) {
  const { song } = item;
  const [note, setNote] = useState(song.notes || '');
  const timer = useRef(null);

  function handleNote(e) {
    setNote(e.target.value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onNoteChange(song.song_id, e.target.value), 700);
  }

  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      style={{
        ...provided.draggableProps.style,
        background: snapshot.isDragging ? 'var(--cs-card)' : 'var(--cs-bg)',
        border: `1px solid ${snapshot.isDragging ? 'var(--cs-accent)' : 'var(--cs-border)'}`,
        boxShadow: snapshot.isDragging ? '0 4px 14px rgba(0,0,0,0.12)' : 'none',
        marginBottom: 4, padding: '10px 12px',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        {!locked && (
          <div
            {...provided.dragHandleProps}
            style={{ color: 'var(--cs-border)', fontSize: 14, paddingTop: 3, cursor: 'grab', flexShrink: 0, touchAction: 'none' }}
            title="Drag to reorder"
          >⠿</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--cs-text)' }}>{song.title}</div>
              <div style={{ fontSize: 11, color: 'var(--cs-muted)' }}>{song.artist}</div>
            </div>
            {!locked && (
              <button
                onClick={() => onRemove(item.id, song.song_id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cs-muted)', fontSize: 18, lineHeight: 1, padding: 0, flexShrink: 0 }}
              >×</button>
            )}
          </div>
          {!locked && (
            <input
              type="text"
              placeholder="Add a note…"
              value={note}
              onChange={handleNote}
              style={{
                marginTop: 7, width: '100%', boxSizing: 'border-box',
                fontSize: 11, padding: '5px 8px',
                border: '1px solid var(--cs-border)', background: 'var(--cs-card)',
                color: 'var(--cs-text)', outline: 'none', fontFamily: 'inherit',
              }}
            />
          )}
          {locked && note && (
            <div style={{ fontSize: 11, color: 'var(--cs-muted)', marginTop: 4, fontStyle: 'italic' }}>{note}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Divider row ──────────────────────────────────────────────────────────────

function DividerRow({ item, provided, snapshot, locked, onChange, onRemove }) {
  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      style={{
        ...provided.draggableProps.style,
        display: 'flex', alignItems: 'center', gap: 6,
        marginBottom: 4, userSelect: 'none',
        opacity: snapshot.isDragging ? 0.8 : 1,
      }}
    >
      {!locked && (
        <div
          {...provided.dragHandleProps}
          style={{ color: 'var(--cs-border)', fontSize: 14, cursor: 'grab', flexShrink: 0, touchAction: 'none' }}
        >⠿</div>
      )}
      <div style={{ flex: 1, height: 1, background: 'var(--cs-accent)', opacity: 0.25 }} />
      {!locked ? (
        <input
          type="text"
          placeholder="Section label…"
          value={item.label || ''}
          onChange={e => onChange(item.id, e.target.value)}
          style={{
            fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
            padding: '3px 8px', border: '1px solid var(--cs-border)',
            background: 'var(--cs-bg)', color: 'var(--cs-accent)',
            outline: 'none', fontFamily: 'inherit', minWidth: 80, maxWidth: 160,
          }}
        />
      ) : (
        item.label
          ? <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--cs-accent)', padding: '0 6px' }}>{item.label}</span>
          : null
      )}
      <div style={{ flex: 1, height: 1, background: 'var(--cs-accent)', opacity: 0.25 }} />
      {!locked && (
        <button
          onClick={() => onRemove(item.id)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cs-muted)', fontSize: 16, padding: 0, lineHeight: 1, flexShrink: 0 }}
        >×</button>
      )}
    </div>
  );
}

// ─── Submit confirm modal ─────────────────────────────────────────────────────

function SubmitModal({ items, requests, busy, onConfirm, onCancel }) {
  const songs = items.filter(i => i.type === 'song');
  const validReqs = requests.filter(r => r.trim());

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200, padding: 20, boxSizing: 'border-box',
    }}>
      <div style={{
        background: 'var(--cs-bg)', border: '1px solid var(--cs-border)',
        padding: 24, width: '100%', maxWidth: 420, maxHeight: '85vh', overflowY: 'auto',
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--cs-text)', marginBottom: 10 }}>
          Submit your set?
        </div>
        <div style={{ fontSize: 12, color: 'var(--cs-muted)', marginBottom: 16, lineHeight: 1.6 }}>
          You're submitting <strong>{songs.length} song{songs.length !== 1 ? 's' : ''}</strong>
          {validReqs.length > 0 && ` and ${validReqs.length} special request${validReqs.length !== 1 ? 's' : ''}`}.
          {' '}Once submitted, the set is locked and your artist is notified.
        </div>

        <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--cs-muted)', marginBottom: 6 }}>
          Your songs:
        </div>
        <ol style={{ margin: '0 0 14px 16px', padding: 0 }}>
          {songs.map((item) => (
            <li key={item.id} style={{ fontSize: 12, color: 'var(--cs-text)', marginBottom: 4 }}>
              {item.song.title} — {item.song.artist}
              {item.song.notes && <span style={{ color: 'var(--cs-muted)' }}> · {item.song.notes}</span>}
            </li>
          ))}
        </ol>

        {validReqs.length > 0 && (
          <>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--cs-muted)', marginBottom: 6 }}>
              Special requests:
            </div>
            <ul style={{ margin: '0 0 14px 16px', padding: 0 }}>
              {validReqs.map((r, i) => (
                <li key={i} style={{ fontSize: 12, color: 'var(--cs-text)', marginBottom: 4 }}>{r}</li>
              ))}
            </ul>
          </>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button
            onClick={onCancel}
            disabled={busy}
            style={{
              padding: '9px 16px', fontSize: 12, fontFamily: 'inherit',
              background: 'none', border: '1px solid var(--cs-border)',
              color: 'var(--cs-text)', cursor: 'pointer',
            }}
          >Cancel</button>
          <button
            onClick={onConfirm}
            disabled={busy}
            style={{
              padding: '9px 18px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
              background: 'var(--cs-accent)', color: 'var(--cs-btn-text)', border: 'none',
              cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? 'Submitting…' : 'Confirm & Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ClientSetPage() {
  const { slug } = useParams();
  const isMobile = useIsMobile();

  const [phase,       setPhase]       = useState('loading'); // loading | password | ready
  const [setData,     setSetData]     = useState(null);
  const [songBank,    setSongBank]    = useState([]);
  const [items,       setItems]       = useState([]);
  const [requests,    setRequests]    = useState([]);
  const [search,      setSearch]      = useState('');
  const [tagFilter,   setTagFilter]   = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [submitted,   setSubmitted]   = useState(false);
  const [loadErr,     setLoadErr]     = useState('');

  const saveTimer = useRef(null);

  const scheme   = getScheme(setData?.color_scheme);
  const locked   = submitted || !!(setData?.is_locked);
  const songCount = items.filter(i => i.type === 'song').length;

  // ── Fetch set data (called after auth is confirmed) ─────────────────────────

  const fetchSetData = useCallback(async () => {
    setLoadErr('');
    try {
      const data = await getSet(slug);
      console.log('[ClientSetPage] color_scheme:', data.color_scheme);
      setSetData(data);
      setItems(data.songs.map(songToItem));
      setRequests(Array.from({ length: data.off_list_requests_limit ?? 0 }, () => ''));
      setPhase('ready');

      if (data.artist_id) {
        fetch(`${API_BASE}/api/songbook/${data.artist_id}`)
          .then(r => r.ok ? r.json() : { songs: [] })
          .then(body => setSongBank(Array.isArray(body.songs) ? body.songs : []))
          .catch(() => {});
      }
    } catch (err) {
      if (err.status === 401) {
        setPhase('password');
      } else {
        setLoadErr(err.message || 'Failed to load set');
        setPhase('ready');
      }
    }
  }, [slug]);

  // ── Initial load: probe verify to detect password requirement ───────────────
  // POST /verify with no password:
  //   - set has no password → server sets cookie, returns ok → proceed to load
  //   - set has password    → server returns 400 "password required" → show gate

  useEffect(() => {
    verifySet(slug, undefined)
      .then(() => fetchSetData())
      .catch(err => {
        if (err.status === 400) {
          setPhase('password');
        } else {
          // Unexpected error (404, network, etc.) — try loading anyway
          fetchSetData();
        }
      });
  }, [slug, fetchSetData]);

  // ── Save order (debounced) ───────────────────────────────────────────────────

  function scheduleSave(newItems) {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const songs = newItems
        .filter(i => i.type === 'song')
        .map((item, idx) => ({
          song_id: item.song.song_id,
          position: idx,
          notes: item.song.notes || undefined,
        }));
      reorderSet(slug, songs).catch(() => {});
    }, 800);
  }

  // ── Drag & drop ─────────────────────────────────────────────────────────────

  function handleDragEnd(result) {
    if (!result.destination) return;
    const next = [...items];
    const [moved] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, moved);
    setItems(next);
    scheduleSave(next);
  }

  // ── Add song ─────────────────────────────────────────────────────────────────

  async function handleAddSong(song) {
    const newItem = songToItem({ ...song, notes: '' });
    const next = [...items, newItem];
    setItems(next);
    try {
      await addSong(slug, song.song_id);
      scheduleSave(next);
    } catch {
      setItems(prev => prev.filter(i => i.id !== newItem.id));
    }
  }

  // ── Remove item (song or divider) ────────────────────────────────────────────

  function handleRemoveItem(itemId, songId) {
    setItems(prev => prev.filter(i => i.id !== itemId));
    if (songId) removeSong(slug, songId).catch(() => {});
  }

  // ── Song note ────────────────────────────────────────────────────────────────

  function handleNoteChange(songId, notes) {
    setItems(prev => prev.map(i =>
      i.type === 'song' && i.song.song_id === songId ? { ...i, song: { ...i.song, notes } } : i
    ));
    patchSong(slug, songId, { notes }).catch(() => {});
  }

  // ── Dividers ─────────────────────────────────────────────────────────────────

  function handleDividerChange(id, label) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, label } : i));
  }

  // ── Submit ───────────────────────────────────────────────────────────────────

  async function handleConfirmSubmit() {
    setSubmitting(true);
    try {
      const songs = items
        .filter(i => i.type === 'song')
        .map((item, idx) => ({
          song_id: item.song.song_id,
          position: idx,
          notes: item.song.notes || undefined,
        }));
      await reorderSet(slug, songs);

      for (const text of requests) {
        if (text.trim()) {
          try { await submitRequest(slug, text.trim()); } catch { /* limit reached */ }
        }
      }

      await submitSet(slug);
      setSubmitted(true);
      setShowConfirm(false);
      setSetData(d => d ? { ...d, is_locked: true } : d);
    } catch (err) {
      alert(err.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Filtered bank ────────────────────────────────────────────────────────────

  const inSetIds    = new Set(items.filter(i => i.type === 'song').map(i => i.id));
  const allTags     = [...new Set(songBank.flatMap(s => s.tags ?? []))].sort();
  const filteredBank = songBank.filter(song => {
    if (search && !song.title.toLowerCase().includes(search.toLowerCase())
                && !song.artist.toLowerCase().includes(search.toLowerCase())) return false;
    if (tagFilter && !song.tags?.includes(tagFilter)) return false;
    return true;
  });

  // ── Render ───────────────────────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#888', background: '#fff' }}>
        Loading…
      </div>
    );
  }

  if (phase === 'password') {
    return (
      <div style={{ ...scheme, fontFamily: 'Inter, sans-serif', minHeight: '100dvh' }}>
        <PasswordGate slug={slug} onSuccess={fetchSetData} />
      </div>
    );
  }

  if (loadErr) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ textAlign: 'center', color: '#888', padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: '#111' }}>Set not found</div>
          <div style={{ fontSize: 12 }}>{loadErr}</div>
        </div>
      </div>
    );
  }

  // ── Set panel content ───────────────────────────────────────────────────────

  const setPanelContent = (
    <div style={{ display: 'flex', flexDirection: 'column', padding: 16, flex: 1 }}>
      <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--cs-muted)', marginBottom: 12 }}>
        Your Set — {songCount} song{songCount !== 1 ? 's' : ''}
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="set">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} style={{ minHeight: 60 }}>
              {items.length === 0 && (
                <div style={{
                  border: '2px dashed var(--cs-border)', padding: 24,
                  textAlign: 'center', fontSize: 12, color: 'var(--cs-muted)', lineHeight: 1.6,
                }}>
                  {locked ? 'No songs in this set.' : 'Add songs from the song bank.'}
                </div>
              )}
              {items.map((item, index) => (
                <Draggable key={item.id} draggableId={item.id} index={index} isDragDisabled={locked}>
                  {(provided, snapshot) =>
                    item.type === 'song' ? (
                      <SetSongRow
                        item={item}
                        provided={provided}
                        snapshot={snapshot}
                        locked={locked}
                        onRemove={handleRemoveItem}
                        onNoteChange={handleNoteChange}
                      />
                    ) : (
                      <DividerRow
                        item={item}
                        provided={provided}
                        snapshot={snapshot}
                        locked={locked}
                        onChange={handleDividerChange}
                        onRemove={(id) => handleRemoveItem(id, null)}
                      />
                    )
                  }
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {!locked && (
        <button
          onClick={() => setItems(prev => [...prev, makeDivider()])}
          style={{
            marginTop: 6, padding: '7px 12px', fontSize: 10, fontFamily: 'inherit',
            background: 'none', border: '1px dashed var(--cs-border)',
            color: 'var(--cs-muted)', cursor: 'pointer', width: '100%', textAlign: 'center',
          }}
        >+ Add section divider</button>
      )}

      {/* Special requests */}
      {(setData?.off_list_requests_limit ?? 0) > 0 && (
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--cs-border)' }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--cs-muted)', marginBottom: 4 }}>
            Special Requests ({setData.off_list_requests_limit} allowed)
          </div>
          <div style={{ fontSize: 11, color: 'var(--cs-muted)', marginBottom: 10, lineHeight: 1.5 }}>
            Request songs not on the list.
          </div>
          {requests.map((req, i) => (
            <input
              key={i}
              type="text"
              placeholder={`Special request ${i + 1}…`}
              value={req}
              disabled={locked}
              onChange={e => setRequests(prev => prev.map((r, j) => j === i ? e.target.value : r))}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '8px 10px', fontSize: 12, marginBottom: 6,
                border: '1px solid var(--cs-border)',
                background: locked ? 'var(--cs-card)' : 'var(--cs-bg)',
                color: 'var(--cs-text)', outline: 'none', fontFamily: 'inherit',
              }}
            />
          ))}
        </div>
      )}

      {/* Submit */}
      {!locked && (
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--cs-border)' }}>
          <button
            onClick={() => setShowConfirm(true)}
            disabled={songCount === 0}
            style={{
              width: '100%', padding: 14, fontSize: 12, fontWeight: 700,
              letterSpacing: 0.8, textTransform: 'uppercase', fontFamily: 'inherit',
              background: 'var(--cs-accent)', color: 'var(--cs-btn-text)', border: 'none',
              cursor: songCount === 0 ? 'not-allowed' : 'pointer',
              opacity: songCount === 0 ? 0.4 : 1,
            }}
          >Submit Set →</button>
          <div style={{ fontSize: 10, color: 'var(--cs-muted)', textAlign: 'center', marginTop: 6 }}>
            Once submitted, your artist is notified and editing is locked.
          </div>
        </div>
      )}
    </div>
  );

  // ── Song bank panel content ─────────────────────────────────────────────────

  const bankPanelContent = (
    <div style={{ display: 'flex', flexDirection: 'column', borderRight: isMobile ? 'none' : '1px solid var(--cs-border)', borderBottom: isMobile ? '1px solid var(--cs-border)' : 'none', background: 'var(--cs-bank-bg)' }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--cs-border)', flexShrink: 0 }}>
        <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--cs-muted)', marginBottom: 8 }}>
          Song Bank
        </div>
        {setData?.color_scheme === 'wedding' && (
          tagFilter === 'wedding' ? (
            <button
              onClick={() => setTagFilter('')}
              style={{
                display: 'block', width: '100%', marginBottom: 8,
                padding: '9px 14px', fontSize: 12, fontFamily: 'Georgia, serif',
                background: 'var(--cs-accent)', color: 'var(--cs-btn-text)',
                border: 'none', cursor: 'pointer', textAlign: 'center', letterSpacing: 0.3,
              }}
            >Show All Songs</button>
          ) : (
            <button
              onClick={() => setTagFilter('wedding')}
              style={{
                display: 'block', width: '100%', marginBottom: 8,
                padding: '9px 14px', fontSize: 14, fontFamily: 'Georgia, serif',
                background: 'none', color: 'var(--cs-accent)',
                border: '1px solid var(--cs-accent)', cursor: 'pointer', textAlign: 'center',
              }}
            >Browse Wedding Songs ♡</button>
          )
        )}
        <input
          type="text"
          placeholder="Search…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '7px 10px', fontSize: 12,
            border: '1px solid var(--cs-border)', background: 'var(--cs-bg)',
            color: 'var(--cs-text)', outline: 'none', fontFamily: 'inherit',
            marginBottom: allTags.length > 0 ? 8 : 0,
          }}
        />
        {allTags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <button
              onClick={() => setTagFilter('')}
              style={{
                fontSize: 8, padding: '2px 7px', fontFamily: 'inherit',
                textTransform: 'uppercase', letterSpacing: 0.3,
                border: '1px solid var(--cs-border)',
                background: !tagFilter ? 'var(--cs-accent)' : 'var(--cs-bg)',
                color: !tagFilter ? 'var(--cs-btn-text)' : 'var(--cs-muted)',
                cursor: 'pointer',
              }}
            >All</button>
            {allTags.map(t => (
              <button
                key={t}
                onClick={() => setTagFilter(prev => prev === t ? '' : t)}
                style={{
                  fontSize: 8, padding: '2px 7px', fontFamily: 'inherit',
                  textTransform: 'uppercase', letterSpacing: 0.3,
                  border: '1px solid var(--cs-border)',
                  background: tagFilter === t ? 'var(--cs-accent)' : 'var(--cs-bg)',
                  color: tagFilter === t ? 'var(--cs-btn-text)' : 'var(--cs-muted)',
                  cursor: 'pointer',
                }}
              >{t}</button>
            ))}
          </div>
        )}
      </div>
      <div style={{ overflowY: 'auto', maxHeight: isMobile ? '42vh' : '65vh' }}>
        {filteredBank.length === 0 && (
          <div style={{ padding: 20, fontSize: 12, color: 'var(--cs-muted)', textAlign: 'center' }}>
            {songBank.length === 0 ? 'Loading songs…' : 'No results'}
          </div>
        )}
        {filteredBank.map(song => (
          <BankSong
            key={song.song_id}
            song={song}
            inSet={inSetIds.has(song.song_id)}
            locked={locked}
            onAdd={() => handleAddSong(song)}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ ...scheme, height: '100dvh', overflowY: 'auto', fontFamily: 'Inter, sans-serif', background: 'var(--cs-bg)', color: 'var(--cs-text)' }}>

      {/* Header */}
      <header style={{
        background: 'var(--cs-hdr-bg)', color: 'var(--cs-hdr-text)',
        padding: '12px 20px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', opacity: 0.5, marginBottom: 3 }}>
            billy fm
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3 }}>
            {setData?.client_name ? `Set for ${setData.client_name}` : setData?.title}
          </div>
          {setData?.event_date && (
            <div style={{ fontSize: 11, opacity: 0.65, marginTop: 2 }}>
              {formatDate(setData.event_date)}
            </div>
          )}
        </div>
        {locked && (
          <div style={{
            fontSize: 9, padding: '5px 10px', border: '1px solid currentColor',
            opacity: 0.65, textTransform: 'uppercase', letterSpacing: 0.8, flexShrink: 0,
          }}>
            {submitted ? 'Submitted ✓' : 'Submitted ✓'}
          </div>
        )}
      </header>

      {/* Submitted/locked notice */}
      {locked && (
        <div style={{
          background: 'var(--cs-card)', borderBottom: '1px solid var(--cs-border)',
          padding: '10px 20px', fontSize: 12, color: 'var(--cs-muted)', textAlign: 'center',
          lineHeight: 1.5,
        }}>
          {submitted
            ? 'Your set has been submitted. Your artist has been notified. ✓'
            : setData?.locked_at
              ? `This set was finalized on ${formatLockedAt(setData.locked_at)}.`
              : 'Your set has been finalized by your artist.'
          }
        </div>
      )}

      {/* Two-panel layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        maxWidth: 1100,
        margin: '0 auto',
      }}>
        {bankPanelContent}
        <div>
          {setPanelContent}
        </div>
      </div>

      {/* Submit confirm modal */}
      {showConfirm && (
        <SubmitModal
          items={items}
          requests={requests}
          busy={submitting}
          onConfirm={handleConfirmSubmit}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}
