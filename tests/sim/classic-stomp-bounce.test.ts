import { describe, expect, it } from 'vitest';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import type { Action } from '@engine/input/actions';
import { DEFAULT_ASSIST, NO_CHEATS, newGameState, type CheatFlags } from '@game/context';
import { CHARACTERS, CLASSIC_CHARACTERS, CLASSIC_EXTRAS, heroFor } from '@game/characters/registry';
import type { CharacterDef } from '@game/characters/character';
import {
  CLASSIC_STOMP_BOUNCE,
  LINK_CLASSIC_STOMP_BOUNCE,
  SMB1_STOMP_HELD,
} from '@game/characters/classic/stomp';
import { POUND_BOUNCE, YOSHI_CLASSIC } from '@game/characters/yoshi/classic';
import { Goomba } from '@game/entities/enemies/goomba';
import { parseTextMap } from '@game/level/textmap';
import type { LevelData } from '@game/level/schema';
import { ScriptedInput } from '@game/sim/headless';
import { levelSeed, World } from '@game/world/world';

// BUG-07: the original's stomp bounce is vy = -bouncePwr with normal gravity, jump held or not
// (Character.bounce, Character.as 2610-2618, never reads jmpBtn): bouncePwr 300 (Character.as
// 172), Link's 325 (Link.as 221, 409). Mario and Luigi stomp of their own (MarioBase.as 278,
// 368); the others with Everyone Can Stomp (Character.canStomp, 3212-3220). Under the cheat every
// other Classic hero bounced Current's -4 px/f, about 2.5 times too high: now the original's.
// By owner decision the SMB heroes (the ones that stomp of their own: Mario, Luigi, their looks,
// Peach, Yoshi) instead bounce as in SMB1, higher with jump held (classic/stomp.ts SMB1_STOMP_HELD).

const LINK_LOOKS = new Set(['link', 'zelda-nes', 'zelda-snes', 'zelda-gb']);

const classicDefs = (): CharacterDef[] =>
  [...Object.values(CLASSIC_CHARACTERS), ...CLASSIC_EXTRAS].filter((d): d is CharacterDef => !!d);

function level(): LevelData {
  const lines: string[] = [];
  for (let y = 0; y < 13; y++) lines.push('.'.repeat(48));
  lines.push('#'.repeat(48), '#'.repeat(48));
  return parseTextMap(
    ['id: t', 'time: 300', 'start: 6,6', '', '[tiles]', ...lines, '[entities]', 'goomba 6 12'].join('\n'),
  );
}

function world(def: CharacterDef): World {
  const lv = level();
  const ctx = {
    assets: new AssetRegistry({ default: {} }),
    audio: NULL_AUDIO,
    assist: { ...DEFAULT_ASSIST },
    reduceFlashing: true,
    rules: 'classic' as const,
    classicCheats: { ...NO_CHEATS, everyoneCanStomp: true } as CheatFlags,
  };
  return new World(lv, ctx, newGameState(def, null, 'classic'), { seed: levelSeed(lv) });
}

/** The hero falls onto a still Goomba, jump held throughout or never: the bounce's vy and peak. */
function bounce(def: CharacterDef, held: boolean): { vy: number; rise: number } | null {
  const w = world(def);
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
  const keys: Action[] = held ? ['jump'] : [];
  for (let f = 0; f < 200 && w.feats.stomps === 0; f++) step(keys);
  if (w.feats.stomps === 0) return null;
  const b = w.player.body;
  const vy = b.vy;
  const top = b.y;
  let peak = b.y;
  for (let f = 0; f < 120 && b.vy < 0; f++) {
    step(keys);
    peak = Math.min(peak, b.y);
  }
  return { vy, rise: top - peak };
}

/**
 * The hero falls onto a still Goomba holding `pre`, then from the stomp holds `after(frame)`: the
 * bounce's peak above the stomp point.
 */
function riseWith(def: CharacterDef, pre: Action[], after: (f: number) => Action[]): number {
  const w = world(def);
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
  for (let f = 0; f < 200 && w.feats.stomps === 0; f++) step(pre);
  expect(w.feats.stomps).toBe(1);
  const b = w.player.body;
  const top = b.y;
  let peak = b.y;
  for (let f = 0; f < 120 && b.vy < 0; f++) {
    step(after(f));
    peak = Math.min(peak, b.y);
  }
  return top - peak;
}

/** Yoshi pounds a Goomba from above, `keys` held: the bounce's first vy and its peak. */
function poundBounce(keys: Action[]): { vy: number; rise: number } {
  const w = world(YOSHI_CLASSIC);
  const input = new ScriptedInput({ steps: [] });
  const step = (k: Action[]) => {
    input.setHeld(k);
    input.next();
    w.update([input]);
  };
  step([]);
  const g = w.entities.find((e) => e instanceof Goomba) as Goomba;
  g.walkSpeed = 0;
  g.body.vx = 0;
  g.body.x = w.player.body.x;
  step(['down']);
  const b = w.player.body;
  for (let f = 0; f < 200 && !(!g.alive && b.vy < 0); f++) step(keys);
  expect(g.alive).toBe(false);
  expect(w.feats.stomps).toBe(0);
  const vy = b.vy;
  const top = b.y;
  let peak = b.y;
  for (let f = 0; f < 120 && b.vy < 0; f++) {
    step(keys);
    peak = Math.min(peak, b.y);
  }
  return { vy, rise: top - peak };
}

