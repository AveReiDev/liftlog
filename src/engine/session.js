/**
 * Building and changing a session in progress.
 *
 * Pure: every function takes a session and returns a new one. The caller
 * (main.js) owns ids and the clock and passes them in.
 *
 * The core idea: starting a plan copies its sets and reps, and pre-fills
 * each weight with what she lifted LAST time, so the only thing she ever has
 * to touch is the one number that moved.
 */

import { lastFor } from './progress.js';

/** One entry, with the weight pre-filled from history. */
export function makeEntry({ exerciseId, block = '', sets = 3, reps = '8' }, history) {
  const last = lastFor(history, exerciseId);
  return {
    exerciseId,
    block,
    sets,
    reps: String(reps),
    value: last?.value ?? null,
    done: false,
  };
}

/** A new session from a saved plan. */
export function startFromWorkout(workout, history, { id, date, now }) {
  return {
    id,
    date,
    title: workout.name,
    workoutId: workout.id,
    startedAt: now,
    entries: workout.items.map((item) => makeEntry(item, history)),
    busy: [],
  };
}

/** "Do this again": a new session with the same exercises as a past one. */
export function startFromSession(past, history, { id, date, now }) {
  return {
    id,
    date,
    title: past.title,
    workoutId: past.workoutId ?? null,
    startedAt: now,
    entries: past.entries.map((e) => makeEntry(e, history)),
    busy: [],
  };
}

export function startEmpty({ id, date, now, title = 'Session' }) {
  return { id, date, title, workoutId: null, startedAt: now, entries: [], busy: [] };
}

export function updateEntry(session, index, patch) {
  const entries = session.entries.map((e, i) => (i === index ? { ...e, ...patch } : e));
  return { ...session, entries };
}

export function addEntry(session, item, history) {
  const block = item.block ?? session.entries.at(-1)?.block ?? '';
  return { ...session, entries: [...session.entries, makeEntry({ ...item, block }, history)] };
}

export function removeEntry(session, index) {
  return { ...session, entries: session.entries.filter((_, i) => i !== index) };
}

export function moveEntry(session, index, dir) {
  const j = index + dir;
  if (j < 0 || j >= session.entries.length) return session;
  const entries = [...session.entries];
  [entries[index], entries[j]] = [entries[j], entries[index]];
  return { ...session, entries };
}

/**
 * Swap an exercise for an alternate. Sets and reps carry over, the weight is
 * re-filled from the alternate's own history, and `swappedFrom` remembers the
 * original so history can show "TRX row (for Seated cable row)".
 */
export function swapEntry(session, index, exerciseId, history) {
  const old = session.entries[index];
  if (!old) return session;
  const fresh = makeEntry({ exerciseId, block: old.block, sets: old.sets, reps: old.reps }, history);
  fresh.swappedFrom = old.swappedFrom ?? old.exerciseId;
  if (fresh.swappedFrom === exerciseId) delete fresh.swappedFrom;   // swapped back to the original
  if (old.note) fresh.note = old.note;
  const entries = session.entries.map((e, i) => (i === index ? fresh : e));
  return { ...session, entries };
}

export function setBusy(session, station, busy) {
  const set = new Set(session.busy ?? []);
  if (busy) set.add(station); else set.delete(station);
  return { ...session, busy: [...set] };
}

/** Group entries for display by block label, keeping order and original indexes. */
export function groupByBlock(entries) {
  const groups = [];
  entries.forEach((entry, index) => {
    const label = entry.block ?? '';
    const g = groups.at(-1);
    if (g && g.label === label) g.items.push({ entry, index });
    else groups.push({ label, items: [{ entry, index }] });
  });
  return groups;
}
