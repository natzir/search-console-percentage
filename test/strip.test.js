import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderLoading, renderStrip } from '../src/strip.js';
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
  it('draws one bar per point at the chart\'s own x, right under the chart\'s wrapper', async () => {
    const { chart, points } = await setup();
    const strip = renderStrip(document, chart, points, { key: 'CLICKS', labels: LABELS, lang: 'en', onSelect() {} });
    expect(strip.parentElement).toBe(chart.host.parentElement.parentElement);
    expect(strip.previousElementSibling).toBe(chart.host.parentElement);
    for (const t of [...strip.querySelectorAll('svg > text')].filter(x => x.textContent.includes('100'))) expect(t.getAttribute('text-anchor')).toBe('end');
    const bars = [...strip.querySelectorAll('rect[data-scpc-tone]')];
    expect(bars).toHaveLength(3);
    const centres = bars.map(b => Number(b.getAttribute('x')) + Number(b.getAttribute('width')) / 2);
    centres.forEach((c, i) => expect(c).toBeCloseTo(chart.plotX + chart.xs[i], 5));
  });

  it('colours bars by better or worse, and new where there was nothing before', async () => {
    const { chart, points } = await setup();
    const strip = renderStrip(document, chart, points, { key: 'CLICKS', labels: LABELS, lang: 'en', onSelect() {} });
    expect([...strip.querySelectorAll('rect[data-scpc-tone]')].map(b => [b.getAttribute('data-scpc-tone'), b.getAttribute('fill')])).toEqual([
      ['worse', '#d93025'],
      ['better', '#188038'],
      ['new', '#1a73e8'],
    ]);
  });

  it('caps bars past ±100% with an arrow', async () => {
    const { chart, points } = await setup();
    const strip = renderStrip(document, chart, points, { key: 'CLICKS', labels: LABELS, lang: 'en', onSelect() {} });
    expect([...strip.querySelectorAll('text')].some(t => t.textContent === '↑')).toBe(true);
    expect(strip.querySelector('title')).toBeNull();
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

  it('associates the title with the select, and the legend uses the new colours', async () => {
    const { chart, points } = await setup();
    const strip = renderStrip(document, chart, points, { key: 'CLICKS', labels: LABELS, lang: 'en', onSelect() {} });
    const label = strip.querySelector('label');
    const select = strip.querySelector('select');
    expect(label.textContent).toBe('Change by date');
    expect(label.getAttribute('for')).toBe(select.id);
    expect(select.closest('.scpc-select-wrap')).not.toBeNull();
    expect(strip.querySelector('.scpc-swatch.scpc-better')).not.toBeNull();
  });

  it('shows an instant tooltip with three lines on pointerover, and hides it on Escape', async () => {
    const { chart, points } = await setup();
    const strip = renderStrip(document, chart, points, { key: 'CLICKS', labels: LABELS, lang: 'en', onSelect() {} });
    const tip = strip.querySelector('.scpc-tip');
    expect(tip.getAttribute('role')).toBe('tooltip');
    expect(tip.hidden).toBe(true);
    strip.querySelectorAll('rect[data-scpc-tone]')[1].dispatchEvent(new Event('pointerover', { bubbles: true }));
    expect(tip.hidden).toBe(false);
    expect([...tip.children].map(c => c.textContent)).toEqual([
      'Thu, Sep 10, 2026 vs Thu, Aug 13, 2026',
      'Total clicks: 10 vs 2',
      '+400% · better',
    ]);
    strip.querySelector('.scpc-plot').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(tip.hidden).toBe(true);
  });

  it('reads by keyboard: arrows move the active bar and the live region says it', async () => {
    const { chart, points } = await setup();
    const strip = renderStrip(document, chart, points, { key: 'CLICKS', labels: LABELS, lang: 'en', onSelect() {} });
    const plot = strip.querySelector('.scpc-plot');
    const live = strip.querySelector('[aria-live="polite"]');
    const key = k => plot.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
    expect(plot.getAttribute('tabindex')).toBe('0');
    expect(plot.getAttribute('role')).toBe('group');
    expect(plot.getAttribute('aria-roledescription')).toBe('bar chart');
    expect(plot.getAttribute('aria-label')).toBe('Change by date, Total clicks: 1 days better, 1 worse, 1 new. Use the left and right arrow keys to read each day.');
    expect(strip.querySelector('svg').getAttribute('aria-hidden')).toBe('true');
    plot.dispatchEvent(new Event('focus'));
    expect(strip.querySelector('.scpc-tip').hidden).toBe(false);
    expect(live.textContent).toMatch(/^Wed, Sep 9, 2026/);
    key('ArrowRight');
    expect(live.textContent).toBe('Thu, Sep 10, 2026 vs Thu, Aug 13, 2026. Total clicks 10 vs 2. +400%, better.');
    expect(strip.querySelectorAll('rect[stroke="#1f1f1f"]')).toHaveLength(1);
    expect(strip.querySelector('rect[stroke="#1f1f1f"]').getAttribute('data-scpc-tone')).toBe('better');
    key('End');
    expect(strip.querySelector('.scpc-tip').children[2].textContent).toBe('new');
    key('ArrowRight');
    expect(strip.querySelector('rect[stroke="#1f1f1f"]').getAttribute('data-scpc-tone')).toBe('new');
    key('Home');
    key('ArrowLeft');
    expect(strip.querySelector('rect[stroke="#1f1f1f"]').getAttribute('data-scpc-tone')).toBe('worse');
    plot.dispatchEvent(new Event('blur'));
    expect(strip.querySelector('.scpc-tip').hidden).toBe(true);
  });

  it('renders a loading state of the same shape: select disabled, aria-busy, no bars', async () => {
    const { chart, points } = await setup();
    const strip = renderStrip(document, chart, points, { key: 'CLICKS', labels: LABELS, lang: 'en', onSelect() {} });
    renderLoading(document, chart, { key: 'CLICKS', labels: LABELS, lang: 'en' });
    expect(strip.getAttribute('aria-busy')).toBe('true');
    expect(strip.querySelector('select').disabled).toBe(true);
    expect(strip.querySelectorAll('rect')).toHaveLength(0);
    expect(strip.textContent).toContain('Reading the days…');
    renderStrip(document, chart, points, { key: 'CLICKS', labels: LABELS, lang: 'en', onSelect() {} });
    expect(strip.hasAttribute('aria-busy')).toBe(false);
  });

  it('offers the metrics it is given, not only the drawn ones', async () => {
    const { chart, points } = await setup();
    const strip = renderStrip(document, chart, points, { key: 'CLICKS', keys: ['CLICKS', 'IMPRESSIONS', 'CTR'], labels: LABELS, lang: 'en', onSelect() {} });
    expect([...strip.querySelectorAll('option')].map(o => o.value)).toEqual(['CLICKS', 'IMPRESSIONS', 'CTR']);
  });
});
