import type { LevelData } from '../level/schema';

/**
 * Classic mode's music sets (0.5.0; GAP_LIST_0.5.0 G-060 to G-066, owner decision D2). The
 * original plays every music type from the playing hero's own game (SoundManager.changeMusic with
 * Music Set = Character, its default). Ours: one set of our own songs per hero (the campaign's hero
 * tunes where they exist, and new pieces in content/music/hero-sets.ts); any type a hero has no
 * song for comes from the SMB set, so songs can land a few at a time.
 *
 * Game installs `musicFor` as the audio's music map (AudioSink.setMusicMap) and it only ever
 * changes a song in a Classic mode run outside a campaign file; the campaign plays as before.
 */

/** Every music type a set may have (the original's MusicType and level types). */
export const MUSIC_TYPES = [
  'overworld',
  'platform',
  'cheep',
  'underground',
  'bonus',
  'water',
  'castle',
  'coin-heaven',
  'intro',
  'boss',
  'final-boss',
  'star',
  'hurry',
  'death',
  'win',
  'castle-win',
  'choose',
  'game-over',
  'credits',
  'select',
] as const;
export type MusicType = (typeof MUSIC_TYPES)[number];

/** A hero's set: the types it has a song for (null: silence, Proto Man's whistle instead). */
export type MusicSet = Partial<Record<MusicType, string | null>>;

/**
 * The SMB set (GameSuperMarioBros.createPlayList), the fallback for every hero: the platform and
 * Cheep Cheep levels play the overworld, pipe bonus rooms the underground, coin heaven the Star
 * tune (G-063), the x-2 walk-in the transition tune (G-063), and the boss the castle's (G-064).
 */
export const SMB_SET: Readonly<Record<MusicType, string>> = {
  overworld: 'overworld',
  platform: 'overworld',
  cheep: 'overworld',
  underground: 'underground',
  bonus: 'underground',
  water: 'water',
  castle: 'castle',
  'coin-heaven': 'star',
  intro: 'smb-transition',
  boss: 'castle',
  'final-boss': 'castle',
  star: 'star',
  hurry: 'hurry',
  death: 'death',
  win: 'level-clear',
  'castle-win': 'castle-clear',
  choose: 'smb-transition',
  'game-over': 'game-over',
  credits: 'credits',
  select: 'smb-select',
};

/**
 * Each hero's own set, in its NES game's mood. Reused campaign tunes: Link's Hyrule (World 2),
 * Mega Man's world (World 3, the station), Zebes (World 4), Transylvania (World 5), Ryu's city
 * (World 6), Bill's jungle (World 7), the Underworld (World 8) and the mini games.
 */
