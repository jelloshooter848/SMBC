import type { Renderer } from '@engine/gfx/renderer';
import { SCREEN_W } from '@engine/viewport';
import type { View } from '../entity';

/**
 * The prompt over someone a player can talk to (a captive hero, a partner): the ability and, with
 * keys or a pad, the TALK button's key ("TALK (C)"; on touch "TALK", its caption), on a black strip
 * so it reads over any sky (0.4.35: it was a bare TALK and an up arrow). `cx` is its centre, `top`
 * the speaker's top (screen px).
 */
export function drawTalkPrompt(
  r: Renderer,
  view: View,
  verb: string,
  cx: number,
  top: number,
  /**
   * Which key the hint names (0.4.52): the TALK button's (`special`, default), up's (an open
   * door: "UP"), or none (LOCKED: a word, not an action).
   */
  key: 'special' | 'up' | 'none' = 'special',
): void {
  const hint = key === 'special' ? view.talkHint : key === 'up' ? view.upHint : undefined;
  const text = hint?.(verb) ?? verb;
  const font = view.assets.sheet('font');
  const w = text.length * 8;
  // Kept on the screen (a key by the room's right wall: its strip would run off it).
  const x = Math.max(2, Math.min(SCREEN_W - 2 - w, Math.round(cx - w / 2)));
  const y = Math.max(1, top - 12);
  r.rect(x - 2, y - 1, w + 4, 10, '#000');
  r.text(font, text, x, y);
}
