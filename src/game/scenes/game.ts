import { OPEN_DEV_LOCK, type DevLock } from '../dev-lock';
import { CHAPTER1_LINK_CARD, showChapter1Gate } from './chapter1-gate';
import { confirmQuitRun } from './quit-run';
import { SceneStack } from '@engine/scene';
import { GestureGate } from '@engine/input/gesture';
import type { HomeScreenHooks } from '../pwa/home-screen';
import type { LastInput } from '@engine/input/touch-logic';
import {
  loadProgress,
  lostLettersOpen,
  recordLostGameBeaten,
  saveProgress,
  type MapSetId,
} from '@engine/save/progress';
import type { CheatFlags, GameContext, GameState, HeroSwaps, Rules } from '../context';
import { defaultPower, newGameState } from '../context';
import {
  CLASSIC_EXTRAS,
  CLASSIC_SLOTS,
  EXPANSION_HEROES,
  expansionReleased,
  isSkin,
  playedHero,
  skinHost,
  skinsOf,
} from '../characters/registry';
import { startHp, type CharacterDef } from '../characters/character';
import { TitleScene } from './title';
import { INTRO_FRAMES, INTRO_FRAMES_SINGLE, IntroScene } from './intro';
import { resumeOf, type ClassicResume } from '../run-resume';
import {
  classicFileKept,
  copyFileRules,
  eraseClassicFile,
  hasClassicFile,
  listClassicFiles,
  loadClassicFile,
  loadClearedFile,
  migrateClassicFiles,
  originalFileRules,
  saveClassicFile,
  saveClearedFile,
  type ClassicFile,
  type ClearedFile,
  type ClassicFileRef,
  type ClassicFileRules,
  type ClassicFileSlot,
} from '../original-files';
import { LevelScene, type LevelStart } from './level';
import { freshSeed, startTime } from '../world/world';
import { Rng } from '@engine/rng';
import { GameOverScene } from './game-over';
import { CharacterSelectScene } from './character-select';
import type { LevelData } from '../level/schema';
import {
  saveSettings,
  CLASSIC_CHEAT_IDS,
  type ClassicCheatId,
  type ClassicCheatStat,
  type ClassicDevToggles,
  type MapDifficulty,
  type Settings,
} from '@engine/save/settings';
import { addCheatStat, cheatInfo, unlockedLines, unlockEarned, type CheatEvent } from '../cheats';
import type { ClassicSettings } from '@engine/save/original-options';
import type { InputManager } from '@engine/input/input-manager';
import type { Announcer } from '@engine/a11y/announcer';
import type { Viewport } from '@engine/viewport';
import { EditorScene } from './editor';
import { DevMenuScene } from './dev';
import { MenuScene } from './menu';
import { loadLibrary, customLevelId, CUSTOM_PREFIX } from '../level/library';
import { pageSaid } from '../story/cards';
import { CardScene, MessageScene } from './message';
import { CreditsScene, creditsLines } from './credits';
import { FINALE } from '../story/finale';
import { WorldMapScene, showChapterGate, spoken, type WorldMapOptions } from './world-map';
import type { MapProgress, PageId, WorldMapPage } from '../map/types';
import {
  clearLevel,
  entryLevel,
  findLevelNode,
  secretExit,
  isOpen,
  isPageOpen,
  mainLevel,
  newMapProgress,
  openMetExits,
  warpTo,
  chapterGated,
} from '../map/rules';
import { mapPage, rulePages } from '@content/worldmap';
import { CRYSTAL_BALL } from '../map/captives';
import { storyOn, upgradeStory } from '../story/beats';
import { playOpening } from '../story/opening';
import { bonusGame, type BonusOutcome, type BonusSpot } from '../map/bonus-spot';
import { HammerBattleScene } from './hammer-battle';
import { campaignLevel } from '../level/campaign';
import { heroVariant } from '../level/variants';
import { boardAirship, endDev, isAirshipArea, type AirshipRun } from './airship';
import { isLostLevel } from '../level/lost-campaign';
import { spokenLevel } from '../map/campaign-order';
import { abilityHint } from './hints';
import { fontText } from '../hud/text';
import {
  levelTutorial,
  newTutorialRun,
  skipTutorialStory,
  stageTutorial,
  type TutorialRun,
} from '../tutorial/stage-tutorial';
import {
  FIRST_HERO,
  loadSave,
  newSave,
  saveFromState,
  stateFromSave,
  tutorialHeroes,
  metIds,
  writeSave,
  type SaveFile,
  type SaveSlot,
} from '@game/save/save-files';
import {
  bonusSaveFields,
  bonusStateFrom,
  newBonusState,
  swapInventory,
  type BonusState,
} from '../bonus/items';
import { heroStart, type HeroPower } from '../items/heroes';
import { keptPower } from '../rules/reconcile';
import type { StageRound } from '../arena/stage-round';
import { TownScene } from '../town/scene';
import { DEV_VILLAGE, KAKARIKO, layUsedBlocks, openedBlocks, SECRET_HOUSE_LEVEL } from '../town/secret-house';
import type { World } from '../world/world';
import { TipLog } from '../tutorial/tips';
import { ClassicTutorials } from '../tutorial/original-tutorials';
import type { ShareEnv } from '../save/share-code';
import { readSaveCode } from '../save/save-code';
import { BackupCardScene } from './backup-card';
import { LoadCodeScene } from './save-codes';
import { FileSelectScene } from './file-select';
import { ClassicTitleScene, type ClassicTitlePhase } from './original-title';
import { ClassicMenuScene, MAP_SETS, classicNextWorld, mapSetOf, recordClassicBeat } from './original-game';
import { filesBoxFor, fileRulesSpoken, type ClassicFilesScene } from './original-files-menu';
import { openDevLevelSelect } from './level-select-return';
import {
  clearedNote,
  openClearedFile,
  ReplayDeathScene,
  showReplayLevels,
  type ReplayRun,
} from './original-replay';
import { CHOOSE_SFX, heroSet, musicFor, setSong, SMB_SET } from './original-music';
import { applyRevivalBoost, Survival } from '../survival';

export interface GameDeps {
  ctx: GameContext;
  getLevel: (id: string) => LevelData;
  characters: CharacterDef[];
  debugKeys?: ReadonlySet<string>;
  fps?: () => number;
  /** Live settings object and a callback that applies + persists it (wired by main). */
  settings?: Settings;
  applySettings?: () => void;
  input?: InputManager;
  announcer?: Announcer;
  /** Every playable level id (built-in and custom), for the developer level select. */
  listLevels?: () => string[];
  /** DOM hooks for the editor (canvas for pointer mapping, overlay for panels). */
  canvas?: HTMLCanvasElement;
  overlay?: HTMLElement;
  viewport?: Viewport;
  /** The controls the player is using, so the guides show only that scheme (wired by main). */
  controlScheme?: () => ControlScheme;
  /** The last kind of input used (touch, or keys / gamepad), so touch menus never offer Off. */
  lastInput?: () => LastInput;
  /** Play the title's rift intro on the session's first title (main.ts; off in the headless sims). */
  titleIntro?: boolean;
  /**
   * The dev-mode lock (game/dev-lock.ts; main.ts builds it from the build's defines). Absent: open,
   * as in local builds and the headless sims.
   */
  devLock?: DevLock;
  /**
   * A fresh world seed for every level visit (main.ts), so no two visits play out the same
   * (swimming Cheep Cheeps, leaping ones, timers). Off, every world keeps its level's fixed seed
   * (levelSeed), as in the headless sims: the tests that play through Game repeat exactly, run
   * after run, alone or in the full suite.
   */
  freshSeeds?: boolean;
  /**
   * The Home Screen (PWA) side, 0.4.44 (main.ts): platform, install prompt, the waiting update.
   * Without it (the sims) Options has no ADD TO HOME SCREEN and no Home Screen notice shows.
   */
  homeScreen?: HomeScreenHooks;
  /** The share sheet and clipboard for save codes (save/share-code.ts; default: the browser's). */
  shareEnv?: ShareEnv;
  /** Takes `#save=` off the page's address once a resume link was answered (main.ts). */
  clearSaveLink?: () => void;
}

/** Touch when the on-screen pad is shown, else a connected gamepad, else the keyboard. */
export type ControlScheme = 'touch' | 'gamepad' | 'keyboard';

/** RC-005: the card a `?level=custom-` link shows when this browser has no such custom level. */
export const CUSTOM_LEVEL_MISSING: readonly string[] = [
  'LEVEL NOT FOUND',
  '',
  'THIS CUSTOM LEVEL IS NOT',
  'SAVED IN THIS BROWSER.',
  '',
  'ASK FOR ITS SHARE LINK.',
];

/** A castle's main level id: SMB 'W-4' or the Lost Kingdom's 'll-W-4'. */
export const isCastle = (id: string): boolean => /^(ll-)?\d+-4$/.test(id);

/**
 * The keys of `kit` a death keeps for `def` (CharacterDef.keepOnDeath: Classic Warriors of Light's
 * class), outside the campaign; empty for every other hero.
 */
function keptKit(def: CharacterDef, kit: Readonly<Record<string, number>>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of def.keepOnDeath ?? []) if (kit[k] !== undefined) out[k] = kit[k];
  return out;
}

/** BUG-06: whether kept power `k` reads for `def` (a look with another damage kind starts afresh). */
function fitsHero(def: CharacterDef, k: HeroPower): boolean {
  return def.damage.kind === 'powerup' ? k.powerState !== 'full' : k.powerState === 'full';
}

/** Classic mode's random hero draw's seed when play is repeatable (tests: no freshSeeds). */
const RANDOM_PICK_SEED = 0x5eed1;

/** Orchestrates scenes and carries GameState between levels. */
/** Why a Classic file that reads cannot play now (Game.classicFileProblem, 31d; 0.4.72). */
export type FileProblem = 'hero-off' | 'hero' | 'level' | 'not-released';

export class Game {
  readonly scenes = new SceneStack();
  /** The top scene's in-event confirm action (share, clipboard), run by main.ts's input handlers. */
  readonly gestures = new GestureGate(() => this.scenes.top?.gesture?.() ?? null);
  state: GameState;
  /** The title's rift intro has had its turn this session (later titles use the quick drop). */
  titleIntroPlayed = false;
  /** Level to start after character select (custom levels / shared links). */
  pendingLevel: string | null = null;
  /** When set, the current level is an editor play-test; called when it ends. */
  playtestDone: (() => void) | null = null;
  /** Dev-mode starts respawn straight away after a death, skipping character select. */
  quickRespawn = false;
  /** A level opened from a share link: not in any library, so kept here for respawn/continue. */
  private sharedLevel: LevelData | null = null;
  /** World map progress (cleared levels, open worlds, secrets, the hero's place on the map). */
  mapProgress: MapProgress = newMapProgress();
  /** The save file being played from the world map; null for every non-campaign start. */
  campaign: { slot: SaveSlot; scratch?: true } | null = null;
  /**
   * A Classic mode run (title > CLASSIC, or the dev Level select's Mode: Classic run): the
   * original game's flow, with no campaign file (`campaign` stays null). Every other start clears
   * it. Its rules are runRules (Classic mode: classicRules, always Classic; dev: the START page Rules row).
   */
  classicRun = false;
  /**
   * The Classic run's Map Difficulty (G-006): set as the run starts (the CLASSIC menu's Map
   * difficulty row, settings.classicMapDifficulty), Normal for
   * a dev run. GameContext.mapDifficulty is a live view of it while a Classic run plays Classic
   * rules.
   */
  classicDifficulty: MapDifficulty = 'normal';
  /**
   * 0.4.72 (owner item 7): a dev START page start is playing (always free play since the Mode row
   * went): its Map difficulty plays under Classic rules (ctx.mapDifficulty). Cleared by every
   * other start (endClassicRun, startRun, resumes, play-tests, shared levels).
   */
  private devFreePlay = false;
  /**
   * v0.4.73 items 63 / 64: this run goes back to Dev > Level select (a clear, Quit, the last
   * castle's credits): a dev START page start (item 94: the Level Select cheat that also did is gone).
   */
  get levelSelectBack(): boolean {
    return this.devFreePlay && this.devBack !== null;
  }

  /** v0.4.73 items 63 / 64: the dev START page's start just begun (playDevPick) goes back there. */
  keepDevReturn(branch: 'classic' | 'campaign', level: string): void {
    if (this.devFreePlay) this.devBack = { branch, level };
  }

  /**
   * v0.4.73 items 63 / 64: back to the level select this run was started from, its cursor on the
   * level just played (the one under the scenes on top, else the one picked), which it says. The
   * run is left as Quit leaves it; nothing is written. False (doing nothing) for any other run.
   */
  backToLevelSelect(): boolean {
    if (!this.levelSelectBack) return false;
    const here = this.scenes.find((s) => s instanceof LevelScene) as LevelScene | undefined;
    const played = here ? (here.world.level.parent ?? here.world.level.id) : null;
    const back = this.devBack as { branch: 'classic' | 'campaign'; level: string };
    this.showTitle();
    openDevLevelSelect(this, back, played ?? back.level);
    return true;
  }

  /** A dev START page free play start is playing (v0.4.73 item 61: its hero is any hero). */
  get devFreePlaying(): boolean {
    return this.devFreePlay;
  }
  /**
   * 0.4.72 (owner item 6): the dev START page's Mount for this start: 'ride' starts every area
   * riding Yoshi (the mount on, as the Dev menu's Ride); 'none' starts without him (a Ride toggle
   * plays as On); null: no START page start (the toggle and `&yoshi=` decide). Cleared with
   * devFreePlay.
   */
  private devYoshi: 'ride' | 'none' | null = null;
  /**
   * B-L: the save file this Classic run belongs to (its set and slot): every WORLD card and a
   * game over's continue point write it, the credits empty it. Null for a practice run (a
   * CLEARED file's replay), a developer run and a link run, which never write a file.
   */
  classicFile: ClassicFileRef | null = null;
  /**
   * B-L: the rules this Classic run plays, fixed as it starts: its file's, or the original's for
   * a practice or link run. Null for a developer start (and the tests' direct starts), which read
   * the old shared Classic options as they were last kept (no menu changes them any more).
   */
  private runFileRules: ClassicFileRules | null = null;
  /** B-L: the continues this run's file has used (Infinite Lives' goal). */
  fileContinues = 0;
  /**
   * B-L: a practice run: no file, and it counts for nothing (no beat, no cheat counts, no
   * unlocks), as a developer run. Since v0.4.73 (item 94, the Level Select cheat removed) only a
   * CLEARED file's level replay is one (replayRun).
   */
  practiceRun = false;
  /**
   * v0.4.73 items 63 / 64: a dev START page start (keepDevReturn): its branch and level, for the
   * way back to Dev > Level select. Read only while that free play plays (devFreePlay).
   */
  private devBack: { branch: 'classic' | 'campaign'; level: string } | null = null;
  /**
   * v0.4.73 (owner C): the level replay of a CLEARED file playing (or its select), with the
   * file, world and level it was picked from. Only with practiceRun (replayRun reads both): it
   * writes no file, counts for nothing, and has free play's lives.
   */
  private replay: ReplayRun | null = null;
  /**
   * v0.4.73: the worlds this file run has had a WORLD card in (ClassicResume.worlds), for its
   * CLEARED file's replay (The Lost Levels' World 9 and A-D only when reached).
   */
  private runWorlds: number[] = [];
  /**
   * v0.4.73 (owner B): the file this run's ending made CLEARED (and whether storage took it),
   * for the message after the credits and the cheat cards.
   */
  private clearedNews: { ref: ClassicFileRef; saved: boolean } | null = null;
  /**
   * Classic mode's Survival (Options > Game mode): which heroes have fallen and whether the next
   * select may revive (survival.ts). Null in every other run, the campaign's included.
   */
  survival: Survival | null = null;
  /**
   * The Classic run was started from developer mode (the dev Level select's Classic run, or
   * `?mode=classic`): it never records a beat status (G-005) and its wins unlock nothing.
   */
  classicDev = false;
  /**
   * RC-004: the Classic run came from a `?level=` link (devClassicGame). It counts as any Classic
   * run does, but it never touches a save file (no write at its WORLD cards, no clear at its
   * game over or credits), so a shared link cannot replace the player's CLASSIC > Continue run.
   */
  private linkRun = false;
  /**
   * The rules chosen for this non-campaign run (Classic mode, TG-9 rules model). Run starters set
   * it: devStart's and newGame's `opts.rules`, or the Classic mode flow before it starts a run;
   * showTitle, playtest and playShared put it back to 'current'. Never read directly to decide
   * play: liveRules does that, and ignores it while a campaign file is open.
   */
  runRules: Rules = 'current';
  /** Cheats unlocked and not yet shown: each gets its YOU UNLOCKED card (showCheatUnlocks). */
  cheatUnlocks: ClassicCheatId[] = [];
  /**
   * Classic mode: the last hero choice was the select screen's Random slot (FU-4), so the next
   * select starts on it again. Reset with each Classic mode run.
   */
  pickedRandom = false;
  /**
   * The level the next select screen is for (Classic mode's select stands the hero on its ground):
   * set by the new game's select, a warp's and a death's. Null: none known (the overworld's).
   */
  selectLevel: string | null = null;
  /** Classic mode's random hero picks (the Random slot, Single random): seeded per run. */
  private pickRng = new Rng(RANDOM_PICK_SEED);

