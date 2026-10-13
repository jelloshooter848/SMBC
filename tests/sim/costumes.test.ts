import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { costumesDef, costumePalettes, COSTUME_OF_WORLD } from '@content/sprites/costumes';
import { enemiesDef } from '@content/sprites/enemies';
import { PALETTES } from '@content/sprites';
import { NES } from '@engine/gfx/palette';
import { ScriptedInput } from '@game/sim/headless';
import { World } from '@game/world/world';
import { DEFAULT_ASSIST, newGameState } from '@game/context';
import { AssetRegistry } from '@engine/assets/registry';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import type { AssetRegistry as Assets } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { tileAt } from '@engine/math/units';
import { Bowser } from '@game/entities/enemies/bowser';
import { CostumePile } from '@game/entities/effects/costume-pile';
import { CHARACTERS } from '@game/characters/registry';
import { campaignLevel } from '@game/level/campaign';
import { T } from '@game/level/tiles';
import { castleRemark, CASTLE_PAGES, HOME_REMARKS, REMARK_CASTLES } from '@game/story/script';
import type { CharacterDef } from '@game/characters/character';
import type { LevelData } from '@game/level/schema';
import type { Action } from '@engine/input/actions';
import type { View } from '@game/entities/entity';

// The fake Bowsers' villain costumes (0.4.47, roadmap #31; content/sprites/costumes.ts): in the
// campaign's castles 2-4 to 7-4 the fake wears a cheap costume of the world's villain; however he
// dies it falls off (a pile on the floor, said for the screen reader; with a fall it goes down
// with him), his true form shows, and the hero's reveal line plays: the castle's own hero says a
// home line. World 1's fake wears the plain king suit; classic play, 8-4 and the Lost Kingdom none.

const hero = (id: string) => CHARACTERS.find((c) => c.id === id) as CharacterDef;

function castle(id: string, opts: { story?: boolean; hero?: string; reduce?: boolean } = {}) {
  const story = opts.story ?? true;
  const level: LevelData = story ? campaignLevel(getLevel(id)) : getLevel(id);
  const axe = level.entities.find((e) => e.type === 'axe') as { x: number; y: number };
  const state = newGameState(hero(opts.hero ?? 'mario'));
  state.world = level.world;
  const said: string[] = [];
  const remarks: { level: string; hero: string }[] = [];
  const world = new World(
    level,
    {
      assets: new AssetRegistry({ default: {} }),
      audio: NULL_AUDIO,
      assist: { ...DEFAULT_ASSIST, invulnerable: true },
      reduceFlashing: opts.reduce ?? true,
    },
    state,
    { x: axe.x - 9, y: 8, mode: 'stand' },
  );
  world.storyMode = story;
  // The remark card closes a few frames on (as a press would).
  let close: (() => void) | null = null;
  world.remarkHook = (level, h, done) => {
    remarks.push({ level, hero: h.id });
    close = done;
    return true;
  };
  const input = new ScriptedInput({ steps: [{ frame: 0, hold: [] as Action[] }] });
  const step = (n = 1) => {
    for (let i = 0; i < n; i++) {
      input.next();
      world.update([input]);
      const c: (() => void) | null = close;
      close = null;
      c?.();
      for (const ev of world.events.splice(0)) if (ev.type === 'say') said.push(ev.text);
    }
  };
  for (let i = 0; i < 10 && !world.entities.some((e) => e instanceof Bowser); i++) step();
  step();
  const b = world.entities.find((e): e is Bowser => e instanceof Bowser && !e.fake);
  if (!b) throw new Error(`${id}: no Bowser`);
  return { world, step, b, axe, said, remarks };
}

const piles = (w: World) => w.entities.filter((e): e is CostumePile => e instanceof CostumePile && e.alive);

const COSTUMED = ['2-4', '3-4', '4-4', '5-4', '6-4', '7-4'];

describe('the costumes: the art', () => {
  it('six costumes and six piles, 32x32, every index in the costumes palette', () => {
    expect(Object.keys(COSTUME_OF_WORLD).map(Number)).toEqual([2, 3, 4, 5, 6, 7]);
    const pal = costumePalettes.costumes!;
    const digits = '0123456789abcdefghijklmnopqrstuvwxyz';
    for (const w of [2, 3, 4, 5, 6, 7])
      for (const name of [`costume-${w}`, `costume-drop-${w}`]) {
        const rows = costumesDef.frames[name];
        expect(rows, name).toHaveLength(32);
        for (const row of rows!) {
          expect(row, name).toHaveLength(32);
          for (const ch of row)
            if (ch !== '.') expect(digits.indexOf(ch), `${name} ${ch}`).toBeLessThan(pal.length);
        }
      }
  });

  it("indices 0-b are the castle king's own colours; high contrast lifts the dark grey", () => {
    const own = enemiesDef.palette;
    expect(own).toBeDefined();
    const pal = costumePalettes.costumes!;
    expect(pal[1]).toBe(NES.black);
    expect(pal[12]).toBe(NES.darkGray);
    expect(PALETTES.highContrast?.costumes?.[12]).toBe(NES.gray);
  });
});

