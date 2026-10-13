import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { px, toPx } from '@engine/math/units';
import type { Action } from '@engine/input/actions';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import { CHARACTERS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import type { CharacterDef } from '@game/characters/character';
import { DEFAULT_ASSIST, newGameState } from '@game/context';
import { campaignLevel } from '@game/level/campaign';
import { T } from '@game/level/tiles';
import { ScriptedInput } from '@game/sim/headless';
import { World, levelSeed, type WorldEvent } from '@game/world/world';
import {
  DOOR_ART,
  KEY_RISE_FRAMES,
  KEY_SAID,
  KeyBox,
  KeyItem,
  LockedDoor,
  LockedHatch,
} from '@game/entities/objects/keys';
import { levelTouchLabels } from '@game/touch-labels';
import { PALETTES, SPRITES } from '@content/sprites';
import { keysDef } from '@content/sprites/keys';
import { PARTNERS } from '@game/story/script';

// Sophia III's way in (0.4.54, owner design; docs/STORY.md "Sophia III's way in"), the 0.4.52 key
// and locked-door mechanic reused: 8-1's steel hatch by the start is always shut (the locked card
// once a visit), and the real way down is 8-1's coin room (8-1-bonus): the 10-coin brick is a key
// box, Jason lost the key, and the locked blast door leads down into the garage (8-4-garage, its
// id kept, an area of 8-1 now).

/** The key box (column 12, row 9), the door (column 4, rows 11-12), the floor (row 13). */
const BOX = { x: 12, y: 9 };
const DOOR = { x: 4, y: 11 };
const FLOOR = 13 * 16;
const INTO_GARAGE = { level: '8-4-garage', x: 2, y: 0, exitDir: 'fall' };
/** 8-1's hatch: columns 13-14 on the ground's top row (13). */
const HATCH = { x: 13, y: 13 };

interface Room {
  world: World;
  events: WorldEvent[];
  step(a?: Action[], a2?: Action[]): void;
}

/** A campaign (story) world of `levelId` for `c` (and a co-op `c2`), Sophia III freed or not. */
function room(
  c: CharacterDef,
  o: { power?: string; freed?: boolean; c2?: CharacterDef; levelId?: string; story?: boolean } = {},
): Room {
  const level = campaignLevel(getLevel(o.levelId ?? '8-1-bonus'));
  const state = newGameState(c, o.c2 ?? null);
  if (o.power && c.damage.kind === 'powerup' && c.damage.states.includes(o.power)) state.powerState = o.power;
  if (o.power && o.c2?.damage.kind === 'powerup' && o.c2.damage.states.includes(o.power))
    state.powerState2 = o.power;
  state.world = level.world;
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
      isFreed: (id) => (o.freed ? ['mario', 'sophia'] : ['mario']).includes(id),
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
const hatchOf = (w: World) => w.entities.find((e): e is LockedHatch => e instanceof LockedHatch && e.alive);
const says = (r: Room) => r.events.filter((e) => e.type === 'say').map((e) => (e as { text: string }).text);

/** Land, then stand player `i` at `cx` (px, centre) on the floor. */
function place(r: Room, cx: number, i = 0): void {
  for (let f = 0; f < 120 && !r.world.players[i]!.body.onGround; f++) r.step();
  const p = r.world.players[i]!;
  p.body.x = px(cx) - (p.body.w >> 1);
  p.body.y = px(FLOOR) - p.body.h;
  p.body.vx = 0;
  p.body.vy = 0;
  for (let f = 0; f < 4; f++) r.step();
}

/**
 * Plays the room as a player would (player 1, real inputs only), from where the pipe drops the
 * hero in: right along the floor to under the box (never on into the exit pipe's mouth), a jump to
 * bump it, PICK UP the key once it lies on the floor, left to the door (it opens by itself as the
 * key touches it), then UP in the doorway. Returns the frame of each milestone (or -1).
 */
function playRoute(r: Room, max = 3000) {
  const w = r.world;
  const at = { bumped: -1, got: -1, opened: -1, entered: -1 };
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
    if (jumpHold > 0) {
      jumpHold--;
      a.push('jump');
    }
    if (at.bumped < 0) {
      if (!b.onGround) {
        // Up under the box, never steering on into the pipe's mouth.
      } else if (cx < BOX.x * 16 + 5) a.push('right');
      else if (cx > BOX.x * 16 + 11) a.push('left');
      else if (jumpHold === 0) jumpHold = 20;
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

describe('8-1-bonus in campaign play', () => {
  it('the 10-coin brick is a key box; the blast door (vault look) and Jason are in', () => {
    const r = room(MARIO);
    r.step();
    expect(r.world.map.get(BOX.x, BOX.y)).toBe(T.BRICK_KEY);
    const door = doorOf(r.world)!;
    expect([toPx(door.body.x) >> 4, toPx(door.body.y) >> 4]).toEqual([DOOR.x, DOOR.y]);
    expect(door.open).toBe(false);
    expect(door.look).toBe('vault');
    expect(door.target).toEqual({ level: '8-4-garage', x: 2, y: 0 });
    const jason = r.world.entities.find((e) => e.kind === 'partner') as { who?: string; body: { x: number } };
    expect(jason.who).toBe('jason');
    expect(toPx(jason.body.x) >> 4).toBe(8);
    // Option A (owner-approved): Jason lost the key, in this room.
    expect(PARTNERS.jason!.pages).toEqual([
      [
        'JASON:',
        '',
        'FRED! SOPHIA! THE HATCH',
        'SHUT ON THEM! THIS DOOR',
        'GOES DOWN THERE TOO, BUT I',
        'LOST THE KEY IN HERE.',
      ],
    ]);
  });

  it("the vault door is the Underworld dungeon's own blast door, on its floor tile", () => {
    const sheet = SPRITES['bm-dungeon'];
    expect(sheet?.frames[DOOR_ART.vault.shut]).toBeDefined();
    expect(sheet?.frames[DOOR_ART.vault.open]).toBeDefined();
    const drawn: string[] = [];
    const rr: Renderer = Object.assign(new NullRenderer(), {
      sprite(_s: unknown, frame: string, _x: number, y: number) {
        drawn.push(`${frame}@${y}`);
      },
    });
    const r = room(MARIO);
    r.step();
    const door = doorOf(r.world)!;
    const view = {
      camX: 0,
      frame: 0,
      assets: r.world.ctx.assets,
      theme: 'bm-vault',
      reduceFlashing: true,
    } as const;
    door.render(rr, view);
    expect(drawn).toEqual([`door-locked-side@${12 * 16}`, `padlock@${11 * 16 + 21}`]);
  });

  it('classic play keeps the coin brick, with no door, no key and no Jason', () => {
    const r = room(MARIO, { story: false });
    for (let f = 0; f < 10; f++) r.step();
    expect(r.world.map.get(BOX.x, BOX.y)).toBe(T.BRICK_COINS10);
    expect(r.world.entities.some((e) => e instanceof KeyBox || e instanceof LockedDoor)).toBe(false);
    expect(r.world.entities.some((e) => e.kind === 'partner')).toBe(false);
    expect(getLevel('8-1-bonus').entities.every((e) => e.props?.campaign === true)).toBe(true);
  });

  it('once Sophia III is freed: the door stands open for good, and the brick keeps its coins', () => {
    const r = room(MARIO, { freed: true });
    for (let f = 0; f < 10; f++) r.step();
    expect(r.world.map.get(BOX.x, BOX.y)).toBe(T.BRICK_COINS10);
    expect(doorOf(r.world)!.open).toBe(true);
    place(r, DOOR.x * 16 + 8);
    r.step(['up']);
    for (let f = 0; f < 60; f++) r.step();
    expect(r.events.find((e) => e.type === 'pipe')).toMatchObject({ target: INTO_GARAGE });
  });
});

describe('the key drops out of the box to the floor', () => {
  it('bumped from below, it sinks out of the underside and lies on the floor under it; the box is spent', () => {
    const r = room(MARIO, { power: 'big' });
    place(r, BOX.x * 16 + 8);
    r.step(['jump']);
    for (let f = 0; f < 30 && !keyOf(r.world); f++) r.step(['jump']);
    const key = keyOf(r.world)!;
    expect(key).toBeDefined();
    expect(key.out).toBe('down');
    expect(key.rising).toBe(true);
    expect(key.inReach(r.world.player)).toBe(false);
    for (let f = 0; f < KEY_RISE_FRAMES + 80; f++) r.step();
    expect(key.body.onGround).toBe(true);
    expect(toPx(key.body.y + key.body.h)).toBe(FLOOR);
    expect(toPx(key.body.x)).toBe(BOX.x * 16);
    expect(r.world.map.get(BOX.x, BOX.y)).toBe(T.USED);
    expect(says(r)).toContain(KEY_SAID.popped);
    // In reach on the floor: PICK UP, and it is taken.
    expect(r.world.talkVerb(r.world.player)).toBe('PICK UP');
    expect(levelTouchLabels(r.world.player, r.world).special).toBe('PICK UP');
    r.step(['special']);
    expect(r.world.keyHolder).toBe(0);
  });

  it("5-1-bonus's key still hops out of the top (its box's default)", () => {
    const r = room(MARIO, { levelId: '5-1-bonus' });
    r.step();
    const box = r.world.entities.find((e): e is KeyBox => e instanceof KeyBox)!;
    expect(box.out).toBe('up');
  });
});

describe('every hero, small and big, gets the key to the blast door and goes down to the garage', () => {
  const cases = CHARACTERS.flatMap((c) =>
    (c.damage.kind === 'powerup' ? ['small', 'big'] : ['full']).map((power) => [c.name, power, c] as const),
  );
  it.each(cases)(
    '%s (%s): bump the box from the floor, PICK UP, the door opens by itself, UP',
    (_n, power, c) => {
      const r = room(c, { power });
      const at = playRoute(r);
      expect(at.bumped, 'bumped the box').toBeGreaterThanOrEqual(0);
      expect(at.got, 'picked up the key').toBeGreaterThan(at.bumped);
      expect(at.opened, 'opened the door').toBeGreaterThan(at.got);
      expect(at.entered, 'went through').toBeGreaterThan(at.opened);
      expect(r.events.find((e) => e.type === 'pipe')).toMatchObject({ target: INTO_GARAGE });
      expect(r.world.keyHolder).toBeNull();
      expect(r.world.map.get(BOX.x, BOX.y)).toBe(T.USED);
      expect(says(r)).toEqual(expect.arrayContaining([KEY_SAID.popped, KEY_SAID.got, KEY_SAID.opened]));
      expect(r.events.some((e) => e.type === 'died')).toBe(false);
    },
  );
});

describe('the key lasts one visit (8-1-bonus)', () => {
  it('a new visit has the box full and the door locked', () => {
    const r = room(MARIO);
    playRoute(r);
    expect(r.world.map.get(BOX.x, BOX.y)).toBe(T.USED);
    const again = room(MARIO);
    again.step();
    expect(again.world.map.get(BOX.x, BOX.y)).toBe(T.BRICK_KEY);
    expect(doorOf(again.world)!.open).toBe(false);
  });

  it('co-op: either player carries it; if its carrier dies it goes back in its box', () => {
    const r = room(MARIO, { c2: MARIO });
    place(r, BOX.x * 16 + 8, 0);
    place(r, 9 * 16, 1);
    for (let f = 0; f < 20; f++) r.step(['jump']);
    for (let f = 0; f < 80; f++) r.step();
    const key = keyOf(r.world)!;
    place(r, toPx(key.body.x) + 8, 1);
    expect(r.world.talkVerb(r.world.players[1]!)).toBe('PICK UP');
    r.step([], ['special']);
    expect(r.world.keyHolder).toBe(1);
    r.world.players[1]!.dead = true;
    r.step();
    expect(r.world.keyHolder).toBeNull();
    expect(r.world.map.get(BOX.x, BOX.y)).toBe(T.BRICK_KEY);
  });
});

describe("8-1's hatch by the start", () => {
  it('lies on the ground at columns 13-14; the ground under it is solid, and every hero walks over it', () => {
    for (const c of CHARACTERS) {
      const r = room(c, { levelId: '8-1' });
      for (let f = 0; f < 10; f++) r.step();
      const hatch = hatchOf(r.world)!;
      expect([toPx(hatch.body.x) >> 4, toPx(hatch.body.y) >> 4]).toEqual([HATCH.x, HATCH.y]);
      expect([toPx(hatch.body.w), toPx(hatch.body.h)]).toEqual([32, 16]);
      expect(hatch.kind).toBe('locked-hatch');
      expect([r.world.map.isSolid(13, 13), r.world.map.isSolid(14, 13)]).toEqual([true, true]);
      place(r, 12 * 16);
      let furthest = 0;
      for (let f = 0; f < 90; f++) {
        // The first Goomba (column 24) is not this test's business.
        for (const e of r.world.enemies) e.destroy();
        r.step(['right']);
        const p = r.world.player;
        furthest = Math.max(furthest, toPx(p.body.x));
        if (toPx(p.centerX) >> 4 >= 13 && toPx(p.centerX) >> 4 <= 14)
          expect(toPx(p.body.y + p.body.h), c.name).toBeLessThanOrEqual(FLOOR);
      }
      expect(furthest, c.name).toBeGreaterThan(15 * 16);
      expect(r.world.player.dead, c.name).toBe(false);
      expect(
        r.events.some((e) => e.type === 'pipe'),
        c.name,
      ).toBe(false);
    }
  });

  it('OPEN on it: the locked card once a visit (a gate event for Sophia III), then just LOCKED', () => {
    const r = room(MARIO, { levelId: '8-1' });
    for (let f = 0; f < 10; f++) r.step();
    place(r, HATCH.x * 16 + 16);
    expect(r.world.talkVerb(r.world.player)).toBe('OPEN');
    expect(levelTouchLabels(r.world.player, r.world).special).toBe('OPEN');
    expect(r.events).toContainEqual({ type: 'key-near', what: 'hatch', player: 0 });
    r.step(['special']);
    expect(r.events.filter((e) => e.type === 'gate')).toEqual([{ type: 'gate', hero: 'sophia', player: 0 }]);
    r.step();
    expect(r.world.talkVerb(r.world.player)).toBe('LOCKED');
    r.step(['special']);
    r.step(['down']);
    r.step();
    expect(r.events.filter((e) => e.type === 'gate')).toHaveLength(1);
    expect(r.events.some((e) => e.type === 'pipe')).toBe(false);
    // Off it and back: just "Locked.".
    place(r, 60);
    place(r, HATCH.x * 16 + 16);
    expect(r.events.filter((e) => e.type === 'key-near').at(-1)).toEqual({
      type: 'key-near',
      what: 'locked',
      player: 0,
    });
  });

  it("beside it, the mutant's TALK wins (his reach and the hatch's never meet)", () => {
    const r = room(MARIO, { levelId: '8-1' });
    for (let f = 0; f < 10; f++) r.step();
    place(r, 10 * 16 + 8);
    expect(r.world.talkVerb(r.world.player)).toBe('TALK');
    place(r, 12 * 16 + 8);
    expect(r.world.talkVerb(r.world.player)).toBe('OPEN');
  });

  it('drawn shut (the approved art) with its strip over the head of a hero on it', () => {
    expect(keysDef.frames['hatch-shut']?.length).toBe(16);
    expect(keysDef.frames['hatch-shut']?.[0]?.length).toBe(32);
    expect(keysDef.frames['hatch-open']?.length).toBe(16);
    const r = room(MARIO, { levelId: '8-1' });
    for (let f = 0; f < 10; f++) r.step();
    place(r, HATCH.x * 16 + 16);
    const drawn: string[] = [];
    const rr: Renderer = Object.assign(new NullRenderer(), {
      sprite(_s: unknown, frame: string) {
        drawn.push(frame);
      },
    });
    hatchOf(r.world)!.render(rr, {
      camX: 0,
      frame: 0,
      assets: r.world.ctx.assets,
      theme: 'bm-forest',
      reduceFlashing: true,
    });
    expect(drawn[0]).toBe('hatch-shut');
    expect(drawn).not.toContain('hatch-open');
  });

  it('once Sophia III is freed it is plain ground (no prompt); classic play has no hatch', () => {
    const freed = room(MARIO, { levelId: '8-1', freed: true });
    for (let f = 0; f < 10; f++) freed.step();
    expect(hatchOf(freed.world)!.freed).toBe(true);
    place(freed, HATCH.x * 16 + 16);
    expect(freed.world.talkVerb(freed.world.player)).toBeNull();
    const classic = room(MARIO, { levelId: '8-1', story: false });
    for (let f = 0; f < 10; f++) classic.step();
    expect(hatchOf(classic.world)).toBeUndefined();
  });
});
