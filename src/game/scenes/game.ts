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
import { CreditsScene } from './credits';
import { WorldMapScene, type WorldMapOptions } from './world-map';
import type { MapProgress, PageId } from '../map/types';
import {
  clearLevel,
  conditionCount,
  conditionMet,
  entryLevel,
  findLevelNode,
  findSecret,
  isOpen,
  isPageOpen,
  mainLevel,
  newMapProgress,
  openMetExits,
  warpTo,
} from '../map/rules';
import { mapPage } from '@content/worldmap';
import { campaignLevel } from '../level/campaign';
import { isLostLevel, warpsOpened, workingWarps } from '../level/lost-campaign';
import { abilityHint } from './hints';
import { fontText } from '../hud/text';
import { levelTutorial, newTutorialRun, stageTutorial, type TutorialRun } from '../tutorial/stage-tutorial';
import {
  FIRST_HERO,
  loadSave,
  saveFromState,
  stateFromSave,
  tutorialHeroes,
  writeSave,
  type SaveFile,
  type SaveSlot,
} from '@game/save/save-files';

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
}

/** Touch when the on-screen pad is shown, else a connected gamepad, else the keyboard. */
export type ControlScheme = 'touch' | 'gamepad' | 'keyboard';

/** Orchestrates scenes and carries GameState between levels. */
export class Game {
  readonly scenes = new SceneStack();
  state: GameState;
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
  /** The campaign's file as last written (the base `autosave` updates). */
  private campaignSave: SaveFile | null = null;
  /** The node the hero last stood on in each page (SaveFile.lastNode), for map travel. */
  mapLastNode: Record<PageId, string> = {};
  /**
   * Page-qualified map ids (rules.revealId) opened but not yet drawn in: each page draws in its
   * own when the hero first arrives there (SaveFile.pendingReveal).
   */
  pendingReveal: string[] = [];
  /** The file's developer "Unlock all" map flag (SaveFile.devUnlockAll); see `mapUnlockAll`. */
  devUnlockAll = false;
  /** The file's developer "All heroes" flag (SaveFile.devAllHeroes); see `heroLocked`. */
  devAllHeroes = false;
  /** Heroes freed on the campaign's file (SaveFile.freed); see `heroLocked`. */
  freed: string[] = [FIRST_HERO];
  /**
   * The stage tutorial being played (1-0): its lesson, kept across respawns and its pipe room;
   * null outside one (src/game/tutorial/stage-tutorial.ts).
   */
  tutorialRun: TutorialRun | null = null;
  /** Heroes whose training question was answered on the campaign's file (SaveFile.tutorials). */
  tutorials: string[] = [];

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
   * marked as cleared and saved, and the title follows (owner decision, 2026-10-05).
   *
   * The Lost Levels follow the NES rules (owner decision, 2026-10-05): 8-4 counts a game beaten
   * (worlds A-D open after 8) and, without warps, goes on to World 9; World 9 and D-4 end the game,
   * D-4 with the credits (see showLostEnding).
   */
  showEnding(from = ''): void {
    if (from.startsWith('ll-')) return this.showLostEnding(from);
    const below = this.scenes.top;
    const world = below instanceof LevelScene ? below.world : null;
    const head = world ? world.castleText.splice(0) : [];
    this.deps.announcer?.say(`${head.filter(Boolean).join(' ')} Credits.`.trim());
    this.scenes.push(new CreditsScene(this, head, () => this.afterCredits(from), world));
  }

  /**
   * The credits are over: campaign files record the clear and save, then the title (SMB 8-4) or
   * the map page of the castle (Lost Levels D-4). Otherwise the title.
   */
  private afterCredits(from: string): void {
    if (this.campaign) {
      const s = this.state;
      s.checkpoint = null;
      s.time = null;
      if (!isLostLevel(from)) this.mapProgress.gameCleared = true;
      this.addReveal(clearLevel(this.mapProgress, from, this.deps.getLevel));
      this.autosave();
      if (isLostLevel(from)) return this.returnToMap();
    }
    this.showTitle();
  }

