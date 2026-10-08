import type { Action } from '@engine/input/actions';
import { toPx } from '@engine/math/units';
import type { Player } from '@game/entities/player';
import { HeroItem } from '@game/entities/objects/hero-item';
import { PowerUp } from '@game/entities/objects/powerup';
import { activeTool } from '@game/characters/toolbelt';
import type { PracticeRoomScene } from '@game/tutorial/room';

/*
 * Scripted players for Simon's, Ryu's, Bill's, Sophia III's and Luigi's training (0.4.34): one
 * policy per lesson, keyed `<hero>:<lesson id>` (training-room.test.ts's `play` looks those up
 * first). Each item lesson walks to the placed power-up first (`grabbing`), then does the move.
 */

/**
 * What a scripted player does for one lesson: held actions from the player, the frames since it
 * began, and the room.
 */
export type Policy = (p: Player, f: number, s: PracticeRoomScene) => Action[];

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

/** The power-up the room placed, while it is still there. */
export function placedItem(s: PracticeRoomScene): HeroItem | PowerUp | null {
  for (const e of s.world.entities) if (e.alive && (e instanceof HeroItem || e instanceof PowerUp)) return e;
  return null;
}

/**
 * Walk to the placed power-up (letting go of a wall or ceiling first), then play `then`.
 */
export const grabbing =
  (then: Policy): Policy =>
  (p, f, s) => {
    const item = placedItem(s);
    if (!item) return then(p, f, s);
    // Sophia III lets go of a wall or ceiling first.
    if (p.scratch._wall || p.scratch._ceiling) return f % 4 < 2 ? ['down', 'jump'] : [];
    const at = toPx(item.body.x + (item.body.w >> 1));
    return goTo(p, at);
  };

/** Turn to face the dummy (right) first: a shot fired left from the item spot hits the step. */
const facingRight =
  (then: Policy): Policy =>
  (p, f, s) =>
    p.facing < 0 ? ['right'] : then(p, f, s);

