import type { World } from '../../world/world';
import { Projectile } from '../../entities/projectiles/projectile';
import { START_HITS } from '../../characters/bill';
import type { Lesson } from '../stage-prompts';
import { lessonUpFrame } from '../stage-prompts';
import type { TutorialGate } from '../stage-tutorial';
import type { HeroStage } from '../hero-stage';
import { TrainingTarget, type StageHit } from '../targets';
import { alive, hitsSince, landedPast } from './common';
import source from '../../../content/levels/training/bill.map?raw';

/*
 * Bill's training stage (0.4.38, the owner's design section 9), in the Contra jungle look
 * (src/content/levels/training/bill.map). He starts with the rifle, 8-way aim, prone and 3 hits,
 * then takes a Medal (his grow item) and each falcon gun from a block in the order his kit builds
 * up (docs/POWERUPS.md 6.2). A new gun is in his hands at once.
 */

/** The set pieces' columns (bill.map). */
export const BILL_STAGE = {
  enemy: 13,
  shootGate: 16,
  upTarget: 22,
  ledge: { from: 30, to: 31, top: 6 },
  diagonalTarget: 30,
  aimGate: 34,
  turret: 42,
  proneGate: 45,
  ditch: { from: 50, to: 53 },
  downGate: 56,
  medalBlock: { x: 58, y: 9 },
  gunBlock: { x: 62, y: 9 },
  gunGate: 75,
  laserBlock: { x: 82, y: 9 },
  laserTargets: [88, 90],
  laserGate: 93,
  flameBlock: { x: 96, y: 9 },
  toughTarget: 102,
  flameGate: 105,
  spreadBlock: { x: 108, y: 9 },
  spreadTargets: [118, 117, 116],
  spreadGate: 121,
  flag: 127,
} as const;
const S = BILL_STAGE;

/** Lesson `id`'s targets hit (each counted once) by hits `pred` accepts since it came up. */
function targetsHit(w: World, id: string, pred: (h: StageHit) => boolean): number {
  const hit = hitsSince(w, (h) => h.target instanceof TrainingTarget && h.target.lesson === id && pred(h));
  return new Set(hit.map((h) => h.target)).size;
}

/** Shots the machine gun must fire in one hold. */
export const HOLD_SHOTS = 10;
/** Frames between two of its shots still counted as one hold (it fires every 6, fewer when full). */
const HOLD_GAP = 16;

/** Per world: the machine gun's shots seen, and the longest run of them in one hold. */
const holds = new WeakMap<World, { seen: WeakSet<Projectile>; last: number; run: number; best: number }>();

/** The most machine-gun shots fired in one hold since the lesson came up. */
export function heldShots(w: World): number {
  const from = lessonUpFrame(w);
  let h = holds.get(w);
  if (!h) holds.set(w, (h = { seen: new WeakSet(), last: -999, run: 0, best: 0 }));
  if (w.frame < from) return 0;
  for (const e of w.entities) {
    if (!(e instanceof Projectile) || !e.alive || e.kind !== 'mg' || e.owner !== w.player || h.seen.has(e))
      continue;
    h.seen.add(e);
    h.run = w.frame - h.last <= HOLD_GAP ? h.run + 1 : 1;
    h.last = w.frame;
    h.best = Math.max(h.best, h.run);
  }
  return h.best;
}

/** Per world: the turret's shots seen ahead of him, and how many flew over him while he lay prone. */
const overs = new WeakMap<World, { ahead: WeakSet<Projectile>; count: number }>();

/** Turret shots that flew over him (from in front to behind him) while he lay prone, unhurt. */
export function shotsOver(w: World): number {
  let o = overs.get(w);
  if (!o) overs.set(w, (o = { ahead: new WeakSet(), count: 0 }));
  const p = w.player;
  for (const e of w.entities) {
    if (!(e instanceof Projectile) || !e.alive || !(e.owner instanceof TrainingTarget)) continue;
    const mid = e.body.x + (e.body.w >> 1);
    if (mid > p.centerX) o.ahead.add(e);
    else if (o.ahead.has(e)) {
      o.ahead.delete(e);
      if (alive(p) && p.crouching && p.invuln === 0) o.count++;
    }
  }
  return o.count;
}

