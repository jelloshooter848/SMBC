import { describe, expect, it } from 'vitest';
import { toPx } from '@engine/math/units';
import { defaultSettings, type Settings } from '@engine/save/settings';
import { recordClassicBeat } from '@game/scenes/original-game';
import { ClassicMenuScene, ClassicOptionsScene } from '@game/scenes/original-game';
import {
  ClassicDemo,
  DEMO_HEROES,
  DEMO_MAX_FRAMES,
  DEMO_TIMING,
  MARIO_WAIT,
  WAKE_AHEAD,
  demoDef,
} from '@game/scenes/title-demo';
import { CLASSIC_AT, ClassicTitleScene, PROMPT_BLINK, SMASH } from '@game/scenes/original-title';
import {
  BOX_GROW,
  boxGrowth,
  boxLayout,
  boxSize,
  cursorBob,
  MUSHROOM_CURSOR,
  type BoxRow,
} from '@game/scenes/menu-box';
import type { Scene } from '@engine/scene';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { TitleScene } from '@game/scenes/title';
import { TITLE_TIMING } from '@game/scenes/title-anim';
import type { MenuItem } from '@game/scenes/menu';
import type { Player } from '@game/entities/player';
import { draw, makeGame, store, useStorage, type H } from './heroes-harness';

// O-04 (docs/classic/RC_AUDIT_0.5.0.md, owner items): the CLASSIC title in the original's style
// (level/TitleLevel.as, messageBoxes/StartMenu.as): a live 1-1 demo with no HUD, the begin prompt
// blinking every 500 ms (steady with Reduce flashing), then the Start box (START, OPTIONS, BACK)
// and the map set menu as a box over the demo.

useStorage();

const items = (s: unknown) => (s as { items: MenuItem[] }).items;
const labels = (s: unknown) => items(s).map((i) => i.label);

function classic(over: Partial<Settings> = {}): H {
  const settings = { ...defaultSettings(), ...over };
  return makeGame({ deps: { settings, applySettings: () => {} } });
}

function demoCtx(h: H) {
  return h.game.ctx;
}

/** A Player's power as a rank (small < big < fire) and its hit points: neither may drop. */
function health(p: Player): number {
  const rank = ['small', 'big', 'fire'].indexOf(p.powerState);
  return rank * 1000 + p.hp;
}

describe('O-04 the demo (TitleLevel.as)', () => {
  it('Mario waits 5 s, then runs right by himself and clears 1-1; the demo then starts again', () => {
    const d = new ClassicDemo(demoCtx(classic()));
    const x0 = d.world.player.body.x;
    for (let i = 0; i < MARIO_WAIT; i++) d.update();
    expect(d.world.player.body.x).toBe(x0);
    let best = 0;
    for (let i = 0; i < 6000 && d.loops === 0; i++) {
      d.update();
      best = Math.max(best, toPx(d.world.player.body.x));
    }
    // The flag is near the level's end: he got there, and the loop began again from the start.
    expect(best).toBeGreaterThan(3100);
    expect(d.loops).toBe(1);
    expect(d.t).toBe(0);
    expect(d.world.player.body.x).toBe(x0);
    expect(d.awake).toEqual([]);
  });

  it('never damages anyone: no hero loses power or hit points, and Mario never dies', () => {
    const d = new ClassicDemo(demoCtx(classic()));
    expect(d.world.assist.invulnerable).toBe(true);
    expect(d.world.demo).toBe(true);
    const seen = new Map<Player, number>();
    for (let i = 0; i < 6000; i++) {
      d.update();
      if (d.loops > 0) break;
      expect(d.world.player.dead).toBe(false);
      for (const p of d.world.players) {
        const now = health(p);
        const before = seen.get(p);
        if (before !== undefined) expect(now, p.def.id).toBeGreaterThanOrEqual(before);
        seen.set(p, now);
      }
    }
    // Every one of the nine woke and played.
    expect(seen.size).toBe(DEMO_HEROES.length + 1);
  });

  it('the nine heroes stand powered up and wake as the screen reaches each, left to right', () => {
    const d = new ClassicDemo(demoCtx(classic()));
    for (const p of d.players.slice(1)) {
      const k = p.def.damage.kind;
      if (k === 'powerup') expect(p.powerState, p.def.id).toBe('big');
    }
    expect(d.players.slice(1).every((p) => p.def.rules === 'classic')).toBe(true);
    const order: string[] = [];
    for (let i = 0; i < 6000 && d.loops === 0; i++) {
      const right = toPx(d.world.camera.x) + 256 + WAKE_AHEAD;
      d.update();
      for (const id of d.awake)
        if (!order.includes(id)) {
          order.push(id);
          const hero = DEMO_HEROES.find((x) => x.id === id);
          // It woke as the screen's right edge came within reach of his spot.
          expect(right).toBeGreaterThan(hero?.x ?? 0);
        }
    }
    expect(order).toEqual(DEMO_HEROES.map((x) => x.id));
    expect(demoDef('bass').id).toBe('bass');
  });

  it("each hero's own script keeps the original's timing: first move and last release", () => {
    for (const hero of DEMO_HEROES) {
      const t = DEMO_TIMING[hero.id];
      expect(t, hero.id).toBeDefined();
      const firstMove = hero.script.find((s) => s.hold.length > 0);
      expect(firstMove?.frame, hero.id).toBe(t?.first);
      const last = hero.script.at(-1);
      expect(last?.frame, hero.id).toBe(t?.last);
      expect(last?.hold, hero.id).toEqual([]);
      // In order, each step after the one before.
      hero.script.forEach((s, i) => {
        if (i > 0) expect(s.frame, hero.id).toBeGreaterThan(hero.script[i - 1]?.frame ?? -1);
      });
    }
    expect(DEMO_MAX_FRAMES).toBeGreaterThan(60 * 60);
  });
});

