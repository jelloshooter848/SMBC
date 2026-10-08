import { afterEach, describe, expect, it } from 'vitest';
import type { Scene } from '@engine/scene';
import { toPx } from '@engine/math/units';
import { CHARACTERS } from '@game/characters/registry';
import { HeroItem } from '@game/entities/objects/hero-item';
import { PowerUp } from '@game/entities/objects/powerup';
import { heroStart } from '@game/items/heroes';
import { has } from '@game/items/flags';
import { HERO_ITEMS, heroItems } from '@game/items/catalog';
import { itemLesson, lesson, lessonsFor, TRAINING, type HeroTraining } from '@game/tutorial/lessons';
import { CARD_GUARD_FRAMES, PracticeRoomScene, type TrainingResult } from '@game/tutorial/room';
import { makeGame, useStorage } from './heroes-harness';

useStorage();

/*
 * The training rooms' power-up API (0.4.34): the room starts from the basic kit, a lesson's
 * `item` is placed in the room as the real pickup, and the lesson counts only after the grab.
 */

const swapped = new Map<string, HeroTraining>();
/** Give `hero` a training of its own for the test (put back after each test). */
function train(hero: string, t: HeroTraining): void {
  const all = TRAINING as Record<string, HeroTraining>;
  if (!swapped.has(hero)) swapped.set(hero, all[hero] as HeroTraining);
  all[hero] = t;
}
afterEach(() => {
  for (const [hero, t] of swapped) (TRAINING as Record<string, HeroTraining>)[hero] = t;
  swapped.clear();
});

function room(heroId: string) {
  const h = makeGame();
  const hero = CHARACTERS.find((c) => c.id === heroId);
  if (!hero) throw new Error(heroId);
  const below: Scene = { update() {}, render() {} };
  h.game.scenes.push(below);
  const results: TrainingResult[] = [];
  const scene = new PracticeRoomScene(h.game, hero, {
    onEnd: (r) => {
      results.push(r);
      h.game.scenes.pop();
    },
  });
  h.game.scenes.push(scene);
  h.step();
  // Past the chapter card.
  h.idle(CARD_GUARD_FRAMES + 1);
  h.tap('jump');
  return { h, scene, results };
}

const pickups = (s: PracticeRoomScene) =>
  s.world.entities.filter((e) => e.alive && (e instanceof HeroItem || e instanceof PowerUp));

/** Walk right until the placed item is gone (taken), at most `max` frames. */
function walkToItem(r: ReturnType<typeof room>, max = 200): void {
  for (let i = 0; i < max && pickups(r.scene).length > 0; i++) r.h.step(['right']);
}

describe('training starts from the basic kit', () => {
  it("a hero's room starts with the campaign's first kit, not the run's or the whole kit", () => {
    train('samus', {
      chapters: [{ id: 'a', title: 'A', room: 'practice', lessons: [lesson('x', 'X', () => false)] }],
    });
    const { scene } = room('samus');
    const start = heroStart(scene.hero);
    expect(scene.player.powerState).toBe(start.powerState);
    for (const [k, v] of Object.entries(start.kit)) expect(scene.player.scratch[k]).toBe(v);
    expect(has(scene.player, 'missiles')).toBe(false);
    expect(has(scene.player, 'long-beam')).toBe(false);
  });
});

