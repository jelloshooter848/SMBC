import { describe, expect, it } from 'vitest';
import { mapPage } from '@content/worldmap';
import { HIDING_HINT, HIDING_SAID, WorldMapScene } from '@game/scenes/world-map';
import type { MenuItem, MenuScene } from '@game/scenes/menu';
import type { MapNode, WorldMapPage } from '@game/map/types';
import type { SaveFile } from '@game/save/save-files';
import type { Settings } from '@engine/save/settings';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { CHARACTERS } from '@game/characters/registry';
import {
  PEDESTAL_STONE,
  TROPHY_BURST_HOPS,
  TROPHY_HOP_EVERY,
  TROPHY_HOP_PX,
  TROPHY_SCALE,
} from '@game/map/trophy';
import { draw, file, makeGame, useStorage, type H } from './heroes-harness';

// The world map's hint for levels that hide a brainwashed hero (docs/HEROES.md "The map hint"):
// nothing before the level is cleared, a faint silhouette peeking from behind the node once it
// is cleared while the hero is still a captive, and the hero beside the node in full colour once
// freed. Luigi hides in 1-1 (its bonus room), Link in 2-1 (its sky ruins), Mega Man in 3-1 (the
// space station above its coin heaven), Samus in 4-2 (her cavern under the vine area).

useStorage();

// 0.4.23: the campaign says the generic line again (Toad's per-hero lines are gone, docs/STORY.md 2.3).
const said = (_hero: string) => HIDING_SAID;
const HIDING = HIDING_SAID;

const W1_CLEAR = ['1-0', '1-1', '1-2', '1-3', '1-4'];

interface Case {
  hero: string;
  /** The hero's map sheet key (sheet@palette) in full colour. */
  colour: string;
  /** Its silhouette's key on that page. */
  shade: string;
  page: string;
  node: string;
  /** A file with the page open, the hero on the node, before its level is cleared. */
  before: Partial<SaveFile>;
  /** The level's clear. */
  level: string;
  side: 1 | -1;
}

const CASES: Case[] = [
  {
    hero: 'luigi',
    colour: 'mario@luigi',
    shade: 'mario@luigi~shade-grass',
    page: 'smb-1',
    node: '1-1',
    before: { cleared: ['1-0'], position: { page: 'smb-1', node: '1-1' } },
    level: '1-1',
    side: 1,
  },
  {
    hero: 'link',
    colour: 'link@link',
    shade: 'link@link~shade-sea',
    page: 'smb-2',
    node: '2-1',
    before: { cleared: W1_CLEAR, pages: ['smb-1', 'smb-2'], position: { page: 'smb-2', node: '2-1' } },
    level: '2-1',
    side: -1,
  },
  {
    hero: 'megaman',
    colour: 'megaman@megaman',
    shade: 'megaman@megaman~shade-night',
    page: 'smb-3',
    node: '3-1',
    before: {
      cleared: [...W1_CLEAR, '2-1', '2-2', '2-3', '2-4'],
      pages: ['smb-1', 'smb-2', 'smb-3'],
      position: { page: 'smb-3', node: '3-1' },
    },
    level: '3-1',
    side: -1,
  },
  {
    hero: 'samus',
    colour: 'samus@samus',
    shade: 'samus@samus~shade-mushroom',
    page: 'smb-4',
    node: '4-2',
    before: {
      cleared: [...W1_CLEAR, '2-1', '2-2', '2-3', '2-4', '3-1', '3-2', '3-3', '3-4', '4-1'],
      pages: ['smb-1', 'smb-2', 'smb-3', 'smb-4'],
      position: { page: 'smb-4', node: '4-2' },
    },
    level: '4-2',
    side: -1,
  },
];

/** File 1 open on the map (dev mode `dev`), the map drawn a few frames in. */
function onMap(over: Partial<SaveFile>, dev = false): { h: H; map: WorldMapScene } {
  const h = makeGame();
  h.game.deps.settings = { dev } as Settings;
  file(over);
  h.game.openFile(1);
  h.idle(8);
  const map = h.top() as WorldMapScene;
  expect(map).toBeInstanceOf(WorldMapScene);
  return { h, map };
}

const nodeOf = (page: string, id: string) =>
  (mapPage(page) as WorldMapPage).nodes.find((n) => n.id === id) as MapNode;

