/* global window, URL */
/*
 * The old address's redirect (0.5.0, G-110; docs/RELEASING.md "Renaming the repository").
 * GitHub Pages does not redirect a renamed repository's project site, so after the rename to
 * SMBC-Remix a small `SMBC` repository serves this folder at the old address. Every page there
 * (index.html, and 404.html for any other path) loads this script, which sends the visitor to the
 * game at the new address, keeping the query (`?dev=1&level=1-1`) and the hash (`#save=...`
 * resume links, `#level=...` shared levels). The game is one page, so any old path lands on it.
 *
 * Saves are kept: both addresses are on the same origin (jelloshooter848.github.io), and the
 * browser keeps saves per origin, not per path.
 */
(function (root) {
  'use strict';
  var TO = 'https://jelloshooter848.github.io/SMBC-Remix/';

  /** The new address for an old one: the game's page, with the old query and hash. */
  function smbcRedirectTarget(href) {
    var u = new URL(href);
    return TO + u.search + u.hash;
  }

  root.smbcRedirectTarget = smbcRedirectTarget;
  if (root.location && root.document) root.location.replace(smbcRedirectTarget(root.location.href));
})(typeof window !== 'undefined' ? window : globalThis);
