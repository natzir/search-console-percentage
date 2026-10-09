import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const file = name => `${import.meta.dirname}/../extension/${name}`;
const doc = new DOMParser().parseFromString(readFileSync(file('welcome.html'), 'utf8'), 'text/html');
const text = doc.body.textContent.replace(/\s+/g, ' ');

describe('welcome page', () => {
  it('says what to pin by the store name and how to start comparing', () => {
    expect(text).toContain('“Search Console Percentage Calculator by Natzir”');
    expect(text).toContain('Compare');
  });

  it('links GitHub and natzir.com', () => {
    expect([...doc.querySelectorAll('a')].map(a => a.getAttribute('href'))).toEqual([
      'https://github.com/natzir/search-console-percentage#readme',
      'https://natzir.com',
    ]);
  });

  it('loads only files the extension has, and no script', () => {
    const local = [...doc.querySelectorAll('link[href], img[src]')].map(el => el.getAttribute('href') ?? el.getAttribute('src'));
    expect(local).toEqual(['tokens.css', 'welcome.css', 'icons/32.png']);
    for (const name of local) expect(existsSync(file(name))).toBe(true);
    expect(doc.querySelector('script')).toBeNull();
  });
});
