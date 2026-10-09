import { describe, it, expect, afterEach } from 'vitest';
import { liveLines, parseLine, readPoint, sweep } from '../src/daily.js';
import { findChart } from '../src/detect.js';
import { DAYS, ES, buildPage } from './helpers/gsc.js';

const now = () => Promise.resolve();

afterEach(() => {
  document.body.innerHTML = '';
});

describe('parseLine', () => {
  it('takes the date and the value, whatever the metric is called', () => {
    expect(parseLine('. Clicks: Thu, Sep 10, 2026\n            : 10 ,', 'en')).toEqual({ date: 'Thu, Sep 10, 2026', value: 10 });
    expect(parseLine('. Impressions: Wed, Sep 9, 2026 : 1,749 .', 'en')).toEqual({ date: 'Wed, Sep 9, 2026', value: 1749 });
    expect(parseLine('. Clics: jue, 10 sept 2026 : 1.423 ,', 'es')).toEqual({ date: 'jue, 10 sept 2026', value: 1423 });
    expect(parseLine('. CTR: jue, 10 sept 2026 : 0,7 % ,', 'es')).toEqual({ date: 'jue, 10 sept 2026', value: 0.7 });
    expect(parseLine('Day 2', 'en')).toBeNull();
  });
});

describe('readPoint', () => {
  it('pairs the lines, current period first, metrics in the cards\' order', () => {
    const lines = ['. Clicks: Thu, Sep 10, 2026 : 10 ,', '. Clicks: Thu, Aug 13, 2026 : 2 ,', '. Impressions: Thu, Sep 10, 2026 : 1,423 ,', '. Impressions: Thu, Aug 13, 2026 : 2,792 ,'];
    expect(readPoint(lines, ['CLICKS', 'IMPRESSIONS'], 'en')).toEqual({
      CLICKS: { last: 10, previous: 2, date: 'Thu, Sep 10, 2026', previousDate: 'Thu, Aug 13, 2026' },
      IMPRESSIONS: { last: 1423, previous: 2792, date: 'Thu, Sep 10, 2026', previousDate: 'Thu, Aug 13, 2026' },
    });
  });

  it('gives up when the lines don\'t match the drawn metrics', () => {
    expect(readPoint(['. Clicks: Thu, Sep 10, 2026 : 10 ,'], ['CLICKS'], 'en')).toBeNull();
  });
});

describe('sweep', () => {
  it('reads every point of the chart from Google\'s tooltip', async () => {
    buildPage({ drawn: ['CLICKS', 'IMPRESSIONS', 'CTR'] });
    const points = await sweep(findChart(document), 'en', { frame: now });
    expect(points).toHaveLength(DAYS.length);
    expect(points[1].CLICKS).toEqual({ last: 10, previous: 2, date: 'Thu, Sep 10, 2026', previousDate: 'Thu, Aug 13, 2026' });
    expect(points[2].CTR).toMatchObject({ last: 0.3, previous: 0 });
  });

  it('works on a Spanish page', async () => {
    buildPage({ lang: ES });
    const points = await sweep(findChart(document), 'es', { frame: now });
    expect(points[1].IMPRESSIONS).toMatchObject({ last: 1423, previous: 2792 });
  });

  it('gives up when the chart\'s data changes during the sweep', async () => {
    const { svg } = buildPage();
    let step = 0;
    const frame = async () => {
      if (++step === 2) svg.querySelector('path').setAttribute('d', 'M0,0L1,1');
    };
    expect(await sweep(findChart(document), 'en', { frame })).toBeNull();
  });

  it('marks the chart while it sweeps, and clears the mark after', async () => {
    const { host } = buildPage();
    let marked = false;
    await sweep(findChart(document), 'en', { frame: async () => { marked ||= host.classList.contains('scpc-sweeping'); } });
    expect(marked).toBe(true);
    expect(host.classList.contains('scpc-sweeping')).toBe(false);
  });

  it('reads the lines of the live region only', () => {
    const { host } = buildPage();
    host.querySelector('[aria-live] > span').innerHTML = '<div>Chart, containing counts…</div><div>Day 2</div><div>. Clicks: Thu, Sep 10, 2026 : 10 ,</div>';
    expect(liveLines(host)).toEqual(['. Clicks: Thu, Sep 10, 2026 : 10 ,']);
  });
});
