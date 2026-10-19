import { px } from '@engine/math/units';
import type { Rng } from '@engine/rng';
import type { Player, HurtLock } from '../../entities/player';
import type { World } from '../../world/world';
import type { CharacterBehaviour, HurtResult } from '../character';
import type { PickupKind } from '../../entities/objects/pickup';

/**
 * Classic SMBC power states, hit response, drops and Star (`2026-10-07-classic-power-states.md`,
 * PS-C1..PS-C27; umbrella TG-21, TG-28, TG-29). No rules branch: each Classic def plugs these
 * helpers into its own hooks, so a Current def never meets them.
 *
 * A Classic def wires them like this (one `ClassicPowerKit` row per hero, see each hero report):
 *
 * ```ts
 * const KIT: ClassicPowerKit = { response: CLASSIC_HIT_RESPONSES.link, gainBig: …, loseBig: …, repeat: … };
 * export const LINK_CLASSIC: CharacterDef = {
 *   …,
 *   rules: 'classic',
 *   damage: { kind: 'powerup', states: CLASSIC_POWER_STATES },
 *   blockPowerUp: classicBlockPowerUp,
 *   drawLook: (p, frame, reduce) => classicLook(p, reduce, KIT.response.look),
 *   starMusicLeft: CLASSIC_STAR_MUSIC_LEFT,
 *   drop: (rng, _e, killer) => (killer ? classicDrop(rng, killer, LINK_DROPS, 'enemy') : null),
 *   blockDrop: (rng, p, source) => classicDrop(rng, p, LINK_DROPS, source),
 *   behaviour: {
 *     update(p, input, world) { if (classicBusy(p)) return; … },
 *     onPowerUp: (p, kind, world) => classicOnPowerUp(p, kind, world, KIT),
 *     onHurt: (p, world, fromDir) => classicOnHurt(p, world, fromDir, KIT),
 *     onPickup: (p, kind, world) => classicPickup(p, kind, world, { bomb: { key: 'bombs', max: 40 } }),
 *     onRespawn: (p) => classicRespawn(p, START_KIT),
 *     …
 *   },
 * };
 * ```
 */

/** Star power lasts 12.0 s (PS-C19). Current keeps STAR_FRAMES = 600. */
export const CLASSIC_STAR_FRAMES = 720;
/** From this many frames after the pickup the Star flashes slowly (PS-C19). */
export const CLASSIC_STAR_SLOW_FROM = 570;
/** Star frames left when the level music comes back (frame 642, PS-C19): CharacterDef.starMusicLeft. */
export const CLASSIC_STAR_MUSIC_LEFT = 78;
/** The whole game freezes this long when a hero goes up a state (PS-C4), and on Mario's and Bill's hits. */
export const CLASSIC_FREEZE_FRAMES = 60;
/**
 * Player.startTransition length for a freeze of CLASSIC_FREEZE_FRAMES whole frames: the world
 * runs again on the frame the transition reaches its length (World.update, tickTransition).
 */
const FREEZE_LEN = CLASSIC_FREEZE_FRAMES + 1;
/** Every Mushroom, Fire Flower and Star scores this (`ScoreValue.POWER_UP`, PS-C3). */
export const CLASSIC_POWER_SCORE = 1000;
/** The semi-transparent look (`Character.TD_ALPHA`, PS-C13). */
export const CLASSIC_HURT_ALPHA = 0.65;
/** Invulnerable frames after a push hero's lock ends (1250 ms, PS-C10). */
export const CLASSIC_PUSH_INVULN = 75;
/** Timers held "for as long as the lock lasts" (Player.hurtLock ends them). */
const HELD = 1 << 20;

/** A ? block's power-up (PS-C2): a Mushroom for a small hero, else a Fire Flower. Every hero. */
export function classicBlockPowerUp(p: Player): 'mushroom' | 'flower' {
  return p.powerState === 'small' ? 'mushroom' : 'flower';
}

/** How the hero looks from a hit to the end of its invulnerability (PS-C13). */
export interface ClassicLook {
  /** Drawn at 65 % opacity. */
  alpha?: boolean;
  /** Shown and hidden in turn, toggling every `flickerMs` of game time (Samus 25, Mega Man 70). */
  flickerMs?: number;
  /** The sprite cycles the hero's flash palettes every 2 frames (classicHurtPaletteStep). */
  paletteFlash?: boolean;
  /** 'land': only once the push has ended (Simon, Ryu: "after landing"). Default 'hit'. */
  from?: 'hit' | 'land';
}

