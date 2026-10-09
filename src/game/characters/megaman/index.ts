import { px } from '@engine/math/units';
import type { InputFrame } from '@engine/input/input-manager';
import type { CharacterDef, MeterInfo, SpriteSpec } from '../character';
import type { MovementProfile } from '../profile';
import type { Player } from '../../entities/player';
import type { World } from '../../world/world';
import { Projectile, BUSTER, CHARGED_BUSTER } from '../../entities/projectiles/projectile';
import { RushCoil } from '../../entities/objects/rush-coil';
import { STAR_FRAMES } from '../../constants';
import { MEGAMAN_GUIDE } from './guide';
import { activeTool, cycleTool, type ToolInfo } from '../toolbelt';
import { beltButton, toolButton } from '../../touch-labels';
import { RUSH, WEAPON_ENERGY, WEAPONS, type WeaponDef } from './weapons';
import { has, isFound } from '../../items/flags';

/** Robot boy: instant acceleration, tall cut-able jump, slide, arm cannon, hit-point bar. */
export const MEGAMAN_PROFILE: MovementProfile = {
  // TUNED by feel, not cited from any game.
  minWalk: 0x01600,
  walkAccel: 0x01600,
  runAccel: 0x01600,
  releaseDecel: 0x01600,
  skidDecel: 0x01600,
  maxWalk: 0x01600, // 1.375 px/f
  maxRun: 0x01600,
  skidTurnaround: 0,
  jump: [{ maxVx: Infinity, initial: 0x05800, holdGravity: 0x00380, fallGravity: 0x00380 }], // apex ≈ 4.3 tiles
  maxFall: 0x04800,
  fallReset: 0x04000,
  runTimerFrames: 0,
  airControl: 'full',
  canRun: false,
  variableJump: 'cut',
  instantAccel: true,
  coyoteFrames: 0,
  slide: { speed: 0x02800, frames: 26, hitboxH: 12 },
  // Under water (0.4.25, TUNED by feel after Bubble Man's stage): no stroke; he walks the seabed
  // and jumps off it about 9 tiles high, floating down slowly. The release cut still works.
  swim: { mode: 'seabed', stroke: 0x04000, gravity: 0x000e4, sinkMax: 0x01800 },
};

export const MAX_HP = 28;
export const MAX_ETANKS = 4;
const HIT_DAMAGE = 4;
const CHARGE_FRAMES = 40;
const SHOOT_POSE_FRAMES = 16;

/** Scratch keys: helmet, weapons (how many unlocked), tool, w<id> (energy), etanks, chargeT. */
function unlocked(p: Player): WeaponDef[] {
  // Campaign: each weapon is its own item (docs/POWERUPS.md 5.3), on the belt in WEAPONS order.
  if (isFound(p)) return WEAPONS.filter((w) => has(p, w.item));
  return WEAPONS.slice(0, p.scratch.weapons ?? 0);
}
/** Rush Coil is on the belt: with the helmet, or (campaign) once found as its own item. */
function hasRush(p: Player): boolean {
  return isFound(p) ? has(p, 'rush-coil') : !!p.scratch.helmet;
}
function energy(p: Player, id: string): number {
  return p.scratch[`w${id}`] ?? WEAPON_ENERGY;
}
export function setEnergy(p: Player, id: string, v: number): void {
  p.scratch[`w${id}`] = Math.max(0, Math.min(WEAPON_ENERGY, v));
}
function etanks(p: Player): number {
  return p.scratch.etanks ?? 0;
}

/**
 * The weapon belt: the weapons he has and Rush (0.4.35, owner: no "Buster" entry; the plain shot,
 * ATTACK, is always the buster, and charges with the helmet whatever is selected).
 */
function tools(p: Player): ToolInfo[] {
  const list: ToolInfo[] = [];
  for (const w of unlocked(p))
    list.push({ id: w.id, icon: w.icon, count: null, usable: energy(p, w.id) >= w.cost });
  if (hasRush(p))
    list.push({ id: RUSH.id, icon: RUSH.icon, count: null, usable: energy(p, RUSH.id) >= RUSH.cost });
  return list;
}

