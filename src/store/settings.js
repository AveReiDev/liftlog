/**
 * Settings: theme, which equipment her gym has, and welcome messages.
 *
 * `gym` is a list of station ids, or null for "assume everything". Swaps only
 * ever suggest exercises on stations in this list (floor space is always free).
 *
 * `messages` are notes shown when the app opens, one per open, in order. They
 * live only on the phone (typed in Settings or imported from a file), never in
 * the repo. `messageFrom` is the sign-off under each one.
 */

import { KEYS } from './storage.js';

export const THEMES = ['system', 'light', 'dark'];
export const MAX_MESSAGES = 100;
export const MAX_MESSAGE_LENGTH = 280;

const DEFAULTS = { theme: 'system', gym: null, messages: [], messageFrom: '', messageIndex: 0 };

/** Trim, drop blanks and cap length and count. Accepts an array or one-per-line text. */
export function cleanMessages(raw) {
  const list = typeof raw === 'string' ? raw.split('\n') : Array.isArray(raw) ? raw : [];
  return list
    .filter((m) => typeof m === 'string')
    .map((m) => m.trim().slice(0, MAX_MESSAGE_LENGTH))
    .filter(Boolean)
    .slice(0, MAX_MESSAGES);
}

export const cleanFrom = (raw) => (typeof raw === 'string' ? raw.trim().slice(0, 40) : '');

export function createSettings({ storage, stations }) {
  const valid = new Set(Object.keys(stations));
  let state = storage.read(KEYS.settings, DEFAULTS, (data, fallback) => ({
    theme: THEMES.includes(data?.theme) ? data.theme : fallback.theme,
    gym: Array.isArray(data?.gym) ? data.gym.filter((s) => valid.has(s)) : fallback.gym,
    messages: cleanMessages(data?.messages),
    messageFrom: cleanFrom(data?.messageFrom),
    messageIndex: Number.isInteger(data?.messageIndex) && data.messageIndex >= 0 ? data.messageIndex : 0,
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

    // ---- welcome messages --------------------------------------------

    get messages() { return [...state.messages]; },
    get messageFrom() { return state.messageFrom; },

    setMessages(list, from = state.messageFrom) {
      state.messages = cleanMessages(list);
      state.messageFrom = cleanFrom(from);
      state.messageIndex = 0;
      save();
    },

    /**
     * The message for this open, advancing so the next open shows the next
     * one. Cycles back to the first after the last. Null when there are none.
     */
    nextMessage() {
      if (!state.messages.length) return null;
      const i = state.messageIndex % state.messages.length;
      state.messageIndex = (i + 1) % state.messages.length;
      save();
      return { text: state.messages[i], from: state.messageFrom };
    },
  };
}