describe('BUG-07: the Classic stomp bounce', () => {
  it('every Classic hero that cannot stomp has a fixed bounce: 300 (0x2800), Link and his looks 325', () => {
    for (const d of classicDefs()) {
      if (d.stomps) continue;
      const want = LINK_LOOKS.has(d.id) ? LINK_CLASSIC_STOMP_BOUNCE : CLASSIC_STOMP_BOUNCE;
      expect(d.movement.stompBounce, d.id).toBe(want);
      expect(d.movement.stompHeld, d.id).toBeUndefined();
    }
    // 325 / 300 of Mario's bounce (velocity units of 1/4096 px/f).
    expect(Math.round((CLASSIC_STOMP_BOUNCE * 325) / 300)).toBe(LINK_CLASSIC_STOMP_BOUNCE);
  });

  it('the Classic heroes that stomp (the SMB ones) bounce as in SMB1 (owner decision)', () => {
    const smb = classicDefs().filter((d) => d.stomps);
    expect(smb.map((d) => d.id).sort()).toEqual(['luigi', 'luigi3', 'mario', 'mario3', 'peach', 'yoshi']);
    for (const d of smb) {
      expect(d.movement.stompHeld, d.id).toBe(SMB1_STOMP_HELD);
      expect(d.movement.stompBounce, d.id).toBeUndefined();
    }
    expect(SMB1_STOMP_HELD.vy).toBe(0x04000);
  });

  it('the Current heroes keep the campaign bounce (no Classic field)', () => {
    for (const d of CHARACTERS) {
      expect(d.movement.stompBounce, d.id).toBeUndefined();
      expect(d.movement.stompHeld, d.id).toBeUndefined();
    }
  });

  for (const d of [
    ...['mario', 'luigi'].map((id) =>
      heroFor(CHARACTERS.find((c) => c.id === id) as CharacterDef, 'classic'),
    ),
    YOSHI_CLASSIC,
  ]) {
    it(`${d.id}: SMB1's bounce, -4 px/f, higher with jump held`, () => {
      const free = bounce(d, false);
      const held = bounce(d, true);
      expect(free, 'stomped').not.toBeNull();
      expect(held, 'stomped').not.toBeNull();
      if (!free || !held) return;
      expect(free.vy).toBe(-0x04000);
      expect(held.vy).toBe(-0x04000);
      expect(held.rise).toBeGreaterThan(free.rise * 2);
    });
  }

  for (const id of ['mario', 'luigi']) {
    const d = heroFor(CHARACTERS.find((c) => c.id === id) as CharacterDef, 'classic');
    it(`${id}: a release latches the fall gravity; pressing JUMP again adds no height`, () => {
      const held = riseWith(d, ['jump'], () => ['jump']);
      const released = riseWith(d, ['jump'], (f) => (f < 4 ? ['jump'] : []));
      const again = riseWith(d, ['jump'], (f) => (f < 4 || f >= 8 ? ['jump'] : []));
      expect(again).toBe(released);
      expect(released).toBeLessThan(held);
      // Not held at the stomp: the fall gravity from the start, a press later adds nothing.
      expect(riseWith(d, [], (f) => (f >= 3 ? ['jump'] : []))).toBe(riseWith(d, [], () => []));
    });
  }

  it("Yoshi's ground pound keeps its fixed 2.5 px/f bounce, jump held or not (YO-9)", () => {
    const free = poundBounce([]);
    const held = poundBounce(['jump']);
    expect(POUND_BOUNCE).toBe(CLASSIC_STOMP_BOUNCE);
    expect(free.vy).toBe(-POUND_BOUNCE);
    expect(held.vy).toBe(-POUND_BOUNCE);
    expect(held.rise).toBe(free.rise);
  });

  for (const cur of CHARACTERS.filter((c) => !heroFor(c, 'classic').stomps)) {
    const d = heroFor(cur, 'classic');
    it(`${d.id}: a stomp bounces the same with jump held or not`, () => {
      const free = bounce(d, false);
      const held = bounce(d, true);
      expect(free, 'stomped').not.toBeNull();
      expect(held, 'stomped').not.toBeNull();
      if (!free || !held) return;
      // The original's bouncePwr (before this fix: Current's -4 px/f, about 2.5 times as high).
      expect(free.vy, `${d.id} vy`).toBe(-(d.movement.stompBounce ?? 0));
      expect(held.vy, `${d.id} vy held`).toBe(free.vy);
      expect(held.rise, `${d.id} rise`).toBe(free.rise);
      expect(free.rise).toBeGreaterThan(0);
    });
  }
});
