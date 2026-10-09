import { describe, it, expect, afterEach } from 'vitest';
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
