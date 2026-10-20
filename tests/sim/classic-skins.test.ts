import { describe, expect, it } from 'vitest';
import { px, toPx } from '@engine/math/units';
import type { Action } from '@engine/input/actions';
import { defaultSettings, loadSettings, normaliseSkins, saveSettings } from '@engine/save/settings';
import { T } from '@game/level/tiles';
import { runSim, ScriptedInput } from '@game/sim/headless';
import type { CharacterDef } from '@game/characters/character';
import { CHARACTERS, CLASSIC_EXTRAS, CLASSIC_SKINS, skinHost, skinsOf } from '@game/characters/registry';
import { LUIGI } from '@game/characters/luigi';
import { MARIO } from '@game/characters/mario';
import { MEGAMAN } from '@game/characters/megaman';
import { SAMUS } from '@game/characters/samus';
import { PEACH_CLASSIC } from '@game/characters/peach/classic';
import { MEGAMAN_CLASSIC } from '@game/characters/megaman/classic';
import { BREAKMAN_CLASSIC, PROTOMAN_CLASSIC } from '@game/characters/protoman/classic';
import { DARKPIT_CLASSIC, PIT_CLASSIC } from '@game/characters/pit/classic';
import {
  CUTMAN_CLASSIC,
  DOROPIE_CLASSIC,
  FIREMAN_CLASSIC,
  FRANCESCA_CLASSIC,
  ICEMAN_CLASSIC,
  ICE_FREEZE_FRAMES,
  ROCK_CLASSIC,
  ROKKO_CLASSIC,
} from '@game/characters/megaman/classic-variants';
import { Projectile } from '@game/entities/projectiles/projectile';
import { Goomba } from '@game/entities/enemies/goomba';
import { Firebar } from '@game/entities/enemies/firebar';
import type { World } from '@game/world/world';
import type { GameState } from '@game/context';
import { SPRITES, PALETTES } from '@content/sprites';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { LevelScene } from '@game/scenes/level';
import { makeGame, useStorage } from './heroes-harness';
import { testLevel, tile } from './classic-harness';

// Classic mode's skins (FU-8) and Mega Man's gameplay variants (FU-3; SkinDescriptions.as and the
// original's per-skin switches): the skin picker on the select, the saved choice, every cosmetic
// skin playing exactly as its slot's hero, the variants' measured differences, and the campaign
// and Current rules unchanged.

useStorage();

type Hold = Action[];

function world(def: CharacterDef, level = testLevel(), state: Partial<GameState> = {}, hurt = false): World {
  return runSim({
    level,
    character: def,
    rules: 'classic',
    script: { steps: [] },
    maxFrames: 0,
    state,
    assist: { invulnerable: !hurt },
  }).world;
}

function drive(w: World, n: number, hold: (i: number) => Hold = () => [], each?: () => void): void {
  const input = new ScriptedInput({ steps: [] });
  for (let i = 0; i < n; i++) {
    input.setHeld(hold(i));
    input.next();
    w.update([input]);
    each?.();
  }
}

const shots = (w: World, kind?: string) =>
  w.entities.filter(
    (e): e is Projectile => e instanceof Projectile && e.alive && (kind === undefined || e.kind === kind),
  );

/** Classic mode's select (the first one, a new game), with `settings`. */
function classicSelect(settings = defaultSettings()) {
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  h.game.classicSelect('1-1', () => h.game.showClassicMenu());
  const sel = h.top() as CharacterSelectScene;
  h.idle(12);
  return { h, sel, settings };
}

const at = (sel: CharacterSelectScene) => sel.chars[sel.cursor];

function cursorTo(h: ReturnType<typeof makeGame>, sel: CharacterSelectScene, id: string): void {
  for (let i = 0; i < 40 && at(sel)?.id !== id; i++) h.tap('right');
  expect(at(sel)?.id).toBe(id);
}

