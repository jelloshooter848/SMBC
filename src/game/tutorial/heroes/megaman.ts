import type { World } from '../../world/world';
import type { Projectile } from '../../entities/projectiles/projectile';
import { Koopa } from '../../entities/enemies/koopa';
import { T } from '../../level/tiles';
import type { Lesson } from '../stage-prompts';
import type { TutorialGate } from '../stage-tutorial';
import type { HeroStage } from '../hero-stage';
import { TrainingTarget } from '../targets';
import { blocksSince, hitLessons, hitsSince, landedPast, onTop } from './common';
import source from '../../../content/levels/training/megaman.map?raw';

/*
 * Mega Man's training stage (0.4.37, the owner's design section 5), in the Mega Man night-stage
 * look (src/content/levels/training/megaman.map). He starts bare-headed with the buster and the
 * slide, takes the Helmet from the first ? block (the charge shot and brick breaking), then each
 * weapon and Rush from a block in the order his kit builds up (docs/POWERUPS.md 5.3). A hit that
 * knocks the Helmet off is no dead end: Toad's card puts him back with it on (the kit floor). The
 * box starts right of his health and weapon bars.
 */

/** The set pieces' columns (megaman.map). */
export const MEGAMAN_STAGE = {
  enemy: 14,
  shootGate: 17,
  tunnel: { from: 21, to: 23 },
  helmetBlock: { x: 30, y: 8 },
  bigTarget: 36,
  chargeGate: 39,
  roof: { from: 40, to: 48, top: 8 },
  bricks: { from: 42, to: 45 },
  sawBlock: { x: 52, y: 8 },
  sawBrick: { x: 60, y: 5 },
  /** The target hovering on its cloud (0.4.46, #22): its column, and the row its feet are on. */
  cloud: { x: 57, y: 4 },
  sawGate: 62,
  leafBlock: { x: 65, y: 8 },
  shooter: 70,
  leafGate: 73,
  rushBlock: { x: 77, y: 8 },
  wall: { from: 82, to: 85, top: 5 },
  flameBlock: { x: 88, y: 8 },
  trench: { from: 92, to: 96 },
  flameGate: 99,
  knuckleBlock: { x: 103, y: 8 },
  ledge: { from: 108, to: 111, top: 7 },
  knuckleGate: 113,
  boltBlock: { x: 117, y: 8 },
  boltGate: 131,
  /**
   * The full charge through walls (0.4.46, owner #23): a pipe (columns 136-137), then a row of ?
   * blocks and bricks on the ground (row 11), and the gate after it.
   */
  pipe: 136,
  row: { from: 139, to: 143, y: 11 },
  pierceGate: 146,
  /** WHAT A HIT TAKES (0.4.46): the thorn bush, and the gate until the hit is taken. */
  thorns: 150,
  hitGate: 152,
  flag: 158,
} as const;
const S = MEGAMAN_STAGE;

/** Frames the buster must charge for a full charge shot (megaman/index.ts CHARGE_FRAMES). */
export const CHARGE_FULL = 40;

/** One bolt hit two enemies or more. */
function boltHitMany(w: World): boolean {
  const per = new Map<Projectile, Set<unknown>>();
  for (const h of hitsSince(w, (x) => x.shotKind === 'bolt' && !(x.target instanceof TrainingTarget))) {
    const shot = h.shot as Projectile;
    let set = per.get(shot);
    if (!set) per.set(shot, (set = new Set()));
    set.add(h.target);
  }
  return [...per.values()].some((s) => s.size >= 2);
}

