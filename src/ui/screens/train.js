/**
 * Train: pick today's plan and go. Each plan card previews the first few
 * exercises with the weight she'll start at, so she can see where she is
 * before she gets to the gym.
 */

import { esc, fmtDate, fmtAgo, plural } from '../util.js';
import { formatValue } from '../../engine/units.js';
import { lastFor } from '../../engine/progress.js';

export function createTrainScreen({ root, app }) {
  const { library } = app;

  function lastDone(workoutId, history) {
    return history.find((s) => s.workoutId === workoutId) ?? null;
  }

  function planCard(w, history) {
    const done = lastDone(w.id, history);
    // Preview the working sets, not the warm-up: that's where the weights are.
    const main = w.items.filter((it) => !/warm/i.test(it.block));
    const shown = (main.length ? main : w.items).slice(0, 4);
    const preview = shown.map((it) => {
      const ex = library.get(it.exerciseId);
      if (!ex) return '';
      const last = lastFor(history, ex.id);
      const v = last?.value != null ? formatValue(ex, last.value, { short: true }) : `${it.sets}×${it.reps}`;
      return `<li>${esc(ex.name)} · <span class="w">${esc(v)}</span></li>`;
    }).join('');
    const more = w.items.length > shown.length ? `<li>+ ${w.items.length - shown.length} more</li>` : '';
    const when = done ? (done.approxDate ? ' · last done in your old notes' : ` · last done ${esc(fmtAgo(done.date, app.today()))}`) : '';
    return `
      <div class="card plan">
        <div class="plan-top">
          <div><h3 class="plan-name">${esc(w.name)}</h3><div class="hint">${plural(w.items.length, 'exercise')}${when}</div></div>
        </div>
        ${w.items.length ? `<ul class="plan-list">${preview}${more}</ul>` : '<p class="hint" style="margin:0">No exercises yet. Add some in Plans.</p>'}
        <div class="plan-foot">
          <button class="btn ghost" data-edit="${esc(w.id)}" style="margin-left:-8px">Edit</button>
          <button class="btn primary" data-start="${esc(w.id)}" ${w.items.length ? '' : 'disabled'}>Start</button>
        </div>
      </div>`;
  }

  function render() {
    const history = app.history.all();
    const active = app.history.active;
    const plans = app.workouts.all();
    const recent = history.slice(0, 4);

    root.innerHTML = `
      <div class="page-head"><div><h1 class="page-title">Train</h1><div class="page-sub">${esc(fmtDate(app.today(), { today: app.today(), weekday: true }))}</div></div></div>

      ${active ? `
        <div class="card resume">
          <div><div class="row-title">${esc(active.title)} is in progress</div><div class="row-sub">${active.entries.filter((e) => e.done).length} of ${plural(active.entries.length, 'exercise')} done</div></div>
          <button class="btn block" data-resume>Resume workout</button>
        </div>` : ''}

      <div class="section-label">Your plans <button class="link" data-new-plan>+ New plan</button></div>
      ${plans.length ? `<div class="stack">${plans.map((w) => planCard(w, history)).join('')}</div>` : `
        <div class="card empty">
          <h3>No plans yet</h3>
          <p>A plan is a list of exercises with sets and reps. Each time you start one, the weights fill in from last time.</p>
          <button class="btn primary" data-new-plan>Create a plan</button>
          <p class="hint">Have a backup file? Import it in Settings.</p>
        </div>`}

      ${recent.length ? `
        <div class="section-label">Do a past session again</div>
        <div class="card">${recent.map((s) => `
          <button class="row" data-repeat="${esc(s.id)}"><span class="row-main"><span class="row-title">${esc(s.title)}</span><span class="row-sub">${esc(fmtDate(s.date, { today: app.today(), approx: s.approxDate }))} · ${plural(s.entries.length, 'exercise')}</span></span><span class="chev">›</span></button>`).join('')}
        </div>` : ''}

      <button class="btn block" data-empty style="margin-top:20px">Start an empty session</button>`;
  }

  root.addEventListener('click', async (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.resume !== undefined) return app.openSession();
    if (t.dataset.start) return app.start({ workoutId: t.dataset.start });
    if (t.dataset.repeat) return app.start({ sessionId: t.dataset.repeat });
    if (t.dataset.empty !== undefined) return app.start({});
    if (t.dataset.edit) return app.editPlan(t.dataset.edit);
    if (t.dataset.newPlan !== undefined) return app.editPlan(null);
  });

  return { render, refresh: render };
}
