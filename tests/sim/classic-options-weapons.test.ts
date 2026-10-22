import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { defaultSettings, type Settings } from '@engine/save/settings';
import {
  CLASSIC_WEAPON_VALUES,
  defaultClassicSettings,
  type ClassicSettings,
  type ClassicWeapons,
} from '@engine/save/original-options';
import type { Action } from '@engine/input/actions';
import type { CharacterDef } from '@game/characters/character';
import { CHARACTERS, CLASSIC_EXTRAS } from '@game/characters/registry';
import { BILL } from '@game/characters/bill';
import { LINK } from '@game/characters/link';
import { MEGAMAN } from '@game/characters/megaman';
import { RYU } from '@game/characters/ryu';
import { SAMUS } from '@game/characters/samus';
import { SIMON } from '@game/characters/simon';
import { SOPHIA } from '@game/characters/sophia';
import { attackGun, specialGun } from '@game/characters/bill/classic';
import type { Entity } from '@game/entities/entity';
import { runSim, ScriptedInput } from '@game/sim/headless';
import type { MenuItem, MenuScene } from '@game/scenes/menu';
import { ClassicFileRulesScene } from '@game/scenes/original-files-menu';
import { ClassicMenuScene } from '@game/scenes/original-game';
import { ClassicOptionRowsScene, stepRow, WEAPON_ROWS } from '@game/scenes/original-options';
import { TitleScene } from '@game/scenes/title';
import { TITLE_TIMING } from '@game/scenes/title-anim';
import type { World } from '@game/world/world';
import { makeGame, useStorage, type H } from './heroes-harness';
import { step, testLevel } from './classic-harness';
import { isolateClassicRegistry } from './classic-registry';

// FU-7c Customize Weapons (docs/classic/FOLLOW_UPS_PROPOSAL.md): each Classic hero's power-up
// weapon is read from the run's options (the original's weapon by default), and the drops, HUD
// and touch captions follow the choice.

useStorage();
isolateClassicRegistry();

const opts = (w: Partial<ClassicWeapons> = {}): ClassicSettings => ({
  ...defaultClassicSettings(),
  weapons: { ...defaultClassicSettings().weapons, ...w },
});

const BASS = CLASSIC_EXTRAS.find((d) => d.id === 'bass') as CharacterDef;

/** A Classic World for `def` at `power` with `o` (no frames run yet). */
function world(
  def: CharacterDef,
  o: ClassicSettings | undefined,
  power = 'fire',
  kit: Record<string, number> = {},
) {
  return runSim({
    level: testLevel(),
    character: def,
    script: { steps: [] },
    maxFrames: 0,
    rules: 'classic',
    ...(o ? { classic: o } : {}),
    state: { powerState: power, kit },
  }).world;
}

/** What one press of `action` (after a few frames) puts in the world: kinds and shot sizes. */
function pressOut(w: World, action: Action, frames = 30): string[] {
  step(w, 4);
  const before = new Set<Entity>(w.entities);
  const seen: string[] = [];
  const input = new ScriptedInput({ steps: [] });
  for (let f = 0; f < frames; f++) {
    input.setHeld(f < 3 ? [action] : []);
    input.next();
    w.update([input]);
    for (const e of w.entities)
      if (!before.has(e)) {
        before.add(e);
        const spec = (
          e as { spec?: { w: number; h: number; amount?: number; classicHit?: { freezeFrames?: number } } }
        ).spec;
        seen.push(
          `${e.kind}:${spec ? `${spec.w}x${spec.h}/${spec.amount ?? ''}/${spec.classicHit?.freezeFrames ?? ''}` : ''}`,
        );
      }
  }
  return seen;
}

/** A hash of a Classic run on 1-1 for `def`, starting with the Fire Flower, firing everything. */
function fireRun(def: CharacterDef, o?: ClassicSettings): string {
  const frames: number[] = [];
  const r = runSim({
    level: getLevel('1-1'),
    character: def,
    script: { steps: [] },
    maxFrames: 700,
    rules: 'classic',
    ...(o ? { classic: o } : {}),
    state: { powerState: 'fire' },
    controller: (w: World, f: number): Action[] => {
      const p = w.player;
      frames.push(p.body.x, p.body.y, p.body.vx, p.body.vy, w.entities.length);
      const k = f % 24;
      return k < 2
        ? ['right', 'special']
        : k < 4
          ? ['right']
          : k < 6
            ? ['right', 'select']
            : k < 12
              ? ['right', 'attack']
              : ['right', 'jump'];
    },
  });
  return JSON.stringify({ frames, events: r.events });
}