/** The sprites drawn this frame for case `c`: its node's dot, and the hero in colour or shade. */
function hintSprites(map: WorldMapScene, c: Case) {
  const { sprites, texts } = draw(map);
  const n = nodeOf(c.page, c.node);
  const nodeAt = sprites.findIndex((s) => s.x === n.x * 16 && s.y === n.y * 16 && /^map-node/.test(s.frame));
  const shade = sprites.findIndex((s) => s.key === c.shade);
  // The trophy: the hero in colour, not the player's own marker (the player is Mario).
  const trophy = sprites.findIndex((s) => s.key === c.colour);
  return { sprites, texts, n, nodeAt, shade, trophy };
}

describe('map hint for hidden heroes: the three stages', () => {
  for (const c of CASES) {
    describe(`${c.hero} (${c.page} ${c.node})`, () => {
      it('1. before the level is cleared: nothing at all', () => {
        const { h, map } = onMap(c.before);
        const s = hintSprites(map, c);
        expect(s.nodeAt).toBeGreaterThanOrEqual(0);
        expect(s.sprites.some((x) => x.key.includes(`~shade-`))).toBe(false);
        expect(s.trophy).toBe(-1);
        expect(h.said.join(' ')).not.toMatch(/hiding|toad:/i);
        expect(map.hintLine).toBe('');
      });

      it('2. cleared, not freed: a silhouette peeking from behind the node, and a spoken hint', () => {
        const before = c.before as { cleared: string[] };
        const { h, map } = onMap({ ...c.before, cleared: [...before.cleared, c.level] });
        const s = hintSprites(map, c);
        expect(s.trophy).toBe(-1);
        expect(s.shade).toBeGreaterThanOrEqual(0);
        // Drawn before the node's dot (so the dot hides part of it), on the side away from the roads.
        expect(s.shade).toBeLessThan(s.nodeAt);
        const sx = s.sprites[s.shade]!.x;
        if (c.side === 1) expect(sx).toBeGreaterThan(s.n.x * 16);
        else expect(sx).toBeLessThan(s.n.x * 16);
        // Partly behind the node: it overlaps the node's tile.
        expect(Math.abs(sx - s.n.x * 16)).toBeLessThan(16);
        // Standing on the node: the announcer adds the line, the hint line shows it.
        expect(h.said.some((t) => t.includes(said(c.hero)))).toBe(true);
        expect(map.hintLine).toBe(HIDING_HINT);
        expect(s.texts.map((t) => t.str)).toContain(HIDING_HINT);
        // Beyond Toad's hint, it never says where in the level.
        const rest = h.said.join(' ').replace(said(c.hero), '');
        expect(rest).not.toMatch(/bonus|pipe|vine|sky|ruins|station|teleport/i);
      });

      it('3. freed: the hero stands beside the node in full colour, no hint line', () => {
        const before = c.before as { cleared: string[] };
        const { h, map } = onMap({
          ...c.before,
          cleared: [...before.cleared, c.level],
          freed: ['mario', c.hero],
        });
        const s = hintSprites(map, c);
        expect(s.shade).toBe(-1);
        expect(s.trophy).toBeGreaterThan(s.nodeAt); // in front of the dot
        const tx = s.sprites[s.trophy]!.x;
        if (c.side === 1) expect(tx).toBeGreaterThan(s.n.x * 16);
        else expect(tx).toBeLessThan(s.n.x * 16);
        expect(h.said.join(' ')).not.toMatch(/hiding|toad:/i);
        expect(map.hintLine).toBe('');
      });
    });
  }

  it('the line is said only on the node hiding someone: walking on to the next node, it is not', () => {
    const { h, map } = onMap({ cleared: ['1-0', '1-1'], position: { page: 'smb-1', node: '1-1' } });
    expect(h.said.some((t) => t.includes(HIDING))).toBe(true);
    h.said.length = 0;
    h.tap('up'); // 1-1 → 1-2
    h.until(() => map.node === '1-2' && map.hintLine === '' && h.said.length > 0, 300);
    expect(h.said.join(' ')).not.toMatch(/hiding|toad:/i);
    // Back: said again on arrival.
    h.tap('left'); // the road leaves 1-2 to the left
    h.until(() => map.node === '1-1' && h.said.some((t) => t.includes(HIDING)), 300);
  });

  it('the trophy hops for joy every few seconds in its jump frame; the silhouette sits still', () => {
    const c = CASES[0]!;
    const freed = onMap({
      cleared: ['1-0', '1-1'],
      position: { page: 'smb-1', node: '1-1' },
      freed: ['mario', 'luigi'],
    });
    const ys: number[] = [];
    const frames = new Set<string>();
    for (let i = 0; i < TROPHY_HOP_EVERY * 2; i++) {
      freed.h.step();
      const s = hintSprites(freed.map, c);
      const t = s.sprites[s.trophy]!;
      ys.push(t.y);
      frames.add(t.frame);
    }
    const rest = Math.max(...ys);
    // A small hop (TROPHY_HOP_PX, 4 px: the statue is half size), in Luigi's jump frame (his
    // CharacterDef sprite in the air), then back down.
    expect(TROPHY_HOP_PX).toBe(4);
    expect(rest - Math.min(...ys)).toBe(TROPHY_HOP_PX);
    expect(frames).toEqual(new Set(['small-idle', 'small-jump']));
    // Two hops in two cycles, mostly at rest.
    const takeoffs = ys.filter((y, i) => y < rest && (ys[i - 1] ?? rest) === rest).length;
    expect(takeoffs).toBe(2);
    expect(ys.filter((y) => y === rest).length).toBeGreaterThan(ys.length * 0.7);
    const shaded = onMap({ cleared: ['1-0', '1-1'], position: { page: 'smb-1', node: '1-1' } });
    const pos = new Set<string>();
    for (let i = 0; i < 240; i++) {
      shaded.h.step();
      const s = hintSprites(shaded.map, c);
      pos.add(`${s.sprites[s.shade]!.x},${s.sprites[s.shade]!.y}`);
    }
    expect(pos.size).toBe(1);
  });
});

