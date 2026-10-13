import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { PALETTES, SPRITES } from '@content/sprites';
import { billDef } from '@content/sprites/bill';
import { sfx } from '@content/sfx/sfx';
import { AssetRegistry } from '@engine/assets/registry';
import { T as Tl } from '@game/level/tiles';
import { tileAtTiles as tileAt } from '@game/level/schema';
import { LevelScene } from '@game/scenes/level';
import { CardScene, CARD_GUARD_FRAMES } from '@game/scenes/message';
import { CHARACTERS } from '@game/characters/registry';
import { beat } from '@game/story/beats';
import { pageSaid } from '@game/story/cards';
import { SIGHTING_SAID, sightingPage } from '@game/story/script';
import { HeroSightingScene } from '@game/story/hero-sighting';
import { SPIN_SEQUENCE, TRICK_SPIN_FRAMES } from '@game/entities/objects/trick-wall';
import {
  BILL_GONE_AT,
  BILL_SIGHTING,
  BILL_SIGHTING_TIMING,
  GROUND,
  RYU_SIGHTING,
  RYU_SIGHTING_TIMING,
  ryuPanelFrame,
  SIGHTINGS,
  type SightingDraw,
  type SightingScript,
} from '@game/story/sightings';
import { loadSave } from '@game/save/save-files';
import type { SaveFile } from '@game/save/save-files';
import { closeCards, draw, file, makeGame, useStorage, type H } from './heroes-harness';
import { ALL_STORY } from './story-seen';

// Ryu's and Bill's sightings (0.4.53, story/sightings.ts, docs/STORY.md "6-2: the sighting" and
// "7-3: the sighting"): the same rules as every sighting (hero-sighting.test.ts), over their own
// levels: Ryu in 6-2 (shown 6-1) spun through the start castle's wall by a scene-only panel, Bill in
// 7-3 (shown 7-1) hand over hand under the first bridge with the camera panning, then a far boom.

useStorage();

const hero = (id: string) => CHARACTERS.find((c) => c.id === id)!;
const NO_SIGHTINGS = ALL_STORY.filter((id) => !id.startsWith('sighting:'));
const W5 = ['mario', 'luigi', 'link', 'megaman', 'samus', 'simon'];

/** A campaign file that has reached World 6 (and, with Ryu freed, World 7) but seen no sighting. */
function reached(over: Partial<SaveFile> = {}): Partial<SaveFile> {
  return {
    cleared: ['1-0', '1-1', '1-2', '1-3', '1-4', '5-1', '5-2', '5-3', '5-4', '6-1', '6-3', '6-4'],
    pages: ['smb-1', 'smb-2', 'smb-3'],
    freed: W5,
    met: W5,
    story: NO_SIGHTINGS,
    ...over,
  };
}

interface Into {
  over?: Partial<SaveFile>;
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
  h.game.state.character = hero(o.p1 ?? 'simon');
  if (o.p2) h.game.state.character2 = hero(o.p2);
  h.game.startLevel(getLevel(levelId), { mode: o.mode ?? 'stand', ...(o.x !== undefined ? { x: o.x } : {}) });
  for (let i = 0; i < 4 && h.top() instanceof LevelScene; i++) h.step();
  return h;
}

const level = (h: H) => h.game.scenes.find((s) => s instanceof LevelScene) as LevelScene;

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

function closeCard(h: H, key: 'jump' | 'attack' = 'jump', player = 0): void {
  expect(h.top()).toBeInstanceOf(CardScene);
  h.idle(CARD_GUARD_FRAMES + 1);
  h.step(player === 0 ? [key] : [], player === 1 ? [key] : []);
  expect(h.top()).toBeInstanceOf(LevelScene);
}

const frameOf = (s: HeroSightingScene) => ({
  render: (r: Parameters<HeroSightingScene['drawFrame']>[0]) => s.drawFrame(r),
});

const RYU_OVER: Partial<SaveFile> = {};
const BILL_OVER: Partial<SaveFile> = {
  cleared: [...(reached().cleared ?? []), '6-2', '7-1', '7-2', '7-4'],
  freed: [...W5, 'ryu'],
  met: [...W5, 'ryu'],
};

