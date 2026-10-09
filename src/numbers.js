// Numbers as Search Console writes them in the page's language, and as the extension writes them back.

// A <html lang> Intl doesn't accept ("en_US") would throw: such a page is read and written in English.
const format = (lang, options) => {
  try {
    return new Intl.NumberFormat(lang || 'en', options);
  } catch {
    return new Intl.NumberFormat('en', options);
  }
};
// Marks that right-to-left languages put around numbers and signs ("0.7\u200E%\u200E" in Arabic).
const BIDI = /[\u200E\u200F\u061C]/g;

// The group and decimal separators of the language Search Console set on <html lang>.
export function separators(lang) {
  const parts = format(lang).formatToParts(12345.6);
  return {
    group: parts.find(p => p.type === 'group')?.value ?? ',',
    decimal: parts.find(p => p.type === 'decimal')?.value ?? '.',
  };
}

// "35,005" (en), "35.005" and "0,7 %" (es), "1 423" (fr) → 35005, 35005, 0.7, 1423. NaN for words.
export function parseNumber(text, lang) {
  const { group, decimal } = separators(lang);
  let s = String(text ?? '').replace(BIDI, '').replace(/[\s%]/g, '').replace(/−/g, '-');
  if (!/\s/.test(group)) s = s.split(group).join('');
  s = s.split(decimal).join('.');
  return /^[+-]?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}

// A change in %, signed, with one decimal under 100 % (but not at 0) and none at 0 or from 100 on: "+7.1%", "+7,1 %", "+227%", "0%".
export function formatPercent(pct, lang) {
  const digits = pct === 0 || Math.abs(pct) >= 100 ? 0 : 1;
  return format(lang, {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    signDisplay: 'exceptZero',
  }).format(pct / 100);
}

// A difference in the metric's own unit: counts grouped ("+80", "-31,207"), CTR in percentage points
// ("+0.4 pp"), position with one decimal ("+1.0").
export function formatDifference(key, diff, lang) {
  if (key === 'CTR' || key === 'POSITION') {
    const text = format(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: 'exceptZero' }).format(diff);
    return key === 'CTR' ? `${text} pp` : text;
  }
  return format(lang, { maximumFractionDigits: 0, signDisplay: 'exceptZero', useGrouping: 'always' }).format(diff);
}

// A value as the metric reads: "1,423", "0.7%", "14,2".
export function formatValue(key, value, lang) {
  if (key === 'CTR') return format(lang, { style: 'percent', maximumFractionDigits: 1 }).format(value / 100);
  return format(lang, { maximumFractionDigits: 1, useGrouping: 'always' }).format(value);
}
