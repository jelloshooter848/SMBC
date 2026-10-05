import { SceneStack } from '@engine/scene';
import { loadProgress, saveProgress } from '@engine/save/progress';
import type { GameContext, GameState } from '../context';
import { newGameState } from '../context';
import { startHp, type CharacterDef } from '../characters/character';
import { TitleScene } from './title';
import { IntroScene } from './intro';
import { LevelScene, type LevelStart } from './level';
import { startTime } from '../world/world';
import { pad, SCORE_MAX } from '../hud/hud';
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
import { MessageScene } from './message';
import { WorldMapScene, type WorldMapOptions } from './world-map';
import type { MapProgress } from '../map/types';
import { clearLevel, entryLevel, isOpen, isWorldOpen, newMapProgress, warpTo } from '../map/rules';
import { mapPage } from '@content/worldmap';
import {
  loadSave,
  saveFromState,
  stateFromSave,
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
}

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
  /** The node the hero last stood on in each world (SaveFile.lastNode), for map travel. */
  mapLastNode: Record<number, string> = {};
  /** Campaign: map ids a warp opened, drawn in the next time the map is shown. */
  private warpReveal: string[] = [];

  constructor(readonly deps: GameDeps) {
    this.state = newGameState(deps.characters[0] as CharacterDef);
  }

  get ctx(): GameContext {
    return this.deps.ctx;
  }

  /**
   * After the last castle: the princess's thanks, the final score, then the title. In campaign
   * mode the clear is recorded, the file marked as cleared and saved, and the ending leads back
   * to the map (World 8).
   */
  showEnding(from = ''): void {
    const s = this.state;
    let reveal: string[] | null = null;
    if (this.campaign) {
      s.checkpoint = null;
      s.time = null;
      reveal = clearLevel(this.mapProgress, from, this.deps.getLevel);
      if (this.campaignSave) this.campaignSave = { ...this.campaignSave, gameCleared: true };
      this.autosave();
    }
    // The Lost Levels: clearing 8-4 opens worlds A-D; a run without warps goes on to World 9.
    let next: string | null = null;
    if (from === 'll-8-4') {
      const progress = loadProgress();
      progress.lost.letters = true;
      if (!s.warped) {
        progress.lost.world9 = true;
        next = 'll-9-1-start';
      }
      saveProgress(progress);
    }
    const audio = this.deps.ctx.audio;
    audio.stopMusic();
    audio.playJingle('world-clear');
    this.deps.announcer?.say(`Thank you ${s.character.name}! The princess is safe. Final score ${s.score}.`);
    this.scenes.clear();
    this.scenes.push(
      new MessageScene(
        this,
        [
          `THANK YOU ${s.character.hudName}!`,
          '',
          'THE PRINCESS IS SAFE',
          'AND THE KINGDOM IS FREE.',
          '',
          `FINAL SCORE ${pad(Math.min(s.score, SCORE_MAX), 7)}`,
          '',
          'PRESS START',
        ],
        () =>
          reveal
            ? this.returnToMap(reveal)
            : next
              ? this.goToLevel(next, { mode: 'stand' })
              : this.showTitle(),
        1800,
      ),
    );
  }

  showTitle(): void {
    this.deps.ctx.audio.stopMusic();
    this.pendingLevel = null;
    this.playtestDone = null;
    this.quickRespawn = false;
    this.campaign = null;
    this.warpReveal = [];
    this.scenes.clear();
    this.scenes.push(new TitleScene(this));
  }

  /** The world map page of `world` (default: where the hero stands), replacing every scene. */
  showMap(world?: number, opts: WorldMapOptions = {}): void {
    this.pendingLevel = null;
    this.playtestDone = null;
    this.quickRespawn = false;
    this.scenes.clear();
    this.scenes.push(new WorldMapScene(this, world ?? this.mapProgress.position.world, opts));
  }

  /**
   * A level node picked on the map: character select with the current hero preselected (keeping
   * it keeps its power; a different hero starts from its default), then player two's own pick in
   * co-op, then the level (its intro scene when it has one). Back returns to the map.
   */
  enterLevelFromMap(levelId: string): void {
    const s = this.state;
    const back = () => this.scenes.pop();
    const go = () => {
      s.checkpoint = null;
      this.deps.ctx.audio.stopMusic();
      this.goToLevel(entryLevel(levelId, this.deps.getLevel), { mode: 'stand' });
    };
    const pick = (player: 0 | 1, then: () => void) =>
      new CharacterSelectScene(this, {
        player,
        current: player === 1 ? (s.character2 as CharacterDef) : s.character,
        onPick: (c) => {
          if (c !== (player === 1 ? s.character2 : s.character)) this.setHero(player, c);
          then();
        },
        onCancel: back,
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
    this.mapLastNode[p.position.world] = p.position.node;
    const save: SaveFile = {
      ...saveFromState(base, this.state),
      cleared: p.cleared.slice(),
      worlds: p.worlds.slice(),
      secrets: p.secrets.slice(),
      position: { world: p.position.world, node: p.position.node },
      lastNode: { ...this.mapLastNode },
    };
    this.campaignSave = save;
    writeSave(save);
  }

  /**
   * Campaign: back to the map from a level (a clear, "Quit to map", or a continue). Saves the
   * file first, then shows the page the hero stands on, drawing in `reveal` and whatever a warp
   * opened since the map was last shown.
   */
  returnToMap(reveal: string[] = []): void {
    const all = [...this.warpReveal, ...reveal.filter((id) => !this.warpReveal.includes(id))];
    this.warpReveal = [];
    this.state.checkpoint = null;
    this.state.time = null;
    this.deps.ctx.audio.stopMusic();
    this.deps.ctx.audio.setTempoScale(1);
    this.autosave();
    this.showMap(this.mapProgress.position.world, all.length ? { reveal: all } : {});
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
  campaignWarp(world: number): void {
    if (!this.campaign) return;
    const pos = this.mapProgress.position;
    this.mapLastNode[pos.world] = pos.node; // map travel back returns here
    const opened = warpTo(this.mapProgress, world);
    this.warpReveal.push(...opened.filter((id) => !this.warpReveal.includes(id)));
    const start = mapPage(world)?.nodes.find((n) => n.kind === 'start');
    if (start) this.mapProgress.position = { world, node: start.id };
    this.autosave();
  }

  /**
   * Map menu "Worlds": show the page of open world `world` with the hero on the node it last
   * stood on there (its start when never visited). Lets a player who warped ahead go back to
   * worlds left unfinished.
   */
  travelToWorld(world: number): void {
    const p = this.mapProgress;
    const page = mapPage(world);
    if (!page || !isWorldOpen(p, world)) return;
    const last = this.mapLastNode[world];
    const node =
      last && page.nodes.some((n) => n.id === last) && isOpen(p, page, last)
        ? last
        : (page.nodes.find((n) => n.kind === 'start')?.id ?? 'start');
    this.mapLastNode[p.position.world] = p.position.node;
    p.position = { world, node };
    this.deps.ctx.audio.stopMusic();
    this.showMap(world); // the map announces the page and node, and saves
  }

  /** Map menu "Save and quit": save the file, then the title. */
  saveAndQuit(): void {
    this.autosave();
    this.showTitle();
  }

  showCharacterSelect(): void {
    this.scenes.replace(new CharacterSelectScene(this));
  }

  get devMode(): boolean {
    return this.deps.settings?.dev ?? false;
  }

  showDevMenu(): void {
    this.scenes.push(new DevMenuScene(this));
  }

  /** Developer level select: any level, character and power state, with 99 lives. */
  devStart(levelId: string, character: CharacterDef, power: string, fullKit = false): void {
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
    this.state = newGameState(this.state.character);
    this.state.lives = 99;
    this.playtestDone = done;
    this.quickRespawn = true;
    this.campaign = null;
    this.startLevel(level, { mode: 'stand' });
  }

  /** Play a level decoded from a share link with the default character. */
  playShared(level: LevelData): void {
    this.sharedLevel = level;
    this.state = newGameState(this.deps.characters[0] as CharacterDef);
    this.playtestDone = null;
    this.quickRespawn = false;
    this.campaign = null;
    this.startLevel(level, { mode: 'stand' });
  }

  newGame(character: CharacterDef, levelId = '1-1', character2: CharacterDef | null = null): void {
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
    this.warpReveal = [];
    this.mapLastNode = { ...save.lastNode };
    this.mapProgress = {
      cleared: save.cleared.slice(),
      worlds: save.worlds.slice(),
      secrets: save.secrets.slice(),
      position: { world: save.position.world, node: save.position.node },
    };
    this.showMap(); // the map saves the file as it opens
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
    this.state.world = level.world;
    this.state.stage = level.stage;
    this.deps.ctx.audio.stopMusic();
    this.deps.ctx.audio.setTempoScale(1);
    this.scenes.clear();
    this.deps.announcer?.say(`World ${level.world}-${level.stage}. ${this.state.lives} lives.`);
    const time = startTime(level, this.state, start);
    this.scenes.push(new IntroScene(this, () => this.startLevel(level, start), time));
  }

  /** Straight into a level (pipes, bonus rooms). */
  startLevel(level: LevelData, start: LevelStart): void {
    this.scenes.clear();
    this.scenes.push(new LevelScene(this, level, start));
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
      return first;
    } catch {
      return levelId;
    }
  }
}
