import { describe, it, expect } from 'vitest';
import { METRICS, cardLabel, change, tableLabel } from '../src/change.js';

const plain = s => s.replace(/[  ]/g, ' ');

describe('change', () => {
  it('knows the four metrics, in the cards\' order', () => {
    expect(METRICS).toEqual(['CLICKS', 'IMPRESSIONS', 'CTR', 'POSITION']);
  });

  it('gives the difference, the % and whether more is better', () => {
    const c = change('CLICKS', 30, 28);
    expect(c.diff).toBe(2);
    expect(c.pct).toBeCloseTo(7.142857, 5);
    expect(c).toMatchObject({ direction: 'up', tone: 'better' });
    expect(change('IMPRESSIONS', 35005, 66212)).toMatchObject({ diff: -31207, direction: 'down', tone: 'worse' });
  });

  it('treats a lower position as better', () => {
    expect(change('POSITION', 1.1, 3.5)).toMatchObject({ diff: -2.4, direction: 'down', tone: 'better' });
    expect(change('POSITION', 14.2, 13.2)).toMatchObject({ diff: 1, direction: 'up', tone: 'worse' });
  });

  it('calls it new when there was nothing before, and flat when nothing moved', () => {
    expect(change('CLICKS', 3, 0)).toEqual({ diff: 3, pct: null, direction: 'up', tone: 'new' });
    expect(change('CLICKS', 0, 0)).toEqual({ diff: 0, pct: null, direction: 'flat', tone: 'flat' });
    expect(change('CLICKS', 5, 5)).toMatchObject({ pct: 0, direction: 'flat', tone: 'flat' });
  });
});

describe('labels', () => {
  it('writes the table pill with the arrow of the number\'s sign', () => {
    expect(tableLabel(change('CLICKS', 30, 28), 'en')).toBe('▲ +7.1%');
    expect(tableLabel(change('POSITION', 1.1, 3.5), 'en')).toBe('▼ -68.6%');
    expect(plain(tableLabel(change('CLICKS', 30, 28), 'es'))).toBe('▲ +7,1 %');
    expect(tableLabel(change('CLICKS', 3, 0), 'en')).toBe('new');
    expect(tableLabel(change('CLICKS', 0, 0), 'en')).toBe('= 0%');
  });

  it('writes the card pill with the difference and the %', () => {
    expect(cardLabel('CLICKS', change('CLICKS', 248, 168), 'en')).toBe('▲ +80 · +47.6%');
    expect(cardLabel('IMPRESSIONS', change('IMPRESSIONS', 35005, 66212), 'en')).toBe('▼ -31,207 · -47.1%');
    expect(cardLabel('CTR', change('CTR', 0.7, 0.3), 'en')).toBe('▲ +0.4 pp · +133%');
    expect(cardLabel('POSITION', change('POSITION', 14.2, 13.2), 'en')).toBe('▲ +1.0 · +7.6%');
    expect(cardLabel('CLICKS', change('CLICKS', 3, 0), 'en')).toBe('▲ +3 · new');
  });
});
