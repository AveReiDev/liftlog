/**
 * Shared sheets: pick an exercise from the library, and add or edit one.
 */

import { openSheet, confirmSheet } from './sheet.js';
import { esc, toast } from './util.js';
import { METRICS, formatValue } from '../engine/units.js';
import { lastFor, frequency } from '../engine/progress.js';

const METRIC_LABELS = {
  load: 'Weight',
  assist: 'Machine assistance (less is better)',
  reps: 'Bodyweight (no number)',
  hold: 'Hold time (seconds)',
  time: 'Sprint time (seconds, less is better)',
  height: 'Height (inches)',
  watts: 'Power (watts)',
  speed: 'Speed (mph)',
};

/**
 * @param {object} app
 * @param {object} o
 * @param {string} o.title
 * @param {(id: string) => void} o.onPick
 * @param {boolean} [o.manage]  tapping opens the editor instead of picking
 */
export function pickExercise(app, { title = 'Add exercise', onPick, manage = false }) {
  const { library, settings } = app;
  const history = app.history.all();
  const counts = frequency(history);
  let query = '';
  let pattern = 'all';

  const patternChips = [['all', 'All'], ['mine', 'Done before'], ...Object.entries(library.patterns)]
    .map(([id, label]) => `<button class="chip" data-pattern="${id}">${esc(label)}</button>`).join('');

  const sheet = openSheet({
    title,
    tall: true,
    closeLabel: manage ? 'Done' : 'Cancel',
    body: `
      <input class="input search" type="search" placeholder="Search exercises or equipment" id="pick-q" autocomplete="off">
      <div class="chips scroll" style="margin-bottom:12px">${patternChips}</div>
      <div class="card"><button class="row" data-new><span class="row-main"><span class="row-title link">+ New exercise</span><span class="row-sub">Add one that isn’t in the list</span></span></button></div>
      <div id="pick-list" style="margin-top:12px"></div>`,
    onMount(el, close) {
      const list = el.querySelector('#pick-list');
      const chips = el.querySelectorAll('[data-pattern]');

      function render() {
        chips.forEach((c) => c.classList.toggle('on', c.dataset.pattern === pattern));
        let items = library.search(query);
        if (pattern === 'mine') items = items.filter((e) => counts.has(e.id));
        else if (pattern !== 'all') items = items.filter((e) => e.pattern === pattern);
        items = [...items].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || a.name.localeCompare(b.name));
        if (!items.length) {
          list.innerHTML = `<div class="empty"><h3>No matches</h3><p>Try another word, or add it as a new exercise.</p></div>`;
          return;
        }
        list.innerHTML = `<div class="card">${items.map((e) => {
          const last = counts.has(e.id) ? lastFor(history, e.id) : null;
          const away = !settings.hasStation(e.station) ? ' · not at your gym' : '';
          const lastTxt = last?.value != null ? ` · last <b class="num">${esc(formatValue(e, last.value, { short: true }))}</b>` : '';
          return `<button class="row" data-id="${esc(e.id)}"><span class="row-main"><span class="row-title">${esc(e.name)}</span><span class="row-sub">${esc(library.stations[e.station] ?? '')}${lastTxt}${away}</span></span>${e.custom ? '<span class="tag">Yours</span>' : ''}</button>`;
        }).join('')}</div>`;
      }

      el.querySelector('#pick-q').addEventListener('input', (e) => { query = e.target.value; render(); });
      el.querySelector('.chips').addEventListener('click', (e) => {
        const c = e.target.closest('[data-pattern]');
        if (c) { pattern = c.dataset.pattern; render(); }
      });
      el.querySelector('[data-new]').addEventListener('click', () => {
        editExercise(app, {
          draft: { name: query.trim(), pattern: pattern in library.patterns ? pattern : undefined },
          onSaved(ex) {
            if (manage) { render(); return; }
            close();
            onPick?.(ex.id);
          },
        });
      });
      list.addEventListener('click', (e) => {
        const row = e.target.closest('[data-id]');
        if (!row) return;
        if (manage) {
          editExercise(app, { exercise: library.get(row.dataset.id), onSaved: render });
        } else {
          close();
          onPick?.(row.dataset.id);
        }
      });
      render();
    },
  });
  return sheet;
}

