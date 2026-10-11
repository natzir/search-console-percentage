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

// Moves a synthetic mouse across the chart, point by point, and reads the tooltip each time. Returns
// null if the chart's data changes during the sweep, if Google's tooltip didn't update for a point, if a
// drawn metric got no number at any point (a tooltip it can't read), or if `abort()` turns true (checked
// before each point is read), so the caller can decide whether to run it again.
// Points past the days both periods have (a shorter previous period, as the last 3 months against the
// previous 3) are left without values: Google's tooltip stays on the last day they share.
// Google rewrites its tooltip within the mousemove, so a point is read at once; one it hasn't rewritten
// yet gets a frame. Every `budget` ms the sweep yields a frame to the page, so a long chart doesn't
// freeze it. When the person's pointer is on the chart, `pointer()` (where it last moved) is where
// Google's tooltip goes back to after.
export async function sweep(chart, lang, { frame = nextFrame, abort = () => false, budget = 40, pointer = () => null } = {}) {
  const { host, svg, plotX, plotY, xs, drawn, paired = xs.length } = chart;
  const doc = host.ownerDocument;
  const before = signature(svg);
  host.classList.add('scpc-sweeping');
  // Google rewrites its tooltip each time it moves to another point, even when the text comes out the
  // same (the hours of one day share their dates): left untouched, it is still on the point before.
  let rewritten = 0;
  const rewrites = new MutationObserver(records => (rewritten += records.length));
  const region = host.querySelector('[aria-live]');
  if (region) rewrites.observe(region, { subtree: true, childList: true, characterData: true });
  const points = [];
  let slice = performance.now();
  try {
    for (const [i, x] of xs.slice(0, paired).entries()) {
      // Where the chart is now: the page can scroll or move during the sweep.
      const rect = svg.getBoundingClientRect();
      const clientX = rect.left + plotX + x;
      const clientY = rect.top + plotY + 20;
      rewrites.takeRecords();
      rewritten = 0;
      hitTarget(doc, host, svg, clientX, clientY).dispatchEvent(mouse(doc, 'mousemove', { bubbles: true, clientX, clientY }));
      rewritten += rewrites.takeRecords().length;
      if (!rewritten) {
        await frame();
        rewritten += rewrites.takeRecords().length;
      }
      if (abort()) return null;
      if (signature(svg) !== before) return null;
      if (i > 0 && !rewritten) return null;
      points.push(readPoint(liveLines(host), drawn, lang));
      if (performance.now() - slice >= budget) {
        await frame();
        slice = performance.now();
      }
    }
  } finally {
    rewrites.disconnect();
    const at = host.matches(':hover') ? pointer() : null;
    if (at) {
      hitTarget(doc, host, svg, at.clientX, at.clientY).dispatchEvent(mouse(doc, 'mousemove', { bubbles: true, clientX: at.clientX, clientY: at.clientY }));
    } else {
      svg.dispatchEvent(mouse(doc, 'mouseout', { bubbles: true }));
      svg.dispatchEvent(mouse(doc, 'mouseleave', {}));
    }
    host.classList.remove('scpc-sweeping');
  }
  while (points.length < xs.length) points.push(null);
  const usable = key => points.some(p => Number.isFinite(p?.[key].last) && Number.isFinite(p?.[key].previous));
  return drawn.every(usable) ? points : null;
}
