import { describe, it, expect, afterEach, vi } from 'vitest';
import { start } from '../src/app.js';
import { buildPage, DAYS, ES } from './helpers/gsc.js';

const PERF = 'https://search.google.com/search-console/performance/search-analytics?resource_id=x&compare_date=PREV';
const wait = ms => new Promise(r => setTimeout(r, ms));
// The sweep's frames are these tests' hook into it: budget 0 yields one after every point.
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
    app = start(document, fakeWin(PERF), { storage: memoryStorage(), frame: now, delay: 0, settle: 0, budget: 0, patience: 15 });
    await wait(150);
    expect(document.querySelectorAll('[data-scpc="pill"]').length).toBe(12);
    expect(document.querySelectorAll('[data-scpc="card-pill"]').length).toBe(4);
    expect(document.querySelector('[data-scpc="toolbar"]')).not.toBeNull();
    expect(document.querySelectorAll('[data-scpc="strip"] rect[data-scpc-tone]').length).toBe(3);
  });

  it('does nothing outside Performance, or when the report is not comparing', async () => {
    buildPage();
    app = start(document, fakeWin('https://search.google.com/search-console/inspect?resource_id=x'), { frame: now, delay: 0, settle: 0, budget: 0, patience: 15 });
    await wait(20);
    expect(document.querySelectorAll('[data-scpc]')).toHaveLength(0);
    app.stop();
    buildPage({ compare: false });
    app = start(document, fakeWin(PERF), { frame: now, delay: 0, settle: 0, budget: 0, patience: 15 });
    await wait(20);
    expect(document.querySelectorAll('[data-scpc]')).toHaveLength(0);
  });

  it('removes everything when comparison is turned off', async () => {
    buildPage();
    app = start(document, fakeWin(PERF), { frame: now, delay: 0, settle: 0, budget: 0, patience: 15 });
    await wait(20);
    buildPage({ compare: false });
    await wait(20);
    expect(document.querySelectorAll('[data-scpc]')).toHaveLength(0);
  });

  it('turns off and on with the icon', async () => {
    buildPage();
    app = start(document, fakeWin(PERF), { frame: now, delay: 0, settle: 0, budget: 0, patience: 15 });
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
    app = start(document, fakeWin(PERF), { storage, frame: now, delay: 0, settle: 0, budget: 0, patience: 15 });
    await wait(20);
    const select = document.querySelector('[data-scpc="strip"] select');
    expect(select.value).toBe('IMPRESSIONS');
    select.value = 'CLICKS';
    select.dispatchEvent(new Event('change'));
    await wait(5);
    expect(storage.data.metric).toBe('CLICKS');
  });

  it('exports the CSV in the page\'s language', async () => {
    buildPage({ lang: ES });
    const saved = [URL.createObjectURL, URL.revokeObjectURL];
    const blobs = [];
    URL.createObjectURL = blob => { blobs.push(blob); return 'blob:csv'; };
    URL.revokeObjectURL = () => {};
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    try {
      app = start(document, fakeWin(PERF), { frame: now, delay: 0, settle: 0, budget: 0, patience: 15 });
      await wait(20);
      document.querySelector('[data-scpc="toolbar"] button').click();
      expect((await blobs[0].text()).split('\r\n')[1]).toMatch(/^blue widgets;30;28;2;7,14;/);
    } finally {
      click.mockRestore();
      [URL.createObjectURL, URL.revokeObjectURL] = saved;
    }
  });

  it('waits for the person to stop hovering the chart before it reads the days', async () => {
    const { host } = buildPage();
    Object.defineProperty(host, 'matches', { configurable: true, value: sel => sel === ':hover' || Element.prototype.matches.call(host, sel) });
    app = start(document, fakeWin(PERF), { frame: now, delay: 0, settle: 0, budget: 0, patience: 15 });
    await wait(20);
    expect(document.querySelector('[data-scpc="strip"]').getAttribute('aria-busy')).toBe('true');
    expect(document.querySelectorAll('[data-scpc="strip"] rect')).toHaveLength(0);
    Object.defineProperty(host, 'matches', { configurable: true, value: sel => Element.prototype.matches.call(host, sel) });
    host.dispatchEvent(new MouseEvent('mouseleave'));
    await wait(20);
    expect(document.querySelector('[data-scpc="strip"]')).not.toBeNull();
  });
});

const hovering = (host, on) => Object.defineProperty(host, 'matches', { configurable: true, value: sel => (on && sel === ':hover') || Element.prototype.matches.call(host, sel) });

