/**
 * History: every finished session by month. Tap one to see it, fix a
 * mistyped weight, do it again, or delete it.
 */

import { esc, fmtDate, fmtMonth, plural, toast } from '../util.js';
import { openSheet, confirmSheet } from '../sheet.js';
import { formatValue, formatNumber, parseValue, tracksNumber, unitOf } from '../../engine/units.js';
import { sessionSummary } from '../../engine/progress.js';

export function createHistoryScreen({ root, app }) {
  const { library } = app;
  const name = (id) => library.get(id)?.name ?? 'Deleted exercise';

  function render() {
    const history = app.history.all();
    const today = app.today();
    if (!history.length) {
      root.innerHTML = `<div class="page-head"><h1 class="page-title">History</h1></div>
        <div class="card empty"><h3>No sessions yet</h3><p>Finished workouts are saved here. To bring in old notes or another phone’s data, import a backup in Settings.</p></div>`;
      return;
    }
    const groups = [];
    for (const s of history) {
      const key = s.approxDate ? 'Undated, from notes' : fmtMonth(s.date);
      if (groups.at(-1)?.key !== key) groups.push({ key, items: [] });
      groups.at(-1).items.push(s);
    }
    root.innerHTML = `
      <div class="page-head"><div><h1 class="page-title">History</h1><div class="page-sub">${plural(history.length, 'session')}</div></div></div>
      ${groups.map((g) => `
        <div class="section-label">${esc(g.key)}</div>
        <div class="card">${g.items.map((s) => `
          <button class="row" data-id="${esc(s.id)}">
            <span class="row-main"><span class="row-title">${esc(s.title)}</span>
            <span class="row-sub">${esc(fmtDate(s.date, { today, approx: s.approxDate, weekday: !s.approxDate }))} · ${plural(s.entries.length, 'exercise')}</span></span>
            <span class="chev">›</span></button>`).join('')}
        </div>`).join('')}`;
  }

  root.addEventListener('click', (e) => {
    const row = e.target.closest('[data-id]');
    if (row) openSession(row.dataset.id);
  });

  function openSession(id) {
    const s = app.history.get(id);
    if (!s) return;
    const all = app.history.all();
    const summary = sessionSummary(s, all.filter((x) => x.date < s.date), (x) => library.get(x));
    const prIds = new Set(summary.prs.map((p) => p.exercise.id));
    let editing = false;

    const entryRow = (e, i) => {
      const ex = library.get(e.exerciseId);
      const numeric = ex && tracksNumber(ex);
      const value = editing && numeric
        ? `<input data-i="${i}" inputmode="decimal" value="${esc(formatNumber(e.value))}" aria-label="${esc(name(e.exerciseId))}"> <span class="hint">${esc(unitOf(ex))}</span>`
        : esc(ex ? formatValue(ex, e.value, { short: true }) : '');
      return `<div class="hist-entry">
        <span class="row-main"><span class="row-title">${esc(name(e.exerciseId))} ${prIds.has(e.exerciseId) ? '<span class="tag pr">Best</span>' : ''}</span>
        <span class="row-sub">${esc(`${e.sets}×${e.reps}`)}${e.swappedFrom ? ` · for ${esc(name(e.swappedFrom))}` : ''}${e.note ? ` · ${esc(e.note)}` : ''}</span></span>
        <span class="v">${value}</span></div>`;
    };

    openSheet({
      title: s.title,
      tall: true,
      closeLabel: 'Done',
      body: '<div id="hs"></div>',
      foot: '<button class="btn primary block" data-again>Do this again</button>',
      onMount(el, close) {
        const box = el.querySelector('#hs');
        function paint() {
          box.innerHTML = `
            <div class="hint" style="margin-bottom:12px">${esc(fmtDate(s.date, { today: app.today(), approx: s.approxDate, weekday: !s.approxDate }))}${s.approxDate ? ' · imported from your notes, so the date is a guess' : ''}</div>
            ${s.note ? `<p class="hint">${esc(s.note)}</p>` : ''}
            <div class="card">${s.entries.map(entryRow).join('')}</div>
            <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
              <button class="btn sm" data-edit>${editing ? 'Save changes' : 'Fix a number'}</button>
              <button class="btn sm danger" data-del>Delete session</button>
            </div>`;
        }
        paint();
        box.addEventListener('click', async (ev) => {
          if (ev.target.closest('[data-edit]')) {
            if (editing) {
              box.querySelectorAll('input[data-i]').forEach((inp) => {
                s.entries[Number(inp.dataset.i)].value = parseValue(inp.value);
              });
              app.history.replace(s);
              toast('Saved');
              render();
            }
            editing = !editing;
            paint();
          } else if (ev.target.closest('[data-del]')) {
            const ok = await confirmSheet({ title: 'Delete this session?', message: `${s.title}, ${fmtDate(s.date, { today: app.today(), approx: s.approxDate })}. This can’t be undone unless you have a backup.`, confirm: 'Delete', danger: true });
            if (!ok) return;
            app.history.remove(s.id);
            close();
            render();
            toast('Session deleted');
          }
        });
        el.querySelector('[data-again]').addEventListener('click', () => { close(); app.start({ sessionId: s.id }); });
      },
    });
  }

  return { render, refresh: render };
}
