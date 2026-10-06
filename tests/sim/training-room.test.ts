import { describe, expect, it } from 'vitest';
import type { Action } from '@engine/input/actions';
import { toPx } from '@engine/math/units';
import type { Scene } from '@engine/scene';
import { CHARACTERS } from '@game/characters/registry';
import { LUIGI } from '@game/characters/luigi';
import { MARIO } from '@game/characters/mario';
import type { Player } from '@game/entities/player';
import { lessonsFor, LUIGI_HIGH_JUMP_PX, LUIGI_COAST_PX } from '@game/tutorial/lessons';
import {
  PracticeRoomScene,
  practiceRoom,
  PROMPT_LINES,
  TrainingMenuScene,
  type TrainingResult,
} from '@game/tutorial/room';
import { defaultSettings } from '@engine/save/settings';
import type { TargetDummy } from '@game/tutorial/dummy';
import { runSim } from '@game/sim/headless';
import { getLevel } from '@content/levels';
import { draw, makeGame, useStorage } from './heroes-harness';

useStorage();

/** What a scripted player does for one lesson: held actions from the player and frames since it began. */
type Policy = (p: Player, f: number) => Action[];

const cx = (p: Player) => toPx(p.centerX);
const tapEvery = (f: number, a: Action, n = 8): Action[] => (f % n < 2 ? [a] : []);
/** Walk until the centre is near `x` px (within 3 px), then nothing. */
const goTo = (p: Player, x: number): Action[] => (cx(p) < x - 3 ? ['right'] : cx(p) > x + 3 ? ['left'] : []);

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
    'morph-ball': (_p, f) => tapEvery(f, 'down', 10),
    bomb: (_p, f) => tapEvery(f, 'attack', 10),
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
  };
}

/** The room for `heroId` pushed over a stand-in scene, as the training flow does. */
function room(heroId: string) {
  const h = makeGame();
  const hero = CHARACTERS.find((c) => c.id === heroId) ?? MARIO;
  const below: Scene = { update() {}, render() {} };
  h.game.scenes.push(below);
  const results: TrainingResult[] = [];
  const scene = new PracticeRoomScene(h.game, hero, {
    onEnd: (r) => {
      results.push(r);
      h.game.scenes.pop();
    },
  });
  h.game.scenes.push(scene);
  return { h, scene, results, below };
}

