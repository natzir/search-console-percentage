// How one metric changed between the two periods, and whether that is good.
import { formatDifference, formatPercent } from './numbers.js';

// Search Console's metrics, in the order of its cards, table columns and tooltip lines.
export const METRICS = ['CLICKS', 'IMPRESSIONS', 'CTR', 'POSITION'];

const ARROWS = { up: '▲', down: '▼', flat: '=' };

export function change(key, last, previous) {
  const diff = Math.round((last - previous) * 1e6) / 1e6;
  const direction = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
  if (previous === 0) return { diff, pct: null, direction, tone: last === 0 ? 'flat' : 'new' };
  // A position of 0 means no impressions in that period: the query or page was lost.
  if (key === 'POSITION' && last === 0) return { diff, pct: null, direction, tone: 'worse', lost: true };
  const pct = (diff / previous) * 100;
  // Position: lower is better.
  const better = key === 'POSITION' ? diff < 0 : diff > 0;
  return { diff, pct, direction, tone: direction === 'flat' ? 'flat' : better ? 'better' : 'worse' };
}

// The % change in words where a % says nothing: "new" (from 0), "lost" (a position gone to 0).
export const status = c => (c.tone === 'new' ? 'new' : c.lost ? 'lost' : null);

// The pill next to a Difference: "▲ +7.1%", "= 0%", "new", "lost".
export function tableLabel(c, lang) {
  return status(c) ?? `${ARROWS[c.direction]} ${formatPercent(c.pct ?? 0, lang)}`;
}

// The pill in a totals card: "▲ +80 · +47.6%", "▲ +0.4 pp · +133%", "▲ +3 · new", "▼ -9.5 · lost".
export function cardLabel(key, c, lang) {
  const pct = status(c) ?? formatPercent(c.pct ?? 0, lang);
  return `${ARROWS[c.direction]} ${formatDifference(key, c.diff, lang)} · ${pct}`;
}
