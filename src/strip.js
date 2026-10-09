// The strip under Google's chart: one bar per point for the chosen metric, at the chart's own x, up
// when the number went up, coloured by whether that is good. Google's chart is left untouched. The bars
// can be read with a pointer or the keyboard: a tooltip next to the active bar, announced politely.
import { change } from './change.js';
import { formatPercent, formatValue } from './numbers.js';

const NS = 'http://www.w3.org/2000/svg';
const HEIGHT = 120;
const PAD = 10;
const MID = 62;
const CAP = 100;
const COLORS = { better: '#188038', worse: '#d93025', flat: '#9aa0a6', new: '#1a73e8' };
const TONE_WORDS = { better: 'better', worse: 'worse', flat: 'no change', new: 'new' };
let counter = 0;

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
const html = (doc, name, className, text) => {
  const el = doc.createElement(name);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
};

function header(doc, keys, key, labels, { onSelect, disabled }) {
  const id = `scpc-metric-${++counter}`;
  const head = html(doc, 'div', 'scpc-strip-head');
  const left = html(doc, 'div', 'scpc-head-left');
  const title = html(doc, 'label', '', 'Change by date');
  title.htmlFor = id;
  const wrap = html(doc, 'span', 'scpc-select-wrap');
  const select = html(doc, 'select', 'scpc-select');
  select.id = id;
  select.disabled = Boolean(disabled);
  for (const k of keys) {
    const option = html(doc, 'option', '', labels[k] ?? k);
    option.value = k;
    option.selected = k === key;
    select.append(option);
  }
  select.addEventListener('change', () => onSelect?.(select.value));
  wrap.append(select);
  left.append(title, wrap);
  const legend = html(doc, 'span', 'scpc-legend');
  for (const tone of ['better', 'worse', 'new']) {
    const swatch = html(doc, 'i', `scpc-swatch scpc-${tone}`);
    legend.append(swatch, ` ${tone}`);
  }
  head.append(left, legend);
  return head;
}

// What a bar says: the three lines of its tooltip and the one line that is announced.
function describe(key, v, c, label, lang) {
  const pct = c.tone === 'new' ? 'new' : formatPercent(c.pct ?? 0, lang);
  const values = `${formatValue(key, v.last, lang)} vs ${formatValue(key, v.previous, lang)}`;
  const verdict = c.tone === 'better' || c.tone === 'worse' ? `${pct} · ${TONE_WORDS[c.tone]}` : TONE_WORDS[c.tone];
  const spoken = c.tone === 'better' || c.tone === 'worse' ? `${pct}, ${TONE_WORDS[c.tone]}.` : `${TONE_WORDS[c.tone]}.`;
  return {
    lines: [`${v.date} vs ${v.previousDate}`, `${label}: ${values}`, verdict],
    spoken: `${v.date} vs ${v.previousDate}. ${label} ${values}. ${spoken}`,
  };
}

function bars(doc, chart, points, key, labels, lang) {
  const width = Number(chart.svg.getAttribute('width')) || chart.svg.getBoundingClientRect().width;
  const svg = svgEl(doc, 'svg', { width, height: HEIGHT, class: 'scpc-bars', 'aria-hidden': 'true' });
  svg.append(
    svgEl(doc, 'line', { x1: chart.plotX, x2: width - PAD, y1: MID, y2: MID, stroke: '#bdc1c6' }),
    svgText(doc, width - 2, PAD + 4, formatPercent(CAP, lang), 'end'),
    svgText(doc, width - 2, HEIGHT - 2, formatPercent(-CAP, lang), 'end'),
  );
  const gap = chart.xs.length > 1 ? chart.xs[1] - chart.xs[0] : 20;
  const barWidth = Math.max(1, Math.min(18, gap * 0.64));
  const items = [];
  const hits = [];
  const marks = [];
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
    const bar = svgEl(doc, 'rect', { x, y, width: barWidth, height: h, rx: 2, fill: COLORS[c.tone], 'data-scpc-tone': c.tone, 'data-i': items.length });
    // A transparent column over the whole plot, so a one-pixel bar is as easy to point at as a tall one.
    hits.push(svgEl(doc, 'rect', { x: x - (gap - barWidth) / 2, y: 0, width: Math.max(barWidth, gap), height: HEIGHT, fill: 'transparent', 'data-i': items.length }));
    items.push({ bar, tone: c.tone, cx: x + barWidth / 2, ...describe(key, v, c, labels[key] ?? key, lang) });
    marks.push(bar);
    if (c.tone !== 'new' && Math.abs(c.pct ?? 0) > CAP) marks.push(svgText(doc, x + barWidth / 2, c.pct > 0 ? PAD - 1 : HEIGHT - PAD + 9, c.pct > 0 ? '↑' : '↓', 'middle'));
  });
  svg.append(...hits, ...marks);
  return { svg, items };
}

