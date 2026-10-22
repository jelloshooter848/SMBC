import { translucent, type Renderer } from '@engine/gfx/renderer';
import { TILE } from '@engine/math/units';
import { SCREEN_H, SCREEN_W } from '@engine/viewport';
import type { View } from '../entities/entity';
import { T, tileDef, type BlockContent } from '../level/tiles';
import type { TileMap } from './tilemap';

/*
 * 0.4.72 (owner item 8): the "Show hidden items" assist (AssistOptions.showHidden). Over every
 * ? block, item brick and hidden block that holds something, a small marker of what it holds; a
 * hidden block shows as a ghost ? block. Our own 8 x 8 pixel art (text rows, one letter a colour),
 * in a white-framed black square so it reads on any block or sky. Nothing flashes or moves.
 */

/** The marker colours. */
const COLOURS: Record<string, string> = {
  y: '#fcbc3c',
  o: '#c84c0c',
  w: '#fcfcfc',
  r: '#d82800',
  g: '#00a800',
  G: '#80d010',
  k: '#000000',
  s: '#fcbcb0',
  p: '#8c3cd8',
  b: '#3cbcfc',
  n: '#a05000',
  e: '#bcbcbc',
};

/** A mushroom with cap colour `c` (`c` for the cap; the stem and face as the menus' cursor). */
const mushroom = (c: string): readonly string[] =>
  ['..cccc..', '.cwwccc.', 'cwwccwwc', 'cccccwwc', 'cccccccc', '.kswsk..', '..ssss..', '..ssss..'].map(
    (row) => row.replace(/c/g, c),
  );

/** Each marker, 8 rows of 8. */
export const BLOCK_MARKERS: Readonly<Record<string, readonly string[]>> = {
  coin: ['..yyyy..', '.yywwoy.', '.ywyyoy.', '.ywyyoy.', '.ywyyoy.', '.ywyyoy.', '.yyyooy.', '..yyyy..'],
  coins: ['.yyy.yyy', 'ywyoywyo', 'ywyoywyo', 'ywyoywyo', 'ywyoywyo', 'ywyoywyo', 'ywyoywyo', '.ooo.ooo'],
  mushroom: mushroom('r'),
  '1up': mushroom('g'),
  poison: mushroom('p'),
  flower: ['..rrrr..', '.rywwyr.', '.rywwyr.', '..rrrr..', '...gg...', '.g.gg.g.', '.gggggg.', '...gg...'],
  star: ['...yy...', '...yy...', 'yyyyyyyy', '.yykkyy.', '..yyyy..', '.yyyyyy.', '.yy..yy.', 'y......y'],
  vine: ['..GG....', '.GggG...', '..Gg.GG.', '...gGgG.', '...g.G..', '..GGg...', '.GgGg...', '...g....'],
  clock: ['..kkkk..', '.kwwwwk.', 'kwwkwwwk', 'kwwkwwwk', 'kwwkkkwk', 'kwwwwwwk', '.kwwwwk.', '..kkkk..'],
  key: ['..yyy...', '.y...y..', '.y...y..', '..yyy...', '...y....', '...yy...', '...y....', '...yy...'],
  egg: ['...ww...', '..wwgw..', '.wwwwww.', '.wgwwww.', '.wwwwgw.', '.wwgwww.', '..wwww..', '........'],
  teleporter: [
    '..bbbb..',
    '.b....b.',
    'b..bb..b',
    'b.b..b.b',
    'b..bb..b',
    '.b....b.',
    '..bbbb..',
    'kkkkkkkk',
  ],
  path: ['........', '..ww....', '.wwww.w.', 'wwwwwwww', '.wwwwww.', '........', 'w.w.w.w.', '........'],
  bee: ['..ww.ww.', '..wwwww.', '.ykykyk.', 'ykykykyk', 'ykykykyk', '.ykykyk.', '..k..k..', '........'],
  atom: ['...bb...', '.b.bb.b.', '..bbbb..', 'bbbwwbbb', 'bbbwwbbb', '..bbbb..', '.b.bb.b.', '...bb...'],
  rabbit: ['.w...w..', '.ws.sw..', '.ws.sw..', '.wwwww..', 'wwkwkww.', 'wwwwwww.', '.wwsww..', '..www...'],
  hammer: ['.eeeee..', '.wwwww..', '.eeeee..', '...n....', '...n....', '...n....', '...n....', '...n....'],
  wing: ['......w.', '....www.', '..wwwww.', '.wwwwww.', 'wwwwwww.', '.wwwww..', '..www...', '........'],
};

/**
 * The marker for a block's `content`, or null for none (a plain brick). A power-up block shows
 * `powerUp`, what it gives the hero now (CharacterDef.blockPowerUp: the Mushroom or the Fire
 * Flower for a power-up hero, an HP hero's own pick).
 */
export function markerFor(content: BlockContent, powerUp: string): string | null {
  switch (content) {
    case 'none':
      return null;
    case 'powerup':
      return BLOCK_MARKERS[powerUp] ? powerUp : 'mushroom';
    case 'coins10':
      return 'coins';
    default:
      return BLOCK_MARKERS[content] ? content : null;
  }
}

/** A marker's pixels, top-left at (x, y). */
export function drawMarker(r: Renderer, id: string, x: number, y: number): void {
  const rows = BLOCK_MARKERS[id];
  if (!rows) return;
  rows.forEach((row, cy) => {
    for (let cx = 0; cx < row.length; cx++) {
      const c = COLOURS[row[cx] as string];
      if (c) r.rect(x + cx, y + cy, 1, 1, c);
    }
  });
}

/**
 * Draws the markers over the visible blocks of `map` (World.render, after the tiles).
 * `contentAt` gives a block's content (a `block-item` spawn's item in place of its own, the Yoshi
 * mount's egg block's egg); `powerUp` is what a power-up block gives the hero now.
 */
export function renderBlockMarkers(
  r: Renderer,
  view: View,
  map: TileMap,
  contentAt: (tx: number, ty: number) => BlockContent | null,
  powerUp: string,
): void {
  const camPx = view.camX;
  const first = Math.max(0, camPx >> 4);
  const last = Math.min(map.width - 1, (camPx + SCREEN_W) >> 4);
  const top = view.camY === undefined ? 0 : Math.max(0, view.camY >> 4);
  const bottom =
    view.camY === undefined ? map.height - 1 : Math.min(map.height - 1, (view.camY + SCREEN_H) >> 4);
  const sheet = view.assets.sheet('tiles', `tiles-${view.theme}`);
  const themed = `question-0@${view.theme}`;
  const ghost = sheet.frames.has(themed) ? themed : 'question-0';
  for (let ty = top; ty <= bottom; ty++)
    for (let tx = first; tx <= last; tx++) {
      const id = map.get(tx, ty);
      if (id === T.AIR || id === T.BUMPING) continue;
      const block = tileDef(id).block;
      if (!block) continue;
      const content = contentAt(tx, ty);
      const marker = content ? markerFor(content, powerUp) : null;
      const x = tx * TILE - camPx;
      const y = ty * TILE;
      // A hidden block shows where it is: a ghost ? block (half see-through).
      if (block.kind === 'hidden') translucent(r, 0.5, () => r.sprite(sheet, ghost, x, y));
      if (!marker) continue;
      // A white-framed black square, so the marker reads on a ? block, a brick or the sky.
      r.rect(x + 2, y + 2, 12, 12, '#fcfcfc');
      r.rect(x + 3, y + 3, 10, 10, '#000000');
      drawMarker(r, marker, x + 4, y + 4);
    }
}
