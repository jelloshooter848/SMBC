import { describe, expect, it } from 'vitest';
import { parseTextMap } from '@game/level/textmap';
import { T } from '@game/level/tiles';
import { runSim, type SimOptions } from '@game/sim/headless';
import type { Action } from '@engine/input/actions';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import type { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO, type AudioSink } from '@engine/audio/audio-manager';
import { Rng } from '@engine/rng';
import { px, toPx } from '@engine/math/units';
import { STAR_FRAMES } from '@game/constants';
import { MARIO } from '@game/characters/mario';
import { LUIGI } from '@game/characters/luigi';
import { LINK } from '@game/characters/link';
import { SAMUS } from '@game/characters/samus';
import { SIMON } from '@game/characters/simon';
import { MEGAMAN } from '@game/characters/megaman';
import { BILL } from '@game/characters/bill';
import { RYU } from '@game/characters/ryu';
import type { CharacterDef } from '@game/characters/character';
import { classicStandIn } from '@game/characters/classic/test-def';
import {
  CLASSIC_DROPS,
  CLASSIC_HIT_RESPONSES,
  CLASSIC_STAR_FRAMES,
  classicDrop,
  classicLook,
  classicPickup,
  classicRespawn,
  classicStarPaletteStep,
  classicStartKit,
  hasAmmo,
  spendAmmo,
} from '@game/characters/classic/power';
import { drawHud, POWER_ICON_P1, POWER_ICON_P2 } from '@game/hud/hud';
import { itemsDef } from '@content/sprites/items';
import { PowerUp } from '@game/entities/objects/powerup';
import { Pickup } from '@game/entities/objects/pickup';
import { Goomba } from '@game/entities/enemies/goomba';
import type { Player } from '@game/entities/player';
import { World } from '@game/world/world';
import { AssetRegistry as Assets } from '@engine/assets/registry';
import { DEFAULT_ASSIST, newGameState } from '@game/context';
import { isolateClassicRegistry } from './classic-registry';

// Independent of which hero slices have landed: no registered Classic hero def replaces this
// file's stand-ins (tests/sim/classic-registry.ts).
isolateClassicRegistry({ hide: true });

// Classic SMBC power states (2026-10-07-classic-power-states.md, PS-C1..PS-C27; TG-21, TG-28,
// TG-29), driven with stand-in Classic defs (characters/classic/test-def.ts) until the hero
// slices land. Per-hero kits (what each state adds and keeps) are the hero slices' tests.

const none = { steps: [{ frame: 0, hold: [] as Action[] }] };

/** A flat stretch, 48 columns, `rows` laid over it. */
function flat(rows: Record<number, string> = {}) {
  const lines = Array.from({ length: 13 }, (_, y) => (rows[y] ?? '').padEnd(48, '.'));
  return parseTextMap(
    ['id: t', 'time: 300', 'start: 6,12', '', '[tiles]', ...lines, '#'.repeat(48), '#'.repeat(48)].join('\n'),
  );
}

type Probe = (w: World, f: number) => boolean | void;
/** Runs Classic `def` on `level`, calling `probe` after every frame until it returns true. */
function play(def: CharacterDef, probe: Probe, extra: Partial<SimOptions> = {}) {
  return runSim({
    level: flat(),
    character: def,
    rules: 'classic',
    script: none,
    maxFrames: 1500,
    until: (w, f) => probe(w, f) === true,
    ...extra,
  });
}

const HEROES = [MARIO, LUIGI, LINK, SAMUS, SIMON, MEGAMAN, BILL, RYU];

