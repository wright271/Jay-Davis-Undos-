# Undo's Amateur Golf Classic — Scoring

Live scoring for a flighted amateur tournament — individual stroke play, 2-man
better ball, and skins, all driven from one set of hole-by-hole scores.

Everything is scored **gross**: strokes taken, straight up. No handicaps.

## How the tournament is scored

**Every player turns in an individual card.** That single card feeds all three
games, so a score is only ever entered once.

| Flight | Individual | Better ball | Skins |
| --- | :---: | :---: | :---: |
| Championship | ✅ | ✅ | ✅ |
| First | ✅ | ✅ | ✅ |
| Senior | ✅ | ✅ | ✅ |
| Ladies | ✅ | — | — |
| Junior | ✅ | — | — |

- **Individual** — every player in the field, ranked within their own flight
  (each flight numbers from 1) or across the whole field.
- **Better ball** — 2-man teams take their best score on each hole. Both
  partners still post their own card for the individual leaderboard.
- **Skins** — outright low score on a hole wins it. Ties push, and by default
  the skin carries to the next hole won. Ladies and Junior flights are not in
  the game.

### Which flight does a team play in?

**A team plays in its stronger player's flight.** A Championship player paired
with a First flight player makes a Championship flight team.

Strength is ranked Championship → First → Senior. Senior is an age flight
rather than a skill flight, so if the committee wants a Senior + First pairing
to play Senior instead, change the numbers under **Admin → Settings → Flight
strength** — lower is stronger. Ladies and Junior players cannot be put on a
team; the team builder blocks it and the leaderboard flags any team that
somehow ends up with one.

### Ties

Broken by matching cards: back 9, then 6, then 3, then the 18th. A genuine
dead heat is shown as a shared position (T1) rather than being ordered
arbitrarily.

## The course

Par 72 — 36 out, 36 in. The card holds a hole number and a par, nothing else.
Edit par per hole under **Admin → Course**.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # scoring engine unit tests
npm run build
```

`npm run dev` talks to the real Firebase project. If Firestore is unreachable
the app says so and falls back to the last scores that device saw, rather than
silently showing an empty leaderboard.

## Firebase

The app is already wired to the **jay-davis-undos** Firebase project — the web
config lives in `src/lib/firebaseConfig.js`. A Firebase web config is public by
design: it identifies the project and is compiled into the bundle every phone
downloads. `firestore.rules` is what actually controls who can write (anyone
may read the leaderboards; only signed-in organisers may post scores).

Two things still have to be switched on in the
[Firebase console](https://console.firebase.google.com/project/jay-davis-undos)
before scores will sync between phones:

1. **Firestore** — Build → Firestore Database → Create database (production
   mode). Until this is done the app shows "Not connected" and keeps working
   against whatever that phone last saw.
2. **Email/Password auth** — Build → Authentication → Sign-in method →
   Email/Password → Enable. Then add a user per organiser under the Users tab.
   Those accounts are the only ones that can edit the field or post scores.

Then publish the security rules:

```bash
npx firebase deploy --only firestore:rules
```

`.firebaserc` already points at the project, so no `firebase init` is needed.

## Deploying

Pushing to `main` builds and deploys to Firebase Hosting via
`.github/workflows/deploy.yml`. It needs one repository secret under
**Settings → Secrets and variables → Actions**:

- `FIREBASE_SERVICE_ACCOUNT` — from **Project settings → Service accounts →
  Generate new private key**, pasted as JSON.

The Firebase web config is already in the repo, so no other secrets are
required. The `VITE_FIREBASE_*` secrets are optional overrides if you ever want
a build to point at a different project.

Or deploy by hand:

```bash
npm run build && npx firebase deploy --only hosting
```

## Running the event

1. **Admin → Players** — add the field, or paste it in under Bulk import
   (`First, Last, Flight` per line).
2. **Admin → Teams** — pair the 2-man better ball teams. Ladies and Junior
   players are not offered.
3. **Admin → Settings** — skins scope, carryover and value per skin.
4. **Scores** — players post hole by hole out on the course; the leaderboards
   update live.

Admin lives at the bottom of the **Teams** tab.

## Layout

```
src/lib/scoring.js       all scoring logic, pure functions, unit tested
src/lib/scoring.test.js  32 tests covering flighting, better ball, skins, ties
src/lib/store.js         Firestore and localStorage adapters, one interface
src/lib/constants.js     flights, course card, default settings
src/lib/firebaseConfig.js  project config, overridable per environment
src/components/          one file per tab
firestore.rules          public read, organiser-only writes
```
