import type { Action } from '@engine/input/actions';
import { toPx } from '@engine/math/units';
import type { Scene } from '@engine/scene';
import { CHARACTERS } from '@game/characters/registry';
import { activeTool } from '@game/characters/toolbelt';
import type { Player } from '@game/entities/player';
import { HeroItem } from '@game/entities/objects/hero-item';
import { RushCoil } from '@game/entities/objects/rush-coil';
import { CARD_GUARD_FRAMES, PracticeRoomScene, type TrainingResult } from '@game/tutorial/room';
import { makeGame } from './heroes-harness';

/*
 * Scripted players for Link's, Mega Man's and Samus's training (0.4.34: each lesson with an item
 * walks to the placed power-up first, then uses it). Keyed `<hero>:<lesson>`, so they take
 * precedence over training-room.test.ts's shared policies, which spread them in.
 */

/** Held actions for one lesson: the player, the frames since it began (or since the grab), the room. */
export type Policy = (p: Player, f: number, s: PracticeRoomScene) => Action[];

const cx = (p: Player) => toPx(p.centerX);
const tapEvery = (f: number, a: Action, n = 8): Action[] => (f % n < 2 ? [a] : []);
const goTo = (p: Player, x: number): Action[] => (cx(p) < x - 3 ? ['right'] : cx(p) > x + 3 ? ['left'] : []);
const tool = (p: Player) => activeTool(p, p.def.tools?.(p) ?? [])?.id;
/** Pick `id` on the belt (WEAPON / TOOLS), then use it with `use` every `n` frames. */
const pick =
  (id: string, use: Action = 'special', n = 20): Policy =>
  (p, f) =>
    tool(p) !== id ? (f % 8 === 0 ? ['select'] : []) : tapEvery(f, use, n);
const idle: Policy = () => [];

/** The power-up the room placed for the lesson, until it is grabbed. */
export function placedItem(s: PracticeRoomScene): HeroItem | undefined {
  const id = s.lesson?.item;
  if (!id || s.tracker.taken.has(id)) return undefined;
  return s.world.entities.find((e): e is HeroItem => e.alive && e instanceof HeroItem && e.item === id);
}

/** Walk to the lesson's item and take it, then play `then` (its frames counted from the grab). */
export function grab(then: Policy): Policy {
  let t0 = -1;
  return (p, f, s) => {
    const item = placedItem(s);
    if (item) {
      t0 = -1;
      return goTo(p, toPx(item.body.x + (item.body.w >> 1)));
    }
    if (t0 < 0 || f < t0) t0 = f;
    return then(p, f - t0, s);
  };
}

/** Down off the high ledge or the bricks first (the practice room), then `then`. */
const offLedge =
  (then: Policy): Policy =>
  (p, f, s) =>
    toPx(p.body.y + p.body.h) < 190 ? (cx(p) < 64 ? ['right'] : ['left']) : then(p, f, s);

/** Swing at the dummy from a few tiles off, facing it: a sword beam flies to it. */
const beamSwing: Policy = offLedge((p, f) =>
  cx(p) < 96 ? ['right'] : p.facing < 0 ? ['right'] : tapEvery(f, 'attack', 16),
);

