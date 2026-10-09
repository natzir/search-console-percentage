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
  // A word instead of a number ("none") is a period without impressions: 0, as the table writes it.
  const value = body.slice(cut + 3).trim();
  return { date: body.slice(colon + 2, cut).trim(), value: /^\p{L}[\p{L} ]*$/u.test(value) ? 0 : parseNumber(value, lang) };
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

// What a real mouse would hit at that point of the chart. Google listens on a transparent overlay over
// the plot, not on the svg, so the event must reach it. When the chart is scrolled out of the window,
// elementFromPoint finds nothing; the last element of the svg whose box holds the point (the overlay,
// drawn on top) stands in for it.
function hitTarget(doc, host, svg, x, y) {
  const hit = doc.elementFromPoint?.(x, y);
  if (hit && host.contains(hit)) return hit;
  const holds = [...svg.querySelectorAll('*')].filter(el => {
    const box = el.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
  });
  return holds.at(-1) ?? svg;
}

// The same two dates as the point read before: the tooltip didn't move on. One date alone can repeat
// when the periods differ in length.
const repeats = (point, before, key) => point[key].date === before[key].date && point[key].previousDate === before[key].previousDate;

// Moves a synthetic mouse across the chart, point by point, and reads the tooltip each time. Returns
// null if the chart's data changes during the sweep, if Google's tooltip didn't update for a point, if a
// drawn metric got no number at any point (a tooltip it can't read), or if `abort()` turns true (checked
// after each frame, before the point is read), so the caller can decide whether to run it again.
export async function sweep(chart, lang, { frame = nextFrame, abort = () => false } = {}) {
  const { host, svg, plotX, plotY, xs, drawn } = chart;
  const doc = host.ownerDocument;
  const before = signature(svg);
  host.classList.add('scpc-sweeping');
  const points = [];
  let read = null; // the last point read
  try {
    for (const x of xs) {
      // Where the chart is now: the page can scroll or move during the sweep.
      const rect = svg.getBoundingClientRect();
      const clientX = rect.left + plotX + x;
      const clientY = rect.top + plotY + 20;
      hitTarget(doc, host, svg, clientX, clientY).dispatchEvent(mouse(doc, 'mousemove', { bubbles: true, clientX, clientY }));
      await frame();
      if (abort()) return null;
      if (signature(svg) !== before) return null;
      const point = readPoint(liveLines(host), drawn, lang);
      if (point && read && repeats(point, read, drawn[0])) return null;
      read = point ?? read;
      points.push(point);
    }
  } finally {
    svg.dispatchEvent(mouse(doc, 'mouseout', { bubbles: true }));
    svg.dispatchEvent(mouse(doc, 'mouseleave', {}));
    host.classList.remove('scpc-sweeping');
  }
  const usable = key => points.some(p => Number.isFinite(p?.[key].last) && Number.isFinite(p?.[key].previous));
  return drawn.every(usable) ? points : null;
}
