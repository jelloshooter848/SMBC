import { describe, expect, it, vi } from 'vitest';
import { getLevel } from '@content/levels';
import { px, toPx } from '@engine/math/units';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { AssetRegistry } from '@engine/assets/registry';
import { PALETTES, SPRITES } from '@content/sprites';
import type { Renderer } from '@engine/gfx/renderer';
import { NullRenderer } from '@engine/gfx/renderer';
import type { Action } from '@engine/input/actions';
import { NO_INPUT } from '@engine/input/input-manager';
import type { Announcer } from '@engine/a11y/announcer';
import { defaultSettings } from '@engine/save/settings';
import { runSim } from '@game/sim/headless';
import { DEFAULT_ASSIST, newGameState } from '@game/context';
import { MARIO } from '@game/characters/mario';
import { LUIGI } from '@game/characters/luigi';
import { CHARACTERS } from '@game/characters/registry';
import { campaignLevel } from '@game/level/campaign';
import { Lift } from '@game/entities/objects/lift';
import { Game } from '@game/scenes/game';
import { AssistOptionsScene } from '@game/scenes/options';
import type { MenuItem } from '@game/scenes/menu';
import { World } from '@game/world/world';
import type { Player } from '@game/entities/player';
import { duelHarness } from '@game/minigames/ryu/harness';
import { castleHarness } from '@game/minigames/simon/harness';
import { escapeHarness } from '@game/minigames/samus/harness';
import { stationHarness } from '@game/minigames/megaman/harness';
import { drops } from './safety-floor-bot';

// The Safety floor dev assist (Dev → Assists): an invisible one-way floor at the rim of every
// deadly pit and on lava. Falls that lead somewhere (pit transfers, 5-4's descent, vines) still
// lead there; toggling it mid-level works at once; both co-op players are caught; the mini games
// built on World read the same assist.

const none = { steps: [{ frame: 0, hold: [] as Action[] }] };
const SAFE = { safetyFloor: true, invulnerable: true, infiniteTime: true };
const feetRow = (p: Player) => toPx(p.body.y + p.body.h) / 16;

describe('the assist setting', () => {
  it('is off by default, saved with the other assists', () => {
    expect(DEFAULT_ASSIST.safetyFloor).toBe(false);
    expect(defaultSettings().assist.safetyFloor).toBe(false);
  });

  it('Dev → Assists has a "Safety floor" row that toggles it and applies at once', () => {
    const settings = defaultSettings();
    const applySettings = vi.fn();
    const said: string[] = [];
    const game = new Game({
      ctx: {
        assets: new AssetRegistry({ default: {} }),
        audio: NULL_AUDIO,
        assist: { ...DEFAULT_ASSIST },
        reduceFlashing: true,
      },
      getLevel,
      characters: CHARACTERS,
      settings,
      applySettings,
      announcer: { say: (t: string) => said.push(t) } as unknown as Announcer,
    });
    const menu = new AssistOptionsScene(game, () => undefined);
    const items = (menu as unknown as { items: MenuItem[] }).items;
    const row = items.find((i) => i.label === 'Safety floor') as MenuItem;
    expect(row).toBeDefined();
    expect(row.value?.()).toBe('Off');
    row.adjust?.(1);
    expect(settings.assist.safetyFloor).toBe(true);
    expect(applySettings).toHaveBeenCalledTimes(1);
    expect(row.value?.()).toBe('On');
    expect(row.hint).toBe('Pits and lava catch you');
  });
});

