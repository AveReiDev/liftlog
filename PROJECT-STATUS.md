# Lift Log — project summary

Last updated 12 October 2026.

## Where it stands

**v1.0.0 is live at https://avereidev.github.io/liftlog/** (repo: github.com/AveReiDev/liftlog,
GitHub Pages from `main`, repo root). Awaiting install and first use on her phone.

| Area | State |
|---|---|
| Exercise library (103 exercises, 37 stations) | Done |
| Plans (create, edit, reorder; blocks for supersets) | Done |
| Logging (pre-filled weights, +/−, Try chip, new-best badge, notes) | Done |
| Busy? Swap (pattern-matched alternates, busy stations, My gym filter) | Done |
| Progress (PR board, sparklines, per-lift chart with estimated 1RM, weekly bars) | Done |
| History (by month, fix a number, do again, delete) | Done |
| Backup export / import (merge, never overwrite) | Done |
| Offline service worker, home-screen icons | Done |
| Her notes-app history (13 sessions, 3 plans) | Import file ready, outside the repo |

36 tests pass: `npm test`.

## Design decisions

- **Weights are not part of a plan.** A plan holds exercises, sets and reps.
  The weight comes from her history each time. This matches how she already
  logged: copy last session, change the one number that moved.
- **Suggest, don't auto-increase.** The box pre-fills with last time's weight;
  a "Try 90 lb" chip offers one step up. Her coach decides when weight goes up.
- **Stations, not brands.** Alternates are picked by movement pattern and the
  station people queue for (cable stack, squat rack). "My gym" lists what a big
  club like Equinox usually has; she switches off what her location lacks. I
  couldn't verify a standard Equinox equipment list, so it's a checklist she
  edits, not a claim about her club.
- **Kettlebell steps walk real bell sizes** (12 → 14 → 16 kg), not +2.
- **Assisted pull-ups track machine help**, so lower is better and the app
  says so wherever it matters.
- **Undated sessions** from her notes have placeholder January 2025 dates, are
  flagged `approxDate`, show as "in your old notes", and are left out of the
  weekly chart.
- **Data lives on the phone** (localStorage). Backup export via the iOS share
  sheet is the safety net.

## Getting it on her phone

1. Open **https://avereidev.github.io/liftlog/** in **Safari** on her iPhone.
2. Share → **Add to Home Screen**. Open it from the icon; it works offline.
3. AirDrop the import file (kept outside this repo) to her phone and save it to Files.
4. In the app: Settings → Import backup → pick that file.

**Releasing an update:** bump `CACHE_VERSION` in `sw.js`, commit, push. The
phone picks it up the next time the app opens with signal.

## Ideas for later

- Rest timer between sets.
- Per-set logging for ramps (65×5, 85×5, 100×5×5) instead of a note.
- Nudge when a lift has been at the same weight for 3+ sessions.
- Share a progress snapshot with her coach.
