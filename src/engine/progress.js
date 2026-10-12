/**
 * Reading progress out of the session history.
 *
 * Pure: takes the history array and the exercise definitions, returns plain
 * data. `today` is always passed in; nothing here reads the clock.
 *
 * A session is { id, date: 'YYYY-MM-DD', title, entries: [entry] } and an entry
 * is { exerciseId, block, sets, reps, value, done, note, swappedFrom }.
 * Dates are ISO strings, so plain string comparison sorts them.
 */

import { isBetter, tracksNumber, estimatedMax } from './units.js';

const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.startedAt ?? 0) - (b.startedAt ?? 0));

/** Every time this exercise was logged, oldest first, with its session attached. */
export function entriesFor(history, exerciseId, { excludeSessionId } = {}) {
  const out = [];
  for (const s of [...history].sort(byDate)) {
    if (s.id === excludeSessionId) continue;
    for (const e of s.entries ?? []) {
      if (e.exerciseId === exerciseId && e.done !== false) {
        out.push({ ...e, date: s.date, sessionId: s.id, sessionTitle: s.title, approxDate: !!s.approxDate });
      }
    }
  }
  return out;
}

/** The most recent time she did it. This is what pre-fills the weight box. */
export function lastFor(history, exerciseId, opts) {
  const all = entriesFor(history, exerciseId, opts);
  for (let i = all.length - 1; i >= 0; i--) {
    if (all[i].value != null) return all[i];
  }
  return all.at(-1) ?? null;
}

/** Best single result, by whichever direction counts as better. */
export function bestFor(ex, history, opts) {
  if (!tracksNumber(ex)) return null;
  let best = null;
  for (const e of entriesFor(history, ex.id, opts)) {
    if (e.value != null && (best === null || isBetter(ex, e.value, best.value))) best = e;
  }
  return best;
}

/** Would this value be a new personal best? Needs at least one earlier result to beat. */
export function isPersonalBest(ex, value, history, opts) {
  if (value == null || !tracksNumber(ex)) return false;
  const best = bestFor(ex, history, opts);
  return best !== null && isBetter(ex, value, best.value);
}

/** One point per session for the chart: the session's best value plus estimated max. */
export function seriesFor(ex, history) {
  const bySession = new Map();
  for (const e of entriesFor(history, ex.id)) {
    if (e.value == null) continue;
    const prev = bySession.get(e.sessionId);
    if (!prev || isBetter(ex, e.value, prev.value)) bySession.set(e.sessionId, e);
  }
  return [...bySession.values()].map((e) => ({
    date: e.date,
    approxDate: e.approxDate,
    sessionId: e.sessionId,
    value: e.value,
    reps: e.reps,
    sets: e.sets,
    e1rm: estimatedMax(ex, e.value, e.reps),
  }));
}

/** How many sessions each exercise appears in. */
export function frequency(history) {
  const counts = new Map();
  for (const s of history) {
    const seen = new Set();
    for (const e of s.entries ?? []) {
      if (e.done === false || seen.has(e.exerciseId)) continue;
      seen.add(e.exerciseId);
      counts.set(e.exerciseId, (counts.get(e.exerciseId) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * The PR board: every exercise with a number, its best result, and how far it
 * has moved since the first time. Most-trained first.
 */
export function prBoard(exercises, history) {
  const counts = frequency(history);
  const rows = [];
  for (const ex of exercises) {
    if (!tracksNumber(ex) || !counts.has(ex.id)) continue;
    const series = seriesFor(ex, history);
    if (!series.length) continue;
    const best = bestFor(ex, history);
    rows.push({
      exercise: ex,
      best,
      first: series[0],
      sessions: counts.get(ex.id),
      points: series.length,
    });
  }
  return rows.sort((a, b) => b.sessions - a.sessions || a.exercise.name.localeCompare(b.exercise.name));
}

/** Monday of the week containing an ISO date, as an ISO date. */
export function weekStart(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;     // Monday = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

/** Sessions per week for the last `weeks` weeks, oldest first, ending with this week. */
export function weeklyCounts(history, today, weeks = 12) {
  const end = weekStart(today);
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(`${end}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - i * 7);
    out.push({ week: d.toISOString().slice(0, 10), count: 0 });
  }
  const index = new Map(out.map((w, i) => [w.week, i]));
  for (const s of history) {
    if (s.approxDate) continue;
    const i = index.get(weekStart(s.date));
    if (i !== undefined) out[i].count++;
  }
  return out;
}

/**
 * What the Finish screen celebrates: new bests, and weights that went up
 * compared with the last time she did each exercise.
 */
export function sessionSummary(session, history, lookup) {
  const before = { excludeSessionId: session.id };
  const done = (session.entries ?? []).filter((e) => e.done);
  const prs = [];
  const ups = [];
  for (const e of done) {
    const ex = lookup(e.exerciseId);
    if (!ex || e.value == null || !tracksNumber(ex)) continue;
    if (isPersonalBest(ex, e.value, history, before)) prs.push({ exercise: ex, value: e.value });
    const last = lastFor(history, ex.id, before);
    if (last?.value != null && isBetter(ex, e.value, last.value)) ups.push({ exercise: ex, from: last.value, to: e.value });
  }
  return { done: done.length, total: (session.entries ?? []).length, prs, ups };
}
