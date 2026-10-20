import { describe, expect, it } from 'vitest';
import { px } from '@engine/math/units';
import type { Action } from '@engine/input/actions';
import { runSim, ScriptedInput } from '@game/sim/headless';
import { CHARACTERS, CLASSIC_EXTRAS, heroFor } from '@game/characters/registry';
import { MEGAMAN } from '@game/characters/megaman';
import { MEGAMAN_CLASSIC, MEGAMAN_CLASSIC_PROFILE } from '@game/characters/megaman/classic';
import { BREAKMAN_CLASSIC, PROTOMAN_CLASSIC } from '@game/characters/protoman/classic';
import { PROTOMAN_CLASSIC_GUIDE } from '@game/characters/protoman/classic-guide';
import type { CharacterDef } from '@game/characters/character';
import { Projectile } from '@game/entities/projectiles/projectile';
import { Goomba } from '@game/entities/enemies/goomba';
import { SPRING_GREEN_BOOST, SPRING_RISE_GRAVITY } from '@game/entities/objects/spring';
import type { World } from '@game/world/world';
import type { GameState } from '@game/context';
import { fontText } from '@game/hud/text';
import { SPRITES } from '@content/sprites';
import { sfx } from '@content/sfx/sfx';
import type { CharacterSelectScene } from '@game/scenes/character-select';
import { defaultSettings } from '@engine/save/settings';
import { makeGame, useStorage } from './heroes-harness';
import { testLevel } from './classic-harness';

// Proto Man and Break Man, Classic-only heroes (bug-reports/2026-10-07-protoman-build-classic-character.md,
// PM-1..PM-20): the report's acceptance checks, played with rules 'classic', against Classic Mega Man.

useStorage();

type Hold = Action[];

function world(def: CharacterDef, state: Partial<GameState> = {}, hurt = false): World {
  return runSim({
    level: testLevel(),
    character: def,
    rules: 'classic',
    script: { steps: [] },
    maxFrames: 0,
    state,
    assist: { invulnerable: !hurt },
  }).world;
}

function drive(w: World, n: number, hold: (i: number) => Hold = () => []): void {
  const input = new ScriptedInput({ steps: [] });
  for (let i = 0; i < n; i++) {
    input.setHeld(hold(i));
    input.next();
    w.update([input]);
  }
}

const settled = (def: CharacterDef, state: Partial<GameState> = {}, hurt = false): World => {
  const w = world(def, state, hurt);
  drive(w, 4);
  return w;
};
const shots = (w: World, kind: string) =>
  w.entities.filter((e): e is Projectile => e instanceof Projectile && e.alive && e.kind === kind);

describe('Proto Man and Break Man: definitions (PM-1, PM-2, TG-41)', () => {
  it('two Classic-only defs built on Classic Mega Man, in CLASSIC_EXTRAS only', () => {
    for (const [d, id, name, hud] of [
      [PROTOMAN_CLASSIC, 'protoman', 'Proto Man', 'PROTO'],
      [BREAKMAN_CLASSIC, 'breakman', 'Break Man', 'BREAK'],
    ] as const) {
      expect(d.id).toBe(id);
      expect(d.name).toBe(name);
      expect(d.hudName).toBe(hud);
      expect(d.rules).toBe('classic');
      expect(d.portrait).toEqual({ sheet: 'megaman', palette: id, frame: 'idle' });
      expect(d.movement).toBe(MEGAMAN_CLASSIC_PROFILE);
      expect(d.damage).toEqual(MEGAMAN_CLASSIC.damage);
      expect(d.stomps).toBe(false);
      expect(d.crouches).toBe(false);
      expect(CLASSIC_EXTRAS).toContain(d);
      expect(CHARACTERS).not.toContain(d);
      expect(heroFor(d, 'classic')).toBe(d);
    }
    // Adjacent, Proto Man first (PM-2).
    const i = CLASSIC_EXTRAS.indexOf(PROTOMAN_CLASSIC);
    expect(CLASSIC_EXTRAS[i + 1]).toBe(BREAKMAN_CLASSIC);
  });

  it('Classic Mega Man and Current Mega Man are unchanged (TG-38)', () => {
    expect(MEGAMAN_CLASSIC.pickSfx).toBeUndefined();
    expect(MEGAMAN.pickSfx).toBeUndefined();
    for (const c of CHARACTERS) expect(c.pickSfx, c.id).toBeUndefined();
    expect(heroFor(MEGAMAN, 'classic')).toBe(MEGAMAN_CLASSIC);
    expect(heroFor(MEGAMAN, 'current')).toBe(MEGAMAN);
  });

  it('their palettes exist (and the charge and star ones), and the spring tables know them', () => {
    for (const id of ['protoman', 'breakman']) {
      expect(SPRITES.megaman).toBeDefined();
      expect(SPRING_GREEN_BOOST[id]).toBe(SPRING_GREEN_BOOST.megaman);
      expect(SPRING_RISE_GRAVITY[id]).toBe(SPRING_RISE_GRAVITY.megaman);
    }
    expect(sfx.some((s) => s.id === 'protoman-whistle')).toBe(true);
  });
});

