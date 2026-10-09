// A minimal Search Console Performance page in compare mode, built like the real one (checked on
// 2026-10-09 in English and Spanish): cards with data-label and their totals in title attributes; a
// table whose number columns carry data-column-toggle-label and data-numeric-value; a chart host
// (role=application) with the lines' SVG, and an aria-live region that a mousemove over the chart fills
// with that point's values, current period first, metrics in the cards' order. Queries and numbers are
// made up.
const STROKES = { CLICKS: '#4285F4', IMPRESSIONS: '#5E35B1', CTR: '#00897B', POSITION: '#E8710A' };
const ORDER = ['CLICKS', 'IMPRESSIONS', 'CTR', 'POSITION'];

export const EN = {
  lang: 'en',
  cards: { CLICKS: 'Total clicks', IMPRESSIONS: 'Total impressions', CTR: 'Average CTR', POSITION: 'Average position' },
  names: { CLICKS: 'Clicks', IMPRESSIONS: 'Impressions', CTR: 'CTR', POSITION: 'Position' },
  last: 'Last 28 days', previous: 'Previous 28 days', difference: 'Difference', dimension: 'Top queries',
};
export const ES = {
  lang: 'es',
  cards: { CLICKS: 'Clics totales', IMPRESSIONS: 'Impresiones totales', CTR: 'CTR medio', POSITION: 'Posición media' },
  names: { CLICKS: 'Clics', IMPRESSIONS: 'Impresiones', CTR: 'CTR', POSITION: 'Posición' },
  last: 'Últimos 28 días', previous: '28 días anteriores', difference: 'Diferencia', dimension: 'Consultas principales',
};

export const TOTALS = { CLICKS: [248, 168], IMPRESSIONS: [35005, 66212], CTR: [0.7, 0.3], POSITION: [14.2, 13.2] };
export const ROWS = [
  { dim: 'blue widgets', CLICKS: [30, 28], IMPRESSIONS: [89, 68], CTR: [33.7, 41.2], POSITION: [1.1, 3.5] },
  { dim: 'red widgets, cheap', CLICKS: [3, 0], IMPRESSIONS: [140, 151], CTR: [2.1, 0], POSITION: [9.7, 8.9] },
  { dim: 'widget "pro"', CLICKS: [0, 0], IMPRESSIONS: [1423, 2792], CTR: [0, 0], POSITION: [12, 12] },
];
export const DAYS = [
  { date: 'Wed, Sep 9, 2026', prev: 'Wed, Aug 12, 2026', CLICKS: [2, 5], IMPRESSIONS: [1749, 2462], CTR: [0.1, 0.2], POSITION: [15.9, 12.1] },
  { date: 'Thu, Sep 10, 2026', prev: 'Thu, Aug 13, 2026', CLICKS: [10, 2], IMPRESSIONS: [1423, 2792], CTR: [0.7, 0.1], POSITION: [14.2, 11.6] },
  { date: 'Fri, Sep 11, 2026', prev: 'Fri, Aug 14, 2026', CLICKS: [4, 0], IMPRESSIONS: [1200, 1200], CTR: [0.3, 0], POSITION: [13, 14] },
];

const show = (key, v, lang) => {
  const n = new Intl.NumberFormat(lang, { maximumFractionDigits: 1, useGrouping: 'always' }).format(v);
  return key === 'CTR' ? (lang === 'es' ? `${n} %` : `${n}%`) : n;
};
const visible = el => {
  el.getClientRects = () => [{ width: 10, height: 10 }];
  return el;
};

