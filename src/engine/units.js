/**
 * What a logged number means, and how to show and step it.
 *
 * Pure: no DOM, no clock. Every exercise has a `metric`; the metric decides
 * the unit, which direction counts as better, and how the +/- buttons move.
 *
 *   load    weight lifted (lb or kg)            higher is better
 *   assist  machine help on assisted pull-ups   LOWER is better
 *   reps    bodyweight; no number to track      —
 *   hold    seconds held (planks)               higher is better
 *   time    seconds to finish (100 m sprint)    LOWER is better
 *   height  inches (box jump)                   higher is better
 *   watts   power (rower)                       higher is better
 *   speed   mph (Skillmill)                     higher is better
 */

export const METRICS = {
  load:   { label: 'Weight',   unit: 'lb', better: 'higher' },
  assist: { label: 'Assistance', unit: 'lb', better: 'lower' },
  reps:   { label: 'Bodyweight', unit: '',  better: null },
  hold:   { label: 'Hold',     unit: 's',  better: 'higher' },
  time:   { label: 'Time',     unit: 's',  better: 'lower' },
  height: { label: 'Height',   unit: 'in', better: 'higher' },
  watts:  { label: 'Power',    unit: 'W',  better: 'higher' },
  speed:  { label: 'Speed',    unit: 'mph', better: 'higher' },
};

/** Kettlebells come in fixed sizes, so kg steps walk this list, not +2. */
export const KETTLEBELLS_KG = [4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 32, 36, 40, 44, 48];

export const unitOf = (ex) => ex.unit ?? METRICS[ex.metric]?.unit ?? '';
export const tracksNumber = (ex) => ex.metric !== 'reps';
export const betterOf = (ex) => METRICS[ex.metric]?.better ?? null;

/** True when `a` is a better result than `b` for this exercise. */
export function isBetter(ex, a, b) {
  if (a == null) return false;
  if (b == null) return true;
  const dir = betterOf(ex);
  if (dir === 'higher') return a > b;
  if (dir === 'lower') return a < b;
  return false;
}

const round = (v) => Math.round(v * 100) / 100;

/**
 * One press of + (dir = 1) or − (dir = -1). For kettlebells this means the next
 * bell on the rack; for everything else it is the exercise's step.
 */
export function stepValue(ex, value, dir) {
  const unit = unitOf(ex);
  if (value == null || !Number.isFinite(value)) value = 0;

  if (unit === 'kg' && !ex.step) {
    if (dir > 0) return KETTLEBELLS_KG.find((k) => k > value) ?? value + 4;
    const down = [...KETTLEBELLS_KG].reverse().find((k) => k < value);
    return down ?? Math.max(0, value - 2);
  }
  const step = ex.step ?? (unit === 'kg' ? 2 : 5);
  return Math.max(0, round(value + dir * step));
}

/** The "next session" target: one step in the direction that counts as progress. */
export function progressStep(ex, value) {
  if (value == null || !tracksNumber(ex)) return null;
  const dir = betterOf(ex) === 'lower' ? -1 : 1;
  const next = stepValue(ex, value, dir);
  return next === value ? null : next;
}

/** "85 lb", "45 lb/side", "12 kg each", "55 lb help", "19.9 s". */
export function formatValue(ex, value, { short = false } = {}) {
  if (value == null || !tracksNumber(ex)) return short ? '—' : 'Bodyweight';
  const unit = unitOf(ex);
  const n = formatNumber(value);
  let s = unit ? `${n} ${unit}` : n;
  if (ex.per === 'side') s += short ? '/side' : ' / side';
  if (ex.per === 'hand') s += ' each';
  if (ex.metric === 'assist') s += ' help';
  return s;
}

/** The number that matters on the bar, for per-side machines. */
export function totalLoad(ex, value) {
  if (value == null) return null;
  return ex.per === 'side' || ex.per === 'hand' ? value * 2 : value;
}

export function formatNumber(v) {
  if (v == null || !Number.isFinite(v)) return '';
  return Number.isInteger(v) ? String(v) : String(round(v));
}

/** Parse what she types into the number box. Accepts "27.5", "27,5", " 85 ". */
export function parseValue(text) {
  if (typeof text === 'number') return Number.isFinite(text) ? text : null;
  if (typeof text !== 'string') return null;
  const v = Number.parseFloat(text.trim().replace(',', '.'));
  return Number.isFinite(v) && v >= 0 ? round(v) : null;
}

/** Leading number from a reps field: "8" → 8, "12 steps" → 12, "30s" → 30. */
export function repsNumber(reps) {
  const m = /^\s*(\d+)/.exec(String(reps ?? ''));
  return m ? Number(m[1]) : null;
}

/** Epley estimated one-rep max. Only meaningful for load, and only up to ~12 reps. */
export function estimatedMax(ex, value, reps) {
  if (ex.metric !== 'load' || value == null) return null;
  const r = repsNumber(reps);
  if (!r || r > 15) return null;
  const load = totalLoad(ex, value);
  return r === 1 ? load : Math.round(load * (1 + r / 30));
}
