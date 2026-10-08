import { describe, expect, it } from 'vitest';
import type { Action } from '@engine/input/actions';
import { toPx } from '@engine/math/units';
import type { Scene } from '@engine/scene';
import { CHARACTERS } from '@game/characters/registry';
import { LUIGI } from '@game/characters/luigi';
import { MARIO } from '@game/characters/mario';
import type { Player } from '@game/entities/player';
import { lessonsFor, LUIGI_HIGH_JUMP_PX, LUIGI_COAST_PX, SEABED_JUMP_PX } from '@game/tutorial/lessons';
import {
  CARD_GUARD_FRAMES,
  PracticeRoomScene,
  practiceRoom,
  ROOM_LINES,
  TrainingMenuScene,
  type TrainingResult,
} from '@game/tutorial/room';
import { chaptersFor, type RunKit } from '@game/tutorial/lessons';
import { activeTool } from '@game/characters/toolbelt';
import { RushCoil } from '@game/entities/objects/rush-coil';
import { defaultSettings } from '@engine/save/settings';
import type { TargetDummy } from '@game/tutorial/dummy';
import { runSim } from '@game/sim/headless';
import { getLevel } from '@content/levels';
import { draw, makeGame, useStorage } from './heroes-harness';
import { tcPolicies } from './training-tc';

useStorage();

/**
 * What a scripted player does for one lesson: held actions from the player, the frames since it
 * began, and the room.
 */
type Policy = (p: Player, f: number, s: PracticeRoomScene) => Action[];

const cx = (p: Player) => toPx(p.centerX);
const tapEvery = (f: number, a: Action, n = 8): Action[] => (f % n < 2 ? [a] : []);
/** Walk until the centre is near `x` px (within 3 px), then nothing. */
const goTo = (p: Player, x: number): Action[] => (cx(p) < x - 3 ? ['right'] : cx(p) > x + 3 ? ['left'] : []);
/** The belt's selected tool. */
const tool = (p: Player) => activeTool(p, p.def.tools?.(p) ?? [])?.id;
/** Pick `id` on the belt (the belt's button), then use it with `use` every `n` frames. */
const pick =
  (id: string, use: Action = 'special', n = 20): Policy =>
  (p, f) =>
    tool(p) !== id ? (f % 8 === 0 ? ['select'] : []) : tapEvery(f, use, n);

