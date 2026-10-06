import { describe, expect, it, vi } from 'vitest';
import { getLevel } from '@content/levels';
import { PALETTES, SPRITES } from '@content/sprites';
import { DEFAULT_ASSIST } from '@game/context';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { NullRenderer } from '@engine/gfx/renderer';
import { px, toPx } from '@engine/math/units';
import { runSim, ScriptedInput } from '@game/sim/headless';
import { Game } from '@game/scenes/game';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { IntroScene } from '@game/scenes/intro';
import { LevelScene } from '@game/scenes/level';
import { CHARACTERS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { Enemy } from '@game/entities/enemies/enemy';
import { Goomba } from '@game/entities/enemies/goomba';
import { Piranha } from '@game/entities/enemies/piranha';
import { Vine } from '@game/entities/objects/vine';
import type { World, WorldEvent } from '@game/world/world';
import type { Action } from '@engine/input/actions';

// Area transfers checked against the original (com/smbc): warps (EventManager.levelTransfer),
// intros (Level.as watchModeOverride), the vine arrival (Vine.growFromStgBot,
// Character.climbVineStarter / checkVinePosition), stepping off a vine (Character.movePlayer /
// getOffVine), pipe speed (Character vertPipeSpeed / horzPipeSpeed, PIPE_LEV_TRANS_DELAY), enemy
// removal on arrival (Level.destroyNearbyEnemies) and the restart area (Level.reloadLevel).

function makeGame() {
  const assets = new AssetRegistry(PALETTES);
  assets.defineAll(SPRITES);
  const audio = { ...NULL_AUDIO, stopMusic: vi.fn(), playMusic: vi.fn() };
  const game = new Game({
    ctx: { assets, audio, assist: { ...DEFAULT_ASSIST }, reduceFlashing: true },
    getLevel,
    characters: CHARACTERS,
  });
  const p1 = new ScriptedInput({ steps: [] });
  const r = new NullRenderer();
  const step = (a: Action[] = []) => {
    p1.setHeld(a);
    p1.next();
    game.scenes.update([p1]);
    game.scenes.render(r);
  };
  const tap = (a: Action) => {
    step([a]);
    step();
  };
  const until = (pred: () => boolean, max = 2000) => {
    for (let i = 0; i < max && !pred(); i++) step();
    expect(pred()).toBe(true);
  };
  const top = () => game.scenes.top;
  const level = () => top() as LevelScene;
  const fire = (ev: WorldEvent) => {
    expect(top()).toBeInstanceOf(LevelScene);
    level().world.events.push(ev);
    step();
  };
  /** Character select (keep the hero), the WORLD card, then the level. */
  const pickAndPlay = () => {
    expect(top()).toBeInstanceOf(CharacterSelectScene);
    for (let i = 0; i < 12; i++) step();
    tap('jump');
    expect(top()).toBeInstanceOf(IntroScene);
    until(() => top() instanceof LevelScene);
  };
  const die = () => {
    const w = level().world;
    w.kill(w.player);
    until(() => !(top() instanceof LevelScene), 400);
  };
  /** Start `id` directly, as a pipe would, with the HUD's world and stage set. */
  const play = (id: string) => {
    const l = getLevel(id);
    game.state.world = l.world;
    game.state.stage = l.stage;
    game.startLevel(l, { mode: 'stand' });
    step();
  };
  return { game, step, tap, until, top, level, fire, pickAndPlay, die, play };
}

const enemiesNear = (w: World, col: number) =>
  w.entities.filter(
    (e) => e instanceof Enemy && e.alive && Math.abs(toPx(e.body.x + (e.body.w >> 1)) - col * 16) < 96,
  );

describe('warps outside campaign mode (?level=, dev)', () => {
  it('go through character select and the WORLD card of the target, and forget the old checkpoint', () => {
    const h = makeGame();
    h.game.newGame(MARIO, '1-2');
    h.until(() => h.top() instanceof LevelScene);
    h.play('1-2');
    h.game.state.checkpoint = { level: '1-2', x: 97 };
    h.level().world.player.powerState = 'fire';
    h.step();
    h.fire({ type: 'pipe', target: { level: '4-1', x: 2, y: 12 } });
    expect(h.game.state.checkpoint).toBeNull();
    expect(h.game.state.warped).toBe(true);
    h.pickAndPlay();
    expect([h.game.state.world, h.game.state.stage]).toEqual([4, 1]);
    expect(h.level().level.id).toBe('4-1');
    expect(h.level().world.time).toBe(400);
    expect(h.level().world.player.powerState).toBe('fire'); // the same hero keeps its power
    // A death in 4-1 restarts 4-1, not 1-2's midpoint.
    h.die();
    h.pickAndPlay();
    expect(h.level().level.id).toBe('4-1');
    expect(toPx(h.level().world.player.body.x)).toBeLessThan(5 * 16);
  });
});

describe('intro scenes', () => {
  it('1-2-intro walks Mario into the pipe on its own with no clock; 1-2 starts at 400', () => {
    const h = makeGame();
    h.game.newGame(MARIO, '1-1');
    h.game.goToLevel('1-2-intro', { mode: 'stand' });
    h.until(() => h.top() instanceof LevelScene);
    const w = h.level().world;
    expect(w.autoWalk).toBe(true);
    expect(w.time).toBeNull();
    h.until(() => h.level().level.id === '1-2', 900);
    expect(h.level().world.time).toBe(400);
  });
});

describe('the vine arrival in a sky area', () => {
  it('4-2-warp: a 5-tile vine grows, Mario climbs it on his own and steps off right; the time is hidden meanwhile', () => {
    const seen: { frame: number; hidden: boolean; onVine: boolean; timeHidden: boolean }[] = [];
    const r = runSim({
      level: getLevel('4-2-warp'),
      character: MARIO,
      script: { steps: [{ frame: 0, hold: [] }] },
      maxFrames: 600,
      controller: (w, f) => {
        seen.push({ frame: f, hidden: w.player.hidden, onVine: !!w.player.vine, timeHidden: w.timeHidden });
        return [];
      },
      until: (w) => !w.timeHidden && w.player.body.onGround,
    });
    expect(r.outcome).toBe('stopped');
    const w = r.world;
    const vines = w.entities.filter((e): e is Vine => e instanceof Vine);
    expect(vines).toHaveLength(1); // the map's 8-tile vine is replaced
    const v = vines[0] as Vine;
    expect([v.basePx, v.topPx]).toEqual([240, 240 - 5 * 16]);
    // Hidden while the vine grows (80 px at 0.5 px a frame), then climbing, then off.
    expect(seen[0]).toMatchObject({ hidden: true, onVine: true, timeHidden: true });
    const shown = seen.findIndex((s) => !s.hidden);
    expect(shown).toBeGreaterThanOrEqual(155);
    expect(shown).toBeLessThanOrEqual(165);
    const off = seen.findIndex((s) => !s.onVine);
    expect(off).toBeGreaterThan(shown + 60);
    expect(seen.slice(0, off).every((s) => s.timeHidden)).toBe(true);
    // Landed right of the vine on the ground (row 13), not hanging on the vine.
    expect(w.player.vine).toBeNull();
    expect(toPx(w.player.body.x)).toBeGreaterThan(4 * 16 + 9);
    expect(toPx(w.player.body.y + w.player.body.h)).toBe(13 * 16);
  });
});

describe('on a vine', () => {
  /** 4-2-warp after the arrival: stand right of the vine, then run `script` (frame → actions). */
  function vineRun(script: (f: number) => Action[]) {
    let base = -1;
    const log: { onVine: boolean; x: number; vy: number }[] = [];
    const r = runSim({
      level: getLevel('4-2-warp'),
      character: MARIO,
      script: { steps: [{ frame: 0, hold: [] }] },
      maxFrames: 700,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (base < 0 && !w.timeHidden && w.player.body.onGround) base = f;
        if (base < 0) return [];
        log.push({ onVine: !!w.player.vine, x: toPx(w.player.body.x), vy: w.player.body.vy });
        return script(f - base);
      },
      until: (_w, f) => base >= 0 && f - base > 160,
    });
    return { r, log };
  }

  it('left or right does nothing until released once; the next press steps off; jump does nothing', () => {
    const { r, log } = vineRun((f) => {
      if (f < 40) return ['up']; // grab (on the ground beside it) and climb
      if (f < 70) return ['right']; // held since before: stays on
      if (f < 72) return []; // released: armed
      if (f < 90) return f % 4 === 0 ? ['jump'] : []; // jump on the vine: nothing
      return ['right'];
    });
    expect(r.outcome).toBe('stopped');
    expect(log[39]?.onVine).toBe(true);
    expect(log.slice(40, 90).every((s) => s.onVine)).toBe(true);
    const climbX = log[60]?.x as number;
    expect(log.slice(40, 90).every((s) => s.x === climbX)).toBe(true);
    // The press after the release steps off to the right, beside the vine's hit box.
    expect(log[91]?.onVine).toBe(false);
    expect(log[91]?.x).toBeGreaterThanOrEqual(4 * 16 + 9);
    // And he is not caught by the same vine again while falling.
    expect(log.slice(91).every((s) => !s.onVine)).toBe(true);
  });

  it('steps off to the left too', () => {
    const { log } = vineRun((f) => {
      if (f < 40) return ['up'];
      if (f < 42) return [];
      if (f < 50) return ['left'];
      if (f < 52) return [];
      return ['left'];
    });
    expect(log[39]?.onVine).toBe(true);
    // Releasing up does not arm the step-off, so the first left press keeps him on; releasing
    // left does, and the next left press steps off.
    expect(log[45]?.onVine).toBe(true);
    expect(log[53]?.onVine).toBe(false);
    expect((log[53]?.x as number) + 12).toBeLessThanOrEqual(4 * 16 + 7);
  });
});

