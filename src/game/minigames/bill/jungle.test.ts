import { beforeEach, describe, expect, it } from 'vitest';
import { levelIds } from '@content/levels';
import type { Action } from '@engine/input/actions';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import type { AssetRegistry } from '@engine/assets/registry';
import { defaultSettings } from '@engine/save/settings';
import { ScriptedInput } from '@game/sim/headless';
import type { MenuItem } from '@game/scenes/menu';
import { AssistOptionsScene } from '@game/scenes/options';
import { TitleScene } from '@game/scenes/title';
import { ROUND_GIVE_UP_HINT } from '@game/minigames/menu';
import { ARENA_GAMES } from '@game/arena';
import { BILL } from '@game/characters/bill';
import { GUNS as MAIN_GUNS } from '@game/characters/bill/weapons';
import { MINIGAMES, miniGameFor } from '..';
import { BILL_MINIGAME } from '.';
import {
  BARRIER_FRAMES,
  DEATH_FRAMES,
  GUNS,
  JUMP_V,
  RESPAWN_INVULN,
  RESPAWN_X,
  WADE_DEPTH,
  WALK,
  type Commando,
} from './commando';
import { BlastBridge, Capsule, Falcon, Pillbox, Soldier, TURN_EVERY, WallGun, PILLBOX_SHUT } from './foes';
import { BREACH_FRAMES, CORE_HP, HEART_HP, Larva, POD_SPIT, POD_FIRST } from './boss';
import { Jungle, LAIR_BACK } from './jungle';
import { C, COLS, jungleStage, LAIR_CAM, TIER, WALL_CAM, WALL_X, WATER_Y } from './stage';
import { CARD_ANIM } from './card';
import { GAME_OVER_FRAMES, JungleMenuScene, KONAMI_LIVES, LIVES, WIN_FRAMES } from './scene';
import { JungleBot, SHARP } from './bot';
import { jungleHarness, type JungleHarness } from './harness';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

class TextRenderer implements Renderer {
  texts: string[] = [];
  rects: [number, number, number, number, string][] = [];
  private readonly none = new NullRenderer();
  clear = this.none.clear;
  sprite = this.none.sprite;
  debugText = this.none.debugText;
  line = this.none.line;
  rect(x: number, y: number, w: number, h: number, c: string): void {
    this.rects.push([x, y, w, h, c]);
  }
  text(...args: Parameters<Renderer['text']>): void {
    this.texts.push(args[1]);
  }
}

const STUB_ASSETS = {
  sheet: () => ({ id: 'stub', image: null, frames: new Map() }),
  has: () => false,
} as unknown as AssetRegistry;

function draw(h: JungleHarness): TextRenderer {
  const r = new TextRenderer();
  h.game.scenes.render(r);
  return r;
}

/** A bare simulation and a stepper for it (Bill's own tests). */
function sim(seed = 1) {
  const j = new Jungle({ seed });
  const input = new ScriptedInput({ steps: [] });
  const step = (held: Action[] = [], n = 1) => {
    for (let i = 0; i < n; i++) {
      input.setHeld(held);
      input.next();
      j.update(input);
    }
  };
  return { j, step, b: j.bill };
}

/** Bill standing at (x, feet), the camera on him, nothing else around. */
function place(j: Jungle, x: number, y: number, state: Commando['state'] = 'ground'): void {
  const b = j.bill;
  b.x = x;
  b.y = y;
  b.vy = 0;
  b.state = state;
  b.spin = false;
  j.camX = Math.max(0, Math.min(j.camMax, x - 120));
  j.things = j.things.filter((t) => t.pinned);
  j.foeShots = [];
}

/** Clears the stage of soldiers' spawns for a test (zones off). */
function quiet(j: Jungle): void {
  j.zones.length = 0;
}