/** The dummy's left edge is at 146 px, the bricks span 80-128, the gap 176-208, the wall is at 240. */
function policies(): Record<string, Policy> {
  let released = false;
  let backed = false;
  let wasClose = false;
  return {
    // Luigi
    'high-jump': (p, f) => (Math.abs(cx(p) - 140) > 3 ? goTo(p, 140) : f % 60 < 45 ? ['jump'] : []),
    'slippery-stop': (p) => {
      if (!backed) {
        backed = cx(p) <= 72;
        return ['left'];
      }
      if (!released && cx(p) >= 112) released = true;
      return released ? [] : ['right', 'attack'];
    },
    fireball: (_p, f) => (f < 60 ? [] : tapEvery(f, 'attack', 12)),
    // Link (and the shared ones)
    sword: (p, f) => (cx(p) < 128 ? goTo(p, 130) : tapEvery(f, 'attack', 16)),
    'down-thrust': (p, f) => {
      const b = p.body;
      if (b.onGround) {
        if (cx(p) > 124) return ['left'];
        return cx(p) < 118 ? ['right'] : f % 6 < 3 ? ['right', 'jump'] : [];
      }
      const hold: Action[] = cx(p) < 152 ? ['right'] : [];
      return b.vy > 0 ? [...hold, 'down'] : [...hold, 'jump'];
    },
    'up-thrust': (p, f) => (Math.abs(cx(p) - 104) > 3 ? goTo(p, 104) : f % 30 < 15 ? ['jump', 'up'] : ['up']),
    shield: (p) => goTo(p, 100),
    boomerang: (_p, f) => tapEvery(f, 'special', 20),
    // Mega Man
    shoot: (_p, f) => tapEvery(f, 'attack', 10),
    slide: (_p, f) => (f % 20 < 2 ? ['down', 'jump'] : ['down']),
    charge: (_p, f) => (f % 70 < 55 ? ['attack'] : []),
    weapon: (_p, f) => (f === 2 ? ['select'] : f > 10 ? tapEvery(f, 'special', 20) : []),
    // Samus
    'aim-up': (_p, f) => ['up', ...tapEvery(f, 'attack', 10)],
    missile: (_p, f) => (f < 10 ? tapEvery(f, 'up', 4) : tapEvery(f, 'special', 10)),
    // Simon
    whip: (p, f) => (cx(p) < 116 ? goTo(p, 118) : tapEvery(f, 'attack', 30)),
    'crouch-whip': (_p, f) => ['down', ...tapEvery(f, 'attack', 30)],
    'sub-weapon': (_p, f) => tapEvery(f, 'special', 20),
    'committed-jump': (p, f) =>
      p.body.onGround && cx(p) < 208
        ? cx(p) < 160
          ? ['right']
          : f % 4 < 2
            ? ['right', 'jump']
            : ['right']
        : [],
    // Ryu
    slash: (p, f) => (cx(p) < 126 ? goTo(p, 128) : tapEvery(f, 'attack', 14)),
    cling: (p, f) =>
      p.body.onGround && cx(p) >= 160 ? (f % 4 < 2 ? ['right', 'jump'] : ['right']) : ['right'],
    'wall-jump': (p, f) => {
      if (p.clinging) {
        const go: Action[] = wasClose ? ['right', 'jump'] : ['right'];
        wasClose = !wasClose;
        return go;
      }
      return p.body.onGround && cx(p) >= 160 ? (f % 4 < 2 ? ['right', 'jump'] : ['right']) : ['right'];
    },
    ninpo: (_p, f) => tapEvery(f, 'special', 20),
    // Bill
    aim: (_p, f) => {
      const k = Math.floor(f / 20) % 3;
      const hold: Action[] = k === 0 ? [] : k === 1 ? ['up'] : ['up', 'right'];
      return [...hold, ...tapEvery(f, 'attack', 10)];
    },
    prone: () => ['down'],
    'jump-shoot': (p, f) => (p.body.onGround ? tapEvery(f, 'jump', 20) : tapEvery(f, 'attack', 4)),
    // Sophia III (the shared 'missile' fires hers too)
    cannon: (_p, f) => tapEvery(f, 'attack', 10),
    hover: (p, f) => (p.body.onGround ? tapEvery(f, 'jump', 40) : f % 40 >= 12 ? ['jump'] : []),
    // Over the gap with a held jump, then up the tall wall.
    'wall-climb': (p, f) => {
      if (!p.body.onGround) return ['right', 'up', 'jump'];
      return cx(p) > 150 && cx(p) < 176 && f % 2 ? ['right', 'up', 'jump'] : ['right', 'up'];
    },
    // Off the wall first (into it + jump lets go; her wall pose is under a tile wide), then
    // EXIT on the floor.
    jason: (p, f) => {
      if (p.body.onGround) return f % 10 === 0 ? ['select'] : [];
      return p.body.w < 16 * 256 && f % 2 ? ['right', 'jump'] : [];
    },
    // Link's tools (the gear screen: the dummy at 128-140) and magic.
    'link:bomb': (p, f, s) =>
      cx(p) > 118 ? ['left'] : cx(p) < 106 ? ['right'] : p.facing < 0 ? ['right'] : pick('bomb')(p, f, s),
    'jump-spell': (p, f) => {
      if (!p.scratch.jumpSpell) return pick('jump')(p, f, null as never);
      return ['left', ...(f % 40 < 30 ? (['jump'] as Action[]) : [])];
    },
    'shield-spell': pick('shield'),
    'fire-spell': (p, f) => {
      if (!p.scratch.fireSpell) return pick('fire')(p, f, null as never);
      // Down off the ledge or the bricks first: the beam flies at the hero's height.
      if (toPx(p.body.y + p.body.h) < 190) return cx(p) < 64 ? ['right'] : ['left'];
      return cx(p) < 96 ? ['right'] : p.facing < 0 ? ['right'] : tapEvery(f, 'attack', 16);
    },
    swim: (_p, f) => tapEvery(f, 'jump', 10),
    // Mega Man's moves (the gear screen: the tunnel at 192-224), weapons and the seabed.
    'megaman:slide': (p, f) =>
      cx(p) < 160 ? ['right'] : f % 20 < 2 ? ['right', 'down', 'jump'] : ['right', 'down'],
    rush: (p, f, s) => {
      const coil = s.world.entities.find((e) => e instanceof RushCoil && e.alive);
      if (!coil) return p.body.onGround ? pick('rush')(p, f, s) : [];
      const at = toPx(coil.body.x + (coil.body.w >> 1));
      if (p.body.onGround) return f % 6 < 3 ? ['jump'] : [];
      return cx(p) < at - 2 ? ['right', 'jump'] : cx(p) > at + 2 ? ['left', 'jump'] : ['jump'];
    },
    saw: pick('saw'),
    leaf: pick('leaf'),
    flame: pick('flame'),
    knuckle: pick('knuckle'),
    bolt: pick('bolt', 'special', 40),
    'seabed-jump': (_p, f) => (f % 90 < 70 ? ['jump'] : []),
    // Samus: the beams from the left wall, missiles, the ball (the gear screen).
    'long-beam': (p, f) => (cx(p) > 20 ? ['left'] : p.facing < 0 ? ['right'] : tapEvery(f, 'attack', 10)),
    'ice-beam': (_p, f) => tapEvery(f, 'attack', 12),
    'wave-beam': (_p, f) => tapEvery(f, 'attack', 12),
    'missile-switch': (p, f) =>
      tool(p) !== 'missile' ? (f % 8 === 0 ? ['select'] : []) : tapEvery(f, 'attack', 12),
    'morph-ball': (p, f) =>
      cx(p) < 168 ? ['right'] : !p.scratch.ball ? (f % 6 === 0 ? ['down'] : []) : ['right'],
    'samus:bomb': (p, f) => (!p.scratch.ball ? tapEvery(f, 'down', 10) : tapEvery(f, 'attack', 10)),
    'bomb-jump': (p, f) => (!p.scratch.ball ? tapEvery(f, 'down', 10) : tapEvery(f, 'attack', 60)),
    // Simon's sub-weapons and upgrades.
    dagger: (_p, f) => tapEvery(f, 'special', 20),
    'hand-axe': pick('hand-axe', 'special', 30),
    'holy-water': pick('holy-water', 'special', 30),
    cross: pick('cross', 'special', 30),
    stopwatch: pick('stopwatch', 'special', 30),
    hearts: (_p, f) => tapEvery(f, 'special', 24),
    'simon:whip': (p, f) => (cx(p) < 128 ? goTo(p, 130) : tapEvery(f, 'attack', 30)),
    'chain-whip': (p, f) => (cx(p) < 122 ? goTo(p, 124) : tapEvery(f, 'attack', 30)),
    'morning-star': (p, f) => (cx(p) < 116 ? goTo(p, 118) : tapEvery(f, 'attack', 30)),
    'double-shot': (_p, f) => tapEvery(f, 'special', 14),
    // Ryu's arts.
    'throwing-star': (_p, f) => tapEvery(f, 'special', 20),
    windmill: pick('windmill', 'special', 30),
    'fire-wheel': pick('fire-wheel', 'special', 30),
    'jump-slash': pick('slash', 'special', 40),
    // Bill's guns and the swim.
    mg: pick('mg', 'attack', 6),
    spread: pick('spread', 'attack', 12),
    laser: pick('laser', 'attack', 20),
    'flame-gun': pick('flame-gun', 'attack', 20),
    'swim-shoot': (_p, f) => [...tapEvery(f, 'jump', 12), ...tapEvery(f + 6, 'attack', 6)],
    // Sophia III's drive, cannon and missiles.
    'drive-jump': (p, f) =>
      p.body.onGround && cx(p) < 208
        ? cx(p) < 150
          ? ['right']
          : f % 4 < 2
            ? ['right', 'jump']
            : ['right']
        : ['right', 'jump'],
    'sophia:cannon': (p, f) =>
      cx(p) > 104 ? ['left'] : p.facing < 0 ? ['right'] : tapEvery(f, 'attack', 10),
    'cannon-up': (_p, f) => ['up', ...tapEvery(f, 'attack', 10)],
    homing: (_p, f) => (f === 2 ? ['down', 'special'] : f > 10 ? tapEvery(f, 'special', 20) : []),
    // Simon, Ryu, Bill, Sophia III and Luigi from 0.4.34 (`<hero>:<lesson>`, training-tc.ts).
    ...tcPolicies(),
  };
}

