/**
 * Bottom sheets: the one overlay used everywhere (swaps, pickers, editors,
 * confirmations). Sheets stack, so a picker can open on top of an editor.
 *
 * The page can't use alert/confirm (they're unreliable in a home-screen app),
 * so confirmSheet is the in-app replacement.
 */

import { esc } from './util.js';

const stack = [];

/**
 * @param {object} o
 * @param {string} o.title
 * @param {string} o.body           HTML for the scrolling body
 * @param {string} [o.foot]         HTML for a pinned footer
 * @param {boolean} [o.tall]        full height (pickers, editors)
 * @param {string} [o.closeLabel]
 * @param {(el: HTMLElement, close: Function) => void} [o.onMount]
 * @param {() => void} [o.onClose]
 */
export function openSheet({ title, body, foot = '', tall = false, closeLabel = 'Close', onMount, onClose }) {
  const z = 40 + stack.length * 2;
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  scrim.style.zIndex = z;
  const el = document.createElement('div');
  el.className = `sheet${tall ? ' tall' : ''}`;
  el.style.zIndex = z + 1;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', title);
  el.innerHTML = `
    <div class="sheet-head"><h2>${esc(title)}</h2><button class="btn ghost" data-close>${esc(closeLabel)}</button></div>
    <div class="sheet-body">${body}</div>
    ${foot ? `<div class="sheet-foot">${foot}</div>` : ''}`;
  document.body.append(scrim, el);
  document.body.style.overflow = 'hidden';

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    const i = stack.indexOf(entry);
    if (i >= 0) stack.splice(i, 1);
    el.classList.remove('open');
    scrim.classList.remove('open');
    setTimeout(() => { el.remove(); scrim.remove(); }, 230);
    if (!stack.length) document.body.style.overflow = '';
    onClose?.();
  }
  const entry = { el, close };
  stack.push(entry);

  scrim.addEventListener('click', close);
  el.querySelector('[data-close]').addEventListener('click', close);
  requestAnimationFrame(() => { el.classList.add('open'); scrim.classList.add('open'); });
  onMount?.(el, close);
  return { el, close, body: el.querySelector('.sheet-body') };
}

export function closeAllSheets() {
  [...stack].reverse().forEach((s) => s.close());
}

addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && stack.length) stack.at(-1).close();
});

/** Resolves true if she taps the confirm button, false otherwise. */
export function confirmSheet({ title, message, confirm = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    let answered = false;
    openSheet({
      title,
      body: `<p class="hint" style="margin:0">${esc(message)}</p>`,
      foot: `<button class="btn block ${danger ? 'danger' : 'primary'}" data-yes>${esc(confirm)}</button>`,
      closeLabel: 'Cancel',
      onMount(el, close) {
        el.querySelector('[data-yes]').addEventListener('click', () => { answered = true; resolve(true); close(); });
      },
      onClose() { if (!answered) resolve(false); },
    });
  });
}
