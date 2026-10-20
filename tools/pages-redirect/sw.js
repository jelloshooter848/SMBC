/* global self, clients */
/*
 * The old address's service worker, retired (0.5.0, G-110). A phone or browser that installed the
 * game at /SMBC/ before the rename keeps its old service worker, which would go on serving the old
 * build from its cache. When it checks for an update it fetches /SMBC/sw.js, now this file: it
 * takes over at once, unregisters itself and reloads every open window, which then gets the
 * redirect page (redirect.js) and goes on to the new address.
 *
 * It deletes no cache: caches belong to the whole origin, which the new address shares, and the
 * new site's own service worker drops the old release's cache when it starts (tools/pwa/sw.js).
 */
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.registration
      .unregister()
      .then(() => clients.matchAll({ type: 'window' }))
      .then((windows) => Promise.all(windows.map((w) => w.navigate(w.url)))),
  );
});
