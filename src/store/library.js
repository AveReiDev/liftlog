/**
 * The exercise library: the shipped list plus the ones she adds.
 *
 * Shipped exercises live in data/exercises.json and are never written to
 * storage. Her own exercises are stored as `customs`. She can also tweak a
 * shipped exercise's step (say her gym's cable stack goes up in 5s) through
 * `overrides`, which are merged over the shipped definition on read.
 */

import { KEYS } from './storage.js';
import { METRICS } from '../engine/units.js';

const EDITABLE = ['name', 'pattern', 'station', 'metric', 'unit', 'step', 'per', 'notes'];
const UNITS = { load: ['lb', 'kg'], assist: ['lb', 'kg'], hold: ['s'], time: ['s'], height: ['in'], watts: ['W'], speed: ['mph'], reps: [] };

export function slug(text) {
  return String(text).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'exercise';
}

/** Keep only fields that make sense; anything odd falls back or is dropped. */
export function cleanExercise(raw, { patterns, stations }) {
  if (!raw || typeof raw !== 'object') return null;
  const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, 80) : '';
  if (!name || typeof raw.id !== 'string') return null;
  const metric = raw.metric in METRICS ? raw.metric : 'load';
  const units = UNITS[metric];
  const ex = {
    id: raw.id,
    name,
    pattern: raw.pattern in patterns ? raw.pattern : 'core',
    station: raw.station in stations ? raw.station : 'floor',
    metric,
  };
  if (units.length) ex.unit = units.includes(raw.unit) ? raw.unit : units[0];
  if (typeof raw.step === 'number' && raw.step > 0 && raw.step <= 100) ex.step = raw.step;
  if (raw.per === 'side' || raw.per === 'hand') ex.per = raw.per;
  if (typeof raw.notes === 'string' && raw.notes.trim()) ex.notes = raw.notes.trim().slice(0, 300);
  if (raw.custom) ex.custom = true;
  if (raw.archived) ex.archived = true;
  return ex;
}

export function createLibrary({ shipped, storage }) {
  const { patterns, stations } = shipped;
  const shippedById = new Map(shipped.exercises.map((e) => [e.id, e]));

  let state = storage.read(KEYS.library, { customs: [], overrides: {} }, (data, fallback) => {
    const customs = Array.isArray(data?.customs)
      ? data.customs.map((c) => cleanExercise({ ...c, custom: true }, shipped)).filter(Boolean)
      : fallback.customs;
    const overrides = {};
    if (data?.overrides && typeof data.overrides === 'object') {
      for (const [id, patch] of Object.entries(data.overrides)) {
        if (shippedById.has(id) && patch && typeof patch === 'object') overrides[id] = patch;
      }
    }
    return { customs, overrides };
  });

  let cache = null;
  const save = () => { cache = null; storage.write(KEYS.library, state); };

  /** Everything, archived customs included, so old sessions can still name them. */
  function everything() {
    if (cache) return cache;
    const merged = shipped.exercises.map((e) => {
      const o = state.overrides[e.id];
      return o ? cleanExercise({ ...e, ...o, id: e.id }, shipped) ?? e : e;
    });
    const ids = new Set(merged.map((e) => e.id));
    const list = [...merged, ...state.customs.filter((c) => !ids.has(c.id))];
    cache = { list, live: list.filter((e) => !e.archived), byId: new Map(list.map((e) => [e.id, e])) };
    return cache;
  }

  /** What pickers and swaps offer. */
  const all = () => everything().live;
  const byId = () => everything().byId;

  return {
    patterns,
    stations,
    all,
    get(id) { return byId().get(id) ?? null; },

    /** Case-insensitive match on name, pattern or equipment. */
    search(query) {
      const q = String(query ?? '').trim().toLowerCase();
      const list = all();
      if (!q) return list;
      return list.filter((e) =>
        e.name.toLowerCase().includes(q) ||
        (patterns[e.pattern] ?? '').toLowerCase().includes(q) ||
        (stations[e.station] ?? '').toLowerCase().includes(q));
    },

    /** Add one of her own. Returns the stored exercise, or null if the input was unusable. */
    add(fields, rnd = Math.random) {
      const base = slug(fields?.name);
      let id = `c-${base}`;
      const taken = byId();
      while (taken.has(id)) id = `c-${base}-${Math.floor(rnd() * 1e6).toString(36)}`;
      const ex = cleanExercise({ ...fields, id, custom: true }, shipped);
      if (!ex) return null;
      state.customs.push(ex);
      save();
      return ex;
    },

    /** Edit a custom outright, or record an override on a shipped one. */
    update(id, patch) {
      const fields = Object.fromEntries(Object.entries(patch ?? {}).filter(([k]) => EDITABLE.includes(k)));
      const i = state.customs.findIndex((c) => c.id === id);
      if (i >= 0) {
        const next = cleanExercise({ ...state.customs[i], ...fields, id, custom: true }, shipped);
        if (!next) return null;
        state.customs[i] = next;
      } else if (shippedById.has(id)) {
        state.overrides[id] = { ...state.overrides[id], ...fields };
      } else {
        return null;
      }
      save();
      return this.get(id);
    },

    /**
     * Only her own exercises can be deleted. They are archived rather than
     * erased, so past sessions that used them still show the right name.
     */
    remove(id) {
      const c = state.customs.find((x) => x.id === id);
      if (!c || c.archived) return false;
      c.archived = true;
      save();
      return true;
    },

    isCustom: (id) => state.customs.some((c) => c.id === id),
  };
}