/**
 * A survived hit's response (PS-C10). 'freeze': the game freezes `frames` (input with it), then
 * `invuln` frames (Mario, Luigi, Bill). 'push': speeds in 1/4096 px/f; the push ends by `lock`
 * (Player.HurtLock), then CLASSIC_PUSH_INVULN frames.
 */
export type ClassicHitResponse =
  | { kind: 'freeze'; frames: number; invuln: number; look: ClassicLook }
  | {
      kind: 'push';
      /** Horizontal push speed. */
      vx: number;
      /** 'source': away from the damage source; 'facing': backwards from the hero's facing (Mega Man). */
      from: 'source' | 'facing';
      /** Upward push speed (positive), if any. */
      vy?: number;
      /** The upward push only when the hero was on the ground (Samus). */
      vyOnGroundOnly?: boolean;
      /** vy set to 0 (Mega Man). */
      zeroVy?: boolean;
      /** Turns to face the damage source. */
      faceSource?: boolean;
      lock: { frames?: number; distance?: number; untilLand?: boolean };
      invuln: number;
      look: ClassicLook;
    };

/** Each hero's hit response (PS-C10 table), by hero id. Classic extras add their own rows. */
export const CLASSIC_HIT_RESPONSES: Readonly<Record<string, ClassicHitResponse>> = {
  mario: { kind: 'freeze', frames: CLASSIC_FREEZE_FRAMES, invuln: 150, look: { alpha: true } },
  luigi: { kind: 'freeze', frames: CLASSIC_FREEZE_FRAMES, invuln: 150, look: { alpha: true } },
  link: {
    kind: 'push',
    vx: 0x042ab,
    from: 'source',
    faceSource: true,
    lock: { distance: 32, frames: 72 },
    invuln: CLASSIC_PUSH_INVULN,
    look: { paletteFlash: true },
  },
  samus: {
    kind: 'push',
    vx: 0x01400,
    from: 'source',
    vy: 0x02155,
    vyOnGroundOnly: true,
    lock: { frames: 15 },
    invuln: CLASSIC_PUSH_INVULN,
    look: { flickerMs: 25 },
  },
  simon: {
    kind: 'push',
    vx: 0x01400,
    from: 'source',
    vy: 0x02800,
    faceSource: true,
    lock: { untilLand: true },
    invuln: CLASSIC_PUSH_INVULN,
    look: { alpha: true, from: 'land' },
  },
  megaman: {
    kind: 'push',
    vx: 0x00aab,
    from: 'facing',
    zeroVy: true,
    lock: { frames: 27 },
    invuln: CLASSIC_PUSH_INVULN,
    look: { flickerMs: 70 },
  },
  bill: {
    kind: 'freeze',
    frames: CLASSIC_FREEZE_FRAMES,
    invuln: 120,
    look: { alpha: true, paletteFlash: true },
  },
  ryu: {
    kind: 'push',
    vx: 0x01400,
    from: 'source',
    vy: 0x03355,
    faceSource: true,
    lock: { untilLand: true },
    invuln: CLASSIC_PUSH_INVULN,
    look: { alpha: true, from: 'land' },
  },
};

/** An ammo counter with its cap (a number, or one that depends on the kit). */
export interface ClassicAmmo {
  key: string;
  max: number | ((p: Player) => number);
}
const maxOf = (a: ClassicAmmo, p: Player) => (typeof a.max === 'number' ? a.max : a.max(p));

/**
 * One hero's power-state row (PS-C5, PS-C6, PS-C8). Upgrades that come and go with the state are
 * read from `p.powerState` by the hero's own code; these hooks handle what the state alone does
 * not say (ammo given the first time, flags kept after a hit).
 */
export interface ClassicPowerKit {
  /** Mario and Luigi: the body changes size (grow and shrink animations). */
  grows?: boolean;
  response: ClassicHitResponse;
  /** Reached the Mushroom state (e.g. Link: 3 bombs if he had none). */
  gainBig?(p: Player, world: World): void;
  /** Reached the Fire Flower state. */
  gainFire?(p: Player, world: World): void;
  /** A hit took the Fire Flower: drop its "lose with the Flower" list. Ammo counts stay (PS-C8). */
  loseFire?(p: Player, world: World): void;
  /** A hit took the Mushroom (always, Lose Everything). Ammo counts stay. */
  loseBig?(p: Player, world: World): void;
  /** The repeat Fire Flower bonus (PS-C6), capped at the ammo's maximum. Absent: points only. */
  repeat?: ClassicAmmo & { add: number };
}

