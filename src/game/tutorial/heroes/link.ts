import type { World } from '../../world/world';
import { T } from '../../level/tiles';
import { Projectile } from '../../entities/projectiles/projectile';
import { LINK_SPELLS, MAX_MAGIC, SHIELD_SPELL } from '../../characters/link';
import { has } from '../../items/flags';
import type { Lesson } from '../stage-prompts';
import type { TutorialGate } from '../stage-tutorial';
import type { HeroStage } from '../hero-stage';
import { ownsItem } from '../kit';
import { hitsSince, hurtsSince, blocksSince, onTop } from './common';
import source from '../../../content/levels/training/link.map?raw';

/*
 * Link's training stage (0.4.37, the owner's design section 4), in the Zelda II field look
 * (src/content/levels/training/link.map). He starts with three hearts, the sword, the shield, both
 * thrusts and the Boomerang, and takes each item from a ? block in the order his kit builds up
 * (docs/POWERUPS.md 5.2): the Heart Container, the Bomb Bag, the Shield and Jump spells, the Blue
 * Ring, the Fire spell and the Magical Sword.
 *
 * The Blue Ring's lesson is built around one rule, every other hit costs no heart: his hearts are
 * full and never topped up while it is played, walkers come out of the palace door one at a time,
 * and the box's two lights show it, FREE on the first bump (nothing lost, a knock back), HURT on
 * the next (half a heart). A Shield spell still running is put out first (with the ring, the spell
 * makes every hit free while it lasts).
 */

/** The set pieces' columns (link.map). */
export const LINK_STAGE = {
  sword: 11,
  shooter: 27,
  shieldGate: 30,
  dip: { from: 35, to: 37 },
  thrustGate: 41,
  coinBlock: { x: 46, y: 8 },
  upGate: 49,
  ledge: { from: 53, to: 56, top: 7 },
  coin: { x: 55, y: 6 },
  boomerangGate: 59,
  heartBlock: { x: 64, y: 8 },
  bombBlock: { x: 69, y: 8 },
  bombTarget: 74,
  bombGate: 77,
  shieldBlock: { x: 81, y: 8 },
  jumpBlock: { x: 87, y: 8 },
  wall: { from: 92, to: 95, top: 6 },
  ringBlock: { x: 99, y: 8 },
  door: 108,
  ringGate: 110,
  fireBlock: { x: 114, y: 8 },
  ditch: { from: 118, to: 121 },
  fireTarget: 125,
  fireGate: 128,
  swordBlock: { x: 131, y: 8 },
  swordTarget: 138,
  swordGate: 141,
  flag: 148,
} as const;
const S = LINK_STAGE;

/** Frames of the Shield spell's bar seen running before its lesson is done. */
export const SHIELD_BAR_SEEN = 60;

/** Per world: the up-thrust's lesson, the coin blocks bumped as of the last frame. */
const coinCounts = new WeakMap<World, { frame: number; coins: number; thrust: boolean }>();

/** A coin block was opened by an up-thrust (counted on the frame it gave its coin). */
function upThrustCoin(w: World): boolean {
  let c = coinCounts.get(w);
  if (!c) coinCounts.set(w, (c = { frame: -1, coins: w.feats.coinBlocks, thrust: false }));
  if (c.frame === w.frame) return c.thrust;
  c.frame = w.frame;
  if (w.feats.coinBlocks > c.coins && w.player.scratch.upThrust) c.thrust = true;
  c.coins = w.feats.coinBlocks;
  return c.thrust;
}

/** The boomerang brought the ledge's coin back: the coin is gone and no boomerang is out. */
function coinFetched(w: World): boolean {
  if (w.map.get(S.coin.x, S.coin.y) === T.COIN) return false;
  return !w.entities.some((e) => e instanceof Projectile && e.alive && e.kind === 'boomerang');
}

/** Per world: the frame the Blue Ring was taken in this lesson (null: not yet). */
const ringFrames = new WeakMap<World, number>();

/**
 * The Blue Ring's two lights: FREE once a hit after the grab cost nothing, HURT once a later one
 * cost half a heart.
 */
export function ringLights(w: World): { free: boolean; hurt: boolean; at: number } {
  let from = ringFrames.get(w);
  if (from === undefined) {
    if (!ownsItem(w.player, 'blue-ring')) return { free: false, hurt: false, at: 0 };
    ringFrames.set(w, (from = w.frame));
  }
  const hurts = hurtsSince(w).filter((h) => h.frame >= (from as number));
  const free = hurts.findIndex((h) => h.cost === 0);
  const hurt = free >= 0 ? hurts.slice(free + 1).find((h) => h.cost > 0) : undefined;
  return { free: free >= 0, hurt: !!hurt, at: hurt?.frame ?? 0 };
}

