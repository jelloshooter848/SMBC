import { px, tileToSub } from '@engine/math/units';
import { overlaps } from '@engine/math/aabb';
import type { World } from '../../world/world';
import { T } from '../../level/tiles';
import { Projectile } from '../../entities/projectiles/projectile';
import { Firebar } from '../../entities/enemies/firebar';
import { MAX_HP } from '../../characters/simon';
import { SUB_WEAPONS } from '../../characters/simon/weapons';
import type { Lesson } from '../stage-prompts';
import type { TutorialGate } from '../stage-tutorial';
import type { HeroStage } from '../hero-stage';
import { LessonCandle, TrainingTarget } from '../targets';
import { alive, hitLessons, hitsSince, landedPast, onTop } from './common';
import source from '../../../content/levels/training/simon.map?raw';

/*
 * Simon's training stage (0.4.38, the owner's design section 7), in the Castlevania courtyard-gate
 * look (src/content/levels/training/simon.map). He starts with the leather whip, 5 hearts and a
 * 10-point bar, and takes each item from a ? block in the order his kit builds up (docs/POWERUPS.md
 * 6.2): the Pot Roast first, then the Chain Whip, the Dagger, the Holy Water, the Axe, the Morning
 * Star, the Cross, the Double and Triple Shot (one lesson, owner) and the Stopwatch.
 *
 * His whips are taught on wall candles (his crypt's), each standing just past the last whip's reach
 * from a low wall he walks up to: the chain reaches the second, the Morning Star the third. His
 * hearts (sub-weapon ammo) are kept at 10 or more, except in the Dagger's lesson, which shows the
 * count going down (it starts at 10 again at each put-back).
 */

/** The set pieces' columns (simon.map). */
export const SIMON_STAGE = {
  wallCandle: 12,
  whipGate: 15,
  stairs: { foot: 18, len: 5 },
  ledge: { from: 23, to: 27, top: 7 },
  ditch: { from: 31, to: 32 },
  /** The double jump's wall (0.4.46, #27): two blocks wide, its top six over the ground. */
  doubleWall: { from: 41, to: 42, top: 6 },
  roastBlock: { x: 50, y: 9 },
  chainBlock: { x: 52, y: 9 },
  chainWall: 58,
  chainGate: 63,
  daggerBlock: { x: 67, y: 9 },
  daggerTarget: 73,
  daggerGate: 76,
  waterBlock: { x: 79, y: 9 },
  pipe: 87,
  waterGate: 90,
  axeBlock: { x: 93, y: 9 },
  shelf: { from: 100, to: 103, row: 7 },
  axeTarget: 101,
  axeGate: 106,
  starBlock: { x: 109, y: 9 },
  starWall: 114,
  starGate: 119,
  crossBlock: { x: 121, y: 9 },
  crossTarget: 126,
  crossGate: 129,
  doubleBlock: { x: 133, y: 9 },
  tripleBlock: { x: 136, y: 9 },
  shotsGate: 142,
  watchBlock: { x: 146, y: 9 },
  firebar: { x: 155, y: 9 },
  /** Past the fire bar's reach: his middle at this column. */
  pastBar: 159,
  watchGate: 160,
  /** WHAT A HIT TAKES (0.4.46): the thorn bush, and the gate until the hit is taken. */
  thorns: 165,
  hitGate: 167,
  flag: 174,
} as const;
const S = SIMON_STAGE;

/** Hearts kept for a lesson with sub-weapons (the Stopwatch alone costs 5). */
export const SIMON_HEARTS = 10;

/** Hearts up to at least SIMON_HEARTS (an `enter`, or every frame: `during`). */
const keepHearts = (w: World): void => {
  for (const p of w.players) p.scratch.hearts = Math.max(p.scratch.hearts ?? 0, SIMON_HEARTS);
};

/** Row of the low walls the whip candles stand on (one block over the ground). */
const WALL_ROW = 11;

/**
 * A whip lesson's low wall crumbles once it is done (Simon could only climb it with a run-up: he
 * can't steer in the air), as the next lesson comes up. In a stretch rebuilt further on it goes
 * quietly; just after the lesson, in pieces with a sound.
 */
