/**
 * Saved workout plans: an ordered list of exercises with their sets and reps.
 *
 * Weights are deliberately NOT part of a plan. Her sets and reps stay the
 * same from week to week; the weight is what moves, and it comes from history
 * each time she starts the workout.
 *
 * A plan is { id, name, items: [{ exerciseId, block, sets, reps }] }.
 * `block` groups supersets the way her coach writes them ("1", "2", "Warm-up").
 */

import { KEYS } from './storage.js';

export function cleanItem(raw) {
  if (!raw || typeof raw.exerciseId !== 'string') return null;
  const sets = Number.isInteger(raw.sets) && raw.sets > 0 && raw.sets <= 20 ? raw.sets : 3;
  const reps = typeof raw.reps === 'string' || typeof raw.reps === 'number' ? String(raw.reps).slice(0, 24) : '8';
  const block = typeof raw.block === 'string' ? raw.block.slice(0, 24) : '';
  return { exerciseId: raw.exerciseId, block, sets, reps };
}

export function cleanWorkout(raw) {
  if (!raw || typeof raw.id !== 'string' || typeof raw.name !== 'string' || !raw.name.trim()) return null;
  return {
    id: raw.id,
    name: raw.name.trim().slice(0, 60),
    items: Array.isArray(raw.items) ? raw.items.map(cleanItem).filter(Boolean) : [],
    createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : 0,
  };
}

export function createWorkouts({ storage }) {
  let list = storage.read(KEYS.workouts, [], (data, fallback) =>
    Array.isArray(data) ? data.map(cleanWorkout).filter(Boolean) : fallback);

  const save = () => storage.write(KEYS.workouts, list);

  return {
    all: () => list,
    get: (id) => list.find((w) => w.id === id) ?? null,

    /** Insert or replace by id. */
    save(workout) {
      const w = cleanWorkout(workout);
      if (!w) return null;
      const i = list.findIndex((x) => x.id === w.id);
      if (i >= 0) list[i] = w; else list.push(w);
      save();
      return w;
    },

    remove(id) {
      list = list.filter((w) => w.id !== id);
      save();
    },

    /** Move a plan up or down the Train screen. */
    move(id, dir) {
      const i = list.findIndex((w) => w.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      save();
    },
  };
}