  /**
   * The map pages the rules read for this run (content/worldmap rulePages): the campaign's, whose
   * roads follow the campaign order (map/campaign-order.ts), on a campaign file; else classic's.
   */
  get rulePages(): readonly WorldMapPage[] {
    return rulePages(this.campaign !== null);
  }
  /**
   * A round played for fun is on (dev-minigames.ts playRound: the arena and Dev → Mini games):
   * nothing it wins is kept and no hero is freed, so its words stay neutral (no campaign lines).
   */
  inRound = false;
  /** Larry's airship challenge in progress (scenes/airship.ts), else null. */
  airship: AirshipRun | null = null;
  /** The campaign's file as last written (the base `autosave` updates). */
  private campaignSave: SaveFile | null = null;
  /** The node the hero last stood on in each page (SaveFile.lastNode), for map travel. */
  mapLastNode: Record<PageId, string> = {};
  /**
   * Page-qualified map ids (rules.revealId) opened but not yet drawn in: each page draws in its
   * own when the hero first arrives there (SaveFile.pendingReveal).
   */
  pendingReveal: string[] = [];
  /**
   * A one-time map cutscene to play before the next map's reveal: 'airship-crash' (Larry's
   * airship crashing on World 4's bonus spot, map/airship-crash.ts), set when the crystal ball is
   * taken. Never saved: it plays once, and a reload only draws the reveal.
   */
  mapCutscene: 'airship-crash' | null = null;
  /** The file's developer "Unlock all" map flag (SaveFile.devUnlockAll); see `mapUnlockAll`. */
  devUnlockAll = false;
  /** The file's developer "All heroes" flag (SaveFile.devAllHeroes); see `heroLocked`. */
  devAllHeroes = false;
  /** The file's developer "Chapter 2 gate: open" flag (SaveFile.devGateOpen); see `chapterGateOpen`. */
  devGateOpen = false;
  /** Heroes freed on the campaign's file (SaveFile.freed); see `heroLocked`. */
  freed: string[] = [FIRST_HERO];
  /**
   * The stage tutorial being played (1-0): its lesson, kept across respawns and its pipe room;
   * null outside one (src/game/tutorial/stage-tutorial.ts).
   */
  tutorialRun: TutorialRun | null = null;
  /** The tips a tutorial or a training stage has shown (0.4.43: the pause menu's LAST TIPS). */
  readonly tips = new TipLog();
  /** Classic mode's Tutorials boxes (O-15 / G-042; off unless Classic options > Tutorials is on). */
  readonly classicTutorials = new ClassicTutorials(this);
  /** Heroes whose training question was answered on the campaign's file (SaveFile.tutorials). */
  tutorials: string[] = [];
  /**
   * Who the campaign's file has met (SaveFile.met): heroes whose captive was talked to, freed
   * heroes, and 'larry' once his airship was boarded; the Mini Game Arena's "found" rule.
   */
  met: string[] = [];
  /**
   * A stage played as one round over another scene (the Mini Game Arena's 1-0: src/game/arena/
   * stage-round.ts): its exit passes, Give up quits; level changes clear down to `base`. Else null.
   */
  stageRound: StageRound | null = null;
  /**
   * World 4's bonus spot can be played (SaveFile.bonusOpen): closed once used, open again when its
   * Hammer Bro is beaten (map/bonus-spot.ts, map/hammer-bro.ts).
   */
  bonusOpen = true;
  /**
   * The used bonus spot's Hammer Bro is out on the map (SaveFile.bonusGuard): not right after the
   * bonus is used, only once a level has been entered from the map since; off again when beaten.
   */
  bonusGuard = false;
  /** The SMB3 item inventory is unlocked on the file (SaveFile.inventoryUnlocked; the crystal ball). */
  inventoryUnlocked = false;
  /**
   * The campaign file's item inventory, bonus rotation, dev "Item inventory" flag and waiting
   * Starman (SaveFile's fields of the same names): src/game/bonus/index.ts. A fresh, empty one
   * outside campaign play.
   */
  bonus: BonusState = newBonusState();
  /**
   * Campaign: the power, hit points and kit of each hero not being played (decision 3: switching
   * heroes keeps them). The played heroes' are in `state`.
   */
  heroKits: Record<string, HeroPower> = {};
  /**
   * BUG-06: a Classic mode run's power, hit points and kit of each hero not being played, by slot
   * hero id (a look shares its hero's, as the original's skins share a charNum). The original keeps
   * every hero's upgrades and ammo in StatManager (obtainedUpgradesVec, ammoVec, _pStateVec by
   * charNum, StatManager.as 135-147): a level's end resets nothing, a hero change leaves each hero
   * his own (Character.as 605 reads getObtainedUpgradesDct(charNum)), a death resets only the hero
   * who died (Character.cleanUp, Character.as 3076-3081), and a new game or a continue resets
   * everyone (resetAllStats, StatManager.as 280-332, 485-489, 542-548). Empty in every other run.
   */
  classicKits: Record<string, HeroPower> = {};
  /**
   * A visit to Kakariko Village under way (0.4.41, town/scene.ts): its scene, kept while the hero
   * is in the secret house's Top Secret Area, and the ? blocks opened there this visit ("x,y";
   * they refill on the next visit from the map, never saved). Null outside the village.
   */
  town: { scene: TownScene; used: Set<string> } | null = null;
  /**
   * The story beats seen on the campaign's file (SaveFile.story; ids from src/game/story/beats.ts),
   * each once. See `seen` / `markSeen`; whether the story plays at all is beats.ts storyOn.
   */
  story: string[] = [];
  /**
   * The one-time explainers shown on the campaign's file (SaveFile.explained, 0.4.46: a pickup's
   * or an item's first touch, tutorial/explainers.ts), each once. See `markExplained`.
   */
  explained: string[] = [];
  /**
   * Beats played while developer "Unlock all" is on (`mapUnlockAll`): they count as seen only
   * while it stays on and are never saved, so with it off the scene plays for real (markSeen).
   */
  private storyUnsaved = new Set<string>();
  /**
   * Campaign: a castle (X-4, SMB or Lost Kingdom) just cleared for the first time on this file, so
   * the map offers "BACK UP YOUR GAME?" once it is the player's again (offerBackup). Null: none.
   */
  backupDue: string | null = null;
  /** A resume link's code (`#save=`, main.ts), asked about once the title is up (offerSaveLink). */
  saveLink: string | null = null;

  constructor(readonly deps: GameDeps) {
    this.state = newGameState(deps.characters[0] as CharacterDef);
    // ctx.rules is a live view of liveRules (TG-9), so every World and the intro card read the
    // run's rules, and never stale ones once a campaign file opens. Setting it sets runRules.
    Object.defineProperty(deps.ctx, 'rules', {
      get: () => this.liveRules,
      set: (r: Rules) => {
        this.runRules = r;
      },
      enumerable: true,
      configurable: true,
    });
    // ctx.classicCheats: the cheats that are on, only while they play (cheatsLive), else absent.
    Object.defineProperty(deps.ctx, 'classicCheats', {
      get: () => (this.cheatsLive ? this.cheatsInForce : undefined),
      enumerable: true,
      configurable: true,
    });
    // ctx.classic likewise: Classic mode's options, only while a Classic run plays Classic rules.
    Object.defineProperty(deps.ctx, 'classic', {
      get: () => this.classicOptions,
      enumerable: true,
      configurable: true,
    });
    // ctx.heroSwaps (BUG-10): dev mode's Toggle heroes "Plays as", only while dev mode is on.
    Object.defineProperty(deps.ctx, 'heroSwaps', {
      get: () => this.heroSwaps,
      enumerable: true,
      configurable: true,
    });
    // ctx.mapDifficulty: the Classic run's Map Difficulty (G-006), only while it plays Classic rules.
    Object.defineProperty(deps.ctx, 'mapDifficulty', {
      // 0.4.72 (owner item 7): a dev free play start under Classic rules plays it too.
      get: () =>
        (this.classicRun || this.devFreePlay) && this.campaign === null && this.liveRules === 'classic'
          ? this.classicDifficulty
          : undefined,
      enumerable: true,
      configurable: true,
    });
    // The Classic Yoshi mount (YM-1, YM-2): only in a Classic-rules run outside the campaign,
    // with the Dev menu's toggle (or a dev `&yoshi=` start) on.
    Object.defineProperty(deps.ctx, 'classicYoshi', {
      get: () => this.yoshiMount,
      enumerable: true,
      configurable: true,
    });
    // ctx.classicMode: a Classic mode run (either rules) outside a campaign file (G-060 to G-074).
    Object.defineProperty(deps.ctx, 'classicMode', {
      get: () => this.classicRun && this.campaign === null,
      enumerable: true,
      configurable: true,
    });
    // Classic mode's music sets (G-060): every song asked for goes through classicMusic, which
    // leaves it alone outside a Classic mode run.
    deps.ctx.audio.setMusicMap?.((id) => this.classicMusic(id));
  }

  /** A hero was just picked on the select screen open now (its choose jingle plays as it closes). */
  private heroChosen = false;

  /** Options > Music set's Random roll for each level scene (G-066): one per area, as it loads. */
  private readonly musicRolls = new WeakMap<LevelScene, 'character' | 'map'>();

  /**
   * The song Classic mode plays for `id` (G-060, original-music.ts musicFor): the playing hero's
   * set's, or the SMB set's, for the area being played. Unchanged outside a Classic mode run or
   * with a campaign file open (the campaign's music is never touched).
   */
  classicMusic(id: string): string | null {
    if (!this.classicRun || this.campaign !== null) return id;
    const scene = this.scenes.find((s) => s instanceof LevelScene) as LevelScene | undefined;
    const choice = this.deps.settings?.classic.musicSet ?? 'character';
    let set: 'character' | 'map' = choice === 'map' ? 'map' : 'character';
    if (choice === 'random') {
      // MusicSets.RANDOM: Character or Map at random (GameSettings.getMusicSet), once per area.
      const rolled = scene ? this.musicRolls.get(scene) : undefined;
      set = rolled ?? (Math.random() < 0.5 ? 'map' : 'character');
      if (scene && !rolled) this.musicRolls.set(scene, set);
    }
    // A look with no set of its own plays its hero's (CharacterDef.lookOf).
    const def = scene?.world.player.def ?? this.state.character;
    return musicFor(id, {
      hero: heroSet(def.id) ? def.id : (def.lookOf ?? def.id),
      level: scene?.level ?? null,
      boss: scene?.bossMusic ?? false,
      set,
    });
  }

  /**
   * A select screen opened (CharacterSelectScene.enter): Classic mode's has the SMB set's select
   * music (G-061; the original's always comes from the map skin, SMB's here).
   */
  selectEntered(classic: boolean): void {
    this.heroChosen = false;
    if (classic && this.campaign === null) this.deps.ctx.audio.playMusic(SMB_SET.select);
    // Tutorials (O-15): the select's box over it (EventManager.characterSelectStart).
    if (classic) this.classicTutorials.atSelect();
  }

  /**
   * A select screen closed (CharacterSelectScene.exit): in Classic mode the chosen hero's choose
   * jingle plays over the WORLD card (G-062; CharacterSelect.as 191); Proto Man whistles instead
   * (his pick sound), so his set has none. Anywhere else nothing.
   */
  selectLeft(classic: boolean): void {
    // Only a pick plays it: Back (or any other way out) leaves in silence for the next scene's music.
    const chosen = this.heroChosen;
    const sounded = this.chooseSounded;
    this.heroChosen = false;
    this.chooseSounded = false;
    if (!classic || this.campaign !== null) return;
    // Back without a pick: the select music stops (the CLASSIC menu is silent).
    if (!chosen) return this.deps.ctx.audio.stopMusic();
    // Already played as the pick performance began (heroPicked), else now.
    if (!sounded) this.playChooseJingle(this.chooseId(this.state.character));
  }

  /** The choose jingle was played (heroPicked) for this select. */
  private chooseSounded = false;

  /**
   * A Classic select's pick performance begins (CharacterSelectScene.perform, G-055): the
   * chosen hero's choose jingle (G-062) and its choose sound (G-070) play now, as the original's
   * chooseCharacter plays them with the move, not when the select closes.
   */
  heroPicked(c: CharacterDef): void {
    if (this.campaign !== null) return;
    this.chooseSounded = true;
    this.playChooseJingle(this.chooseId(c));
  }

  /** The id hero `c` chooses as: its own set's, else (a look with none) its hero's (lookOf). */
  private chooseId(c: CharacterDef): string {
    return heroSet(c.id) ? c.id : (c.lookOf ?? c.id);
  }

  /**
   * Classic mode's choose jingle for hero `id` (G-062; CharacterSelect.as 191), with its choose
   * sound (G-070: Mega Man and his skins teleport out, MegaMan.as 157; Bill is shocked, Bill.as
   * 1087; CHOOSE_SFX).
   * The one trigger of both: the pick performance's start (heroPicked), else the select's close
   * after a pick (selectLeft).
   */
  playChooseJingle(id: string): void {
    const song = setSong(heroSet(id), 'choose');
    if (song) this.deps.ctx.audio.playJingle(song);
    else this.deps.ctx.audio.stopMusic();
    const sfx = CHOOSE_SFX[id];
    if (sfx) this.deps.ctx.audio.sfx(sfx);
  }

  /**
   * Classic mode's gameplay options (More Settings, Customize Weapons) for the run being played:
   * its file's (B-L), only in a Classic run (Classic mode, or a dev Classic run) with Classic
   * rules, else undefined, so the campaign and every Current run never see them. A developer
   * start without settings (the test harnesses) has none either: the original's values.
   */
  get classicOptions(): ClassicSettings | undefined {
    if (!this.classicRun || this.liveRules !== 'classic') return undefined;
    if (!this.runFileRules && !this.deps.settings) return undefined;
    return this.classicRunRules.options;
  }

  /**
   * B-L: the rules the Classic run (or the flow starting one) plays: its file's, the original's
   * for a practice or link run, else (a developer start) the old shared options as last kept.
   */
  get classicRunRules(): ClassicFileRules {
    if (this.runFileRules) return this.runFileRules;
    const s = this.deps.settings;
    if (!s) return originalFileRules();
    return { difficulty: s.classicMapDifficulty, options: s.classic, heroesOff: s.classicHeroesOff ?? [] };
  }

  /**
   * The one place Classic mode decides how a hero is chosen (Options > Game mode; the original's
   * CampaignModes): 'select' shows the select screen, 'keep' goes on with the hero playing,
   * 'random' picks one (randomHero) with no select screen. `first` is the run's first choice.
   * All heroes (the default): always 'select'. Single hero: 'select' once, then 'keep'. Single
   * random: always 'random'. Survival: always 'select' (ScreenManager.createLevel shows
   * CharacterSelect in every mode but the two single ones), which opens in revive mode when
   * revival is allowed (survival.ts).
   */
  classicHeroChoice(first: boolean): 'select' | 'keep' | 'random' {
    switch (this.classicRunRules.options.gameMode) {
      case 'survival':
        return 'select';
      case 'single':
        return first ? 'select' : 'keep';
      case 'single-random':
        return 'random';
      default:
        return 'select';
    }
  }

  /**
   * Game mode Single random's pick, said with the next lives card ("Sophia III. World 1-1. 3
   * lives."), as no select screen names it. Cleared once said.
   */
  private sayHero: string | null = null;

  /** Said at the start of the next lives card's line, then cleared (Continue's, owner decision). */
  private sayFirst: string | null = null;

  /** Single random: a random hero, to be named on the next lives card. */
  private singleRandomHero(): CharacterDef {
    const c = this.randomHero();
    this.sayHero = c.name;
    return c;
  }

  /**
   * A random hero for Classic mode (the Random slot, Single random): any hero of the run's roster
   * that can be picked, from this run's seeded draw (fixed in tests; fresh in play).
   */
  randomHero(among?: readonly CharacterDef[]): CharacterDef {
    // Survival: never a fallen hero (CharacterSelectBox: only standing heroes are selectable);
    // revive mode passes its own list (`among`).
    const heroes =
      among ?? this.heroSlots.filter((c) => !this.heroLocked(c) && !this.survival?.isFallen(c.id));
    // The hero comes in the look chosen for it (FU-8: the Random slot respects the skin picker).
    return this.skinFor(this.pickRng.pick(heroes.length ? heroes : this.heroSlots));
  }

  /**
   * The select screen's slots: in a Classic-rules run, the original's eleven heroes in its order
   * (registry CLASSIC_SLOTS), then the released heroes the original never had
   * (expansionHeroOffered); every other look is a skin on one of them. Any other run (the campaign, Current
   * rules): the roster itself, untouched.
   */
  get heroSlots(): CharacterDef[] {
    return this.withoutDisabled(this.slotsFor(this.liveRules));
  }

  /**
   * 0.4.72 (owner item 5): the heroes the select screen shows. Outside dev mode, heroSlots. In
   * dev mode every hero Dev > Toggle heroes does not set Off, released or not (classicHeroOn in
   * place of expansionHeroOffered's release rule), still without the ones the run's Disable
   * heroes turned off. Random, Single random and Survival keep heroSlots.
   */
  get selectSlots(): CharacterDef[] {
    // Survival tracks heroSlots (newSurvival): its select offers only those, so every hero shown
    // stands or has fallen in the run, and revive Random draws only from them.
    if (!this.devMode || this.survival !== null) return this.heroSlots;
    return this.withoutDisabled(this.devSlotsFor(this.liveRules));
  }

  /**
   * 0.4.72 (owner item 5): slotsFor `rules` as dev mode's hero pickers offer them (the select,
   * the dev START page's Hero row): every hero Dev > Toggle heroes does not set Off. Outside dev
   * mode, slotsFor itself (the release rule).
   */
  devSlotsFor(rules: Rules): CharacterDef[] {
    if (!this.devMode) return this.slotsFor(rules);
    return this.slotsFor(rules, (id) => {
      const d = CLASSIC_EXTRAS.find((c) => c.id === id);
      return d ? this.classicHeroOn(d) : !this.classicToggles.heroesOff.includes(id);
    });
  }

  /**
   * v0.4.73 item 61 (owner): the dev START page's Hero row offers every hero there is under
   * `rules`, released or not, whatever Dev > Toggle heroes says (Toggle heroes is for Classic and
   * campaign play only). The heroes in the select's order (slotsFor), on devRosterFor.
   */
  devAllSlotsFor(rules: Rules): CharacterDef[] {
    return this.slotsFor(rules, () => true, this.devRosterFor(rules));
  }

  /** rosterFor `rules` with every Classic extra, the ones Toggle heroes set Off too (item 61). */
  devRosterFor(rules: Rules): CharacterDef[] {
    if (rules !== 'classic' || CLASSIC_EXTRAS.length === 0) return this.deps.characters;
    return [...this.deps.characters, ...CLASSIC_EXTRAS];
  }

  /** `slots` without the heroes the Classic run's Disable heroes turned off (G-032). */
  private withoutDisabled(slots: CharacterDef[]): CharacterDef[] {
    // G-032: a Classic mode run leaves out the heroes Options > Disable heroes turned off,
    // always keeping at least one (GeneralOptions.as: the last hero cannot be disabled).
    if (!(this.classicRun || this.classicFlow) || this.campaign !== null) return slots;
    const off = this.classicRunRules.heroesOff;
    if (off.length === 0) return slots;
    const on = slots.filter((c) => !off.includes(c.id));
    return on.length ? on : slots;
  }

  /**
   * heroSlots for a run under `rules` (G-093: the Classic menu's How to play lists the heroes a
   * Classic run would offer, though no run is playing yet).
   */
  slotsFor(
    rules: Rules,
    offered: (id: string) => boolean = (id) => this.expansionHeroOffered(id),
    roster: CharacterDef[] = this.rosterFor(rules),
  ): CharacterDef[] {
    if (rules !== 'classic' || this.campaign !== null) return roster;
    const ids = [...CLASSIC_SLOTS, ...EXPANSION_HEROES.filter(offered)];
    const slots: CharacterDef[] = [];
    for (const id of ids) {
      const def = roster.find((c) => c.id === id && !isSkin(c));
      if (def) slots.push(def);
    }
    // A hero the lists do not name (a test's stand-in extra) keeps a slot of its own, after them.
    for (const c of roster)
      if (!slots.includes(c) && !isSkin(c) && !ids.includes(c.id) && !EXPANSION_HEROES.includes(c.id))
        slots.push(c);
    return slots.length ? slots : roster;
  }

  /**
   * Classic mode's menu flow is under way (classicSelect onward, until the run ends): its select
   * and Random slot leave out the disabled heroes before classicRun is set (G-032).
   */
  private classicFlow = false;

  /**
   * O-12 / O-06 / BUG-08: the one place that decides whether Expansion hero `id` gets a select slot
   * (so the select, Random, Survival, Disable heroes, the guides and the dev START page):
   * `devMode ? (override ?? release) : release`. The override is Dev > Toggle heroes' On or Off;
   * release is heroReleased.
   */
  expansionHeroOffered(id: string): boolean {
    const release = this.heroReleased(id);
    if (!this.devMode) return release;
    const t = this.classicToggles;
    if (t.heroesOff.includes(id)) return false;
    if (t.heroesOn?.includes(id)) return true;
    return release;
  }

