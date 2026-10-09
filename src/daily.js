// Each point's values for both periods, read from Google's own chart tooltip: a mousemove over a point
// fills the chart's aria-live region with one line per drawn metric and period, current period first,
// metrics in the cards' order: ". Clicks: Thu, Sep 10, 2026 : 10 ,". The metric's name is translated
// and ignored; the date is kept as Google wrote it.
import { signature } from './detect.js';
import { parseNumber } from './numbers.js';

export function parseLine(text, lang) {
  const s = text.replace(/\s+/g, ' ').trim();
  if (!s.startsWith('. ')) return null;
  const body = s.slice(2).replace(/\s*[,.]$/, '');
  const cut = body.lastIndexOf(' : ');
  const colon = body.indexOf(': ');
  if (cut < 0 || colon < 0 || colon >= cut) return null;
  return { date: body.slice(colon + 2, cut).trim(), value: parseNumber(body.slice(cut + 3), lang) };
}

export function readPoint(lines, keys, lang) {
  const parsed = lines.map(line => parseLine(line, lang)).filter(Boolean);
  if (parsed.length !== keys.length * 2) return null;
  return Object.fromEntries(keys.map((key, i) => {
    const [current, previous] = [parsed[2 * i], parsed[2 * i + 1]];
    return [key, { last: current.value, previous: previous.value, date: current.date, previousDate: previous.date }];
  }));
}

export const liveLines = host =>
  [...(host.querySelector('[aria-live]')?.querySelectorAll('*') ?? [])]
    .filter(el => !el.childElementCount && /^\s*\.\s/.test(el.textContent))
    .map(el => el.textContent);

const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => resolve()));

// Synthetic mouse events carry the page's window as their view, as a real one would; jsdom (tests)
// rejects that, so there the event goes without it.
function mouse(doc, type, init) {
  try {
    return new MouseEvent(type, { ...init, view: doc.defaultView });
  } catch {
    return new MouseEvent(type, init);
  }
}

// Moves a synthetic mouse across the chart, point by point, and reads the tooltip each time. Returns
// null if the chart's data changes during the sweep, or if `abort()` turns true (checked after each
// frame, before the point is read), so the caller can decide whether to run it again.
export async function sweep(chart, lang, { frame = nextFrame, abort = () => false } = {}) {
  const { host, svg, plotX, plotY, xs, drawn } = chart;
  const doc = host.ownerDocument;
  const before = signature(svg);
  const rect = svg.getBoundingClientRect();
  const clientY = rect.top + plotY + 20;
  host.classList.add('scpc-sweeping');
  const points = [];
  try {
    for (const x of xs) {
      const clientX = rect.left + plotX + x;
      const hit = doc.elementFromPoint?.(clientX, clientY);
      const target = hit && host.contains(hit) ? hit : svg;
      target.dispatchEvent(mouse(doc, 'mousemove', { bubbles: true, clientX, clientY }));
      await frame();
      if (abort()) return null;
      if (signature(svg) !== before) return null;
      points.push(readPoint(liveLines(host), drawn, lang));
    }
  } finally {
    svg.dispatchEvent(mouse(doc, 'mouseout', { bubbles: true }));
    svg.dispatchEvent(mouse(doc, 'mouseleave', {}));
    host.classList.remove('scpc-sweeping');
  }
  return points;
}