describe('Lose Everything (PS-C7, PS-C8)', () => {
  for (const base of HEROES) {
    it(`${base.id}: a hit in the Fire Flower state ends small; the next one after the window kills`, () => {
      let hitAt = -1;
      let second = -1;
      const r = play(
        classicStandIn(base),
        (w, f) => {
          const p = w.player;
          if (f === 10) {
            w.hurtPlayer(p, 1);
            hitAt = f;
            expect(p.powerState).toBe('small');
            expect(p.dead).toBe(false);
          } else if (hitAt > 0 && second < 0 && !p.invulnerable) {
            second = f;
            w.hurtPlayer(p, 1);
          }
          return p.dead;
        },
        { state: { powerState: 'fire' } },
      );
      expect(second).toBeGreaterThan(hitAt);
      expect(r.world.player.dead).toBe(true);
    });
  }

  it('a hit while big also ends small, never big', () => {
    const r = play(classicStandIn(LINK), (w, f) => (f === 5 ? (w.hurtPlayer(w.player, 1), true) : false), {
      state: { powerState: 'big' },
    });
    expect(r.world.player.powerState).toBe('small');
  });

  it('a small hero dies from one hit', () => {
    const r = play(classicStandIn(SIMON), (w, f) => {
      if (f === 5) w.hurtPlayer(w.player, 1);
      return w.player.dead;
    });
    expect(r.world.player.dead).toBe(true);
  });

  it('the "Fire keeps big" assist is ignored (TG-29, PS-C9); Current Mario still keeps big', () => {
    const hit = (def: CharacterDef, rules: 'classic' | 'current') =>
      runSim({
        level: flat(),
        character: def,
        rules,
        script: none,
        maxFrames: 6,
        state: { powerState: 'fire' },
        assist: { fireRevertsToBig: true },
        until: (w, f) => (f === 5 ? (w.hurtPlayer(w.player, 1), true) : false),
      }).world.player.powerState;
    expect(hit(classicStandIn(MARIO), 'classic')).toBe('small');
    expect(hit(MARIO, 'current')).toBe('big');
  });

  it('the No damage assist still applies', () => {
    const r = play(classicStandIn(MARIO), (w, f) => (f === 5 ? (w.hurtPlayer(w.player, 1), true) : false), {
      state: { powerState: 'fire' },
      assist: { invulnerable: true },
    });
    expect(r.world.player.powerState).toBe('fire');
  });

  it('the hit loses the Flower list, then always the Mushroom list (hooks in that order)', () => {
    const calls: string[] = [];
    const def = classicStandIn(LINK, {
      kit: { loseFire: () => calls.push('fire'), loseBig: () => calls.push('big') },
    });
    play(def, (w, f) => (f === 5 ? (w.hurtPlayer(w.player, 1), true) : false), {
      state: { powerState: 'fire' },
    });
    expect(calls).toEqual(['fire', 'big']);
  });

  it('a poison mushroom takes the same path (a hit, not a pickup)', () => {
    const r = play(
      classicStandIn(SAMUS),
      (w, f) => {
        const p = w.player;
        if (f === 5) {
          const m = new PowerUp(6, 12, 'poison');
          m.body.x = p.body.x;
          m.body.y = p.body.y;
          w.spawn(m);
        }
        return f > 8;
      },
      { state: { powerState: 'fire' } },
    );
    expect(r.world.player.powerState).toBe('small');
    expect(r.world.player.dead).toBe(false);
  });
});

