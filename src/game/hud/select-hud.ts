import type { Renderer } from '@engine/gfx/renderer';
import { clipped } from '@engine/gfx/renderer';
import type { AssetRegistry } from '@engine/assets/registry';
import type { CharacterDef } from '../characters/character';
import type { GameState } from '../context';
import { faceAt } from '../scenes/select-grid';
import { CLASSIC_HUD_COLUMNS } from './hud';
import { worldLabel } from './world-label';

/**
 * The HUD's face box over Classic mode's select: its top-left and size (framed). The original's
 * portrait sits at (6, 7) with its 1 px frame from (5, 6) (TopScreenText PORT_PNT: -10 + HUD_X_OFS
 * 22, FIRST_ROW_Y 14, halved; portraitFrame 2 px up and left).
 */
export const HUD_FACE = { x: 5, y: 6, size: 26 } as const;

/** The HUD's text columns: a Classic run's level HUD's (hud.ts CLASSIC_HUD_COLUMNS), so nothing moves. */
export const HUD_TEXT = CLASSIC_HUD_COLUMNS;

/**
 * The HUD over Classic mode's select (the original 3.1.21's layout: the HUD stays on top): the
 * shown hero's face in a white-framed box (our standing art doubled, its head filling the box; the
 * Random slot's "?"), then its HUD name, the score, the coins, WORLD and TIME as in a level.
 * `shown` null: the Random slot. `place`: the level the select is for (BUG-04: the coming level,
 * whose WORLD card follows the select; the state still holds the last level's until then).
 */
export function drawSelectHud(
  r: Renderer,
  assets: AssetRegistry,
  state: GameState,
  shown: CharacterDef | null,
  art: { sheet: string; palette: string; frame: string } | null,
  frame = '#fcfcfc',
  place: { world: number; stage: number } = state,
): void {
  const font = assets.sheet('font');
  const B = HUD_FACE;
  r.rect(B.x, B.y, B.size, B.size, frame);
  r.rect(B.x + 1, B.y + 1, B.size - 2, B.size - 2, '#000000');
  clipped(r, B.x + 1, B.y + 1, B.size - 2, B.size - 2, () => {
    if (art?.sheet === 'select-faces') {
      // A drawn face fills the box as it is.
      const f = assets.sheet(art.sheet, art.palette).frames.get(art.frame);
      r.sprite(
        assets.sheet(art.sheet, art.palette),
        art.frame,
        B.x + ((B.size - (f?.w ?? 24)) >> 1),
        B.y + ((B.size - (f?.h ?? 24)) >> 1),
      );
    } else if (art) {
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
  const T = HUD_TEXT;
  r.text(font, (shown ? shown.hudName : 'RANDOM').slice(0, 7), T.name, 8);
  r.text(font, String(state.score).padStart(7, '0'), T.name, 16);
  r.text(font, `$×${String(state.coins).padStart(2, '0')}`, T.coins, 16);
  r.text(font, 'WORLD', T.world, 8);
  r.text(font, `${worldLabel(place.world)}-${place.stage}`, T.level, 16);
  r.text(font, 'TIME', T.time, 8);
}
