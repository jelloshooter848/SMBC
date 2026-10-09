import { describe, expect, it } from 'vitest';
import type { Action } from '@engine/input/actions';
import { tileToSub, toPx } from '@engine/math/units';
import { runSim } from '@game/sim/headless';
import { MARIO } from '@game/characters/mario';
import { LUIGI } from '@game/characters/luigi';
import { CardScene } from '@game/scenes/message';
import { stageLevel, type HeroStageScene } from '@game/tutorial/hero-stage';
import { LUIGI_LESSONS, LUIGI_STAGE, LUIGI_STAGE_DEF } from '@game/tutorial/heroes/luigi';
import type { CharacterDef } from '@game/characters/character';
import { useStorage } from './heroes-harness';
import {
  choose,
  heroCol,
  hold,
  playStage,
  skipGreeting,
  stageMenu,
  startAtLabels,
  startStage,
} from './stage-bot';

// Luigi's training stage (0.4.37, design section 3): only what is different from Mario. The well
// only his higher jump leaves, the run that fills the sprint bar, the slide onto the hard blocks,
// the wide ditch only his floatier jump clears, a note on SMB's power-ups and the flagpole.

useStorage();

const S = LUIGI_STAGE;
const lessonId = (s: HeroStageScene) => s.director.lesson?.id;

/** Luigi's bot: reads the current lesson and plays it as a player would. */
export function luigiBot(): (s: HeroStageScene) => Action[] {
  return (s) => {
    const w = s.world;
    const p = w.player;
    const b = p.body;
    const x = toPx(b.x);
    const out: Action[] = [];
    const jumpHeld = () => {
      if (b.onGround ? (w.frame & 1) === 0 : b.vy < 0) out.push('jump');
    };
    switch (lessonId(s)) {
      case 'high-jump':
        // A walk at the wall, and a full jump on the way.
        out.push('right');
        if (b.onGround && Math.abs(b.vx) < 0x1100) break;
        jumpHeld();
        break;
      case 'run':
        out.push('right', 'run');
        break;
      case 'slide':
        // Run, and let go about eight blocks before the strip's far end.
        if (x < S.strip.from * 16 - 100 || !b.onGround) out.push('right', 'run');
        break;
      case 'float': {
        if (!b.onGround) {
          out.push('right', 'run', 'jump');
          break;
        }
        // Climb out of the shallow ditch first, back to the run-up.
        if (toPx(b.y + b.h) > S.strip.top * 16) {
          out.push('right');
          jumpHeld();
          break;
        }
        out.push('right', 'run');
        if (toPx(b.x + b.w) >= S.wide.from * 16 - 6) out.push('jump');
        break;
      }
      default:
        out.push('right', 'run');
        if (b.onGround && toPx(b.x) >= (S.flag - 3) * 16) out.push('jump');
        else if (!b.onGround && b.vy < 0) out.push('jump');
    }
    return out;
  };
}

