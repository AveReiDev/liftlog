/**
 * Finished sessions, plus the one in progress.
 *
 * The in-progress session is saved on every change under its own key, so the
 * phone locking, the app being swiped away, or a crash mid-set loses nothing.
 * Finishing moves it into history.
 */

import { KEYS } from './storage.js';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function cleanEntry(raw) {
  if (!raw || typeof raw.exerciseId !== 'string') return null;
  const value = typeof raw.value === 'number' && Number.isFinite(raw.value) && raw.value >= 0 ? raw.value : null;
  const e = {
    exerciseId: raw.exerciseId,
    block: typeof raw.block === 'string' ? raw.block.slice(0, 24) : '',
    sets: Number.isInteger(raw.sets) && raw.sets > 0 && raw.sets <= 20 ? raw.sets : 3,
    reps: raw.reps == null ? '' : String(raw.reps).slice(0, 24),
    value,
    done: raw.done === true,
  };
  if (typeof raw.note === 'string' && raw.note.trim()) e.note = raw.note.slice(0, 500);
  if (typeof raw.swappedFrom === 'string') e.swappedFrom = raw.swappedFrom;
  return e;
}

export function cleanSession(raw) {
  if (!raw || typeof raw.id !== 'string' || !ISO.test(raw.date ?? '')) return null;
  const s = {
    id: raw.id,
    date: raw.date,
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim().slice(0, 60) : 'Session',
    workoutId: typeof raw.workoutId === 'string' ? raw.workoutId : null,
    startedAt: Number.isFinite(raw.startedAt) ? raw.startedAt : null,
    finishedAt: Number.isFinite(raw.finishedAt) ? raw.finishedAt : null,
    entries: Array.isArray(raw.entries) ? raw.entries.map(cleanEntry).filter(Boolean) : [],
  };
  if (raw.approxDate === true) s.approxDate = true;   // imported from undated notes
  if (Array.isArray(raw.busy)) s.busy = raw.busy.filter((b) => typeof b === 'string').slice(0, 40);
  if (typeof raw.note === 'string' && raw.note.trim()) s.note = raw.note.slice(0, 1000);
  return s;
}

export function createHistory({ storage }) {
  let list = storage.read(KEYS.history, [], (data, fallback) =>
    Array.isArray(data) ? data.map(cleanSession).filter(Boolean) : fallback);
  let active = storage.read(KEYS.active, null, (data) => cleanSession(data));

  const save = () => storage.write(KEYS.history, list);

  return {
    /** Newest first. */
    all() {
      return [...list].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.startedAt ?? 0) - (a.startedAt ?? 0)));
    },
    get: (id) => list.find((s) => s.id === id) ?? null,

    remove(id) {
      list = list.filter((s) => s.id !== id);
      save();
    },

    /** Edit a finished session (fix a typo'd weight, change the date). */
    replace(session) {
      const s = cleanSession(session);
      if (!s) return null;
      const i = list.findIndex((x) => x.id === s.id);
      if (i < 0) return null;
      list[i] = s;
      save();
      return s;
    },

    // ---- the session in progress -------------------------------------

    get active() { return active; },

    setActive(session) {
      active = cleanSession(session);
      if (active) storage.write(KEYS.active, active);
      return active;
    },

    discardActive() {
      active = null;
      storage.remove(KEYS.active);
    },

    /** Move the active session into history. Entries never ticked are dropped. */
    finishActive(now) {
      if (!active) return null;
      const s = cleanSession({ ...active, finishedAt: now, entries: active.entries.filter((e) => e.done) });
      list = list.filter((x) => x.id !== s.id);
      list.push(s);
      save();
      active = null;
      storage.remove(KEYS.active);
      return s;
    },
  };
}

export function newId(prefix, now, rnd = Math.random) {
  return `${prefix}-${now.toString(36)}-${Math.floor(rnd() * 1e6).toString(36)}`;
}