describe('the trophy reads as a statue, not a second player (owner note 13)', () => {
  /** Every sprite (with its scale) and rect drawn for one frame. */
  const frame = (map: WorldMapScene) => {
    const sprites: { key: string; frame: string; x: number; y: number; scale: number }[] = [];
    const rects: { x: number; y: number; w: number; h: number; c: string }[] = [];
    const r: Renderer = Object.assign(new NullRenderer(), {
      sprite(s: SpriteSheet, f: string, x: number, y: number, ...rest: unknown[]): void {
        sprites.push({ key: s.id, frame: f, x, y, scale: (rest[3] as number | undefined) ?? 1 });
      },
      rect(x: number, y: number, w: number, h: number, c: string): void {
        rects.push({ x, y, w, h, c });
      },
    });
    map.render(r);
    return { sprites, rects };
  };
  const freedFile = {
    cleared: ['1-0', '1-1'],
    position: { page: 'smb-1', node: '1-1' },
    freed: ['mario', 'luigi'],
  };

  it('Luigi is drawn at half size on a small stone pedestal; the player stays full size', () => {
    const { map } = onMap(freedFile);
    const { sprites, rects } = frame(map);
    const statue = sprites.find((s) => s.key === 'mario@luigi')!;
    expect(statue.scale).toBe(TROPHY_SCALE);
    expect(TROPHY_SCALE).toBe(0.5);
    const player = sprites.find((s) => s.key === 'mario@mario')!;
    expect(player.scale).toBe(1);
    // The pedestal: stone rects right under the statue's feet (Luigi's 16 px portrait at half: 8).
    const feet = statue.y + 8;
    const stone = rects.filter((b) => (PEDESTAL_STONE as readonly string[]).includes(b.c));
    expect(stone.length).toBeGreaterThan(0);
    expect(Math.min(...stone.map((b) => b.y))).toBe(feet);
    const left = Math.min(...stone.map((b) => b.x));
    const right = Math.max(...stone.map((b) => b.x + b.w));
    expect(right - left).toBeLessThanOrEqual(14);
    expect(left).toBeLessThanOrEqual(statue.x);
    expect(right).toBeGreaterThanOrEqual(statue.x + 8);
  });

  it("the statue and its pedestal stay clear of the player's marker", () => {
    const { map } = onMap(freedFile);
    const { sprites, rects } = frame(map);
    const player = sprites.find((s) => s.key === 'mario@mario')!;
    const stone = rects.filter((b) => (PEDESTAL_STONE as readonly string[]).includes(b.c));
    const statue = sprites.find((s) => s.key === 'mario@luigi')!;
    const boxes = [...stone, { x: statue.x - 1, y: statue.y - 1, w: 10, h: 10 }];
    for (const b of boxes) {
      // The player's marker is 16 px wide from player.x.
      const apart = b.x + b.w <= player.x - 2 || b.x >= player.x + 16 + 2;
      expect(apart).toBe(true);
    }
  });
});

