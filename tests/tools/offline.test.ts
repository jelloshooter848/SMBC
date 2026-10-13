import { describe, expect, it } from 'vitest';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { inlineHtml, offlineReadme } from '../../tools/offline/plugin';

// The download build (0.4.49, `pnpm build:offline`): one index.html that plays from the disk
// (file://), with every script, style and picture inside it.

/** The page without the text of its scripts and styles. */
function markup(html: string): string {
  return html.replace(/(<(script|style)\b[^>]*>)[\s\S]*?<\/\2>/gi, '$1</$2>');
}

/**
 * Every src= and href= in the tags of `html` (not inside a script or a style) that points at
 * another file: not a data: URL or a #fragment.
 */
function externalRefs(html: string): string[] {
  return [...markup(html).matchAll(/<[^>]*>/g)]
    .flatMap((tag) => [...tag[0].matchAll(/\b(?:src|href)\s*=\s*["']?([^"'\s>]+)/gi)])
    .map((m) => m[1] as string)
    .filter((u) => !/^data:/i.test(u) && !u.startsWith('#'));
}

describe('inlineHtml', () => {
  const page = [
    '<html><head>',
    '<link rel="icon" href="favicon.svg" type="image/svg+xml" />',
    '<script type="module" crossorigin src="./assets/index-abc.js"></script>',
    '<link rel="stylesheet" crossorigin href="./assets/index-abc.css">',
    '<link rel="modulepreload" crossorigin href="./assets/dep-abc.js">',
    '</head><body><script>var inline = 1;</script></body></html>',
  ].join('\n');

  it('puts the script and the style inside the page and drops preloads', () => {
    const out = inlineHtml(page, {
      scripts: { 'assets/index-abc.js': 'console.log("game")' },
      styles: { 'assets/index-abc.css': 'body{color:red}' },
      favicon: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
    });
    expect(out).toContain('<script type="module">console.log("game")</script>');
    expect(out).toContain('<style>body{color:red}</style>');
    expect(out).not.toMatch(/modulepreload/);
    expect(out).toContain('<script>var inline = 1;</script>'); // the page's own scripts stay
    expect(externalRefs(out)).toEqual([]);
    expect(out).toMatch(/<link rel="icon" href="data:image\/svg\+xml,[^"]+"/);
  });

  it('keeps a script that says </script> or <!-- from ending the tag early', () => {
    const out = inlineHtml(page, {
      scripts: { 'assets/index-abc.js': 'const a = "</script>"; const b = "<!--";' },
      styles: { 'assets/index-abc.css': '' },
    });
    const body = /<script type="module">([\s\S]*?)<\/script>/.exec(out)?.[1];
    expect(body).toBe('const a = "<\\/script>"; const b = "<\\!--";');
  });

  it('fails loudly when a referenced file is missing', () => {
    expect(() => inlineHtml(page, { scripts: {}, styles: {} })).toThrow(/index-abc\.js/);
  });
});

describe('the README.txt beside it', () => {
  it('names the version, says double-click index.html and how to carry saves over', () => {
    const text = offlineReadme('1.2.3');
    expect(text).toContain('1.2.3');
    expect(text).toMatch(/double-click index\.html/i);
    expect(text).toMatch(/Options > Save files > COPY CODE/);
    expect(text).toMatch(/PASTE CODE/);
    expect(text).toContain('Tested in Chrome. Should work in Edge, Firefox and Safari.');
    expect(text).not.toMatch(/\r/); // the template's line ends are made \r\n by the plugin
  });
});

describe('pnpm build:offline', () => {
  it('writes one self-contained index.html (and README.txt), with no other file', async () => {
    const out = mkdtempSync(join(tmpdir(), 'smbc-offline-'));
    try {
      await build({
        configFile: fileURLToPath(new URL('../../vite.config.ts', import.meta.url)),
        mode: 'offline',
        logLevel: 'silent',
        build: { outDir: out, emptyOutDir: true },
      });
      expect(readdirSync(out).sort()).toEqual(['README.txt', 'index.html']);
      const html = readFileSync(join(out, 'index.html'), 'utf8');
      expect(externalRefs(html)).toEqual([]);
      expect(html).not.toMatch(/<script[^>]*\bsrc=/i);
      expect(html).not.toMatch(/<link[^>]*rel=["']?(stylesheet|modulepreload|manifest|apple-touch-icon)/i);
      expect(markup(html)).not.toMatch(/sw\.js|webmanifest|apple-touch-icon/);
      // The game is in there: the boot reporter, then the whole bundle as one inline module.
      const modules = [...html.matchAll(/<script type="module">/g)];
      expect(modules).toHaveLength(1);
      expect(html.length).toBeGreaterThan(1_000_000);
      expect(readFileSync(join(out, 'README.txt'), 'utf8')).toMatch(/double-click index\.html/i);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  }, 120_000);
});
