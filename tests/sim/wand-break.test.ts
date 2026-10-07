import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { ScriptedInput } from '@game/sim/headless';
import { World } from '@game/world/world';
import { DEFAULT_ASSIST, newGameState, type GameState } from '@game/context';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { SCREEN_W } from '@engine/viewport';
import { px } from '@engine/math/units';
import { PALETTES, SPRITES } from '@content/sprites';
import { getLevel } from '@content/levels';
import { MARIO } from '@game/characters/mario';
import { MEGAMAN } from '@game/characters/megaman';
import { Bowser } from '@game/entities/enemies/bowser';
import { Toad } from '@game/entities/objects/toad';
import { Princess } from '@game/entities/objects/princess';
import {
  WandBreak,
  WAND_CRACK_AT,
  WAND_FLASH_FRAMES,
  WAND_SCENE_FRAMES,
} from '@game/entities/effects/wand-break';
import { campaignLevel } from '@game/level/campaign';
import { CASTLE_PAGES, STORY_NOT_OVER, WAND_BREAK_SAID } from '@game/story/script';
import { CreditsScene, creditsLines, CREDITS } from '@game/scenes/credits';
import { LevelScene } from '@game/scenes/level';
import type { LevelData } from '@game/level/schema';
import type { Action } from '@engine/input/actions';
import { file, makeGame, useStorage, type H } from './heroes-harness';
import { seeAllStory } from './story-seen';

// docs/STORY.md 2.12: in the campaign's 8-4 the king's wand breaks as he falls, a rift opens over
// the lava and stays; then the castle pages, then the credits (which do not read the news twice).
// Classic 8-4 and the Lost Levels' 8-4 are unchanged.

const levels = join(import.meta.dirname, '../../src/content/levels');
const load = (path: string, id: string): LevelData =>
  parseTextMap(readFileSync(join(levels, path), 'utf8'), id);
const end84 = () => load('world8/8-4-end.map', '8-4-end');
/** The campaign's 8-4-end: Toad in the princess's place (level/campaign.ts toadAt84). */
const campaign84 = () => campaignLevel(end84(), () => false);

const assets = new AssetRegistry(PALETTES);
assets.defineAll(SPRITES);

interface Drawn {
  rects: { x: number; y: number; w: number; h: number; c: string }[];
  sprites: string[];
}

/** A renderer recording rects and `frame@sheet` sprites. */
function recorder(out: Drawn): Renderer {
  return Object.assign(new NullRenderer(), {
    rect(x: number, y: number, w: number, h: number, c: string) {
      out.rects.push({ x, y, w, h, c });
    },
    sprite(s: SpriteSheet, f: string) {
      out.sprites.push(`${f}@${s.id}`);
    },
  });
}

function makeWorld(
  level: LevelData,
  story: boolean,
  opts: { reduceFlashing?: boolean; state?: GameState } = {},
) {
  const sfx: string[] = [];
  const state = opts.state ?? newGameState(MARIO);
  state.world = level.world;
  const axe = level.entities.find((e) => e.type === 'axe') as { x: number };
  const world = new World(
    level,
    {
      assets,
      audio: { ...NULL_AUDIO, sfx: (id: string) => void sfx.push(id) },
      assist: { ...DEFAULT_ASSIST, invulnerable: true },
      reduceFlashing: opts.reduceFlashing ?? true,
    },
    state,
    { x: axe.x - 6, y: 8, mode: 'stand' },
  );
  world.storyMode = story;
  return { world, sfx, axe: axe.x };
}

/**
 * Clear a castle by the axe (player `who` takes it; the other waits by the start), drawing every
 * frame; returns what was shown, said, sounded and drawn.
 */
