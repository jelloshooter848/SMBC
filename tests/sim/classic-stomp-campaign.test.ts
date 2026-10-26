import { describe, expect, it } from 'vitest';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import type { Action } from '@engine/input/actions';
import { DEFAULT_ASSIST, NO_CHEATS, newGameState, type CheatFlags, type Rules } from '@game/context';
import { CHARACTERS, CLASSIC_CHARACTERS, CLASSIC_EXTRAS, heroFor } from '@game/characters/registry';
import type { CharacterDef } from '@game/characters/character';
import { MARIO } from '@game/characters/mario';
import { MARIO_PROFILE } from '@game/characters/mario/profile';
import { POUND_BOUNCE, YOSHI_CLASSIC } from '@game/characters/yoshi/classic';
import { Goomba } from '@game/entities/enemies/goomba';
import { parseTextMap } from '@game/level/textmap';
import type { LevelData } from '@game/level/schema';
import { ScriptedInput } from '@game/sim/headless';
import { levelSeed, World } from '@game/world/world';

// BUG-07, owner decision: the Classic SMB heroes use the campaign's own held stomp bounce
// (MovementProfile.stompHeld = MARIO_PROFILE, Player.stompBounce), not numbers of their own. These
// compare a Classic stomp with campaign Mario's frame for frame, and pin the campaign's bounce.

function level(): LevelData {
  const lines: string[] = [];
  for (let y = 0; y < 13; y++) lines.push('.'.repeat(48));
  lines.push('#'.repeat(48), '#'.repeat(48));
  return parseTextMap(
    ['id: t', 'time: 300', 'start: 6,6', '', '[tiles]', ...lines, '[entities]', 'goomba 6 12'].join('\n'),
  );
}

function world(def: CharacterDef, rules: Rules): World {
  const lv = level();
  const ctx = {
    assets: new AssetRegistry({ default: {} }),
    audio: NULL_AUDIO,
    assist: { ...DEFAULT_ASSIST },
    reduceFlashing: true,
    rules,
    classicCheats: { ...NO_CHEATS } as CheatFlags,
  };
  return new World(lv, ctx, newGameState(def, null, rules), { seed: levelSeed(lv) });
}

/** A key pattern after the stomp: frame -> held. */
type Pattern = (f: number) => boolean;

/**
 * The hero falls onto a still Goomba (JUMP held through the fall when `pattern(0)`), then from the
 * stomp holds JUMP by `pattern`: each frame's vy and height above the stomp point, to the apex.
 */
function riseProfile(def: CharacterDef, rules: Rules, pattern: Pattern): { vy: number; up: number }[] {
  const w = world(def, rules);
  const input = new ScriptedInput({ steps: [] });
  const step = (keys: Action[]) => {
    input.setHeld(keys);
    input.next();
    w.update([input]);
  };
  step([]);
  const g = w.entities.find((e) => e instanceof Goomba) as Goomba;
  g.walkSpeed = 0;
  g.body.vx = 0;
  g.body.x = w.player.body.x;
  const pre: Action[] = pattern(0) ? ['jump'] : [];
  for (let f = 0; f < 200 && w.feats.stomps === 0; f++) step(pre);
  expect(w.feats.stomps, `${def.id} stomped`).toBe(1);
  const b = w.player.body;
  const top = b.y;
  const out = [{ vy: b.vy, up: 0 }];
  for (let f = 0; f < 120 && b.vy < 0; f++) {
    step(pattern(f) ? ['jump'] : []);
    out.push({ vy: b.vy, up: top - b.y });
  }
  return out;
}

const PATTERNS: [string, Pattern][] = [
  ['held', () => true],
  ['not held', () => false],
  ['released after 4 frames', (f) => f < 4],
  ['released, then pressed again', (f) => f < 4 || f >= 8],
  ['pressed after 3 frames', (f) => f >= 3],
];

const peak = (p: { up: number }[]): number => Math.max(...p.map((s) => s.up));

/**
 * B-L backlog: a moving stomp, followed through to the landing. The hero falls onto a still
 * Goomba (kept under him) moving at `vx`, holding RIGHT (and RUN when `run`) and JUMP; from the
 * stomp, each frame's vx, vy and travel until he is on the ground again.
 */
function movingStomp(
  def: CharacterDef,
  rules: Rules,
  vx: number,
  run: boolean,
): { frames: { vx: number; vy: number; dx: number }[]; landed: number } {
  const w = world(def, rules);
  const input = new ScriptedInput({ steps: [] });
  const keys: Action[] = ['right', 'jump', ...(run ? (['run'] as Action[]) : [])];
  const step = () => {
    input.setHeld(keys);
    input.next();
    w.update([input]);
  };
  input.setHeld([]);
  input.next();
  w.update([input]);
  const g = w.entities.find((e) => e instanceof Goomba) as Goomba;
  g.walkSpeed = 0;
  g.body.vx = 0;
  const b = w.player.body;
  b.vx = vx;
  for (let f = 0; f < 200 && w.feats.stomps === 0; f++) {
    g.body.x = b.x;
    step();
  }
  expect(w.feats.stomps, `${def.id} stomped`).toBe(1);
  const x0 = b.x;
  const frames: { vx: number; vy: number; dx: number }[] = [];
  let n = 0;
  for (; n < 200 && !(b.onGround && n > 2); n++) {
    step();
    frames.push({ vx: b.vx, vy: b.vy, dx: b.x - x0 });
  }
  expect(b.onGround, `${def.id} landed`).toBe(true);
  return { frames, landed: n };
}

