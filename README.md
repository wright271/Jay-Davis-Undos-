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

  Not everyone pays into the skins, so each player has an **In the skins**
  tickbox under Admin → Players. Everyone in an eligible flight starts ticked;
  untick whoever did not pay. **All in** and **None** buttons do the whole field
  at once. Unticking a player only removes them from the skins — they still
  appear on the individual leaderboard and in their better ball team.

**A team plays in its stronger player's flight** — a Championship player paired
with a First flight player makes a Championship team. Ladies and Junior players
are not offered in the team builder at all.

Leaderboards rank on **score to par**, so a player still out on the course is
compared fairly against one who has finished.

## Running the event

1. Open the link, go to **Leaderboard → Admin** (bottom of the page), enter the
   password.
2. **Tee sheet → Load the Saturday tee sheet.** The final Saturday pairings are
   built into the page: 33 groups, 128 players with their flights and tee times,
   and the 59 better ball pairings. The first two names in a group are Team 1,
   the last two are Team 2. The Ladies and Junior groups load as players only,
   and group 15 is a threesome, so its third player has no better ball partner.
3. Or build it by hand — **Players** to add the field and set flights (or
   **Bulk roster**, one player per line: `Jay Davis, Championship`), then
   **Teams** to pair them.

   A late addition does not need the sheet reloaded. Add them under
   **Players**, set their **Group** — the tee time fills in from the others in
   that group and they go on the end of it — then pair them under **Teams**.
4. **Course / Par** — adjust par per hole if needed (defaults to par 72).
5. **Tee Times → SCORE** on a group. One card holds the whole foursome — a
   column per player, a row per hole — so one person keeps the card for the
   group. Everything updates live on every phone.

Three tabs: **Tee Times** (where scores are entered), **Leaderboard** and
**Skins**. Leaderboard holds the **Better Ball** and **Individual** standings on
its own tabs. Everything outside Tee Times is read-only.

Reloading the tee sheet replaces the field and clears posted scores, so do it
before play starts.

## Sponsor logos

The header shows a sponsor bar. Drop these three files in beside `index.html`
and they appear automatically; until then the bar hides itself.

| File | Sponsor |
| --- | --- |
| `undos.png` | Undo's — main sponsor, shown larger and centred |
| `glessner.png` | The Glessner Group |
| `united-dairy.png` | United Dairy |

PNG with a transparent or white background works best. They sit on a white
strip, sized to fit, so any reasonable dimensions are fine.

## Setup

Two constants at the top of the `<script>` block in `index.html`:

```js
const DB_PATH = 'undos';            // the key in the database
const ADMIN_PASSWORD = "davis";     // committee password for the Admin screen
```

Anyone who opens the link can watch the leaderboards; only the password unlocks
the roster and settings. Change it here and push to update it.

### Firebase

Uses the **jay-davis-undos** Realtime Database. The config is already in the
file. Paste `database.rules.json` into the Firebase console under **Realtime
Database → Rules → Publish**.

The data lives under one key:

```
undos/
  eventName
  par/0..17
  players/<id>   { name, flight, tee, grp, ord, scores: { h0..h17 } }
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