/**
 * CharacterBehaviour.onPowerUp for a Classic def (PS-C3, PS-C4, PS-C6, PS-C19, PS-C20). A Mushroom
 * or Flower raises the state one step whatever the item (small → big → fire), with a 60-frame
 * freeze; in the Fire Flower state it gives the repeat bonus with no freeze. 1000 points each. A
 * Star lasts 720 frames (a second one restarts it, Open question 1); a 1-up gives a life.
 */
export function classicOnPowerUp(
  p: Player,
  kind: Parameters<CharacterBehaviour['onPowerUp']>[1],
  world: World,
  kit: ClassicPowerKit,
): void {
  const at = () => world.addScore(CLASSIC_POWER_SCORE, p.body.x, p.body.y - px(16));
  switch (kind) {
    case 'mushroom':
    case 'flower': {
      at();
      world.audio.sfx('powerup');
      if (p.powerState === 'small' || p.powerState === 'big') {
        const fire = p.powerState === 'big';
        p.powerState = fire ? 'fire' : 'big';
        p.crouching = false;
        p.startTransition(kit.grows ? 'grow' : 'freeze', FREEZE_LEN);
        if (fire) kit.gainFire?.(p, world);
        else kit.gainBig?.(p, world);
      } else if (kit.repeat) {
        const r = kit.repeat;
        p.scratch[r.key] = Math.min((p.scratch[r.key] ?? 0) + r.add, maxOf(r, p));
      }
      break;
    }
    case 'star':
      p.star = CLASSIC_STAR_FRAMES;
      at();
      world.audio.playMusic('star');
      break;
    case '1up':
      world.addLife(p.body.x, p.body.y - px(16));
      break;
  }
}

/**
 * CharacterBehaviour.onHurt for a Classic def: When Hit = Lose Everything (PS-C7, PS-C8, PS-C10).
 * World.hurtPlayer has already skipped invulnerable heroes and the No damage assist. Small: dead.
 * Else the Flower's list goes (if held), then always the Mushroom's, so one hit always ends
 * small; then the hero's hit response. The "Fire keeps big" assist is not read (TG-29).
 */
export function classicOnHurt(
  p: Player,
  world: World,
  fromDir: -1 | 1 = 1,
  kit: ClassicPowerKit,
): HurtResult {
  if (p.powerState !== 'big' && p.powerState !== 'fire') return 'dead';
  if (p.powerState === 'fire') kit.loseFire?.(p, world);
  kit.loseBig?.(p, world);
  p.powerState = 'small';
  // Any attack in progress ends (PS-C12).
  p.activeMelee = null;
  p.attackTimer = 0;
  p.sliding = 0;
  p.crouching = false;
  p.scratch._hurtAt = p.frame;
  world.audio.sfx('pipe');
  startResponse(p, fromDir, kit);
  return 'hurt';
}

function startResponse(p: Player, fromDir: -1 | 1, kit: ClassicPowerKit): void {
  const r = kit.response;
  if (r.kind === 'freeze') {
    // The world stands still for the freeze (World.update returns while a transition runs, and
    // Player.update with it), so the invulnerable frames start counting when it ends.
    p.startTransition(kit.grows ? 'shrink' : 'freeze', r.frames + 1);
    p.invuln = r.invuln;
    return;
  }
  p.refitHitbox();
  const b = p.body;
  // On Castlevania stairs a hit never knocks the hero off (as in Current): no push, no lock.
  if (p.stairs) {
    p.invuln = r.invuln;
    return;
  }
  const dir: -1 | 1 = r.from === 'facing' ? (-p.facing as -1 | 1) : fromDir;
  b.vx = dir * r.vx;
  if (r.zeroVy) b.vy = 0;
  if (r.vy !== undefined && (!r.vyOnGroundOnly || b.onGround)) {
    b.vy = -r.vy;
    b.onGround = false;
  }
  if (r.faceSource) p.facing = -fromDir as -1 | 1;
  p.clinging = false;
  const lock: HurtLock = { t: 0, startX: b.x, dir, invulnAfter: r.invuln };
  if (r.lock.frames !== undefined) lock.frames = r.lock.frames;
  if (r.lock.distance !== undefined) lock.distance = r.lock.distance;
  if (r.lock.untilLand) lock.untilLand = true;
  p.hurtLock = lock;
  p.stun = HELD;
  p.invuln = HELD;
}

