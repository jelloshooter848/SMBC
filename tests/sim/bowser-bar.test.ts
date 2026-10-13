import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { ScriptedInput } from '@game/sim/headless';
import { World } from '@game/world/world';
import { BOSS_BAR_HOLD } from '@game/world/boss-bar';
import { DEFAULT_ASSIST, newGameState } from '@game/context';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { px, tileAt } from '@engine/math/units';
import { Bowser } from '@game/entities/enemies/bowser';
import { MARIO } from '@game/characters/mario';
import { campaignLevel } from '@game/level/campaign';
import { T } from '@game/level/tiles';
import type { LevelData } from '@game/level/schema';
import type { Action } from '@engine/input/actions';

// 0.4.47 (#30): every Bowser, fake and real, in every castle, 8-4 included, has a boss health
// bar while the fight is on, in the campaign only (the original Crossover shows no boss bar).
// It starts when he comes on screen, empties on hits, and shows empty a moment after a weapon
// kill; it is gone at once for a kill by the axe or a fall. (Larry's bar: Larry.hpMode.)

function castle(id: string, story = true, back = 9) {
  const level: LevelData = story ? campaignLevel(getLevel(id)) : getLevel(id);
  const axe = level.entities.find((e) => e.type === 'axe') as { x: number; y: number };
  const state = newGameState(MARIO);
  state.world = level.world;
  const said: string[] = [];
  const world = new World(
    level,
    {
      assets: new AssetRegistry({ default: {} }),
      audio: NULL_AUDIO,
      assist: { ...DEFAULT_ASSIST, invulnerable: true },
      reduceFlashing: true,
    },
    state,
    { x: axe.x - back, y: 8, mode: 'stand' },
  );
  world.storyMode = story;
  // The remark card closes a frame on (as a press would).
  let close: (() => void) | null = null;
  world.remarkHook = (_l, _h, done) => {
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
  const b = world.entities.find((e): e is Bowser => e instanceof Bowser && !e.fake);
  if (!b) throw new Error(`${id}: no Bowser`);
  return { world, step, b, axe, said };
}

/** The hero on the axe's tile, feet on the floor under it. */
function toAxe(world: World, axe: { x: number; y: number }): void {
  const p = world.player.body;
  let row = axe.y + 1;
  while (row < world.level.height && !world.map.isSolid(axe.x, row)) row++;
  p.x = px(axe.x * 16 + 8) - (p.w >> 1);
  p.y = px(row * 16) - p.h;
  p.vx = 0;
  p.vy = 0;
  world.camera.snapTo(p.x);
}

const fire = (b: Bowser, world: World) =>
  b.hit({ kind: 'fireball', amount: 1, owner: world.player, dirX: 1 }, world);

/** The castle is over: the bridge is down and the walk has ended (Toad, or the princess). */
const done = (world: World) => world.castleText.length > 0 || world.bossClear?.stop !== undefined;

// Chapter 1's castles, and the Lost Kingdom's first and last (its 8-4 room has a fake and the king).
const CASTLES = ['1-4', '2-4', '3-4', '4-4', '5-4', '6-4', '7-4', '8-4-end', 'll-1-4', 'll-8-4-end3'];

describe('the Bowser bar: shown while the fight is on (campaign)', () => {
  it.each(CASTLES)('%s: on when he is on screen, full; each hit takes a notch', (id) => {
    const { world, step, b, said } = castle(id);
    step(2);
    expect(world.bossBar.shown).toBe(true);
    expect(world.bossBar.max).toBe(5);
    expect(world.bossBar.hp).toBe(5);
    expect(said.some((s) => s.startsWith('Bowser'))).toBe(true);
    fire(b, world);
    step();
    expect(world.bossBar.hp).toBe(4);
    fire(b, world);
    fire(b, world);
    step();
    expect(world.bossBar.hp).toBe(2);
    expect(said.at(-1)).toMatch(/2 of 5/);
  });

  it('not before he comes on screen', () => {
    const level = campaignLevel(getLevel('1-4'));
    const state = newGameState(MARIO);
    state.world = 1;
    const world = new World(
      level,
      {
        assets: new AssetRegistry({ default: {} }),
        audio: NULL_AUDIO,
        assist: DEFAULT_ASSIST,
        reduceFlashing: false,
      },
      state,
      { x: 2, y: 8, mode: 'stand' },
    );
    world.storyMode = true;
    const input = new ScriptedInput({ steps: [{ frame: 0, hold: [] as Action[] }] });
    for (let i = 0; i < 30; i++) {
      input.next();
      world.update([input]);
    }
    expect(world.bossBar.shown).toBe(false);
  });

  it('off screen again (a maze loop, the hero turned back): it goes, and comes back with him', () => {
    const { world, step, b } = castle('1-4');
    step(2);
    fire(b, world);
    step();
    expect(world.bossBar.shown).toBe(true);
    // The screen moves away from him (as 4-4's and 7-4's loops send the hero back).
    const p = world.player.body;
    const x0 = p.x;
    p.x = Math.max(px(16), b.body.x - px(30 * 16));
    world.camera.snapTo(p.x);
    step();
    expect(world.bossBar.shown).toBe(false);
    p.x = x0;
    world.camera.snapTo(p.x);
    step(2);
    expect(world.bossBar.shown).toBe(true);
    expect(world.bossBar.hp).toBe(4);
  });

  it('a despawned boss leaves no bar behind', () => {
    const { world, step, b } = castle('1-4');
    step(2);
    expect(world.bossBar.shown).toBe(true);
    b.destroy();
    step();
    expect(world.bossBar.shown).toBe(false);
  });

  it('classic play keeps the original: no bar', () => {
    const { world, step, b } = castle('1-4', false);
    step(5);
    expect(world.bossBar.shown).toBe(false);
    fire(b, world);
    step();
    expect(world.bossBar.shown).toBe(false);
  });
});

describe('the Bowser bar: each kind of death', () => {
  it.each(CASTLES)('%s, weapons: the last hit empties it; it shows empty a moment, then goes', (id) => {
    const { world, step, b, axe } = castle(id);
    step(2);
    for (let i = 0; i < 5; i++) fire(b, world);
    expect(world.bossBar.shown).toBe(true);
    expect(world.bossBar.hp).toBe(0);
    step(BOSS_BAR_HOLD - 2);
    expect(world.bossBar.shown).toBe(true);
    step(4);
    expect(world.bossBar.shown).toBe(false);
    // It never comes back for the rest of the scene (no unmask scene: the hero takes the axe).
    if (!world.unmask) toAxe(world, axe);
    for (let i = 0; i < 1500 && !done(world); i++) {
      step();
      expect(world.bossBar.shown).toBe(false);
    }
    expect(done(world)).toBe(true);
  });

  it.each(CASTLES)('%s, the axe with him standing: gone at once', (id) => {
    const { world, step, b, axe } = castle(id);
    step(2);
    fire(b, world);
    step();
    expect(world.bossBar.shown).toBe(true);
    toAxe(world, axe);
    step();
    expect(world.bossBar.shown).toBe(false);
    for (let i = 0; i < 1500 && !done(world); i++) {
      step();
      expect(world.bossBar.shown).toBe(false);
    }
    expect(done(world)).toBe(true);
  });

  it.each(CASTLES)('%s, a fall into the lava: gone at once', (id) => {
    const { world, step, b } = castle(id);
    step(2);
    expect(world.bossBar.shown).toBe(true);
    const c0 = tileAt(b.body.x) - 1;
    const c1 = tileAt(b.body.x + b.body.w) + 1;
    for (let tx = c0; tx <= c1; tx++)
      for (let ty = 0; ty < world.level.height; ty++)
        if (world.map.get(tx, ty) === T.BRIDGE) world.map.set(tx, ty, T.AIR);
    for (let i = 0; i < 200 && b.alive; i++) step();
    expect(b.alive).toBe(false);
    expect(world.bossBar.shown).toBe(false);
  });
});

describe('the Bowser bar: a fake on the way (the Lost Kingdom), then the king', () => {
  it("ll-8-4's hammer fake gets the bar; once he is beaten, the king's comes up as he appears", () => {
    const level = campaignLevel(getLevel('ll-8-4-end3'));
    const state = newGameState(MARIO);
    state.world = level.world;
    const world = new World(
      level,
      {
        assets: new AssetRegistry({ default: {} }),
        audio: NULL_AUDIO,
        assist: { ...DEFAULT_ASSIST, invulnerable: true },
        reduceFlashing: true,
      },
      state,
      { x: 18, y: 8, mode: 'stand' },
    );
    world.storyMode = true;
    const input = new ScriptedInput({ steps: [{ frame: 0, hold: [] as Action[] }] });
    const step = (n = 1) => {
      for (let i = 0; i < n; i++) {
        input.next();
        world.update([input]);
        world.events.splice(0);
      }
    };
    step(5);
    const fake = world.entities.find((e): e is Bowser => e instanceof Bowser && e.fake);
    expect(fake).toBeDefined();
    expect(world.bossBar.shown).toBe(true);
    expect(world.bossBar.isFor(fake!)).toBe(true);
    for (let i = 0; i < 5; i++) fire(fake!, world);
    step(BOSS_BAR_HOLD + 2);
    expect(world.bossBar.shown).toBe(false);
    // On toward the king: his bar when he comes on screen.
    const p = world.player.body;
    // On the bridge's left end (row 10), the king ahead.
    p.x = px(114 * 16);
    p.y = px(10 * 16) - p.h;
    world.camera.snapTo(p.x);
    let king: Bowser | undefined;
    for (let i = 0; i < 60 && !world.bossBar.shown; i++) {
      step();
      king = world.entities.find((e): e is Bowser => e instanceof Bowser && !e.fake && e.alive);
    }
    expect(king).toBeDefined();
    expect(world.bossBar.isFor(king!)).toBe(true);
    expect(world.bossBar.hp).toBe(5);
  });
});
