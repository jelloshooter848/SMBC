/**
 * The game's public site (named in README.md and the download's README.txt). Links a player
 * shares (save codes' resume links, the level editor's SHARE) are made on this page's address;
 * the downloaded copy (0.4.49) runs from file://, which a friend can't open, so its links point
 * here instead.
 */
export const SITE_URL = 'https://jelloshooter848.github.io/SMBC/';

/**
 * The address to make a shared link from: this page's (`href`) on the web, else the public site
 * (a file:// page, or anything that is not http(s), such as an opaque `null` origin).
 */
export function shareBase(href: string): string {
  try {
    const { protocol } = new URL(href);
    if (protocol === 'https:' || protocol === 'http:') return href;
  } catch {
    // not an absolute address
  }
  return SITE_URL;
}
