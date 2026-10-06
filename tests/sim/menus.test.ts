import { beforeEach, describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { fontDef } from '@content/sprites/font';
import { DEFAULT_ASSIST } from '@game/context';
import type { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { defaultSettings, type Settings } from '@engine/save/settings';
import type { Code } from '@engine/input/bindings';
import { InputManager, type InputSource } from '@engine/input/input-manager';
import type { Scene } from '@engine/scene';
import { Game } from '@game/scenes/game';
import { fitMenuValue, type MenuItem, type MenuScene } from '@game/scenes/menu';
import { OptionsScene } from '@game/scenes/options';
import { CHARACTERS } from '@game/characters/registry';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

const assets = { sheet: (name: string) => ({ name, frames: new Map() }) } as unknown as AssetRegistry;

/** A key or pad source driven by the test: hold/release codes; new holds count as just pressed. */
class FakeSource implements InputSource {
  readonly held = new Set<Code>();
  private prev = new Set<Code>();
  private just: Code[] = [];
  poll(): ReadonlySet<Code> {
    for (const c of this.held) if (!this.prev.has(c)) this.just.push(c);
    this.prev = new Set(this.held);
    return new Set(this.held);
  }
  takeJustPressed(): Code[] {
    const out = this.just;
    this.just = [];
    return out;
  }
}

interface Harness {
  game: Game;
  input: InputManager;
  settings: Settings;
  kb: FakeSource;
  pad: FakeSource;
  frame: (n?: number) => Promise<void>;
  tap: (code: Code, src?: FakeSource) => Promise<void>;
}

function harness(): Harness {
  const settings = defaultSettings();
  const input = new InputManager(2, settings.input.bindings);
  const kb = new FakeSource();
  const pad = new FakeSource();
  input.addSource('keyboard', kb);
  input.addSource('gamepad', pad);
  const game = new Game({
    ctx: { assets, audio: NULL_AUDIO, assist: { ...DEFAULT_ASSIST }, reduceFlashing: true },
    getLevel,
    characters: CHARACTERS,
    settings,
    applySettings: () => void (input.bindings = settings.input.bindings),
    controlScheme: () => 'keyboard',
    input,
  });
  const frame = async (n = 1) => {
    for (let i = 0; i < n; i++) {
      input.beginFrame();
      game.scenes.update([input.player(0), input.player(1)]);
      // Let the capture promise settle, as it would between two animation frames.
      await new Promise((r) => setTimeout(r, 0));
    }
  };
  const tap = async (code: Code, src = kb) => {
    src.held.add(code);
    await frame();
    src.held.delete(code);
    await frame();
  };
  return { game, input, settings, kb, pad, frame, tap };
}

type Menu = MenuScene & { index: number; items: MenuItem[]; status: string; t: number };

/** Options (from the title, or see-through over the map) → Controls. */
async function openControls(h: Harness, translucent = false): Promise<Menu> {
  h.game.scenes.push(new OptionsScene(h.game, () => h.game.scenes.pop(), translucent));
  await h.frame(8);
  await h.tap('ArrowDown');
  await h.tap('ArrowDown');
  await h.tap('KeyZ');
  const m = h.game.scenes.top as Menu;
  expect(m.title).toBe('CONTROLS');
  await h.frame(8);
  return m;
}

function row(m: Menu, label: string): number {
  const i = m.items.findIndex((it) => it.label === label);
  expect(i, label).toBeGreaterThanOrEqual(0);
  return i;
}

describe('remapping in Options → Controls', () => {
  it('a key just bound does not fire its new action until released (Jump → A)', async () => {
    const h = harness();
    const m = await openControls(h);
    m.index = row(m, 'Key Jump');
    await h.tap('KeyZ');
    expect(h.input.capturing).toBe(true);
    // Press A and keep holding it: A is now Jump, which is OK in menus.
    h.kb.held.add('KeyA');
    await h.frame(6);
    expect(h.settings.input.bindings[0]?.keyboard.jump).toEqual(['KeyA']);
    expect(h.input.capturing).toBe(false);
    expect(m.status).not.toMatch(/PRESS/i);
    h.kb.held.delete('KeyA');
    await h.frame();
    // The next key moves the cursor; it is not captured.
    await h.tap('ArrowDown');
    expect(h.settings.input.bindings[0]?.keyboard.jump).toEqual(['KeyA']);
    expect(m.items[m.index]?.label).toBe('Key Attack');
    // Pressed again after the release, A works as OK.
    await h.tap('KeyA');
    expect(h.input.capturing).toBe(true);
    h.input.cancelCapture();
  });

  it('a key just bound to BACK does not close the menu (Attack → V)', async () => {
    const h = harness();
    const m = await openControls(h);
    m.index = row(m, 'Key Attack');
    await h.tap('KeyZ');
    h.kb.held.add('KeyV');
    await h.frame(6);
    expect(h.settings.input.bindings[0]?.keyboard.attack).toEqual(['KeyV']);
    expect(h.game.scenes.top).toBe(m);
    h.kb.held.delete('KeyV');
    await h.frame();
    await h.tap('KeyV');
    expect(h.game.scenes.top).not.toBe(m);
  });

  it('a pad button just bound does not fire its new action until released', async () => {
    const h = harness();
    const m = await openControls(h);
    m.index = row(m, 'Pad Jump');
    await h.tap('KeyZ');
    expect(h.input.capturing).toBe(true);
    // Y (pad:3) becomes Jump, which is OK in menus.
    h.pad.held.add('pad:3');
    await h.frame(6);
    expect(h.settings.input.bindings[0]?.gamepad.jump).toEqual(['pad:3']);
    expect(h.input.capturing).toBe(false);
    expect(m.status).not.toMatch(/PRESS/i);
    h.pad.held.delete('pad:3');
    await h.frame();
    await h.tap('pad:3', h.pad);
    expect(h.input.capturing).toBe(true);
    h.input.cancelCapture();
  });

  it('a pad button bound to BACK does not close the menu while held', async () => {
    const h = harness();
    const m = await openControls(h);
    m.index = row(m, 'Pad Attack');
    await h.tap('KeyZ');
    h.pad.held.add('pad:1');
    await h.frame(6);
    expect(h.settings.input.bindings[0]?.gamepad.attack).toEqual(['pad:1']);
    expect(h.game.scenes.top).toBe(m);
  });

  it('Esc cancels the capture, and the held Esc does not reopen it', async () => {
    const h = harness();
    const m = await openControls(h);
    m.index = row(m, 'Key Jump');
    await h.tap('KeyZ');
    h.kb.held.add('Escape');
    await h.frame(6);
    expect(h.input.capturing).toBe(false);
    expect(m.status).toMatch(/CANCEL/i);
    expect(h.settings.input.bindings[0]?.keyboard.jump).toEqual(['KeyZ', 'Space', 'KeyK']);
    h.kb.held.delete('Escape');
    await h.frame();
    await h.tap('ArrowDown');
    expect(m.items[m.index]?.label).toBe('Key Attack');
  });
});

interface Drawn {
  str: string;
  x: number;
  y: number;
}

/** Everything a scene draws: text with its position, and the filled rects. */
function draw(scene: Scene, t = 0): { texts: Drawn[]; rects: [number, number, number, number][] } {
  const texts: Drawn[] = [];
  const rects: [number, number, number, number][] = [];
  const r: Renderer = Object.assign(new NullRenderer(), {
    text(_f: SpriteSheet, str: string, x: number, y: number): void {
      texts.push({ str, x, y });
    },
    rect(x: number, y: number, w: number, h: number): void {
      rects.push([x, y, w, h]);
    },
  });
  (scene as unknown as { t: number }).t = t;
  scene.render(r);
  return { texts, rects };
}

/** Both blink phases of the footer. */
function drawBoth(scene: Scene) {
  const a = draw(scene, 0);
  const b = draw(scene, 32);
  return { texts: [...a.texts, ...b.texts], rects: a.rects };
}

function expectInside(texts: Drawn[], [px, py, pw, ph]: readonly number[], where: string): void {
  for (const t of texts) {
    const w = t.str.length * 8;
    expect(t.x, `${where}: "${t.str}" left`).toBeGreaterThanOrEqual(px as number);
    expect(t.x + w, `${where}: "${t.str}" right`).toBeLessThanOrEqual((px as number) + (pw as number));
    expect(t.y, `${where}: "${t.str}" top`).toBeGreaterThanOrEqual(py as number);
    expect(t.y + 8, `${where}: "${t.str}" bottom`).toBeLessThanOrEqual((py as number) + (ph as number));
  }
}

/** Label and value of each row: value right of the label with a gap, nothing past the panel. */
function rowsOf(texts: Drawn[]): Map<number, Drawn[]> {
  const rows = new Map<number, Drawn[]>();
  for (const t of texts) if (t.str !== '>') rows.set(t.y, [...(rows.get(t.y) ?? []), t]);
  return rows;
}

const LONG_KEYS: Record<string, Code> = {
  jump: 'ShiftRight',
  attack: 'ControlRight',
  special: 'NumpadSubtract',
  start: 'NumpadAdd',
  select: 'IntlBackslash',
  run: 'PrintScreen',
  left: 'BracketRight',
  right: 'NumpadMultiply',
  up: 'ContextMenu',
  down: 'ScrollLock',
};

describe('menu values', () => {
  it('shows a key name in full when it fits the row ("RIGHT SHIFT")', async () => {
    const h = harness();
    const m = await openControls(h);
    m.index = row(m, 'Key Tools');
    const { texts } = draw(m);
    const y = texts.find((t) => t.str === 'KEY TOOLS')?.y;
    const value = texts.find((t) => t.y === y && t.str !== 'KEY TOOLS' && t.str !== '>');
    expect(value?.str).toBe('RIGHT SHIFT');
  });

  it('abbreviates names that do not fit, clearly', () => {
    expect(fitMenuValue('Right Shift', 20)).toBe('RIGHT SHIFT');
    expect(fitMenuValue('Right Shift', 9)).toBe('R SHIFT');
    expect(fitMenuValue('Left Control', 9)).toBe('L CTRL');
    expect(fitMenuValue('Num Add', 6)).toBe('NUM +');
    expect(fitMenuValue('Num Subtract', 9)).toBe('NUM -');
    expect(fitMenuValue('Num Multiply', 9)).toBe('NUM ×');
    expect(fitMenuValue('Num Decimal', 9)).toBe('NUM .');
    expect(fitMenuValue('Num Enter', 8)).toBe('NUM ENT');
    expect(fitMenuValue('PrintScreen', 9)).toBe('PRT SC');
    expect(fitMenuValue('Backspace', 6)).toBe('BKSP');
    expect(fitMenuValue('BracketRight', 9)).toBe('R BRKT');
    expect(fitMenuValue('D-RIGHT', 9)).toBe('D-RIGHT');
    expect(fitMenuValue('Button 16', 6)).toBe('BTN 16');
    // Never longer than the room, whatever the name.
    for (const n of [3, 5, 7, 9])
      expect(fitMenuValue('Supercalifragilistic', n).length).toBeLessThanOrEqual(n);
  });

  it('no Controls row runs into its label or out of the panel, even with long key names', async () => {
    for (const translucent of [false, true]) {
      const h = harness();
      const m = await openControls(h, translucent);
      const b = h.settings.input.bindings[0];
      if (!b) throw new Error('no bindings');
      for (const [a, code] of Object.entries(LONG_KEYS)) b.keyboard[a as keyof typeof b.keyboard] = [code];
      b.gamepad.jump = ['pad:16'];
      b.gamepad.attack = ['pad:axis3-'];
      for (let i = 0; i < m.items.length; i++) {
        m.index = i;
        const { texts, rects } = draw(m);
        const panel = translucent ? (rects[0] as number[]) : [0, 0, 256, 240];
        expectInside(texts, panel, `row ${i}`);
        for (const [y, parts] of rowsOf(texts)) {
          if (parts.length < 2) continue;
          const [label, value] = parts as [Drawn, Drawn];
          expect(value.x, `row at ${y}: ${label.str} / ${value.str}`).toBeGreaterThanOrEqual(
            label.x + label.str.length * 8 + 8,
          );
          // A cut-off name ("RIGHT SHIF") is never shown.
          expect(value.str).not.toMatch(/(SHIF|SUBTRAC|MULTIPL|BACKSLAS|SCREE|CONTRO|BRACKETRIGH)$/);
        }
      }
    }
  });
});

describe('menu footer', () => {
  it('see-through menus keep the status line and BACK hint inside the panel', async () => {
    const h = harness();
    const m = await openControls(h, true);
    m.status = 'Attack / Run: Right Shift';
    const { texts, rects } = drawBoth(m);
    expect(rects).toHaveLength(1);
    const panel = rects[0] as number[];
    expect(texts.some((t) => t.str.startsWith('BACK'))).toBe(true);
    expect(texts.some((t) => t.str.startsWith('ATTACK / RUN'))).toBe(true);
    expectInside(texts, panel, 'controls over the map');
    // The footer sits below the last row.
    const rowsBottom = Math.max(
      ...texts.filter((t) => !t.str.startsWith('BACK') && !t.str.startsWith('ATTACK')).map((t) => t.y),
    );
    for (const t of texts.filter((x) => x.str.startsWith('BACK') || x.str.startsWith('ATTACK')))
      expect(t.y).toBeGreaterThanOrEqual(rowsBottom + 8);
  });

  it('every see-through Options menu draws inside its panel', async () => {
    const h = harness();
    h.game.scenes.push(new OptionsScene(h.game, () => h.game.scenes.pop(), true));
    await h.frame(8);
    const opts = h.game.scenes.top as Menu;
    for (const label of ['Video', 'Audio', 'Controls']) {
      opts.index = row(opts, label);
      await h.tap('KeyZ');
      const sub = h.game.scenes.top as Menu;
      expect(sub.translucent).toBe(true);
      sub.status = 'Controls reset';
      const { texts, rects } = drawBoth(sub);
      expectInside(texts, rects[0] as number[], label);
      h.game.scenes.pop();
    }
  });

  it('full-screen menus keep their footer at the bottom of the screen', async () => {
    const h = harness();
    const m = await openControls(h, false);
    m.status = 'Controls reset';
    const { texts, rects } = drawBoth(m);
    expect(rects).toHaveLength(0);
    expectInside(texts, [0, 0, 256, 240], 'controls from the title');
    expect(texts.find((t) => t.str === 'CONTROLS RESET')?.y).toBe(200);
    expect(texts.find((t) => t.str.startsWith('BACK'))?.y).toBe(216);
  });
});

describe('menu glyphs', () => {
  it('percentages show their % sign (Touch size, audio volumes)', async () => {
    const h = harness();
    const m = await openControls(h);
    const touch = m.items[row(m, 'Touch size')];
    expect(touch?.value?.()).toBe('100%');
    const { texts } = draw(m);
    expect(texts.some((t) => t.str === '100%')).toBe(true);
    h.game.scenes.pop();
    const opts = h.game.scenes.top as Menu;
    opts.index = row(opts, 'Audio');
    await h.tap('KeyZ');
    const audio = h.game.scenes.top as Menu;
    expect(audio.title).toBe('AUDIO');
    const drawnAudio = draw(audio).texts.map((t) => t.str);
    expect(drawnAudio.filter((s) => /^\d+%$/.test(s))).toHaveLength(3);
  });

  it('every character the Options menus draw has a font glyph', async () => {
    const h = harness();
    h.game.scenes.push(new OptionsScene(h.game, () => h.game.scenes.pop(), true));
    await h.frame(8);
    const opts = h.game.scenes.top as Menu;
    const menus: Menu[] = [opts];
    for (const label of ['Video', 'Audio', 'Controls']) {
      opts.index = row(opts, label);
      await h.tap('KeyZ');
      menus.push(h.game.scenes.top as Menu);
      h.game.scenes.pop();
    }
    // The remap status line, too.
    const controls = menus[3] as Menu;
    h.game.scenes.push(controls);
    controls.index = row(controls, 'Key Jump');
    await h.tap('KeyZ');
    await h.tap('KeyA');
    menus.push(controls);
    for (const m of menus)
      for (let i = 0; i < m.items.length; i++) {
        m.index = i;
        for (const t of drawBoth(m).texts)
          for (const ch of t.str)
            if (ch !== ' ') expect(fontDef.frames[ch], `"${ch}" in "${t.str}" (${m.title})`).toBeDefined();
      }
  });
});
