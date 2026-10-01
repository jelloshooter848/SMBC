import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import { px, TILE, tileToSub, toPx } from '@engine/math/units';
import { Rng } from '@engine/rng';
import { SCREEN_H, SCREEN_W } from '@engine/viewport';
import type { LevelData } from '../level/schema';
import { tileDef, T } from '../level/tiles';
import { Camera } from './camera';
import { TileMap } from './tilemap';
import { Player } from '../entities/player';
import { MARIO_PROFILE } from '../characters/mario/profile';

export interface WorldOptions {
  allowLeftScroll?: boolean;
  seed?: number;
}

/** One loaded level: tiles, camera, player and (from phase 1) entities. */
export class World {
  readonly map: TileMap;
  readonly camera: Camera;
  readonly player: Player;
  readonly rng: Rng;
  frame = 0;
  /** Set when the player falls below the level. */
  playerFell = false;

  constructor(
    readonly level: LevelData,
    opts: WorldOptions = {},
  ) {
    this.map = new TileMap(level);
    const stop = level.zones.find((z) => z.kind === 'scrollStop');
    this.camera = new Camera(
      level.width,
      stop && stop.kind === 'scrollStop' ? stop.x : null,
      level.camera === 'locked',
    );
    this.camera.allowLeftScroll = opts.allowLeftScroll ?? false;
    this.rng = new Rng(opts.seed ?? 1);
    const sx = tileToSub(level.start.x) + px(2);
    const sy = tileToSub(level.start.y + 1) - px(16);
    this.player = new Player(sx, sy, { w: 12, h: 16 }, MARIO_PROFILE);
    this.camera.snapTo(this.player.body.x);
  }

  update(input: InputFrame): void {
    this.frame++;
    const p = this.player;
    p.update(input, this.map, (tx, ty) => this.onHeadBump(tx, ty));
    // Left edge of the screen is a wall (SMB1).
    if (p.body.x < this.camera.x) {
      p.body.x = this.camera.x;
      if (p.body.vx < 0) p.body.vx = 0;
    }
    this.camera.follow(p.body.x);
    if (toPx(p.body.y) > SCREEN_H + 16) this.playerFell = true;
  }

  private onHeadBump(tx: number, ty: number): void {
    const id = this.map.get(tx, ty);
    const def = tileDef(id);
    if (def.block) {
      // Phase 0 placeholder: question blocks become used, bricks stay (breaking arrives with power states).
      if (def.block.kind === 'question' || def.block.kind === 'hidden') this.map.set(tx, ty, T.USED);
    }
  }

  /** Placeholder rendering until the tile atlas lands: tiles as flat colours. */
  render(r: Renderer): void {
    r.clear(THEME_SKY[this.level.theme] ?? '#5c94fc');
    const camPx = this.camera.pxX;
    const first = Math.max(0, camPx >> 4);
    const last = Math.min(this.map.width - 1, (camPx + SCREEN_W) >> 4);
    for (let ty = 0; ty < this.map.height; ty++) {
      for (let tx = first; tx <= last; tx++) {
        const id = this.map.get(tx, ty);
        if (id === T.AIR) continue;
        const color = TILE_COLORS[id] ?? '#c0c0c0';
        r.rect(tx * TILE - camPx, ty * TILE, TILE, TILE, color);
        r.rect(tx * TILE - camPx, ty * TILE, TILE, 1, 'rgba(0,0,0,0.25)');
        r.rect(tx * TILE - camPx, ty * TILE, 1, TILE, 'rgba(0,0,0,0.25)');
      }
    }
    const b = this.player.body;
    r.rect(toPx(b.x) - camPx, toPx(b.y), toPx(b.w), toPx(b.h), '#e03c28');
    r.rect(toPx(b.x) - camPx + (this.player.facing > 0 ? toPx(b.w) - 3 : 0), toPx(b.y) + 3, 3, 3, '#fff');
  }
}

const THEME_SKY: Partial<Record<LevelData['theme'], string>> = {
  overworld: '#5c94fc',
  underground: '#000000',
  castle: '#000000',
  water: '#2038ec',
  night: '#000000',
  treetop: '#5c94fc',
  snow: '#5c94fc',
};

const TILE_COLORS: Record<number, string> = {
  [T.GROUND]: '#c84c0c',
  [T.BRICK]: '#c84c0c',
  [T.BRICK_COIN]: '#c84c0c',
  [T.BRICK_COINS10]: '#c84c0c',
  [T.BRICK_STAR]: '#c84c0c',
  [T.BRICK_POWERUP]: '#c84c0c',
  [T.BRICK_1UP]: '#c84c0c',
  [T.Q_COIN]: '#f8b800',
  [T.Q_POWERUP]: '#f8b800',
  [T.Q_1UP]: '#f8b800',
  [T.Q_STAR]: '#f8b800',
  [T.USED]: '#8c5a2c',
  [T.HARD]: '#a0a0a0',
  [T.PIPE_TL]: '#00a800',
  [T.PIPE_TR]: '#00a800',
  [T.PIPE_BL]: '#008000',
  [T.PIPE_BR]: '#008000',
  [T.PIPE_H_TL]: '#00a800',
  [T.PIPE_H_TR]: '#00a800',
  [T.PIPE_H_BL]: '#008000',
  [T.PIPE_H_BR]: '#008000',
  [T.COIN]: '#ffd700',
  [T.FLAG_SHAFT]: '#00c000',
  [T.FLAG_BALL]: '#00c000',
  [T.TREE_TOP]: '#00a800',
  [T.TREE_TRUNK]: '#80602c',
  [T.MUSHROOM_TOP]: '#f87858',
  [T.MUSHROOM_STEM]: '#f8d8b0',
  [T.LAVA]: '#f83800',
  [T.BRIDGE]: '#c84c0c',
  [T.CHAIN]: '#a0a0a0',
  [T.CASTLE_BRICK]: '#808080',
  [T.WATER]: '#2038ec',
  [T.CLOUD_BLOCK]: '#f8f8f8',
};
