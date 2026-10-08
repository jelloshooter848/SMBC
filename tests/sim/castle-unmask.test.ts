import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { ScriptedInput } from '@game/sim/headless';
import { World } from '@game/world/world';
import { DEFAULT_ASSIST, newGameState } from '@game/context';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { MARIO } from '@game/characters/mario';
import { Bowser } from '@game/entities/enemies/bowser';
import { Corpse } from '@game/entities/effects/effects';
import { WandPoof } from '@game/entities/effects/wand-poof';
import { castleRemark } from '@game/story/script';
import type { LevelData } from '@game/level/schema';
import type { Action } from '@engine/input/actions';
import type { CharacterDef } from '@game/characters/character';
import { px, toPx } from '@engine/math/units';

// The fake Bowsers' unmasking scenes (0.4.23, docs/STORY.md 2.3a; world/unmask.ts): campaign
// castles 1-4 to 7-4 only. Beaten with weapons, the disguise bursts, the creature drops onto the
// bridge dazed and the hero jumps over it to the axe; reaching the axe with the fake standing,
// the disguise bursts, the hero looks and says the castle's remark, then pulls the axe. Classic
// play, 8-4 and the Lost Kingdom keep today's behaviour.

const levels = join(import.meta.dirname, '../../src/content/levels');
const load = (path: string, id: string): LevelData =>
  parseTextMap(readFileSync(join(levels, path), 'utf8'), id);

function makeWorld(level: LevelData, story: boolean, x: number) {
  const sfx: string[] = [];
  const state = newGameState(MARIO);
  state.world = level.world;
  const world = new World(
    level,
    {
      assets: new AssetRegistry({ default: {} }),
      audio: { ...NULL_AUDIO, sfx: (id: string) => void sfx.push(id) },
      assist: { ...DEFAULT_ASSIST, invulnerable: true },
      reduceFlashing: true,
    },
    state,
    { x, y: 8, mode: 'stand' },
  );
  world.storyMode = story;
  return { world, sfx, input: new ScriptedInput({ steps: [{ frame: 0, hold: [] as Action[] }] }) };
}

const axeX = (level: LevelData) => (level.entities.find((e) => e.type === 'axe') as { x: number }).x;
const bowserOf = (w: World) => w.entities.find((e): e is Bowser => e instanceof Bowser && !e.fake);

function step(world: World, input: ScriptedInput, n = 1): void {
  for (let i = 0; i < n; i++) {
    input.next();
    world.update([input]);
    world.events.splice(0);
  }
}

/** A castle with Bowser spawned, the player `back` tiles before the axe. */
function castle(path: string, id: string, story: boolean, back: number) {
  const level = load(path, id);
  const r = makeWorld(level, story, axeX(level) - back);
  for (let i = 0; i < 10 && !bowserOf(r.world); i++) step(r.world, r.input);
  const b = bowserOf(r.world);
  if (!b) throw new Error('no Bowser');
  return { ...r, level, b };
}

/** Puts the player on the axe's tile (on the floor beside it). */
function toAxe(world: World, level: LevelData): void {
  const p = world.player.body;
  p.x = px(axeX(level) * 16 + 2);
  p.y = px(9 * 16) - p.h;
  p.vx = 0;
  p.vy = 0;
  world.camera.snapTo(p.x);
}

const kill = (b: Bowser, world: World) => {
  for (let i = 0; i < 5; i++) b.hit({ kind: 'fireball', amount: 1, owner: null, dirX: 1 }, world);
};