describe('the costumes: who wears one', () => {
  it.each(COSTUMED)("%s (campaign): the fake wears his world's costume", (id) => {
    const { b } = castle(id);
    expect(b.costume).toBe(Number(id[0]));
  });

  it.each([
    ['1-4', true],
    ['8-4-end', true],
    ['ll-2-4', true],
    ['2-4', false],
    ['7-4', false],
  ] as const)('%s (story %s): no costume', (id, story) => {
    const { b } = castle(id, { story });
    expect(b.costume).toBe(0);
  });
});

/** A recording renderer and a view over it: the frames drawn, by sheet. */
function drawn(b: Bowser, reduceFlashing: boolean, frame: number): string[] {
  const out: string[] = [];
  const r: Renderer = Object.assign(new NullRenderer(), {
    sprite(s: SpriteSheet, f: string): void {
      out.push(`${(s as unknown as { key: string }).key}:${f}`);
    },
  });
  const assets = { sheet: (key: string) => ({ key }) } as unknown as Assets;
  const view: View = { camX: 0, frame, assets, theme: 'castle', reduceFlashing };
  b.render(r, view);
  return out;
}

describe('the costumes: drawn over him, and the tell', () => {
  it('worn over his frame; with the tell showing, the flicker hides it (true form)', () => {
    const { world, step, b } = castle('2-4', { reduce: false });
    expect(drawn(b, false, world.frame)).toContain('costumes:costume-2');
    for (let i = 0; i < 400 && !b.tellShowing; i++) step();
    expect(b.tellShowing).toBe(true);
    const frames = drawn(b, false, world.frame);
    expect(frames).not.toContain('costumes:costume-2');
    expect(frames.some((f) => f.endsWith('bowser-die-2'))).toBe(true);
  });

  it('reduce flashing: no flicker; the costume stays, the steady true-form outline over it', () => {
    const { world, step, b } = castle('2-4', { reduce: true });
    for (let i = 0; i < 400 && !b.tellWindow; i++) step();
    expect(b.tellWindow).toBe(true);
    for (let i = 0; i < 6; i++) {
      const frames = drawn(b, true, world.frame);
      expect(frames).toContain('costumes:costume-2');
      expect(frames.at(-1)).toMatch(/bowser-ghost-2$/);
      step();
    }
  });
});

describe('the costumes: they drop, however he dies', () => {
  it.each(COSTUMED)('%s, weapons: a pile where he stood, said; the true form on the bridge', (id) => {
    const { world, step, b, said, remarks } = castle(id);
    for (let i = 0; i < 5; i++) b.hit({ kind: 'fireball', amount: 1, owner: world.player, dirX: 1 }, world);
    step();
    expect(b.costume).toBe(0);
    expect(b.standing).toBe(Number(id[0]));
    const [pile, ...more] = piles(world);
    expect(more).toEqual([]);
    expect(pile!.world).toBe(Number(id[0]));
    expect(said.some((s) => /costume falls off in a heap/.test(s))).toBe(true);
    // The pile lies on the floor and goes down with the bridge.
    const y0 = pile!.body.y;
    step(20);
    expect(pile!.body.y).toBe(y0);
    for (let i = 0; i < 900 && !world.castleText.length; i++) step();
    expect(remarks).toEqual([{ level: id, hero: 'mario' }]);
    expect(world.castleText.length).toBeGreaterThan(0);
    // Where the bridge went from under it, it fell into the lava; on the stone, it still lies there.
    const col = tileAt(pile!.body.x + (pile!.body.w >> 1));
    const row = tileAt(pile!.body.y + pile!.body.h);
    if (pile!.alive) {
      expect(pile!.body.y).toBe(y0);
      expect(world.map.collisionAt(col, row)).not.toBe('none');
    } else expect(world.map.get(col, row)).not.toBe(T.BRIDGE);
  });

  it.each(COSTUMED)('%s, the axe with him standing: it falls off at the axe', (id) => {
    const { world, step, b, axe, said, remarks } = castle(id);
    const p = world.player.body;
    let row = axe.y + 1;
    while (row < world.level.height && !world.map.isSolid(axe.x, row)) row++;
    p.x = (axe.x * 16 + 8) * 256 - (p.w >> 1);
    p.y = row * 16 * 256 - p.h;
    p.vx = 0;
    p.vy = 0;
    world.camera.snapTo(p.x);
    step(3);
    expect(b.costume).toBe(0);
    expect(piles(world)).toHaveLength(1);
    expect(said.some((s) => /costume falls off in a heap/.test(s))).toBe(true);
    for (let i = 0; i < 900 && !world.castleText.length; i++) step();
    expect(remarks).toEqual([{ level: id, hero: 'mario' }]);
    expect(world.castleText.length).toBeGreaterThan(0);
  });

  it.each(COSTUMED)('%s, a fall into the lava: the costume goes down with him, said', (id) => {
    const { world, step, b, said } = castle(id);
    const c0 = tileAt(b.body.x) - 1;
    const c1 = tileAt(b.body.x + b.body.w) + 1;
    for (let tx = c0; tx <= c1; tx++)
      for (let ty = 0; ty < world.level.height; ty++)
        if (world.map.get(tx, ty) === T.BRIDGE) world.map.set(tx, ty, T.AIR);
    for (let i = 0; i < 200 && b.alive; i++) step();
    expect(b.alive).toBe(false);
    expect(b.costume).toBe(0);
    expect(said.some((s) => /costume goes down with it/.test(s))).toBe(true);
  });

  it('a pile on the bridge goes down with it when the axe drops it', () => {
    const { world, step, b, axe } = castle('2-4');
    // Spawned on a bridge tile, as when he is beaten out on the bridge.
    let bx = axe.x - 1;
    while (world.map.get(bx, 10) !== T.BRIDGE && bx > 0) bx--;
    expect(world.map.get(bx, 10)).toBe(T.BRIDGE);
    const pile = new CostumePile((bx * 16 - 16) * 256, (160 - 32) * 256, 2, false);
    world.spawn(pile);
    step(10);
    expect(pile.body.y).toBe((160 - 32) * 256);
    for (let i = 0; i < 5; i++) b.hit({ kind: 'fireball', amount: 1, owner: world.player, dirX: 1 }, world);
    for (let i = 0; i < 2000 && !world.castleText.length && pile.alive; i++) step();
    expect(pile.alive).toBe(false);
  });

  it('dropped from a fake in mid-jump, the pile lands on the bridge', () => {
    const { world, step, axe } = castle('2-4');
    let bx = axe.x - 1;
    while (world.map.get(bx, 10) !== T.BRIDGE && bx > 0) bx--;
    const pile = new CostumePile((bx * 16 - 16) * 256, (160 - 32 - 20) * 256, 2, false);
    world.spawn(pile);
    step(40);
    expect(pile.alive).toBe(true);
    expect(pile.body.y).toBe((160 - 32) * 256);
    expect(pile.body.vy).toBe(0);
  });

  it('World 1: the plain king suit; no pile, nothing said of a costume', () => {
    const { world, step, b, said } = castle('1-4');
    for (let i = 0; i < 5; i++) b.hit({ kind: 'fireball', amount: 1, owner: world.player, dirX: 1 }, world);
    step(5);
    expect(piles(world)).toEqual([]);
    expect(said.some((s) => /costume/.test(s))).toBe(false);
  });
});

