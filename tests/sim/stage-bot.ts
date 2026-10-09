import { expect } from 'vitest';
import type { Action } from '@engine/input/actions';
import { toPx } from '@engine/math/units';
import { SCREEN_H, SCREEN_W } from '@engine/viewport';
import type { Scene } from '@engine/scene';
import { CardScene, CARD_GUARD_FRAMES } from '@game/scenes/message';
import type { MenuItem } from '@game/scenes/menu';
import { CHARACTERS } from '@game/characters/registry';
import { HeroStageScene, StageMenu, StartAtMenu } from '@game/tutorial/hero-stage';
import { runTraining } from '@game/tutorial/training';
import { file, makeGame, type H } from './heroes-harness';

/*
 * Shared helpers for the hero stages' sims (0.4.37, tutorial/hero-stage.ts): start a hero's
 * training from a campaign file (a copy of the run), play it with a hero's bot while checking the
 * box and the cards every frame, and the menus.
 */

/** A campaign file with `hero` freed, opened, and the hero's training started (not a replay). */
export function startStage(
  heroId: string,
  opts: { replay?: boolean; file?: Parameters<typeof file>[0]; dev?: boolean } = {},
): { h: H; stage: () => HeroStageScene; ended: () => boolean } {
  const h = makeGame(opts.dev ? { dev: true } : {});
  file({ freed: ['mario', heroId], ...opts.file });
  h.game.openFile(1);
  const hero = CHARACTERS.find((c) => c.id === heroId);
  if (!hero) throw new Error(heroId);
  let ended = false;
  runTraining(h.game, hero, 0, () => void (ended = true), opts.replay ?? false);
  const scene = h.game.scenes.find((s) => s instanceof HeroStageScene) as HeroStageScene;
  expect(scene).toBeInstanceOf(HeroStageScene);
  return { h, stage: () => scene, ended: () => ended };
}

/** Closes Toad's greeting (OK on each page). */
export function skipGreeting(h: H): void {
  h.until(() => h.top() instanceof CardScene, 120);
  for (let i = 0; i < 10 && h.top() instanceof CardScene; i++) {
    h.idle(CARD_GUARD_FRAMES + 1);
    h.tap('jump');
  }
  expect(h.top()).toBeInstanceOf(HeroStageScene);
}

/** Overlap of two screen rectangles. */
const overlap = (
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/**
 * The checks every frame of a stage: the box (when shown) stays on screen, never covers the hero
 * (his body on screen) nor the HUD's bars (the rows above 40 px, Mega Man's bars at the left edge
 * down to 100 px), and holds at most 3 lines of words.
 */
export function checkBox(stage: HeroStageScene): void {
  const box = stage.director.box();
  if (!box) return;
  const w = stage.world;
  const camX = w.camera.pxX;
  const camY = w.camera.pxY ?? 0;
  const rect = { x: box.x, y: box.y, w: box.w, h: box.h };
  expect(rect.y + rect.h).toBeLessThanOrEqual(SCREEN_H);
  expect(rect.x).toBeGreaterThanOrEqual(0);
  expect(rect.x + rect.w).toBeLessThanOrEqual(SCREEN_W);
  expect(rect.y, 'under the HUD rows').toBeGreaterThanOrEqual(40);
  const p = w.player;
  if (!p.dead) {
    const b = p.body;
    const hero = { x: toPx(b.x) - camX, y: toPx(b.y) - camY, w: toPx(b.w), h: toPx(b.h) };
    expect(overlap(rect, hero), `box over the hero at ${hero.x},${hero.y}`).toBe(false);
  }
  if (p.def.damage.kind === 'hp' && p.def.damage.hudStyle === 'bar')
    expect(overlap(rect, { x: 7, y: 39, w: 17, h: 60 }), 'box over the bars').toBe(false);
  const words = box.rows.filter((r) => r !== '');
  const head = stage.director.lesson?.item ? 1 : 0;
  expect(words.length - head, words.join('/')).toBeLessThanOrEqual(3);
}

/** What happened while a stage was played (playStage). */
export interface PlayLog {
  frames: number;
  /** Toad's gate cards, with how the hero stood when each came. */
  cards: { lines: readonly string[]; ground: boolean; vx: number }[];
}

/**
 * Plays the stage with `bot` until `stop` (or `max` frames): cards are closed with OK after a
 * while (they never go on by themselves), and every frame of play is checked (checkBox, and a card
 * only ever comes with the hero standing still on the ground).
 */
export function playStage(
  h: H,
  stage: HeroStageScene,
  bot: (s: HeroStageScene) => Action[],
  stop: () => boolean,
  max = 7200,
): PlayLog {
  const log: PlayLog = { frames: 0, cards: [] };
  let last = { ground: true, vx: 0 };
  let wait = 0;
  for (; log.frames < max && !stop(); log.frames++) {
    const top = h.top();
    if (top instanceof CardScene) {
      if (wait === 0) {
        const card = top;
        if (card.lines[0] === 'TOAD:' && !stage.cleared && stage.run.greeted)
          log.cards.push({ lines: card.lines, ground: last.ground, vx: last.vx });
      }
      wait++;
      h.step(wait > CARD_GUARD_FRAMES + 2 && wait % 8 === 0 ? ['jump'] : []);
      continue;
    }
    wait = 0;
    if (top !== stage) {
      h.step();
      continue;
    }
    checkBox(stage);
    const b = stage.world.player.body;
    last = { ground: b.onGround, vx: Math.abs(b.vx) };
    h.step(bot(stage));
  }
  for (const c of log.cards) {
    expect(c.ground, 'a card only on the ground').toBe(true);
    expect(c.vx, 'a card only when still').toBeLessThan(0x400);
  }
  return log;
}

const items = (s: Scene | undefined) => (s as unknown as { items: MenuItem[] }).items;

/** Picks the menu entry labelled `label` on the menu on top. */
export function choose(h: H, label: string): void {
  h.idle(8);
  const list = items(h.top());
  const i = list.findIndex((it) => it.label === label);
  expect(i, `${label} in ${list.map((x) => x.label).join(', ')}`).toBeGreaterThanOrEqual(0);
  for (let k = 0; k < i; k++) h.tap('down');
  h.tap('jump');
}

/** MENU in the stage, then `label` (Continue, Skip this lesson, Skip training). */
export function stageMenu(h: H, label: string): void {
  h.idle(2);
  h.tap('start');
  expect(h.top()).toBeInstanceOf(StageMenu);
  choose(h, label);
}

/** The START AT entries offered. */
export function startAtLabels(h: H): string[] {
  expect(h.top()).toBeInstanceOf(StartAtMenu);
  return items(h.top()).map((i) => i.label);
}

/** Steps `input` until `stop` holds (at most `max` frames), and checks it did. */
export function hold(h: H, input: Action[], stop: () => boolean, max: number): void {
  for (let i = 0; i < max && !stop(); i++) h.step(input);
  expect(stop()).toBe(true);
}

/** The hero's centre column. */
export const heroCol = (s: HeroStageScene): number => Math.floor(toPx(s.world.player.centerX) / 16);