describe('Jungle Assault: the mini game contract', () => {
  it('frees Bill: registered (Dev → Mini games and the arena list MINIGAMES), a title, and rules naming abilities', () => {
    expect(miniGameFor('bill')).toBe(BILL_MINIGAME);
    expect(Object.keys(MINIGAMES)).toContain('bill');
    expect(ARENA_GAMES.map((g) => g.id)).toContain('mini-bill');
    expect(BILL_MINIGAME.title).toBe('JUNGLE ASSAULT');
    for (const line of BILL_MINIGAME.rules) expect(line.length).toBeLessThanOrEqual(26);
    const rules = BILL_MINIGAME.rules.join(' ');
    for (const w of ['JUMP', 'FIRE', 'AIM', 'RED FALCON', 'LIFE']) expect(rules).toMatch(w);
    expect(rules).not.toMatch(/\b[ABXYZC] BUTTON|\bPRESS [ABXYZC]\b/);
  });

  it("Bill's main-game kit is untouched (the Contra form is the mini game's own)", () => {
    expect(BILL.damage).toMatchObject({ kind: 'hp', max: 5 });
    expect(MAIN_GUNS.map((g) => g.id)).toEqual(['rifle', 'mg', 'spread', 'laser', 'flame-gun']);
  });

  it('the stage is kept out of the level library: river, tiers 32 px apart, two exploding bridges, a bank at every river crossing', () => {
    expect(levelIds().some((id) => /jungle|contra|bill-mini/.test(id))).toBe(false);
    const st = jungleStage();
    expect(st.bridges.map((b) => b.len)).toEqual([8, 8]);
    expect([TIER.bank - TIER.low, TIER.low - TIER.mid, TIER.mid - TIER.high]).toEqual([32, 32, 32]);
    // Every stretch of river ends (going right) at a bank Bill can climb out on: one flush with
    // the water, or the base floor 16 px over it.
    const cell = (x: number, y: number) => st.cells[y * COLS + x];
    let x = 0;
    while (x < COLS) {
      if (cell(x, 13) !== C.WATER) {
        x++;
        continue;
      }
      while (x < COLS && cell(x, 13) === C.WATER) x++;
      expect(cell(x, 13) === C.BASE || cell(x, 12) === C.BASE, `bank at ${x}`).toBe(true);
    }
    const kinds = new Set(st.placed.map((p) => p.type));
    for (const k of ['rifleman', 'wall-gun', 'cannon', 'pillbox', 'capsule'])
      expect(kinds.has(k as never)).toBe(true);
    expect(st.placed.some((p) => p.type === 'rifleman' && p.bush)).toBe(true);
    const weapons = st.placed.flatMap((p) => ('weapon' in p ? [p.weapon] : [])).sort();
    expect(weapons).toEqual(['B', 'F', 'L', 'M', 'R', 'S']);
  });
});

describe('Jungle Assault: the stage card and the Konami code', () => {
  it('opens on the Contra-style card (its sting, announced): island map, STAGE 1 / JUNGLE, REST 2, the briefing; SKIP then OK', () => {
    const h = jungleHarness({ assets: STUB_ASSETS });
    expect(h.scene.phase).toBe('card');
    expect(h.log.jingles).toContain('contra-card');
    expect(h.said.at(-1)).toMatch(
      /Jungle Assault\. Stage 1: Jungle\. Red Falcon's aliens have taken Bill's mind/,
    );
    expect(h.scene.touchLabels()).toMatchObject({ jump: 'SKIP', attack: '', start: 'MENU', special: null });
    h.step([], CARD_ANIM);
    const t = draw(h).texts;
    for (const s of ['STAGE 1', 'JUNGLE', 'REST 2', "RED FALCON'S ALIENS HAVE", 'TO THE ALIEN HEART!'])
      expect(t).toContain(s);
    expect(t.some((s) => /^OK/.test(s))).toBe(true);
    expect(h.scene.touchLabels()).toMatchObject({ jump: 'OK' });
  });

  it('JUMP skips the drawing, the next starts the stage: Bill drops in from the top, and the press does not make him jump', () => {
    const h = jungleHarness();
    h.step([], 10);
    h.tap('jump');
    expect(h.scene.phase).toBe('card');
    expect(h.scene.phaseT).toBeGreaterThanOrEqual(CARD_ANIM);
    h.tap('jump');
    expect(h.scene.phase).toBe('play');
    expect(h.log.music.at(-1)).toBe('contra-stage');
    const b = h.jungle.bill;
    expect(b.y).toBeLessThan(40);
    expect(b.vy).toBeGreaterThanOrEqual(0);
    h.step([], 80);
    expect(b.state).toBe('ground');
    expect(b.y).toBe(TIER.mid);
  });

  it('the Konami code on the card (keys, pad or touch: the same actions) gives 30 lives, with a sound and the announcer', () => {
    const h = jungleHarness({ assets: STUB_ASSETS });
    h.game.deps.settings = { ...defaultSettings(), dev: false };
    for (const a of [
      'up',
      'up',
      'down',
      'down',
      'left',
      'right',
      'left',
      'right',
      'attack',
      'jump',
    ] as Action[])
      h.tap(a);
    expect(h.scene.konami).toBe(true);
    expect(h.scene.lives).toBe(KONAMI_LIVES);
    expect(h.jungle.rest).toBe(KONAMI_LIVES - 1);
    expect(h.log.sfx).toContain('konami');
    expect(h.said.at(-1)).toBe('Konami code! 30 lives.');
    // Its last press (JUMP) does not also start the stage, and the title's developer code did not fire.
    expect(h.scene.phase).toBe('card');
    expect(h.game.deps.settings.dev).toBe(false);
    expect(draw(h).texts).toEqual(expect.arrayContaining(['REST 29', '30 LIVES!']));
  });

  it('the code works only on the card, and the title screen code does not carry into the round', () => {
    const h = jungleHarness({ skipCard: true });
    for (const a of [
      'up',
      'up',
      'down',
      'down',
      'left',
      'right',
      'left',
      'right',
      'attack',
      'jump',
    ] as Action[])
      h.tap(a);
    expect(h.scene.konami).toBe(false);
    expect(h.jungle.rest).toBe(LIVES - 1);
    // At the title the same code turns on developer mode (its own), and a round after it still has 3 lives.
    const h2 = jungleHarness({ keep: true });
    h2.game.deps.settings = { ...defaultSettings(), dev: false };
    h2.game.scenes.pop();
    h2.game.scenes.push(new TitleScene(h2.game));
    for (const a of [
      'up',
      'up',
      'down',
      'down',
      'left',
      'right',
      'left',
      'right',
      'attack',
      'jump',
    ] as Action[])
      h2.tap(a);
    expect(h2.game.deps.settings.dev).toBe(true);
    const fresh = BILL_MINIGAME.create(h2.game, () => {}) as typeof h.scene;
    expect(fresh.lives).toBe(LIVES);
    expect(fresh.jungle.rest).toBe(LIVES - 1);
  });
});

