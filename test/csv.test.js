import { describe, it, expect, afterEach, vi } from 'vitest';
import { download, ensureExportButton, fileName, tableCsv } from '../src/csv.js';
import { findTable } from '../src/detect.js';
import { ES, buildPage } from './helpers/gsc.js';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('tableCsv', () => {
  it('has every column, exact numbers, and a % change after each Difference', () => {
    buildPage({ metrics: ['CLICKS', 'POSITION'] });
    const lines = tableCsv(findTable(document)).split('\r\n');
    expect(lines[0]).toBe('﻿Top queries,Clicks Last 28 days,Clicks Previous 28 days,Clicks Difference,Clicks % change,Position Last 28 days,Position Previous 28 days,Position Difference,Position % change');
    expect(lines[1]).toBe('blue widgets,30,28,2,7.14,1.1,3.5,-2.4,-68.57');
    expect(lines[2]).toBe('"red widgets, cheap",3,0,3,new,9.7,8.9,0.8,8.99');
    expect(lines[3]).toBe('"widget ""pro""",0,0,0,0.00,12,12,0,0.00');
  });

  it('follows a language that writes decimals with a comma: semicolons and decimal commas, as Excel expects there', () => {
    buildPage({ lang: ES, metrics: ['CLICKS', 'POSITION'] });
    const lines = tableCsv(findTable(document), 'es').split('\r\n');
    expect(lines[0]).toBe('﻿Consultas principales;Clics Últimos 28 días;Clics 28 días anteriores;Clics Diferencia;Clics % change;Posición Últimos 28 días;Posición 28 días anteriores;Posición Diferencia;Posición % change');
    expect(lines[1]).toBe('blue widgets;30;28;2;7,14;1,1;3,5;-2,4;-68,57');
    expect(lines[2]).toBe('red widgets, cheap;3;0;3;new;9,7;8,9;0,8;8,99');
    expect(lines[3]).toBe('"widget ""pro""";0;0;0;0,00;12;12;0;0,00');
    expect(lines[4]).toBe('');
  });

  it('keeps Google\'s Spanish headers, and writes numbers without thousands separators', () => {
    buildPage({ lang: ES, metrics: ['IMPRESSIONS'] });
    const lines = tableCsv(findTable(document), 'es').split('\r\n');
    expect(lines[0]).toBe('﻿Consultas principales;Impresiones Últimos 28 días;Impresiones 28 días anteriores;Impresiones Diferencia;Impresiones % change');
    expect(lines[3]).toBe('"widget ""pro""";1423;2792;-1369;-49,03');
  });

  it('quotes a field that holds the separator in use, and only then', () => {
    const rows = [{ dim: 'widgets; cheap', CLICKS: [1, 2] }, { dim: '=1;2', CLICKS: [1, 1] }];
    buildPage({ lang: ES, metrics: ['CLICKS'], rows });
    let lines = tableCsv(findTable(document), 'es').split('\r\n');
    expect(lines[1]).toBe('"widgets; cheap";1;2;-1;-50,00');
    expect(lines[2]).toBe(`"'=1;2";1;1;0;0,00`);
    document.body.innerHTML = '';
    buildPage({ metrics: ['CLICKS'], rows });
    lines = tableCsv(findTable(document), 'en').split('\r\n');
    expect(lines[1]).toBe('widgets; cheap,1,2,-1,-50.00');
  });

  it('keeps spreadsheets from reading a query as a formula, but not the numbers', () => {
    buildPage({
      metrics: ['CLICKS'],
      rows: [
        { dim: '+500 euros', CLICKS: [3, 4] },
        { dim: '=HYPERLINK("x")', CLICKS: [1, 1] },
        { dim: '@home', CLICKS: [2, 1] },
      ],
    });
    const lines = tableCsv(findTable(document)).split('\r\n');
    expect(lines[1]).toBe("'+500 euros,3,4,-1,-25.00");
    expect(lines[2]).toBe('"\'=HYPERLINK(""x"")",1,1,0,0.00');
    expect(lines[3]).toBe("'@home,2,1,1,100.00");
  });

  it('writes lost for a position of 0', () => {
    buildPage({ metrics: ['POSITION'], rows: [{ dim: 'gone', POSITION: [0, 9.5] }, { dim: 'never', POSITION: [0, 0] }] });
    const lines = tableCsv(findTable(document)).split('\r\n');
    expect(lines[1]).toBe('gone,0,9.5,-9.5,lost');
    expect(lines[2]).toBe('never,0,0,0,0.00');
  });

  it('leaves the % empty where the Difference is not last − previous', () => {
    buildPage({ metrics: ['CLICKS', 'POSITION'] });
    const row = document.querySelector('tbody tr');
    row.cells[3].setAttribute('data-numeric-value', '-2'); // clicks 30 vs 28
    row.cells[6].setAttribute('data-numeric-value', '-2.43'); // position 1.1 vs 3.5: within rounding
    expect(tableCsv(findTable(document)).split('\r\n')[1]).toBe('blue widgets,30,28,-2,,1.1,3.5,-2.43,-68.57');
  });

  it('writes a page as its URL, without the labels of the buttons Google puts beside it', () => {
    buildPage({ metrics: ['CLICKS'] });
    document.querySelector('tbody tr').cells[0].innerHTML =
      '<span><span>https://example.com/blue/<div><div><span><button aria-label=" Copy URL "><span aria-hidden="true"><svg></svg></span></button>' +
      '<div role="tooltip" aria-hidden="true">Copy URL</div></span></div><div><span><button aria-label=" Inspect URL "></button>' +
      '<div role="tooltip" aria-hidden="true">Inspect URL</div></span></div></div></span></span>';
    expect(tableCsv(findTable(document)).split('\r\n')[1]).toBe('https://example.com/blue/,30,28,2,7.14');
  });

  it('leaves a missing number empty instead of writing NaN', () => {
    buildPage({ metrics: ['CLICKS'] });
    document.querySelector('tbody tr').cells[2].removeAttribute('data-numeric-value');
    expect(tableCsv(findTable(document)).split('\r\n')[1]).toBe('blue widgets,30,,2,');
  });

  it('leaves a blank number empty instead of writing 0', () => {
    buildPage({ metrics: ['CLICKS'] });
    document.querySelector('tbody tr').cells[2].setAttribute('data-numeric-value', ' ');
    expect(tableCsv(findTable(document)).split('\r\n')[1]).toBe('blue widgets,30,,2,');
  });
});

