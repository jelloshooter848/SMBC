import type { Renderer } from '@engine/gfx/renderer';
import type { View } from '../entity';

/**
 * The prompt over someone a player can talk to (a captive hero, a partner): the ability and, with
 * keys or a pad, the key ("TALK (UP)"; on touch "TALK", which is also its button), on a black strip
 * so it reads over any sky (0.4.35: it was a bare TALK and an up arrow). `cx` is its centre, `top`
 * the speaker's top (screen px).
 */
export function drawTalkPrompt(r: Renderer, view: View, verb: string, cx: number, top: number): void {
  const text = view.talkHint?.(verb) ?? verb;
  const font = view.assets.sheet('font');
  const w = text.length * 8;
  const x = Math.round(cx - w / 2);
  const y = Math.max(1, top - 12);
  r.rect(x - 2, y - 1, w + 4, 10, '#000');
  r.text(font, text, x, y);
}
