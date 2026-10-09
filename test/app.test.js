import { describe, it, expect, afterEach, vi } from 'vitest';
import { start } from '../src/app.js';
import { buildPage } from './helpers/gsc.js';

const PERF = 'https://search.google.com/search-console/performance/search-analytics?resource_id=x&compare_date=PREV';
const wait = ms => new Promise(r => setTimeout(r, ms));
const now = () => Promise.resolve();
const fakeWin = href => ({ location: new URL(href), getComputedStyle: window.getComputedStyle.bind(window) });
const memoryStorage = (data = {}) => ({ data, async get(key) { return key in data ? { [key]: data[key] } : {}; }, async set(items) { Object.assign(data, items); } });
let app;

afterEach(() => {
  app?.stop();
  app = null;
  document.body.innerHTML = '';
});

describe('start', () => {
  it('adds the pills, the card pills, the export button and the strip by itself', async () => {
    buildPage();
    app = start(document, fakeWin(PERF), { storage: memoryStorage(), frame: now, delay: 0 });
    await wait(20);
    expect(document.querySelectorAll('[data-scpc="pill"]').length).toBe(12);
    expect(document.querySelectorAll('[data-scpc="card-pill"]').length).toBe(4);
    expect(document.querySelector('[data-scpc="toolbar"]')).not.toBeNull();
    expect(document.querySelectorAll('[data-scpc="strip"] rect[data-scpc-tone]').length).toBe(3);
  });

  it('does nothing outside Performance, or when the report is not comparing', async () => {
    buildPage();
    app = start(document, fakeWin('https://search.google.com/search-console/inspect?resource_id=x'), { frame: now, delay: 0 });
    await wait(20);
    expect(document.querySelectorAll('[data-scpc]')).toHaveLength(0);
    app.stop();
    buildPage({ compare: false });
    app = start(document, fakeWin(PERF), { frame: now, delay: 0 });
    await wait(20);
    expect(document.querySelectorAll('[data-scpc]')).toHaveLength(0);
  });

  it('removes everything when comparison is turned off', async () => {
    buildPage();
    app = start(document, fakeWin(PERF), { frame: now, delay: 0 });
    await wait(20);
    buildPage({ compare: false });
    await wait(20);
    expect(document.querySelectorAll('[data-scpc]')).toHaveLength(0);
  });

  it('turns off and on with the icon', async () => {
    buildPage();
    app = start(document, fakeWin(PERF), { frame: now, delay: 0 });
    await wait(20);
    app.toggle();
    expect(app.enabled).toBe(false);
    expect(document.querySelectorAll('[data-scpc]')).toHaveLength(0);
    app.toggle();
    await wait(20);
    expect(document.querySelectorAll('[data-scpc="pill"]').length).toBe(12);
  });

  it('remembers the metric chosen for the strip', async () => {
    buildPage();
    const storage = memoryStorage({ metric: 'IMPRESSIONS' });
    app = start(document, fakeWin(PERF), { storage, frame: now, delay: 0 });
    await wait(20);
    const select = document.querySelector('[data-scpc="strip"] select');
    expect(select.value).toBe('IMPRESSIONS');
    select.value = 'CLICKS';
    select.dispatchEvent(new Event('change'));
    await wait(5);
    expect(storage.data.metric).toBe('CLICKS');
  });

  it('waits for the person to stop hovering the chart before it reads the days', async () => {
    const { host } = buildPage();
    Object.defineProperty(host, 'matches', { configurable: true, value: sel => sel === ':hover' || Element.prototype.matches.call(host, sel) });
    app = start(document, fakeWin(PERF), { frame: now, delay: 0 });
    await wait(20);
    expect(document.querySelector('[data-scpc="strip"]')).toBeNull();
    Object.defineProperty(host, 'matches', { configurable: true, value: sel => Element.prototype.matches.call(host, sel) });
    host.dispatchEvent(new MouseEvent('mouseleave'));
    await wait(20);
    expect(document.querySelector('[data-scpc="strip"]')).not.toBeNull();
  });
});

const hovering = (host, on) => Object.defineProperty(host, 'matches', { configurable: true, value: sel => (on && sel === ':hover') || Element.prototype.matches.call(host, sel) });

