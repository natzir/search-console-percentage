// Watches Search Console and keeps the extension's additions in step with what it shows: pills and
// cards whenever the table or cards change; the daily strip whenever the chart's data changes.
import { download, ensureExportButton, fileName, tableCsv } from './csv.js';
import { sweep } from './daily.js';
import { findCards, findChart, findTable, signature } from './detect.js';
import { METRICS } from './change.js';
import { annotateCards, annotateTable, removeAll } from './pills.js';
import { renderLoading, renderStrip } from './strip.js';

const PERFORMANCE = /\/search-console\/performance\//;
const ours = node => node.nodeType === 1 && (node.hasAttribute('data-scpc') || node.closest?.('[data-scpc]'));

export function start(doc, win, { storage, frame, delay = 200 } = {}) {
  let enabled = true;
  let timer = null;
  let sweeping = false;
  // What was read for the report's current data: per point, per metric. { key, points, read: Set }
  let cache = null;
  let lastChart = null;
  let stopped = false;
  let pending = false; // a draw arrived while sweeping
  let fails = 0; // consecutive sweeps the chart changed under
  let blocked = null; // signature we stopped retrying on
  let chosen = null;
  let waitingForLeave = null;
  const lang = () => doc.documentElement.lang || 'en';

  storage?.get('metric').then(v => { chosen = v?.metric ?? null; schedule(); }).catch(() => {});

  const clear = () => {
    removeAll(doc);
  };

  const exportCsv = () => {
    const model = findTable(doc);
    if (model) download(doc, tableCsv(model), fileName(new URL(win.location.href)));
  };

  const stripOf = chart => chart.host.parentElement?.parentElement?.querySelector(':scope > [data-scpc="strip"]');
  const removeStrips = () => doc.querySelectorAll('[data-scpc="strip"]').forEach(el => el.remove());

  // The report's data: the page and its filters and dates (not which metrics are drawn), and its size.
  const cacheKey = chart => {
    const params = [...new URLSearchParams(win.location.search)].filter(([k]) => k !== 'metrics').sort((a, b) => (a[0] + a[1] < b[0] + b[1] ? -1 : 1));
    return `${win.location.pathname}?${new URLSearchParams(params)}|${chart.xs.length}`;
  };
  const cachedKeys = chart => {
    const keys = METRICS.filter(k => cache.points.some(p => p?.[k]));
    return keys.length ? keys : chart.drawn;
  };
  const labelsOf = l => Object.fromEntries(findCards(doc, l).map(card => [card.key, card.label]));
  const pick = keys => (keys.includes(chosen) ? chosen : keys[0]);

  const paint = (chart, l) => {
    if (!chart.host.isConnected) return;
    lastChart = chart;
    const keys = cachedKeys(chart);
    const key = pick(keys);
    const stamp = `${key}|${l}|${cache.key}|${chart.xs.join(',')}|${keys.join(',')}`;
    if (stripOf(chart)?.dataset.stamp === stamp) return;
    const box = renderStrip(doc, chart, cache.points, {
      key,
      keys,
      labels: labelsOf(l),
      lang: l,
      onSelect: k => {
        chosen = k;
        storage?.set({ metric: k }).catch(() => {});
        const current = findChart(doc);
        paint(current?.compare && cacheKey(current) === cache.key ? current : lastChart, l);
      },
    });
    box.dataset.stamp = stamp;
  };

  const loading = (chart, l) => {
    const keys = cachedKeys(chart);
    const stamp = `loading|${l}|${cache.key}|${chart.xs.join(',')}|${keys.join(',')}`;
    if (stripOf(chart)?.dataset.stamp === stamp) return;
    renderLoading(doc, chart, { key: pick(keys), keys, labels: labelsOf(l), lang: l }).dataset.stamp = stamp;
  };

  const readDays = async (chart, l) => {
    // Never fight the person over Google's tooltip: wait until the pointer leaves the chart.
    if (chart.host.matches(':hover')) {
      if (waitingForLeave !== chart.host) {
        waitingForLeave = chart.host;
        chart.host.addEventListener('mouseleave', () => { waitingForLeave = null; schedule(); }, { once: true });
      }
      return;
    }
    let aborted = false;
    const abort = () => {
      aborted = stopped || !enabled || chart.host.matches(':hover');
      return aborted;
    };
    sweeping = true;
    const target = cache;
    let points;
    try {
      points = await sweep(chart, l, { ...(frame ? { frame } : {}), abort });
    } finally {
      sweeping = false;
      if (pending) {
        pending = false;
        schedule();
      }
    }
    if (stopped || !enabled) return;
    if (!points) {
      if (aborted) return schedule();
      if (++fails >= 3) blocked = signature(chart.svg);
      else schedule();
      return;
    }
    fails = 0;
    if (cache !== target) return schedule();
    for (const k of chart.drawn) {
      target.read.add(k);
      points.forEach((point, i) => {
        if (point?.[k]) target.points[i] = { ...target.points[i], [k]: point[k] };
      });
    }
    paint(chart, l);
  };

  const draw = () => {
    timer = null;
    if (!enabled || stopped) return;
    if (sweeping) {
      pending = true;
      return;
    }
    if (!PERFORMANCE.test(win.location.pathname)) return clear();
    const l = lang();
    const model = findTable(doc);
    const cards = findCards(doc, l);
    const chart = findChart(doc);
    if (!model && !cards.length && !chart?.compare) return clear();
    if (!model) doc.querySelectorAll('[data-scpc="toolbar"]').forEach(el => el.remove());
    if (model) {
      annotateTable(model, l);
      ensureExportButton(doc, model, exportCsv);
    }
    annotateCards(cards, l);
    if (!chart?.compare) return removeStrips();
    const dataKey = cacheKey(chart);
    if (cache?.key !== dataKey) cache = { key: dataKey, points: [], read: new Set() };
    if (chart.drawn.every(k => cache.read.has(k))) return paint(chart, l);
    if (blocked !== null) {
      if (chart.signature === blocked) return removeStrips();
      blocked = null;
      fails = 0;
    }
    loading(chart, l);
    readDays(chart, l).catch(error => console.error('[Search Console Percentage Calculator]', error));
  };

  const schedule = () => {
    if (timer === null) timer = setTimeout(draw, delay);
  };

  const observer = new MutationObserver(records => {
    const relevant = records.some(r =>
      !ours(r.target) && ([...r.addedNodes, ...r.removedNodes].some(n => !ours(n)) || r.type === 'attributes'));
    if (relevant) schedule();
  });
  observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['d', 'data-numeric-value', 'title', 'stroke'] });
  schedule();

  return {
    get enabled() {
      return enabled;
    },
    toggle() {
      enabled = !enabled;
      if (enabled) schedule();
      else clear();
    },
    refresh: schedule,
    stop() {
      stopped = true;
      enabled = false;
      observer.disconnect();
      clearTimeout(timer);
      timer = null;
      clear();
    },
  };
}