describe('start, fixes', () => {
  it('stops a sweep when the pointer arrives mid-way, and resumes after mouseleave', async () => {
    const { host } = buildPage();
    let n = 0;
    const frame = async () => { if (++n === 2) hovering(host, true); };
    app = start(document, fakeWin(PERF), { frame, delay: 0, settle: 0, budget: 0, patience: 15 });
    await wait(30);
    expect(document.querySelector('[data-scpc="strip"]').getAttribute('aria-busy')).toBe('true');
    expect(document.querySelectorAll('[data-scpc="strip"] rect')).toHaveLength(0);
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
    app = start(document, fakeWin(PERF), { frame, delay: 0, settle: 0, budget: 0, patience: 15 });
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
    app = start(document, fakeWin(PERF), { frame, delay: 0, settle: 0, budget: 0, patience: 15 });
    await wait(80);
    expect(document.querySelectorAll('[data-scpc="pill"]').length).toBe(12);
  });

  it('paints nothing if it is stopped mid-sweep', async () => {
    buildPage();
    let n = 0;
    const frame = async () => { if (++n === 2) app.stop(); };
    app = start(document, fakeWin(PERF), { frame, delay: 0, settle: 0, budget: 0, patience: 15 });
    await wait(30);
    expect(document.querySelector('[data-scpc]')).toBeNull();
  });

  it('keeps the same strip when something unrelated changes', async () => {
    buildPage();
    app = start(document, fakeWin(PERF), { frame: now, delay: 0, settle: 0, budget: 0, patience: 15 });
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
    app = start(document, fakeWin(PERF), { frame, delay: 0, settle: 0, budget: 0, patience: 15 });
    await wait(150);
    expect(n).toBeLessThanOrEqual(4);
    expect(n).toBeGreaterThan(0);
  });

  it('applies a metric that storage returns late', async () => {
    buildPage();
    const storage = { async get() { await wait(30); return { metric: 'IMPRESSIONS' }; }, async set() {} };
    app = start(document, fakeWin(PERF), { storage, frame: now, delay: 0, settle: 0, budget: 0, patience: 15 });
    await wait(100);
    expect(document.querySelector('[data-scpc="strip"] select').value).toBe('IMPRESSIONS');
  });

  it('removes only the strip when the chart goes away but the table stays', async () => {
    const { host } = buildPage();
    app = start(document, fakeWin(PERF), { frame: now, delay: 0, settle: 0, budget: 0, patience: 15 });
    await wait(20);
    host.remove();
    await wait(20);
    expect(document.querySelector('[data-scpc="strip"]')).toBeNull();
    expect(document.querySelectorAll('[data-scpc="pill"]').length).toBe(12);
  });

  it('gives up, and removes the strip, when Google\'s tooltip is reworded and can\'t be read', async () => {
    const { host, svg } = buildPage();
    svg.addEventListener('mousemove', () => {
      host.querySelector('[aria-live] > span').innerHTML = '<div>Clicks on Thu, Sep 10, 2026: 10</div><div>Clicks on Thu, Aug 13, 2026: 2</div>';
    });
    let n = 0;
    app = start(document, fakeWin(PERF), { frame: async () => { n++; }, delay: 0, settle: 0, budget: 0, patience: 15 });
    await wait(150);
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(9); // three sweeps of three points, at most
    expect(document.querySelector('[data-scpc="strip"]')).toBeNull();
    const stable = n;
    document.body.append(document.createElement('div'));
    await wait(50);
    expect(n).toBe(stable);
    expect(document.querySelector('[data-scpc="strip"]')).toBeNull();
    expect(document.querySelectorAll('[data-scpc="pill"]').length).toBe(12);
  });

  it('does not walk the page again when Google writes its chart tooltip', async () => {
    const { host } = buildPage();
    app = start(document, fakeWin(PERF), { frame: now, delay: 0, settle: 0, budget: 0, patience: 15 });
    await wait(50);
    const walks = vi.spyOn(document, 'querySelectorAll');
    const tableWalks = () => walks.mock.calls.filter(([selector]) => selector === 'table').length;
    try {
      host.querySelector('[aria-live] > span').innerHTML = '<div>Day 2</div><div>. Clicks: Thu, Sep 10, 2026 : 10 ,</div>';
      host.querySelector('[aria-live]').append(document.createElement('div'));
      await wait(30);
      expect(tableWalks()).toBe(0);
      document.body.append(document.createElement('div'));
      await wait(30);
      expect(tableWalks()).toBeGreaterThan(0);
    } finally {
      walks.mockRestore();
    }
  });
});