/** Wait out a card (a chapter's or READY!) and press on. */
function pressOn(h: { idle(n: number): void; tap(a: Action): void }): void {
  h.idle(CARD_GUARD_FRAMES + 1);
  h.tap('jump');
}

/** The room for `heroId` pushed over a stand-in scene, as the training flow does. */
function room(heroId: string, run?: RunKit) {
  const h = makeGame();
  const hero = CHARACTERS.find((c) => c.id === heroId) ?? MARIO;
  const below: Scene = { update() {}, render() {} };
  h.game.scenes.push(below);
  const results: TrainingResult[] = [];
  const scene = new PracticeRoomScene(h.game, hero, {
    ...(run ? { run } : {}),
    onEnd: (r) => {
      results.push(r);
      h.game.scenes.pop();
    },
  });
  h.game.scenes.push(scene);
  return { h, scene, results, below };
}

/**
 * Plays the room with the scripted policies, pressing on at each card; returns the lessons in the
 * order they were ticked and the chapters' cards in the order they came.
 */
function play(heroId: string, max = 12000) {
  const r = room(heroId);
  const pol = policies();
  const ticked: string[] = [];
  const cards: number[] = [];
  let lesson = r.scene.lesson?.id;
  let since = 0;
  let phase = '';
  for (let i = 0; i < max && r.results.length === 0; i++) {
    const id = r.scene.lesson?.id;
    if (id !== lesson || r.scene.phase !== phase) {
      if (r.scene.phase === 'chapter' && phase !== 'chapter') cards.push(r.scene.chapter);
      lesson = id;
      phase = r.scene.phase;
      since = 0;
    }
    const policy = id ? (pol[`${heroId}:${id}`] ?? pol[id]) : undefined;
    const card = r.scene.phase === 'chapter' || r.scene.phase === 'ready';
    const act = card
      ? since > CARD_GUARD_FRAMES && since % 4 === 0
        ? (['jump'] as Action[])
        : []
      : r.scene.phase === 'lesson' && policy
        ? policy(r.scene.player, since, r.scene)
        : ([] as Action[]);
    r.h.step(act);
    since++;
  }
  ticked.push(...r.scene.ticked);
  return { ...r, ticked, cards };
}

