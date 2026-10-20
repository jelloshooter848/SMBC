import { tileAt, tileToSub } from '@engine/math/units';
import type { AABB } from '@engine/math/aabb';
import type { InputFrame } from '@engine/input/input-manager';
import type { CharacterDef, SpriteSpec } from '../character';
import { CLASSIC_POWER_STATES } from '../character';
import type { MovementProfile } from '../profile';
import type { Player } from '../../entities/player';
import type { World } from '../../world/world';
import type { DamageSource } from '../../rules/damage';
import { tileDef } from '../../level/tiles';
import { CLASSIC_SWIM } from '../../rules/classic-swim';
import { activeTool, cycleTool, type ToolInfo } from '../toolbelt';
import { toolButton } from '../../touch-labels';
import { LINK } from './index';
import { LINK_CLASSIC_GUIDE } from './classic-guide';
import {
  CLASSIC_DROPS,
  CLASSIC_HIT_RESPONSES,
  CLASSIC_STAR_MUSIC_LEFT,
  classicBlockPowerUp,
  classicBusy,
  classicDrop,
  classicHurtPaletteStep,
  classicLook,
  classicOnHurt,
  classicOnPowerUp,
  classicPickup,
  classicRespawn,
  classicStarPaletteStep,
  hasAmmo,
  spendAmmo,
  type ClassicDropTable,
  type ClassicPowerKit,
} from '../classic/power';
import {
  LINK_STRIKE,
  LinkBomb,
  LinkBoomerang,
  LinkShot,
  MAGIC_BOOMERANG,
  SHORT_BOOMERANG,
  beamLocked,
  bombSpot,
  bombsOut,
  sub,
  type ShotDir,
} from './classic-weapons';
import { CLASSIC_HURT, CLASSIC_WALK, LINK_FLIP_TICKS, WALK_ABAB, walkPose } from '../classic/anim';

/**
 * Classic SMBC Link (2026-10-07-link-classic-smbc-rules.md, LK-C1..LK-C45): the original's
 * default Link (Classic power-ups, Lose Everything, Bomb weapon). Constants from Link.as,
 * LinkProjectile.as, LinkBoomerang.as and the SWF's LinkMc rectangles (SMBC 3.1.21): Flash px/s
 * ÷ 120 = px/f, px/s² ÷ 7200 = px/f², Flash px ÷ 2 = px; velocities in 1/4096 px/f.
 */

/** LK-C5, LK-C7, LK-C9, LK-C10, LK-C12: digital walk, a gravity-first arc with a soft cut. */
export const LINK_CLASSIC_PROFILE: MovementProfile = {
  // Instant walk: these are not read with instantAccel.
  minWalk: 0,
  walkAccel: 0,
  runAccel: 0,
  releaseDecel: 0,
  skidDecel: 0,
  skidTurnaround: 0,
  maxWalk: 0x01755, // 175 px/s: 1.458 px/f
  maxRun: 0x01755,
  // Jump 600 px/s (0x05000) less one frame of gravity, as our move comes before gravity; gravity
  // 1300 px/s² (0x002E4) rising and falling; VY_MAX_PSV 800 px/s (0x06AAB), clamped.
  jump: [{ maxVx: Infinity, initial: 0x04d1c, holdGravity: 0x002e4, fallGravity: 0x002e4 }],
  maxFall: 0x06aab,
  fallReset: 0x06aab,
  runTimerFrames: 0,
  airControl: 'full',
  canRun: false,
  variableJump: false,
  instantAccel: true,
  coyoteFrames: 0,
  swim: CLASSIC_SWIM.link,
  softCut: 56210, // fy .0001 a second: 0.8577 a frame
  jumpBuffer: false,
  airStop: true,
};

/** The attack state: 9 live frames (ATK_DUR 150 ms), then 3 recovery frames at 30 fps (LK-C23). */
export const ATTACK_FRAMES = 15;
/** attackTimer (after the frame's countdown) above this: the sword box is live. */
const LIVE_ABOVE = ATTACK_FRAMES - 9;
/** attackTimer on the 9th frame from the press: the Red Ring beam fires (LK-C28). */
const BEAM_AT = LIVE_ABOVE + 1;
/** The down-thrust bounce (bouncePwr 325 px/s, 0x02B55) less one frame of gravity (LK-C25). */
export const THRUST_BOUNCE = 0x02871;
/** At most this many of Link's bombs on screen (LK-C36). */
export const MAX_BOMBS_OUT = 3;
/** Bomb and arrow caps, with the Bomb Bag / Quiver (LK-C18). */
export const AMMO_MAX = 20;
export const AMMO_MAX_UPGRADED = 40;
/** Bombs the first Mushroom gives; the repeat Fire Flower's bombs (LK-C14, LK-C15). */
export const FIRST_BOMBS = 3;
export const REPEAT_BOMBS = 3;

