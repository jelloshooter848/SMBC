import type { Renderer } from '@engine/gfx/renderer';
import { px, toPx } from '@engine/math/units';
import { Entity, type View } from '../entity';
import type { EntitySpawn } from '../../level/schema';
import { T } from '../../level/tiles';
import type { World } from '../../world/world';
import { CHAIN_FRAME, CHAIN_SHEET, Vine } from './vine';

/** Frames between a player landing on the room's floor and the anchor showing at the top. */
export const ANCHOR_WAIT_FRAMES = 20;
/** px per frame the anchor starts falling at, its gain each frame, and its top speed. */
const FALL_SPEED = 4;
const FALL_GAIN = 0.5;
const FALL_MAX = 10;
/** Frames the screen shakes after the crash (none with reduce flashing). */
export const ANCHOR_SHAKE_FRAMES = 16;
/** The announcer's line at the crash (LevelScene adds the climb prompt). */
export const ANCHOR_SAID = 'An anchor crashes down and smashes the pipe!';
/** The anchor's frame in the smb3 sheet (32x32, its ring at the top centre). */
export const ANCHOR_FRAME = 'anchor';
const PIPE_TILES = new Set<number>([T.PIPE_TL, T.PIPE_TR, T.PIPE_BL, T.PIPE_BR]);

type Phase = 'wait' | 'warn' | 'fall' | 'rest';

/**
 * Larry Koopa's anchor crashing into 4-2's hidden right zone (campaign; level/campaign.ts builds
 * the `anchor-drop x y len=N pipe=row holes=r,.. room=x0,x1` spawn): the room shows the classic
 * warp zone until a player stands on its floor (rows below the ceiling, columns x0..x1), then the
 * anchor (`smb3:anchor`, 32x32, centred on column x) falls from above the screen trailing its
 * chain, breaks the solid tiles in its column on the way (`holes`: the ceiling brick), smashes
 * the dead pipe whose mouth is on row `pipe` (pipe-green chunks, the `cannon` boom and a break,
 * a short shake, the world number gone) and comes to rest on the floor where the pipe stood. The
 * chain is then a climbable placed vine (`Vine`, chain art) standing on row y, whose `vine` zone
 * leads to the airship. Nothing here is solid or harmful: players keep control throughout.
 */
export class AnchorDrop extends Entity {
  readonly kind = 'anchor-drop';
  phase: Phase = 'wait';
  private t = 0;
  /** px: the anchor's top edge, its fall speed. */
  private top = -48;
  private vy = 0;
  private readonly len: number;
  private readonly pipeRow: number;
  private readonly holes: number[];
  private readonly room: [number, number];
  private smashed = false;
  /** The chain left standing (a climbable placed vine) once the anchor rests. */
  chain: Vine | null = null;

  constructor(
    readonly tx: number,
    /** Tile row the anchor and its chain stand on (the floor is the row below). */
    readonly foot: number,
    props: EntitySpawn['props'] = {},
  ) {
    super(px(tx * 16 - 8), px(-48), 32, 32);
    this.layer = 'main';
    this.despawnMargin = null;
    this.len = Number(props.len ?? foot + 2);
    this.pipeRow = Number(props.pipe ?? foot);
    this.holes = String(props.holes ?? '')
      .split(',')
      .filter(Boolean)
      .map(Number);
    const [x0, x1] = String(props.room ?? `${tx - 8},${tx + 8}`)
      .split(',')
      .map(Number);
    this.room = [x0 ?? tx - 8, x1 ?? tx + 8];
  }

  /** px: where the anchor's top rests (its bottom on the floor). */
  private get restTop(): number {
    return (this.foot + 1) * 16 - 32;
  }

  update(world: World): void {
    this.t++;
    switch (this.phase) {
      case 'wait':
        if (this.someoneOnFloor(world)) {
          this.phase = 'warn';
          this.t = 0;
        }
        return;
      case 'warn':
        if (this.t >= ANCHOR_WAIT_FRAMES) {
          this.phase = 'fall';
          this.vy = FALL_SPEED;
        }
        return;
      case 'fall':
        this.drop(world);
        return;
      case 'rest':
        return;
    }
  }

  /** A player standing on the room's floor (not on the pipe, not up on the ceiling). */
  private someoneOnFloor(world: World): boolean {
    const floorTop = px((this.foot + 1) * 16);
    return world.players.some((p) => {
      if (p.dead || p.out || !p.body.onGround) return false;
      const col = toPx(p.centerX) >> 4;
      return col >= this.room[0] && col < this.room[1] && p.body.y + p.body.h === floorTop;
    });
  }

  private drop(world: World): void {
    this.top = Math.min(this.restTop, this.top + this.vy);
    this.vy = Math.min(FALL_MAX, this.vy + FALL_GAIN);
    this.body.y = px(this.top);
    const bottom = this.top + 32;
    // Break the ceiling in the chain's column as the anchor passes it.
    for (const r of this.holes) {
      if (bottom >= r * 16 && world.map.get(this.tx, r) !== T.AIR) {
        world.map.set(this.tx, r, T.AIR);
        world.breakPieces(this.tx, r);
        world.audio.sfx('break');
      }
    }
    if (!this.smashed && bottom >= this.pipeRow * 16) this.smash(world);
    if (this.top < this.restTop) return;
    this.phase = 'rest';
    this.chain = new Vine(this.tx, this.foot, this.len, null, 'chain');
    world.spawn(this.chain);
  }

  /** The pipe in pieces: its tiles gone, green chunks, the boom, the shake, the number gone. */
  private smash(world: World): void {
    this.smashed = true;
    for (const x of [this.tx, this.tx + 1])
      for (let y = this.pipeRow; y <= this.foot; y++) {
        if (!PIPE_TILES.has(world.map.get(x, y))) continue;
        world.map.set(x, y, T.AIR);
        world.breakPieces(x, y, 'pipe-piece');
      }
    world.audio.sfx('cannon');
    world.audio.sfx('break');
    world.shake(ANCHOR_SHAKE_FRAMES);
    world.smashWarpAt(this.tx);
    world.events.push({ type: 'anchor' });
  }

  render(r: Renderer, view: View): void {
    if (this.phase === 'wait' || this.phase === 'warn') return;
    const x = this.tx * 16 - 8 - view.camX;
    const sheet = view.assets.sheet(CHAIN_SHEET);
    // Falling, it trails its chain from above the screen; at rest the Vine draws the chain.
    if (this.phase === 'fall')
      for (let y = Math.round(this.top) - 16; y > -32; y -= 16) r.sprite(sheet, CHAIN_FRAME, x + 8, y);
    r.sprite(sheet, ANCHOR_FRAME, x, Math.round(this.top));
  }
}
