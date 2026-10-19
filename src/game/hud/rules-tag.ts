import type { Renderer } from '@engine/gfx/renderer';
import type { AssetRegistry } from '@engine/assets/registry';
import type { CharacterDef } from '../characters/character';
import type { Rules } from '../context';
import { fxPalette } from '@content/sprites/palette-fx';

/**
 * The Classic rules tag (TG-31, TG-32) at the top right, under TIME and its digits (200, 8-23),
 * clear of the screen's top edge and of every HUD line: CLASSIC while every hero plays a Classic def, CLASSIC? at x 188 while any hero has
 * no Classic def yet and plays Current (TG-20). Nothing under Current rules.
 */
export function rulesTag(rules: Rules, heroes: readonly CharacterDef[]): string | null {
  if (rules !== 'classic') return null;
  return heroes.every((d) => d.rules === 'classic') ? 'CLASSIC' : 'CLASSIC?';
}

/**
 * The tag's top: under TIME's digits (y 16-23) with a few px between, the right of the HUD's third
 * row being empty for one player (the hearts, meters and tool belt end left of x 150; an SMB3
 * piece's status is at the bottom). Co-op's player-two lines take that row (its name and power at
 * 144-192, y 24-39, OUT at 200, 24), so with two heroes the tag goes under them.
 */
export const RULES_TAG_Y = 28;
export const RULES_TAG_Y_COOP = 42;

/** The tag's top for `players` heroes. */
export function rulesTagY(players: number): number {
  return players > 1 ? RULES_TAG_Y_COOP : RULES_TAG_Y;
}

/** The tag's x: CLASSIC at 196, CLASSIC? at 188 (the font's 8-px cells, ending at 252). */
export function rulesTagX(tag: string): number {
  return tag.endsWith('?') ? 188 : 196;
}

/** The dark outline's offsets (as the HUD's outlined text): once each way, under the letters. */
const OUTLINE: readonly (readonly [number, number])[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

/**
 * Draws the tag (if any) in the HUD font, always with a 1-px dark outline: it sits over the sky,
 * where white clouds would swallow plain white letters. The outline is the font's silhouette
 * glyphs (one sprite a letter), then the letters as text.
 */
export function drawRulesTag(
  r: Renderer,
  assets: AssetRegistry,
  rules: Rules,
  heroes: readonly CharacterDef[],
): void {
  const tag = rulesTag(rules, heroes);
  if (!tag) return;
  const x = rulesTagX(tag);
  const y = rulesTagY(heroes.length);
  const dark = assets.sheet('font', fxPalette('font', 'silhouette'));
  for (const [dx, dy] of OUTLINE)
    [...tag].forEach((ch, i) => {
      if (ch !== ' ') r.sprite(dark, ch, x + i * 8 + dx, y + dy);
    });
  r.text(assets.sheet('font'), tag, x, y);
}

/** The F1 overlay's rules line (TG-33), e.g. `rules classic p1 link classic p2 mario current`. */
export function rulesLine(rules: Rules, heroes: readonly CharacterDef[]): string {
  const who = heroes.map((d, i) => `p${i + 1} ${d.id} ${d.rules === 'classic' ? 'classic' : 'current'}`);
  return [`rules ${rules}`, ...who].join(' ');
}
