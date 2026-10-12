/**
 * Hand-drawn SVG charts. No library: three small shapes cover everything.
 * Colours come from CSS variables so both themes work.
 */

import { esc } from './util.js';

const fmt = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace(/\.0$/, ''));

/** Round tick values covering [lo, hi], about `count` of them. */
export function niceTicks(lo, hi, count = 4) {
  if (lo === hi) { lo -= 1; hi += 1; }
  const raw = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const start = Math.floor(lo / step) * step;
  const ticks = [];
  for (let v = start; v <= hi + step * 0.999; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}

/**
 * Progress line. Points are evenly spaced by session (not by date), since
 * training gaps would otherwise squash the line.
 *
 * @param {{label: string, value: number, e1rm?: number|null}[]} points
 * @param {{unit?: string, showE1rm?: boolean}} opts
 */
export function lineChart(points, { unit = '', showE1rm = false } = {}) {
  const W = 340, H = 196, L = 34, R = 40, T = 26, B = 26;
  if (!points.length) return '';
  const vals = points.flatMap((p) => [p.value, showE1rm ? p.e1rm : null]).filter((v) => v != null);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = (hi - lo) * 0.12 || Math.max(1, hi * 0.1);
  const ticks = niceTicks(Math.max(0, lo - pad), hi + pad);
  lo = ticks[0]; hi = ticks.at(-1);
  const x = (i) => (points.length === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (points.length - 1));
  const y = (v) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));

  let g = '';
  for (const t of ticks) {
    g += `<line x1="${L}" x2="${W - R + 12}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line)" stroke-width="1"/>`;
    g += `<text x="${L - 6}" y="${y(t) + 4}" text-anchor="end">${fmt(t)}</text>`;
  }
  g += `<text x="${L - 6}" y="${T - 14}" text-anchor="end">${esc(unit)}</text>`;
  // First and last date only; the rest are in the log below.
  g += `<text x="${x(0)}" y="${H - 6}" text-anchor="${points.length === 1 ? 'middle' : 'start'}">${esc(points[0].label)}</text>`;
  if (points.length > 1) g += `<text x="${x(points.length - 1)}" y="${H - 6}" text-anchor="end">${esc(points.at(-1).label)}</text>`;

  const path = (key) => points.map((p, i) => (p[key] == null ? null : `${x(i)},${y(p[key])}`)).filter(Boolean).join(' ');
  if (showE1rm) g += `<polyline points="${path('e1rm')}" fill="none" stroke="var(--fg-mute)" stroke-width="1.5" stroke-dasharray="4 4" stroke-linejoin="round"/>`;
  if (points.length > 1) {
    const area = `${x(0)},${y(lo)} ${path('value')} ${x(points.length - 1)},${y(lo)}`;
    g += `<polygon points="${area}" fill="var(--accent)" opacity="0.08"/>`;
  }
  g += `<polyline points="${path('value')}" fill="none" stroke="var(--accent)" stroke-width="2.25" stroke-linejoin="round" stroke-linecap="round"/>`;
  points.forEach((p, i) => {
    const last = i === points.length - 1;
    g += `<circle cx="${x(i)}" cy="${y(p.value)}" r="${last ? 5 : 3.5}" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"><title>${esc(p.label)}: ${fmt(p.value)} ${esc(unit)}</title></circle>`;
  });
  const lp = points.at(-1);
  g += `<text class="val" x="${x(points.length - 1) + 9}" y="${y(lp.value) + 4}">${fmt(lp.value)}</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(points.map((p) => `${p.label} ${fmt(p.value)}`).join(', '))}">${g}</svg>`;
}

/** Tiny trend line for list rows. */
export function sparkline(values) {
  const W = 72, H = 28, P = 3;
  if (values.length < 2) return `<svg viewBox="0 0 ${W} ${H}"></svg>`;
  const lo = Math.min(...values), hi = Math.max(...values);
  const span = hi - lo || 1;
  const pts = values.map((v, i) => [P + (i * (W - 2 * P)) / (values.length - 1), H - P - ((v - lo) / span) * (H - 2 * P)]);
  const end = pts.at(-1);
  return `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true"><polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="1.75" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${end[0]}" cy="${end[1]}" r="2.5" fill="var(--accent)"/></svg>`;
}

/** Sessions per week. */
export function weekBars(weeks, { label = (w) => w.week } = {}) {
  const W = 340, H = 92, B = 18, T = 14, gap = 4;
  const max = Math.max(3, ...weeks.map((w) => w.count));
  const bw = (W - gap * (weeks.length - 1)) / weeks.length;
  let g = '';
  weeks.forEach((w, i) => {
    const h = w.count ? Math.max(4, ((H - B - T) * w.count) / max) : 2;
    const x = i * (bw + gap), y = H - B - h;
    const isLast = i === weeks.length - 1;
    g += `<rect x="${x}" y="${y}" width="${bw}" height="${h}" rx="3" fill="${w.count ? 'var(--accent)' : 'var(--line)'}" opacity="${isLast ? 1 : 0.75}"><title>${esc(label(w))}: ${w.count}</title></rect>`;
    if (w.count) g += `<text class="val" x="${x + bw / 2}" y="${y - 4}" text-anchor="middle">${w.count}</text>`;
  });
  g += `<text x="0" y="${H - 3}">${esc(label(weeks[0]))}</text><text x="${W}" y="${H - 3}" text-anchor="end">This week</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Sessions per week">${g}</svg>`;
}
