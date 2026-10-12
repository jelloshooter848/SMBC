import { describe, expect, it } from 'vitest';
import type { Action } from '@engine/input/actions';
import { px, tileAt, toPx } from '@engine/math/units';
import { getLevel } from '@content/levels';
import { parseTextMap } from '@game/level/textmap';
import { campaignLevel } from '@game/level/campaign';
import { heroVariant } from '@game/level/variants';
import { runSim } from '@game/sim/headless';
import { MEGAMAN } from '@game/characters/megaman';
import { MARIO } from '@game/characters/mario';
import { BILL } from '@game/characters/bill';
import { LINK } from '@game/characters/link';
import { SAMUS } from '@game/characters/samus';
import type { CharacterDef } from '@game/characters/character';
import type { LevelData } from '@game/level/schema';
import type { World } from '@game/world/world';

// Low ceilings (0.4.43, owner: Mega Man stood up inside 4-2's cavern ceiling at a slide's end).
// A slide goes on under a low ceiling until there is room to stand, as in his own games, and
// waits against a wall there (turning with the d-pad); a crouch (Mario's crouch-slide, Link's
// crouch, Bill prone) stays down and crawls on; Samus's ball stands only with room. Nobody ever
// stands up inside tiles.

/** A field with a tunnel `h` tiles high (its floor the ground) from column `from` to `to`. */
function tunnel(from: number, to: number, h: number, wallAt?: number): LevelData {
  const rows = Array.from({ length: 13 }, () => '.'.repeat(48).split(''));
  for (let x = from; x <= to; x++) for (let y = 0; y <= 12 - h; y++) (rows[y] as string[])[x] = '#';
  if (wallAt !== undefined) for (let y = 0; y <= 12; y++) (rows[y] as string[])[wallAt] = '#';
  return parseTextMap(
    [
      'id: t',
      'time: 300',
      'start: 2,12',
      '',
      '[tiles]',
      ...rows.map((r) => r.join('')),
      '#'.repeat(48),
      '#'.repeat(48),
    ].join('\n'),
  );
}

/** Whether the player's body overlaps a solid tile. */
function inside(w: World): boolean {
  const b = w.player.body;
  for (let ty = tileAt(b.y); ty <= tileAt(b.y + b.h - 1); ty++)
    for (let tx = tileAt(b.x); tx <= tileAt(b.x + b.w - 1); tx++) if (w.map.isSolid(tx, ty)) return true;
  return false;
}

function run(
  level: LevelData,
  hero: CharacterDef,
  controller: (w: World, f: number) => Action[],
  frames: number,
  state: Record<string, unknown> = {},
) {
  const bad: string[] = [];
  const r = runSim({
    level,
    character: hero,
    script: { steps: [] },
    maxFrames: frames,
    state,
    controller: (w, f) => {
      if (inside(w))
        bad.push(`${f}:${toPx(w.player.body.x)},${toPx(w.player.body.y)} h${toPx(w.player.body.h)}`);
      return controller(w, f);
    },
  });
  return { r, bad, p: r.world.player };
}

