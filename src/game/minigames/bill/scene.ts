import type { Scene } from '@engine/scene';
import { NO_INPUT, type InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { TouchLabels } from '@engine/input/touch';
import { SCREEN_W } from '@engine/viewport';
import type { Game } from '../../scenes/game';
import { CheatCode, DEV_CODE } from '../../scenes/cheat';
import { abilityHint } from '../../scenes/hints';
import { NO_TOUCH_BUTTONS } from '../../touch-labels';
import { MiniGameMenuScene } from '../menu';
import type { MiniGameResult } from '../types';
import { drawBanner } from '../megaman/scene';
import { CONTRA_MUSIC, soundId } from './art';
import { CARD_ANIM, drawCard } from './card';
import { GUNS } from './commando';
import { Jungle, type JungleEvent } from './jungle';
import { drawJungle } from './view';
import type { WeaponId } from './stage';

/** Lives for a round, and with the Konami code entered on the stage card (Contra's 30). */
export const LIVES = 3;
export const KONAMI_LIVES = 30;
/** After the heart's explosion chain: the banner, the jingle, then the round passes. */
export const WIN_BANNER_AT = 140;
export const WIN_JINGLE = 160;
export const WIN_FRAMES = 420;
/** START is swallowed this long after the Konami code (the NES code ends B A START). */
export const KONAMI_START_GUARD = 30;
/** Frames between the soft flashes over the breach and the win's booms (under 3 a second). */
export const FLASH_EVERY = 24;
/** GAME OVER shows this long before the round fails. */
export const GAME_OVER_FRAMES = 180;

export type JunglePhaseOfScene = 'card' | 'play' | 'over';

export interface JungleOptions {
  seed?: number;
  /** Start playing at once, without the stage card (tests). */
  skipCard?: boolean;
}

/** Spoken weapon names, for the announcer. */
const WEAPON_SAID: Record<WeaponId, string> = {
  M: 'Machine gun!',
  S: 'Spread gun!',
  L: 'Laser!',
  F: 'Fire gun!',
  R: 'Rapid bullets!',
  B: 'Barrier! Nothing can touch Bill for a while.',
};

/**
 * Bill's mini game, Jungle Assault: a Contra-style stage card (the Konami code works there),
 * then an NES Contra stage 1-style run-and-gun played as Bill in Contra form (commando.ts): three
 * lives, one hit each, falcon weapons, exploding bridges, the defense wall and Red Falcon's heart
 * in the alien lair. The heart bursting passes; losing every life fails (GAME OVER, then the
 * shared retry); the menu's Give up quits. It runs its own simulation (jungle.ts) with a fresh
 * state, so the campaign is never touched.
 */
export class JungleScene implements Scene {
  readonly jungle: Jungle;
  phase: JunglePhaseOfScene = 'card';
  /** Frames since the scene started, and in the current phase. */
  t = 0;
  phaseT = 0;
  /** The Konami code was entered (30 lives). */
  konami = false;
  /** The round's lives (3, or 30 with the code). */
  lives = LIVES;
  /** The win's banner, and GAME OVER. */
  banner: string[] | null = null;
  private readonly cheat = new CheatCode(DEV_CODE);
  /** Frames after the Konami code during which START is swallowed. */
  private startGuard = 0;
  private readonly seed: number;
  private music: string | null = null;
  private winT = -1;
  private gameOverT = -1;

  constructor(
    private readonly game: Game,
    private readonly done: (result: MiniGameResult) => void,
    opts: JungleOptions = {},
  ) {
    this.seed = opts.seed ?? 1;
    this.jungle = this.newJungle();
    if (opts.skipCard) this.phase = 'play';
  }

  private newJungle(): Jungle {
    const assist = this.game.ctx.assist;
    return new Jungle({
      seed: this.seed,
      lives: this.lives,
      noDamage: () => assist.invulnerable,
      infiniteLives: () => assist.infiniteLives,
    });
  }

  enter(): void {
    this.game.ctx.audio.stopMusic();
    if (this.phase === 'card') {
      this.game.ctx.audio.playJingle(CONTRA_MUSIC.card);
      this.say(
        `Jungle Assault. Stage 1: Jungle. Red Falcon's aliens have taken Bill's mind. Fight through the jungle to the alien heart! ${LIVES} lives. ${this.hint('JUMP', 'jump')} starts. ${this.hint('MENU', 'start')} for the menu.`,
      );
    } else this.startPlay();
  }

  exit(): void {
    this.game.ctx.audio.setTempoScale(1);
  }

  private say(text: string): void {
    this.game.deps.announcer?.say(text);
  }

  private hint(label: string, action: Parameters<typeof abilityHint>[2]): string {
    return abilityHint(this.game, label, action);
  }

  private playMusic(id: string): void {
    if (this.music === id) return;
    this.music = id;
    this.game.ctx.audio.playMusic(id);
  }

  private stopMusic(): void {
    this.music = null;
    this.game.ctx.audio.stopMusic();
  }

  /** The card's prompt: SKIP while it is still drawing, then OK (with the JUMP key). */
  get prompt(): string {
    return this.phaseT < CARD_ANIM ? this.hint('SKIP', 'jump') : this.hint('OK', 'jump');
  }

  touchLabels(): TouchLabels {
    if (this.phase === 'card')
      // FIRE stays (blank) so the Konami code can be entered on the touch buttons too.
      return {
        ...NO_TOUCH_BUTTONS,
        jump: this.phaseT < CARD_ANIM ? 'SKIP' : 'OK',
        attack: '',
        start: 'MENU',
      };
    if (this.phase === 'over' || this.decided) return { ...NO_TOUCH_BUTTONS };
    const b = this.jungle.bill;
    const out: TouchLabels = { ...NO_TOUCH_BUTTONS, start: 'MENU' };
    const ph = this.jungle.phase;
    if (!b.alive || ph === 'breach' || ph === 'won') return out;
    out.attack = GUNS[b.gun].label;
    // In the river he cannot jump (Contra's), and under it he cannot shoot.
    out.jump = b.state === 'water' ? null : 'JUMP';
    if (b.state === 'water' && b.dive) out.attack = null;
    return out;
  }

  /** Won or lost: the menu no longer opens. */
  get decided(): boolean {
    return this.jungle.phase === 'won' || this.jungle.phase === 'lost';
  }

  update(input: InputFrame): void {
    if (this.phase === 'over') return;
    // (START right after the Konami code is the NES code's last press: it opens no menu)
    if (this.startGuard > 0) this.startGuard--;
    if (!this.decided && input.pressed('start') && this.startGuard === 0) {
      this.game.scenes.push(new JungleMenuScene(this.game, () => this.finish('quit')));
      return;
    }
    this.t++;
    this.phaseT++;
    if (this.phase === 'card') return this.updateCard(input);
    this.updatePlay(input);
  }

  private updateCard(input: InputFrame): void {
    if (this.cheat.feed(input)) {
      // The code's last press (JUMP) must not also start the stage.
      input.consumeJumpBuffer();
      this.startGuard = KONAMI_START_GUARD;
      if (!this.konami) {
        this.konami = true;
        this.lives = KONAMI_LIVES;
        this.jungle.rest = KONAMI_LIVES - 1;
        this.game.ctx.audio.sfx(soundId('konami'));
        this.say(`Konami code! ${KONAMI_LIVES} lives.`);
      }
      return;
    }
    if (input.pressed('jump')) {
      input.consumeJumpBuffer();
      if (this.phaseT < CARD_ANIM) {
        this.phaseT = CARD_ANIM;
        return;
      }
      return this.startPlay();
    }
    // The briefing stays until JUMP (text never moves on by itself, owner note 4).
  }

  private startPlay(): void {
    this.phase = 'play';
    this.phaseT = 0;
    this.playMusic(CONTRA_MUSIC.stage);
    const fire = this.hint('FIRE', 'attack');
    const jump = this.hint('JUMP', 'jump');
    this.say(
      `Go! ${fire} shoots, ${jump} jumps. Hold UP or DOWN to aim; DOWN alone lies flat. DOWN and ${jump} drops through a ledge. In the river, DOWN ducks under. Shoot capsules and open pillboxes for falcon weapons. One hit costs a life.`,
    );
  }

  private updatePlay(input: InputFrame): void {
    const j = this.jungle;
    j.update(j.phase === 'won' ? NO_INPUT : input);
    for (const e of j.events) this.onEvent(e);
    j.events.length = 0;
    if (j.phase === 'won') {
      this.winT++;
      if (this.winT === WIN_BANNER_AT) this.showWin();
      if (this.winT === WIN_JINGLE) this.game.ctx.audio.playJingle(CONTRA_MUSIC.victory);
      if (this.winT >= WIN_FRAMES) this.finish('pass');
    }
    if (j.phase === 'lost') {
      this.gameOverT++;
      if (this.gameOverT >= GAME_OVER_FRAMES) this.finish('fail');
    }
  }

  private onEvent(e: JungleEvent): void {
    const audio = this.game.ctx.audio;
    switch (e.type) {
      case 'sound':
        audio.sfx(soundId(e.sound));
        return;
      case 'weapon':
        this.say(WEAPON_SAID[e.weapon]);
        return;
      case 'died': {
        // (`rest`: the lives in reserve, one of which he drops in with now)
        const left = e.rest;
        if (this.game.ctx.assist.infiniteLives) this.say('Bill is down!');
        else if (left > 0)
          this.say(left === 1 ? 'Bill is down! Last life.' : `Bill is down! ${left} lives left.`);
        return;
      }
      case 'respawn':
        return;
      case 'phase':
        switch (e.phase) {
          case 'wall':
            this.playMusic(CONTRA_MUSIC.boss);
            this.say(
              'The defense wall! Shoot the sensor core in its door; mind the cannons and the sniper on top.',
            );
            return;
          case 'breach':
            this.say('The core is destroyed! The wall blows apart.');
            return;
          case 'walk':
            this.stopMusic();
            this.say('On through the wall, into the alien lair.');
            return;
          case 'lair':
            this.playMusic(CONTRA_MUSIC.lair);
            this.say("Red Falcon's lair! Shoot its heart. Lie flat to shoot the larvae.");
            return;
          case 'won':
            this.stopMusic();
            this.winT = 0;
            return;
          case 'lost':
            this.stopMusic();
            this.gameOverT = 0;
            this.banner = ['GAME OVER'];
            this.say('Game over. Try again.');
            return;
        }
        return;
    }
  }

  private showWin(): void {
    // A round for fun (Game.inRound) frees nobody: no word of Bill's mind.
    const fun = this.game.inRound;
    this.banner = fun
      ? ["RED FALCON'S HEART BURSTS!"]
      : ["RED FALCON'S HEART BURSTS!", "BILL'S MIND IS HIS OWN!"];
    this.say(fun ? "Red Falcon's heart bursts!" : "Red Falcon's heart bursts! Bill's mind is his own again.");
  }

  /** The round is over: report it once. */
  private finish(result: MiniGameResult): void {
    if (this.phase === 'over') return;
    this.phase = 'over';
    this.stopMusic();
    this.game.ctx.audio.setTempoScale(1);
    this.done(result);
  }

  render(r: Renderer): void {
    const assets = this.game.ctx.assets;
    const rf = this.game.ctx.reduceFlashing;
    if (this.phase === 'card') {
      drawCard(r, assets, this.phaseT, this.jungle.rest, this.prompt, this.konami);
      return;
    }
    const j = this.jungle;
    drawJungle({ r, assets, camX: j.camX, t: j.t, rf }, j);
    // A big boom's soft flash, under 3 a second (never with reduce flashing).
    if (!rf && (j.phase === 'breach' || j.phase === 'won') && j.phaseT % FLASH_EVERY < 2 && j.phaseT < 130)
      r.rect(0, 0, SCREEN_W, 240, 'rgba(252,252,252,0.18)');
    if (this.banner) drawBanner(r, assets.sheet('font'), this.banner, 96);
  }
}

/**
 * Jungle Assault's own menu: Continue, Give up (ends the round as 'quit'), and in dev mode the
 * assists. Pauses the music.
 */
export class JungleMenuScene extends MiniGameMenuScene {
  constructor(game: Game, giveUp: () => void) {
    super(
      game,
      'JUNGLE ASSAULT',
      giveUp,
      "Bill stays under Red Falcon's control for now; you can try again later",
    );
  }
}