describe('hit response and invulnerability (PS-C10, PS-C11)', () => {
  /** Frames from a hit until a second contact would hurt (invulnerable no longer). */
  const window = (base: CharacterDef) => {
    let hitAt = -1;
    let free = -1;
    let landed = -1;
    play(
      classicStandIn(base),
      (w, f) => {
        const p = w.player;
        if (f === 20) {
          w.hurtPlayer(p, 1);
          hitAt = f;
        } else if (hitAt > 0) {
          if (landed < 0 && p.body.onGround && f > hitAt) landed = f;
          if (!p.invulnerable) {
            free = f;
            return true;
          }
        }
        return false;
      },
      { state: { powerState: 'big' } },
    );
    return { total: free - hitAt, fromLanding: free - landed };
  };

  it('Mario and Luigi: 60-frame freeze, then 150 invulnerable: 210', () => {
    expect(window(MARIO).total).toBe(210);
    expect(window(LUIGI).total).toBe(210);
  });
  it('Link: pushed about 8 frames, then 75: 83', () => expect(window(LINK).total).toBe(83));
  it('Samus: 15 locked, then 75: 90', () => expect(window(SAMUS).total).toBe(90));
  it('Mega Man: 27 locked, then 75: 102', () => expect(window(MEGAMAN).total).toBe(102));
  it('Bill: 60-frame freeze, then 120: 180', () => expect(window(BILL).total).toBe(180));
  it('Simon and Ryu: 75 frames from landing', () => {
    expect(window(SIMON).fromLanding).toBe(75);
    expect(window(RYU).fromLanding).toBe(75);
  });

  it('the freeze stops the whole world for 60 frames (Mario)', () => {
    let frozen = 0;
    play(
      classicStandIn(MARIO),
      (w, f) => {
        if (f === 5) w.hurtPlayer(w.player, 1);
        if (f > 5 && w.player.transition) frozen++;
        return f > 100;
      },
      { state: { powerState: 'big' } },
    );
    expect(frozen).toBe(60);
  });

  it('Link is pushed 32 px away from the source, at 4.1667 px/f, input locked; he faces the source', () => {
    let x0 = 0;
    let xs: number[] = [];
    let facing = 0;
    let jumped = false;
    play(
      classicStandIn(LINK),
      (w, f) => {
        const p = w.player;
        if (f === 20) {
          x0 = p.body.x;
          w.hurtPlayer(p, 1); // the source is on his left: pushed right
          facing = p.facing;
        } else if (f > 20) {
          xs.push(p.body.x);
          if (p.body.vy < 0) jumped = true;
        }
        return f > 40;
      },
      // Holding left and jump all the while: the lock ignores both.
      {
        state: { powerState: 'big' },
        script: {
          steps: [
            { frame: 0, hold: [] },
            { frame: 21, hold: ['left', 'jump'] },
          ],
        },
      },
    );
    xs = xs.map((x) => toPx(x - x0));
    expect(facing).toBe(-1);
    expect(xs[0]).toBeGreaterThan(3);
    // Pushed for 8 frames (33 px), then control returns (left is held: he walks back).
    expect(Math.max(...xs)).toBeGreaterThanOrEqual(32);
    expect(Math.max(...xs)).toBeLessThan(38);
    expect(jumped).toBe(false);
  });

  it('Mega Man is pushed backwards from his facing, not from the source', () => {
    let x0 = 0;
    let x1 = 0;
    play(
      classicStandIn(MEGAMAN),
      (w, f) => {
        const p = w.player;
        if (f === 20) {
          p.facing = 1;
          x0 = p.body.x;
          w.hurtPlayer(p, 1); // source on his left, but he faces right: pushed left
        }
        if (f === 30) x1 = p.body.x;
        return f > 30;
      },
      { state: { powerState: 'big' } },
    );
    expect(x1).toBeLessThan(x0);
  });

  it('Simon is knocked up into a hop and locked until he lands', () => {
    let minY = Infinity;
    let y0 = 0;
    let lockedUntil = -1;
    play(
      classicStandIn(SIMON),
      (w, f) => {
        const p = w.player;
        if (f === 20) {
          y0 = p.body.y;
          w.hurtPlayer(p, -1);
        } else if (f > 20) {
          minY = Math.min(minY, p.body.y);
          if (p.hurtLock) lockedUntil = f;
        }
        return f > 80;
      },
      { state: { powerState: 'big' } },
    );
    expect(toPx(y0 - minY)).toBeGreaterThan(8);
    expect(lockedUntil).toBeGreaterThan(25);
  });

  it('no head bump during the push (PS-C12)', () => {
    // A ? block right over Simon's head: the hop's rise reaches it but bumps nothing.
    const r = play(
      classicStandIn(SIMON),
      (w, f) => {
        if (f === 20) w.hurtPlayer(w.player, -1);
        return f > 60;
      },
      { level: flat({ 9: '......?' }), state: { powerState: 'big' } },
    );
    expect(r.world.map.get(6, 9)).toBe(T.Q_COIN);
  });

  it('no stomp during the push: landing on an enemy then is plain contact (ignored while invulnerable)', () => {
    let goomba: Goomba | null = null;
    play(
      classicStandIn(MARIO),
      (w, f) => {
        const p = w.player;
        if (f === 2) {
          goomba = new Goomba(p.body.x, px(13 * 16 - 14));
          w.spawn(goomba);
          p.body.y = px(120);
          p.body.onGround = false;
          p.hurtLock = { t: 0, startX: p.body.x, dir: 1, invulnAfter: 75, untilLand: true };
          p.stun = 1 << 20;
          p.invuln = 1 << 20;
        }
        const g = goomba as Goomba | null;
        if (g?.alive) {
          g.body.vx = 0;
          p.body.x = g.body.x;
        }
        return f > 60;
      },
      { state: { powerState: 'big' } },
    );
    expect((goomba as Goomba | null)?.alive).toBe(true);
  });

  it('items can still be collected during the push (Open question 3)', () => {
    const r = play(
      classicStandIn(LINK),
      (w, f) => {
        const p = w.player;
        if (f === 20) {
          w.hurtPlayer(p, 1);
          w.spawn(new Pickup(p.body.x + px(20), p.body.y + p.body.h, 'bomb'));
        }
        return f > 40;
      },
      { state: { powerState: 'big' } },
    );
    expect(r.events.some((e) => e.type === 'pickup')).toBe(true);
  });
});