describe('low ceilings: nobody stands up inside tiles', () => {
  it('Mega Man: a slide into a one-tile tunnel goes on until there is room, and he stands past it', () => {
    // A slide covers about 4 tiles; the tunnel is 8 long.
    const { bad, p } = run(
      tunnel(6, 13, 1),
      MEGAMAN,
      (_w, f) => (f >= 10 && f < 14 ? ['down', 'jump'] : []),
      200,
    );
    expect(bad).toEqual([]);
    expect(p.sliding).toBe(0);
    expect(toPx(p.body.x)).toBeGreaterThan(14 * 16);
    expect(toPx(p.body.h)).toBe(22);
  });

  it('Mega Man: against a wall in the tunnel he waits sliding, then slides back out with the d-pad', () => {
    let back = false;
    const { bad, p, r } = run(
      tunnel(6, 13, 1, 10),
      MEGAMAN,
      (w, f) => {
        if (f >= 10 && f < 14) return ['down', 'jump'];
        if (f === 120) back = w.player.sliding > 0 && toPx(w.player.body.x) > 7 * 16;
        return f > 120 ? ['left'] : [];
      },
      260,
    );
    expect(back).toBe(true);
    expect(bad).toEqual([]);
    expect(p.sliding).toBe(0);
    expect(toPx(p.body.x + p.body.w)).toBeLessThanOrEqual(6 * 16);
    expect(r.world.player.body.h).toBe(px(22));
  });

  it.each([
    ['4-2', 14, 34],
    ['4-2-cavern', 2, 58],
  ])('Mega Man in %s (campaign): a slide from every floor spot never ends inside the rock', (id, x0, x1) => {
    const level = heroVariant(campaignLevel(getLevel(id)), ['megaman'], true);
    const floorRow = (w: World, x: number): number => {
      let y = 0;
      while (y < 15 && !w.map.isSolid(x, y)) y++;
      return y;
    };
    // 4-2's low passage (one tile high, columns 22-26); the cavern up to its side pipe out.
    for (let x = x0; x < x1; x++)
      for (const dir of ['right', 'left'] as const) {
        const { bad } = run(
          level,
          MEGAMAN,
          (w, f) => {
            if (f === 0) {
              // Stand him on the floor of column x, then slide.
              let y = 12;
              while (y > 0 && (w.map.isSolid(x, y) || w.map.isSolid(x, y - 1))) y--;
              void floorRow;
              w.player.body.x = px(x * 16 + 2);
              w.player.body.y = px((y + 1) * 16) - w.player.body.h;
              w.player.body.vy = 0;
            }
            if (f === 5) return [dir];
            if (f >= 6 && f < 9) return [dir, 'down', 'jump'];
            return [];
          },
          90,
          { kit: { 'has-helmet': 1 } },
        );
        expect(bad.slice(0, 1), `column ${x} ${dir}`).toEqual([]);
      }
  });

  it("big Mario's crouch-slide under a one-tile gap: he stays down and crawls out, never inside", () => {
    let crouched = 0;
    const { bad, p } = run(
      tunnel(12, 16, 1),
      MARIO,
      (w) => {
        // A run, then down short of the gap: the crouch slides him in; then right.
        if (crouched === 0 && toPx(w.player.body.x) < 150) return ['right', 'attack'];
        if (crouched++ < 30) return ['down'];
        return ['right'];
      },
      260,
      { powerState: 'big' },
    );
    expect(bad).toEqual([]);
    expect(p.crouching).toBe(false);
    expect(toPx(p.body.x)).toBeGreaterThan(17 * 16);
  });

  it('Link crouched and Bill prone, put under a low ledge: they stay down and crawl out', () => {
    for (const hero of [LINK, BILL]) {
      const { bad, p } = run(
        tunnel(4, 8, 1),
        hero,
        (w, f) => {
          if (f === 0) {
            w.player.body.x = px(6 * 16);
            w.player.crouching = true;
            w.player.refitHitbox();
            w.player.body.y = px(13 * 16) - w.player.body.h;
          }
          return f < 3 ? ['down'] : ['right'];
        },
        200,
      );
      expect(bad, hero.id).toEqual([]);
      expect(p.crouching, hero.id).toBe(false);
      expect(toPx(p.body.x), hero.id).toBeGreaterThan(9 * 16);
    }
  });

  it("Samus's ball under a low ceiling: up does nothing until there is room", () => {
    const { bad, p } = run(
      tunnel(4, 8, 1),
      SAMUS,
      (w, f) => {
        if (f === 0) {
          w.player.scratch.ball = 1;
          w.player.refitHitbox();
          w.player.body.x = px(6 * 16);
          w.player.body.y = px(13 * 16) - w.player.body.h;
        }
        return f < 60 ? ['up'] : f < 120 ? ['right'] : ['up'];
      },
      200,
    );
    expect(bad).toEqual([]);
    expect(p.scratch.ball).toBe(0);
  });
});