/** The selected weapon, or null for the buster / Rush. */
function selectedWeapon(p: Player): WeaponDef | null {
  const t = activeTool(p, tools(p));
  return (t && WEAPONS.find((w) => w.id === t.id)) ?? null;
}

function sprite(p: Player, frame: number, reduceFlashing: boolean): SpriteSpec {
  const t = activeTool(p, tools(p));
  const w = selectedWeapon(p);
  let palette = !p.scratch.helmet
    ? 'megaman-plain'
    : w
      ? w.palette
      : t?.id === 'rush'
        ? RUSH.palette
        : 'megaman';
  const charging = (p.scratch.chargeT ?? 0) > 12;
  if (charging) palette = `megaman-charge-${reduceFlashing ? 0 : (frame >> 2) % 3}`;
  if (p.star > 0) palette = `megaman-star-${reduceFlashing ? 0 : (frame >> 1) & 3}`;
  let name: string;
  const shooting = p.attackTimer > 0;
  if (p.dead || p.anim === 'hurt') name = 'hurt';
  else if (p.sliding > 0) name = 'slide';
  else {
    switch (p.anim) {
      case 'walk':
      case 'skid':
        name = shooting ? `walk-shoot-${p.walkFrame}` : `walk-${p.walkFrame}`;
        break;
      case 'jump':
        name = shooting ? 'jump-shoot' : 'jump';
        break;
      case 'climb':
        name = `climb-${(frame >> 3) & 1}`;
        break;
      case 'attack':
        name = 'shoot';
        break;
      default:
        name = shooting ? 'shoot' : charging ? 'charge-0' : (frame & 255) < 8 ? 'idle-blink' : 'idle';
    }
  }
  return {
    sheet: 'megaman',
    palette,
    frame: name,
    flip: p.facing < 0,
    offsetX: 2,
    offsetY: p.sliding > 0 ? 20 : 10,
  };
}

function fireBuster(p: Player, world: World, charged: boolean): void {
  const b = p.body;
  const spec = charged ? CHARGED_BUSTER : BUSTER;
  const x = p.facing > 0 ? b.x + b.w : b.x - px(spec.w);
  // The big charge shot is centred on his arm cannon (a 14 px blast around the buster's row).
  world.spawn(new Projectile(x, b.y + px(charged ? 4 : 8), p.facing, spec, p));
  world.audio.sfx(charged ? 'charge-shot' : 'buster');
  p.attackTimer = SHOOT_POSE_FRAMES;
}

/** Spend energy for a special shot; false (with a thud) when there isn't enough. */
function spend(p: Player, id: string, cost: number, world: World): boolean {
  if (energy(p, id) < cost) {
    world.audio.sfx('bump');
    return false;
  }
  setEnergy(p, id, energy(p, id) - cost);
  return true;
}

function fireWeapon(p: Player, w: WeaponDef, input: InputFrame, world: World): void {
  const b = p.body;
  // Leaf Guard: a second press throws the orbiting leaf.
  if (w.id === 'leaf') {
    const orbiting = world.entities.find(
      (e): e is Projectile =>
        e instanceof Projectile && e.alive && e.owner === p && e.kind === 'leaf' && !e.thrown,
    );
    if (orbiting) {
      orbiting.throw(p.facing);
      world.audio.sfx('buster');
      return;
    }
    if (world.countProjectiles(p, 'leaf') > 0) return;
  }
  if (w.id === 'knuckle' && world.countProjectiles(p, 'knuckle') > 0) return;
  if (!spend(p, w.id, w.cost, world)) return;
  const spec = w.spec;
  let x = p.facing > 0 ? b.x + b.w : b.x - px(spec.w);
  let y = b.y + px(8);
  const opts: { vx?: number; vy?: number } = {};
  if (w.id === 'saw') {
    // Eight-way aim from the d-pad; straight ahead when nothing is held.
    const dx = input.dirX;
    const dy = input.held('up') ? -1 : input.held('down') ? 1 : 0;
    if (dx !== 0 || dy !== 0) {
      const n = dx !== 0 && dy !== 0 ? 0.7071 : 1;
      opts.vx = Math.round(dx * spec.speed * n);
      opts.vy = Math.round(dy * spec.speed * n);
      if (dx === 0) x = b.x + (b.w >> 1) - px(spec.w >> 1);
    }
  }
  if (w.id === 'flame') y = b.y + b.h - px(spec.h);
  if (w.id === 'leaf') {
    x = b.x + (b.w >> 1) - px(spec.w >> 1);
    y = b.y - px(spec.h);
  }
  world.spawn(new Projectile(x, y, p.facing, spec, p, opts));
  world.audio.sfx(w.id === 'bolt' ? 'magic' : 'buster');
  p.attackTimer = SHOOT_POSE_FRAMES;
}

