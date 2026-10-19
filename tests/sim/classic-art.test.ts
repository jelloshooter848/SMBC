import { describe, expect, it } from 'vitest';
import type { Action } from '@engine/input/actions';
import type { AssetRegistry } from '@engine/assets/registry';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import { hexToRgb } from '@engine/gfx/palette';
import { rasterizeToBuffer } from '@engine/gfx/pixelart';
import { PALETTES, SPRITES } from '@content/sprites';
import { shownPortrait, type CharacterDef, type SpriteSpec } from '@game/characters/character';
import { DARKPIT_CLASSIC, PIT_CLASSIC } from '@game/characters/pit/classic';
import { BREAKMAN_CLASSIC, PROTOMAN_CLASSIC } from '@game/characters/protoman/classic';
import { BASS_CLASSIC } from '@game/characters/bass/classic';
import { SAMUS_CLASSIC } from '@game/characters/samus/classic';
import { MEGAMAN_CLASSIC } from '@game/characters/megaman/classic';
import {
  LONG_BEAM_CLASSIC,
  MISSILE_CLASSIC,
  SHORT_BEAM_CLASSIC,
  WAVE_BEAM_CLASSIC,
} from '@game/characters/samus/classic-weapons';
import { MM_WEAPONS } from '@game/characters/megaman/classic-weapons';
import { VIC_BAR, VICVIPER_CLASSIC as VIC_CLASSIC } from '@game/characters/vicviper/classic';
import { SOPHIA_CLASSIC_GUIDE } from '@game/characters/sophia/classic-guide';
import { CLASSIC_GUNS as BILL_GUNS } from '@game/characters/bill/classic-weapons';
import { Projectile } from '@game/entities/projectiles/projectile';
import { drawHud, KEY_ICON_P2, POWER_BAR } from '@game/hud/hud';
import { rulesTagX } from '@game/hud/rules-tag';
import { newGameState } from '@game/context';
import { Rig, flatLevel } from './classic-plumber-harness';
import { useStorage } from './heroes-harness';

// The Classic-only extras' own art (PR 7): Pit and Dark Pit, Proto Man and Break Man on their own
// sheets, Bass's face, and the review nits that rode along. Art only: the gameplay tests of each
// hero (classic-pit, classic-protoman, classic-bass) are unchanged.

useStorage();

function rig(def: CharacterDef, power = 'small', kit: Record<string, number> = {}): Rig {
  const r = new Rig(def, flatLevel(), 'classic', power);
  Object.assign(r.p.scratch, kit);
  r.settle();
  return r;
}

/** Every sprite the def shows over a scripted run (each frame both with and without flashing). */
function poses(def: CharacterDef, power: string, script: Action[][]): SpriteSpec[] {
  const r = rig(def, power, def.devKit?.() ?? {});
  const seen: SpriteSpec[] = [];
  for (const hold of script) {
    r.step(hold);
    seen.push(def.sprite(r.p, r.frame, false), def.sprite(r.p, r.frame, true));
  }
  return seen;
}

const repeat = (n: number, hold: Action[]): Action[][] => Array.from({ length: n }, () => hold);

/** Walk, shoot, jump (with a direction for the somersault), crouch, crouch-walk, aim up, fire up. */
const SCRIPT: Action[][] = [
  ...repeat(20, ['right']),
  ...repeat(6, ['right', 'attack']),
  ...repeat(4, []),
  ...repeat(3, ['attack']),
  ...repeat(40, ['right', 'jump']),
  ...repeat(20, []),
  ...repeat(10, ['down']),
  ...repeat(10, ['down', 'right']),
  ...repeat(4, ['down', 'attack']),
  ...repeat(10, ['up']),
  ...repeat(4, ['up', 'attack']),
  ...repeat(4, ['up', 'special']),
  ...repeat(30, ['jump', 'down']),
  ...repeat(20, ['left']),
  ...repeat(20, ['special']),
];

/** True when `palette` has a colour for every index `sheet` uses (rasterizing would throw else). */
function paints(sheet: string, palette: string): boolean {
  const def = SPRITES[sheet];
  const pal = PALETTES.default?.[palette];
  if (!def || !pal) return false;
  rasterizeToBuffer(def, pal);
  return true;
}