describe('pipes', () => {
  it('coming up out of a pipe stops level with the pipe top, at 25 px/s', () => {
    let minFeet = Infinity;
    let frozen = 0;
    const r = runSim({
      level: getLevel('1-2'),
      character: MARIO,
      script: { steps: [{ frame: 0, hold: [] }] },
      maxFrames: 120,
      start: { x: 115, y: 10, mode: 'pipe-exit' },
      controller: (w) => {
        const b = w.player.body;
        minFeet = Math.min(minFeet, b.y + b.h);
        if (w.player.frozen) frozen++;
        return [];
      },
    });
    expect(minFeet).toBe(px(11 * 16)); // the pipe top (row 11), never above it
    expect(r.world.player.body.y + r.world.player.body.h).toBe(px(11 * 16));
    // One body height (16 px) at 25/60 px a frame: about 38 frames.
    expect(frozen).toBeGreaterThanOrEqual(36);
    expect(frozen).toBeLessThanOrEqual(41);
  });

  it('going down a pipe takes about 0.8 s at 25 px/s, then 0.5 s hidden before the next area', () => {
    let pressed = -1;
    let hiddenAt = -1;
    const r = runSim({
      level: getLevel('1-1'),
      character: MARIO,
      script: { steps: [{ frame: 0, hold: [] }] },
      maxFrames: 300,
      start: { x: 57, y: 8 },
      controller: (w, f) => {
        if (w.player.hidden && hiddenAt < 0) hiddenAt = f;
        if (!w.player.body.onGround) return [];
        if (pressed < 0) pressed = f;
        return ['down'];
      },
    });
    expect(r.outcome).toBe('pipe');
    // 16 px body + 3 px (HRECT_PADDING_Y) at 25/60 px a frame: ~46 frames, then 30 hidden.
    expect(hiddenAt - pressed).toBeGreaterThanOrEqual(44);
    expect(hiddenAt - pressed).toBeLessThanOrEqual(49);
    expect(r.frames - hiddenAt).toBeGreaterThanOrEqual(29);
    expect(r.frames - hiddenAt).toBeLessThanOrEqual(31);
  });

  it('a side pipe moves the player in at the same speed', () => {
    let start = -1;
    const r = runSim({
      level: getLevel('1-2-bonus'),
      character: MARIO,
      script: { steps: [{ frame: 0, hold: [] }] },
      maxFrames: 400,
      start: { x: 11, y: 12, mode: 'stand' },
      controller: (w, f) => {
        if (w.inPipe && start < 0) start = f;
        return ['right'];
      },
    });
    expect(r.outcome).toBe('pipe');
    // 12 px body + 2 px (HRECT_PADDING_X) at 25/60 px a frame (~34 frames), then 30 hidden.
    expect(r.frames - start).toBeGreaterThanOrEqual(62);
    expect(r.frames - start).toBeLessThanOrEqual(68);
  });
});

