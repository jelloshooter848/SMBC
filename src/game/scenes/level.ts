import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import { px } from '@engine/math/units';
import { MAP_EXIT, TOWN_EXIT, type LevelData } from '../level/schema';
import { freshSeed, levelSeed, World, type WorldStart } from '../world/world';
import { DebugOverlay } from './debug-overlay';
import {
  drawSmb3Status,
  renderSmb3World,
  SMB3_WORLD_SHIFT,
  smb3Status,
  STATUS_BAR_Y,
} from '../hud/smb3-status';
import { drawHud } from '../hud/hud';
import { drawBossBar, drawSmb3HeroStats } from '../hud/smb3-hero-panel';
import { Larry } from '../entities/enemies/larry';
import { LIGHT_SKIES } from '../world/tile-render';
import { carriedKit } from '../entities/player';
import type { CharacterDef } from '../characters/character';
import type { Game } from './game';
import { PauseScene } from './pause';
import type { TouchLabels } from '@engine/input/touch';
import { levelTouchLabels, NO_TOUCH_BUTTONS } from '../touch-labels';
import { fontText } from '../hud/text';
import { SCREEN_W } from '@engine/viewport';
import { talkToCaptive } from './free-hero';
import { endStageRound } from '../arena/stage-round';
import { TutorialDirector } from '../tutorial/stage-tutorial';
import { applyHeldItems } from '../bonus/use';
import { CardScene } from './message';
import { beat, storyOn } from '../story/beats';
import { playStoryCards } from '../story/cards';
import { playLevelBeat } from '../story/level-beats';
import { playCastleRemark } from '../story/castle-remark';
import { ANCHOR_LARRY_PAGES, anchorHeroPage, STORY_CRYSTAL_BALL_PAGES } from '../story/script';
import { partnerNearSaid, talkToPartner } from '../story/partners';
import { abilityHint, controlScheme } from './hints';
import { ANCHOR_SAID } from '../entities/objects/anchor-drop';
import { airshipDied, airshipMenu, airshipWon, isAirshipArea, type AirshipRun } from './airship';

export type LevelStart = WorldStart;

/**
 * The crystal ball's card (Larry Koopa's, 4-2's airship), at most 26 columns a line; the
 * campaign's story shows STORY_CRYSTAL_BALL_PAGES instead.
 */
export const CRYSTAL_BALL_CARD: readonly string[] = [
  'THE CRYSTAL BALL SHOWS',
  'WHERE YOUR FRIENDS',
  'ARE HIDDEN!',
];

/**
 * The Moblin's cards in 2-1's hidden cave (0.4.10, owner design), each line at most 28 columns
 * (CARD_COLS), font characters only.
 */
export const MOBLIN_CARDS: readonly (readonly string[])[] = [
  ['...!'],
  ['YOU FOUND ME?!'],
  ["I'LL SHOW YOU A SECRET", 'PATH... AS LONG AS YOU', "DON'T TELL ANYONE."],
  ["IT'S A SECRET TO", 'EVERYBODY.'],
  // Named like every other NPC's card (0.4.35): the speaker, a blank line, the words.
].map((lines) => ['MOBLIN:', '', ...lines]);

/** Said when a hidden path's block is bumped (World.layPath). */
export const PATH_SAID = 'A path of clouds appears.';

/** The clock to keep when moving between two areas: only within the same world and stage. */
export function carryTime(from: LevelData, to: LevelData, time: number | null): number | undefined {
  if (time === null) return undefined;
  return from.world === to.world && from.stage === to.stage ? time : undefined;
}

/**
 * The music a level plays for `hero`: the hero's own overworld theme (CharacterDef.music) in a
 * plain overworld area, else the level's own. A campaign look's theme is never `overworld`, so a
 * restyled level (and its coin heaven) plays the restyle's music for every hero.
 */
export function levelMusic(level: LevelData, hero: Pick<CharacterDef, 'music'>): string {
  return hero.music && level.theme === 'overworld' ? hero.music : level.music;
}

export class LevelScene implements Scene {
  world: World;
  readonly debug = new DebugOverlay();
  private lastDebugToggle = { f1: false, f2: false };
  private started = false;
  /** This level was an arena round's stage and its exit ended the round (arena/stage-round.ts). */
  private roundOver = false;
  /** Back from scenes pushed over the level: the press that closed them must not jump. */
  private swallowJump = false;
  /** The stage tutorial played here (1-0 and its pipe room), else null. */
  readonly tutorial: TutorialDirector | null;

