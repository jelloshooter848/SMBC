/* global self, caches, fetch, Request, URL */
/*
 * SMBC REMIX's service worker (0.4.44): offline play from the Home Screen. The build
 * (tools/pwa/plugin.ts) fills in the release's VERSION and FILES (every file it wrote, relative
 * to the site's base path) and writes this out as sw.js. It is never registered by `pnpm dev`
 * or in Vitest.
 *
 * - install: caches every file of this release (bypassing the HTTP cache);
 * - activate: drops the caches of older releases;
 * - fetch: answers from this release's cache, else the network; a page load (any ?level= or
 *   #hash) gets the cached index.html;
 * - a new release waits until the page says SKIP_WAITING (the title's UPDATE READY notice), or
 *   until every window of the old one is closed.
 */
const VERSION = '__SW_VERSION__';
const FILES = /* __SW_FILES__ */ [];

const PREFIX = 'smbc-';
const CACHE = PREFIX + VERSION;
const SCOPE = self.registration.scope;
const INDEX = new URL('index.html', SCOPE).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll(FILES.map((f) => new Request(new URL(f, SCOPE).href, { cache: 'reload' }))),
      ),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))),
      ),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || !req.url.startsWith(SCOPE)) return;
  // The game's page (the base path or index.html, with any query) is the cached index.html.
  const path = req.url.split(/[?#]/)[0];
  const page = req.mode === 'navigate' && (path === SCOPE || path === INDEX);
  event.respondWith(
    caches
      .open(CACHE)
      .then((cache) => cache.match(page ? INDEX : req.url))
      .then((hit) => hit || fetch(req)),
  );
});