  /**
   * What release players get for Expansion hero `id` (O-12), and so O-06's Release in dev mode
   * too: released (RELEASED_EXPANSION_HEROES) and nothing else. BUG-08: there is no Options row
   * for them any more; a `classic.expansion` value saved by an earlier version is ignored and
   * never rewritten.
   */
  heroReleased(id: string): boolean {
    return expansionReleased(id);
  }

  /**
   * 0.4.72: hero `c`'s slot is an Expansion hero players do not have yet (only dev mode's select
   * offers it), whether dev mode is on now or not: a run playing it marks its file (devHero) even
   * after dev mode was turned off mid-run.
   */
  devOnlyHero(c: CharacterDef): boolean {
    const id = this.slotOf(c).id;
    return EXPANSION_HEROES.includes(id) && !this.heroReleased(id);
  }

  /** The select slot hero `c` plays in (itself, or the hero it is a skin of). */
  slotOf(c: CharacterDef): CharacterDef {
    const host = skinHost(c);
    return host !== c && this.roster.includes(host) ? host : c;
  }

  /**
   * A hero from an old save or a run begun before the slots changed (a skin that had its own slot:
   * Peach, Pit, Proto Man, the Mega Man variants): its slot's hero, with the skin remembered as
   * that slot's look, so the run goes on looking and playing as it did. A hero with no slot now is
   * swapped for the first slot's; any other hero is itself.
   */
  restoreSlotHero(c: CharacterDef): CharacterDef {
    const host = this.slotOf(c);
    // A hero the select does not offer now: the first slot's hero, Mario, in his chosen look, so
    // Survival has a hero standing and the select shows who plays. Item 40: a file of an unreleased
    // Expansion hero never gets here (NOT RELEASED); what still does is a `?char=` link or dev
    // start naming one, and a file whose hero its own Disable heroes left out (P1).
    // A hero the dev select offers (selectSlots: dev mode shows every hero not set Off) plays.
    const slots = this.selectSlots;
    if (!slots.includes(host)) {
      const first = slots.find((d) => !this.heroLocked(d)) ?? slots[0];
      return first ? this.skinFor(first) : c;
    }
    if (host === c) return c;
    if (this.deps.settings && this.deps.settings.classicSkins?.[host.id] !== c.id) this.setSkin(host, c);
    return c;
  }

  /** Slot hero `c` in its chosen look (Settings.classicSkins; its own when none is chosen). */
  skinFor(c: CharacterDef): CharacterDef {
    const id = this.deps.settings?.classicSkins?.[c.id];
    if (!id) {
      // No choice saved (a run begun before the picker, as Break Man, Dark Pit or Doropie): the
      // look playing now, when it is one of this hero's skins.
      const s = this.state;
      const now = [s.character, s.character2].find((d) => d && d !== c && this.slotOf(d) === c);
      return now ?? c;
    }
    if (id === c.id) return c;
    return skinsOf(c).find((d) => d.id === id && this.roster.includes(d)) ?? c;
  }

  /** The skins slot hero `c` offers now (its own look first; only those on the roster). */
  skinsFor(c: CharacterDef): readonly CharacterDef[] {
    const list = skinsOf(c).filter((d) => d === c || this.roster.includes(d));
    return list.length ? list : [c];
  }

  /** Remembers `skin` as slot hero `c`'s look (saved with the settings). */
  setSkin(c: CharacterDef, skin: CharacterDef): void {
    const s = this.deps.settings;
    if (!s) return;
    // Its own look is saved too, so it outlasts a skin still playing (skinFor's fallback).
    s.classicSkins = { ...(s.classicSkins ?? {}), [c.id]: skin.id };
    this.deps.applySettings?.();
  }

  /** Lives at a Classic run's start and after its continues (More Settings > Lives; else 3). */
  private classicStartLives(): void {
    const lives = this.classicOptions?.lives;
    if (lives !== undefined) this.state.lives = lives;
  }

  /** Options > Game mode is Survival (read for a Classic run only). */
  private get survivalMode(): boolean {
    return this.classicRunRules.options.gameMode === 'survival';
  }

  /**
   * A run that starts without Classic mode's first select (a dev Classic run, Free play, a dev
   * Level select start): Survival only for a Classic run with Survival set, its hero standing and
   * no revival waiting; any other run has none (a Survival run left behind ends here).
   */
  private survivalWithoutSelect(classic: boolean, character: CharacterDef): void {
    this.survival = null;
    if (!classic || !this.survivalMode) return;
    this.survival = this.newSurvival();
    this.survival.revive(this.slotOf(character).id);
    this.survival.reviveAllowed = false;
  }

  /** A new Survival for this run: every hero of its roster (not hidden or locked) fallen. */
  private newSurvival(): Survival {
    // By slot: a hero's skins are one hero (FU-8).
    return new Survival(() => this.heroSlots.filter((c) => !this.heroLocked(c)).map((c) => c.id));
  }

  /**
   * The lives the pre-level card shows: the lives left, or 1 in Survival (InformativeBlackScreen:
   * numLives = 1 when the campaign mode is SURVIVAL), where each hero has one life.
   */
  get cardLives(): number {
    return this.survivalRun ? 1 : this.state.lives;
  }

  /**
   * Lives are infinite: the assist, or Classic mode's Infinite Lives cheat while it plays (as the
   * World folds it in: cheatAssist). The original exempts Survival's fall and a revival's cost
   * from both (StatManager.playerDie `|| Cheats.infiniteLives`; loseLife returns early).
   */
  private get livesInfinite(): boolean {
    return this.deps.ctx.assist.infiniteLives || this.deps.ctx.classicCheats?.infiniteLives === true;
  }

  /** A Classic Survival run is being played (its run ends only when every hero has fallen). */
  get survivalRun(): boolean {
    return this.survival !== null && this.classicRun;
  }

  /**
   * A death in Survival (StatManager.playerDie): the playing hero falls and no life is lost.
   * False (nothing done) in any other run, or with infinite lives, where the original plays the
   * death as in any other mode.
   */
  survivalFall(): boolean {
    if (!this.survival || !this.survivalRun || this.livesInfinite) return false;
    this.survival.fall(this.slotOf(this.state.character).id);
    return true;
  }

  /**
   * Revive mode's OK on hero `c` (CharacterSelectBox.reviveCharacter): one life is paid
   * (StatManager.loseLife; nothing with infinite lives), then a fallen hero stands again with
   * nothing, and a standing one is strengthened (two power-ups and its ammo when it next plays).
   */
  reviveHero(c: CharacterDef): 'revived' | 'strengthened' {
    const sv = this.survival;
    if (!sv) return 'revived';
    if (!this.livesInfinite) this.state.lives = Math.max(0, this.state.lives - 1);
    return sv.revive(this.slotOf(c).id);
  }

  /**
   * Hero `c` stands and a revive can no longer strengthen it (StatManager.charIsFullyUpgraded under
   * Classic power-ups: it has the Mushroom and the Fire Flower): a strengthening waits for it, or
   * it is the hero playing and has the Fire Flower.
   */
  fullyUpgraded(c: CharacterDef): boolean {
    const id = this.slotOf(c).id;
    if (this.survival?.isFallen(id)) return false;
    if (this.survival?.boosted(id)) return true;
    if (id === this.slotOf(this.state.character).id) return this.state.powerState === 'fire';
    // BUG-06: a hero put away keeps his Fire Flower.
    return this.classicKits[id]?.powerState === 'fire';
  }

  /**
   * A dev `?level=` start's `&yoshi=1|ride` (main.ts, dev-url.ts urlYoshi): overrides the Dev menu's
   * Yoshi mount toggle for the session. Null: the toggle decides.
   */
  yoshiUrl: 'on' | 'ride' | null = null;

  /** The Classic Yoshi mount in force now (GameContext.classicYoshi): undefined when off. */
  get yoshiMount(): 'on' | 'ride' | undefined {
    if (this.liveRules !== 'classic' || !this.devMode) return undefined;
    if (this.devYoshi === 'ride') return 'ride';
    const t = this.classicToggles;
    const base = this.yoshiUrl ?? (t.yoshiMount ? (t.yoshiRide ? 'ride' : 'on') : undefined);
    return this.devYoshi === 'none' && base === 'ride' ? 'on' : base;
  }

  /**
   * The Dev menu's Classic toggles in force (Settings.classicDev): the saved ones while dev mode
   * is on, else the defaults (every hero on, no Yoshi mount), so Classic plays as shipped.
   */
  get classicToggles(): ClassicDevToggles {
    const s = this.deps.settings;
    // A hand-made settings object (a test harness's) may predate the field: the defaults.
    return (this.devMode && s?.classicDev) || { yoshiMount: false, heroesOff: [] };
  }

  /**
   * BUG-10: dev mode's Toggle heroes "Plays as" swaps (ctx.heroSwaps): under Classic rules the
   * heroes set to play their Campaign design, under Campaign rules those set to play their Classic
   * kit. Undefined outside dev mode, so release players never get either.
   */
  get heroSwaps(): HeroSwaps | undefined {
    if (!this.devMode) return undefined;
    const t = this.classicToggles;
    if (!t.playsCampaign?.length && !t.playsClassic?.length) return undefined;
    return { classic: t.playsCampaign ?? [], current: t.playsClassic ?? [] };
  }

  /** False for a hero not in SMBC 3.1.21 (CharacterDef.notInOriginal) toggled off in the Dev menu. */
  classicHeroOn(def: CharacterDef): boolean {
    return !def.notInOriginal || !this.classicToggles.heroesOff.includes(def.id);
  }

  /**
   * The one place that decides the live rules (TG-9 rules model): 'current' whenever a campaign
   * file is open, else the run's (runRules). A World reads them once, when it is built.
   */
  get liveRules(): Rules {
    return this.campaign !== null ? 'current' : this.runRules;
  }

  /**
   * Who can be picked for this run (TG-41): the roster plus the Classic-only extras in a
   * Classic-rules run outside the campaign, else deps.characters (the same array, untouched).
   * heroesToFind, captives, the map and the training rooms keep reading deps.characters.
   */
  get roster(): CharacterDef[] {
    return this.rosterFor(this.liveRules);
  }

  /** The roster for a non-campaign run under `rules` (the dev Level select's Rules row). */
  rosterFor(rules: Rules): CharacterDef[] {
    if (rules !== 'classic' || CLASSIC_EXTRAS.length === 0) return this.deps.characters;
    // A hero toggled off in the Dev menu is left out (and `?char=` falls back to the first).
    return [...this.deps.characters, ...CLASSIC_EXTRAS.filter((d) => this.classicHeroOn(d))];
  }

  get ctx(): GameContext {
    return this.deps.ctx;
  }

  /**
   * The end of a game (an exit marked `next=end`; `from` is the main level's id).
   *
   * SMB (and custom levels): the castle has said "Your quest is over."; the credits roll over it
   * (ScreenManager.startMoveCreditsTmrHandler), then the title (restartGameTmrHandler ->
   * beatGame -> restartGame). In campaign mode, after the credits the clear is recorded, the file
   * marked as cleared and saved, and the World 8 map follows, where the road on to Lost World 1
   * draws in (0.4.7: the Lost Levels are the story's extension; before, the title).
   *
   * The Lost Levels (see showLostEnding): outside the campaign they follow the NES rules (8-4
   * counts a game beaten and, without warps, goes on to World 9; World 9 and D-4 end the game);
   * in the campaign 8-4 and 9-4 go back to the map, where the next world's road draws in, and
   * D-4 is the final ending, with the credits.
   */
  showEnding(from = ''): void {
    // v0.4.73 (owner C, 48A): a replayed level's castle goes back to its world's level box.
    if (this.replayRun) return this.replayCleared();
    // G-008, B-L: a Classic run that reaches the credits is over. v0.4.73 (owner 46B): its file
    // is kept as CLEARED, never emptied.
    if (this.keepsResume) this.clearFile(from);
    // A Classic mode run ends every map set as SMB (G-001): D-4's castle said the quest is over.
    if (from.startsWith('ll-') && !this.classicRun) return this.showLostEnding(from);
    const below = this.scenes.top;
    const world = below instanceof LevelScene ? below.world : null;
    const head = world ? world.castleText.splice(0) : [];
    // The campaign's last castle is a false ending (docs/STORY.md 2.12): the credits say so at
    // the end. 8-4 until Bowser's Castle comes (story/finale.ts FINALE).
    const story = storyOn(this) && from === FINALE.castle;
    // The castle's lines were read out as they showed (World.updateBossClear), so the credits
    // do not read them a second time; the scene reads the whole roll, the story lines with it.
    this.scenes.push(new CreditsScene(this, head, () => this.afterCredits(from), world, creditsLines(story)));
  }

  /**
   * The credits are over: campaign files record the clear and save, then the map page of the
   * castle (SMB 8-4: World 8, its road on to Lost World 1 drawn in; Lost Levels D-4). Otherwise
   * (and for a campaign level on no map page) the title.
   */
  private afterCredits(from: string): void {
    // Classic mode (G-004, G-005, owner decision D3): the map set's beat status is kept, the
    // cheats it unlocks are told, then the title (ScreenManager.restartGameTmrHandler ->
    // StatManager.beatGameHandler's unlock boxes -> restartGame).
    if (this.classicRun) {
      // A developer-started run counts for nothing: the title, as free play. So does a practice
      // run (B-L owner).
      if (this.classicDev || this.practiceRun) return this.showTitle();
      const set = mapSetOf(from).id;
      // Under Current rules every level plays as Normal (no layers): the beat counts as Normal.
      recordClassicBeat(set, this.liveRules === 'classic' ? this.classicDifficulty : 'normal');
      // v0.4.73 item 94 (owner): every map set beaten on Hard no longer opens a Level Select
      // cheat (the original's, StatManager 516-517): a CLEARED file's replay is the level select.
      // Beating the game unlocks the cheats whose goals it completes (beatGameHandler): SMB
      // All Ground Is Bricks, Super Mario Bros. Special All Hammer Bros (G-020), any set the
      // count and no-continue goals.
      this.cheatEvent({ beat: set });
      this.showClassicUnlocks();
      return;
    }
    if (this.campaign) {
      const s = this.state;
      s.checkpoint = null;
      s.time = null;
      // The clear first, then the flag: the Valley's road on opens on either (castle-or-gameCleared),
      // so the clear is what opens it, and it draws in (0.4.55).
      this.addReveal(this.recordClear(from));
      if (!isLostLevel(from)) this.mapProgress.gameCleared = true;
      this.autosave();
      if (findLevelNode(mainLevel(from, this.deps.getLevel))) return this.returnToMap();
    }
    // v0.4.73 items 63 / 64: a dev START page start goes back to Dev > Level select.
    if (!this.backToLevelSelect()) this.showTitle();
  }

  /**
   * The Lost Levels' game ends: 8-4, 9-4 and D-4 (ll-13-4), each with the owner's card (the NES
   * wording, 2026-10-06). The card is the castle's thanks: those castles say nothing themselves
   * (World.updateBossClear), and the card is drawn where their text would be, over the level,
   * with the HUD's score above it as in the SMB 8-4 ending. Start or B continues ("PUSH BUTTON B
   * TO SELECT A WORLD": there is no world picker, so B goes on like Start). D-4 rolls the credits
   * over the castle, scrolling the card away (the SMB 8-4 path).
   *
   * Campaign play (a save file from the map): the story's extension (0.4.7). The clear is
   * recorded on the castle's page (the level → page lookup) and saved as the card shows; the
   * castle's exit opens the next world whatever warps were taken (8-4 → World 9, 9-4 → World A),
   * and the end goes back to that page, where the road draws in: 8-4 and 9-4 after the card, D-4,
   * the final ending, after the credits. The global NES progress store is left alone.
   *
   * Outside the campaign (dev select, ?level=) the NES rules: 8-4 then shows the games-beaten
   * tally (and, warped, why World 9 stays shut) before World 9 or the title; 9-4 goes to the
   * title; D-4 to the title after the credits.
   */
  private showLostEnding(from: string): void {
    const s = this.state;
    const campaign = this.campaign !== null;
    if (campaign) {
      s.checkpoint = null;
      s.time = null;
      this.addReveal(this.recordClear(from));
      this.autosave();
    }
    const below = this.scenes.top;
    const world = below instanceof LevelScene ? below.world : null;
    // "THANK YOU <hero>!" names the hero who took the axe, as Toad's thanks do (World.castleText).
    const hero = fontText((world?.castleHero ?? s.character).name);
    // v0.4.73 items 63 / 64: a dev START page start's 8-4 says only THANK YOU (its next stop is
    // Dev > Level select, not a world to select).
    const card =
      (from === 'll-8-4' && !this.levelSelectBack) || from === 'll-13-4'
        ? [
            `THANK YOU ${hero}!`,
            '',
            'YOUR QUEST IS OVER.',
            'WE PRESENT YOU A NEW QUEST.',
            '',
            'PUSH BUTTON B',
            'TO SELECT A WORLD',
          ]
        : ['THANK YOU!'];
    let then: () => void;
    // v0.4.73 items 63 / 64: a dev START page start's castle is a clear like any other: its card,
    // then Dev > Level select (no games-beaten tally: a dev run writes nothing).
    if (from === 'll-8-4' && !campaign && !this.levelSelectBack) {
      const warped = s.warped;
      const before = loadProgress();
      const progress = recordLostGameBeaten(before, warped);
      saveProgress(progress);
      const opened = lostLettersOpen(progress) && !lostLettersOpen(before);
      const tally = opened
        ? ['WORLDS A-D ARE OPEN!']
        : [`GAMES BEATEN ${Math.min(progress.lost.beaten, 99)}`];
      const page = warped
        ? ['WORLD 9 OPENS AFTER A RUN', 'THROUGH WORLDS 1-8', 'WITHOUT WARP ZONES.', '', ...tally]
        : tally;
      const next = () => (warped ? this.showTitle() : this.goToLevel('ll-9-1-start', { mode: 'stand' }));
      then = () => {
        this.deps.announcer?.say(page.filter(Boolean).join(' '));
        this.scenes.clear();
        this.scenes.push(
          new MessageScene(
            this,
            [...page, '', fontText(`PRESS ${abilityHint(this, 'OK', 'jump')}`)],
            next,
            ['start', 'attack', 'jump'], // as the card, plus A
          ),
        );
      };
    } else if (from === 'll-13-4') {
      then = () => {
        const head = world ? world.castleText.splice(0) : card;
        this.scenes.pop(); // the card; the level (if any) stays beneath the credits
        this.scenes.push(new CreditsScene(this, head, () => this.afterCredits(from), world));
      };
    } else
      then = () => {
        if (campaign) this.returnToMap();
        else if (!this.backToLevelSelect()) this.showTitle();
      };
    const audio = this.deps.ctx.audio;
    audio.stopMusic();
    audio.playJingle('world-clear');
    this.deps.announcer?.say(card.filter(Boolean).join(' '));
    if (!world) this.scenes.clear();
    this.scenes.push(new CardScene(this, card, then, world));
  }