function dropRush(p: Player, world: World): void {
  if (world.entities.some((e) => e instanceof RushCoil && e.alive && e.owner === p)) return;
  if (!spend(p, RUSH.id, RUSH.cost, world)) return;
  const b = p.body;
  world.spawn(new RushCoil(b.x + (b.w >> 1) + p.facing * px(20), b.y + b.h, p));
  world.audio.sfx('kick');
}

function meter(p: Player): MeterInfo | null {
  const t = activeTool(p, tools(p));
  if (!t) return null;
  const w = selectedWeapon(p);
  return {
    value: energy(p, t.id),
    max: WEAPON_ENERGY,
    colour: w ? w.colour : RUSH.colour,
    label: 'W',
  };
}

function heal(p: Player, n: number, world: World): boolean {
  if (p.hp >= MAX_HP) return false;
  p.hp = Math.min(MAX_HP, p.hp + n);
  world.audio.sfx('pickup');
  return true;
}

/** Touch captions for the belt (C shows the selected weapon). */
export const MEGAMAN_TOOL_LABELS: Record<string, string> = {
  saw: 'SAW',
  leaf: 'LEAF',
  flame: 'FLAME',
  knuckle: 'KNUCKLE',
  bolt: 'BOLT',
  rush: 'RUSH',
};

