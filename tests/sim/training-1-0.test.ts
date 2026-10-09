import { describe, expect, it } from 'vitest';
import type { Action } from '@engine/input/actions';
import { tileAt, tileToSub, toPx } from '@engine/math/units';
import { LevelScene } from '@game/scenes/level';
import { CardScene } from '@game/scenes/message';
import { WorldMapScene } from '@game/scenes/world-map';
import { Goomba } from '@game/entities/enemies/goomba';
import { Vine } from '@game/entities/objects/vine';
import { T } from '@game/level/tiles';
import { MARIO_10, MARIO_LESSONS, SPRINT_FRAMES } from '@game/tutorial/mario-1-0';
import { GATE_STOP_FRAMES } from '@game/tutorial/stage-tutorial';
import { file, makeGame, useStorage, type H } from './heroes-harness';
import { playTutorial, tutorialBot } from './tutorial-bot';

// 1-0's training as the owner asked for it in 0.4.36 (tutorial/mario-1-0.ts): a real sustained
// sprint opens the stretch's gate (walking, tapping RUN or a short burst never does); two gaps only a
// sprinting jump clears, a fall dropping Mario back in before the gap; a task walked past is put
// back (a gate, Toad's card waiting for a press, never mid-move or mid-jump); the hidden vine at the
// tall wall's foot; the bricks only big Mario breaks.

useStorage();

const M = MARIO_10;
const level = (h: H) => h.top() as LevelScene;
const director = (h: H) => level(h).tutorial;
const lessonId = (h: H) => (h.top() instanceof LevelScene ? director(h)?.lesson?.id : undefined);
const col = (h: H) => tileAt(level(h).world.player.centerX);
const at = (id: string) => MARIO_LESSONS.find((l) => l.id === id)?.at;

/** A campaign file on 1-0, past Toad's greeting, played by the bot up to lesson `id`. */
function upTo(id: string): H {
  const h = makeGame();
  file();
  h.game.openFile(1);
  h.idle(8);
  h.tap('jump');
  h.until(() => h.top() instanceof LevelScene, 300);
  h.until(() => h.top() instanceof CardScene, 60);
  for (let i = 0; i < 20 && h.top() instanceof CardScene; i++) {
    h.idle(32);
    h.tap('jump');
  }
  playTutorial(h, () => lessonId(h) === id);
  return h;
}

/**
 * Steps `input(frame)` until Toad's card shows (max frames), and checks the card came with the
 * player standing still on the ground (never mid-move, never mid-jump). Returns the card.
 */
function untilCard(h: H, input: (f: number) => Action[], max = 2400): CardScene {
  let last = { ground: false, vx: 0 };
  for (let f = 0; f < max && !(h.top() instanceof CardScene); f++) {
    const b = level(h).world.player.body;
    last = { ground: b.onGround, vx: Math.abs(b.vx) };
    h.step(input(f));
  }
  expect(h.top()).toBeInstanceOf(CardScene);
  expect(last.ground).toBe(true);
  expect(last.vx).toBeLessThan(0x400);
  return h.top() as CardScene;
}

/** Steps `input` until `stop` holds (at most `max` frames), and checks it did. */
function hold(h: H, input: Action[], stop: () => boolean, max: number): void {
  for (let i = 0; i < max && !stop(); i++) h.step(input);
  expect(stop()).toBe(true);
}

/** OK on Toad's card: back in the level, standing. */
function okCard(h: H): void {
  h.idle(40);
  h.tap('jump');
  h.until(() => h.top() instanceof LevelScene && level(h).world.player.body.onGround, 200);
}

