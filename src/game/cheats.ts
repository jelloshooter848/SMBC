import {
  CLASSIC_CHEAT_IDS,
  type ClassicCheatId,
  type ClassicCheatStat,
  type ClassicCheatsSettings,
} from '@engine/save/settings';
import type { PickupKind } from './entities/objects/pickup';

/*
 * Classic mode's cheats (FU-7e): the original's Cheats menu (CheatMenu.as, Cheats.as) with its
 * unlock goals (StatManager.as, MessageBoxMessages.as LOCKED_CHEAT_*). What each cheat does lives
 * in the one hook it reads (World.cheats); this file holds their names, their goals and the
 * bookkeeping on settings.classicCheats. Classic only: the campaign never sees them.
 */

/**
 * The pickups the Infinite Ammo goal counts (Character.hitPickup: PickupInfo.AMMO_DCT): Link's
 * bombs, Mega Man's weapon energy, Ryu's ninpo, Samus's missiles, Sophia III's two missile types
 * and Simon's hearts. Health, energy, E-tanks and the extra heroes' pickups are not ammo.
 */
export const AMMO_PICKUPS: ReadonlySet<PickupKind> = new Set<PickupKind>([
  'bomb',
  'weapon-small',
  'weapon-large',
  'ninpo-small',
  'ninpo-large',
  'missile-pack',
  'triple-ammo',
  'homing-ammo',
  'heart-small',
  'heart-large',
]);

export function isAmmoPickup(kind: PickupKind): boolean {
  return AMMO_PICKUPS.has(kind);
}

/** StatManager.as NUM_*_TO_*: the counts the goals ask for. */
export const CHEAT_GOALS = {
  enemiesDefeated: 1000,
  enemiesStomped: 200,
  armouredDefeated: 200,
  bricksBroken: 1000,
  ammoPickups: 200,
  cheepsDefeated: 300,
  hammerBrosDefeated: 50,
} as const satisfies Record<ClassicCheatStat, number>;

/** How a cheat unlocks (Cheats.unlockCheat's callers). */
export type CheatGoal =
  /** Unlocked from the start (Everyone Can Stomp, Classic Screen Scroll). */
  | { kind: 'open' }
  /** A count reached; `beaten`: and a game beaten (StatManager.beatGame). */
  | { kind: 'count'; stat: ClassicCheatStat; beaten: boolean }
  /** Beat Super Mario Bros. (the original: its SMB map set). */
  | { kind: 'beat-smb' }
  /** Beat The Lost Levels (the original's Special map set, which Classic mode does not have). */
  | { kind: 'beat-lost' }
  /** Beat a game without a continue (StatManager.numContinuesUsed 0). */
  | { kind: 'no-continue' }
  /** Clear any level (Level.completeLevel). */
  | { kind: 'level' }
  /** Clear a castle (Level.completeLevel with _levNum 4). */
  | { kind: 'castle' };

export interface CheatInfo {
  id: ClassicCheatId;
  /** The original's menu name (MenuBoxItems). */
  name: string;
  /** What it does, read out with the row. */
  what: string;
  goal: CheatGoal;
  /** The original's locked-cheat message (without the count). */
  goalText: string;
}

const count = (stat: ClassicCheatStat, beaten = true): CheatGoal => ({ kind: 'count', stat, beaten });

/** The cheats in the original menu's order (alphabetical, CheatMenu.loadItems). */
export const CHEATS: readonly CheatInfo[] = [
  {
    id: 'allGroundIsBricks',
    name: 'All Ground Is Bricks',
    what: 'Ground and blocks before the goal are bricks, from the next area',
    goal: { kind: 'beat-smb' },
    goalText: 'Beat Super Mario Bros.',
  },
  {
    id: 'allHammerBros',
    name: 'All Hammer Bros',
    what: 'Every enemy but Bowser is a Hammer Bro',
    goal: { kind: 'beat-lost' },
    // The original asks for its Special map set, which Classic mode does not have (FU-7e).
    goalText: "Beat The Lost Levels (in place of the original's Special maps).",
  },
  {
    id: 'allWeaponsPierce',
    name: 'All Weapons Pierce',
    what: 'Every attack gets through armour',
    goal: count('armouredDefeated'),
    goalText: `Beat the game once and defeat ${CHEAT_GOALS.armouredDefeated} armored enemies.`,
  },
  {
    id: 'alwaysBreakBricks',
    name: 'Always Break Bricks',
    what: 'Any bump breaks a plain brick',
    goal: count('bricksBroken'),
    goalText: `Beat the game once and break ${CHEAT_GOALS.bricksBroken} bricks.`,
  },
  {
    id: 'bouncyPits',
    name: 'Bouncy Pits',
    what: 'Pits bounce heroes and enemies back up',
    goal: count('enemiesStomped'),
    goalText: `Beat the game once and stomp ${CHEAT_GOALS.enemiesStomped} enemies.`,
  },
  {
    // G-040: Samus.classicMode (Samus.as 991, 1037-1046, 1099).
    id: 'classicSamus',
    name: 'Classic Samus',
    what: 'Special or Tools switches Samus between beam and missiles (her suit changes colour), and Down rolls her straight into the morph ball',
    goal: { kind: 'open' },
    goalText: '',
  },
  {
    id: 'classicScreenScroll',
    name: 'Classic Scroll',
    what: 'Classic Screen Scroll: the screen never scrolls back left, from the next area',
    goal: { kind: 'open' },
    goalText: '',
  },
  {
    // G-040: Simon.classicMode (Simon.as 531, 613, 671, 795).
    id: 'classicSimon',
    name: 'Classic Simon',
    what: "Simon's jump keeps the direction he took off in, and walking off a ledge he drops straight down",
    goal: { kind: 'open' },
    goalText: '',
  },
  {
    id: 'everyoneCanStomp',
    name: 'Everyone Can Stomp',
    what: 'Every hero can stomp enemies',
    goal: { kind: 'open' },
    goalText: '',
  },
  {
    id: 'evilHammerBros',
    name: 'Evil Hammer Bros',
    what: 'Hammer Bros chase you',
    goal: count('hammerBrosDefeated', false),
    goalText: `Defeat ${CHEAT_GOALS.hammerBrosDefeated} Hammer Bros.`,
  },
  {
    id: 'extraCheckpoints',
    name: 'Extra Checkpoints',
    what: 'Castles and World 8 get their checkpoints, from the next area',
    goal: { kind: 'castle' },
    goalText: "Beat Bowser's castle.",
  },
  {
    id: 'infiniteAmmo',
    name: 'Infinite Ammo',
    what: 'Weapons never run out',
    goal: count('ammoPickups'),
    goalText: `Beat the game once and collect ${CHEAT_GOALS.ammoPickups} ammo pickups.`,
  },
  {
    id: 'infiniteLives',
    name: 'Infinite Lives',
    what: 'A lost life is never counted',
    goal: { kind: 'no-continue' },
    goalText: 'Beat the game without using a continue.',
  },
  {
    id: 'infiniteTime',
    name: 'Infinite Time',
    what: 'The clock never runs out',
    goal: { kind: 'level' },
    goalText: 'Beat any level.',
  },
  {
    id: 'invincible',
    name: 'Invincible',
    what: 'Nothing hurts you; pits still do',
    goal: count('enemiesDefeated'),
    goalText: `Beat the game once and defeat ${CHEAT_GOALS.enemiesDefeated} enemies.`,
  },
  {
    id: 'waterMode',
    name: 'Water Mode',
    what: 'Every area is under water',
    goal: count('cheepsDefeated'),
    goalText: `Beat the game once and defeat ${CHEAT_GOALS.cheepsDefeated} cheep cheeps (fish).`,
  },
];

