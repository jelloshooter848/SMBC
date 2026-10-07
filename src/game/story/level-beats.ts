import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { TouchLabels } from '@engine/input/touch';
import type { Game } from '@game/scenes/game';
import type { LevelScene } from '@game/scenes/level';
import type { LevelData } from '@game/level/schema';
import { applyLook } from '@game/level/campaign';
import { AIRSHIP_ROOM } from '@game/scenes/airship';
import { cardContinues, CARD_GUARD_FRAMES } from '@game/scenes/message';
import { abilityHint } from '@game/scenes/hints';
import { NO_TOUCH_BUTTONS } from '@game/touch-labels';
import { fontText } from '@game/hud/text';
import { drawPromptBox, wrapPrompt } from '@game/tutorial/stage-prompts';
import { beat, storyOn } from './beats';
import { playStoryCards, STORY_CARD_TIMEOUT } from './cards';
import { LARRY_PAGES, noMoreStandIns, RESTYLE_PAGES, type Page } from './script';

/*
 * The story scenes that play inside a level, over its frozen world (campaign only, storyOn), each
 * once the players stand free (not rising out of a pipe):
 *
 * - Toad's remark on a restyled level (docs/STORY.md 2.3b): the first time a main level with a
 *   RESTYLE_PAGES card starts on the file, before play, while its campaign look is on (the look's
 *   theme registered: level/campaign.ts applyLook). Once per file (`beat.restyle(id)`).
 * - Larry in his room (2.7): the first time the hero rises out of `4-2-larry`'s pipe in a run
 *   (AirshipRun.larrySpoke), not again on TRY AGAIN; a mandatory scene, so every run.
 * - Bowser in 8-4's bridge room (2.3a item 5): on first entering `8-4-end`, in the prompt box.
 *   Once per file (`beat.bowser84`).
 */

/** 8-4's bridge room, where the real king waits. */
export const BRIDGE_ROOM = '8-4-end';

/** `level` (as played) is in its campaign look: it has one and the look's theme is registered. */
export function inCampaignLook(level: LevelData): boolean {
  return level.campaignLook !== undefined && applyLook(level) !== level;
}

/** The restyled level's remark due on `scene`'s level now, else null (see the top of the file). */
export function restyleDue(game: Game, level: LevelData): Page | null {
  const page = level.parent ? undefined : RESTYLE_PAGES[level.id];
  if (!page || game.seen(beat.restyle(level.id)) || !inCampaignLook(level)) return null;
  return page;
}

/**
 * LevelScene.update, before the world moves: starts the story scene due in this level, if any
 * (over the frozen level, the level resumed when it closes). True when one started.
 */
export function playLevelBeat(game: Game, scene: LevelScene): boolean {
  if (!storyOn(game) || scene.world.inPipe) return false;
  const level = scene.level;
  const resume = () => scene.resume();
  const restyle = restyleDue(game, level);
  if (restyle) {
    game.markSeen(beat.restyle(level.id));
    playStoryCards(game, scene.world, [restyle], resume);
    return true;
  }
  const run = scene.airship;
  if (level.id === AIRSHIP_ROOM && run && !run.larrySpoke) {
    run.larrySpoke = true;
    playStoryCards(game, scene.world, LARRY_PAGES, resume);
    return true;
  }
  if (level.id === BRIDGE_ROOM && !game.seen(beat.bowser84)) {
    game.markSeen(beat.bowser84);
    const hero = fontText(game.state.character.name);
    game.scenes.push(
      new BowserSaysScene(game, noMoreStandIns(hero), () => {
        game.scenes.pop();
        resume();
      }),
    );
    return true;
  }
  return false;
}

/**
 * Bowser speaks in the prompt box at the top (as in 1-0's tease) over the frozen level: his laugh,
 * the lines read out, OK or BACK (or MENU) closes it after the card guard, or the timeout.
 */
export class BowserSaysScene implements Scene {
  readonly translucent = true;
  private t = 0;
  private done = false;

  constructor(
    private readonly game: Game,
    readonly lines: Page,
    private readonly next: () => void,
  ) {}

  enter(): void {
    this.game.ctx.audio.sfx('bowser-laugh');
    this.game.deps.announcer?.say(`${this.lines.join(' ')} OK to continue.`);
  }

  touchLabels(): TouchLabels {
    return this.t > CARD_GUARD_FRAMES
      ? { ...NO_TOUCH_BUTTONS, jump: 'OK', attack: 'BACK' }
      : NO_TOUCH_BUTTONS;
  }

  update(_input: InputFrame, inputs: InputFrame[]): void {
    if (this.done) return;
    if (cardContinues(++this.t, STORY_CARD_TIMEOUT, inputs, ['jump', 'attack', 'start'])) {
      this.done = true;
      this.next();
    }
  }

  render(r: Renderer): void {
    const font = this.game.ctx.assets.sheet('font');
    const ok = fontText(abilityHint(this.game, 'OK', 'jump'));
    drawPromptBox(r, font, [...this.lines.flatMap((l) => wrapPrompt(l)), ok]);
  }
}
