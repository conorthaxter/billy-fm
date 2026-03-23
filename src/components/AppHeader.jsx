import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import SettingsDialog from './SettingsDialog';

// ─── How-To Modal ─────────────────────────────────────────────────────────────

function HowToModal({ onClose }) {
  return (
    <div className="dlg-overlay on" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dlg howto-dlg">
        <div className="howto-header">
          <div className="dlg-title">how to use billy-fm</div>
          <button className="howto-close" onClick={onClose}>✕</button>
        </div>
        <div className="howto-body">

          <div className="howto-section">
            <div className="howto-sec-title">Getting Started</div>
            <p>Your songbook is your personal library. Add songs from the Public Songbook or import from a spreadsheet or Spotify.</p>
          </div>

          <div className="howto-section">
            <div className="howto-sec-title">Playing a Set</div>
            <p>Click a song to select it. Double-click or press Enter twice to play it. Songs you play are tracked automatically.</p>
          </div>

          <div className="howto-section">
            <div className="howto-sec-title">Filtering</div>
            <p>Select a song, then use filters in the left panel to find songs with the same key, BPM, era, or genre. Use the key squares at the top to filter by specific keys.</p>
          </div>

          <div className="howto-section">
            <div className="howto-sec-title">Queue</div>
            <p>Press <kbd>Q</kbd> to add the selected song to your queue. Press <kbd>TAB</kbd> to advance the queue — the next song becomes Now Playing.</p>
          </div>

          <div className="howto-section">
            <div className="howto-sec-title">Hotkeys</div>
            <div className="howto-keys">
              <div className="hk-row"><kbd>SPACE</kbd><span>open chords link</span></div>
              <div className="hk-row"><kbd>Q</kbd><span>add selected to queue</span></div>
              <div className="hk-row"><kbd>TAB</kbd><span>next song in queue → Now Playing</span></div>
              <div className="hk-row"><kbd>↑↓←→</kbd><span>navigate grid</span></div>
              <div className="hk-row"><kbd>ENTER</kbd><span>select song / play if already selected</span></div>
              <div className="hk-row"><kbd>DEL</kbd><span>clear selection</span></div>
              <div className="hk-row"><kbd>N</kbd><span>select Now Playing song in grid</span></div>
              <div className="hk-row"><kbd>/</kbd><span>open search</span></div>
              <div className="hk-row"><kbd>ESC</kbd><span>dismiss search, modals, selection</span></div>
              <div className="hk-row"><kbd>R</kbd><span>reshuffle grid</span></div>
              <div className="hk-row"><kbd>C</kbd><span>clear all filters</span></div>
              <div className="hk-row"><kbd>K</kbd><span>toggle key filter</span></div>
              <div className="hk-row"><kbd>B</kbd><span>toggle BPM filter</span></div>
              <div className="hk-row"><kbd>T</kbd><span>toggle theme tags filter</span></div>
              <div className="hk-row"><kbd>E</kbd><span>toggle era filter</span></div>
              <div className="hk-row"><kbd>A</kbd><span>toggle artist filter</span></div>
              <div className="hk-row"><kbd>G</kbd><span>toggle genre filter</span></div>
            </div>
          </div>

          <div className="howto-section">
            <div className="howto-sec-title">Saving Sets</div>
            <p>Your played songs are tracked per session. Click <em>Save Set as Playlist</em> in the right panel to save your setlist.</p>
          </div>

          <div className="howto-section">
            <div className="howto-sec-title">Color Modes</div>
            <p>Choose a tile palette in Settings (⚙). Five vibes: Festival, Session, Jazz Bar, Café, Dive.</p>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── AppHeader ────────────────────────────────────────────────────────────────

export default function AppHeader() {
  const { user, logout } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [howtoOpen,    setHowtoOpen]    = useState(false);

  return (
    <>
      <nav className="nav">

        {/* ── LEFT: brand cell — aligns with filter panel ── */}
        <div className="nav-brand-cell">
          <span className="nav-title">billy-fm</span>
        </div>

        {/* ── CENTER: nav tabs ── */}
        <div className="nav-center">
          {/* Nav tabs — centered */}
          <div className="nav-tabs-row">
            <NavLink to="/dashboard" end className={({ isActive }) => `nav-tab-link${isActive ? ' active' : ''}`}>
              my songbook
            </NavLink>
            <NavLink to="/marketplace" className={({ isActive }) => `nav-tab-link${isActive ? ' active' : ''}`}>
              public songbook
            </NavLink>
          </div>
        </div>

        {/* ── RIGHT: help, settings, user, logout ── */}
        <div className="nav-right">
          <button
            className="nav-help-btn"
            title="How to use billy-fm"
            onClick={() => setHowtoOpen(true)}
          >?</button>
          <button
            className="nav-settings-btn"
            title="Settings"
            onClick={() => setSettingsOpen(true)}
          >⚙</button>
          {user && (
            <div className="nav-user-cluster">
              <span className="nav-user">{user.display_name}</span>
              <button className="nav-logout-btn" onClick={logout}>out</button>
            </div>
          )}
        </div>

      </nav>

      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
      {howtoOpen    && <HowToModal    onClose={() => setHowtoOpen(false)}    />}
    </>
  );
}