describe('looks (PS-C13)', () => {
  /** Visible / alpha per frame after a hit, as the def's drawLook reports. */
  const looks = (base: CharacterDef, frames: number, reduce = false) => {
    const out: { visible: boolean; alpha: number }[] = [];
    let hitAt = -1;
    play(
      classicStandIn(base),
      (w, f) => {
        const p = w.player;
        if (f === 20) {
          w.hurtPlayer(p, 1);
          hitAt = f;
        }
        if (hitAt >= 0) out.push(p.def.drawLook?.(p, f, reduce) ?? { visible: true, alpha: 1 });
        return hitAt >= 0 && f - hitAt >= frames;
      },
      { state: { powerState: 'big' } },
    );
    return out;
  };
  /** Frames between visibility changes. */
  const runs = (v: boolean[]) => {
    const out: number[] = [];
    let n = 1;
    for (let i = 1; i < v.length; i++) {
      if (v[i] !== v[i - 1]) {
        out.push(n);
        n = 1;
      } else n++;
    }
    return out;
  };

  it('Samus flickers on a 25 ms timer: toggles after 2, 1, 2, 1… frames', () => {
    const v = looks(SAMUS, 13).map((l) => l.visible);
    expect(runs(v).slice(0, 6)).toEqual([2, 1, 2, 1, 2, 1]);
  });

  it('Mega Man flickers on a 70 ms timer: 5, 4, 4, 4, 4, 5', () => {
    const v = looks(MEGAMAN, 40).map((l) => l.visible);
    expect(runs(v).slice(0, 6)).toEqual([5, 4, 4, 4, 4, 5]);
  });

  it('with Reduce flashing, flicker and palette-flash heroes are drawn at 65 % instead', () => {
    for (const h of [SAMUS, MEGAMAN, LINK])
      for (const l of looks(h, 10, true).slice(1)) expect(l).toEqual({ visible: true, alpha: 0.65 });
  });

  it('Mario is at 65 % from the hit to the end of the window, then opaque', () => {
    const l = looks(MARIO, 215);
    for (const x of l.slice(0, 209)) expect(x.alpha).toBe(0.65);
    expect(l[l.length - 1]?.alpha).toBe(1);
  });

  it('Simon is opaque during the hop and at 65 % once landed', () => {
    const l = looks(SIMON, 60);
    expect(l[1]?.alpha).toBe(1);
    expect(l[50]?.alpha).toBe(0.65);
  });

  it('the World draws the look through Renderer.alpha', () => {
    const alphas: number[] = [];
    const r = play(classicStandIn(MARIO), (w, f) => (f === 5 ? (w.hurtPlayer(w.player, 1), true) : false), {
      state: { powerState: 'big' },
    });
    const rec: Renderer = Object.assign(new NullRenderer(), {
      alpha(a: number, draw: () => void): void {
        alphas.push(a);
        draw();
      },
    });
    const w = r.world;
    // A sprite sheet stub: the world only asks for frames.
    (w.ctx.assets as unknown as { sheet: () => unknown }).sheet = () => ({ frames: new Map() });
    w.render(rec);
    expect(alphas).toContain(0.65);
  });

  it('every Classic hit response has a look', () => {
    for (const r of Object.values(CLASSIC_HIT_RESPONSES)) expect(r.look).toBeDefined();
    expect(classicLook({ dead: true } as Player, false, { alpha: true })).toEqual({
      visible: true,
      alpha: 1,
    });
  });
});