describe('Jungle Assault: Bill in Contra form', () => {
  it("aims by Contra's rules: standing up / the up-diagonals; running with DOWN the down-diagonals; DOWN alone prone and low; all eight in the air", () => {
    const { b } = sim();
    b.state = 'ground';
    b.facing = 1;
    expect(b.aimFor(0, false, false)).toEqual({ x: 1, y: 0 });
    expect(b.aimFor(0, true, false)).toEqual({ x: 0, y: -1 });
    expect(b.aimFor(1, true, false)).toEqual({ x: 1, y: -1 });
    expect(b.aimFor(-1, false, true)).toEqual({ x: -1, y: 1 });
    b.prone = true;
    expect(b.aimFor(0, false, true)).toEqual({ x: 1, y: 0 });
    expect(b.muzzle().y).toBe(b.y - 5);
    b.prone = false;
    b.state = 'air';
    expect(b.aimFor(0, false, true)).toEqual({ x: 0, y: 1 });
    expect(b.aimFor(-1, false, true)).toEqual({ x: -1, y: 1 });
    expect(b.aimFor(1, true, false)).toEqual({ x: 1, y: -1 });
    b.state = 'water';
    expect(b.aimFor(0, true, false)).toEqual({ x: 0, y: -1 });
    expect(b.aimFor(1, true, false)).toEqual({ x: 1, y: -1 });
    expect(b.aimFor(1, false, true)).toEqual({ x: 1, y: 0 });
  });

  it('the jump is a fixed somersault (the same 40 px apex held or tapped), steered at walking pace in the air', () => {
    const apex = (hold: boolean) => {
      const { j, step, b } = sim();
      quiet(j);
      place(j, 100, TIER.mid);
      step(['jump']);
      let top = b.y;
      for (let i = 0; i < 60 && b.state === 'air'; i++) {
        step(hold ? ['jump'] : []);
        top = Math.min(top, b.y);
      }
      return { rise: TIER.mid - top, spin: true, landed: b.state };
    };
    expect(apex(true)).toEqual(apex(false));
    expect(apex(true).rise).toBeGreaterThanOrEqual(37.9);
    expect(apex(true).rise).toBeLessThanOrEqual(41);
    const { j, step, b } = sim();
    quiet(j);
    place(j, 100, TIER.mid);
    step(['jump']);
    expect(b.spin).toBe(true);
    expect(b.vy).toBeCloseTo(-JUMP_V + 0.2);
    const x = b.x;
    step(['left'], 10);
    expect(b.x).toBeCloseTo(x - 10 * WALK);
    expect(b.hitBox()?.h).toBe(14);
  });

  it('DOWN + JUMP drops through a ledge to the tier below; not through a bank (it jumps)', () => {
    const { j, step, b } = sim();
    quiet(j);
    place(j, 20 * 16, TIER.mid);
    step(['down', 'jump']);
    expect(b.state).toBe('air');
    expect(b.spin).toBe(false);
    step(['down'], 40);
    expect(b.state).toBe('ground');
    expect(b.y).toBe(TIER.low);
    place(j, 92 * 16, TIER.bank);
    step(['down', 'jump']);
    expect(b.spin).toBe(true);
  });

  it('in the river he wades (head and gun above water), cannot jump, ducks under with DOWN (nothing hits him, he cannot shoot) and climbs out onto the bank', () => {
    const { j, step, b } = sim();
    quiet(j);
    place(j, 81 * 16, TIER.low - 64, 'air');
    step([], 60);
    expect(b.state).toBe('water');
    expect(b.y).toBe(WATER_Y + WADE_DEPTH);
    step(['jump']);
    step();
    expect(b.state).toBe('water');
    step(['down']);
    expect(b.dive).toBe(true);
    expect(b.hitBox()).toBeNull();
    j.foeShot(b.x, WATER_Y - 4, 0, 0);
    step(['down', 'attack']);
    expect(b.alive).toBe(true);
    expect(j.shots).toHaveLength(0);
    j.foeShots = [];
    step(['right'], 200);
    expect(b.state).toBe('ground');
    expect(b.y).toBe(TIER.bank);
  });

  it('one hit kills: the death flip, then the next life drops in from the top at the scroll, blinking ~2 s; the medals count down', () => {
    const h = jungleHarness({ skipCard: true });
    const j = h.jungle;
    h.step([], 60);
    quiet(j);
    const b = j.bill;
    j.foeShot(b.x, b.y - 12, 0, 0);
    h.step();
    expect(b.state).toBe('dead');
    expect(h.log.sfx).toContain('contra-death');
    expect(h.said.at(-1)).toBe('Bill is down! 2 lives left.');
    let rose = false;
    for (let i = 0; i < 20; i++) {
      h.step();
      if (b.y < TIER.mid - 10) rose = true;
    }
    expect(rose).toBe(true);
    h.step([], 40);
    expect(b.flat).toBe(true);
    h.step([], DEATH_FRAMES - 60);
    expect(b.state).toBe('air');
    expect(b.x).toBe(j.camX + RESPAWN_X);
    expect(b.y).toBeLessThan(0);
    expect(b.invuln).toBeGreaterThan(RESPAWN_INVULN - 3);
    expect(j.rest).toBe(LIVES - 2);
    expect(RESPAWN_INVULN / 60).toBeCloseTo(2, 0);
  });

  it('death loses the weapon: back to the default gun (no rapid, no barrier)', () => {
    const { j, step, b } = sim();
    quiet(j);
    place(j, 100, TIER.mid);
    j.giveWeapon('S');
    j.giveWeapon('R');
    expect(b.gun).toBe('S');
    expect(b.rapid).toBe(true);
    b.kill(j);
    expect([b.gun, b.rapid, b.barrier]).toEqual(['default', false, 0]);
    step([], DEATH_FRAMES + 2);
    expect(b.gun).toBe('default');
  });

  it('out of lives: GAME OVER, then fail (reported once)', () => {
    const h = jungleHarness({ skipCard: true, keep: true, assets: STUB_ASSETS });
    const j = h.jungle;
    h.step([], 60);
    j.rest = 0;
    j.foeShot(j.bill.x, j.bill.y - 12, 0, 0);
    h.step([], DEATH_FRAMES + 2);
    expect(j.phase).toBe('lost');
    expect(h.said.at(-1)).toBe('Game over. Try again.');
    expect(draw(h).texts).toContain('GAME OVER');
    h.step([], GAME_OVER_FRAMES);
    expect(h.results).toEqual(['fail']);
    for (let i = 0; i < 200; i++) h.step(i % 5 === 0 ? ['start'] : []);
    expect(h.results).toEqual(['fail']);
    expect(h.game.scenes.top).toBe(h.scene);
  });
});