describe('the trophy: glad to be free', () => {
  const freedFile = {
    cleared: ['1-0', '1-1'],
    position: { page: 'smb-1', node: '1-1' },
    freed: ['mario', 'luigi'],
  };
  /** The trophy's sprites and the sparkle's pale rects for one frame. */
  const frame = (map: WorldMapScene) => {
    const sprites: { key: string; frame: string; x: number; y: number }[] = [];
    const rects: string[] = [];
    const r: Renderer = Object.assign(new NullRenderer(), {
      sprite(s: SpriteSheet, f: string, x: number, y: number): void {
        sprites.push({ key: s.id, frame: f, x, y });
      },
      rect(_x: number, _y: number, _w: number, _h: number, c: string): void {
        rects.push(c);
      },
    });
    map.render(r);
    return { sprites, sparkle: rects.filter((c) => c === '#fce4a0').length > 0 };
  };

  it('a 1-px dark outline under it keeps Luigi clear of the grass', () => {
    const { map } = onMap(freedFile);
    const { sprites } = frame(map);
    const body = sprites.find((s) => s.key === 'mario@luigi')!;
    const outline = sprites.filter((s) => s.key === 'mario@luigi~silhouette');
    expect(outline.map((s) => `${s.x - body.x},${s.y - body.y}`).sort()).toEqual(
      ['-1,0', '0,-1', '0,1', '1,0'].sort(),
    );
    // Drawn under the hero.
    expect(sprites.indexOf(body)).toBeGreaterThan(sprites.indexOf(outline[3]!));
  });

  it('a small sparkle at the top of a hop; none with reduce flashing (the hops stay)', () => {
    for (const reduce of [false, true]) {
      const { h, map } = onMap(freedFile);
      h.game.ctx.reduceFlashing = reduce;
      let sparkles = 0;
      let hops = 0;
      for (let i = 0; i < TROPHY_HOP_EVERY; i++) {
        h.step();
        const f = frame(map);
        if (f.sparkle) sparkles++;
        if (f.sprites.some((s) => s.key === 'mario@luigi' && s.frame === 'small-jump')) hops++;
      }
      expect(hops).toBeGreaterThan(0);
      if (reduce) expect(sparkles).toBe(0);
      else {
        expect(sparkles).toBeGreaterThan(0);
        expect(sparkles).toBeLessThan(hops);
      }
    }
  });

  it('just freed: a burst of 3 hops the first time the trophy shows, once', () => {
    const { h, map } = onMap(freedFile);
    // Freed this session (Game.freeHero), as after the mini game.
    h.game.freed = ['mario'];
    h.game.freeHero('luigi');
    expect(h.game.celebrate.has('luigi')).toBe(true);
    const hopsIn = (n: number) => {
      let takeoffs = 0;
      let wasUp = false;
      for (let i = 0; i < n; i++) {
        h.step();
        const up = frame(map).sprites.some((s) => s.key === 'mario@luigi' && s.frame === 'small-jump');
        if (up && !wasUp) takeoffs++;
        wasUp = up;
      }
      return takeoffs;
    };
    expect(hopsIn(TROPHY_BURST_HOPS * 24 + 1)).toBe(TROPHY_BURST_HOPS);
    expect(h.game.celebrate.has('luigi')).toBe(false);
    // Afterwards only the idle hop, every few seconds.
    expect(hopsIn(TROPHY_HOP_EVERY)).toBeLessThanOrEqual(1);
  });

  it("another file's already-freed trophy does no burst: opening a file or the title forgets it", () => {
    const { h } = onMap(freedFile);
    // Freed on this file this session, then quit to the title before the map showed it.
    h.game.freed = ['mario'];
    h.game.freeHero('luigi');
    expect(h.game.celebrate.has('luigi')).toBe(true);
    h.game.showTitle();
    expect(h.game.celebrate.size).toBe(0);
    // And straight into another file (no title in between) that freed Luigi long ago.
    h.game.freed = ['mario'];
    h.game.freeHero('luigi');
    expect(h.game.celebrate.size).toBe(1);
    file(freedFile);
    h.game.openFile(1);
    expect(h.game.celebrate.size).toBe(0);
    h.idle(8);
    const map = h.top() as WorldMapScene;
    let jumps = 0;
    for (let i = 0; i < TROPHY_BURST_HOPS * 24; i++) {
      h.step();
      if (frame(map).sprites.some((s) => s.key === 'mario@luigi' && s.frame === 'small-jump')) jumps++;
    }
    // At most one idle hop (24 frames), not the burst's three.
    expect(jumps).toBeLessThan(24 + 1);
  });

  it('every hero hops in its own jump frame (its CharacterDef sprite in the air)', () => {
    const { h, map } = onMap(freedFile);
    type Look = { sheet: string; palette: string; frame: string };
    const m = map as unknown as { jumpFrame(d: (typeof CHARACTERS)[number]): Look | null };
    for (const def of CHARACTERS) {
      const j = m.jumpFrame(def);
      expect(j, def.id).not.toBeNull();
      expect(h.game.ctx.assets.sheet(j!.sheet, j!.palette).frames.has(j!.frame), def.id).toBe(true);
      expect(j!.frame, def.id).not.toBe(def.portrait.frame);
    }
    expect(m.jumpFrame(CHARACTERS.find((c) => c.id === 'luigi')!)).toEqual({
      sheet: 'mario',
      palette: 'luigi',
      frame: 'small-jump',
    });
  });
});