const crumble =
  (col: number) =>
  (w: World): void => {
    if (!w.map.isSolid(col, WALL_ROW)) return;
    w.map.set(col, WALL_ROW, T.AIR);
    const near = w.players.some((p) => Math.abs(p.centerX - tileToSub(col)) < px(48));
    if (!near) return;
    w.breakPieces(col, WALL_ROW);
    w.audio.sfx('break');
  };

/** Per world: each lesson's candle, and whether a whip put it out. */
const candles = new WeakMap<World, Map<string, { candle: LessonCandle | null; whipped: boolean }>>();

/**
 * Lesson `id`'s candle was put out by a crack of the whip: on the frame it went out, the whip's
 * lash was over it (walking or jumping into it puts it out too, but that is no whip).
 */
export function candleWhipped(w: World, id: string): boolean {
  let all = candles.get(w);
  if (!all) candles.set(w, (all = new Map()));
  let c = all.get(id);
  if (!c) all.set(id, (c = { candle: null, whipped: false }));
  if (c.whipped) return true;
  if (!c.candle) {
    c.candle =
      w.entities.find((e): e is LessonCandle => e instanceof LessonCandle && e.lesson === id) ?? null;
    return false;
  }
  if (c.candle.alive) return false;
  const body = c.candle.body;
  c.whipped = w.players.some((p) => p.activeMelee !== null && overlaps(p.activeMelee, body));
  c.candle = null;
  return c.whipped;
}

/** Sub-weapons of his in the air now. */
const subsOut = (w: World): number =>
  w.entities.filter(
    (e) =>
      e instanceof Projectile && e.alive && e.owner === w.player && SUB_WEAPONS.some((s) => s.id === e.kind),
  ).length;

/** Per world: where he stood last frame, and whether he got past the fire bar while it was frozen. */
const barPasses = new WeakMap<World, { x: number; frozen: boolean }>();

/** He walked past the fire bar while the Stopwatch held it still. */
function pastFrozenBar(w: World): boolean {
  const p = w.player;
  const line = tileToSub(S.pastBar) + px(8);
  let s = barPasses.get(w);
  if (!s) barPasses.set(w, (s = { x: p.centerX, frozen: false }));
  if (s.frozen) return true;
  const bar = w.entities.find((e): e is Firebar => e instanceof Firebar && e.alive);
  if (alive(p) && s.x < line && p.centerX >= line && !!bar && bar.stunned > 0) s.frozen = true;
  s.x = p.centerX;
  return s.frozen;
}

