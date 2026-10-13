import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { px, toPx } from '@engine/math/units';
import type { Action } from '@engine/input/actions';
import { CHARACTERS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import type { CharacterDef } from '@game/characters/character';
import { DEFAULT_ASSIST, newGameState } from '@game/context';
import { campaignLevel } from '@game/level/campaign';
import { T } from '@game/level/tiles';
import { ScriptedInput } from '@game/sim/headless';
import { World, levelSeed, type WorldEvent } from '@game/world/world';
import {
  KEY_RISE_FRAMES,
  KEY_SAID,
  KeyBox,
  KeyItem,
  LockedDoor,
  LockedGate,
} from '@game/entities/objects/keys';
import { levelTouchLabels } from '@game/touch-labels';
import { drawHud, KEY_ICON_P1, KEY_ICON_P2 } from '@game/hud/hud';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import { PALETTES, SPRITES } from '@content/sprites';

// Keys and locked doors (0.4.52, entities/objects/keys.ts; docs/STORY.md "Simon's way in"): the
// key box over 5-1-bonus's exit pipe, the key, the locked door to Simon's crypt and 5-1's gate.

/** The key box (column 14, row 7), the door (column 2, rows 11-12), the pipe top (row 11). */
const BOX = { x: 14, y: 7 };
const DOOR = { x: 2, y: 11 };
const PIPE_TOP = 11 * 16;
const FLOOR = 13 * 16;
const INTO_CRYPT = { level: '5-4-crypt', x: 1, y: 0, exitDir: 'fall' };

interface Room {
  world: World;
  events: WorldEvent[];
  step(a?: Action[], a2?: Action[]): void;
}

/** A campaign (story) world of `levelId` for `c` (and a co-op `c2`), Simon freed or not. */
function room(
  c: CharacterDef,
  o: { power?: string; freed?: boolean; c2?: CharacterDef; levelId?: string; story?: boolean } = {},
): Room {
  const level = campaignLevel(getLevel(o.levelId ?? '5-1-bonus'));
  const state = newGameState(c, o.c2 ?? null);
  if (o.power && c.damage.kind === 'powerup' && c.damage.states.includes(o.power)) state.powerState = o.power;
  if (o.power && o.c2?.damage.kind === 'powerup' && o.c2.damage.states.includes(o.power))
    state.powerState2 = o.power;
  const assets = new AssetRegistry(PALETTES);
  assets.defineAll(SPRITES);
  const world = new World(
    level,
    { assets, audio: NULL_AUDIO, assist: { ...DEFAULT_ASSIST }, reduceFlashing: true },
    state,
    { seed: levelSeed(level) },
  );
  if (o.story !== false) {
    world.storyMode = true;
    world.captives = {
      isFreed: (id) => (o.freed ? ['mario', 'simon'] : ['mario']).includes(id),
      hero: (id) => CHARACTERS.find((x) => x.id === id),
    };
  }
  const p1 = new ScriptedInput({ steps: [] });
  const p2 = new ScriptedInput({ steps: [] });
  const events: WorldEvent[] = [];
  return {
    world,
    events,
    step(a = [], a2 = []) {
      p1.setHeld(a);
      p2.setHeld(a2);
      p1.next();
      p2.next();
      world.update([p1, p2]);
      events.push(...world.events.splice(0));
    },
  };
}

const keyOf = (w: World) => w.entities.find((e): e is KeyItem => e instanceof KeyItem && e.alive);
const doorOf = (w: World) => w.entities.find((e): e is LockedDoor => e instanceof LockedDoor && e.alive);
const says = (r: Room) => r.events.filter((e) => e.type === 'say').map((e) => (e as { text: string }).text);

/** Land, then stand player 1 at `cx` (px, centre) on the floor or the pipe top (`top`). */
function place(r: Room, cx: number, top = FLOOR, i = 0): void {
  for (let f = 0; f < 120 && !r.world.players[i]!.body.onGround; f++) r.step();
  const p = r.world.players[i]!;
  p.body.x = px(cx) - (p.body.w >> 1);
  p.body.y = px(top) - p.body.h;
  p.body.vx = 0;
  p.body.vy = 0;
  for (let f = 0; f < 4; f++) r.step();
}

/**
 * Plays the room as a player would (player 1, real inputs only): onto the exit pipe's top with a
 * jump, under the box, a jump to bump it, PICK UP the key once it lies on the pipe, down to the
 * floor and left to the door (it opens by itself as the key touches it), then UP in the doorway.
 * Returns the frame of each milestone (or -1).
 */
function playRoute(r: Room, max = 3000) {
  const w = r.world;
  const at = { onPipe: -1, bumped: -1, got: -1, opened: -1, entered: -1 };
  let jumpHold = 0;
  for (let f = 0; f < max; f++) {
    const p = w.player;
    const b = p.body;
    const cx = toPx(p.centerX);
    const key = keyOf(w);
    const door = doorOf(w);
    const a: Action[] = [];
    if (at.entered < 0 && r.events.some((e) => e.type === 'pipe')) {
      at.entered = f;
      break;
    }
    if (at.bumped < 0 && (key || w.map.get(BOX.x, BOX.y) === T.USED)) at.bumped = f;
    if (at.got < 0 && w.keyHolder === 0) at.got = f;
    if (at.opened < 0 && door?.open) at.opened = f;
    const onPipe = b.onGround && toPx(b.y + b.h) === PIPE_TOP;
    if (at.onPipe < 0 && onPipe) at.onPipe = f;
    if (jumpHold > 0) {
      jumpHold--;
      a.push('jump');
    }
    if (at.bumped < 0) {
      if (!onPipe) {
        // To the pipe: run right, and jump before its mouth (walking into it leaves the room);
        // in the air, steer onto its top (not on into the upright pipe beyond, where Ryu clings).
        if (cx < 13 * 16 + 8) a.push('right');
        if (b.onGround && cx >= 13 * 16 - 40 && toPx(b.y + b.h) === FLOOR) jumpHold = 24;
      } else if (cx < BOX.x * 16 + 6) a.push('right');
      else if (cx > BOX.x * 16 + 10) a.push('left');
      else if (b.onGround && jumpHold === 0) jumpHold = 20;
    } else if (at.got < 0) {
      // Wait for the key to land, then go to it and PICK UP (an edge: every other frame).
      if (key && !key.rising && key.body.onGround) {
        const kx = toPx(key.body.x) + 8;
        if (key.inReach(p)) {
          if (f % 2 === 0) a.push('special');
        } else if (b.onGround) a.push(kx < cx ? 'left' : 'right');
      }
    } else if (at.opened < 0) a.push('left');
    else if (door) {
      const dx = toPx(door.body.x) + 8 - cx;
      if (Math.abs(dx) > 4) a.push(dx < 0 ? 'left' : 'right');
      else if (b.onGround && f % 2 === 0) a.push('up');
    }
    r.step(a);
  }
  return at;
}

describe('the room in campaign play', () => {
  it('the lone coin brick over the exit pipe is a key box; the door and the townsperson are in', () => {
    const r = room(MARIO);
    r.step();
    expect(r.world.map.get(BOX.x, BOX.y)).toBe(T.BRICK_KEY);
    const door = doorOf(r.world)!;
    expect([toPx(door.body.x) >> 4, toPx(door.body.y) >> 4]).toEqual([DOOR.x, DOOR.y]);
    expect(door.open).toBe(false);
    expect(door.target).toEqual({ level: '5-4-crypt', x: 1, y: 0 });
    expect(
      r.world.entities.some((e) => e.kind === 'partner' && (e as { who?: string }).who === 'townsperson'),
    ).toBe(true);
  });

  it('classic play keeps the coin brick, with no door, no key and no townsperson', () => {
    const r = room(MARIO, { story: false });
    for (let f = 0; f < 10; f++) r.step();
    expect(r.world.map.get(BOX.x, BOX.y)).toBe(T.BRICK_COINS10);
    expect(r.world.entities.some((e) => e instanceof KeyBox || e instanceof LockedDoor)).toBe(false);
    expect(r.world.entities.some((e) => e.kind === 'partner')).toBe(false);
    const raw = getLevel('5-1-bonus');
    expect(raw.entities.every((e) => e.props?.campaign === true)).toBe(true);
  });

  it('once Simon is freed: the door stands open for good, and the brick keeps its coins', () => {
    const r = room(MARIO, { freed: true });
    for (let f = 0; f < 10; f++) r.step();
    expect(r.world.map.get(BOX.x, BOX.y)).toBe(T.BRICK_COINS10);
    expect(doorOf(r.world)!.open).toBe(true);
    // Up in the doorway goes straight down to the crypt, no key needed.
    place(r, DOOR.x * 16 + 8);
    r.step(['up']);
    for (let f = 0; f < 60; f++) r.step();
    expect(r.events.find((e) => e.type === 'pipe')).toMatchObject({ target: INTO_CRYPT });
  });
});

describe('every hero, small and big, gets the key to the door and goes in', () => {
  const cases = CHARACTERS.flatMap((c) =>
    (c.damage.kind === 'powerup' ? ['small', 'big'] : ['full']).map((power) => [c.name, power, c] as const),
  );
  it.each(cases)(
    '%s (%s): onto the pipe, bump the box, PICK UP, the door opens by itself, UP',
    (_n, power, c) => {
      const r = room(c, { power });
      const at = playRoute(r);
      expect(at.onPipe, 'stood on the pipe top').toBeGreaterThanOrEqual(0);
      expect(at.bumped, 'bumped the box').toBeGreaterThan(at.onPipe);
      expect(at.got, 'picked up the key').toBeGreaterThan(at.bumped);
      expect(at.opened, 'opened the door').toBeGreaterThan(at.got);
      expect(at.entered, 'went through').toBeGreaterThan(at.opened);
      expect(r.events.find((e) => e.type === 'pipe')).toMatchObject({ target: INTO_CRYPT });
      expect(r.world.keyHolder).toBeNull();
      expect(r.world.map.get(BOX.x, BOX.y)).toBe(T.USED);
      expect(says(r)).toEqual(expect.arrayContaining([KEY_SAID.popped, KEY_SAID.got, KEY_SAID.opened]));
      expect(r.events.some((e) => e.type === 'died')).toBe(false);
    },
  );
});

describe('the key', () => {
  /** Mario stands on the pipe under the box and bumps it. */
  function bumped(o: Parameters<typeof room>[1] = {}) {
    const r = room(MARIO, o);
    place(r, BOX.x * 16 + 8, PIPE_TOP);
    for (let f = 0; f < 20; f++) r.step(['jump']);
    for (let f = 0; f < 60; f++) r.step();
    return r;
  }

  it('bumped from below it rises out, hops left and lies on the pipe top; the box is spent, not broken', () => {
    const r = room(MARIO, { power: 'big' });
    place(r, BOX.x * 16 + 8, PIPE_TOP);
    r.step(['jump']);
    for (let f = 0; f < 30 && !keyOf(r.world); f++) r.step(['jump']);
    const key = keyOf(r.world)!;
    expect(key).toBeDefined();
    expect(key.rising).toBe(true);
    expect(key.inReach(r.world.player)).toBe(false);
    for (let f = 0; f < KEY_RISE_FRAMES + 80; f++) r.step();
    expect(key.alive).toBe(true);
    expect(key.body.onGround).toBe(true);
    expect(toPx(key.body.y + key.body.h)).toBe(PIPE_TOP);
    expect(toPx(key.body.x)).toBeLessThan(BOX.x * 16);
    expect(toPx(key.body.x)).toBeGreaterThanOrEqual(13 * 16 - 8);
    expect(r.world.map.get(BOX.x, BOX.y)).toBe(T.USED);
    // A spent box gives nothing more.
    const before = r.world.entities.filter((e) => e instanceof KeyItem).length;
    for (let f = 0; f < 20; f++) r.step(['jump']);
    expect(r.world.entities.filter((e) => e instanceof KeyItem).length).toBe(before);
  });

  it('in reach the TALK button reads PICK UP (the touch button too), and pressing it takes the key', () => {
    const r = bumped();
    const key = keyOf(r.world)!;
    place(r, toPx(key.body.x) + 8, PIPE_TOP);
    expect(r.world.talkVerb(r.world.player)).toBe('PICK UP');
    expect(levelTouchLabels(r.world.player, r.world).special).toBe('PICK UP');
    expect(r.events).toContainEqual({ type: 'key-near', what: 'key', player: 0 });
    r.step(['special']);
    expect(key.alive).toBe(false);
    expect(r.world.keyHolder).toBe(0);
    expect(says(r)).toContain(KEY_SAID.got);
    expect(r.world.talkVerb(r.world.player)).toBeNull();
  });

  it('the HUD shows the key icon on the carrier’s side only while it is carried', () => {
    const assets = new AssetRegistry(PALETTES);
    assets.defineAll(SPRITES);
    const icons = (holder: number | null) => {
      const out: { x: number; y: number }[] = [];
      const r: Renderer = Object.assign(new NullRenderer(), {
        sprite(_s: unknown, frame: string, x: number, y: number) {
          if (frame === 'key-icon') out.push({ x, y });
        },
      });
      const state = newGameState(MARIO, MARIO);
      drawHud(r, assets, state, 300, 0, [], { keyHolder: holder });
      return out;
    };
    expect(icons(null)).toEqual([]);
    expect(icons(0)).toEqual([KEY_ICON_P1]);
    expect(icons(1)).toEqual([KEY_ICON_P2]);
  });

  it('the key never blinks: it is drawn every frame (reduce flashing or not)', () => {
    const r = bumped();
    const key = keyOf(r.world)!;
    let drawn = 0;
    const rr: Renderer = Object.assign(new NullRenderer(), {
      sprite(_s: unknown, frame: string) {
        if (frame === 'key') drawn++;
      },
    });
    for (let f = 0; f < 40; f++) {
      key.render(rr, {
        camX: 0,
        frame: f,
        assets: r.world.ctx.assets,
        theme: 'underground',
        reduceFlashing: f % 2 === 0,
      });
    }
    expect(drawn).toBe(40);
  });
});

describe('the locked door', () => {
  it('without the key it reads LOCKED, the button does nothing, and the door holds', () => {
    const r = room(MARIO);
    place(r, DOOR.x * 16 + 8);
    const door = doorOf(r.world)!;
    expect(r.world.talkVerb(r.world.player)).toBe('LOCKED');
    expect(levelTouchLabels(r.world.player, r.world).special).toBe('LOCKED');
    expect(r.events).toContainEqual({ type: 'key-near', what: 'door', player: 0 });
    r.step(['special']);
    r.step(['up']);
    for (let f = 0; f < 40; f++) r.step();
    expect(door.open).toBe(false);
    expect(r.events.some((e) => e.type === 'pipe' || e.type === 'gate')).toBe(false);
  });

  it('it opens by itself as the carried key touches it (no press), the key used up; then UP enters', () => {
    const r = room(MARIO);
    place(r, 120);
    r.world.keyHolder = 0;
    const door = doorOf(r.world)!;
    for (let f = 0; f < 200 && !door.open; f++) r.step(['left']);
    expect(door.open).toBe(true);
    expect(r.world.keyHolder).toBeNull();
    expect(says(r)).toContain(KEY_SAID.opened);
    expect(r.world.talkVerb(r.world.player)).toBeNull();
    place(r, DOOR.x * 16 + 8);
    r.step(['up']);
    expect(r.world.inPipe).toBe(true);
    for (let f = 0; f < 60; f++) r.step();
    expect(r.events.find((e) => e.type === 'pipe')).toMatchObject({ target: INTO_CRYPT });
  });

  it('a player not carrying the key opens nothing (co-op: the other carries it)', () => {
    const r = room(MARIO, { c2: MARIO });
    place(r, 120, FLOOR, 1);
    place(r, DOOR.x * 16 + 8, FLOOR, 0);
    r.world.keyHolder = 1;
    for (let f = 0; f < 30; f++) r.step();
    expect(doorOf(r.world)!.open).toBe(false);
  });
});

describe('the key lasts one visit', () => {
  it('a new visit (death, leaving, restart: the room is made again) has the box full and the door locked', () => {
    const r = room(MARIO);
    playRoute(r);
    expect(r.world.map.get(BOX.x, BOX.y)).toBe(T.USED);
    const again = room(MARIO);
    again.step();
    expect(again.world.map.get(BOX.x, BOX.y)).toBe(T.BRICK_KEY);
    expect(again.world.keyHolder).toBeNull();
    expect(doorOf(again.world)!.open).toBe(false);
  });

  it('co-op: one key, either player; if its carrier dies it goes back in its box', () => {
    const r = room(MARIO, { c2: MARIO });
    place(r, BOX.x * 16 + 8, PIPE_TOP, 0);
    place(r, 13 * 16 + 4, PIPE_TOP, 1);
    for (let f = 0; f < 20; f++) r.step(['jump']);
    for (let f = 0; f < 80; f++) r.step();
    const key = keyOf(r.world)!;
    // Player 2 takes it.
    place(r, toPx(key.body.x) + 8, PIPE_TOP, 1);
    expect(r.world.talkVerb(r.world.players[1]!)).toBe('PICK UP');
    r.step([], ['special']);
    expect(r.world.keyHolder).toBe(1);
    expect(keyOf(r.world)).toBeUndefined();
    // Player 2 dies: the key is back in its box, the box full again.
    r.world.players[1]!.dead = true;
    r.step();
    expect(r.world.keyHolder).toBeNull();
    expect(r.world.map.get(BOX.x, BOX.y)).toBe(T.BRICK_KEY);
    expect(says(r)).toContain(KEY_SAID.back);
  });
});

describe('5-1’s crypt gate', () => {
  const gateOf = (w: World) => w.entities.find((e): e is LockedGate => e instanceof LockedGate && e.alive);

  it('stands at column 12 by the start, in the background: every hero walks past it, never through it', () => {
    for (const c of CHARACTERS) {
      const r = room(c, { levelId: '5-1' });
      for (let f = 0; f < 10; f++) r.step();
      const gate = gateOf(r.world)!;
      expect([toPx(gate.body.x) >> 4, toPx(gate.body.y) >> 4]).toEqual([12, 11]);
      expect([r.world.map.get(12, 11), r.world.map.get(12, 12)]).toEqual([T.AIR, T.AIR]);
      place(r, 10 * 16 + 8);
      let furthest = 0;
      for (let f = 0; f < 60; f++) {
        r.step(['right']);
        furthest = Math.max(furthest, toPx(r.world.player.body.x));
      }
      // Right through its doorway's column and out the other side (the enemies beyond may push back).
      expect(furthest, c.name).toBeGreaterThan(13 * 16);
      expect(
        r.events.some((e) => e.type === 'pipe'),
        c.name,
      ).toBe(false);
    }
  });

  it('OPEN tries it: the locked card once a visit (a gate event), then just LOCKED; UP does nothing', () => {
    const r = room(MARIO, { levelId: '5-1' });
    for (let f = 0; f < 10; f++) r.step();
    place(r, 12 * 16 + 8);
    expect(r.world.talkVerb(r.world.player)).toBe('OPEN');
    expect(levelTouchLabels(r.world.player, r.world).special).toBe('OPEN');
    expect(r.events).toContainEqual({ type: 'key-near', what: 'gate', player: 0 });
    r.step(['special']);
    expect(r.events.filter((e) => e.type === 'gate')).toEqual([{ type: 'gate', hero: 'simon', player: 0 }]);
    r.step();
    expect(r.world.talkVerb(r.world.player)).toBe('LOCKED');
    r.step(['special']);
    r.step(['up']);
    r.step();
    expect(r.events.filter((e) => e.type === 'gate')).toHaveLength(1);
    expect(r.events.some((e) => e.type === 'pipe')).toBe(false);
    // Walking off and back: just "Locked." (no card again on this visit).
    place(r, 40);
    place(r, 12 * 16 + 8);
    expect(r.events.filter((e) => e.type === 'key-near').at(-1)).toEqual({
      type: 'key-near',
      what: 'locked',
      player: 0,
    });
    // A new visit (5-1 entered again): the card once more.
    const again = room(MARIO, { levelId: '5-1' });
    for (let f = 0; f < 10; f++) again.step();
    place(again, 12 * 16 + 8);
    again.step(['special']);
    expect(again.events.filter((e) => e.type === 'gate')).toHaveLength(1);
  });

  it('once Simon is freed it is plain scenery (no prompt); classic play has no gate', () => {
    const freed = room(MARIO, { levelId: '5-1', freed: true });
    for (let f = 0; f < 10; f++) freed.step();
    expect(gateOf(freed.world)!.freed).toBe(true);
    place(freed, 12 * 16 + 8);
    expect(freed.world.talkVerb(freed.world.player)).toBeNull();
    const classic = room(MARIO, { levelId: '5-1', story: false });
    for (let f = 0; f < 10; f++) classic.step();
    expect(gateOf(classic.world)).toBeUndefined();
  });

  it('the old way in is gone: 5-4 has no descent zone and no townsperson; its lift is classic', () => {
    const l = campaignLevel(getLevel('5-4'));
    expect(l.zones.some((z) => z.kind === 'descent')).toBe(false);
    expect(l.entities.some((e) => e.type === 'partner')).toBe(false);
  });
});
