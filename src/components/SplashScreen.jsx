import { useEffect, useState } from 'react';

const PIANO = `
 ┌─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┐
 │ │█│ │█│ │ │█│ │█│ │█│ │
 │ │█│ │█│ │ │█│ │█│ │█│ │
 │ └┤ └┤ │ └┤ └┤ └┤ │
 │  │  │ │  │  │  │ │
 └──┴──┴─┴──┴──┴──┴─┘
`.trim();

export default function SplashScreen({ onDone }) {
  const [phase, setPhase] = useState('in'); // 'in' | 'hold' | 'out' | 'done'

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 600);
    const t2 = setTimeout(() => setPhase('out'), 2400);
    const t3 = setTimeout(() => { setPhase('done'); onDone?.(); }, 3200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []); // eslint-disable-line

  if (phase === 'done') return null;

  return (
    <div className={`splash-overlay splash-${phase}`}>
      <pre className="splash-piano">{PIANO}</pre>
      <div className="splash-tagline">have a good set!</div>
    </div>
  );
}
