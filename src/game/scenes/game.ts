import { SceneStack } from '@engine/scene';
import type { LastInput } from '@engine/input/touch-logic';
import { loadProgress, lostLettersOpen, recordLostGameBeaten, saveProgress } from '@engine/save/progress';
import type { GameContext, GameState } from '../context';
import { newGameState } from '../context';
import { startHp, type CharacterDef } from '../characters/character';
import { TitleScene } from './title';
import { IntroScene } from './intro';
import { LevelScene, type LevelStart } from './level';
import { startTime } from '../world/world';
import { GameOverScene } from './game-over';
import { CharacterSelectScene } from './character-select';
import type { LevelData } from '../level/schema';
import type { Settings } from '@engine/save/settings';
import type { InputManager } from '@engine/input/input-manager';
import type { Announcer } from '@engine/a11y/announcer';
import type { Viewport } from '@engine/viewport';
import { EditorScene } from './editor';
import { DevMenuScene } from './dev';
import { MenuScene } from './menu';
import { loadLibrary, customLevelId } from '../level/library';
import { CardScene, MessageScene } from './message';
import { CreditsScene, creditsLines } from './credits';
import { STORY_NOT_OVER } from '../story/script';
import { WorldMapScene, showChapterGate, spoken, type WorldMapOptions } from './world-map';
import type { MapProgress, PageId } from '../map/types';
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
import { mapPage } from '@content/worldmap';
import { CRYSTAL_BALL } from '../map/captives';
import { storyOn, upgradeStory } from '../story/beats';
import { playOpening } from '../story/opening';
import { bonusGame, type BonusOutcome, type BonusSpot } from '../map/bonus-spot';
import { HammerBattleScene } from './hammer-battle';
import { campaignLevel } from '../level/campaign';
import { heroVariant } from '../level/variants';
import { boardAirship, endDev, isAirshipArea, type AirshipRun } from './airship';
import { isLostLevel } from '../level/lost-campaign';
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
import type { StageRound } from '../arena/stage-round';

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
   * A fresh world seed for every level visit (main.ts), so no two visits play out the same
   * (swimming Cheep Cheeps, leaping ones, timers). Off, every world keeps its level's fixed seed
   * (levelSeed), as in the headless sims: the tests that play through Game repeat exactly, run
   * after run, alone or in the full suite.
   */
  freshSeeds?: boolean;
}

/** Touch when the on-screen pad is shown, else a connected gamepad, else the keyboard. */
export type ControlScheme = 'touch' | 'gamepad' | 'keyboard';

/** Orchestrates scenes and carries GameState between levels. */
export class Game {
  readonly scenes = new SceneStack();
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
  campaign: { slot: SaveSlot } | null = null;
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
   * The story beats seen on the campaign's file (SaveFile.story; ids from src/game/story/beats.ts),
   * each once. See `seen` / `markSeen`; whether the story plays at all is beats.ts storyOn.
   */
  story: string[] = [];
  /**
   * Beats played while developer "Unlock all" is on (`mapUnlockAll`): they count as seen only
   * while it stays on and are never saved, so with it off the scene plays for real (markSeen).
   */
  private storyUnsaved = new Set<string>();

  constructor(readonly deps: GameDeps) {
    this.state = newGameState(deps.characters[0] as CharacterDef);
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
    if (from.startsWith('ll-')) return this.showLostEnding(from);
    const below = this.scenes.top;
    const world = below instanceof LevelScene ? below.world : null;
    const head = world ? world.castleText.splice(0) : [];
    // The campaign's 8-4 is a false ending (docs/STORY.md 2.12): the credits say so at the end.
    const story = storyOn(this) && from === '8-4';
    // The castle's lines were read out as they showed (World.updateBossClear), so the credits
    // do not read them a second time.
    const said = story ? ` ${STORY_NOT_OVER.filter(Boolean).join(' ')}` : '';
    this.deps.announcer?.say(`Credits.${said}`);
    this.scenes.push(new CreditsScene(this, head, () => this.afterCredits(from), world, creditsLines(story)));
  }