describe('beaten with weapons (campaign castles 1-4 to 7-4)', () => {
  it.each([
    ['1-4', 'world1/1-4.map'],
    ['3-4', 'world3/3-4.map'],
    ['7-4', 'world7/7-4.map'],
  ])('%s: the disguise bursts, the creature drops dazed, the hero jumps over it to the axe', (id, path) => {
    const { world, input, b, sfx } = castle(path, id, true, 9);
    kill(b, world);
    expect(b.alive).toBe(true);
    expect(b.standing).toBe(Number(id[0]));
    expect(b.dazed).toBe(true);
    expect(world.unmask?.kind).toBe('killed');
    expect(world.entities.some((e) => e instanceof WandPoof)).toBe(true);
    expect(world.entities.some((e) => e instanceof Corpse)).toBe(false);
    expect(sfx).toContain('poof');
    const p = world.player;
    const groundY = p.body.y;
    let jumped = false;
    let over = false;
    for (let i = 0; i < 900 && !world.bossClear; i++) {
      step(world, input);
      if (p.anim === 'jump') jumped = true;
      if (p.body.y + p.body.h < b.body.y + b.body.h - px(b.standingHeight)) over = true;
    }
    expect(jumped).toBe(true);
    expect(over).toBe(true);
    expect(world.bossClear).not.toBeNull();
    expect(world.unmask).toBeNull();
    expect(toPx(p.body.x)).toBeGreaterThan(toPx(b.body.x + b.body.w));
    expect(p.body.y).toBeLessThanOrEqual(groundY + px(16));
    // The bridge falls; the creature falls with it, its true form, no second poof.
    const poofs = sfx.filter((s) => s === 'poof').length;
    step(world, input, 80);
    expect(b.currentFrame).toBe(`bowser-die-${id[0]}`);
    expect(sfx.filter((s) => s === 'poof').length).toBe(poofs);
  });

  it('beaten from the foot of the bridge, the axe not spawned yet: the scene still plays to the axe', () => {
    const { world, input, b } = castle('world1/1-4.map', '1-4', true, 13);
    const axeAlive = () => world.entities.some((e) => e.kind === 'axe' && e.alive);
    expect(axeAlive()).toBe(false); // off the screen's edge: not spawned
    kill(b, world);
    expect(world.unmask?.kind).toBe('killed');
    expect(b.alive).toBe(true);
    expect(world.entities.some((e) => e instanceof Corpse)).toBe(false);
    for (let i = 0; i < 900 && !world.bossClear; i++) step(world, input);
    expect(world.bossClear).not.toBeNull();
  });

  it('a shot that lands after the hero died: no scene (no one to run to the axe), the death goes on', () => {
    const { world, input, b } = castle('world1/1-4.map', '1-4', true, 9);
    world.kill(world.player);
    kill(b, world);
    expect(world.unmask).toBeNull();
    expect(b.alive).toBe(false);
    step(world, input, 120);
    expect(world.bossClear).toBeNull();
  });

  it('classic play: the NES true form drops as a corpse, no scene', () => {
    const { world, b } = castle('world3/3-4.map', '3-4', false, 9);
    kill(b, world);
    expect(b.alive).toBe(false);
    expect(world.unmask).toBeNull();
    expect(world.entities.find((e): e is Corpse => e instanceof Corpse)?.frame).toBe('bowser-die-3');
  });

  it("8-4's real king: no scene", () => {
    const { world, b } = castle('world8/8-4-end.map', '8-4-end', true, 9);
    kill(b, world);
    expect(b.alive).toBe(false);
    expect(world.unmask).toBeNull();
  });
});

describe('reaching the axe with the fake standing (campaign)', () => {
  it('the disguise bursts, the hero turns to look and says the remark, then pulls the axe', () => {
    const { world, input, b, level, sfx } = castle('world2/2-4.map', '2-4', true, 6);
    const calls: { level: string; hero: CharacterDef; done: () => void }[] = [];
    world.remarkHook = (lvl, hero, done) => {
      calls.push({ level: lvl, hero, done });
      return true;
    };
    toAxe(world, level);
    step(world, input);
    expect(world.unmask?.kind).toBe('axe');
    expect(b.standing).toBe(2);
    expect(b.dazed).toBe(false);
    expect(sfx).toContain('poof');
    expect(world.bossClear).toBeNull();
    const p = world.player;
    let looked = false;
    for (let i = 0; i < 60; i++) {
      step(world, input);
      if (p.facing < 0) looked = true;
    }
    expect(looked).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.level).toBe('2-4');
    expect(calls[0]?.hero.id).toBe('mario');
    // It waits for the card.
    step(world, input, 120);
    expect(world.bossClear).toBeNull();
    calls[0]?.done();
    step(world, input, 60);
    expect(world.bossClear).not.toBeNull();
    expect(p.facing).toBe(1);
    step(world, input, 80);
    expect(b.currentFrame).toBe('bowser-die-2');
    expect(sfx.filter((s) => s === 'poof')).toHaveLength(1);
  });

  it('a hero still blinking from a hit stops blinking: never invisible while the scene holds play', () => {
    const { world, input, level } = castle('world5/5-4.map', '5-4', true, 6);
    world.remarkHook = () => true; // the card stays up
    const p = world.player;
    toAxe(world, level);
    p.invuln = 21;
    step(world, input);
    expect(world.unmask?.kind).toBe('axe');
    for (let f = 0; f < 4; f++) expect(p.visible(world.frame + f)).toBe(true);
  });

  it('without a remark due (seen, or no hook) the hero just looks a moment', () => {
    const { world, input, level } = castle('world1/1-4.map', '1-4', true, 6);
    toAxe(world, level);
    step(world, input);
    expect(world.unmask?.kind).toBe('axe');
    step(world, input, 100);
    expect(world.bossClear).not.toBeNull();
  });

  it('classic play and the Lost Kingdom: the axe goes at once', () => {
    for (const [path, id, story] of [
      ['world1/1-4.map', '1-4', false],
      ['lost/world1/ll-1-4.map', 'll-1-4', true],
    ] as const) {
      const { world, input, level } = castle(path, id, story, 6);
      toAxe(world, level);
      step(world, input);
      expect(world.unmask, id).toBeNull();
      expect(world.bossClear, id).not.toBeNull();
    }
  });

  it('the remark card: <HERO> is the full name, and it fits', () => {
    expect(castleRemark('1-4', 'SOPHIA III')?.[0]).toBe('SOPHIA III:');
  });
});