export const MEGAMAN_LESSONS: readonly Lesson[] = [
  {
    id: 'shoot',
    at: 2,
    row: 11,
    text: '[SHOOT:attack] THE ENEMY WITH YOUR BUSTER.',
    retry: 'SHOOT THE ENEMY TO OPEN THE WAY. HERE IT COMES AGAIN!',
    done: (w) => hitsSince(w, (h) => h.kind === 'buster' && h.reaction === 'kill').length > 0,
  },
  {
    id: 'slide',
    at: 18,
    row: 11,
    text: 'HOLD DOWN AND PRESS [JUMP:jump] TO SLIDE UNDER THE LOW WALL.',
    done: (w) => landedPast(w, S.tunnel.to + 1),
  },
  {
    id: 'helmet',
    at: 26,
    row: 11,
    item: 'helmet',
    block: S.helmetBlock,
    get: 'JUMP UP INTO THE ? BLOCK AND TAKE THE HELMET.',
    // The weapons rule (0.4.46, owner #20): ? blocks give a bare-headed Mega Man the Helmet first.
    text: 'CHARGE SHOT, BRICK BREAKING, AND ? BLOCKS GIVE WEAPONS ONLY WITH IT ON.',
    explains: 'megaman:helmet',
    done: (w) => !!w.player.scratch.helmet,
  },
  {
    id: 'charge',
    at: 27,
    row: 11,
    text: 'HOLD [SHOOT:attack] TO CHARGE. LET GO FOR A BIG BLAST AT THE TARGET.',
    retry: 'A FULL CHARGE OPENS THE WAY: HOLD [SHOOT:attack] UNTIL THE BAR FILLS, THEN LET GO.',
    done: (w) => hitsSince(w, (h) => h.shotKind === 'buster-charged').length > 0,
    meter: (w) => Math.min(1, (w.player.scratch.chargeT ?? 0) / CHARGE_FULL),
  },
  {
    id: 'bricks',
    at: 38,
    row: 11,
    text: 'WITH THE HELMET YOU BREAK BRICKS. JUMP UP THROUGH THE ROOF.',
    done: (w) => onTop(w, S.roof.top, S.roof.from, S.roof.to),
  },
  {
    id: 'saw',
    at: 50,
    row: 11,
    item: 'saw-disc',
    block: S.sawBlock,
    get: 'A ? BLOCK! JUMP INTO IT.',
    text: '[USE WEAPON:special:SAW] HOLDING UP AND AHEAD: CUT THE BRICK UP THERE.',
    touchText: 'HOLD UP AND AHEAD AND TAP [SAW:special:SAW]: CUT THE BRICK UP THERE.',
    retry: 'AIM THE SAW UP AND AHEAD AT THE BRICK: HOLD UP AND TOWARD IT AS YOU FIRE.',
    done: (w) => w.map.get(S.sawBrick.x, S.sawBrick.y) === T.AIR,
  },
  {
    // 0.4.46 (owner #22): the Saw straight up at a target hovering on a cloud, as Lakitu does.
    id: 'saw-up',
    at: 54,
    row: 11,
    text: 'HOLD UP, [USE WEAPON:special:SAW] AT THE CLOUD. LAKITU FALLS TO THE SAW TOO!',
    touchText: 'HOLD UP AND TAP [SAW:special:SAW] AT THE CLOUD. LAKITU FALLS TO IT TOO!',
    retry: 'STAND UNDER THE CLOUD AND HOLD UP, NOT AHEAD, AS YOU FIRE THE SAW.',
    done: (w) =>
      hitsSince(
        w,
        (h) => h.shotKind === 'saw' && h.target instanceof TrainingTarget && h.target.lesson === 'saw-up',
      ).length > 0,
  },
  {
    id: 'leaf',
    at: 63,
    row: 11,
    item: 'leaf-guard',
    block: S.leafBlock,
    get: 'ANOTHER ? BLOCK!',
    text: '[WEAPON:select] TO IT. [USE WEAPON:special:LEAF] SWATS SHOTS.',
    touchText: 'TAP [WEAPON:select] TILL IT READS LEAF, THEN [LEAF:special:LEAF]: IT SWATS SHOTS.',
    retry: 'THE LEAF GUARD SWATS SHOTS: PICK IT WITH [WEAPON:select], USE IT AND WALK AT THE SHOOTER.',
    done: (w) => blocksSince(w).swats > 0,
  },
  {
    id: 'rush',
    at: 74,
    row: 11,
    item: 'rush-coil',
    block: S.rushBlock,
    get: 'THE WALL IS TOO HIGH. JUMP INTO THE ? BLOCK!',
    text: 'PICK HIM WITH [WEAPON:select], CALL HIM, LAND ON HIM.',
    touchText: 'TAP [WEAPON:select] TILL IT READS RUSH, TAP [RUSH:special:RUSH], LAND ON HIM.',
    done: (w) => onTop(w, S.wall.top, S.wall.from, S.wall.to) || landedPast(w, S.wall.to + 1),
  },
  {
    id: 'flame',
    at: 87,
    row: 11,
    item: 'flame-wave',
    block: S.flameBlock,
    get: 'JUMP INTO THE ? BLOCK.',
    text: 'IT RUNS ALONG THE FLOOR AND DROPS INTO THE DITCH: BURN THE SHELL.',
    retry: 'THE FLAME WAVE RUNS ALONG THE FLOOR: FIRE IT FROM THE EDGE OF THE DITCH AT THE SHELL.',
    done: (w) => hitsSince(w, (h) => h.shotKind === 'flame' && h.target instanceof Koopa).length > 0,
  },
  {
    id: 'knuckle',
    at: 100,
    row: 11,
    item: 'homing-knuckle',
    block: S.knuckleBlock,
    get: 'JUMP INTO THE ? BLOCK.',
    text: 'IT SEEKS: HIT THE ENEMY ON THE LEDGE ABOVE.',
    retry: 'PICK THE KNUCKLE AND FIRE IT: IT SEEKS THE ENEMY ON THE LEDGE.',
    done: (w) =>
      hitsSince(w, (h) => h.shotKind === 'knuckle' && h.target instanceof TrainingTarget).length > 0,
  },
  {
    id: 'bolt',
    at: 114,
    row: 11,
    item: 'bolt',
    block: S.boltBlock,
    get: 'THE LAST ? BLOCK!',
    text: 'A BEAM ACROSS THE WHOLE SCREEN. CLEAR THE ENEMIES.',
    retry: 'ONE BOLT HITS EVERY ENEMY IN ITS LINE: FIRE IT AT THE GROUP.',
    done: boltHitMany,
  },
  {
    // 0.4.46 (owner #23): the campaign's full charge flies through walls, bumping each block once.
    id: 'pierce',
    at: 132,
    row: 11,
    text: 'A FULL CHARGE GOES THROUGH WALLS AND BUMPS EVERY BLOCK ON ITS WAY. SHOOT THE ROW!',
    retry: 'HOLD [SHOOT:attack] TILL THE BAR FILLS, THEN LET GO AT THE PIPE: IT GOES RIGHT THROUGH.',
    done: (w) =>
      w.feats.pierced >= 3 &&
      [S.row.from, S.row.from + 2, S.row.to].every((x) => w.map.get(x, S.row.y) !== T.Q_COIN),
    meter: (w) => Math.min(1, (w.player.scratch.chargeT ?? 0) / CHARGE_FULL),
    // Its ? blocks bumped another way before the blast (a Saw, a bomb of a jump): laid again.
    spent: "THOSE BLOCKS WERE BUMPED BEFORE THE BLAST. LET'S LAY THEM AGAIN!",
    spentWhen: (w) =>
      w.feats.pierced === 0 &&
      [S.row.from, S.row.from + 2, S.row.to].some((x) => {
        const t = w.map.get(x, S.row.y);
        return t !== T.Q_COIN && t !== T.BUMPING;
      }),
  },
  ...hitLessons('megaman', { at: S.pierceGate + 1, row: 11, thorns: S.thorns }),
  {
    id: 'flag',
    at: S.pierceGate + 1,
    row: 11,
    note: true,
    text: 'ALL DONE! GRAB THE FLAGPOLE.',
    done: (w) => w.flagGrabbedBy !== null,
  },
];

/** A gate is the whole height of the screen over the ground: not even Rush clears it. */
const gate = (col: number, after: string): TutorialGate => ({ col, top: 0, bottom: 11, after });

export const MEGAMAN_GATES: readonly TutorialGate[] = [
  gate(S.shootGate, 'shoot'),
  gate(S.chargeGate, 'charge'),
  gate(S.sawGate, 'saw-up'),
  gate(S.leafGate, 'leaf'),
  gate(S.flameGate, 'flame'),
  gate(S.knuckleGate, 'knuckle'),
  gate(S.boltGate, 'bolt'),
  gate(S.pierceGate, 'pierce'),
  gate(S.hitGate, 'hit'),
];

export const MEGAMAN_STAGE_DEF: HeroStage = {
  hero: 'megaman',
  source,
  greeting: ["MEGA MAN! LET'S POWER YOU UP WITH THE KINGDOM'S ? BLOCKS.", 'FOLLOW THE TIPS UP TOP!'],
  tutorial: {
    level: 'training-megaman',
    hero: 'megaman',
    lessons: MEGAMAN_LESSONS,
    gates: MEGAMAN_GATES,
    // Clear of his health and weapon bars at the left edge (hud.ts, x 7-23).
    boxLeft: 26,
  },
};
