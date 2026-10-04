import { px } from '@engine/math/units';
import type { InputFrame } from '@engine/input/input-manager';
import type { CharacterDef, SpriteSpec } from '../character';
import type { MovementProfile } from '../profile';
import type { Player } from '../../entities/player';
import type { World } from '../../world/world';
import { Projectile } from '../../entities/projectiles/projectile';
import { STAR_FRAMES } from '../../constants';
import { BILL_GUIDE } from './guide';
import { activeTool, cycleTool, type ToolInfo } from '../toolbelt';
import { GUNS, type Gun } from './weapons';

/** Commando: fast run, fixed somersault jump, eight-way rifle, goes prone. */
export const BILL_PROFILE: MovementProfile = {
  // TUNED by feel, not cited from any game.
  minWalk: 0x00400,
  walkAccel: 0x00400,
  runAccel: 0x00400,
  releaseDecel: 0x00800,
  skidDecel: 0x00800,
  maxWalk: 0x01800, // 1.5 px/f
  maxRun: 0x01800,
  skidTurnaround: 0x00800,
  jump: [{ maxVx: Infinity, initial: 0x05000, holdGravity: 0x00300, fallGravity: 0x00300 }], // apex ≈ 4 tiles
  maxFall: 0x04800,
  fallReset: 0x04000,
  runTimerFrames: 0,
  airControl: 'full',
  canRun: false,
  variableJump: false,
  instantAccel: false,
  coyoteFrames: 0,
};

export const START_HITS = 3;
export const MAX_HITS = 5;
const SHOOT_POSE_FRAMES = 10;

/** Scratch keys: guns (unlocked count beyond the rifle), tool, autoT, aimX, aimY. */
function unlocked(p: Player): Gun[] {
  return GUNS.slice(0, 1 + (p.scratch.guns ?? 0));
}
function tools(p: Player): ToolInfo[] {
  return unlocked(p).map((g) => ({ id: g.id, icon: g.icon, count: null, usable: true }));
}
function gun(p: Player): Gun {
  return unlocked(p).find((g) => g.id === activeTool(p, tools(p))?.id) ?? (GUNS[0] as Gun);
}

/** Eight-way aim from the d-pad: straight up when standing still with up, down only in the air. */
function aim(p: Player, input: InputFrame): { x: number; y: number } {
  const b = p.body;
  const up = input.held('up');
  const down = input.held('down') && !b.onGround;
  const dx = input.dirX;
  if (p.crouching) return { x: p.facing, y: 0 };
  if (up && dx === 0) return { x: 0, y: -1 };
  if (down && dx === 0) return { x: 0, y: 1 };
  if (up) return { x: dx, y: -1 };
  if (down) return { x: dx, y: 1 };
  return { x: p.facing, y: 0 };
}

function sprite(p: Player, frame: number, reduceFlashing: boolean): SpriteSpec {
  let palette = 'bill';
  if (p.star > 0) palette = `bill-star-${reduceFlashing ? 0 : (frame >> 1) & 3}`;
  const b = p.body;
  const ax = p.scratch.aimX ?? p.facing;
  const ay = p.scratch.aimY ?? 0;
  let name: string;
  let offsetY = 8;
  if (p.dead) name = 'die';
  else if (p.anim === 'hurt') name = 'hurt';
  else if (p.crouching) {
    name = 'prone';
    offsetY = 24;
  } else if (!b.onGround)
    name =
      p.attackTimer > 0 && ay !== 0 ? (ay < 0 ? 'aim-diag-up' : 'aim-diag-down') : `spin-${(frame >> 2) & 3}`;
  else if (ay < 0 && ax === 0) name = 'aim-up';
  else if (ay < 0) name = 'aim-diag-up';
  else if (p.anim === 'walk' || p.anim === 'skid') name = `walk-${p.walkFrame}`;
  else name = p.attackTimer > 0 ? 'shoot' : 'idle';
  return { sheet: 'bill', palette, frame: name, flip: p.facing < 0, offsetX: 2, offsetY };
}

