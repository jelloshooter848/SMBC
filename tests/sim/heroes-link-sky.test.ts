import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { px, toPx } from '@engine/math/units';
import { LevelScene } from '@game/scenes/level';
import { WorldMapScene } from '@game/scenes/world-map';
import { MARIO } from '@game/characters/mario';
import type { Captive } from '@game/entities/objects/captive';
import { captives, draw, file, makeGame, useStorage, type H } from './heroes-harness';
import { LINK, toLink } from './sky-palace-way';

// Captive Link waits on the altar in the hall of his sky palace (2-1-sky2), above the 2-1 coin
// heaven. Campaign play only, and only until Link is freed on the file (docs/HEROES.md). His mini
// game is not this test's business: it only needs him there, reachable, with TALK showing.

useStorage();

/** File 1 open, then into the sky palace by the vine, as from the hidden block in 2-1-sky. */
function intoRuins(h: H, time = 300): LevelScene {
  h.game.openFile(1);
  expect(h.top()).toBeInstanceOf(WorldMapScene);
  h.game.startLevel(getLevel('2-1-sky2'), { mode: 'climb', x: 4, y: 14, time });
  h.step();
  expect(h.top()).toBeInstanceOf(LevelScene);
  return h.top() as LevelScene;
}

/** After the vine arrival, put player 1 on the hall floor at column 44, by the altar, and let the screen catch up. */
function byAltar(h: H, l: LevelScene): void {
  const p = l.world.player;
  h.until(() => !p.vine && !p.frozen, 600);
  p.body.x = px(44 * 16);
  p.body.y = px(12 * 16) - p.body.h;
  h.idle(60);
  expect(toPx(l.world.camera.x)).toBeGreaterThan(32 * 16);
}

describe('captive Link in the 2-1 sky palace', () => {
  it('stands on the altar in the hall; climbing in and walking up to him shows TALK', () => {
    const h = makeGame();
    file();
    const l = intoRuins(h);
    // The vine arrival plays, then the player walks right, over the sky stair and into the hall,
    // and up the altar until Link is in reach (he spawns as the screen comes to him, like any entity).
    const p = l.world.player;
    h.until(() => !p.vine && !p.frozen, 600);
    const way = { hold: 0 };
    const link = () => captives(l)[0];
    for (let i = 0; i < 1500 && !link()?.prompt; i++) h.step(toLink(p.body, l.world.map, way));
    const cs = captives(l);
    expect(cs).toHaveLength(1);
    const c = cs[0] as Captive;
    expect(c.hero.id).toBe('link');
    expect(toPx(c.body.y + c.body.h)).toBe(LINK.feet); // feet on the altar's top
    expect(toPx(c.body.x + (c.body.w >> 1)) >> 4).toBe(LINK.x);
    h.step();
    expect(c.prompt).toBe(true);
    expect(draw(l).texts.some((t) => t.str === 'TALK')).toBe(true);
    expect(h.said.some((t) => /^Link\. Up to talk\.$/.test(t))).toBe(true);
    expect(l.world.time).toBeLessThanOrEqual(300); // the running clock came along
  });

  it('is not there once Link is freed on the file, nor outside campaign play', () => {
    const h0 = makeGame();
    file();
    const l0 = intoRuins(h0);
    byAltar(h0, l0);
    expect(captives(l0)).toHaveLength(1); // the control: still captive on this file
    const h = makeGame();
    file({ freed: ['mario', 'link'] });
    const l = intoRuins(h);
    byAltar(h, l);
    expect(captives(l)).toHaveLength(0);
    const h2 = makeGame();
    h2.game.devStart('2-1-sky2', MARIO, 'small');
    h2.until(() => h2.top() instanceof LevelScene);
    const l2 = h2.top() as LevelScene;
    byAltar(h2, l2);
    expect(captives(l2)).toHaveLength(0);
  });
});