describe("Luigi's stage", () => {
  it('a bot plays it to the TRAINING CLEAR card in under two minutes, the box always clear', () => {
    const { h, stage, ended } = startStage('luigi');
    const s = stage();
    expect(s.world.player.powerState).toBe('small');
    skipGreeting(h);
    const log = playStage(h, s, luigiBot(), () => s.cleared, 7200);
    expect(log.frames).toBeLessThan(7200);
    expect(s.director.done).toEqual(LUIGI_LESSONS.map((l) => l.id));
    expect(log.cards).toEqual([]);
    // The card waits for a press, then the training ends and the run is back.
    expect(h.top()).toBeInstanceOf(CardScene);
    expect((h.top() as CardScene).lines.join(' ')).toMatch(/TRAINING CLEAR/);
    h.idle(400);
    expect(h.top()).toBeInstanceOf(CardScene);
    h.tap('jump');
    expect(ended()).toBe(true);
  });

  it("Mario's moves can't leave the well or clear the wide ditch; Luigi's can", () => {
    const level = stageLevel(LUIGI_STAGE_DEF);
    /** Out of the well with `walk` frames of a run-up, then a full jump. */
    const outOfWell = (c: CharacterDef, walk: number) =>
      runSim({
        level,
        character: c,
        maxFrames: 160,
        script: { steps: [] },
        start: { x: 0, y: 13, mode: 'stand' },
        controller: (_w, f) => (f < walk ? ['right', 'run'] : ['right', 'run', 'jump']),
        until: (w) =>
          w.player.body.onGround && w.player.body.y + w.player.body.h <= tileToSub(S.tallSide.top),
      }).outcome === 'stopped';
    const walks = [0, 4, 8, 12, 16, 20, 24, 28, 32];
    expect(walks.filter((n) => outOfWell(MARIO, n))).toEqual([]);
    expect(walks.filter((n) => outOfWell(LUIGI, n)).length).toBeGreaterThan(2);
    /** Over the wide ditch: a run from the run-up, the jump `off` px before the edge. */
    const over = (c: CharacterDef, off: number) => {
      let took = false;
      return (
        runSim({
          level,
          character: c,
          maxFrames: 400,
          script: { steps: [] },
          start: { x: 57, y: 9, mode: 'stand' },
          controller: (w) => {
            const b = w.player.body;
            if (!took && b.onGround && toPx(b.x + b.w) >= S.wide.from * 16 - 2 - off) {
              took = true;
              return ['right', 'run', 'jump'];
            }
            return took ? ['right', 'run', 'jump'] : ['right', 'run'];
          },
          until: (w) =>
            w.player.body.onGround && w.player.body.y + w.player.body.h <= tileToSub(S.farBank.top),
        }).outcome === 'stopped'
      );
    };
    const offs = [0, 2, 4, 6, 8, 10];
    expect(offs.filter((o) => over(MARIO, o))).toEqual([]);
    expect(offs.filter((o) => over(LUIGI, o))).toEqual(offs);
    // In the ditch, the far wall is too tall to climb: only the jump gets there.
    const climb = runSim({
      level,
      character: LUIGI,
      maxFrames: 300,
      script: { steps: [] },
      start: { x: 75, y: 13, mode: 'stand' },
      controller: (_w, f) => (f % 60 < 20 ? ['right', 'run'] : ['right', 'run', 'jump']),
      until: (w) => w.player.body.onGround && w.player.body.y + w.player.body.h <= tileToSub(S.farBank.top),
    });
    expect(climb.outcome).toBe('timeout');
  });

  it("a walk to the run's gate gets Toad's card standing still; OK puts Luigi back with the gate shut", () => {
    const { h, stage } = startStage('luigi');
    const s = stage();
    skipGreeting(h);
    const bot = luigiBot();
    playStage(h, s, bot, () => lessonId(s) === 'run', 1200);
    expect(s.director.closedGates).toContain(S.runGate);
    // Walking only (no run): the bar never fills; at the gate, Toad's card.
    const log = playStage(
      h,
      s,
      () => ['right'],
      () => h.top() instanceof CardScene,
      1800,
    );
    expect(heroCol(s)).toBe(S.runGate - 1);
    const card = h.top() as CardScene;
    expect(card.lines[0]).toBe('TOAD:');
    expect(card.lines.join(' ')).toMatch(/REAL RUN/);
    expect(log.frames).toBeGreaterThan(0);
    h.idle(300);
    expect(h.top()).toBe(card);
    h.idle(10);
    h.tap('jump');
    expect(h.top()).toBe(s);
    expect(heroCol(s)).toBe(S.runFrom);
    h.until(() => s.world.player.body.onGround, 10);
    expect(lessonId(s)).toBe('run');
    expect(s.director.closedGates).toContain(S.runGate);
  });

  it('Skip this lesson opens the gate and stands Luigi past it; Skip training restores the run', () => {
    const { h, stage, ended } = startStage('luigi', {
      file: { lives: 4, score: 1200, coins: 7, powerState: 'fire' },
    });
    const s = stage();
    skipGreeting(h);
    playStage(h, s, luigiBot(), () => lessonId(s) === 'run', 1200);
    stageMenu(h, 'Skip this lesson');
    expect(lessonId(s)).toBe('slide');
    expect(s.director.done).toContain('run');
    expect(s.director.closedGates).not.toContain(S.runGate);
    expect(heroCol(s)).toBe(30);
    stageMenu(h, 'Skip training');
    expect(ended()).toBe(true);
    const st = h.game.state;
    expect([st.lives, st.score, st.coins, st.powerState]).toEqual([4, 1200, 7, 'fire']);
  });

  it('a replay asks START AT; the Super Mushroom starts at its lesson, Luigi big', () => {
    const { h, stage } = startStage('luigi', { replay: true });
    expect(startAtLabels(h)).toEqual(['Beginning', 'Super Mushroom']);
    choose(h, 'Super Mushroom');
    const s = stage();
    expect(h.top()).toBe(s);
    expect(lessonId(s)).toBe('power-ups');
    expect(s.world.player.powerState).toBe('small');
    // The lessons before are done (their gates open); the mushroom is this lesson's own (its block).
    expect(s.director.closedGates).toEqual([]);
    expect(heroCol(s)).toBe(79);
  });

  it('a death costs no life: Luigi stands back up at the lesson', () => {
    const { h, stage } = startStage('luigi');
    const s = stage();
    skipGreeting(h);
    playStage(h, s, luigiBot(), () => lessonId(s) === 'slide', 2400);
    const w = s.world;
    w.kill(w.player);
    hold(h, [], () => s.world !== w, 400);
    expect(s.state.lives).toBe(1);
    expect(lessonId(s)).toBe('slide');
    expect(heroCol(s)).toBe(30);
    expect(s.director.closedGates).not.toContain(S.runGate);
  });
});