export const MEGAMAN: CharacterDef = {
  id: 'megaman',
  name: 'Mega Man',
  hudName: 'MEGA',
  movement: MEGAMAN_PROFILE,
  damage: {
    kind: 'hp',
    max: MAX_HP,
    hudStyle: 'bar',
    invulnFrames: 60,
    knockback: { vx: 0x00800, vy: 0x01800 },
  },
  stomps: false,
  crouches: false,
  canBreakBricks: (p) => !!p.scratch.helmet,
  hitbox: (p) => (p.sliding > 0 ? { w: 12, h: 12 } : { w: 12, h: 22 }),
  sprite,
  blockPowerUp: (p) =>
    !p.scratch.helmet ? 'mushroom' : (p.scratch.weapons ?? 0) < WEAPONS.length ? 'flower' : 'mushroom',
  jumpSfx: () => 'jump-small',
  portrait: { sheet: 'megaman', palette: 'megaman', frame: 'idle' },
  tools,
  meter,
  hudExtra: (p) => (etanks(p) > 0 ? `E×${etanks(p)}` : null),
  reserve: {
    label: (p) => (etanks(p) > 0 ? `Use E-tank ×${etanks(p)}` : null),
    use(p, world) {
      if (etanks(p) <= 0 || p.hp >= MAX_HP) return false;
      p.scratch.etanks = etanks(p) - 1;
      p.hp = MAX_HP;
      world.audio.sfx('powerup');
      return true;
    },
  },
  devKit: () => ({ helmet: 1, weapons: WEAPONS.length, etanks: 2 }),
  drop(rng) {
    const r = rng.int(60);
    if (r < 12) return 'health-small';
    if (r < 16) return 'health-large';
    if (r < 28) return 'weapon-small';
    if (r < 32) return 'weapon-large';
    if (r < 34) return 'e-tank';
    return null;
  },
  guide: MEGAMAN_GUIDE,
  touchLabels(p) {
    const belt = tools(p);
    return {
      attack: 'SHOOT',
      special: toolButton(belt, p, MEGAMAN_TOOL_LABELS),
      select: beltButton(belt, 'WEAPON'),
    };
  },
  behaviour: {
    // A charge held into a vine is dropped (no attacks on a vine: MegaManBase.pressAtkBtn
    // returns on ST_VINE), so letting go there fires nothing.
    onGrabVine(p) {
      p.scratch.chargeT = 0;
    },
    update(p, input, world) {
      cycleTool(p, input, tools(p), world);
      if (p.stun > 0 || p.sliding > 0) {
        p.scratch.chargeT = 0;
        return;
      }
      if (input.pressed('attack') && world.countProjectiles(p, 'buster') < 3) fireBuster(p, world, false);
      if (input.pressed('special')) {
        const t = activeTool(p, tools(p));
        const w = selectedWeapon(p);
        if (w) fireWeapon(p, w, input, world);
        else if (t?.id === 'rush') dropRush(p, world);
      }
      if (p.scratch.helmet) {
        if (input.held('attack')) {
          p.scratch.chargeT = (p.scratch.chargeT ?? 0) + 1;
          if (p.scratch.chargeT === 16) world.audio.sfx('charge');
        } else {
          if ((p.scratch.chargeT ?? 0) >= CHARGE_FRAMES) fireBuster(p, world, true);
          p.scratch.chargeT = 0;
        }
      }
    },
    onPickup(p, kind, world) {
      switch (kind) {
        case 'health-small':
          return heal(p, 4, world);
        case 'health-large':
          return heal(p, 10, world);
        case 'weapon-small':
        case 'weapon-large': {
          // The selected weapon (or Rush) first, else the emptiest one he has; a weapon he hasn't
          // found keeps its full tank for when he does. Nothing to fill: points (World.collectPickup).
          const belt = tools(p).filter((b) => energy(p, b.id) < WEAPON_ENERGY);
          const t = activeTool(p, tools(p));
          const to = t && belt.includes(t) ? t : belt.sort((a, b) => energy(p, a.id) - energy(p, b.id))[0];
          if (!to) return false;
          setEnergy(p, to.id, energy(p, to.id) + (kind === 'weapon-small' ? 4 : 10));
          world.audio.sfx('pickup');
          return true;
        }
        case 'e-tank':
          if (etanks(p) >= MAX_ETANKS) return false;
          p.scratch.etanks = etanks(p) + 1;
          world.audio.sfx('1up');
          return true;
        default:
          return false;
      }
    },
    onPowerUp(p, kind, world) {
      switch (kind) {
        case 'mushroom':
          // The helmet: charge shot, brick breaking and Rush Coil.
          p.scratch.helmet = 1;
          p.hp = MAX_HP;
          world.addScore(1000, p.body.x, p.body.y - px(16));
          world.audio.sfx('powerup');
          break;
        case 'flower': {
          const n = p.scratch.weapons ?? 0;
          if (n < WEAPONS.length) p.scratch.weapons = n + 1;
          else for (const w of WEAPONS) setEnergy(p, w.id, WEAPON_ENERGY);
          p.hp = MAX_HP;
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
      // Campaign (0.4.35, owner): the helmet is his mushroom, so a hit takes it, and with it the
      // charge shot and brick breaking, as well as its damage. The weapons he found stay. Classic
      // play keeps the original's (a hit costs health only).
      if (isFound(p) && p.scratch.helmet) p.scratch.helmet = 0;
      p.hp -= HIT_DAMAGE;
      if (p.hp <= 0) {
        p.hp = 0;
        return 'dead';
      }
      p.invuln = 60;
      p.scratch.chargeT = 0;
      world.audio.sfx('hit');
      return 'hurt';
    },
  },
};
