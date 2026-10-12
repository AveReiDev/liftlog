/**
 * Shared test setup. Not a test file itself (npm test runs test/*.test.js).
 */
import { readFileSync } from 'node:fs';
import { createStorage } from '../src/store/storage.js';

export const SHIPPED = JSON.parse(readFileSync(new URL('../data/exercises.json', import.meta.url)));
export const EXERCISES = SHIPPED.exercises;
export const ex = (id) => {
  const e = EXERCISES.find((x) => x.id === id);
  if (!e) throw new Error(`no exercise ${id}`);
  return e;
};

/** In-memory localStorage stand-in. `throws: true` mimics Safari private mode. */
export function memoryBackend({ throws = false } = {}) {
  const m = new Map();
  return {
    getItem(k) { if (throws) throw new Error('denied'); return m.has(k) ? m.get(k) : null; },
    setItem(k, v) { if (throws) throw new Error('denied'); m.set(k, String(v)); },
    removeItem(k) { m.delete(k); },
    dump: () => m,
  };
}

export const memoryStorage = (opts) => createStorage({ backend: memoryBackend(opts) });

/** A tiny history: box squat three times, assisted pull-up twice. */
export function sampleHistory() {
  return [
    { id: 's1', date: '2025-02-26', title: 'A', entries: [
      { exerciseId: 'box-squat', block: '1', sets: 3, reps: '6', value: 85, done: true },
      { exerciseId: 'assisted-pullup', block: '1', sets: 3, reps: '6', value: 80, done: true },
    ] },
    { id: 's2', date: '2025-03-19', title: 'B', entries: [
      { exerciseId: 'box-squat', block: '1', sets: 3, reps: '5', value: 100, done: true },
      { exerciseId: 'assisted-pullup', block: '1', sets: 3, reps: '5', value: 70, done: true },
      { exerciseId: 'trx-row', block: '2', sets: 3, reps: '8', value: null, done: true },
    ] },
    { id: 's3', date: '2025-05-14', title: 'C', entries: [
      { exerciseId: 'box-squat', block: '1', sets: 3, reps: '8', value: 85, done: true },
    ] },
  ];
}