/** Plays the room with the scripted policies; returns the lessons in the order they were ticked. */
function play(heroId: string, max = 4000) {
  const r = room(heroId);
  const pol = policies();
  const ticked: string[] = [];
  let lesson = r.scene.lesson?.id;
  let since = 0;
  for (let i = 0; i < max && r.results.length === 0; i++) {
    const id = r.scene.lesson?.id;
    if (id !== lesson) {
      lesson = id;
      since = 0;
    }
    const act =
      r.scene.phase === 'lesson' && id ? (pol[id]?.(r.scene.player, since) ?? []) : ([] as Action[]);
    if (r.scene.phase === 'good' && lesson && ticked.at(-1) !== lesson) ticked.push(lesson);
    r.h.step(act);
    since++;
  }
  return { ...r, ticked };
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
  });

  it.each(CHARACTERS.filter((c) => c.id !== 'mario').map((c) => [c.id]))(
    '%s: a scripted player completes every lesson, then READY! ends the room',
    (id) => {
      const r = play(id);
      expect(r.ticked).toEqual(lessonsFor(id).map((l) => l.id));
      expect(r.results).toEqual(['done']);
      expect(r.h.game.scenes.top).toBe(r.below);
      expect(r.h.said.some((t) => /^Ready!/.test(t))).toBe(true);
    },
  );

  it('shows one prompt at a time in a box near the top, announced, and ticks it off with GOOD!', () => {
    const { h, scene } = room('link');
    h.step();
    const first = lessonsFor('link')[0];
    const { texts } = draw(scene);
    expect(texts.some((t) => t.str === 'LINK TRAINING 1/5')).toBe(true);
    expect(texts.some((t) => t.str === 'SWING YOUR SWORD AT THE')).toBe(true);
    expect(texts.filter((t) => t.y >= 36 && t.y < 80).length).toBeGreaterThan(1);
    expect(h.said.some((t) => /Link training\. .*Swing your sword at the dummy\./.test(t))).toBe(true);
    expect(first?.id).toBe('sword');
    // The sword connects: GOOD! and a sound, then the next prompt.
    scene.tracker.hitDummy(['sword', 'melee']);
    h.step();
    expect(scene.phase).toBe('good');
    expect(draw(scene).texts.some((t) => t.str === 'GOOD!')).toBe(true);
    expect(h.said.at(-1)).toBe('Good!');
    h.idle(60);
    expect(scene.lesson?.id).toBe('down-thrust');
    expect(h.said.at(-1)).toMatch(/^Jump over the dummy/);
  });

  it('MENU: Continue goes back to the room; Skip training ends it', () => {
    const { h, scene, results, below } = room('samus');
    h.idle(4);
    h.tap('start');
    expect(h.game.scenes.top).toBeInstanceOf(TrainingMenuScene);
    h.idle(8);
    h.tap('jump'); // Continue
    expect(h.game.scenes.top).toBe(scene);
    h.tap('start');
    h.idle(8);
    h.tap('down');
    expect(h.said.at(-1)).toMatch(/^Skip training/);
    h.tap('jump');
    expect(results).toEqual(['skip']);
    expect(h.game.scenes.top).toBe(below);
  });

  it('is safe: the gap puts the hero back at the start, hits never stick, the dummy comes back', () => {
    const { h, scene } = room('link');
    h.step();
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
    h.step();
    while (scene.lesson?.id !== 'shield') {
      scene.tracker.hitDummy(['sword', 'melee', 'down-thrust']);
      scene.tracker.observe(scene.player, scene.world);
      (scene.tracker as unknown as { seen: Set<string> }).seen.add('upThrust');
      h.step();
    }
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
    h.until(() => scene.phase === 'good', 300);
    expect(scene.tracker.blocked).toBe(1);
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
    h.step();
    const { texts } = draw(scene);
    const heading = texts.find((t) => t.str === 'LINK TRAINING 1/5');
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
    expect(scene.promptWrapped().length).toBeLessThanOrEqual(PROMPT_LINES);
    expect(scene.promptWrapped().join(' ')).toBe('USE TOOL THROWS THE BOOMERANG. TOOLS PICKS ANOTHER TOOL.');
  });

  it("Link's shield lesson works standing right next to the dummy too", () => {
    const { h, scene } = room('link');
    h.step();
    scene.startLesson(3);
    expect(scene.lesson?.id).toBe('shield');
    for (let i = 0; i < 120 && cx(scene.player) < 134; i++) h.step(['right']);
    h.until(() => scene.phase === 'good', 200);
    expect(scene.tracker.blocked).toBe(1);
  });

  it("Bill's spread fan counts as one direction: aiming is what counts", () => {
    const { h, scene } = room('bill');
    h.step();
    scene.startLesson(1);
    scene.player.scratch.tool = 2; // the spread gun
    for (let i = 0; i < 120; i++) h.step(i % 12 < 2 ? ['attack'] : []);
    expect(scene.tracker.shots).toBeGreaterThan(5);
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
  link: ['down-thrust', 'up-thrust', 'boomerang'],
  megaman: ['slide', 'charge', 'weapon'],
  samus: ['aim-up', 'morph-ball', 'bomb', 'missile'],
  simon: ['crouch-whip', 'sub-weapon', 'committed-jump'],
  ryu: ['cling', 'wall-jump', 'ninpo'],
  bill: ['aim', 'prone', 'jump-shoot'],
};

/** Walk back and forth between the step and the dummy, tap-jump now and then, attack on the ground. */
const unrelated = (p: Player, f: number, dir: { d: 1 | -1 }): Action[] => {
  if (cx(p) >= 136) dir.d = -1;
  else if (cx(p) <= 84) dir.d = 1;
  const walk: Action[] = [dir.d > 0 ? 'right' : 'left'];
  // A jump every 90 frames from the ground; attacks only on the ground, well after landing.
  if (f % 90 < 3 && p.body.onGround) return [...walk, 'jump'];
  if (p.body.onGround && f % 90 >= 60 && f % 8 < 2) return [...walk, 'attack'];
  return walk;
};

describe('walking, jumping and the basic attack never tick a move lesson', () => {
  it.each(Object.entries(MOVE_LESSONS))('%s', (id, moves) => {
    expect(moves.every((m) => lessonsFor(id).some((l) => l.id === m))).toBe(true);
    for (const m of moves) {
      const { h, scene } = room(id);
      h.step();
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