export const SIMON_LESSONS: readonly Lesson[] = [
  {
    id: 'whip',
    at: 2,
    row: 11,
    text: 'CRACK THE [WHIP:attack] AT THE CANDLE. IT WINDS UP, SO SWING EARLY.',
    retry: 'WALK UP TO THE LOW WALL AND CRACK THE [WHIP:attack] AT THE CANDLE ON IT.',
    done: (w) => candleWhipped(w, 'whip'),
  },
  {
    id: 'stairs',
    at: 16,
    row: 11,
    enter: crumble(S.wallCandle),
    text: 'AT THE FOOT OF THE STAIRS, HOLD UP TO CLIMB.',
    done: (w) => onTop(w, S.ledge.top, S.ledge.from, S.ledge.to),
  },
  {
    id: 'committed-jump',
    at: 28,
    row: 11,
    text: "SIMON CAN'T STEER IN THE AIR. WALK, AND [JUMP:jump] AT THE DITCH'S EDGE.",
    done: (w) => landedPast(w, S.ditch.to + 1),
  },
  {
    // 0.4.46 (owner #27): the original Crossover's Simon.canDoubleJump, his base kit.
    id: 'double-jump',
    at: 36,
    row: 11,
    text: 'JUMP AGAIN IN THE AIR FOR A SECOND JUMP: [JUMP:jump] TWICE TO GET OVER THE WALL.',
    done: (w) =>
      onTop(w, S.doubleWall.top, S.doubleWall.from, S.doubleWall.to) || landedPast(w, S.doubleWall.to + 1),
  },
  {
    id: 'pot-roast',
    at: 49,
    row: 11,
    item: 'pot-roast',
    block: S.roastBlock,
    get: 'JUMP UP INTO THE ? BLOCK, THEN JUMP ONTO IT FOR WHAT COMES OUT.',
    text: 'YOUR HEALTH BAR GROWS TO 16, AND FILLS.',
    done: (w) => (w.player.scratch.maxHp ?? 0) >= MAX_HP,
  },
  {
    id: 'chain-whip',
    at: 52,
    row: 11,
    item: 'chain-whip',
    block: S.chainBlock,
    get: 'ANOTHER ? BLOCK!',
    text: 'IT REACHES FURTHER: [WHIP:attack] THE CANDLE FROM THE LOW WALL.',
    retry: 'WALK UP TO THE LOW WALL, THEN [WHIP:attack]: THE CHAIN REACHES THE CANDLE.',
    done: (w) => candleWhipped(w, 'chain-whip'),
  },
  {
    id: 'dagger',
    at: 64,
    row: 11,
    item: 'dagger',
    block: S.daggerBlock,
    // The count shows going down here (and never runs dry: 10 again at a put-back).
    enter: (w) => {
      keepHearts(w);
      crumble(S.chainWall)(w);
    },
    get: 'A ? BLOCK!',
    text: '[THROW:special:DAGGER] IT AT THE TARGET. EACH COSTS A HEART: SEE THE COUNT.',
    touchText: 'TAP [DAGGER:special:DAGGER] AT THE TARGET. EACH ONE COSTS A HEART: WATCH THE COUNT.',
    retry: 'STAND FACING THE TARGET: THE DAGGER FLIES STRAIGHT AT IT.',
    done: (w) =>
      hitsSince(w, (h) => h.shotKind === 'dagger' && h.target instanceof TrainingTarget).length > 0,
  },
  {
    id: 'holy-water',
    at: 77,
    row: 11,
    item: 'holy-water',
    block: S.waterBlock,
    during: keepHearts,
    get: 'ANOTHER ? BLOCK!',
    text: 'IT BURNS ON THE FLOOR. [TOOLS:select] TO IT, THEN [THROW:special:WATER].',
    touchText: 'TAP [TOOLS:select] TILL IT READS WATER. TAP [WATER:special:WATER]: IT BURNS ON THE FLOOR.',
    retry: 'PICK THE HOLY WATER WITH [TOOLS:select] AND LET AN ENEMY WALK INTO ITS FLAME.',
    done: (w) =>
      hitsSince(w, (h) => h.shotKind === 'holy-water' && !(h.target instanceof TrainingTarget)).length > 0,
  },
  {
    id: 'axe',
    at: 91,
    row: 11,
    item: 'axe',
    block: S.axeBlock,
    during: keepHearts,
    get: 'A ? BLOCK!',
    text: 'IT ARCS HIGH: HIT THE TARGET ON THE LEDGE. [TOOLS:select] TO IT.',
    touchText: 'TAP [TOOLS:select] TILL IT READS AXE. TAP [AXE:special:AXE]: IT ARCS UP TO THE TARGET.',
    retry: 'PICK THE AXE WITH [TOOLS:select]. FROM A FEW STEPS BEFORE THE LEDGE, IT ARCS UP TO THE TARGET.',
    done: (w) =>
      hitsSince(w, (h) => h.shotKind === 'hand-axe' && h.target instanceof TrainingTarget).length > 0,
  },
  {
    id: 'morning-star',
    at: 107,
    row: 11,
    item: 'morning-star',
    block: S.starBlock,
    get: 'A ? BLOCK!',
    text: 'THE LONGEST WHIP. AT THE LOW WALL, [WHIP:attack] THE FAR CANDLE.',
    retry: 'WALK UP TO THE LOW WALL, THEN [WHIP:attack]: THE MORNING STAR REACHES THE CANDLE.',
    done: (w) => candleWhipped(w, 'morning-star'),
  },
  {
    id: 'cross',
    at: 120,
    row: 11,
    item: 'cross',
    block: S.crossBlock,
    enter: crumble(S.starWall),
    during: keepHearts,
    get: 'ANOTHER ? BLOCK!',
    text: '[TOOLS:select] TO IT. [THROW:special:CROSS] IT AT THE TARGET: IT COMES BACK!',
    touchText:
      'TAP [TOOLS:select] TILL IT READS CROSS. TAP [CROSS:special:CROSS] AT THE TARGET: IT COMES BACK!',
    retry: 'PICK THE CROSS WITH [TOOLS:select] AND SEND IT AT THE TARGET.',
    done: (w) => hitsSince(w, (h) => h.shotKind === 'cross' && h.target instanceof TrainingTarget).length > 0,
  },
  {
    id: 'shots',
    at: 130,
    row: 11,
    item: 'double-shot',
    // The font has no "&": the nearest that reads as one lesson with the box's TRIPLE SHOT!.
    name: 'Double + Triple Shot',
    block: S.doubleBlock,
    more: [{ item: 'triple-shot', block: S.tripleBlock }],
    during: keepHearts,
    get: 'TWO ? BLOCKS: THE DOUBLE SHOT, THEN THE TRIPLE SHOT!',
    text: 'THREE AXES AT ONCE: [TOOLS:select] TO THE AXE, [THROW:special:AXE] FAST!',
    touchText: 'TAP [TOOLS:select] TILL IT READS AXE. TAP [AXE:special:AXE] THREE TIMES, FAST!',
    retry: 'THREE AXES IN THE AIR AT ONCE OPEN THE WAY. BE QUICK!',
    done: (w) => subsOut(w) >= 3,
  },
  {
    id: 'stopwatch',
    at: 144,
    row: 11,
    item: 'stopwatch',
    block: S.watchBlock,
    during: keepHearts,
    get: 'THE LAST ? BLOCK!',
    text: '[TOOLS:select] TO IT. FREEZE THE BAR, WALK PAST!',
    touchText:
      'TAP [TOOLS:select] TILL IT READS WATCH. TAP [WATCH:special:WATCH] BY THE FIRE BAR, WALK PAST.',
    retry: 'USE THE STOPWATCH CLOSE TO THE FIRE BAR, THEN WALK PAST IT WHILE IT STANDS STILL.',
    done: pastFrozenBar,
  },
  ...hitLessons('simon', { at: 161, row: 11, thorns: S.thorns }),
  {
    id: 'flag',
    at: 161,
    row: 11,
    note: true,
    text: 'ALL DONE! GRAB THE FLAGPOLE.',
    done: (w) => w.flagGrabbedBy !== null,
  },
];

