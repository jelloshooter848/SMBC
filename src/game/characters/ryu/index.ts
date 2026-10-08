import { px } from '@engine/math/units';
import type { CharacterDef, MeterInfo, SpriteSpec } from '../character';
import type { MovementProfile } from '../profile';
import type { Player } from '../../entities/player';
import type { World } from '../../world/world';
import { Projectile } from '../../entities/projectiles/projectile';
import { STAR_FRAMES } from '../../constants';
import { RYU_GUIDE } from './guide';
import { activeTool, cycleTool, type ToolInfo } from '../toolbelt';
import { beltButton, toolButton } from '../../touch-labels';
import { NINPO_ARTS, type NinpoArt } from './weapons';

/** Ninja: fast run, cut-able jump, clings to walls and kicks off them. */
export const RYU_PROFILE: MovementProfile = {
  // TUNED by feel, not cited from any game.
  minWalk: 0x00400,
  walkAccel: 0x00400,
  runAccel: 0x00400,
  releaseDecel: 0x00600,
  skidDecel: 0x00600,
  maxWalk: 0x01800, // 1.5 px/f
  maxRun: 0x01800,
  skidTurnaround: 0x00800,
  jump: [{ maxVx: Infinity, initial: 0x05000, holdGravity: 0x00300, fallGravity: 0x00300 }], // apex ≈ 4 tiles
  maxFall: 0x04800,
  fallReset: 0x04000,
  runTimerFrames: 0,
  airControl: 'full',
  canRun: false,
  variableJump: 'cut',
  instantAccel: false,
  coyoteFrames: 0,
  // Under water (0.4.25, TUNED by feel): a strong, quick stroke and a slow sink.
  swim: { stroke: 0x02000, gravity: 0x000c0, sinkMax: 0x01800 },
};

export const MAX_HP = 16;
export const START_NINPO = 40;
export const MAX_NINPO = 99;
export const NINPO_PER_FLOWER = 20;
const HIT_DAMAGE = 2;
const SLASH_FRAMES = 10;
const THROW_FRAMES = 10;
const SPIN_FRAMES = 36;

/** Scratch keys: arts (unlocked count), tool, ninpo, ninpoMax, spin, throwT. */
function ninpoMax(p: Player): number {
  return p.scratch.ninpoMax ?? START_NINPO;
}
function ninpo(p: Player): number {
  return p.scratch.ninpo ?? ninpoMax(p);
}
function unlocked(p: Player): NinpoArt[] {
  return NINPO_ARTS.slice(0, p.scratch.arts ?? 0);
}
function tools(p: Player): ToolInfo[] {
  return unlocked(p).map((a) => ({ id: a.id, icon: a.icon, count: null, usable: ninpo(p) >= a.cost }));
}
function meter(p: Player): MeterInfo | null {
  if (!unlocked(p).length) return null;
  return { value: ninpo(p), max: ninpoMax(p), colour: '#3cbcfc', label: 'N' };
}

function sprite(p: Player, frame: number, reduceFlashing: boolean): SpriteSpec {
  let palette = 'ryu';
  if (p.star > 0) palette = `ryu-star-${reduceFlashing ? 0 : (frame >> 1) & 3}`;
  const b = p.body;
  let name: string;
  const t = p.attackTimer;
  if (p.dead) name = 'die';
  else if (p.anim === 'hurt') name = 'hurt';
  else if ((p.scratch.spin ?? 0) > 0) name = `spin-${(frame >> 1) & 3}`;
  else if (p.clinging) name = 'cling';
  else if ((p.scratch.throwT ?? 0) > 0) name = 'throw';
  else if (t > 0) name = p.crouching ? 'crouch-slash' : t > SLASH_FRAMES - 3 ? 'slash-0' : 'slash-1';
  else if (p.crouching) name = 'crouch';
  else if (p.anim === 'swim') name = `swim-${(frame >> 3) & 1}`;
  else if (!b.onGround) name = 'jump';
  else if (p.anim === 'walk' || p.anim === 'skid') name = `walk-${p.walkFrame}`;
  else name = 'idle';
  return {
    sheet: 'ryu',
    palette,
    frame: name,
    flip: p.facing < 0,
    offsetX: 2,
    offsetY: p.crouching ? 16 : 8,
  };
}

