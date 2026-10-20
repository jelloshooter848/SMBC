/**
 * Classic mode's own options (title > CLASSIC > Options: Game Mode, More Settings, Customize
 * Weapons; docs/classic/FOLLOW_UPS_PROPOSAL.md FU-7a, FU-7b, FU-7c). Every value defaults to the
 * original's (SMBC 3.1.21 GameSettings.resetDifficultySettings), so a player who never opens the
 * menus plays today's Classic mode exactly. Kept in `Settings.classic`, never in a campaign file;
 * a run reads them only as `GameContext.classic`, which Game fills for a Classic mode run with
 * Classic rules (the gameplay rows) — the Game Mode row is read by Game's select flow.
 *
 * Each row is an ordered list of values; the menus step through them and `normaliseClassic`
 * puts any stored value not in its list back to the default.
 */

/** Lives at a new game and after a continue (InitialLivesCount). */
export const CLASSIC_LIVES = [1, 3, 5, 7, 10] as const;
export type ClassicLives = (typeof CLASSIC_LIVES)[number];

/** When Hit (ClassicDamageResponse): Lose Everything, Previous State, Instant Death. */
export const CLASSIC_WHEN_HIT = ['lose-everything', 'previous-state', 'instant-death'] as const;
export type ClassicWhenHit = (typeof CLASSIC_WHEN_HIT)[number];

/** Attack Strength (AttackStrength): every hero's damage, and brick damage, times this. */
export const CLASSIC_ATTACK = ['very-weak', 'weak', 'normal', 'strong', 'very-strong'] as const;
export type ClassicAttack = (typeof CLASSIC_ATTACK)[number];
export const CLASSIC_ATTACK_MULTS: Readonly<Record<ClassicAttack, number>> = {
  'very-weak': 0.66,
  weak: 0.75,
  normal: 1,
  strong: 1.75,
  'very-strong': 3,
};

/** Item Drop Rate (ItemDropRate): added to the hero's 25 % before the brick and coin factors. */
export const CLASSIC_DROPS = ['very-low', 'low', 'normal', 'high', 'very-high'] as const;
export type ClassicDropRate = (typeof CLASSIC_DROPS)[number];
export const CLASSIC_DROP_OFFSETS: Readonly<Record<ClassicDropRate, number>> = {
  'very-low': -0.05,
  low: -0.025,
  normal: 0,
  high: 0.075,
  'very-high': 0.15,
};

/** Enemy Speed (EnemySpeed): walking enemies at 90 instead of 65 (ENEMY_WALK_SPEED_FAST). */
export const CLASSIC_ENEMY_SPEEDS = ['normal', 'fast'] as const;
export type ClassicEnemySpeed = (typeof CLASSIC_ENEMY_SPEEDS)[number];

/** Piranhas (PiranhaSpawnType): which pipes have plants, and their colour. */
export const CLASSIC_PIRANHAS = ['some', 'all', 'green-some', 'green-all', 'red-some', 'red-all'] as const;
export type ClassicPiranhas = (typeof CLASSIC_PIRANHAS)[number];

/**
 * Replace Goombas (GoombaReplacementType): Off, Buzzy Beetle, Spiny and Spike Top (the new enemy
 * of entities/enemies/spike-top.ts, whose spawn type rules/classic-goombas.ts registers).
 */
export const CLASSIC_GOOMBAS = ['off', 'buzzy', 'spiny', 'spike-top'] as const;
export type ClassicGoombas = (typeof CLASSIC_GOOMBAS)[number];

/**
 * Game Mode (CampaignModes): All Characters (a pick before every level and life, the default),
 * Single Character (one pick for the whole run), Single Random (a random hero each level and
 * life, no select screen), Survival (each hero one life, revived with lives: game/survival.ts), in
 * the original's menu order (CampaignModeMenu.as 21-24: All, Survival, Single, Single random).
 * Game.classicHeroChoice is the one place the select flow is decided.
 */
export const CLASSIC_GAME_MODES = ['all', 'survival', 'single', 'single-random'] as const;
export type ClassicGameMode = (typeof CLASSIC_GAME_MODES)[number];

