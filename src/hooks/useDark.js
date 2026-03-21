import { useEffect, useState } from 'react';

export function useDark() {
  const [dark, setDark] = useState(() => {
    try { return !!JSON.parse(localStorage.getItem('bfm_dark')); } catch { return false; }
  });

  useEffect(() => {
    document.body.classList.toggle('dark', dark);
    try { localStorage.setItem('bfm_dark', JSON.stringify(dark)); } catch {}
  }, [dark]);

  return [dark, setDark];
}
