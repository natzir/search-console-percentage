import { describe, it, expect, afterEach } from 'vitest';
import { annotateCards, annotateTable, removeAll } from '../src/pills.js';
import { findCards, findTable } from '../src/detect.js';
import { ES, TOTALS, buildPage } from './helpers/gsc.js';

const plain = s => s.replace(/[  ]/g, ' ');
const pills = () => [...document.querySelectorAll('[data-scpc="pill"]')].map(p => [plain(p.textContent), p.className]);

afterEach(() => {
  document.body.innerHTML = '';
});

describe('annotateTable', () => {
  it('puts the % next to each Difference, coloured by better or worse', () => {
    buildPage();
    annotateTable(findTable(document), 'en');
    const first = [...document.querySelector('tbody tr').querySelectorAll('[data-scpc="pill"]')].map(p => [p.textContent, p.className]);
    expect(first).toEqual([
      ['▲ +7.1%', 'scpc-pill scpc-better'],
      ['▲ +30.9%', 'scpc-pill scpc-better'],
      ['▼ -18.2%', 'scpc-pill scpc-worse'],
      ['▼ -68.6%', 'scpc-pill scpc-better'],
    ]);
  });

  it('says new when there was nothing before, and = 0% when nothing moved', () => {
    buildPage();
    annotateTable(findTable(document), 'en');
    const [, second, third] = document.querySelectorAll('tbody tr');
    expect(second.cells[3].querySelector('[data-scpc]').textContent).toBe('new');
    expect(third.cells[3].querySelector('[data-scpc]').textContent).toBe('= 0%');
  });

  it('adds one pill per cell however often it runs, and redraws a cell Google replaced', () => {
    buildPage();
    const model = findTable(document);
    annotateTable(model, 'en');
    annotateTable(model, 'en');
    expect(document.querySelectorAll('tbody tr:first-child [data-scpc="pill"]')).toHaveLength(4);
    const cell = document.querySelector('tbody tr').cells[3];
    cell.innerHTML = '<span><span>2</span></span>';
    annotateTable(findTable(document), 'en');
    expect(cell.querySelectorAll('[data-scpc="pill"]')).toHaveLength(1);
  });

  it('says lost, in the worse colour, for a position of 0 (no impressions in the last period)', () => {
    buildPage({ rows: [{ dim: 'gone', CLICKS: [0, 2], IMPRESSIONS: [0, 40], CTR: [0, 5], POSITION: [0, 9.5] }] });
    annotateTable(findTable(document), 'en');
    const pill = document.querySelector('tbody tr').cells[12].querySelector('[data-scpc="pill"]');
    expect([pill.textContent, pill.className]).toEqual(['lost', 'scpc-pill scpc-worse']);
  });

  it('says nothing where the Difference is not last − previous, as when Google reorders the columns', () => {
    buildPage();
    const model = findTable(document);
    annotateTable(model, 'en');
    const row = document.querySelector('tbody tr');
    row.cells[3].setAttribute('data-numeric-value', '-2'); // clicks 30 vs 28
    row.cells[6].setAttribute('data-numeric-value', '21.4'); // impressions 89 vs 68: within rounding
    row.cells[9].setAttribute('data-numeric-value', '-7.45'); // CTR 33.7 vs 41.2: within rounding
    row.cells[12].setAttribute('data-numeric-value', '-2.6'); // position 1.1 vs 3.5
    annotateTable(model, 'en');
    expect([3, 6, 9, 12].map(i => row.cells[i].querySelector('[data-scpc="pill"]')?.textContent ?? null)).toEqual([null, '▲ +30.9%', '▼ -18.2%', null]);
  });

  it('keeps the pill where Google rounds Last, Previous and the Difference apart by 0.1', () => {
    buildPage();
    const row = document.querySelector('tbody tr');
    const set = (i, v) => row.cells[i].setAttribute('data-numeric-value', v);
    set(7, '3.8'); set(8, '4.2'); set(9, '-0.3'); // CTR: 3.8 − 4.2 is -0.4
    set(10, '31.5'); set(11, '9.2'); set(12, '22.2'); // position: 31.5 − 9.2 is 22.3
    annotateTable(findTable(document), 'en');
    expect([9, 12].map(i => row.cells[i].querySelector('[data-scpc="pill"]')?.textContent ?? null)).toEqual(['▼ -9.5%', '▲ +242%']);
  });

  it('leaves a cell without its number alone', () => {
    buildPage();
    document.querySelector('tbody tr').cells[2].removeAttribute('data-numeric-value');
    annotateTable(findTable(document), 'en');
    expect(document.querySelector('tbody tr').cells[3].querySelector('[data-scpc]')).toBeNull();
  });

  it('writes Spanish numbers on a Spanish page', () => {
    buildPage({ lang: ES });
    annotateTable(findTable(document), 'es');
    expect(pills()[0][0]).toBe('▲ +7,1 %');
  });
});

