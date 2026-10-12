/**
 * The workout in progress: the screen she has open at the gym.
 *
 * Each card shows last time's result and a weight box already filled with it.
 * The usual flow per exercise is: glance at "Last", tap + once (or not),
 * tick. "Busy?" opens alternates on equipment that's free.
 *
 * Rendering: the whole list re-renders only on structural changes (add,
 * remove, swap, reorder). Typing in a weight box never re-renders, so the
 * keyboard stays up; +/− and the tick re-render just that one card.
 */

import { esc, fmtDate, fmtAgo, toast, plural } from '../util.js';
import { openSheet, confirmSheet } from '../sheet.js';
import { pickExercise } from '../pickers.js';
import {
  formatValue, formatNumber, parseValue, stepValue, progressStep, tracksNumber, unitOf, isBetter,
} from '../../engine/units.js';
import { lastFor, isPersonalBest, sessionSummary } from '../../engine/progress.js';
import { suggestAlternates } from '../../engine/alternates.js';
import {
  updateEntry, addEntry, removeEntry, moveEntry, swapEntry, setBusy, groupByBlock,
} from '../../engine/session.js';

const CHECK = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.2L19 7"/></svg>';

export function createSessionScreen({ root, app }) {
  const { library } = app;
  const lookup = (id) => library.get(id) ?? { id, name: 'Deleted exercise', metric: 'reps', pattern: 'core', station: 'floor' };

  const session = () => app.history.active;
  const history = () => app.history.all();
  const commit = (next) => app.history.setActive(next);

  function blockTitle(label) {
    if (!label) return '';
    return /^\d+$/.test(label) ? `Block ${label}` : label;
  }

  // ---- one card --------------------------------------------------------

  function cardHTML(entry, index) {
    const ex = lookup(entry.exerciseId);
    const s = session();
    const hist = history();
    const last = lastFor(hist, ex.id, { excludeSessionId: s.id });
    const numeric = tracksNumber(ex);
    const unit = unitOf(ex);

    let lastLine = '<span class="last">First time. Start light.</span>';
    if (last) {
      const v = last.value != null ? formatValue(ex, last.value) : 'Bodyweight';
      lastLine = `<span class="last">Last <b>${esc(v)}</b> · ${esc(`${last.sets}×${last.reps}`)} · ${esc(fmtAgo(last.date, app.today(), last.approxDate))}</span>`;
    }

    const suggestion = numeric && last?.value != null && entry.value === last.value ? progressStep(ex, last.value) : null;
    const pr = numeric && entry.value != null && isPersonalBest(ex, entry.value, hist, { excludeSessionId: s.id });
    const up = !pr && numeric && last?.value != null && entry.value != null && isBetter(ex, entry.value, last.value);

    const swapped = entry.swappedFrom ? `<span class="tag swap">for ${esc(lookup(entry.swappedFrom).name)}</span>` : '';
    const note = entry.note ? `<div class="hint">“${esc(entry.note)}”</div>` : '';

    const stepper = numeric ? `
      <div class="stepper">
        <button class="step-btn" data-act="step" data-dir="-1" aria-label="Less">−</button>
        <label class="num-wrap"><input class="val" data-i="${index}" inputmode="decimal" enterkeyhint="done" autocomplete="off"
          value="${esc(formatNumber(entry.value))}" placeholder="0" aria-label="${esc(ex.name)} ${esc(unit)}">
          <span class="unit">${esc(unit)}${ex.per === 'side' ? '/side' : ex.per === 'hand' ? ' each' : ''}${ex.metric === 'assist' ? ' help' : ''}</span></label>
        <button class="step-btn" data-act="step" data-dir="1" aria-label="More">+</button>
      </div>` : '';

    const chips = [
      suggestion != null ? `<button class="chip try" data-act="try" data-v="${suggestion}">Try ${esc(formatValue(ex, suggestion, { short: true }))}</button>` : '',
      pr ? '<span class="chip badge-pr">New best</span>' : '',
      up ? `<span class="tag up">Up from ${esc(formatNumber(last.value))}</span>` : '',
    ].join('');

    return `
      <div class="entry-top">
        <button class="check" data-act="done" aria-label="${entry.done ? 'Mark not done' : 'Mark done'}" aria-pressed="${entry.done}">${CHECK}</button>
        <div style="min-width:0">
          <h3 class="entry-name">${esc(ex.name)}</h3>
          <div class="entry-meta">
            <span class="scheme"><input class="sets" data-i="${index}" inputmode="numeric" value="${entry.sets}" aria-label="Sets">×<input class="reps" data-i="${index}" value="${esc(entry.reps)}" aria-label="Reps"></span>
            <span>${esc(library.stations[ex.station] ?? '')}</span>
            ${swapped}
          </div>
        </div>
        <button class="more" data-act="more" aria-label="More options">⋯</button>
      </div>
      ${lastLine}
      ${stepper}
      <div class="entry-actions">
        ${chips}
        <span style="flex:1"></span>
        <button class="btn sm" data-act="swap">Busy? Swap</button>
        <button class="btn sm" data-act="note">${entry.note ? 'Edit note' : 'Note'}</button>
      </div>
      ${note}`;
  }

  function renderCard(index) {
    const card = root.querySelector(`.entry[data-i="${index}"]`);
    const entry = session()?.entries[index];
    if (!card || !entry) return render();
    card.classList.toggle('is-done', entry.done);
    card.innerHTML = cardHTML(entry, index);
    renderHeader();
  }

  // ---- header ----------------------------------------------------------

  function headerHTML() {
    const s = session();
    const done = s.entries.filter((e) => e.done).length;
    const pct = s.entries.length ? Math.round((done / s.entries.length) * 100) : 0;
    const busy = (s.busy ?? []).map((b) => `<button class="chip" data-unbusy="${esc(b)}">${esc(library.stations[b] ?? b)} ✕</button>`).join('');
    return `
      <div class="sess-bar">
        <button class="btn ghost" data-act="leave" style="margin-left:-8px">‹ Train</button>
        <span class="hint num">${done} / ${s.entries.length} done</span>
        <button class="btn primary sm" data-act="finish">Finish</button>
      </div>
      <button class="sess-title-btn" data-act="rename"><h1 class="sess-title">${esc(s.title)}</h1><span class="hint">${esc(fmtDate(s.date, { today: app.today(), weekday: true }))}</span></button>
      <div class="progressbar"><div style="width:${pct}%"></div></div>
      ${busy ? `<div class="busy-row">Busy today: ${busy}</div>` : ''}`;
  }

  function renderHeader() {
    const head = root.querySelector('.sess-head');
    if (head && session()) head.innerHTML = headerHTML();
  }

  // ---- whole screen ----------------------------------------------------

  function render() {
    const s = session();
    if (!s) { root.innerHTML = ''; return; }
    const groups = groupByBlock(s.entries);
    root.innerHTML = `
      <div class="sess-head">${headerHTML()}</div>
      ${s.entries.length ? '' : `<div class="empty"><h3>Nothing here yet</h3><p>Add the exercises you’re doing today.</p></div>`}
      ${groups.map((g) => `
        ${g.label ? `<div class="block-label">${esc(blockTitle(g.label))}</div>` : ''}
        <div class="stack">${g.items.map(({ entry, index }) => `<div class="card entry${entry.done ? ' is-done' : ''}" data-i="${index}">${cardHTML(entry, index)}</div>`).join('')}</div>
      `).join('')}
      <button class="btn block" data-act="add" style="margin-top:20px">+ Add exercise</button>
      <div class="dock"><div class="dock-inner">
        <button class="btn" data-act="add">+ Add</button>
        <button class="btn primary" data-act="finish">Finish workout</button>
      </div></div>`;
  }

  // ---- events ----------------------------------------------------------

  root.addEventListener('click', (e) => {
    const s = session();
    if (!s) return;
    const unbusy = e.target.closest('[data-unbusy]');
    if (unbusy) { commit(setBusy(s, unbusy.dataset.unbusy, false)); render(); return; }
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const card = btn.closest('.entry');
    const i = card ? Number(card.dataset.i) : -1;
    const entry = s.entries[i];
    const act = btn.dataset.act;

    if (act === 'done') {
      commit(updateEntry(s, i, { done: !entry.done }));
      renderCard(i);
      if (!entry.done && navigator.vibrate) navigator.vibrate(12);
    } else if (act === 'step') {
      const ex = lookup(entry.exerciseId);
      commit(updateEntry(s, i, { value: stepValue(ex, entry.value, Number(btn.dataset.dir)) }));
      renderCard(i);
    } else if (act === 'try') {
      commit(updateEntry(s, i, { value: Number(btn.dataset.v) }));
      renderCard(i);
    } else if (act === 'swap') {
      openSwap(i);
    } else if (act === 'note') {
      openNote(i);
    } else if (act === 'more') {
      openMore(i);
    } else if (act === 'add') {
      pickExercise(app, {
        onPick(id) { commit(addEntry(session(), { exerciseId: id, sets: 3, reps: '8' }, history())); render(); scrollToEnd(); },
      });
    } else if (act === 'finish') {
      openFinish();
    } else if (act === 'leave') {
      app.router.show('train');
    } else if (act === 'rename') {
      openRename();
    }
  });

  // Typing: save as she types, re-render only when she leaves the box.
  root.addEventListener('input', (e) => {
    const t = e.target;
    const i = Number(t.dataset.i);
    const s = session();
    if (!s || !s.entries[i]) return;
    if (t.classList.contains('val')) commit(updateEntry(s, i, { value: parseValue(t.value) }));
    else if (t.classList.contains('sets')) {
      const n = Number.parseInt(t.value, 10);
      if (n > 0 && n <= 20) commit(updateEntry(s, i, { sets: n }));
    } else if (t.classList.contains('reps')) commit(updateEntry(s, i, { reps: t.value.slice(0, 24) }));
  });
  root.addEventListener('change', (e) => {
    if (e.target.classList.contains('val')) renderCard(Number(e.target.dataset.i));
  });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('input')) e.target.blur();
  });
  // Selecting the whole number on focus means she can just type the new one.
  root.addEventListener('focusin', (e) => {
    if (e.target.classList.contains('val')) setTimeout(() => e.target.select(), 0);
  });

  function scrollToEnd() {
    const cards = root.querySelectorAll('.entry');
    cards[cards.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // ---- sheets ----------------------------------------------------------

  function openSwap(i) {
    const s = session();
    const entry = s.entries[i];
    const ex = lookup(entry.exerciseId);
    const stationName = library.stations[ex.station] ?? 'This equipment';
    let markBusy = true;

    openSheet({
      title: `Instead of ${ex.name}`,
      tall: true,
      closeLabel: 'Cancel',
      body: `
        <div class="card"><div class="row">
          <span class="row-main"><span class="row-title">${esc(stationName)} is busy</span><span class="row-sub">Leave it out of swaps for the rest of today</span></span>
          <button class="switch" role="switch" aria-checked="true" data-busy aria-label="${esc(stationName)} is busy"></button>
        </div></div>
        <div class="section-label">Same movement, free equipment</div>
        <div id="alts"></div>
        <button class="btn block" data-any style="margin-top:16px">Pick any exercise</button>`,
      onMount(el, close) {
        const skip = new Set(s.entries.map((x) => x.exerciseId));
        const hist = history();
        const alts = suggestAlternates({
          exercise: ex,
          exercises: library.all(),
          history: hist,
          busy: new Set(s.busy ?? []),
          gym: app.settings.gym(),
          skip,
        });
        el.querySelector('#alts').innerHTML = alts.length ? `<div class="card">${alts.map((a) => {
          const lastTxt = a.last?.value != null
            ? `Last <b>${esc(formatValue(a.exercise, a.last.value))}</b> · ${esc(fmtAgo(a.last.date, app.today(), a.last.approxDate))}`
            : a.count ? `Done ${plural(a.count, 'time')}` : 'New to you. Start light.';
          return `<button class="alt" data-id="${esc(a.exercise.id)}">
            <span class="row-main"><span class="row-title">${esc(a.exercise.name)}</span>
            <span class="row-sub">${esc(library.stations[a.exercise.station] ?? '')}${a.related ? ' · similar movement' : ''}</span>
            <span class="row-sub">${lastTxt}</span></span><span class="chev">›</span></button>`;
        }).join('')}</div>`
          : `<div class="empty"><h3>Nothing free that fits</h3><p>Everything for this movement is busy or not at your gym. Pick any exercise below, or check My gym in Settings.</p></div>`;

        const sw = el.querySelector('[data-busy]');
        sw.addEventListener('click', () => { markBusy = !markBusy; sw.setAttribute('aria-checked', String(markBusy)); });

        const choose = (id) => {
          let next = swapEntry(session(), i, id, history());
          if (markBusy) next = setBusy(next, ex.station, true);
          commit(next);
          close();
          render();
          toast(`Swapped to ${lookup(id).name}`);
        };
        el.querySelector('#alts').addEventListener('click', (ev) => {
          const b = ev.target.closest('[data-id]');
          if (b) choose(b.dataset.id);
        });
        el.querySelector('[data-any]').addEventListener('click', () => pickExercise(app, { title: 'Swap for…', onPick: choose }));
      },
    });
  }

  function openNote(i) {
    const entry = session().entries[i];
    openSheet({
      title: lookup(entry.exerciseId).name,
      closeLabel: 'Cancel',
      body: `<div class="field"><label for="note-t">Note</label><textarea class="input" id="note-t" placeholder="e.g. 65×5, 85×5, then 100×5×5. Pause reps. Left side tight.">${esc(entry.note ?? '')}</textarea></div>`,
      foot: '<button class="btn primary block" data-save>Save note</button>',
      onMount(el, close) {
        setTimeout(() => el.querySelector('#note-t').focus(), 250);
        el.querySelector('[data-save]').addEventListener('click', () => {
          const note = el.querySelector('#note-t').value.trim();
          commit(updateEntry(session(), i, { note: note || undefined }));
          close();
          renderCard(i);
        });
      },
    });
  }

  function openMore(i) {
    const s = session();
    const ex = lookup(s.entries[i].exerciseId);
    openSheet({
      title: ex.name,
      body: `<div class="card">
        <button class="row" data-m="change"><span class="row-title">Change exercise</span><span class="chev">›</span></button>
        <button class="row" data-m="up" ${i === 0 ? 'disabled' : ''}><span class="row-title">Move up</span></button>
        <button class="row" data-m="down" ${i === s.entries.length - 1 ? 'disabled' : ''}><span class="row-title">Move down</span></button>
        <button class="row" data-m="block"><span class="row-main"><span class="row-title">Block</span><span class="row-sub">${esc(s.entries[i].block || 'None')}</span></span><span class="chev">›</span></button>
        <button class="row" data-m="remove"><span class="row-title" style="color:var(--danger)">Remove from today</span></button>
      </div>`,
      onMount(el, close) {
        el.addEventListener('click', (ev) => {
          const b = ev.target.closest('[data-m]');
          if (!b || b.disabled) return;
          const m = b.dataset.m;
          if (m === 'change') {
            close();
            pickExercise(app, { title: 'Change to…', onPick(id) { commit(swapEntry(session(), i, id, history())); render(); } });
            return;
          }
          if (m === 'block') {
            close();
            openBlock(i);
            return;
          }
          if (m === 'up') commit(moveEntry(session(), i, -1));
          if (m === 'down') commit(moveEntry(session(), i, 1));
          if (m === 'remove') commit(removeEntry(session(), i));
          close();
          render();
        });
      },
    });
  }

  function openBlock(i) {
    const entry = session().entries[i];
    openSheet({
      title: 'Block',
      closeLabel: 'Cancel',
      body: `<div class="field"><label for="blk">Group label</label><input class="input" id="blk" value="${esc(entry.block)}" placeholder="1, 2, Warm-up, Cardio"></div>
        <p class="hint">Exercises next to each other with the same label are shown together, the way your coach writes supersets.</p>`,
      foot: '<button class="btn primary block" data-save>Save</button>',
      onMount(el, close) {
        el.querySelector('[data-save]').addEventListener('click', () => {
          commit(updateEntry(session(), i, { block: el.querySelector('#blk').value.trim().slice(0, 24) }));
          close();
          render();
        });
      },
    });
  }

  function openRename() {
    const s = session();
    openSheet({
      title: 'Session',
      closeLabel: 'Cancel',
      body: `<div class="field"><label for="sn">Name</label><input class="input" id="sn" value="${esc(s.title)}"></div>
        <div class="field"><label for="sd">Date</label><input class="input" id="sd" type="date" value="${esc(s.date)}" max="${esc(app.today())}"></div>`,
      foot: '<button class="btn primary block" data-save>Save</button>',
      onMount(el, close) {
        el.querySelector('[data-save]').addEventListener('click', () => {
          const title = el.querySelector('#sn').value.trim() || s.title;
          const date = el.querySelector('#sd').value || s.date;
          commit({ ...session(), title, date });
          close();
          renderHeader();
        });
      },
    });
  }

  function openFinish() {
    const s = session();
    const summary = sessionSummary(s, history(), (id) => library.get(id));
    const skipped = summary.total - summary.done;
    const lines = [
      ...summary.prs.map((p) => `<div class="row"><span class="row-main"><span class="row-title">${esc(p.exercise.name)}</span></span><span class="row-end"><b class="num">${esc(formatValue(p.exercise, p.value))}</b><span class="tag pr">New best</span></span></div>`),
      ...summary.ups.filter((u) => !summary.prs.some((p) => p.exercise.id === u.exercise.id))
        .map((u) => `<div class="row"><span class="row-main"><span class="row-title">${esc(u.exercise.name)}</span></span><span class="row-end num">${esc(formatNumber(u.from))} → <b>${esc(formatValue(u.exercise, u.to))}</b></span></div>`),
    ];
    openSheet({
      title: 'Finish workout',
      closeLabel: 'Keep going',
      body: `
        <div class="stats" style="grid-template-columns:repeat(2,1fr)">
          <div class="stat"><div class="big">${summary.done}</div><div class="label">exercises done</div></div>
          <div class="stat"><div class="big">${summary.prs.length}</div><div class="label">${summary.prs.length === 1 ? 'new best' : 'new bests'}</div></div>
        </div>
        ${lines.length ? `<div class="section-label">Progress today</div><div class="card">${lines.join('')}</div>` : ''}
        ${skipped ? `<p class="hint" style="margin-top:16px">${plural(skipped, 'exercise')} not ticked won’t be saved.</p>` : ''}
        ${summary.done === 0 ? '<p class="hint" style="margin-top:16px">Tick at least one exercise to save this session.</p>' : ''}
        <button class="btn ghost block" data-discard style="margin-top:20px;color:var(--danger)">Discard this session</button>`,
      foot: `<button class="btn primary block" data-save ${summary.done ? '' : 'disabled'}>Save session</button>`,
      onMount(el, close) {
        el.querySelector('[data-save]').addEventListener('click', () => {
          app.history.finishActive(app.now());
          close();
          app.router.show('train');
          toast(summary.prs.length ? `Saved, with ${plural(summary.prs.length, 'new best')}` : 'Session saved');
        });
        el.querySelector('[data-discard]').addEventListener('click', async () => {
          const ok = await confirmSheet({ title: 'Discard this session?', message: 'Nothing from today will be saved.', confirm: 'Discard', danger: true });
          if (!ok) return;
          app.history.discardActive();
          close();
          app.router.show('train');
        });
      },
    });
  }

  return { render, refresh: render };
}