describe('pits: caught at the rim', () => {
  it("1-1's first pit (columns 69-70): caught on the rim floor, then walks out; without it, dies", () => {
    const run = (safetyFloor: boolean) =>
      runSim({
        level: getLevel('1-1'),
        character: MARIO,
        assist: { ...SAFE, safetyFloor },
        script: {
          steps: [
            { frame: 0, hold: [] },
            { frame: 60, hold: ['right'] },
          ],
        },
        start: { x: 69, y: 9, mode: 'stand' },
        maxFrames: 200,
        until: (w, f) => f === 59 || w.player.dead,
      });
    const caught = run(true);
    expect(caught.world.player.dead).toBe(false);
    expect(caught.world.player.body.onGround).toBe(true);
    expect(feetRow(caught.world.player)).toBe(13);
    expect(caught.world.map.get(69, 13)).toBe(0); // nothing in the map itself: the floor is the assist
    expect(run(false).world.player.dead).toBe(true);
  });

  it('a sinking lift that carries the hero through the floor: he is put back on it', () => {
    // 1-2's down lifts (column 141) wrap off the screen bottom; riding one down past the floor.
    let below = false;
    const r = runSim({
      level: getLevel('1-2'),
      character: MARIO,
      assist: SAFE,
      script: none,
      start: { x: 141, y: 2, mode: 'stand' },
      maxFrames: 400,
      controller: (w) => {
        if (toPx(w.player.body.y) > 13 * 16) below = true;
        return [];
      },
    });
    expect(below).toBe(true);
    expect(r.world.player.dead).toBe(false);
    expect(r.world.player.body.onGround).toBe(true);
    const row = r.world.safetyFloor.rowAt(toPx(r.world.player.body.x + (r.world.player.body.w >> 1)) >> 4);
    expect(row).toBe(13);
  });

  it('toggling mid-level: on mid-fall catches him, off again drops him to his death', () => {
    let world: World | null = null;
    let caught = false;
    const r = runSim({
      level: getLevel('1-1'),
      character: MARIO,
      assist: { invulnerable: true, infiniteTime: true },
      script: none,
      start: { x: 69, y: 7, mode: 'stand' },
      maxFrames: 400,
      controller: (w, f) => {
        world = w;
        // Mid-fall, still above the rim: switch it on (the same object the menu writes).
        if (f === 6) w.assist.safetyFloor = true;
        if (f === 100) {
          caught = !w.player.dead && w.player.body.onGround && feetRow(w.player) === 13;
          w.assist.safetyFloor = false;
        }
        return [];
      },
      until: (w) => w.player.dead,
    });
    expect(caught).toBe(true);
    expect(r.outcome).toBe('stopped');
    expect((world as unknown as World).player.dead).toBe(true);
  });

  it('switched on after the hero fell below the rim: he is put back on the floor, not killed', () => {
    const r = runSim({
      level: getLevel('1-1'),
      character: MARIO,
      assist: { invulnerable: true, infiniteTime: true },
      script: none,
      start: { x: 69, y: 11, mode: 'stand' },
      maxFrames: 120,
      controller: (w) => {
        if (toPx(w.player.body.y) > 13 * 16) w.assist.safetyFloor = true;
        return [];
      },
    });
    expect(r.world.player.dead).toBe(false);
    expect(feetRow(r.world.player)).toBe(13);
  });

  it('co-op: both players are caught', () => {
    const state = newGameState(MARIO, LUIGI);
    const world = new World(
      getLevel('1-1'),
      {
        assets: new AssetRegistry({ default: {} }),
        audio: NULL_AUDIO,
        assist: { ...DEFAULT_ASSIST, ...SAFE },
        reduceFlashing: true,
      },
      state,
      { x: 86, y: 8, mode: 'stand' },
    );
    expect(world.players).toHaveLength(2);
    // Player 2 starts 20 px right of player 1: both over the pit at 86-88.
    for (let i = 0; i < 120; i++) world.update([NO_INPUT, NO_INPUT]);
    for (const p of world.players) {
      expect(p.dead).toBe(false);
      expect(p.body.onGround).toBe(true);
      expect(feetRow(p)).toBe(13);
    }
    // Player 2 pushed back in from below the floor (the backstop) is put back too.
    const p2 = world.players[1] as Player;
    p2.body.y = px(250);
    p2.body.vy = 0;
    for (let i = 0; i < 5; i++) world.update([NO_INPUT, NO_INPUT]);
    expect(p2.dead).toBe(false);
    expect(feetRow(p2)).toBe(13);
  });
  it('a put-back never lands a big hero inside tiles (4-2-airship: the hull over the floor at 23-33)', () => {
    const level = getLevel('4-2-airship');
    let put = false;
    let solidHit = false;
    const r = runSim({
      level,
      character: MARIO,
      state: { powerState: 'big' },
      assist: SAFE,
      script: none,
      start: { x: 12, y: 8, mode: 'stand' },
      maxFrames: 40,
      controller: (w, f) => {
        const b = w.player.body;
        if (f === 5) {
          // Out of the level under the hull, as a lift or a late switch-on would leave him.
          b.x = px(28 * 16);
          b.y = px(250);
          b.vy = 0;
        }
        if (f > 5 && toPx(b.y) < 240) {
          put = true;
          for (let ty = toPx(b.y) >> 4; ty <= (toPx(b.y + b.h) - 1) >> 4; ty++)
            for (let tx = toPx(b.x) >> 4; tx <= (toPx(b.x + b.w) - 1) >> 4; tx++)
              if (w.map.isSolid(tx, ty)) solidHit = true;
        }
        return [];
      },
    });
    expect(toPx(r.world.player.body.h)).toBeGreaterThan(16);
    expect(r.world.player.dead).toBe(false);
    expect(put).toBe(true);
    expect(solidHit).toBe(false);
    // Put back on screen (off it, the auto-scrolling camera's edges would push him into the hull).
    expect(r.world.player.body.x).toBeGreaterThanOrEqual(r.world.camera.x);
    expect(r.world.player.body.x + r.world.player.body.w).toBeLessThanOrEqual(r.world.camera.right);
    // The floor right under the hull has no room for him.
    expect(r.world.map.isSolid(28, 12)).toBe(true);
    expect(r.world.safetyFloor.rowAt(28)).toBe(13);
  });
});