describe.each([
  // Each as two different heroes (player 1's hero speaks the card in their own name).
  ['ryu', '6-2', RYU_SIGHTING, RYU_OVER, 'simon', 'SIMON', 'samus', '6-2-bonus'],
  ['bill', '7-3', BILL_SIGHTING, BILL_OVER, 'ryu', 'RYU', 'mario', '7-3-camp'],
] as const)('%s’s sighting in %s', (id, levelId, script, over, p1, speaker, other, sub) => {
  it('play holds: the brainwashed hero acts it out, then player 1’s hero says line A, announced', () => {
    const h = into(levelId, { p1, over });
    const l = level(h);
    expect(h.top()).toBeInstanceOf(HeroSightingScene);
    expect(h.said).toContain(SIGHTING_SAID[id]);
    expect(h.game.seen(beat.sighting(id))).toBe(true);
    expect(loadSave(1)?.story).toContain(beat.sighting(id));
    const before = snapshot(l);
    const first = draw(frameOf(h.top() as HeroSightingScene)).sprites.find((s) =>
      s.key.endsWith(`${id}~brainwashed`),
    );
    expect(first).toBeDefined();
    h.until(() => h.top() instanceof CardScene, script.frames + 5);
    const page = sightingPage(id, speaker);
    expect((h.top() as CardScene).lines).toEqual(page);
    expect(h.said).toContain(pageSaid(page, true));
    expect(l.underHud).toBeNull();
    h.idle(600);
    expect(h.top()).toBeInstanceOf(CardScene);
    closeCard(h);
    expect(snapshot(l)).toEqual(before);
    h.idle(5);
    expect(l.world.frame).toBe(before.frame + 5);
  });

  it('as another hero, that hero speaks', () => {
    const h = into(levelId, { p1: other, over });
    h.idle(CARD_GUARD_FRAMES + 1);
    h.tap('jump');
    expect((h.top() as CardScene).lines).toEqual(sightingPage(id, hero(other).name.toUpperCase()));
  });

  it('skips (after the guard) straight to the card, mid-action; the level and camera come back exactly', () => {
    const h = into(levelId, { p1, over });
    const l = level(h);
    const before = snapshot(l);
    const s = h.top() as HeroSightingScene;
    h.idle(CARD_GUARD_FRAMES - 3);
    h.tap('jump');
    expect(h.top()).toBe(s);
    // Into the action (Bill: mid-pan), then skipped.
    h.idle(60 - CARD_GUARD_FRAMES);
    h.tap('attack');
    expect((h.top() as CardScene).lines).toEqual(sightingPage(id, speaker));
    expect(snapshot(l)).toEqual(before);
    closeCard(h, 'attack');
    expect(snapshot(l)).toEqual(before);
  });

  it('MENU skips too', () => {
    const h = into(levelId, { p1, over });
    h.idle(CARD_GUARD_FRAMES + 1);
    h.tap('start');
    expect(h.top()).toBeInstanceOf(CardScene);
  });

  it('once per file', () => {
    const h = into(levelId, { p1, over });
    h.idle(CARD_GUARD_FRAMES + 1);
    h.tap('attack');
    closeCards(h);
    h.game.startLevel(getLevel(levelId), { mode: 'stand' });
    h.step();
    expect(h.top()).toBeInstanceOf(LevelScene);
    const story = [...NO_SIGHTINGS, beat.sighting(id)];
    expect(into(levelId, { p1, over: { ...over, story } }).top()).toBeInstanceOf(LevelScene);
  });

  it('never once the hero is freed or met, nor once the level is cleared (old saves too)', () => {
    const base = reached(over);
    for (const o of [
      { freed: [...(base.freed ?? []), id] },
      { met: [...(base.met ?? []), id] },
      { cleared: [...(base.cleared ?? []), levelId] },
    ]) {
      const h = into(levelId, { p1, over: { ...over, ...o } });
      h.idle(10);
      expect(h.top()).toBeInstanceOf(LevelScene);
      expect(h.game.seen(beat.sighting(id))).toBe(false);
    }
  });

  it('never while a player is that hero: skipped, not marked seen', () => {
    for (const o of [{ p1: id }, { p1, p2: id }]) {
      const h = into(levelId, { ...o, over });
      h.idle(10);
      expect(h.top()).toBeInstanceOf(LevelScene);
      expect(h.game.seen(beat.sighting(id))).toBe(false);
    }
  });

  it('not outside the campaign, nor in its sub-areas, nor arriving further in', () => {
    const dev = makeGame();
    dev.game.startLevel(getLevel(levelId), { mode: 'stand' });
    dev.idle(10);
    expect(dev.top()).toBeInstanceOf(LevelScene);
    const s = into(sub, { p1, over, mode: 'fall', x: 2 });
    s.idle(60);
    expect(s.top()).toBeInstanceOf(LevelScene);
    expect(s.game.seen(beat.sighting(id))).toBe(false);
    const far = into(levelId, { p1, over, x: 40 });
    far.idle(10);
    expect(far.top()).toBeInstanceOf(LevelScene);
    expect(far.game.seen(beat.sighting(id))).toBe(false);
  });

  it('co-op: both players held, player 1’s hero speaks, player 2’s press skips', () => {
    const h = into(levelId, { p1, p2: 'luigi', over });
    const l = level(h);
    expect(h.top()).toBeInstanceOf(HeroSightingScene);
    const before = snapshot(l);
    h.idle(CARD_GUARD_FRAMES + 1);
    h.tap('jump', 1);
    expect((h.top() as CardScene).lines).toEqual(sightingPage(id, speaker));
    closeCard(h, 'jump', 1);
    expect(snapshot(l)).toEqual(before);
  });

  it('names only frames that exist, in either flashing setting, and ends empty', () => {
    const assets = new AssetRegistry(PALETTES);
    assets.defineAll(SPRITES);
    for (const reduce of [true, false])
      for (let t = 0; t <= script.frames; t++)
        for (const d of script.draw(t, reduce)) {
          if (d.kind !== 'sprite') continue;
          expect(assets.sheet(d.sheet, d.palette).frames.has(d.frame), `${d.sheet}:${d.frame} at ${t}`).toBe(
            true,
          );
        }
    expect(script.draw(script.frames, false)).toEqual([]);
    expect(SIGHTINGS[levelId]).toBe(script);
    for (const s of Object.values(script.sfx ?? {}))
      expect(
        sfx.some((e) => e.id === s),
        s,
      ).toBe(true);
  });

  it('line A fits the card (26 columns)', () => {
    for (const line of sightingPage(id, speaker)) expect(line.length).toBeLessThanOrEqual(26);
  });
});