function clearCastle(
  level: LevelData,
  story: boolean,
  opts: { reduceFlashing?: boolean; state?: GameState; who?: number } = {},
) {
  const { world, sfx, axe } = makeWorld(level, story, opts);
  const inputs = (opts.state?.character2 ? [0, 1] : [0]).map(
    () => new ScriptedInput({ steps: [{ frame: 0, hold: [] as Action[] }] }),
  );
  const texts: string[][] = [];
  const said: string[] = [];
  const frames: Drawn[] = [];
  /** Per frame: the walking hero's x and the castle-clear clock (-1 before the axe). */
  const xs: number[] = [];
  const ts: number[] = [];
  let exitAt = -1;
  let placed = false;
  let wand: WandBreak | undefined;
  let wandAt = -1;
  const who = world.players[opts.who ?? 0];
  if (!who) throw new Error('no such player');
  for (let f = 0; f < 2000 && exitAt < 0; f++) {
    const b = world.entities.find((e): e is Bowser => e instanceof Bowser && e.alive && !e.fake);
    if (!placed && b) {
      placed = true;
      const p = who.body;
      p.x = px(axe * 16 + 2);
      p.y = px(9 * 16) - p.h;
      p.vx = 0;
      p.vy = 0;
      world.camera.snapTo(p.x);
    }
    for (const i of inputs) i.next();
    world.update(inputs);
    for (const ev of world.events.splice(0)) {
      if (ev.type === 'say') said.push(ev.text);
      if (ev.type === 'exit') exitAt = f;
    }
    const w = world.entities.find((e): e is WandBreak => e instanceof WandBreak);
    if (w && !wand) {
      wand = w;
      wandAt = f;
    }
    const d: Drawn = { rects: [], sprites: [] };
    world.render(recorder(d));
    frames.push(d);
    xs.push(who.body.x);
    ts.push(world.bossClear?.t ?? -1);
    const last = texts[texts.length - 1];
    if (world.castleText.join('|') !== (last ?? []).join('|')) texts.push([...world.castleText]);
  }
  return { world, texts, said, sfx, exitAt, placed, wand, wandAt, frames, xs, ts };
}

const PAGES = CASTLE_PAGES['8-4'] as { reveal: readonly string[]; news: readonly string[] };
const fullScreen = (r: Drawn['rects'][number]) => r.w >= SCREEN_W;

