import { describe, expect, it } from 'vitest';
import { lifeLostSaid, MINI_LIVES, MiniLives, type MiniCheckpoint } from './lives';

const START: MiniCheckpoint = { id: 'start', x: 2, y: 12 };
const MID: MiniCheckpoint = { id: 'mid', x: 40, y: 12 };
const BOSS: MiniCheckpoint = { id: 'boss', x: 77, y: 12, at: 76 };
const SHAFT: MiniCheckpoint = { id: 'shaft', x: 10, y: 3, at: 8, rows: [0, 5] };

describe("MiniLives (the World mini games' lives and checkpoints)", () => {
  it('three lives: two deaths restart, the third is game over', () => {
    const l = new MiniLives({ start: START });
    expect(MINI_LIVES).toBe(3);
    expect(l.lives).toBe(3);
    expect(l.rest).toBe(2);
    expect(l.lose()).toBe('retry');
    expect(l.rest).toBe(1);
    expect(l.lose()).toBe('retry');
    expect(l.rest).toBe(0);
    expect(l.lose()).toBe('over');
    expect(l.rest).toBe(0);
  });

  it('Infinite lives (the dev assist, read at each death) never runs out or counts down', () => {
    let infinite = true;
    const l = new MiniLives({ start: START, infinite: () => infinite });
    for (let i = 0; i < 10; i++) expect(l.lose()).toBe('retry');
    expect(l.rest).toBe(2);
    infinite = false;
    expect(l.lose()).toBe('retry');
    expect(l.rest).toBe(1);
  });

  it('checkpoints are reached in order as the hero passes them; a life restarts at the last one', () => {
    const l = new MiniLives({ start: START, checkpoints: [MID, BOSS] });
    expect(l.start).toEqual({ x: 2, y: 12 });
    expect(l.reach(39, 12)).toBeNull();
    expect(l.reach(40, 12)).toBe(MID);
    expect(l.reach(41, 12)).toBeNull(); // already there
    expect(l.start).toEqual({ x: 40, y: 12 });
    // Walking back does not lose it; `at` sets where the boss door is reached.
    expect(l.reach(10, 12)).toBeNull();
    expect(l.reach(76, 12)).toBe(BOSS);
    expect(l.current).toBe(BOSS);
    l.lose();
    expect(l.start).toEqual({ x: 77, y: 12 });
  });

  it('a far jump passes every checkpoint on the way: the furthest wins', () => {
    const l = new MiniLives({ start: START, checkpoints: [MID, BOSS] });
    expect(l.reach(90, 12)).toBe(BOSS);
  });

  it('a checkpoint with rows is only reached inside them (a shaft); set() picks one by id', () => {
    const l = new MiniLives({ start: START, checkpoints: [SHAFT, BOSS] });
    expect(l.reach(9, 11)).toBeNull();
    expect(l.reach(9, 4)).toBe(SHAFT);
    l.set('boss');
    expect(l.current).toBe(BOSS);
    l.set('nowhere');
    expect(l.current).toBe(BOSS);
  });

  it('a round can start with another count of lives (at least one)', () => {
    expect(new MiniLives({ start: START, lives: 5 }).rest).toBe(4);
    expect(new MiniLives({ start: START, lives: 0 }).lose()).toBe('over');
  });

  it("says what is left, as Bill's round does", () => {
    expect(lifeLostSaid('Mega Man', 2, false)).toBe('Mega Man is down! 2 lives left.');
    expect(lifeLostSaid('Mega Man', 1, false)).toBe('Mega Man is down! Last life.');
    expect(lifeLostSaid('Samus', 0, false)).toBe('Samus is down! Game over.');
    expect(lifeLostSaid('Samus', 2, true)).toBe('Samus is down!');
  });
});