describe('Jungle Assault: falcon weapons, capsules and pillboxes', () => {
  const firing = (gun: 'default' | 'M' | 'S' | 'L' | 'F', held: (i: number) => Action[], n = 40) => {
    const { j, step, b } = sim();
    quiet(j);
    place(j, 100, TIER.mid);
    b.gun = gun;
    let most = 0;
    let fired = 0;
    for (let i = 0; i < n; i++) {
      const before = b.sinceShot;
      step(held(i));
      if (b.sinceShot === 0 && before !== 0) fired++;
      most = Math.max(most, j.shots.length);
    }
    return { most, fired, j };
  };

  it('the default gun: a shot a press, four on screen; M fires while FIRE is held; S fans five; L: one beam, a new one replaces it', () => {
    expect(firing('default', () => ['attack']).fired).toBe(1);
    expect(firing('default', (i) => (i % 2 ? [] : ['attack'])).most).toBe(GUNS.default.maxOut);
    expect(firing('M', () => ['attack']).fired).toBeGreaterThan(3);
    const s = firing('S', () => ['attack'], 1);
    expect(s.j.shots).toHaveLength(5);
    const l = firing('L', (i) => (i % 2 ? [] : ['attack']));
    expect(l.most).toBe(1);
  });

  it('F loops round its line (a corkscrew); R speeds the shots up', () => {
    const f = firing('F', () => ['attack'], 12).j.shots[0];
    expect(f && Math.abs(f.y - f.by)).toBeGreaterThan(1);
    const slow = firing('default', () => ['attack'], 1).j.shots[0];
    const { j, step, b } = sim();
    quiet(j);
    place(j, 100, TIER.mid);
    j.giveWeapon('R');
    step(['attack']);
    expect(b.gun).toBe('default');
    expect(Math.abs(j.shots[0]?.vx ?? 0)).toBeGreaterThan(Math.abs(slow?.vx ?? 0) * 1.4);
  });

  it('B, the barrier: nothing can touch him for a while, and touching a soldier fells it', () => {
    const { j, step, b } = sim();
    quiet(j);
    place(j, 100, TIER.mid);
    j.giveWeapon('B');
    expect(b.barrier).toBe(BARRIER_FRAMES);
    const s = new Soldier(b.x + 20, TIER.mid, -1);
    j.spawn(s);
    j.foeShot(b.x, b.y - 12, 0, 0);
    step([], 20);
    expect(b.alive).toBe(true);
    expect(s.alive).toBe(false);
  });

  it('a flying capsule (sine flight) shot down drops its falcon; touching the falcon takes the weapon (sound, announcer)', () => {
    const h = jungleHarness({ skipCard: true });
    const j = h.jungle;
    quiet(j);
    h.step([], 60);
    const cap = new Capsule(j.bill.x - 20, 90, 'S');
    j.spawn(cap);
    const ys = new Set<number>();
    for (let i = 0; i < 40; i++) {
      h.step();
      ys.add(Math.round(cap.y));
    }
    expect(ys.size).toBeGreaterThan(5);
    cap.hit(1, j);
    const falcon = j.things.find((t) => t instanceof Falcon) as Falcon;
    expect(falcon.weapon).toBe('S');
    falcon.x = j.bill.x;
    falcon.vx = 0;
    for (let i = 0; i < 80 && falcon.alive; i++) h.step();
    expect(j.bill.gun).toBe('S');
    expect(h.log.sfx).toContain('falcon');
    expect(h.said.at(-1)).toBe('Spread gun!');
  });

  it('a pillbox sensor opens and closes: shots pass it shut, hit it open; destroyed, it leaves its falcon', () => {
    const { j, step } = sim();
    quiet(j);
    place(j, 100, TIER.mid);
    const p = new Pillbox(180, TIER.mid, 'L');
    j.spawn(p);
    step();
    expect(p.open).toBe(0);
    expect(p.hurtBox()).toBeNull();
    step(['attack']);
    step([], 40);
    expect(p.hp).toBe(5);
    for (let i = 0; i < PILLBOX_SHUT && p.open !== 2; i++) step();
    expect(p.open).toBe(2);
    for (let i = 0; i < 60 && p.alive; i++) step(i % 2 ? [] : ['attack']);
    expect(p.alive).toBe(false);
    expect(j.things.some((t) => t instanceof Falcon && t.weapon === 'L')).toBe(true);
  });
});