/** Sword damage by power state (DamageValue.as: Lv 1, Lv 2, Magic Sword; LK-C24). */
// LK-C42: fire Bowser (2400) takes 12 / 9 / 6 stabs, beams 12, bombs 3, arrows 7.
export const SWORD_DAMAGE = { small: 200, big: 275, fire: 400 } as const;

/** Stab poses (`_pose`): 1 forward, 2 up, 3 down; 4 a throw or bomb (no sword). */
const FORWARD = 1;
const UP = 2;
const DOWN = 3;
const THROW = 4;

/**
 * The sword boxes (SWF `LinkMc` attack rectangles, LK-C22): px from Link's centre x and feet,
 * facing right.
 */
export const SWORD_BOX = {
  forward: { x0: 6.8, x1: 19.3, y0: -9.5, y1: -3.5 },
  up: { x0: -3.5, x1: 0.5, y0: -27, y1: -17 },
  down: { x0: -1.5, x1: 2.5, y0: 0, y1: 10 },
} as const;

export function swordBox(p: Player, pose: keyof typeof SWORD_BOX): AABB {
  const r = SWORD_BOX[pose];
  const x0 = p.facing > 0 ? r.x0 : -r.x1;
  const x1 = p.facing > 0 ? r.x1 : -r.x0;
  return {
    x: p.centerX + sub(x0),
    y: p.feetY + sub(r.y0),
    w: sub(x1 - x0),
    h: sub(r.y1 - r.y0),
  };
}

const bombMax = (p: Player): number => (p.scratch.bombBag ? AMMO_MAX_UPGRADED : AMMO_MAX);
const ownsBombs = (p: Player): boolean => !!p.scratch.bombsOwned;
const fullKit = (p: Player): boolean => !!p.scratch.classicAll;

/**
 * The kit each power state implies (LK-C13..LK-C16): the Mushroom state owns bombs (3 the first
 * time), the Flower state adds the Bomb Bag and the Quiver. A hit takes only the state (the rings,
 * the Magic Sword and the Magic Boomerang are read from it), so bombs, the bag and the quiver stay.
 */
function claimKit(p: Player): void {
  if ((p.powerState === 'big' || p.powerState === 'fire') && !ownsBombs(p)) {
    p.scratch.bombsOwned = 1;
    p.scratch.bombs = Math.max(p.scratch.bombs ?? 0, FIRST_BOMBS);
  }
  if (p.powerState === 'fire' && !p.scratch.bombBag) {
    p.scratch.bombBag = 1;
    p.scratch.quiver = 1;
  }
}

const KIT: ClassicPowerKit = {
  response: CLASSIC_HIT_RESPONSES.link as ClassicPowerKit['response'],
  gainBig: (p) => claimKit(p),
  gainFire: (p) => claimKit(p),
  repeat: { key: 'bombs', max: bombMax, add: REPEAT_BOMBS },
};

const DROPS: ClassicDropTable = {
  ...(CLASSIC_DROPS.link as ClassicDropTable),
  gate: ownsBombs,
};

/** The dev full kit's belt (TG-44, LK-C38): Select cycles, Special uses. */
function tools(p: Player): ToolInfo[] {
  if (!fullKit(p)) return [];
  const bombs = p.scratch.bombs ?? 0;
  const arrows = p.scratch.arrows ?? 0;
  return [
    { id: 'boomerang', icon: 'icon-boomerang', count: null, usable: true },
    { id: 'bomb', icon: 'icon-bomb', count: bombs, usable: bombs > 0 || p.star > 0 },
    { id: 'arrow', icon: 'icon-arrow', count: arrows, usable: arrows > 0 || p.star > 0 },
  ];
}
const TOOL_LABELS: Record<string, string> = { boomerang: 'BOOMERANG', bomb: 'BOMB', arrow: 'BOW' };