describe('the practice room', () => {
  it('is one screen, outside the level library, with the pieces the lessons use', () => {
    const { level, dummy, geometry } = practiceRoom();
    expect(level.width).toBe(16);
    expect(level.camera).toBe('locked');
    expect(level.entities.some((e) => e.type === 'dummy')).toBe(false);
    expect(dummy).toEqual({ x: 9, y: 12 });
    expect(geometry.floorTop).toBe(208);
    expect(geometry.ledgeTop).toBe(128);
    expect(geometry.gap).toEqual({ x0: 176, x1: 208 });
    expect(geometry.tunnel.x1).toBeLessThanOrEqual(geometry.tunnel.x0);
    // The gear screen: a high ledge for the Rush Coil, a one-tile tunnel under a wall; the water
    // screen swims.
    const gear = practiceRoom('gear');
    expect(gear.level.width).toBe(16);
    expect(gear.geometry.ledgeTop).toBe(128);
    expect(gear.geometry.tunnel).toEqual({ x0: 192, x1: 224 });
    const water = practiceRoom('water');
    expect(water.level.swim).toBe(true);
    expect(water.level.camera).toBe('locked');
  });

  it.each(CHARACTERS.filter((c) => c.id !== 'mario').map((c) => [c.id]))(
    '%s: a scripted player completes every lesson, then READY! ends the room',
    (id) => {
      const r = play(id);
      expect(r.ticked).toEqual(lessonsFor(id).map((l) => l.id));
      expect(r.cards).toEqual(chaptersFor(id).map((_c, i) => i));
      expect(r.results).toEqual(['done']);
      expect(r.h.game.scenes.top).toBe(r.below);
      expect(r.h.said.some((t) => /^(Good! )?Ready!/.test(t))).toBe(true);
    },
  );

  it('shows one prompt at a time in a box near the top, announced, and ticks it off with GOOD! by the next', () => {
    const { h, scene } = room('link');
    h.step();
    // The first chapter's card waits for a button.
    expect(scene.phase).toBe('chapter');
    expect(draw(scene).texts.map((t) => t.str)).toEqual(
      expect.arrayContaining(['LINK TRAINING', 'CHAPTER 1/4', 'SWORD', 'ANY BUTTON TO START']),
    );
    expect(h.said.at(-1)).toMatch(
      /^Link training\. .*Chapter 1 of 4: Sword\. 4 lessons\. Any button to start\.$/,
    );
    h.idle(200);
    expect(scene.phase).toBe('chapter');
    pressOn(h);
    const first = lessonsFor('link')[0];
    const { texts } = draw(scene);
    expect(texts.some((t) => t.str === 'LINK SWORD 1/4')).toBe(true);
    expect(texts.some((t) => t.str === 'SWING YOUR SWORD AT THE')).toBe(true);
    expect(texts.filter((t) => t.y >= 36 && t.y < 80).length).toBeGreaterThan(1);
    expect(h.said.at(-1)).toMatch(/^Swing your sword .*at the dummy\./);
    expect(first?.id).toBe('sword');
    expect(draw(scene).texts.some((t) => t.str === 'GOOD!')).toBe(false);
    // The sword connects: a sound, and the next prompt at once with GOOD! by it.
    scene.tracker.hitDummy(['sword', 'melee']);
    h.step();
    expect([scene.phase, scene.lesson?.id]).toEqual(['lesson', 'down-thrust']);
    const after = draw(scene).texts;
    expect(after.some((t) => t.str === 'GOOD!')).toBe(true);
    expect(after.some((t) => t.str === 'LINK SWORD 2/4')).toBe(true);
    expect(h.said.at(-1)).toMatch(/^Good! Jump over the dummy/);
  });

  it('MENU: Continue goes back to the room; Skip chapter goes on to the next; Skip training ends it', () => {
    const { h, scene, results, below } = room('samus');
    h.idle(4);
    h.tap('start');
    expect(h.game.scenes.top).toBeInstanceOf(TrainingMenuScene);
    h.idle(8);
    h.tap('jump'); // Continue
    expect(h.game.scenes.top).toBe(scene);
    // Skip chapter, from the card or mid-lesson: the next chapter's card, in its own room.
    pressOn(h);
    expect(scene.phase).toBe('lesson');
    h.tap('start');
    h.idle(8);
    h.tap('down');
    expect(h.said.at(-1)).toMatch(/^Skip chapter/);
    h.tap('jump');
    expect(h.game.scenes.top).toBe(scene);
    expect([scene.phase, scene.chapter, scene.lesson?.id]).toEqual(['chapter', 1, 'missile']);
    expect(h.said.at(-1)).toMatch(/^Chapter 2 of 3: Missiles\./);
    h.tap('start');
    h.idle(8);
    h.tap('down');
    h.tap('jump'); // Skip chapter again: the morph ball's gear screen
    expect([scene.phase, scene.chapter]).toEqual(['chapter', 2]);
    expect(scene.world.level.id).toBe('practice-gear');
    expect(results).toEqual([]);
    h.tap('start');
    h.idle(8);
    h.tap('down');
    h.tap('down');
    expect(h.said.at(-1)).toMatch(/^Skip training/);
    h.tap('jump');
    expect(results).toEqual(['skip']);
    expect(h.game.scenes.top).toBe(below);
  });

  it('is safe: the gap puts the hero back at the start, hits never stick, the dummy comes back', () => {
    const { h, scene } = room('link');
    pressOn(h);
    const p = scene.player;
    p.body.x = 184 * 256;
    p.body.y = 150 * 256;
    h.until(() => p.body.onGround && toPx(p.body.y) < 208, 120);
    expect(cx(p)).toBe(88);
    expect(scene.world.players[0]?.dead).toBe(false);
    // Hurt: health is topped up again at once.
    scene.world.hurtPlayer(p);
    h.step();
    expect(p.hp).toBe(p.scratch.maxHp);
    // The dummy pops after three hits and stands up again.
    const d = scene.dummy as TargetDummy;
    for (let i = 0; i < 3; i++) d.hit({ kind: 'bomb', amount: 1, owner: null, dirX: 1 }, scene.world);
    expect(d.alive).toBe(false);
    h.idle(60);
    expect(scene.dummy).not.toBe(d);
    expect(scene.dummy?.alive).toBe(true);
    // It never hurts: walking into it does nothing.
    const hp = p.hp;
    p.body.x = (scene.dummy as TargetDummy).body.x;
    h.idle(4);
    expect(p.hp).toBe(hp);
    expect(p.invuln).toBe(0);
  });

  it("Link's shield lesson: the dummy shoots, and a shot on the shield counts while a hit does not", () => {
    const { h, scene } = room('link');
    pressOn(h);
    for (let i = 0; i < 2000 && scene.lesson?.id !== 'shield'; i++) {
      scene.tracker.hitDummy(['sword', 'melee', 'down-thrust']);
      scene.tracker.observe(scene.player, scene.world);
      (scene.tracker as unknown as { seen: Set<string> }).seen.add('upThrust');
      h.step();
    }
    expect(scene.lesson?.id).toBe('shield');
    expect(scene.dummyShoots).toBe(true);
    // Facing away: the shot gets through (blinking), nothing counts.
    for (let i = 0; i < 6; i++) h.step(['left']);
    h.until(() => scene.player.invuln > 0, 200);
    expect(scene.tracker.blocked).toBe(0);
    // Facing it, standing still: the shield blocks the next one.
    h.until(() => scene.player.stun === 0 && scene.player.body.onGround, 60);
    // (The hit knocked him back onto the step, above the shots: walk off it, toward the dummy.)
    for (let i = 0; i < 90 && cx(scene.player) < 96; i++) h.step(['right']);
    expect(scene.player.facing).toBe(1);
    h.until(() => scene.ticked.includes('shield'), 300);
    expect(scene.ticked).toContain('shield');
  });

  it('the HUD names the place instead of WORLD and TIME, with no score or coins', () => {
    const { h, scene } = room('megaman');
    h.step();
    const texts = draw(scene).texts.map((t) => t.str.trim());
    expect(texts).toContain('TRAINING');
    expect(texts).toContain('MEGA');
    expect(texts.some((t) => /WORLD|TIME|^\d{7}$|\$×/.test(t))).toBe(false);
  });

  it('the prompt box is centred, and prompts show the keys (bare names on touch, or when too long)', () => {
    const { h, scene } = room('link');
    h.game.deps.settings = defaultSettings();
    pressOn(h);
    const { texts } = draw(scene);
    const heading = texts.find((t) => t.str === 'LINK SWORD 1/4');
    expect(heading).toBeDefined();
    expect(heading && heading.x + (heading.str.length * 8) / 2).toBe(128);
    expect(scene.promptWrapped().join(' ')).toBe('SWING YOUR SWORD (X) AT THE DUMMY.');
    // Touch: the button carries the name itself.
    h.game.deps.settings.input.touch = 'on';
    expect(scene.promptWrapped().join(' ')).toBe('SWING YOUR SWORD AT THE DUMMY.');
    // A long key name that would push the prompt past three lines: the bare names.
    h.game.deps.settings.input.touch = 'off';
    scene.startLesson(4);
    const bound = h.game.deps.settings.input.bindings[0];
    if (bound) {
      bound.keyboard.special = ['ShiftRight'];
      bound.keyboard.select = ['ControlRight'];
    }
    expect(scene.promptWrapped().length).toBeLessThanOrEqual(ROOM_LINES);
    expect(scene.promptWrapped().join(' ')).toBe('USE TOOL THROWS THE BOOMERANG. TOOLS PICKS ANOTHER TOOL.');
  });

  it("Link's shield lesson works standing right next to the dummy too", () => {
    const { h, scene } = room('link');
    pressOn(h);
    scene.startLesson(3);
    expect(scene.lesson?.id).toBe('shield');
    for (let i = 0; i < 120 && cx(scene.player) < 134; i++) h.step(['right']);
    h.until(() => scene.ticked.includes('shield'), 200);
    expect(scene.ticked).toContain('shield');
  });

  it("Bill's spread fan counts as one direction: aiming is what counts", () => {
    const { h, scene } = room('bill');
    pressOn(h);
    scene.startLesson(1);
    // The Spread Gun found (the room starts from the rifle alone), in hand.
    Object.assign(scene.player.scratch, { 'has-spread-gun': 1, tool: 1 });
    for (let i = 0; i < 120; i++) h.step(i % 12 < 2 ? ['attack'] : []);
    expect(scene.tracker.shots).toBeGreaterThan(5);
    expect([...scene.tracker.shotKinds]).toEqual(['spread']);
    expect([...scene.tracker.shotDirs]).toEqual(['1,0']);
    expect(scene.phase).toBe('lesson');
  });

  it('gives the kit only inside the room: the run outside keeps its own', () => {
    const { h } = room('megaman');
    h.step();
    expect(h.game.state.kit).toEqual({});
    expect(h.game.state.character).toBe(MARIO);
  });
});