  /**
   * The credits are over: campaign files record the clear and save, then the map page of the
   * castle (SMB 8-4: World 8, its road on to Lost World 1 drawn in; Lost Levels D-4). Otherwise
   * (and for a campaign level on no map page) the title.
   */
  private afterCredits(from: string): void {
    if (this.campaign) {
      const s = this.state;
      s.checkpoint = null;
      s.time = null;
      if (!isLostLevel(from)) this.mapProgress.gameCleared = true;
      this.addReveal(clearLevel(this.mapProgress, from, this.deps.getLevel));
      this.autosave();
      if (findLevelNode(mainLevel(from, this.deps.getLevel))) return this.returnToMap();
    }
    this.showTitle();
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
      this.addReveal(clearLevel(this.mapProgress, from, this.deps.getLevel));
      this.autosave();
    }
    const below = this.scenes.top;
    const world = below instanceof LevelScene ? below.world : null;
    // "THANK YOU <hero>!" names the hero who took the axe, as Toad's thanks do (World.castleText).
    const hero = (world?.castleHero ?? s.character).hudName;
    const card =
      from === 'll-8-4' || from === 'll-13-4'
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
    if (from === 'll-8-4' && !campaign) {
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
        this.deps.announcer?.say('Credits.');
        this.scenes.pop(); // the card; the level (if any) stays beneath the credits
        this.scenes.push(new CreditsScene(this, head, () => this.afterCredits(from), world));
      };
    } else then = () => (campaign ? this.returnToMap() : this.showTitle());
    const audio = this.deps.ctx.audio;
    audio.stopMusic();
    audio.playJingle('world-clear');
    this.deps.announcer?.say(card.filter(Boolean).join(' '));
    if (!world) this.scenes.clear();
    this.scenes.push(new CardScene(this, card, then, world));
  }

  showTitle(): void {
    this.airship = null;
    this.deps.ctx.audio.stopMusic();
    this.pendingLevel = null;
    this.playtestDone = null;
    this.quickRespawn = false;
    this.campaign = null;
    this.celebrate.clear();
    this.pendingReveal = [];
    this.devUnlockAll = false;
    this.endTutorial();
    this.devAllHeroes = false;
    this.bonus = newBonusState();
    this.scenes.clear();
    this.scenes.push(new TitleScene(this));
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
    if (this.campaign) this.addReveal(openMetExits(this.mapProgress));
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
        // A training room on the way plays its own music; the map's comes back after it.
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
    writeSave(this.campaignSave);
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
    };
    this.campaignSave = save;
    writeSave(save);
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
    this.returnToMap(clearLevel(this.mapProgress, levelId, this.deps.getLevel));
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
    this.addReveal(warpTo(this.mapProgress, page));
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
    this.returnToMap(secretExit(this.mapProgress, levelId, secret, this.deps.getLevel));
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
    this.returnToMap(secretExit(this.mapProgress, levelId, secret, this.deps.getLevel));
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
    this.returnToMap(secretExit(this.mapProgress, levelId, CRYSTAL_BALL, this.deps.getLevel));
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
  warpToLevel(levelId: string, start: LevelStart): void {
    const s = this.state;
    const go = () => this.goToLevel(levelId, start);
    const pick = (player: 0 | 1, then: () => void) => {
      const current = player === 1 ? (s.character2 as CharacterDef) : s.character;
      return new CharacterSelectScene(this, {
        player,
        current,
        onPick: (c) => {
          if (c !== current) this.setHero(player, c);
          then();
        },
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
   * level's world seed (tests); otherwise LevelScene picks it (GameDeps.freshSeeds).
   */
  devStart(levelId: string, character: CharacterDef, power: string, fullKit = false, seed?: number): void {
    this.tutorialRun = null;
    this.state = newGameState(character);
    this.state.lives = 99;
    if (fullKit && character.devKit) this.state.kit = character.devKit();
    if (character.damage.kind === 'powerup') this.state.powerState = power;
    else {
      const max = this.state.kit.maxHp ?? startHp(character);
      this.state.hp = power === 'full' ? max : power === 'half' ? Math.max(1, Math.ceil(max / 2)) : 1;
    }
    this.playtestDone = null;
    this.pendingLevel = null;
    this.quickRespawn = true;
    this.campaign = null;
    this.goToLevel(levelId, seed === undefined ? { mode: 'stand' } : { mode: 'stand', seed });
  }

  openEditor(initial?: { level: LevelData; name: string }): void {
    this.playtestDone = null;
    this.deps.ctx.audio.stopMusic();
    this.scenes.clear();
    this.scenes.push(new EditorScene(this, initial));
  }

  /** Menu of saved custom levels; picking one goes to character select then the level. */
  showCustomLevels(): void {
    const names = Object.keys(loadLibrary().levels).sort();
    const items = names.map((n) => ({
      label: n.slice(0, 14),
      select: () => {
        this.pendingLevel = customLevelId(n);
        this.showCharacterSelect();
      },
    }));
    if (!items.length) items.push({ label: 'No levels yet', select: () => this.openEditor() });
    items.push({ label: 'Back', select: () => this.showTitle() });
    this.scenes.replace(new MenuScene(this, 'CUSTOM LEVELS', items, () => this.showTitle()));
  }

  /** Run a level from the editor; returns to it when the level ends or the player quits. */
  playtest(level: LevelData, done: () => void): void {
    this.tutorialRun = null;
    this.state = newGameState(this.state.character);
    this.state.lives = 99;
    this.playtestDone = done;
    this.quickRespawn = true;
    this.campaign = null;
    this.startLevel(level, { mode: 'stand' });
  }

  /** Play a level decoded from a share link with the default character. */
  playShared(level: LevelData): void {
    this.tutorialRun = null;
    this.sharedLevel = level;
    this.state = newGameState(this.deps.characters[0] as CharacterDef);
    this.playtestDone = null;
    this.quickRespawn = false;
    this.campaign = null;
    this.startLevel(level, { mode: 'stand' });
  }

  newGame(character: CharacterDef, levelId = '1-1', character2: CharacterDef | null = null): void {
    this.tutorialRun = null;
    this.state = newGameState(character, character2);
    this.playtestDone = null;
    this.quickRespawn = false;
    this.campaign = null;
    const id = this.pendingLevel ?? levelId;
    this.pendingLevel = null;
    this.goToLevel(id, { mode: 'stand' });
  }

  /**
   * Play save file `slot` (file select): load it into the game state, save it, show the map.
   * `save` is passed when just created (so play goes on even if storage is unavailable).
   */
  openFile(slot: SaveSlot, save = loadSave(slot), opening = false): void {
    if (!save) {
      this.showTitle();
      return;
    }
    this.state = stateFromSave(save, this.deps.characters);
    this.playtestDone = null;
    this.pendingLevel = null;
    this.quickRespawn = false;
    this.campaign = { slot };
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
      this.deps.ctx.audio.playJingle('world-clear');
      this.scenes.clear();
      this.scenes.push(
        new MessageScene(
          this,
          [
            'THANK YOU FOR PLAYING!',
            '',
            `WORLD ${levelId.split('-')[0]} IS NOT`,
            'BUILT YET.',
            '',
            'MORE WORLDS COMING SOON',
          ],
          () => this.showTitle(),
        ),
      );
      return;
    }
    // An intro area (TYPE="intro" with gameStateWatch) and a vine area (vineStart) always open
    // with their scripted watch-mode start, whatever start the caller asked for; so does an area
    // beamed down into (a teleport pad's arrival, the 3-1 space station).
    if (level.startMode === 'autowalk' || level.startMode === 'climb' || level.startMode === 'beam')
      start = { ...start, mode: level.startMode };
    this.state.world = level.world;
    this.state.stage = level.stage;
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
    this.deps.announcer?.say(`World ${level.world}-${level.stage}. ${this.state.lives} lives.`);
    // A stage tutorial has no clock (LevelScene stops it): the card shows none either. Any
    // other level ends a tutorial's run (its exit, outside the campaign, leads on to 1-1).
    const tutorial = levelTutorial(level);
    if (!tutorial) this.endTutorial();
    const time = tutorial ? null : startTime(level, this.state, start);
    this.scenes.push(new IntroScene(this, () => this.startLevel(level, start), time));
  }

  /**
   * Straight into a level (pipes, bonus rooms); campaign play gets its variant (level/campaign.ts).
   * Entering Larry's airship (deck or room) from elsewhere boards it (scenes/airship.ts); any
   * other level ends a run aboard. A dev airship round's levels replace each other over its list.
   */
  startLevel(level: LevelData, start: LevelStart): void {
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
    this.scenes.push(this.levelScene(level, start));
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
    return new LevelScene(this, heroVariant(played, heroes, this.campaign !== null), start);
  }

  /**
   * A death with lives left. As in the original (Level.reloadLevel → ScreenManager.loadNewLevel
   * sets newLev → createLevel shows CharacterSelect), the player whose death ended the attempt
   * picks a hero, then the lives card and the level at `start` (the checkpoint) follow. Score,
   * coins and the checkpoint are kept. Dev-mode starts respawn straight away.
   */
  respawn(levelId: string, start: LevelStart, player = 0): void {
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
    this.deps.ctx.audio.stopMusic();
    this.scenes.clear();
    this.scenes.push(
      new CharacterSelectScene(this, {
        player: p2 ? 1 : 0,
        current,
        onPick: (c) => {
          // StatManager.playerDie resets the fallen hero to PS_NORMAL; a newly picked hero
          // starts from its default state too.
          this.setHero(p2 ? 1 : 0, c);
          then();
        },
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
    const fresh = (c: CharacterDef): HeroPower =>
      this.campaign
        ? heroStart(c)
        : { powerState: c.damage.kind === 'powerup' ? 'small' : 'full', hp: startHp(c), kit: {} };
    const p1 = fresh(s.character);
    s.powerState = p1.powerState;
    s.hp = p1.hp;
    s.kit = p1.kit;
    s.kit2 = {};
    if (s.character2) {
      const p2 = fresh(s.character2);
      s.powerState2 = p2.powerState;
      s.hp2 = p2.hp;
      s.kit2 = this.campaign ? p2.kit : {};
    }
  }

  /** The heroes' kits to save: the ones put away, and a tutorial's own hero's live power. */
  private savedHeroKits(saved: GameState): Record<string, HeroPower> {
    const out = structuredClone(this.heroKits);
    const s = this.state;
    if (s.character !== saved.character)
      out[s.character.id] = { powerState: s.powerState, hp: s.hp, kit: { ...s.kit } };
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
      if (old)
        this.heroKits[old.id] =
          player === 1
            ? { powerState: s.powerState2, hp: s.hp2, kit: { ...s.kit2 } }
            : { powerState: s.powerState, hp: s.hp, kit: { ...s.kit } };
      const next = this.heroKits[c.id] ?? heroStart(c);
      delete this.heroKits[c.id];
      if (player === 1) {
        s.character2 = c;
        s.powerState2 = next.powerState;
        s.hp2 = next.hp;
        s.kit2 = { ...next.kit };
      } else {
        s.character = c;
        s.powerState = next.powerState;
        s.hp = next.hp;
        s.kit = { ...next.kit };
        swapInventory(this.bonus, c.id);
      }
      return;
    }
    const power = c.damage.kind === 'powerup' ? 'small' : 'full';
    if (player === 1) {
      s.character2 = c;
      s.powerState2 = power;
      s.hp2 = startHp(c);
      s.kit2 = {};
    } else {
      s.character = c;
      s.powerState = power;
      s.hp = startHp(c);
      s.kit = {};
    }
  }

  /**
   * No lives left: GAME OVER, then CONTINUE? YES / NO. `levelId` is the level the run ended in;
   * `player` picks the hero if the run continues. In campaign mode YES goes back to the map
   * (progress kept) and NO to the title.
   */
  gameOver(levelId: string | null = null, player = 0): void {
    this.scenes.clear();
    if (this.campaign) {
      // The file is saved as a continue leaves it (so NO keeps a playable file): fresh lives
      // (3, or 5 with two players), score and coins 0, the same heroes, map progress kept.
      const old = this.state;
      this.state = newGameState(old.character, old.character2);
      this.autosave();
      this.scenes.push(new GameOverScene(this, () => this.returnToMap()));
      return;
    }
    this.scenes.push(new GameOverScene(this, () => this.continueGame(levelId, player)));
  }

  /**
   * CONTINUE → YES. The original's EventManager.continueAfterDying: StatManager.resetAllStats(false)
   * (lives back to the starting count, score and coins 0, power-ups gone) and
   * changeToFirstWorldLevel (the first level of the current world, from its start), then
   * character select as for a new level.
   */
  continueGame(levelId: string | null, player = 0): void {
    const old = this.state;
    this.state = newGameState(old.character, old.character2);
    this.state.warped = old.warped;
    const id = levelId === null ? null : this.firstLevelOfWorld(levelId);
    if (id === null) {
      this.showTitle();
      return;
    }
    this.respawn(id, { mode: 'stand' }, player);
  }

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