/** Block tiles each sword action has struck, each once per action (LK-C26: once per contact). */
const struck = new WeakMap<Player, Set<number>>();
function newAction(p: Player): void {
  struck.get(p)?.clear();
}

/**
 * Strikes the weapon-strikable blocks the box overlaps (bricks break at once, item blocks bump;
 * hidden blocks too, BR-C11), each once per action; true when one was struck now. Returns the
 * top of the first struck block (subpixels) through `top`.
 */
function strikeBox(p: Player, world: World, box: AABB, top?: { y: number }): boolean {
  let seen = struck.get(p);
  if (!seen) struck.set(p, (seen = new Set()));
  let hit = false;
  for (let ty = tileAt(box.y); ty <= tileAt(box.y + box.h - 1); ty++)
    for (let tx = tileAt(box.x); tx <= tileAt(box.x + box.w - 1); tx++) {
      const block = tileDef(world.map.get(tx, ty)).block;
      if (!block || (block.kind === 'hidden' && block.content === 'teleporter')) continue;
      const key = ty * 4096 + tx;
      if (seen.has(key)) continue;
      seen.add(key);
      if (top && !hit) top.y = tileToSub(ty);
      world.strikeBlock(tx, ty, p, true, { source: 'melee' });
      hit = true;
    }
  return hit;
}

/** The down-thrust bounce (LK-C25): about 20 px, feet snapped to `top`. No stomp bounce. */
function thrustBounce(p: Player, top: number): void {
  const b = p.body;
  b.y = top - b.h;
  b.vy = -THRUST_BOUNCE;
  b.onGround = false;
  p.launched = false;
  // Each landing is a new hit: the enemies this thrust hit can be hit again once he falls.
  p.scratch._rehit = 1;
}

function clearThrust(p: Player): void {
  p.scratch.downThrust = 0;
  p.scratch.upThrust = 0;
  p.scratch._thrust = 0;
  p.scratch._thrustT = 0;
}

/** Whether Attack, Special or Select starts a 15-frame action now (LK-C6: rooted from this frame). */
function startsAction(p: Player, input: InputFrame): boolean {
  if (p.attackTimer > 0 || classicBusy(p)) return false;
  if (input.pressed('attack')) return true;
  if (input.pressed('special')) return true;
  return input.pressed('select') && !fullKit(p) && ownsBombs(p);
}

function fireShot(p: Player, world: World, dir: ShotDir, arrow: boolean): void {
  world.spawn(LinkShot.fire(p, dir, arrow));
  world.audio.sfx(arrow ? 'kick' : 'sword-beam');
}

/** The Red Ring beam, if it is free (LK-C28). */
function tryBeam(p: Player, world: World, dir: ShotDir): void {
  if (p.powerState !== 'fire' || beamLocked(p, world)) return;
  fireShot(p, world, dir, false);
}

/** Link's other shots out (bombs, beams, arrows; LK-C30). */
function othersOut(p: Player, world: World): number {
  return bombsOut(p, world) + world.countProjectiles(p, 'sword-beam') + world.countProjectiles(p, 'arrow');
}

function startAction(p: Player, pose: number): void {
  // Any action in the air ends the somersault: upright to the landing (Link.as attackStart).
  if (!p.body.onGround) p.scratch._flipDone = 1;
  p.attackTimer = ATTACK_FRAMES;
  p.scratch._pose = pose;
  p.activeMelee = null;
  clearThrust(p);
}

function throwBoomerang(p: Player, world: World, input: InputFrame): boolean {
  if (world.countProjectiles(p, 'boomerang') > 0 || othersOut(p, world) >= 2) return false;
  const type = p.powerState === 'fire' ? MAGIC_BOOMERANG : SHORT_BOOMERANG;
  world.spawn(LinkBoomerang.throwFrom(p, input.held('up'), input.held('down'), input.dirX, type));
  world.audio.sfx('boomerang');
  startAction(p, THROW);
  return true;
}

function placeBomb(p: Player, world: World): boolean {
  if (!ownsBombs(p) || !hasAmmo(p, 'bombs', 1) || bombsOut(p, world) >= MAX_BOMBS_OUT) return false;
  spendAmmo(p, 'bombs', 1);
  const at = bombSpot(p, world);
  world.spawn(new LinkBomb(at.cx, at.bottom, p));
  world.audio.sfx('kick');
  startAction(p, THROW);
  return true;
}

