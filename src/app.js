// Watches Search Console and keeps the extension's additions in step with what it shows: pills and
// cards whenever the table or cards change; the daily strip whenever the chart's data changes.
import { download, ensureExportButton, fileName, tableCsv } from './csv.js';
import { sweep } from './daily.js';
import { findCards, findChart, findTable } from './detect.js';
import { annotateCards, annotateTable, removeAll } from './pills.js';
import { renderStrip } from './strip.js';

const PERFORMANCE = /\/search-console\/performance\//;
const ours = node => node.nodeType === 1 && (node.hasAttribute('data-scpc') || node.closest?.('[data-scpc]'));

export function start(doc, win, { storage, frame, delay = 200 } = {}) {
  let enabled = true;
  let timer = null;
  let sweeping = false;
  let swept = null; // { signature, points }
  let chosen = null;
  let waitingForLeave = null;
  const lang = () => doc.documentElement.lang || 'en';

  storage?.get('metric').then(v => { chosen = v?.metric ?? null; }).catch(() => {});

  const clear = () => {
    removeAll(doc);
    swept = null;
  };

  const exportCsv = () => {
    const model = findTable(doc);
    if (model) download(doc, tableCsv(model), fileName(new URL(win.location.href)));
  };

  const paint = (chart, l) => {
    const labels = Object.fromEntries(findCards(doc, l).map(card => [card.key, card.label]));
    const key = chart.drawn.includes(chosen) ? chosen : chart.drawn[0];
    renderStrip(doc, chart, swept.points, {
      key,
      labels,
      lang: l,
      onSelect: k => {
        chosen = k;
        storage?.set({ metric: k }).catch(() => {});
        paint(findChart(doc) ?? chart, l);
      },
    });
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
    sweeping = true;
    const points = await sweep(chart, l, frame ? { frame } : {});
    sweeping = false;
    if (!enabled) return;
    if (!points) return schedule();
    swept = { signature: chart.signature, points };
    paint(chart, l);
  };

  const draw = () => {
    timer = null;
    if (!enabled || sweeping) return;
    if (!PERFORMANCE.test(win.location.pathname)) return clear();
    const l = lang();
    const model = findTable(doc);
    const cards = findCards(doc, l);
    const chart = findChart(doc);
    if (!model && !cards.length && !chart?.compare) return clear();
    if (model) {
      annotateTable(model, l);
      ensureExportButton(doc, model, exportCsv);
    }
    annotateCards(cards, l);
    if (!chart?.compare) return;
    if (swept?.signature === chart.signature) paint(chart, l);
    else readDays(chart, l);
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
      observer.disconnect();
      clearTimeout(timer);
      clear();
    },
  };
}
