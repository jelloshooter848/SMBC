import type { Renderer } from '@engine/gfx/renderer';
import type { InputFrame } from '@engine/input/input-manager';
import { px, tileAt, toPx } from '@engine/math/units';
import { overlaps } from '@engine/math/aabb';
import { Entity, type View } from '../../entities/entity';
import { groundBelow } from '../../entities/body';
import { Projectile, type ProjectileSpec } from '../../entities/projectiles/projectile';
import type { Player } from '../../entities/player';
import type { World } from '../../world/world';
import type { SpriteSpec } from '../character';
import {
  JASON_H,
  JASON_HOP,
  JASON_PROFILE,
  JASON_SAFE_FALL,
  JASON_W,
  SOPHIA_PROFILE,
  TANK_H,
  TANK_W,
} from './profile';
import { FLOOR, SOUNDS, sophiaState, type SophiaState } from './state';
import { SOPHIA_SHEET } from './weapons';
import { unstick } from './drive';

/*
 * Jason on foot (our own design; in the original Crossover he only hops out on the select
 * screen). EXIT (Select) on the floor: the hatch opens and Jason hops out; the tank stays parked
 * where it was, solid to stand on, ignored by enemies and shots. He is small (8 x 16: he fits
 * one-tile gaps), walks slowly, hops low, fires a short-range gun and climbs vines and ladders.
 * A fall of more than five tiles hurts him, as in Blaster Master. A hit while he is out works on
 * the hero's shared power state, as a hit on the tank would: Hyper or Crusher drop to Normal, a
 * hit at Normal is a lost life. UP or EXIT beside the tank (touching it) climbs back in. Pipes,
 * vines to other areas, the flagpole and level exits work for him as for any hero; the tank
 * comes along (the next area starts with Jason back in it).
 */

/** Frames after hopping out before he can climb back in. */
const BOARD_LOCK = 20;
/** Jason's gun: a short-range pea shot, armour shrugs it off (a `fireball`, 1 hit point). */
export const JASON_SHOT: ProjectileSpec = {
  kind: 'jason-shot',
  damage: 'fireball',
  amount: 1,
  speed: 0x03000,
  gravity: 0,
  bounceVy: null,
  hitsTiles: true,
  hitsEnemies: true,
  hitsPlayer: false,
  lifetime: 22,
  w: 4,
  h: 4,
  sheet: SOPHIA_SHEET,
  frames: ['jason-shot'],
  frameRate: 1,
};
const JASON_SHOTS_OUT = 2;

/**
 * The tank, parked while Jason is out: drawn with its hatch open, solid to stand on (a player
 * landing on it stands there, like on a lift), nothing else touches it.
 */
export class ParkedTank extends Entity {
  readonly kind = 'parked-tank';
  constructor(
    x: number,
    y: number,
    readonly owner: Player,
    readonly face: -1 | 1,
  ) {
    super(x, y, TANK_W, TANK_H);
    this.despawnMargin = null;
    // Jason can't wander off and strand it: the screen stays on the tank.
    this.anchorsCamera = true;
    this.layer = 'main';
  }

  update(world: World): void {
    // Its hero gone (out of lives in co-op) or back in another tank: nothing to keep it, nor the
    // camera on it.
    if (this.owner.out || sophiaState(this.owner).jason?.tank !== this) {
      this.alive = false;
      return;
    }
    const top = this.body.y;
    for (const p of world.activePlayers()) {
      const b = p.body;
      if (p.vine || b.vy < 0) continue;
      if (b.x >= this.body.x + this.body.w || b.x + b.w <= this.body.x) continue;
      const feet = b.y + b.h;
      if (b.prevBottom <= top + px(2) && feet >= top && feet <= top + px(10)) {
        b.y = top - b.h;
        b.vy = 0;
        b.onGround = true;
      }
    }
  }

  render(r: Renderer, view: View): void {
    const sheet = view.assets.sheet(SOPHIA_SHEET, hull(this.owner));
    const f = sheet.frames.get('open');
    const cx = toPx(this.body.x + (this.body.w >> 1)) - view.camX;
    const cy = toPx(this.body.y + (this.body.h >> 1));
    r.sprite(sheet, 'open', cx - ((f?.w ?? 32) >> 1), cy - ((f?.h ?? 32) >> 1), this.face < 0);
  }
}

/** The hull palette for a power state. */
export function hull(p: Player): string {
  return p.powerState === 'fire' ? 'sophia-crusher' : p.powerState === 'big' ? 'sophia-hyper' : 'sophia';
}

/** Room above the tank for Jason to stand in (his 16 px over its top). */
function roomAbove(world: World, p: Player): boolean {
  const b = p.body;
  const cx = b.x + (b.w >> 1);
  const top = b.y - px(JASON_H);
  for (let ty = tileAt(top); ty <= tileAt(b.y - 1); ty++)
    for (let tx = tileAt(cx - px(JASON_W / 2)); tx <= tileAt(cx + px(JASON_W / 2) - 1); tx++)
      if (world.map.isSolid(tx, ty)) return false;
  return true;
}

