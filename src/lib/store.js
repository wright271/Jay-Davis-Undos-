/**
 * Tournament data access.
 *
 * Two interchangeable adapters behind one interface:
 *   - Realtime Database, with live listeners so every scorer's phone updates
 *     in place.
 *   - localStorage, used automatically when no Firebase project is configured.
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
  get,
  onChildAdded,
  onChildChanged,
  onChildRemoved,
  onValue,
  ref,
  remove,
  serverTimestamp,
  set,
  update,
} from 'firebase/database';
import { db, isFirebaseConfigured } from './firebase.js';
import { DEFAULT_TOURNAMENT, DEFAULT_SETTINGS } from './constants.js';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/** Turn a database failure into something the organiser can act on. */
export function databaseErrorMessage(err) {
  const raw = err?.message || '';
  if (/permission_denied|Permission denied/i.test(raw)) {
    return 'The database rules are blocking this. Publish database.rules.json — npx firebase deploy --only database — or paste it into the Rules tab in the console.';
  }
  if (/Index not defined/i.test(raw)) {
    return 'The database is missing an index for this read.';
  }
  return raw || 'Could not reach the scoring database.';
}

/** Fill in anything a stored tournament doc is missing. */
function normaliseTournament(raw) {
  const t = { ...DEFAULT_TOURNAMENT, ...(raw || {}) };
  t.settings = { ...DEFAULT_SETTINGS, ...(raw?.settings || {}) };
  if (!Array.isArray(t.holes) || t.holes.length === 0) t.holes = DEFAULT_TOURNAMENT.holes;
  return t;
}

/* ------------------------------------------------------------------ *
 * Realtime Database adapter
 * ------------------------------------------------------------------ *
 *
 * Layout under tournaments/<id>:
 *   name, date, courseName, holes[], settings{}
 *   players/<playerId>  { firstName, lastName, flight }
 *   teams/<teamId>      { name, playerIds[] }
 *   cards/<playerId>/holes/<holeNumber> = strokes
 *
 * Scores are stored one hole deep on purpose: posting a score writes a single
 * integer at cards/<player>/holes/7 rather than rewriting a card, so two
 * players on the same group entering scores at once cannot clobber each other.
 */

/**
 * RTDB returns a dense array as an array but a sparse one as an object keyed
 * by index, so anything stored as a list has to be read back through this.
 */
function toArray(value, fallback) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value && typeof value === 'object') {
    return Object.values(value).filter(Boolean);
  }
  return fallback;
}

/** Children of a node as [{ id, ...fields }]. */
function childList(value) {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).map(([id, fields]) => ({ id, ...fields }));
}