export function cheatInfo(id: ClassicCheatId): CheatInfo {
  return CHEATS.find((c) => c.id === id) as CheatInfo;
}

/** StatManager.beatGame: either game beaten in Classic mode. */
export function beatAGame(c: ClassicCheatsSettings): boolean {
  return c.beaten.smb || c.beaten.lost;
}

/** The locked message with its count (Cheats.getUnlockConditionsMessage: "Current Count: N"). */
export function lockedText(c: ClassicCheatsSettings, id: ClassicCheatId): string {
  const info = cheatInfo(id);
  return info.goal.kind === 'count'
    ? `${info.goalText} Current count: ${c.stats[info.goal.stat]}.`
    : info.goalText;
}

/** What just happened in a Classic run, for the goals that ask for an event rather than a count. */
export interface CheatEvent {
  /** A level was cleared (its flag or its axe). */
  level?: boolean;
  /** That level was a castle (X-4). */
  castle?: boolean;
  /** A game was just beaten without a continue. */
  noContinue?: boolean;
}

/** Whether the goal of `id` is met now (`ev`: the event just played, if any). */
function earned(c: ClassicCheatsSettings, info: CheatInfo, ev: CheatEvent): boolean {
  const g = info.goal;
  switch (g.kind) {
    case 'open':
      return true;
    case 'count':
      return c.stats[g.stat] >= CHEAT_GOALS[g.stat] && (!g.beaten || beatAGame(c));
    case 'beat-smb':
      return c.beaten.smb;
    case 'beat-lost':
      return c.beaten.lost;
    case 'no-continue':
      return ev.noContinue === true;
    case 'level':
      return ev.level === true;
    case 'castle':
      return ev.castle === true;
  }
}

/**
 * Unlocks every locked cheat whose goal is met now (Cheats.unlockCheat; StatManager's setters and
 * beatGameHandler check the same goals). Returns the ones it unlocked, in menu order.
 */
export function unlockEarned(c: ClassicCheatsSettings, ev: CheatEvent = {}): ClassicCheatId[] {
  const out: ClassicCheatId[] = [];
  for (const info of CHEATS) {
    if (c.unlocked[info.id] || !earned(c, info, ev)) continue;
    c.unlocked[info.id] = true;
    out.push(info.id);
  }
  return out;
}

/** The Enter code row's code (CheatMenu.CORRECT_INPUT): unlocks every cheat. */
export function unlockAll(c: ClassicCheatsSettings): void {
  for (const id of CLASSIC_CHEAT_IDS) c.unlocked[id] = true;
  c.levelSelect = true;
}

/**
 * Whether every cheat is unlocked (Cheats.allUnlocked: all 17 locks, the Level Select's too), so
 * the Enter code row goes. A save that entered the code before the Level Select cheat existed has
 * the 14 rule cheats but not it: the row comes back, and the code unlocks it.
 */
export function allUnlocked(c: ClassicCheatsSettings): boolean {
  return CLASSIC_CHEAT_IDS.every((id) => c.unlocked[id]) && c.levelSelect === true;
}

/** One more of `stat` (capped as StatManager.checkDefaultStatMaxMin, at 999999). */
export function addCheatStat(c: ClassicCheatsSettings, stat: ClassicCheatStat, n = 1): void {
  c.stats[stat] = Math.min(999999, c.stats[stat] + n);
}

/** The card for a cheat just unlocked (MessageBoxMessages.UNLOCKED_CHEAT_*). */
export function unlockedLines(id: ClassicCheatId): string[] {
  return ['YOU UNLOCKED', cheatInfo(id).name.toUpperCase(), 'CHEAT!'];
}
