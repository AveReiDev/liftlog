# Lift Log — notes for Claude

Strength-training log PWA, built for one lifter. Plain static
files, **no build step, no dependencies**. Read `PROJECT-STATUS.md` for history
and design decisions before changing behaviour. Same conventions as `../strikr`.

## What it's for

1. Progressive overload: sets/reps stay fixed per plan; starting a plan
   pre-fills each weight from last time, with a one-tap "Try +step" chip.
2. Busy equipment: "Busy? Swap" suggests exercises with the same movement
   pattern on a free station her gym has (Settings → My gym).

## Hosting

Live at https://avereidev.github.io/liftlog/ (GitHub Pages, `main`, repo root).
**`git push` to `main` publishes to her phone**: only push work that passed tests
and a browser smoke test, and confirm with the user first.

## Privacy

The repo is public. **Never commit anyone's training data, names or backup
files.** Her old notes-app history is imported from a backup file built by a
script in a private folder beside this repo (see the parent workspace), never
from anything in here. `.gitignore` blocks `*import*.json` and `*backup*.json`.
`data/exercises.json` is a generic library and is fine to publish.

## Commands

- Tests: `npm test` (node:test, `node --test 'test/*.test.js'`)
- Browser smoke test: the built-in browser's launcher can't read ~/Desktop, so
  rsync this folder to the session scratchpad and serve it from there with
  `.claude/launch.json` (config "liftlog", port 8445). Re-sync after edits and reload.
- Icons: `python3 tools/make-icons.py` (needs Pillow), then commit the PNGs.

## Rules

- **After changing any shipped file, bump `CACHE_VERSION` in `sw.js`.** New
  files under `src/` must also be added to its `SHELL` list. The pre-commit hook
  enforces both (enable with `git config core.hooksPath .githooks`).
- `src/engine/` stays pure: no DOM, no clock. `main.js` owns `now()`/`today()`.
- Stores sanitise everything they read; bad stored data falls back, never throws.
- Exercise ids are permanent: history refers to them. Custom exercises are
  archived on delete, never erased. Rename freely; never change an id.
- localStorage keys: `liftlog.v1.{settings,library,workouts,history,active}`.
- Weight conventions: per-side machines (`per: "side"`) log one side; double
  kettlebells/dumbbells (`per: "hand"`) log one bell. `assist` and `time` are
  lower-is-better.
