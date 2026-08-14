/**
 * Tests for the Realtime Database adapter.
 *
 * The database SDK is replaced with a small in-memory tree that behaves the
 * way RTDB does in the ways that matter here: values live at paths, listeners
 * fire on change, and a list read back from the tree can arrive as an object
 * keyed by index rather than as an array. That last one is the quiet source of
 * shape bugs, so it is exercised directly.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

/* ---------------- in-memory stand-in for firebase/database ---------------- */

const tree = {};
const listeners = [];

const segments = (path) => path.split('/').filter(Boolean);

function readAt(path) {
  let node = tree;
  for (const key of segments(path)) {
    if (node == null || typeof node !== 'object') return null;
    node = node[key];
  }
  return node === undefined ? null : node;
}

function writeAt(path, value) {
  const parts = segments(path);
  const last = parts.pop();
  let node = tree;
  for (const key of parts) {
    if (typeof node[key] !== 'object' || node[key] === null) node[key] = {};
    node = node[key];
  }
  if (value === null) delete node[last];
  else node[last] = value;
  notify();
}

const snapshotOf = (path) => ({
  key: segments(path).at(-1) ?? null,
  val: () => readAt(path),
  exists: () => readAt(path) !== null,
});

/** Re-fire every listener, comparing children so child events stay accurate. */
function notify() {
  for (const l of listeners) {
    const value = readAt(l.path);
    if (l.type === 'value') {
      l.cb(snapshotOf(l.path));
      continue;
    }
    const now = value && typeof value === 'object' ? Object.keys(value) : [];
    const before = l.seen ?? [];
    if (l.type === 'added') {
      for (const k of now) if (!before.includes(k)) l.cb(snapshotOf(`${l.path}/${k}`));
    } else if (l.type === 'removed') {
      for (const k of before) if (!now.includes(k)) l.cb({ key: k, val: () => null });
    } else if (l.type === 'changed') {
      for (const k of now) {
        if (before.includes(k) && JSON.stringify(value[k]) !== JSON.stringify(l.snapshot?.[k])) {
          l.cb(snapshotOf(`${l.path}/${k}`));
        }
      }
    }
    l.seen = now;
    l.snapshot = JSON.parse(JSON.stringify(value ?? {}));
  }
}

function addListener(type, refObj, cb) {
  const value = readAt(refObj.path);
  const entry = {
    type,
    path: refObj.path,
    cb,
    seen: [],
    snapshot: JSON.parse(JSON.stringify(value ?? {})),
  };
  listeners.push(entry);
  // Fire the initial state the way the SDK does on attach.
  if (type === 'value') {
    cb(snapshotOf(refObj.path));
    entry.seen = value && typeof value === 'object' ? Object.keys(value) : [];
  } else if (type === 'added' && value && typeof value === 'object') {
    for (const k of Object.keys(value)) cb(snapshotOf(`${refObj.path}/${k}`));
    entry.seen = Object.keys(value);
  }
  return () => {
    const i = listeners.indexOf(entry);
    if (i >= 0) listeners.splice(i, 1);
  };
}

vi.mock('firebase/database', () => ({
  ref: (_db, path) => ({ path: path ?? '' }),
  get: async (r) => snapshotOf(r.path),
  set: async (r, v) => writeAt(r.path, v),
  remove: async (r) => writeAt(r.path, null),
  update: async (r, patch) => {
    for (const [k, v] of Object.entries(patch)) writeAt(`${r.path}/${k}`, v);
  },
  serverTimestamp: () => 1234567890,
  onValue: (r, cb) => addListener('value', r, cb),
  onChildAdded: (r, cb) => addListener('added', r, cb),
  onChildChanged: (r, cb) => addListener('changed', r, cb),
  onChildRemoved: (r, cb) => addListener('removed', r, cb),
}));

vi.mock('./firebase.js', () => ({ db: {}, isFirebaseConfigured: true }));

const { createStore } = await import('./store.js');

/* ------------------------------ helpers ------------------------------ */

const BASE = 'tournaments/default';

/** Latest state the store has pushed to its subscriber. */
function subscribeAndCapture(store) {
  const seen = { current: null };
  const unsub = store.subscribe((s) => {
    seen.current = s;
  });
  return { seen, unsub };
}

/** The initial card read resolves on a promise, so let microtasks drain. */
const settle = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  for (const k of Object.keys(tree)) delete tree[k];
  listeners.length = 0;
  // The connection flag the store watches.
  writeAt('.info/connected', true);
});

/* -------------------------------- tests -------------------------------- */

