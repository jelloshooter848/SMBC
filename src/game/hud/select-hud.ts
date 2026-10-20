import type { Renderer } from '@engine/gfx/renderer';
import { clipped } from '@engine/gfx/renderer';
import type { AssetRegistry } from '@engine/assets/registry';
import type { CharacterDef } from '../characters/character';
import type { GameState } from '../context';

/**
 * The HUD over Classic mode's select (the original 3.1.21's layout: the HUD stays on top): the
 * shown hero's small portrait (its head, in a 16 px box) and HUD name, then the score, the coins,
 * WORLD and TIME as in a level. `shown` null: the Random slot.
 */
export function drawSelectHud(
  r: Renderer,
  assets: AssetRegistry,
  state: GameState,
  shown: CharacterDef | null,
  art: { sheet: string; palette: string; frame: string } | null,
): void {
  const font = assets.sheet('font');
  if (art) {
    const sheet = assets.sheet(art.sheet, art.palette);
    const f = sheet.frames.get(art.frame);
    clipped(r, 6, 6, 16, 16, () => r.sprite(sheet, art.frame, 14 - ((f?.w ?? 16) >> 1), 6));
  }
  r.text(font, (shown ? shown.hudName : 'RANDOM').slice(0, 7), 24, 8);
  r.text(font, String(state.score).padStart(7, '0'), 24, 16);
  r.text(font, `$×${String(state.coins).padStart(2, '0')}`, 96, 16);
  r.text(font, 'WORLD', 144, 8);
  r.text(font, `${state.world}-${state.stage}`, 152, 16);
  r.text(font, 'TIME', 200, 8);
}