describe('map hint: shimmer and reduce flashing', () => {
  const cleared = { cleared: ['1-0', '1-1'], position: { page: 'smb-1', node: '1-1' } };
  const keysOver = (h: H, map: WorldMapScene, frames: number) => {
    const keys = new Set<string>();
    for (let i = 0; i < frames; i++) {
      h.step();
      for (const s of draw(map).sprites) if (s.key.includes('~shade-')) keys.add(s.key);
    }
    return keys;
  };

  it('a very slow faint shimmer: the glow shade shows now and then, mostly the plain one', () => {
    const { h, map } = onMap(cleared);
    h.game.ctx.reduceFlashing = false;
    let glow = 0;
    const frames = 720;
    for (let i = 0; i < frames; i++) {
      h.step();
      if (draw(map).sprites.some((s) => s.key === 'mario@luigi~shade-grass-glow')) glow++;
    }
    expect(glow).toBeGreaterThan(0);
    expect(glow).toBeLessThan(frames / 4);
  });

  it('with reduce flashing there is no shimmer', () => {
    const { h, map } = onMap(cleared);
    h.game.ctx.reduceFlashing = true;
    expect(keysOver(h, map, 720)).toEqual(new Set(['mario@luigi~shade-grass']));
  });
});

describe('map hint: dev toggles and campaign only', () => {
  const openMenu = (h: H) => {
    h.tap('select');
    h.idle(8);
    return h.top() as MenuScene;
  };
  const toggle = (h: H, label: string) => {
    const menu = openMenu(h);
    const row = (menu as unknown as { items: MenuItem[] }).items.findIndex((i) => i.label === label);
    expect(row).toBeGreaterThan(0);
    for (let i = 0; i < row; i++) h.tap('down');
    h.tap('right');
    h.tap('attack');
    expect(h.top()).toBeInstanceOf(WorldMapScene);
  };

  it('"All heroes" shows no trophy for a hero not freed (the silhouette stays)', () => {
    const { h } = onMap({ cleared: ['1-0', '1-1'], position: { page: 'smb-1', node: '1-1' } }, true);
    toggle(h, 'All heroes');
    expect(h.game.devAllHeroes).toBe(true);
    const s = hintSprites(h.top() as WorldMapScene, CASES[0]!);
    expect(s.trophy).toBe(-1);
    expect(s.shade).toBeGreaterThanOrEqual(0);
  });

  it('"Unlock all" opens nodes without clearing them: no silhouette', () => {
    const { h } = onMap({ cleared: [], position: { page: 'smb-1', node: 'start' } }, true);
    toggle(h, 'Unlock all');
    expect(h.game.devUnlockAll).toBe(true);
    const s1 = hintSprites(h.top() as WorldMapScene, CASES[0]!);
    expect(s1.nodeAt).toBeGreaterThanOrEqual(0); // 1-1 shows, open
    expect(s1.sprites.some((x) => x.key.includes('~shade-'))).toBe(false);
    h.game.travelToPage('smb-2');
    h.idle(8);
    const s2 = hintSprites(h.top() as WorldMapScene, CASES[1]!);
    expect(s2.nodeAt).toBeGreaterThanOrEqual(0);
    expect(s2.sprites.some((x) => x.key.includes('~shade-'))).toBe(false);
    expect(s2.trophy).toBe(-1);
  });

  it('a hero freed before its node opens shows nothing until the node is drawn', () => {
    // A file started with Luigi frees him, but 1-1 is still locked behind the tutorial.
    const { map } = onMap({ cleared: [], freed: ['mario', 'luigi'] });
    const s = hintSprites(map, CASES[0]!);
    expect(s.nodeAt).toBe(-1);
    expect(s.trophy).toBe(-1);
  });

  it('outside campaign play (no file open) the map shows no hints', () => {
    const h = makeGame();
    h.game.mapProgress.cleared = ['1-0', '1-1'];
    h.game.mapProgress.position = { page: 'smb-1', node: '1-1' };
    h.game.showMap('smb-1');
    h.idle(8);
    const map = h.top() as WorldMapScene;
    expect(h.game.campaign).toBeNull();
    const s = hintSprites(map, CASES[0]!);
    expect(s.shade).toBe(-1);
    expect(h.said.join(' ')).not.toMatch(/hiding|toad:/i);
  });
});
