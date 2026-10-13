import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { SITE_URL, shareBase } from './site';
import { levelLink } from './share';

// A link the player shares is never a file:// or null/... address (0.4.49): the downloaded copy
// (file://) makes its links on the public site instead, so a friend's link opens the real game.

describe('shareBase', () => {
  it('the website: this page', () => {
    expect(shareBase('https://jelloshooter848.github.io/SMBC/?dev=1')).toBe(
      'https://jelloshooter848.github.io/SMBC/?dev=1',
    );
    expect(shareBase('http://localhost:5173/')).toBe('http://localhost:5173/');
  });

  it('the download (file://, on Linux, macOS or Windows), or no real address: the public site', () => {
    for (const href of [
      'file:///home/me/smbc-v0.4.49-offline/index.html',
      'file:///C:/Users/me/Downloads/smbc-v0.4.49-offline/index.html?x=1#save=AB',
      'about:blank',
      'null/home/me/index.html',
      '',
    ])
      expect(shareBase(href), href).toBe(SITE_URL);
  });

  it('is the address the README and the download README name', () => {
    expect(SITE_URL).toMatch(/^https:\/\/[^/]+\/.*\/$/);
    expect(readFileSync(new URL('../../README.md', import.meta.url), 'utf8')).toContain(SITE_URL);
    expect(readFileSync(new URL('../../tools/offline/README.txt', import.meta.url), 'utf8')).toContain(
      SITE_URL,
    );
  });
});

describe('levelLink (Level editor > SHARE)', () => {
  it('this page with #level=, without its query or hash', () => {
    expect(levelLink('zABC', 'https://example.com/SMBC/index.html?dev=1#save=X')).toBe(
      'https://example.com/SMBC/index.html#level=zABC',
    );
  });

  it('from the download: on the public site, never file:// or null/', () => {
    const link = levelLink('zABC', 'file:///C:/Users/me/smbc/index.html');
    expect(link).toBe(`${SITE_URL}#level=zABC`);
    expect(link).not.toMatch(/^(file:|null)/);
  });
});
