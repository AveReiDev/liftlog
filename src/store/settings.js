/**
 * Settings: theme, and which equipment her gym has.
 *
 * `gym` is a list of station ids, or null for "assume everything". Swaps only
 * ever suggest exercises on stations in this list (floor space is always free).
 */

import { KEYS } from './storage.js';

export const THEMES = ['system', 'light', 'dark'];

const DEFAULTS = { theme: 'system', gym: null };

export function createSettings({ storage, stations }) {
  const valid = new Set(Object.keys(stations));
  let state = storage.read(KEYS.settings, DEFAULTS, (data, fallback) => ({
    theme: THEMES.includes(data?.theme) ? data.theme : fallback.theme,
    gym: Array.isArray(data?.gym) ? data.gym.filter((s) => valid.has(s)) : fallback.gym,
  }));

  const save = () => storage.write(KEYS.settings, state);

  return {
    get theme() { return state.theme; },
    setTheme(t) { if (THEMES.includes(t)) { state.theme = t; save(); } },

    /** A Set of stations she has, or null when she hasn't narrowed it down. */
    gym() { return state.gym ? new Set(state.gym) : null; },
    hasStation(id) { return state.gym === null || state.gym.includes(id) || id === 'floor'; },
    setStation(id, on) {
      if (!valid.has(id)) return;
      const current = new Set(state.gym ?? valid);
      if (on) current.add(id); else current.delete(id);
      state.gym = current.size === valid.size ? null : [...current];
      save();
    },
  };
}
