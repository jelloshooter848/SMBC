import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { PALETTES, SPRITES } from '@content/sprites';
import { AssetRegistry } from '@engine/assets/registry';
import { runSim } from '@game/sim/headless';
import { CHARACTERS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { carryTime, LevelScene } from '@game/scenes/level';
import { WorldMapScene } from '@game/scenes/world-map';
import { autoPlayer, newBot } from '@game/sim/bot';
import { campaignLevel } from '@game/level/campaign';
import { T } from '@game/level/tiles';
import { px, toPx } from '@engine/math/units';
import type { World } from '@game/world/world';
import type { Action } from '@engine/input/actions';
import type { Zone } from '@game/level/schema';
import type { Captive } from '@game/entities/objects/captive';
import { captiveDialogue, CARD_COLS } from '@game/scenes/free-hero';
import { fontText } from '@game/hud/text';
import type { MiniGameDef } from '@game/minigames';
import { captives, draw, file, makeGame, useStorage, type H } from './heroes-harness';

// Samus's cavern (owner design, 0.5.0): in campaign play the 4-2 vine area's warp zone shows one
// pipe, which leads down into 4-2-cavern, a short Metroid-flavoured cavern (blue rock, bubble
// doors, a Chozo statue's chamber) where captive Samus waits on the dais. A side pipe at its end
// brings the player up out of the 4-2 pipe at column 72, the first pipe past the vine block, with
// the clock running on.

useStorage();

const none = { steps: [{ frame: 0, hold: [] as Action[] }] };
const cavern = () => getLevel('4-2-cavern');
const TO_4_2 = { level: '4-2', x: 72, y: 9, exitDir: 'up' };
/** Samus stands on the dais (rows 12, columns 36-44), feet in row 11. */
const SAMUS = { x: 41, y: 11 };

const feetRow = (w: World) => toPx(w.player.body.y + w.player.body.h) / 16;
const centerCol = (w: World) => toPx(w.player.centerX) / 16;
const pipes = (zones: Zone[]) => zones.filter((z): z is Zone & { kind: 'pipe' } => z.kind === 'pipe');

describe('4-2-cavern: the level', () => {
  it('is an area of 4-2 that keeps the clock, falling in from the top', () => {
    const l = cavern();
    expect(l.parent).toBe('4-2');
    expect(l.time).toBeNull();
    expect([l.world, l.stage]).toEqual([4, 2]);
    expect(l.startMode).toBe('fall');
    expect(l.start).toEqual({ x: 2, y: 0 });
    expect(l.theme).toBe('cavern');
    expect(l.music).toBe('cavern');
  });

  it('landmarks: two bubble doors, the Chozo statue on the dais, Samus beside it', () => {
    const l = cavern();
    expect(l.entities).toContainEqual({ type: 'captive', x: SAMUS.x, y: SAMUS.y, props: { hero: 'samus' } });
    expect(l.decor).toContainEqual({ kind: 'zebes:chozo-0', x: 37, y: 11 });
    expect(l.decor.filter((d) => d.kind === 'zebes:bubble-door')).toEqual([
      { kind: 'zebes:bubble-door', x: 14, y: 12 },
      { kind: 'zebes:bubble-door', x: 48, y: 12 },
    ]);
    // Each bubble door hangs in a three-tile doorway in a rock wall.
    for (const x of [14, 48]) {
      for (const y of [10, 11, 12]) expect(l.tiles[y * l.width + x], `door ${x},${y}`).toBe(T.AIR);
      expect(l.tiles[9 * l.width + x], `wall over door ${x}`).toBe(T.GROUND);
    }
    // The dais: solid under Samus and the statue, open where they stand.
    for (const x of [37, 38, 41]) {
      expect(l.tiles[12 * l.width + x]).toBe(T.GROUND);
      expect(l.tiles[11 * l.width + x]).toBe(T.AIR);
    }
  });

  it("the zebes decor draws: the 32x32 statue and the 16x48 bubble doors are the sheet's frames", () => {
    const assets = new AssetRegistry(PALETTES);
    assets.defineAll(SPRITES);
    const zebes = assets.sheet('zebes');
    for (const d of cavern().decor.filter((x) => x.kind.startsWith('zebes:')))
      expect(zebes.frames.get(d.kind.slice('zebes:'.length)), d.kind).toBeDefined();
    expect(zebes.frames.get('chozo-0')).toMatchObject({ w: 32, h: 32 });
    expect(zebes.frames.get('bubble-door')).toMatchObject({ w: 16, h: 48 });
  });

  it('its one way out is the side pipe at the end, up out of the 4-2 pipe at 72', () => {
    const l = cavern();
    expect(pipes(l.zones)).toEqual([{ kind: 'pipe', x: 61, y: 12, dir: 'right', target: TO_4_2 }]);
    expect(l.zones.filter((z) => z.kind === 'pit' || z.kind === 'vine' || z.kind === 'teleport')).toEqual([]);
    // 4-2's pipe at 72 has its mouth on row 10, just past the vine block at (64, 5).
    const main = getLevel('4-2');
    expect(main.tiles[10 * main.width + 72]).toBe(T.PIPE_TL);
    expect(main.tiles[9 * main.width + 72]).toBe(T.AIR);
    expect(main.zones.find((z) => z.kind === 'vine')).toMatchObject({ x: 64, y: 5 });
    expect(main.zones.find((z) => z.kind === 'checkpoint')).toMatchObject({ x: 98 }); // not skipped
  });

  it('the clock carries over: 4-2 → vine area → cavern → back into 4-2', () => {
    const vine = getLevel('4-2-warp');
    const main = getLevel('4-2');
    expect(carryTime(main, vine, 300)).toBe(300);
    expect(carryTime(vine, cavern(), 280)).toBe(280);
    expect(carryTime(cavern(), main, 260)).toBe(260);
  });
});

describe('4-2-cavern: every hero gets through', () => {
  it.each(CHARACTERS.map((c) => [c.name, c] as const))(
    '%s falls in and crosses the cavern to the pipe back to 4-2; it can walk up to Samus on the dais',
    (_name, c) => {
      const bot = newBot();
      const r = runSim({
        level: cavern(),
        character: c,
        script: none,
        start: { time: 300 },
        maxFrames: 3000,
        controller: (w) => (w.player.frozen ? [] : autoPlayer(w, bot)),
      });
      // Up the dais step from the chamber floor and along to Samus (talking range: 24 px).
      const dais = runSim({
        level: cavern(),
        character: c,
        script: none,
        start: { x: 33, y: 12, mode: 'stand' },
        maxFrames: 600,
        controller: (w, f) => {
          if (f < 5) return [];
          if (feetRow(w) === 12 && centerCol(w) >= SAMUS.x - 0.5) return [];
          // A fresh jump press every 20 frames while at the foot of the step, held through the hop.
          const b = w.player.body;
          if (!b.onGround && centerCol(w) > 34.5 && centerCol(w) < 37 && feetRow(w) > 11.5)
            return ['right', 'jump']; // a short hop: the step is one tile
          if (b.onGround && feetRow(w) === 13 && centerCol(w) > 34.5)
            return f % 20 < 14 ? ['right', 'jump'] : ['right'];
          return ['right'];
        },
        until: (w, f) =>
          f > 30 &&
          w.player.body.onGround &&
          feetRow(w) === 12 &&
          Math.abs(centerCol(w) - (SAMUS.x + 0.5)) < 1.5,
      });
      expect(dais.outcome, `${c.name} stood beside Samus`).toBe('stopped');
      expect(r.outcome, c.name).toBe('pipe');
      expect(r.events.find((e) => e.type === 'pipe')).toMatchObject({ target: TO_4_2 });
      expect(r.world.time).toBeLessThanOrEqual(300);
      expect(r.world.time).toBeGreaterThan(200);
    },
  );

  it('back in 4-2 the hero rises out of the pipe at 72 and stands on it', () => {
    const r = runSim({
      level: getLevel('4-2'),
      character: MARIO,
      script: none,
      start: { x: 72, y: 9, mode: 'pipe-exit', time: 250 },
      maxFrames: 200,
    });
    expect(r.outcome).toBe('timeout');
    const w = r.world;
    expect(w.player.body.onGround).toBe(true);
    expect(feetRow(w)).toBe(10);
    expect(Math.floor(toPx(w.player.body.x) / 16)).toBe(72);
    expect(w.time).toBeLessThanOrEqual(250);
  });
});

/** File 1 open (World 4 reached), then into the cavern as from the vine area's pipe. */
function intoCavern(h: H, time = 300): LevelScene {
  h.game.openFile(1);
  expect(h.top()).toBeInstanceOf(WorldMapScene);
  h.game.startLevel(cavern(), { mode: 'fall', x: 2, y: 0, time });
  h.step();
  expect(h.top()).toBeInstanceOf(LevelScene);
  return h.top() as LevelScene;
}

/** Put player 1 on the dais at column `col` and let the screen catch up. */
function onDais(h: H, l: LevelScene, col: number): void {
  const p = l.world.player;
  h.until(() => p.body.onGround, 300);
  for (const x of [8, 16, 24, 32, col]) {
    p.body.x = px(x * 16);
    p.body.y = px((x >= 36 ? 12 : 13) * 16) - p.body.h;
    h.idle(20);
  }
}

describe('the whole way in campaign play: vine area → cavern → 4-2', () => {
  it('the one pipe leads down into the cavern and the exit pipe up into 4-2 at 72, clock running', () => {
    const h = makeGame();
    file({ cleared: ['1-0', '4-1'], pages: ['smb-1', 'smb-4'], position: { page: 'smb-4', node: '4-2' } });
    h.game.openFile(1);
    h.game.startLevel(getLevel('4-2-warp'), { mode: 'stand', x: 54, y: 9, time: 300 });
    h.step();
    let l = h.top() as LevelScene;
    expect(l.level.id).toBe('4-2-warp');
    expect(pipes(l.level.zones)).toHaveLength(1);
    for (let f = 0; f < 300 && (h.top() as LevelScene).level?.id !== '4-2-cavern'; f++) h.step(['down']);
    expect((h.top() as LevelScene).level.id).toBe('4-2-cavern');
    // A pipe into an area of the same level: no map, no secret recorded, no clear.
    expect(h.game.mapProgress.secrets).toEqual([]);
    expect(h.game.mapProgress.cleared).not.toContain('4-2');
    l = h.top() as LevelScene;
    const arrived = l.world.time as number;
    expect(arrived).toBeLessThanOrEqual(300);
    expect(arrived).toBeGreaterThan(280);
    const bot = newBot();
    for (let f = 0; f < 3000 && (h.top() as LevelScene).level?.id === '4-2-cavern'; f++)
      h.step(l.world.player.frozen ? [] : autoPlayer(l.world, bot));
    const main = h.top() as LevelScene;
    expect(main).toBeInstanceOf(LevelScene);
    expect(main.level.id).toBe('4-2');
    expect(Math.floor(toPx(main.world.player.body.x) / 16)).toBe(72);
    expect(main.world.time).toBeLessThanOrEqual(arrived);
    expect(main.world.time).toBeGreaterThan(arrived - 60);
    expect(h.game.mapProgress.secrets).toEqual([]);
  });

  it('the 4-2 warp pipe (the right zone) is not a secret exit either: no secret on its pipe', () => {
    const l = campaignLevel(getLevel('4-2'), () => true);
    const p = pipes(l.zones).find((z) => z.x === 214);
    expect(p?.target).toEqual({ level: '4-2-airship', x: 2, y: 6, exitDir: 'fall' });
  });
});

describe('captive Samus in the cavern', () => {
  it('stands on the dais beside the Chozo statue; walking over shows TALK', () => {
    const h = makeGame();
    file();
    const l = intoCavern(h);
    onDais(h, l, 37);
    const cs = captives(l);
    expect(cs).toHaveLength(1);
    const c = cs[0] as Captive;
    expect(c.hero.id).toBe('samus');
    expect(toPx(c.body.y + c.body.h)).toBe(12 * 16);
    expect(toPx(c.body.x + (c.body.w >> 1)) >> 4).toBe(SAMUS.x);
    for (let i = 0; i < 120 && !c.prompt; i++) h.step(['right']);
    expect(c.prompt).toBe(true);
    expect(draw(l).texts.some((t) => t.str === 'TALK')).toBe(true);
    expect(h.said.some((t) => /^Samus\. Up to talk\.$/.test(t))).toBe(true);
  });

  it('is there only in campaign play, and only until Samus is freed', () => {
    const h0 = makeGame();
    file();
    const l0 = intoCavern(h0);
    onDais(h0, l0, 37);
    expect(captives(l0)).toHaveLength(1);
    const h = makeGame();
    file({ freed: ['mario', 'samus'] });
    const l = intoCavern(h);
    onDais(h, l, 37);
    expect(captives(l)).toHaveLength(0);
    const h2 = makeGame();
    h2.game.devStart('4-2-cavern', MARIO, 'small');
    h2.until(() => h2.top() instanceof LevelScene);
    const l2 = h2.top() as LevelScene;
    onDais(h2, l2, 37);
    expect(captives(l2)).toHaveLength(0);
  });
});

describe("Samus's words before the round", () => {
  const def: MiniGameDef = {
    hero: 'samus',
    title: 'ZEBES ESCAPE',
    rules: [],
    create: () => ({ update() {}, render() {} }),
  };
  const samus = CHARACTERS.find((c) => c.id === 'samus')!;

  it('the brainwashing is a parasite feeding like a Metroid; she names whoever came to talk', () => {
    for (const talker of CHARACTERS) {
      const pages = captiveDialogue(samus, def, talker);
      for (const page of pages)
        for (const line of page) expect(line.length, `${talker.id}: ${line}`).toBeLessThanOrEqual(CARD_COLS);
      const own = (pages[1] ?? []).join(' ');
      expect(own).toContain('PARASITE');
      expect(own).toContain('METROID');
      expect(own).toContain(`${fontText(talker.name)}...`);
      expect(own).not.toContain('NO ONE PASSES HERE.');
      expect(pages[0]?.join(' ')).toContain('SAMUS SERVES');
    }
  });
});