describe('O-04 the CLASSIC title', () => {
  it('the title row opens it: the demo, announced with the prompt and the way back', () => {
    const h = classic();
    h.game.showTitle();
    h.idle(TITLE_TIMING.dropEnd + 10);
    const title = h.top() as TitleScene;
    const row = labels(title).indexOf('Classic');
    for (let i = 0; i < row; i++) h.tap('down');
    h.tap('jump');
    const ct = h.top();
    expect(ct).toBeInstanceOf(ClassicTitleScene);
    expect((ct as ClassicTitleScene).phase).toBe('demo');
    expect(h.said.at(-1)).toMatch(
      /^Classic\. The original game, with a demo of World 1-1 playing\. Press OK/,
    );
    expect(h.said.at(-1)).toMatch(/returns to the title\.$/);
    // The demo's level is drawn with no HUD (no SCORE/WORLD/TIME line) and our logo.
    const d = draw(ct as ClassicTitleScene);
    expect(d.texts.some((t) => /WORLD|TIME|SCORE/.test(t.str))).toBe(false);
    expect(d.sprites.some((s) => s.frame === 'cross-0')).toBe(true);
    expect(d.texts.some((t) => t.str.startsWith('VER '))).toBe(true);
  });

  it("the prompt: first at 5.5 s (the blink timer's first tick), then 500 ms on and 500 ms off; it names the ability", () => {
    const h = classic();
    h.game.ctx.reduceFlashing = false;
    const ct = new ClassicTitleScene(h.game);
    // shown[t]: the prompt at demo frame t.
    const shown: boolean[] = [false];
    for (let t = 1; t <= MARIO_WAIT + PROMPT_BLINK * 5; t++) {
      ct.demo.update();
      expect(ct.demo.t).toBe(t);
      shown.push(ct.promptShown());
    }
    const first = MARIO_WAIT + PROMPT_BLINK;
    expect(first).toBe(330);
    expect(shown.slice(0, first).some(Boolean)).toBe(false);
    expect(shown.slice(first, first + PROMPT_BLINK).every(Boolean)).toBe(true);
    expect(shown.slice(first + PROMPT_BLINK, first + PROMPT_BLINK * 2).some(Boolean)).toBe(false);
    expect(shown.slice(first + PROMPT_BLINK * 2, first + PROMPT_BLINK * 3).every(Boolean)).toBe(true);
    expect(ct.prompt).toMatch(/^PRESS OK\b.* TO BEGIN$/);
    expect(ct.prompt).not.toMatch(/\b[ABC]\b/);
  });

  it('the version shows until the prompt first does, then is gone for good (TitleLevel.as:305-306)', () => {
    const h = classic();
    h.game.ctx.reduceFlashing = false;
    h.game.showClassicTitle();
    const ct = h.top() as ClassicTitleScene;
    const version = () => draw(ct).texts.some((t) => t.str.startsWith('VER '));
    expect(version()).toBe(true);
    h.idle(MARIO_WAIT + PROMPT_BLINK - 2);
    expect(version()).toBe(true);
    h.idle(3);
    expect(ct.promptShown()).toBe(true);
    expect(version()).toBe(false);
    h.idle(PROMPT_BLINK);
    expect(ct.promptShown()).toBe(false);
    expect(version()).toBe(false);
  });

  it('Reduce flashing holds the prompt steady and the mushroom cursor still', () => {
    const h = classic();
    h.game.ctx.reduceFlashing = true;
    const ct = new ClassicTitleScene(h.game);
    for (let i = 0; i < MARIO_WAIT + PROMPT_BLINK; i++) ct.demo.update();
    for (let i = 0; i < PROMPT_BLINK * 4; i++) {
      ct.demo.update();
      expect(ct.promptShown()).toBe(true);
    }
    for (let t = 0; t < 64; t++) expect(cursorBob(t, true)).toBe(0);
    expect(new Set(Array.from({ length: 64 }, (_, t) => cursorBob(t, false))).size).toBe(2);
    // The boxes open at once with Reduce flashing, else they grow in BOX_GROW frames.
    expect(boxGrowth(0, true)).toBe(1);
    expect(boxGrowth(0, false)).toBeLessThan(0.1);
    expect(boxGrowth(BOX_GROW, false)).toBe(1);
    expect(MUSHROOM_CURSOR.every((row) => row.length === 8)).toBe(true);
  });

  it('the demo never blocks input: OK on its first frame opens the Start box at once', () => {
    const h = classic();
    h.game.showClassicTitle();
    h.tap('jump');
    const ct = h.top() as ClassicTitleScene;
    expect(ct.phase).toBe('start');
    expect(h.said.at(-1)).toBe('Start menu. Start. Choose a map set and its difficulty, then a hero');
    expect(labels(ct)).toEqual(['Start', 'Options', 'Back']);
    // A box with the rows, the highlighted one in the select's pink.
    const d = draw(ct);
    expect(d.texts.map((t) => t.str)).toEqual(expect.arrayContaining(['START', 'OPTIONS', 'BACK']));
    expect(d.texts.some((t) => t.str === 'CONTINUE' || t.str === 'LINKS')).toBe(false);
  });

  it('the Start box: moves and reads its rows, BACK closes it to the demo, BACK there to the title', () => {
    const h = classic();
    h.game.showClassicTitle();
    h.tap('start');
    const ct = h.top() as ClassicTitleScene;
    h.tap('down');
    expect(h.said.at(-1)).toMatch(/^Options\. Classic rules/);
    expect(h.audio.sfx).toHaveBeenCalledWith('fireball');
    h.tap('down');
    expect(h.said.at(-1)).toMatch(/^Back\. To the title/);
    h.tap('down');
    expect(h.said.at(-1)).toMatch(/^Start\./);
    h.tap('attack');
    expect(ct.phase).toBe('demo');
    expect(h.audio.sfx).toHaveBeenCalledWith('bump');
    expect(h.said.at(-1)).toMatch(/^Classic\./);
    h.tap('attack');
    expect(h.top()).toBeInstanceOf(TitleScene);
  });

  it('it remembers its cursor between visits (StartMenu.lastIndex)', () => {
    const h = classic();
    h.game.showClassicTitle();
    h.tap('jump');
    h.tap('down');
    h.tap('attack');
    h.tap('jump');
    expect((h.top() as ClassicTitleScene).index).toBe(1);
    h.tap('up');
  });

  it('OPTIONS opens the Classic options, and BACK there returns to the box', () => {
    const h = classic();
    h.game.showClassicTitle('start');
    const ct = h.top() as ClassicTitleScene;
    while (ct.index !== 1) h.tap('down');
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(ClassicOptionsScene);
    h.idle(8);
    h.tap('attack');
    expect(h.top()).toBe(ct);
    expect(ct.phase).toBe('start');
  });

  it('START: the map set menu as a box over the demo; it keeps playing; BACK returns to the Start box', () => {
    recordClassicBeat('smb');
    const h = classic();
    h.game.showClassicTitle('start');
    const ct = h.top() as ClassicTitleScene;
    while (ct.index !== 0) h.tap('down');
    h.tap('jump');
    const menu = h.top() as ClassicMenuScene;
    expect(menu).toBeInstanceOf(ClassicMenuScene);
    expect(menu.over).toBe(ct);
    expect(menu.translucent).toBe(true);
    expect(h.said.at(-1)).toMatch(/^Classic\. The original game\. Super Mario Bros\./);
    const t0 = ct.demo.t;
    h.idle(10);
    expect(ct.demo.t).toBe(t0 + 10);
    // Drawn as a box: BEATEN at the SMB row's right, the BACK line named by ability.
    const d = draw(menu);
    const smb = d.texts.find((t) => t.str === 'SUPER MARIO BROS.');
    const mark = d.texts.find((t) => t.str === 'BEATEN');
    expect(mark?.y).toBe(smb?.y);
    expect(d.texts.some((t) => t.str.startsWith('BACK'))).toBe(true);
    h.tap('attack');
    expect(h.top()).toBe(ct);
    expect(ct.phase).toBe('start');
    expect(h.said.at(-1)).toMatch(/^Start menu\./);
  });

  it('a map set goes on to the select, and its BACK comes back to the map set box', () => {
    const h = classic();
    h.game.showClassicTitle('start');
    h.tap('jump');
    h.idle(8);
    h.tap('jump'); // Super Mario Bros.
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
    h.idle(12);
    h.tap('attack');
    const menu = h.top() as ClassicMenuScene;
    expect(menu).toBeInstanceOf(ClassicMenuScene);
    expect(menu.over).toBeInstanceOf(ClassicTitleScene);
    h.idle(8);
    h.tap('attack');
    expect(h.top()).toBeInstanceOf(ClassicTitleScene);
  });

  it('a tap or click on the screen begins, as the original (TitleLevel.clickHandler)', () => {
    const listeners: ((e: unknown) => void)[] = [];
    const canvas = {
      addEventListener: (_: string, f: (e: unknown) => void) => listeners.push(f),
      removeEventListener: () => {},
    } as unknown as HTMLCanvasElement;
    const settings = defaultSettings();
    const h = makeGame({ deps: { settings, applySettings: () => {}, canvas } });
    h.game.showClassicTitle();
    for (const f of listeners) f({});
    h.idle(1);
    expect((h.top() as ClassicTitleScene).phase).toBe('start');
    expect((h.top() as ClassicTitleScene).touchLabels().jump).toBe('OK');
    expect((h.top() as ClassicTitleScene).touchLabels().attack).toBe('BACK');
  });
});

