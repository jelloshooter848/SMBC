import { encodeSaveCode, saveLink, shareText } from './save-code';
import type { SaveFile } from './save-files';

/*
 * Sharing and copying a save code, and reading one from the clipboard: the browser's share sheet
 * and clipboard, feature-detected here (navigator.share, navigator.clipboard, then the old
 * execCommand copy), behind a small interface so tests and other hosts can stand in for them.
 */

export interface ShareEnv {
  /** The share sheet (navigator.share), when the browser has one. */
  share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
  /** Writes text to the clipboard; false when the browser refused. */
  copy?: (text: string) => Promise<boolean>;
  /** Reads text from the clipboard (null when refused or not offered). */
  read?: () => Promise<string | null>;
  /** The page's address (resume links are made from it). */
  href: string;
}

/** The browser's share sheet and clipboard, whatever of them it has. */
export function browserShareEnv(): ShareEnv {
  const nav = typeof navigator === 'undefined' ? undefined : navigator;
  const env: ShareEnv = { href: typeof location === 'undefined' ? 'https://localhost/' : location.href };
  if (nav && typeof nav.share === 'function') env.share = (data) => nav.share(data);
  env.copy = async (text) => {
    try {
      if (nav?.clipboard && typeof nav.clipboard.writeText === 'function') {
        await nav.clipboard.writeText(text);
        return true;
      }
    } catch {
      // not allowed (no focus, an insecure page): try the old way
    }
    return execCopy(text);
  };
  if (nav?.clipboard && typeof nav.clipboard.readText === 'function')
    env.read = async () => {
      try {
        return await nav.clipboard.readText();
      } catch {
        return null;
      }
    };
  return env;
}

/** The pre-Clipboard-API copy: a hidden text box, selected, and the copy command. */
function execCopy(text: string): boolean {
  if (typeof document === 'undefined') return false;
  const box = document.createElement('textarea');
  box.value = text;
  box.setAttribute('readonly', '');
  box.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px;';
  document.body.appendChild(box);
  box.select();
  box.setSelectionRange(0, text.length);
  let ok: boolean;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  box.remove();
  return ok;
}

/**
 * What sharing did: the share sheet took it ('shared'), the player closed the sheet
 * ('cancelled'), there was no sheet so the link was copied instead ('copied'), or nothing worked
 * ('failed': the code is on screen to copy by hand).
 */
export type ShareOutcome = 'shared' | 'cancelled' | 'copied' | 'failed';

/** SHARE SAVE: the share sheet with the resume link and a summary line; no sheet, the link copied. */
export async function shareSave(save: SaveFile, env: ShareEnv): Promise<ShareOutcome> {
  const link = saveLink(encodeSaveCode(save), env.href);
  if (env.share) {
    try {
      // One line of text with the link in it: every share target keeps text (some drop `url`).
      await env.share({ title: 'SMBC REMIX save', text: shareText(save, link) });
      return 'shared';
    } catch (e) {
      // The player closed the sheet; any other failure falls back to copying.
      if ((e as { name?: string })?.name === 'AbortError') return 'cancelled';
    }
  }
  return (await env.copy?.(link)) ? 'copied' : 'failed';
}

/** COPY CODE: the code on the clipboard. */
export async function copyCode(save: SaveFile, env: ShareEnv): Promise<boolean> {
  return (await env.copy?.(encodeSaveCode(save))) ?? false;
}

/** What the screen says after sharing (font text, at most 28 characters). */
export const SHARE_STATUS: Readonly<Record<ShareOutcome, string>> = {
  shared: 'SAVE SHARED',
  cancelled: 'SHARE CANCELLED',
  copied: 'NO SHARE SHEET: LINK COPIED',
  failed: 'COPY FAILED',
};
export const COPY_STATUS = { ok: 'CODE COPIED', failed: 'COPY FAILED' } as const;
