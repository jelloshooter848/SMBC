import { expect } from 'vitest';
import type { Action } from '@engine/input/actions';
import { toPx } from '@engine/math/units';
import { SCREEN_H, SCREEN_W } from '@engine/viewport';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import type { Scene } from '@engine/scene';
import { CardScene, CARD_GUARD_FRAMES } from '@game/scenes/message';
import type { MenuItem } from '@game/scenes/menu';
import { CHARACTERS } from '@game/characters/registry';
import { ScorePopup } from '@game/entities/effects/effects';
import { FlagScore } from '@game/entities/objects/flagpole';
import { HeroItem } from '@game/entities/objects/hero-item';
import { T } from '@game/level/tiles';
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
  const words = stage.director.lines();
  expect(words.length, words.join('/')).toBeLessThanOrEqual(3);
}

/** What happened while a stage was played (playStage). */
export interface PlayLog {
  frames: number;
  /**
   * Every colour the whole screen was filled with (the backdrop's clear, any full-screen rect):
   * with reduce flashing on (the harness's) it never changes in a stage.
   */
  fills: Set<string>;
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
  const log: PlayLog = { frames: 0, cards: [], fills: new Set() };
  // Records the screen-wide fills of a frame (reduce flashing is on in the harness).
  const rec: Renderer = Object.assign(new NullRenderer(), {
    clear(color: string): void {
      log.fills.add(color);
    },
    rect(x: number, y: number, w: number, h: number, color: string): void {
      if (x <= 0 && y <= 0 && w >= SCREEN_W && h >= SCREEN_H) log.fills.add(color);
    },
  });
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
    // The HUD shows no score, so no points float up (the flagpole's either).
    expect(stage.world.entities.some((e) => e instanceof ScorePopup || e instanceof FlagScore)).toBe(false);
    const b = stage.world.player.body;
    last = { ground: b.onGround, vx: Math.abs(b.vx) };
    h.step(bot(stage));
    if (h.top() === stage) stage.render(rec);
  }
  expect([...log.fills].length, `whole-screen colours: ${[...log.fills].join(', ')}`).toBeLessThanOrEqual(1);
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

/**
 * A bot's controls for this frame (pushing into `out`): walk to a column (hopping a step in the
 * way), stand at one facing right, pick a belt tool, press a button now and then, and take an
 * item out of a ? block (bump it, then touch the item from the side the hero is on).
 */
const stands = new WeakMap<HeroStageScene, { col: number; back: boolean }>();

export function controls(s: HeroStageScene, out: Action[]) {
  const w = s.world;
  const p = w.player;
  const b = p.body;
  const cx = toPx(p.centerX);
  // The screen never scrolls back left: a column behind its left edge is as near as he gets.
  const pinned = toPx(b.x) - w.camera.pxX < 4;
  const goTo = (col: number, slack = 3): boolean => {
    const dx = col * 16 + 8 - cx;
    if (Math.abs(dx) <= slack || (dx < 0 && pinned)) return Math.abs(b.vx) < 0x100 && b.onGround;
    const dir = dx > 0 ? 1 : -1;
    out.push(dir > 0 ? 'right' : 'left');
    // A hop over a step: a full one (JUMP held while rising).
    if (!b.onGround && b.vy < 0) out.push('jump');
    const ahead = Math.floor((dir > 0 ? toPx(b.x + b.w) + 1 : toPx(b.x) - 1) / 16);
    const feet = Math.floor((toPx(b.y + b.h) - 1) / 16);
    if (b.onGround && w.map.isSolid(ahead, feet) && (w.frame & 3) === 0) out.push('jump');
    return false;
  };
  /**
   * Stand at column `col` facing right: reached from the left, so he arrives facing right (from
   * the right he first walks a little past it; the screen's left edge just turns him).
   */
  const standAt = (col: number): boolean => {
    const target = col * 16 + 8;
    let st = stands.get(s);
    if (!st || st.col !== col) stands.set(s, (st = { col, back: false }));
    if (cx > target + 12 && !pinned) st.back = true;
    if (st.back) {
      if (cx > target - 10 && !pinned) {
        goTo(col - 1, 2);
        return false;
      }
      st.back = false;
    }
    if (cx < target - 12) {
      goTo(col, 2);
      return false;
    }
    if (p.facing < 0) {
      out.push('right');
      return false;
    }
    return b.onGround;
  };
  const tool = (): string | undefined => {
    const tools = p.def.tools?.(p) ?? [];
    const n = tools.length;
    if (!n) return undefined;
    return tools[(((p.scratch.tool ?? 0) % n) + n) % n]?.id;
  };
  const pick = (id: string): boolean => {
    if (tool() === id) return true;
    if ((w.frame & 7) === 0) out.push('select');
    return false;
  };
  const press = (a: Action, every = 12): void => {
    if (w.frame % every === 0) out.push(a);
  };
  /** Bump the ? block at (x, y), then take its item: true once neither is left. */
  const takeFrom = (blk: { x: number; y: number }, up = false): boolean => {
    const used = w.map.get(blk.x, blk.y) !== T.Q_POWERUP;
    const item = w.entities.find((e) => e instanceof HeroItem && e.alive);
    // A full jump: JUMP held while rising.
    if (!b.onGround && b.vy < 0) out.push('jump');
    if (!used) {
      if (!b.onGround) {
        if (up) out.push('up');
        const dx = blk.x * 16 + 8 - cx;
        if (Math.abs(dx) > 2) out.push(dx > 0 ? 'right' : 'left');
        return false;
      }
      // Standing on top of it: off it first, to come up under it.
      if (toPx(b.y + b.h) <= blk.y * 16 && Math.abs(cx - (blk.x * 16 + 8)) < 20) {
        goTo(blk.x + 2);
        return false;
      }
      if (goTo(blk.x)) press('jump', 4);
      return false;
    }
    if (!item) return true;
    const side = cx <= blk.x * 16 + 8 ? -2 : 2;
    if (!b.onGround) {
      out.push(side < 0 ? 'right' : 'left');
      return false;
    }
    if (goTo(blk.x + side)) press('jump', 4);
    return false;
  };
  return { w, p, b, cx, goTo, standAt, tool, pick, press, takeFrom };
}