describe('Pit and Dark Pit: their own sheet', () => {
  it('every pose he shows is on the `pit` sheet, in palettes with every colour it uses', () => {
    for (const def of [PIT_CLASSIC, DARKPIT_CLASSIC])
      for (const power of ['small', 'big', 'fire']) {
        const seen = poses(def, power, SCRIPT);
        const names = new Set(seen.map((s) => s.frame));
        for (const s of seen) {
          expect(s.sheet, s.frame).toBe('pit');
          expect(SPRITES.pit?.frames[s.frame], s.frame).toBeDefined();
          expect(paints('pit', s.palette), s.palette).toBe(true);
        }
        for (const n of ['idle', 'shoot', 'crouch', 'aim-up'])
          expect(names, `${def.id} ${power} ${n}`).toContain(n);
      }
  });

  it('frames are 16 x 32 on Samus palette roles (0-5), so her Star and Screw Attack rows recolour him', () => {
    const frames = SPRITES.pit?.frames ?? {};
    for (const [n, rows] of Object.entries(frames)) {
      expect(rows.length, n).toBe(32);
      expect(new Set(rows.map((r) => r.length)), n).toEqual(new Set([16]));
      expect(rows.join(''), n).toMatch(/^[.0-5]*$/);
    }
    for (const pal of ['pit', 'pit-varia', 'darkpit', 'darkpit-varia', 'samus-star-0', 'samus-star-3'])
      expect(paints('pit', pal), pal).toBe(true);
    // The crouch's body sits in the bottom 15 rows (its 12 x 15 box).
    const crouch = frames.crouch as string[];
    expect(crouch.slice(0, 17).join('')).toMatch(/^\.*$/);
  });

  it('his portrait on the select screen and intro card is his own art; `portrait` still names Samus', () => {
    expect(shownPortrait(PIT_CLASSIC)).toEqual({ sheet: 'pit', palette: 'pit', frame: 'idle' });
    expect(shownPortrait(DARKPIT_CLASSIC)).toEqual({ sheet: 'pit', palette: 'darkpit', frame: 'idle' });
    expect(PIT_CLASSIC.portrait.sheet).toBe('samus');
    expect(shownPortrait(SAMUS_CLASSIC)).toBe(SAMUS_CLASSIC.portrait);
    expect(SAMUS_CLASSIC.portraitArt).toBeUndefined();
  });

  it('his shots are arrows: the same specs with only the art swapped', () => {
    const r = rig(PIT_CLASSIC, 'fire', { missileUp: 1, missiles: 9 });
    const fired: Projectile[] = [];
    const grab = () => {
      for (const e of r.world.entities)
        if (e instanceof Projectile && e.owner === r.p && !fired.includes(e)) fired.push(e);
    };
    r.step(['attack']);
    grab();
    for (let i = 0; i < 30; i++) r.step();
    r.step(['special']);
    grab();
    expect(fired.map((p) => p.spec.frames[0])).toEqual(['light-arrow-0', 'heavy-arrow']);
    for (const [shot, base] of [
      [fired[0], WAVE_BEAM_CLASSIC],
      [fired[1], MISSILE_CLASSIC],
    ] as const) {
      const { sheet, frames, burstFrame, ...rest } = (shot as Projectile).spec;
      const { sheet: _s, frames: _f, burstFrame: _b, ...want } = base;
      expect(rest).toEqual(want);
      expect(sheet).toBe('pit-shots');
      for (const f of [...frames, ...(burstFrame ? [burstFrame] : [])])
        expect(SPRITES['pit-shots']?.frames[f], f).toBeDefined();
    }
    // Dark Pit's in his colours; Classic Samus keeps her beams.
    const d = rig(DARKPIT_CLASSIC);
    d.step(['attack']);
    const dark = d.world.entities.find((e): e is Projectile => e instanceof Projectile && e.owner === d.p);
    expect(dark?.spec.sheet).toBe('darkpit-shots');
    expect(dark?.spec.frames).toEqual(['arrow-0', 'arrow-1']);
    expect(dark?.spec.lifetime).toBe(SHORT_BEAM_CLASSIC.lifetime);
    const s = rig(SAMUS_CLASSIC);
    s.step(['attack']);
    const beam = s.world.entities.find((e): e is Projectile => e instanceof Projectile && e.owner === s.p);
    expect(beam?.spec).toBe(SHORT_BEAM_CLASSIC);
    expect(LONG_BEAM_CLASSIC.sheet).toBe('items');
  });
});

describe('Proto Man and Break Man: their own sheet', () => {
  it('every pose is on the `protoman` sheet, with every suit palette he can wear', () => {
    for (const def of [PROTOMAN_CLASSIC, BREAKMAN_CLASSIC])
      for (const power of ['small', 'big', 'fire']) {
        const seen = poses(def, power, [...SCRIPT, ...repeat(90, ['attack']), ...repeat(2, [])]);
        for (const s of seen) {
          expect(s.sheet, s.frame).toBe('protoman');
          expect(SPRITES.protoman?.frames[s.frame], s.frame).toBeDefined();
          expect(paints('protoman', s.palette), s.palette).toBe(true);
        }
      }
    for (const id of ['protoman', 'breakman']) {
      for (let i = 0; i < 3; i++) expect(paints('protoman', `${id}-charge-${i}`)).toBe(true);
      for (let i = 0; i < 4; i++) expect(paints('protoman', `${id}-star-${i}`)).toBe(true);
    }
    for (const w of MM_WEAPONS) expect(paints('protoman', w.palette), w.palette).toBe(true);
    expect(paints('protoman', 'protoman-rush')).toBe(true);
  });

  it('Mega Man frame names on Mega Man palette roles; the scarf (5) and visor stripe (4) in every pose with his head', () => {
    const frames = SPRITES.protoman?.frames ?? {};
    for (const n of Object.keys(SPRITES.megaman?.frames ?? {}).filter((k) => !k.startsWith('bare-')))
      expect(frames[n], n).toBeDefined();
    for (const [n, rows] of Object.entries(frames)) {
      expect(new Set(rows.map((r) => r.length)).size, n).toBe(1);
      expect(rows.join(''), n).toMatch(/^[.0-5]*$/);
      if (n === 'death-orb' || n === 'teleport-0') continue;
      expect(rows.join(''), n).toContain('5');
      expect(rows.join(''), n).toContain('4');
    }
  });

  it('portraits: their own art; `portrait` still names Mega Man; Classic Mega Man unchanged', () => {
    expect(shownPortrait(PROTOMAN_CLASSIC)).toEqual({
      sheet: 'protoman',
      palette: 'protoman',
      frame: 'idle',
    });
    expect(shownPortrait(BREAKMAN_CLASSIC)).toEqual({
      sheet: 'protoman',
      palette: 'breakman',
      frame: 'idle',
    });
    expect(PROTOMAN_CLASSIC.portrait.sheet).toBe('megaman');
    expect(MEGAMAN_CLASSIC.portraitArt).toBeUndefined();
    const m = rig(MEGAMAN_CLASSIC);
    expect(MEGAMAN_CLASSIC.sprite(m.p, 0, true).sheet).toBe('megaman');
  });
});