const all = (s: SightingScript, reduce = false) =>
  Array.from({ length: s.frames + 1 }, (_, t) => s.draw(t, reduce));
const sprites = (ds: SightingDraw[]) => ds.filter((d) => d.kind === 'sprite');

describe('Ryu: drops in, dashes to the castle wall, a panel spins him through', () => {
  const T = RYU_SIGHTING_TIMING;
  const frames = all(RYU_SIGHTING);
  const ryu = (t: number) => sprites(frames[t]!).find((d) => d.sheet === 'ryu');
  const panel = (t: number) => sprites(frames[t]!).filter((d) => d.sheet === 'ninja');

  it('drops spinning from above the screen and lands crouched facing you, between you and Irene', () => {
    expect(ryu(1)!.frame).toMatch(/^spin-[0-3]$/);
    expect(ryu(1)!.feet).toBeLessThan(16);
    const spins = new Set(frames.slice(1, T.landAt).map((ds) => sprites(ds)[0]!.frame));
    expect(spins).toEqual(new Set(['spin-0', 'spin-1', 'spin-2', 'spin-3']));
    expect(ryu(T.landAt)).toMatchObject({ frame: 'crouch', x: T.x, feet: GROUND, flip: true, fx: true });
    // Irene stands at column 7: he lands short of her, ahead of the hero (column 2).
    expect(T.x + 16).toBeLessThanOrEqual(7 * 16);
    expect(T.x).toBeGreaterThan(2 * 16 + 16);
  });

  it('dashes left to the castle wall and presses into it (walking, never past its face)', () => {
    expect(ryu(T.dashAt + 1)!.frame).toMatch(/^walk-/);
    expect(ryu(T.dashAt + 1)!.x).toBeLessThan(T.x);
    for (let t = T.dashAt; t < T.turnAt; t++) expect(ryu(t)!.x).toBeGreaterThanOrEqual(T.wallX + 16);
    expect(ryu(T.turnAt - 1)!.x).toBe(T.wallX + 16);
  });

  it('the panel is the trick wall’s half turn in the castle brick, out and back; at rest nothing is drawn', () => {
    expect(panel(T.turnAt - 1)).toEqual([]);
    const seen: string[] = [];
    for (let t = T.turnAt; t < T.restAt; t++) {
      const p = panel(t);
      expect(p).toHaveLength(2);
      for (const d of p) expect(d).toMatchObject({ palette: 'ninja-castle-city', x: T.wallX });
      for (const d of p) expect(d.fx).toBeFalsy();
      expect(p.map((d) => d.feet)).toEqual([GROUND - 16, GROUND]);
      if (seen.at(-1) !== p[0]!.frame) seen.push(p[0]!.frame);
    }
    expect(seen).toEqual([...SPIN_SEQUENCE, ...[...SPIN_SEQUENCE].reverse().slice(1)]);
    expect(ryuPanelFrame(T.restAt)).toBeNull();
    for (let t = T.restAt; t <= RYU_SIGHTING.frames; t++) expect(frames[t]).toEqual([]);
    expect(T.turnBackAt - T.turnAt).toBe(TRICK_SPIN_FRAMES);
    // Scene-only: no shuriken mark, no cracked tile, ever.
    for (const ds of frames)
      for (const d of sprites(ds)) expect(['shuriken-mark', 'trick-wall-cracked']).not.toContain(d.frame);
  });

  it('he goes in with the panel and is gone from the edge-on frame', () => {
    const edge = frames.findIndex((_, t) => ryuPanelFrame(t) === 'trick-wall-2');
    expect(ryu(edge - 1)).toBeDefined();
    expect(ryu(edge - 1)!.x).toBeLessThan(T.wallX + 16);
    for (let t = edge; t <= RYU_SIGHTING.frames; t++) expect(ryu(t)).toBeUndefined();
    // Drawn under the panel, so its turning face covers him as he goes in.
    const ds = sprites(frames[edge - 1]!);
    expect(ds[0]!.sheet).toBe('ryu');
  });

  it('the panel sits over the start castle’s right-hand wall in 6-2 (decor-castle at column 0)', () => {
    const lvl = getLevel('6-2');
    expect(lvl.entities.some((e) => e.type === 'decor-castle' && e.x === 0 && e.y === 12)).toBe(true);
    // The street under the wall: he stands on ground there.
    expect(tileAt(lvl, T.wallX / 16 + 1, 13)).toBe(Tl.GROUND);
  });
});