describe('guard: the original weapons by default change nothing', () => {
  for (const def of [...CHARACTERS, BASS])
    it(`${def.name}: a Fire Flower run with the default weapons hashes as one without options`, () => {
      expect(fireRun(def, opts())).toBe(fireRun(def));
    });

  it('the hash is not blind: another weapon changes the run', () => {
    expect(fireRun(MEGAMAN, opts({ megaman: 'hard-knuckle' }))).not.toBe(fireRun(MEGAMAN));
    expect(fireRun(SIMON, opts({ simonStart: 'dagger' }))).not.toBe(fireRun(SIMON));
  });

  it('the defaults are the original’s (GameSettings.resetDifficultySettings)', () => {
    expect(defaultClassicSettings().weapons).toEqual({
      bass: 'water-shield',
      billFirst: 'mg',
      billSecond: 'spread',
      link: 'bomb',
      megaman: 'metal-blade',
      ryuStart: 'shuriken',
      ryuExtra: 'windmill',
      samus: 'wave',
      simonStart: 'hand-axe',
      simonExtra: 'cross',
      sophia: 'triple',
    });
  });
});

describe('each choice is played', () => {
  it('Mega Man: the Fire Flower weapon (Special) is the chosen one; the HUD meter follows', () => {
    const def = (pick?: ClassicSettings) => world(MEGAMAN, pick);
    const base = pressOut(def(undefined), 'special');
    expect(base.length).toBeGreaterThan(0);
    for (const id of ['hard-knuckle', 'pharaoh-shot', 'magma-bazooka'] as const) {
      const w = def(opts({ megaman: id }));
      const meter = w.player.def.meter?.(w.player);
      expect(meter?.label).toBe('W');
      expect(meter?.colour).not.toBe(
        world(MEGAMAN, undefined).player.def.meter?.(world(MEGAMAN, undefined).player)?.colour,
      );
      expect(pressOut(w, 'special'), id).not.toEqual(base);
    }
  });

  it('Bass: the Fire Flower weapon is the chosen one (touch caption follows)', () => {
    const w0 = world(BASS, undefined);
    expect(w0.player.def.touchLabels?.(w0.player, w0).special).toBe('WATER');
    const w = world(BASS, opts({ bass: 'metal-blade' }));
    expect(w.player.def.touchLabels?.(w.player, w).special).not.toBe('WATER');
    expect(pressOut(w, 'special')).not.toEqual(pressOut(world(BASS, undefined), 'special'));
  });

  it('Link: Bow and Arrow: the Mushroom gives the Bow and 5 arrows, Select shoots, drops and HUD are arrows', () => {
    const w = world(LINK, opts({ link: 'bow' }), 'big');
    step(w, 2);
    const p = w.player;
    expect(p.scratch.bow).toBe(1);
    expect(p.scratch.arrows).toBe(5);
    expect(p.scratch.bombsOwned).toBeUndefined();
    expect(p.def.hudAmmo?.(p)).toEqual({ icon: 'icon-arrow', count: 5 });
    expect(p.def.touchLabels?.(p, w).select).toBe('BOW');
    const out = pressOut(w, 'select');
    expect(out.some((k) => k.startsWith('arrow'))).toBe(true);
    expect(p.scratch.arrows).toBe(4);
    // Drops: arrows only (the original's DROP_ARR_ARROWS), whatever the roll.
    const rng = { chance: () => true, float: () => 0 } as never;
    expect(p.def.blockDrop?.(rng, p, 'brick')).toBe('arrow-pack');
    expect(p.def.behaviour.onPickup?.(p, 'arrow-pack', w)).toBe(true);
    expect(p.scratch.arrows).toBe(6);
    // The default: bombs.
    const d = world(LINK, opts(), 'big');
    step(d, 2);
    expect(d.player.scratch.bombs).toBe(3);
    expect(d.player.def.blockDrop?.(rng, d.player, 'brick')).toBe('bomb');
  });

  it('Link: a repeat Fire Flower adds 5 arrows with the Bow (3 bombs by default)', () => {
    const w = world(LINK, opts({ link: 'bow' }), 'fire');
    step(w, 2);
    const p = w.player;
    const a = p.scratch.arrows ?? 0;
    p.def.behaviour.onPowerUp(p, 'flower', w);
    expect(p.scratch.arrows).toBe(a + 5);
  });

  it('Samus: the Ice Beam freezes; the Wave Beam by default', () => {
    const ice = pressOut(world(SAMUS, opts({ samus: 'ice' })), 'attack');
    const wave = pressOut(world(SAMUS, opts()), 'attack');
    expect(ice).not.toEqual(wave);
    expect(ice.some((k) => /\/\d+$/.test(k))).toBe(true);
  });

  it('Simon: the start sub-weapon (Special) and the extra one (Select, with the Flower) are the chosen ones', () => {
    const kit = { hearts: 30 };
    const d = world(SIMON, opts({ simonStart: 'dagger', simonExtra: 'holy-water' }), 'fire', kit);
    const base = world(SIMON, opts(), 'fire', kit);
    expect(d.player.def.touchLabels?.(d.player, d)).toMatchObject({ special: 'DAGGER', select: 'WATER' });
    expect(base.player.def.touchLabels?.(base.player, base)).toMatchObject({
      special: 'AXE',
      select: 'CROSS',
    });
    expect(pressOut(d, 'special')).not.toEqual(pressOut(base, 'special'));
  });

  it('Ryu: the start art (Special) and the extra art (Select) are the chosen ones', () => {
    const d = world(RYU, opts({ ryuStart: 'fire-wheel', ryuExtra: 'dragon-ball' }), 'fire', { ninpo: 50 });
    expect(d.player.def.touchLabels?.(d.player, d)).toMatchObject({ special: 'WHEEL', select: 'DRAGON' });
    const base = world(RYU, opts(), 'fire', { ninpo: 50 });
    expect(base.player.def.touchLabels?.(base.player, base)).toMatchObject({
      special: 'SHURIKEN',
      select: 'WINDMILL',
    });
    expect(pressOut(d, 'special')).not.toEqual(pressOut(base, 'special'));
  });

  it('Bill: the Mushroom gun and the Flower gun are the chosen ones', () => {
    const big = world(BILL, opts({ billFirst: 'laser', billSecond: 'flare' }), 'big').player;
    expect(attackGun(big)).toBe('laser');
    const fire = world(BILL, opts({ billFirst: 'laser', billSecond: 'flare' }), 'fire').player;
    expect(attackGun(fire)).toBe('flare');
    expect(specialGun(fire)).toBe('laser');
    const d = world(BILL, undefined, 'fire').player;
    expect([attackGun(d), specialGun(d)]).toEqual(['spread', 'mg']);
  });

  it('Sophia III: the Homing Missile with the Flower; her HUD and drops follow it', () => {
    const w = world(SOPHIA, opts({ sophia: 'homing' }), 'big');
    const p = w.player;
    p.def.behaviour.onPowerUp(p, 'flower', w);
    expect(p.powerState).toBe('fire');
    expect(p.scratch.hasHoming).toBe(1);
    expect(p.scratch.hasTriple).toBeUndefined();
    expect(p.def.hudAmmo?.(p)?.icon).toBe('icon-homing');
    const rng = { chance: () => true, float: () => 0 } as never;
    expect(p.def.blockDrop?.(rng, p, 'brick')).toBe('homing-ammo');
  });
});