describe('PM-11: charge without the Mushroom', () => {
  function charge(def: CharacterDef, n: number, power = 'small') {
    const w = settled(def, { powerState: power });
    drive(w, n, () => ['attack']);
    drive(w, 1);
    return w;
  }

  it('small Proto Man: 87 frames fire a full charge shot; Classic Mega Man none', () => {
    expect(shots(charge(PROTOMAN_CLASSIC, 87), 'mm-charge-full')).toHaveLength(1);
    const mm = charge(MEGAMAN_CLASSIC, 87);
    expect(shots(mm, 'mm-charge-full').length + shots(mm, 'mm-charge').length).toBe(0);
  });

  it('48..86 frames a weak shot; 47 nothing extra', () => {
    expect(shots(charge(PROTOMAN_CLASSIC, 48), 'mm-charge')).toHaveLength(1);
    expect(shots(charge(PROTOMAN_CLASSIC, 86), 'mm-charge')).toHaveLength(1);
    expect(shots(charge(BREAKMAN_CLASSIC, 60), 'mm-charge')).toHaveLength(1);
    const w = charge(PROTOMAN_CLASSIC, 47);
    expect(shots(w, 'mm-charge').length + shots(w, 'mm-charge-full').length).toBe(0);
  });
});

describe('PM-12: the buster cap', () => {
  it('small: 6 presses leave 2 buster shots; with the Mushroom 3', () => {
    const small = settled(PROTOMAN_CLASSIC);
    drive(small, 12, (i) => (i % 2 === 0 ? ['attack'] : []));
    expect(shots(small, 'mm-buster')).toHaveLength(2);
    const big = settled(PROTOMAN_CLASSIC, { powerState: 'big' });
    drive(big, 12, (i) => (i % 2 === 0 ? ['attack'] : []));
    expect(shots(big, 'mm-buster')).toHaveLength(3);
    // Classic Mega Man keeps 3 while small.
    const mm = settled(MEGAMAN_CLASSIC);
    drive(mm, 12, (i) => (i % 2 === 0 ? ['attack'] : []));
    expect(shots(mm, 'mm-buster')).toHaveLength(3);
  });

  it('a hit at Mushroom: back to 2, and the charge still works', () => {
    const w = settled(PROTOMAN_CLASSIC, { powerState: 'big' }, true);
    w.hurtPlayer(w.player, 1);
    expect(w.player.powerState).toBe('small');
    drive(w, 130);
    drive(w, 12, (i) => (i % 2 === 0 ? ['attack'] : []));
    expect(shots(w, 'mm-buster')).toHaveLength(2);
    drive(w, 120);
    drive(w, 90, () => ['attack']);
    drive(w, 1);
    expect(shots(w, 'mm-charge-full')).toHaveLength(1);
  });
});

