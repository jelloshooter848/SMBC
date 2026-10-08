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
import { AIRSHIP_CHALLENGE } from './airship';
import { CharacterSelectScene } from './character-select';
import type { CharacterDef } from '../characters/character';

/**
 * One dev round: a hero's freeing mini game (MiniGameDef), or another challenge played the same
 * way (Larry's airship: `who` names it on the card instead of a hero). A round played as a hero
 * of the player's choosing (Larry's airship) has `asHero`: character select comes first
 * (pickRoundHero) and the round played is `asHero(picked)`.
 */
export type DevRound = Pick<MiniGameDef, 'title' | 'create'> & {
  hero?: string;
  who?: string;
  asHero?: (hero: CharacterDef) => DevRound;
};

/**
 * Before a round of `def` (the scene on top stays below): character select for player one when
 * the round is played as a picked hero (`asHero`), then `play(def.asHero(picked))`; Back pops the
 * select and calls `back` with nothing started. Any other round is just `play(def)`. The select
 * shows the heroes as everywhere else (locked captives on a campaign file are silhouettes; dev
 * "All heroes" frees them) with the current hero preselected; it never asks about training (the
 * round must not change the file), and player two keeps their hero.
 */
export function pickRoundHero(
  game: Game,
  def: DevRound,
  play: (round: DevRound) => void,
  back: () => void,
): void {
  const asHero = def.asHero;
  if (!asHero) return play(def);
  game.scenes.push(
    new CharacterSelectScene(game, {
      player: 0,
      current: game.state.character,
      onPick: (c) => {
        game.scenes.pop();
        play(asHero(c));
      },
      onCancel: () => {
        game.scenes.pop();
        back();
      },
      training: false,
    }),
  );
}

/*
 * Dev mode → Mini games: every hero's freeing mini game (MINIGAMES), played straight from the
 * dev menu (the title's, or pause → Dev mode outside the campaign), in production builds too.
 * One round through `MiniGameDef.create`, then a result card (PASS / FAIL / QUIT) and back to
 * the list. Nothing sticks: no save is written and the run's state, freed heroes and campaign
 * are put back as they were; the music that was playing comes back.
 */

/**
 * One round of `def` played over the scene on top (the dev list, the Mini Game Arena's map), for
 * fun: nothing sticks. No file is open while it runs (`campaign` is null, so nothing can
 * autosave), and when it ends the round's scenes go (down to that scene) and the run's state, the
 * freed and met heroes, training answers, map progress, bonus state and items, the campaign and
 * the music's tempo are put back as they were (its music stopped); then `ended(result)`. A round
 * that throws while being built puts everything back the same way and rethrows.
 */
export function playRound(game: Game, def: DevRound, ended: (result: MiniGameResult) => void): void {
  const base = game.scenes.top;
  const audio = game.ctx.audio;
  const saved = game.state;
  const before = snapshot(saved);
  const freed = game.freed.slice();
  const met = game.met.slice();
  const tutorials = game.tutorials.slice();
  const celebrate = [...game.celebrate];
  const campaign = game.campaign;
  const progress = structuredClone(game.mapProgress);
  const pendingReveal = game.pendingReveal.slice();
  const lastNode = { ...game.mapLastNode };
  const cutscene = game.mapCutscene;
  const bonus = structuredClone(game.bonus);
  const bonusOpen = game.bonusOpen;
  const bonusGuard = game.bonusGuard;
  const inventoryUnlocked = game.inventoryUnlocked;
  const tutorialRun = game.tutorialRun;
  const stageRound = game.stageRound;
  const inRound = game.inRound;
  game.inRound = true;
  // No file is open for the round: nothing it does can autosave.
  game.campaign = null;
  // A pause menu below suspended the audio; the round has its own music.
  audio.resume();
  audio.setTempoScale(1);
  audio.stopMusic();
  /** Everything as it was before the round (its music stopped). */
  const restore = () => {
    game.state = saved;
    Object.assign(saved, before);
    game.freed = freed;
    game.met = met;
    game.tutorials = tutorials;
    game.celebrate.clear();
    for (const id of celebrate) game.celebrate.add(id);
    game.campaign = campaign;
    // The world gates read the file's freed list itself (Game.openFile): keep them one array, or a
    // hero freed after a round would leave the gate shut until the file is reloaded.
    if (progress.freed) progress.freed = freed;
    game.mapProgress = progress;
    game.pendingReveal = pendingReveal;
    game.mapLastNode = lastNode;
    game.mapCutscene = cutscene;
    game.bonus = bonus;
    game.bonusOpen = bonusOpen;
    game.bonusGuard = bonusGuard;
    game.inventoryUnlocked = inventoryUnlocked;
    game.tutorialRun = tutorialRun;
    game.stageRound = stageRound;
    game.inRound = inRound;
    game.airship = null;
    audio.setTempoScale(1);
    audio.stopMusic();
  };
  let over = false;
  const onDone = (result: MiniGameResult) => {
    if (over) return;
    over = true;
    // The round and anything it left on top (its menu) go.
    while (game.scenes.depth > 0 && game.scenes.top !== base) game.scenes.pop();
    restore();
    ended(result);
  };
  let scene: Scene;
  try {
    scene = def.create(game, onDone);
  } catch (e) {
    over = true;
    restore();
    throw e;
  }
  game.scenes.push(scene);
}

/** What the result card says for each ending. */
export const RESULT_WORDS: Record<MiniGameResult, string> = { pass: 'PASS', fail: 'FAIL', quit: 'QUIT' };

/** 'MIRROR RACE' → 'Mirror race', "LARRY'S AIRSHIP" → "Larry's airship" (the menu's label case). */
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
      {
        label: label(AIRSHIP_CHALLENGE.title),
        select: () => this.play(AIRSHIP_CHALLENGE),
        hint: "Deck and Larry's room with a hero you pick. Plays one round; nothing is saved",
      },
      { label: 'Back', select: () => game.scenes.pop() },
    ]);
  }

  /**
   * One round of `def` over this list (after character select when it is played as a picked
   * hero; Back from the select is the list again), then its result card; the game is left as it
   * was.
   */
  play(def: DevRound): void {
    pickRoundHero(
      this.game,
      def,
      (round) => this.playRound(round),
      () => this.announce(),
    );
  }

  /** One round of `def` over this list, then its result card. */
  private playRound(def: DevRound): void {
    const game = this.game;
    try {
      playRound(game, def, (result) => {
        this.lastResult = result;
        game.scenes.push(
          new DevMiniGameResultScene(game, def, result, () => {
            game.scenes.pop();
            this.restoreMusic();
            this.announce();
          }),
        );
      });
    } catch (e) {
      // A round that cannot even start leaves nothing behind: the list, as it was, with its music.
      this.restoreMusic();
      throw e;
    }
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
    def: DevRound,
    readonly result: MiniGameResult,
    private readonly next: () => void,
  ) {
    const hero = game.deps.characters.find((c) => c.id === def.hero);
    const who = hero?.name ?? def.who ?? def.hero ?? '';
    this.lines = [fontText(def.title), fontText(who), '', RESULT_WORDS[result]];
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
    if (cardContinues(++this.t, inputs, ['jump', 'start', 'attack'])) {
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
