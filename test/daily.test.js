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

  it('reads a value written as a word, as Google writes the position of a period without impressions, as 0', () => {
    expect(parseLine('. Position: Wed, Aug 12, 2026\n            : none .', 'en')).toEqual({ date: 'Wed, Aug 12, 2026', value: 0 });
    expect(parseLine('. Posición: mié, 12 ago 2026 : ninguna .', 'es')).toEqual({ date: 'mié, 12 ago 2026', value: 0 });
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

  it('gives up, and cleans up, when the caller aborts it', async () => {
    const { host } = buildPage();
    let step = 0;
    const frame = async () => { step++; };
    const abort = () => step >= 2;
    expect(await sweep(findChart(document), 'en', { frame, abort })).toBeNull();
    expect(step).toBe(2);
    expect(host.classList.contains('scpc-sweeping')).toBe(false);
  });

  it('marks the chart while it sweeps, and clears the mark after', async () => {
    const { host } = buildPage();
    let marked = false;
    await sweep(findChart(document), 'en', { frame: async () => { marked ||= host.classList.contains('scpc-sweeping'); } });
    expect(marked).toBe(true);
    expect(host.classList.contains('scpc-sweeping')).toBe(false);
  });

  it('reads each point where the chart is now, when the page moves during the sweep', async () => {
    const { svg } = buildPage();
    let left = 0;
    svg.getBoundingClientRect = () => ({ left, top: 0, right: left + 751, bottom: 212, width: 751, height: 212, x: left, y: 0 });
    const points = await sweep(findChart(document), 'en', { frame: async () => { left += 40; } });
    expect(points?.map(p => p.CLICKS.date)).toEqual(DAYS.map(d => d.date));
  });

  it('reads the chart when it is scrolled out of view, where elementFromPoint finds nothing', async () => {
    const { svg } = buildPage();
    // Scrolled up past the top of the window, as when the person reads the table below.
    svg.getBoundingClientRect = () => ({ left: 394, top: -244, right: 1145, bottom: -32, width: 751, height: 212, x: 394, y: -244 });
    document.elementFromPoint = () => null;
    try {
      const points = await sweep(findChart(document), 'en', { frame: now });
      expect(points?.map(p => p.CLICKS.date)).toEqual(DAYS.map(d => d.date));
    } finally {
      delete document.elementFromPoint;
    }
  });

  it('gives up when Google\'s tooltip did not update for a point', async () => {
    const { host } = buildPage();
    let moves = 0;
    // The second mousemove never reaches the chart: its tooltip still shows the first point.
    host.addEventListener('mousemove', event => { if (++moves === 2) event.stopImmediatePropagation(); }, true);
    expect(await sweep(findChart(document), 'en', { frame: now })).toBeNull();
    expect(moves).toBe(2);
  });

  it('reads on when only the previous date repeats, as when Google pairs two days with one in periods of different lengths', async () => {
    const days = DAYS.map(day => ({ ...day, prev: DAYS[0].prev }));
    buildPage({ days });
    const points = await sweep(findChart(document), 'en', { frame: now });
    expect(points?.map(p => p.CLICKS.date)).toEqual(DAYS.map(day => day.date));
  });

  it('gives up when the tooltip is written in a way it can\'t read', async () => {
    const { host, svg } = buildPage();
    svg.addEventListener('mousemove', () => {
      host.querySelector('[aria-live] > span').innerHTML = '<div>Clicks on Thu, Sep 10, 2026: 10</div><div>Clicks on Thu, Aug 13, 2026: 2</div>';
    });
    expect(await sweep(findChart(document), 'en', { frame: now })).toBeNull();
  });

  it('gives up when a drawn metric has no number at any point', async () => {
    const { host, svg } = buildPage();
    svg.addEventListener('mousemove', () => {
      const lines = [...host.querySelectorAll('[aria-live] div')].filter(el => el.textContent.startsWith('. Impressions'));
      for (const line of lines) line.textContent = line.textContent.replace(/: [\d,]+ ,$/, ': — ,');
    });
    expect(await sweep(findChart(document), 'en', { frame: now })).toBeNull();
  });

  it('reads the lines of the live region only', () => {
    const { host } = buildPage();
    host.querySelector('[aria-live] > span').innerHTML = '<div>Chart, containing counts…</div><div>Day 2</div><div>. Clicks: Thu, Sep 10, 2026 : 10 ,</div>';
    expect(liveLines(host)).toEqual(['. Clicks: Thu, Sep 10, 2026 : 10 ,']);
  });
});