describe('the costumes: the reveal lines', () => {
  it("each costumed castle has its reveal line, shared by every hero; Toad's pages unchanged", () => {
    expect(REMARK_CASTLES).toEqual(['1-4', ...COSTUMED]);
    expect(castleRemark('2-4', 'MARIO')).toEqual(['MARIO:', '', '...THAT WAS A KOOPA IN A', 'DRESS?!']);
    expect(castleRemark('5-4', 'SIMON', 'simon')).toEqual([
      'SIMON:',
      '',
      'A VAMPIRE?! NO... JUST A',
      'LAKITU WITH HAIR GEL.',
    ]);
    expect(castleRemark('7-4', 'MARIO', 'mario')?.join(' ')).toContain('REAL KING MUST BE CLOSE.');
    expect(CASTLE_PAGES['2-4']?.reveal.join(' ')).toContain('KOOPA');
  });

  it("the castle's own hero says a home line instead (Link, Mega Man, Samus, Ryu, Bill; not Simon)", () => {
    expect(HOME_REMARKS).toEqual([
      ['2-4', 'link'],
      ['3-4', 'megaman'],
      ['4-4', 'samus'],
      ['6-4', 'ryu'],
      ['7-4', 'bill'],
    ]);
    for (const [level, id] of HOME_REMARKS) {
      const home = castleRemark(level, 'X', id);
      const shared = castleRemark(level, 'X', 'mario');
      expect(home, `${level} ${id}`).not.toEqual(shared);
      // Another castle's own hero hears the shared line here.
      const other = HOME_REMARKS.find(([l]) => l !== level)![1];
      expect(castleRemark(level, 'X', other)).toEqual(shared);
    }
    expect(castleRemark('2-4', 'LINK', 'link')).toEqual([
      'LINK:',
      '',
      'GANON?! ...NO. GANON IS',
      'TALLER. AND NOT A KOOPA.',
    ]);
  });

  it('every reveal line fits its card and names no level', () => {
    const pages = [
      ...REMARK_CASTLES.map((l) => castleRemark(l, 'SOPHIA III')!),
      ...HOME_REMARKS.map(([l, id]) => castleRemark(l, 'SOPHIA III', id)!),
    ];
    for (const p of pages) {
      expect(p.length).toBeLessThanOrEqual(6);
      for (const l of p) expect(l.length, l).toBeLessThanOrEqual(26);
      expect(p.join(' ')).not.toMatch(/\b[1-8]-[1-4]\b/);
    }
  });
});
