import { describe, expect, it } from 'vitest';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import type { Settings } from '@engine/save/settings';
import { WorldMapScene } from '@game/scenes/world-map';
import { CRASH_FRAMES } from '@game/map/airship-crash';
import { secretExit } from '@game/map/rules';
import { CRYSTAL_BALL } from '@game/map/captives';
import { getLevel } from '@content/levels';
import { newSave, writeSave, type SaveFile } from '@game/save/save-files';
import { file, makeGame, useStorage, type H } from './heroes-harness';
import { ALL_STORY } from './story-seen';

// The World 4 map's airship crash (owner decision 8:25 PM PDT, docs/WORLD_MAP.md): after Larry is
// beaten and the crystal ball's card is dismissed, the airship flies in smoking and tips, the
// hero jumps out onto 4-2, the ship crashes on the bonus spot, Toad hammers the wreck into the
// bonus node and leaves; then the usual reveal draws the road from 4-2 to the bonus spot.

useStorage();

const W3 = ['1-0', '1-1', '1-2', '1-3', '1-4', '2-1', '2-2', '2-3', '2-4', '3-1', '3-2', '3-3', '3-4'];
const world4 = (over: Partial<SaveFile> = {}): Partial<SaveFile> => ({
  cleared: [...W3, '4-1'],
  pages: ['smb-1', 'smb-2', 'smb-3', 'smb-4'],
  position: { page: 'smb-4', node: '4-2' },
  lives: 4,
  // Toad's map scenes (0.4.13; the crash's cards in toad-guide.test.ts) are seen.
  story: [...ALL_STORY],
  ...over,
});

/** A campaign game on file 1 (written first), standing on World 4's map. */
function open(over: Partial<SaveFile> = world4(), reduceFlashing = true): H {
  const h = makeGame();
  (h.game.deps.ctx as { reduceFlashing: boolean }).reduceFlashing = reduceFlashing;
  h.game.deps.settings = { dev: false } as Settings;
  if (Object.keys(over).length) file(over);
  h.game.openFile(1);
  h.idle(8);
  return h;
}

/** Larry beaten, the ball's card dismissed: the hand-off to the map (Game.takeCrystalBall). */
function takeBall(h: H): WorldMapScene {
  h.game.takeCrystalBall('4-2-airship');
  const map = h.top() as WorldMapScene;
  expect(map).toBeInstanceOf(WorldMapScene);
  return map;
}

/** Everything one frame draws: sprites (sheet, frame, place) and rects. */
function frame(scene: { render(r: Renderer): void }) {
  const sprites: { key: string; frame: string; x: number; y: number }[] = [];
  const rects: { x: number; y: number; w: number; h: number; color: string }[] = [];
  const r: Renderer = Object.assign(new NullRenderer(), {
    sprite(s: SpriteSheet, f: string, x: number, y: number): void {
      sprites.push({ key: s.id, frame: f, x, y });
    },
    rect(x: number, y: number, w: number, h: number, color: string): void {
      rects.push({ x, y, w, h, color });
    },
  });
  scene.render(r);
  return { sprites, rects };
}

/** The end state to compare: the hero's place, the road's dots and the nodes drawn. */
function endState(map: WorldMapScene) {
  const { sprites } = frame(map);
  return {
    node: map.node,
    hero: [map.hx, map.hy],
    dots: sprites.filter((s) => s.frame === 'map-path-dot').map((s) => [s.x, s.y]),
    nodes: sprites
      .filter(
        (s) =>
          s.frame.startsWith('map-node') || s.frame.startsWith('node-') || s.frame.startsWith('map-castle'),
      )
      .map((s) => [s.frame, s.x, s.y]),
  };
}

/** Today's plain return to the map (no cutscene), its reveal drawn in. */
function plainReveal(): ReturnType<typeof endState> {
  const h = open();
  h.game.inventoryUnlocked = true;
  h.game.returnToMap(secretExit(h.game.mapProgress, '4-2-airship', CRYSTAL_BALL, getLevel));
  const map = h.top() as WorldMapScene;
  expect(map.cutscene).toBe(false);
  h.until(() => !map.revealing, 600);
  return endState(map);
}