describe('power-ups (PS-C2..PS-C4, PS-C6)', () => {
  /** Gives `kinds` one after another (each once the last freeze is over) and logs the states. */
  const take = (
    def: CharacterDef,
    power: string,
    kinds: ('mushroom' | 'flower')[],
    kit?: Record<string, number>,
  ) => {
    const states: string[] = [];
    const freezes: number[] = [];
    let i = 0;
    let frozen = 0;
    const r = play(
      def,
      (w, f) => {
        const p = w.player;
        if (p.transition) frozen++;
        else if (f > 2 && i < kinds.length && f % 80 === 0) {
          if (i > 0) freezes.push(frozen);
          frozen = 0;
          w.powerUp(p, kinds[i++] as 'mushroom');
          states.push(p.powerState);
        } else if (i === kinds.length && f % 80 === 79) {
          freezes.push(frozen);
          return true;
        }
        return false;
      },
      { state: { powerState: power, kit: kit ?? {}, score: 0 } },
    );
    return { states, freezes, score: r.score, kit: r.world.player.scratch };
  };

  it('small + Flower → big; big + Mushroom → fire (Mario, then Link), 60-frame freezes, 1000 each', () => {
    for (const base of [MARIO, LINK]) {
      const t = take(classicStandIn(base), 'small', ['flower', 'mushroom']);
      expect(t.states).toEqual(['big', 'fire']);
      expect(t.freezes).toEqual([60, 60]);
      expect(t.score).toBe(2000);
    }
  });

  it('a ? block gives a Mushroom to a small hero, else a Flower (every Classic def)', () => {
    for (const base of HEROES) {
      const d = classicStandIn(base);
      expect(d.blockPowerUp({ powerState: 'small' } as Player)).toBe('mushroom');
      expect(d.blockPowerUp({ powerState: 'big' } as Player)).toBe('flower');
      expect(d.blockPowerUp({ powerState: 'fire' } as Player)).toBe('flower');
    }
  });

  it('fire + Flower: the repeat bonus, capped, no freeze (Simon +5 hearts)', () => {
    const def = classicStandIn(SIMON, { kit: { repeat: { key: 'hearts', add: 5, max: 99 } } });
    const t = take(def, 'fire', ['flower', 'mushroom'], { hearts: 92 });
    expect(t.states).toEqual(['fire', 'fire']);
    expect(t.freezes).toEqual([0, 0]);
    expect(t.kit.hearts).toBe(99);
    expect(t.score).toBe(2000);
  });

  it('fire + Flower with no repeat bonus: 1000 points only (Mario, Bill)', () => {
    const t = take(classicStandIn(BILL), 'fire', ['flower']);
    expect(t.states).toEqual(['fire']);
    expect(t.score).toBe(1000);
  });

  it('the Mushroom and Flower hooks run when the state is reached', () => {
    const got: string[] = [];
    const def = classicStandIn(LINK, {
      kit: { gainBig: (p) => (got.push('big'), (p.scratch.bombs ??= 3)), gainFire: () => got.push('fire') },
    });
    const t = take(def, 'small', ['mushroom', 'mushroom']);
    expect(got).toEqual(['big', 'fire']);
    expect(t.kit.bombs).toBe(3);
  });

  it('a 1-up gives a life and changes no state (PS-C20)', () => {
    const r = play(classicStandIn(LINK), (w, f) => (f === 5 ? (w.powerUp(w.player, '1up'), true) : false), {
      state: { powerState: 'big', lives: 3 },
    });
    expect(r.lives).toBe(4);
    expect(r.world.player.powerState).toBe('big');
  });
});

