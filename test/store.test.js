import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHIPPED, EXERCISES, memoryStorage, memoryBackend } from './fixtures.js';
import { createStorage, KEYS } from '../src/store/storage.js';
import { createLibrary, slug } from '../src/store/library.js';
import { createSettings, cleanMessages } from '../src/store/settings.js';
import { createWorkouts } from '../src/store/workouts.js';
import { createHistory, cleanSession } from '../src/store/history.js';
import { createBackup, parseBackup, restoreBackup, backupFilename } from '../src/store/backup.js';

// ---- shipped data --------------------------------------------------------

test('every shipped exercise has a known pattern, station and metric', () => {
  const ids = new Set();
  for (const e of EXERCISES) {
    assert.ok(!ids.has(e.id), `duplicate id ${e.id}`);
    ids.add(e.id);
    assert.ok(e.pattern in SHIPPED.patterns, `${e.id} pattern`);
    assert.ok(e.station in SHIPPED.stations, `${e.id} station`);
    assert.ok(['load', 'assist', 'reps', 'hold', 'time', 'height', 'watts', 'speed'].includes(e.metric), `${e.id} metric`);
    if (e.metric !== 'reps') assert.ok(e.unit, `${e.id} needs a unit`);
  }
});

test('every pattern that has a busy machine has at least two other options', () => {
  for (const p of Object.keys(SHIPPED.patterns)) {
    const stations = new Set(EXERCISES.filter((e) => e.pattern === p).map((e) => e.station));
    assert.ok(stations.size >= 2, `${p} has only ${[...stations]}`);
  }
});

// ---- storage -------------------------------------------------------------

test('storage survives a throwing backend', () => {
  const s = createStorage({ backend: memoryBackend({ throws: true }) });
  assert.equal(s.write('x', 1), false);
  assert.deepEqual(s.read('x', { a: 1 }), { a: 1 });
});

// ---- library -------------------------------------------------------------

test('library merges customs and overrides over the shipped list', () => {
  const storage = memoryStorage();
  const lib = createLibrary({ shipped: SHIPPED, storage });
  const mine = lib.add({ name: 'Cossack squat', pattern: 'single-leg-squat', station: 'floor', metric: 'reps' });
  assert.equal(mine.id, 'c-cossack-squat');
  assert.ok(lib.get('c-cossack-squat').custom);
  lib.update('dual-cable-row', { step: 5 });

  const again = createLibrary({ shipped: SHIPPED, storage });
  assert.equal(again.get('dual-cable-row').step, 5);
  assert.equal(again.get('c-cossack-squat').name, 'Cossack squat');
  assert.equal(again.all().length, EXERCISES.length + 1);
  assert.ok(again.remove('c-cossack-squat'));
  assert.ok(!again.remove('box-squat'), 'shipped exercises cannot be deleted');
  const after = createLibrary({ shipped: SHIPPED, storage });
  assert.equal(after.all().length, EXERCISES.length, 'deleted exercises leave the list');
  assert.equal(after.get('c-cossack-squat').name, 'Cossack squat', 'but old sessions can still name them');
});

test('library cleans bad input and keeps ids unique', () => {
  const lib = createLibrary({ shipped: SHIPPED, storage: memoryStorage() });
  assert.equal(lib.add({ name: '   ' }), null);
  const a = lib.add({ name: 'Thing', metric: 'nonsense', pattern: 'nope', unit: 'stone' }, () => 0.5);
  assert.equal(a.metric, 'load');
  assert.equal(a.pattern, 'core');
  assert.equal(a.unit, 'lb');
  const b = lib.add({ name: 'Thing' }, () => 0.5);
  assert.notEqual(a.id, b.id);
  assert.equal(slug('Half-kneeling KB Press!'), 'half-kneeling-kb-press');
});

test('library search matches name, pattern and equipment', () => {
  const lib = createLibrary({ shipped: SHIPPED, storage: memoryStorage() });
  assert.ok(lib.search('trx').some((e) => e.id === 'trx-row'));
  assert.ok(lib.search('row').some((e) => e.id === 'seated-cable-row'));
  assert.ok(lib.search('kettlebells').every((e) => e.station === 'kettlebells' || /kettlebells/i.test(e.name)));
});

// ---- settings ------------------------------------------------------------

test('gym starts as everything and narrows when a station is turned off', () => {
  const storage = memoryStorage();
  const s = createSettings({ storage, stations: SHIPPED.stations });
  assert.equal(s.gym(), null);
  s.setStation('ski-erg', false);
  const again = createSettings({ storage, stations: SHIPPED.stations });
  assert.ok(!again.hasStation('ski-erg'));
  assert.ok(again.hasStation('cable'));
  assert.ok(again.hasStation('floor'));
  again.setStation('ski-erg', true);
  assert.equal(again.gym(), null, 'turning everything back on returns to "all"');
});

// ---- workouts ------------------------------------------------------------

test('workouts save, reorder, clean and delete', () => {
  const storage = memoryStorage();
  const w = createWorkouts({ storage });
  w.save({ id: 'a', name: 'Day 1', items: [{ exerciseId: 'box-squat', sets: 3, reps: 8, block: '1' }, { bad: true }] });
  w.save({ id: 'b', name: 'Day 2', items: [] });
  assert.equal(w.save({ id: 'c', name: '' }), null);
  const again = createWorkouts({ storage });
  assert.equal(again.get('a').items.length, 1);
  assert.equal(again.get('a').items[0].reps, '8');
  again.move('b', -1);
  assert.deepEqual(again.all().map((x) => x.id), ['b', 'a']);
  again.remove('a');
  assert.deepEqual(createWorkouts({ storage }).all().map((x) => x.id), ['b']);
});