describe('fileName', () => {
  it('names the file after the report, the tab and the day', () => {
    const at = href => fileName(new URL(href), '2026-10-09');
    expect(at('https://search.google.com/search-console/performance/search-analytics?resource_id=x&compare_date=PREV')).toBe('search-analytics-query-2026-10-09.csv');
    expect(at('https://search.google.com/u/1/search-console/performance/search-analytics/ai?breakdown=page')).toBe('search-analytics-ai-page-2026-10-09.csv');
    expect(at('https://search.google.com/search-console/performance/discover?breakdown=country')).toBe('discover-country-2026-10-09.csv');
  });
});

describe('ensureExportButton', () => {
  it('adds one Export with % button above the table', () => {
    buildPage();
    const onExport = vi.fn();
    ensureExportButton(document, findTable(document), onExport);
    ensureExportButton(document, findTable(document), onExport);
    const buttons = document.querySelectorAll('[data-scpc="toolbar"] button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].textContent).toBe('Export with %');
    expect(document.querySelector('[data-scpc="toolbar"]').nextElementSibling).toBe(document.querySelector('table').parentElement);
    buttons[0].click();
    expect(onExport).toHaveBeenCalledOnce();
  });
});

describe('download', () => {
  it('saves the CSV under its name', () => {
    URL.createObjectURL = vi.fn(() => 'blob:csv');
    URL.revokeObjectURL = vi.fn();
    const names = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      names.push(this.download);
    });
    download(document, 'a,b\r\n', 'x.csv');
    expect(names).toEqual(['x.csv']);
    expect(URL.createObjectURL.mock.calls[0][0].type).toBe('text/csv;charset=utf-8');
    expect(document.querySelector('a[download]')).toBeNull();
  });
});