/**
 * While true the hero's own update should do nothing (no attacks, no tools): a hit's push
 * (PS-C12) or a freeze. Classic defs call it first in `behaviour.update`.
 */
export function classicBusy(p: Player): boolean {
  return p.hurtLock !== null || p.transition !== null;
}

const SHOWN = { visible: true, alpha: 1 } as const;
const SOFT = { visible: true, alpha: CLASSIC_HURT_ALPHA } as const;

/** Whether the hit look of `look` shows now (from the hit, or from landing, to the end). */
function lookActive(p: Player, look: ClassicLook): boolean {
  if (look.from === 'land') return p.hurtLock === null && p.invuln > 0;
  return p.hurtLock !== null || p.invuln > 0;
}

/**
 * CharacterDef.drawLook for a Classic def (PS-C13). The flicker uses the original's
 * GameLoopTimer: 16.667 ms a frame, toggling each time `flickerMs` is reached, remainder kept
 * (Samus 25 ms: toggles after 2, 1, 2, 1… frames; Mega Man 70 ms: 5, 4, 4, 4, 4, 5…). With
 * Reduce flashing, flicker and palette-flash heroes are drawn at 65 % opacity instead.
 */
export function classicLook(p: Player, reduceFlashing: boolean, look: ClassicLook): { visible: boolean; alpha: number } {
  if (p.dead || !lookActive(p, look)) return SHOWN;
  if (look.flickerMs !== undefined) {
    if (reduceFlashing) return SOFT;
    const n = p.frame - (p.scratch._hurtAt ?? p.frame);
    const toggles = Math.floor((n * 1000) / (60 * look.flickerMs));
    return toggles % 2 === 0 ? SHOWN : { visible: false, alpha: 1 };
  }
  if (look.alpha || (look.paletteFlash && reduceFlashing)) return SOFT;
  return SHOWN;
}

/**
 * For a palette-flash hero's sprite (PS-C13): the flash palette step (0..3, next every 2 frames)
 * while the hit look shows, else null (normal palette; also with Reduce flashing). Until the
 * original's power-up palettes are extracted, heroes use their Star palettes (Open question 2).
 */
export function classicHurtPaletteStep(
  p: Player,
  frame: number,
  reduceFlashing: boolean,
  look: ClassicLook,
): number | null {
  if (!look.paletteFlash || reduceFlashing || !lookActive(p, look)) return null;
  return (frame >> 1) & 3;
}

/**
 * For a Classic sprite under Star power (PS-C19): the Star palette step, the next one every 2
 * frames for the first 570 frames, then every 6 (100 ms); null without Star. Reduce flashing
 * holds step 0, as Current does.
 */
export function classicStarPaletteStep(p: Player, frame: number, reduceFlashing: boolean): number | null {
  if (p.star <= 0) return null;
  if (reduceFlashing) return 0;
  return CLASSIC_STAR_FRAMES - p.star < CLASSIC_STAR_SLOW_FROM ? (frame >> 1) & 3 : Math.floor(frame / 6) & 3;
}

/* ---------- ammo ---------- */

/**
 * Spends `cost` of ammo `key` (PS-C18): true and nothing spent while Star is active (a weapon
 * then needs no ammo); else true and spent when there is enough, false otherwise.
 */
export function spendAmmo(p: Player, key: string, cost: number): boolean {
  if (p.star > 0) return true;
  const have = p.scratch[key] ?? 0;
  if (have < cost) return false;
  p.scratch[key] = have - cost;
  return true;
}

/** Whether a weapon costing `cost` of `key` can fire (always under Star, PS-C18). */
export function hasAmmo(p: Player, key: string, cost: number): boolean {
  return p.star > 0 || (p.scratch[key] ?? 0) >= cost;
}

/** What each Classic ammo pickup gives (PS-C16); Mega Man's energy is in the original's units (112 = full). */
export const CLASSIC_PICKUP_GIVES: Partial<Record<PickupKind, number>> = {
  bomb: 2,
  'missile-pack': 2,
  'heart-small': 1,
  'heart-large': 5,
  'weapon-small': 8,
  'weapon-large': 40,
  'ninpo-small': 5,
  'ninpo-large': 10,
};

/**
 * CharacterBehaviour.onPickup for a Classic def (PS-C17): the pickup is always taken (true), even
 * with that ammo full (the extra is lost). `ammo` maps each pickup kind the hero uses to its
 * counter; other kinds just vanish.
 */