// The owner's CLASSIC smash on O-04: on the way in from the title a big CLASSIC drops onto the
// REMIX stamp and lands hard, once; skippable; still under Reduce flashing; never replayed.
describe('O-04 the CLASSIC smash', () => {
  const frames = (scene: ClassicTitleScene) => draw(scene).sprites.map((s) => s.frame);
  const stamps = (h: H) => h.audio.sfx.mock.calls.filter((c) => c[0] === 'stamp').length;

  it('plays once from the title: REMIX until it lands, one thud, a shake, then CLASSIC in place', () => {
    const h = classic();
    h.game.ctx.reduceFlashing = false;
    h.game.showClassicTitle();
    const ct = h.top() as ClassicTitleScene;
    expect(ct.smashPhase()).toBe('drop');
    expect(frames(ct)).toEqual(expect.arrayContaining(['remix', 'classic']));
    const shakes: number[] = [];
    for (let i = 0; i < SMASH.end + 5; i++) {
      h.idle(1);
      shakes.push(ct.shake());
    }
    expect(stamps(h)).toBe(1);
    expect(shakes.some((s) => s !== 0)).toBe(true);
    expect(ct.smashPhase()).toBe('done');
    expect(ct.shake()).toBe(0);
    const done = draw(ct).sprites;
    expect(done.map((s) => s.frame)).not.toContain('remix');
    expect(done.find((s) => s.frame === 'classic')).toMatchObject(CLASSIC_AT);
    // The announcement opens with the word.
    expect(h.said.at(-1)).toMatch(/^Classic\./);
    // The demo's timing is untouched by it.
    expect(ct.demo.t).toBe(SMASH.end + 5);
  });

  it('any press finishes it at once and still opens the Start box', () => {
    const h = classic();
    h.game.ctx.reduceFlashing = false;
    h.game.showClassicTitle();
    const ct = h.top() as ClassicTitleScene;
    h.idle(3);
    expect(ct.smashPhase()).toBe('drop');
    h.tap('jump');
    expect(ct.smashPhase()).toBe('done');
    expect(ct.phase).toBe('start');
    // Skipped before it landed: no thud, no shake.
    expect(stamps(h)).toBe(0);
    expect(ct.shake()).toBe(0);
  });

  it('Reduce flashing: CLASSIC is simply in place, with no fall, shake, chips or thud', () => {
    const h = classic();
    h.game.ctx.reduceFlashing = true;
    h.game.showClassicTitle();
    const ct = h.top() as ClassicTitleScene;
    for (let i = 0; i < SMASH.end; i++) {
      expect(ct.smashPhase()).toBe('done');
      expect(ct.shake()).toBe(0);
      const f = frames(ct);
      expect(f).toContain('classic');
      expect(f).not.toContain('brick-bit');
      expect(f).not.toContain('remix');
      h.idle(1);
    }
    expect(stamps(h)).toBe(0);
  });

  it('coming back from a run, the select or the map set menu: already in place, never replayed', () => {
    const h = classic();
    h.game.ctx.reduceFlashing = false;
    h.game.showClassicMenu();
    const under = (h.top() as ClassicMenuScene).over as ClassicTitleScene;
    expect(under.smashPhase()).toBe('done');
    h.game.showClassicTitle('start');
    expect((h.top() as ClassicTitleScene).smashPhase()).toBe('done');
    // BACK in the Start box returns to the demo of the same title: still no replay.
    h.tap('attack');
    expect((h.top() as ClassicTitleScene).phase).toBe('demo');
    expect((h.top() as ClassicTitleScene).smashPhase()).toBe('done');
    expect(stamps(h)).toBe(0);
  });
});