/** EXIT on the floor: the hatch opens and Jason hops out on top of the parked tank. */
export function hopOut(p: Player, st: SophiaState, world: World): boolean {
  const b = p.body;
  if (st.jason || st.nose || st.surface !== FLOOR || st.turn || st.squat > 0 || st.push || !b.onGround)
    return false;
  if (p.vine || p.stairs || !roomAbove(world, p)) return false;
  // Not on an auto-scrolling screen (it would carry the tank off), and only on solid ground: not
  // riding a lift or a spring, which would leave the tank hanging. A locked one-screen room is
  // fine: the tank can never leave it.
  if (world.camera.auto || !groundBelow(b, world.map)) return false;
  const tank = new ParkedTank(b.x, b.y, p, p.facing);
  world.spawn(tank);
  const cx = b.x + (b.w >> 1);
  const top = b.y;
  b.w = px(JASON_W);
  b.h = px(JASON_H);
  b.x = cx - (b.w >> 1);
  b.y = top - b.h;
  b.vx = 0;
  b.vy = -JASON_HOP;
  b.onGround = false;
  p.profile = { ...JASON_PROFILE, coyoteFrames: p.profile.coyoteFrames };
  st.jason = { tank, peak: b.y + b.h, grounded: false, lock: BOARD_LOCK };
  st.engaged = false;
  st.hovering = false;
  st.raise = 0;
  world.audio.sfx(SOUNDS.open);
  return true;
}

/** Back into the tank (beside it: UP or EXIT; or a respawn): the tank's box where it was parked. */
export function board(p: Player, st: SophiaState, world: World | null): void {
  const j = st.jason;
  if (!j) return;
  const b = p.body;
  const t = j.tank.body;
  if (world) {
    b.x = t.x;
    b.y = t.y;
    world.audio.sfx(SOUNDS.open);
  }
  j.tank.destroy();
  st.jason = null;
  b.w = px(TANK_W);
  b.h = px(TANK_H);
  b.vx = 0;
  b.vy = 0;
  b.onGround = world !== null;
  p.vine = null;
  p.profile = { ...SOPHIA_PROFILE, coyoteFrames: p.profile.coyoteFrames };
  p.facing = (j.tank as ParkedTank).face ?? p.facing;
}

/** Jason's frame: his own controls (the gun, getting back in) and the fall-damage check. */
export function jasonUpdate(p: Player, st: SophiaState, input: InputFrame, world: World): void {
  const j = st.jason;
  if (!j) return;
  const b = p.body;
  if (j.lock > 0) j.lock--;
  // The screen's edge can push him into a wall's corner (the camera never scrolls back).
  if (!p.vine) unstick(b, world.map);
  if (!j.tank.alive) {
    // Should never happen; fall back into the tank where he stands.
    board(p, st, null);
    return;
  }
  // Fall damage: his feet's highest point since he last stood, against where he lands.
  const feet = b.y + b.h;
  if (b.onGround || p.vine) {
    if (b.onGround && !j.grounded && feet - j.peak > px(JASON_SAFE_FALL))
      world.hurtPlayer(p, p.facing === 1 ? -1 : 1);
    j.peak = feet;
  } else j.peak = Math.min(j.peak, feet);
  j.grounded = b.onGround;
  if (p.dead || p.transition) return;
  // Touching the tank: beside it, in front of it, or standing on it.
  const touching = overlaps({ x: b.x - px(1), y: b.y, w: b.w + px(2), h: b.h + px(2) }, j.tank.body);
  if (j.lock === 0 && touching && (input.pressed('select') || input.pressed('up')) && !p.vine) {
    board(p, st, world);
    return;
  }
  if (input.pressed('attack') && !p.vine && world.countProjectiles(p, JASON_SHOT.kind) < JASON_SHOTS_OUT) {
    const x = p.facing > 0 ? b.x + b.w : b.x - px(JASON_SHOT.w);
    world.spawn(new Projectile(x, b.y + px(6), p.facing, JASON_SHOT, p));
    world.audio.sfx(SOUNDS.jasonShot);
    p.attackTimer = 8;
  }
}

/** Jason's sprite (16 x 16 over his 8 x 16 box, feet on the frame's bottom row). */
export function jasonSprite(p: Player, frame: number, reduceFlashing: boolean): SpriteSpec {
  let palette = hull(p);
  if (p.star > 0) palette = `sophia-star-${reduceFlashing ? 0 : (frame >> 1) & 3}`;
  let name: string;
  if (p.dead) name = 'jason-die';
  else if (p.invuln > 60) name = 'jason-hurt';
  else if (p.vine) name = `jason-climb-${(frame >> 3) & 1}`;
  else if (!p.body.onGround) name = 'jason-jump';
  else if (p.anim === 'walk' || p.anim === 'skid') name = `jason-walk-${p.walkFrame}`;
  else name = 'jason-stand';
  return { sheet: SOPHIA_SHEET, palette, frame: name, flip: p.facing < 0, offsetX: 4, offsetY: 0 };
}