  constructor(
    private readonly game: Game,
    readonly level: LevelData,
    start: LevelStart,
  ) {
    // In play each visit plays out differently (swimming Cheep Cheeps, timers); headless sims and
    // tests (no GameDeps.freshSeeds) keep the level's fixed seed.
    const seed = start.seed ?? (game.deps.freshSeeds === true ? freshSeed() : levelSeed(level));
    this.world = new World(level, game.ctx, game.state, { ...start, seed });
    // The TALK prompt over a captive or a partner names its key ("TALK (UP)"); on touch "TALK",
    // the button it is then (0.4.35).
    this.world.talkHint = (verb) => fontText(abilityHint(game, verb, 'up'));
    // Campaign play: brainwashed heroes wait in some rooms until freed on this file.
    if (game.campaign)
      this.world.captives = {
        isFreed: (id) => game.freed.includes(id),
        hero: (id) => game.deps.characters.find((c) => c.id === id),
      };
    // The campaign's story (src/game/story): entities and the world check it.
    this.world.storyMode = storyOn(game);
    // Campaign play (as the story's): each hero's own items from the power blocks.
    if (this.world.storyMode) this.world.useHeroItems(level.heroItems ?? []);
    // The hero's remark at a fake Bowser's axe (story/castle-remark.ts, 0.4.23).
    if (this.world.storyMode)
      this.world.remarkHook = (level, hero, done) =>
        playCastleRemark(game, this.world, level, hero, () => {
          this.resumePlay();
          done();
        });
    // 4-2's anchor scene (world/anchor-scene.ts, 0.4.39): once per file, while the story plays.
    if (this.world.storyMode && !game.seen(beat.anchor42))
      this.world.anchorStory = {
        cards: (kind, hero, done, skip) => {
          const pages =
            kind === 'larry' ? ANCHOR_LARRY_PAGES : [anchorHeroPage(hero.def.id, fontText(hero.def.name))];
          playStoryCards(
            game,
            this.world,
            pages,
            () => {
              this.resumePlay();
              done();
            },
            {
              onSkip: () => {
                this.resumePlay();
                skip();
              },
            },
          );
        },
        say: (text) => game.deps.announcer?.say(text),
        started: () => game.markSeen(beat.anchor42),
        skipHint: () => abilityHint(game, 'SKIP', 'jump'),
      };
    // A stage tutorial has no clock (and keeps every life: TutorialDirector).
    this.tutorial = TutorialDirector.attach(game, this);
    if (this.tutorial) this.world.time = null;
    // Larry's airship challenge (scenes/airship.ts): no clock aboard, and co-op respawns are free.
    if (this.airship) {
      this.world.time = null;
      this.world.livesFree = true;
    }
  }

  /** The airship challenge this level is part of (deck or room, while a run is on), else null. */
  get airship(): AirshipRun | null {
    return isAirshipArea(this.level.id) ? this.game.airship : null;
  }

  enter(): void {
    this.playMusic();
    this.started = true;
    // Items used from the map (mushroom, flower, Starman) go to the hero who entered.
    const held = applyHeldItems(this.game, this.world);
    // Aboard Larry's airship a retry or NO restores the run: it keeps what they gave, once.
    if (held.some((o) => o.given)) this.airship?.itemsGiven(this.game.state);
  }

  /** The level's music (levelMusic), at the clock's tempo. */
  playMusic(): void {
    const music = levelMusic(this.level, this.game.state.character);
    this.game.ctx.audio.setTempoScale(this.world.time !== null && this.world.time <= 100 ? 1.4 : 1);
    this.game.ctx.audio.playMusic(music);
  }

  /** Play on after scenes pushed over the level (a captive's unlock flow): music back on. */
  resume(): void {
    this.game.ctx.audio.stopMusic();
    this.playMusic();
    this.swallowJump = true;
  }

  /**
   * Play on after a story card over the level (a partner's pages, a restyle remark, Larry,
   * Bowser in 8-4): the music never stopped, so it plays on untouched; only the press that
   * closed the card is kept from making the hero jump.
   */
  resumePlay(): void {
    this.swallowJump = true;
  }