describe('annotateCards', () => {
  it('adds the difference and % to each card, once', () => {
    buildPage();
    const cards = findCards(document, 'en');
    annotateCards(cards, 'en');
    annotateCards(cards, 'en');
    expect([...document.querySelectorAll('[data-scpc="card-pill"]')].map(p => p.textContent)).toEqual([
      '▲ +80 · +47.6%',
      '▼ -31,207 · -47.1%',
      '▲ +0.5 pp · +179%',
      '▲ +1.0 · +7.6%',
    ]);
    for (const card of cards) expect(card.el.querySelector('[data-scpc="card-pill"]').parentElement).toBe(card.el.querySelector('[title]').parentElement);
  });

  it('works the CTR card out from the clicks and impressions totals, not its rounded title', () => {
    // 248 / 35,005 = 0.708 % and 168 / 66,212 = 0.254 %; the titles say 0.7 % and 0.3 %.
    buildPage();
    annotateCards(findCards(document, 'en'), 'en');
    const ctr = document.querySelector('[data-label="CTR"] [data-scpc="card-pill"]');
    expect(ctr.textContent).toBe('▲ +0.5 pp · +179%');
    expect(ctr.className).toContain('scpc-better');
  });

  it('falls back to the CTR card\'s title without both the clicks and impressions cards', () => {
    buildPage({ metrics: ['CTR', 'POSITION'] });
    annotateCards(findCards(document, 'en'), 'en');
    expect(document.querySelector('[data-label="CTR"] [data-scpc="card-pill"]').textContent).toBe('▲ +0.4 pp · +133%');
    document.body.innerHTML = '';
    buildPage({ metrics: ['CLICKS', 'CTR'] });
    annotateCards(findCards(document, 'en'), 'en');
    expect(document.querySelector('[data-label="CTR"] [data-scpc="card-pill"]').textContent).toBe('▲ +0.4 pp · +133%');
  });

  it('says lost on the position card when the last period has no position', () => {
    buildPage({ totals: { ...TOTALS, POSITION: [0, 9.5] } });
    annotateCards(findCards(document, 'en'), 'en');
    const pill = document.querySelector('[data-label="POSITION"] [data-scpc="card-pill"]');
    expect(pill.textContent).toBe('▼ -9.5 · lost');
    expect(pill.className).toContain('scpc-worse');
  });

  it('turns the pill white on a card filled with its metric colour', () => {
    buildPage();
    const cards = findCards(document, 'en');
    cards[0].el.style.backgroundColor = 'rgb(66, 133, 244)';
    annotateCards(cards, 'en');
    expect(cards[0].el.querySelector('[data-scpc]').classList.contains('scpc-on-colour')).toBe(true);
    expect(cards[1].el.querySelector('[data-scpc]').classList.contains('scpc-on-colour')).toBe(false);
  });
});

describe('removeAll', () => {
  it('takes away everything the extension added', () => {
    buildPage();
    annotateTable(findTable(document), 'en');
    annotateCards(findCards(document, 'en'), 'en');
    removeAll(document);
    expect(document.querySelectorAll('[data-scpc]')).toHaveLength(0);
  });
});