/**
 * Music set (MusicSets.as, SoundOptions.as; G-066): Character plays each hero's own set (the
 * original's default), Map the map's (always SMB's: we have no map skins), Random either one
 * at random for each area. Read for any Classic mode run, whatever its rules.
 */
export const CLASSIC_MUSIC_SETS = ['character', 'map', 'random'] as const;
export type ClassicMusicSet = (typeof CLASSIC_MUSIC_SETS)[number];

/* ---------- Customize Weapons (CustomizeWeaponsMenu) ---------- */

/** Mega Man's and Bass's Fire Flower weapon (MegaManSpecialWeapon). */
export const CLASSIC_MM_WEAPONS = [
  'super-arm',
  'metal-blade',
  'hard-knuckle',
  'pharaoh-shot',
  'charge-kick',
  'flame-blast',
  'magma-bazooka',
  'water-shield',
  'screw-crusher',
] as const;
export type ClassicMMWeapon = (typeof CLASSIC_MM_WEAPONS)[number];
/** Bill's guns (BillWeapon): the first gun cannot be the Spread (CustomizeWeaponsMenu). */
export const CLASSIC_BILL_GUNS = ['flare', 'laser', 'mg', 'spread'] as const;
export type ClassicBillGun = (typeof CLASSIC_BILL_GUNS)[number];
export const CLASSIC_LINK_WEAPONS = ['bomb', 'bow'] as const;
export type ClassicLinkWeapon = (typeof CLASSIC_LINK_WEAPONS)[number];
/** Ryu's arts (RyuSpecialWeapon); the start and extra arts are never the same. */
export const CLASSIC_RYU_ARTS = ['shuriken', 'windmill', 'jump-slash', 'fire-wheel', 'dragon-ball'] as const;
export type ClassicRyuArt = (typeof CLASSIC_RYU_ARTS)[number];
export const CLASSIC_SAMUS_BEAMS = ['ice', 'wave'] as const;
export type ClassicSamusBeam = (typeof CLASSIC_SAMUS_BEAMS)[number];
/** Simon's sub-weapons (SimonSpecialWeapon); the start and extra ones are never the same. */
export const CLASSIC_SIMON_WEAPONS = ['dagger', 'hand-axe', 'holy-water', 'cross', 'stopwatch'] as const;
export type ClassicSimonWeapon = (typeof CLASSIC_SIMON_WEAPONS)[number];
export const CLASSIC_SOPHIA_WEAPONS = ['triple', 'homing'] as const;
export type ClassicSophiaWeapon = (typeof CLASSIC_SOPHIA_WEAPONS)[number];

export interface ClassicWeapons {
  bass: ClassicMMWeapon;
  billFirst: ClassicBillGun;
  billSecond: ClassicBillGun;
  link: ClassicLinkWeapon;
  megaman: ClassicMMWeapon;
  ryuStart: ClassicRyuArt;
  ryuExtra: ClassicRyuArt;
  samus: ClassicSamusBeam;
  simonStart: ClassicSimonWeapon;
  simonExtra: ClassicSimonWeapon;
  sophia: ClassicSophiaWeapon;
}

export interface ClassicSettings {
  lives: ClassicLives;
  whenHit: ClassicWhenHit;
  attack: ClassicAttack;
  drops: ClassicDropRate;
  enemySpeed: ClassicEnemySpeed;
  piranhas: ClassicPiranhas;
  goombas: ClassicGoombas;
  gameMode: ClassicGameMode;
  musicSet: ClassicMusicSet;
  weapons: ClassicWeapons;
}

/** The original's weapons (GameSettings.as 222-232). */
export function defaultClassicWeapons(): ClassicWeapons {
  return {
    bass: 'water-shield',
    billFirst: 'mg',
    billSecond: 'spread',
    link: 'bomb',
    megaman: 'metal-blade',
    ryuStart: 'shuriken',
    ryuExtra: 'windmill',
    samus: 'wave',
    simonStart: 'hand-axe',
    simonExtra: 'cross',
    sophia: 'triple',
  };
}