describe('enemies near the arrival point are removed (Level.destroyNearbyEnemies)', () => {
  it('a checkpoint restart in 1-2 clears the Goombas at 99-102 but keeps the plant 6 tiles away', () => {
    const h = makeGame();
    h.game.newGame(MARIO, '1-2');
    h.until(() => h.top() instanceof LevelScene);
    h.play('1-2');
    h.fire({ type: 'checkpoint', x: 97 });
    h.die();
    h.pickAndPlay();
    for (let i = 0; i < 4; i++) h.step();
    const w = h.level().world;
    expect(toPx(w.player.body.x)).toBeLessThan(98 * 16);
    expect(enemiesNear(w, 97.5).filter((e) => e instanceof Goomba)).toEqual([]);
    expect(w.entities.some((e) => e instanceof Piranha && e.alive)).toBe(true);
  });

  it('coming out of the pipe at 1-2 column 115 clears the Goomba at 113 and keeps the plant', () => {
    const h = makeGame();
    h.play('1-2-bonus');
    h.fire({ type: 'pipe', target: { level: '1-2', x: 115, y: 10, exitDir: 'up' } });
    for (let i = 0; i < 60; i++) h.step();
    const w = h.level().world;
    expect(h.level().level.id).toBe('1-2');
    expect(w.entities.some((e) => e instanceof Goomba && e.alive)).toBe(false);
    expect(w.entities.some((e) => e instanceof Piranha && e.alive)).toBe(true);
  });

  it('dropping back into ll-11-1 at 114 from the sky area clears the Koopa and Goombas there', () => {
    const h = makeGame();
    h.play('ll-11-1-sky');
    h.fire({ type: 'pipe', target: { level: 'll-11-1', x: 114, y: 0, exitDir: 'fall' } });
    for (let i = 0; i < 60; i++) h.step();
    const w = h.level().world;
    expect(enemiesNear(w, 115)).toEqual([]);
  });
});

describe('Lost Levels 9-1 restarts in its start room (Level.reloadLevel loads area a)', () => {
  it('after a death in the flooded area', () => {
    const h = makeGame();
    h.game.newGame(MARIO, 'll-9-1');
    h.until(() => h.top() instanceof LevelScene);
    expect(h.level().level.id).toBe('ll-9-1');
    h.die();
    h.pickAndPlay();
    expect(h.level().level.id).toBe('ll-9-1-start');
    expect(h.level().world.time).toBe(400);
  });

  it('after a Continue from World 9', () => {
    const h = makeGame();
    h.game.newGame(MARIO, 'll-9-3');
    h.game.continueGame('ll-9-3');
    h.pickAndPlay();
    expect(h.level().level.id).toBe('ll-9-1-start');
  });
});