/** Frames both lights show before the ring's lesson is done. */
export const READ_FRAMES = 75;

/** Magic full for a spell's lesson (he can always cast it again). */
const fillMagic = (w: World): void => {
  const p = w.player;
  if (LINK_SPELLS.some((id) => has(p, id))) p.scratch.magic = MAX_MAGIC;
};

export const LINK_LESSONS: readonly Lesson[] = [
  {
    id: 'sword',
    at: 2,
    row: 11,
    text: 'SWING YOUR [SWORD:attack] AT THE TARGET.',
    done: (w) => hitsSince(w, (h) => h.kind === 'sword' && !h.shot).length > 0,
  },
  {
    id: 'shield',
    at: 17,
    row: 11,
    text: 'STAND STILL, FACING THE SHOOTER. YOUR SHIELD BLOCKS ITS SHOTS.',
    retry: 'STAND STILL AND FACE THE SHOOTER: YOUR SHIELD BLOCKS ITS SHOTS.',
    done: (w) => blocksSince(w).blocks > 0,
  },
  {
    id: 'down-thrust',
    at: 31,
    row: 11,
    text: '[JUMP:jump] OVER THE ENEMY AND HOLD DOWN TO STAB DOWN ON IT.',
    retry: 'STAB DOWN ON THE ENEMY: [JUMP:jump] OVER IT AND HOLD DOWN. HERE IT COMES AGAIN!',
    done: (w) => hitsSince(w, (h) => h.downThrust).length > 0,
  },
  {
    id: 'up-thrust',
    at: 42,
    row: 11,
    text: '[JUMP:jump] UNDER THE BLOCK AND HOLD UP TO STAB UP INTO IT.',
    retry: 'HOLD UP AS YOU [JUMP:jump] UNDER THE BLOCK: YOUR SWORD STABS UP INTO IT.',
    done: upThrustCoin,
  },
  {
    id: 'boomerang',
    at: 50,
    row: 11,
    text: '[USE TOOL:special:BOOMERANG] THROWS THE BOOMERANG: JUMP AND FETCH THE COIN ON THE LEDGE.',
    touchText: 'JUMP AND TAP [BOOMERANG:special:BOOMERANG] TO FETCH THE COIN ON THE LEDGE. IT COMES BACK!',
    retry: 'JUMP BY THE LEDGE AND SEND THE BOOMERANG AT THE TOP OF THE JUMP: IT BRINGS THE COIN BACK.',
    done: coinFetched,
  },
  {
    id: 'heart-container',
    at: 60,
    row: 11,
    item: 'heart-container',
    block: S.heartBlock,
    get: 'OPEN THE ? BLOCK WITH YOUR [SWORD:attack]: JUMP AND SWING, OR STAB UP.',
    text: 'ONE MORE HEART, AND ALL OF THEM FILLED.',
    done: (w) => (w.player.scratch.maxHp ?? 6) >= 8 && w.player.hp >= 8,
  },
  {
    id: 'bomb',
    at: 66,
    row: 11,
    item: 'bomb-bag',
    block: S.bombBlock,
    get: 'ANOTHER ? BLOCK! OPEN IT TOO.',
    text: '[TOOLS:select] TO THE BOMB. SET ONE BY THE TARGET!',
    touchText: 'TAP [TOOLS:select] TILL THE BUTTON READS BOMB, THEN TAP IT BY THE TARGET.',
    retry: 'PICK THE BOMB WITH [TOOLS:select], SET IT BY THE TARGET AND STEP BACK FROM THE BLAST.',
    done: (w) => hitsSince(w, (h) => h.kind === 'bomb').length > 0,
  },
  {
    id: 'shield-spell',
    at: 78,
    row: 11,
    item: 'shield-spell',
    block: S.shieldBlock,
    enter: fillMagic,
    get: 'A SPELL IN THIS ? BLOCK! OPEN IT.',
    text: '[TOOLS:select] TO IT, [USE TOOL:special:SHIELD] CASTS IT.',
    touchText: 'TAP [TOOLS:select] TO IT, THEN TAP [SHIELD:special:SHIELD]. A BAR SHOWS ITS TIME.',
    done: (w) => {
      const t = w.player.scratch.shieldSpell ?? 0;
      return t > 0 && t <= SHIELD_SPELL.frames - SHIELD_BAR_SEEN;
    },
    meter: (w) => (w.player.scratch.shieldSpell ?? 0) / SHIELD_SPELL.frames,
  },
  {
    id: 'jump-spell',
    at: 84,
    row: 11,
    item: 'jump-spell',
    block: S.jumpBlock,
    enter: fillMagic,
    get: 'THE WALL IS TOO HIGH. THE ? BLOCK HOLDS A SPELL FOR IT!',
    text: 'CAST IT, THEN [JUMP:jump] ONTO THE WALL.',
    touchText: 'PICK IT WITH [TOOLS:select], TAP [HI-JUMP:special:HI-JUMP], THEN [JUMP:jump] ONTO THE WALL.',
    done: (w) => onTop(w, S.wall.top, S.wall.from, S.wall.to),
  },
  {
    id: 'blue-ring',
    at: 97,
    row: 11,
    item: 'blue-ring',
    block: S.ringBlock,
    // A Shield spell still running would make every hit free: put out, and the ring's count reset.
    enter: (w) => {
      w.player.scratch.shieldSpell = 0;
      w.player.scratch.halfHit = 0;
    },
    get: 'OPEN THE ? BLOCK IN THE PEN.',
    text: 'EVERY OTHER HIT COSTS NO HEART. LET TWO ENEMIES BUMP YOU.',
    retry: 'TAKE THE BLUE RING, THEN LET TWO ENEMIES BUMP YOU: ONE IS FREE, ONE COSTS.',
    // Both lights lit, and read for a moment.
    done: (w) => {
      const l = ringLights(w);
      return l.free && l.hurt && w.frame >= l.at + READ_FRAMES;
    },
    lights: (w) => {
      const l = ringLights(w);
      return [
        { label: 'FREE', on: l.free },
        { label: 'HURT', on: l.hurt },
      ];
    },
  },
  {
    id: 'fire-spell',
    at: 111,
    row: 11,
    item: 'fire-spell',
    block: S.fireBlock,
    enter: fillMagic,
    get: 'ONE MORE SPELL IN THIS ? BLOCK.',
    text: 'CAST IT. YOUR NEXT [SWORD:attack] FIRES A BEAM: HIT THE FAR TARGET.',
    touchText:
      'PICK IT WITH [TOOLS:select] AND TAP [FIRE:special:FIRE]: THE NEXT [SWORD:attack] FIRES A BEAM!',
    retry: 'THE FIRE SPELL, THEN A SWING: ITS BEAM FLIES OVER THE DITCH TO THE TARGET.',
    done: (w) => hitsSince(w, (h) => h.shotKind === 'sword-beam').length > 0,
  },
  {
    id: 'magical-sword',
    at: 129,
    row: 11,
    item: 'magical-sword',
    block: S.swordBlock,
    // A Fire spell cast and not swung would fire the beam by itself.
    enter: (w) => void (w.player.scratch.fireSpell = 0),
    get: 'THE LAST ? BLOCK!',
    text: 'WITH FULL HEARTS, [SWORD:attack] FIRES BEAMS. HIT THE TARGET TWICE.',
    done: (w) => hitsSince(w, (h) => h.shotKind === 'sword-beam').length >= 2,
  },
  {
    id: 'flag',
    at: 142,
    row: 11,
    note: true,
    text: 'ALL DONE! GRAB THE FLAGPOLE.',
    done: (w) => w.flagGrabbedBy !== null,
  },
];

/** A gate is eight blocks over the ground (rows 3-11): no jump clears it, not even the spell's. */
const gate = (col: number, after: string): TutorialGate => ({ col, top: 3, bottom: 11, after });

export const LINK_GATES: readonly TutorialGate[] = [
  gate(S.shieldGate, 'shield'),
  gate(S.thrustGate, 'down-thrust'),
  gate(S.upGate, 'up-thrust'),
  gate(S.boomerangGate, 'boomerang'),
  gate(S.bombGate, 'bomb'),
  gate(S.ringGate, 'blue-ring'),
  gate(S.fireGate, 'fire-spell'),
  gate(S.swordGate, 'magical-sword'),
];

export const LINK_STAGE_DEF: HeroStage = {
  hero: 'link',
  source,
  greeting: [
    "LINK! WELCOME TO THE MUSHROOM KINGDOM. LET'S SEE YOUR SWORD AND YOUR TOOLS.",
    'FOLLOW THE TIPS UP TOP!',
  ],
  tutorial: {
    level: 'training-link',
    hero: 'link',
    lessons: LINK_LESSONS,
    gates: LINK_GATES,
  },
};