/** A gate stands from under the HUD to the ground: no jump of his clears it. */
const gate = (col: number, after: string): TutorialGate => ({ col, top: 2, bottom: 11, after });

export const SIMON_GATES: readonly TutorialGate[] = [
  gate(S.whipGate, 'whip'),
  gate(S.chainGate, 'chain-whip'),
  gate(S.daggerGate, 'dagger'),
  gate(S.waterGate, 'holy-water'),
  gate(S.axeGate, 'axe'),
  gate(S.starGate, 'morning-star'),
  gate(S.crossGate, 'cross'),
  gate(S.shotsGate, 'shots'),
  // The fire bar's blink after a hit would let him walk through it: the gate holds until it is frozen.
  gate(S.watchGate, 'stopwatch'),
  gate(S.hitGate, 'hit'),
];

export const SIMON_STAGE_DEF: HeroStage = {
  hero: 'simon',
  source,
  greeting: [
    "SIMON! THE KINGDOM'S ? BLOCKS HOLD YOUR WHIPS AND SUB-WEAPONS. LET'S FIND THEM ALL.",
    'FOLLOW THE TIPS UP TOP!',
  ],
  tutorial: {
    level: 'training-simon',
    hero: 'simon',
    lessons: SIMON_LESSONS,
    gates: SIMON_GATES,
    // Clear of his health bar at the left edge (hud.ts, x 7-15).
    boxLeft: 26,
  },
};
