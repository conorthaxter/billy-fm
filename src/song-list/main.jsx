import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SettingsProvider } from '../contexts/SettingsContext';
import SongListApp from './SongListApp';
import '../styles/global.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SettingsProvider>
      <SongListApp />
    </SettingsProvider>
  </StrictMode>,
);