/** The policies for TC's heroes. */
export function tcPolicies(): Record<string, Policy> {
  let wasClose = false;
  let out = false;
  const committedJump: Policy = (p, f) =>
    p.body.onGround && cx(p) < 208
      ? cx(p) < 160
        ? ['right']
        : f % 4 < 2
          ? ['right', 'jump']
          : ['right']
      : [];
  let released = false;
  let backed = false;
  return {
    // Luigi
    'luigi:high-jump': (p, f) => (Math.abs(cx(p) - 140) > 3 ? goTo(p, 140) : f % 60 < 45 ? ['jump'] : []),
    'luigi:slippery-stop': (p) => {
      if (!backed) {
        backed = cx(p) <= 72;
        return ['left'];
      }
      if (!released && cx(p) >= 112) released = true;
      return released ? [] : ['right', 'attack'];
    },
    'luigi:mushroom': grabbing((p, f) => {
      // Under the brick at column 7 (112-128 px), then jump into it.
      if (Math.abs(cx(p) - 120) > 3) return goTo(p, 120);
      return f % 40 < 20 ? ['jump'] : [];
    }),
    'luigi:fireball': grabbing((p, f) =>
      cx(p) > 124 ? ['left'] : p.facing < 0 ? ['right'] : tapEvery(f, 'attack', 12),
    ),
    // Simon
    'simon:whip': (p, f) => (cx(p) < 128 ? goTo(p, 130) : tapEvery(f, 'attack', 30)),
    'simon:crouch-whip': (_p, f) => ['down', ...tapEvery(f, 'attack', 30)],
    'simon:committed-jump': committedJump,
    'simon:pot-roast': grabbing(() => []),
    'simon:chain-whip': grabbing((p, f) => (cx(p) < 122 ? goTo(p, 124) : tapEvery(f, 'attack', 30))),
    'simon:dagger': grabbing((p, f) => (p.facing < 0 ? ['right'] : tapEvery(f, 'special', 20))),
    'simon:hearts': (_p, f) => tapEvery(f, 'special', 24),
    'simon:holy-water': grabbing(facingRight(pick('holy-water', 'special', 30))),
    'simon:hand-axe': grabbing(facingRight(pick('hand-axe', 'special', 30))),
    'simon:morning-star': grabbing((p, f) => (cx(p) < 116 ? goTo(p, 118) : tapEvery(f, 'attack', 30))),
    'simon:cross': grabbing(facingRight(pick('cross', 'special', 30))),
    'simon:double-shot': grabbing(facingRight(pick('hand-axe', 'special', 14))),
    'simon:stopwatch': grabbing((p, f, s) =>
      p.facing < 0 ? ['right'] : pick('stopwatch', 'special', 30)(p, f, s),
    ),
    'simon:triple-shot': grabbing(facingRight(pick('hand-axe', 'special', 14))),
    // Ryu
    'ryu:slash': (p, f) => (cx(p) < 126 ? goTo(p, 128) : tapEvery(f, 'attack', 14)),
    'ryu:cling': (p, f) =>
      p.body.onGround && cx(p) >= 160 ? (f % 4 < 2 ? ['right', 'jump'] : ['right']) : ['right'],
    'ryu:wall-jump': (p, f) => {
      if (p.clinging) {
        const go: Action[] = wasClose ? ['right', 'jump'] : ['right'];
        wasClose = !wasClose;
        return go;
      }
      return p.body.onGround && cx(p) >= 160 ? (f % 4 < 2 ? ['right', 'jump'] : ['right']) : ['right'];
    },
    'ryu:medicine': grabbing(() => []),
    'ryu:throwing-star': grabbing(facingRight((_p, f) => tapEvery(f, 'special', 20))),
    'ryu:ninpo-scroll': grabbing(() => []),
    'ryu:windmill': grabbing(facingRight(pick('windmill', 'special', 30))),
    'ryu:fire-wheel': grabbing(facingRight(pick('fire-wheel', 'special', 30))),
    'ryu:jump-slash': grabbing(pick('slash', 'special', 40)),
    // Bill
    'bill:shoot': (_p, f) => tapEvery(f, 'attack', 10),
    'bill:aim': (_p, f) => {
      const k = Math.floor(f / 20) % 3;
      const hold: Action[] = k === 0 ? [] : k === 1 ? ['up'] : ['up', 'right'];
      return [...hold, ...tapEvery(f, 'attack', 10)];
    },
    'bill:prone': () => ['down'],
    'bill:jump-shoot': (p, f) => (p.body.onGround ? tapEvery(f, 'jump', 20) : tapEvery(f, 'attack', 4)),
    'bill:medal': grabbing(() => []),
    'bill:mg': grabbing(facingRight(() => ['attack'])),
    'bill:laser': grabbing(facingRight((_p, f) => tapEvery(f, 'attack', 20))),
    'bill:flame-gun': grabbing(facingRight((_p, f) => tapEvery(f, 'attack', 20))),
    'bill:spread': grabbing(facingRight((_p, f) => tapEvery(f, 'attack', 12))),
    'bill:swim-shoot': (_p, f) => [...tapEvery(f, 'jump', 12), ...tapEvery(f + 6, 'attack', 6)],
    // Sophia III
    'sophia:drive-jump': (p, f) =>
      p.body.onGround && cx(p) < 208
        ? cx(p) < 150
          ? ['right']
          : f % 4 < 2
            ? ['right', 'jump']
            : ['right']
        : ['right', 'jump'],
    'sophia:cannon': (p, f) =>
      cx(p) > 104 ? ['left'] : p.facing < 0 ? ['right'] : tapEvery(f, 'attack', 10),
    'sophia:cannon-up': (_p, f) => ['up', ...tapEvery(f, 'attack', 10)],
    // Out on the floor with EXIT; once out, UP by the tank gets him back in.
    'sophia:jason': (p, f) => {
      if (p.scratch._jason) out = true;
      if (!out) return p.body.onGround && f % 10 === 0 ? ['select'] : [];
      return f % 10 < 2 ? ['up'] : [];
    },
    'sophia:hover': grabbing((p, f) =>
      p.body.onGround ? tapEvery(f, 'jump', 40) : f % 40 >= 12 ? ['jump'] : [],
    ),
    'sophia:crusher': grabbing((p, f) =>
      cx(p) > 104 ? ['left'] : p.facing < 0 ? ['right'] : tapEvery(f, 'attack', 10),
    ),
    'sophia:missile': grabbing(facingRight((_p, f) => tapEvery(f, 'special', 10))),
    // Over the gap with a held jump, then up the tall wall.
    'sophia:wall-climb': grabbing((p, f) => {
      if (!p.body.onGround) return ['right', 'up', 'jump'];
      return cx(p) > 150 && cx(p) < 176 && f % 2 ? ['right', 'up', 'jump'] : ['right', 'up'];
    }),
    // Under the brick row (80-128 px), then a held jump into it.
    'sophia:ceiling-climb': grabbing((p, f) => {
      if (p.body.onGround) return Math.abs(cx(p) - 104) > 3 ? goTo(p, 104) : f % 4 < 2 ? ['jump'] : [];
      return ['jump'];
    }),
    'sophia:homing': grabbing(
      facingRight((p, f) =>
        tool(p) !== 'homing' ? (f % 8 === 0 ? ['down', 'special'] : []) : tapEvery(f, 'special', 20),
      ),
    ),
  };
}