  showTitle(): void {
    // Back from the CLASSIC title (or a box over it), 0.4.72: the REMIX title breaks CLASSIC over
    // that title's still frame (TitleScene's back transition). Its music is not stopped here:
    // the REMIX title takes it from where it is.
    const classic =
      (this.scenes.find((s) => s instanceof ClassicTitleScene) as ClassicTitleScene | undefined) ?? null;
    this.leaveRun(classic !== null);
    this.scenes.clear();
    this.scenes.push(new TitleScene(this, classic));
  }

  /** Everything a run (of any kind) leaves behind on the way back to the menus (showTitle). */
  private leaveRun(keepMusic = false): void {
    this.flushCheatStats();
    this.airship = null;
    this.runRules = 'current';
    if (!keepMusic) this.deps.ctx.audio.stopMusic();
    this.pendingLevel = null;
    this.playtestDone = null;
    this.quickRespawn = false;
    this.campaign = null;
    this.endClassicRun();
    this.backupDue = null;
    this.celebrate.clear();
    this.pendingReveal = [];
    this.devUnlockAll = false;
    this.endTutorial();
    this.devAllHeroes = false;
    this.bonus = newBonusState();
    this.town = null;
  }

  /**
   * The world map page `page` (default: where the hero stands), replacing every scene. Pages
   * whose castle exit's condition has come to hold since (rules.openMetExits) open first.
   */
  showMap(page?: PageId, opts: WorldMapOptions = {}): void {
    this.airship = null;
    this.pendingLevel = null;
    this.playtestDone = null;
    this.quickRespawn = false;
    this.endTutorial();
    this.town = null; // any visit to the village is over
    if (this.campaign) this.addReveal(openMetExits(this.mapProgress, this.rulePages));
    this.scenes.clear();
    this.scenes.push(new WorldMapScene(this, page ?? this.mapProgress.position.page, opts));
  }

  /**
   * A level node picked on the map: character select with the current hero preselected (keeping
   * it keeps its power; a different hero starts from its default), then player two's own pick on
   * a two-player file, then the level (its intro scene when it has one). A file stays one- or
   * two-player as created. The picks apply only once the level starts, and are saved to the file
   * so the map and the file select show them; Back from either pick returns to the map unchanged.
   * A stage tutorial (1-0) is played with its own hero, with no pick (player two keeps theirs).
   */
  enterLevelFromMap(levelId: string): void {
    const s = this.state;
    let hero = s.character;
    let hero2 = s.character2;
    const back = () => this.scenes.pop();
    const go = () => {
      if (hero !== s.character) this.setHero(0, hero);
      if (hero2 && hero2 !== s.character2) this.setHero(1, hero2);
      s.checkpoint = null;
      this.guardBonus();
      this.autosave();
      this.deps.ctx.audio.stopMusic();
      // Its intro when it has one, else its first area (Lost Levels 9-1 starts in ll-9-1-start).
      const entry = entryLevel(levelId, this.deps.getLevel);
      this.goToLevel(entry === levelId ? this.firstArea(levelId) : entry, { mode: 'stand' });
    };
    const tutorial = stageTutorial(levelId);
    const tutorialHero = this.deps.characters.find((c) => c.id === tutorial?.hero);
    if (tutorial && tutorialHero) {
      // Saved as the file has it; the tutorial's hero plays, and the file's comes back after.
      s.checkpoint = null;
      this.guardBonus();
      this.autosave();
      const heroes =
        s.character === tutorialHero
          ? null
          : { character: s.character, powerState: s.powerState, hp: s.hp, kit: { ...s.kit } };
      if (heroes) this.setHero(0, tutorialHero);
      this.tutorialRun = newTutorialRun(tutorial, s.lives, heroes);
      this.deps.ctx.audio.stopMusic();
      this.goToLevel(this.firstArea(levelId), { mode: 'stand' });
      return;
    }
    const pick = (player: 0 | 1, then: () => void) =>
      new CharacterSelectScene(this, {
        player,
        current: player === 1 ? (s.character2 as CharacterDef) : s.character,
        onPick: (c) => {
          if (player === 1) hero2 = c;
          else hero = c;
          then();
        },
        onCancel: back,
        // A training stage on the way plays its own music; the map's comes back after it.
        music: mapPage(this.mapProgress.position.page)?.music,
      });
    this.scenes.push(
      pick(0, () => {
        if (!s.character2) return go();
        this.scenes.pop();
        this.scenes.push(pick(1, go));
      }),
    );
  }

  /**
   * World 2's hidden spot (its map node's `town`): straight into Kakariko Village with the file's
   * hero, no character select (owner). The first time, the village is found: its secret goes on
   * the file (the map's label and the guard's hello follow it) and the file is saved.
   */
  enterTown(): void {
    const first = !this.mapProgress.secrets.includes(KAKARIKO);
    if (first && this.campaign) this.mapProgress.secrets.push(KAKARIKO);
    this.guardBonus();
    this.autosave();
    this.deps.ctx.audio.stopMusic();
    const scene = new TownScene(this, { first });
    this.town = { scene, used: new Set() };
    this.scenes.clear();
    this.scenes.push(scene);
  }

  /**
   * Out of the village (the south gate, or its menu's Quit to map): back on the map with nothing
   * cleared, saved as after a level, whoever the hero now is.
   */
  leaveTown(): void {
    this.town = null;
    // Dev level select's village has no map to go back to.
    if (!this.campaign) return this.showTitle();
    this.returnToMap();
  }

  /**
   * The secret house's door: the side-view Top Secret Area with the town's hero (no character
   * select, no WORLD card), its blocks as this visit has left them.
   */
  enterSecretHouse(): void {
    this.state.checkpoint = null;
    this.goToLevel(SECRET_HOUSE_LEVEL, { mode: 'stand' });
  }

  /**
   * The Top Secret Area's pipe (`-> town`) during a visit: what was opened is remembered for the
   * rest of the visit, and the village comes back with the hero on the secret house's step.
   */
  returnToTown(world: World): void {
    const town = this.town;
    if (!town) {
      this.returnToMap();
      return;
    }
    for (const key of openedBlocks(world.level, world)) town.used.add(key);
    this.state.checkpoint = null;
    this.state.time = null;
    this.deps.ctx.audio.stopMusic();
    this.scenes.clear();
    this.scenes.push(town.scene);
    town.scene.backFromSecretHouse();
  }

  /** Story beat `id` (beats.ts) has played on this file. */
  seen(id: string): boolean {
    return this.story.includes(id) || (this.mapUnlockAll && this.storyUnsaved.has(id));
  }

  /**
   * Records story beat `id` (beats.ts) as seen, once, and writes it to the file (campaign only):
   * only the file's `story` list changes, so a beat mid-level never makes a save point of the
   * run. While developer "Unlock all" is on, the scene may play but nothing is recorded on the
   * file (it is kept aside until "Unlock all" is turned off, so it does not repeat meanwhile).
   */
  markSeen(id: string): void {
    if (this.seen(id)) return;
    if (this.mapUnlockAll) {
      this.storyUnsaved.add(id);
      return;
    }
    this.story.push(id);
    const base = this.campaign ? this.campaignSave : null;
    if (!base) return;
    this.campaignSave = { ...base, story: this.story.slice() };
    this.writeFile(this.campaignSave);
  }

  /**
   * Records explainer `id` (tutorial/explainers.ts) as shown, once, and writes it to the file
   * (campaign only): only the file's `explained` list changes, as a story beat's (markSeen).
   */
  markExplained(id: string): void {
    if (this.explained.includes(id)) return;
    this.explained.push(id);
    const base = this.campaign ? this.campaignSave : null;
    if (!base) return;
    this.campaignSave = { ...base, explained: this.explained.slice() };
    this.writeFile(this.campaignSave);
  }

  /**
   * Writes the campaign's save file: the run (lives, score, coins, heroes, power) and the map
   * progress. Does nothing outside campaign mode (dev, ?level=, custom, shared, playtests).
   */
  autosave(): void {
    const base = this.campaign ? this.campaignSave : null;
    if (!base) return;
    const p = this.mapProgress;
    this.mapLastNode[p.position.page] = p.position.node;
    // In a stage tutorial that swapped in its own hero, the file keeps its own.
    const heroes = this.tutorialRun?.heroes;
    const state = heroes ? { ...this.state, ...heroes } : this.state;
    const save: SaveFile = {
      ...saveFromState(base, state),
      cleared: p.cleared.slice(),
      pages: p.pages.slice(),
      secrets: p.secrets.slice(),
      position: { page: p.position.page, node: p.position.node },
      gameCleared: p.gameCleared === true,
      lastNode: { ...this.mapLastNode },
      pendingReveal: this.pendingReveal.slice(),
      devUnlockAll: this.devUnlockAll,
      devAllHeroes: this.devAllHeroes,
      devGateOpen: this.devGateOpen,
      freed: this.freed.slice(),
      tutorials: this.tutorials.slice(),
      met: this.met.slice(),
      inventoryUnlocked: this.inventoryUnlocked,
      bonusOpen: this.bonusOpen,
      bonusGuard: this.bonusGuard,
      ...bonusSaveFields(this.bonus),
      heroKits: this.savedHeroKits(state),
      story: this.story.slice(),
      explained: this.explained.slice(),
    };
    this.campaignSave = save;
    this.writeFile(save);
  }

  /** Writes the open file to its slot, unless it is a dev scratch file (openScratchFile). */
  private writeFile(save: SaveFile): void {
    if (this.campaign?.scratch) return;
    writeSave(save);
  }

  /**
   * Dev > Campaign (O-05): `save` (a copy of a file), or a new file with every world and hero
   * open, played as a scratch file: it plays as the campaign does, but nothing is ever written to
   * a save slot and no backup card asks. Dev mode only.
   */
  openScratchFile(save?: SaveFile): void {
    if (!this.devMode) return;
    const file = save
      ? structuredClone(save)
      : { ...newSave(1, FIRST_HERO, null, this.deps.characters), devUnlockAll: true, devAllHeroes: true };
    this.openFile(file.slot, file, false, true);
  }

  /**
   * Campaign: back to the map from a level (a clear, "Quit to map", or a continue). Saves the
   * file first (with `reveal` pending), then shows the page the hero stands on, which draws in
   * its share of what is pending (another world's share waits until the hero gets there).
   */
  returnToMap(reveal: string[] = [], opts: WorldMapOptions = {}): void {
    this.addReveal(reveal);
    this.state.checkpoint = null;
    this.state.time = null;
    this.deps.ctx.audio.stopMusic();
    this.deps.ctx.audio.setTempoScale(1);
    this.endTutorial();
    this.autosave();
    this.showMap(this.mapProgress.position.page, opts);
  }

  /**
   * A stage tutorial is over (its clear, a skip, the map, the title): the file's own hero, if the
   * tutorial swapped in its own, comes back with its power, hit points and kit.
   */
  endTutorial(): void {
    // A tip holding the game ends with it (0.4.45).
    this.tips.release();
    const heroes = this.tutorialRun?.heroes;
    this.tutorialRun = null;
    if (!heroes) return;
    const s = this.state;
    // The tutorial's hero puts their kit away again (decision 3); the file's hero comes back.
    if (this.campaign && s.character !== heroes.character) {
      this.heroKits[s.character.id] = { powerState: s.powerState, hp: s.hp, kit: { ...s.kit } };
      delete this.heroKits[heroes.character.id];
      swapInventory(this.bonus, heroes.character.id);
    }
    s.character = heroes.character;
    s.powerState = heroes.powerState;
    s.hp = heroes.hp;
    s.kit = { ...heroes.kit };
  }

  /** Queue map ids to draw in (each page takes its own when shown). */
  addReveal(ids: readonly string[]): void {
    for (const id of ids) if (!this.pendingReveal.includes(id)) this.pendingReveal.push(id);
  }

  /**
   * A level's exit (flagpole or castle) reached: in campaign mode the clear is recorded (a
   * sub-area counts for its main level), what it opens is drawn in on the map, and the run
   * (lives, score, coins, power) carries on. Does nothing outside campaign mode.
   */
  levelCleared(levelId: string): void {
    if (!this.campaign) return;
    this.returnToMap(this.recordClear(levelId));
  }

  /**
   * Records a campaign clear on the map (rules.clearLevel; the revealIds it opens) and notes a
   * castle's first clear for the backup card (backupDue): a castle cleared before never asks again.
   */
  private recordClear(levelId: string): string[] {
    const main = mainLevel(levelId, this.deps.getLevel);
    if (this.campaign && isCastle(main) && !this.mapProgress.cleared.includes(main)) this.backupDue = main;
    return clearLevel(this.mapProgress, levelId, this.deps.getLevel, this.rulePages);
  }

  /**
   * The map is the player's again (WorldMapScene, idle): after a castle's first clear, the
   * "BACK UP YOUR GAME?" card, once, while Options > Save files > Backup reminders is on (a game
   * without settings, the headless sims, has none). True when the card opened.
   */
  offerBackup(): boolean {
    const castle = this.backupDue;
    if (castle === null) return false;
    this.backupDue = null;
    if (
      !this.campaign ||
      this.campaign.scratch ||
      this.mapUnlockAll ||
      this.deps.settings?.backupReminders !== true
    )
      return false;
    this.scenes.push(new BackupCardScene(this, this.campaign.slot));
    return true;
  }

  /**
   * The title is up: a resume link's code (`#save=`) asks which file to load it into (never
   * replacing one without YES). However it is answered, the link leaves the address (a reload
   * doesn't ask again); a file loaded opens the file select on it. True when it asked.
   */
  offerSaveLink(): boolean {
    const code = this.saveLink;
    if (code === null) return false;
    this.saveLink = null;
    // 0.5.0 (G-101): the campaign is closed outside dev mode. The card says so, and the link stays
    // in the address (nothing is loaded or cleared), so it still works once Chapter 1 is out.
    if (!this.campaignOpen) {
      showChapter1Gate(this, CHAPTER1_LINK_CARD);
      return true;
    }
    this.scenes.push(
      new LoadCodeScene(this, readSaveCode(code, 1), {
        done: (slot) => {
          this.deps.clearSaveLink?.();
          if (slot === null) {
            this.scenes.pop();
            return;
          }
          this.scenes.clear();
          this.scenes.push(new FileSelectScene(this, slot));
        },
      }),
    );
    return true;
  }

  /**
   * A warp pipe into `world`: in campaign mode it opens that world only (skipped ones stay
   * closed) and the hero's map place moves to its start, so a quit or game over before the
   * target level is cleared comes back to that page. Play goes on into the level as before.
   */
  campaignWarp(page: PageId): void {
    if (!this.campaign) return;
    const pos = this.mapProgress.position;
    this.mapLastNode[pos.page] = pos.node; // map travel back returns here
    this.addReveal(warpTo(this.mapProgress, page, this.rulePages));
    const start = mapPage(page)?.nodes.find((n) => n.kind === 'start');
    if (start) this.mapProgress.position = { page, node: start.id };
    this.autosave();
  }

  /** The map page a level (or one of its sub-areas) sits on, by the level → page lookup. */
  pageOfLevel(levelId: string): PageId | null {
    return findLevelNode(mainLevel(levelId, this.deps.getLevel))?.page.id ?? null;
  }

  /**
   * Campaign: a warp pipe from page `from` into page `to` (owner decision, 2026-10-05): the
   * level ends on the map, which opens the target page (campaignWarp), slides over to it and
   * draws it in; the player picks the level there (character select and the WORLD card follow).
   * The level warped from is not cleared, and its checkpoint is gone.
   */
  campaignWarpToMap(from: PageId, to: PageId): void {
    this.campaignWarp(to);
    this.returnToMap([], { slideFrom: from });
  }

  /**
   * Campaign: a secret pipe (a warp zone with `secret`, see level/campaign.ts) taken in level
   * `levelId`: a secret exit, Super Mario World style (rules.secretExit). The secret is recorded
   * and back on the map only the road tied to it is drawn in (the 1-2 pipe: the road from 1-2 to
   * World 1's warp spot). The level does not count as cleared: its normal roads (1-2 to 1-3) open
   * with its normal exit.
   */
  campaignSecret(secret: string, levelId: string): void {
    if (!this.campaign) return;
    this.returnToMap(secretExit(this.mapProgress, levelId, secret, this.deps.getLevel, this.rulePages));
  }

  /**
   * Campaign: the Moblin's secret in 2-1's hidden cave (0.4.10, owner design; the cave is reached
   * only by jumping over 2-1's flagpole without touching it): a secret exit like any other
   * (rules.secretExit): `secret` is found and only its road, to World 2's hidden bonus spot (the
   * Top Secret Area), draws in. 2-1 does not count as cleared (0.4.35, owner: a secret exit
   * never opens the normal road; 2-2 waits for the flagpole).
   */
  campaignTopSecret(secret: string, levelId: string): void {
    if (!this.campaign) return;
    this.returnToMap(secretExit(this.mapProgress, levelId, secret, this.deps.getLevel, this.rulePages));
  }

  /**
   * Campaign: Larry Koopa's crystal ball taken (4-2's airship, after its card): a secret exit of
   * 4-2 (rules.secretExit, key CRYSTAL_BALL), so only the road to World 4's bonus spot is drawn in
   * and 4-2 is not cleared. From now on the map shows every hero not freed yet (map/captives.ts),
   * and the item inventory is unlocked. Saved on the way back to the map.
   */
  takeCrystalBall(levelId: string): void {
    if (!this.campaign) return;
    this.inventoryUnlocked = true;
    // The first time only: World 4's map plays the airship's crash before the road draws in.
    if (!this.mapProgress.secrets.includes(CRYSTAL_BALL)) this.mapCutscene = 'airship-crash';
    this.returnToMap(secretExit(this.mapProgress, levelId, CRYSTAL_BALL, this.deps.getLevel, this.rulePages));
  }

  /**
   * JUMP on the open bonus node: the bonus game's scene over the map (map/bonus-spot.ts). Played,
   * it closes (bonusUsed: spent, the Hammer Bro out after the next level); either way back to the
   * map on the node.
   */
  openBonus(spot: BonusSpot): void {
    if (!this.bonusOpen) return;
    let finished = false;
    const done = (outcome: BonusOutcome) => {
      if (finished) return;
      finished = true;
      if (outcome === 'used') this.bonusUsed();
      this.returnToMap();
    };
    this.deps.ctx.audio.stopMusic();
    this.scenes.push(bonusGame().create(this, spot, done));
  }

  /**
   * The bonus was played: closed until its Hammer Bro is beaten; saved at once. Safe to call again
   * (the SMB3 bonus games call it at the first choice, and the end calls it once more).
   */
  bonusUsed(): void {
    this.bonusOpen = false;
    this.bonusGuard = false;
    this.autosave();
  }

  /**
   * A level entered from the map: a used bonus spot's Hammer Bro comes out, there when the map
   * comes back whatever the result (saved by the caller).
   */
  private guardBonus(): void {
    if (!this.bonusOpen) this.bonusGuard = true;
  }

  /**
   * The hero walked into the map's Hammer Bro: the one-screen Hammer Bro battle (scenes/hammer-battle.ts)
   * with the run as it is. The hero's map place stays the node it last stood on.
   */
  startHammerBattle(): void {
    this.deps.ctx.audio.stopMusic();
    this.autosave();
    // Its HUD names the bonus road's level (internal 4-2) by its campaign label on a campaign file.
    this.state.campaignOrder = this.campaign !== null;
    this.scenes.clear();
    this.scenes.push(new HammerBattleScene(this));
  }