describe('start, fixes', () => {
  it('removes the strip when the chart changes, instead of leaving the old days under the new chart', async () => {
    const { host, svg } = buildPage();
    app = start(document, fakeWin(PERF), { frame: now, delay: 0 });
    await wait(20);
    expect(document.querySelector('[data-scpc="strip"]')).not.toBeNull();
    hovering(host, true);
    svg.querySelector('path').setAttribute('d', 'M0,0L5,5');
    await wait(20);
    expect(document.querySelector('[data-scpc="strip"]')).toBeNull();
  });

  it('stops a sweep when the pointer arrives mid-way, and resumes after mouseleave', async () => {
    const { host } = buildPage();
    let n = 0;
    const frame = async () => { if (++n === 2) hovering(host, true); };
    app = start(document, fakeWin(PERF), { frame, delay: 0 });
    await wait(30);
    expect(document.querySelector('[data-scpc="strip"]')).toBeNull();
    hovering(host, false);
    host.dispatchEvent(new MouseEvent('mouseleave'));
    await wait(30);
    expect(document.querySelector('[data-scpc="strip"]')).not.toBeNull();
  });

  it('survives a throw inside the sweep', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    buildPage();
    let n = 0;
    const frame = async () => { if (++n === 1) throw new Error('boom'); };
    app = start(document, fakeWin(PERF), { frame, delay: 0 });
    await wait(20);
    expect(spy).toHaveBeenCalled();
    document.querySelectorAll('[data-scpc="pill"]').forEach(p => p.remove());
    document.body.append(document.createElement('div'));
    await wait(30);
    expect(document.querySelectorAll('[data-scpc="pill"]').length).toBe(12);
    spy.mockRestore();
  });

  it('draws again after a sweep if a draw arrived during it', async () => {
    buildPage();
    let n = 0;
    const frame = async () => {
      if (++n === 3) {
        app.toggle();
        app.toggle();
        await wait(10);
      }
    };
    app = start(document, fakeWin(PERF), { frame, delay: 0 });
    await wait(80);
    expect(document.querySelectorAll('[data-scpc="pill"]').length).toBe(12);
  });

  it('paints nothing if it is stopped mid-sweep', async () => {
    buildPage();
    let n = 0;
    const frame = async () => { if (++n === 2) app.stop(); };
    app = start(document, fakeWin(PERF), { frame, delay: 0 });
    await wait(30);
    expect(document.querySelector('[data-scpc]')).toBeNull();
  });

  it('keeps the same strip when something unrelated changes', async () => {
    buildPage();
    app = start(document, fakeWin(PERF), { frame: now, delay: 0 });
    await wait(20);
    const select = document.querySelector('[data-scpc="strip"] select');
    document.body.append(document.createElement('div'));
    await wait(20);
    expect(document.querySelector('[data-scpc="strip"] select')).toBe(select);
  });

  it('gives up re-reading a chart that never settles', async () => {
    const { svg } = buildPage();
    let n = 0;
    const frame = async () => { n++; svg.querySelector('path').setAttribute('d', `M0,0L${n},${n}`); };
    app = start(document, fakeWin(PERF), { frame, delay: 0 });
    await wait(150);
    expect(n).toBeLessThanOrEqual(4);
    expect(n).toBeGreaterThan(0);
  });

  it('applies a metric that storage returns late', async () => {
    buildPage();
    const storage = { async get() { await wait(30); return { metric: 'IMPRESSIONS' }; }, async set() {} };
    app = start(document, fakeWin(PERF), { storage, frame: now, delay: 0 });
    await wait(100);
    expect(document.querySelector('[data-scpc="strip"] select').value).toBe('IMPRESSIONS');
  });

  it('removes only the strip when the chart goes away but the table stays', async () => {
    const { host } = buildPage();
    app = start(document, fakeWin(PERF), { frame: now, delay: 0 });
    await wait(20);
    host.remove();
    await wait(20);
    expect(document.querySelector('[data-scpc="strip"]')).toBeNull();
    expect(document.querySelectorAll('[data-scpc="pill"]').length).toBe(12);
  });
});
