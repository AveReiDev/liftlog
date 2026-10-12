import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ex, EXERCISES, sampleHistory } from './fixtures.js';
import {
  stepValue, progressStep, formatValue, parseValue, estimatedMax, isBetter, repsNumber, totalLoad,
} from '../src/engine/units.js';
import {
  lastFor, bestFor, isPersonalBest, seriesFor, prBoard, weeklyCounts, weekStart, sessionSummary, frequency,
} from '../src/engine/progress.js';
import { suggestAlternates } from '../src/engine/alternates.js';
import {
  startFromWorkout, startFromSession, swapEntry, addEntry, removeEntry, moveEntry, groupByBlock, setBusy, updateEntry,
} from '../src/engine/session.js';

const lookup = (id) => EXERCISES.find((e) => e.id === id) ?? null;

// ---- units ---------------------------------------------------------------

test('kettlebell steps walk the rack sizes, not a fixed increment', () => {
  assert.equal(stepValue(ex('kb-swing'), 16, 1), 18);
  assert.equal(stepValue(ex('kb-swing'), 24, 1), 26);
  assert.equal(stepValue(ex('kb-swing'), 12, -1), 10);
  assert.equal(stepValue(ex('kb-swing'), 13, 1), 14, 'an odd value snaps to the next real bell');
});

test('lb steps use the exercise step and never go below zero', () => {
  assert.equal(stepValue(ex('dual-cable-row'), 27.5, 1), 30);
  assert.equal(stepValue(ex('hex-deadlift'), 155, 1), 165);
  assert.equal(stepValue(ex('box-squat'), 0, -1), 0);
  assert.equal(stepValue(ex('box-squat'), null, 1), 5);
});

test('progress on assisted pull-ups means LESS help', () => {
  assert.equal(progressStep(ex('assisted-pullup'), 55), 50);
  assert.equal(progressStep(ex('box-squat'), 85), 90);
  assert.equal(progressStep(ex('rower-100'), 19.9), 19.4);
  assert.equal(progressStep(ex('pushup'), null), null);
});

test('isBetter respects direction', () => {
  assert.ok(isBetter(ex('assisted-pullup'), 55, 70));
  assert.ok(!isBetter(ex('assisted-pullup'), 70, 55));
  assert.ok(isBetter(ex('box-squat'), 100, 85));
  assert.ok(isBetter(ex('rower-100'), 19.9, 20.3));
  assert.ok(!isBetter(ex('pushup'), 10, 5), 'bodyweight has no direction');
});

test('formatValue names the unit, per side and assistance', () => {
  assert.equal(formatValue(ex('box-squat'), 85), '85 lb');
  assert.equal(formatValue(ex('leg-press'), 45), '45 lb / side');
  assert.equal(formatValue(ex('kb-front-squat'), 10), '10 kg each');
  assert.equal(formatValue(ex('assisted-pullup'), 55), '55 lb help');
  assert.equal(formatValue(ex('dual-cable-row'), 27.5), '27.5 lb');
  assert.equal(formatValue(ex('pushup'), null), 'Bodyweight');
});

test('parseValue accepts what a phone keyboard produces', () => {
  assert.equal(parseValue('27.5'), 27.5);
  assert.equal(parseValue('27,5'), 27.5);
  assert.equal(parseValue(' 85 '), 85);
  assert.equal(parseValue(''), null);
  assert.equal(parseValue('abc'), null);
  assert.equal(parseValue('-5'), null);
});

test('estimated max uses Epley on the total load', () => {
  assert.equal(estimatedMax(ex('box-squat'), 100, '5'), 117);
  assert.equal(estimatedMax(ex('box-squat'), 85, '8'), 108);
  assert.equal(estimatedMax(ex('leg-press'), 45, '12'), Math.round(90 * 1.4));
  assert.equal(estimatedMax(ex('assisted-pullup'), 55, '3'), null);
  assert.equal(estimatedMax(ex('box-squat'), 85, 'AMRAP'), null);
  assert.equal(repsNumber('12 steps'), 12);
  assert.equal(totalLoad(ex('kb-front-squat'), 10), 20);
});

// ---- progress ------------------------------------------------------------