  /** The Hammer Bros are beaten: the bonus opens again, back to the map (saved). */
  hammerBattleWon(): void {
    this.bonusOpen = true;
    this.bonusGuard = false;
    this.returnToMap();
  }

  /**
   * The hero fell in the Hammer Bro battle: a life lost (SMB3), power back to the start as after
   * any death, then the map (the Hammer Bro still there), or GAME OVER with no lives left.
   */
  hammerBattleLost(): void {
    this.resetAfterDeath();
    const s = this.state;
    if (!this.deps.ctx.assist.infiniteLives) s.lives--;
    if (s.lives <= 0) {
      s.lives = 0;
      this.gameOver(null);
      return;
    }
    this.returnToMap();
  }

  /**
   * A warp outside campaign mode (?level=, dev, shared and custom levels, the Lost Levels): as in
   * the original, where a pipe to another level sets levelIDToLoad and ScreenManager.loadNewLevel
   * sets newLev, so createLevel shows CharacterSelect, then the pre-level card and the level.
   * Keeping the hero keeps its power (a different one starts from its default); in co-op player
   * two picks next.
   */
  warpToLevel(levelId: string, start: LevelStart, pipe = true): void {
    // v0.4.73: a replayed level left by a warp pipe (a warp zone) is over, as a clear is.
    if (this.replayRun) return this.replayCleared();
    const s = this.state;
    const go = () => this.goToLevel(levelId, start);
    this.selectLevel = levelId;
    // G-008: the next level is the run's place from here, as the original's file holds the level
    // just reached (StatManager's current level moves on at the clear); quitting from the select
    // between levels resumes there.
    if (this.keepsResume) this.keepResume(levelId);
    // Survival: a warp pipe to another level allows revival (EventManager.levelTransfer calls
    // StatManager.warpPipeHandler); a cleared level's exit does not (levelExitTo).
    if (pipe && this.survival) this.survival.reviveAllowed = true;
    // Classic mode's Game mode may skip the select screen (classicHeroChoice); one player.
    if (this.classicRun) {
      const choice = this.classicHeroChoice(false);
      if (choice === 'keep') return go();
      if (choice === 'random') {
        const c = this.singleRandomHero();
        if (c !== s.character) this.setHero(0, c);
        return go();
      }
    }
    const pick = (player: 0 | 1, then: () => void) => {
      const current = player === 1 ? (s.character2 as CharacterDef) : s.character;
      return new CharacterSelectScene(this, {
        player,
        current,
        onPick: (c) => {
          this.heroChosen = true;
          if (c !== current) this.setHero(player, c);
          then();
        },
        ...(this.classicRun ? { random: true } : {}),
        ...this.classicQuitPick(),
      });
    };
    this.deps.ctx.audio.stopMusic();
    this.scenes.clear();
    this.scenes.push(
      pick(0, () => {
        if (!s.character2) return go();
        this.scenes.pop();
        this.scenes.push(pick(1, go));
      }),
    );
  }

  /**
   * A cleared level's exit to the next level outside the campaign (the flagpole or castle's
   * `next`, the crystal ball's, the Moblin's). A Classic mode run goes through character select
   * first, as the original's default All Characters mode does: Level.completeLevel (Level.as
   * 1951-1956, 3470-3486) loads the next LevelID through ScreenManager.loadNewLevel, which sets
   * newLev (581-588), and createLevel shows CharacterSelect for it (290-318). The pick is the
   * warp's (warpToLevel): the same hero keeps its power. Every other run goes straight on.
   * `cleared` is the level just beaten: in Survival a castle allows revival
   * (EventManager.beatLevel → StatManager.beatLevelHandler).
   */
  levelExitTo(levelId: string, cleared?: { world: number; stage: number }): void {
    // v0.4.73 (owner C, 48A): a replayed level's clear goes back to its world's level box.
    if (this.replayRun) return this.replayCleared();
    if (cleared) this.survival?.levelCleared(cleared.world, cleared.stage);
    if (this.classicRun && this.campaign === null) return this.warpToLevel(levelId, { mode: 'stand' }, false);
    this.goToLevel(levelId, { mode: 'stand' });
  }

  /**
   * How a Classic mode run treats level `levelId`'s castle marked `next=end` (World.classicEnd,
   * G-001/G-002): an ordinary castle on to the next world's first area, or, at its map set's last
   * world (SMB 8-4, Lost Levels D-4), the end of the game (`next` null). Null outside a Classic
   * mode run, where the Lost Levels' castles keep the NES rules (showLostEnding).
   */
  classicCastle(levelId: string): { next: string | null } | null {
    if (!this.classicRun || this.campaign !== null) return null;
    const next = classicNextWorld(levelId);
    return { next: next ? this.firstArea(next) : null };
  }

  /**
   * The area a level restarts in without a checkpoint: its first area (Level.reloadLevel loads
   * area a, or b when a is an intro). Only Lost Levels 9-1 has a normal first area before its
   * main one: the converter names it `<main>-start` (convert-smbc.mjs entryId).
   */
  firstArea(levelId: string): string {
    const start = `${levelId}-start`;
    try {
      this.deps.getLevel(start);
      return start;
    } catch {
      return levelId;
    }
  }

  /**
   * Map menu "Worlds": show open page `id` with the hero on the node it last stood on there
   * (its start when never visited). Lets a player who warped ahead go back to worlds left
   * unfinished.
   */
  travelToPage(id: PageId): void {
    const p = this.mapProgress;
    const page = mapPage(id);
    const all = this.mapUnlockAll;
    if (!page || !isPageOpen(p, id, all)) return;
    const last = this.mapLastNode[id];
    const node =
      last && page.nodes.some((n) => n.id === last) && isOpen(p, page, last, all)
        ? last
        : (page.nodes.find((n) => n.kind === 'start')?.id ?? 'start');
    this.mapLastNode[p.position.page] = p.position.node;
    p.position = { page: id, node };
    this.deps.ctx.audio.stopMusic();
    this.showMap(id); // the map announces the page and node, and saves
  }

  /** Map menu "Save and quit": save the file, then the title. */
  saveAndQuit(): void {
    this.endTutorial();
    this.autosave();
    this.showTitle();
  }

  /**
   * Whether hero `def` is still a brainwashed captive on the campaign's file, so it cannot be
   * picked. Always false outside campaign mode (dev, ?level=, custom, shared, playtests), and
   * while the file's dev "All heroes" flag is on in dev mode (`freed` itself stays as it is).
   */
  heroLocked(def: CharacterDef): boolean {
    // A Classic-only extra (TG-42) can be picked only while the roster lists it; it has no
    // captive, so it is never added to `freed`.
    if (CLASSIC_EXTRAS.includes(def)) return !this.roster.includes(def);
    if (this.devMode && this.devAllHeroes) return false;
    return this.campaign !== null && !this.freed.includes(def.id);
  }

  /** A player whose hero is locked (the real roster is back) gives way to the first hero. */
  dropLockedHeroes(): void {
    if (this.heroLocked(this.state.character)) this.setHero(0, this.firstHero);
    const c2 = this.state.character2;
    if (c2 && this.heroLocked(c2)) this.setHero(1, this.firstHero);
  }

  /** Heroes still to be found on the campaign's file (0 outside campaign mode). */
  get heroesToFind(): number {
    return this.deps.characters.filter((c) => this.heroLocked(c)).length;
  }

  /** The hero every file starts with: the fallback for a locked current hero. */
  get firstHero(): CharacterDef {
    const chars = this.deps.characters;
    return chars.find((c) => c.id === FIRST_HERO) ?? (chars[0] as CharacterDef);
  }

  /**
   * Heroes freed this session whose trophy the world map has not shown yet: it greets each with
   * a burst of happy hops (map/trophy.ts), once.
   */
  readonly celebrate = new Set<string>();

  /** A mini game was passed: hero `id` joins the file's roster, saved at once. */
  freeHero(id: string): void {
    if (!this.freed.includes(id)) {
      this.freed.push(id);
      this.celebrate.add(id);
    }
    this.autosave();
  }

  /**
   * Campaign: the file has met `id` (a captive talked to, or 'larry' on boarding his airship): the
   * Mini Game Arena shows that game from now on. Saved at once the first time.
   */
  meet(id: string): void {
    if (!this.campaign || this.met.includes(id)) return;
    this.met.push(id);
    this.autosave();
  }

  /** The "<HERO> TRAINING?" question was answered (yes or no): never asked again; saved at once. */
  answerTraining(id: string): void {
    if (!this.tutorials.includes(id)) this.tutorials.push(id);
    this.autosave();
  }

  showCharacterSelect(): void {
    this.scenes.replace(new CharacterSelectScene(this));
  }

  get devMode(): boolean {
    return this.deps.settings?.dev ?? false;
  }

  /** The dev-mode lock: open unless a release build gave one (0.5.0). */
  get devLock(): DevLock {
    return this.deps.devLock ?? OPEN_DEV_LOCK;
  }

  /**
   * Whether the story campaign (Chapter 1) can be opened from the title or a resume link: only
   * with dev mode on until Chapter 1 ships (0.5.0, G-100; scenes/chapter1-gate.ts).
   */
  get campaignOpen(): boolean {
    return this.devMode;
  }

  /** The map rules' `unlockAll`: the file's "Unlock all" flag, only while dev mode is on. */
  get mapUnlockAll(): boolean {
    return this.devMode && this.devUnlockAll;
  }

  /** The Chapter 2 gate's dev lift: the file's "Chapter 2 gate: open" flag, only while dev mode is on. */
  get chapterGateOpen(): boolean {
    return this.devMode && this.devGateOpen;
  }

  /**
   * Whether campaign play may not enter `levelId` yet (rules.chapterGated: Chapter 2, the Lost
   * Kingdom, unless dev mode lifts the gate). Always false outside the campaign (dev select,
   * `?level=`, custom and shared levels, play-tests); arena rounds are never Lost levels.
   */
  chapterBlocked(levelId: string): boolean {
    return this.campaign !== null && chapterGated(levelId, this.chapterGateOpen);
  }

  /**
   * A campaign level start that reached Chapter 2 content without the map's gate (none should:
   * the map is the only way into a Lost level, rules.chapterGated): back to the map, where the
   * gate's card shows. The run's checkpoint and clock go, as for a quit to the map.
   */
  private chapterGateBack(): void {
    this.state.checkpoint = null;
    this.state.time = null;
    this.showMap();
    showChapterGate(this);
  }

  showDevMenu(): void {
    this.scenes.push(new DevMenuScene(this));
  }

  /**
   * Developer level select: any level, character and power state, with 99 lives. `seed` fixes the
   * level's world seed (tests); otherwise LevelScene picks it (GameDeps.freshSeeds). `opts.rules`
   * is the run's rules (default 'current'); the kit and power come from the def played under them.
   */
  devStart(
    levelId: string,
    character: CharacterDef,
    power: string,
    fullKit = false,
    seed?: number,
    opts: { rules?: Rules; classic?: boolean; difficulty?: MapDifficulty; mount?: 'none' | 'yoshi' } = {},
  ): void {
    const classic = opts.classic === true;
    // A Classic run has none of the campaign's rooms: the village and the stage tutorials (1-0)
    // start 1-1 instead.
    if (classic && !this.classicStartable(levelId)) levelId = '1-1';
    this.tutorialRun = null;
    this.campaign = null;
    this.runRules = opts.rules ?? 'current';
    this.classicRun = classic;
    this.classicDev = classic;
    this.linkRun = false;
    this.devFreePlay = !classic;
    // Items 63 / 64: only the START page's own starts go back to it (playDevPick: keepDevReturn).
    this.devBack = null;
    // 0.4.72 (owner item 6): the START page's Mount row; null leaves the Dev menu's toggle alone.
    this.devYoshi = opts.mount === 'yoshi' ? 'ride' : opts.mount === 'none' ? 'none' : null;
    // B-L: a dev start has no file and reads the old shared options.
    this.classicFile = null;
    this.runFileRules = null;
    this.practiceRun = false;
    this.fileContinues = 0;
    // BUG-06: a dev start is a new run; no hero keeps a kit from the run it left.
    this.classicKits = {};
    // O-05: the dev START page's Map difficulty (it plays under Classic rules: a Classic run, or
    // since 0.4.72 a free play start too).
    this.classicDifficulty = opts.difficulty ?? 'normal';
    const rules = this.liveRules;
    const hero = playedHero(this.ctx, character, rules);
    this.state = newGameState(character, null, rules);
    // BUG-10: a hero Toggle heroes swaps starts at the swapped design's power.
    this.state.powerState = defaultPower(hero);
    this.state.hp = startHp(hero);
    if (!classic) this.state.lives = 99;
    else this.classicStartLives();
    this.survivalWithoutSelect(classic, character);
    if (fullKit && hero.devKit) this.state.kit = hero.devKit();
    if (hero.damage.kind === 'powerup') this.state.powerState = power;
    else {
      const max = this.state.kit.maxHp ?? startHp(hero);
      this.state.hp = power === 'full' ? max : power === 'half' ? Math.max(1, Math.ceil(max / 2)) : 1;
    }
    this.playtestDone = null;
    this.pendingLevel = null;
    // Free play respawns straight away; a Classic run goes through character select.
    this.quickRespawn = !classic;
    this.backupDue = null;
    if (levelId === DEV_VILLAGE) {
      this.deps.ctx.audio.stopMusic();
      const scene = new TownScene(this, { first: false });
      this.town = { scene, used: new Set() };
      this.scenes.clear();
      this.scenes.push(scene);
      return;
    }
    this.goToLevel(levelId, seed === undefined ? { mode: 'stand' } : { mode: 'stand', seed });
  }

  openEditor(initial?: { level: LevelData; name: string }): void {
    this.playtestDone = null;
    this.deps.ctx.audio.stopMusic();
    this.scenes.clear();
    this.scenes.push(new EditorScene(this, initial));
  }

  /**
   * Menu of saved custom levels (title > Options, O-01), over Options: Back closes it; picking
   * one goes to character select, then the level.
   */
  showCustomLevels(back: () => void): void {
    const names = Object.keys(loadLibrary().levels).sort();
    const items = names.map((n) => ({
      label: n.slice(0, 14),
      select: () => {
        this.pendingLevel = customLevelId(n);
        this.scenes.clear();
        this.showCharacterSelect();
      },
    }));
    if (!items.length) items.push({ label: 'No levels yet', select: () => this.openEditor() });
    items.push({ label: 'Back', select: back });
    this.scenes.push(new MenuScene(this, 'CUSTOM LEVELS', items, back));
  }

  /** Run a level from the editor; returns to it when the level ends or the player quits. */
  playtest(level: LevelData, done: () => void): void {
    this.tutorialRun = null;
    this.runRules = 'current';
    this.state = newGameState(this.state.character);
    this.state.lives = 99;
    this.playtestDone = done;
    this.quickRespawn = true;
    this.campaign = null;
    this.endClassicRun();
    this.backupDue = null;
    this.startLevel(level, { mode: 'stand' });
  }

  /** Play a level decoded from a share link with the default character. */
  playShared(level: LevelData): void {
    this.tutorialRun = null;
    this.sharedLevel = level;
    this.runRules = 'current';
    this.state = newGameState(this.deps.characters[0] as CharacterDef);
    this.playtestDone = null;
    this.quickRespawn = false;
    this.campaign = null;
    this.endClassicRun();
    this.backupDue = null;
    this.startLevel(level, { mode: 'stand' });
  }

  /**
   * A non-campaign run from `levelId`. `opts.rules` sets the run's rules; left out, the run keeps
   * runRules as it stands (rules-toggle.test.ts relies on it; showTitle resets them to 'current',
   * and Classic paths pass theirs). Never a Classic run: it clears classicRun.
   */
  newGame(
    character: CharacterDef,
    levelId = '1-1',
    character2: CharacterDef | null = null,
    opts: { rules?: Rules } = {},
  ): void {
    this.startRun(character, levelId, character2, opts.rules, false, false);
  }

  /**
   * Classic mode (title > CLASSIC): a new game of `levelId` (SMB 1-1, or the Lost Levels' 1-1)
   * with no campaign file, playing Classic rules (classicRules). The original's flow from there:
   * character select before every new level (each clear: levelExitTo), after every death and
   * continue, warps through character select, and after SMB 8-4 the ending, the credits and the
   * Lost Levels. B-L: `file`, a new game straight into that file with those rules (the menus
   * set the file before the select instead: classicSelect); without it the run keeps the file and
   * rules its select set, if any.
   */
  classicGame(
    character: CharacterDef,
    levelId = '1-1',
    file?: { ref: ClassicFileRef; rules?: ClassicFileRules },
  ): void {
    // 31e: an empty file only, as startClassicFile: a used or unreadable one is emptied only
    // through ERASE FILE, never started over.
    if (file && this.classicFileState(file.ref) !== 'empty') return;
    this.pendingLevel = null;
    if (file) {
      this.classicFile = { set: file.ref.set, slot: file.ref.slot };
      this.runFileRules = copyFileRules(file.rules ?? originalFileRules());
      this.practiceRun = false;
      this.replay = null;
      this.runWorlds = [];
      this.fileContinues = 0;
      this.classicDifficulty = this.runFileRules.difficulty;
    }
    // One player: Classic mode has no co-op.
    this.startRun(character, levelId, null, this.classicRules, true, false);
  }

  /**
   * A `?level=` link's Classic run (main.ts): from that level with the URL's hero and rules, one
   * player (the village and the stage tutorials start 1-1 instead). `dev`: dev mode is on
   * (`?dev=1&mode=classic`), and the run counts for nothing (classicDev). With dev mode off (a
   * shared link on a release build) it counts as any Classic run does, as the original counts a
   * run that its Level Select started anywhere (LevelSelectMenu.as 115-131 only sets the map pack
   * and difficulty and creates the level; StatManager.beatGameHandler 506-529 asks nothing of
   * where the run began). It never
   * writes or clears a save file (RC-004, linkRun). B-L: a link run plays the original's rules
   * at Normal (no file's); a developer run reads the old shared options, as every dev start does.
   */
  devClassicGame(character: CharacterDef, levelId: string, rules: Rules, dev = true): void {
    this.pendingLevel = null;
    this.classicTutorials.newGame();
    this.classicFile = null;
    this.practiceRun = false;
    this.fileContinues = 0;
    this.runFileRules = dev ? null : originalFileRules();
    this.classicDifficulty = 'normal';
    const id = this.classicStartable(levelId) ? levelId : '1-1';
    this.startRun(character, id, null, rules, true, dev, true);
  }

  /**
   * BUG-06: each hero keeps his own power and kit across hero changes (Game.classicKits): a
   * Classic mode run under Classic rules, never the campaign.
   */
  get keepsHeroKits(): boolean {
    return this.classicRun && this.campaign === null && this.liveRules === 'classic';
  }

  /**
   * G-008, B-L: this run writes and empties its file (a Classic mode run with a file; never a
   * developer, link or practice run).
   */
  get keepsResume(): boolean {
    return (
      this.classicRun &&
      !this.classicDev &&
      !this.linkRun &&
      this.campaign === null &&
      this.classicFile !== null
    );
  }

