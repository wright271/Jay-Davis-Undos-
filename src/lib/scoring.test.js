import { describe, it, expect } from 'vitest';
import { DEFAULT_HOLES, FLIGHTS } from './constants.js';
import {
  playerRound,
  individualLeaderboard,
  byFlight,
  teamFlight,
  teamProblems,
  teamRound,
  betterBallLeaderboard,
  skinsEligible,
  computeSkins,
  skinsGames,
  matchingCards,
  formatToPar,
  totalPar,
} from './scoring.js';

const HOLES = DEFAULT_HOLES;

/** Build a card from an array of 18 scores. */
const card = (scores) => ({
  holes: Object.fromEntries(scores.map((s, i) => [String(i + 1), s]).filter(([, s]) => s != null)),
});
/** An even-par round: every hole played to its par. */
const parCard = () => card(HOLES.map((h) => h.par));
const player = (id, over = {}) => ({
  id,
  firstName: id.toUpperCase(),
  lastName: 'Player',
  flight: 'championship',
  ...over,
});

describe('the course card', () => {
  it('is 18 holes of par 72', () => {
    expect(HOLES).toHaveLength(18);
    expect(totalPar(HOLES)).toBe(72);
  });

  it('carries only a hole number and a par', () => {
    for (const h of HOLES) {
      expect(Object.keys(h).sort()).toEqual(['number', 'par']);
    }
    expect(HOLES.map((h) => h.number)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
  });
});

describe('playerRound', () => {
  it('totals strokes and to-par for a finished round', () => {
    const r = playerRound(player('a'), parCard(), HOLES);
    expect(r.thru).toBe(18);
    expect(r.complete).toBe(true);
    expect(r.gross).toBe(72);
    expect(r.toPar).toBe(0);
  });

  it('counts only posted holes while a round is in progress', () => {
    const nine = HOLES.map((h, i) => (i < 9 ? h.par : null));
    const r = playerRound(player('a'), card(nine), HOLES);
    expect(r.thru).toBe(9);
    expect(r.complete).toBe(false);
    expect(r.gross).toBe(36);
    expect(r.toPar).toBe(0);
  });

  it('ignores zero and blank entries rather than scoring them', () => {
    const r = playerRound(player('a'), card([4, 0, null, 5, ...Array(14).fill(null)]), HOLES);
    expect(r.thru).toBe(2);
    expect(r.gross).toBe(9);
  });

  it('tracks each hole against its par', () => {
    const r = playerRound(player('a'), card(HOLES.map((h) => h.par + 1)), HOLES);
    expect(r.gross).toBe(90);
    expect(r.toPar).toBe(18);
    expect(r.byNumber[3].par).toBe(5);
    expect(r.byNumber[3].gross).toBe(6);
  });
});

describe('individualLeaderboard', () => {
  it('ranks by strokes and includes every flight', () => {
    const players = [
      player('a', { flight: 'championship' }),
      player('b', { flight: 'first' }),
      player('c', { flight: 'ladies' }),
      player('d', { flight: 'junior' }),
    ];
    const cards = {
      a: parCard(), // 72
      b: card(HOLES.map((h) => h.par + 1)), // 90
      c: card(HOLES.map((h) => h.par - 1)), // 54
      d: card(HOLES.map((h) => h.par + 2)), // 108
    };
    const rows = individualLeaderboard(players, cards, HOLES);
    expect(rows).toHaveLength(4);
    expect(rows[0].player.id).toBe('c');
    expect(rows[0].gross).toBe(54);
    expect(rows.at(-1).player.id).toBe('d');
  });

  it('breaks ties on the back nine and shares positions on a dead heat', () => {
    // All three post 81. `bogeyFront` bogeys the front and pars the back, so
    // it holds the better back nine (36) and wins the card-off.
    const bogeyFront = HOLES.map((h, i) => (i < 9 ? h.par + 1 : h.par));
    const bogeyBack = HOLES.map((h, i) => (i < 9 ? h.par : h.par + 1));
    const players = [player('bogeyFront'), player('bogeyBack'), player('sameCard')];
    const rows = individualLeaderboard(
      players,
      { bogeyFront: card(bogeyFront), bogeyBack: card(bogeyBack), sameCard: card(bogeyFront) },
      HOLES,
    );
    expect(rows.every((r) => r.gross === 81)).toBe(true);
    expect(rows.at(-1).player.id).toBe('bogeyBack');
    // The two identical cards cannot be separated, so they share the lead.
    expect(rows[0].positionLabel).toBe('T1');
    expect(rows[1].positionLabel).toBe('T1');
    expect(rows[2].positionLabel).toBe('3');
  });

  it('numbers each flight from 1 rather than carrying the overall position', () => {
    // The Championship players go low, so the First flight leader sits 3rd
    // overall but must show as 1 inside their own flight.
    const players = [
      player('ch1', { flight: 'championship' }),
      player('ch2', { flight: 'championship' }),
      player('f1', { flight: 'first' }),
      player('f2', { flight: 'first' }),
    ];
    const cards = {
      ch1: card(HOLES.map((h) => h.par - 1)),
      ch2: card(HOLES.map((h) => h.par)),
      f1: card(HOLES.map((h) => h.par + 1)),
      f2: card(HOLES.map((h) => h.par + 2)),
    };
    const rows = individualLeaderboard(players, cards, HOLES);
    expect(rows.find((r) => r.player.id === 'f1').position).toBe(3); // overall

    const groups = byFlight(rows, FLIGHTS);
    const first = groups.find((g) => g.flight.id === 'first');
    expect(first.rows.map((r) => r.player.id)).toEqual(['f1', 'f2']);
    expect(first.rows.map((r) => r.positionLabel)).toEqual(['1', '2']);

    const champ = groups.find((g) => g.flight.id === 'championship');
    expect(champ.rows.map((r) => r.positionLabel)).toEqual(['1', '2']);
    // Grouping must not disturb the overall rows it was derived from.
    expect(rows.find((r) => r.player.id === 'f1').position).toBe(3);
  });

  it('gives ladies and junior players their own leaderboards', () => {
    const players = [
      player('a', { flight: 'championship' }),
      player('l', { flight: 'ladies' }),
      player('j', { flight: 'junior' }),
    ];
    const cards = { a: parCard(), l: parCard(), j: parCard() };
    const groups = byFlight(individualLeaderboard(players, cards, HOLES), FLIGHTS);
    expect(groups.map((g) => g.flight.id)).toEqual(['championship', 'ladies', 'junior']);
    expect(groups.every((g) => g.rows.length === 1 && g.rows[0].positionLabel === '1')).toBe(true);
  });

  it('sorts players with no card to the bottom', () => {
    const rows = individualLeaderboard([player('none'), player('some')], { some: parCard() }, HOLES);
    expect(rows[0].player.id).toBe('some');
    expect(rows[1].thru).toBe(0);
    expect(rows[1].positionLabel).toBe('—');
  });
});

describe('team flighting', () => {
  const settings = {};

  it('places a team in the stronger players flight', () => {
    const ch = player('a', { flight: 'championship' });
    const first = player('b', { flight: 'first' });
    const senior = player('c', { flight: 'senior' });
    expect(teamFlight([ch, first], settings)).toBe('championship');
    expect(teamFlight([first, ch], settings)).toBe('championship');
    expect(teamFlight([first, senior], settings)).toBe('first');
    expect(teamFlight([senior, senior], settings)).toBe('senior');
  });

  it('honours committee rank overrides', () => {
    const first = player('b', { flight: 'first' });
    const senior = player('c', { flight: 'senior' });
    // Committee decides Senior outranks First for team placement.
    const overridden = { flightRanks: { senior: 1.5 } };
    expect(teamFlight([first, senior], overridden)).toBe('senior');
  });

  it('rejects ladies and junior players on a better-ball team', () => {
    const ch = player('a', { flight: 'championship' });
    const lady = player('l', { flight: 'ladies' });
    const jr = player('j', { flight: 'junior' });
    expect(teamProblems({ id: 't' }, [ch, lady])).toHaveLength(1);
    expect(teamProblems({ id: 't' }, [ch, lady])[0]).toMatch(/individual only/i);
    expect(teamProblems({ id: 't' }, [ch, jr])[0]).toMatch(/individual only/i);
    expect(teamProblems({ id: 't' }, [ch, player('b', { flight: 'first' })])).toEqual([]);
  });

  it('flags a team that is missing a partner', () => {
    expect(teamProblems({ id: 't' }, [player('a')])[0]).toMatch(/two players/i);
  });
});

describe('better ball', () => {
  it('takes the best ball on each hole', () => {
    // A birdies the odd holes, B birdies the evens.
    const aScores = HOLES.map((h, i) => (i % 2 === 0 ? h.par - 1 : h.par + 1));
    const bScores = HOLES.map((h, i) => (i % 2 === 0 ? h.par + 1 : h.par - 1));
    const round = teamRound(
      { id: 't' },
      [player('a'), player('b')],
      { a: card(aScores), b: card(bScores) },
      HOLES,
    );
    expect(round.thru).toBe(18);
    expect(round.gross).toBe(totalPar(HOLES) - 18); // a birdie on every hole
    expect(round.toPar).toBe(-18);
  });

  it('counts a hole as soon as one partner posts it', () => {
    const round = teamRound(
      { id: 't' },
      [player('a'), player('b')],
      { a: card([4, ...Array(17).fill(null)]), b: card([null, 3, ...Array(16).fill(null)]) },
      HOLES,
    );
    expect(round.thru).toBe(2);
    expect(round.gross).toBe(7);
  });

  it('records which partner contributed the counting score', () => {
    const aScores = HOLES.map((h) => h.par);
    const bScores = HOLES.map((h, i) => (i === 0 ? h.par - 1 : h.par + 1));
    const round = teamRound(
      { id: 't' },
      [player('a'), player('b')],
      { a: card(aScores), b: card(bScores) },
      HOLES,
    );
    expect(round.byNumber[1].contributor.id).toBe('b');
    expect(round.byNumber[2].contributor.id).toBe('a');
  });

  it('ranks teams and reports unscoreable pairings separately', () => {
    const players = [
      player('a', { flight: 'championship' }),
      player('b', { flight: 'first' }),
      player('c', { flight: 'senior' }),
      player('d', { flight: 'senior' }),
      player('l', { flight: 'ladies' }),
      player('e', { flight: 'championship' }),
    ];
    const teams = [
      { id: 't1', name: 'Mixed flights', playerIds: ['a', 'b'] },
      { id: 't2', name: 'Seniors', playerIds: ['c', 'd'] },
      { id: 't3', name: 'Illegal', playerIds: ['e', 'l'] },
    ];
    const cards = {
      a: parCard(),
      b: card(HOLES.map((h) => h.par + 2)),
      c: card(HOLES.map((h) => h.par + 1)),
      d: card(HOLES.map((h) => h.par + 1)),
      e: parCard(),
      l: parCard(),
    };
    const { rows, invalid } = betterBallLeaderboard(teams, players, cards, HOLES, {});

    expect(rows).toHaveLength(2);
    expect(rows[0].team.id).toBe('t1'); // 72 beats 90
    expect(rows[0].flight).toBe('championship'); // stronger partner's flight
    expect(rows[1].flight).toBe('senior');
    expect(invalid).toHaveLength(1);
    expect(invalid[0].team.id).toBe('t3');
    expect(invalid[0].problems[0]).toMatch(/individual only/i);
  });

  it('numbers better-ball teams from 1 inside each flight', () => {
    const players = [
      player('a', { flight: 'championship' }),
      player('b', { flight: 'championship' }),
      player('c', { flight: 'senior' }),
      player('d', { flight: 'senior' }),
    ];
    const teams = [
      { id: 'champ', playerIds: ['a', 'b'] },
      { id: 'sr', playerIds: ['c', 'd'] },
    ];
    const cards = {
      a: parCard(),
      b: parCard(),
      c: card(HOLES.map((h) => h.par + 3)),
      d: card(HOLES.map((h) => h.par + 3)),
    };
    const { rows } = betterBallLeaderboard(teams, players, cards, HOLES, {});
    const groups = byFlight(rows, FLIGHTS.filter((f) => f.team));
    expect(groups.map((g) => g.flight.id)).toEqual(['championship', 'senior']);
    expect(groups.every((g) => g.rows[0].positionLabel === '1')).toBe(true);
  });
});

describe('skins', () => {
  const field = [
    player('a', { flight: 'championship' }),
    player('b', { flight: 'first' }),
    player('c', { flight: 'senior' }),
    player('lady', { flight: 'ladies' }),
    player('jr', { flight: 'junior' }),
  ];

  it('excludes ladies and juniors from the game', () => {
    expect(skinsEligible(field).map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('never awards a skin to an ineligible player, even with the low score', () => {
    // The junior and lady shoot the lowest rounds but are not in the game.
    const cards = {
      a: parCard(),
      b: parCard(),
      c: parCard(),
      jr: card(HOLES.map((h) => h.par - 2)),
      lady: card(HOLES.map((h) => h.par - 2)),
    };
    const [game] = skinsGames(field, cards, HOLES, { skinsScope: 'field' });
    expect(game.players.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(game.result.holes.every((h) => h.status === 'tied')).toBe(true);
    expect(game.result.winners).toEqual([]);
  });

  it('awards a hole to the outright low score', () => {
    const a = HOLES.map((h, i) => (i === 0 ? h.par - 1 : h.par));
    const result = computeSkins([field[0], field[1]], { a: card(a), b: parCard() }, HOLES, {
      skinsCarryover: false,
    });
    expect(result.holes[0].status).toBe('won');
    expect(result.holes[0].winner.id).toBe('a');
    expect(result.holes[1].status).toBe('tied');
    expect(result.winners[0].player.id).toBe('a');
    expect(result.winners[0].skins).toBe(1);
  });

  it('carries a tied hole forward to the next winner', () => {
    // Holes 1 and 2 tied, A wins hole 3 outright -> collects 3 skins.
    const aScores = HOLES.map((h, i) => (i === 2 ? h.par - 1 : h.par));
    const result = computeSkins([field[0], field[1]], { a: card(aScores), b: parCard() }, HOLES, {
      skinsCarryover: true,
    });
    expect(result.holes[0].status).toBe('tied');
    expect(result.holes[2].status).toBe('won');
    expect(result.holes[2].skins).toBe(3);
    expect(result.holes[2].carriedIn).toBe(2);
    expect(result.winners[0].skins).toBe(3);
  });

  it('does not carry when carryover is off', () => {
    const aScores = HOLES.map((h, i) => (i === 2 ? h.par - 1 : h.par));
    const result = computeSkins([field[0], field[1]], { a: card(aScores), b: parCard() }, HOLES, {
      skinsCarryover: false,
    });
    expect(result.holes[2].skins).toBe(1);
  });

  it('needs an outright low score — two players tied low means no skin', () => {
    const low = HOLES.map((h) => h.par - 1);
    const result = computeSkins(
      [field[0], field[1], field[2]],
      { a: card(low), b: card(low), c: parCard() },
      HOLES,
      { skinsCarryover: true },
    );
    expect(result.holes[0].status).toBe('tied');
    expect(result.holes[0].tiedBy).toBe(2);
    expect(result.skinsAwarded).toBe(0);
  });

  it('leaves unplayed holes pending without carrying them', () => {
    const result = computeSkins(
      [field[0], field[1]],
      { a: card([3, ...Array(17).fill(null)]), b: card([4, ...Array(17).fill(null)]) },
      HOLES,
      { skinsCarryover: true },
    );
    expect(result.holes[0].status).toBe('won');
    expect(result.holes[1].status).toBe('pending');
    expect(result.carrying).toBe(0);
  });

  it('reports the running carry when every hole is halved', () => {
    const result = computeSkins([field[0], field[1]], { a: parCard(), b: parCard() }, HOLES, {
      skinsCarryover: true,
    });
    expect(result.skinsAwarded).toBe(0);
    expect(result.carrying).toBe(18);
    expect(result.winners).toEqual([]);
  });

  it('pays out per skin at the configured value', () => {
    const aScores = HOLES.map((h, i) => (i === 0 ? h.par - 1 : h.par + 5));
    const result = computeSkins([field[0], field[1]], { a: card(aScores), b: parCard() }, HOLES, {
      skinsValuePerHole: 20,
    });
    expect(result.winners.find((w) => w.player.id === 'a').payout).toBe(20);
  });

  it('splits into one game per flight when scoped that way', () => {
    const games = skinsGames(field, {}, HOLES, { skinsScope: 'flight' });
    expect(games.map((g) => g.key)).toEqual(['championship', 'first', 'senior']);
    const fieldGame = skinsGames(field, {}, HOLES, { skinsScope: 'field' });
    expect(fieldGame).toHaveLength(1);
    expect(fieldGame[0].players).toHaveLength(3);
  });
});

describe('matchingCards', () => {
  it('prefers the better back nine, then six, then three, then 18', () => {
    const base = HOLES.map((h) => h.par);
    const a = playerRound(player('a'), card(base), HOLES);
    const only18 = base.map((s, i) => (i === 17 ? s - 1 : s));
    const b = playerRound(player('b'), card(only18), HOLES);
    expect(matchingCards(b, a)).toBeLessThan(0);
    expect(matchingCards(a, a)).toBe(0);
  });
});

describe('formatToPar', () => {
  it('formats even, over and under par', () => {
    expect(formatToPar(0)).toBe('E');
    expect(formatToPar(3)).toBe('+3');
    expect(formatToPar(-2)).toBe('-2');
    expect(formatToPar(null)).toBe('—');
  });
});
