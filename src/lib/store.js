/**
 * Tournament data access.
 *
 * Two interchangeable adapters behind one interface:
 *   - Firestore, with live listeners so every scorer's phone updates in place.
 *   - localStorage, used automatically when Firebase env vars are absent.
 *
 * Both expose:
 *   subscribe(cb) -> unsubscribe    cb({ tournament, players, teams, cards, ready })
 *   saveTournament(patch)
 *   upsertPlayer(player) / removePlayer(id)
 *   upsertTeam(team) / removeTeam(id)
 *   setHoleScore(playerId, hole, value)
 *   setCard(playerId, holes)
 *   listTournaments() / createTournament(id, data)
 */

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase.js';
import { DEFAULT_TOURNAMENT, DEFAULT_SETTINGS } from './constants.js';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/** Fill in anything a stored tournament doc is missing. */
function normaliseTournament(raw) {
  const t = { ...DEFAULT_TOURNAMENT, ...(raw || {}) };
  t.settings = { ...DEFAULT_SETTINGS, ...(raw?.settings || {}) };
  if (!Array.isArray(t.holes) || t.holes.length === 0) t.holes = DEFAULT_TOURNAMENT.holes;
  return t;
}

/* ------------------------------------------------------------------ *
 * Firestore adapter
 * ------------------------------------------------------------------ */

function firestoreStore(tournamentId) {
  const root = doc(db, 'tournaments', tournamentId);
  const playersCol = collection(root, 'players');
  const teamsCol = collection(root, 'teams');
  const cardsCol = collection(root, 'cards');

  return {
    kind: 'firebase',

    subscribe(cb) {
      const state = { tournament: null, players: [], teams: [], cards: {}, ready: false };
      const loaded = { tournament: false, players: false, teams: false, cards: false };
      const emit = () => {
        state.ready = Object.values(loaded).every(Boolean);
        cb({ ...state });
      };

      const unsubs = [
        onSnapshot(root, (snap) => {
          state.tournament = normaliseTournament(snap.exists() ? snap.data() : null);
          loaded.tournament = true;
          emit();
        }),
        onSnapshot(playersCol, (snap) => {
          state.players = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          loaded.players = true;
          emit();
        }),
        onSnapshot(teamsCol, (snap) => {
          state.teams = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          loaded.teams = true;
          emit();
        }),
        onSnapshot(cardsCol, (snap) => {
          state.cards = Object.fromEntries(snap.docs.map((d) => [d.id, { holes: d.data().holes || {} }]));
          loaded.cards = true;
          emit();
        }),
      ];
      return () => unsubs.forEach((u) => u());
    },

    async saveTournament(patch) {
      await setDoc(root, { ...patch, updatedAt: serverTimestamp() }, { merge: true });
    },
    async upsertPlayer(player) {
      const { id, ...rest } = player;
      await setDoc(doc(playersCol, id), rest, { merge: true });
    },
    async removePlayer(id) {
      await Promise.all([deleteDoc(doc(playersCol, id)), deleteDoc(doc(cardsCol, id))]);
    },
    async upsertTeam(team) {
      const { id, ...rest } = team;
      await setDoc(doc(teamsCol, id), rest, { merge: true });
    },
    async removeTeam(id) {
      await deleteDoc(doc(teamsCol, id));
    },
    async setHoleScore(playerId, hole, value) {
      const clean = value === null || value === '' ? null : Number(value);
      await setDoc(
        doc(cardsCol, playerId),
        { holes: { [String(hole)]: clean }, updatedAt: serverTimestamp() },
        { merge: true },
      );
    },
    async setCard(playerId, holes) {
      await setDoc(doc(cardsCol, playerId), { holes, updatedAt: serverTimestamp() }, { merge: true });
    },
    async listTournaments() {
      const snap = await getDocs(collection(db, 'tournaments'));
      return snap.docs.map((d) => ({ id: d.id, name: d.data()?.name || d.id }));
    },
    async createTournament(id, data) {
      await setDoc(doc(db, 'tournaments', id), normaliseTournament(data), { merge: true });
    },
  };
}

/* ------------------------------------------------------------------ *
 * Local adapter (no backend)
 * ------------------------------------------------------------------ */

const KEY = (id) => `golf-scoring:${id}`;
const INDEX_KEY = 'golf-scoring:index';