describe('start, cache and loading', () => {
  const counting = () => {
    const calls = { n: 0 };
    return { calls, frame: async () => { calls.n++; } };
  };

  it('does not read the days again when a drawn metric is unchecked, and still offers it', async () => {
    buildPage();
    const { calls, frame } = counting();
    app = start(document, fakeWin(PERF), { frame, delay: 0, settle: 0, budget: 0, patience: 15 });
    await wait(30);
    expect(calls.n).toBe(3);
    buildPage({ drawn: ['CLICKS'] });
    await wait(30);
    expect(calls.n).toBe(3);
    const strip = document.querySelector('[data-scpc="strip"]');
    expect(strip.hasAttribute('aria-busy')).toBe(false);
    expect(strip.querySelectorAll('rect[data-scpc-tone]')).toHaveLength(3);
    expect([...strip.querySelectorAll('option')].map(o => o.value)).toEqual(['CLICKS', 'IMPRESSIONS']);
  });

  it('reads again for a metric that was never read, and merges it', async () => {
    buildPage({ drawn: ['CLICKS'] });
    const { calls, frame } = counting();
    app = start(document, fakeWin(PERF), { frame, delay: 0, settle: 0, budget: 0, patience: 15 });
    await wait(30);
    expect(calls.n).toBe(3);
    buildPage({ drawn: ['CLICKS', 'IMPRESSIONS'] });
    await wait(30);
    expect(calls.n).toBe(6);
    buildPage({ drawn: ['IMPRESSIONS'] });
    await wait(30);
    expect(calls.n).toBe(6);
    expect([...document.querySelectorAll('[data-scpc="strip"] option')].map(o => o.value)).toEqual(['CLICKS', 'IMPRESSIONS']);
  });

  it('starts a new cache when the report\'s data changes, ignoring the metrics parameter and the order', async () => {
    buildPage();
    const { calls, frame } = counting();
    const win = fakeWin(PERF);
    app = start(document, win, { frame, delay: 0, settle: 0, budget: 0, patience: 15 });
    await wait(30);
    expect(calls.n).toBe(3);
    win.location = new URL('https://search.google.com/search-console/performance/search-analytics?compare_date=PREV&metrics=CLICKS&resource_id=x');
    document.body.append(document.createElement('div'));
    await wait(30);
    expect(calls.n).toBe(3);
    win.location = new URL(`${PERF}&query=abc`);
    document.body.append(document.createElement('div'));
    await wait(30);
    expect(calls.n).toBe(6);
  });

  it('shows a loading state, with no bars from the previous key, while the days are read', async () => {
    buildPage();
    app = start(document, fakeWin(PERF), { frame: now, delay: 0, settle: 0, budget: 0, patience: 15 });
    await wait(30);
    expect(document.querySelectorAll('[data-scpc="strip"] rect[data-scpc-tone]')).toHaveLength(3);
    let release;
    const gate = new Promise(r => { release = r; });
    app.stop();
    buildPage();
    const win = fakeWin(`${PERF}&query=abc`);
    app = start(document, win, { frame: () => gate, delay: 0, settle: 0, budget: 0, patience: 15 });
    await wait(30);
    const strip = document.querySelector('[data-scpc="strip"]');
    expect(strip.getAttribute('aria-busy')).toBe('true');
    expect(strip.querySelector('select').disabled).toBe(true);
    expect(strip.textContent).toContain('Reading the chart…');
    expect(strip.querySelectorAll('rect')).toHaveLength(0);
    release();
    await wait(30);
    expect(document.querySelector('[data-scpc="strip"]').hasAttribute('aria-busy')).toBe(false);
    expect(document.querySelectorAll('[data-scpc="strip"] rect[data-scpc-tone]')).toHaveLength(3);
  });

  it('repaints without reading again when only the x positions change', async () => {
    const { svg } = buildPage();
    const { calls, frame } = counting();
    app = start(document, fakeWin(PERF), { frame, delay: 0, settle: 0, budget: 0, patience: 15 });
    await wait(30);
    const first = document.querySelector('[data-scpc="strip"] svg');
    expect(calls.n).toBe(3);
    svg.setAttribute('width', '600');
    svg.querySelectorAll('path[stroke]').forEach(path => path.setAttribute('d', path.getAttribute('d').replace(/([ML])([\d.]+),/g, (m, c, x) => `${c}${Number(x) * 0.8},`)));
    await wait(40);
    expect(document.querySelector('[data-scpc="strip"] svg')).not.toBe(first);
    expect(calls.n).toBe(3);
  });

  // Same dates and count, different numbers: what a new filter's data looks like.
  const NEW = DAYS.map((d, i) => ({ ...d, CLICKS: [[5, 2], [2, 10], [0, 4]][i], IMPRESSIONS: [[2, 1], [1, 2], [1, 3]][i] }));
  const tones = () => [...document.querySelectorAll('[data-scpc="strip"] rect[data-scpc-tone]')].map(r => r.getAttribute('data-scpc-tone'));
  const gated = () => {
    const g = { gate: null, frame: () => g.gate ?? Promise.resolve() };
    g.hold = () => { g.gate = new Promise(r => { g.release = () => { g.gate = null; r(); }; }); };
    return g;
  };

  it('never keeps the old bars when the URL changes first and the new data arrives later', async () => {
    buildPage();
    const g = gated();
    const win = fakeWin(PERF);
    app = start(document, win, { frame: g.frame, delay: 0, settle: 0, budget: 0, patience: 15 });
    await wait(30);
    expect(tones()).toEqual(['worse', 'better', 'new']);
    win.location = new URL(`${PERF}&query=abc`);
    document.body.append(document.createElement('div'));
    await wait(30);
    g.hold();
    buildPage({ days: NEW });
    await wait(30);
    const strip = document.querySelector('[data-scpc="strip"]');
    expect(strip.getAttribute('aria-busy')).toBe('true');
    expect(tones()).toEqual([]);
    g.release();
    await wait(30);
    expect(tones()).toEqual(['better', 'worse', 'worse']);
  });

  it('never keeps the old bars when the data changes under the same URL', async () => {
    buildPage();
    app = start(document, fakeWin(PERF), { frame: now, delay: 0, settle: 0, budget: 0, patience: 15 });
    await wait(30);
    buildPage({ days: NEW });
    await wait(30);
    expect(tones()).toEqual(['better', 'worse', 'worse']);
  });

  it('shows the loading state, with no bars, from a key change until the read finishes', async () => {
    buildPage();
    const g = gated();
    const win = fakeWin(PERF);
    app = start(document, win, { frame: g.frame, delay: 0, settle: 0, budget: 0, patience: 15 });
    await wait(30);
    g.hold();
    win.location = new URL(`${PERF}&query=abc`);
    document.body.append(document.createElement('div'));
    await wait(30);
    expect(document.querySelector('[data-scpc="strip"]').getAttribute('aria-busy')).toBe('true');
    expect(tones()).toEqual([]);
    g.release();
    await wait(30);
    expect(tones()).toEqual(['worse', 'better', 'new']);
  });

  it('does not write what it read if the page moved on during the sweep', async () => {
    buildPage();
    const g = gated();
    g.hold();
    const win = fakeWin(PERF);
    app = start(document, win, { frame: g.frame, delay: 0, settle: 0, budget: 0, patience: 15 });
    await wait(30);
    win.location = new URL(`${PERF}&query=abc`);
    buildPage({ days: NEW });
    g.release();
    await wait(60);
    expect(tones()).toEqual(['better', 'worse', 'worse']);
  });

  it('does not re-read when switching table tabs (breakdown) or reordering parameters', async () => {
    buildPage();
    const { calls, frame } = counting();
    const win = fakeWin(`${PERF}&breakdown=query`);
    app = start(document, win, { frame, delay: 0, settle: 0, budget: 0, patience: 15 });
    await wait(30);
    win.location = new URL('https://search.google.com/search-console/performance/search-analytics?compare_date=PREV&breakdown=page&resource_id=x');
    document.body.append(document.createElement('div'));
    await wait(30);
    expect(calls.n).toBe(3);
  });

  it('keeps focus on the select after choosing a metric', async () => {
    buildPage();
    app = start(document, fakeWin(PERF), { frame: now, delay: 0, settle: 0, budget: 0, patience: 15 });
    await wait(30);
    const select = document.querySelector('[data-scpc="strip"] select');
    select.focus();
    select.value = 'IMPRESSIONS';
    select.dispatchEvent(new Event('change'));
    await wait(5);
    const fresh = document.querySelector('[data-scpc="strip"] select');
    expect(fresh).not.toBe(select);
    expect(document.activeElement).toBe(fresh);
  });

  it('reads the chart on screen, not a hidden earlier one that comes first', async () => {
    buildPage();
    const host = document.querySelector('[role="application"]');
    const old = host.closest('.chart-card').cloneNode(true);
    old.querySelectorAll('path[stroke]').forEach(p => p.setAttribute('d', 'M1,1L2,2L3,3L4,4L5,5'));
    document.body.prepend(old);
    app = start(document, fakeWin(PERF), { frame: now, delay: 0, settle: 0, budget: 0, patience: 15 });
    await wait(30);
    expect(tones()).toEqual(['worse', 'better', 'new']);
  });

  it('does not re-read while Google animates the remaining lines after a toggle', async () => {
    buildPage();
    const { calls, frame } = counting();
    app = start(document, fakeWin(PERF), { frame, delay: 0, settle: 50, budget: 0, patience: 15 });
    await wait(150);
    expect(calls.n).toBe(3);
    buildPage({ drawn: ['CLICKS'] });
    const path = document.querySelector('path[stroke="#4285F4"][stroke-dasharray="null"]');
    const truth = path.getAttribute('d');
    const busy = [];
    for (const dy of [90, 60, 30, 10, 0]) {
      path.setAttribute('d', truth.replace(/,([\d.]+)/g, (m, y) => `,${Number(y) + dy}`));
      await wait(15);
      busy.push(document.querySelector('[data-scpc="strip"]')?.hasAttribute('aria-busy'));
    }
    await wait(150);
    expect(busy.every(b => b === false)).toBe(true);
    expect(calls.n).toBe(3);
    expect([...document.querySelectorAll('[data-scpc="strip"] option')].map(o => o.value)).toEqual(['CLICKS', 'IMPRESSIONS']);
    expect(document.querySelector('[data-scpc="strip"]').hasAttribute('aria-busy')).toBe(false);
  });

  it('waits for the new chart after a URL change, showing the loading state and reading nothing', async () => {
    buildPage();
    const { calls, frame } = counting();
    const win = fakeWin(PERF);
    app = start(document, win, { frame, delay: 0, settle: 20, budget: 0, patience: 5000 });
    await wait(100);
    expect(calls.n).toBe(3);
    win.location = new URL(`${PERF}&query=abc`);
    document.body.append(document.createElement('div'));
    await wait(80);
    expect(calls.n).toBe(3);
    expect(document.querySelector('[data-scpc="strip"]').getAttribute('aria-busy')).toBe('true');
    expect(tones()).toEqual([]);
    buildPage({ days: NEW });
    await wait(100);
    expect(calls.n).toBe(6);
    expect(tones()).toEqual(['better', 'worse', 'worse']);
  });

  it('stops retrying when the page keeps moving under the sweep', async () => {
    buildPage();
    let n = 0;
    const win = fakeWin(PERF);
    // The URL changes during every sweep, so what was read never belongs to the key it started with.
    const frame = async () => { if (++n % 3 === 1) win.location = new URL(`${PERF}&query=q${n}`); };
    app = start(document, win, { frame, delay: 0, settle: 0, budget: 0, patience: 5 });
    await wait(300);
    expect(n).toBeLessThanOrEqual(12);
    const stable = n;
    await wait(100);
    expect(n).toBe(stable);
    // Given up: no strip left stuck on "Reading the chart…".
    expect(document.querySelector('[data-scpc="strip"]')).toBeNull();
  });

  it('reads at once when the new chart is already up at the first draw after a URL change', async () => {
    buildPage();
    const { calls, frame } = counting();
    const win = fakeWin(PERF);
    app = start(document, win, { frame, delay: 0, settle: 20, budget: 0, patience: 5000 });
    await wait(100);
    expect(calls.n).toBe(3);
    win.location = new URL(`${PERF}&query=abc`);
    buildPage({ days: NEW });
    await wait(120);
    expect(calls.n).toBe(6);
    expect(tones()).toEqual(['better', 'worse', 'worse']);
  });

  it('does not wait for the old chart when the new one has another number of points', async () => {
    buildPage();
    const { calls, frame } = counting();
    const win = fakeWin(PERF);
    app = start(document, win, { frame, delay: 0, settle: 20, budget: 0, patience: 5000 });
    await wait(100);
    win.location = new URL(`${PERF}&query=abc`);
    buildPage({ days: DAYS.slice(0, 2) });
    await wait(120);
    expect(calls.n).toBe(5);
    expect(tones()).toEqual(['worse', 'better']);
  });

  it('keeps waiting for the new chart across turning the icon off and on', async () => {
    buildPage();
    const { calls, frame } = counting();
    const win = fakeWin(PERF);
    app = start(document, win, { frame, delay: 0, settle: 20, budget: 0, patience: 5000 });
    await wait(100);
    win.location = new URL(`${PERF}&query=abc`);
    document.body.append(document.createElement('div'));
    await wait(60);
    app.toggle();
    app.toggle();
    await wait(100);
    expect(calls.n).toBe(3);
    expect(document.querySelector('[data-scpc="strip"]').getAttribute('aria-busy')).toBe('true');
    expect(tones()).toEqual([]);
  });
});