  /**
   * Classic mode's cheats play now (FU-7e, scenes/cheats-menu.ts): a Classic run under Classic
   * rules. Never with a campaign file open, never under Current rules.
   */
  get cheatsLive(): boolean {
    return (
      this.classicRun &&
      this.campaign === null &&
      this.liveRules === 'classic' &&
      !!this.deps.settings?.classicCheats
    );
  }

  /**
   * The cheats in force (GameContext.classicCheats): each one on and, outside developer mode,
   * unlocked, so a locked cheat turned on from the dev pause stops with dev mode off. A live view
   * (made once): every read asks the settings again.
   */
  private readonly cheatsInForce: CheatFlags = Object.freeze(
    Object.defineProperties(
      {},
      Object.fromEntries(
        CLASSIC_CHEAT_IDS.map((id) => [
          id,
          {
            enumerable: true,
            get: () => {
              const c = this.deps.settings?.classicCheats;
              return !!c && c.on[id] && (this.devMode || c.unlocked[id]);
            },
          },
        ]),
      ),
    ),
  ) as CheatFlags;

  /**
   * Play counts toward the cheats' goals: a Classic run with Classic rules, not started from
   * developer mode. Cheats play only with Classic rules, so under Current rules nothing counts:
   * no kill, no clear, no game beaten, no continue.
   */
  get cheatGoalsCount(): boolean {
    return (
      this.classicRun &&
      this.campaign === null &&
      !this.classicDev &&
      !this.practiceRun &&
      this.liveRules === 'classic' &&
      !!this.deps.settings?.classicCheats
    );
  }

  /** One more of `stat` toward the cheats' goals (StatManager's num* setters); unlocks what it earns. */
  cheatTally(stat: ClassicCheatStat): void {
    const c = this.deps.settings?.classicCheats;
    if (!c || !this.cheatGoalsCount) return;
    addCheatStat(c, stat);
    const unlocked = unlockEarned(c);
    this.cheatsUnlocked(unlocked);
    // Saved in batches (per area, per clear: flushCheatStats), not on every kill; an unlock at once.
    this.cheatStatsDirty = true;
    if (unlocked.length) this.flushCheatStats();
  }

  /** Counts tallied since the last save (cheatTally), written by flushCheatStats. */
  private cheatStatsDirty = false;

  /**
   * Saves the cheats' counts if any changed since the last save: at each area's start
   * (startLevel), a clear (cheatEvent), a game over, the title, and when the page is hidden
   * (main.ts), so a run's kills are kept without a settings write per kill.
   */
  flushCheatStats(): void {
    if (!this.cheatStatsDirty) return;
    this.cheatStatsDirty = false;
    if (this.deps.settings) saveSettings(this.deps.settings);
  }

  /**
   * A Classic run cleared a level (`level`, `castle`) or beat a game (`beat`): the goals that ask
   * for it (Level.completeLevel, StatManager.beatGameHandler) unlock their cheats.
   */
  cheatEvent(ev: { level?: boolean; castle?: boolean; beat?: MapSetId }): void {
    const s = this.deps.settings;
    if (!s || !this.cheatGoalsCount) return;
    const c = s.classicCheats;
    const e: CheatEvent = { level: ev.level === true, castle: ev.castle === true };
    if (ev.beat) {
      c.beaten[ev.beat] = true;
      // B-L: the file's own count (StatManager.numContinuesUsed is the file's, owner): a run
      // with no file (a link run) never earns it.
      e.noContinue = this.classicFile !== null && this.fileContinues === 0;
    }
    this.cheatsUnlocked(unlockEarned(c, e));
    this.cheatStatsDirty = false;
    saveSettings(s);
  }

  private cheatsUnlocked(ids: readonly ClassicCheatId[]): void {
    for (const id of ids) if (!this.cheatUnlocks.includes(id)) this.cheatUnlocks.push(id);
  }

  /**
   * A cheat unlocked mid-level (a count reached: Cheats.unlockCheat's message boxes at the end of
   * the game loop): its YOU UNLOCKED card over the frozen level, read out, gone on with OK; one
   * card per cheat. Unlocks from a clear or a game beaten are told on the select screen that
   * follows instead (CharacterSelectScene), which already waits for a press.
   */
  showCheatUnlocks(world: World): void {
    const id = this.cheatUnlocks.shift();
    if (!id) return;
    // Tutorials (O-15): the cheat box follows the cards once (Cheats.as).
    this.classicTutorials.cheatUnlocked();
    this.deps.ctx.audio.sfx('1up');
    this.deps.announcer?.say(`You unlocked the ${cheatInfo(id).name} cheat! OK to continue.`);
    this.scenes.push(
      new CardScene(
        this,
        unlockedLines(id),
        () => {
          this.scenes.pop();
          this.showCheatUnlocks(world);
        },
        world,
        { panel: true, keys: ['start', 'attack', 'jump'], prompt: abilityHint(this, 'OK', 'jump') },
      ),
    );
  }

  /**
   * The rules a Classic mode run plays (the menu flow, Continue, its guides and options). Every
   * read of the old setting went through here, so this is the one place it is ignored.
   */
  get classicRules(): Rules {
    // BUG-11: always Classic rules. The old Rules row is gone; a saved settings.classicRules is
    // ignored and never rewritten. Dev > Toggle heroes' Plays as gives one hero its Campaign
    // design instead (heroSwaps); the dev START page's Rules row still starts a Campaign-rules run.
    return 'classic';
  }

  private startRun(
    character: CharacterDef,
    levelId: string,
    character2: CharacterDef | null,
    rules: Rules | undefined,
    classic: boolean,
    dev: boolean,
    link = false,
  ): void {
    this.tutorialRun = null;
    this.campaign = null;
    if (rules) this.runRules = rules;
    this.classicRun = classic;
    this.classicDev = classic && dev;
    this.linkRun = classic && link;
    this.devFreePlay = false;
    this.devYoshi = null;
    // BUG-06: a new game resets every hero (StatManager.startNewGameHandler → resetAllStats).
    this.classicKits = {};
    // A hero that was its own slot before (a save or a link naming a skin): its slot keeps that look;
    // a hero the select does not offer now plays as its first slot's hero.
    if (classic) character = this.restoreSlotHero(character);
    // Survival: the run goes on with the lives its first select's revivals left (classicSelect).
    const paid = classic && this.survival ? this.state.lives : null;
    const rulesNow = this.liveRules;
    this.state = newGameState(character, character2, rulesNow);
    // BUG-10: each hero starts at the power of the design it plays (Toggle heroes' Plays as), as a
    // dev start does, so reconcileRules finds nothing to reset on a brand-new run.
    const hero = playedHero(this.ctx, character, rulesNow);
    this.state.powerState = defaultPower(hero);
    this.state.hp = startHp(hero);
    if (character2) {
      const hero2 = playedHero(this.ctx, character2, rulesNow);
      this.state.powerState2 = defaultPower(hero2);
      this.state.hp2 = startHp(hero2);
    }
    if (classic) this.classicStartLives();
    if (paid !== null) this.state.lives = paid;
    else this.survivalWithoutSelect(classic, character);
    this.playtestDone = null;
    this.quickRespawn = false;
    this.backupDue = null;
    const id = this.pendingLevel ?? levelId;
    this.pendingLevel = null;
    this.goToLevel(id, { mode: 'stand' });
  }

  /** Any Classic mode run is over (the title, and every other start); runRules are reset by each. */
  private endClassicRun(): void {
    // Tutorials (O-15): no box queued in the run left behind shows in the next one.
    this.classicTutorials.clearQueue();
    this.classicRun = false;
    this.classicFlow = false;
    this.classicDev = false;
    this.linkRun = false;
    this.devFreePlay = false;
    this.devYoshi = null;
    this.survival = null;
    this.sayFirst = null;
    this.classicKits = {};
    // B-L: the run's file and rules go with it.
    this.classicFile = null;
    this.playedFile = null;
    this.runFileRules = null;
    this.fileContinues = 0;
    this.practiceRun = false;
    this.replay = null;
    this.clearedNews = null;
  }

  /**
   * Whether a dev Classic run may start at `levelId`: not the village (Kakariko) or a stage
   * tutorial (1-0), which are the campaign's.
   */
  private classicStartable(levelId: string): boolean {
    if (levelId === DEV_VILLAGE || stageTutorial(levelId)) return false;
    try {
      return !levelTutorial(this.deps.getLevel(levelId));
    } catch {
      return true;
    }
  }

  /**
   * G-008, B-L: writes the run's file (classicFile) for the WORLD card of `levelId`, with its
   * rules and continues. `continued`: written by a game over at its continue point (BUG-05):
   * going on from it counts as a continue used. A run that went into another map set stays in
   * its own file.
   */
  private keepResume(levelId: string, continued = false): void {
    const ref = this.classicFile;
    if (!ref) return;
    const r = this.runNow(levelId, ref);
    saveClassicFile({
      ...ref,
      rules: this.classicRunRules,
      continues: this.fileContinues,
      tutorialsSeen: this.classicTutorials.seen,
      run: continued ? { ...r, continued: true } : r,
    });
  }

  /** The run as its file keeps it at the WORLD card of `levelId` (keepResume, clearFile). */
  private runNow(levelId: string, ref: ClassicFileRef): ClassicResume {
    const sv = this.survival;
    const survival = sv
      ? {
          fallen: this.heroSlots.map((c) => c.id).filter((id) => sv.isFallen(id)),
          reviveAllowed: sv.reviveAllowed,
        }
      : undefined;
    const r = resumeOf(
      levelId,
      this.state,
      this.liveRules,
      survival,
      // BUG-06: the other heroes' power and kit, as the original's file keeps every hero's
      // (StatManager.prepareLoadSaveStats 610-643).
      // None kept: no field (as a slot from before BUG-06 reads).
      this.keepsHeroKits && Object.keys(this.classicKits).length > 0 ? this.classicKits : undefined,
    );
    // The level's own world and stage (before its WORLD card the state still holds the last one's).
    try {
      const lv = this.deps.getLevel(levelId);
      r.world = lv.world;
      r.stage = lv.stage;
    } catch {
      /* a level that does not load: kept as the state has it */
    }
    // 0.4.72: a hero only dev mode's select offers marks the run (fileProblem 'not-released').
    // A mark the file has is never dropped (a later write by another hero keeps it).
    if (this.devOnlyHero(this.state.character) || loadClassicFile(ref)?.run.devHero === true)
      r.devHero = true;
    // v0.4.73: the worlds reached (its CLEARED file's replay offers Lost World 9 and A-D by them).
    if (!this.runWorlds.includes(r.world)) this.runWorlds.push(r.world);
    r.worlds = [...this.runWorlds];
    return r;
  }

  /**
   * v0.4.73 (owner 46B, 47A): the set is beaten (its ending, before the credits): the run's file
   * is kept as CLEARED, with the run as it is now (score, lives, hero), once. A file CLEARED
   * already (another tab's run) stays as it was; storage refusing the write leaves the file's
   * last run in it (nothing lost), and the message after the credits says it was not saved.
   */
  private clearFile(from: string): void {
    const ref = this.classicFile;
    if (!ref) return;
    let main = from;
    try {
      main = this.deps.getLevel(from).parent ?? from;
    } catch {
      /* kept as given */
    }
    const ok = saveClearedFile({
      ...ref,
      rules: this.classicRunRules,
      continues: this.fileContinues,
      tutorialsSeen: this.classicTutorials.seen,
      run: this.runNow(main, ref),
    });
    this.clearedNews = { ref: { ...ref }, saved: ok || loadClearedFile(ref) !== null };
  }

  /**
   * v0.4.73 (owner B): after the credits and the cheat cards of a beaten set: that set's file box
   * on the CLEARED file, with the message box over it (read out, waiting for OK). A run with no
   * file to clear (a link run) goes to the title as before.
   */
  private afterClassicBeat(): void {
    const news = this.clearedNews;
    this.clearedNews = null;
    if (!news) return this.showTitle();
    this.deps.ctx.audio.stopMusic();
    const files = this.showClassicFiles(news.ref.set, news.ref.slot);
    this.scenes.push(clearedNote(this, files, news.ref, news.saved));
  }

  /**
   * B-L: the Tutorials boxes seen this game go into the run's file at once (TutorialManager
   * saves them with the original's file); a run with no file keeps them in memory only. Before
   * the file's first WORLD card there is nothing to write; that card writes them with the run.
   */
  keepTutorialsSeen(seen: readonly string[]): void {
    const ref = this.classicFile;
    if (!ref || !this.keepsResume) return;
    const f = loadClassicFile(ref);
    if (f) saveClassicFile({ ...f, tutorialsSeen: seen });
  }

  /**
   * The rules a kept run goes on under: its own in developer mode; outside it Classic rules, the
   * only ones a release Classic run plays (O-12: a slot saved under Current rules too).
   */
  private resumeRules(r: ClassicResume): Rules {
    return this.devMode ? r.rules : 'classic';
  }

  /** The map set the Classic run's file belongs to, for the CLASSIC menu's focus on leaving it. */
  get runSet(): MapSetId | undefined {
    if (this.classicFile) return this.classicFile.set;
    // 36a: a run with no file (a practice run): the set of the level
    // it is playing (its main level's, for a sub-area), else of the level its select was for.
    const scene = this.scenes.find((s) => s instanceof LevelScene) as LevelScene | undefined;
    // 38d: with no level on the stack (MAIN MENU after a game over), the level the run last
    // played: a `?level=` link run has no select level, and it played its link's set.
    const id = scene ? (scene.level.parent ?? scene.level.id) : (this.runLevel ?? this.selectLevel);
    return id ? mapSetOf(id).id : undefined;
  }

  /** 38d: the main level of the last level any run went to (goToLevel), for runSet. */
  private runLevel: string | null = null;

  /**
   * 38e: the file of the Classic run that was just left for the CLASSIC menu (Quit, or MAIN MENU
   * after its game over); any other way out of a run (the title) forgets it.
   */
  private playedFile: ClassicFileRef | null = null;

  /** 38e: the slot of set `set` the last Classic run played in, for its file box's focus. */
  playedSlot(set: MapSetId): ClassicFileSlot | undefined {
    const f = this.classicFile ?? this.playedFile;
    return f?.set === set ? f.slot : undefined;
  }

  /** G-008, B-L: the run is over (its credits, or a game over with nowhere to go on): its file is empty. */
  private dropResume(): void {
    const ref = this.classicFile;
    // v0.4.73 (47A): a CLEARED file (another tab's clear) is never emptied by a run.
    if (ref && !classicFileKept(ref)) eraseClassicFile(ref);
  }

  /**
   * B-L: the old Classic saves move into files (original-files.ts migrateClassicFiles), with
   * the shared options as they are for the rules a slot did not keep. Safe at every read.
   */
  private migrateClassicFiles(): void {
    const s = this.deps.settings;
    // Read only when an old slot is there to migrate (the retired shared count with it, B-L).
    migrateClassicFiles(() => ({
      classic: s?.classic ?? originalFileRules().options,
      ...(s?.classicHeroesOff ? { heroesOff: s.classicHeroesOff } : {}),
      difficulty: s?.classicMapDifficulty ?? 'normal',
      continuesUsed: s?.classicCheats.continuesUsed ?? 0,
      ...(s?.classicTutorialsSeen ? { tutorialsSeen: s.classicTutorialsSeen } : {}),
    }));
  }

  /**
   * B-L: map set `set`'s three files, in slot order: null for one not in use (empty, or kept but
   * unreadable: classicFileState tells them apart).
   */
  classicFiles(set: MapSetId): (ClassicFile | null)[] {
    this.migrateClassicFiles();
    return listClassicFiles(set).map((f) => (f && this.playable(f) ? f : null));
  }

  /**
   * B-L: whether file `ref` is empty, used (and plays), unplayable (31d: it reads, but its hero
   * or level is not there now: classicFileProblem says which) or kept but unreadable (broken).
   * Only an empty file is ever treated as empty, so a new game never overwrites the others;
   * ERASE FILE empties them.
   */
  classicFileState(ref: ClassicFileRef): 'empty' | 'used' | 'cleared' | 'unplayable' | 'unreadable' {
    if (this.classicFileAt(ref)) return 'used';
    // v0.4.73 (owner 46B): its set was beaten in it; only ERASE FILE empties it.
    if (this.classicClearedAt(ref)) return 'cleared';
    if (loadClassicFile(ref)) return 'unplayable';
    return hasClassicFile(ref) ? 'unreadable' : 'empty';
  }

  /**
   * v0.4.73: file `ref` when it is CLEARED (whatever its hero: the replay's select offers the
   * heroes its rules do), else null.
   */
  classicClearedAt(ref: ClassicFileRef): ClearedFile | null {
    this.migrateClassicFiles();
    return loadClearedFile(ref);
  }

  /** B-L: file `ref` when it is used and still plays, else null. */
  classicFileAt(ref: ClassicFileRef): ClassicFile | null {
    this.migrateClassicFiles();
    const f = loadClassicFile(ref);
    return f && this.playable(f) ? f : null;
  }

  /**
   * 31d: why readable file `ref` cannot play now: its hero is off in Dev > Toggle heroes
   * ('hero-off'), its hero is not one this version has ('hero'), or its level does not load
   * ('level'). 0.4.72: its run was played in dev mode by a hero only dev mode offers (devHero)
   * and dev mode is off now ('not-released'); 0.4.73 item 40: so is any run of an unreleased
   * Expansion hero, marked or not. Null when it plays, or when there is no readable
   * file there.
   */
  classicFileProblem(ref: ClassicFileRef): FileProblem | null {
    this.migrateClassicFiles();
    const f = loadClassicFile(ref);
    return f ? this.fileProblem(f) : null;
  }

  private fileProblem(f: ClassicFile): FileProblem | null {
    const r = f.run;
    try {
      this.deps.getLevel(r.levelId);
    } catch {
      return 'level';
    }
    const rules = this.resumeRules(r);
    const hero = this.rosterFor(rules).find((c) => c.id === r.hero);
    if (hero) {
      // 0.4.72: a marked run (devHero) waits for a select that offers its hero (dev mode's).
      // 0.4.73 item 40: so does an unmarked one whose hero is an unreleased Expansion hero (a
      // file saved by v0.4.71 or earlier), never played as another hero or rewritten. Only a
      // hero that is neither offered nor an Expansion hero plays as the first slot's (P1).
      const waits = r.devHero === true || this.devOnlyHero(hero);
      if (waits && !this.devSlotsFor(rules).includes(this.slotOf(hero))) return 'not-released';
      return null;
    }
    const off = CLASSIC_EXTRAS.find((d) => d.id === r.hero && !this.classicHeroOn(d));
    return off ? 'hero-off' : 'hero';
  }

  /** A file's run still plays: its hero is offered and its level loads. */
  private playable(f: ClassicFile): boolean {
    return this.fileProblem(f) === null;
  }

  /**
   * B-L: a new game on empty file `ref` with `rules` (its rules box's START): the select, then
   * its set's first level. The file is written at the first WORLD card; until then it stays
   * empty, and BACK from the select (`back`) goes back to the rules box.
   */
  startClassicFile(ref: ClassicFileRef, rules: ClassicFileRules, back: () => void): void {
    // An empty file only: a used or unreadable one is emptied only through ERASE FILE.
    if (this.classicFileState(ref) !== 'empty') return;
    const set = MAP_SETS.find((m) => m.id === ref.set) ?? (MAP_SETS[0] as (typeof MAP_SETS)[number]);
    this.classicSelect(set.start, back, { file: ref, rules: copyFileRules(rules) });
  }