function shootArrow(p: Player, world: World, input: InputFrame): boolean {
  if (!p.scratch.bow || !hasAmmo(p, 'arrows', 1)) return false;
  spendAmmo(p, 'arrows', 1);
  fireShot(p, world, input.held('up') ? 'up' : input.held('down') ? 'down' : 'forward', true);
  startAction(p, THROW);
  return true;
}

/**
 * The somersault (F2; Link.as jump 696-709, checkState 801-824, flipTmrHandler 440-444): from any
 * take-off, a jump or a walk off a ledge, he rolls for as long as he is airborne; a stab, a throw,
 * a thrust, a vine or a hit ends it and he stays upright to the landing. Not in water.
 */
function trackFlip(p: Player): void {
  const sc = p.scratch;
  if (p.body.onGround || p.inWater) {
    sc._flipT = 0;
    sc._flipDone = 0;
    return;
  }
  if (p.hurtLock || p.stun > 0) sc._flipDone = 1;
  if (!sc._flipDone) sc._flipT = (sc._flipT ?? 0) + 1;
}

/** The air pose: 3 rolled poses then the upright `jump` twice, one every 140 ms; upright once ended. */
const FLIP_POSES = ['roll-0', 'roll-1', 'roll-2', 'jump', 'jump'] as const;
export function linkAirPose(p: Player): string {
  const t = p.scratch._flipT ?? 0;
  if (p.scratch._flipDone || t <= 0) return 'jump';
  return FLIP_POSES[Math.floor((t - 1) / LINK_FLIP_TICKS) % FLIP_POSES.length] as string;
}

function update(p: Player, input: InputFrame, world: World): void {
  claimKit(p);
  trackFlip(p);
  if (classicBusy(p)) {
    // A hit's push cancels the attack state (LK-C17); a freeze holds everything.
    if (p.hurtLock) {
      p.scratch._pose = 0;
      clearThrust(p);
      p.activeMelee = null;
    }
    return;
  }
  const b = p.body;
  const full = fullKit(p);
  if (full) cycleTool(p, input, tools(p), world);
  const wasActing = p.attackTimer > 0 || (p.scratch._pose ?? 0) > 0;
  if (p.attackTimer === 0) p.scratch._pose = 0;

  // Down-thrust re-hits: the bounce is over, so the enemies it hit count again.
  if (p.scratch._rehit && b.vy >= 0) {
    p.scratch._rehit = 0;
    for (const k of Object.keys(p.scratch)) if (/^hit\d+$/.test(k)) delete p.scratch[k];
  }

  if (p.attackTimer === 0) {
    const up = input.held('up');
    const down = input.held('down');
    if (input.pressed('attack')) {
      if (b.onGround) {
        newAction(p);
        startAction(p, up ? UP : down ? DOWN : FORWARD);
        p.scratch._air = 0;
        world.audio.sfx('sword');
      } else if (up || down) {
        // In the air with Up or Down: no stab, the thrust goes on; the Red Ring fires that way.
        tryBeam(p, world, up ? 'up' : 'down');
      } else {
        newAction(p);
        startAction(p, FORWARD);
        p.scratch._air = 1;
        world.audio.sfx('sword');
      }
    } else if (input.pressed('special')) {
      const t = full ? activeTool(p, tools(p)) : null;
      if (!t || t.id === 'boomerang') throwBoomerang(p, world, input);
      else if (t.id === 'bomb') placeBomb(p, world);
      else if (t.id === 'arrow') shootArrow(p, world, input);
    } else if (!full && input.pressed('select')) placeBomb(p, world);
  }

  const pose = p.scratch._pose ?? 0;
  if (p.attackTimer > 0 && pose >= FORWARD && pose <= DOWN) {
    // The stab (LK-C22, LK-C23): the box for the first 9 frames, the beam on the 9th.
    if (p.attackTimer > LIVE_ABOVE) {
      const key = pose === UP ? 'up' : pose === DOWN ? 'down' : 'forward';
      p.activeMelee = swordBox(p, key);
      strikeBox(p, world, p.activeMelee);
    } else p.activeMelee = null;
    if (p.attackTimer === BEAM_AT) {
      let dir: ShotDir = pose === UP ? 'up' : pose === DOWN ? 'down' : 'forward';
      if (p.scratch._air) dir = input.held('up') ? 'up' : input.held('down') ? 'down' : 'forward';
      tryBeam(p, world, dir);
    }
    clearThrust(p);
    return;
  }
  if (p.attackTimer > 0) {
    // A throw or a bomb: the attack state with no sword.
    p.activeMelee = null;
    clearThrust(p);
    return;
  }

  // Thrusts (LK-C25, LK-C26): Down or Up held in the air while not stabbing or throwing.
  const kind = b.onGround ? 0 : input.held('down') ? 1 : input.held('up') ? 2 : 0;
  if (kind === 0) {
    clearThrust(p);
    p.activeMelee = null;
    return;
  }
  p.scratch._flipDone = 1;
  if (p.scratch._thrust !== kind) {
    newAction(p);
    p.scratch._thrust = kind;
    // Out of an air stab with the direction still held, the thrust is live at once.
    p.scratch._thrustT = wasActing ? 1 : 0;
  }
  p.scratch._thrustT = (p.scratch._thrustT ?? 0) + 1;
  if (p.scratch._thrustT < 2) {
    p.activeMelee = null;
    return;
  }
  if (kind === 1) {
    p.scratch.downThrust = 1;
    p.scratch.upThrust = 0;
    p.activeMelee = swordBox(p, 'down');
    const top = { y: 0 };
    if (b.vy >= 0 && strikeBox(p, world, p.activeMelee, top)) thrustBounce(p, top.y);
  } else {
    p.scratch.upThrust = 1;
    p.scratch.downThrust = 0;
    p.activeMelee = swordBox(p, 'up');
    if (strikeBox(p, world, p.activeMelee) && b.vy < 0) b.vy = 0;
  }
}

