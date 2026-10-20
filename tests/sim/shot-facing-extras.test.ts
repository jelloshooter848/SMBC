import { describe, expect, it } from 'vitest';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import { SPRITES } from '@content/sprites';
import type { View } from '@game/entities/entity';
import { Projectile } from '@game/entities/projectiles/projectile';
import { BASS_BUSTER } from '@game/characters/bass/classic-weapons';
import { DARKPIT_CLASSIC, PIT_CLASSIC } from '@game/characters/pit/classic';
import { Rig, flatLevel } from './classic-plumber-harness';
import { useStorage } from './heroes-harness';

/*
 * Shots fly head first (0.4.57) for the Classic-only heroes. Projectile.render mirrors a shot
 * flying right, so a pointed frame is stored pointing LEFT. Bass's buster is a diamond (mirror
 * symmetric). Pit's and Dark Pit's arrows (head role 3, fletching role 2) must lead with the head,
 * fired right and fired left, beam and missile (heavy arrow) alike.
 */

useStorage();

const mirror = (rows: readonly string[]): string[] => rows.map((r) => [...r].reverse().join(''));

/** The rows a shot draws this frame, mirrored as the renderer mirrors them. */
function drawn(shot: Projectile): { frame: string; rows: string[] } {
  const calls: { f: string; flip: boolean }[] = [];
  const rr: Renderer = Object.assign(new NullRenderer(), {
    sprite(_s: SpriteSheet, f: string, _x: number, _y: number, flip?: boolean) {
      calls.push({ f, flip: !!flip });
    },
  });
  shot.render(rr, { camX: 0, frame: 0, assets: { sheet: () => ({ frames: new Map() }) } } as unknown as View);
  const c = calls.at(-1);
  if (!c) throw new Error(`${shot.kind} drew nothing`);
  const rows = SPRITES[shot.spec.sheet]?.frames[c.f] as string[] | undefined;
  if (!rows) throw new Error(`${shot.spec.sheet}:${c.f} is not a frame`);
  return { frame: c.f, rows: c.flip ? mirror(rows) : rows };
}

/** Mean x of the pixels in `chars`, as a fraction across the frame. */
function at(rows: readonly string[], chars: string): number {
  const hits: number[] = [];
  rows.forEach((row) => [...row].forEach((ch, x) => chars.includes(ch) && hits.push(x)));
  if (hits.length === 0) throw new Error(`no ${chars} pixels`);
  return hits.reduce((a, b) => a + b, 0) / hits.length / ((rows[0]?.length ?? 1) - 1);
}

function newest(r: Rig): Projectile {
  const shot = r.world.entities
    .filter((e): e is Projectile => e instanceof Projectile && e.owner === r.p)
    .at(-1);
  if (!shot) throw new Error('no shot');
  return shot;
}

describe('Classic-only heroes: shots fly head first', () => {
  it("Bass's buster is left/right symmetric, so it leads the same fired right or left", () => {
    for (const f of BASS_BUSTER.frames) {
      const rows = SPRITES[BASS_BUSTER.sheet]?.frames[f] as string[] | undefined;
      expect(rows, f).toBeDefined();
      expect(mirror(rows as string[]), f).toEqual(rows);
    }
  });

  it.each([
    ['Pit', PIT_CLASSIC],
    ['Dark Pit', DARKPIT_CLASSIC],
  ] as const)('%s: arrow and heavy arrow lead with the head, fired right and fired left', (_n, def) => {
    const r = new Rig(def, flatLevel(), 'classic', 'big');
    Object.assign(r.p.scratch, { missileUp: 1, missiles: 9 });
    r.settle();
    const check = (button: 'attack' | 'special', dir: 1 | -1, frame: RegExp) => {
      const shot = newest(r);
      expect(Math.sign(shot.body.vx), shot.kind).toBe(dir);
      const d = drawn(shot);
      expect(d.frame).toMatch(frame);
      const lead = at(d.rows, '3') - at(d.rows, '2');
      if (dir > 0) expect(lead, `${button} ${d.frame} fired right`).toBeGreaterThan(0);
      else expect(lead, `${button} ${d.frame} fired left`).toBeLessThan(0);
    };
    r.step(['attack']);
    check('attack', 1, /^arrow-\d$/);
    for (let i = 0; i < 40; i++) r.step([]);
    r.step(['special']);
    check('special', 1, /^heavy-arrow$/);
    for (let i = 0; i < 30; i++) r.step(['left']);
    for (let i = 0; i < 40; i++) r.step([]);
    r.step(['attack']);
    check('attack', -1, /^arrow-\d$/);
    for (let i = 0; i < 40; i++) r.step([]);
    r.step(['special']);
    check('special', -1, /^heavy-arrow$/);
  });
});
