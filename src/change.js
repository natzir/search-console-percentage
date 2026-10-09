// How one metric changed between the two periods, and whether that is good.
import { formatDifference, formatPercent } from './numbers.js';

// Search Console's metrics, in the order of its cards, table columns and tooltip lines.
export const METRICS = ['CLICKS', 'IMPRESSIONS', 'CTR', 'POSITION'];

const ARROWS = { up: '▲', down: '▼', flat: '=' };

export function change(key, last, previous) {
  const diff = Math.round((last - previous) * 1e6) / 1e6;
  const direction = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
  if (previous === 0) return { diff, pct: null, direction, tone: last === 0 ? 'flat' : 'new' };
  const pct = (diff / previous) * 100;
  // Position: lower is better.
  const better = key === 'POSITION' ? diff < 0 : diff > 0;
  return { diff, pct, direction, tone: direction === 'flat' ? 'flat' : better ? 'better' : 'worse' };
}

// The pill next to a Difference: "▲ +7.1%", "= 0%", "new".
export function tableLabel(c, lang) {
  if (c.tone === 'new') return 'new';
  return `${ARROWS[c.direction]} ${formatPercent(c.pct ?? 0, lang)}`;
}

// The pill in a totals card: "▲ +80 · +47.6%", "▲ +0.4 pp · +133%", "▲ +3 · new".
export function cardLabel(key, c, lang) {
  const pct = c.tone === 'new' ? 'new' : formatPercent(c.pct ?? 0, lang);
  return `${ARROWS[c.direction]} ${formatDifference(key, c.diff, lang)} · ${pct}`;
}