  /**
   * The Lost Levels' game ends: 8-4 (on to World 9 without warps), 9-4 and D-4 (ll-13-4), each
   * with the owner's card (the NES wording, 2026-10-06). The card is the castle's thanks: those
   * castles say nothing themselves (World.updateBossClear), and the card is drawn where their
   * text would be, over the level, with the HUD's score above it as in the SMB 8-4 ending.
   * Start or B continues ("PUSH BUTTON B TO SELECT A WORLD": there is no world picker, so B
   * goes on like Start). 8-4 then shows the games-beaten tally (and, warped, why World 9 stays
   * shut) before World 9 or the title; 9-4 goes to the title; D-4 rolls the credits over the
   * castle, scrolling the card away (the SMB 8-4 path), then the title.
   *
   * Campaign play (a save file from the map, owner decision for 0.4.0) has its own unlock rules,
   * read from the file alone (rules.conditionMet; the global NES progress store is left alone):
   * World A opens once 8-4 is beaten ('llLetters'), World 9 once all 32 levels from 1-1 to 8-4
   * are cleared ('ll9'). The clear is recorded on the castle's page (the level → page lookup)
   * and saved as the card shows, and the end goes back to that page: 8-4 after a page saying
   * what is open (the map then draws in the World A warp's road, and World 9's when it opened),
   * 9-4 after the card, D-4 after the credits.
   */
  private showLostEnding(from: string): void {
    const s = this.state;
    const campaign = this.campaign !== null;
    const prog = this.mapProgress;
    const firstClear = campaign && !prog.cleared.includes(from);
    const nineBefore = campaign && conditionMet(prog, 'll9');
    // Campaign: the clear first, so a condition the ending makes true opens with a draw-in.
    const warpsBefore = campaign ? workingWarps(prog) : null;
    if (campaign) {
      s.checkpoint = null;
      s.time = null;
      this.addReveal(clearLevel(this.mapProgress, from, this.deps.getLevel));
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
    if (from === 'll-8-4' && campaign) {
      // What is open now ('!' when this clear opened it).
      const page = [firstClear ? 'WORLD A IS OPEN!' : 'WORLD A IS OPEN.'];
      if (!conditionMet(prog, 'll9'))
        page.push('', 'WORLD 9 OPENS ONCE LOST 1-1', `TO 8-4 ARE CLEARED (${conditionCount(prog, 'll9')}).`);
      else page.push(nineBefore ? 'WORLD 9 IS OPEN.' : 'WORLD 9 IS OPEN!');
      then = () => {
        this.deps.announcer?.say(page.filter(Boolean).join(' '));
        this.scenes.clear();
        this.scenes.push(
          new MessageScene(
            this,
            [...page, '', fontText(`PRESS ${abilityHint(this, 'OK', 'jump')}`)],
            () => this.returnToMap(),
            1800,
            ['start', 'attack', 'jump'], // as the card, plus A
          ),
        );
      };
    } else if (from === 'll-8-4') {
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
            1800,
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
    if (warpsBefore) {
      this.addReveal(warpsOpened(this.mapProgress, warpsBefore));
      this.autosave();
    }
    const audio = this.deps.ctx.audio;
    audio.stopMusic();
    audio.playJingle('world-clear');
    this.deps.announcer?.say(card.filter(Boolean).join(' '));
    if (!world) this.scenes.clear();
    this.scenes.push(new CardScene(this, card, then, world));
  }

  showTitle(): void {
    this.deps.ctx.audio.stopMusic();
    this.pendingLevel = null;
    this.playtestDone = null;
    this.quickRespawn = false;
    this.campaign = null;
    this.pendingReveal = [];
    this.devUnlockAll = false;
    this.endTutorial();
    this.devAllHeroes = false;
    this.scenes.clear();
    this.scenes.push(new TitleScene(this));
  }

  /**
   * The world map page `page` (default: where the hero stands), replacing every scene. Pages
   * whose castle exit's condition has come to hold since (rules.openMetExits) open first.
   */
  showMap(page?: PageId, opts: WorldMapOptions = {}): void {
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
      freed: this.freed.slice(),
      tutorials: this.tutorials.slice(),
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
   * `levelId`: the level counts as cleared, the secret is recorded, and back on the map what
   * that opened is drawn in (the 1-2 pipe: the road from 1-1 to World 1's warp spot).
   */
  campaignSecret(secret: string, levelId: string): void {
    if (!this.campaign) return;
    const p = this.mapProgress;
    const reveal = clearLevel(p, levelId, this.deps.getLevel);
    reveal.push(...findSecret(p, secret));
    this.returnToMap(reveal);
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

  showDevMenu(): void {
    this.scenes.push(new DevMenuScene(this));
  }

  /** Developer level select: any level, character and power state, with 99 lives. */
  devStart(levelId: string, character: CharacterDef, power: string, fullKit = false): void {
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
    this.goToLevel(levelId, { mode: 'stand' });
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
  openFile(slot: SaveSlot, save = loadSave(slot)): void {
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
    this.freed = save.freed.slice();
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
    };
    this.showMap(); // the map saves the file as it opens
  }

  /**
   * A file just created on the file select: its World 1 map, the hero standing on 1-0, Mario's
   * tutorial stage, where Toad tells the story (Bowser has brainwashed the heroes of other worlds;
   * Mario must find and free them). 1-1 opens once 1-0 is cleared (or skipped from its pause menu).
   */
  startNewFile(slot: SaveSlot, save: SaveFile): void {
    this.openFile(slot, save);
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
    // Campaign: the clear's way back to the map gives the file's hero back (endTutorial).
    if (this.campaign) {
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
    // with their scripted watch-mode start, whatever start the caller asked for.
    if (level.startMode === 'autowalk' || level.startMode === 'climb')
      start = { ...start, mode: level.startMode };
    this.state.world = level.world;
    this.state.stage = level.stage;
    this.deps.ctx.audio.stopMusic();
    this.deps.ctx.audio.setTempoScale(1);
    this.scenes.clear();
    this.deps.announcer?.say(`World ${level.world}-${level.stage}. ${this.state.lives} lives.`);
    // A stage tutorial has no clock (LevelScene stops it): the card shows none either. Any
    // other level ends a tutorial's run (its exit, outside the campaign, leads on to 1-1).
    const tutorial = levelTutorial(level);
    if (!tutorial) this.endTutorial();
    const time = tutorial ? null : startTime(level, this.state, start);
    this.scenes.push(new IntroScene(this, () => this.startLevel(level, start), time));
  }

  /** Straight into a level (pipes, bonus rooms); campaign play gets its variant (level/campaign.ts). */
  startLevel(level: LevelData, start: LevelStart): void {
    this.scenes.clear();
    this.scenes.push(new LevelScene(this, this.campaign ? campaignLevel(level) : level, start));
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

  /** Give player `player` hero `c`, starting from its default power (small, or full hp). */
  private setHero(player: 0 | 1, c: CharacterDef): void {
    const s = this.state;
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
