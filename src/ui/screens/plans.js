/**
 * Plans: the workouts her coach writes, as reusable lists of exercises with
 * sets and reps. Also the way into the exercise library.
 */

import { esc, plural, toast } from '../util.js';
import { openSheet, confirmSheet } from '../sheet.js';
import { pickExercise } from '../pickers.js';
import { newId } from '../../store/history.js';

export function createPlansScreen({ root, app }) {
  const { library } = app;

  function render() {
    const plans = app.workouts.all();
    const mine = library.all().filter((e) => e.custom).length;
    root.innerHTML = `
      <div class="page-head"><div><h1 class="page-title">Plans</h1><div class="page-sub">Sets and reps stay put. Weights come from last time.</div></div></div>
      <div class="section-label">Workouts <button class="link" data-new>+ New plan</button></div>
      ${plans.length ? `<div class="card">${plans.map((w, i) => `
        <div class="row">
          <button class="row-main" data-edit="${esc(w.id)}" style="text-align:left;flex:1"><span class="row-title">${esc(w.name)}</span><span class="row-sub">${plural(w.items.length, 'exercise')}</span></button>
          <span class="icon-btns">
            <button class="icon-btn" data-up="${esc(w.id)}" ${i === 0 ? 'disabled' : ''} aria-label="Move up">↑</button>
            <button class="icon-btn" data-down="${esc(w.id)}" ${i === plans.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button>
          </span>
        </div>`).join('')}</div>` : `<div class="card empty"><h3>No plans yet</h3><p>Make one for each training day, like “Day 1 · Knee / Pull”.</p><button class="btn primary" data-new>Create a plan</button></div>`}

      <div class="section-label">Exercises</div>
      <div class="card">
        <button class="row" data-library><span class="row-main"><span class="row-title">Exercise library</span><span class="row-sub">${library.all().length} exercises${mine ? `, ${mine} of them yours` : ''}. Add new ones or change step sizes.</span></span><span class="chev">›</span></button>
      </div>`;
  }

  root.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.new !== undefined) editPlan(null);
    else if (t.dataset.edit) editPlan(t.dataset.edit);
    else if (t.dataset.up) { app.workouts.move(t.dataset.up, -1); render(); }
    else if (t.dataset.down) { app.workouts.move(t.dataset.down, 1); render(); }
    else if (t.dataset.library !== undefined) pickExercise(app, { title: 'Exercise library', manage: true });
  });

  /** Create (id null) or edit a plan. Edits happen on a copy until Save. */
  function editPlan(id) {
    const existing = id ? app.workouts.get(id) : null;
    const plan = existing
      ? JSON.parse(JSON.stringify(existing))
      : { id: newId('w', app.now()), name: '', items: [], createdAt: app.now() };

    const itemHTML = (it, i) => `
      <div class="item" data-i="${i}">
        <div class="item-top">
          <button class="item-name" data-change>${esc(library.get(it.exerciseId)?.name ?? 'Deleted exercise')} <span class="chev">›</span></button>
          <span class="icon-btns">
            <button class="icon-btn" data-mv="-1" aria-label="Move up">↑</button>
            <button class="icon-btn" data-mv="1" aria-label="Move down">↓</button>
            <button class="icon-btn danger" data-rm aria-label="Remove">✕</button>
          </span>
        </div>
        <div class="item-fields">
          <label>Block<input data-f="block" value="${esc(it.block)}" placeholder="1"></label>
          <label>Sets<input data-f="sets" inputmode="numeric" value="${it.sets}"></label>
          <label>Reps<input data-f="reps" value="${esc(it.reps)}"></label>
        </div>
      </div>`;

    openSheet({
      title: existing ? 'Edit plan' : 'New plan',
      tall: true,
      closeLabel: 'Cancel',
      body: `
        <div class="field"><label for="pn">Name</label><input class="input" id="pn" value="${esc(plan.name)}" placeholder="Day 1 · Knee / Pull"></div>
        <div class="section-label">Exercises</div>
        <div id="items"></div>
        <button class="btn block" data-add style="margin-top:12px">+ Add exercise</button>
        <p class="hint">Block groups exercises the way your coach writes them: 1a and 1b are both Block 1. Use words too, like Warm-up or Cardio.</p>
        ${existing ? '<button class="btn ghost block" data-delete style="color:var(--danger);margin-top:12px">Delete plan</button>' : ''}`,
      foot: '<button class="btn primary block" data-save>Save plan</button>',
      onMount(el, close) {
        const box = el.querySelector('#items');
        const paint = () => {
          box.innerHTML = plan.items.length ? `<div class="card">${plan.items.map(itemHTML).join('')}</div>` : '<p class="hint">No exercises yet.</p>';
        };
        paint();
        if (!existing) setTimeout(() => el.querySelector('#pn').focus(), 250);

        box.addEventListener('input', (ev) => {
          const f = ev.target.dataset.f;
          const i = Number(ev.target.closest('.item')?.dataset.i);
          if (!f || !plan.items[i]) return;
          if (f === 'sets') {
            const n = Number.parseInt(ev.target.value, 10);
            if (n > 0 && n <= 20) plan.items[i].sets = n;
          } else plan.items[i][f] = ev.target.value;
        });
        box.addEventListener('click', (ev) => {
          const item = ev.target.closest('.item');
          if (!item) return;
          const i = Number(item.dataset.i);
          if (ev.target.closest('[data-rm]')) { plan.items.splice(i, 1); paint(); }
          else if (ev.target.closest('[data-mv]')) {
            const j = i + Number(ev.target.closest('[data-mv]').dataset.mv);
            if (j >= 0 && j < plan.items.length) { [plan.items[i], plan.items[j]] = [plan.items[j], plan.items[i]]; paint(); }
          } else if (ev.target.closest('[data-change]')) {
            pickExercise(app, { title: 'Change to…', onPick(xid) { plan.items[i].exerciseId = xid; paint(); } });
          }
        });
        el.querySelector('[data-add]').addEventListener('click', () => {
          pickExercise(app, {
            onPick(xid) {
              const last = plan.items.at(-1);
              plan.items.push({ exerciseId: xid, block: last?.block ?? '1', sets: last?.sets ?? 3, reps: last?.reps ?? '8' });
              paint();
            },
          });
        });
        el.querySelector('[data-save]').addEventListener('click', () => {
          plan.name = el.querySelector('#pn').value.trim();
          if (!plan.name) { toast('Give the plan a name first.'); return; }
          app.workouts.save(plan);
          close();
          app.refreshAll();
          toast('Plan saved');
        });
        el.querySelector('[data-delete]')?.addEventListener('click', async () => {
          const ok = await confirmSheet({ title: `Delete ${existing.name}?`, message: 'Past sessions stay in History.', confirm: 'Delete', danger: true });
          if (!ok) return;
          app.workouts.remove(existing.id);
          close();
          app.refreshAll();
        });
      },
    });
  }

  return { render, refresh: render, editPlan };
}
