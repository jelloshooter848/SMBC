import type { Renderer } from '@engine/gfx/renderer';
import { clipped } from '@engine/gfx/renderer';
import type { AssetRegistry } from '@engine/assets/registry';
import type { CharacterDef } from '../characters/character';
import type { GameState } from '../context';
import { faceAt } from '../scenes/select-grid';

/** The HUD's face box over Classic mode's select: its top-left and size (white-framed). */
export const HUD_FACE = { x: 0, y: 0, size: 24 } as const;

/**
 * The HUD over Classic mode's select (the original 3.1.21's layout: the HUD stays on top): the
 * shown hero's face in a white-framed box (our standing art doubled, its head filling the box; the
 * Random slot's "?"), then its HUD name, the score, the coins, WORLD and TIME as in a level.
 * `shown` null: the Random slot.
 */
export function drawSelectHud(
  r: Renderer,
  assets: AssetRegistry,
  state: GameState,
  shown: CharacterDef | null,
  art: { sheet: string; palette: string; frame: string } | null,
): void {
  const font = assets.sheet('font');
  const B = HUD_FACE;
  r.rect(B.x, B.y, B.size, B.size, '#fcfcfc');
  r.rect(B.x + 1, B.y + 1, B.size - 2, B.size - 2, '#000000');
  clipped(r, B.x + 1, B.y + 1, B.size - 2, B.size - 2, () => {
    if (art) {
      const sheet = assets.sheet(art.sheet, art.palette);
      const at = faceAt(art.sheet, art.frame, B.x + 1, B.y + 1, B.size - 2, 2, 1);
      r.sprite(sheet, art.frame, at.x, at.y, false, false, 0, 2);
    } else {
      const items = assets.sheet('items');
      const f = items.frames.get('select-random-0');
      r.sprite(
        items,
        'select-random-0',
        B.x + ((B.size - (f?.w ?? 16)) >> 1),
        B.y + ((B.size - (f?.h ?? 20)) >> 1),
      );
    }
  });
  r.text(font, (shown ? shown.hudName : 'RANDOM').slice(0, 7), 32, 8);
  r.text(font, String(state.score).padStart(7, '0'), 32, 16);
  r.text(font, `$×${String(state.coins).padStart(2, '0')}`, 104, 16);
  r.text(font, 'WORLD', 152, 8);
  r.text(font, `${state.world}-${state.stage}`, 160, 16);
  r.text(font, 'TIME', 208, 8);
}