/** The policies, fresh for each run. */
export function tbPolicies(): Record<string, Policy> {
  let turned = false;
  return {
    // Link's sword (the practice room: the dummy's left edge at 146, the bricks over 80-128).
    'link:sword': (p, f) => (cx(p) < 128 ? goTo(p, 130) : tapEvery(f, 'attack', 16)),
    'link:down-thrust': (p, f) => {
      const b = p.body;
      if (b.onGround) {
        if (cx(p) > 124) return ['left'];
        return cx(p) < 118 ? ['right'] : f % 6 < 3 ? ['right', 'jump'] : [];
      }
      const hold: Action[] = cx(p) < 152 ? ['right'] : [];
      return b.vy > 0 ? [...hold, 'down'] : [...hold, 'jump'];
    },
    'link:up-thrust': (p, f) =>
      Math.abs(cx(p) - 104) > 3 ? goTo(p, 104) : f % 30 < 15 ? ['jump', 'up'] : ['up'],
    'link:shield': (p) => goTo(p, 100),
    // Link's tools (the gear screen: the dummy at 130-142) and magic (the practice room).
    'link:boomerang': (_p, f) => tapEvery(f, 'special', 20),
    'link:heart-container': grab(idle),
    'link:bomb': grab((p, f, s) =>
      cx(p) > 118 ? ['left'] : cx(p) < 106 ? ['right'] : p.facing < 0 ? ['right'] : pick('bomb')(p, f, s),
    ),
    'link:shield-spell': grab(pick('shield')),
    'link:jump-spell': grab((p, f, s) => {
      if (!p.scratch.jumpSpell) return pick('jump')(p, f, s);
      return ['left', ...(f % 40 < 30 ? (['jump'] as Action[]) : [])];
    }),
    // His back to the dummy (to its left, facing left), standing still: its shot gets past the shield.
    'link:blue-ring': grab(
      offLedge((p) => {
        if (cx(p) > 96) return ['left'];
        if (p.facing > 0 && !turned) {
          turned = true;
          return ['left'];
        }
        return p.facing > 0 ? ['left'] : [];
      }),
    ),
    'link:fire-spell': grab((p, f, s) => (!p.scratch.fireSpell ? pick('fire')(p, f, s) : beamSwing(p, f, s))),
    'link:magical-sword': grab(beamSwing),
    'link:swim': (_p, f) => tapEvery(f, 'jump', 10),
    // Mega Man: the buster, the slide (the gear screen's tunnel at 192-224), the helmet's charge,
    // the weapons and Rush, the seabed.
    'megaman:shoot': (_p, f) => tapEvery(f, 'attack', 10),
    'megaman:slide': (p, f) =>
      cx(p) < 160 ? ['right'] : f % 20 < 2 ? ['right', 'down', 'jump'] : ['right', 'down'],
    'megaman:charge': grab((_p, f) => (f % 70 < 55 ? ['attack'] : [])),
    'megaman:saw': grab(pick('saw')),
    'megaman:leaf': grab(pick('leaf')),
    'megaman:rush': grab((p, f, s) => {
      const coil = s.world.entities.find((e) => e instanceof RushCoil && e.alive);
      if (!coil) return p.body.onGround ? pick('rush')(p, f, s) : [];
      const at = toPx(coil.body.x + (coil.body.w >> 1));
      if (p.body.onGround) return f % 6 < 3 ? ['jump'] : [];
      return cx(p) < at - 2 ? ['right', 'jump'] : cx(p) > at + 2 ? ['left', 'jump'] : ['jump'];
    }),
    'megaman:flame': grab(pick('flame')),
    'megaman:knuckle': grab(pick('knuckle')),
    'megaman:bolt': grab(pick('bolt', 'special', 40)),
    'megaman:seabed-jump': (_p, f) => (f % 90 < 70 ? ['jump'] : []),
    // Samus: the beam, the tank, the ball (the gear screen's tunnel at 192-224), missiles, the
    // beams (from the far left for the Long Beam) and the suit.
    'samus:shoot': (_p, f) => tapEvery(f, 'attack', 10),
    'samus:energy-tank': grab(idle),
    'samus:aim-up': (_p, f) => ['up', ...tapEvery(f, 'attack', 10)],
    'samus:morph-ball': (p, f) =>
      cx(p) < 168 ? ['right'] : !p.scratch.ball ? (f % 6 === 0 ? ['down'] : []) : ['right'],
    'samus:bomb': (p, f) => (!p.scratch.ball ? tapEvery(f, 'down', 10) : tapEvery(f, 'attack', 10)),
    'samus:bomb-jump': (p, f) => (!p.scratch.ball ? tapEvery(f, 'down', 10) : tapEvery(f, 'attack', 60)),
    'samus:missile': grab((_p, f) => tapEvery(f, 'special', 10)),
    'samus:missile-switch': (p, f) =>
      tool(p) !== 'missile' ? (f % 8 === 0 ? ['select'] : []) : tapEvery(f, 'attack', 12),
    'samus:long-beam': grab((p, f) =>
      cx(p) > 20 ? ['left'] : p.facing < 0 ? ['right'] : tapEvery(f, 'attack', 10),
    ),
    'samus:ice-beam': grab(pick('ice', 'attack', 12)),
    // Standing still a few steps from the dummy: its shots hit her.
    'samus:varia-suit': grab(idle),
    'samus:wave-beam': grab(pick('wave', 'attack', 12)),
  };
}

/** The training room for `heroId` over a stand-in scene, as the training flow pushes it. */
export function trainingRoom(heroId: string) {
  const h = makeGame();
  const hero = CHARACTERS.find((c) => c.id === heroId);
  if (!hero) throw new Error(heroId);
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

/**
 * Plays `heroId`'s whole training with `policies` (`<hero>:<lesson>` first, then `<lesson>`),
 * pressing on at each card. Returns the room, the lessons ticked, and the hero's scratch as the
 * last lesson ended (just before READY!).
 */
export function playTraining(heroId: string, policies: Record<string, Policy>, max = 15000) {
  const r = trainingRoom(heroId);
  let lesson = r.scene.lesson?.id;
  let phase = '';
  let since = 0;
  let kit: Record<string, number> = {};
  for (let i = 0; i < max && r.results.length === 0; i++) {
    const s = r.scene;
    const id = s.lesson?.id;
    if (id !== lesson || s.phase !== phase) {
      if (s.phase === 'ready' && phase !== 'ready') kit = { ...s.player.scratch };
      lesson = id;
      phase = s.phase;
      since = 0;
    }
    const policy = id ? (policies[`${heroId}:${id}`] ?? policies[id]) : undefined;
    const card = s.phase === 'chapter' || s.phase === 'ready';
    const act: Action[] = card
      ? since > CARD_GUARD_FRAMES && since % 4 === 0
        ? ['jump']
        : []
      : s.phase === 'lesson' && policy
        ? policy(s.player, since, s)
        : [];
    r.h.step(act);
    since++;
  }
  return { ...r, ticked: [...r.scene.ticked], kit };
}