function spend(p: Player, art: NinpoArt, world: World): boolean {
  if (ninpo(p) < art.cost) {
    world.audio.sfx('bump');
    return false;
  }
  p.scratch.ninpo = ninpo(p) - art.cost;
  return true;
}

function cast(p: Player, world: World): void {
  const art = unlocked(p).find((a) => a.id === activeTool(p, tools(p))?.id);
  if (!art) return;
  const b = p.body;
  switch (art.id) {
    case 'throwing-star': {
      if (world.countProjectiles(p, art.id) >= 2) return;
      if (!spend(p, art, world)) return;
      const spec = art.spec as NonNullable<NinpoArt['spec']>;
      const x = p.facing > 0 ? b.x + b.w : b.x - px(spec.w);
      world.spawn(new Projectile(x, b.y + px(6), p.facing, spec, p));
      world.audio.sfx('buster');
      p.scratch.throwT = THROW_FRAMES;
      break;
    }
    case 'windmill': {
      if (world.countProjectiles(p, art.id) > 0) return;
      if (!spend(p, art, world)) return;
      const spec = art.spec as NonNullable<NinpoArt['spec']>;
      const x = p.facing > 0 ? b.x + b.w : b.x - px(spec.w);
      world.spawn(new Projectile(x, b.y + px(4), p.facing, spec, p));
      world.audio.sfx('boomerang');
      p.scratch.throwT = THROW_FRAMES;
      break;
    }
    case 'fire-wheel': {
      if (world.countProjectiles(p, art.id) > 0) return;
      if (!spend(p, art, world)) return;
      const spec = art.spec as NonNullable<NinpoArt['spec']>;
      const cx = b.x + (b.w >> 1) - px(spec.w >> 1);
      const cy = b.y + (b.h >> 1) - px(spec.h >> 1);
      for (const angle of [0, 120, 240]) world.spawn(new Projectile(cx, cy, p.facing, spec, p, { angle }));
      world.audio.sfx('magic');
      break;
    }
    case 'slash':
      if ((p.scratch.spin ?? 0) > 0) return;
      if (!spend(p, art, world)) return;
      p.scratch.spin = SPIN_FRAMES;
      if (b.onGround) {
        b.vy = -0x04000;
        b.onGround = false;
      }
      world.audio.sfx('sword');
      break;
  }
}

/**
 * Touch captions for the belt (C shows the selected one), sized by fitLabel: SHURIKEN and
 * WINDMILL are long single words, so they shrink (down to LABEL_LONG_WORD_MIN_PX).
 */
export const RYU_TOOL_LABELS: Record<string, string> = {
  'throwing-star': 'SHURIKEN',
  windmill: 'WINDMILL',
  'fire-wheel': 'WHEEL',
  slash: 'SPIN',
};

