import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { ScriptedInput } from '@game/sim/headless';
import { World } from '@game/world/world';
import { overlapsSolid } from '@game/world/unmask';
import { DEFAULT_ASSIST, newGameState } from '@game/context';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { px, tileAt, toPx } from '@engine/math/units';
import { Bowser } from '@game/entities/enemies/bowser';
import { CHARACTERS } from '@game/characters/registry';
import { campaignLevel } from '@game/level/campaign';
import { heroVariant } from '@game/level/variants';
import { T } from '@game/level/tiles';
import { fontText } from '@game/hud/text';
import { REMARK_CASTLES } from '@game/story/script';
import type { DamageKind } from '@game/rules/damage';
import type { LevelData } from '@game/level/schema';
import type { Action } from '@engine/input/actions';

// The fake Bowsers' deaths (0.4.43, owner: after the 2-4 fake, Link walked into the brick column,
// and the hero's line played only when the axe was taken with the fake standing). Every way the
// fake can die (the hero's weapon, fire, the axe, a fall into the lava), for every hero, in every
// castle with a fake: the hero says the castle's line once, never stands inside a tile on the way
// to the axe or the walk to Toad, and the walk ends at Toad.

/** Each hero's weapon, as it hits Bowser. */
const WEAPON: Readonly<Record<string, DamageKind>> = {
  mario: 'fireball',
  luigi: 'fireball',
  link: 'sword',
  megaman: 'buster',
  samus: 'buster',
  simon: 'weapon',
  ryu: 'sword',
  bill: 'buster',
  sophia: 'bomb',
};

type Way = 'weapon' | 'fire' | 'axe' | 'fall';
const WAYS: readonly Way[] = ['weapon', 'fire', 'axe', 'fall'];

/** The castle's bridge room, where a castle's main level is not it (8-4's is 8-4-end). */
const BRIDGE: Readonly<Record<string, string>> = { '8-4': '8-4-end' };

function castle(id: string, heroId: string) {
  const hero = CHARACTERS.find((c) => c.id === heroId);
  if (!hero) throw new Error(heroId);
  const level: LevelData = heroVariant(campaignLevel(getLevel(BRIDGE[id] ?? id)), [heroId], true);
  const axe = level.entities.find((e) => e.type === 'axe') as { x: number; y: number };
  const state = newGameState(hero);
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
    { x: axe.x - 9, y: 8, mode: 'stand' },
  );
  world.storyMode = true;
  const input = new ScriptedInput({ steps: [{ frame: 0, hold: [] as Action[] }] });
  const step = () => {
    input.next();
    world.update([input]);
    world.events.splice(0);
  };
  for (let i = 0; i < 10 && !world.entities.some((e) => e instanceof Bowser); i++) step();
  const b = world.entities.find((e): e is Bowser => e instanceof Bowser && !e.fake);
  if (!b) throw new Error(`${id}: no Bowser`);
  return { world, step, b, axe, hero };
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

function play(id: string, heroId: string, way: Way) {
  const { world, step, b, axe, hero } = castle(id, heroId);
  const p = world.player;
  const lines: { level: string; hero: string }[] = [];
  let close: (() => void) | null = null;
  let closeAt = 0;
  world.remarkHook = (level, h, done) => {
    lines.push({ level, hero: h.id });
    close = done;
    closeAt = world.frame + 20;
    return true;
  };
  if (way === 'weapon' || way === 'fire') {
    const kind = way === 'fire' ? 'fireball' : (WEAPON[heroId] as DamageKind);
    for (let i = 0; i < 20 && !b.standing && b.alive; i++)
      b.hit({ kind, amount: 1, owner: p, dirX: 1 }, world);
    expect(world.unmask?.kind, `${id} ${heroId} ${way}`).toBe('killed');
  } else {
    if (way === 'fall') {
      // The bridge gone under him: he drops into the lava.
      const c0 = tileAt(b.body.x) - 1;
      const c1 = tileAt(b.body.x + b.body.w) + 1;
      for (let tx = c0; tx <= c1; tx++)
        for (let ty = 0; ty < world.level.height; ty++)
          if (world.map.get(tx, ty) === T.BRIDGE) world.map.set(tx, ty, T.AIR);
      for (let i = 0; i < 200 && b.alive; i++) step();
      expect(b.alive, `${id}: fell`).toBe(false);
    }
    toAxe(world, axe);
  }
  const inside: string[] = [];
  for (let i = 0; i < 2400 && !world.castleText.length; i++) {
    step();
    if (close && world.frame >= closeAt) {
      const c: () => void = close;
      close = null;
      c();
    }
    const pb = p.body;
    if ((world.unmask || world.bossClear) && overlapsSolid(world, pb.x, pb.y, pb.w, pb.h))
      inside.push(
        `${world.frame}:${toPx(pb.x)},${toPx(pb.y)} ${toPx(pb.w)}x${toPx(pb.h)} t${world.map.get(tileAt(pb.x + pb.w - 1), tileAt(pb.y + pb.h - 1))} ${tileAt(pb.x + pb.w - 1)},${tileAt(pb.y + pb.h - 1)}`,
      );
  }
  return { world, lines, inside, hero, p };
}

describe('a fake Bowser dies: every way, every hero, every castle with a fake', () => {
  // 0.4.54: 8-4's fake (the Plutonium Boss costume over a Piranha Plant) too.
  expect(REMARK_CASTLES).toEqual(['1-4', '2-4', '3-4', '4-4', '5-4', '6-4', '7-4', '8-4']);
  for (const id of REMARK_CASTLES)
    for (const way of WAYS)
      it(`${id}, ${way}: every hero says the line, stands on the floor, and walks to Toad`, () => {
        for (const c of CHARACTERS) {
          const { world, lines, inside, hero } = play(id, c.id, way);
          const tag = `${id} ${c.id} ${way}`;
          expect(lines, tag).toEqual([{ level: id, hero: c.id }]);
          expect(inside.slice(0, 3), tag).toEqual([]);
          expect(world.castleText[0], tag).toBe(`THANK YOU ${fontText(hero.name)}!`);
          // The walk ended at the exit marker (Toad), not on the time limit.
          expect(world.bossClear?.stop ?? 9999, tag).toBeLessThan(700);
        }
      });
});