/**
 * The lessons that walking, jumping and the basic attack must not tick (the basic attack's own
 * lessons, and Link's shield, which blocks while he walks toward a shot, are left out).
 */
const MOVE_LESSONS: Record<string, string[]> = {
  luigi: ['high-jump', 'slippery-stop'],
  link: ['down-thrust', 'up-thrust', 'boomerang', 'shield-spell'],
  megaman: ['slide', 'charge', 'weapon', 'rush'],
  samus: ['aim-up', 'morph-ball', 'bomb', 'missile', 'long-beam'],
  simon: ['crouch-whip', 'dagger', 'committed-jump', 'stopwatch'],
  ryu: ['cling', 'wall-jump', 'throwing-star', 'jump-slash'],
  bill: ['aim', 'prone', 'jump-shoot'],
  sophia: ['hover', 'missile', 'wall-climb', 'jason', 'cannon-up'],
};

/** Walk back and forth between the step and the dummy, tap-jump now and then, attack on the ground. */
const unrelated = (p: Player, f: number, dir: { d: 1 | -1 }): Action[] => {
  if (cx(p) >= 136) dir.d = -1;
  else if (cx(p) <= 84) dir.d = 1;
  const walk: Action[] = [dir.d > 0 ? 'right' : 'left'];
  // A jump every 90 frames from the ground; attacks only on the ground, well after landing.
  if (f % 90 < 3 && p.body.onGround) return [...walk, 'jump'];
  if (p.body.onGround && f % 90 >= 60 && f % 8 < 2) return [...walk, 'attack'];
  // Sophia III with the Flower grips a ceiling she jumps into; holding down bumps it instead
  // (her guide's tip), so her jumps come back down like everyone's.
  if (p.def.id === 'sophia' && !p.body.onGround) return [...walk, 'down'];
  return walk;
};