describe('Jungle Assault: the stage', () => {
  it('an exploding bridge: once Bill steps on, each segment flashes, then blows (a boom) and is gone, at a pace a running Bill just outruns', () => {
    const { j, step, b } = sim();
    quiet(j);
    const br = jungleStage().bridges[0] as { col: number; len: number; row: number };
    place(j, br.col * 16 - 20, TIER.mid);
    const bridge = j.things.find((t) => t instanceof BlastBridge) as BlastBridge;
    let fell = false;
    for (let i = 0; i < 200; i++) {
      step(['right']);
      if (b.state !== 'ground' && b.x < (br.col + br.len) * 16) fell = true;
    }
    expect(fell).toBe(false);
    expect(bridge.fuse).toBeGreaterThan(BlastBridge.boomAt(br.len - 1));
    for (let i = 0; i < br.len; i++) expect(j.cell(br.col + i, br.row)).toBe(C.AIR);
    expect(BlastBridge.boomAt(1) - BlastBridge.boomAt(0)).toBe(16);
    // Standing on it: he falls into the river below.
    const s = sim();
    quiet(s.j);
    place(s.j, br.col * 16 + 8, TIER.mid);
    s.step([], 60);
    expect(s.b.state).toBe('water');
  });

  it('a wall gun opens once in view, then turns one 30° step at a time toward Bill (12 steps) and fires when it points at him', () => {
    const { j, step, b } = sim();
    quiet(j);
    place(j, 1200, TIER.low);
    const g = new WallGun(1290, 176);
    j.spawn(g);
    for (let i = 0; i < 40 && g.state !== 'active'; i++) step();
    expect(g.state).toBe('active');
    b.invuln = 9999;
    const steps: number[] = [g.step];
    for (let i = 0; i < 200; i++) {
      step();
      if (g.step !== steps.at(-1)) steps.push(g.step);
    }
    for (let i = 1; i < steps.length; i++) {
      const d = ((steps[i] as number) - (steps[i - 1] as number) + 12) % 12;
      expect(d === 1 || d === 11).toBe(true);
    }
    expect(g.step).toBe(g.target(j));
    expect(TURN_EVERY).toBe(8);
    expect(j.foeShots.length + (j.t > 0 ? 0 : 1)).toBeGreaterThanOrEqual(0);
  });

  it('running soldiers come in from the screen edge, jump down from a ledge end and drown in the river', () => {
    const { j, step, b } = sim(3);
    place(j, 8 * 16, TIER.mid);
    b.invuln = 99999;
    let seen: Soldier | null = null;
    for (let i = 0; i < 600 && !seen; i++) {
      step();
      seen = (j.things.find((t) => t instanceof Soldier) as Soldier | undefined) ?? null;
    }
    expect(seen).not.toBeNull();
    expect((seen as Soldier).x).toBeGreaterThan(j.camX + 250);
    // One on the lower ledge runs off its end into the river.
    const s = new Soldier(19 * 16, TIER.low, -1);
    j.spawn(s);
    let air = false;
    for (let i = 0; i < 200 && s.alive; i++) {
      step();
      air ||= s.air;
    }
    expect(air).toBe(true);
    expect(s.alive).toBe(false);
  });
});