describe('realtime database adapter', () => {
  it('reads players, teams and cards into the shape the leaderboards expect', async () => {
    writeAt(`${BASE}/players/p1`, { firstName: 'Jay', lastName: 'Davis', flight: 'championship' });
    writeAt(`${BASE}/players/p2`, { firstName: 'Tom', lastName: 'Wright', flight: 'first' });
    writeAt(`${BASE}/teams/t1`, { name: 'Davis / Wright', playerIds: ['p1', 'p2'] });
    writeAt(`${BASE}/cards/p1`, { holes: { 1: 4, 2: 5 } });

    const store = createStore('default');
    const { seen, unsub } = subscribeAndCapture(store);
    await settle();

    expect(seen.current.ready).toBe(true);
    expect(seen.current.players).toEqual([
      { id: 'p1', firstName: 'Jay', lastName: 'Davis', flight: 'championship' },
      { id: 'p2', firstName: 'Tom', lastName: 'Wright', flight: 'first' },
    ]);
    expect(seen.current.teams[0]).toMatchObject({ id: 't1', playerIds: ['p1', 'p2'] });
    expect(seen.current.cards.p1).toEqual({ holes: { 1: 4, 2: 5 } });
    unsub();
  });

  it('handles a list that comes back keyed by index instead of as an array', () => {
    // This is how RTDB returns a list once it has a gap in it.
    writeAt(`${BASE}/teams/t1`, { name: 'Pair', playerIds: { 0: 'p1', 1: 'p2' } });
    writeAt(`${BASE}/meta/holes`, { 0: { number: 1, par: 4 }, 1: { number: 2, par: 3 } });

    const store = createStore('default');
    const { seen, unsub } = subscribeAndCapture(store);

    expect(seen.current.teams[0].playerIds).toEqual(['p1', 'p2']);
    expect(Array.isArray(seen.current.tournament.holes)).toBe(true);
    expect(seen.current.tournament.holes).toHaveLength(2);
    expect(seen.current.tournament.holes[1]).toEqual({ number: 2, par: 3 });
    unsub();
  });

  it('falls back to the default course when no card has been saved', () => {
    const store = createStore('default');
    const { seen, unsub } = subscribeAndCapture(store);
    expect(seen.current.tournament.holes).toHaveLength(18);
    expect(seen.current.tournament.settings.skinsCarryover).toBe(true);
    unsub();
  });

  it('writes a single hole rather than rewriting the whole card', async () => {
    writeAt(`${BASE}/cards/p1`, { holes: { 1: 4, 2: 5 } });
    const store = createStore('default');

    await store.setHoleScore('p1', 3, 6);

    expect(readAt(`${BASE}/cards/p1/holes/3`)).toBe(6);
    // The partner holes are untouched, so two scorers cannot clobber each other.
    expect(readAt(`${BASE}/cards/p1/holes`)).toEqual({ 1: 4, 2: 5, 3: 6 });
  });

  it('clears one hole without deleting the rest of the card', async () => {
    writeAt(`${BASE}/cards/p1`, { holes: { 1: 4, 2: 5 } });
    const store = createStore('default');

    await store.setHoleScore('p1', 1, null);

    expect(readAt(`${BASE}/cards/p1/holes`)).toEqual({ 2: 5 });
  });

  it('stores scores as numbers even when the input hands over a string', async () => {
    const store = createStore('default');
    await store.setHoleScore('p1', 5, '7');
    expect(readAt(`${BASE}/cards/p1/holes/5`)).toBe(7);
  });

  it('pushes a posted score out to a live subscriber', async () => {
    const store = createStore('default');
    const { seen, unsub } = subscribeAndCapture(store);

    await store.setHoleScore('p9', 1, 4);

    expect(seen.current.cards.p9).toEqual({ holes: { 1: 4 } });
    unsub();
  });

  it('removes a player along with their card and their team pairing', async () => {
    writeAt(`${BASE}/players/p1`, { firstName: 'Jay', lastName: 'Davis', flight: 'championship' });
    writeAt(`${BASE}/players/p2`, { firstName: 'Tom', lastName: 'Wright', flight: 'first' });
    writeAt(`${BASE}/cards/p1`, { holes: { 1: 4 } });
    writeAt(`${BASE}/teams/t1`, { name: 'Pair', playerIds: ['p1', 'p2'] });

    const store = createStore('default');
    await store.removePlayer('p1');

    expect(readAt(`${BASE}/players/p1`)).toBeNull();
    expect(readAt(`${BASE}/cards/p1`)).toBeNull();
    // The team survives, minus the departed player, rather than pointing at a
    // player who is no longer in the field.
    expect(readAt(`${BASE}/teams/t1/playerIds`)).toEqual(['p2']);
    expect(readAt(`${BASE}/players/p2`)).not.toBeNull();
  });

  it('keeps tournament settings under meta, clear of the score branches', async () => {
    const store = createStore('default');
    await store.saveTournament({ name: 'Undo Classic', settings: { skinsValuePerHole: 20 } });

    expect(readAt(`${BASE}/meta/name`)).toBe('Undo Classic');
    expect(readAt(`${BASE}/meta/settings`)).toEqual({ skinsValuePerHole: 20 });
    expect(readAt(`${BASE}/players`)).toBeNull();
  });

  it('surfaces a team edit to subscribers', async () => {
    const store = createStore('default');
    const { seen, unsub } = subscribeAndCapture(store);

    await store.upsertTeam({ id: 't2', name: 'Nolan / Reed', playerIds: ['a', 'b'] });

    expect(seen.current.teams).toHaveLength(1);
    expect(seen.current.teams[0]).toMatchObject({ id: 't2', name: 'Nolan / Reed' });

    await store.removeTeam('t2');
    expect(seen.current.teams).toEqual([]);
    unsub();
  });

  it('reports the connection dropping so the app can flag stale scores', () => {
    const store = createStore('default');
    const { seen, unsub } = subscribeAndCapture(store);
    expect(seen.current.connected).toBe(true);

    writeAt('.info/connected', false);
    expect(seen.current.connected).toBe(false);
    unsub();
  });

  it('stops listening once unsubscribed', async () => {
    const store = createStore('default');
    const { seen, unsub } = subscribeAndCapture(store);
    await settle();
    const before = seen.current;
    unsub();

    await store.setHoleScore('p1', 1, 4);
    await settle();
    expect(seen.current).toBe(before);
    expect(listeners).toHaveLength(0);
  });
});
