import React, { useEffect, useMemo, useState } from 'react';
import { createStore } from './lib/store.js';
import { isFirebaseConfigured, watchAuth } from './lib/firebase.js';
import { DEFAULT_TOURNAMENT } from './lib/constants.js';
import IndividualTab from './components/IndividualTab.jsx';
import TeamsTab from './components/TeamsTab.jsx';
import SkinsTab from './components/SkinsTab.jsx';
import ScoreEntryTab from './components/ScoreEntryTab.jsx';
import AdminTab from './components/AdminTab.jsx';

const TOURNAMENT_ID = import.meta.env.VITE_TOURNAMENT_ID || 'default';

const TABS = [
  { id: 'individual', label: 'Individual', icon: '🏌️' },
  { id: 'teams', label: 'Teams', icon: '👥' },
  { id: 'skins', label: 'Skins', icon: '💰' },
  { id: 'entry', label: 'Scores', icon: '✏️' },
];

export default function App() {
  const [tournamentId, setTournamentId] = useState(TOURNAMENT_ID);
  const store = useMemo(() => createStore(tournamentId), [tournamentId]);

  const [state, setState] = useState({
    tournament: DEFAULT_TOURNAMENT,
    players: [],
    teams: [],
    cards: {},
    ready: false,
  });
  const [tab, setTab] = useState('individual');
  const [user, setUser] = useState(null);

  useEffect(() => store.subscribe(setState), [store]);
  useEffect(() => watchAuth(setUser), []);

  const { tournament, players, teams, cards, ready } = state;
  const holes = tournament?.holes ?? DEFAULT_TOURNAMENT.holes;
  const settings = tournament?.settings ?? DEFAULT_TOURNAMENT.settings;

  // Without Firebase there is nobody to authenticate against, so the local
  // copy is fully editable on this device.
  const canEdit = !isFirebaseConfigured || !!user;

  const shared = { store, tournament, players, teams, cards, holes, settings, canEdit, user };

  return (
    <div className="app">
      <header className="app-head">
        <div className="app-head-inner">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">⛳</span>
            <div>
              <h1>{tournament?.name || 'Tournament'}</h1>
              <p className="muted">
                {tournament?.courseName ? `${tournament.courseName} · ` : ''}
                {tournament?.date}
                {store.kind === 'local' && <span className="offline-tag">on this device</span>}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="app-body">
        {!ready && <div className="loading">Loading scores…</div>}

        {ready && tab === 'individual' && <IndividualTab {...shared} />}
        {ready && tab === 'teams' && <TeamsTab {...shared} onOpenAdmin={() => setTab('admin')} />}
        {ready && tab === 'skins' && <SkinsTab {...shared} />}
        {ready && tab === 'entry' && <ScoreEntryTab {...shared} />}
        {ready && tab === 'admin' && (
          <AdminTab
            {...shared}
            tournamentId={tournamentId}
            onSwitchTournament={setTournamentId}
            onClose={() => setTab('teams')}
          />
        )}
      </main>

      <nav className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? 'on' : ''}
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
          >
            <span className="tab-icon" aria-hidden="true">{t.icon}</span>
            <span className="tab-label">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
