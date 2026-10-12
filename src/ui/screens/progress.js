/**
 * Progress: how often she trains, and every lift's best and trend.
 * Tapping a lift opens its chart and full log.
 */

import { esc, fmtDate, plural } from '../util.js';
import { openSheet } from '../sheet.js';
import { lineChart, sparkline, weekBars } from '../chart.js';
import { formatValue, formatNumber, unitOf, betterOf } from '../../engine/units.js';
import { prBoard, seriesFor, entriesFor, weeklyCounts, bestFor } from '../../engine/progress.js';

export function createProgressScreen({ root, app }) {
  const { library } = app;
  let query = '';

  function delta(ex, first, best) {
    if (!first || !best || first.value === best.value) return '<span class="delta flat">—</span>';
    const d = best.value - first.value;
    const lower = betterOf(ex) === 'lower';
    const good = lower ? d < 0 : d > 0;
    const sign = d > 0 ? '+' : '−';
    return `<span class="delta ${good ? 'good' : 'flat'}">${sign}${esc(formatNumber(Math.abs(d)))} ${esc(unitOf(ex))}</span>`;
  }

  function render() {
    const history = app.history.all();
    const today = app.today();
    const dated = history.filter((s) => !s.approxDate);
    const month = today.slice(0, 7);
    const thisMonth = dated.filter((s) => s.date.startsWith(month)).length;
    const weeks = weeklyCounts(history, today, 12);
    const avg = weeks.slice(-8).reduce((a, w) => a + w.count, 0) / 8;

    let rows = prBoard(library.all(), history);
    if (query) rows = rows.filter((r) => r.exercise.name.toLowerCase().includes(query.toLowerCase()));

    root.innerHTML = `
      <div class="page-head"><div><h1 class="page-title">Progress</h1><div class="page-sub">${plural(history.length, 'session')} logged</div></div></div>

      <div class="stats">
        <div class="stat"><div class="big">${thisMonth}</div><div class="label">this month</div></div>
        <div class="stat"><div class="big">${avg.toFixed(1).replace(/\.0$/, '')}</div><div class="label">per week (8 wk)</div></div>
        <div class="stat"><div class="big">${rows.length}</div><div class="label">lifts tracked</div></div>
      </div>

      <div class="section-label">Sessions per week</div>
      <div class="card weeks">${weekBars(weeks, { label: (w) => fmtDate(w.week, { today }) })}</div>

      <div class="section-label">Personal bests</div>
      <input class="input search" type="search" placeholder="Find a lift" id="pr-q" value="${esc(query)}" autocomplete="off">
      ${rows.length ? `<div class="card">${rows.map((r) => {
        // Up always means progress in the little trend line, even when less is better.
        const flip = betterOf(r.exercise) === 'lower' ? -1 : 1;
        const series = seriesFor(r.exercise, history).map((p) => p.value * flip);
        const when = r.best.approxDate ? 'best in old notes' : `best ${fmtDate(r.best.date, { today })}`;
        return `<button class="pr-row" data-id="${esc(r.exercise.id)}">
          <span class="row-main"><span class="row-title">${esc(r.exercise.name)}</span><span class="row-sub">${plural(r.sessions, 'session')} · ${esc(when)}</span></span>
          ${sparkline(series)}
          <span><div class="best">${esc(formatValue(r.exercise, r.best.value, { short: true }))}</div><div class="delta">${delta(r.exercise, r.first, r.best)}</div></span>
        </button>`;
      }).join('')}</div>` : `<div class="card empty"><h3>${query ? 'No lifts match' : 'No lifts yet'}</h3><p>${query ? 'Try another name.' : 'Finish a workout and your bests show up here.'}</p></div>`}`;

    const q = root.querySelector('#pr-q');
    q.addEventListener('input', () => {
      query = q.value;
      const pos = q.selectionStart;
      render();
      const again = root.querySelector('#pr-q');
      again.focus();
      again.setSelectionRange(pos, pos);
    });
  }

  root.addEventListener('click', (e) => {
    const row = e.target.closest('[data-id]');
    if (row) openExercise(app, row.dataset.id);
  });

  return { render, refresh: render };
}

/** One lift: chart, best/first/last, and every logged set. */
export function openExercise(app, id) {
  const ex = app.library.get(id);
  if (!ex) return;
  const history = app.history.all();
  const today = app.today();
  const series = seriesFor(ex, history);
  const log = entriesFor(history, id).reverse();
  const best = bestFor(ex, history);
  const showE1rm = ex.metric === 'load' && series.some((p) => p.e1rm != null);
  const unit = unitOf(ex) + (ex.per === 'side' ? '/side' : ex.per === 'hand' ? ' each' : '');
  const points = series.map((p) => ({ label: fmtDate(p.date, { today, approx: p.approxDate }), value: p.value, e1rm: p.e1rm }));

  openSheet({
    title: ex.name,
    tall: true,
    closeLabel: 'Done',
    body: `
      ${series.length ? `
        <div class="stats">
          <div class="stat"><div class="big">${esc(formatNumber(best.value))}</div><div class="label">best (${esc(unit)})</div></div>
          <div class="stat"><div class="big">${esc(formatNumber(series[0].value))}</div><div class="label">first</div></div>
          <div class="stat"><div class="big">${esc(formatNumber(series.at(-1).value))}</div><div class="label">latest</div></div>
        </div>
        <div class="card chart-card" style="margin-top:12px">
          ${showE1rm ? '<div class="legend"><span><i></i>Weight</span><span><i class="dash"></i>Estimated 1-rep max</span></div>' : ''}
          ${lineChart(points, { unit, showE1rm })}
        </div>
        ${ex.metric === 'assist' ? '<p class="hint">Lower is better: less machine help means you’re lifting more of yourself.</p>' : ''}
        ${showE1rm ? '<p class="hint">Estimated max combines weight and reps, so 85 lb × 8 and 100 lb × 5 can be compared.</p>' : ''}`
        : '<p class="hint">Nothing with a number logged yet.</p>'}
      <div class="section-label">Every session</div>
      ${log.length ? `<div class="card">${log.map((e) => `
        <div class="log-row"><span class="d">${esc(fmtDate(e.date, { today, approx: e.approxDate }))}</span>
        <span class="row-main"><span>${esc(`${e.sets}×${e.reps}`)}</span>${e.note ? `<span class="row-sub">${esc(e.note)}</span>` : ''}</span>
        <span class="v">${esc(formatValue(ex, e.value, { short: true }))}</span></div>`).join('')}</div>` : '<p class="hint">Not logged yet.</p>'}`,
  });
}
