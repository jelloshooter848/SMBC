import { px } from '@engine/math/units';
import type { CharacterDef, SpriteSpec } from '../character';
import type { MovementProfile } from '../profile';
import type { Player } from '../../entities/player';
import type { World } from '../../world/world';
import { Projectile } from '../../entities/projectiles/projectile';
import { STAR_FRAMES } from '../../constants';
import { SIMON_GUIDE } from './guide';
import { STUN_FRAMES } from '../../rules/damage';
import { activeTool, cycleTool, type ToolInfo } from '../toolbelt';
import { beltButton, toolButton } from '../../touch-labels';
import { SUB_WEAPONS, WHIP_FRAMES, WHIP_REACH, type SubWeapon } from './weapons';

/** Vampire hunter: slow walk, a committed fixed-arc jump, a whip with a wind-up. */
export const SIMON_PROFILE: MovementProfile = {
  // TUNED by feel, not cited from any game.
  minWalk: 0x00100,
  walkAccel: 0x00200,
  runAccel: 0x00200,
  releaseDecel: 0x00400,
  skidDecel: 0x00400,
  maxWalk: 0x01000, // 1 px/f
  maxRun: 0x01000,
  skidTurnaround: 0x00400,
  jump: [{ maxVx: Infinity, initial: 0x04800, holdGravity: 0x00280, fallGravity: 0x00280 }], // apex ≈ 4 tiles
  maxFall: 0x04800,
  fallReset: 0x04000,
  runTimerFrames: 0,
  airControl: 'none', // the jump arc is committed at takeoff
  canRun: false,
  variableJump: false,
  instantAccel: false,
  coyoteFrames: 0,
};

export const MAX_HP = 16;
export const START_HEARTS = 5;
export const MAX_HEARTS = 99;
export const MAX_MULTI = 3;
const HIT_DAMAGE = 2;
const WHIP_FRAMES_TOTAL = 18;
const THROW_FRAMES = 12;

/** Scratch keys: whip (0..2), subs (unlocked count), multi (1..3), hearts, tool, throwT. */
function hearts(p: Player): number {
  return p.scratch.hearts ?? START_HEARTS;
}
function whipLevel(p: Player): number {
  return Math.min(WHIP_REACH.length - 1, p.scratch.whip ?? 0);
}
function multi(p: Player): number {
  return Math.max(1, Math.min(MAX_MULTI, p.scratch.multi ?? 1));
}
function unlocked(p: Player): SubWeapon[] {
  return SUB_WEAPONS.slice(0, p.scratch.subs ?? 0);
}

function tools(p: Player): ToolInfo[] {
  return unlocked(p).map((w) => ({ id: w.id, icon: w.icon, count: hearts(p), usable: hearts(p) >= w.cost }));
}

function sprite(p: Player, frame: number, reduceFlashing: boolean): SpriteSpec {
  let palette = 'simon';
  if (p.star > 0) palette = `simon-star-${reduceFlashing ? 0 : (frame >> 1) & 3}`;
  let name: string;
  const t = p.attackTimer;
  if (p.dead) name = 'die';
  else if (p.anim === 'hurt') name = 'hurt';
  else if ((p.scratch.throwT ?? 0) > 0) name = 'throw';
  else if (t > 0) {
    // Wind-up, swing, strike (the strike frame carries the whip itself).
    if (t > WHIP_FRAMES_TOTAL - 6) name = 'whip-0';
    else if (t > WHIP_FRAMES_TOTAL - 10) name = 'whip-1';
    else name = (p.crouching ? 'crouch-' : '') + WHIP_FRAMES[whipLevel(p)];
  } else if (p.crouching) name = 'crouch';
  else if (!p.body.onGround) name = 'jump';
  else if (p.anim === 'walk' || p.anim === 'skid') name = `walk-${p.walkFrame}`;
  else name = 'idle';
  return {
    sheet: 'simon',
    palette,
    frame: name,
    flip: p.facing < 0,
    offsetX: 2,
    offsetY: p.crouching ? 16 : 8,
  };
}

/** Sub-weapon projectiles in flight count against the shot multiplier. */
function subShotsOut(p: Player, world: World): number {
  let n = 0;
  for (const e of world.entities)
    if (e instanceof Projectile && e.alive && e.owner === p && SUB_WEAPONS.some((w) => w.id === e.kind)) n++;
  return n;
}

function throwSub(p: Player, world: World): void {
  const w = unlocked(p).find((s) => s.id === activeTool(p, tools(p))?.id);
  if (!w) return;
  if (hearts(p) < w.cost) {
    world.audio.sfx('bump');
    return;
  }
  if (w.spec) {
    if (subShotsOut(p, world) >= multi(p)) return;
    const b = p.body;
    const spec = w.spec;
    const x = p.facing > 0 ? b.x + b.w : b.x - px(spec.w);
    world.spawn(new Projectile(x, b.y + px(4), p.facing, spec, p));
    world.audio.sfx(w.id === 'dagger' ? 'buster' : 'boomerang');
  } else {
    // Stopwatch: everything on screen freezes.
    let any = false;
    for (const e of world.enemies) {
      if (e.body.x + e.body.w < world.camera.x || e.body.x > world.camera.right) continue;
      e.stunned = STUN_FRAMES;
      any = true;
    }
    if (!any) return;
    world.audio.sfx('magic');
  }
  p.scratch.hearts = hearts(p) - w.cost;
  p.scratch.throwT = THROW_FRAMES;
  p.attackTimer = 0;
  p.activeMelee = null;
}

