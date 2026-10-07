import type { Renderer } from '@engine/gfx/renderer';
import { TILE } from '@engine/math/units';
import { SCREEN_H, SCREEN_W } from '@engine/viewport';
import { tileDef, T } from '../level/tiles';
import type { View } from '../entities/entity';
import type { TileMap } from './tilemap';
import type { SpriteSheet } from '@engine/gfx/spritesheet';

/** Draw the visible tile columns of a map for the current theme (shared by the game and the editor). */
export function renderTiles(r: Renderer, view: View, map: TileMap, showHidden = false): void {
  const sheet = view.assets.sheet('tiles', `tiles-${view.theme}`);
  const camPx = view.camX;
  const first = Math.max(0, camPx >> 4);
  const last = Math.min(map.width - 1, (camPx + SCREEN_W) >> 4);
  const anim = (view.frame >> 3) % 3;
  // A vertically scrolling view draws only the rows on screen (in map coordinates: the caller's
  // renderer is offset by the camera's y).
  const top = view.camY === undefined ? 0 : Math.max(0, view.camY >> 4);
  const bottom =
    view.camY === undefined ? map.height - 1 : Math.min(map.height - 1, (view.camY + SCREEN_H) >> 4);
  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = first; tx <= last; tx++) {
      const id = map.get(tx, ty);
      if (id === T.AIR || id === T.BUMPING) continue;
      const def = tileDef(id);
      if (def.block?.kind === 'hidden') {
        if (showHidden) r.rect(tx * TILE - camPx + 2, ty * TILE + 2, 12, 12, 'rgba(255,255,255,0.3)');
        continue;
      }
      if (id === T.CRACKED) {
        drawCracked(r, view, sheet, tx * TILE - camPx, ty * TILE);
        continue;
      }
      let name = def.name;
      // A trick wall's panel looks like the wall it stands in (World's TrickWall draws its spin).
      if (id === T.TRICK) name = 'brick';
      else if (def.block?.kind === 'question') name = `question-${anim === 2 ? 1 : anim}`;
      else if (def.block?.kind === 'brick') name = 'brick';
      else if (def.pickup === 'coin') name = `coin-${(view.frame >> 3) & 3}`;
      else if (id === T.LAVA) name = `lava-${(view.frame >> 4) & 1}`;
      else if (id === T.WATER) name = `water-${(view.frame >> 4) & 1}`;
      const themed = `${name}@${view.theme}`;
      r.sprite(sheet, sheet.frames.has(themed) ? themed : name, tx * TILE - camPx, ty * TILE);
    }
  }
}

/**
 * A cracked wall tile: the `crypt` sheet's `wall-cracked` once that art is registered, else the
 * theme's castle brick with a dark crack zig-zagging across it.
 */
function drawCracked(r: Renderer, view: View, sheet: SpriteSheet, x: number, y: number): void {
  if (view.assets.has('crypt')) {
    const crypt = view.assets.sheet('crypt');
    if (crypt.frames.has('wall-cracked')) {
      r.sprite(crypt, 'wall-cracked', x, y);
      return;
    }
  }
  const themed = `castle-brick@${view.theme}`;
  r.sprite(sheet, sheet.frames.has(themed) ? themed : 'castle-brick', x, y);
  const crack = '#000000';
  r.rect(x + 3, y + 1, 2, 4, crack);
  r.rect(x + 5, y + 4, 2, 3, crack);
  r.rect(x + 7, y + 6, 2, 4, crack);
  r.rect(x + 9, y + 9, 2, 3, crack);
  r.rect(x + 8, y + 12, 2, 4, crack);
  r.rect(x + 10, y + 7, 4, 1, crack);
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
  // The airship's open decks sail SMB3's lighter daylight blue.
  'airship-deck': '#3cbcfc',
  // Simon's crypt: the castle's black behind the night-blue brick.
  crypt: '#000000',
  // Ryu's dojo: dark between the beams and screens.
  dojo: '#000000',
  // Ryu's moonlit town: a deep violet night over the roofs.
  'ninja-night': '#100828',
};