export const RYU: CharacterDef = {
  id: 'ryu',
  name: 'Ryu',
  hudName: 'RYU',
  movement: RYU_PROFILE,
  damage: {
    kind: 'hp',
    max: MAX_HP,
    hudStyle: 'bar',
    invulnFrames: 60,
    knockback: { vx: 0x01000, vy: 0x02000 },
  },
  stomps: false,
  crouches: true,
  canBreakBricks: () => true,
  hitbox: (p) => (p.crouching ? { w: 12, h: 16 } : { w: 12, h: 24 }),
  sprite,
  blockPowerUp: (p) => ((p.scratch.arts ?? 0) < NINPO_ARTS.length ? 'mushroom' : 'flower'),
  jumpSfx: () => 'jump-small',
  portrait: { sheet: 'ryu', palette: 'ryu', frame: 'idle' },
  tools,
  meter,
  devKit: () => ({ arts: NINPO_ARTS.length, ninpoMax: MAX_NINPO, ninpo: MAX_NINPO }),
  drop(rng) {
    const r = rng.int(10);
    if (r < 3) return 'ninpo-small';
    if (r === 3) return 'ninpo-large';
    if (r === 4) return 'health-small';
    return null;
  },
  guide: RYU_GUIDE,
  touchLabels(p) {
    const belt = tools(p);
    return {
      attack: 'SLASH',
      special: toolButton(belt, p, RYU_TOOL_LABELS),
      select: beltButton(belt, 'NINPO'),
    };
  },
  behaviour: {
    update(p, input, world) {
      const b = p.body;
      if (p.scratch.throwT) p.scratch.throwT--;
      cycleTool(p, input, tools(p), world);
      if (p.stun > 0 || p.transition) {
        p.activeMelee = null;
        p.clinging = false;
        p.scratch.spin = 0;
        return;
      }
      // Wall cling: airborne, pressing into a wall. Landing or letting go releases it.
      const dir = input.dirX;
      p.clinging =
        !b.onGround && p.clingLock === 0 && dir !== 0 && b.hitWall === dir && (p.scratch.spin ?? 0) === 0;
      if (p.clinging && dir !== 0) p.facing = dir;
      // Jump-and-slash: the whole body is a blade while spinning.
      const spin = p.scratch.spin ?? 0;
      if (spin > 0) {
        p.scratch.spin = b.onGround && spin < SPIN_FRAMES - 4 ? 0 : spin - 1;
        p.activeMelee = { x: b.x - px(4), y: b.y - px(4), w: b.w + px(8), h: b.h + px(8) };
        return;
      }
      if (input.pressed('special') && p.attackTimer === 0 && !p.scratch.throwT) {
        cast(p, world);
        return;
      }
      if (input.pressed('attack') && p.attackTimer === 0 && !p.scratch.throwT && !p.clinging) {
        p.attackTimer = SLASH_FRAMES;
        world.audio.sfx('sword');
      }
      const t = p.attackTimer;
      if (t > 0 && t <= SLASH_FRAMES - 2 && t >= 2) {
        const y = b.y + (p.crouching ? px(6) : px(5));
        p.activeMelee =
          p.facing > 0
            ? { x: b.x + b.w, y, w: px(12), h: px(6) }
            : { x: b.x - px(12), y, w: px(12), h: px(6) };
      } else p.activeMelee = null;
    },
    onPickup(p, kind, world) {
      switch (kind) {
        case 'ninpo-small':
        case 'ninpo-large':
          if (ninpo(p) >= ninpoMax(p)) return false;
          p.scratch.ninpo = Math.min(ninpoMax(p), ninpo(p) + (kind === 'ninpo-small' ? 5 : 10));
          world.audio.sfx('pickup');
          return true;
        case 'health-small':
          if (p.hp >= MAX_HP) return false;
          p.hp = Math.min(MAX_HP, p.hp + 4);
          world.audio.sfx('pickup');
          return true;
        default:
          return false;
      }
    },
    onPowerUp(p, kind, world) {
      switch (kind) {
        case 'mushroom': {
          const n = p.scratch.arts ?? 0;
          if (n < NINPO_ARTS.length) p.scratch.arts = n + 1;
          p.hp = MAX_HP;
          world.addScore(1000, p.body.x, p.body.y - px(16));
          world.audio.sfx('powerup');
          break;
        }
        case 'flower':
          p.scratch.ninpoMax = Math.min(MAX_NINPO, ninpoMax(p) + NINPO_PER_FLOWER);
          p.scratch.ninpo = ninpoMax(p);
          p.hp = MAX_HP;
          world.addScore(1000, p.body.x, p.body.y - px(16));
          world.audio.sfx('powerup');
          break;
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
      p.hp -= HIT_DAMAGE;
      if (p.hp <= 0) {
        p.hp = 0;
        return 'dead';
      }
      p.invuln = 60;
      p.attackTimer = 0;
      p.activeMelee = null;
      world.audio.sfx('hit');
      return 'hurt';
    },
  },
};