describe('FU-8: skins in the registry', () => {
  it("every variant is a skin on its hero's slot, in the original's skin order", () => {
    // MegaMan.SKIN_ORDER: Mega Man, Rock, Proto Man, Break Man, Cut Man, Fire Man, Ice Man,
    // Francesca, Doropie, Rokko Chan; Samus's: Pit, Dark Pit; Luigi's: Peach.
    expect(skinsOf(MEGAMAN)).toEqual([
      MEGAMAN,
      ROCK_CLASSIC,
      PROTOMAN_CLASSIC,
      BREAKMAN_CLASSIC,
      CUTMAN_CLASSIC,
      FIREMAN_CLASSIC,
      ICEMAN_CLASSIC,
      FRANCESCA_CLASSIC,
      DOROPIE_CLASSIC,
      ROKKO_CLASSIC,
    ]);
    expect(skinsOf(SAMUS)).toEqual([SAMUS, PIT_CLASSIC, DARKPIT_CLASSIC]);
    expect(skinsOf(LUIGI)).toEqual([LUIGI, PEACH_CLASSIC]);
    for (const d of [BREAKMAN_CLASSIC, PROTOMAN_CLASSIC, ROCK_CLASSIC, ROKKO_CLASSIC])
      expect(skinHost(d)).toBe(MEGAMAN);
    expect(skinHost(DARKPIT_CLASSIC)).toBe(SAMUS);
    expect(skinHost(PEACH_CLASSIC)).toBe(LUIGI);
    expect(skinsOf(MARIO)).toEqual([MARIO]);
    // Every look past the slot's own is a Classic-only def (never a campaign hero).
    for (const list of Object.values(CLASSIC_SKINS))
      for (const d of list.slice(1)) {
        expect(CHARACTERS).not.toContain(d);
        expect(CLASSIC_EXTRAS).toContain(d);
      }
  });

  it('one select slot per hero; the roster keeps every skin (old saves, ?char=)', () => {
    const { h, sel } = classicSelect();
    const skins = [BREAKMAN_CLASSIC, PROTOMAN_CLASSIC, DARKPIT_CLASSIC, DOROPIE_CLASSIC, ROCK_CLASSIC];
    for (const d of skins) expect(sel.chars).not.toContain(d);
    for (const d of [MEGAMAN, SAMUS, LUIGI]) expect(sel.chars).toContain(d);
    const roster = h.game.roster;
    for (const d of skins) {
      expect(roster).toContain(d);
      expect(h.game.slotOf(d)).toBe(skinHost(d));
    }
  });
});

describe('FU-8: the skin picker on the Classic select', () => {
  it("Skin on Mega Man's slot steps his looks, said, saved, drawn and picked", () => {
    const { h, sel, settings } = classicSelect();
    expect(h.said.at(-1)).toContain("Skin to change a hero's look.");
    cursorTo(h, sel, 'megaman');
    expect(h.said.at(-1)).toBe('Mega Man, Mega Man');
    expect(sel.skinPicker).toBe(true);
    expect(sel.touchLabels().special).toBe('SKIN');
    // The original's order: Rock, then Proto Man, then Break Man.
    h.tap('special');
    h.tap('special');
    h.tap('special');
    expect(h.said.at(-1)).toBe('Break Man, Mega Man, Mega Man 3');
    expect(settings.classicSkins).toEqual({ megaman: 'breakman' });
    expect(h.game.skinFor(MEGAMAN)).toBe(BREAKMAN_CLASSIC);
    // OK opens the skin menu on Break Man; OK there starts the run as him: his HUD name and look.
    h.tap('jump');
    expect(sel.pickerOpen).toBe(true);
    expect(sel.pickerSkin).toBe(BREAKMAN_CLASSIC);
    h.tap('jump');
    h.until(() => h.top() instanceof LevelScene, 600);
    const w = (h.top() as LevelScene).world;
    expect(w.player.def).toBe(BREAKMAN_CLASSIC);
    expect(h.game.state.character).toBe(BREAKMAN_CLASSIC);
    expect(w.player.def.hudName).toBe('BREAK');
    expect(w.player.def.rescueName).toBe('Roll');
  });

  it('a hero with no other skin: no SKIN button, Skin does nothing', () => {
    const { h, sel, settings } = classicSelect();
    cursorTo(h, sel, 'mario');
    expect(sel.skinPicker).toBe(false);
    expect(sel.touchLabels().special).toBeNull();
    const n = h.said.length;
    h.tap('special');
    expect(h.said.length).toBe(n);
    expect(settings.classicSkins).toBeUndefined();
  });

  it('a saved choice is shown and picked; a death with Break Man returns the cursor to Proto Man', () => {
    const settings = { ...defaultSettings(), classicSkins: { samus: 'darkpit' } };
    const { h, sel } = classicSelect(settings);
    cursorTo(h, sel, 'samus');
    expect(h.said.at(-1)).toBe('Dark Pit, Samus, Kid Icarus: Uprising');
    h.tap('jump');
    h.tap('jump');
    h.until(() => h.top() instanceof LevelScene, 600);
    expect(h.game.state.character).toBe(DARKPIT_CLASSIC);
    // The next pick (as after a death) starts on his slot.
    const pick = new CharacterSelectScene(h.game, {
      player: 0,
      current: DARKPIT_CLASSIC,
      onPick: () => {},
      random: true,
    });
    pick.enter();
    expect(pick.chars[pick.cursor]).toBe(SAMUS);
  });

  it('the Random slot comes in the chosen skin', () => {
    const settings = { ...defaultSettings(), classicSkins: { megaman: 'breakman', samus: 'darkpit' } };
    const h = makeGame({ deps: { settings, applySettings: () => {} } });
    h.game.classicSelect('1-1', () => {});
    for (let i = 0; i < 60; i++) {
      const c = h.game.randomHero();
      expect(c).not.toBe(MEGAMAN);
      expect(c).not.toBe(SAMUS);
    }
    expect(h.game.randomHero([MEGAMAN])).toBe(BREAKMAN_CLASSIC);
  });

  it('Survival counts a hero once, whatever its skin', () => {
    const settings = defaultSettings();
    settings.classic.gameMode = 'survival';
    const h = makeGame({ deps: { settings, applySettings: () => {} } });
    h.game.classicSelect('1-1', () => {});
    const sv = h.game.survival;
    expect(sv).not.toBeNull();
    const ids = sv?.standing().length === 0 ? h.game.heroSlots.map((c) => c.id) : [];
    expect(ids).toContain('megaman');
    expect(ids).not.toContain('breakman');
    h.game.reviveHero(BREAKMAN_CLASSIC);
    expect(sv?.isFallen('megaman')).toBe(false);
  });
});

