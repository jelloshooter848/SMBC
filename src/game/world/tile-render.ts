import type { Renderer } from '@engine/gfx/renderer';
import { TILE } from '@engine/math/units';
import { SCREEN_W } from '@engine/viewport';
import { tileDef, T } from '../level/tiles';
import type { View } from '../entities/entity';
import type { TileMap } from './tilemap';

/** Draw the visible tile columns of a map for the current theme (shared by the game and the editor). */
export function renderTiles(r: Renderer, view: View, map: TileMap, showHidden = false): void {
  const sheet = view.assets.sheet('tiles', `tiles-${view.theme}`);
  const camPx = view.camX;
  const first = Math.max(0, camPx >> 4);
  const last = Math.min(map.width - 1, (camPx + SCREEN_W) >> 4);
  const anim = (view.frame >> 3) % 3;
  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = first; tx <= last; tx++) {
      const id = map.get(tx, ty);
      if (id === T.AIR || id === T.BUMPING) continue;
      const def = tileDef(id);
      if (def.block?.kind === 'hidden') {
        if (showHidden) r.rect(tx * TILE - camPx + 2, ty * TILE + 2, 12, 12, 'rgba(255,255,255,0.3)');
        continue;
      }
      let name = def.name;
      if (def.block?.kind === 'question') name = `question-${anim === 2 ? 1 : anim}`;
      else if (def.block?.kind === 'brick') name = 'brick';
      else if (def.pickup === 'coin') name = `coin-${(view.frame >> 3) & 3}`;
      else if (id === T.LAVA) name = `lava-${(view.frame >> 4) & 1}`;
      else if (id === T.WATER) name = `water-${(view.frame >> 4) & 1}`;
      const themed = `${name}@${view.theme}`;
      r.sprite(sheet, sheet.frames.has(themed) ? themed : name, tx * TILE - camPx, ty * TILE);
    }
  }
}

export const SKY: Record<string, string> = {
  overworld: '#5c94fc',
  underground: '#000000',
  castle: '#000000',
  water: '#2038ec',
  night: '#000000',
  treetop: '#5c94fc',
  snow: '#5c94fc',
  mushroom: '#5c94fc',
  clouds: '#5c94fc',
  'clouds-overworld': '#5c94fc',
  // Flooded overworld areas keep the daylight sky above and below the waves.
  'overworld-water': '#5c94fc',
  'water-gray': '#5c94fc',
  'castle-overworld': '#5c94fc',
  'mushroom-red': '#5c94fc',
  // A swim through a castle keeps the castle's darkness.
  'castle-water': '#000000',
  // The station hangs in space: black behind the plating.
  station: '#000000',
  // Samus's cavern: a near-black blue, just off the castle's black, behind the rock.
  cavern: '#000818',
  // Larry's airship sails a dark night sky.
  airship: '#000040',
};
