import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { TouchLabels } from '@engine/input/touch';
import { SCREEN_W } from '@engine/viewport';
import { MINIGAMES, type MiniGameDef, type MiniGameResult } from '../minigames';
import { NO_TOUCH_BUTTONS } from '../touch-labels';
import { fontText } from '../hud/text';
import { MenuScene } from './menu';
import { abilityHint } from './hints';
import { cardContinues } from './message';
import { snapshot } from './free-hero';
import type { Game } from './game';

/*
 * Dev mode → Mini games: every hero's freeing mini game (MINIGAMES), played straight from the
 * dev menu (the title's, or pause → Dev mode outside the campaign), in production builds too.
 * One round through `MiniGameDef.create`, then a result card (PASS / FAIL / QUIT) and back to
 * the list. Nothing sticks: no save is written and the run's state, freed heroes and campaign
 * are put back as they were; the music that was playing comes back.
 */

/** What the result card says for each ending. */
export const RESULT_WORDS: Record<MiniGameResult, string> = { pass: 'PASS', fail: 'FAIL', quit: 'QUIT' };

/** 'MIRROR RACE' → 'Mirror race' (the menu's label case). */
function label(title: string): string {
  const t = title.toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** The dev list of mini games: title and hero, OK plays one round. */
export class DevMiniGamesScene extends MenuScene {
  /** The last round's ending (tests, the card). */
  lastResult: MiniGameResult | null = null;

  constructor(
    game: Game,
    /** Opened over a pause menu: the audio it suspended is suspended again on the way back. */
    private readonly fromPause = false,
  ) {
    super(game, 'MINI GAMES', [], () => game.scenes.pop(), fromPause);
    const heroName = (id: string) => game.deps.characters.find((c) => c.id === id)?.name ?? id;
    this.setItems([
      ...Object.values(MINIGAMES).map((def) => ({
        label: label(def.title),
        value: () => heroName(def.hero),
        select: () => this.play(def),
        hint: `Frees ${heroName(def.hero)}. Plays one round; nothing is saved`,
      })),
      { label: 'Back', select: () => game.scenes.pop() },
    ]);
  }

  /** One round of `def` over this list, then its result card; the game is left as it was. */
  play(def: MiniGameDef): void {
    const game = this.game;
    const audio = game.ctx.audio;
    const saved = game.state;
    const before = snapshot(saved);
    const freed = game.freed.slice();
    const celebrate = [...game.celebrate];
    const campaign = game.campaign;
    // No file is open for the round: nothing it does can autosave.
    game.campaign = null;
    // A pause menu below suspended the audio; the round has its own music.
    audio.resume();
    audio.setTempoScale(1);
    audio.stopMusic();
    let over = false;
    const scene = def.create(game, (result) => {
      if (over) return;
      over = true;
      // The round and anything it left on top (its menu) go.
      while (game.scenes.depth > 0 && game.scenes.top !== this) game.scenes.pop();
      game.state = saved;
      Object.assign(saved, before);
      game.freed = freed;
      game.celebrate.clear();
      for (const id of celebrate) game.celebrate.add(id);
      game.campaign = campaign;
      audio.setTempoScale(1);
      audio.stopMusic();
      this.lastResult = result;
      game.scenes.push(
        new DevMiniGameResultScene(game, def, result, () => {
          game.scenes.pop();
          this.restoreMusic();
          this.announce();
        }),
      );
    });
    game.scenes.push(scene);
  }

  /** The music under the dev menu again: the level's (paused again under its pause menu), else the title's. */
  private restoreMusic(): void {
    const audio = this.game.ctx.audio;
    const level = this.game.scenes.find(
      (s) => typeof (s as { playMusic?: unknown }).playMusic === 'function',
    ) as { playMusic(): void } | undefined;
    if (level) level.playMusic();
    else audio.playMusic('title');
    if (this.fromPause) audio.pause();
  }
}

/** The dev round's result: the mini game, its hero and PASS / FAIL / QUIT; OK goes back. */
export class DevMiniGameResultScene implements Scene {
  private t = 0;
  private done = false;
  readonly lines: string[];

  constructor(
    private readonly game: Game,
    def: MiniGameDef,
    readonly result: MiniGameResult,
    private readonly next: () => void,
  ) {
    const hero = game.deps.characters.find((c) => c.id === def.hero);
    this.lines = [fontText(def.title), fontText(hero?.hudName ?? def.hero), '', RESULT_WORDS[result]];
  }

  enter(): void {
    this.game.ctx.audio.sfx(this.result === 'pass' ? '1up' : 'bump');
    this.game.deps.announcer?.say(`${this.lines.filter(Boolean).join(' ')}. OK to go back.`);
  }

  touchLabels(): TouchLabels {
    return { ...NO_TOUCH_BUTTONS, jump: 'OK' };
  }

  update(_input: InputFrame, inputs: InputFrame[]): void {
    if (this.done) return;
    if (cardContinues(++this.t, Infinity, inputs, ['jump', 'start', 'attack'])) {
      this.done = true;
      this.next();
    }
  }

  render(r: Renderer): void {
    r.clear('#000');
    const font = this.game.ctx.assets.sheet('font');
    const colour = this.result === 'pass' ? '#58d854' : this.result === 'fail' ? '#e45c10' : '#7c7c7c';
    // The result word on a coloured bar.
    const word = this.lines[3] as string;
    r.rect(SCREEN_W / 2 - 40, 120 - 4, 80, 16, colour);
    this.lines.forEach((l, i) => {
      if (l && i !== 3) r.text(font, l, (SCREEN_W - l.length * 8) >> 1, 72 + i * 16);
    });
    r.text(font, word, (SCREEN_W - word.length * 8) >> 1, 120);
    // Asked every frame, so the key follows the controls in use.
    const ok = fontText(`PRESS ${abilityHint(this.game, 'OK', 'jump')}`);
    if (this.t > 30) r.text(font, ok, (SCREEN_W - ok.length * 8) >> 1, 176);
  }
}