describe('FU-8: the saved choice', () => {
  it('a run begun as a skin with no choice saved keeps that look at the next pick', () => {
    for (const skin of [BREAKMAN_CLASSIC, DARKPIT_CLASSIC, DOROPIE_CLASSIC]) {
      const h = makeGame({ deps: { settings: defaultSettings(), applySettings: () => {} } });
      h.game.classicSelect('1-1', () => {});
      h.game.state.character = skin;
      const host = skinHost(skin);
      expect(h.game.skinFor(host), skin.id).toBe(skin);
      const pick = new CharacterSelectScene(h.game, {
        player: 0,
        current: skin,
        onPick: () => {},
        random: true,
      });
      pick.enter();
      expect(pick.chars[pick.cursor]).toBe(host);
      expect(h.said.at(-1)).toContain(`${skin.name}, ${host.name}`);
      // A saved choice of its own look wins over the skin playing.
      h.game.setSkin(host, host);
      expect(h.game.skinFor(host)).toBe(host);
    }
  });

  it('loadSettings keeps the string entries of classicSkins (deep-merged files)', () => {
    const s = defaultSettings();
    s.classicSkins = { megaman: 'breakman', samus: 'darkpit' };
    saveSettings(s);
    expect(loadSettings().classicSkins).toEqual({ megaman: 'breakman', samus: 'darkpit' });
    expect(normaliseSkins({ a: 'b', c: 3, d: null })).toEqual({ a: 'b' });
    expect(normaliseSkins([1])).toBeUndefined();
    saveSettings(defaultSettings());
    expect(loadSettings().classicSkins).toBeUndefined();
  });

  it('an unknown or foreign skin id falls back to the hero itself', () => {
    const settings = { ...defaultSettings(), classicSkins: { megaman: 'darkpit', samus: 'nobody' } };
    const { h } = classicSelect(settings);
    expect(h.game.skinFor(MEGAMAN)).toBe(MEGAMAN);
    expect(h.game.skinFor(SAMUS)).toBe(SAMUS);
  });
});