describe('walking, jumping and the basic attack never tick a move lesson', () => {
  it.each(Object.entries(MOVE_LESSONS))('%s', (id, moves) => {
    expect(moves.every((m) => lessonsFor(id).some((l) => l.id === m))).toBe(true);
    for (const m of moves) {
      const { h, scene } = room(id);
      pressOn(h);
      scene.startLesson(lessonsFor(id).findIndex((l) => l.id === m));
      const dir = { d: 1 as 1 | -1 };
      for (let f = 0; f < 600; f++) h.step(unrelated(scene.player, f, dir));
      expect(scene.lesson?.id, `${id} ${m}`).toBe(m);
      expect(scene.phase, `${id} ${m}`).toBe('lesson');
      // The script did walk, jump and attack.
      expect(scene.tracker.jumps).toBeGreaterThanOrEqual(4);
      // (Small Luigi's attack button runs.)
      if (id !== 'luigi') expect(scene.tracker.attacks + scene.tracker.shots).toBeGreaterThan(5);
    }
  });
});

describe("the heroes' standout moves really are measured as the lessons say", () => {
  const level = practiceRoom().level;
  it("Luigi's held standing jump clears LUIGI_HIGH_JUMP_PX; a tap and Mario's don't", () => {
    const peak = (hold: number, c = LUIGI) => {
      let best = Infinity;
      runSim({
        level,
        character: c,
        maxFrames: 160,
        script: {
          steps: [
            { frame: 0, hold: ['right'] },
            { frame: 40, hold: [] },
            { frame: 70, hold: ['jump'] },
            { frame: 70 + hold, hold: [] },
          ],
        },
        until: (w) => {
          best = Math.min(best, toPx(w.player.body.y + w.player.body.h));
          return false;
        },
      });
      return 208 - best;
    };
    expect(peak(40)).toBeGreaterThanOrEqual(LUIGI_HIGH_JUMP_PX);
    expect(peak(4)).toBeLessThan(LUIGI_HIGH_JUMP_PX);
    expect(peak(40, MARIO)).toBeLessThan(LUIGI_HIGH_JUMP_PX);
  });

  it('Luigi glides LUIGI_COAST_PX after letting go from a run; Mario stops sooner', () => {
    // On 1-1's long first floor: run right for 40 frames, then let go.
    const coast = (c = LUIGI) => {
      let from = 0;
      const r = runSim({
        level: getLevel('1-1'),
        character: c,
        maxFrames: 300,
        script: {
          steps: [
            { frame: 0, hold: ['right', 'attack'] },
            { frame: 40, hold: [] },
          ],
        },
        until: (w, f) => {
          if (f === 40) from = toPx(w.player.body.x);
          return f > 40 && w.player.body.vx === 0;
        },
      });
      return toPx(r.world.player.body.x) - from;
    };
    expect(coast()).toBeGreaterThanOrEqual(LUIGI_COAST_PX);
    expect(coast(MARIO)).toBeLessThan(LUIGI_COAST_PX);
  });
});