function summary(items, key, labels) {
  const n = tone => items.filter(item => item.tone === tone).length;
  const flat = n('flat') ? `, ${n('flat')} no change` : '';
  return `Change by date, ${labels[key] ?? key}: ${n('better')} days better, ${n('worse')} worse, ${n('new')} new${flat}. Use the left and right arrow keys to read each day.`;
}

function ensureBox(doc, chart) {
  const wrapper = chart.host.parentElement;
  let box = wrapper.parentElement.querySelector(':scope > [data-scpc="strip"]');
  if (!box) {
    box = doc.createElement('div');
    box.setAttribute('data-scpc', 'strip');
    box.className = 'scpc-strip';
    wrapper.after(box);
  }
  delete box.dataset.stamp;
  return box;
}

// Line the title and the bars up with Google's chart, which may start to the right of the strip's left
// edge. Returns the bars' left margin.
function align(chart, box, head, body) {
  const offset = chart.svg.getBoundingClientRect().left - box.getBoundingClientRect().left;
  head.style.paddingLeft = `${offset + chart.plotX}px`;
  body.style.marginLeft = `${offset}px`;
  return offset;
}

// The strip while the days are being read: same height as the finished one, no bars.
export function renderLoading(doc, chart, { key, keys = chart.drawn, labels, lang }) {
  const box = ensureBox(doc, chart);
  const head = header(doc, keys, key, labels, { disabled: true });
  const body = html(doc, 'div', 'scpc-loading', 'Reading the days…');
  box.setAttribute('aria-busy', 'true');
  box.replaceChildren(head, body);
  align(chart, box, head, body);
  return box;
}

export function renderStrip(doc, chart, points, { key, keys = chart.drawn, labels, lang, onSelect }) {
  const box = ensureBox(doc, chart);
  const { svg, items } = bars(doc, chart, points, key, labels, lang);
  const head = header(doc, keys, key, labels, { onSelect });
  const plot = html(doc, 'div', 'scpc-plot');
  plot.tabIndex = 0;
  plot.setAttribute('role', 'group');
  plot.setAttribute('aria-roledescription', 'bar chart');
  plot.setAttribute('aria-label', summary(items, key, labels));
  plot.append(svg);
  const tip = html(doc, 'div', 'scpc-tip');
  tip.setAttribute('role', 'tooltip');
  tip.hidden = true;
  const live = html(doc, 'div', 'scpc-live');
  live.setAttribute('aria-live', 'polite');
  box.removeAttribute('aria-busy');
  box.replaceChildren(head, plot, tip, live);
  const offset = align(chart, box, head, plot);

  let active = null;
  const hide = () => {
    tip.hidden = true;
    if (active !== null) {
      items[active].bar.removeAttribute('stroke');
      items[active].bar.removeAttribute('stroke-width');
    }
    active = null;
    live.textContent = '';
  };
  const show = (index, speak) => {
    if (index === null || !items[index]) return;
    if (active !== null && active !== index) {
      items[active].bar.removeAttribute('stroke');
      items[active].bar.removeAttribute('stroke-width');
    }
    active = index;
    const item = items[index];
    item.bar.setAttribute('stroke', '#1f1f1f');
    item.bar.setAttribute('stroke-width', '2');
    tip.replaceChildren(
      html(doc, 'div', '', item.lines[0]),
      html(doc, 'div', '', item.lines[1]),
      html(doc, 'div', `scpc-tip-${item.tone}`, item.lines[2]),
    );
    tip.hidden = false;
    const cx = offset + item.cx;
    const width = tip.offsetWidth;
    let left = cx + 14;
    if (width && left + width > box.clientWidth) left = cx - 14 - width;
    tip.style.left = `${Math.max(0, left)}px`;
    tip.style.top = `${plot.offsetTop + 6}px`;
    if (speak) live.textContent = item.spoken;
  };

  const indexOf = event => {
    const hit = event.target.closest?.('[data-i]');
    return hit ? Number(hit.getAttribute('data-i')) : null;
  };
  const point = event => {
    const index = indexOf(event);
    if (index === null) hide();
    else if (index !== active || tip.hidden) show(index, false);
  };
  svg.addEventListener('pointerover', point);
  svg.addEventListener('pointermove', point);
  plot.addEventListener('pointerleave', hide);
  plot.addEventListener('focus', () => {
    if (tip.hidden && items.length) show(active ?? 0, true);
  });
  plot.addEventListener('blur', hide);
  plot.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      hide();
      return;
    }
    if (!items.length) return;
    const last = items.length - 1;
    const target = { ArrowRight: Math.min(last, (active ?? -1) + 1), ArrowLeft: Math.max(0, (active ?? last + 1) - 1), Home: 0, End: last }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    show(target, true);
  });
  return box;
}