describe('Star (PS-C18, PS-C19)', () => {
  it('lasts 720 frames; the level music returns at frame 642; Current keeps 600', () => {
    expect(STAR_FRAMES).toBe(600);
    const music: [number, string][] = [];
    let frame = 0;
    const audio: AudioSink = { ...NULL_AUDIO, playMusic: (id: string) => music.push([frame, id]) };
    const def = classicStandIn(MARIO);
    const w = new World(
      flat(),
      {
        assets: new Assets({ default: {} }),
        audio,
        assist: { ...DEFAULT_ASSIST },
        reduceFlashing: true,
        rules: 'classic',
      },
      newGameState(def, null, 'classic'),
      { seed: 1 },
    );
    const idle = {
      held: () => false,
      pressed: () => false,
      released: () => false,
      bufferedJump: () => false,
      consumeJumpBuffer: () => undefined,
      dirX: 0 as const,
    };
    let starAt = -1;
    let ended = -1;
    for (frame = 0; frame < 800; frame++) {
      w.update([idle]);
      if (frame === 10) {
        w.powerUp(w.player, 'star');
        starAt = frame;
        expect(w.player.star).toBe(CLASSIC_STAR_FRAMES);
      }
      if (starAt >= 0 && ended < 0 && w.player.star === 0) ended = frame;
    }
    expect(ended - starAt).toBe(720);
    const back = music.filter(([, id]) => id !== 'star');
    expect(music.find(([, id]) => id === 'star')?.[0]).toBe(10);
    expect(back[back.length - 1]?.[0]).toBe(starAt + 642);
  });

  it('flashes fast for 570 frames, then slowly (every 6 frames); Reduce flashing holds one palette', () => {
    const p = { star: CLASSIC_STAR_FRAMES } as Player;
    expect([0, 1, 2, 3].map((f) => classicStarPaletteStep(p, f, false))).toEqual([0, 0, 1, 1]);
    p.star = CLASSIC_STAR_FRAMES - 570;
    expect([0, 5, 6, 12].map((f) => classicStarPaletteStep(p, f, false))).toEqual([0, 0, 1, 2]);
    expect(classicStarPaletteStep(p, 9, true)).toBe(0);
    p.star = 0;
    expect(classicStarPaletteStep(p, 9, false)).toBeNull();
  });

  it('ammo is free under Star; a weapon needs none then', () => {
    const p = { star: 0, scratch: { bombs: 1 } } as unknown as Player;
    expect(spendAmmo(p, 'bombs', 1)).toBe(true);
    expect(p.scratch.bombs).toBe(0);
    expect(spendAmmo(p, 'bombs', 1)).toBe(false);
    expect(hasAmmo(p, 'bombs', 1)).toBe(false);
    p.star = 100;
    expect(hasAmmo(p, 'bombs', 1)).toBe(true);
    expect(spendAmmo(p, 'bombs', 1)).toBe(true);
    expect(p.scratch.bombs).toBe(0);
  });
});

