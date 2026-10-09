// Reads Search Console's Performance page through hooks it doesn't translate: the table columns'
// data-column-toggle-label and data-numeric-value, the cards' data-label, the chart lines' colours.
import { METRICS } from './change.js';
import { parseNumber } from './numbers.js';

const STROKES = { '#4285f4': 'CLICKS', '#5e35b1': 'IMPRESSIONS', '#00897b': 'CTR', '#e8710a': 'POSITION' };
const isVisible = el => el.getClientRects().length > 0;
const byOrder = (a, b) => METRICS.indexOf(a) - METRICS.indexOf(b);

// The comparison table: per metric, three consecutive number columns (last, previous, difference).
// Null when not comparing; hidden tables of other tabs are skipped.
export function findTable(doc) {
  for (const table of doc.querySelectorAll('table')) {
    const head = table.tHead?.rows[0];
    if (!head || !isVisible(table)) continue;
    const groups = new Map();
    [...head.cells].forEach((th, i) => {
      const key = th.getAttribute('data-column-toggle-label');
      if (key && th.getAttribute('data-type') === 'number') groups.set(key, [...(groups.get(key) ?? []), i]);
    });
    const metrics = [...groups].filter(([key]) => METRICS.includes(key)).map(([key, cols]) => ({ key, cols }));
    const triplets = metrics.length > 0 && metrics.every(({ cols }) => cols.length === 3 && cols[1] === cols[0] + 1 && cols[2] === cols[0] + 2);
    if (triplets) return { table, metrics };
  }
  return null;
}

// A cell's exact number; NaN when it has none (Number would read a blank one as 0).
export const numeric = cell => {
  const value = cell?.getAttribute('data-numeric-value');
  return value == null || value.trim() === '' ? NaN : Number(value);
};

// Last − previous is the Difference Google shows, give or take its rounding. If not, the columns are not
// what they seem (Google reordered them) and no % is given. A Difference without a number can't tell.
const TOLERANCE = { CTR: 0.051, POSITION: 0.051 };
export const agrees = (key, last, previous, difference) =>
  Number.isNaN(difference) || Math.abs(last - previous - difference) <= (TOLERANCE[key] ?? 0.5);

export function readRows({ table, metrics }) {
  return [...(table.tBodies[0]?.rows ?? [])].map(row => ({
    row,
    values: Object.fromEntries(metrics.map(({ key, cols }) => [key, [numeric(row.cells[cols[0]]), numeric(row.cells[cols[1]])]])),
    diffCells: Object.fromEntries(metrics.map(({ key, cols }) => [key, row.cells[cols[2]]])),
  }));
}

// The totals cards while comparing: two numbers among their titles (last, previous), written in the
// page's language. Cards with a single number (not comparing) are left out.
export function findCards(doc, lang) {
  return [...doc.querySelectorAll('[data-guidedhelpid^="scorecard_"][data-label]')]
    .filter(isVisible)
    .map(el => {
      const titles = [...el.querySelectorAll('[title]')].map(t => t.getAttribute('title'));
      const numbers = titles.map(t => parseNumber(t, lang)).filter(n => !Number.isNaN(n));
      return { el, key: el.getAttribute('data-label'), label: titles[0] ?? '', last: numbers[0], previous: numbers[1] };
    })
    .filter(card => METRICS.includes(card.key) && card.previous !== undefined)
    .sort((a, b) => Number(a.el.getAttribute('data-column-index')) - Number(b.el.getAttribute('data-column-index')));
}

export const pathXs = d => (String(d).match(/[ML]\s*-?[\d.]+/g) ?? []).map(s => Number(s.slice(1)));

// Each drawn metric's y-coordinates, solid and dashed lines: they change when the numbers change, not
// when other metrics are toggled.
export const pathYs = d => [...String(d).matchAll(/[ML]\s*-?[\d.]+[\s,]+(-?[\d.]+)/g)].map(m => m[1]).join(',');
export function fingerprints(svg) {
  const parts = {};
  for (const path of svg.querySelectorAll('path[stroke]')) {
    const key = STROKES[path.getAttribute('stroke').toLowerCase()];
    if (!key) continue;
    const dashed = /\d/.test(path.getAttribute('stroke-dasharray') ?? '');
    (parts[key] ??= []).push(`${dashed ? 'D' : 'S'}${pathYs(path.getAttribute('d'))}`);
  }
  return Object.fromEntries(Object.entries(parts).map(([key, list]) => [key, list.sort().join(';')]));
}

// Changes when the chart's data or size changes, not when Google's hover marks move.
export const signature = svg => [...svg.querySelectorAll('path[stroke]')].map(p => `${p.getAttribute('stroke')}:${p.getAttribute('d')}`).join('|');

// Google's chart: the plot's offset in its SVG, each point's x, the metrics drawn (by line colour, in
// the cards' order) and whether it compares (dashed lines are the previous period).
export function findChart(doc) {
  for (const host of doc.querySelectorAll('[role="application"]')) {
    if (!isVisible(host)) continue; // Google keeps earlier views' charts in the page, hidden
    const svg = host.querySelector('svg');
    const plot = svg?.querySelector(':scope > g[transform]');
    const offset = plot?.getAttribute('transform').match(/translate\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/);
    if (!offset) continue;
    const drawn = [];
    let xs = null;
    let compare = false;
    for (const path of svg.querySelectorAll('path[stroke]')) {
      const key = STROKES[path.getAttribute('stroke').toLowerCase()];
      if (!key) continue;
      if (/\d/.test(path.getAttribute('stroke-dasharray') ?? '')) {
        compare = true;
        continue;
      }
      if (!drawn.includes(key)) drawn.push(key);
      xs ??= pathXs(path.getAttribute('d'));
    }
    if (drawn.length && xs?.length) {
      return { host, svg, plotX: Number(offset[1]), plotY: Number(offset[2]), xs, drawn: drawn.sort(byOrder), compare, signature: signature(svg), fingerprints: fingerprints(svg) };
    }
  }
  return null;
}
