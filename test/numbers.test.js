import { describe, it, expect } from 'vitest';
import { formatDifference, formatPercent, formatValue, parseNumber, separators } from '../src/numbers.js';

const plain = s => s.replace(/[  ]/g, ' ');

describe('separators', () => {
  it('follows the page language', () => {
    expect(separators('en')).toEqual({ group: ',', decimal: '.' });
    expect(separators('es')).toEqual({ group: '.', decimal: ',' });
  });
});

describe('parseNumber', () => {
  it('reads numbers as Search Console writes them in English', () => {
    expect(parseNumber('35,005', 'en')).toBe(35005);
    expect(parseNumber('12.8', 'en')).toBe(12.8);
    expect(parseNumber('0.7%', 'en')).toBe(0.7);
    expect(parseNumber('-764', 'en')).toBe(-764);
  });

  it('reads them in Spanish and French', () => {
    expect(parseNumber('35.005', 'es')).toBe(35005);
    expect(parseNumber('1.423', 'es')).toBe(1423);
    expect(parseNumber('0,7 %', 'es')).toBe(0.7);
    expect(parseNumber('14,2', 'es')).toBe(14.2);
    expect(parseNumber('1 423', 'fr')).toBe(1423);
  });

  it('gives NaN for words', () => {
    expect(parseNumber('Last 28 days', 'en')).toBeNaN();
    expect(parseNumber('28 días anteriores', 'es')).toBeNaN();
    expect(parseNumber('', 'en')).toBeNaN();
  });
});

describe('formatPercent', () => {
  it('signs it, with one decimal under 100 % and none from there', () => {
    expect(formatPercent(7.142857, 'en')).toBe('+7.1%');
    expect(formatPercent(-68.571, 'en')).toBe('-68.6%');
    expect(formatPercent(227.27, 'en')).toBe('+227%');
    expect(plain(formatPercent(7.142857, 'es'))).toBe('+7,1 %');
    expect(formatPercent(0, 'en')).toBe('0%');
  });
});

describe('formatDifference', () => {
  it('groups counts, gives CTR in points and position with one decimal', () => {
    expect(formatDifference('CLICKS', 80, 'en')).toBe('+80');
    expect(formatDifference('IMPRESSIONS', -31207, 'en')).toBe('-31,207');
    expect(formatDifference('IMPRESSIONS', -31207, 'es')).toBe('-31.207');
    expect(formatDifference('CTR', 0.4, 'en')).toBe('+0.4 pp');
    expect(formatDifference('POSITION', 1, 'en')).toBe('+1.0');
  });
});

describe('formatValue', () => {
  it('writes a value the way the metric reads', () => {
    expect(formatValue('IMPRESSIONS', 1423, 'en')).toBe('1,423');
    expect(formatValue('CTR', 0.7, 'en')).toBe('0.7%');
    expect(formatValue('POSITION', 14.2, 'es')).toBe('14,2');
  });
});