describe("a lesson's item", () => {
  it('is placed in the room as the hero item, and the lesson waits for the grab', () => {
    train('samus', {
      chapters: [
        {
          id: 'a',
          title: 'A',
          room: 'practice',
          // `done` is already true: only the grab holds it back.
          lessons: [itemLesson('long', 'long-beam', 'GRAB THE LONG BEAM.', () => true)],
        },
      ],
    });
    const r = room('samus');
    expect(lessonsFor('samus')[0]?.item).toBe('long-beam');
    const [item] = pickups(r.scene);
    expect(item).toBeInstanceOf(HeroItem);
    expect((item as HeroItem).item).toBe('long-beam');
    expect((item as HeroItem).out).toBe(true);
    // At the room's item spot: on the floor two tiles ahead of the start.
    const spot = r.scene.itemSpot();
    expect(toPx(item!.body.y + item!.body.h)).toBe((spot.y + 1) * 16);
    r.h.idle(30);
    expect(r.scene.ticked).toEqual([]);
    expect(r.scene.tracker.taken.size).toBe(0);
    walkToItem(r);
    expect(pickups(r.scene)).toHaveLength(0);
    expect(has(r.scene.player, 'long-beam')).toBe(true);
    r.h.step();
    expect(r.scene.ticked).toEqual(['long']);
    expect(r.scene.phase).toBe('ready');
    // The item's name and what it does are read out.
    expect(r.h.said.some((t) => /^Long Beam: /.test(t))).toBe(true);
  });

  it('counting starts afresh at the grab: what was done before it does not count', () => {
    let attacks = -1;
    train('samus', {
      chapters: [
        {
          id: 'a',
          title: 'A',
          room: 'practice',
          lessons: [
            itemLesson('long', 'long-beam', 'GRAB IT, THEN SHOOT.', (t) => {
              attacks = t.attacks;
              return t.attacks > 0;
            }),
          ],
        },
      ],
    });
    const r = room('samus');
    for (let i = 0; i < 40; i++) r.h.step(i % 8 < 2 ? ['attack'] : []);
    expect(r.scene.ticked).toEqual([]);
    walkToItem(r);
    r.h.step();
    expect(attacks).toBe(0);
    expect(r.scene.ticked).toEqual([]);
    for (let i = 0; i < 20 && !r.scene.ticked.length; i++) r.h.step(i % 8 < 2 ? ['attack'] : []);
    expect(r.scene.ticked).toEqual(['long']);
  });

  it("Mario's and Luigi's items are SMB's mushroom and flower, standing still", () => {
    train('luigi', {
      chapters: [
        {
          id: 'a',
          title: 'A',
          room: 'practice',
          lessons: [
            itemLesson('grow', 'mushroom', 'GRAB THE MUSHROOM.', () => true),
            itemLesson('fire', 'fire-flower', 'GRAB THE FIRE FLOWER.', () => true),
          ],
        },
      ],
    });
    const r = room('luigi');
    expect(r.scene.player.powerState).toBe('small');
    const [m] = pickups(r.scene);
    expect(m).toBeInstanceOf(PowerUp);
    expect((m as PowerUp).item).toBe('mushroom');
    const x = m!.body.x;
    r.h.idle(30);
    expect(m!.body.x).toBe(x);
    walkToItem(r);
    r.h.idle(40);
    expect(r.scene.player.powerState).toBe('big');
    expect(r.scene.ticked).toEqual(['grow']);
    // Next, the flower stands where the mushroom stood.
    const [f] = pickups(r.scene);
    expect(f).toBeInstanceOf(PowerUp);
    expect((f as PowerUp).item).toBe('flower');
  });

  it('a hero who has the item already needs no grab', () => {
    train('megaman', {
      chapters: [
        {
          id: 'a',
          title: 'A',
          room: 'practice',
          lessons: [
            itemLesson('helmet', 'helmet', 'X', () => true),
            itemLesson('again', 'helmet', 'X', () => true),
          ],
        },
      ],
    });
    const r = room('megaman');
    walkToItem(r);
    r.h.step();
    // The second lesson's helmet is owned already: nothing placed, and it ticks at once.
    r.h.step();
    expect(r.scene.ticked).toEqual(['helmet', 'again']);
  });
});

describe('the item ids', () => {
  it("every lesson's item is one of its hero's power-ups", () => {
    for (const [hero, t] of Object.entries(TRAINING))
      for (const ch of t.chapters)
        for (const l of ch.lessons) {
          if (!l.item) continue;
          const ids = heroItems(hero)?.items.map((i) => i.id) ?? [];
          expect(ids, `${hero}:${l.id}`).toContain(l.item);
        }
    expect(Object.keys(HERO_ITEMS)).toEqual(expect.arrayContaining(Object.keys(TRAINING)));
  });
});