function fire(p: Player, g: Gun, input: InputFrame, world: World): void {
  const out = world.countProjectiles(p, g.spec.kind);
  if (out + g.fan > g.maxOut) return;
  const b = p.body;
  const a = aim(p, input);
  const baseAngle = Math.atan2(a.y, a.x === 0 && a.y === 0 ? p.facing : a.x);
  const spec = g.spec;
  const cx = b.x + (b.w >> 1);
  const cy = p.crouching ? b.y + px(4) : b.y + px(11); // hip height: level with short enemies
  for (let i = 0; i < g.fan; i++) {
    const ang = baseAngle + ((i - (g.fan - 1) / 2) * g.fanDeg * Math.PI) / 180;
    const vx = Math.round(Math.cos(ang) * spec.speed);
    const vy = Math.round(Math.sin(ang) * spec.speed);
    const x = cx - px(spec.w >> 1) + Math.round(Math.cos(ang) * px(10));
    const y = cy - px(spec.h >> 1) + Math.round(Math.sin(ang) * px(10));
    world.spawn(new Projectile(x, y, (vx >= 0 ? 1 : -1) as 1 | -1, spec, p, { vx, vy }));
  }
  world.audio.sfx(g.id === 'laser' ? 'magic' : 'buster');
  p.attackTimer = SHOOT_POSE_FRAMES;
}

export const BILL: CharacterDef = {
  id: 'bill',
  name: 'Bill',
  hudName: 'BILL',
  movement: BILL_PROFILE,
  damage: {
    kind: 'hp',
    max: MAX_HITS,
    hudStyle: 'bar',
    invulnFrames: 90,
    knockback: { vx: 0x00800, vy: 0x02000 },
  },
  startHp: START_HITS,
  stomps: false,
  crouches: true,
  canBreakBricks: () => true,
  hitbox: (p) => (p.crouching ? { w: 12, h: 8 } : { w: 12, h: 24 }),
  sprite,
  blockPowerUp: (p) => ((p.scratch.guns ?? 0) < GUNS.length - 1 ? 'flower' : 'mushroom'),
  jumpSfx: () => 'jump-small',
  portrait: { sheet: 'bill', palette: 'bill', frame: 'idle' },
  tools,
  devKit: () => ({ guns: GUNS.length - 1, maxHp: MAX_HITS }),
  drop(rng) {
    const r = rng.int(12);
    if (r === 0) return 'capsule';
    if (r < 3) return 'health-small';
    return null;
  },
  guide: BILL_GUIDE,
  behaviour: {
    update(p, input, world) {
      cycleTool(p, input, tools(p), world);
      if (p.stun > 0 || p.transition) return;
      const a = aim(p, input);
      p.scratch.aimX = a.x;
      p.scratch.aimY = a.y;
      const g = gun(p);
      if (p.scratch.autoT) p.scratch.autoT--;
      const wantFire =
        input.pressed('attack') ||
        input.pressed('special') ||
        (g.auto > 0 && input.held('attack') && !p.scratch.autoT);
      if (wantFire) {
        fire(p, g, input, world);
        if (g.auto > 0) p.scratch.autoT = g.auto;
      }
    },
    onPickup(p, kind, world) {
      switch (kind) {
        case 'capsule':
          if ((p.scratch.guns ?? 0) >= GUNS.length - 1) return false;
          p.scratch.guns = (p.scratch.guns ?? 0) + 1;
          p.scratch.tool = p.scratch.guns; // switch to the new gun like a capsule would
          world.audio.sfx('powerup');
          return true;
        case 'health-small':
          if (p.hp >= (p.scratch.maxHp ?? START_HITS)) return false;
          p.hp += 1;
          world.audio.sfx('pickup');
          return true;
        default:
          return false;
      }
    },
    onPowerUp(p, kind, world) {
      switch (kind) {
        case 'mushroom': {
          // One more hit, up to five.
          const max = Math.min(MAX_HITS, (p.scratch.maxHp ?? START_HITS) + 1);
          p.scratch.maxHp = max;
          p.hp = max;
          world.addScore(1000, p.body.x, p.body.y - px(16));
          world.audio.sfx('powerup');
          break;
        }
        case 'flower': {
          const n = p.scratch.guns ?? 0;
          if (n < GUNS.length - 1) {
            p.scratch.guns = n + 1;
            p.scratch.tool = n + 1;
          } else p.hp = p.scratch.maxHp ?? START_HITS;
          world.addScore(1000, p.body.x, p.body.y - px(16));
          world.audio.sfx('powerup');
          break;
        }
        case 'star':
          p.star = STAR_FRAMES;
          world.addScore(1000, p.body.x, p.body.y - px(16));
          world.audio.playMusic('star');
          break;
        case '1up':
          world.addLife(p.body.x, p.body.y - px(16));
          break;
      }
    },
    contactDamage() {
      return null;
    },
    onHurt(p, world) {
      p.hp -= 1;
      if (p.hp <= 0) {
        p.hp = 0;
        return 'dead';
      }
      p.invuln = 90;
      world.audio.sfx('hit');
      return 'hurt';
    },
  },
};