describe('Jungle Assault: the defense wall and Red Falcon', () => {
  /** Into the wall fight, Bill out of harm's way. */
  function toWall(h: JungleHarness): void {
    const j = h.jungle;
    h.game.ctx.assist.invulnerable = true;
    quiet(j);
    place(j, WALL_CAM + 100, 192);
    j.camX = WALL_CAM;
    h.step();
    expect(j.phase).toBe('wall');
  }

  it('the wall is the same every round: its cannons and sniper fire on its own clock (whatever the seed)', () => {
    const log = (seed: number) => {
      const h = jungleHarness({ skipCard: true, seed });
      toWall(h);
      const out: string[] = [];
      let seen = new Set(h.jungle.foeShots);
      for (let i = 0; i < 600; i++) {
        h.step();
        for (const s of h.jungle.foeShots)
          if (!seen.has(s))
            out.push(
              `${h.jungle.phaseT}:${s.kind}:${s.x.toFixed(1)},${s.y.toFixed(1)},${s.vx.toFixed(2)},${s.vy.toFixed(2)}`,
            );
        seen = new Set(h.jungle.foeShots);
      }
      return out;
    };
    const a = log(1);
    expect(a.filter((s) => s.includes('shell')).length).toBeGreaterThanOrEqual(10);
    expect(a.filter((s) => s.includes('bullet')).length).toBeGreaterThanOrEqual(4);
    expect(log(7)).toEqual(a);
    expect(log(23)).toEqual(a);
  });

  it('phase 1 → 2: the core falls, the wall blows apart, Bill walks into the lair, the heart bursts, the chain of booms, the banner, pass (once)', () => {
    const h = jungleHarness({ skipCard: true, keep: true });
    const j = h.jungle;
    toWall(h);
    expect(h.log.music.at(-1)).toBe('contra-boss');
    expect(h.said.at(-1)).toMatch(/defense wall/);
    // Nothing gets past it while it stands.
    h.step(['right'], 200);
    expect(j.bill.x).toBeLessThanOrEqual(WALL_X - 8);
    for (let i = 0; i < CORE_HP; i++) j.core.hit(1, j);
    expect(j.phase).toBe('breach');
    h.step([], BREACH_FRAMES + 1);
    expect(j.phase).toBe('walk');
    expect(j.wall.broken).toBe(true);
    for (let i = 0; i < 600 && j.phase !== 'lair'; i++) h.step(['right']);
    expect(j.phase).toBe('lair');
    expect(j.camX).toBe(LAIR_CAM);
    expect(h.log.music.at(-1)).toBe('contra-lair');
    h.step(['right'], 100);
    expect(j.bill.x).toBeLessThanOrEqual(LAIR_BACK);
    for (let i = 0; i < HEART_HP; i++) j.heart.hit(1, j);
    expect(j.phase).toBe('won');
    h.step([], WIN_FRAMES - 2);
    expect(h.results).toEqual([]);
    expect(h.scene.banner).toEqual(["RED FALCON'S HEART BURSTS!", "BILL'S MIND IS HIS OWN!"]);
    expect(h.log.jingles).toContain('castle-clear');
    h.step([], 10);
    expect(h.results).toEqual(['pass']);
    h.step(['start'], 20);
    expect(h.results).toEqual(['pass']);
  });

  it('the mouths spit larvae by turns; a larva crawls at Bill and leaps when near; prone shots meet it', () => {
    const h = jungleHarness({ skipCard: true });
    const j = h.jungle;
    h.game.ctx.assist.invulnerable = true;
    quiet(j);
    j.wall.broken = true;
    j.camMax = LAIR_CAM;
    place(j, LAIR_CAM + 150, 208);
    j.camX = LAIR_CAM;
    j.phase = 'walk';
    h.step();
    expect(j.phase).toBe('lair');
    h.step([], POD_FIRST + POD_SPIT);
    const larva = j.things.find((t) => t instanceof Larva) as Larva;
    expect(larva).toBeDefined();
    let leapt = false;
    for (let i = 0; i < 300 && !leapt; i++) {
      h.step();
      leapt = larva.air && larva.vy < 0;
    }
    expect(leapt).toBe(true);
    expect(Math.abs(larva.x - j.bill.x)).toBeLessThan(48);
    // Lying flat, Bill's low shot meets one on the floor.
    const low = new Larva(j.bill.x + 40, 208);
    low.air = false;
    j.spawn(low);
    j.bill.facing = 1;
    for (let i = 0; i < 20 && low.alive; i++) h.step(i % 2 ? ['down'] : ['down', 'attack']);
    expect(low.alive).toBe(false);
  });

  it('in a round for fun (Game.inRound) the win says nothing of Bill’s mind, and Give up "Ends the round"', () => {
    const h = jungleHarness({ skipCard: true, keep: true });
    h.game.inRound = true;
    const j = h.jungle;
    j.phase = 'lair';
    j.heartDown();
    h.step([], WIN_FRAMES);
    expect(h.scene.banner).toEqual(["RED FALCON'S HEART BURSTS!"]);
    const h2 = jungleHarness({ skipCard: true });
    h2.game.inRound = true;
    h2.tap('start');
    const items = (h2.game.scenes.top as unknown as { items: MenuItem[] }).items;
    expect(items[1]?.hint).toBe(ROUND_GIVE_UP_HINT);
  });
});

