/**
 * Pure scoring logic. No React, no Firebase — everything here is a plain
 * function over plain data so it can be unit tested (see scoring.test.js).
 *
 * Everything is scored gross: the number of strokes taken, straight up. There
 * are no handicaps, so no stroke index or yardage is carried on a hole.
 *
 * Shared shapes:
 *   hole   { number, par }
 *   player { id, firstName, lastName, flight, teamId }
 *   team   { id, name, playerIds: [id, id] }
 *   card   { holes: { '1': 5, '2': 4, ... } }   // strokes, sparse
 */

import { FLIGHT_BY_ID, FLIGHTS } from './constants.js';

/* ------------------------------------------------------------------ *
 * Per-player round
 * ------------------------------------------------------------------ */

const scoreOn = (card, holeNumber) => {
  const v = card?.holes?.[String(holeNumber)];
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * Expand one player's card into per-hole scores plus totals.
 *
 * Only holes with a posted score count toward the total, so a round in
 * progress reports an honest `thru` and a running score.
 */
export function playerRound(player, card, holes) {
  const perHole = holes.map((h) => {
    const gross = scoreOn(card, h.number);
    return {
      number: h.number,
      par: h.par,
      gross,
      toPar: gross === null ? null : gross - h.par,
    };
  });

  const played = perHole.filter((h) => h.gross !== null);

  return {
    playerId: player?.id,
    holes: perHole,
    byNumber: Object.fromEntries(perHole.map((h) => [h.number, h])),
    thru: played.length,
    complete: played.length === holes.length,
    gross: played.reduce((t, h) => t + h.gross, 0),
    toPar: played.reduce((t, h) => t + h.toPar, 0),
    parPlayed: played.reduce((t, h) => t + h.par, 0),
  };
}

/* ------------------------------------------------------------------ *
 * Tie breaking — matching cards
 * ------------------------------------------------------------------ */

/** Sum scores over a range of hole numbers. */
function sumRange(perHole, from, to) {
  let total = 0;
  let counted = 0;
  for (const h of perHole) {
    if (h.number >= from && h.number <= to && h.gross !== null) {
      total += h.gross;
      counted += 1;
    }
  }
  return counted === 0 ? null : total;
}

/**
 * Compare two rounds by matching cards: back 9, then 6, 3, and the last hole.
 * Returns a negative number if `a` finishes ahead of `b`. Ties that survive
 * every segment return 0 and should be shown as a genuine tie (card off or
 * shared prize money).
 */
export function matchingCards(a, b, holeCount = 18) {
  const segments = [
    [holeCount - 8, holeCount], // back 9
    [holeCount - 5, holeCount], // back 6
    [holeCount - 2, holeCount], // back 3
    [holeCount, holeCount], // 18th
  ];
  for (const [from, to] of segments) {
    const av = sumRange(a.holes, from, to);
    const bv = sumRange(b.holes, from, to);
    if (av === null || bv === null) continue;
    if (av !== bv) return av - bv;
  }
  return 0;
}

/**
 * Sort comparator for leaderboards: fewest strokes first, players with no
 * score at all pushed to the bottom, ties broken by matching cards.
 */
function leaderboardComparator() {
  return (a, b) => {
    if (a.thru === 0 && b.thru === 0) return 0;
    if (a.thru === 0) return 1;
    if (b.thru === 0) return -1;
    if (a.gross !== b.gross) return a.gross - b.gross;
    // A finished round beats one still on the course at the same total.
    if (a.thru !== b.thru) return b.thru - a.thru;
    return matchingCards(a, b);
  };
}

/**
 * Sort rows, mark genuine dead heats, and number the positions.
 *
 * Always run this over exactly the group being displayed: a flight's
 * leaderboard has to read 1, 2, 3 within that flight, not carry the player's
 * position in the overall field.
 */
export function rankRows(rows) {
  const ranked = [...rows].sort(leaderboardComparator());
  ranked.forEach((row, i) => {
    const prev = ranked[i - 1];
    row.tieBreakEqual =
      !!prev && prev.thru > 0 && row.thru > 0 && prev.gross === row.gross && matchingCards(prev, row) === 0;
  });
  return applyPositions(ranked);
}

/** Assign 1,2,3 style positions, sharing a position across true ties (T3). */
function applyPositions(rows) {
  let lastValue = null;
  let lastPos = 0;
  rows.forEach((row, i) => {
    if (row.thru === 0) {
      row.position = null;
      row.positionLabel = '—';
      return;
    }
    const tied = lastValue !== null && row.gross === lastValue && row.tieBreakEqual;
    if (!tied) {
      lastPos = i + 1;
      lastValue = row.gross;
    }
    row.position = lastPos;
    row.positionLabel = String(lastPos);
  });
  // Mark shared positions with a T prefix.
  const counts = rows.reduce((m, r) => {
    if (r.position) m[r.position] = (m[r.position] || 0) + 1;
    return m;
  }, {});
  rows.forEach((r) => {
    if (r.position && counts[r.position] > 1) r.positionLabel = `T${r.position}`;
  });
  return rows;
}

/* ------------------------------------------------------------------ *
 * Individual leaderboard
 * ------------------------------------------------------------------ */

/**
 * Individual leaderboard rows for one flight or the whole field.
 *
 * Every player turns in an individual card — including players who are also
 * on a better-ball team — so this covers the entire field.
 */
export function individualLeaderboard(players, cards, holes) {
  const rows = players.map((player) => {
    const round = playerRound(player, cards[player.id], holes);
    return {
      ...round,
      player,
      name: playerName(player),
      flight: player.flight,
    };
  });

  return rankRows(rows);
}

/**
 * Group leaderboard rows by flight, in flight order.
 *
 * Positions are recomputed inside each flight, so every flight is numbered
 * from 1 — a player who sits 6th in the overall field but leads their flight
 * shows as 1 here.
 */
export function byFlight(rows, flights = FLIGHTS) {
  return flights
    .map((flight) => ({
      flight,
      rows: rankRows(rows.filter((r) => r.flight === flight.id).map((r) => ({ ...r }))),
    }))
    .filter((g) => g.rows.length > 0);
}

/* ------------------------------------------------------------------ *
 * Better ball
 * ------------------------------------------------------------------ */

/** Effective strength rank for a flight, honouring committee overrides. */
export function flightRank(flightId, settings = {}) {
  const override = settings.flightRanks?.[flightId];
  if (Number.isFinite(Number(override))) return Number(override);
  return FLIGHT_BY_ID[flightId]?.rank ?? 99;
}

/**
 * A team plays in its stronger player's flight: pair a Championship player
 * with a First flight player and the team plays Championship.
 */
export function teamFlight(members, settings = {}) {
  const eligible = members.filter((m) => m && FLIGHT_BY_ID[m.flight]?.team);
  if (eligible.length === 0) return null;
  return eligible.reduce((best, m) =>
    flightRank(m.flight, settings) < flightRank(best.flight, settings) ? m : best,
  ).flight;
}

/**
 * Reasons a team cannot be scored in the better ball, as human-readable
 * strings. An empty array means the team is good to go.
 */
export function teamProblems(team, members, settings = {}) {
  const problems = [];
  const found = members.filter(Boolean);
  if (found.length < 2) problems.push('Team needs two players.');
  if (found.length > 2) problems.push('Better ball teams are two players.');
  for (const m of found) {
    const f = FLIGHT_BY_ID[m.flight];
    if (!f) problems.push(`${playerName(m)} has no flight assigned.`);
    else if (!f.team) problems.push(`${f.label} flight plays individual only — ${playerName(m)} cannot be on a team.`);
  }
  return problems;
}

/**
 * Better ball of partners: on each hole the team takes its best single score.
 *
 * A hole counts as soon as one partner has posted it, which keeps the running
 * total honest when partners enter scores at different times.
 */
export function teamRound(team, members, cards, holes) {
  const rounds = members.map((m) => playerRound(m, cards[m.id], holes));

  const perHole = holes.map((h) => {
    const candidates = rounds
      .map((r, i) => ({ value: r.byNumber[h.number]?.gross, member: members[i] }))
      .filter((c) => c.value !== null && c.value !== undefined);

    if (candidates.length === 0) {
      return { number: h.number, par: h.par, gross: null, toPar: null, contributor: null };
    }
    const best = candidates.reduce((b, c) => (c.value < b.value ? c : b));
    return {
      number: h.number,
      par: h.par,
      gross: best.value,
      toPar: best.value - h.par,
      contributor: best.member,
    };
  });

  const played = perHole.filter((h) => h.gross !== null);

  return {
    teamId: team.id,
    holes: perHole,
    byNumber: Object.fromEntries(perHole.map((h) => [h.number, h])),
    thru: played.length,
    complete: played.length === holes.length,
    gross: played.reduce((t, h) => t + h.gross, 0),
    toPar: played.reduce((t, h) => t + h.toPar, 0),
    memberRounds: rounds,
  };
}

/**
 * Better-ball leaderboard. Teams containing an individual-only player are
 * returned separately as `invalid` rather than silently dropped, so the
 * committee can see and fix the pairing.
 */
export function betterBallLeaderboard(teams, players, cards, holes, settings = {}) {
  const byId = Object.fromEntries(players.map((p) => [p.id, p]));
  const rows = [];
  const invalid = [];

  for (const team of teams) {
    const members = (team.playerIds || []).map((id) => byId[id]).filter(Boolean);
    const problems = teamProblems(team, members, settings);
    if (problems.length) {
      invalid.push({ team, members, problems });
      continue;
    }
    const round = teamRound(team, members, cards, holes);
    rows.push({
      ...round,
      team,
      members,
      name: team.name || members.map((m) => lastNameOf(m)).join(' / '),
      flight: teamFlight(members, settings),
    });
  }

  return { rows: rankRows(rows), invalid };
}

/* ------------------------------------------------------------------ *
 * Skins
 * ------------------------------------------------------------------ */

/** Players eligible for skins — team flights only, so no Ladies or Junior. */
export function skinsEligible(players) {
  return players.filter((p) => FLIGHT_BY_ID[p.flight]?.skins);
}

/**
 * Score one skins game.
 *
 * A hole is won outright by the single lowest score. Ties push: with carryover
 * on, the skin rolls into the next hole and the winner there collects the pile.
 * A hole nobody has finished yet stays `pending` and does not carry.
 */
export function computeSkins(players, cards, holes, settings = {}) {
  const carryover = settings.skinsCarryover !== false;
  const rounds = players.map((p) => ({ player: p, round: playerRound(p, cards[p.id], holes) }));

  let carried = 0;
  const results = holes.map((h) => {
    const entries = rounds
      .map(({ player, round }) => ({ player, value: round.byNumber[h.number]?.gross }))
      .filter((e) => e.value !== null && e.value !== undefined);

    const base = { number: h.number, par: h.par, entries };

    if (entries.length === 0) {
      return { ...base, status: 'pending', winner: null, best: null, skins: 0, carriedIn: carried };
    }

    const best = Math.min(...entries.map((e) => e.value));
    const leaders = entries.filter((e) => e.value === best);
    const carriedIn = carried;

    if (leaders.length === 1) {
      const skins = 1 + carriedIn;
      carried = 0;
      return { ...base, status: 'won', winner: leaders[0].player, best, skins, carriedIn, tiedBy: 1 };
    }

    if (carryover) carried = carriedIn + 1;
    return {
      ...base,
      status: 'tied',
      winner: null,
      best,
      skins: 0,
      carriedIn,
      tiedBy: leaders.length,
      leaders: leaders.map((l) => l.player),
    };
  });

  // Tally per player.
  const tally = new Map();
  for (const r of results) {
    if (r.status !== 'won') continue;
    const cur = tally.get(r.winner.id) || { player: r.winner, skins: 0, holes: [] };
    cur.skins += r.skins;
    cur.holes.push(r.number);
    tally.set(r.winner.id, cur);
  }

  const value = Number(settings.skinsValuePerHole) || 0;
  const winners = [...tally.values()]
    .map((w) => ({ ...w, payout: w.skins * value }))
    .sort((a, b) => b.skins - a.skins || a.player.lastName?.localeCompare(b.player.lastName));

  return {
    holes: results,
    winners,
    carrying: carried,
    valuePerHole: value,
    skinsAwarded: results.reduce((t, r) => t + r.skins, 0),
  };
}

/**
 * Skins split into separate games per flight, or one game across the whole
 * eligible field, per settings.skinsScope.
 */
export function skinsGames(players, cards, holes, settings = {}) {
  const eligible = skinsEligible(players);
  if (settings.skinsScope === 'flight') {
    return FLIGHTS.filter((f) => f.skins)
      .map((flight) => ({
        key: flight.id,
        label: `${flight.label} Flight`,
        players: eligible.filter((p) => p.flight === flight.id),
      }))
      .filter((g) => g.players.length > 0)
      .map((g) => ({ ...g, result: computeSkins(g.players, cards, holes, settings) }));
  }
  return [
    {
      key: 'field',
      label: 'Full Field',
      players: eligible,
      result: computeSkins(eligible, cards, holes, settings),
    },
  ];
}

/* ------------------------------------------------------------------ *
 * Misc helpers
 * ------------------------------------------------------------------ */

export const playerName = (p) => (p ? `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || 'Unnamed' : '');
export const lastNameOf = (p) => p?.lastName?.trim() || playerName(p);

/** '+3' / 'E' / '-2' for display. */
export function formatToPar(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  if (n === 0) return 'E';
  return n > 0 ? `+${n}` : String(n);
}

export const totalPar = (holes) => holes.reduce((t, h) => t + h.par, 0);

/** Out / In / Total splits for a set of per-hole scores. */
export function nineSplits(perHole) {
  const half = Math.floor(perHole.length / 2);
  const sum = (arr) => {
    const vals = arr.map((h) => h.gross).filter((v) => v !== null && v !== undefined);
    return vals.length ? vals.reduce((t, v) => t + v, 0) : null;
  };
  return {
    out: sum(perHole.slice(0, half)),
    in: sum(perHole.slice(half)),
    total: sum(perHole),
  };
}
