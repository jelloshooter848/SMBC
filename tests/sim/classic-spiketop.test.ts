import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { SPRITES } from '@content/sprites';
import { spikeTopDef } from '@content/sprites/spike-top';
import { validateDef } from '@engine/gfx/pixelart';
import { px, toPx } from '@engine/math/units';
import { MARIO } from '@game/characters/mario';
import { SpikeTop } from '@game/entities/enemies/spike-top';
import { ENEMY_SCORES } from '@game/rules/score';
import { CLASSIC_HP, classicMaxHp, isArmoured } from '@game/rules/classic-enemies';
import {
  EXTRA_GOOMBA_REPLACEMENTS,
  registerGoombaReplacements,
  replaceGoombas,
  type GoombaReplacement,
} from '@game/rules/classic-goombas';
import { allHammerBros } from '@game/rules/classic-cheats';
import { applyOptionSpawns, GOOMBA_SPAWNS } from '@game/rules/classic-options-level';
import { CLASSIC_ROW_VALUES, defaultClassicSettings } from '@engine/save/original-options';
import { defaultSettings } from '@engine/save/settings';
import { TileMap } from '@game/world/tilemap';
import { LevelScene } from '@game/scenes/level';
import { makeGame } from './heroes-harness';
import type { EntitySpawn } from '@game/level/schema';
import type { World } from '@game/world/world';
import { classicWorld, step, testLevel } from './classic-harness';

// Spike Top (FU-7a; com/smbc/enemies/SpikeTop.as) as a new enemy with its own original art, and
// as the Replace Goombas choice this slice adds (rules/classic-goombas.ts). Its look and timing
// follow the original's numbers: two 16 px walking cells (GraphicsManager ar(126,7,49,24)),
// animated, sized and moved as its Goomba base.

function withSpikeTop(world: World, col: number): SpikeTop {
  const e = new SpikeTop(px(col * 16 + 2), px(12 * 16 + 2));
  world.spawn(e);
  return e;
}

describe('the sprite', () => {
  it('is original pixel art in the text format: two 16x16 frames, the enemy palettes', () => {
    expect(() => validateDef('spike-top', spikeTopDef)).not.toThrow();
    expect(SPRITES['spike-top']).toBe(spikeTopDef);
    expect(Object.keys(spikeTopDef.frames)).toEqual(['spike-top-0', 'spike-top-1']);
    for (const rows of Object.values(spikeTopDef.frames)) {
      expect(rows).toHaveLength(16);
      for (const r of rows) expect(r).toHaveLength(16);
    }
    expect(spikeTopDef.palette).toBe('enemies-overworld');
  });
});

describe('the enemy', () => {
  it("is a Goomba's size and walk, with the Goomba's two-frame step", () => {
    const w = classicWorld(MARIO);
    const e = withSpikeTop(w, 20);
    expect([toPx(e.body.w), toPx(e.body.h)]).toEqual([12, 14]);
    expect(e.body.vx).toBe(-e.walkSpeed);
    const frames = new Set<string>();
    for (let i = 0; i < 32; i++) {
      step(w);
      frames.add(e.currentFrame);
    }
    expect([...frames].sort()).toEqual(['spike-top-0', 'spike-top-1']);
    expect(e.sheet).toBe('spike-top');
  });

  it('cannot be stomped: landing on it hurts (Classic and Campaign)', () => {
    for (const rules of ['classic', 'campaign'] as const) {
      const w = classicWorld(MARIO, testLevel(), rules);
      const e = withSpikeTop(w, 2);
      e.walkSpeed = 0;
      e.body.vx = 0;
      e.body.x = w.player.body.x;
      w.player.body.y -= px(48);
      const before = w.feats.stomps;
      step(w, 60);
      expect(w.feats.stomps, rules).toBe(before);
      expect(e.alive, rules).toBe(true);
      expect(w.player.invuln > 0 || w.player.dead || w.events.some((v) => v.type === 'died'), rules).toBe(
        true,
      );
    }
  });

  it('Classic: armoured, with its Goomba base hit points and scores (overwriteInitialStats)', () => {
    const w = classicWorld(MARIO);
    const e = withSpikeTop(w, 20);
    expect(isArmoured(e)).toBe(true);
    expect(classicMaxHp(e, w)).toBe(CLASSIC_HP['spike-top']);
    expect(CLASSIC_HP['spike-top']).toBe(CLASSIC_HP.goomba);
    expect(e.scores).toBe(ENEMY_SCORES.GOOMBA);
    // A weak hit is stopped by its armour; one that pierces armour (5) takes it.
    expect(e.hit({ kind: 'fireball', amount: 1000, owner: w.player, dirX: 1 }, w)).toBe('blocked');
    expect(e.hit({ kind: 'fireball', amount: 1000, owner: w.player, dirX: 1, pierce: 5 }, w)).toBe('kill');
  });

  it('a block bumped under it pops it up and turns it; landing from a fall it faces the player', () => {
    const w = classicWorld(MARIO);
    const e = withSpikeTop(w, 10);
    step(w, 2);
    expect(e.body.vx).toBeLessThan(0);
    // Bumped from a block to its right: it turns, pops up and lands without turning back.
    e.hit({ kind: 'bump', amount: 1, owner: w.player, dirX: 1, fromX: e.body.x + px(20) }, w);
    expect(e.body.vx).toBeGreaterThan(0);
    expect(e.body.vy).toBeLessThan(0);
    for (let i = 0; i < 60 && !e.body.onGround; i++) step(w);
    step(w, 2);
    expect(e.body.vx).toBeGreaterThan(0);
    // Dropped from above on the player's right, it lands facing the player (left).
    const f = new SpikeTop(px(30 * 16), px(4 * 16));
    f.body.vx = f.walkSpeed;
    w.spawn(f);
    for (let i = 0; i < 90 && !(f.body.onGround && i > 2); i++) step(w);
    step(w, 2);
    expect(f.body.vx).toBeLessThan(0);
  });
});