test('lastFor finds the most recent logged value', () => {
  const h = sampleHistory();
  assert.equal(lastFor(h, 'box-squat').value, 85);
  assert.equal(lastFor(h, 'box-squat').date, '2025-05-14');
  assert.equal(lastFor(h, 'assisted-pullup').value, 70);
  assert.equal(lastFor(h, 'nope'), null);
  assert.equal(lastFor(h, 'box-squat', { excludeSessionId: 's3' }).value, 100);
});

test('bestFor and personal bests follow the better direction', () => {
  const h = sampleHistory();
  assert.equal(bestFor(ex('box-squat'), h).value, 100);
  assert.equal(bestFor(ex('assisted-pullup'), h).value, 70);
  assert.ok(isPersonalBest(ex('box-squat'), 105, h));
  assert.ok(!isPersonalBest(ex('box-squat'), 100, h), 'equalling is not a new best');
  assert.ok(isPersonalBest(ex('assisted-pullup'), 65, h));
  assert.ok(!isPersonalBest(ex('hex-deadlift'), 200, h), 'no history means nothing to beat');
});

test('seriesFor gives one point per session with estimated max', () => {
  const s = seriesFor(ex('box-squat'), sampleHistory());
  assert.deepEqual(s.map((p) => p.value), [85, 100, 85]);
  assert.deepEqual(s.map((p) => p.e1rm), [102, 117, 108]);
});

test('frequency counts sessions, not entries', () => {
  const h = sampleHistory();
  h[0].entries.push({ exerciseId: 'box-squat', value: 65, done: true });
  assert.equal(frequency(h).get('box-squat'), 3);
});

test('prBoard skips bodyweight and sorts by sessions', () => {
  const rows = prBoard(EXERCISES, sampleHistory());
  assert.deepEqual(rows.map((r) => r.exercise.id), ['box-squat', 'assisted-pullup']);
  assert.equal(rows[0].best.value, 100);
  assert.equal(rows[0].first.value, 85);
});

test('weeklyCounts buckets by Monday and ignores undated imports', () => {
  assert.equal(weekStart('2026-10-12'), '2026-10-12');   // a Monday
  assert.equal(weekStart('2026-10-18'), '2026-10-12');   // the Sunday after
  const h = [
    { id: 'a', date: '2026-10-13', entries: [] },
    { id: 'b', date: '2026-10-15', entries: [] },
    { id: 'c', date: '2026-10-06', entries: [] },
    { id: 'd', date: '2026-10-14', approxDate: true, entries: [] },
  ];
  const w = weeklyCounts(h, '2026-10-16', 3);
  assert.deepEqual(w.map((x) => x.count), [0, 1, 2]);
});

test('sessionSummary reports new bests and weights that went up', () => {
  const h = sampleHistory();
  const today = { id: 'now', date: '2025-06-01', entries: [
    { exerciseId: 'box-squat', reps: '8', value: 90, done: true },
    { exerciseId: 'assisted-pullup', reps: '5', value: 65, done: true },
    { exerciseId: 'trx-row', value: null, done: true },
    { exerciseId: 'hex-deadlift', value: 135, done: false },
  ] };
  const s = sessionSummary(today, h, lookup);
  assert.equal(s.done, 3);
  assert.equal(s.total, 4);
  assert.deepEqual(s.prs.map((p) => p.exercise.id), ['assisted-pullup']);
  assert.deepEqual(s.ups.map((u) => u.exercise.id), ['box-squat', 'assisted-pullup']);
});

// ---- alternates ----------------------------------------------------------

test('alternates share the pattern and avoid the busy station', () => {
  const alts = suggestAlternates({ exercise: ex('dual-cable-row'), exercises: EXERCISES, history: [] });
  assert.ok(alts.length >= 3);
  for (const a of alts) {
    assert.equal(a.exercise.pattern, 'horizontal-pull');
    assert.notEqual(a.exercise.station, 'cable');
  }
});

test('alternates she has done before rank first and carry her last weight', () => {
  const alts = suggestAlternates({ exercise: ex('dual-cable-row'), exercises: EXERCISES, history: sampleHistory() });
  assert.equal(alts[0].exercise.id, 'trx-row');
  assert.equal(alts[0].count, 1);
  assert.ok(alts[0].last);
});

