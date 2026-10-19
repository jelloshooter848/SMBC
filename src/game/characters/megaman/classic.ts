import type { InputFrame } from '@engine/input/input-manager';
import type { CharacterDef, CharacterGuide, MeterInfo, SpriteSpec } from '../character';
import { CLASSIC_POWER_STATES } from '../character';
import type { MovementProfile } from '../profile';
import type { ToolInfo } from '../toolbelt';
import { toolIndex } from '../toolbelt';
import type { Player } from '../../entities/player';
import type { World } from '../../world/world';
import type { DamageSource } from '../../rules/damage';
import type { ProjectileSpec } from '../../entities/projectiles/projectile';
import { CLASSIC_SWIM } from '../../rules/classic-swim';
import {
  CLASSIC_DROPS,
  CLASSIC_HIT_RESPONSES,
  CLASSIC_PICKUP_GIVES,
  CLASSIC_STAR_MUSIC_LEFT,
  classicBlockPowerUp,
  classicBusy,
  classicDrop,
  classicLook,
  classicOnHurt,
  classicOnPowerUp,
  classicRespawn,
  classicStarPaletteStep,
  classicStartKit,
  hasAmmo,
  spendAmmo,
  type ClassicDropTable,
  type ClassicHitResponse,
  type ClassicPowerKit,
} from '../classic/power';
import { MEGAMAN, MEGAMAN_PROFILE } from './index';
import { MEGAMAN_CLASSIC_GUIDE } from './classic-guide';
import { ClassicRush } from './classic-rush';
import {
  CLASSIC_FLOWER_WEAPON,
  MAGMA_CHARGE_COST,
  MAGMA_CHARGED,
  MM_BUSTER,
  MM_CHARGE_FULL,
  MM_CHARGE_WEAK,
  MM_HIT,
  MM_ROOT_FRAMES,
  MM_WEAPONS,
  WEAPON_UNITS,
  balloonOf,
  busterSpawn,
  capCount,
  carriedBrick,
  clearWeaponShots,
  countShots,
  fireWeapon,
  frontTile,
  liftBrick,
  magmaVolley,
  mmWeapon,
  releaseBalloon,
  throwBrick,
  touchingBrick,
  type MMFire,
  type MMWeaponId,
} from './classic-weapons';
import { MMShot } from './classic-weapons';

/**
 * Classic SMBC Mega Man (bug-reports/2026-10-07-megaman-classic-smbc-rules.md, MM-C1..MM-C36):
 * power states instead of a health bar, the Mega Buster through solid ground, a two-level Charge
 * Shot on the Mushroom, Metal Blade on the Flower, a distance slide with slide-jump, and a free
 * Rush Coil on a Select tap. Current Mega Man (index.ts) is untouched.
 *
 * `classicMegaMan(options)` builds the def, so the Classic Mega Man variants (Bass, Proto Man:
 * FU-1, FU-5) can reuse the buster, charge, weapons, power tiers and Rush with their own numbers.
 */

/* ---------- constants ---------- */

/**
 * The Classic profile (MM-C4, MM-C5, MM-C10, MM-C11, MM-C13). Jump 650 px/s, gravity 1500 px/s²
 * and fall cap 700 px/s; our take-off is the jump speed less one frame of gravity (MM-C10).
 */
export const MEGAMAN_CLASSIC_PROFILE: MovementProfile = {
  ...MEGAMAN_PROFILE,
  jump: [{ maxVx: Infinity, initial: 0x05355, holdGravity: 0x00355, fallGravity: 0x00355 }],
  maxFall: 0x05d55,
  fallReset: 0x05d55,
  variableJump: false,
  softCut: 52055, // 0.7943 = 1e-6^(1/60) (MegaManBase fy^dt)
  airStop: true,
  step: { px: 2, frames: 6 },
  slide: {
    speed: 0x02800,
    frames: 25,
    hitboxH: 15,
    distance: 62.5,
    ceilingHold: true,
    reverseCancel: true,
    jumpOut: true,
    crossGaps: true,
  },
  swim: CLASSIC_SWIM.megaman,
};

