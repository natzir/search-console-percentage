// The comparison table as CSV: every row the page holds (not only the visible page of the table), the
// exact numbers from data-numeric-value, Google's own headers, and a % change after each Difference.
import { change, status } from './change.js';
import { agrees, numeric } from './detect.js';

const field = value => (/[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
const headerName = th => (th.getAttribute('data-name') ?? th.textContent).replace(/\s+/g, ' ').trim();
const metricName = th => (th.getAttribute('data-name') ?? th.textContent).split('\n')[0].trim();
// A text cell that starts like a formula would be run as one by Excel and Sheets: a query "+500 euros"
// or "=HYPERLINK(...)" gets a leading apostrophe, which the spreadsheet hides.
const safeText = text => (/^[=+\-@\t\r]/.test(text) ? `'${text}` : text);

export function tableCsv({ table, metrics }) {
  const head = [...table.tHead.rows[0].cells];
  const byDiff = new Map(metrics.map(m => [m.cols[2], m]));
  const header = [];
  head.forEach((th, i) => {
    header.push(headerName(th));
    if (byDiff.has(i)) header.push(`${metricName(head[byDiff.get(i).cols[0]])} % change`);
  });
  const rows = [...(table.tBodies[0]?.rows ?? [])].map(row => {
    const out = [];
    [...row.cells].forEach((cell, i) => {
      if (cell.hasAttribute('data-column-toggle-label')) {
        const value = numeric(cell);
        out.push(Number.isNaN(value) ? '' : String(value));
      } else {
        out.push(safeText(cell.textContent.replace(/\s+/g, ' ').trim()));
      }
      const metric = byDiff.get(i);
      if (metric) {
        const [last, previous, difference] = metric.cols.map(c => numeric(row.cells[c]));
        if (Number.isNaN(last) || Number.isNaN(previous) || !agrees(metric.key, last, previous, difference)) {
          out.push('');
        } else {
          const c = change(metric.key, last, previous);
          out.push(status(c) ?? (c.pct ?? 0).toFixed(2));
        }
      }
    });
    return out;
  });
  return `﻿${[header, ...rows].map(r => r.map(field).join(',')).join('\r\n')}\r\n`;
}

// search-analytics-query-2026-10-09.csv: the report's path after /performance/, the tab, the day.
export function fileName(url, today = new Date().toISOString().slice(0, 10)) {
  const parts = url.pathname.split('/').filter(Boolean);
  const report = parts.slice(parts.indexOf('performance') + 1).join('-') || 'performance';
  return `${report}-${url.searchParams.get('breakdown') || 'query'}-${today}.csv`;
}

export function ensureExportButton(doc, { table }, onExport) {
  const wrap = table.parentElement;
  let bar = wrap.parentElement.querySelector(':scope > [data-scpc="toolbar"]');
  if (!bar) {
    bar = doc.createElement('div');
    bar.setAttribute('data-scpc', 'toolbar');
    bar.className = 'scpc-toolbar';
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'scpc-export';
    button.textContent = 'Export with %';
    button.addEventListener('click', () => onExport());
    bar.append(button);
    wrap.before(bar);
  }
  return bar;
}

export function download(doc, csv, name) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = doc.createElement('a');
  link.href = url;
  link.download = name;
  link.setAttribute('data-scpc', 'download');
  doc.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
