import { describe, it, expect, afterEach, vi } from 'vitest';
import { download, ensureExportButton, fileName, tableCsv } from '../src/csv.js';
import { findTable } from '../src/detect.js';
import { ES, buildPage } from './helpers/gsc.js';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('tableCsv', () => {
  it('has every column, exact numbers, and a % after each Difference', () => {
    buildPage({ metrics: ['CLICKS', 'POSITION'] });
    const lines = tableCsv(findTable(document)).split('\r\n');
    expect(lines[0]).toBe('﻿Top queries,Clicks Last 28 days,Clicks Previous 28 days,Clicks Difference,Clicks %,Position Last 28 days,Position Previous 28 days,Position Difference,Position %');
    expect(lines[1]).toBe('blue widgets,30,28,2,7.14,1.1,3.5,-2.4,-68.57');
    expect(lines[2]).toBe('"red widgets, cheap",3,0,3,new,9.7,8.9,0.8,8.99');
    expect(lines[3]).toBe('"widget ""pro""",0,0,0,0.00,12,12,0,0.00');
  });

  it('keeps Google\'s Spanish headers and machine-readable numbers', () => {
    buildPage({ lang: ES, metrics: ['IMPRESSIONS'] });
    const lines = tableCsv(findTable(document)).split('\r\n');
    expect(lines[0]).toBe('﻿Consultas principales,Impresiones Últimos 28 días,Impresiones 28 días anteriores,Impresiones Diferencia,Impresiones %');
    expect(lines[3]).toBe('"widget ""pro""",1423,2792,-1369,-49.03');
  });

  it('leaves a missing number empty instead of writing NaN', () => {
    buildPage({ metrics: ['CLICKS'] });
    document.querySelector('tbody tr').cells[2].removeAttribute('data-numeric-value');
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