export const HERO_SETS: Readonly<Record<string, MusicSet>> = {
  link: {
    overworld: 'zelda2-field',
    platform: 'zelda2-field',
    cheep: 'zelda2-water',
    underground: 'zelda2-cave',
    bonus: 'dungeon',
    water: 'zelda2-water',
    castle: 'zelda2-palace',
    'coin-heaven': 'village',
    intro: 'village-indoors',
    boss: 'keeper',
    'final-boss': 'keeper',
    win: 'link-win',
    'castle-win': 'triforce-get',
    choose: 'link-choose',
  },
  megaman: {
    overworld: 'mm-stage-31',
    platform: 'mm-air',
    cheep: 'mm-wood',
    underground: 'mm-station',
    bonus: 'mm-station',
    water: 'mm-wood',
    castle: 'mm-wily',
    'coin-heaven': 'mm-air',
    intro: 'mm-choose',
    boss: 'mm-boss',
    'final-boss': 'mm-boss',
    win: 'mm-win',
    choose: 'mm-choose',
  },
  samus: {
    overworld: 'brinstar',
    platform: 'crateria',
    cheep: 'crateria',
    underground: 'cavern',
    bonus: 'cavern',
    castle: 'tourian',
    'coin-heaven': 'crateria',
    intro: 'zebes-start',
    boss: 'norfair',
    'final-boss': 'zebes-escape',
    win: 'samus-win',
    death: 'samus-classic-death',
    choose: 'zebes-start',
  },
  simon: {
    overworld: 'cv-stage',
    platform: 'cv-town',
    cheep: 'cv-lake',
    underground: 'crypt',
    bonus: 'crypt',
    water: 'cv-lake',
    castle: 'cv-hall',
    'coin-heaven': 'cv-town',
    intro: 'cv-choose',
    boss: 'cv-boss',
    'final-boss': 'cv-beast',
    win: 'cv-win',
    death: 'cv-die',
    choose: 'cv-choose',
  },
  ryu: {
    overworld: 'ng-stage',
    platform: 'ng-pass',
    cheep: 'ng-harbor',
    underground: 'ng-sewer',
    bonus: 'ng-sewer',
    water: 'ng-harbor',
    castle: 'ng-city',
    'coin-heaven': 'dojo',
    intro: 'ng-cutscene',
    boss: 'ng-boss',
    'final-boss': 'ng-boss',
    win: 'ng-win',
    death: 'ng-die',
    choose: 'ng-choose',
  },
  bill: {
    overworld: 'contra-stage',
    platform: 'contra-snow',
    cheep: 'contra-river',
    underground: 'contra-lair',
    bonus: 'contra-jungle',
    water: 'contra-river',
    castle: 'contra-lair',
    'coin-heaven': 'contra-jungle',
    intro: 'contra-card',
    boss: 'contra-boss',
    'final-boss': 'contra-boss',
    win: 'contra-win',
    choose: 'contra-card',
  },
  sophia: {
    overworld: 'bm-area',
    platform: 'bm-ice',
    cheep: 'bm-ice',
    underground: 'bm-dungeon',
    bonus: 'bm-garage',
    water: 'bm-cutscene',
    castle: 'bm-techno',
    'coin-heaven': 'bm-garage',
    intro: 'bm-cutscene',
    boss: 'bm-boss',
    'final-boss': 'bm-boss',
    win: 'bm-win',
    choose: 'bm-choose',
  },
};

/**
 * Which set a hero plays (by def id): Bass and Proto Man share Mega Man's (the original's
 * Mega Man game), Proto Man whistling instead of the choose jingle (SoundManager 1004-1009).
 * Mario, Luigi, Peach and every hero with no set of ours yet play the SMB set.
 */
const HERO_SET_OF: Readonly<Record<string, string>> = {
  link: 'link',
  megaman: 'megaman',
  bass: 'megaman',
  protoman: 'megaman',
  samus: 'samus',
  simon: 'simon',
  ryu: 'ryu',
  bill: 'bill',
  sophia: 'sophia',
};

/**
 * A sound with the choose jingle, by hero id: Mega Man and Bass teleport out (MegaMan.as 157),
 * Bill is electrocuted (Bill.as chooseCharacter 1087).
 */
export const CHOOSE_SFX: Readonly<Record<string, string>> = {
  megaman: 'mm-teleport',
  bass: 'mm-teleport',
  bill: 'bill-shock',
};

/** The set hero `heroId` plays, or null for the SMB set. */
export function heroSet(heroId: string): MusicSet | null {
  const key = HERO_SET_OF[heroId];
  const set = key ? HERO_SETS[key] : undefined;
  if (!set) return null;
  return heroId === 'protoman' ? { ...set, choose: null } : set;
}

/**
 * The original's area types for our maps that the map's own music does not tell apart
 * (levelData*.xml TYPE): the platform and Cheep Cheep areas, which play the overworld in the SMB
 * set. Every other area is told by its id and music (`areaType`).
 */
const PLATFORM_AREAS = new Set([
  '1-3',
  '3-3',
  '4-2-warp',
  '4-3',
  '5-3',
  '6-3',
  'll-1-2-warp',
  'll-1-3',
  'll-3-3',
  'll-4-3',
  'll-5-2-warp',
  'll-5-3',
  'll-7-3',
  'll-8-2-warp',
  'll-8-3',
  'll-10-3',
  'll-11-3',
  'll-12-3',
]);
const CHEEP_AREAS = new Set(['2-3', '7-3', 'll-2-3', 'll-6-3', 'll-12-2']);