describe('the sprint: walk, sprint at top speed until the bar fills, walk', () => {
  it('walking, tapping RUN or a short burst never opens the gate; Toad waits, then puts Mario back', () => {
    const h = upTo('sprint');
    expect(director(h)?.closedGates).toContain(M.sprintGate);
    const tries: [string, (f: number) => Action[]][] = [
      ['walk', () => ['right']],
      ['taps of RUN', (f) => (f % 24 < 8 ? ['right', 'run'] : ['right'])],
      ['a short burst', (f) => (f < SPRINT_FRAMES + 10 ? ['right', 'run'] : ['right'])],
    ];
    for (const [what, input] of tries) {
      const card = untilCard(h, input);
      expect(card.lines[0], what).toBe('TOAD:');
      expect(card.lines.join(' '), what).toMatch(/SPRINT/);
      // Stopped at the gate, it is still shut; the card waits for a press.
      expect(col(h), what).toBe(M.sprintGate - 1);
      h.idle(300);
      expect(h.top(), what).toBeInstanceOf(CardScene);
      okCard(h);
      expect(col(h), what).toBe(M.sprintFrom);
      expect(lessonId(h), what).toBe('sprint');
      expect(director(h)?.closedGates, what).toContain(M.sprintGate);
    }
    // A real sprint: RUN held at top speed until the bar fills, then a walk.
    hold(h, ['right', 'run'], () => lessonId(h) === 'ease', 600);
    hold(h, ['right'], () => lessonId(h) === 'gap1', 300);
    expect(director(h)?.closedGates).not.toContain(M.sprintGate);
    expect(level(h).world.map.isSolid(M.sprintGate, 12)).toBe(false);
    hold(h, ['right'], () => col(h) > M.sprintGate + 1, 900);
  });

  it('the bar shows the run-up, then fills only while top speed is held', () => {
    const h = upTo('sprint');
    const sprint = MARIO_LESSONS.find((l) => l.id === 'sprint')!;
    const w = () => level(h).world;
    for (let i = 0; i < 30; i++) h.step(['right']);
    const walking = sprint.meter!(w());
    expect(walking).toBeGreaterThan(0);
    expect(walking).toBeLessThan(0.3);
    for (let i = 0; i < 40; i++) h.step(['right', 'run']);
    expect(sprint.meter!(w())).toBeGreaterThan(0.3);
    expect(lessonId(h)).toBe('sprint');
    // Letting go empties it again.
    for (let i = 0; i < 40; i++) h.step(['right']);
    expect(sprint.meter!(w())).toBeLessThan(0.3);
  });
});

describe('the gaps: only a sprinting jump clears them', () => {
  it('a walking jump falls short of each (back a few steps before it, no life lost); a sprint clears both', () => {
    const h = upTo('gap1');
    const lives = h.game.state.lives;
    for (const [id, gap, next] of [
      ['gap1', M.gap1, 'gap2'],
      ['gap2', M.gap2, 'stomp'],
    ] as const) {
      // Walk to the edge and jump from it, holding JUMP all the way.
      let fell = false;
      let back = false;
      for (let i = 0; i < 1200 && !back; i++) {
        const b = level(h).world.player.body;
        const input: Action[] = ['right'];
        if ((b.onGround && toPx(b.x + b.w) >= gap.x * 16 - 2) || (!b.onGround && b.vy < 0))
          input.push('jump');
        h.step(input);
        const y = level(h).world.player.body.y;
        fell ||= y > tileToSub(13);
        back = fell && y < tileToSub(2);
      }
      expect(back, `${id}: ${col(h)}`).toBe(true);
      h.until(() => level(h).world.player.body.onGround, 120);
      expect(col(h), id).toBe(gap.back);
      expect(lessonId(h), id).toBe(id);
      expect(h.game.state.lives, id).toBe(lives);
      // From there, a sprint and a jump from the edge clear it.
      for (let i = 0; i < 600 && lessonId(h) !== next; i++) h.step(tutorialBot(h));
      expect(lessonId(h), id).toBe(next);
      expect(col(h), id).toBeGreaterThanOrEqual(gap.x + gap.w);
    }
  });
});