  update(input: InputFrame, inputs: InputFrame[] = [input]): void {
    if (this.swallowJump) {
      this.swallowJump = false;
      for (const f of inputs) f.consumeJumpBuffer();
    }
    // The campaign's story scenes in a level (a restyle's remark, Larry, Bowser in 8-4).
    if (playLevelBeat(this.game, this)) return;
    this.handleDebugKeys();
    if (this.debug.freeCamera) {
      const keys = this.game.deps.debugKeys;
      const step = keys?.has('ShiftLeft') ? px(16) : px(4);
      if (keys?.has('ArrowLeft')) this.world.camera.x = Math.max(0, this.world.camera.x - step);
      if (keys?.has('ArrowRight'))
        this.world.camera.x = Math.min(this.world.camera.maxX, this.world.camera.x + step);
      return;
    }
    if (
      inputs.some((f) => f.pressed('start')) &&
      this.world.activePlayers().length > 0 &&
      this.started &&
      // MENU skips the anchor scene instead (world/anchor-scene.ts).
      !this.world.anchorScene
    ) {
      // Aboard Larry's airship MENU is Continue / Give up, as in a mini game.
      this.game.scenes.push(this.airship ? airshipMenu(this.game) : new PauseScene(this.game, this.world));
      return;
    }
    this.world.camera.allowLeftScroll = this.game.ctx.assist.allowLeftScroll; // dev assists can change mid-level
    this.world.update(inputs);
    this.syncState();
    this.tutorial?.update();
    for (const ev of this.world.events.splice(0)) {
      this.handle(ev);
      // An arena round ended here (its exit): this level is gone with it, so nothing more of it
      // may act (a later event would play on over the arena's map).
      if (this.roundOver && !this.game.scenes.find((s) => s === this)) break;
    }
  }

  /** Player 1's hero decides the buttons: touch input only ever drives player 1. */
  touchLabels(): TouchLabels {
    // The castle's text waits for OK (World.castleWaiting).
    if (this.world.castleWaiting) return { ...NO_TOUCH_BUTTONS, jump: 'OK', start: 'MENU' };
    // 4-2's anchor scene: JUMP skips it (as in the opening scene).
    if (this.world.anchorScene) return { ...NO_TOUCH_BUTTONS, jump: 'SKIP' };
    return levelTouchLabels(this.world.players[0], this.world);
  }

  /** Mirror the player's power state into the carried game state. */
  private syncState(): void {
    const s = this.game.state;
    const p = this.world.player;
    s.powerState = p.powerState;
    s.hp = p.hp;
    s.kit = carriedKit(p);
    const p2 = this.world.players[1];
    if (p2) {
      s.powerState2 = p2.powerState;
      s.hp2 = p2.hp;
      s.kit2 = carriedKit(p2);
    }
    s.time = this.world.time;
  }