describe('drops and ammo (PS-C14..PS-C17)', () => {
  const simon = { scratch: {} } as unknown as Player;

  it('10 000 Goomba kills by Simon: about 2500 drops, about 20 % big hearts', () => {
    const rng = new Rng(12345);
    let drops = 0;
    let big = 0;
    for (let i = 0; i < 10000; i++) {
      const k = classicDrop(rng, simon, CLASSIC_DROPS.simon, 'enemy');
      if (k) drops++;
      if (k === 'heart-large') big++;
    }
    expect(drops).toBeGreaterThan(2350);
    expect(drops).toBeLessThan(2650);
    expect(big / drops).toBeGreaterThan(0.17);
    expect(big / drops).toBeLessThan(0.23);
  });

  it('bricks drop at 6.25 %, coins at 12.5 % (Simon, Ryu); Mega Man gets nothing from blocks', () => {
    const rate = (table: (typeof CLASSIC_DROPS)[string] | undefined, src: 'brick' | 'coin') => {
      const rng = new Rng(7);
      let n = 0;
      for (let i = 0; i < 20000; i++) if (classicDrop(rng, simon, table, src)) n++;
      return n / 20000;
    };
    expect(Math.abs(rate(CLASSIC_DROPS.simon, 'brick') - 0.0625)).toBeLessThan(0.01);
    expect(Math.abs(rate(CLASSIC_DROPS.ryu, 'coin') - 0.125)).toBeLessThan(0.012);
    expect(rate(CLASSIC_DROPS.megaman, 'brick')).toBe(0);
    expect(rate(CLASSIC_DROPS.link, 'coin')).toBe(0);
  });

  it('Mario, Luigi and Bill never get drops; Link drops nothing until he owns bombs', () => {
    const rng = new Rng(3);
    for (const id of ['mario', 'luigi', 'bill'])
      for (let i = 0; i < 1000; i++) expect(classicDrop(rng, simon, CLASSIC_DROPS[id], 'enemy')).toBeNull();
    const link = {
      ...CLASSIC_DROPS.link,
      gate: (p: Player) => (p.scratch.bombs ?? -1) >= 0,
    } as typeof CLASSIC_DROPS.link;
    for (let i = 0; i < 1000; i++) expect(classicDrop(rng, simon, link, 'enemy')).toBeNull();
    const owner = { scratch: { bombs: 0 } } as unknown as Player;
    let n = 0;
    for (let i = 0; i < 1000; i++) if (classicDrop(rng, owner, link, 'enemy') === 'bomb') n++;
    expect(n).toBeGreaterThan(150);
  });

  it('a killed enemy drops for the Classic killer (World.enemyKilled → drop)', () => {
    let drops = 0;
    play(classicStandIn(SIMON), (w, f) => {
      if (f === 2) {
        for (let i = 0; i < 200; i++)
          w.enemyKilled(new Goomba(px(200), px(100)), { kind: 'sword', amount: 1, owner: w.player, dirX: 1 });
        drops = w.entities.filter((e) => e instanceof Pickup).length;
        return true;
      }
      return false;
    });
    expect(drops).toBeGreaterThan(25);
    expect(drops).toBeLessThan(80);
  });

  it('a broken brick and a coin block roll the hero blockDrop; Current heroes roll nothing', () => {
    const def: CharacterDef = { ...classicStandIn(MARIO), blockDrop: () => 'heart-small' };
    const r = play(
      def,
      (w, f) => {
        if (f === 2) {
          w.strikeBlock(10, 9, w.player, true); // brick
          w.strikeBlock(12, 9, w.player, false); // coin block
          return true;
        }
        return false;
      },
      { level: flat({ 9: '..........=.?' }) },
    );
    expect(r.world.entities.filter((e) => e instanceof Pickup).length).toBe(2);
    const cur = runSim({
      level: flat({ 9: '..........=.?' }),
      character: MARIO,
      script: none,
      maxFrames: 3,
      until: (w, f) => {
        if (f !== 2) return false;
        w.strikeBlock(10, 9, w.player, true);
        w.strikeBlock(12, 9, w.player, false);
        return true;
      },
    });
    expect(cur.world.entities.filter((e) => e instanceof Pickup).length).toBe(0);
  });

  it('a pickup is always taken, the extra lost when full', () => {
    const w = { audio: NULL_AUDIO } as unknown as World;
    const p = { scratch: { hearts: 97 } } as unknown as Player;
    expect(classicPickup(p, 'heart-large', w, { 'heart-large': { key: 'hearts', max: 99 } })).toBe(true);
    expect(p.scratch.hearts).toBe(99);
    expect(classicPickup(p, 'heart-small', w, {})).toBe(true);
    expect(p.scratch.hearts).toBe(99);
  });
});

describe('death, drop-in and the start kit (PS-C21, PS-C22, PS-C24)', () => {
  it('the start kit is given once per life', () => {
    const p = { scratch: {} as Record<string, number> } as Player;
    classicStartKit(p, { hearts: 10 });
    expect(p.scratch.hearts).toBe(10);
    p.scratch.hearts = 3;
    classicStartKit(p, { hearts: 10 });
    expect(p.scratch.hearts).toBe(3);
  });

  it('a co-op drop-in comes back small with the start kit and drop-in invulnerability', () => {
    const def = classicStandIn(SIMON, { start: { hearts: 10 } });
    const r = runSim({
      level: flat(),
      character: def,
      rules: 'classic',
      state: { character2: classicStandIn(RYU), powerState: 'fire', powerState2: 'fire', lives: 3 },
      script: none,
      maxFrames: 600,
      until: (w, f) => {
        const p = w.players[0] as Player;
        if (f === 5) {
          p.scratch.hearts = 40;
          p.scratch.morningStar = 1;
          w.kill(p);
        }
        return f > 5 && !p.dead && p.invuln > 0;
      },
    });
    const p = r.world.players[0] as Player;
    expect(p.powerState).toBe('small');
    expect(p.scratch.hearts).toBe(10);
    expect(p.scratch.morningStar).toBeUndefined();
    expect(p.invuln).toBeGreaterThan(100);
  });

  it('classicRespawn wipes the kit and gives the start kit again', () => {
    const p = { scratch: { hearts: 40, classicKit: 1 }, frame: 9, hurtLock: null } as unknown as Player;
    classicRespawn(p, { hearts: 10 });
    expect(p.scratch.hearts).toBe(10);
  });

  it('the pit kills in any state, Star included (PS-C24)', () => {
    const r = play(
      classicStandIn(MARIO),
      (w, f) => {
        if (f === 5) {
          w.player.star = CLASSIC_STAR_FRAMES;
          w.player.body.y = px(260);
        }
        return w.player.dead;
      },
      { state: { powerState: 'fire' }, maxFrames: 30 },
    );
    expect(r.world.player.dead).toBe(true);
  });
});