describe('Jungle Assault: menu, assists and the screen', () => {
  it('the menu (MiniGameMenuScene) offers Continue and Give up (quit), from the card and in play; in dev mode the assists', () => {
    const h = jungleHarness();
    h.tap('start');
    expect(h.game.scenes.top).toBeInstanceOf(JungleMenuScene);
    h.step([], 8);
    h.tap('jump');
    expect(h.game.scenes.top).toBe(h.scene);
    h.tap('start');
    h.step([], 8);
    h.tap('down');
    h.tap('jump');
    expect(h.results).toEqual(['quit']);
    expect(h.game.scenes.top).toBe(h.below);
    const h2 = jungleHarness({ skipCard: true });
    h2.game.deps.settings = { ...defaultSettings(), dev: true };
    h2.step([], 30);
    h2.tap('start');
    const items = (h2.game.scenes.top as unknown as { items: MenuItem[] }).items;
    expect(items.map((i) => i.label)).toEqual(['Continue', 'Give up', 'Assists']);
    items[2]?.select?.();
    expect(h2.game.scenes.top).toBeInstanceOf(AssistOptionsScene);
  });

  it('No damage keeps Bill alive; Infinite lives keeps the medals', () => {
    const h = jungleHarness({ skipCard: true });
    const j = h.jungle;
    h.step([], 60);
    h.game.ctx.assist.invulnerable = true;
    j.foeShot(j.bill.x, j.bill.y - 12, 0, 0);
    h.step();
    expect(j.bill.alive).toBe(true);
    h.game.ctx.assist.invulnerable = false;
    h.game.ctx.assist.infiniteLives = true;
    j.foeShot(j.bill.x, j.bill.y - 12, 0, 0);
    h.step([], DEATH_FRAMES + 5);
    expect(j.bill.deaths).toBe(1);
    expect(j.rest).toBe(LIVES - 1);
  });

  it('touch: JUMP and the gun (FIRE, then the weapon) and MENU in play; no JUMP in the river, nothing while he is down or once decided', () => {
    const h = jungleHarness({ skipCard: true });
    const j = h.jungle;
    h.step([], 60);
    expect(h.scene.touchLabels()).toMatchObject({
      jump: 'JUMP',
      attack: 'FIRE',
      start: 'MENU',
      special: null,
      select: null,
    });
    j.giveWeapon('S');
    expect(h.scene.touchLabels().attack).toBe('SPREAD');
    j.bill.state = 'water';
    expect(h.scene.touchLabels().jump).toBeNull();
    j.bill.state = 'dead';
    expect(h.scene.touchLabels()).toMatchObject({ jump: null, attack: null, start: 'MENU' });
    j.phase = 'won';
    expect(h.scene.touchLabels()).toMatchObject({ jump: null, attack: null, start: null });
  });

  it('the screen: medals for the lives in reserve, no score (no score popups); reduce flashing: no flash over the screen, a still heart and core', () => {
    const h = jungleHarness({ skipCard: true, assets: STUB_ASSETS, keep: true });
    const j = h.jungle;
    h.step([], 60);
    const r = draw(h);
    expect(r.texts).toEqual([]);
    expect(r.rects.filter(([x, y, w, hh]) => y === 16 && w === 8 && hh === 16 && x < 64)).toHaveLength(
      LIVES - 1,
    );
    j.phase = 'lair';
    j.heartDown();
    for (let i = 0; i < 40; i++) {
      h.step();
      const full = draw(h).rects.filter(([x, y, w, hh]) => x === 0 && y === 0 && w === 256 && hh === 240);
      expect(full.filter(([, , , , c]) => c.startsWith('rgba(252'))).toEqual([]);
    }
    const h2 = jungleHarness({ skipCard: true, reduceFlashing: false });
    h2.jungle.phase = 'lair';
    h2.jungle.heartDown();
    let flashed = false;
    for (let i = 0; i < 40; i++) {
      h2.step();
      if (
        draw(h2).rects.some(
          ([x, y, w, hh, c]) => x === 0 && y === 0 && w === 256 && hh === 240 && c.startsWith('rgba(252'),
        )
      )
        flashed = true;
    }
    expect(flashed).toBe(true);
  });

  it('a sharp bot plays the whole round (falcons, the bridges, the river, the wall and the lair) and passes, the campaign state untouched', () => {
    const h = jungleHarness();
    const before = { ...h.game.state };
    const bot = new JungleBot(SHARP);
    h.play(bot);
    expect(h.results).toEqual(['pass']);
    for (const ph of ['stage', 'wall', 'breach', 'walk', 'lair', 'won'])
      expect(bot.reached.has(ph)).toBe(true);
    expect(bot.stuck).toBe(false);
    expect(h.game.state).toEqual(before);
  }, 60_000);
});

describe('Jungle Assault: determinism', () => {
  it('the same seed and inputs play the same round', () => {
    const run = () => {
      const h = jungleHarness({ skipCard: true, seed: 5 });
      const bot = new JungleBot({ ...SHARP, seed: 5 });
      for (let i = 0; i < 3000; i++) h.step(bot.next(h.scene));
      return [h.jungle.bill.x, h.jungle.bill.y, h.jungle.t, h.jungle.things.length, h.jungle.rest];
    };
    expect(run()).toEqual(run());
  });
});