  private handle(ev: ReturnType<World['events']['splice']>[number]): void {
    const game = this.game;
    switch (ev.type) {
      case 'checkpoint':
        game.state.checkpoint = { level: this.level.id, x: ev.x, y: ev.y };
        break;
      case 'talk':
        // A captive hero: the unlock flow plays over the paused level (scenes/free-hero.ts).
        if (game.campaign && !game.playtestDone)
          talkToCaptive(game, this, ev.hero, this.world.players[ev.player]?.def);
        break;
      case 'partner':
        // A story partner: its pages over the frozen level, then play on (story/partners.ts).
        if (this.world.storyMode) talkToPartner(game, this, ev.who);
        break;
      case 'partner-near':
        game.deps.announcer?.say(
          partnerNearSaid(ev.who, ev.player, this.world.coop, controlScheme(game) === 'touch'),
        );
        break;
      case 'crystal-ball':
        this.takeCrystalBall(ev.next);
        break;
      case 'moblin':
        this.meetMoblin(ev.secret, ev.next);
        break;
      case 'path':
        game.deps.announcer?.say(PATH_SAID);
        break;
      case 'say':
        game.deps.announcer?.say(ev.text);
        break;
      case 'anchor':
        // The anchor scene says its own (world/anchor-scene.ts).
        if (!ev.scene)
          game.deps.announcer?.say(`${ANCHOR_SAID} Climb its chain: ${abilityHint(game, 'UP', 'up')}.`);
        break;
      case 'captive-near': {
        const name = game.deps.characters.find((c) => c.id === ev.hero)?.name ?? ev.hero;
        const who = this.world.coop ? `Player ${ev.player + 1}: ` : '';
        game.deps.announcer?.say(
          `${who}${name}. ${controlScheme(game) === 'touch' ? 'Press TALK' : 'Up to talk'}.`,
        );
        break;
      }
      case 'pipe': {
        // Back out to the village (the Top Secret Area's pipe, during a visit): the house's step.
        if (ev.target.level === TOWN_EXIT && game.town) {
          game.returnToTown(this.world);
          break;
        }
        // The way back to the map (the Top Secret Area's pipe): nothing is cleared.
        if (ev.target.level === MAP_EXIT || ev.target.level === TOWN_EXIT) {
          game.state.checkpoint = null;
          game.state.time = null;
          if (game.playtestDone) game.playtestDone();
          else if (game.campaign) game.returnToMap();
          else game.showTitle();
          break;
        }
        // Campaign: a secret warp zone's one pipe (level/campaign.ts) ends the level on the map.
        if (ev.target.secret && game.campaign) {
          game.state.checkpoint = null;
          game.state.time = null;
          game.campaignSecret(ev.target.secret, this.level.id);
          break;
        }
        const target = game.deps.getLevel(ev.target.level);
        const exitDir = ev.target.exitDir ?? 'none';
        const start: LevelStart = {
          x: ev.target.x,
          y: ev.target.y,
          mode:
            exitDir === 'up'
              ? 'pipe-exit'
              : exitDir === 'climb' || exitDir === 'fall' || exitDir === 'beam' || exitDir === 'spin'
                ? exitDir
                : target.startMode,
        };
        // A pipe into another world or stage is a warp. EventManager.levelTransfer loads a new
        // level for it (passedHw = false: the old checkpoint is gone), with a fresh clock.
        if (target.world !== this.level.world || target.stage !== this.level.stage) {
          game.state.warped = true;
          game.state.checkpoint = null;
          game.state.time = null;
          // Campaign: the warp ends the level on the map, at the target level's page (owner
          // decision; pages found by the level → page lookup, 'll-3-1' → 'll-3'), opening only
          // that page; otherwise character select, the WORLD card and the level, as the original
          // does. Lost Levels warp zones stay as on the NES, backward ones too.
          const from = game.campaign ? game.pageOfLevel(this.level.id) : null;
          const to = game.campaign ? game.pageOfLevel(target.id) : null;
          if (game.campaign && from && to && from !== to) game.campaignWarpToMap(from, to);
          else game.warpToLevel(target.id, start);
          break;
        }
        if (target.time === null) game.state.time = this.world.time;
        const time = carryTime(this.level, target, this.world.time);
        if (time !== undefined) start.time = time;
        if (exitDir === 'climb' && ev.target.chain) start.chain = true;
        // Level.changePlayerLoc (pipe and pit arrivals) ends with destroyNearbyEnemies(true).
        if (exitDir !== 'climb') start.clearEnemies = 'keep-piranhas';
        game.startLevel(target, start);
        break;
      }
      case 'exit':
        game.state.checkpoint = null;
        game.state.time = null;
        if (game.playtestDone) game.playtestDone();
        // A stage played as an arena round (arena/stage-round.ts): its exit passes the round.
        else if (endStageRound(game, 'pass')) this.roundOver = true;
        else if (ev.next === 'end') game.showEnding(this.level.parent ?? this.level.id);
        // Campaign: the clear is recorded and the map shows what it opened (flagpole or castle).
        // Otherwise on to the next level; a castle's "another castle" news is shown in the
        // level, next to Toad (World.castleText).
        else if (game.campaign) game.levelCleared(this.level.id);
        else game.goToLevel(ev.next, { mode: 'stand' });
        break;
      case 'died': {
        if (game.playtestDone) {
          game.playtestDone();
          return;
        }
        // Aboard Larry's airship a death costs no life: TRY AGAIN? YES / NO (scenes/airship.ts).
        if (this.airship) {
          airshipDied(game);
          return;
        }
        const s = game.state;
        // Decision 1: the hero's found items go (campaign: back to the basic kit).
        game.resetAfterDeath();
        s.time = null;
        // A stage tutorial: no life lost, straight back in at the current lesson.
        if (this.tutorial) {
          this.tutorial.respawn();
          break;
        }
        if (!game.ctx.assist.infiniteLives) s.lives--;
        // Campaign: the lost life is saved at once, so quitting now keeps the count.
        if (game.campaign && s.lives > 0) game.autosave();
        // Respawn at the checkpoint if one was reached, else at the start of the main level.
        const cp = s.checkpoint;
        const mainLevel = cp?.level ?? this.level.parent ?? this.level.id;
        if (s.lives <= 0) {
          s.lives = 0;
          game.gameOver(mainLevel, ev.player ?? 0);
          return;
        }
        // Feet on the bottom of the midpoint's row (Level.as hwPnt, startAtHalfwayPoint), which
        // also clears the enemies around it (destroyNearbyEnemies()).
        const start: LevelStart = cp
          ? { x: cp.x, y: cp.y ?? 12, mode: 'stand', clearEnemies: 'all' }
          : { mode: 'stand' };
        // Through character select first (Game.respawn), as in the original. Without a
        // checkpoint the level restarts in its first area (Level.reloadLevel: area a).
        game.respawn(cp ? mainLevel : game.firstArea(mainLevel), start, ev.player ?? 0);
        break;
      }
    }
  }

