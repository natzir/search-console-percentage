import { describe, it, expect, afterEach } from 'vitest';
import { findCards, findChart, findTable, pathXs, readRows, signature } from '../src/detect.js';
import { ES, buildPage } from './helpers/gsc.js';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('findTable', () => {
  it('finds a triplet of columns per metric by their untranslated label', () => {
    buildPage();
    const model = findTable(document);
    expect(model.metrics).toEqual([
      { key: 'CLICKS', cols: [1, 2, 3] },
      { key: 'IMPRESSIONS', cols: [4, 5, 6] },
      { key: 'CTR', cols: [7, 8, 9] },
      { key: 'POSITION', cols: [10, 11, 12] },
    ]);
  });

  it('works the same on a Spanish page and on Discover\'s three metrics', () => {
    buildPage({ lang: ES, metrics: ['CLICKS', 'IMPRESSIONS', 'CTR'] });
    expect(findTable(document).metrics.map(m => m.key)).toEqual(['CLICKS', 'IMPRESSIONS', 'CTR']);
  });

  it('finds nothing when the report is not comparing', () => {
    buildPage({ compare: false });
    expect(findTable(document)).toBeNull();
  });

  it('skips a hidden table left from another tab', () => {
    buildPage();
    document.querySelector('table').getClientRects = () => [];
    expect(findTable(document)).toBeNull();
  });
});

describe('readRows', () => {
  it('reads last and previous from data-numeric-value, and NaN where it is missing', () => {
    buildPage();
    const model = findTable(document);
    document.querySelector('tbody tr').cells[2].removeAttribute('data-numeric-value');
    const rows = readRows(model);
    expect(rows[0].values.CLICKS).toEqual([30, NaN]);
    expect(rows[0].values.POSITION).toEqual([1.1, 3.5]);
    expect(rows[0].diffCells.CLICKS).toBe(document.querySelector('tbody tr').cells[3]);
  });
});

describe('findCards', () => {
  it('reads both totals from the titles, in the page\'s language', () => {
    buildPage({ lang: ES });
    expect(findCards(document, 'es').map(({ key, label, last, previous }) => ({ key, label, last, previous }))).toEqual([
      { key: 'CLICKS', label: 'Clics totales', last: 248, previous: 168 },
      { key: 'IMPRESSIONS', label: 'Impresiones totales', last: 35005, previous: 66212 },
      { key: 'CTR', label: 'CTR medio', last: 0.7, previous: 0.3 },
      { key: 'POSITION', label: 'Posición media', last: 14.2, previous: 13.2 },
    ]);
  });

  it('finds none when not comparing', () => {
    buildPage({ compare: false });
    expect(findCards(document, 'en')).toEqual([]);
  });
});

describe('findChart', () => {
  it('finds the plot, the points and which metrics are drawn, in the cards\' order', () => {
    const { xs } = buildPage({ drawn: ['CLICKS', 'IMPRESSIONS', 'POSITION'] });
    const chart = findChart(document);
    expect(chart).toMatchObject({ plotX: 26, plotY: 10, drawn: ['CLICKS', 'IMPRESSIONS', 'POSITION'], compare: true });
    expect(chart.xs).toEqual(xs);
  });

  it('knows when the chart is not comparing', () => {
    buildPage({ compare: false });
    expect(findChart(document).compare).toBe(false);
  });

  it('reads path coordinates and a data signature that ignores hover marks', () => {
    expect(pathXs('M12,57.01L36.59,42.4L61.18,44')).toEqual([12, 36.59, 61.18]);
    const { svg } = buildPage();
    const before = signature(svg);
    svg.querySelector('g').append(document.createElementNS('http://www.w3.org/2000/svg', 'circle'));
    expect(signature(svg)).toBe(before);
  });
});