describe("Bass's face", () => {
  it('his skin is far from his helmet orange in every suit he wears', () => {
    const dist = (a: string, b: string) => {
      const [x, y] = [hexToRgb(a), hexToRgb(b)];
      return Math.abs(x[0] - y[0]) + Math.abs(x[1] - y[1]) + Math.abs(x[2] - y[2]);
    };
    for (const pal of ['bass', 'bass-water', 'bass-charge-0']) {
      const p = PALETTES.default?.[pal] as readonly string[];
      expect(dist(p[3] as string, p[2] as string), pal).toBeGreaterThan(150);
      expect(p[3]).not.toBe('#fca044');
    }
    expect(BASS_CLASSIC.portrait).toEqual({ sheet: 'bass', palette: 'bass', frame: 'idle' });
  });
});

describe('review nits', () => {
  it("Sophia III's jump line says the height doesn't depend on speed", () => {
    const jump = SOPHIA_CLASSIC_GUIDE.controls.find((c) => c.action === 'jump');
    expect(jump?.does).toContain("Jump height doesn't depend on speed. Hold for higher.");
    expect(jump?.does).not.toContain('fixed jump');
  });

  it("Bill's Flare pierces at strength 6 (PIERCE_STR_ARMOR_PIERCING)", () => {
    expect(BILL_GUNS.flare.spec.classicHit?.pierce).toBe(6);
  });

  /** The words drawn by the HUD for `players` heroes, Vic Viper first with slot `sel` lit. */
  function hudWords(two: boolean, sel = 2, keyHolder: number | null = null) {
    const r = rig(VIC_CLASSIC, 'small', { vvSel: sel });
    const words: { s: string; x: number; y: number }[] = [];
    const sprites: { f: string; x: number; y: number }[] = [];
    const rr: Renderer = Object.assign(new NullRenderer(), {
      text(_f: SpriteSheet, s: string, x: number, y: number) {
        words.push({ s, x, y });
      },
      sprite(_s: SpriteSheet, f: string, x: number, y: number) {
        sprites.push({ f, x, y });
      },
    });
    const state = newGameState(VIC_CLASSIC, two ? VIC_CLASSIC : null, 'classic');
    const players = two ? [r.p, r.p] : [r.p];
    drawHud(rr, { sheet: () => ({}) } as unknown as AssetRegistry, state, 300, 0, players, { keyHolder });
    return { words, sprites };
  }

  it("Vic Viper's lit-slot names end 8 px or more left of the CLASSIC tag's outline", () => {
    const tagOutline = rulesTagX('CLASSIC') - 1;
    for (const s of VIC_BAR)
      expect(POWER_BAR.nameX + s.name.length * 8 + 8, s.name).toBeLessThanOrEqual(tagOutline);
    // Clear of the bar's last cell too.
    expect(POWER_BAR.nameX).toBeGreaterThan(POWER_BAR.x + 6 * POWER_BAR.cellW - 1);
    expect(hudWords(false).words.some((w) => w.s === 'MISSL' && w.x === POWER_BAR.nameX)).toBe(true);
  });

  it("with player two's HUD shown the lit-slot name is not drawn over their name", () => {
    const { words } = hudWords(true);
    expect(words.filter((w) => w.y === POWER_BAR.nameY && w.x === POWER_BAR.nameX)).toEqual([]);
    expect(words.some((w) => w.x === 144 && w.y === 24 && w.s === VIC_CLASSIC.hudName.slice(0, 7))).toBe(
      true,
    );
  });

  it("player two's key icon starts after a seven-letter name (WARRIOR's last R)", () => {
    expect(KEY_ICON_P2.x).toBeGreaterThanOrEqual(144 + 7 * 8);
    const { sprites } = hudWords(true, 0, 1);
    expect(sprites.filter((s) => s.f === 'key-icon')).toEqual([{ f: 'key-icon', ...KEY_ICON_P2 }]);
  });
});
