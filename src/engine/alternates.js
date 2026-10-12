/**
 * "This machine is taken — what else can I do?"
 *
 * Pure. An alternate trains the same movement pattern on equipment that is
 * free right now and that her gym actually has. Exercises she has done before
 * rank first, because she already knows her weight on them.
 *
 * Stations are the physical things people queue for (the cable stack, the squat
 * rack). Marking one busy hides every exercise that needs it for the rest of
 * the session, so a second swap doesn't send her back to the same crowd.
 */

import { frequency, lastFor } from './progress.js';

/** Close enough to stand in when nothing in the same pattern is free. */
export const RELATED = {
  'squat': ['single-leg-squat'],
  'single-leg-squat': ['squat'],
  'hinge': ['single-leg-hinge', 'hip-power'],
  'single-leg-hinge': ['hinge'],
  'hip-power': ['hinge'],
  'vertical-pull': ['horizontal-pull'],
  'horizontal-pull': ['vertical-pull', 'shoulder-accessory'],
  'vertical-push': ['horizontal-push'],
  'horizontal-push': ['vertical-push'],
  'shoulder-accessory': ['horizontal-pull'],
  'leg-accessory': ['hinge', 'single-leg-hinge'],
  'core': [],
  'arm-accessory': [],
  'conditioning': ['hip-power'],
  'warmup': [],
};

/**
 * @param {object}   o
 * @param {object}   o.exercise   the one she can't do
 * @param {object[]} o.exercises  the full library
 * @param {object[]} o.history    finished sessions
 * @param {Set}      [o.busy]     stations taken right now (the exercise's own is added)
 * @param {Set|null} [o.gym]      stations her gym has; null means assume all
 * @param {Set}      [o.skip]     exercise ids to leave out (already in today's session)
 * @param {number}   [o.limit]
 */
export function suggestAlternates({ exercise, exercises, history, busy = new Set(), gym = null, skip = new Set(), limit = 6 }) {
  const taken = new Set(busy);
  taken.add(exercise.station);
  const counts = frequency(history);
  const related = new Set(RELATED[exercise.pattern] ?? []);

  const usable = (e) =>
    e.id !== exercise.id &&
    !skip.has(e.id) &&
    !taken.has(e.station) &&
    (gym === null || gym.has(e.station) || e.station === 'floor');

  const scored = [];
  for (const e of exercises) {
    if (!usable(e)) continue;
    const same = e.pattern === exercise.pattern;
    if (!same && !related.has(e.pattern)) continue;
    const count = counts.get(e.id) ?? 0;
    let score = same ? 10 : 3;
    if (count > 0) score += 3 + Math.min(count, 5) * 0.4;
    if (e.metric === exercise.metric) score += 1;
    if (e.unit && e.unit === exercise.unit) score += 0.5;
    scored.push({ exercise: e, score, count, related: !same });
  }

  scored.sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name));

  // Related patterns only fill in when the same pattern runs short.
  const same = scored.filter((s) => !s.related);
  const pick = same.length >= 3 ? same : scored;
  return pick.slice(0, limit).map((s) => ({ ...s, last: s.count ? lastFor(history, s.exercise.id) : null }));
}
