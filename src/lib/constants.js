/**
 * Flight definitions.
 *
 * `rank` is *playing strength*, lowest number = strongest. It drives which
 * flight a better-ball team lands in: the team plays in the stronger player's
 * flight. Senior is really an age flight rather than a skill flight, so the
 * committee can re-rank it from the Admin tab (settings.flightRanks) — e.g. if
 * a Senior + First team should play First rather than Senior.
 *
 * `team`  - flight participates in the 2-man better ball.
 * `skins` - flight participates in skins.
 */
export const FLIGHTS = [
  { id: 'championship', label: 'Championship', short: 'CH', rank: 1, team: true, skins: true },
  { id: 'first', label: 'First', short: '1st', rank: 2, team: true, skins: true },
  { id: 'senior', label: 'Senior', short: 'SR', rank: 3, team: true, skins: true },
  { id: 'ladies', label: 'Ladies', short: 'LD', rank: 4, team: false, skins: false },
  { id: 'junior', label: 'Junior', short: 'JR', rank: 5, team: false, skins: false },
];

export const FLIGHT_BY_ID = Object.fromEntries(FLIGHTS.map((f) => [f.id, f]));

/** Flights that field better-ball teams and skins. */
export const TEAM_FLIGHTS = FLIGHTS.filter((f) => f.team);
export const SKINS_FLIGHTS = FLIGHTS.filter((f) => f.skins);

/** Flights scored individually only (Ladies / Junior). */
export const INDIVIDUAL_ONLY_FLIGHTS = FLIGHTS.filter((f) => !f.team);

export const flightLabel = (id) => FLIGHT_BY_ID[id]?.label ?? id ?? 'Unassigned';

/**
 * The tournament course card: hole number and par, nothing else.
 *
 * Par 72 — 36 out / 36 in. Everything is scored gross, so no stroke index or
 * yardage is needed. Par is editable per tournament from the Admin tab.
 */
export const DEFAULT_HOLES = [
  { number: 1, par: 4 },
  { number: 2, par: 3 },
  { number: 3, par: 5 },
  { number: 4, par: 4 },
  { number: 5, par: 4 },
  { number: 6, par: 5 },
  { number: 7, par: 3 },
  { number: 8, par: 4 },
  { number: 9, par: 4 },
  { number: 10, par: 5 },
  { number: 11, par: 3 },
  { number: 12, par: 5 },
  { number: 13, par: 4 },
  { number: 14, par: 3 },
  { number: 15, par: 4 },
  { number: 16, par: 4 },
  { number: 17, par: 4 },
  { number: 18, par: 4 },
];

export const DEFAULT_SETTINGS = {
  /** Unclaimed (tied) holes carry their skin forward to the next hole. */
  skinsCarryover: true,
  /** 'field' scores skins across all eligible players together;
   *  'flight' runs a separate skins game inside each eligible flight. */
  skinsScope: 'field',
  /** Dollars per hole, used to show the payout column. 0 hides it. */
  skinsValuePerHole: 0,
  /** Overrides for FLIGHTS[].rank, keyed by flight id. */
  flightRanks: {},
};

export const DEFAULT_TOURNAMENT = {
  name: "Undo's Amateur Golf Classic",
  date: new Date().toISOString().slice(0, 10),
  courseName: '',
  holes: DEFAULT_HOLES,
  settings: DEFAULT_SETTINGS,
};
