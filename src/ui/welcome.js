/**
 * The welcome note shown when the app opens. A full-screen card with the
 * message and its sign-off; it fades on its own after a few seconds, or on tap.
 */

import { esc } from './util.js';

const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.4C1.5 7.8 3.6 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.4 0 5.5 3.3 4.3 6.6-1.8 4.8-9.3 9.4-9.3 9.4z"/></svg>';

let current = null;

export function showWelcome({ text, from }, { ms = 4500 } = {}) {
  current?.dismiss();
  const el = document.createElement('div');
  el.className = 'welcome';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Message');
  el.innerHTML = `
    <div class="welcome-card">
      <div class="welcome-heart">${HEART}</div>
      <p class="welcome-text">${esc(text)}</p>
      ${from ? `<p class="welcome-from">${esc(from)}</p>` : ''}
    </div>
    <p class="welcome-hint">Tap to start</p>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('open'));

  let timer = null;
  function dismiss() {
    if (!el.isConnected || el.classList.contains('closing')) return;
    clearTimeout(timer);
    el.classList.add('closing');
    el.classList.remove('open');
    setTimeout(() => el.remove(), 400);
    if (current?.el === el) current = null;
  }
  el.addEventListener('click', dismiss);
  timer = setTimeout(dismiss, ms);
  current = { el, dismiss };
  return current;
}
