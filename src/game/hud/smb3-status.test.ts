import { describe, expect, it } from 'vitest';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import type { AssetRegistry } from '@engine/assets/registry';
import { px } from '@engine/math/units';
import { SCREEN_H, SCREEN_W } from '@engine/viewport';
import { newGameState } from '../context';
import { MARIO } from '../characters/mario';
import { Player } from '../entities/player';
import { startHp } from '../characters/character';
import {
  drawSmb3Status,
  P_ARROWS,
  pMeter,
  smb3Status,
  STATUS_BAR_H,
  STATUS_BAR_Y,
  SMB3_WORLD_SHIFT,
  type Smb3Status,
} from './smb3-status';

/** Records everything drawn: texts with where, and every box. */
class Recorder implements Renderer {
  texts: { s: string; x: number; y: number }[] = [];
  boxes: { x: number; y: number; w: number; h: number; c: string }[] = [];
  private readonly none = new NullRenderer();
  clear = this.none.clear;
  sprite = this.none.sprite;
  debugText = this.none.debugText;
  line = this.none.line;
  rect(x: number, y: number, w: number, h: number, c: string): void {
    this.boxes.push({ x, y, w, h, c });
  }
  text(_f: Parameters<Renderer['text']>[0], s: string, x: number, y: number): void {
    this.texts.push({ s, x, y });
  }
}

const assets = { sheet: () => ({ id: 'stub', image: null, frames: new Map() }) } as unknown as AssetRegistry;
const base: Smb3Status = {
  world: 4,
  pMeter: 0,
  initial: 'M',
  lives: 5,
  score: 12340,
  coins: 7,
  time: 287,
  cards: [null, null, null],
};

function draw(s: Partial<Smb3Status> = {}, frame = 0, reduceFlashing = false): Recorder {
  const r = new Recorder();
  drawSmb3Status(r, assets, { ...base, ...s }, frame, reduceFlashing);
  return r;
}

describe('the SMB3 status bar', () => {
  it('sits along the bottom of the screen, framed in black, and draws nothing above it', () => {
    expect(STATUS_BAR_Y + STATUS_BAR_H).toBe(SCREEN_H);
    // The world moves up by as much as the bar takes, so the bar covers none of it.
    expect(SMB3_WORLD_SHIFT).toBe(STATUS_BAR_H);
    const r = draw();
    expect(r.boxes[0]).toEqual({ x: 0, y: STATUS_BAR_Y, w: SCREEN_W, h: STATUS_BAR_H, c: '#000' });
    for (const b of r.boxes) {
      expect(b.y).toBeGreaterThanOrEqual(STATUS_BAR_Y);
      expect(b.y + b.h).toBeLessThanOrEqual(SCREEN_H);
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(SCREEN_W);
    }
    for (const t of r.texts) {
      expect(t.y).toBeGreaterThanOrEqual(STATUS_BAR_Y);
      expect(t.y + 8).toBeLessThanOrEqual(SCREEN_H);
      expect(t.x + t.s.length * 8).toBeLessThanOrEqual(SCREEN_W);
    }
  });

  it('shows the world, the coins, the hero with his lives, the score and the time', () => {
    const t = draw().texts.map((x) => x.s);
    expect(t).toEqual(expect.arrayContaining(['WORLD 4', '$07', 'M', '×5', '0012340', '287']));
  });

  it('has no time digits without a clock, and caps lives and coins as SMB3 does', () => {
    const t = draw({ time: null, lives: 123, coins: 140 }).texts.map((x) => x.s);
    expect(t.some((s) => /^\d{3}$/.test(s))).toBe(false);
    expect(t).toContain('×99');
    expect(t).toContain('$99');
  });

  it('has three end-card slots on the right, empty until there is a card', () => {
    const r = draw();
    const slots = r.boxes.filter((b) => b.w === 22 && b.h === 28);
    expect(slots).toHaveLength(3);
    expect(slots.every((b) => b.x >= 176)).toBe(true);
  });

  it('lights one P-meter arrow per step of run speed, and the P once full (steady with reduce flashing)', () => {
    const lit = (r: Recorder) => r.boxes.filter((b) => b.c === '#fcfcfc' && b.y > STATUS_BAR_Y + 2).length;
    expect(lit(draw({ pMeter: 3 }))).toBeGreaterThan(lit(draw({ pMeter: 0 })));
    // Full: the P blinks with the frame, unless reduce flashing holds it lit.
    expect(draw({ pMeter: P_ARROWS }, 0).boxes).not.toEqual(draw({ pMeter: P_ARROWS }, 8).boxes);
    expect(draw({ pMeter: P_ARROWS }, 0, true).boxes).toEqual(draw({ pMeter: P_ARROWS }, 8, true).boxes);
  });

  it('reads the run: P-meter from the hero speed, empty standing, full at a run', () => {
    const p = new Player(px(32), px(160), MARIO, 'small', startHp(MARIO));
    p.body.onGround = true;
    expect(pMeter(p)).toBe(0);
    p.body.vx = p.profile.maxRun;
    expect(pMeter(p)).toBe(P_ARROWS);
    p.body.vx = -p.profile.maxRun;
    expect(pMeter(p)).toBe(P_ARROWS);
    p.body.vx = p.profile.maxWalk;
    expect(pMeter(p)).toBe(0);
    expect(pMeter(null)).toBe(0);
    const state = { ...newGameState(MARIO), world: 4, lives: 3, score: 50, coins: 2 };
    expect(smb3Status(state, p, 100)).toEqual({
      world: 4,
      pMeter: 0,
      initial: 'M',
      lives: 3,
      score: 50,
      coins: 2,
      wallet: false,
      time: 100,
      cards: [null, null, null],
    });
  });
});