describe('FU-8: a cosmetic skin plays exactly as its hero', () => {
  /** Everything that moves, frame by frame, under one input script. */
  function trace(def: CharacterDef, state: Partial<GameState> = {}): string[] {
    const w = world(def, testLevel({ 9: '..........===?===' }), state);
    w.spawn(new Goomba(tile(20), tile(12)));
    const out: string[] = [];
    const script = (i: number): Hold => {
      if (i < 30) return ['right'];
      if (i < 32) return ['jump', 'right'];
      if (i < 60) return i % 6 === 0 ? ['attack'] : [];
      if (i < 62) return ['down', 'jump'];
      if (i < 160) return ['attack'];
      if (i < 170) return ['up', 'special'];
      return i % 3 === 0 ? ['left', 'attack'] : ['left'];
    };
    drive(w, 220, script, () => {
      const p = w.player;
      const s = shots(w).map((x) => `${x.kind}@${x.body.x},${x.body.y}`);
      out.push(
        `${p.body.x},${p.body.y},${p.body.vx},${p.body.vy},${p.sliding},${p.powerState}|${s.join(';')}`,
      );
    });
    return out;
  }

  for (const [skin, host] of [
    [BREAKMAN_CLASSIC, PROTOMAN_CLASSIC],
    [DARKPIT_CLASSIC, PIT_CLASSIC],
    [DOROPIE_CLASSIC, FRANCESCA_CLASSIC],
  ] as const)
    it(`${skin.name} = ${host.name}: the same moves, shots and power in every state`, () => {
      for (const powerState of ['small', 'big', 'fire'])
        expect(trace(skin, { powerState }), powerState).toEqual(trace(host, { powerState }));
      expect(skin.movement).toBe(host.movement);
      expect(skin.damage).toEqual(host.damage);
      expect(skin.stomps).toBe(host.stomps);
      expect(skin.crouches).toBe(host.crouches);
    });
});

