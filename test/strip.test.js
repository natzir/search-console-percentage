import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderStrip } from '../src/strip.js';
import { findChart } from '../src/detect.js';
import { sweep } from '../src/daily.js';
import { buildPage } from './helpers/gsc.js';

const now = () => Promise.resolve();
const LABELS = { CLICKS: 'Total clicks', IMPRESSIONS: 'Total impressions', CTR: 'Average CTR', POSITION: 'Average position' };

async function setup(options) {
  buildPage(options);
  const chart = findChart(document);
  return { chart, points: await sweep(chart, 'en', { frame: now }) };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('renderStrip', () => {
  it('draws one bar per point at the chart\'s own x, right after the chart', async () => {
    const { chart, points } = await setup();
    const strip = renderStrip(document, chart, points, { key: 'CLICKS', labels: LABELS, lang: 'en', onSelect() {} });
    expect(chart.host.nextElementSibling).toBe(strip);
    const bars = [...strip.querySelectorAll('rect[data-scpc-tone]')];
    expect(bars).toHaveLength(3);
    const centres = bars.map(b => Number(b.getAttribute('x')) + Number(b.getAttribute('width')) / 2);
    centres.forEach((c, i) => expect(c).toBeCloseTo(chart.plotX + chart.xs[i], 5));
  });

  it('colours bars by better or worse, and new where there was nothing before', async () => {
    const { chart, points } = await setup();
    const strip = renderStrip(document, chart, points, { key: 'CLICKS', labels: LABELS, lang: 'en', onSelect() {} });
    expect([...strip.querySelectorAll('rect[data-scpc-tone]')].map(b => [b.getAttribute('data-scpc-tone'), b.getAttribute('fill')])).toEqual([
      ['worse', '#ea4335'],
      ['better', '#34a853'],
      ['new', '#8ab4f8'],
    ]);
  });

  it('caps bars past ±100% with an arrow, and says what each bar is', async () => {
    const { chart, points } = await setup();
    const strip = renderStrip(document, chart, points, { key: 'CLICKS', labels: LABELS, lang: 'en', onSelect() {} });
    const bar = strip.querySelectorAll('rect[data-scpc-tone]')[1];
    expect(bar.querySelector('title').textContent).toBe('Thu, Sep 10, 2026 vs Thu, Aug 13, 2026 · Total clicks 10 vs 2 · +400%');
    expect([...strip.querySelectorAll('text')].some(t => t.textContent === '↑')).toBe(true);
  });

  it('turns position around: going down is green', async () => {
    const { chart, points } = await setup({ drawn: ['POSITION'] });
    const strip = renderStrip(document, chart, points, { key: 'POSITION', labels: LABELS, lang: 'en', onSelect() {} });
    expect([...strip.querySelectorAll('rect[data-scpc-tone]')].map(b => b.getAttribute('data-scpc-tone'))).toEqual(['worse', 'worse', 'better']);
  });

  it('offers the drawn metrics in a selector, and redraws in place', async () => {
    const { chart, points } = await setup();
    const onSelect = vi.fn();
    renderStrip(document, chart, points, { key: 'IMPRESSIONS', labels: LABELS, lang: 'en', onSelect });
    const select = document.querySelector('[data-scpc="strip"] select');
    expect([...select.options].map(o => [o.value, o.textContent, o.selected])).toEqual([
      ['CLICKS', 'Total clicks', false],
      ['IMPRESSIONS', 'Total impressions', true],
    ]);
    select.value = 'CLICKS';
    select.dispatchEvent(new Event('change'));
    expect(onSelect).toHaveBeenCalledWith('CLICKS');
    renderStrip(document, chart, points, { key: 'CLICKS', labels: LABELS, lang: 'en', onSelect });
    expect(document.querySelectorAll('[data-scpc="strip"]')).toHaveLength(1);
  });
});