describe("BUG-07: the Classic SMB heroes' stomp bounce is the campaign's", () => {
  it("campaign Mario's bounce is unchanged: -4 px/f, then MARIO_PROFILE's standing tier", () => {
    expect(MARIO.movement).toBe(MARIO_PROFILE);
    const t = MARIO_PROFILE.jump[0];
    expect(t).toEqual({ maxVx: 0x01000, initial: 0x04000, holdGravity: 0x00200, fallGravity: 0x00700 });
    for (const [name, pat] of PATTERNS) {
      const got = riseProfile(MARIO, 'campaign', pat);
      // The tier path: the move, then the tier's hold gravity while rising with JUMP held, else
      // its fall gravity (no latch: a second press takes the hold gravity again).
      const want = [-0x04000];
      for (let f = 0; want[want.length - 1]! < 0; f++) {
        const v = want[want.length - 1]!;
        want.push(v + (pat(f) ? 0x00200 : 0x00700));
      }
      expect(
        got.map((s) => s.vy),
        name,
      ).toEqual(want);
    }
  });

  const smb = [...Object.values(CLASSIC_CHARACTERS), ...CLASSIC_EXTRAS].filter(
    (d): d is CharacterDef => !!d && d.stomps,
  );
  it('the SMB heroes are Mario, Luigi, their looks, Peach and Yoshi', () => {
    expect(smb.map((d) => d.id).sort()).toEqual(['luigi', 'luigi3', 'mario', 'mario3', 'peach', 'yoshi']);
  });

  const campaign = new Map(PATTERNS.map(([n, p]) => [n, riseProfile(MARIO, 'campaign', p)]));
  for (const d of smb) {
    for (const [name, pat] of PATTERNS) {
      it(`${d.id}, ${name}: the same rise as campaign Mario, frame for frame`, () => {
        expect(riseProfile(d, 'classic', pat)).toEqual(campaign.get(name));
      });
    }
  }

  it('Classic Mario: held is higher than not held; a release and a second press add height as in the campaign', () => {
    const cm = heroFor(CHARACTERS.find((c) => c.id === 'mario') as CharacterDef, 'classic');
    const held = peak(riseProfile(cm, 'classic', () => true));
    const free = peak(riseProfile(cm, 'classic', () => false));
    const released = peak(riseProfile(cm, 'classic', (f) => f < 4));
    const again = peak(riseProfile(cm, 'classic', (f) => f < 4 || f >= 8));
    expect(held).toBeGreaterThan(free * 2);
    expect(released).toBeLessThan(held);
    // The campaign has no release latch, so neither does Classic.
    expect(again).toBeGreaterThan(released);
  });

  // B-L backlog: a running stomp. With RUN held both heroes move at the same 2.5 px/f, so the held
  // bounce picks the same MARIO_PROFILE tier (the running one, |vx| >= 2.3125) for both: the whole
  // arc, rise and fall, to the landing, is the same frame for frame, across as well as up.
  it('a running stomp (RUN held, equal speed): the same tier and the same arc to the landing', () => {
    const cm = heroFor(CHARACTERS.find((c) => c.id === 'mario') as CharacterDef, 'classic');
    const camp = movingStomp(MARIO, 'campaign', 0x02800, true);
    const classic = movingStomp(cm, 'classic', 0x02800, true);
    expect(classic.frames[0]?.vy).toBe(camp.frames[0]?.vy);
    expect(classic.frames).toEqual(camp.frames);
    expect(classic.landed).toBe(camp.landed);
  });

  // B-L backlog: the no-RUN difference to the campaign. Walking, campaign Mario keeps his 1.5625
  // px/f walk while Classic Mario eases to his own walk cap, 1.4583 px/f (MarioBase WALK 175 px/s,
  // reached through its own release factor: InertiaProfile), so a walking stomp lands a few
  // pixels shorter. That is the whole of it: every frame's vy, and the landing frame, are the
  // campaign's, and the travel differs only by Classic's own speed, frame by frame.
  it("a walking stomp (no RUN): the same vertical arc; the travel differs only by Classic's own deceleration", () => {
    const cm = heroFor(CHARACTERS.find((c) => c.id === 'mario') as CharacterDef, 'classic');
    const start = 0x01700;
    const camp = movingStomp(MARIO, 'campaign', start, false);
    const classic = movingStomp(cm, 'classic', start, false);
    expect(classic.frames.map((f) => f.vy)).toEqual(camp.frames.map((f) => f.vy));
    expect(classic.landed).toBe(camp.landed);
    // Campaign: its walk speed; Classic: its own walk cap, eased down to from the start speed.
    expect(camp.frames.every((f) => f.vx === MARIO_PROFILE.maxWalk)).toBe(true);
    expect(cm.movement.maxWalk).toBe(0x01755);
    expect(classic.frames.at(-1)?.vx).toBe(cm.movement.maxWalk);
    for (let i = 1; i < classic.frames.length; i++)
      expect(classic.frames[i]!.vx).toBeLessThanOrEqual(classic.frames[i - 1]!.vx);
    // The gap in travel is the sum of the speed gaps (the same frames, the same vertical motion).
    const gap = (camp.frames.at(-1)?.dx ?? 0) - (classic.frames.at(-1)?.dx ?? 0);
    expect(gap).toBeGreaterThan(0);
    expect(gap / 256).toBeLessThan(8);
    // Luigi and Peach land one frame earlier on some stomps: their hitbox sits differently over
    // the Goomba, so the stomp itself comes a frame sooner (a body difference, not the bounce).
  });

  it("Yoshi's ground pound keeps its fixed 2.5 px/f bounce (YO-9)", () => {
    expect(POUND_BOUNCE).toBe(0x02800);
    expect(YOSHI_CLASSIC.movement.stompBounce).toBeUndefined();
  });
});
