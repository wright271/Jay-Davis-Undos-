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

Without Firebase configured the app stores everything in the browser on that
one device — good for a practice round or trying it out, but scores do not
sync between phones.

## Firebase setup

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com).
2. **Build → Firestore Database → Create database** (production mode).
3. **Build → Authentication → Sign-in method → Email/Password → Enable**, then
   add a user for each organiser under the Users tab. These are the only
   accounts that can edit the field or post scores.
4. **Project settings → General → Your apps → Web app** — copy the config
   values into a `.env` file:

   ```bash
   cp .env.example .env   # then paste your values in
   ```

5. Publish the security rules (leaderboards public to read, writes require a
   signed-in organiser):

   ```bash
   npx firebase deploy --only firestore:rules
   ```

The config values in `.env` are public by design — they identify the project,
they do not grant access. `firestore.rules` is what controls who can write.

## Deploying

Pushing to `main` builds and deploys to Firebase Hosting via
`.github/workflows/deploy.yml`. Add these repository secrets under
**Settings → Secrets and variables → Actions**:

- `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
  `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`,
  `VITE_FIREBASE_APP_ID`, `VITE_TOURNAMENT_ID`
- `FIREBASE_SERVICE_ACCOUNT` — from **Project settings → Service accounts →
  Generate new private key**, pasted as JSON.

Run `npx firebase init hosting` once locally to link the project, or set it up
in the console.

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
src/components/          one file per tab
firestore.rules          public read, organiser-only writes
```