describe('lava', () => {
  it("1-4's lava pits: the rim floor above the lava (castle floor height, row 10)", () => {
    const r = runSim({
      level: getLevel('1-4'),
      character: MARIO,
      assist: SAFE,
      script: none,
      start: { x: 27, y: 6, mode: 'stand' },
      maxFrames: 120,
    });
    expect(r.world.player.dead).toBe(false);
    expect(feetRow(r.world.player)).toBe(10);
  });

  it("lava itself is solid from above: Bowser's bridge lava in 1-4 once the bridge is gone", () => {
    const r = runSim({
      level: getLevel('1-4'),
      character: MARIO,
      assist: SAFE,
      script: none,
      start: { x: 134, y: 11, mode: 'stand' },
      maxFrames: 3,
    });
    const w = r.world;
    // Cut the bridge out from under him (as Bowser's fall does) and let him drop.
    for (let x = 128; x <= 140; x++) w.map.set(x, 10, 0);
    const p = w.player;
    p.body.x = px(134 * 16);
    p.body.y = px(11 * 16) - p.body.h;
    for (let i = 0; i < 90; i++) w.update([NO_INPUT]);
    expect(p.dead).toBe(false);
    expect(w.map.get(134, 13)).toBe(w.map.get(129, 13)); // lava under him
    expect(feetRow(p)).toBeLessThanOrEqual(13);
  });
});