/** The level song ids of the SMB maps, which `areaType` reads. */
const LEVEL_SONGS = new Set(['overworld', 'underground', 'water', 'castle']);

/**
 * An area's music type (Level.type): the walk-in (`-intro`), coin heaven (`-sky`), pipe bonus
 * rooms (`-bonus`, 1-0's pipe), then the map's music, with the platform and Cheep Cheep areas
 * named above. Null for an area with a song of its own (not one of the SMB maps' four).
 */
export function areaType(level: Pick<LevelData, 'id' | 'music'>): MusicType | null {
  if (!LEVEL_SONGS.has(level.music)) return null;
  const id = level.id;
  if (/-intro$/.test(id)) return 'intro';
  if (/-sky\d*$/.test(id)) return 'coin-heaven';
  switch (level.music) {
    case 'castle':
      return 'castle';
    case 'water':
      return 'water';
    case 'underground':
      return /-bonus\d*$|-pipe$/.test(id) ? 'bonus' : 'underground';
  }
  if (PLATFORM_AREAS.has(id)) return 'platform';
  if (CHEEP_AREAS.has(id)) return 'cheep';
  return 'overworld';
}

/** Bowser's last stand plays the final-boss tune: SMB's World 8 and the Lost Levels' D (13). */
export function finalBossWorld(level: Pick<LevelData, 'id' | 'world'>): boolean {
  return level.id.startsWith('ll-') ? level.world === 13 : level.world === 8;
}

/** The game's own song ids that name a music type (played by shared code: the World, scenes). */
const EVENT_SONGS: Readonly<Record<string, MusicType>> = {
  star: 'star',
  hurry: 'hurry',
  death: 'death',
  'level-clear': 'win',
  'castle-clear': 'castle-win',
  'game-over': 'game-over',
  credits: 'credits',
};

/** Options > Music set (G-066; data/MusicSets.as): Character (the original's default), Map, Random. */
export type MusicSetChoice = 'character' | 'map' | 'random';

/** What `musicFor` needs to know about the moment. */
export interface MusicMoment {
  /** The playing hero's def id (null: none yet). */
  hero: string | null;
  /** The area being played, or null outside a level. */
  level: Pick<LevelData, 'id' | 'music' | 'world'> | null;
  /** Bowser has been on screen in this area (G-064): the castle tune becomes the boss's. */
  boss: boolean;
  /** Options > Music set; Random already rolled to `map` or `character` for this area. */
  set: Exclude<MusicSetChoice, 'random'>;
}

/** The song a set plays for `type` (null: silence), falling back to the SMB set. */
export function setSong(set: MusicSet | null, type: MusicType): string | null {
  const own = set?.[type];
  return own === undefined ? SMB_SET[type] : own;
}

/**
 * The song to play instead of `id` at this moment (null: none). Types from the map (the select
 * screen) always come from the SMB set, as the original's map skin; the choose jingle and the death
 * music always from the hero's (SoundManager.changeMusic); the rest from the Music set's choice.
 * Song ids that are not a music type pass through unchanged.
 */
export function musicFor(id: string, m: MusicMoment): string | null {
  let type: MusicType | undefined = EVENT_SONGS[id];
  if (!type && m.level && LEVEL_SONGS.has(id) && id === m.level.music) type = areaType(m.level) ?? undefined;
  if (!type && LEVEL_SONGS.has(id)) type = id as MusicType;
  if (!type) return id;
  if (type === 'castle' && m.boss && m.level) type = finalBossWorld(m.level) ? 'final-boss' : 'boss';
  const own = m.hero ? heroSet(m.hero) : null;
  const set = type === 'death' || type === 'choose' || m.set === 'character' ? own : null;
  return setSong(set, type);
}