describe('FU-3: the variants are Classic Mega Man with their own rules, as skins on his slot', () => {
  const VARIANTS = [
    ROCK_CLASSIC,
    CUTMAN_CLASSIC,
    FIREMAN_CLASSIC,
    ICEMAN_CLASSIC,
    FRANCESCA_CLASSIC,
    ROKKO_CLASSIC,
  ];

  it('each is one of his looks, with its own art, palettes, guide and castle name; never in the campaign', () => {
    const { h, sel } = classicSelect();
    expect(sel.chars).not.toContain(ROCK_CLASSIC);
    for (const d of VARIANTS) {
      expect(h.game.skinsFor(MEGAMAN)).toContain(d);
      expect(d.rules).toBe('classic');
      const pt = d.portraitArt;
      expect(pt && SPRITES[pt.sheet]?.frames[pt.frame], d.id).toBeDefined();
      expect(PALETTES.default?.[pt?.palette ?? ''], d.id).toBeDefined();
      for (const n of [0, 1, 2]) expect(PALETTES.default?.[`${pt?.palette}-charge-${n}`]).toBeDefined();
      for (const n of [0, 1, 2, 3]) expect(PALETTES.default?.[`${pt?.palette}-star-${n}`]).toBeDefined();
      expect(d.guide.tagline.length).toBeGreaterThan(0);
      expect(d.rescueName).toBeDefined();
    }
    expect(h.game.rosterFor('current')).toBe(CHARACTERS);
    // Every pose Mega Man has, each variant has (built from his sheet).
    const mm = Object.keys(SPRITES['megaman-classic']?.frames ?? {});
    for (const sheet of ['mm-rock', 'mm-cutman', 'mm-fireman', 'mm-iceman', 'mm-witch', 'mm-rokko'])
      for (const f of mm) expect(SPRITES[sheet]?.frames[f], `${sheet} ${f}`).toBeDefined();
  });

  function charge(def: CharacterDef, n: number, power = 'big') {
    const w = world(def, testLevel(), { powerState: power });
    drive(w, 4);
    drive(w, n, () => ['attack']);
    drive(w, 1);
    return w;
  }
  const charged = (w: World) => shots(w, 'mm-charge').length + shots(w, 'mm-charge-full').length;

  it('Rock and Rokko Chan never charge; Francesca, Cut Man, Ice Man and Fire Man do', () => {
    expect(charged(charge(MEGAMAN_CLASSIC, 87))).toBe(1);
    expect(charged(charge(ROCK_CLASSIC, 87))).toBe(0);
    expect(charged(charge(ROKKO_CLASSIC, 87))).toBe(0);
    for (const d of [FRANCESCA_CLASSIC, CUTMAN_CLASSIC, ICEMAN_CLASSIC, FIREMAN_CLASSIC])
      expect(charged(charge(d, 87)), d.id).toBe(1);
  });

  function downJump(def: CharacterDef) {
    const w = world(def);
    drive(w, 4);
    const y0 = w.player.body.y;
    let slid = false;
    let rose = 0;
    drive(
      w,
      12,
      (i) => (i < 2 ? ['down', 'jump'] : ['down']),
      () => {
        if (w.player.sliding > 0) slid = true;
        rose = Math.max(rose, toPx(y0 - w.player.body.y));
      },
    );
    return { slid, rose };
  }

  it('Rock and Francesca: Down + Jump jumps (no slide); Mega Man slides', () => {
    expect(downJump(MEGAMAN_CLASSIC)).toEqual({ slid: true, rose: 0 });
    for (const d of [ROCK_CLASSIC, FRANCESCA_CLASSIC, DOROPIE_CLASSIC]) {
      const r = downJump(d);
      expect(r.slid, d.id).toBe(false);
      expect(r.rose, d.id).toBeGreaterThan(16);
    }
  });

  it("Rokko Chan dashes upright and jumps out of it with Down held, keeping the dash's speed", () => {
    const w = world(ROKKO_CLASSIC);
    drive(w, 4);
    drive(w, 6, (i) => (i < 1 ? ['down', 'jump', 'right'] : ['down', 'right']));
    expect(w.player.sliding).toBeGreaterThan(0);
    expect(toPx(w.player.body.h)).toBe(22);
    expect(ROKKO_CLASSIC.sprite(w.player, 0, true).frame).toBe('dash');
    drive(w, 1, () => ['down', 'jump', 'right']);
    expect(w.player.sliding).toBe(0);
    expect(w.player.body.onGround).toBe(false);
    drive(w, 10, () => ['down', 'right']);
    expect(Math.abs(w.player.body.vx)).toBe(0x02800);
    // Mega Man cannot jump out with Down held.
    const m = world(MEGAMAN_CLASSIC);
    drive(m, 4);
    drive(m, 6, (i) => (i < 1 ? ['down', 'jump', 'right'] : ['down', 'right']));
    drive(m, 1, () => ['down', 'jump', 'right']);
    expect(m.player.body.onGround).toBe(true);
  });

  /** Taps Attack 6 times; the buster shots left out. */
  function cap(def: CharacterDef, power = 'big') {
    const w = world(def, testLevel(), { powerState: power });
    drive(w, 4);
    drive(w, 12, (i) => (i % 2 === 0 ? ['attack'] : []));
    return shots(w, 'mm-buster').length;
  }

  it('Cut Man and Fire Man fire two shots at a time in every state; the rest three', () => {
    for (const p of ['small', 'big']) {
      expect(cap(CUTMAN_CLASSIC, p)).toBe(2);
      expect(cap(FIREMAN_CLASSIC, p)).toBe(2);
      expect(cap(ICEMAN_CLASSIC, p)).toBe(3);
      expect(cap(ROCK_CLASSIC, p)).toBe(3);
    }
  });

  /** HP a Goomba (250) has left after one buster shot. */
  function hpAfterShot(def: CharacterDef): number {
    const w = world(def);
    drive(w, 4);
    const g = new Goomba(tile(8), tile(12) + px(2));
    w.spawn(g);
    drive(w, 1, () => ['attack']);
    drive(w, 30);
    return g.classicHp ?? 0;
  }

  it('buster damage: Cut Man and Fire Man 125, Ice Man 75, the rest 100', () => {
    expect(250 - hpAfterShot(MEGAMAN_CLASSIC)).toBe(100);
    expect(250 - hpAfterShot(CUTMAN_CLASSIC)).toBe(125);
    expect(250 - hpAfterShot(FIREMAN_CLASSIC)).toBe(125);
    expect(250 - hpAfterShot(ICEMAN_CLASSIC)).toBe(75);
    expect(250 - hpAfterShot(ROKKO_CLASSIC)).toBe(100);
  });

  it("Cut Man's shot goes on through an enemy and through bricks, breaking them", () => {
    const w = world(CUTMAN_CLASSIC, testLevel({ 12: '........=.=' }));
    drive(w, 4);
    drive(w, 1, () => ['attack']);
    drive(w, 40);
    expect(w.map.get(8, 12)).toBe(T.AIR);
    expect(w.map.get(10, 12)).toBe(T.AIR);
    const m = world(MEGAMAN_CLASSIC, testLevel({ 12: '........=.=' }));
    drive(m, 4);
    drive(m, 1, () => ['attack']);
    drive(m, 40);
    expect(m.map.get(8, 12)).toBe(T.BRICK);
    expect(m.map.get(10, 12)).toBe(T.BRICK);
    // Through a Goomba to the one behind it.
    const e = world(CUTMAN_CLASSIC);
    drive(e, 4);
    const a = new Goomba(tile(7), tile(12) + px(2));
    const b = new Goomba(tile(11), tile(12) + px(2));
    e.spawn(a);
    e.spawn(b);
    drive(e, 1, () => ['attack']);
    drive(e, 40);
    expect(a.classicHp).toBe(125);
    expect(b.classicHp).toBe(125);
  });

  it("Cut Man's head breaks a brick even small; Mega Man's only bumps it", () => {
    const head = (def: CharacterDef) => {
      const w = world(def, testLevel({ 9: '..=' }));
      drive(w, 4);
      drive(w, 30, () => ['jump']);
      return w.map.get(2, 9);
    };
    expect(head(CUTMAN_CLASSIC)).toBe(T.AIR);
    expect(head(MEGAMAN_CLASSIC)).toBe(T.BRICK);
  });

  it("Ice Man's full charge freezes an enemy (no damage); Mega Man's hurts it", () => {
    const freeze = (def: CharacterDef) => {
      const w = world(def, testLevel(), { powerState: 'big' });
      drive(w, 4);
      const g = new Goomba(tile(9), tile(12) + px(2));
      w.spawn(g);
      drive(w, 90, () => ['attack']);
      drive(w, 20);
      return g;
    };
    const ice = freeze(ICEMAN_CLASSIC);
    expect(ice.alive).toBe(true);
    expect(ice.frozen).toBeGreaterThan(ICE_FREEZE_FRAMES - 30);
    // The tap's buster shot (75) went first; the freeze took none.
    expect(ice.classicHp).toBe(175);
    expect(freeze(MEGAMAN_CLASSIC).alive).toBe(false);
  });

  it('a firebar passes through Fire Man; it hurts Mega Man', () => {
    const hurt = (def: CharacterDef) => {
      const w = world(def, testLevel(), { powerState: 'big' }, true);
      drive(w, 4);
      const tx = toPx(w.player.body.x) >> 4;
      w.spawn(new Firebar(tx, 9, 1, 6));
      drive(w, 120);
      return w.player.powerState;
    };
    expect(hurt(FIREMAN_CLASSIC)).toBe('big');
    expect(hurt(MEGAMAN_CLASSIC)).toBe('small');
  });

  it("a firebar's anchor ball passes through Fire Man too; it hurts Mega Man", () => {
    const anchor = (def: CharacterDef) => {
      const w = world(def, testLevel(), { powerState: 'big' }, true);
      drive(w, 4);
      const tx = (toPx(w.player.body.x) + 6) >> 4;
      // A one-ball bar: only the anchor, at his chest.
      w.spawn(new Firebar(tx, 11, 1, 1));
      drive(w, 30);
      return w.player.powerState;
    };
    expect(anchor(FIREMAN_CLASSIC)).toBe('big');
    expect(anchor(MEGAMAN_CLASSIC)).toBe('small');
  });

  it('Fire Man is pushed back twice as far as Mega Man', () => {
    const pushed = (def: CharacterDef) => {
      const w = world(def, testLevel(), { powerState: 'big' }, true);
      drive(w, 4);
      w.player.body.x = px(160);
      const x0 = w.player.body.x;
      w.hurtPlayer(w.player, 1);
      drive(w, 27);
      return (x0 - w.player.body.x) / 256;
    };
    expect(Math.abs(pushed(FIREMAN_CLASSIC) - 36)).toBeLessThanOrEqual(1);
    expect(Math.abs(pushed(MEGAMAN_CLASSIC) - 18)).toBeLessThanOrEqual(1);
    expect(Math.abs(pushed(CUTMAN_CLASSIC) - 18)).toBeLessThanOrEqual(1);
  });
});

describe('the campaign and Current rules are unchanged', () => {
  it('campaign and Current rosters: the plain heroes, one row, no skin picker', () => {
    const h = makeGame();
    h.game.showCharacterSelect();
    const sel = h.top() as CharacterSelectScene;
    expect(sel.chars).toBe(CHARACTERS);
    expect(sel.rows).toBe(1);
    expect(sel.skinPicker).toBe(false);
    expect(h.game.heroSlots).toBe(h.game.roster);
    expect(h.game.rosterFor('current')).toBe(CHARACTERS);
    // A saved skin never reaches a campaign hero.
    for (const c of CHARACTERS) expect(h.game.skinFor(c)).toBe(c);
  });

  it('no Current def sets the new optional fields', () => {
    for (const c of CHARACTERS) {
      expect(c.fireBarProof, c.id).toBeUndefined();
      expect(c.behaviour.slides, c.id).toBeUndefined();
    }
  });
});