describe('the kit lessons measure the real thing', () => {
  it("Samus's long-range hit needs the Long Beam: the Power Beam fizzles short from the far left", () => {
    for (const beam of [0, 1]) {
      const { h, scene } = room('samus');
      pressOn(h);
      scene.startLesson(lessonsFor('samus').findIndex((l) => l.id === 'long-beam'));
      scene.player.scratch.beam = beam;
      const p = scene.player;
      for (let f = 0; f < 240 && !scene.ticked.includes('long-beam'); f++)
        h.step(cx(p) > 20 ? ['left'] : p.facing < 0 ? ['right'] : tapEvery(f, 'attack', 10));
      expect(scene.ticked.includes('long-beam'), `beam ${beam}`).toBe(!!beam);
      if (!beam) expect(scene.tracker.shots).toBeGreaterThan(3);
    }
  });

  it("Mega Man's jump on land stays under SEABED_JUMP_PX; off the seabed it clears it", () => {
    const { h, scene } = room('megaman');
    pressOn(h);
    // In the gear screen's open floor (the Rush lesson: a jump alone does not tick it).
    scene.startLesson(lessonsFor('megaman').findIndex((l) => l.id === 'rush'));
    for (let f = 0; f < 120; f++) h.step(f < 60 ? ['jump'] : []);
    expect(scene.tracker.maxJumpHeight).toBeGreaterThan(32);
    expect(scene.tracker.maxJumpHeight).toBeLessThan(SEABED_JUMP_PX);
    scene.startLesson(lessonsFor('megaman').findIndex((l) => l.id === 'seabed-jump'));
    expect(scene.world.level.id).toBe('practice-water');
    for (let f = 0; f < 200 && scene.phase === 'lesson'; f++) h.step(['jump']);
    expect(scene.ticked).toContain('seabed-jump');
  });

  it('sliding and rolling count only through the low wall', () => {
    const { h, scene } = room('megaman');
    pressOn(h);
    scene.startLesson(lessonsFor('megaman').findIndex((l) => l.id === 'slide'));
    // Sliding the other way, along the open floor.
    for (let f = 0; f < 120; f++) h.step(f < 4 ? ['left'] : f % 20 < 2 ? ['down', 'jump'] : ['down']);
    expect(scene.tracker.slid).toBe(true);
    expect(scene.phase).toBe('lesson');
  });
});

describe('the skip hint', () => {
  it('sits on the prompt box, clear of the floor and the gap', () => {
    for (const id of ['luigi', 'link', 'megaman']) {
      const { h, scene } = room(id);
      pressOn(h);
      const skip = draw(scene).texts.find((t) => t.str.endsWith('TO SKIP'));
      expect(skip, id).toBeDefined();
      // Well above the room's ledge and floor: on the box's bottom edge, under the HUD.
      expect(skip && skip.y + 8, id).toBeLessThanOrEqual(practiceRoom().geometry.ledgeTop);
      expect(skip && skip.y, id).toBeGreaterThan(44);
    }
  });
});
