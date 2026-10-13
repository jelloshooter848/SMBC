import { describe, expect, it, vi } from 'vitest';
import { getLevel } from '@content/levels';
import { PALETTES, SPRITES } from '@content/sprites';
import { AssetRegistry } from '@engine/assets/registry';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import { LevelScene } from '@game/scenes/level';
import { CardScene, CARD_GUARD_FRAMES } from '@game/scenes/message';
import { CHARACTERS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { beat, SIGHTING_HEROES } from '@game/story/beats';
import { pageSaid } from '@game/story/cards';
import { SIGHTING_SAID, sightingPage } from '@game/story/script';
import { HeroSightingScene } from '@game/story/hero-sighting';
import {
  BURST_LIFE,
  LINK_SIGHTING,
  LINK_SIGHTING_TIMING,
  MEGAMAN_SIGHTING,
  MEGAMAN_SIGHTING_TIMING,
  SIGHTINGS,
  type SightingDraw,
  type SightingScript,
} from '@game/story/sightings';
import { loadSave } from '@game/save/save-files';
import type { SaveFile } from '@game/save/save-files';
import { closeCards, draw, file, makeGame, useStorage, type H } from './heroes-harness';
import { ALL_STORY } from './story-seen';

// The hero sightings (0.4.51, story/sightings.ts, docs/STORY.md): a world's brainwashed hero
// glimpsed at the start of its first level, then player 1's hero's card. Campaign only, once per
// file, over the frozen level, skippable; built so far: Link (2-1) and Mega Man (3-1).

useStorage();

const hero = (id: string) => CHARACTERS.find((c) => c.id === id)!;
const NO_SIGHTINGS = ALL_STORY.filter((id) => !id.startsWith('sighting:'));

/** A campaign file that has reached World 2 and 3 (World 1 and 2 done) but seen no sighting. */
function reached(over: Partial<SaveFile> = {}): Partial<SaveFile> {
  return {
    cleared: ['1-0', '1-1', '1-2', '1-3', '1-4', '2-2', '2-3', '2-4'],
    pages: ['smb-1', 'smb-2', 'smb-3'],
    freed: ['mario', 'luigi'],
    met: ['mario', 'luigi'],
    story: NO_SIGHTINGS,
    ...over,
  };
}

interface Into {
  over?: Partial<SaveFile>;
  /** Player 1's hero (and player 2's, for co-op). */
  p1?: string;
  p2?: string;
  mode?: 'stand' | 'fall';
  x?: number;
}

function into(levelId: string, o: Into = {}): H {
  const h = makeGame();
  file(reached(o.over));
  h.game.openFile(1);
  h.idle(4);
  h.game.state.character = hero(o.p1 ?? MARIO.id);
  if (o.p2) h.game.state.character2 = hero(o.p2);
  h.game.startLevel(getLevel(levelId), { mode: o.mode ?? 'stand', ...(o.x !== undefined ? { x: o.x } : {}) });
  // The level's first frames settle the players on the ground; a sighting starts on the next.
  for (let i = 0; i < 4 && h.top() instanceof LevelScene; i++) h.step();
  return h;
}

const level = (h: H) => h.game.scenes.find((s) => s instanceof LevelScene) as LevelScene;

/** What the level holds that must come back exactly: the clock, frame, camera and every body. */
function snapshot(l: LevelScene) {
  const w = l.world;
  return {
    frame: w.frame,
    time: w.time,
    camX: w.camera.x,
    camY: w.camera.y,
    players: w.players.map((p) => [p.body.x, p.body.y, p.body.vx, p.body.vy, p.facing, p.anim]),
    entities: w.entities.map((e) => [e.constructor.name, e.body.x, e.body.y, e.body.vx, e.body.vy, e.alive]),
  };
}

/** Closes the card on top with one press (by `player`), the level not yet stepped after it. */
function closeCard(h: H, key: 'jump' | 'attack' = 'jump', player = 0): void {
  expect(h.top()).toBeInstanceOf(CardScene);
  h.idle(CARD_GUARD_FRAMES + 1);
  h.step(player === 0 ? [key] : [], player === 1 ? [key] : []);
  expect(h.top()).toBeInstanceOf(LevelScene);
}

/** Every sprite and rect a scene draws, with each rect's colour. */
function drawAll(scene: { render(r: Renderer): void }) {
  const rects: { x: number; y: number; c: string }[] = [];
  const sprites: { key: string; frame: string; x: number; y: number; flip: boolean }[] = [];
  const r: Renderer = Object.assign(new NullRenderer(), {
    rect(x: number, y: number, _w: number, _h: number, c: string): void {
      rects.push({ x, y, c });
    },
    sprite(s: { id: string }, frame: string, x: number, y: number, flip?: boolean): void {
      sprites.push({ key: s.id, frame, x, y, flip: flip === true });
    },
  });
  scene.render(r);
  return { rects, sprites };
}

describe.each([
  ['link', '2-1', LINK_SIGHTING, MARIO.id, 'MARIO'],
  ['megaman', '3-1', MEGAMAN_SIGHTING, 'link', 'LINK'],
] as const)('%s’s sighting in %s', (id, levelId, script, p1, speaker) => {
  const over = id === 'megaman' ? { freed: ['mario', 'luigi', 'link'], met: ['mario', 'luigi', 'link'] } : {};

  it('play holds: the brainwashed hero acts it out, then player 1’s hero says the card, announced', () => {
    const h = into(levelId, { p1, over });
    const l = level(h);
    expect(h.top()).toBeInstanceOf(HeroSightingScene);
    expect(h.said).toContain(SIGHTING_SAID[id]);
    expect(h.game.seen(beat.sighting(id))).toBe(true);
    expect(loadSave(1)?.story).toContain(beat.sighting(id));
    const before = snapshot(l);
    const first = draw(h.top() as HeroSightingScene).sprites.find((s) => s.key.endsWith(`${id}~brainwashed`));
    expect(first).toBeDefined();
    // Ahead of the player, on the start screen.
    expect(first!.x).toBeGreaterThan(l.world.player.body.x / 256 + 64);
    expect(first!.x).toBeLessThan(256);
    h.until(() => h.top() instanceof CardScene, script.frames + 5);
    const page = sightingPage(id, speaker);
    expect((h.top() as CardScene).lines).toEqual(page);
    expect(page[0]).toBe(`${speaker}:`);
    expect(h.said).toContain(pageSaid(page, true));
    // The card waits for a press, never a timer.
    h.idle(600);
    expect(h.top()).toBeInstanceOf(CardScene);
    closeCard(h);
    expect(h.top()).toBe(l);
    // The level resumes exactly where it was: nothing moved, the clock held.
    expect(snapshot(l)).toEqual(before);
    h.idle(5);
    expect(l.world.frame).toBe(before.frame + 5);
  });

  it('a press after the guard skips straight to the card; the level resumes exactly', () => {
    const h = into(levelId, { p1, over });
    const l = level(h);
    const before = snapshot(l);
    const s = h.top() as HeroSightingScene;
    h.idle(CARD_GUARD_FRAMES - 3);
    expect(s.touchLabels().jump).toBeNull();
    h.tap('jump'); // too soon: the guard holds it
    expect(h.top()).toBe(s);
    h.idle(2);
    expect(s.touchLabels().jump).toBe('SKIP');
    h.tap('attack');
    expect(h.top()).toBeInstanceOf(CardScene);
    expect((h.top() as CardScene).lines).toEqual(sightingPage(id, speaker));
    // BACK closes the card as any story card.
    closeCard(h, 'attack');
    expect(h.top()).toBe(l);
    expect(snapshot(l)).toEqual(before);
  });

  it('MENU skips it too, and never opens the pause menu over it', () => {
    const h = into(levelId, { p1, over });
    h.idle(CARD_GUARD_FRAMES + 1);
    h.tap('start');
    expect(h.top()).toBeInstanceOf(CardScene);
  });

  it('once per file: not again on TRY AGAIN or a new visit', () => {
    const h = into(levelId, { p1, over });
    h.idle(CARD_GUARD_FRAMES + 1);
    h.tap('attack');
    closeCards(h);
    h.game.startLevel(getLevel(levelId), { mode: 'stand' });
    h.step();
    expect(h.top()).toBeInstanceOf(LevelScene);
    const again = into(levelId, { p1, over: { ...over, story: [...NO_SIGHTINGS, beat.sighting(id)] } });
    expect(again.top()).toBeInstanceOf(LevelScene);
  });

  it('not once the hero is freed or met, nor once the level is cleared', () => {
    const base = reached(over);
    for (const o of [
      { freed: [...(base.freed ?? []), id] },
      { met: [...(base.met ?? []), id] },
      { cleared: [...(base.cleared ?? []), levelId] },
    ]) {
      const h = into(levelId, { p1, over: { ...over, ...o } });
      expect(h.top()).toBeInstanceOf(LevelScene);
      h.idle(10);
      expect(h.top()).toBeInstanceOf(LevelScene);
      expect(h.game.seen(beat.sighting(id))).toBe(false);
    }
  });

  it('not while any player is that hero (dev "All heroes"): skipped, not marked seen', () => {
    for (const o of [{ p1: id }, { p1, p2: id }]) {
      const h = into(levelId, { ...o, over });
      h.idle(10);
      expect(h.top()).toBeInstanceOf(LevelScene);
      expect(h.game.seen(beat.sighting(id))).toBe(false);
    }
  });

  it('not outside the campaign (classic, dev starts, ?level=), nor in its sub-areas', () => {
    const classic = makeGame();
    classic.game.newGame(MARIO, levelId);
    classic.until(() => classic.top() instanceof LevelScene, 400);
    classic.idle(10);
    expect(classic.top()).toBeInstanceOf(LevelScene);
    const dev = makeGame();
    dev.game.startLevel(getLevel(levelId), { mode: 'stand' });
    dev.idle(10);
    expect(dev.top()).toBeInstanceOf(LevelScene);
    const sub = into(`${levelId}-bonus`, { p1, over, mode: 'fall', x: 2 });
    sub.idle(60);
    expect(sub.top()).toBeInstanceOf(LevelScene);
    expect(sub.game.seen(beat.sighting(id))).toBe(false);
  });

  it('only once every player stands on the start screen: a fall in waits until landed', () => {
    const h = into(levelId, { p1, over, mode: 'fall' });
    expect(h.top()).toBeInstanceOf(LevelScene);
    expect(h.game.seen(beat.sighting(id))).toBe(false);
    h.until(() => h.top() instanceof HeroSightingScene, 300);
    expect(level(h).world.players.every((p) => p.body.onGround)).toBe(true);
    // Arriving further in (a warp, a return from a sub-area) is not the start: nothing plays.
    const far = into(levelId, { p1, over, x: 40 });
    far.idle(10);
    expect(far.top()).toBeInstanceOf(LevelScene);
    expect(far.game.seen(beat.sighting(id))).toBe(false);
  });

  it('co-op: both players held, player 1’s hero speaks, either player’s press skips', () => {
    const h = into(levelId, { p1, p2: 'luigi', over });
    const l = level(h);
    expect(l.world.players).toHaveLength(2);
    expect(h.top()).toBeInstanceOf(HeroSightingScene);
    const before = snapshot(l);
    h.idle(CARD_GUARD_FRAMES + 1);
    h.tap('jump', 1);
    expect((h.top() as CardScene).lines).toEqual(sightingPage(id, speaker));
    closeCard(h, 'jump', 1);
    expect(snapshot(l)).toEqual(before);
  });

  it('the script ends within its frames and names only frames that exist', () => {
    const assets = new AssetRegistry(PALETTES);
    assets.defineAll(SPRITES);
    for (const reduce of [true, false])
      for (let t = 0; t <= script.frames; t++)
        for (const d of script.draw(t, reduce)) {
          if (d.kind !== 'sprite') continue;
          expect(assets.sheet(d.sheet).frames.has(d.frame), `${d.sheet}:${d.frame} at ${t}`).toBe(true);
        }
    // The last beat is empty: everything has left the screen before the card.
    expect(script.draw(script.frames, false)).toEqual([]);
  });
});

describe('what each sighting shows', () => {
  const frames = (s: SightingScript, reduce: boolean) =>
    Array.from({ length: s.frames + 1 }, (_, t) => s.draw(t, reduce));
  const sprites = (ds: SightingDraw[]) => ds.filter((d) => d.kind === 'sprite');

  it('Link: back turned, looks back once, a vine grows out of the ground, he climbs it, it slides up after him', () => {
    const T = LINK_SIGHTING_TIMING;
    const all = frames(LINK_SIGHTING, false);
    const link = (t: number) => sprites(all[t]!).find((d) => d.sheet === 'link');
    expect(link(1)).toMatchObject({ frame: 'idle', flip: false, fx: true, sparkles: true });
    expect(link(T.lookAt)!.flip).toBe(true);
    expect(link(T.lookEnd)!.flip).toBe(false);
    // No vine before the magic; from the ground up once it starts.
    expect(all[T.growAt - 1]!.some((d) => d.kind === 'vine')).toBe(false);
    const vine = (t: number) => all[t]!.find((d) => d.kind === 'vine');
    expect(vine(T.growAt + 10)).toMatchObject({ base: 208, top: 208 - 30 });
    expect(all[T.growAt + 1]!.some((d) => d.kind === 'burst')).toBe(true);
    // He climbs it (climb-0/1) and is out of sight before the vine's foot leaves the screen.
    expect(link(T.climbAt + 8)!.frame).toMatch(/^climb-[01]$/);
    expect(link(T.climbAt + 8)!.x).toBe(T.vineX);
    const gone = all.findIndex((ds, t) => t > T.climbAt && !ds.some((d) => d.kind === 'sprite'));
    const vineGone = all.findIndex((ds, t) => t > T.slideAt && !ds.some((d) => d.kind === 'vine'));
    expect(gone).toBeGreaterThan(T.slideAt);
    expect(vineGone).toBeGreaterThan(gone);
    // It slides up whole at 4 px a frame: its foot leaves the ground.
    expect((vine(T.slideAt + 10) as { base: number }).base).toBe(208 - 40);
    expect(LINK_SIGHTING.frames - vineGone).toBeLessThanOrEqual(T.beat + 1);
  });

  it('Mega Man: blinks, the helmet flickers (held once with reduce flashing), he faces you and beams up', () => {
    const T = MEGAMAN_SIGHTING_TIMING;
    const at = (t: number, reduce: boolean) => sprites(MEGAMAN_SIGHTING.draw(t, reduce))[0]!;
    expect(at(1, false)).toMatchObject({ sheet: 'megaman', frame: 'idle', flip: false });
    expect(at(T.blinkAt, false).frame).toBe('idle-blink');
    const flicker = (reduce: boolean) => {
      const out = new Set<string>();
      for (let t = T.flickerAt; t < T.gatherAt; t++) out.add(`${at(t, reduce).frame}@${at(t, reduce).x}`);
      return out;
    };
    expect(flicker(false)).toEqual(new Set(['bare-idle@140', 'idle@141']));
    expect(flicker(true)).toEqual(new Set(['bare-idle@140']));
    expect(at(T.gatherAt, false)).toMatchObject({ frame: 'teleport-0', flip: true });
    const beams = (reduce: boolean) => {
      const out = new Set<string>();
      for (let t = T.beamAt; t <= MEGAMAN_SIGHTING.frames; t++)
        for (const d of sprites(MEGAMAN_SIGHTING.draw(t, reduce))) {
          expect(d).toMatchObject({ sheet: 'station', fx: true });
          expect(d.sparkles).toBeFalsy();
          out.add(d.frame);
        }
      return out;
    };
    expect(beams(false)).toEqual(new Set(['beam-0', 'beam-1']));
    expect(beams(true)).toEqual(new Set(['beam-0']));
    // The streak rises 8 px a frame (the pad's own speed).
    const top = (t: number) => sprites(MEGAMAN_SIGHTING.draw(t, false))[0]!.feet;
    expect(top(T.beamAt + 1) - top(T.beamAt + 2)).toBe(8);
  });

  it('reduce flashing: the sparkles keep one colour each, never twinkle', () => {
    const h = into('2-1');
    const s = h.top() as HeroSightingScene;
    expect(h.game.ctx.reduceFlashing).toBe(true);
    const colours = (n: number) => {
      const seen: string[][] = [];
      for (let i = 0; i < n; i++) {
        seen.push(drawAll(s).rects.map((r) => r.c));
        h.step();
      }
      return seen;
    };
    // Link's three drifting sparkles: the same three colours every frame.
    const c = colours(20);
    for (const f of c) expect(f).toEqual(c[0]);
  });

  it('every built sighting is a reserved beat, and plays in the level it names', () => {
    for (const [lvl, s] of Object.entries(SIGHTINGS)) {
      expect(s.level).toBe(lvl);
      expect(SIGHTING_HEROES).toContain(s.hero);
      expect(BURST_LIFE).toBeGreaterThan(0);
    }
    expect(Object.keys(SIGHTINGS).sort()).toEqual(['2-1', '3-1']);
  });
});

describe('a sighting’s camera pan (scene support for later sightings)', () => {
  const PAN: SightingScript = {
    hero: 'link',
    level: '2-1',
    frames: 120,
    pan: { dx: 96, at: 10, back: 70, speed: 2, backSpeed: 8 },
    draw: () => [],
  };

  function panned() {
    const h = into('2-1', { over: { story: [...NO_SIGHTINGS, beat.sighting('link')] } });
    const l = level(h);
    expect(h.top()).toBe(l);
    const next = vi.fn(() => h.game.scenes.pop());
    const before = snapshot(l);
    h.game.scenes.push(new HeroSightingScene(h.game, l.world, PAN, next));
    return { h, l, next, before };
  }

  it('eases out and back, and the camera is put back exactly before the card', () => {
    const { h, l, next, before } = panned();
    h.idle(20);
    expect(l.world.camera.x).toBe(before.camX + (20 - 10 + 1) * 2 * 256);
    h.idle(40);
    expect(l.world.camera.pxX).toBe(96 + before.camX / 256);
    h.idle(20);
    expect(l.world.camera.x).toBeLessThan(before.camX + 96 * 256);
    h.until(() => next.mock.calls.length > 0, 200);
    expect(snapshot(l)).toEqual(before);
  });

  it('a skip mid-pan puts the camera back at once', () => {
    const { h, l, next, before } = panned();
    h.idle(CARD_GUARD_FRAMES + 5);
    expect(l.world.camera.x).toBeGreaterThan(before.camX);
    h.step(['jump']);
    expect(next).toHaveBeenCalledTimes(1);
    expect(snapshot(l)).toEqual(before);
  });
});