describe('PM-9: double knockback', () => {
  /** px pushed back in the 27 frames after a hit at Mushroom, and frames until hurtable again. */
  function pushed(def: CharacterDef): { dx: number; frames: number } {
    const w = settled(def, { powerState: 'big' }, true);
    const p = w.player;
    // Room behind him (he starts 32 px from the level's left edge).
    p.body.x = px(160);
    const x0 = p.body.x;
    w.hurtPlayer(p, 1);
    drive(w, 27);
    const dx = (x0 - p.body.x) / 256;
    let frames = 27;
    while ((p.invuln > 0 || p.hurtLock) && frames < 400) {
      drive(w, 1);
      frames++;
    }
    return { dx, frames };
  }

  it('Proto Man is pushed about 36 px back in 27 frames, Classic Mega Man about 18; both 102 frames safe', () => {
    const proto = pushed(PROTOMAN_CLASSIC);
    const mm = pushed(MEGAMAN_CLASSIC);
    expect(Math.abs(proto.dx - 36)).toBeLessThanOrEqual(1);
    expect(Math.abs(mm.dx - 18)).toBeLessThanOrEqual(1);
    expect(Math.abs(proto.frames - 102)).toBeLessThanOrEqual(2);
    expect(Math.abs(mm.frames - 102)).toBeLessThanOrEqual(2);
  });

  it('a Goomba touching him pushes him at 0x01555 backwards from his facing, vy 0', () => {
    const w = settled(BREAKMAN_CLASSIC, { powerState: 'fire' }, true);
    const p = w.player;
    w.spawn(new Goomba(p.body.x + px(4), p.body.y + p.body.h - px(16)));
    for (let i = 0; i < 10 && !p.hurtLock; i++) drive(w, 1);
    expect(p.powerState).toBe('small');
    expect(p.body.vx).toBe(-0x01555);
    expect(p.body.vy).toBe(0);
  });
});

describe('PM-13: lower shots', () => {
  /** The first buster shot's centre above his feet (the frame it spawns; he faces right). */
  function height(def: CharacterDef, air: boolean): number {
    const w = settled(def);
    if (air) drive(w, 6, () => ['jump']);
    drive(w, 1, () => (air ? ['jump', 'attack'] : ['attack']));
    expect(w.player.body.onGround).toBe(!air);
    const s = shots(w, 'mm-buster')[0] as Projectile;
    return (w.player.body.y + w.player.body.h - (s.body.y + (s.body.h >> 1))) / 256;
  }

  it('on the ground 9.5 px above the feet (Classic Mega Man 13)', () => {
    expect(height(PROTOMAN_CLASSIC, false)).toBeCloseTo(9.5, 1);
    expect(height(MEGAMAN_CLASSIC, false)).toBeCloseTo(13, 1);
  });

  it('in the air 15.5 px above the feet (Classic Mega Man 17)', () => {
    expect(height(PROTOMAN_CLASSIC, true)).toBeCloseTo(15.5, 1);
    expect(height(BREAKMAN_CLASSIC, true)).toBeCloseTo(15.5, 1);
    expect(height(MEGAMAN_CLASSIC, true)).toBeCloseTo(17, 1);
  });
});

describe('PM-18: the whistle on the pick, Proto Man only', () => {
  function pickSounds(def: CharacterDef): string[] {
    // FU-8: Break Man is Proto Man's second skin, picked on Proto Man's slot.
    const settings = { ...defaultSettings(), classicSkins: { protoman: def.id } };
    const h = makeGame({ deps: { settings, applySettings: () => {} } });
    h.game.classicSelect('1-1', () => h.game.showClassicMenu());
    const sel = h.top() as CharacterSelectScene;
    const slot = h.game.slotOf(def);
    expect(sel.chars).toContain(slot);
    h.idle(12);
    for (let i = 0; i < 40 && sel.chars[(sel as unknown as { index: number }).index] !== slot; i++)
      h.tap('right');
    const sfxMock = h.audio.sfx as unknown as { mock: { calls: unknown[][] } };
    const before = sfxMock.mock.calls.length;
    h.tap('jump');
    return sfxMock.mock.calls.slice(before).map((c) => String(c[0]));
  }

  it('picking Proto Man plays protoman-whistle; Break Man and Classic Mega Man do not', () => {
    expect(pickSounds(PROTOMAN_CLASSIC)).toContain('protoman-whistle');
    expect(pickSounds(BREAKMAN_CLASSIC)).not.toContain('protoman-whistle');
    expect(pickSounds(MEGAMAN)).not.toContain('protoman-whistle');
  });
});

