// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { artPixel, iconPixel } from '../scripts/make-icons.mjs';

const TILE = [23, 34, 36, 255];
const GREEN = [52, 168, 83, 255];
const RED = [234, 67, 53, 255];

describe('icon', () => {
  it('is the dark tools tile with bars: green up, red down', () => {
    expect(artPixel(0, 0, 128)[3]).toBe(0);
    expect(artPixel(64, 6, 128)).toEqual(TILE);
    expect(artPixel(30, 50, 128)).toEqual(GREEN);
    expect(artPixel(54, 90, 128)).toEqual(RED);
    expect(artPixel(102, 40, 128)).toEqual(GREEN);
  });

  it('keeps the bars readable at 16 px', () => {
    expect(artPixel(12, 4, 16)).toEqual(GREEN);
  });

  it('gives the 128 px store icon 16 px of transparent padding', () => {
    expect(iconPixel(8, 64, 128)).toEqual([0, 0, 0, 0]);
    expect(iconPixel(64, 20, 128)).toEqual(artPixel(48, 4, 96));
    expect(iconPixel(8, 1, 16)).toEqual(artPixel(8, 1, 16));
  });
});