const TOAD_HOUSE = (s: { key: string; frame: string; x: number; y: number }) =>
  s.key === 'smb3' && s.frame === 'node-toad-house' && s.x === 32 && s.y === 208;

describe('the airship crash on the World 4 map', () => {
  it('plays its beats, then the reveal, ending as the plain reveal does', () => {
    const h = open();
    const map = takeBall(h);
    expect(map.cutscene).toBe(true);
    expect(map.revealing).toBe(true);
    expect(map.touchLabels().jump).toBe('SKIP');
    const seen = new Set<string>();
    let heroBeforeJump = false;
    let heroLanded = false;
    let houseBeforeBuild = false;
    for (let f = 0; f < CRASH_FRAMES.END + 2 && map.cutscene; f++) {
      const { sprites } = frame(map);
      for (const s of sprites) if (s.key === 'smb3') seen.add(s.frame);
      const t = f; // the cutscene's clock starts with the first update
      const hero = sprites.find((s) => s.key.startsWith('mario'));
      if (t < CRASH_FRAMES.JUMP - 1 && hero) heroBeforeJump = true;
      if (t > CRASH_FRAMES.LAND && hero && hero.y === 11 * 16 + 10 - 16) heroLanded = true;
      if (t < CRASH_FRAMES.BUILD - 1 && sprites.some(TOAD_HOUSE)) houseBeforeBuild = true;
      h.step();
    }
    expect(map.cutscene).toBe(false);
    expect(heroBeforeJump, 'the hero stays aboard until he jumps').toBe(false);
    expect(houseBeforeBuild, 'the bonus node waits for Toad').toBe(false);
    expect(heroLanded, 'the hero stands on 4-2 after his jump').toBe(true);
    for (const f of [
      'map-airship-0',
      'map-airship-tilt',
      'map-wreck',
      'map-smoke-0',
      'map-dust-0',
      'toad-map-0',
      'toad-map-hammer-0',
      'toad-map-hammer-1',
    ])
      expect(seen, f).toContain(f);
    // The announcer narrates the beats.
    for (const line of [/airship limps over World 4/, /jumps out onto 4-2/, /airship crashes/, /Toad/])
      expect(
        h.said.some((t) => line.test(t)),
        String(line),
      ).toBe(true);
    // One line opens it: the page's own line, the first beat and the skip hint together (said
    // apart, the next frame's line would talk over them).
    const first = h.said.find((t) => /limps over World 4/.test(t)) as string;
    expect(first).toMatch(
      /^World 4, PLANET ZEBES\. World 4-2, .*\. Larry's airship limps over World 4, smoking\. Skip: JUMP/,
    );
    expect(h.said.some((t) => /^Skip:/.test(t))).toBe(false);
    // Toad's house stands; now the road draws in, and the map ends as today's reveal does.
    expect(frame(map).sprites.some(TOAD_HOUSE)).toBe(true);
    expect(map.revealing).toBe(true);
    h.until(() => !map.revealing, 300);
    expect(h.game.pendingReveal).toEqual([]);
    expect(endState(map)).toEqual(plainReveal());
    expect(map.node).toBe('4-2');
    expect(h.said.at(-1)).toMatch(/Toad House, open/);
  });

  it('co-op: neither hero is drawn aboard; both jump out and stand on 4-2', () => {
    const h = makeGame();
    h.game.deps.settings = { dev: false } as Settings;
    writeSave({ ...newSave(1, 'mario', 'luigi'), ...world4(), freed: ['mario', 'luigi'] });
    h.game.openFile(1);
    h.idle(8);
    const s = h.game.state;
    expect(s.character2).not.toBeNull();
    const map = takeBall(h);
    expect(map.cutscene).toBe(true);
    // Each hero's map sprite (its portrait sheet and palette), and where it stands.
    const heroes = () => {
      const { sprites } = frame(map);
      return [s.character, s.character2!].map((c) =>
        sprites.find(
          (sp) =>
            sp.key === h.game.ctx.assets.sheet(c.portrait.sheet, c.portrait.palette).id &&
            sp.frame === c.portrait.frame,
        ),
      );
    };
    for (let f = 0; f < CRASH_FRAMES.JUMP - 1; f++) {
      expect(heroes().filter(Boolean), `frame ${f}`).toEqual([]);
      h.step();
    }
    while (
      map.cutscene &&
      h.game.scenes.top === map &&
      (map as unknown as { crash: { scene: { t: number } } }).crash.scene.t <= CRASH_FRAMES.LAND
    )
      h.step();
    const [a, b] = heroes();
    expect(a && b).toBeTruthy();
    // On the 4-2 node (64, 176): player one on it, player two a little behind (x - 7, y - 2).
    const feet = (sp: { y: number }, c: typeof s.character) =>
      sp.y +
      (h.game.ctx.assets.sheet(c.portrait.sheet, c.portrait.palette).frames.get(c.portrait.frame)?.h ?? 16);
    expect(feet(a!, s.character)).toBe(11 * 16 + 10);
    expect(feet(b!, s.character2!)).toBe(11 * 16 + 8);
    expect(h.said.some((t) => /Mario and Luigi jump out onto 4-2!/.test(t))).toBe(true);
  });

  it('JUMP skips straight to the end: road drawn, hero on 4-2, the bonus node shown', () => {
    const h = open();
    const map = takeBall(h);
    h.idle(40);
    expect(map.cutscene).toBe(true);
    h.tap('jump');
    expect(map.cutscene).toBe(false);
    expect(map.revealing).toBe(false);
    expect(h.game.pendingReveal).toEqual([]);
    expect(endState(map)).toEqual(plainReveal());
    expect(frame(map).sprites.some(TOAD_HOUSE)).toBe(true);
  });

  it('plays once: never again on reload, mid-way or after', () => {
    const h = open();
    takeBall(h);
    h.idle(60);
    // Reloaded mid-way (the save holds the pending road): just the reveal.
    const again = open({});
    const map = again.top() as WorldMapScene;
    expect(map).toBeInstanceOf(WorldMapScene);
    expect(map.cutscene).toBe(false);
    again.until(() => !map.revealing, 300);
    expect(frame(map).sprites.some(TOAD_HOUSE)).toBe(true);
    // And never on later visits.
    const later = open({});
    expect((later.top() as WorldMapScene).cutscene).toBe(false);
    expect((later.top() as WorldMapScene).revealing).toBe(false);
    // Taking the ball again (the secret already found) plays nothing either.
    expect(takeBall(later).cutscene).toBe(false);
  });

  it('reduce flashing: no crash flash (without it, a brief one)', () => {
    const flashes = (reduce: boolean) => {
      const h = open(world4(), reduce);
      const map = takeBall(h);
      let n = 0;
      for (let f = 0; f < CRASH_FRAMES.END && map.cutscene; f++) {
        if (frame(map).rects.some((r) => r.w >= 256 && r.h >= 240 && r.color.startsWith('rgba(255'))) n++;
        h.step();
      }
      return n;
    };
    expect(flashes(true)).toBe(0);
    expect(flashes(false)).toBeGreaterThan(0);
  });

  it('nothing happens without beating Larry', () => {
    const h = open();
    const map = h.top() as WorldMapScene;
    expect(map.cutscene).toBe(false);
    expect(h.game.mapCutscene).toBeNull();
    // Clearing 4-2 at its flagpole opens 4-3, with no airship.
    h.game.levelCleared('4-2');
    const after = h.top() as WorldMapScene;
    expect(after.cutscene).toBe(false);
    h.until(() => !after.revealing, 300);
    expect(frame(after).sprites.some(TOAD_HOUSE)).toBe(false);
  });
});
