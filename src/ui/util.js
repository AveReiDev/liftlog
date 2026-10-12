/**
 * Small shared UI helpers: escaping, date labels, toasts.
 */

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** Escape anything that came from her (names, notes) before it goes into innerHTML. */
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const parts = (iso) => iso.split('-').map(Number);

/** "May 14", or "May 14, 2025" when it isn't this year. Undated imports say so. */
export function fmtDate(iso, { today, approx = false, weekday = false } = {}) {
  if (approx) return 'Undated';
  const [y, m, d] = parts(iso);
  const thisYear = today ? parts(today)[0] : y;
  let s = `${MONTHS[m - 1]} ${d}`;
  if (weekday) s = `${DAYS[new Date(y, m - 1, d).getDay()]}, ${s}`;
  if (y !== thisYear) s += `, ${y}`;
  return s;
}

export function fmtMonth(iso) {
  const [y, m] = parts(iso);
  return `${MONTHS_LONG[m - 1]} ${y}`;
}

/** "today", "yesterday", "3 days ago", else the date. */
export function fmtAgo(iso, today, approx = false) {
  if (approx) return 'in your old notes';
  const ms = new Date(`${today}T12:00:00`) - new Date(`${iso}T12:00:00`);
  const days = Math.round(ms / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days > 1 && days < 7) return `${days} days ago`;
  return fmtDate(iso, { today });
}

/** Local calendar date as YYYY-MM-DD (not UTC, which flips at 5 pm in California). */
export function localISO(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

let toastTimer = null;
export function toast(message, ms = 2600) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