/** The Charge Shot's timeline in frames held (MM-C20). */
export interface ChargeLevels {
  /** The charge sound and the palette flash start. */
  start: number;
  /** A release from here fires the weak shot. */
  weak: number;
  /** A release from here fires the full shot (3-colour flash). */
  full: number;
}
export const MM_CHARGE: ChargeLevels = { start: 33, weak: 48, full: 87 };
/** The 3-shot cap (MM-C19). */
export const MM_BUSTER_CAP = 3;
const SHOOT_POSE = 16;
/** Select held this long swaps the buttons; a release before it is a tap (MM-C1, MM-C3). */
export const MM_SELECT_HOLD = 21;

/** Options of a Classic Mega Man variant. Everything optional falls back to Mega Man's. */
export interface ClassicMegaManOptions {
  /** The roster def it plays for (id, name, hudName, portrait, music; TG-18). */
  base: CharacterDef;
  profile?: MovementProfile;
  response?: ClassicHitResponse;
  drops?: ClassicDropTable;
  /** Sprite sheet and the suit palettes (`<palette>-charge-N`, `<palette>-star-N` must exist). */
  sheet?: string;
  palette?: string;
  /** The buster's shot and cap. */
  buster?: { spec: ProjectileSpec; cap: number };
  /** The Mushroom's Charge Shot, or null for none. */
  charge?: { levels: ChargeLevels; weak: ProjectileSpec; full: ProjectileSpec } | null;
  /** The Fire Flower's weapon, or null for none. */
  flowerWeapon?: MMWeaponId | null;
  /** What the dev full kit grants (TG-44), in Select's order. */
  allWeapons?: readonly MMWeaponId[];
  /** Rush Coil on a Select tap. */
  rush?: boolean;
  guide?: CharacterGuide;
}

/* ---------- scratch keys (apart from Current's: w<id>, helmet, weapons, chargeT, etanks) ---------- */

/** A weapon's energy key. */
export const energyKey = (id: MMWeaponId): string => `cE-${id}`;
/** The dev full kit is carried (TG-44): Select taps cycle `tool`. */
const ALL = 'classicAll';
/** The button swap is set (kept through hits; MM-C3). */
const SWAP = 'mmSwap';
/** Charge Kick's kick mode (MM-C25). */
const KICK = 'mmKick';