/** Touch captions for the belt (C shows the selected one). */
export const SIMON_TOOL_LABELS: Record<string, string> = {
  dagger: 'DAGGER',
  'hand-axe': 'AXE',
  'holy-water': 'WATER',
  cross: 'CROSS',
  stopwatch: 'WATCH',
};

export const SIMON: CharacterDef = {
  id: 'simon',
  name: 'Simon',
  hudName: 'SIMON',
  movement: SIMON_PROFILE,
  damage: {
    kind: 'hp',
    max: MAX_HP,
    hudStyle: 'bar',
    invulnFrames: 60,
    knockback: { vx: 0x01800, vy: 0x02800 },
  },
  stomps: false,
  crouches: true,
  canBreakBricks: () => true,
  hitbox: (p) => (p.crouching ? { w: 12, h: 16 } : { w: 12, h: 24 }),
  sprite,
  blockPowerUp: (p) =>
    whipLevel(p) < WHIP_REACH.length - 1 && (p.scratch.whip ?? 0) < WHIP_REACH.length - 1
      ? 'flower'
      : (p.scratch.subs ?? 0) < SUB_WEAPONS.length
        ? 'mushroom'
        : multi(p) < MAX_MULTI
          ? 'flower'
          : 'mushroom',
  jumpSfx: () => 'jump-big',
  portrait: { sheet: 'simon', palette: 'simon', frame: 'idle' },
  tools,
  devKit: () => ({
    whip: WHIP_REACH.length - 1,
    subs: SUB_WEAPONS.length,
    multi: MAX_MULTI,
    hearts: MAX_HEARTS,
  }),
  drop(rng) {
    const r = rng.int(10);
    if (r < 3) return 'heart-small';
    if (r === 3) return 'heart-large';
    return null;
  },
  guide: SIMON_GUIDE,
  touchLabels(p) {
    const belt = tools(p);
    return {
      attack: 'WHIP',
      special: toolButton(belt, p, SIMON_TOOL_LABELS),
      select: beltButton(belt, 'TOOLS'),
    };
  },
  behaviour: {
    update(p, input, world) {
      const b = p.body;
      if (p.scratch.throwT) p.scratch.throwT--;
      cycleTool(p, input, tools(p), world);
      if (p.stun > 0 || p.transition) {
        p.activeMelee = null;
        return;
      }
      const wantThrow = input.pressed('special') || (input.pressed('attack') && input.held('up'));
      if (wantThrow && p.attackTimer === 0 && !p.scratch.throwT) {
        throwSub(p, world);
        return;
      }
      if (input.pressed('attack') && p.attackTimer === 0 && !p.scratch.throwT) {
        p.attackTimer = WHIP_FRAMES_TOTAL;
        world.audio.sfx('whip');
      }
      // The lash is live for the strike frames after the wind-up.
      const t = p.attackTimer;
      if (t > 0 && t <= WHIP_FRAMES_TOTAL - 10 && t >= 3) {
        const reach = px(WHIP_REACH[whipLevel(p)] as number);
        const y = b.y + px(6);
        p.activeMelee =
          p.facing > 0 ? { x: b.x + b.w, y, w: reach, h: px(6) } : { x: b.x - reach, y, w: reach, h: px(6) };
      } else p.activeMelee = null;
    },
    onPickup(p, kind, world) {
      if (kind !== 'heart-small' && kind !== 'heart-large') return false;
      if (hearts(p) >= MAX_HEARTS) return false;
      p.scratch.hearts = Math.min(MAX_HEARTS, hearts(p) + (kind === 'heart-small' ? 1 : 5));
      world.audio.sfx('pickup');
      return true;
    },
    onPowerUp(p, kind, world) {
      switch (kind) {
        case 'mushroom': {
          const n = p.scratch.subs ?? 0;
          if (n < SUB_WEAPONS.length) p.scratch.subs = n + 1;
          else p.scratch.hearts = Math.min(MAX_HEARTS, hearts(p) + 10);
          p.hp = MAX_HP;
          world.addScore(1000, p.body.x, p.body.y - px(16));
          world.audio.sfx('powerup');
          break;
        }
        case 'flower':
          if ((p.scratch.whip ?? 0) < WHIP_REACH.length - 1) p.scratch.whip = (p.scratch.whip ?? 0) + 1;
          else if (multi(p) < MAX_MULTI) p.scratch.multi = multi(p) + 1;
          else p.scratch.hearts = Math.min(MAX_HEARTS, hearts(p) + 10);
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
