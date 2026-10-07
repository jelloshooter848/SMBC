import { describe, expect, it } from 'vitest';
import { RESTYLES_SEEN } from './story-seen';
import { getLevel } from '@content/levels';
import { runSim } from '@game/sim/headless';
import { CHARACTERS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { LUIGI } from '@game/characters/luigi';
import { campaignLevel } from '@game/level/campaign';
import { LevelScene } from '@game/scenes/level';
import type { MenuScene } from '@game/scenes/menu';
import { Vine } from '@game/entities/objects/vine';
import { AnchorDrop, ANCHOR_SAID, ANCHOR_SHAKE_FRAMES } from '@game/entities/objects/anchor-drop';
import { px, toPx } from '@engine/math/units';
import type { World } from '@game/world/world';
import type { Action } from '@engine/input/actions';
import type { Zone } from '@game/level/schema';
import { T } from '@game/level/tiles';
import {
  ANCHOR_COL,
  dropInAndClimb,
  draw,
  file,
  makeGame,
  ROOM_GAP,
  useStorage,
  type H,
} from './heroes-harness';

// 4-2's anchor chain (owner decisions 8:25 PM PDT and later, docs/HEROES.md "Larry Koopa and the
// crystal ball"): in campaign play the hidden right zone first looks like the classic warp zone
// (WELCOME TO WARP ZONE!, the pipe and its 5) but the pipe is dead. Once the hero has dropped in
// and stands on the floor, Larry's anchor crashes down from above the screen, smashes the pipe and
// leaves its chain, which climbs to Larry's airship (`4-2-airship`), arriving up a chain at the
// bow: the chain at column 2, the hero stepping off onto the deck in column 3. After Larry is
// beaten the room is sealed (no pipe, the ceiling gap closed): nobody can drop in.

useStorage();

const camp = (secrets: string[] = []) => campaignLevel(getLevel('4-2'), undefined, secrets);
/** The chain's column and foot row (the pipe stands at 214-215, rows 10-12; the floor is row 13). */
const CHAIN = { x: ANCHOR_COL, y: 12 };
const ARRIVAL = { level: '4-2-airship', x: 2, y: 3 };
const ARRIVAL_AT = { x: ARRIVAL.x, y: ARRIVAL.y };
const none = { steps: [{ frame: 0, hold: [] as Action[] }] };
const tileAt = (w: World, x: number, y: number) => w.map.get(x, y);
const pipeTiles = (w: World) => [10, 11, 12].flatMap((y) => [tileAt(w, 214, y), tileAt(w, 215, y)]);
const PIPE = [T.PIPE_TL, T.PIPE_TR, T.PIPE_BL, T.PIPE_BR, T.PIPE_BL, T.PIPE_BR];
const drop = (w: World) => w.entities.find((e): e is AnchorDrop => e instanceof AnchorDrop);
const chainOf = (w: World) => w.entities.find((e): e is Vine => e instanceof Vine && e.tx === ANCHOR_COL);

/** The hero's body overlaps no solid tile. */
function clear(w: World): boolean {
  const b = w.player.body;
  for (let ty = toPx(b.y) >> 4; ty <= (toPx(b.y + b.h) - 1) >> 4; ty++)
    for (let tx = toPx(b.x) >> 4; tx <= (toPx(b.x + b.w) - 1) >> 4; tx++)
      if (w.map.isSolid(tx, ty)) return false;
  return true;
}

/** Up to the chain once it stands (walking over from the floor), then up it. */
function toChain(w: World): Action[] {
  const p = w.player;
  const c = chainOf(w);
  if (!c) return [];
  if (p.vine) return ['up'];
  if (p.centerX > c.centerX + px(4)) return ['left', 'up'];
  if (p.centerX < c.centerX - px(4)) return ['right', 'up'];
  return ['up'];
}

describe('the campaign variant of 4-2', () => {
  it('looks like the classic warp zone: the pipe with its 5 and the text, but no pipe zone', () => {
    const l = camp();
    const at = (x: number, y: number) => l.tiles[y * l.width + x];
    expect([10, 11, 12].flatMap((y) => [at(214, y), at(215, y)])).toEqual(PIPE);
    expect(l.zones.filter((z) => z.kind === 'pipe' && z.x >= 208)).toEqual([]);
    const warp = l.zones.find((z): z is Zone & { kind: 'warp' } => z.kind === 'warp');
    expect(warp).toMatchObject({ worlds: [5], text: 'WELCOME TO WARP ZONE!', labelAt: [{ x: 214, y: 10 }] });
    // The ceiling is whole; no chain and no anchor yet, only the drop waiting for the hero.
    expect(at(214, 2)).not.toBe(T.AIR);
    expect(l.entities.some((e) => e.type === 'chain')).toBe(false);
    expect(l.decor.some((d) => d.kind === 'smb3:anchor')).toBe(false);
    expect(l.entities.filter((e) => e.type === 'anchor-drop')).toEqual([
      { type: 'anchor-drop', x: 214, y: 12, props: { len: 14, pipe: 10, holes: '2', room: '208,224' } },
    ]);
    expect(l.zones).toContainEqual({ kind: 'vine', ...CHAIN, target: ARRIVAL });
  });

  it('before the hero lands: classic look, the pipe cannot be entered, no chain', () => {
    // Standing on the pipe and pressing down does nothing (it never warps to World 5).
    const r = runSim({
      level: camp(),
      character: MARIO,
      script: none,
      start: { x: 214, y: 9, mode: 'stand', time: 300 },
      maxFrames: 120,
      controller: () => ['down'],
    });
    expect(r.outcome).toBe('timeout');
    expect(r.events.some((e) => e.type === 'pipe')).toBe(false);
    expect(pipeTiles(r.world)).toEqual(PIPE);
    expect(drop(r.world)?.phase).toBe('wait');
    expect(chainOf(r.world)).toBeUndefined();
    // In the game, the world number and the welcome text are drawn over the room.
    const h = makeGame();
    const main = in42(h);
    // Walking along the ceiling over the room (columns 200 to 210).
    main.world.player.body.y = px(32) - main.world.player.body.h;
    for (let f = 0; f < 400 && toPx(main.world.player.centerX) < 210 * 16; f++) h.step(['right']);
    const texts = draw(main).texts.map((t) => t.str);
    expect(texts).toContain('5');
    expect(texts).toContain('WELCOME TO WARP ZONE!');
    // Once the anchor has smashed the pipe the number and the text are gone.
    dropInAndClimb(h, main, 0);
    for (let f = 0; f < 300 && drop(main.world)?.phase !== 'rest'; f++) h.step(f < 20 ? ['right'] : []);
    const after = draw(main).texts.map((t) => t.str);
    expect(after).not.toContain('5');
    expect(after).not.toContain('WELCOME TO WARP ZONE!');
  });

  it('after the hero lands on the floor: the anchor falls, smashes the pipe, leaves a climbable chain', () => {
    let landed = -1;
    let resting = -1;
    const r = runSim({
      level: camp(),
      character: MARIO,
      script: none,
      start: { x: ROOM_GAP, y: 1, mode: 'stand', time: 300 },
      maxFrames: 400,
      controller: (w, f) => {
        if (landed < 0 && w.player.body.onGround && toPx(w.player.body.y + w.player.body.h) === 13 * 16)
          landed = f;
        if (resting < 0 && drop(w)?.phase === 'rest') resting = f;
        if (landed < 0) return f < 8 ? ['right'] : [];
        // Before the crash the anchor waits: nothing has changed yet.
        if (f === landed) expect(pipeTiles(w)).toEqual(PIPE);
        return toChain(w);
      },
    });
    expect(landed).toBeGreaterThan(0);
    // About a second from the landing to the anchor at rest.
    expect(resting - landed).toBeGreaterThan(30);
    expect(resting - landed).toBeLessThan(90);
    expect(r.events).toContainEqual({ type: 'anchor' });
    expect(r.outcome).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toMatchObject({
      target: { ...ARRIVAL, exitDir: 'climb', chain: true },
    });
    const w = r.world;
    expect(pipeTiles(w)).toEqual(Array(6).fill(T.AIR));
    expect(tileAt(w, 214, 2)).toBe(T.AIR); // the ceiling brick it broke on the way
    const v = chainOf(w) as Vine;
    expect(v.art).toBe('chain');
    expect(v.topPx).toBe(-16);
    expect(v.basePx).toBe(13 * 16);
  });

  it('the anchor and the debris never hurt anyone: standing right under it', () => {
    const r = runSim({
      level: camp(),
      character: MARIO,
      state: { powerState: 'big' },
      script: none,
      start: { x: 213, y: 12, mode: 'stand', time: 300 },
      maxFrames: 200,
      until: (w) => drop(w)?.phase === 'rest' && !w.entities.some((e) => e.kind === 'brick-piece' && e.alive),
    });
    expect(r.outcome).toBe('stopped');
    expect(r.world.player.dead).toBe(false);
    expect(r.world.player.powerState).toBe('big');
    expect(r.events.some((e) => e.type === 'died')).toBe(false);
    // Nothing solid is left where the pipe stood: he walks right through.
    const walk = runSim({
      level: camp(),
      character: MARIO,
      script: none,
      start: { x: 212, y: 12, mode: 'stand', time: 300 },
      maxFrames: 400,
      controller: (w) => (drop(w)?.phase === 'rest' ? ['right'] : []),
      until: (w) => toPx(w.player.centerX) >> 4 >= 217,
    });
    expect(walk.outcome).toBe('stopped');
  });

  it('a restart after the smash shows the whole pipe again and a waiting drop', () => {
    const smashed = runSim({
      level: camp(),
      character: MARIO,
      script: none,
      start: { x: 212, y: 12, mode: 'stand', time: 300 },
      maxFrames: 300,
      until: (w) => drop(w)?.phase === 'rest',
    });
    expect(smashed.outcome).toBe('stopped');
    expect(pipeTiles(smashed.world)).toEqual(Array(6).fill(T.AIR));
    // The level data is untouched (each world copies its tiles), and a new visit starts over.
    const l = camp();
    const at = (x: number, y: number) => l.tiles[y * l.width + x];
    expect([10, 11, 12].flatMap((y) => [at(214, y), at(215, y)])).toEqual(PIPE);
    const again = runSim({
      level: camp(),
      character: MARIO,
      script: none,
      start: { x: 200, y: 1, mode: 'stand', time: 300 },
      maxFrames: 400,
      controller: () => ['right'],
      until: (w) => toPx(w.player.centerX) >> 4 >= 212,
    });
    expect(again.outcome).toBe('stopped');
    expect(pipeTiles(again.world)).toEqual(PIPE);
    expect(drop(again.world)?.phase).toBe('wait');
    expect(chainOf(again.world)).toBeUndefined();
  });

  it('co-op: player two on the ceiling over the anchor when it breaks through: nobody dies, the chain climbs', () => {
    let p2Fell = false;
    const r = runSim({
      level: camp(),
      character: MARIO,
      state: { character2: LUIGI, powerState2: 'small', hp2: 1 },
      script: none,
      start: { x: 213, y: 12, mode: 'stand', time: 300 },
      maxFrames: 1500,
      controller: (w, f) => {
        const p2 = w.players[1]!;
        // Player two waits on the ceiling, right over the anchor's column.
        if (f === 1) {
          p2.body.x = px(ANCHOR_COL * 16 + 2);
          p2.body.y = px(2 * 16) - p2.body.h;
          p2.body.vy = 0;
        }
        if (toPx(p2.body.y) > 3 * 16) p2Fell = true;
        return drop(w)?.phase === 'rest' && f > 120 ? toChain(w) : [];
      },
    });
    const [p1, p2] = r.world.players;
    expect(p1!.dead || p2!.dead).toBe(false);
    expect(r.events.some((e) => e.type === 'died')).toBe(false);
    // The brick under him broke: he dropped into the room (onto the anchor's spot) unharmed.
    expect(p2Fell).toBe(true);
    expect(r.outcome).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toMatchObject({ target: { ...ARRIVAL, chain: true } });
  });

  it.each(CHARACTERS.map((c) => [c.name, c] as const))(
    '%s drops in, climbs the chain into the airship and lands on the deck right of it',
    (_name, c) => {
      const up = runSim({
        level: camp(),
        character: c,
        script: none,
        start: { x: ROOM_GAP, y: 1, mode: 'stand', time: 300 },
        maxFrames: 1200,
        controller: (w, f) => (chainOf(w) ? toChain(w) : f < 8 ? ['right'] : []),
      });
      expect(up.outcome, c.name).toBe('pipe');
      expect(up.events.find((e) => e.type === 'pipe')).toMatchObject({
        target: { ...ARRIVAL, exitDir: 'climb', chain: true },
      });
      // The arrival: the chain rises from the screen bottom at column 2; the hero climbs it and
      // steps off to the right, onto the ground in column 3.
      const deck = runSim({
        level: getLevel('4-2-airship'),
        character: c,
        script: none,
        start: { ...ARRIVAL, mode: 'climb', chain: true, time: 300 },
        maxFrames: 900,
        controller: () => [],
        until: (w, f) => f > 10 && !w.arriving && w.player.body.onGround,
      });
      expect(deck.outcome, c.name).toBe('stopped');
      const w = deck.world;
      const arrival = w.entities.find((e): e is Vine => e instanceof Vine && e.tx === ARRIVAL.x);
      expect(arrival?.art).toBe('chain');
      expect(toPx(w.player.centerX) >> 4).toBe(ARRIVAL.x + 1);
      expect(clear(w), `${c.name} stands clear of the tiles`).toBe(true);
      const feet = w.player.body.y + w.player.body.h;
      expect(w.map.isSolid(ARRIVAL.x + 1, toPx(feet) >> 4)).toBe(true);
      expect(feet % px(16)).toBe(0);
    },
  );
});

/** A campaign game on 4-2 (file 1 on World 4), with the hero placed by the caller. */
function in42(h: H, secrets: string[] = []): LevelScene {
  file({
    story: [...RESTYLES_SEEN],
    cleared: ['1-0', '4-1'],
    pages: ['smb-1', 'smb-4'],
    position: { page: 'smb-4', node: '4-2' },
    secrets,
  });
  h.game.openFile(1);
  h.idle(8);
  h.game.startLevel(getLevel('4-2'), { mode: 'stand', x: 200, y: 1, time: 300 });
  h.step();
  const main = h.top() as LevelScene;
  expect(main.level.id).toBe('4-2');
  return main;
}

describe('the drop in the game', () => {
  it('shakes the screen briefly, never with reduce flashing; the announcer says it', () => {
    const shakes = (reduce: boolean) => {
      const h = makeGame();
      (h.game.deps.ctx as { reduceFlashing: boolean }).reduceFlashing = reduce;
      const main = in42(h);
      const w = main.world;
      w.player.body.x = px(ROOM_GAP * 16 - 14);
      w.player.body.y = px(32) - w.player.body.h;
      let n = 0;
      for (let f = 0; f < 300 && drop(w)?.phase !== 'rest'; f++) {
        h.step(f < 20 ? ['right'] : []);
        if (w.shakeY !== 0) n++;
      }
      for (let f = 0; f < ANCHOR_SHAKE_FRAMES + 2; f++) {
        h.step();
        if (w.shakeY !== 0) n++;
      }
      // The line says the chain is there to climb, naming the ability.
      expect(h.said).toContain(`${ANCHOR_SAID} Climb its chain: UP.`);
      return n;
    };
    expect(shakes(true)).toBe(0);
    expect(shakes(false)).toBeGreaterThan(0);
  });

  it('the whole way: drop in, up the chain, the airship run; a retry climbs it again', () => {
    const h = makeGame();
    const main = in42(h);
    dropInAndClimb(h, main);
    const ship = h.top() as LevelScene;
    expect(ship).toBeInstanceOf(LevelScene);
    expect(ship.level.id).toBe('4-2-airship');
    // The airship run starts on boarding (the clock held), its retry point the chain arrival.
    expect(h.game.airship).not.toBeNull();
    expect(h.game.airship?.retryAt.start).toEqual({ ...ARRIVAL_AT, mode: 'climb', chain: true });
    expect(ship.world.time).toBeNull();
    // The auto-scroll waits while the hero is still on the arrival chain.
    h.until(() => !ship.world.arriving && ship.world.player.body.onGround, 900);
    expect(ship.world.camera.x).toBeLessThan(px(16));
    expect(Math.floor(toPx(ship.world.player.centerX) / 16)).toBe(ARRIVAL.x + 1);
    expect(h.game.mapProgress.secrets).not.toContain('larry');
    expect(() => draw(ship)).not.toThrow();
    // A death aboard: TRY AGAIN? YES climbs the chain again.
    ship.world.kill(ship.world.player);
    h.until(() => h.top() !== ship, 400);
    expect((h.top() as MenuScene).title).toBe('TRY AGAIN?');
    h.idle(8);
    h.tap('jump');
    const again = h.top() as LevelScene;
    expect(again).toBeInstanceOf(LevelScene);
    expect(again).not.toBe(ship);
    expect(again.level.id).toBe('4-2-airship');
    expect(again.world.arriving).toBe(true);
    const chain = again.world.entities.find((e): e is Vine => e instanceof Vine && e.tx === ARRIVAL.x);
    expect(chain?.art).toBe('chain');
    h.until(() => !again.world.arriving && again.world.player.body.onGround, 900);
    expect(Math.floor(toPx(again.world.player.centerX) / 16)).toBe(ARRIVAL.x + 1);
  });
});

describe('after Larry is beaten (the airship crashed on the map)', () => {
  it('the room is sealed: no pipe, the ceiling gap closed; no anchor, no chain, no warp, no text', () => {
    const base = getLevel('4-2');
    const l = camp(['larry']);
    const at = (x: number, y: number) => l.tiles[y * l.width + x];
    for (const y of [10, 11, 12]) expect([at(214, y), at(215, y)]).toEqual([T.AIR, T.AIR]);
    // The gap the room is entered by (220-221 on row 2) is closed with the ceiling's own brick.
    expect(base.tiles[2 * base.width + ROOM_GAP]).toBe(T.AIR);
    const brick = base.tiles[2 * base.width + 214];
    for (let x = 208; x < 224; x++) expect(at(x, 2), `column ${x}`).toBe(brick);
    // Its left wall rises to the top of the screen, and the camera stops there.
    expect([at(208, 0), at(208, 1)]).toEqual([brick, brick]);
    expect(l.zones).toContainEqual({ kind: 'scrollStop', x: 208 });
    expect(camp().zones.some((z) => z.kind === 'scrollStop')).toBe(false);
    expect(l.zones.filter((z) => (z.kind === 'pipe' || z.kind === 'vine') && z.x >= 208)).toEqual([]);
    expect(l.entities.some((e) => e.type === 'anchor-drop' || e.type === 'chain')).toBe(false);
    const warp = l.zones.find((z): z is Zone & { kind: 'warp' } => z.kind === 'warp');
    expect(warp?.worlds).toEqual([]);
    expect(warp?.text).toBeUndefined();
    expect(warp?.labelAt).toBeUndefined();
    // Cached on its own: not the variant before Larry.
    expect(camp(['larry'])).toBe(l);
    expect(camp()).not.toBe(l);
  });

  it.each(CHARACTERS.map((c) => [c.name, c] as const))(
    '%s walking the ceiling over it cannot fall in and is not stuck',
    (_name, c) => {
      // Right along the ceiling as far as it goes (the wall at the screen's edge), then back left.
      let deepest = 0;
      let furthest = 0;
      const r = runSim({
        level: camp(['larry']),
        character: c,
        state: { secrets: ['larry'] } as never,
        script: none,
        start: { x: 200, y: 1, mode: 'stand', time: 300 },
        maxFrames: 900,
        controller: (w, f) => {
          deepest = Math.max(deepest, toPx(w.player.body.y + w.player.body.h));
          furthest = Math.max(furthest, toPx(w.player.body.x + w.player.body.w));
          return f < 300 ? ['right'] : ['left'];
        },
        until: (w, f) => f > 300 && toPx(w.player.centerX) >> 4 <= 200,
      });
      expect(r.outcome, c.name).toBe('stopped');
      expect(deepest, `${c.name} stayed on the ceiling`).toBeLessThanOrEqual(2 * 16);
      expect(furthest, `${c.name} stopped at the wall`).toBeLessThanOrEqual(208 * 16);
      expect(r.world.player.dead).toBe(false);
    },
  );

  it('in the game: walking over the room brings no anchor and nothing to say', () => {
    const h = makeGame();
    const main = in42(h, ['larry']);
    const w = main.world;
    for (let f = 0; f < 200; f++) h.step(['right']);
    expect(toPx(w.player.body.y + w.player.body.h)).toBe(2 * 16);
    expect(drop(w)).toBeUndefined();
    expect(chainOf(w)).toBeUndefined();
    expect(h.said.some((t) => t.startsWith(ANCHOR_SAID))).toBe(false);
    expect(h.top()).toBe(main);
  });
});

describe('outside the campaign', () => {
  it('4-2 keeps the classic warp zone: the pipe to 5-1, no anchor, no chain', () => {
    const l = getLevel('4-2');
    expect(l.entities.some((e) => e.type === 'chain' || e.type === 'anchor-drop')).toBe(false);
    expect(l.decor.some((d) => d.kind === 'smb3:anchor')).toBe(false);
    expect(l.zones).toContainEqual({
      kind: 'pipe',
      x: 214,
      y: 10,
      dir: 'down',
      target: { level: '5-1', x: 2, y: 12 },
    });
  });
});