export function buildPage({ lang = EN, metrics = ORDER, drawn = ['CLICKS', 'IMPRESSIONS'], compare = true, totals = TOTALS, rows = ROWS, days = DAYS } = {}) {
  const doc = document;
  doc.documentElement.lang = lang.lang;
  const cards = metrics.map((key, i) => {
    const [last, prev] = totals[key];
    const periods = compare
      ? `<div><div><span title="${show(key, last, lang.lang)}">${show(key, last, lang.lang)}</span></div><div title="${lang.last}">${lang.last}</div></div>` +
        `<div><div><span title="${show(key, prev, lang.lang)}">${show(key, prev, lang.lang)}</span></div><div title="${lang.previous}">${lang.previous}</div></div>`
      : `<div><div><span title="${show(key, last, lang.lang)}">${show(key, last, lang.lang)}</span></div></div>`;
    return `<div data-guidedhelpid="scorecard_${i}" data-column-index="${i}" data-label="${key}"><div role="button"><span><span><div><div title="${lang.cards[key]}"><span>${lang.cards[key]}</span></div>${periods}</div></span></span></div></div>`;
  }).join('');

  const head = [`<th data-type="string" data-name="${lang.dimension}">${lang.dimension}</th>`];
  for (const key of metrics) {
    const parts = compare ? [lang.last, lang.previous, lang.difference] : [''];
    for (const part of parts) head.push(`<th data-type="number" data-column-toggle-label="${key}" data-name="${lang.names[key]}\n${part} ">${lang.names[key]}<br>${part}</th>`);
  }
  const body = rows.map(r => {
    const cells = [`<td><span><span>${r.dim}</span></span></td>`];
    for (const key of metrics) {
      const [last, prev] = r[key];
      const values = compare ? [last, prev, Math.round((last - prev) * 1e6) / 1e6] : [last];
      for (const v of values) cells.push(`<td data-column-toggle-label="${key}" data-numeric-value="${v}"><span><span>${show(key, v, lang.lang)}</span></span></td>`);
    }
    return `<tr>${cells.join('')}</tr>`;
  }).join('');

  const xs = days.map((_, i) => 12 + i * 24.6);
  // y follows the data, as in Google's chart, so a chart with other numbers has other coordinates.
  const path = (key, dashed) => `<path stroke="${STROKES[key]}" stroke-dasharray="${dashed ? '4, 4' : 'null'}" d="${xs.map((x, i) => `${i ? 'L' : 'M'}${x},${150 - Math.min(days[i][key][dashed ? 1 : 0], 20) * 5 + i}`).join('')}"></path><path stroke="transparent" d="M0,0"></path>`;
  const lines = [...drawn].reverse().map(key => (compare ? path(key, true) : '') + path(key, false)).join('');

  doc.body.innerHTML = `
    <div class="cards">${cards}</div>
    <div class="chart-card"><div class="chart-wrap">
      <div class="chart-block"><div class="chart-row" style="display:flex;flex-direction:row">
        <div role="application" class="host">
          <svg width="751" height="212"><g transform="translate(26,10)"><g class="axis"><text>0</text></g>${lines}</g></svg>
          <div aria-live="polite"><span></span></div>
        </div>
        <div class="chart-side"></div>
      </div></div>
    </div></div>
    <div class="table-card"><div class="table-wrap"><table><thead><tr>${head.join('')}</tr></thead><tbody>${body}</tbody></table></div></div>`;

  for (const el of doc.querySelectorAll('[data-guidedhelpid], table, [role="application"]')) visible(el);

  // Google's tooltip: the nearest point's values for every drawn metric, both periods. Like Google's, it
  // finds the point from where the SVG is on screen now.
  const host = doc.querySelector('[role="application"]');
  const svg = host.querySelector('svg');
  svg.addEventListener('mousemove', event => {
    const x = event.clientX - svg.getBoundingClientRect().left - 26;
    const i = xs.reduce((best, v, j) => (Math.abs(v - x) < Math.abs(xs[best] - x) ? j : best), 0);
    const day = days[i];
    const out = [`<div>Day ${i + 1}</div>`];
    for (const key of ORDER.filter(k => drawn.includes(k))) {
      out.push(`<div>. ${lang.names[key]}: ${day.date}\n : ${show(key, day[key][0], lang.lang)} ,</div>`);
      out.push(`<div>. ${lang.names[key]}: ${day.prev}\n : ${show(key, day[key][1], lang.lang)} ,</div>`);
    }
    host.querySelector('[aria-live] > span').innerHTML = out.join('');
  });
  return { doc, host, svg, xs };
}