/* ---------- the menu ---------- */

const items = (s: unknown) => (s as { items: MenuItem[] }).items;
const idx = (s: unknown) => (s as { index: number }).index;

function pick(h: H, label: string): void {
  const menu = h.top() as MenuScene;
  const row = items(menu).findIndex((i) => i.label.replace(/\*$/, '') === label);
  expect(row, label).toBeGreaterThanOrEqual(0);
  h.idle(8);
  for (let i = 0; i < 20 && idx(menu) !== row; i++) h.tap('down');
  h.tap('jump');
}

function classic(): H & { settings: Settings } {
  const settings = { ...defaultSettings() };
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  return { ...h, settings };
}

describe("Customize Weapons menu (a new file's rules > Weapons, B-L)", () => {
  it('lists the original’s 11 rows by hero, each naming its weapon', () => {
    const h = classic();
    h.game.showTitle();
    h.idle(TITLE_TIMING.dropEnd + 10);
    expect(h.top()).toBeInstanceOf(TitleScene);
    pick(h, 'Classic');
    // O-04: the CLASSIC title's demo, then its Start box's START.
    h.tap('jump');
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(ClassicMenuScene);
    // B-L: Weapons is one of a new file's rules (its rules box).
    pick(h, 'Super Mario Bros.');
    pick(h, 'File 1');
    pick(h, 'Normal');
    const rulesBox = h.top() as ClassicFileRulesScene;
    expect(rulesBox).toBeInstanceOf(ClassicFileRulesScene);
    expect(
      items(h.top())
        .find((i) => i.label === 'Weapons')
        ?.value?.(),
    ).toBe('Original');
    pick(h, 'Weapons');
    const m = h.top();
    expect(m).toBeInstanceOf(ClassicOptionRowsScene);
    expect(items(m).map((i) => i.label)).toEqual([
      'Bass',
      'Bill gun 1',
      'Bill gun 2',
      'Link',
      'Mega Man',
      'Ryu start',
      'Ryu extra',
      'Samus',
      'Simon start',
      'Simon extra',
      'Sophia',
      'Restore originals',
      'Back',
    ]);
    expect(items(m).map((i) => i.value?.())).toEqual([
      'Water Shield',
      'Machine Gun',
      'Spread',
      'Bomb',
      'Metal Blade',
      'Shuriken',
      'Windmill',
      'Wave Beam',
      'Axe',
      'Cross',
      'Triple Missile',
      undefined,
      undefined,
    ]);
    expect(h.said.at(-1)).toMatch(/^Customize weapons\. Left and right to change\. Bass: Water Shield\./);
    h.idle(8);
    h.tap('down');
    h.tap('down');
    h.tap('down');
    h.tap('right');
    expect(rulesBox.draft.options.weapons.link).toBe('bow');
    expect(h.settings.classic.weapons.link).toBe('bomb');
    expect(h.said.at(-1)).toMatch(/^Link: Bow and Arrow\..*Changed from the original: Bomb/);
    h.tap('attack');
    expect(
      items(h.top())
        .find((i) => i.label === 'Weapons')
        ?.value?.(),
    ).toBe('Changed');
  });

  it('a pair never holds the same weapon, and Bill’s first gun is never the Spread', () => {
    const s = opts();
    const row = (label: string) => WEAPON_ROWS.find((r) => r.label === label) as (typeof WEAPON_ROWS)[number];
    // Ryu start: Shuriken → (Windmill is the extra's) → Jump Slash.
    stepRow(row('Ryu start'), s, 1);
    expect(s.weapons.ryuStart).toBe('jump-slash');
    for (let i = 0; i < 12; i++) {
      stepRow(row('Simon extra'), s, 1);
      expect(s.weapons.simonExtra).not.toBe(s.weapons.simonStart);
      stepRow(row('Bill gun 1'), s, -1);
      expect(s.weapons.billFirst).not.toBe('spread');
      expect(s.weapons.billFirst).not.toBe(s.weapons.billSecond);
      stepRow(row('Bill gun 2'), s, 1);
      expect(s.weapons.billSecond).not.toBe(s.weapons.billFirst);
    }
    expect(CLASSIC_WEAPON_VALUES.billFirst).not.toContain('spread');
  });

  it('every weapon name fits its row beside its marked label and names no button', () => {
    for (const r of WEAPON_ROWS)
      for (const v of r.values) {
        expect(`${r.label}* ${r.name(v)}`.length, `${r.label} ${v}`).toBeLessThanOrEqual(24);
        expect(r.name(v).toUpperCase()).not.toMatch(/\b(BUTTON )?[ABC]\b/);
      }
  });
});