function realtimeStore(tournamentId) {
  const base = `tournaments/${tournamentId}`;
  const rootRef = ref(db, base);
  const metaRef = ref(db, `${base}/meta`);
  const playersRef = ref(db, `${base}/players`);
  const teamsRef = ref(db, `${base}/teams`);
  const cardsRef = ref(db, `${base}/cards`);

  return {
    kind: 'firebase',

    subscribe(cb) {
      const state = {
        tournament: normaliseTournament(null),
        players: [],
        teams: [],
        cards: {},
        ready: false,
        error: null,
        connected: true,
      };
      const loaded = { meta: false, players: false, teams: false, cards: false };

      /**
       * Unlike a cache-backed client, these listeners stay silent until they
       * reach the server — so a phone that opens the app with no signal would
       * sit on the loading screen indefinitely. Give them a few seconds, then
       * show the app regardless: the defaults are enough to render, and the
       * offline banner explains why it looks empty.
       */
      let timedOut = false;
      let stopped = false;
      const watchdog = setTimeout(() => {
        timedOut = true;
        emit();
      }, 6000);

      const emit = () => {
        if (stopped) return;
        state.ready = timedOut || Object.values(loaded).every(Boolean);
        cb({ ...state });
      };

      /**
       * A listener that fails — rules denying the read, database not created —
       * must not leave the app spinning on a loading screen. Mark that stream
       * as settled, record why, and let the UI say something useful.
       */
      const onError = (label) => (err) => {
        state.error = { source: label, message: databaseErrorMessage(err) };
        loaded[label] = true;
        emit();
      };

      const unsubs = [
        // Tournament settings and the course card.
        onValue(
          metaRef,
          (snap) => {
            const raw = snap.val();
            const meta = normaliseTournament(raw);
            meta.holes = toArray(raw?.holes, DEFAULT_TOURNAMENT.holes);
            state.tournament = meta;
            loaded.meta = true;
            state.error = null;
            emit();
          },
          onError('meta'),
        ),

        onValue(
          playersRef,
          (snap) => {
            state.players = childList(snap.val());
            loaded.players = true;
            emit();
          },
          onError('players'),
        ),

        onValue(
          teamsRef,
          (snap) => {
            state.teams = childList(snap.val()).map((t) => ({
              ...t,
              playerIds: toArray(t.playerIds, []),
            }));
            loaded.teams = true;
            emit();
          },
          onError('teams'),
        ),

        // Cards are watched per child rather than as one node: during play this
        // is the only branch changing, and a whole-node listener would push
        // every player's card to every phone on each score posted.
        onChildAdded(cardsRef, (snap) => {
          state.cards = { ...state.cards, [snap.key]: { holes: snap.val()?.holes || {} } };
          emit();
        }, onError('cards')),
        onChildChanged(cardsRef, (snap) => {
          state.cards = { ...state.cards, [snap.key]: { holes: snap.val()?.holes || {} } };
          emit();
        }),
        onChildRemoved(cardsRef, (snap) => {
          const next = { ...state.cards };
          delete next[snap.key];
          state.cards = next;
          emit();
        }),

        // `.info/connected` is the database's own view of the socket, which is
        // how the app knows a leaderboard on screen may be stale.
        onValue(ref(db, '.info/connected'), (snap) => {
          state.connected = snap.val() === true;
          emit();
        }),
      ];

      // The child listeners above never report "initial load finished", so ask
      // once and let the incremental events take over from there.
      get(cardsRef)
        .then((snap) => {
          const value = snap.val() || {};
          state.cards = Object.fromEntries(
            Object.entries(value).map(([id, card]) => [id, { holes: card?.holes || {} }]),
          );
          loaded.cards = true;
          emit();
        })
        .catch(onError('cards'));

      return () => {
        // The initial read above may still be in flight; `stopped` keeps it
        // from calling back into a screen that has already gone away.
        stopped = true;
        clearTimeout(watchdog);
        unsubs.forEach((u) => u());
      };
    },

    async saveTournament(patch) {
      await update(metaRef, { ...patch, updatedAt: serverTimestamp() });
    },
    async upsertPlayer(player) {
      const { id, ...rest } = player;
      await update(ref(db, `${base}/players/${id}`), rest);
    },
    async removePlayer(id) {
      await Promise.all([
        remove(ref(db, `${base}/players/${id}`)),
        remove(ref(db, `${base}/cards/${id}`)),
      ]);
      // Drop the player from any team they were paired into, so the team is
      // not left pointing at somebody who is no longer in the field.
      const snap = await get(teamsRef);
      const teams = snap.val() || {};
      await Promise.all(
        Object.entries(teams)
          .filter(([, t]) => toArray(t?.playerIds, []).includes(id))
          .map(([teamId, t]) =>
            update(ref(db, `${base}/teams/${teamId}`), {
              playerIds: toArray(t?.playerIds, []).filter((pid) => pid !== id),
            }),
          ),
      );
    },
    async upsertTeam(team) {
      const { id, ...rest } = team;
      await update(ref(db, `${base}/teams/${id}`), rest);
    },
    async removeTeam(id) {
      await remove(ref(db, `${base}/teams/${id}`));
    },
    async setHoleScore(playerId, hole, value) {
      const holeRef = ref(db, `${base}/cards/${playerId}/holes/${hole}`);
      const clean = value === null || value === '' ? null : Number(value);
      if (clean === null) await remove(holeRef);
      else await set(holeRef, clean);
    },
    async setCard(playerId, holes) {
      await set(ref(db, `${base}/cards/${playerId}/holes`), holes);
    },
    async listTournaments() {
      const snap = await get(ref(db, 'tournaments'));
      const all = snap.val() || {};
      return Object.entries(all).map(([id, t]) => ({ id, name: t?.meta?.name || id }));
    },
    async createTournament(id, data) {
      await update(ref(db, `tournaments/${id}/meta`), normaliseTournament(data));
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
  return isFirebaseConfigured && db ? realtimeStore(tournamentId) : localStore(tournamentId);
}
