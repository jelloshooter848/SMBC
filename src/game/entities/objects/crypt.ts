import type { Renderer } from '@engine/gfx/renderer';
import type { AssetRegistry } from '@engine/assets/registry';
import { px, toPx } from '@engine/math/units';
import type { EntitySpawn } from '../../level/schema';
import { Entity, type View } from '../entity';
import type { World } from '../../world/world';

/*
 * Simon's dungeon and crypt under 5-4 (campaign; docs/HEROES.md): wall candles that give a coin,
 * and the respawning Koopa that lets a hero with no attack break the cracked wall.
 */

/** The `crypt` sheet's frame if that sheet (S3's art) is registered and has it. */
export function cryptFrame(assets: AssetRegistry, frame: string): boolean {
  return assets.has('crypt') && assets.sheet('crypt').frames.has(frame);
}

/** The candle's two flicker frames (no string built each frame). */
const CANDLE_FRAMES = ['candle-0', 'candle-1'] as const;

/**
 * A wall candle (`candle x y`, 8×16, standing on the bottom of tile (x, y), centred in it). Any
 * hero attack (a melee hit, a shot, a kicked shell) or a hero jumping into it snuffs it: a coin
 * pops out (World.snuffCandles). Scenery otherwise: no collision, never despawns.
 */
export class Candle extends Entity {
  readonly kind = 'candle';
  constructor(tx: number, ty: number) {
    super(px(tx * 16 + 4), px(ty * 16), 8, 16);
    this.layer = 'back';
    this.despawnMargin = null;
  }

  update(): void {}

  /** Snuffed: gone, with its coin (the world pays it). */
  snuff(): void {
    this.destroy();
  }

  render(r: Renderer, view: View): void {
    const x = toPx(this.body.x) - view.camX;
    const y = toPx(this.body.y);
    const flick = (view.frame >> 3) & 1;
    const frame = CANDLE_FRAMES[flick] as string;
    if (cryptFrame(view.assets, frame)) {
      r.sprite(view.assets.sheet('crypt'), frame, x, y);
      return;
    }
    // Rect fallback until the crypt sheet lands: a flame over a wax stick on an iron cup.
    r.rect(x + 3, y + 1 + flick, 2, 4 - flick, '#fcbc3c');
    r.rect(x + 3, y + 3, 2, 2, '#fc7460');
    r.rect(x + 2, y + 6, 4, 7, '#fcfcfc');
    r.rect(x + 1, y + 13, 6, 3, '#7c7c7c');
  }
}

/** Frames after the Koopa is lost before another walks in. */
export const RESPAWN_FRAMES = 90;

/**
 * Keeps one enemy of a spawn alive (an entity with `respawn` in its props, 5-4's dungeon Koopa):
 * while the level still has a cracked wall standing, a lost one (killed, or fallen out) comes back
 * at its spawn spot RESPAWN_FRAMES later, once no player stands on that spot. So a hero with no
 * attack always has a shell to break the wall with. Invisible; never despawns.
 */
export class Respawner extends Entity {
  readonly kind = 'respawner';
  private child: Entity | null = null;
  private wait = 0;
  constructor(
    private readonly spawnAt: EntitySpawn,
    private readonly make: (s: EntitySpawn) => Entity | null,
  ) {
    super(px(spawnAt.x * 16), px(spawnAt.y * 16), 16, 16);
    this.despawnMargin = null;
  }

  /** The enemy it keeps (null while waiting to bring it back). */
  get current(): Entity | null {
    return this.child?.alive ? this.child : null;
  }

  update(world: World): void {
    if (this.child?.alive) return;
    if (this.child && !world.crackedWalls()) return; // the wall is down: no need any more
    if (this.child && ++this.wait < RESPAWN_FRAMES) return;
    const b = this.body;
    if (this.child && world.players.some((p) => !p.dead && Math.abs(p.centerX - (b.x + px(8))) < px(24)))
      return;
    const e = this.make(this.spawnAt);
    this.wait = 0;
    if (!e) return;
    this.child = e;
    world.spawn(e);
  }

  render(): void {}
}