// ---- history -------------------------------------------------------------

test('the active session persists and finishing drops unticked entries', () => {
  const storage = memoryStorage();
  const h = createHistory({ storage });
  h.setActive({ id: 'x', date: '2026-10-12', title: 'Day 1', busy: ['cable'], entries: [
    { exerciseId: 'box-squat', sets: 3, reps: '8', value: 90, done: true },
    { exerciseId: 'hex-deadlift', sets: 3, reps: '6', value: 155, done: false },
  ] });
  const reopened = createHistory({ storage });
  assert.equal(reopened.active.entries.length, 2);
  assert.deepEqual(reopened.active.busy, ['cable']);
  const saved = reopened.finishActive(123);
  assert.equal(saved.entries.length, 1);
  assert.equal(saved.finishedAt, 123);
  assert.equal(reopened.active, null);
  const after = createHistory({ storage });
  assert.equal(after.active, null);
  assert.equal(after.all().length, 1);
});

test('history sorts newest first and rejects malformed sessions', () => {
  const storage = memoryStorage();
  storage.write(KEYS.history, [
    { id: 'a', date: '2025-01-01', entries: [] },
    { id: 'b', date: '2025-03-01', entries: [{ exerciseId: 'x', value: -3 }] },
    { id: 'c', date: 'yesterday', entries: [] },
    'junk',
  ]);
  const h = createHistory({ storage });
  assert.deepEqual(h.all().map((s) => s.id), ['b', 'a']);
  assert.equal(h.get('b').entries[0].value, null, 'negative values are dropped');
  assert.equal(cleanSession({ id: 'z', date: '2025-01-01', approxDate: true }).approxDate, true);
});

// ---- backup --------------------------------------------------------------

test('backup round-trips and merges without losing device data', () => {
  const a = memoryStorage();
  createWorkouts({ storage: a }).save({ id: 'w1', name: 'Day 1', items: [] });
  const ha = createHistory({ storage: a });
  ha.setActive({ id: 's1', date: '2026-10-01', entries: [{ exerciseId: 'box-squat', value: 90, done: true }] });
  ha.finishActive(1);
  createLibrary({ shipped: SHIPPED, storage: a }).add({ name: 'Cossack squat', metric: 'reps' });
  const text = JSON.stringify(createBackup(a, Date.UTC(2026, 9, 12)));

  const b = memoryStorage();
  const hb = createHistory({ storage: b });
  hb.setActive({ id: 's2', date: '2026-10-05', entries: [{ exerciseId: 'box-squat', value: 95, done: true }] });
  hb.finishActive(2);

  const parsed = parseBackup(text);
  assert.ok(parsed.ok);
  const r = restoreBackup(b, parsed.backup);
  assert.deepEqual(r, { sessions: 1, workouts: 1, exercises: 1, messages: 0 });
  assert.deepEqual(createHistory({ storage: b }).all().map((s) => s.id), ['s2', 's1']);
  assert.equal(restoreBackup(b, parsed.backup).sessions, 0, 'importing twice adds nothing');
});

test('parseBackup explains what is wrong with a bad file', () => {
  assert.match(parseBackup('{').error, /JSON/);
  assert.match(parseBackup('{"app":"strikr","format":1}').error, /Lift Log/);
  assert.match(parseBackup('{"app":"liftlog","format":9}').error, /format 9/);
  assert.match(backupFilename(Date.UTC(2026, 9, 12, 12)), /^liftlog-backup-2026-10-12\.json$/);
});

// ---- welcome messages ----------------------------------------------------

test('welcome messages cycle in order and survive a reload', () => {
  const storage = memoryStorage();
  const s = createSettings({ storage, stations: SHIPPED.stations });
  assert.equal(s.nextMessage(), null, 'nothing shows until there are messages');
  s.setMessages('Have a great workout!\n\n  Proud of you  \nGo get it', 'A');
  assert.deepEqual(s.messages, ['Have a great workout!', 'Proud of you', 'Go get it']);
  assert.deepEqual(s.nextMessage(), { text: 'Have a great workout!', from: 'A' });
  assert.equal(s.nextMessage().text, 'Proud of you');
  const again = createSettings({ storage, stations: SHIPPED.stations });
  assert.equal(again.nextMessage().text, 'Go get it', 'picks up where it left off');
  assert.equal(again.nextMessage().text, 'Have a great workout!', 'then starts over');
});

test('cleanMessages trims, drops blanks and caps length', () => {
  assert.deepEqual(cleanMessages(['  hi ', '', 3, 'x'.repeat(400)]).map((m) => m.length), [2, 280]);
  assert.deepEqual(cleanMessages(null), []);
});

test('a message file replaces messages but keeps her theme and gym', () => {
  const storage = memoryStorage();
  const s = createSettings({ storage, stations: SHIPPED.stations });
  s.setTheme('dark');
  s.setStation('ski-erg', false);
  s.setMessages(['old'], 'A');
  const r = restoreBackup(storage, { app: 'liftlog', format: 1, settings: { messages: ['new one', 'new two'], messageFrom: 'A' } });
  assert.equal(r.messages, 2);
  const after = createSettings({ storage, stations: SHIPPED.stations });
  assert.deepEqual(after.messages, ['new one', 'new two']);
  assert.equal(after.theme, 'dark');
  assert.ok(!after.hasStation('ski-erg'));
  assert.equal(after.nextMessage().text, 'new one');
});