export function classicPickup(
  p: Player,
  kind: PickupKind,
  world: World,
  ammo: Partial<Record<PickupKind, ClassicAmmo>>,
): true {
  const a = ammo[kind];
  const add = CLASSIC_PICKUP_GIVES[kind];
  if (a && add !== undefined) p.scratch[a.key] = Math.min((p.scratch[a.key] ?? 0) + add, maxOf(a, p));
  world.audio.sfx('pickup');
  return true;
}

/* ---------- drops ---------- */

/** The original's RandomDropGenerator rates (PS-C15): one roll per kill, broken brick or coin. */
export const CLASSIC_DROP_RATES = { enemy: 0.25, brick: 0.25 * 0.25, coin: 0.25 * 0.5 } as const;
export type ClassicDropSource = keyof typeof CLASSIC_DROP_RATES;

/** One hero's drops (PS-C15, PS-C16). */
export interface ClassicDropTable {
  /** Where this hero's drops come from. */
  sources: readonly ClassicDropSource[];
  /** The item roll: kinds with their chances (summing to 1). */
  items: readonly (readonly [PickupKind, number])[];
  /** Drops only once this holds (Link owns bombs, Samus owns missiles). */
  gate?(p: Player): boolean;
}

/**
 * The drop tables by hero id. Mario, Luigi and Bill have none (never a drop). Link's and Samus's
 * need a `gate` from their defs (`{ ...CLASSIC_DROPS.link, gate: (p) => … }`): nothing until they
 * own bombs or missiles. Link's arrow drop needs the Bow with no bombs, which only `kit=full`
 * gives; his def adds it if it wants.
 */
export const CLASSIC_DROPS: Readonly<Record<string, ClassicDropTable>> = {
  link: { sources: ['enemy', 'brick'], items: [['bomb', 1]] },
  samus: { sources: ['enemy', 'brick'], items: [['missile-pack', 1]] },
  simon: {
    sources: ['enemy', 'brick', 'coin'],
    items: [
      ['heart-small', 0.8],
      ['heart-large', 0.2],
    ],
  },
  megaman: {
    sources: ['enemy'],
    items: [
      ['weapon-small', 0.825],
      ['weapon-large', 0.175],
    ],
  },
  ryu: {
    sources: ['enemy', 'brick', 'coin'],
    items: [
      ['ninpo-small', 0.8],
      ['ninpo-large', 0.2],
    ],
  },
};

/**
 * CharacterDef.drop / blockDrop for a Classic def: one chance roll at the source's rate, then
 * the item roll. Null for a source the hero has no drops from, or before the gate opens.
 */
export function classicDrop(
  rng: Rng,
  p: Player,
  table: ClassicDropTable | undefined,
  source: ClassicDropSource,
): PickupKind | null {
  if (!table || !table.sources.includes(source)) return null;
  if (table.gate && !table.gate(p)) return null;
  if (!rng.chance(CLASSIC_DROP_RATES[source])) return null;
  const items = table.items;
  if (items.length === 1) return (items[0] as readonly [PickupKind, number])[0];
  let r = rng.float();
  for (const [kind, w] of items) {
    if (r < w) return kind;
    r -= w;
  }
  return (items[items.length - 1] as readonly [PickupKind, number])[0];
}

/* ---------- start kit, death and drop-in ---------- */

/** Marks a kit that already got its start (carried with the kit, wiped with it on death). */
const STARTED = 'classicKit';

/**
 * Gives the hero its Classic start kit (PS-C5's Small column, PS-C21) once per life: Simon's 10
 * hearts, Ryu's 25 ninpo and so on. Call it from `behaviour.update`; it does nothing once the
 * kit has started (a death wipes the kit, so the next life starts it again).
 */
export function classicStartKit(p: Player, start: Readonly<Record<string, number>>): void {
  if (p.scratch[STARTED]) return;
  for (const [k, v] of Object.entries(start)) if (p.scratch[k] === undefined) p.scratch[k] = v;
  p.scratch[STARTED] = 1;
}

/**
 * CharacterBehaviour.onRespawn for a Classic def (PS-C22, TG-30): a co-op drop-in comes back small
 * (World.respawn did that) with the start kit; every upgrade and ammo count goes. The 150-frame
 * drop-in invulnerability stays as World.respawn set it.
 */
export function classicRespawn(p: Player, start: Readonly<Record<string, number>>): void {
  for (const k of Object.keys(p.scratch)) delete p.scratch[k];
  p.hurtLock = null;
  p.scratch._hurtAt = p.frame;
  classicStartKit(p, start);
}