  /**
   * Larry Koopa's crystal ball touched (4-2's airship): its card over the frozen cabin, then, in
   * the campaign, 4-2's secret exit (Game.takeCrystalBall: the hint for every hidden hero, the
   * bonus road, the item inventory); a play-test ends; elsewhere play goes on to `next`.
   */
  private takeCrystalBall(next: string | null): void {
    const game = this.game;
    const audio = game.ctx.audio;
    audio.stopMusic();
    audio.playJingle('castle-clear');
    game.state.checkpoint = null;
    game.state.time = null;
    const done = () => {
      // A run aboard ends here (a dev round passes and goes to its result card).
      if (this.airship && airshipWon(game)) return;
      if (game.playtestDone) game.playtestDone();
      // The campaign's hand-off back to the map (Game.takeCrystalBall).
      else if (game.campaign) game.takeCrystalBall(this.level.id);
      else if (next) game.goToLevel(next, { mode: 'stand' });
      else game.showTitle();
    };
    // The campaign's story: two pages (docs/STORY.md 2.7), in the same place as the old card.
    if (storyOn(game))
      return playStoryCards(game, this.world, STORY_CRYSTAL_BALL_PAGES, done, { bottom: true });
    game.deps.announcer?.say(`${CRYSTAL_BALL_CARD.join(' ')} OK to continue.`);
    game.scenes.push(
      new CardScene(game, CRYSTAL_BALL_CARD, done, this.world, {
        panel: true,
        keys: ['start', 'attack', 'jump'],
        prompt: () => abilityHint(game, 'OK', 'jump'),
      }),
    );
  }

  /**
   * The Moblin in 2-1's hidden cave saw a player (objects/moblin.ts): his cards over the frozen
   * cave, one after another (each read out, OK to go on), the secret jingle on the last; then in
   * the campaign the Top Secret exit (Game.campaignTopSecret: `secret` found, only its road draws
   * in on the map; 2-1 is not cleared). A play-test ends; elsewhere play goes on to `next`.
   */
  private meetMoblin(secret: string, next: string | null): void {
    const game = this.game;
    const audio = game.ctx.audio;
    audio.stopMusic();
    game.state.checkpoint = null;
    game.state.time = null;
    const end = () => {
      if (game.playtestDone) game.playtestDone();
      else if (game.campaign) game.campaignTopSecret(secret, this.level.id);
      else if (next) game.goToLevel(next, { mode: 'stand' });
      else game.showTitle();
    };
    const show = (i: number) => {
      const lines = MOBLIN_CARDS[i] as readonly string[];
      const last = i === MOBLIN_CARDS.length - 1;
      if (last) audio.sfx('secret');
      game.deps.announcer?.say(`${lines.filter(Boolean).join(' ')} ${last ? 'OK to continue.' : 'OK.'}`);
      game.scenes.push(
        new CardScene(
          game,
          lines,
          () => {
            game.scenes.pop();
            if (last) end();
            else show(i + 1);
          },
          this.world,
          // In a box at the top, so the Moblin and his fires on the floor stay in view.
          {
            panel: true,
            top: true,
            keys: ['start', 'attack', 'jump'],
            prompt: () => abilityHint(game, 'OK', 'jump'),
          },
        ),
      );
    };
    show(0);
  }