describe('8-4: the wand breaks (campaign)', () => {
  it('on the campaign 8-4 (Toad variant): the wand breaks, the rift opens and stays, said once', () => {
    const r = clearCastle(campaign84(), true);
    expect(r.placed).toBe(true);
    expect(r.wand).toBeDefined();
    const wand = r.wand as WandBreak;
    // Still there, the rift open and every piece in, when the level hands over to the ending.
    expect(wand.alive).toBe(true);
    expect(wand.riftOpen).toBe(true);
    expect(wand.piecesOut).toBe(false);
    expect(r.sfx.filter((s) => s === 'wand-crack')).toHaveLength(1);
    // Announced once, before the castle pages.
    expect(r.said).toEqual([
      WAND_BREAK_SAID,
      ['THANK YOU MARIO!', ...PAGES.reveal].join(' '),
      ['THANK YOU MARIO!', ...PAGES.news].join(' '),
    ]);
    expect(r.texts).toEqual([
      ['THANK YOU MARIO!'],
      ['THANK YOU MARIO!', '', ...PAGES.reveal],
      ['THANK YOU MARIO!', '', ...PAGES.news],
    ]);
    // Toad stands at the end, not the princess.
    expect(r.world.entities.some((e) => e instanceof Toad && e.alive)).toBe(true);
    expect(r.world.entities.some((e) => e instanceof Princess && e.alive)).toBe(false);
    // The rift is drawn every frame from the time it is open to the exit.
    const after = r.frames.slice(r.wandAt + 80);
    expect(after.length).toBeGreaterThan(100);
    for (const f of after) expect(f.sprites.some((s) => /^rift-[01]@wand/.test(s))).toBe(true);
  });

  it('the hero walks on only once the pieces are in the rift', () => {
    const r = clearCastle(campaign84(), true);
    const p = r.world.player;
    expect(r.wand).toBeDefined();
    // Still from the axe until the wand scene is over (wandAt + WAND_SCENE_FRAMES, plus a
    // beat of 10 frames), walking from then on.
    const end = r.wandAt + WAND_SCENE_FRAMES;
    const still = r.xs[r.wandAt];
    for (let f = r.wandAt; f <= end + 10; f++) expect(r.xs[f]).toBe(still);
    expect(r.xs[end + 12]).toBeGreaterThan(still as number);
    // At the end the hero has walked to Toad as before.
    const toad = r.world.entities.find((e) => e instanceof Toad) as Toad;
    expect(p.body.x).toBeLessThan(toad.body.x);
    expect(p.body.x).toBeGreaterThan(toad.body.x - px(48));
  });

  it('classic 8-4: no wand, no rift, nothing said, the princess and the NES text', () => {
    const r = clearCastle(end84(), false);
    expect(r.wand).toBeUndefined();
    expect(r.sfx).not.toContain('wand-crack');
    expect(r.said).toEqual([]);
    expect(r.texts.at(-1)).toEqual(['THANK YOU MARIO!', '', 'YOUR QUEST IS OVER.']);
    // The walk starts at once as before: still through c.t 150, moving from c.t 151.
    const at = (t: number) => r.ts.indexOf(t);
    expect(r.xs[at(151)]).toBeGreaterThan(r.xs[at(150)] as number);
    expect(r.xs[at(150)]).toBe(r.xs[at(60)]);
    for (const f of r.frames) expect(f.sprites.some((s) => s.endsWith('@wand'))).toBe(false);
  });

  it("the Lost Levels' 8-4 never breaks the wand, even in the campaign", () => {
    const r = clearCastle(load('lost/world8/ll-8-4-end3.map', 'll-8-4-end3'), true);
    expect(r.placed).toBe(true);
    expect(r.wand).toBeUndefined();
    expect(r.sfx).not.toContain('wand-crack');
  });

  it('reduce flashing: no flash at all, the cracked wand held steady, the rift still', () => {
    const r = clearCastle(campaign84(), true, { reduceFlashing: true });
    for (const f of r.frames) {
      expect(f.rects.some(fullScreen)).toBe(false);
      // Only small sparkles: nothing wider than a sparkle's 1 px.
      expect(f.rects.every((x) => x.w * x.h <= 1)).toBe(true);
    }
    const scene = r.frames.slice(r.wandAt);
    const crack = scene.slice(WAND_CRACK_AT, WAND_CRACK_AT + 16);
    for (const f of crack) {
      expect(f.sprites).toContain('wand-glow@wand');
      expect(f.sprites).not.toContain('wand-crack@wand');
    }
    // The open rift never changes frame.
    const rifts = new Set(scene.flatMap((f) => f.sprites.filter((s) => /^rift-[01]@/.test(s))));
    expect([...rifts]).toEqual(['rift-0@wand']);
  });

  it('flashing allowed: one white flash as it cracks, fading, never repeated; a slow shimmer', () => {
    const r = clearCastle(campaign84(), true, { reduceFlashing: false });
    const flashes = r.frames.map((f) => f.rects.some(fullScreen));
    const first = flashes.indexOf(true);
    expect(first).toBe(r.wandAt + WAND_CRACK_AT);
    expect(flashes.filter(Boolean)).toHaveLength(WAND_FLASH_FRAMES);
    expect(flashes.slice(first, first + WAND_FLASH_FRAMES).every(Boolean)).toBe(true);
    // Fading: each flash paler than the one before.
    const alphas = r.frames
      .slice(first, first + WAND_FLASH_FRAMES)
      .map((f) => Number(/,([\d.]+)\)$/.exec(f.rects.find(fullScreen)?.c ?? '')?.[1]));
    for (let i = 1; i < alphas.length; i++) expect(alphas[i]).toBeLessThan(alphas[i - 1] as number);
    // The shimmer: the rift's frame holds at least half a second each time.
    const rift = r.frames.map((f) => f.sprites.find((s) => /^rift-[01]@/.test(s)));
    let run = 0;
    const runs: number[] = [];
    rift.forEach((s, i) => {
      if (!s) return;
      if (i > 0 && s === rift[i - 1]) run++;
      else {
        if (run) runs.push(run + 1);
        run = 0;
      }
    });
    expect(runs.length).toBeGreaterThan(0);
    for (const n of runs.slice(1)) expect(n).toBeGreaterThanOrEqual(30);
  });

  it('co-op: the castle thanks whoever took the axe (player 2)', () => {
    const state = newGameState(MARIO, MEGAMAN);
    const r = clearCastle(campaign84(), true, { state, who: 1 });
    expect(r.placed).toBe(true);
    expect(r.wand).toBeDefined();
    const thanks = `THANK YOU ${MEGAMAN.hudName}!`;
    expect(thanks).toBe('THANK YOU MEGA!');
    expect(r.texts).toEqual([[thanks], [thanks, '', ...PAGES.reveal], [thanks, '', ...PAGES.news]]);
    expect(r.said.slice(1)).toEqual([[thanks, ...PAGES.reveal].join(' '), [thanks, ...PAGES.news].join(' ')]);
  });
});