describe('Bill: hand over hand under the first bridge, lets go off screen, a far boom', () => {
  const B = BILL_SIGHTING_TIMING;
  const frames = all(BILL_SIGHTING);
  const bill = (t: number) => sprites(frames[t]!).find((d) => d.sheet === 'bill');

  it('lies prone on the stone blocks, then springs up and looks back at you', () => {
    expect(bill(1)).toMatchObject({ frame: 'prone', x: B.x, feet: B.stoneTop, flip: false, fx: true });
    expect(bill(B.standAt)).toMatchObject({ frame: 'idle', flip: true });
    const lvl = getLevel('7-3');
    // The blocks' top (row 10) under him, and the first bridge's girder from column 15.
    expect(tileAt(lvl, Math.floor(B.x / 16), B.stoneTop / 16)).not.toBe(Tl.AIR);
    expect(tileAt(lvl, 15, 10)).toBe(Tl.BRIDGE);
    expect(B.hangX).toBe(15 * 16);
    expect(B.hangTop).toBe(11 * 16);
  });

  it('rolls off the edge, catches the girder and goes hand over hand (hang-0/1 every 10 frames)', () => {
    expect(bill(B.rollAt + 1)!.frame).toMatch(/^spin-/);
    expect(bill(B.catchAt)).toMatchObject({ frame: 'hang-0', x: B.hangX, feet: B.hangTop + 32 });
    expect(bill(B.catchAt + B.swapEvery)!.frame).toBe('hang-1');
    expect(bill(B.catchAt + 2 * B.swapEvery)!.frame).toBe('hang-0');
    expect(bill(B.catchAt + 10)!.x - bill(B.catchAt)!.x).toBe(10 * B.hang);
  });

  it('is out of view (the panned screen’s right edge) before he lets go; never seen falling', () => {
    expect(bill(BILL_GONE_AT - 1)!.x).toBeLessThan(B.pan + 256);
    expect(bill(BILL_GONE_AT)).toBeUndefined();
    expect(BILL_GONE_AT).toBeLessThan(B.whistleAt);
    for (let t = B.catchAt; t < BILL_GONE_AT; t++) expect(bill(t)!.frame).toMatch(/^hang-[01]$/);
    for (let t = BILL_GONE_AT; t <= BILL_SIGHTING.frames; t++) expect(bill(t)).toBeUndefined();
  });

  it('the whistle (a new sound), the thud, then the far boom at the screen edge, not in the fx palette', () => {
    expect(BILL_SIGHTING.sfx).toMatchObject({
      [B.whistleAt]: 'fall-whistle',
      [B.thudAt]: 'bump',
      [B.boomAt]: 'bridge-boom',
    });
    expect(B.whistleAt).toBeLessThan(B.thudAt);
    expect(B.thudAt).toBeLessThan(B.boomAt);
    const booms = frames.flatMap((ds) => sprites(ds).filter((d) => d.sheet === 'contra'));
    expect(new Set(booms.map((d) => d.frame))).toEqual(new Set(['boom-0', 'boom-1', 'boom-2', 'boom-3']));
    for (const d of booms) {
      expect(d.fx).toBeUndefined();
      expect(d.x).toBeGreaterThan(B.pan + 256 - 32);
    }
    expect(B.boomAt + B.boomFrames).toBeLessThanOrEqual(B.backAt);
  });

  it('the camera eases right with him and comes back before the card', () => {
    const h = into('7-3', { p1: 'ryu', over: BILL_OVER });
    const l = level(h);
    const cam0 = l.world.camera.pxX;
    expect(cam0).toBe(0);
    const seen: number[] = [];
    while (h.top() instanceof HeroSightingScene) {
      seen.push(l.world.camera.pxX);
      h.step();
    }
    expect(Math.max(...seen)).toBe(B.pan);
    expect(seen.indexOf(B.pan)).toBeLessThan(BILL_GONE_AT);
    expect(seen.at(-1)).toBe(0);
    expect(h.top()).toBeInstanceOf(CardScene);
    expect(l.world.camera.pxX).toBe(cam0);
  });

  it('the new sound is registered, and the hang frames keep his standing face', () => {
    expect(sfx.some((e) => e.id === 'fall-whistle')).toBe(true);
    const idle = billDef.frames.idle as readonly string[];
    for (const f of ['hang-0', 'hang-1']) {
      const rows = billDef.frames[f] as readonly string[];
      expect(rows).toHaveLength(32);
      // Head, headband and face (rows 4-11 but the hair's tuft row): idle's, a pixel further left.
      for (const y of [4, 5, 6, 8, 9, 10, 11])
        expect(rows[y]!.slice(4, 12), `${f} row ${y}`).toBe(idle[y]!.slice(5, 13));
      // Hands up at the girder: rows 0-2 hold opaque pixels on one side or both.
      expect(rows.slice(0, 3).join('')).toMatch(/1/);
    }
  });
});

describe('both, with reduce flashing on (the harness default)', () => {
  it.each([
    ['6-2', 'simon', RYU_OVER],
    ['7-3', 'ryu', BILL_OVER],
  ] as const)('%s: the sparkles keep their colours', (levelId, p1, over) => {
    const h = into(levelId, { p1, over });
    const s = h.top() as HeroSightingScene;
    expect(h.game.ctx.reduceFlashing).toBe(true);
    const colours: string[][] = [];
    for (let i = 0; i < 20; i++) {
      const c: string[] = [];
      s.drawFrame(
        Object.assign(Object.create(null), {
          rect: (_x: number, _y: number, _w: number, _h: number, col: string) => c.push(col),
          sprite: () => {},
        }),
      );
      colours.push(c);
      h.step();
    }
    for (const c of colours) expect(c).toEqual(colours[0]);
  });
});