describe('roster (TG-41..43)', () => {
  it('in a Classic run, never under Current or in the campaign roster', () => {
    const h = makeGame({ dev: true });
    expect(h.game.rosterFor('current')).not.toContain(PROTOMAN_CLASSIC);
    expect(h.game.rosterFor('current')).not.toContain(BREAKMAN_CLASSIC);
    expect(h.game.rosterFor('classic')).toContain(PROTOMAN_CLASSIC);
    expect(h.game.rosterFor('classic')).toContain(BREAKMAN_CLASSIC);
    expect(h.game.roster).not.toContain(PROTOMAN_CLASSIC);
  });
});

describe('guide and touch labels (PM-20, TG-22, TG-40)', () => {
  it('both share the Proto Man guide: the font draws it, no button letters', () => {
    expect(PROTOMAN_CLASSIC.guide).toBe(PROTOMAN_CLASSIC_GUIDE);
    expect(BREAKMAN_CLASSIC.guide).toBe(PROTOMAN_CLASSIC_GUIDE);
    const g = PROTOMAN_CLASSIC_GUIDE;
    expect(g.tagline).toBe("Mega Man's rival. Charges from the start.");
    const texts = [
      g.tagline,
      ...g.controls.flatMap((x) => [x.does, x.touchDoes ?? '', x.touch ?? '']),
      ...g.powerups.map((x) => x.does),
      ...(g.belt ?? []).map((x) => x.does),
      ...(g.tips ?? []),
    ];
    for (const t of texts) {
      expect(fontText(t).length, t).toBe(t.length);
      expect(t, t).not.toMatch(/\b(button|press|push|tap|hold)\s+[abc]\b|\([abc]\)|\b[abc]\s*:/i);
    }
    expect(g.controls.find((c) => c.action === 'attack (hold)')?.does).toMatch(/even without a mushroom/i);
    const w = settled(PROTOMAN_CLASSIC, { powerState: 'fire' });
    const labels = PROTOMAN_CLASSIC.touchLabels?.(w.player, w) ?? {};
    for (const v of Object.values(labels)) if (v) expect(v).not.toMatch(/\b(BUTTON )?[ABC]\b/);
    expect(labels).toMatchObject({ attack: 'SHOOT', special: 'BLADE', select: 'RUSH' });
    expect(fontText(PROTOMAN_CLASSIC.hudName)).toBe(PROTOMAN_CLASSIC.hudName);
    expect(fontText(BREAKMAN_CLASSIC.hudName)).toBe(BREAKMAN_CLASSIC.hudName);
  });

  it('the full kit gives all nine weapons and Rush (TG-44)', () => {
    const kit = PROTOMAN_CLASSIC.devKit?.() ?? {};
    expect(kit.classicAll).toBe(1);
    const w = world(PROTOMAN_CLASSIC, { powerState: 'fire', kit });
    drive(w, 2);
    expect(PROTOMAN_CLASSIC.tools?.(w.player).length).toBe(10);
  });

  it('draws with his palette (and the charge one while charging)', () => {
    const w = settled(PROTOMAN_CLASSIC);
    expect(PROTOMAN_CLASSIC.sprite(w.player, 0, false).palette).toBe('protoman');
    drive(w, 40, () => ['attack']);
    expect(PROTOMAN_CLASSIC.sprite(w.player, 0, true).palette).toMatch(/^protoman-charge-/);
  });
});