  /**
   * CLASSIC > a used file (G-008, B-L): its run goes on from the WORLD card of the level it was
   * in, with its lives, score, coins, hero, power and kit, under its own rules, on its own Map
   * Difficulty and Game mode, with its own continues. Nothing is written into the settings.
   */
  resumeClassic(ref: ClassicFileRef): boolean {
    this.classicTutorials.clearQueue();
    const f = this.classicFileAt(ref);
    // The boxes this file's game has seen come back with it (TutorialManager.loadData).
    if (f) this.classicTutorials.restore(f.tutorialsSeen);
    const r = f?.run;
    const rules = r ? this.resumeRules(r) : 'classic';
    const hero = r ? this.rosterFor(rules).find((c) => c.id === r.hero) : undefined;
    if (!f || !r || !hero) return false;
    this.runFileRules = copyFileRules(f.rules);
    this.classicDifficulty = f.rules.difficulty;
    this.classicFile = { set: ref.set, slot: ref.slot };
    this.fileContinues = f.continues;
    this.practiceRun = false;
    this.replay = null;
    this.runWorlds = [...(r.worlds ?? [])];
    this.tutorialRun = null;
    this.campaign = null;
    this.runRules = rules;
    this.classicRun = true;
    this.classicDev = false;
    this.linkRun = false;
    this.devFreePlay = false;
    this.devYoshi = null;
    this.pickedRandom = false;
    this.pickRng = new Rng(this.deps.freshSeeds === true ? freshSeed() : RANDOM_PICK_SEED);
    // A look plays on as that look, remembered as its slot's (Peach as Luigi's look, #179).
    const played = this.restoreSlotHero(hero);
    this.state = newGameState(played, null, this.liveRules);
    const s = this.state;
    s.score = r.score;
    s.coins = r.coins;
    s.lives = r.lives;
    s.world = r.world;
    s.stage = r.stage;
    // O-12: a run kept under Current rules goes on under Classic rules outside developer mode,
    // with its level, lives, score and coins; its power and kit (Current's) start afresh.
    // BUG-06: the other heroes' kits come back with it (a slot without them: every hero afresh).
    this.classicKits = {};
    // A hero no select offers now plays as the first slot's (restoreSlotHero): that hero starts
    // at his own default, not with the saved hero's power and kit. Item 40: only a hero that is no
    // Expansion hero gets here from a file (one its own Disable heroes left out, P1); an
    // unreleased Expansion hero's file is NOT RELEASED (fileProblem).
    const unoffered = this.slotOf(played) !== this.slotOf(hero);
    if (rules === r.rules) {
      if (!unoffered) {
        s.powerState = r.powerState;
        s.hp = r.hp;
        s.kit = { ...r.kit };
        // Item 25: earned in a swapped design (the level start resets it if that no longer plays).
        if (r.swapped) s.swapped = true;
      }
      if (r.heroKits) this.classicKits = structuredClone(r.heroKits);
    }
    s.warped = r.warped;
    s.checkpoint = r.checkpoint;
    this.survival = null;
    if (r.survival && this.survivalMode) {
      const sv = this.newSurvival();
      // A fallen look is its slot's hero (an older run kept Peach by her own id: Luigi's slot).
      const roster = this.rosterFor(rules);
      const fallen = r.survival.fallen.map((id) => {
        const d = roster.find((c) => c.id === id);
        return d ? this.slotOf(d).id : id;
      });
      for (const c of this.heroSlots) if (!fallen.includes(c.id)) sv.revive(c.id);
      sv.reviveAllowed = r.survival.reviveAllowed;
      this.survival = sv;
    }
    this.playtestDone = null;
    this.quickRespawn = false;
    this.backupDue = null;
    this.pendingLevel = null;
    // Continue says what the file plays (owner decision): "Continue. Survival, Hard.", as the
    // start of the WORLD card's line that follows, so a screen reader hears it rather than
    // having it replaced in the same frame.
    this.sayFirst = `Continue. ${fileRulesSpoken(f.rules)}.`;
    this.continueSelect(r.levelId, ref, r.continued === true);
    return true;
  }

  /**
   * BUG-03: CONTINUE goes through the select first, as the original's Load Game does
   * (EventManager.loadGame sets StatManager.newLev, so ScreenManager.createLevel shows
   * CharacterSelect before the level; Single Character keeps the saved hero, Single random draws
   * one, as at any new level). The saved hero stays focused and keeps its power if picked again.
   * BACK returns to the set's file box, on that file.
   */
  private continueSelect(levelId: string, ref: ClassicFileRef, continued: boolean): void {
    const s = this.state;
    const go = () => {
      // BUG-05: a file a game over wrote is a continue, counted as the run goes on (as CONTINUE).
      if (continued) this.countContinue();
      this.goToLevel(levelId, { mode: 'stand' });
    };
    this.selectLevel = levelId;
    const choice = this.classicHeroChoice(false);
    if (choice === 'keep') return go();
    if (choice === 'random') {
      const c = this.singleRandomHero();
      if (c !== s.character) this.setHero(0, c);
      return go();
    }
    const current = s.character;
    this.leaveClassicTitle();
    this.scenes.clear();
    this.scenes.push(
      new CharacterSelectScene(this, {
        player: 0,
        current,
        onPick: (c) => {
          this.heroChosen = true;
          if (c !== current) this.setHero(0, c);
          go();
        },
        random: true,
        onCancel: () => this.showClassicFiles(ref.set, ref.slot),
        leaveFallen: true,
      }),
    );
  }

  /**
   * O-16: a Classic run's mid-run select (between levels, after a death) has BACK: it asks to
   * quit (QuitRunScene), NO back to the select. Nothing outside a Classic mode run.
   */
  private classicQuitPick(): { onCancel?: () => void } {
    if (!this.classicRun || this.campaign !== null || this.playtestDone) return {};
    return { onCancel: () => confirmQuitRun(this, 'No. Choose your hero.') };
  }

  /**
   * O-16: leave the Classic run for the CLASSIC menu (its Continue slot is already written): the
   * map set box over the CLASSIC title's demo, as on any way back (O-04), with the demo's tune.
   */
  quitClassicRun(): void {
    // v0.4.73: leaving a level replay goes back to its CLEARED file on the file box.
    if (this.replayRun) return this.leaveReplay('files');
    const set = this.runSet;
    const played = this.classicFile;
    this.leaveRun();
    this.scenes.clear();
    this.showClassicMenu(set);
    this.playedFile = played;
  }

  /**
   * v0.4.73 (owner C): the level replay of a CLEARED file being played (or its select), else
   * null. Only a Classic practice-style run has one: it writes no file and counts for nothing.
   */
  get replayRun(): ReplayRun | null {
    return this.practiceRun && this.campaign === null ? this.replay : null;
  }

  /**
   * v0.4.73 (owner C, 51A, 49A): a CLEARED file's level `levelId` (World `world`, level `stage`)
   * picked on its level box: the Classic hero select, then the level, with the file's rules (its
   * Map difficulty, More settings, Weapons and Disable heroes; its Game mode played as the normal
   * hero pick), free play's lives and the normal timer. BACK from the select: the level box.
   * Nothing is written: no file (classicFile null), no beat, no cheat counts (practiceRun).
   */
  replaySelect(ref: ClassicFileRef, world: number, stage: number, levelId: string): void {
    const f = this.classicClearedAt(ref);
    if (!f) return;
    const rules = copyFileRules(f.rules);
    rules.options.gameMode = originalFileRules().options.gameMode;
    this.classicSelect(levelId, () => showReplayLevels(this, ref, world, stage), {
      rules,
      practice: true,
      replay: { ref: { set: ref.set, slot: ref.slot }, world, stage, levelId },
      tutorialsSeen: f.tutorialsSeen,
    });
  }

  /**
   * v0.4.73 (49A): a death in a replayed level costs no life: its box over the level, RETRY
   * (`levelId` at `start`: the checkpoint, or the level's first area), SELECT CHARACTER, RETURN
   * TO MENU; BACK steps back to the level box.
   */
  replayDied(levelId: string, start: LevelStart): void {
    const rp = this.replayRun;
    if (!rp) return;
    this.selectLevel = levelId;
    this.scenes.push(new ReplayDeathScene(this, rp, levelId, start));
  }

  /** The death box's RETRY: the replayed level again, the same hero. */
  replayRetry(levelId: string, start: LevelStart): void {
    this.goToLevel(levelId, start);
  }

  /** The death box's SELECT CHARACTER, then the level: the picked hero starts at his default. */
  replayHero(c: CharacterDef, levelId: string, start: LevelStart): void {
    this.heroChosen = true;
    if (c !== this.state.character) this.setHero(0, c);
    this.goToLevel(levelId, start);
  }

  /** v0.4.73 (owner C, D): a CLEARED file picked on its file box: (the instructions,) the world box. */
  openClearedFile(files: ClassicFilesScene, f: ClearedFile): void {
    openClearedFile(this, files, f);
  }

  /** v0.4.73 (48A): a replayed level cleared (or left by a warp zone): its world's level box. */
  private replayCleared(): void {
    this.leaveReplay('next');
  }

  /**
   * Leaves the level replay for its CLEARED file: the file box on the file ('files'), or that
   * world's level box on the level played ('levels') or on the one after it ('next': a clear).
   */
  leaveReplay(to: 'files' | 'levels' | 'next'): void {
    const rp = this.replay;
    this.leaveRun();
    this.scenes.clear();
    if (!rp) return this.showClassicMenu();
    if (to === 'files') {
      this.showClassicFiles(rp.ref.set, rp.ref.slot);
      return;
    }
    showReplayLevels(this, rp.ref, rp.world, rp.stage, to === 'next');
  }

  /**
   * The CLASSIC menu (every map set, MAP_SETS; Options; Back), coming back to it from a run or a
   * select: a box over the CLASSIC title's demo, with the title's Start box under it (O-04); on
   * map set `focus`'s row (Back from that set's select), else the first.
   */
  showClassicMenu(focus?: MapSetId): void {
    // 38e: leaving a run for the CLASSIC menu, its set's file box opens on the file it played.
    const played = this.classicFile;
    this.endClassicRun();
    this.playedFile = played;
    this.runRules = 'current';
    const title = new ClassicTitleScene(this, 'start', true);
    this.leaveClassicTitle();
    this.scenes.push(title);
    this.scenes.push(new ClassicMenuScene(this, title, false, focus));
  }

  /**
   * B-L: map set `set`'s file box over the set box and the CLASSIC title (BACK from a used
   * file's select comes back here, on `focus`).
   */
  showClassicFiles(set: MapSetId, focus?: ClassicFileSlot): ClassicFilesScene {
    this.showClassicMenu(set);
    const files = filesBoxFor(this, set, focus);
    this.scenes.push(files);
    return files;
  }

  /** B-L: BACK from a new file's select: its rules box again, with the rules as they were. */
  showNewFile(ref: ClassicFileRef, draft: ClassicFileRules): void {
    this.showClassicFiles(ref.set, ref.slot).openNew(ref.slot, draft, true);
  }

  /**
   * The scene on top goes, and with it every CLASSIC title and menu under it and whatever was
   * opened over them (each one's exit runs: a title's demo World and its pointer listener go), so
   * only one CLASSIC title is ever kept.
   */
  private leaveClassicTitle(): void {
    this.scenes.pop();
    // Every scene opened from the CLASSIC title goes with it, however deep.
    const isTitle = (sc: unknown) => sc instanceof ClassicTitleScene || sc instanceof ClassicMenuScene;
    while (this.scenes.find(isTitle)) this.scenes.pop();
  }

  /**
   * The title's CLASSIC entry (O-04): the CLASSIC title, its live 1-1 demo and begin prompt;
   * `phase` 'start' opens it with its Start box up.
   */
  showClassicTitle(phase: ClassicTitlePhase = 'demo'): void {
    this.endClassicRun();
    this.runRules = 'current';
    const title = new ClassicTitleScene(this, phase);
    this.leaveClassicTitle();
    this.scenes.push(title);
  }

  /**
   * Classic mode: the select screen with every hero, then a new game of `levelId`. Back goes to
   * `back` (the CLASSIC menu; the title after the SMB ending).
   */
  classicSelect(
    levelId: string,
    back: () => void,
    run: {
      file?: ClassicFileRef;
      rules?: ClassicFileRules;
      practice?: boolean;
      /** v0.4.73: a CLEARED file's level replay (with practice), and its file's Tutorials seen. */
      replay?: ReplayRun;
      tutorialsSeen?: readonly string[];
    } = {},
  ): void {
    // The run's rules are set before the pick, so the roster (Game.roster) offers the Classic
    // extras on the very first select.
    this.campaign = null;
    // A new Classic game: every Tutorials box shows again (TutorialManager.startNewGameHandler).
    this.classicTutorials.newGame();
    // B-L: the run's file (none for practice) and its rules, fixed from here; its continues
    // count from 0 (a new file, or one started again after ERASE FILE).
    this.classicFile = run.file ? { set: run.file.set, slot: run.file.slot } : null;
    this.runFileRules = run.rules ? copyFileRules(run.rules) : null;
    this.practiceRun = run.practice === true;
    this.replay = run.practice === true && run.replay ? { ...run.replay } : null;
    if (run.tutorialsSeen) this.classicTutorials.restore(run.tutorialsSeen);
    this.runWorlds = [];
    this.fileContinues = 0;
    this.classicDifficulty = this.classicRunRules.difficulty;
    this.runRules = this.classicRules;
    // The Classic mode flow from here (its first select, Single random's draw): Disable heroes
    // applies before the run itself starts (heroSlots, G-032).
    this.classicFlow = true;
    this.pickedRandom = false;
    this.selectLevel = levelId;
    this.pickRng = new Rng(this.deps.freshSeeds === true ? freshSeed() : RANDOM_PICK_SEED);
    // Game mode Single random: no select screen at all (CampaignModes.SINGLE_RANDOM).
    if (this.classicHeroChoice(true) === 'random') return this.classicGame(this.singleRandomHero(), levelId);
    // Survival: a new game (StatManager.startNewGameHandler): every hero fallen, revival allowed,
    // and the starting lives to revive with, so the first select opens in revive mode.
    this.survival = null;
    if (this.survivalMode) {
      this.classicRun = true;
      this.state = newGameState(this.firstHero, null, this.liveRules);
      this.classicStartLives();
      this.survival = this.newSurvival();
    }
    // The select replaces the CLASSIC title and its menus (its BACK builds them again).
    this.leaveClassicTitle();
    this.scenes.push(
      new CharacterSelectScene(this, null, {
        begin: (c) => {
          this.heroChosen = true;
          this.classicGame(c, levelId);
        },
        back,
        random: true,
      }),
    );
  }

  /**
   * Classic mode (G-030): the TIME UP card after a death by the clock (InformativeBlackScreen's
   * TIME UP, ScreenManager.showTimeUpScreen), on black over the level; read out, and gone on with
   * OK, never by itself (the original's 2.5 s), then `then` (the death goes on).
   */
  showTimeUp(then: () => void): void {
    const ok = fontText(`PRESS ${abilityHint(this, 'OK', 'jump')}`);
    this.deps.announcer?.say(`Time up! ${ok}.`);
    this.scenes.push(
      new MessageScene(
        this,
        ['TIME UP', '', ok],
        () => {
          this.scenes.pop();
          then();
        },
        ['start', 'attack', 'jump'],
      ),
    );
  }

  /**
   * Classic mode, a map set beaten (after the credits): each cheat the game unlocked has its card
   * (StatManager.beatGameHandler: Cheats.unlockCheat's boxes, MessageBoxMessages.UNLOCKED_CHEAT_*),
   * read out and gone on with OK, then the title (G-004, D3).
   */
  private showClassicUnlocks(): void {
    const id = this.cheatUnlocks.shift();
    if (!id) return this.afterClassicBeat();
    const lines = unlockedLines(id);
    const ok = fontText(`PRESS ${abilityHint(this, 'OK', 'jump')}`);
    this.deps.ctx.audio.sfx('1up');
    this.deps.announcer?.say(`You unlocked the ${cheatInfo(id).name} cheat! ${ok}.`);
    this.scenes.clear();
    this.scenes.push(new MessageScene(this, [...lines, '', ok], () => this.showClassicUnlocks()));
  }

  /**
   * Play save file `slot` (file select): load it into the game state, save it, show the map.
   * `save` is passed when just created (so play goes on even if storage is unavailable).
   */
  openFile(slot: SaveSlot, save = loadSave(slot), opening = false, scratch = false): void {
    if (!save) {
      this.showTitle();
      return;
    }
    this.state = stateFromSave(save, this.deps.characters);
    this.playtestDone = null;
    this.pendingLevel = null;
    this.quickRespawn = false;
    this.campaign = scratch ? { slot, scratch } : { slot };
    this.endClassicRun();
    this.backupDue = null;
    this.campaignSave = save;
    this.pendingReveal = save.pendingReveal.slice();
    this.mapLastNode = { ...save.lastNode };
    this.devUnlockAll = save.devUnlockAll === true;
    this.devAllHeroes = save.devAllHeroes === true;
    this.devGateOpen = save.devGateOpen === true;
    this.freed = save.freed.slice();
    this.met = metIds(save.met ?? [], this.freed, save.secrets.includes(CRYSTAL_BALL));
    this.bonusOpen = save.bonusOpen !== false;
    this.bonusGuard = !this.bonusOpen && save.bonusGuard === true;
    this.inventoryUnlocked = save.inventoryUnlocked === true || save.secrets.includes(CRYSTAL_BALL);
    this.bonus = bonusStateFrom(save, this.state.character.id);
    this.heroKits = structuredClone(save.heroKits ?? {});
    // Only heroes freed on this file, this session, get the map's burst of hops.
    this.celebrate.clear();
    // A hero the file has not freed (a hand-edited file, or one picked through "All heroes" with
    // dev mode since off) gives way to Mario.
    this.dropLockedHeroes();
    // The freed heroes the file plays now count as answered: their training is never asked. (A
    // hero picked only through dev "All heroes" is not freed, so its real question still comes.)
    this.tutorials = tutorialHeroes([
      ...(save.tutorials ?? []),
      ...[this.state.character.id, this.state.character2?.id].filter(
        (id) => id !== undefined && this.freed.includes(id),
      ),
    ]);
    this.mapProgress = {
      cleared: save.cleared.slice(),
      pages: save.pages.slice(),
      secrets: save.secrets.slice(),
      position: { page: save.position.page, node: save.position.node },
      gameCleared: save.gameCleared,
      // The world gates read the file's freed heroes (the same list freeHero adds to).
      freed: this.freed,
    };
    // A file from before the story (or a test's file) counts what already happened as seen, and
    // a list from before 0.4.23 gets the new scenes whose trigger is already past (upgradeStory).
    this.story = upgradeStory(save.story, this.mapProgress, this.freed);
    this.storyUnsaved.clear();
    this.explained = (save.explained ?? []).slice();
    // A new file's opening plays first (docs/STORY.md 2.1, story/opening.ts), then the map.
    if (opening && playOpening(this, () => this.showMap())) return;
    this.showMap(); // the map saves the file as it opens
  }