/** The original's defaults (GameSettings.resetDifficultySettings). */
export function defaultClassicSettings(): ClassicSettings {
  return {
    lives: 3,
    whenHit: 'lose-everything',
    attack: 'normal',
    drops: 'normal',
    enemySpeed: 'normal',
    piranhas: 'some',
    goombas: 'off',
    gameMode: 'all',
    musicSet: 'character',
    weapons: defaultClassicWeapons(),
  };
}

/** The value lists of the More Settings and Game Mode rows, by key. */
export const CLASSIC_ROW_VALUES = {
  lives: CLASSIC_LIVES,
  whenHit: CLASSIC_WHEN_HIT,
  attack: CLASSIC_ATTACK,
  drops: CLASSIC_DROPS,
  enemySpeed: CLASSIC_ENEMY_SPEEDS,
  piranhas: CLASSIC_PIRANHAS,
  goombas: CLASSIC_GOOMBAS,
  gameMode: CLASSIC_GAME_MODES,
  musicSet: CLASSIC_MUSIC_SETS,
} as const satisfies { [K in Exclude<keyof ClassicSettings, 'weapons'>]: readonly ClassicSettings[K][] };

/** The value lists of the Customize Weapons rows, by key. */
export const CLASSIC_WEAPON_VALUES = {
  bass: CLASSIC_MM_WEAPONS,
  billFirst: CLASSIC_BILL_GUNS.filter((g) => g !== 'spread'),
  billSecond: CLASSIC_BILL_GUNS,
  link: CLASSIC_LINK_WEAPONS,
  megaman: CLASSIC_MM_WEAPONS,
  ryuStart: CLASSIC_RYU_ARTS,
  ryuExtra: CLASSIC_RYU_ARTS,
  samus: CLASSIC_SAMUS_BEAMS,
  simonStart: CLASSIC_SIMON_WEAPONS,
  simonExtra: CLASSIC_SIMON_WEAPONS,
  sophia: CLASSIC_SOPHIA_WEAPONS,
} as const satisfies { [K in keyof ClassicWeapons]: readonly ClassicWeapons[K][] };

/** Pairs that may not hold the same weapon (CustomizeWeaponsMenu skips the other's value). */
export const CLASSIC_WEAPON_PAIRS: readonly (readonly [keyof ClassicWeapons, keyof ClassicWeapons])[] = [
  ['billFirst', 'billSecond'],
  ['ryuStart', 'ryuExtra'],
  ['simonStart', 'simonExtra'],
];

function pick<T>(list: readonly T[], v: unknown, d: T): T {
  return list.includes(v as T) ? (v as T) : d;
}

/**
 * A stored `Settings.classic` (deep-merged over the defaults, so any field may be stale) with
 * every value checked against its list: an unknown value (an older or newer build's) goes back to
 * the original's, and a weapon pair holding the same weapon gets both defaults back.
 */
export function normaliseClassic(raw: unknown): ClassicSettings {
  const d = defaultClassicSettings();
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out: ClassicSettings = { ...d, weapons: { ...d.weapons } };
  for (const k of Object.keys(CLASSIC_ROW_VALUES) as (keyof typeof CLASSIC_ROW_VALUES)[]) {
    const list = CLASSIC_ROW_VALUES[k] as readonly unknown[];
    (out as unknown as Record<string, unknown>)[k] = pick(list, r[k], d[k]);
  }
  const w = r.weapons && typeof r.weapons === 'object' ? (r.weapons as Record<string, unknown>) : {};
  for (const k of Object.keys(CLASSIC_WEAPON_VALUES) as (keyof ClassicWeapons)[]) {
    const list = CLASSIC_WEAPON_VALUES[k] as readonly unknown[];
    (out.weapons as unknown as Record<string, unknown>)[k] = pick(list, w[k], d.weapons[k]);
  }
  for (const [a, b] of CLASSIC_WEAPON_PAIRS) {
    if (out.weapons[a] === out.weapons[b]) {
      (out.weapons as unknown as Record<string, unknown>)[a] = d.weapons[a];
      (out.weapons as unknown as Record<string, unknown>)[b] = d.weapons[b];
    }
  }
  return out;
}

/** Whether `s` holds the original's value in every row (the menus' "Restore originals" state). */
export function isOriginalClassic(s: ClassicSettings): boolean {
  return JSON.stringify(s) === JSON.stringify(defaultClassicSettings());
}