/**
 * LK-C21: green, blue (`link-blue`) and red tunics by state. LK-C39: the shield is only drawn (no
 * `blocks` hook, no block pose).
 */
function sprite(p: Player, frame: number, reduceFlashing: boolean): SpriteSpec {
  let palette = p.powerState === 'fire' ? 'link-red' : p.powerState === 'big' ? 'link-blue' : 'link';
  const star = classicStarPaletteStep(p, frame, reduceFlashing);
  const hurt = classicHurtPaletteStep(p, frame, reduceFlashing, KIT.response.look);
  if (star !== null) palette = `link-star-${star}`;
  else if (hurt !== null) palette = `link-star-${hurt}`;
  const pose = p.scratch._pose ?? 0;
  let name: string;
  if (p.dead) name = 'die';
  else if (p.anim === 'hurt') name = 'hurt';
  else if (p.attackTimer > 0 && pose === UP) name = 'up-thrust';
  else if (p.attackTimer > 0 && pose === DOWN) name = 'down-thrust';
  else if ((p.attackTimer > 0 && pose === THROW) || (p.scratch.throwT ?? 0) > 0) name = 'throw';
  else if (p.attackTimer > 0)
    name = p.attackTimer > 10 ? 'attack-0' : p.attackTimer > LIVE_ABOVE - 1 ? 'attack-1' : 'attack-2';
  else if (p.scratch._thrust === 1) name = 'down-thrust';
  else if (p.scratch._thrust === 2) name = 'up-thrust';
  else {
    switch (p.anim) {
      case 'walk':
        name = `walk-${walkPose(p, WALK_ABAB)}`;
        break;
      case 'jump':
        name = linkAirPose(p);
        break;
      case 'swim':
        name = 'jump';
        break;
      case 'climb':
        name = `climb-${(frame >> 3) & 1}`;
        break;
      default:
        name = 'idle';
    }
  }
  // The 12 × 16 body (LK-C4) with the 24 px tall art drawn bottom-aligned on it.
  const sheet = name.startsWith('roll-') ? 'link-classic' : 'link';
  return { sheet, palette, frame: name, flip: p.facing < 0, offsetX: 2, offsetY: 16 };
}

