import type { Renderer } from '@engine/gfx/renderer';
import type { AssetRegistry } from '@engine/assets/registry';
import type { CharacterDef } from '../characters/character';
import type { Rules } from '../context';

/**
 * The Classic rules tag (TG-31, TG-32) at the top right, above TIME (200, 8) and clear of the F1
 * overlay: CLASSIC while every hero plays a Classic def, CLASSIC? at x 188 while any hero has
 * no Classic def yet and plays Current (TG-20). Nothing under Current rules.
 */
export function rulesTag(rules: Rules, heroes: readonly CharacterDef[]): string | null {
  if (rules !== 'classic') return null;
  return heroes.every((d) => d.rules === 'classic') ? 'CLASSIC' : 'CLASSIC?';
}

export const RULES_TAG_Y = 0;

/** The tag's x: CLASSIC at 196, CLASSIC? at 188 (the font's 8-px cells, ending at 252). */
export function rulesTagX(tag: string): number {
  return tag.endsWith('?') ? 188 : 196;
}

/** Draws the tag (if any) in the HUD font. */
export function drawRulesTag(
  r: Renderer,
  assets: AssetRegistry,
  rules: Rules,
  heroes: readonly CharacterDef[],
): void {
  const tag = rulesTag(rules, heroes);
  if (tag) r.text(assets.sheet('font'), tag, rulesTagX(tag), RULES_TAG_Y);
}

/** The F1 overlay's rules line (TG-33), e.g. `rules classic p1 link classic p2 mario current`. */
export function rulesLine(rules: Rules, heroes: readonly CharacterDef[]): string {
  const who = heroes.map((d, i) => `p${i + 1} ${d.id} ${d.rules === 'classic' ? 'classic' : 'current'}`);
  return [`rules ${rules}`, ...who].join(' ');
}
