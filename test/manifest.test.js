// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const manifest = read('../extension/manifest.json');
const pkg = read('../package.json');

describe('manifest', () => {
  it('asks only for storage, and runs on Search Console', () => {
    expect(manifest.permissions).toEqual(['storage']);
    expect(manifest.host_permissions).toBeUndefined();
    expect(manifest.content_scripts).toEqual([{
      matches: ['https://search.google.com/search-console*', 'https://search.google.com/u/*/search-console*'],
      js: ['content.js'],
      css: ['content.css'],
      run_at: 'document_idle',
    }]);
  });

  it('has the store name, a description that fits and the package\'s version', () => {
    expect(manifest.name).toBe('Search Console Percentage Calculator by Natzir');
    expect(manifest.description.length).toBeLessThanOrEqual(132);
    expect(manifest.version).toBe('1.0.1');
    expect(pkg.version).toBe(manifest.version);
  });

  it('has no popup, so the icon click reaches the tab', () => {
    expect(manifest.action.default_popup).toBeUndefined();
    expect(manifest.background).toEqual({ service_worker: 'background.js' });
  });

  it('points at icons that exist, and needs Chrome 120', () => {
    for (const path of [...Object.values(manifest.icons), ...Object.values(manifest.action.default_icon)]) {
      expect(existsSync(new URL(`../extension/${path}`, import.meta.url))).toBe(true);
    }
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.minimum_chrome_version).toBe('120');
  });
});