  /**
   * A file just created on the file select: the story's opening (Peach's castle and her note,
   * once per file), then its World 1 map, the hero standing on 1-0, Mario's tutorial stage, where
   * Bowser casts his spell. 1-1 opens once 1-0 is cleared (or skipped from its pause menu).
   */
  startNewFile(slot: SaveSlot, save: SaveFile): void {
    this.openFile(slot, save, true);
  }

  /**
   * Pause → "Skip tutorial" in a stage tutorial: campaign play counts it as cleared and returns to
   * the map, which draws in what that opens (1-0: the road to 1-1), as a clear would. Elsewhere
   * (dev select, ?level=) play goes on to the level its exit leads to.
   */
  skipTutorial(): void {
    const run = this.tutorialRun;
    if (!run) return;
    this.state.checkpoint = null;
    this.state.time = null;
    // Campaign: the clear's way back to the map gives the file's hero back (endTutorial). A file
    // that never saw Bowser's spell sees it first, over the level (docs/STORY.md 2.2).
    if (this.campaign) {
      const scene = this.scenes.find((s) => s instanceof LevelScene) as LevelScene | undefined;
      if (scene && skipTutorialStory(this, scene, run.level, () => this.levelCleared(run.level))) return;
      this.levelCleared(run.level);
      return;
    }
    this.endTutorial();
    const next = this.exitOf(run.level);
    if (next && next !== 'end') this.goToLevel(next, { mode: 'stand' });
    else this.showTitle();
  }

  /** Where level `id`'s exit leads (its `next`), or null without one. */
  private exitOf(id: string): string | null {
    try {
      const exit = this.deps.getLevel(id).zones.find((z) => z.kind === 'exit');
      return exit?.kind === 'exit' ? exit.next : null;
    } catch {
      return null;
    }
  }

  /** Intro card then the level. Levels that don't exist yet end the run with a thank-you card. */
  goToLevel(levelId: string, start: LevelStart): void {
    if (this.chapterBlocked(levelId)) return this.chapterGateBack();
    let level: LevelData;
    try {
      level = this.sharedLevel?.id === levelId ? this.sharedLevel : this.deps.getLevel(levelId);
    } catch {
      this.deps.ctx.audio.stopMusic();
      // RC-005: a custom level this browser does not have (someone else's `?level=custom-` link:
      // the library is per browser) says so, instead of the unbuilt-world card.
      const custom = levelId.startsWith(CUSTOM_PREFIX);
      const lines = custom
        ? [...CUSTOM_LEVEL_MISSING]
        : [
            'THANK YOU FOR PLAYING!',
            '',
            `WORLD ${(levelId.split('-')[0] ?? '').toUpperCase()} IS NOT`,
            'BUILT YET.',
            '',
            'MORE WORLDS COMING SOON',
          ];
      if (custom) this.deps.ctx.audio.sfx('bump');
      else this.deps.ctx.audio.playJingle('world-clear');
      this.scenes.clear();
      this.deps.announcer?.say(pageSaid(lines, true));
      this.scenes.push(new MessageScene(this, lines, () => this.showTitle()));
      return;
    }
    this.runLevel = level.parent ?? level.id;
    // An intro area (TYPE="intro" with gameStateWatch) and a vine area (vineStart) always open
    // with their scripted watch-mode start, whatever start the caller asked for; so does an area
    // beamed down into (a teleport pad's arrival, the 3-1 space station).
    if (level.startMode === 'autowalk' || level.startMode === 'climb' || level.startMode === 'beam')
      start = { ...start, mode: level.startMode };
    this.state.world = level.world;
    this.state.stage = level.stage;
    // A campaign file shows an SMB level by its campaign label (map/campaign-order.ts).
    this.state.campaignOrder = this.campaign !== null && !isLostLevel(level.id);
    this.deps.ctx.audio.stopMusic();
    this.deps.ctx.audio.setTempoScale(1);
    this.clearToRoundBase();
    // A fill-up spot off the map (the Top Secret Area): no WORLD card, no clock; straight in.
    if (level.bonus) {
      this.endTutorial();
      this.deps.announcer?.say(`${spoken(level.name)}.`);
      this.startLevel(level, start);
      return;
    }
    // G-008, B-L: a Classic mode run writes its file at each WORLD card (never a dev run).
    if (this.keepsResume) this.keepResume(levelId);
    const hero = this.sayHero ? `${this.sayHero}. ` : '';
    this.sayHero = null;
    const first = this.sayFirst ? `${this.sayFirst} ` : '';
    this.sayFirst = null;
    this.deps.announcer?.say(
      `${first}${hero}${spokenLevel(level.world, level.stage, this.state.campaignOrder)}. ${this.cardLives} ${this.cardLives === 1 ? 'life' : 'lives'}.`,
    );
    // A stage tutorial has no clock (LevelScene stops it): the card shows none either. Any
    // other level ends a tutorial's run (its exit, outside the campaign, leads on to 1-1).
    const tutorial = levelTutorial(level);
    if (!tutorial) this.endTutorial();
    const time = tutorial ? null : startTime(level, this.state, start);
    // A Classic run's card is skipped by a press and stays 2500 ms in Single Character (G-090).
    const intro = this.classicRun
      ? {
          skippable: true,
          frames: this.classicRunRules.options.gameMode === 'single' ? INTRO_FRAMES_SINGLE : INTRO_FRAMES,
        }
      : {};
    this.scenes.push(new IntroScene(this, () => this.startLevel(level, start), time, intro));
  }

  /**
   * Straight into a level (pipes, bonus rooms); campaign play gets its variant (level/campaign.ts).
   * Entering Larry's airship (deck or room) from elsewhere boards it (scenes/airship.ts); any
   * other level ends a run aboard. A dev airship round's levels replace each other over its list.
   */
  startLevel(level: LevelData, start: LevelStart): void {
    this.flushCheatStats();
    if (this.chapterBlocked(level.id)) return this.chapterGateBack();
    const run = this.airship;
    if (!isAirshipArea(level.id)) {
      // A dev round leaving the airship ends as QUIT (its own scenes go back to the dev list).
      if (run?.onDone) {
        endDev(this, 'quit');
        return;
      }
      this.airship = null;
    } else if (run) run.entered(level.id, start, this.state);
    else boardAirship(this, level.id, start);
    this.clearToRoundBase();
    const scene = this.levelScene(level, start);
    // Survival: a hero strengthened at the select gets its power-ups and ammo as it starts.
    const id = this.state.character.id;
    if (this.survival?.takeBoost(this.slotOf(this.state.character).id))
      scene.afterFirstUpdate = () => {
        const p = scene.world.players[0];
        if (p) applyRevivalBoost(p, scene.world, id);
      };
    this.scenes.push(scene);
  }

  /**
   * Clears the scenes for a level: down to the scene a round is played over (a dev airship round's
   * list, an arena round's map: AirshipRun.base, StageRound.base) while one runs, else all.
   */
  private clearToRoundBase(): void {
    const base = this.airship?.base ?? this.stageRound?.base;
    if (base && this.scenes.find((s) => s === base))
      while (this.scenes.depth > 0 && this.scenes.top !== base) this.scenes.pop();
    else this.scenes.clear();
  }

  /**
   * The scene for `level` (its campaign variant in campaign play, then the variant of the heroes
   * playing: level/variants.ts), not yet pushed.
   */
  levelScene(level: LevelData, start: LevelStart): LevelScene {
    const played = this.campaign ? campaignLevel(level, undefined, this.mapProgress.secrets) : level;
    const heroes = [this.state.character.id, ...(this.state.character2 ? [this.state.character2.id] : [])];
    const scene = new LevelScene(
      this,
      heroVariant(played, heroes, this.campaign !== null, this.liveRules === 'classic'),
      start,
    );
    // The secret house during a village visit: the blocks already opened stay used.
    if (this.town && level.id === SECRET_HOUSE_LEVEL) layUsedBlocks(scene.world, this.town.used);
    return scene;
  }

  /**
   * A death with lives left. As in the original (Level.reloadLevel → ScreenManager.loadNewLevel
   * sets newLev → createLevel shows CharacterSelect), the player whose death ended the attempt
   * picks a hero, then the lives card and the level at `start` (the checkpoint) follow. Score,
   * coins and the checkpoint are kept. Dev-mode starts respawn straight away.
   */
  respawn(levelId: string, start: LevelStart, player = 0): void {
    // v0.4.73: a replayed level's death has its own box (RETRY, SELECT CHARACTER, RETURN TO MENU).
    if (this.replayRun) return this.replayDied(levelId, start);
    this.selectLevel = levelId;
    // G-008: the slot follows the death (its lives) before the select, so quitting there resumes it.
    if (this.keepsResume) this.keepResume(levelId);
    if (this.quickRespawn) {
      this.goToLevel(levelId, start);
      return;
    }
    this.chooseHero(player, () => this.goToLevel(levelId, start));
  }

  /** Character select for one player, then `then`. The picked hero starts small (or at full hp). */
  private chooseHero(player: number, then: () => void): void {
    const s = this.state;
    const p2 = player === 1 && s.character2 !== null;
    const current = p2 ? (s.character2 as CharacterDef) : s.character;
    // Classic mode's Game mode may skip the select screen (classicHeroChoice); one player.
    if (this.classicRun) {
      const choice = this.classicHeroChoice(false);
      if (choice !== 'select') {
        this.setHero(0, choice === 'random' ? this.singleRandomHero() : current);
        return then();
      }
    }
    this.deps.ctx.audio.stopMusic();
    this.scenes.clear();
    this.scenes.push(
      new CharacterSelectScene(this, {
        player: p2 ? 1 : 0,
        current,
        onPick: (c) => {
          // StatManager.playerDie resets the fallen hero to PS_NORMAL; a newly picked hero
          // starts from its default state too.
          this.heroChosen = true;
          this.setHero(p2 ? 1 : 0, c);
          then();
        },
        ...(this.classicRun ? { random: true } : {}),
        ...this.classicQuitPick(),
        // Campaign: back to the map as Pause → Quit to map (no clear; the life lost here is
        // already counted and saved, and the hero stays as the death left it).
        ...(this.campaign && !this.playtestDone ? { onMap: () => this.returnToMap() } : {}),
      }),
    );
  }

  /**
   * After a death: the playing heroes back to their start (decision 1: in the campaign their found
   * items are wiped, back to the basic kit; the other heroes' saved kits stay).
   */
  resetAfterDeath(): void {
    const s = this.state;
    const rules = this.liveRules;
    const fresh = (c: CharacterDef, kit: Record<string, number>): HeroPower => {
      if (this.campaign) return heroStart(c);
      const d = playedHero(this.ctx, c, rules); // the def played under the run's rules (TG-17a)
      return { powerState: defaultPower(d), hp: startHp(d), kit: keptKit(d, kit) };
    };
    const p1 = fresh(s.character, s.kit);
    const kit2 = s.kit2;
    s.powerState = p1.powerState;
    s.hp = p1.hp;
    s.kit = p1.kit;
    s.kit2 = {};
    if (s.character2) {
      const p2 = fresh(s.character2, kit2);
      s.powerState2 = p2.powerState;
      s.hp2 = p2.hp;
      s.kit2 = p2.kit;
    }
  }

  /** The heroes' kits to save: the ones put away, and a tutorial's own hero's live power. */
  private savedHeroKits(saved: GameState): Record<string, HeroPower> {
    const out = structuredClone(this.heroKits);
    const s = this.state;
    if (s.character !== saved.character)
      out[s.character.id] = {
        powerState: s.powerState,
        hp: s.hp,
        kit: { ...s.kit },
        ...(s.swapped ? { swapped: true } : {}),
      };
    delete out[saved.character.id];
    if (saved.character2) delete out[saved.character2.id];
    return out;
  }

  /**
   * Give player `player` hero `c`. Campaign: the old hero's power, hit points and kit are put away
   * and `c` comes back as they were left, or with their basic kit the first time (decisions 2, 3);
   * player 1's inventory goes with the hero (docs/POWERUPS.md 8.1). Elsewhere `c` starts from its
   * default power (small, or full hp).
   */
  setHero(player: 0 | 1, c: CharacterDef): void {
    const s = this.state;
    if (this.campaign) {
      const old = player === 1 ? s.character2 : s.character;
      if (old === c) return;
      // Item 25: a kit earned in a swapped design goes away with that flag, and comes back only
      // while that design still plays.
      const flag = player === 1 ? s.swapped2 : s.swapped;
      if (old)
        this.heroKits[old.id] =
          player === 1
            ? { powerState: s.powerState2, hp: s.hp2, kit: { ...s.kit2 }, ...(flag ? { swapped: true } : {}) }
            : { powerState: s.powerState, hp: s.hp, kit: { ...s.kit }, ...(flag ? { swapped: true } : {}) };
      const stored = this.heroKits[c.id];
      const next = (stored && keptPower(this, c, this.liveRules, stored)) ?? heroStart(c);
      delete this.heroKits[c.id];
      if (player === 1) {
        s.character2 = c;
        s.powerState2 = next.powerState;
        s.hp2 = next.hp;
        s.kit2 = { ...next.kit };
        if (next.swapped) s.swapped2 = true;
        else delete s.swapped2;
      } else {
        s.character = c;
        s.powerState = next.powerState;
        s.hp = next.hp;
        s.kit = { ...next.kit };
        if (next.swapped) s.swapped = true;
        else delete s.swapped;
        swapInventory(this.bonus, c.id);
      }
      return;
    }
    // The default of the def played under the run's rules (TG-17a).
    const d = playedHero(this.ctx, c, this.liveRules);
    if (this.keepsHeroKits && player === 0) {
      // BUG-06: the hero left is put away as he is; `c` comes back as he was left.
      const old = s.character;
      const left: HeroPower = {
        powerState: s.powerState,
        hp: s.hp,
        kit: { ...s.kit },
        ...(s.swapped ? { swapped: true } : {}),
      };
      this.classicKits[this.slotOf(old).id] = left;
      const key = this.slotOf(c).id;
      const stored = this.classicKits[key];
      // Item 25: a kit earned in a swapped design that no longer plays starts afresh.
      const kept = stored && keptPower(this, c, this.liveRules, stored);
      delete this.classicKits[key];
      s.character = c;
      delete s.swapped;
      if (kept && fitsHero(d, kept)) {
        s.powerState = kept.powerState;
        s.hp = kept.hp;
        s.kit = { ...kept.kit };
        if (kept.swapped) s.swapped = true;
      } else {
        s.powerState = defaultPower(d);
        s.hp = startHp(d);
        s.kit = old === c ? keptKit(d, s.kit) : {};
        if (old === c && left.swapped) s.swapped = true;
      }
      return;
    }
    const power = defaultPower(d);
    // The same hero picked again keeps what a death keeps (CharacterDef.keepOnDeath).
    if (player === 1) {
      // Item 25: another hero's fresh kit is not the swapped design's.
      if (s.character2 !== c) delete s.swapped2;
      s.kit2 = s.character2 === c ? keptKit(d, s.kit2) : {};
      s.character2 = c;
      s.powerState2 = power;
      s.hp2 = startHp(d);
    } else {
      if (s.character !== c) delete s.swapped;
      s.kit = s.character === c ? keptKit(d, s.kit) : {};
      s.character = c;
      s.powerState = power;
      s.hp = startHp(d);
    }
  }

  /**
   * No lives left: GAME OVER, then CONTINUE? YES / NO. `levelId` is the level the run ended in;
   * `player` picks the hero if the run continues. In campaign mode YES goes back to the map
   * (progress kept) and NO to the title.
   */
  gameOver(levelId: string | null = null, player = 0): void {
    this.flushCheatStats();
    this.continueReady = false;
    if (this.keepsResume) {
      // BUG-05 (owner): a game over keeps the run. Its file holds the continue point (what
      // CONTINUE plays on from: continueAfterDyingHandler's reset, the world's first level), so
      // MAIN MENU and the set's Continue later go on from the same place.
      const id = levelId === null ? null : this.firstLevelOfWorld(levelId);
      if (id === null) this.dropResume();
      else {
        this.resetForContinue();
        this.continueReady = true;
        this.keepResume(id, true);
      }
    }
    this.scenes.clear();
    if (this.campaign) {
      // The file is saved as a continue leaves it (so NO keeps a playable file): fresh lives
      // (3, or 5 with two players), score and coins 0, the same heroes, map progress kept.
      const old = this.state;
      this.state = newGameState(old.character, old.character2);
      // The Wallet is the file's, like a found secret: a game over keeps it (its coins go).
      this.state.wallet = old.wallet;
      this.autosave();
      this.scenes.push(new GameOverScene(this, () => this.returnToMap()));
      return;
    }
    this.scenes.push(new GameOverScene(this, () => this.continueGame(levelId, player), this.keepsResume));
  }

  /**
   * CONTINUE → YES. The original's EventManager.continueAfterDying: StatManager.resetAllStats(false)
   * (lives back to the starting count, score and coins 0, power-ups gone) and
   * changeToFirstWorldLevel (the first level of the current world, from its start), then
   * character select as for a new level.
   */
  continueGame(levelId: string | null, player = 0): void {
    this.countContinue();
    // The game over already reset the run for its slot's continue point (BUG-05).
    if (!this.continueReady) this.resetForContinue();
    this.continueReady = false;
    const id = levelId === null ? null : this.firstLevelOfWorld(levelId);
    if (id === null) {
      this.showTitle();
      return;
    }
    this.respawn(id, { mode: 'stand' }, player);
  }

  /**
   * Infinite Lives' goal (StatManager.numContinuesUsed): a continue, counted in the run's file
   * only (B-L), written with it at the next WORLD card. A practice, developer or link run has no
   * file and counts nothing.
   */
  private countContinue(): void {
    if (this.classicFile) this.fileContinues = Math.min(999999, this.fileContinues + 1);
  }

  /**
   * StatManager.resetAllStats(false) as a continue does it: lives back to the starting count,
   * score and coins 0, every power-up gone; in Survival every hero fallen again, revival allowed.
   */
  private resetForContinue(): void {
    const old = this.state;
    this.state = newGameState(old.character, old.character2, this.liveRules);
    // BUG-06: every hero's power-ups go too, so a game over's slot carries no heroKits.
    this.classicKits = {};
    if (this.classicRun) this.classicStartLives();
    this.survival?.reset();
    this.state.warped = old.warped;
  }

  /** The game over has reset the run already (its slot written at the continue point, BUG-05). */
  private continueReady = false;

  /** "1-3" → "1-1", "ll-5-2" → "ll-5-1"; custom levels and others outside a numbered world restart themselves. */
  private firstLevelOfWorld(levelId: string): string {
    if (levelId.startsWith('custom-')) return levelId;
    const m = /^(.*?)(\d+)-\d+$/.exec(levelId);
    if (!m) return levelId;
    const first = `${m[1]}${m[2]}-1`;
    try {
      this.deps.getLevel(first);
      // changeToFirstWorldLevel loads area a of it (ll-9-1-start for Lost Levels 9-1).
      return this.firstArea(first);
    } catch {
      return levelId;
    }
  }
}