/** Builds a Classic Mega Man def (see ClassicMegaManOptions). */
export function classicMegaMan(o: ClassicMegaManOptions): CharacterDef {
  const base = o.base;
  const profile = o.profile ?? MEGAMAN_CLASSIC_PROFILE;
  const response = o.response ?? (CLASSIC_HIT_RESPONSES.megaman as ClassicHitResponse);
  const drops = o.drops ?? CLASSIC_DROPS.megaman;
  const sheet = o.sheet ?? 'megaman';
  const suit = o.palette ?? 'megaman';
  const buster = o.buster ?? { spec: MM_BUSTER, cap: MM_BUSTER_CAP };
  const charge =
    o.charge === undefined ? { levels: MM_CHARGE, weak: MM_CHARGE_WEAK, full: MM_CHARGE_FULL } : o.charge;
  const flower = o.flowerWeapon === undefined ? CLASSIC_FLOWER_WEAPON : o.flowerWeapon;
  const all = o.allWeapons ?? MM_WEAPONS.map((x) => x.id);
  const hasRush = o.rush ?? true;

  /** Every weapon starts full each life (MM-C17): the start kit. */
  const START: Record<string, number> = {};
  for (const id of all) START[energyKey(id)] = WEAPON_UNITS;
  if (flower) START[energyKey(flower)] = WEAPON_UNITS;

  const energy = (p: Player, id: MMWeaponId) => p.scratch[energyKey(id)] ?? WEAPON_UNITS;

  /** The dev full kit's belt (TG-44): every weapon, then Rush. */
  function belt(p: Player): ToolInfo[] {
    const list: ToolInfo[] = all.map((id) => {
      const wp = mmWeapon(id);
      return { id, icon: wp.icon, count: null, usable: hasAmmo(p, energyKey(id), wp.cost) };
    });
    if (hasRush) list.push({ id: 'rush', icon: 'icon-rush', count: null, usable: true });
    return list;
  }

  /** What Special (the weapon button) holds now: a weapon, Rush (full kit only) or nothing. */
  function held(p: Player): MMWeaponId | 'rush' | null {
    if (p.scratch[ALL]) {
      const b = belt(p);
      return (b[toolIndex(p, b)]?.id as MMWeaponId | 'rush' | undefined) ?? null;
    }
    return p.powerState === 'fire' ? flower : null;
  }
  const heldWeapon = (p: Player): MMWeaponId | null => {
    const h = held(p);
    return h === 'rush' ? null : h;
  };

  /** The swap is on and allowed now (a weapon held, not Charge Kick; MM-C3). */
  function swapped(p: Player): boolean {
    const w = heldWeapon(p);
    return !!p.scratch[SWAP] && w !== null && w !== 'charge-kick';
  }

  function tools(p: Player): ToolInfo[] {
    if (p.scratch[ALL]) return belt(p);
    // While swapped the HUD shows the Flower weapon's icon (MM-C3).
    const w = heldWeapon(p);
    if (w && swapped(p)) return [{ id: w, icon: mmWeapon(w).icon, count: null, usable: true }];
    return [];
  }

  function meter(p: Player): MeterInfo | null {
    const w = heldWeapon(p);
    if (!w) return null;
    let value = energy(p, w);
    // The refill freeze counts up 4 units every 3 frames (MM-C18).
    const from = p.scratch._fillFrom;
    if (from !== undefined && p.transition?.kind === 'freeze')
      value = Math.min(value, from + 4 * Math.floor(p.transition.t / 3));
    return { value, max: WEAPON_UNITS, colour: mmWeapon(w).colour, label: 'W' };
  }

  function fireCtx(p: Player, world: World, input: InputFrame): MMFire {
    return {
      p,
      world,
      input,
      energy: (id) => energy(p, id),
      spend: (id, cost) => spendAmmo(p, energyKey(id), cost),
      has: (id, cost) => hasAmmo(p, energyKey(id), cost),
    };
  }

  function rushTap(p: Player, world: World, input: InputFrame): void {
    if (!hasRush) return;
    const out = world.entities.find(
      (e): e is ClassicRush => e instanceof ClassicRush && e.alive && e.owner === p,
    );
    if (out) out.dismiss();
    else {
      ClassicRush.summon(p, world, input.held('up'));
      world.audio.sfx('kick');
    }
  }

  function selectButton(p: Player, input: InputFrame, world: World): void {
    if (input.held('select')) {
      const t = (p.scratch._selT ?? 0) + 1;
      p.scratch._selT = t;
      if (t === MM_SELECT_HOLD) {
        const w = heldWeapon(p);
        if (w && w !== 'charge-kick') {
          p.scratch[SWAP] = p.scratch[SWAP] ? 0 : 1;
          p.scratch._chargeT = 0;
          p.scratch._wChargeT = 0;
          world.audio.sfx('select');
        }
      }
      return;
    }
    const t = p.scratch._selT ?? 0;
    if (t === 0) return;
    p.scratch._selT = 0;
    if (t >= MM_SELECT_HOLD) return;
    if (p.scratch[ALL]) {
      // The dev full kit: a tap picks the next weapon (TG-44, MM-C21).
      const b = belt(p);
      p.scratch.tool = (toolIndex(p, b) + 1) % b.length;
      p.scratch._wChargeT = 0;
      world.audio.sfx('select');
    } else rushTap(p, world, input);
  }

  function fireBuster(p: Player, world: World, spec: ProjectileSpec): void {
    const pos = busterSpawn(p, spec);
    world.spawn(new MMShot(pos.x, pos.y, p.facing, spec, p));
    world.audio.sfx(spec === buster.spec ? 'buster' : 'charge-shot');
    p.attackTimer = SHOOT_POSE;
  }

  /** The buster button (MM-C19, MM-C20). */
  function busterButton(p: Player, input: InputFrame, world: World, btn: 'attack' | 'special'): void {
    const sliding = p.sliding > 0;
    const canCharge = charge !== null && p.powerState !== 'small';
    if (input.pressed(btn)) {
      const fullOut = charge !== null && countShots(world, p, (k) => k === charge.full.kind) > 0;
      if (!sliding && capCount(world, p) < buster.cap && !fullOut) fireBuster(p, world, buster.spec);
      if (canCharge) p.scratch._chargeT = 1;
      return;
    }
    const t = p.scratch._chargeT ?? 0;
    if (t === 0 || !charge) return;
    if (input.held(btn)) {
      p.scratch._chargeT = t + 1;
      if (t + 1 === charge.levels.start) world.audio.sfx('charge');
      return;
    }
    p.scratch._chargeT = 0;
    // Let go during a slide: nothing, the charge is dropped.
    if (sliding) return;
    if (t >= charge.levels.full) fireBuster(p, world, charge.full);
    else if (t >= charge.levels.weak) fireBuster(p, world, charge.weak);
  }

  /** The weapon button (MM-C22..MM-C25). */
  function weaponButton(p: Player, input: InputFrame, world: World, btn: 'attack' | 'special'): void {
    const h = held(p);
    const f = fireCtx(p, world, input);
    // A balloon let go of (after any slide) fires its shot or vanishes.
    const bl = balloonOf(p, world);
    if (bl && !(h === 'pharaoh-shot' && input.held(btn)) && p.sliding === 0) releaseBalloon(f, bl);
    // Super Arm: any attack press throws the carried brick.
    const carried = carriedBrick(p, world);
    if (carried) {
      if ((input.pressed('attack') || input.pressed('special')) && throwBrick(f, carried)) {
        p.scratch._carry = 0;
        thrown(p, true);
      }
      return;
    }
    p.scratch._carry = 0;
    if (h === null) return;
    if (h === 'rush') {
      if (input.pressed(btn)) rushTap(p, world, input);
      return;
    }
    switch (h) {
      case 'super-arm': {
        if (!input.held(btn) || !f.has(h, mmWeapon(h).cost)) return;
        const at = touchingBrick(p, world);
        if (at) {
          liftBrick(p, world, at);
          p.scratch._carry = 1;
        }
        return;
      }
      case 'charge-kick':
        if (input.pressed(btn)) {
          p.scratch[KICK] = p.scratch[KICK] ? 0 : 1;
          world.audio.sfx('select');
        }
        return;
      case 'magma-bazooka': {
        if (input.pressed(btn)) {
          const canCharge = f.has(h, mmWeapon(h).cost + MAGMA_CHARGE_COST);
          if (fireWeapon(f, h)) p.attackTimer = SHOOT_POSE;
          p.scratch._wChargeT = canCharge ? 1 : 0;
          return;
        }
        const t = p.scratch._wChargeT ?? 0;
        if (t === 0) return;
        if (input.held(btn)) {
          p.scratch._wChargeT = t + 1;
          if (t + 1 === MM_CHARGE.start) world.audio.sfx('charge');
          return;
        }
        p.scratch._wChargeT = 0;
        if (p.sliding === 0 && t >= MM_CHARGE.full && f.spend(h, MAGMA_CHARGE_COST)) {
          magmaVolley(f, MAGMA_CHARGED);
          p.attackTimer = SHOOT_POSE;
        }
        return;
      }
      default:
        if (input.pressed(btn) && p.sliding === 0 && fireWeapon(f, h)) thrown(p, mmWeapon(h).roots);
    }
  }

  function thrown(p: Player, roots: boolean): void {
    p.attackTimer = SHOOT_POSE;
    if (roots && p.body.onGround) p.root = Math.max(p.root, MM_ROOT_FRAMES);
  }

  /** Charge Kick (MM-C25): each slide in kick mode costs 4 and attacks what it touches. */
  function kickTick(p: Player, world: World, input: InputFrame): void {
    if (p.sliding === 0) {
      p.scratch._kickSlide = 0;
      p.scratch._kick = 0;
      return;
    }
    if (!p.scratch._kickSlide) {
      p.scratch._kickSlide = 1;
      for (const k of Object.keys(p.scratch)) if (k.startsWith('_kh')) delete p.scratch[k];
      p.scratch._kick =
        heldWeapon(p) === 'charge-kick' && p.scratch[KICK] && fireCtx(p, world, input).spend('charge-kick', 4)
          ? 1
          : 0;
    }
    // It breaks the empty bricks it slides into (Open question 5: 350 against 125).
    const b = p.body;
    if (p.scratch._kick && b.hitWall !== 0 && b.hitWall === p.facing) {
      const t = frontTile(p);
      const res = world.strikeBlock(t.tx, t.ty, p, false, { source: 'shot', damage: 350 });
      if (res?.broken) b.hitWall = 0;
    }
  }

  const KIT: ClassicPowerKit = {
    response,
    gainFire(p) {
      if (flower === 'charge-kick') p.scratch[KICK] = 1;
      // The first Flower adds 40 units too (MM-C15).
      if (flower) p.scratch[energyKey(flower)] = Math.min(WEAPON_UNITS, energy(p, flower) + 40);
    },
    loseFire(p, world) {
      clearWeaponShots(p, world);
      p.scratch._wChargeT = 0;
      p.scratch._carry = 0;
    },
    loseBig(p) {
      p.scratch._chargeT = 0;
    },
    ...(flower ? { repeat: { key: energyKey(flower), max: WEAPON_UNITS, add: 40 } } : {}),
  };

  function sprite(p: Player, frame: number, reduceFlashing: boolean): SpriteSpec {
    const h = held(p);
    let palette = suit;
    if (h === 'rush') palette = `${sheet}-rush`;
    else if (h === 'charge-kick') palette = p.scratch[KICK] ? mmWeapon(h).palette : suit;
    else if (h) palette = mmWeapon(h).palette;
    const t = Math.max(p.scratch._chargeT ?? 0, p.scratch._wChargeT ?? 0);
    const levels = charge?.levels ?? MM_CHARGE;
    const charging = t >= levels.start;
    if (charging) {
      const full = t >= levels.full;
      const n = reduceFlashing ? (full ? 2 : 0) : full ? (frame >> 2) % 3 : (frame >> 2) & 1;
      palette = `${suit}-charge-${n}`;
    }
    const star = classicStarPaletteStep(p, frame, reduceFlashing);
    if (star !== null) palette = `${suit}-star-${star}`;
    const shooting = p.attackTimer > 0;
    let name: string;
    if (p.dead || p.anim === 'hurt') name = 'hurt';
    else if (p.sliding > 0) name = 'slide';
    else if (p.stepT > 0 && p.body.onGround) name = 'walk-0';
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
      sheet,
      palette,
      frame: name,
      flip: p.facing < 0,
      offsetX: 2,
      offsetY: p.sliding > 0 ? 32 - (profile.slide?.hitboxH ?? 15) : 10,
    };
  }

  const def: CharacterDef = {
    id: base.id,
    name: base.name,
    hudName: base.hudName,
    portrait: base.portrait,
    ...(base.music !== undefined ? { music: base.music } : {}),
    rules: 'classic',
    movement: profile,
    damage: { kind: 'powerup', states: CLASSIC_POWER_STATES },
    stomps: false,
    crouches: false,
    // He bumps bricks from below in every state and never breaks them (MM-C33).
    canBreakBricks: () => false,
    hitbox: (p) => (p.sliding > 0 ? { w: 12, h: profile.slide?.hitboxH ?? 15 } : { w: 12, h: 22 }),
    sprite,
    blockPowerUp: classicBlockPowerUp,
    jumpSfx: () => 'jump-small',
    drawLook: (p, _frame, reduce) => classicLook(p, reduce, response.look),
    starMusicLeft: CLASSIC_STAR_MUSIC_LEFT,
    drop: (rng, _e, killer) => (killer ? classicDrop(rng, killer, drops, 'enemy') : null),
    blockDrop: (rng, p, source) => classicDrop(rng, p, drops, source),
    tools,
    meter,
    devKit: () => ({ ...START, [ALL]: 1 }),
    guide: o.guide ?? MEGAMAN_CLASSIC_GUIDE,
    touchLabels(p) {
      const w = heldWeapon(p);
      const h = held(p);
      const label = w ? mmWeapon(w).label : h === 'rush' ? 'RUSH' : null;
      const sw = swapped(p);
      return {
        attack: sw ? label : 'SHOOT',
        special: sw ? 'SHOOT' : label,
        select: p.scratch[ALL] ? 'WEAPON' : hasRush ? 'RUSH' : null,
      };
    },
    behaviour: {
      onGrabVine(p) {
        p.scratch._chargeT = 0;
        p.scratch._wChargeT = 0;
      },
      canSlide: (p) => !p.scratch._carry,
      update(p, input, world) {
        classicStartKit(p, START);
        if (!p.transition) delete p.scratch._fillFrom;
        // Hard Knuckle steers by the d-pad's up/down (classic-weapons KnuckleShot).
        p.scratch._ud = input.held('up') ? -1 : input.held('down') ? 1 : 0;
        if (classicBusy(p)) return;
        selectButton(p, input, world);
        const sw = swapped(p);
        busterButton(p, input, world, sw ? 'special' : 'attack');
        weaponButton(p, input, world, sw ? 'attack' : 'special');
        kickTick(p, world, input);
      },
      onPowerUp: (p, kind, world) => classicOnPowerUp(p, kind, world, KIT),
      contactDamage(p, e): DamageSource | null {
        // A Charge Kick slide hits what it touches once (350), and touching it does not hurt.
        if (!p.scratch._kick || p.sliding === 0) return null;
        const key = `_kh${e.id}`;
        const first = !p.scratch[key];
        p.scratch[key] = 1;
        return { kind: 'weapon', amount: first ? 350 : 0, owner: p, dirX: p.facing, ...MM_HIT };
      },
      onHurt: (p, world, fromDir) => {
        p.scratch._chargeT = 0;
        p.root = 0;
        return classicOnHurt(p, world, fromDir, KIT);
      },
      onPickup(p, kind, world) {
        const w = heldWeapon(p);
        const add = CLASSIC_PICKUP_GIVES[kind];
        if ((kind === 'weapon-small' || kind === 'weapon-large') && w && add !== undefined) {
          const e = energy(p, w);
          if (e < WEAPON_UNITS) {
            // The game freezes while the bar fills: 4 units every 3 frames (MM-C18).
            const n = Math.min(add, WEAPON_UNITS - e);
            p.scratch._fillFrom = e;
            p.scratch[energyKey(w)] = e + n;
            p.startTransition('freeze', Math.ceil(n / 4) * 3 + 1);
            world.audio.sfx('boss-fill');
            return true;
          }
        }
        // No weapon, or a full bar: collected with no effect (Open question 6).
        world.audio.sfx('pickup');
        return true;
      },
      onRespawn: (p) => classicRespawn(p, START),
    },
  };
  return def;
}

/** Classic SMBC Mega Man (TG-17: registry.ts's CLASSIC_CHARACTERS). */
export const MEGAMAN_CLASSIC: CharacterDef = classicMegaMan({ base: MEGAMAN });