describe('a task walked past is put back, never mid-move', () => {
  it('jump the Goomba and walk on: at the gate Toad waits for a press, then Mario stands before a fresh Goomba', () => {
    const h = upTo('stomp');
    // Over the Goomba with a running jump, and on to the gate.
    const card = untilCard(h, () => {
      const w = level(h).world;
      const b = w.player.body;
      const g = w.entities.find((e) => e instanceof Goomba && e.alive);
      const input: Action[] = ['right'];
      const near = g && g.body.x > b.x && g.body.x - b.x < tileToSub(4);
      if ((b.onGround && near) || (!b.onGround && b.vy < 0)) input.push('jump');
      if (!b.onGround || near) input.push('run');
      return input;
    });
    expect(level(h).world.feats.stomps).toBe(0);
    expect(card.lines.join(' ')).toMatch(/STOMP THE GOOMBA/);
    expect(col(h)).toBe(M.stompGate - 1);
    expect(h.said.at(-1)).toMatch(/^TOAD: STOMP THE GOOMBA/);
    h.idle(600);
    expect(h.top()).toBeInstanceOf(CardScene);
    okCard(h);
    expect(col(h)).toBe(at('stomp'));
    expect(lessonId(h)).toBe('stomp');
    h.until(() => level(h).world.entities.some((e) => e instanceof Goomba && e.alive), 300);
    // A bump into the gate on the way is not a stop: no card until he stands there.
    expect(GATE_STOP_FRAMES).toBeGreaterThanOrEqual(20);
  });

  it('a jump against the gate never brings the card while in the air', () => {
    const h = upTo('stomp');
    for (const e of level(h).world.entities) if (e instanceof Goomba) e.destroy();
    // Walk to the gate, then keep hopping against it: no card while he hops.
    hold(h, ['right'], () => col(h) === M.stompGate - 1, 900);
    for (let i = 0; i < 240; i++) {
      const b = level(h).world.player.body;
      h.step(
        b.onGround && (i & 1) === 0
          ? ['right', 'jump']
          : ['right', ...(b.vy < 0 ? (['jump'] as Action[]) : [])],
      );
      expect(h.top(), `frame ${i}`).toBeInstanceOf(LevelScene);
    }
  });
});

describe('the hidden vine and the brick wall', () => {
  it("an empty-looking spot at the tall wall's foot hides a vine, the only way over", () => {
    const h = upTo('vine');
    const w = () => level(h).world;
    expect(w().map.get(M.vine.x, M.vine.y)).toBe(T.HIDDEN_VINE);
    expect(w().map.isSolid(M.vine.x, M.vine.y)).toBe(false);
    for (let row = M.vineWall.top; row <= 12; row++) expect(w().map.isSolid(M.vineWall.from, row)).toBe(true);
    expect(w().entities.some((e) => e instanceof Vine)).toBe(false);
    expect(h.said.at(-1)).toMatch(/SOME BLOCKS ARE HIDDEN/);
    playTutorial(h, () => lessonId(h) === 'climb');
    expect(w().entities.some((e) => e instanceof Vine && e.alive)).toBe(true);
    expect(w().map.isSolid(M.vine.x, M.vine.y)).toBe(true);
    playTutorial(h, () => lessonId(h) === 'wall');
    const b = w().player.body;
    expect(b.y + b.h).toBeLessThanOrEqual(tileToSub(M.vineWall.top));
  });

  it('small Mario only bumps the bricks; big Mario smashes up through them', () => {
    const h = upTo('wall');
    const w = () => level(h).world;
    const shut = () => w().map.isSolid(M.bricks.to, 9) || w().map.isSolid(M.bricks.to, 10);
    // Small: the bot jumps into them for a while, and they hold.
    const p = w().player;
    p.powerState = 'small';
    p.refitHitbox();
    h.game.state.powerState = 'small';
    for (let i = 0; i < 900; i++) h.step(tutorialBot(h));
    expect(shut()).toBe(true);
    expect(lessonId(h)).toBe('wall');
    // Big again: through, and onto the step out.
    p.powerState = 'big';
    p.refitHitbox();
    h.game.state.powerState = 'big';
    playTutorial(h, () => lessonId(h) === 'flag');
    expect(shut()).toBe(false);
    expect(w().feats.bricks).toBeGreaterThanOrEqual(2);
  });

  it('past the mushroom, a respawn comes back big (the brick wall needs it)', () => {
    const h = upTo('vine');
    level(h).world.kill(level(h).world.player);
    h.until(() => h.top() instanceof LevelScene && level(h).world.frame > 30, 600);
    expect(lessonId(h)).toBe('vine');
    expect(level(h).world.player.powerState).toBe('big');
  });

  it('the whole stage, then the map', () => {
    const h = upTo('flag');
    playTutorial(h, () => h.top() instanceof WorldMapScene, 3000);
  });
});