describe('falls that lead somewhere still lead there', () => {
  const pipeTarget = (r: ReturnType<typeof runSim>) => r.events.find((e) => e.type === 'pipe');

  it('a coin heaven (2-1-sky): falling off its clouds drops back into 2-1 at 162', () => {
    const r = runSim({
      level: getLevel('2-1-sky'),
      character: MARIO,
      assist: SAFE,
      script: none,
      start: { x: 64, y: 2, mode: 'stand' },
      maxFrames: 300,
    });
    expect(r.outcome).toBe('pipe');
    expect(pipeTarget(r)).toEqual({ type: 'pipe', target: { level: '2-1', x: 162, y: 0, exitDir: 'fall' } });
  });

  it("the campaign 7-3 bridge pit (w=15) falls into Bill's camp; a gap past its columns is caught", () => {
    const level = campaignLevel(getLevel('7-3'));
    const into = runSim({
      level,
      character: MARIO,
      assist: SAFE,
      script: none,
      start: { x: 135, y: 11, mode: 'stand' },
      maxFrames: 300,
    });
    expect(into.outcome).toBe('pipe');
    expect(pipeTarget(into)).toEqual({
      type: 'pipe',
      target: { level: '7-3-camp', x: 2, y: 0, exitDir: 'fall' },
    });
    // Columns 144-145 lie past the zone (128 + 15): a deadly gap, caught at its rim (row 12).
    const past = runSim({
      level,
      character: MARIO,
      assist: SAFE,
      script: none,
      start: { x: 144, y: 7, mode: 'stand' },
      maxFrames: 200,
    });
    expect(past.world.player.dead).toBe(false);
    expect(feetRow(past.world.player)).toBe(12);
    // Outside the campaign the zone sleeps: the same bridge pit is a deadly fall, so it is caught.
    const plain = getLevel('7-3');
    expect(
      new World(
        plain,
        {
          assets: new AssetRegistry({ default: {} }),
          audio: NULL_AUDIO,
          assist: { ...DEFAULT_ASSIST },
          reduceFlashing: true,
        },
        newGameState(MARIO),
      ).safetyFloor.rowAt(130),
    ).toBe(-1);
  });

  it("1-0's practice pit loops back into 1-0, and 5-4's dungeon hole drops into the crypt", () => {
    const loop = runSim({
      level: getLevel('1-0'),
      character: MARIO,
      assist: SAFE,
      script: none,
      start: { x: 26, y: 8, mode: 'stand' },
      maxFrames: 300,
    });
    expect(pipeTarget(loop)).toEqual({
      type: 'pipe',
      target: { level: '1-0', x: 19, y: 12, exitDir: 'fall' },
    });
    const crypt = runSim({
      level: getLevel('5-4-dungeon'),
      character: MARIO,
      assist: SAFE,
      script: none,
      start: { x: 0, y: 8, mode: 'stand' },
      maxFrames: 300,
    });
    expect(pipeTarget(crypt)).toEqual({
      type: 'pipe',
      target: { level: '5-4-crypt', x: 1, y: 0, exitDir: 'fall' },
    });
  });

  it("5-4's descent: riding the down lift on past the floor still carries him into Simon's dungeon", () => {
    // The lift's left side, clear of the fire bar at (92, 10) (as tests/sim/simon-crypt.test.ts).
    const rideLeft = (w: World): Action[] => {
      const b = w.player.body;
      const lift = w.entities.find(
        (e) => e instanceof Lift && e.kind === 'lift-down' && Math.abs(e.body.y - (b.y + b.h)) < px(4),
      );
      if (!lift || !b.onGround) return [];
      return b.x + b.w > lift.body.x + px(10) ? ['left'] : [];
    };
    const r = runSim({
      level: campaignLevel(getLevel('5-4')),
      character: MARIO,
      assist: SAFE,
      script: none,
      start: { x: 89, y: 2, mode: 'stand', time: 250 },
      maxFrames: 600,
      controller: rideLeft,
    });
    expect(r.outcome).toBe('pipe');
    expect(pipeTarget(r)).toEqual({
      type: 'pipe',
      target: { level: '5-4-dungeon', x: 13, y: 0, exitDir: 'fall' },
    });
    expect(r.world.player.dead).toBe(false);
    // Falling into the same shaft without the lift is a deadly fall: caught at the rim.
    const fall = runSim({
      level: campaignLevel(getLevel('5-4')),
      character: MARIO,
      assist: SAFE,
      script: none,
      start: { x: 86, y: 5, mode: 'stand' },
      maxFrames: 200,
      until: (w) => w.player.body.onGround && toPx(w.player.body.y) > 100,
    });
    expect(fall.world.player.dead).toBe(false);
    expect(fall.outcome).not.toBe('pipe');
  });

  it("a vine arrival from below the screen (4-2's warp zone) climbs up through the floor's row", () => {
    const run = (safetyFloor: boolean) =>
      runSim({
        level: getLevel('4-2-warp'),
        character: MARIO,
        assist: { ...SAFE, safetyFloor },
        script: none,
        maxFrames: 400,
      });
    const on = run(true);
    const off = run(false);
    expect(on.world.player.dead).toBe(false);
    expect([on.playerX, on.playerY]).toEqual([off.playerX, off.playerY]);
    expect(on.world.player.body.onGround).toBe(true);
  });

  it('a pipe still goes down (1-1 at 57)', () => {
    const r = runSim({
      level: getLevel('1-1'),
      character: MARIO,
      assist: SAFE,
      script: { steps: [{ frame: 0, hold: ['down'] }] },
      start: { x: 57, y: 8, mode: 'stand' },
      maxFrames: 200,
    });
    expect(r.outcome).toBe('pipe');
  });
});

