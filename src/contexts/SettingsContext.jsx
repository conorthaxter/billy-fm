import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export const SettingsContext = createContext(null);

const LS = {
  get: k => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

// Background → body class mapping
// 'white'  → (no class)
// 'cream'  → body.cream
// 'dark'   → body.dark
function applyBg(bg) {
  document.body.classList.toggle('cream', bg === 'cream');
  document.body.classList.toggle('dark',  bg === 'dark');
  document.body.classList.remove('black');
}

export function SettingsProvider({ children }) {
  const [palette,        setPaletteState]        = useState(() => {
    const stored = LS.get('bfm_palette');
    // migrate old seasonal names to festival
    const legacy = { summer: 'festival', spring: 'session', autumn: 'cafe', winter: 'jazzbar' };
    return (stored && legacy[stored]) ? legacy[stored] : (stored || 'festival');
  });
  const [bg,             setBgState]             = useState(() => {
    const stored = LS.get('bfm_bg') || 'white';
    return stored === 'black' ? 'dark' : stored;
  });
  const [defaultSort,    setDefaultSortState]    = useState(() => LS.get('bfm_default_sort')   || 'random');
  const [defaultPublic,  setDefaultPublicState]  = useState(() => LS.get('bfm_default_public') || false);

  // Apply bg on mount and whenever it changes
  useEffect(() => {
    applyBg(bg);
    LS.set('bfm_bg', bg);
  }, [bg]);

  useEffect(() => {
    LS.set('bfm_palette', palette);
    document.body.classList.toggle('dive', palette === 'dive');
  }, [palette]);

  useEffect(() => {
    LS.set('bfm_default_sort', defaultSort);
  }, [defaultSort]);

  useEffect(() => {
    LS.set('bfm_default_public', defaultPublic);
  }, [defaultPublic]);

  const setPalette       = useCallback(p => setPaletteState(p), []);
  const setDefaultSort   = useCallback(s => setDefaultSortState(s), []);
  const setDefaultPublic = useCallback(v => setDefaultPublicState(v), []);

  const setBg = useCallback(b => setBgState(b), []);

  // Cycle bg: white → cream → dark → white
  const cycleBg = useCallback(() => {
    setBgState(prev => {
      const order = ['white', 'cream', 'dark'];
      const idx = order.indexOf(prev);
      return order[(idx + 1) % order.length];
    });
  }, []);

  return (
    <SettingsContext.Provider value={{ palette, setPalette, bg, setBg, cycleBg, defaultSort, setDefaultSort, defaultPublic, setDefaultPublic }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