  private handleDebugKeys(): void {
    const keys = this.game.deps.debugKeys;
    if (!keys) return;
    const f1 = keys.has('F1');
    const f2 = keys.has('F2');
    if (f1 && !this.lastDebugToggle.f1) this.debug.enabled = !this.debug.enabled;
    if (f2 && !this.lastDebugToggle.f2) {
      this.debug.freeCamera = !this.debug.freeCamera;
      if (this.debug.freeCamera) this.debug.enabled = true;
    }
    this.lastDebugToggle = { f1, f2 };
  }

  render(r: Renderer): void {
    // A stage tutorial has no clock: the flagpole's clear (World.startClear: time ??= 0) must not
    // show TIME 000 under Bowser's spell (0.4.36).
    const time = this.world.timeHidden || this.tutorial ? null : this.world.time;
    // Larry's airship is SMB3's: its status bar along the bottom instead of the HUD on top.
    if (isAirshipArea(this.level.id)) {
      renderSmb3World(r, this.world);
      const ctx = this.game.ctx;
      const status = smb3Status(this.game.state, this.world.player, time);
      drawSmb3Status(r, ctx.assets, status, this.world.frame, ctx.reduceFlashing);
      // The heroes' own hit points, bars, hearts and tool belt in a box of the bar, over its
      // empty card slots (never over the deck, where Larry's ship pins the hero to the left).
      drawSmb3HeroStats(r, ctx.assets, this.game.state, this.world.players);
      // Mega Man's airship: Larry's hit points as a Mega Man 2 style bar (0.4.39).
      const larry = this.world.entities.find((e): e is Larry => e instanceof Larry && e.hpMode);
      if (larry && larry.state !== 'fly') drawBossBar(r, larry.maxHp, larry.hp);
      this.drawItemCaption(r);
      this.debug.render(r, this.world, this.game.deps.fps?.() ?? 0, {
        shiftY: SMB3_WORLD_SHIFT,
        bottom: STATUS_BAR_Y,
      });
      return;
    }
    this.world.render(r);
    drawHud(r, this.game.ctx.assets, this.game.state, time, this.world.frame, this.world.players, {
      covered: (x, y, w, h) => this.world.spriteIn(x, y, w, h),
      // A fill-up spot (the Top Secret Area) shows its name instead of WORLD and TIME.
      ...(this.level.bonus ? { area: this.level.name } : {}),
      outline: LIGHT_SKIES.has(this.world.level.theme),
    });
    this.drawItemCaption(r);
    this.drawSkipHint(r);
    this.tutorial?.render(r);
    if (this.world.castleWaiting) this.drawCastlePrompt(r);
    this.debug.render(r, this.world, this.game.deps.fps?.() ?? 0);
  }

  /** A hero item's name under the HUD the first time it is found (World.itemCaption). */
  private drawItemCaption(r: Renderer): void {
    const c = this.world.itemCaption;
    if (!c) return;
    const t = fontText(c.text);
    const x = (SCREEN_W - t.length * 8) >> 1;
    // On a black strip so it reads over clouds and sky alike.
    r.rect(x - 4, 46, t.length * 8 + 8, 12, '#000');
    r.text(this.game.ctx.assets.sheet('font'), t, x, 48);
  }

  /** "SKIP (key)" at the bottom right while 4-2's anchor scene plays between its cards. */
  private drawSkipHint(r: Renderer): void {
    const s = this.world.anchorScene;
    if (!s || s.waiting || s.over) return;
    const t = fontText(abilityHint(this.game, 'SKIP', 'jump'));
    const x = SCREEN_W - 8 - t.length * 8;
    r.rect(x - 4, 212, t.length * 8 + 8, 12, '#000');
    r.text(this.game.ctx.assets.sheet('font'), t, x, 214);
  }

  /** The OK prompt under the castle's text while it waits (World.castleWaiting). */
  private drawCastlePrompt(r: Renderer): void {
    const ok = fontText(abilityHint(this.game, 'OK', 'jump'));
    const y = 80 + this.world.castleText.length * 16;
    r.text(this.game.ctx.assets.sheet('font'), ok, (SCREEN_W - ok.length * 8) >> 1, y);
  }
}