function localStore(tournamentId) {
  const listeners = new Set();

  const read = () => {
    try {
      const raw = localStorage.getItem(KEY(tournamentId));
      const parsed = raw ? JSON.parse(raw) : {};
      return {
        tournament: normaliseTournament(parsed.tournament),
        players: parsed.players || [],
        teams: parsed.teams || [],
        cards: parsed.cards || {},
      };
    } catch {
      return { tournament: normaliseTournament(null), players: [], teams: [], cards: {} };
    }
  };

  const write = (next) => {
    localStorage.setItem(KEY(tournamentId), JSON.stringify(next));
    try {
      const index = JSON.parse(localStorage.getItem(INDEX_KEY) || '[]');
      if (!index.includes(tournamentId)) {
        localStorage.setItem(INDEX_KEY, JSON.stringify([...index, tournamentId]));
      }
    } catch {
      localStorage.setItem(INDEX_KEY, JSON.stringify([tournamentId]));
    }
    listeners.forEach((cb) => cb({ ...next, ready: true }));
  };

  const mutate = (fn) => {
    const state = read();
    write(fn(state) || state);
  };

  // Keep other tabs on the same device in sync.
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key === KEY(tournamentId)) listeners.forEach((cb) => cb({ ...read(), ready: true }));
    });
  }

  return {
    kind: 'local',

    subscribe(cb) {
      listeners.add(cb);
      cb({ ...read(), ready: true });
      return () => listeners.delete(cb);
    },

    async saveTournament(patch) {
      mutate((s) => ({ ...s, tournament: normaliseTournament({ ...s.tournament, ...patch }) }));
    },
    async upsertPlayer(player) {
      mutate((s) => {
        const players = s.players.some((p) => p.id === player.id)
          ? s.players.map((p) => (p.id === player.id ? { ...p, ...player } : p))
          : [...s.players, player];
        return { ...s, players };
      });
    },
    async removePlayer(id) {
      mutate((s) => {
        const cards = { ...s.cards };
        delete cards[id];
        return {
          ...s,
          cards,
          players: s.players.filter((p) => p.id !== id),
          teams: s.teams.map((t) => ({ ...t, playerIds: (t.playerIds || []).filter((pid) => pid !== id) })),
        };
      });
    },
    async upsertTeam(team) {
      mutate((s) => {
        const teams = s.teams.some((t) => t.id === team.id)
          ? s.teams.map((t) => (t.id === team.id ? { ...t, ...team } : t))
          : [...s.teams, team];
        return { ...s, teams };
      });
    },
    async removeTeam(id) {
      mutate((s) => ({ ...s, teams: s.teams.filter((t) => t.id !== id) }));
    },
    async setHoleScore(playerId, hole, value) {
      const clean = value === null || value === '' ? null : Number(value);
      mutate((s) => {
        const card = s.cards[playerId] || { holes: {} };
        const holes = { ...card.holes };
        if (clean === null) delete holes[String(hole)];
        else holes[String(hole)] = clean;
        return { ...s, cards: { ...s.cards, [playerId]: { holes } } };
      });
    },
    async setCard(playerId, holes) {
      mutate((s) => ({ ...s, cards: { ...s.cards, [playerId]: { holes } } }));
    },
    async listTournaments() {
      try {
        const index = JSON.parse(localStorage.getItem(INDEX_KEY) || '[]');
        return index.map((id) => {
          try {
            const data = JSON.parse(localStorage.getItem(KEY(id)) || '{}');
            return { id, name: data?.tournament?.name || id };
          } catch {
            return { id, name: id };
          }
        });
      } catch {
        return [];
      }
    },
    async createTournament(id, data) {
      const existing = localStorage.getItem(KEY(id));
      if (!existing) {
        localStorage.setItem(
          KEY(id),
          JSON.stringify({ tournament: normaliseTournament(data), players: [], teams: [], cards: {} }),
        );
      }
      const index = JSON.parse(localStorage.getItem(INDEX_KEY) || '[]');
      if (!index.includes(id)) localStorage.setItem(INDEX_KEY, JSON.stringify([...index, id]));
    },
  };
}

/** Pick the adapter that matches the environment. */
export function createStore(tournamentId) {
  return isFirebaseConfigured && db ? firestoreStore(tournamentId) : localStore(tournamentId);
}
