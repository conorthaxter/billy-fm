import { useParams } from 'react-router-dom';

export default function PublicRepertoirePage() {
  const { slug } = useParams();

  return (
    <div style={{ padding: 20 }}>
      <div style={{ fontFamily: 'Courier New', fontSize: 20, fontWeight: 700, letterSpacing: 2, marginBottom: 12 }}>
        BILLY fm
      </div>
      <h1 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Repertoire</h1>
      <p style={{ fontSize: 12, color: '#888' }}>
        Public repertoire for <code>{slug}</code> — coming in Phase 2.
      </p>
    </div>
  );
}