describe('O-04 QA: one title, a clear layout, a demo that leaves no trace', () => {
  const stack = (h: H) => (h.game.scenes as unknown as { stack: Scene[] }).stack;

  it('5 round trips (map set > select > BACK) leave one CLASSIC title and one pointer listener', () => {
    const live = new Set<unknown>();
    const canvas = {
      addEventListener: (_: string, f: unknown) => live.add(f),
      removeEventListener: (_: string, f: unknown) => live.delete(f),
    } as unknown as HTMLCanvasElement;
    const h = makeGame({ deps: { settings: defaultSettings(), applySettings: () => {}, canvas } });
    h.game.showClassicTitle();
    h.tap('jump');
    h.tap('jump');
    for (let trip = 0; trip < 5; trip++) {
      expect(h.top()).toBeInstanceOf(ClassicMenuScene);
      h.idle(8);
      h.tap('jump'); // Super Mario Bros.
      expect(h.top()).toBeInstanceOf(CharacterSelectScene);
      // The select replaced the title and its menu (their exits ran).
      expect(stack(h).some((s) => s instanceof ClassicTitleScene)).toBe(false);
      expect(live.size).toBe(0);
      h.idle(12);
      h.tap('attack');
    }
    expect(stack(h).filter((s) => s instanceof ClassicTitleScene)).toHaveLength(1);
    expect(stack(h).filter((s) => s instanceof ClassicMenuScene)).toHaveLength(1);
    expect(live.size).toBe(1);
    // And showClassicTitle / showClassicMenu called again keep it at one.
    h.game.showClassicTitle('start');
    h.game.showClassicMenu();
    h.game.showClassicTitle();
    expect(stack(h).filter((s) => s instanceof ClassicTitleScene)).toHaveLength(1);
    expect(stack(h)).toHaveLength(1);
    expect(live.size).toBe(1);
  });

  it('the status line and the BACK hint sit clear of the box at every row count', () => {
    for (let n = 1; n <= 12; n++) {
      const rows: BoxRow[] = Array.from({ length: n }, (_, i) => ({
        label: i === 0 ? 'Super Mario Bros.' : `Row ${i}`,
        ...(i === 1 ? { value: 'Normal' } : {}),
      }));
      for (const status of [false, true]) {
        const at = boxLayout(rows, status, 160);
        const { h } = boxSize(rows);
        expect(at.bottom - at.top).toBe(h);
        expect(at.top, `${n} rows`).toBeGreaterThanOrEqual(0);
        const under = status ? (at.statusY as number) : at.backY;
        expect(at.bottom, `${n} rows, status ${status}`).toBeLessThan(under);
        if (status) expect((at.statusY as number) + 8).toBeLessThan(at.backY);
        expect(at.backY + 8).toBeLessThanOrEqual(240);
      }
    }
  });

  it('the map set box as drawn: its status line and BACK hint under its frame, with and without Continue', () => {
    const lineYs = (h: H) => {
      const d = draw(h.top() as ClassicMenuScene);
      const back = d.texts.filter((t) => t.str.startsWith('BACK') && t.x > 60).at(-1);
      const status = d.texts.filter((t) => /RULES/.test(t.str)).at(-1);
      const back0 = d.texts.find((t) => t.str === 'BACK' && t.x < 60);
      return { back, status, lastRow: back0 };
    };
    const seen = { status: 0, continue: 0 };
    for (const rules of ['classic', 'current'] as const) {
      for (const kept of [false, true]) {
        store.clear();
        const settings = { ...defaultSettings(), dev: true, classicRules: rules } as Settings;
        const h = makeGame({ deps: { settings, applySettings: () => {} } });
        if (kept) {
          h.game.classicGame(demoDef('mario'), '1-2');
          h.idle(5);
        }
        h.game.showClassicMenu();
        const menu = h.top() as ClassicMenuScene;
        const status = (menu as unknown as { status: string }).status;
        if (status) seen.status++;
        // Per-set saves (B-G): no Continue row; the saved run's set says so in its hint.
        if ((menu as unknown as { items: { hint?: string }[] }).items[0]?.hint?.includes('Saved run'))
          seen.continue++;
        const y = lineYs(h);
        // The box's last row (BACK) is above the lines under the box.
        expect(y.lastRow).toBeDefined();
        expect(y.back?.y ?? 0).toBeGreaterThan((y.lastRow?.y ?? 0) + 8);
        if (status) {
          expect(y.status).toBeDefined();
          // Whole, and on the screen.
          expect(y.status?.str).toBe(status.toUpperCase());
          expect(y.status?.x ?? -1).toBeGreaterThanOrEqual(0);
          expect((y.status?.x ?? 0) + status.length * 8).toBeLessThanOrEqual(256);
          expect(y.status?.y ?? 0).toBeGreaterThan((y.lastRow?.y ?? 0) + 8 + 6);
          expect((y.status?.y ?? 0) + 8).toBeLessThan(y.back?.y ?? 0);
        }
      }
    }
    // Both cases were drawn: the Campaign-rules status line (dev mode) and a saved run.
    expect(seen.status).toBeGreaterThan(0);
    expect(seen.continue).toBeGreaterThan(0);
  });

  it('two loops of the demo change nothing: storage, the game state, rules, the run, cheats, sounds', () => {
    const settings = defaultSettings();
    const h = makeGame({ deps: { settings, applySettings: () => {} } });
    h.game.ctx.reduceFlashing = true;
    h.game.showClassicTitle();
    const ct = h.top() as ClassicTitleScene;
    const snap = () =>
      JSON.stringify({
        store: [...store.entries()],
        state: { ...h.game.state, character: h.game.state.character.id, character2: null },
        runRules: h.game.runRules,
        classicRun: h.game.classicRun,
        settings,
      });
    const before = snap();
    const sfx = h.audio.sfx.mock.calls.length;
    const music = h.audio.playMusic.mock.calls.length;
    for (let i = 0; i < 12000 && ct.demo.loops < 2; i++) h.step();
    expect(ct.demo.loops).toBe(2);
    expect(snap()).toBe(before);
    expect(h.audio.sfx.mock.calls.length).toBe(sfx);
    expect(h.audio.playMusic.mock.calls.length).toBe(music);
  }, 120000);
});