describe('the dashed line (dev visual)', () => {
  const rects = (safetyFloor: boolean) => {
    const assets = new AssetRegistry(PALETTES);
    assets.defineAll(SPRITES);
    const w = new World(
      getLevel('1-1'),
      {
        assets,
        audio: NULL_AUDIO,
        assist: { ...DEFAULT_ASSIST, ...SAFE, safetyFloor },
        reduceFlashing: true,
      },
      newGameState(MARIO),
      { x: 62, y: 12, mode: 'stand' },
    );
    w.update([NO_INPUT]);
    const r = { world: w };
    const out: [number, number, number, number, string][] = [];
    const rec: Renderer = Object.assign(new NullRenderer(), {
      rect: (x: number, y: number, w: number, h: number, c: string) => void out.push([x, y, w, h, c]),
    });
    r.world.render(rec);
    return { out, camX: r.world.camera.pxX };
  };

  it('a faint dashed line along the rim floor, only while the assist is on', () => {
    const { out, camX } = rects(true);
    const dashes = out.filter(([, y, , h, c]) => h === 1 && y === 13 * 16 && c.startsWith('rgba'));
    expect(dashes.length).toBe(4); // two dashes in each of columns 69 and 70
    expect(dashes.every(([x]) => x + camX >= 69 * 16 && x + camX < 71 * 16)).toBe(true);
    expect(rects(false).out.filter(([, , , h, c]) => h === 1 && c.startsWith('rgba'))).toEqual([]);
  });
});

describe('the mini games built on World read the same assist', () => {
  // Dracula's Castle has no deadly pit to drop into: only its world's assist is checked.
  it("Dracula's Castle (Simon): its world's assist is the game's (no pits to catch)", () => {
    const h = castleHarness();
    expect(h.world.assist).toBe(h.game.ctx.assist);
    expect(drops(h.world.level).filter((d) => d.kind === 'pit')).toEqual([]);
  });

  const games = {
    'Shadow Duel (Ryu)': () => duelHarness({ skipCutscene: true }),
    'Zebes Escape (Samus)': () => escapeHarness(),
    'Station Escape (Mega Man)': () => {
      // Past READY and the beam down (0.4.12): he moves from then on.
      const h = stationHarness();
      for (let i = 0; i < 400 && (h.scene.phase === 'ready' || h.world.beaming); i++) h.step();
      return h;
    },
  };
  for (const [name, make] of Object.entries(games)) {
    it(`${name}: its world's assist is the game's, and its pits catch with the assist on`, () => {
      const h = make();
      expect(h.world.assist).toBe(h.game.ctx.assist);
      const spots = drops(h.world.level).filter((d) => d.kind === 'pit');
      expect(spots.length, name).toBeGreaterThan(0);
      for (const d of spots) {
        for (const safetyFloor of [true, false]) {
          const g = make();
          Object.assign(g.game.ctx.assist, SAFE, { safetyFloor });
          g.step([], 2);
          const p = g.world.player;
          p.body.x = px(d.x * 16) + ((px(16) - p.body.w) >> 1);
          p.body.y = px((d.y + 1) * 16) - p.body.h;
          p.body.vx = 0;
          p.body.vy = 0;
          g.world.camera.snapTo(p.body.x, p.body.y);
          let landed = false;
          for (let i = 0; i < 240 && !p.dead && !landed; i++) {
            g.step();
            landed = p.body.onGround && feetRow(p) >= d.y + 1;
          }
          if (safetyFloor) {
            expect(p.dead, `${name} pit@${d.x}`).toBe(false);
            expect(feetRow(p), `${name} pit@${d.x}`).toBeLessThanOrEqual(d.land);
          } else expect(p.dead || toPx(p.body.y) > 200, `${name} pit@${d.x} off`).toBe(true);
        }
      }
    });
  }
});
