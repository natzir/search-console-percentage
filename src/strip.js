// The strip under Google's chart: one bar per point for the chosen metric, at the chart's own x, up
// when the number went up, coloured by whether that is good. Google's chart is left untouched.
import { change } from './change.js';
import { formatPercent, formatValue } from './numbers.js';

const NS = 'http://www.w3.org/2000/svg';
const HEIGHT = 120;
const PAD = 10;
const MID = 62;
const CAP = 100;
const COLORS = { better: '#34a853', worse: '#ea4335', flat: '#9aa0a6', new: '#8ab4f8' };

const svgEl = (doc, name, attrs = {}) => {
  const el = doc.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};
const svgText = (doc, x, y, content, anchor = 'start') => {
  const t = svgEl(doc, 'text', { x, y, 'text-anchor': anchor });
  t.textContent = content;
  return t;
};

function header(doc, drawn, key, labels, onSelect) {
  const head = doc.createElement('div');
  head.className = 'scpc-strip-head';
  const title = doc.createElement('b');
  title.textContent = 'Change by date';
  const legend = doc.createElement('span');
  legend.className = 'scpc-legend';
  for (const tone of ['better', 'worse', 'new']) {
    const swatch = doc.createElement('i');
    swatch.className = `scpc-swatch scpc-${tone}`;
    legend.append(swatch, ` ${tone}`);
  }
  const select = doc.createElement('select');
  select.className = 'scpc-select';
  select.setAttribute('aria-label', 'Metric');
  for (const k of drawn) {
    const option = doc.createElement('option');
    option.value = k;
    option.textContent = labels[k] ?? k;
    option.selected = k === key;
    select.append(option);
  }
  select.addEventListener('change', () => onSelect(select.value));
  head.append(title, legend, select);
  return head;
}

function bars(doc, chart, points, key, labels, lang) {
  const width = Number(chart.svg.getAttribute('width')) || chart.svg.getBoundingClientRect().width;
  const svg = svgEl(doc, 'svg', { width, height: HEIGHT, class: 'scpc-bars' });
  svg.append(
    svgEl(doc, 'line', { x1: chart.plotX, x2: width - PAD, y1: MID, y2: MID, stroke: '#bdc1c6' }),
    svgText(doc, 0, PAD + 4, formatPercent(CAP, lang)),
    svgText(doc, 0, HEIGHT - 2, formatPercent(-CAP, lang)),
  );
  const gap = chart.xs.length > 1 ? chart.xs[1] - chart.xs[0] : 20;
  const barWidth = Math.max(1, Math.min(18, gap * 0.64));
  points.forEach((point, i) => {
    const v = point?.[key];
    if (!v || !Number.isFinite(v.last) || !Number.isFinite(v.previous)) return;
    const c = change(key, v.last, v.previous);
    const x = chart.plotX + chart.xs[i] - barWidth / 2;
    let y = PAD;
    let h = MID - PAD;
    if (c.tone !== 'new') {
      const pct = Math.max(-CAP, Math.min(CAP, c.pct ?? 0));
      h = Math.max(1, (Math.abs(pct) / CAP) * (MID - PAD));
      y = pct >= 0 ? MID - h : MID;
    }
    const bar = svgEl(doc, 'rect', { x, y, width: barWidth, height: h, rx: 2, fill: COLORS[c.tone], 'data-scpc-tone': c.tone });
    const title = svgEl(doc, 'title');
    const pctText = c.tone === 'new' ? 'new' : formatPercent(c.pct ?? 0, lang);
    title.textContent = `${v.date} vs ${v.previousDate} · ${labels[key] ?? key} ${formatValue(key, v.last, lang)} vs ${formatValue(key, v.previous, lang)} · ${pctText}`;
    bar.append(title);
    svg.append(bar);
    if (c.tone !== 'new' && Math.abs(c.pct ?? 0) > CAP) svg.append(svgText(doc, x + barWidth / 2, c.pct > 0 ? PAD - 1 : HEIGHT - PAD + 9, c.pct > 0 ? '↑' : '↓', 'middle'));
  });
  return svg;
}

export function renderStrip(doc, chart, points, { key, labels, lang, onSelect }) {
  let box = chart.host.parentElement.querySelector(':scope > [data-scpc="strip"]');
  if (!box) {
    box = doc.createElement('div');
    box.setAttribute('data-scpc', 'strip');
    box.className = 'scpc-strip';
    chart.host.after(box);
  }
  box.replaceChildren(header(doc, chart.drawn, key, labels, onSelect), bars(doc, chart, points, key, labels, lang));
  return box;
}