describe('Replace Goombas: Spike Top', () => {
  it('is offered to the More Settings row through registerGoombaReplacements', () => {
    const got: GoombaReplacement[] = [];
    registerGoombaReplacements((r) => got.push(r));
    expect(got).toEqual([{ id: 'spike-top', label: 'Spike Top', spawn: 'spike-top' }]);
    expect(EXTRA_GOOMBA_REPLACEMENTS).toEqual(got);
  });

  it('turns every Goomba of the level data into a Spike Top on its cell, which then spawns', () => {
    const spawns: EntitySpawn[] = getLevel('1-1').entities.map((e) => ({ ...e }));
    const goombas = spawns.filter((s) => s.type === 'goomba').length;
    expect(goombas).toBeGreaterThan(0);
    expect(replaceGoombas(spawns, 'spike-top')).toBe(goombas);
    expect(spawns.some((s) => s.type === 'goomba')).toBe(false);
    expect(spawns.filter((s) => s.type === 'spike-top').length).toBe(goombas);
    // The World builds the spawn type.
    const level = { ...testLevel(), entities: [{ type: 'spike-top', x: 8, y: 12 }] };
    const w = classicWorld(MARIO, level);
    step(w, 2);
    expect(w.entities.some((e) => e instanceof SpikeTop)).toBe(true);
  });

  it("is the More Settings row's fourth Goombas value, and a Classic run's 1-1 spawns Spike Tops", () => {
    expect(CLASSIC_ROW_VALUES.goombas).toEqual(['off', 'buzzy', 'spiny', 'spike-top']);
    expect(GOOMBA_SPAWNS['spike-top']).toBe('spike-top');
    const level = getLevel('1-1');
    const spawns: EntitySpawn[] = level.entities.map((e) => ({ ...e }));
    const n = spawns.filter((s) => s.type === 'goomba').length;
    expect(
      applyOptionSpawns(new TileMap(level), spawns, { ...defaultClassicSettings(), goombas: 'spike-top' }),
    ).toBe(true);
    expect(spawns.filter((s) => s.type === 'spike-top')).toHaveLength(n);
    // Through the Game: CLASSIC with Goombas: Spike Top, 1-1's first Goomba is a Spike Top.
    const settings = {
      ...defaultSettings(),
      classic: { ...defaultClassicSettings(), goombas: 'spike-top' as const },
    };
    const h = makeGame({ deps: { settings, applySettings: () => {} } });
    h.game.classicGame(MARIO);
    h.until(() => h.top() instanceof LevelScene, 600);
    const w = (h.top() as LevelScene).world;
    w.player.body.x = px(40 * 16);
    h.idle(30);
    expect(w.entities.some((e) => e instanceof SpikeTop)).toBe(true);
    expect(w.entities.some((e) => e.kind === 'goomba')).toBe(false);
  });

  it('All Hammer Bros turns a Spike Top into a Hammer Bro too', () => {
    const spawns: EntitySpawn[] = [{ type: 'spike-top', x: 8, y: 12 }];
    expect(allHammerBros(spawns)).toBe(1);
    expect(spawns[0]?.type).toBe('hammer-bro');
  });
});
