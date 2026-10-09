import { describe, it, expect, afterEach } from 'vitest';
import { annotateCards, annotateTable, removeAll } from '../src/pills.js';
import { findCards, findTable } from '../src/detect.js';
import { ES, buildPage } from './helpers/gsc.js';

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
