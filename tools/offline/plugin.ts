/*
 * The download build (0.4.49, `pnpm build:offline`, docs/RELEASING.md): one index.html that plays
 * from the disk. Players unzip smbc-vX.Y.Z-offline.zip and double-click index.html; the browser
 * opens it as file://, where a page may not load other files as scripts (module scripts need
 * CORS, which file:// has not), so everything goes inside the page:
 * - the game's script, as one inline module (inline modules fetch nothing, so they run from disk);
 * - any stylesheet, as a <style>;
 * - the favicon, as a data: URL.
 * The art, music and levels are already in the script (pixel arrays, MML and level text). There
 * is no service worker, manifest or Home Screen icon in this build (vite.config.ts leaves the PWA
 * plugin out). A README.txt goes beside the page.
 */
import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';

export interface InlineFiles {
  /** The build's scripts by file name (assets/index-abc.js). */
  scripts: Readonly<Record<string, string>>;
  /** The build's stylesheets by file name. */
  styles: Readonly<Record<string, string>>;
  /** The favicon's SVG text, made a data: URL (the icon link is dropped without it). */
  favicon?: string;
}

/** A src or href from the page (./assets/x.js, /assets/x.js, assets/x.js) as a bundle file name. */
function fileName(ref: string): string {
  return ref.replace(/^(\.\/|\/)+/, '').replace(/[?#].*$/, '');
}

function attr(tag: string, name: string): string | null {
  return new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(tag)?.[1] ?? null;
}

/**
 * Text that may go between <script> and </script>: a `</script` (any case) or `<!--` in the
 * code would end or confuse the tag, so their characters are escaped (`<\/script`, `<\!--`),
 * which reads the same inside a JavaScript string, template or regular expression.
 */
export function scriptSafe(code: string): string {
  return code.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
}

function lookup(files: Readonly<Record<string, string>>, ref: string): string {
  const text = files[fileName(ref)];
  if (text === undefined) throw new Error(`offline build: ${ref} is not in the bundle`);
  return text;
}

/** `html` with every script and stylesheet it links put inside it, and no preload links. */
export function inlineHtml(html: string, files: InlineFiles): string {
  // Replacer functions throughout: the code is full of `$` that a replacement string would expand.
  return html
    .replace(
      /<script\b([^>]*)\bsrc\s*=\s*["']([^"']+)["']([^>]*)>\s*<\/script>/gi,
      (tag, _a, src: string) => {
        const type = attr(tag, 'type');
        const open = type ? `<script type="${type}">` : '<script>';
        return `${open}${scriptSafe(lookup(files.scripts, src))}</script>`;
      },
    )
    .replace(/<link\b[^>]*>/gi, (tag) => {
      const rel = (attr(tag, 'rel') ?? '').toLowerCase();
      const href = attr(tag, 'href') ?? '';
      if (rel === 'stylesheet')
        return `<style>${lookup(files.styles, href).replace(/<\/(style)/gi, '<\\/$1')}</style>`;
      if (rel === 'modulepreload' || rel === 'preload' || rel === 'prefetch') return '';
      if (rel === 'icon' && !/^data:/i.test(href)) {
        if (!files.favicon) return '';
        const data = `data:image/svg+xml,${encodeURIComponent(files.favicon.trim())}`;
        return `<link rel="icon" href="${data}" type="image/svg+xml" />`;
      }
      return tag;
    });
}

const README_TEMPLATE = new URL('./README.txt', import.meta.url);

/** README.txt for the download of release `version` (\n line ends; the plugin writes \r\n). */
export function offlineReadme(version: string): string {
  return readFileSync(README_TEMPLATE, 'utf8').replace(/\r\n/g, '\n').replaceAll('{{VERSION}}', version);
}

export interface OfflineOptions {
  /** The version shown on the title, named in README.txt. */
  version: string;
  /** Path of the SVG favicon to inline (public/favicon.svg). */
  favicon?: string;
}

/** Turns the build into index.html (everything inside it) plus README.txt. Build only. */
export function offlinePlugin(opts: OfflineOptions): Plugin {
  return {
    name: 'smbc:offline-single-file',
    apply: 'build',
    enforce: 'post',
    generateBundle: {
      order: 'post',
      handler(_out, bundle) {
        const page = bundle['index.html'];
        if (!page || page.type !== 'asset') throw new Error('offline build: no index.html in the bundle');
        const scripts: Record<string, string> = {};
        const styles: Record<string, string> = {};
        for (const [name, item] of Object.entries(bundle)) {
          if (item.type === 'chunk') scripts[name] = item.code;
          else if (name.endsWith('.css')) styles[name] = String(item.source);
        }
        const favicon = opts.favicon ? readFileSync(opts.favicon, 'utf8') : undefined;
        page.source = inlineHtml(String(page.source), {
          scripts,
          styles,
          ...(favicon ? { favicon } : {}),
        });
        // Everything else is inside the page now: one file to ship.
        for (const name of Object.keys(bundle)) if (name !== 'index.html') delete bundle[name];
        this.emitFile({
          type: 'asset',
          fileName: 'README.txt',
          source: offlineReadme(opts.version).replace(/\n/g, '\r\n'),
        });
      },
    },
  };
}