describe('HUD (PS-C25..PS-C27)', () => {
  const boxes = (c1: CharacterDef, c2: CharacterDef | null, power: string, power2 = 'small') => {
    const w = runSim({
      level: flat(),
      character: c1,
      rules: c1.rules ?? 'current',
      state: { character2: c2, powerState: power, powerState2: power2 },
      script: none,
      maxFrames: 1,
    }).world;
    const out: { what: string; x: number; y: number }[] = [];
    const r: Renderer = Object.assign(new NullRenderer(), {
      text(_f: SpriteSheet, str: string, x: number, y: number): void {
        out.push({ what: str, x, y });
      },
      sprite(_s: SpriteSheet, frame: string, x: number, y: number): void {
        out.push({ what: frame, x, y });
      },
    });
    drawHud(r, { sheet: () => ({}) } as unknown as AssetRegistry, w.state, 400, 0, w.players);
    return out;
  };
  const icon = (b: ReturnType<typeof boxes>) =>
    b.filter((x) => x.what.startsWith('icon-mushroom') || x.what.startsWith('icon-flower'));

  it('Classic Link small: no icon and no hearts; Mushroom → icon-mushroom at (24, 24); Flower → icon-flower', () => {
    const def = classicStandIn(LINK);
    expect(icon(boxes(def, null, 'small'))).toEqual([]);
    expect(boxes(def, null, 'small').some((b) => /^[hfe]+$/.test(b.what))).toBe(false);
    expect(icon(boxes(def, null, 'big'))).toEqual([{ what: 'icon-mushroom', ...POWER_ICON_P1 }]);
    expect(icon(boxes(def, null, 'fire'))).toEqual([{ what: 'icon-flower', ...POWER_ICON_P1 }]);
  });

  it("player 2's icon goes at (144, 32)", () => {
    const b = boxes(classicStandIn(MARIO), classicStandIn(SIMON), 'small', 'fire');
    expect(icon(b)).toEqual([{ what: 'icon-flower', ...POWER_ICON_P2 }]);
  });

  it("Current Mario keeps today's HUD: no icon", () => {
    expect(icon(boxes(MARIO, null, 'fire'))).toEqual([]);
  });

  it('a Classic ammo counter: icon at (96, 24), then ×NN (3 digits past 99)', () => {
    const def = classicStandIn(RYU, {
      hudAmmo: (p) => ({ icon: 'icon-ninpo', count: p.scratch.ninpo ?? 0 }),
    });
    const w = runSim({ level: flat(), character: def, rules: 'classic', script: none, maxFrames: 1 }).world;
    (w.player as Player).scratch.ninpo = 150;
    const out: string[] = [];
    const r: Renderer = Object.assign(new NullRenderer(), {
      text(_f: SpriteSheet, str: string, x: number, y: number): void {
        out.push(`${str}@${x},${y}`);
      },
      sprite(_s: SpriteSheet, frame: string, x: number, y: number): void {
        out.push(`${frame}@${x},${y}`);
      },
    });
    drawHud(r, { sheet: () => ({}) } as unknown as AssetRegistry, w.state, 400, 0, w.players);
    expect(out).toContain('icon-ninpo@96,24');
    expect(out).toContain('×150@105,24');
  });

  it('the items sheet has the two icons, 8 × 8, with no black', () => {
    for (const id of ['icon-mushroom', 'icon-flower']) {
      const rows = itemsDef.frames[id] as string[];
      expect(rows).toHaveLength(8);
      for (const row of rows) {
        expect(row).toHaveLength(8);
        expect(row).not.toContain('0');
      }
    }
  });
});