/**
 * One shot of `kind` (a laser's beam), or one volley of them (a spread's five, fired on one frame:
 * markVolleys), hit `n` different targets.
 */
function volleyHit(w: World, kind: string, n: number): boolean {
  const per = new Map<unknown, Set<unknown>>();
  for (const h of hitsSince(w, (x) => x.shotKind === kind && x.target instanceof TrainingTarget)) {
    const key = (h.shot as Projectile & { born?: number }).born ?? h.shot;
    let set = per.get(key);
    if (!set) per.set(key, (set = new Set()));
    set.add(h.target);
  }
  return [...per.values()].some((s) => s.size >= n);
}

/** Per world: the frame each spread shot was first seen (its volley). */
const births = new WeakMap<World, number>();

/** Marks every spread shot with the frame it was first seen (shots fired together share one). */
function markVolleys(w: World): void {
  if (births.get(w) === w.frame) return;
  births.set(w, w.frame);
  for (const e of w.entities)
    if (
      e instanceof Projectile &&
      e.kind === 'spread' &&
      (e as Projectile & { born?: number }).born === undefined
    )
      (e as Projectile & { born?: number }).born = w.frame;
}

export const BILL_LESSONS: readonly Lesson[] = [
  {
    id: 'rifle',
    at: 2,
    row: 11,
    text: '[SHOOT:attack] THE ENEMY. YOUR BULLETS NEVER RUN OUT.',
    retry: 'SHOOT THE ENEMY TO OPEN THE WAY. HERE IT COMES AGAIN!',
    done: (w) => hitsSince(w, (h) => !!h.shot && !(h.target instanceof TrainingTarget)).length > 0,
  },
  {
    id: 'aim',
    at: 17,
    row: 11,
    text: 'HOLD UP TO AIM UP, UP AND AHEAD FOR A DIAGONAL. HIT BOTH TARGETS.',
    retry: 'STAND UNDER THE HIGH TARGET AND AIM UP. AIM UP AND AHEAD AT THE ONE ON THE LEDGE.',
    done: (w) => targetsHit(w, 'aim', (h) => !!h.shot) >= 2,
  },
  {
    id: 'prone',
    at: 35,
    row: 11,
    text: 'HOLD DOWN TO LIE PRONE BY THE TURRET. ITS SHOTS FLY OVER YOU.',
    retry: 'LIE PRONE IN FRONT OF THE TURRET UNTIL TWO SHOTS HAVE FLOWN OVER YOU.',
    done: (w) => shotsOver(w) >= 2,
    meter: (w) => Math.min(1, shotsOver(w) / 2),
  },
  {
    id: 'shoot-down',
    at: 46,
    row: 11,
    text: '[JUMP:jump], THEN HOLD DOWN AND [SHOOT:attack] THE ENEMY IN THE DITCH.',
    retry: 'JUMP OVER THE DITCH, HOLD DOWN AND SHOOT THE ENEMY BELOW YOU.',
    done: (w) => hitsSince(w, (h) => h.down && !(h.target instanceof TrainingTarget)).length > 0,
  },
  {
    id: 'medal',
    at: 56,
    row: 11,
    item: 'medal',
    block: S.medalBlock,
    get: 'JUMP INTO THE ? BLOCK, THEN TAKE WHAT COMES OUT.',
    text: 'ONE MORE HIT: YOU CAN TAKE 4.',
    done: (w) => (w.player.scratch.maxHp ?? START_HITS) > START_HITS,
  },
  {
    id: 'machine-gun',
    at: 60,
    row: 11,
    item: 'machine-gun',
    block: S.gunBlock,
    get: 'ANOTHER ? BLOCK!',
    text: 'HOLD [SHOOT:attack] TO KEEP FIRING!',
    retry: 'HOLD SHOOT DOWN AND KEEP IT HELD: THE MACHINE GUN FIRES ON ITS OWN.',
    done: (w) => heldShots(w) >= HOLD_SHOTS,
    meter: (w) => Math.min(1, heldShots(w) / HOLD_SHOTS),
  },
  {
    id: 'guns',
    at: 76,
    row: 11,
    note: true,
    text: 'EACH NEW GUN IS READY AT ONCE. [WEAPON:select] SWITCHES BETWEEN THEM.',
    done: (w) => landedPast(w, S.laserBlock.x - 3),
  },
  {
    id: 'laser',
    at: 79,
    row: 11,
    item: 'laser',
    block: S.laserBlock,
    get: 'A ? BLOCK!',
    text: 'ONE BEAM THAT PIERCES. HIT BOTH TARGETS IN A ROW.',
    retry: 'FIRE THE LASER AT THE TWO TARGETS: ONE BEAM GOES THROUGH BOTH.',
    done: (w) => volleyHit(w, 'laser', 2),
  },
  {
    id: 'flame-gun',
    at: 94,
    row: 11,
    item: 'flame-gun',
    block: S.flameBlock,
    get: 'ANOTHER ? BLOCK!',
    text: 'A SLOW, HEAVY FIREBALL. KNOCK DOWN THE TOUGH TARGET.',
    retry: 'THE FLAME GUN HITS HARDEST: KEEP FIRING AT THE TOUGH TARGET UNTIL IT FALLS.',
    done: (w) =>
      targetsHit(w, 'flame-gun', (h) => h.reaction === 'kill') > 0 &&
      hitsSince(w, (h) => h.shotKind === 'flame-gun').length > 0,
  },
  {
    id: 'spread-gun',
    at: 106,
    row: 11,
    item: 'spread-gun',
    block: S.spreadBlock,
    get: 'THE LAST ? BLOCK!',
    text: 'FIVE SHOTS IN A FAN. HIT ALL THREE TARGETS AT ONCE.',
    retry: 'BACK UP FROM THE TARGETS: FROM FURTHER AWAY ONE FAN OF SHOTS HITS ALL THREE.',
    done: (w) => {
      markVolleys(w);
      return volleyHit(w, 'spread', 3);
    },
  },
  {
    id: 'flag',
    at: 122,
    row: 11,
    note: true,
    text: 'ALL DONE! GRAB THE FLAGPOLE.',
    done: (w) => w.flagGrabbedBy !== null,
  },
];

/** A gate stands from under the HUD to the ground: no jump of his clears it. */
const gate = (col: number, after: string): TutorialGate => ({ col, top: 2, bottom: 11, after });

export const BILL_GATES: readonly TutorialGate[] = [
  gate(S.shootGate, 'rifle'),
  gate(S.aimGate, 'aim'),
  gate(S.proneGate, 'prone'),
  gate(S.downGate, 'shoot-down'),
  gate(S.gunGate, 'machine-gun'),
  gate(S.laserGate, 'laser'),
  gate(S.flameGate, 'flame-gun'),
  gate(S.spreadGate, 'spread-gun'),
];

export const BILL_STAGE_DEF: HeroStage = {
  hero: 'bill',
  source,
  greeting: [
    "BILL! THE KINGDOM'S ? BLOCKS HOLD YOUR FALCON GUNS. LET'S FIND THEM ALL.",
    'FOLLOW THE TIPS UP TOP!',
  ],
  tutorial: {
    level: 'training-bill',
    hero: 'bill',
    lessons: BILL_LESSONS,
    gates: BILL_GATES,
    // Clear of his health bar at the left edge (hud.ts, x 7-15).
    boxLeft: 26,
  },
};