test('alternates respect the gym list and extra busy stations', () => {
  const gym = new Set(['cable', 'dumbbells']);
  const alts = suggestAlternates({ exercise: ex('dual-cable-row'), exercises: EXERCISES, history: [], gym });
  assert.ok(alts.every((a) => a.exercise.station === 'dumbbells' || a.exercise.station === 'floor' || a.related));
  const none = suggestAlternates({ exercise: ex('dual-cable-row'), exercises: EXERCISES, history: [], busy: new Set(['trx', 'row-station']) });
  assert.ok(none.every((a) => !['trx', 'row-station', 'cable'].includes(a.exercise.station)));
});

test('alternates fall back to related patterns when the pattern runs dry', () => {
  const gym = new Set(['platform']);   // nothing else for a hinge
  const alts = suggestAlternates({ exercise: ex('hex-deadlift'), exercises: EXERCISES, history: [], gym });
  assert.ok(alts.length > 0);
  assert.ok(alts.every((a) => a.exercise.id !== 'hex-deadlift'));
});

test('alternates leave out exercises already in the session', () => {
  const alts = suggestAlternates({ exercise: ex('dual-cable-row'), exercises: EXERCISES, history: [], skip: new Set(['trx-row']) });
  assert.ok(!alts.some((a) => a.exercise.id === 'trx-row'));
});

// ---- session -------------------------------------------------------------

const plan = { id: 'w1', name: 'Day 1', items: [
  { exerciseId: 'box-squat', block: '1', sets: 3, reps: '8' },
  { exerciseId: 'assisted-pullup', block: '1', sets: 3, reps: '6' },
  { exerciseId: 'dual-cable-row', block: '2', sets: 3, reps: '12' },
] };
const ids = { id: 'n1', date: '2025-06-02', now: 1 };

test('starting a plan pre-fills last weights and copies sets and reps', () => {
  const s = startFromWorkout(plan, sampleHistory(), ids);
  assert.equal(s.title, 'Day 1');
  assert.deepEqual(s.entries.map((e) => e.value), [85, 70, null]);
  assert.deepEqual(s.entries.map((e) => e.reps), ['8', '6', '12']);
  assert.ok(s.entries.every((e) => e.done === false));
});

test('repeating a past session uses its exercises with fresh weights', () => {
  const past = sampleHistory()[0];
  const s = startFromSession(past, sampleHistory(), ids);
  assert.deepEqual(s.entries.map((e) => e.value), [85, 70], 'latest weights, not the old session’s');
});

test('swapping keeps sets and reps, records the original, and swapping back clears it', () => {
  let s = startFromWorkout(plan, sampleHistory(), ids);
  s = updateEntry(s, 2, { note: 'busy' });
  s = swapEntry(s, 2, 'trx-row', sampleHistory());
  assert.equal(s.entries[2].exerciseId, 'trx-row');
  assert.equal(s.entries[2].swappedFrom, 'dual-cable-row');
  assert.equal(s.entries[2].reps, '12');
  assert.equal(s.entries[2].note, 'busy');
  s = swapEntry(s, 2, 'db-row', sampleHistory());
  assert.equal(s.entries[2].swappedFrom, 'dual-cable-row', 'a second swap still points at the original');
  s = swapEntry(s, 2, 'dual-cable-row', sampleHistory());
  assert.equal(s.entries[2].swappedFrom, undefined);
});

test('add, remove, move and busy are non-destructive', () => {
  const s0 = startFromWorkout(plan, [], ids);
  const s1 = addEntry(s0, { exerciseId: 'kb-swing' }, []);
  assert.equal(s1.entries.length, 4);
  assert.equal(s1.entries[3].block, '2', 'joins the last block');
  assert.equal(s0.entries.length, 3);
  assert.deepEqual(moveEntry(s1, 3, -1).entries.map((e) => e.exerciseId).slice(2), ['kb-swing', 'dual-cable-row']);
  assert.equal(moveEntry(s1, 0, -1), s1);
  assert.equal(removeEntry(s1, 0).entries[0].exerciseId, 'assisted-pullup');
  assert.deepEqual(setBusy(setBusy(s0, 'cable', true), 'trx', true).busy, ['cable', 'trx']);
  assert.deepEqual(setBusy(setBusy(s0, 'cable', true), 'cable', false).busy, []);
});

test('groupByBlock keeps consecutive blocks together with original indexes', () => {
  const g = groupByBlock(startFromWorkout(plan, [], ids).entries);
  assert.deepEqual(g.map((x) => x.label), ['1', '2']);
  assert.deepEqual(g[1].items.map((x) => x.index), [2]);
});