export const LINK_CLASSIC: CharacterDef = {
  // The castle text's name (PM-M8): the original's default skin (BmdInfo.as).
  rescueName: 'Princess Zelda',
  id: LINK.id,
  name: LINK.name,
  hudName: LINK.hudName,
  portrait: LINK.portrait,
  ...(LINK.music !== undefined ? { music: LINK.music } : {}),
  rules: 'classic',
  movement: LINK_CLASSIC_PROFILE,
  damage: { kind: 'powerup', states: CLASSIC_POWER_STATES },
  // LK-C27: no stomp (landing on an enemy hurts unless thrusting); LK-C2: no crouch, no hearts,
  // meter, spells, shield block or belt.
  stomps: false,
  crouches: false,
  canBreakBricks: () => false,
  hitbox: () => ({ w: 12, h: 16 }),
  // F2: the original's HRect, 13.5 x 15 in every frame; its walk, 4 poses at 100 ms.
  hurtbox: () => ({ w: CLASSIC_HURT.w, h: CLASSIC_HURT.link }),
  walkAnim: CLASSIC_WALK.link,
  sprite,
  blockPowerUp: classicBlockPowerUp,
  powerIcon: true,
  jumpSfx: LINK.jumpSfx,
  // LK-C11: springs unchanged (spring.ts keys its numbers by hero id). LK-C44: every count and
  // timer is per player (scratch, bombsOut, countProjectiles by owner); bombs never hurt players.

  guide: LINK_CLASSIC_GUIDE,
  touchLabels: (p) =>
    fullKit(p)
      ? { attack: 'SWORD', special: toolButton(tools(p), p, TOOL_LABELS), select: 'TOOLS' }
      : { attack: 'SWORD', special: 'BOOMERANG', select: ownsBombs(p) ? 'BOMB' : null },
  drawLook: (p, _frame, reduce) => classicLook(p, reduce, KIT.response.look),
  starMusicLeft: CLASSIC_STAR_MUSIC_LEFT,
  drop: (rng, _e, killer) => (killer ? classicDrop(rng, killer, DROPS, 'enemy') : null),
  blockDrop: (rng, p, source) => classicDrop(rng, p, DROPS, source),
  // LK-C20: no hearts or meter; the bomb count once owned, and the power icon.
  hudAmmo: (p) => (ownsBombs(p) && !fullKit(p) ? { icon: 'icon-bomb', count: p.scratch.bombs ?? 0 } : null),
  tools,
  // TG-44, LK-C38: the Flower state (main.ts), bombs, the Bow, full ammo, Select cycling.
  devKit: () => ({
    classicAll: 1,
    bombsOwned: 1,
    bombBag: 1,
    quiver: 1,
    bow: 1,
    bombs: AMMO_MAX_UPGRADED,
    arrows: AMMO_MAX_UPGRADED,
  }),
  behaviour: {
    update,
    rooted: (p, input) => p.attackTimer > 0 || startsAction(p, input),
    meleeDamage: (p): DamageSource => ({
      kind: 'sword',
      amount: SWORD_DAMAGE[p.powerState as keyof typeof SWORD_DAMAGE] ?? SWORD_DAMAGE.small,
      owner: p,
      dirX: p.facing,
      ...LINK_STRIKE,
      blockedSfx: 'armour',
    }),
    onMeleeHit(p, enemy) {
      const b = p.body;
      if (p.scratch.downThrust) thrustBounce(p, enemy.body.y);
      else if (p.scratch.upThrust && b.vy < 0) b.vy = 0;
    },
    // LK-C43: on a vine World skips `update` (no stab, boomerang, bomb or jump); grabbing one
    // ends a push (Player.tickHurtLock) and the attack state here.
    onGrabVine(p) {
      // Off a vine he falls upright (Link.as 455-460).
      p.scratch._flipDone = 1;
      p.attackTimer = 0;
      p.scratch._pose = 0;
      clearThrust(p);
    },
    // LK-C40: the plain power-up, a 60-frame freeze going up a state (none for a Star or a repeat).
    onPowerUp: (p, kind, world) => classicOnPowerUp(p, kind, world, KIT),
    onHurt: (p, world, fromDir) => classicOnHurt(p, world, fromDir, KIT),
    // Drops are bomb ammo only (LK-C19): the arrow drop needs the Bow choice, out of scope.
    onPickup: (p, kind, world) => classicPickup(p, kind, world, { bomb: { key: 'bombs', max: bombMax } }),
    onRespawn: (p) => classicRespawn(p, {}),
    contactDamage: () => null,
  },
};
