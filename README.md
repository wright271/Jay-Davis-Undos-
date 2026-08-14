# Undo's Amateur Golf Classic — Scoring

One file. `index.html` is the whole app — open it and it runs.

**Live:** https://wright271.github.io/Jay-Davis-Undos-/

Everything is scored **gross** — strokes taken, straight up. No handicaps.

## The three games

Every player turns in **one individual card**. Those same scores feed all three
games, so a score is only ever entered once.

| Flight | Individual | Better ball | Skins |
| --- | :---: | :---: | :---: |
| Championship | ✅ | ✅ | ✅ |
| First | ✅ | ✅ | ✅ |
| Senior | ✅ | ✅ | ✅ |
| Ladies | ✅ | — | — |
| Junior | ✅ | — | — |

- **Individual** — the whole field, ranked inside each flight.
- **Better ball** — 2-man teams take their best score on each hole. Both
  partners still post their own card for the individual leaderboard.
- **Skins** — outright low score on a hole wins it; a tie pushes and nobody
  takes it. Ladies and Junior are not in the game.

**A team plays in its stronger player's flight** — a Championship player paired
with a First flight player makes a Championship team. Ladies and Junior players
are not offered in the team builder at all.

Leaderboards rank on **score to par**, so a player still out on the course is
compared fairly against one who has finished.

## Running the event

1. Open the link, go to **Better Ball → Admin** (bottom of the page), enter the
   password.
2. **Players** — add the field and set each player's flight. Or use **Bulk
   roster** and paste one player per line: `Jay Davis, Championship`.
3. **Teams** — pair the two-man teams.
4. **Course / Par** — adjust par per hole if needed (defaults to par 72).
5. Players tap their own name on the **Individual** tab and enter scores hole by
   hole. Everything updates live on every phone.

## Setup

Two constants at the top of the `<script>` block in `index.html`:

```js
const DB_PATH = 'undos';            // the key in the database
const ADMIN_PASSWORD = "captain";   // change this before sharing the link
```

**Change the password before you send the link out.** Anyone who opens the link
can watch the leaderboards; only the password unlocks the roster and settings.

### Firebase

Uses the **jay-davis-undos** Realtime Database. The config is already in the
file. Paste `database.rules.json` into the Firebase console under **Realtime
Database → Rules → Publish**.

The data lives under one key:

```
undos/
  eventName
  par/0..17
  players/<id>   { name, flight, scores: { h0..h17 } }
  teams/<id>     { a: <playerId>, b: <playerId> }
```

Scores are written one hole at a time (`players/<id>/scores/h6`), so two people
scoring the same group never overwrite each other.

The rules allow writes without a login — the admin password is what gates the
UI, not the database. That matches how the events have been run before. The
rules do still check the shape of everything written: a score must be a whole
number from 1 to 20 on a real hole, and a flight must be one of the five.

## Publishing changes

Edit `index.html`, commit, push to `main`. GitHub Pages serves it — no build, no
install, no deploy step.