/** The current level scene's world. */
const worldOf = (h: H) => (h.top() as LevelScene).world;

/** Take 8-4-end's axe in the game, then run until the credits roll; returns the castle pages shown. */
function axeToCredits(h: H): string[][] {
  const w = worldOf(h);
  w.assist.invulnerable = true;
  const axe = (w.level.entities.find((e) => e.type === 'axe') as { x: number }).x;
  const p = w.player.body;
  p.x = px((axe - 6) * 16);
  p.y = px(10 * 16) - p.h;
  w.camera.snapTo(p.x);
  h.until(() => w.entities.some((e) => e instanceof Bowser && e.alive), 120);
  p.x = px(axe * 16 + 2);
  p.y = px(9 * 16) - p.h;
  p.vx = 0;
  p.vy = 0;
  const texts: string[][] = [];
  for (let i = 0; i < 2000 && !(h.top() instanceof CreditsScene); i++) {
    h.step();
    const t = h.top() instanceof LevelScene ? worldOf(h).castleText : null;
    if (t && t.length && t.join('|') !== (texts.at(-1) ?? []).join('|')) texts.push([...t]);
  }
  expect(h.top()).toBeInstanceOf(CreditsScene);
  return texts;
}

describe('8-4 in the game: the wand, the castle pages, then the credits', () => {
  useStorage();

  it('campaign: the Toad variant, the wand, both pages in order, then the credits (said once each)', () => {
    const h = makeGame();
    const cleared = [1, 2, 3, 4, 5, 6, 7, 8].flatMap((w) => [1, 2, 3, 4].map((s) => `${w}-${s}`));
    h.game.openFile(
      1,
      file({
        cleared: cleared.filter((id) => id !== '8-4'),
        pages: [1, 2, 3, 4, 5, 6, 7, 8].map((w) => `smb-${w}`),
        position: { page: 'smb-8', node: '8-4' },
      }),
    );
    seeAllStory(h.game);
    h.game.startLevel(getLevel('8-4-end'), { mode: 'stand' });
    h.step();
    expect(h.top()).toBeInstanceOf(LevelScene);
    const w = worldOf(h);
    expect(w.storyMode).toBe(true);
    expect(w.level.entities.some((e) => e.type === 'toad')).toBe(true);
    expect(w.level.entities.some((e) => e.type === 'princess')).toBe(false);
    const from = h.said.length;
    const texts = axeToCredits(h);
    expect(w.entities.some((e) => e instanceof WandBreak)).toBe(true);
    expect(texts).toEqual([
      ['THANK YOU MARIO!'],
      ['THANK YOU MARIO!', '', ...PAGES.reveal],
      ['THANK YOU MARIO!', '', ...PAGES.news],
    ]);
    const said = h.said.slice(from);
    const news = ['THANK YOU MARIO!', ...PAGES.news].join(' ');
    expect(said).toEqual([
      WAND_BREAK_SAID,
      ['THANK YOU MARIO!', ...PAGES.reveal].join(' '),
      news,
      `Credits. ${STORY_NOT_OVER.filter(Boolean).join(' ')}`,
    ]);
    // The news is read once, not again with the credits.
    expect(said.filter((s) => s.includes(PAGES.news[0] as string))).toHaveLength(1);
    const credits = h.top() as CreditsScene;
    expect(credits.lines).toEqual(creditsLines(true));
  });

  it('classic: no wand, the NES text, and the credits read the castle lines as before', () => {
    const h = makeGame();
    h.game.newGame(MARIO, '8-4-end');
    h.until(() => h.top() instanceof LevelScene, 400);
    const w = worldOf(h);
    expect(w.storyMode).toBe(false);
    const from = h.said.length;
    axeToCredits(h);
    expect(w.entities.some((e) => e instanceof WandBreak)).toBe(false);
    expect(h.said.slice(from)).toEqual(['THANK YOU MARIO! YOUR QUEST IS OVER. Credits.']);
    expect((h.top() as CreditsScene).lines).toEqual(CREDITS);
  });
});