/** Add a new exercise (draft) or edit an existing one. */
export function editExercise(app, { exercise = null, draft = {}, onSaved }) {
  const { library } = app;
  const e = exercise ?? { name: '', pattern: 'core', station: 'floor', metric: 'load', unit: 'lb', ...draft };
  const isNew = !exercise;
  const shipped = exercise && !exercise.custom;
  const opt = (obj, current) => Object.entries(obj).map(([k, v]) => `<option value="${esc(k)}"${k === current ? ' selected' : ''}>${esc(v)}</option>`).join('');

  openSheet({
    title: isNew ? 'New exercise' : 'Edit exercise',
    tall: true,
    closeLabel: 'Cancel',
    body: `
      <div class="field"><label for="ex-name">Name</label><input class="input" id="ex-name" value="${esc(e.name)}" placeholder="e.g. Cossack squat" autocomplete="off"></div>
      <div class="field"><label for="ex-pattern">Movement</label><select class="input" id="ex-pattern">${opt(library.patterns, e.pattern)}</select>
        <span class="hint">Swaps suggest other exercises with the same movement.</span></div>
      <div class="field"><label for="ex-station">Equipment</label><select class="input" id="ex-station">${opt(library.stations, e.station)}</select>
        <span class="hint">When this is busy, swaps avoid it for the rest of the session.</span></div>
      <div class="field"><label for="ex-metric">What you track</label><select class="input" id="ex-metric">${opt(METRIC_LABELS, e.metric)}</select></div>
      <div class="field" id="unit-field"><label for="ex-unit">Unit</label><select class="input" id="ex-unit">${opt({ lb: 'lb', kg: 'kg' }, e.unit ?? 'lb')}</select></div>
      <div class="field" id="per-field"><label for="ex-per">Weight is</label><select class="input" id="ex-per">${opt({ '': 'Total', side: 'Per side (plate-loaded machines)', hand: 'Each hand (two kettlebells or dumbbells)' }, e.per ?? '')}</select></div>
      <div class="field" id="step-field"><label for="ex-step">+ / − step</label><input class="input" id="ex-step" inputmode="decimal" value="${esc(e.step ?? '')}" placeholder="${e.unit === 'kg' ? 'Next kettlebell size' : '5'}">
        <span class="hint">Leave blank for kg to step through kettlebell sizes.</span></div>
      ${shipped ? '<p class="hint">Changes apply to this exercise everywhere, including past sessions.</p>' : ''}`,
    foot: `<button class="btn primary block" data-save>${isNew ? 'Add exercise' : 'Save'}</button>${exercise?.custom ? '<button class="btn danger block" data-del>Delete exercise</button>' : ''}`,
    onMount(el, close) {
      const $ = (id) => el.querySelector(id);
      function sync() {
        const m = $('#ex-metric').value;
        const weighted = m === 'load' || m === 'assist';
        $('#unit-field').hidden = !weighted;
        $('#per-field').hidden = m !== 'load';
        $('#step-field').hidden = m === 'reps';
      }
      $('#ex-metric').addEventListener('change', sync);
      sync();
      if (isNew) setTimeout(() => $('#ex-name').focus(), 250);

      $('[data-save]').addEventListener('click', () => {
        const metric = $('#ex-metric').value;
        const step = Number.parseFloat($('#ex-step').value.replace(',', '.'));
        const fields = {
          name: $('#ex-name').value,
          pattern: $('#ex-pattern').value,
          station: $('#ex-station').value,
          metric,
          unit: metric === 'load' || metric === 'assist' ? $('#ex-unit').value : METRICS[metric].unit,
          per: metric === 'load' ? $('#ex-per').value || undefined : undefined,
          step: Number.isFinite(step) && step > 0 ? step : undefined,
        };
        if (!fields.name.trim()) { toast('Give it a name first.'); return; }
        const saved = isNew ? library.add(fields) : library.update(exercise.id, fields);
        if (!saved) { toast('That couldn’t be saved. Check the name.'); return; }
        close();
        toast(isNew ? `Added ${saved.name}` : 'Saved');
        onSaved?.(saved);
      });
      $('[data-del]')?.addEventListener('click', async () => {
        const ok = await confirmSheet({
          title: `Delete ${exercise.name}?`,
          message: 'It disappears from the list and from plans. Past sessions keep their entries.',
          confirm: 'Delete', danger: true,
        });
        if (!ok) return;
        library.remove(exercise.id);
        close();
        onSaved?.(null);
      });
    },
  });
}
