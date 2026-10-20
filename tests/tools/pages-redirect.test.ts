import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

// G-110 (0.5.0): after the repository rename to SMBC-Remix, a small `SMBC` repository serves
// tools/pages-redirect/ at the old address, so old links, resume links (#save=) and installed apps
// still reach the game. docs/RELEASING.md "Renaming the repository" has the steps.

const DIR = 'tools/pages-redirect/';
const read = (f: string) => readFileSync(DIR + f, 'utf8');

/** Runs redirect.js with `href` as the page's address; returns where it sent the page. */
function redirect(href: string): { to: string | null; target: (h: string) => string } {
  const root: Record<string, unknown> = {};
  let to: string | null = null;
  root.location = { href, replace: (u: string) => void (to = u) };
  root.document = {};
  new Function('window', 'globalThis', read('redirect.js'))(root, root);
  return { to, target: root.smbcRedirectTarget as (h: string) => string };
}

const NEW = 'https://jelloshooter848.github.io/SMBC-Remix/';

describe('G-110: the /SMBC/ redirect stub', () => {
  it('sends the old address to the new one', () => {
    expect(redirect('https://jelloshooter848.github.io/SMBC/').to).toBe(NEW);
  });

  it('keeps a resume link (#save=) and a shared level (#level=) whole', () => {
    expect(redirect('https://jelloshooter848.github.io/SMBC/#save=K7MD4-P2QJ9-ABCDE').to).toBe(
      `${NEW}#save=K7MD4-P2QJ9-ABCDE`,
    );
    expect(redirect('https://jelloshooter848.github.io/SMBC/#level=eJxLz8nPS1Uoyy8tKk5V').to).toBe(
      `${NEW}#level=eJxLz8nPS1Uoyy8tKk5V`,
    );
  });

  it('keeps the query (dev starts) and lands any old path on the game', () => {
    expect(redirect('https://jelloshooter848.github.io/SMBC/?dev=1&level=1-1&char=link').to).toBe(
      `${NEW}?dev=1&level=1-1&char=link`,
    );
    expect(redirect('https://jelloshooter848.github.io/SMBC/index.html#save=AB').to).toBe(`${NEW}#save=AB`);
    expect(redirect('https://jelloshooter848.github.io/SMBC/assets/index-abc.js').to).toBe(NEW);
    expect(redirect('https://jelloshooter848.github.io/SMBC/a/b/c?dev=1#save=AB').to).toBe(
      `${NEW}?dev=1#save=AB`,
    );
  });

  it('stays on the same origin, so the saves (kept per origin) come along', () => {
    const to = new URL(redirect('https://jelloshooter848.github.io/SMBC/#save=AB').to as string);
    expect(to.origin).toBe('https://jelloshooter848.github.io');
    expect(to.pathname).toBe('/SMBC-Remix/');
  });

  it('index.html and 404.html are the same page and both load redirect.js, with a link for no-script', () => {
    const index = read('index.html');
    expect(read('404.html')).toBe(index);
    // An absolute path: 404.html answers any depth (/SMBC/a/b), where a relative one would miss.
    expect(index).toContain('<script src="/SMBC/redirect.js"></script>');
    const src = /<script src="([^"]+)"/.exec(index)?.[1] as string;
    for (const page of [
      'https://jelloshooter848.github.io/SMBC/',
      'https://jelloshooter848.github.io/SMBC/a/b/c',
    ])
      expect(new URL(src, page).href).toBe('https://jelloshooter848.github.io/SMBC/redirect.js');
    expect(index).toContain(`href="${NEW}"`);
    expect(index).toContain(`url=${NEW}`);
    expect(index).toContain('Your saves are kept.');
  });

  it("retires the old address's service worker: it takes over, unregisters and reloads its windows", async () => {
    const handlers: Record<string, (e: { waitUntil: (p: Promise<unknown>) => void }) => void> = {};
    const navigated: string[] = [];
    const self = {
      addEventListener: (t: string, f: (typeof handlers)[string]) => void (handlers[t] = f),
      skipWaiting: vi.fn(),
      registration: { unregister: vi.fn(async () => true) },
    };
    const clients = {
      matchAll: async () => [
        {
          url: 'https://jelloshooter848.github.io/SMBC/#save=AB',
          navigate: async (u: string) => void navigated.push(u),
        },
      ],
    };
    new Function('self', 'clients', read('sw.js'))(self, clients);
    handlers.install?.({ waitUntil: () => undefined });
    expect(self.skipWaiting).toHaveBeenCalled();
    let done: Promise<unknown> = Promise.resolve();
    handlers.activate?.({ waitUntil: (p) => void (done = p) });
    await done;
    expect(self.registration.unregister).toHaveBeenCalled();
    expect(navigated).toEqual(['https://jelloshooter848.github.io/SMBC/#save=AB']);
    // It deletes no cache (the new address shares the origin's caches).
    expect(read('sw.js')).not.toMatch(/caches\.delete/);
  });
});
