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

/**
 * Themes whose sky is so light the white HUD letters would sink into it: the HUD outlines every
 * text in black there (HudOptions.outline). The Top Secret Area's cream.
 */
export const LIGHT_SKIES: ReadonlySet<string> = new Set(['smw-secret']);

/** Themes whose dark sky has stars in it (Bill's jungle, as NES Contra's first stage; Mega Man's 3-1). */
export const STARRY_SKIES: ReadonlySet<string> = new Set([
  'contra-jungle',
  'megaman-stage',
  // World 5 as Simon's world (0.4.28): the gate, the town and the clock tower's night.
  'cv-gate',
  'cv-town',
  'cv-clock',
  // World 6 as Ryu's world (0.4.29): the bamboo field's and the mountain pass's night.
  'ng-field',
  'ng-pass',
]);

/**
 * Sparse fixed stars over a starry theme's sky, in its upper half, drifting at an eighth of the
 * camera's speed. They never twinkle (nothing flashes).
 */
export function drawStars(r: Renderer, camX: number): void {
  const span = 512;
  for (let i = 0; i < 36; i++) {
    const sx = (i * 197 + ((i * i * 31) % 89)) % span;
    const sy = 6 + ((i * 113 + 41) % 116);
    const x = (((sx - (camX >> 3)) % span) + span) % span;
    if (x >= SCREEN_W) continue;
    r.rect(x, sy, 1, 1, i % 7 === 0 ? '#fcfcfc' : i % 3 === 0 ? '#bcbcbc' : '#7c7c7c');
  }
}

/**
 * The water of a flooded area in a dry theme (a map's `swim: true`, LevelData.swim), filling the
 * screen from the wave row down: the Underworld's murky teal (Fred's tunnel under 8-4), a shade
 * of its tiles' water. A theme without its own takes the Underworld's.
 */
export const FLOODED_WATER = '#002c3c';
export const FLOODED: Readonly<Record<string, string>> = {
  underworld: FLOODED_WATER,
  // 2-2 as Hyrule's lake (0.4.24): its waves' own deep blue (zelda2-hyrule.ts HYRULE_LAKE).
  'zelda2-water': '#1838a0',
  // 5-2's water area as the underground lake (0.4.28): its waves' murky green (transylvania.ts CV_LAKE_WATER).
  'cv-lake': '#1c4c28',
  // 6-2's water area as the night harbour (0.4.29): its waves' dark blue (ninja-world.ts NG_HARBOR_WATER).
  'ng-harbor': '#102c74',
  // 7-2's water area as the jungle river (0.4.30): its waves' green (contra-world.ts CONTRA_RIVER_WATER).
  'contra-river': '#145c44',
};

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
  // 5-4 as Simon's castle hall: black over the hall's wall (theme-backdrop.ts paints it).
  castlevania: '#000000',
  // Ryu's dojo: dark between the beams and screens.
  dojo: '#000000',
  // Ryu's moonlit town: a deep violet night over the roofs.
  'ninja-night': '#100828',
  // 6-2 as Ryu's city street: a black night over the far towers (theme-backdrop.ts).
  'ninja-city': '#000000',
  // Bill's jungle: NES Contra's black night sky, sparse stars (STARRY_SKIES) over snow-capped peaks.
  'contra-jungle': '#000000',
  // The waterfall: darker still, the cliff's shadow.
  'contra-falls': '#000c20',
  // Red Falcon's lair: a dark blood red between the organic walls.
  'alien-lair': '#200010',
  // Sophia's Underworld: the black of a deep cave with a little rust in it.
  underworld: '#100400',
  // The overhead dungeon's metal: black between the walls.
  'bm-dungeon': '#000000',
  // The Top Secret Area: Super Mario World's pale cream behind the hills.
  'smw-secret': '#f8ecc0',
  // Link's field (2-1's campaign look): Zelda II's softer periwinkle daylight.
  zelda2: '#6888fc',
  // Mega Man's night stage (3-1's campaign look): a deep navy with stars (STARRY_SKIES).
  'megaman-stage': '#000c38',
  // Brinstar (4-2's campaign look): Metroid's black behind the blue rock.
  brinstar: '#000000',
  // Tourian (Samus's mini game): Metroid's black behind the machine panels.
  tourian: '#000000',
  // World 2 as Hyrule (0.4.24): 2-2's lake under the field's periwinkle (only the band above the
  // waves shows it), 2-4's palace and 2-1's caves in the dark.
  'zelda2-water': '#6888fc',
  'zelda2-palace': '#000000',
  'zelda2-cave': '#000000',
  // World 3 as Mega Man's world (0.4.26): 3-1's bonus room in the factory's dark, 3-2's forest
  // in a deep green gloom, 3-3 under Air Man's deep daylight blue (the lifts' planks and the
  // balance lifts' ropes stand out against it), 3-4's fortress in the dark.
  'megaman-metal': '#000000',
  'megaman-wood': '#001800',
  'megaman-air': '#2858d8',
  'megaman-fortress': '#000000',
  // World 4 as Samus's world, Zebes (0.4.27): the surface under a dusky storm indigo, Norfair
  // under a dark, hot red (the lifts' planks and the balance lifts' ropes stand out against it),
  // Mother Brain's lair in the dark.
  crateria: '#18183c',
  norfair: '#300808',
  'tourian-lair': '#000000',
  // World 5 as Simon's world, Transylvania (0.4.28): starry night blues over the gate, the town and
  // the clock tower (the lifts' planks stand out against it), a storm's slate over the coin heaven,
  // the catacombs and the underground lake in the dark (only the band above its waves shows it).
  'cv-gate': '#0c0c28',
  'cv-catacomb': '#000000',
  'cv-town': '#100c2c',
  'cv-storm': '#0c1020',
  'cv-lake': '#000000',
  'cv-clock': '#08081c',
  // World 6 as Ryu's world (0.4.29): starry night blues over the bamboo field and the mountain pass
  // (the lifts' planks and the balance ropes stand out against it), the sewers in the dark, the
  // harbour's night over its waves, the demon temple black over its carved wall.
  'ng-field': '#0c1028',
  'ng-sewer': '#000000',
  'ng-harbor': '#080c1c',
  'ng-pass': '#101830',
  'ng-temple': '#000000',
  // World 7 as Bill's world (0.4.30): the snowfield's winter night, the base's corridors in the dark,
  // the shore's and the river's jungle night, the alien lair black over its organic wall.
  'contra-snow': '#141c30',
  'contra-base': '#000000',
  'contra-shore': '#000c24',
  'contra-river': '#000818',
  'contra-lair': '#000000',
};
