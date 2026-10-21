import { beforeEach, describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { DEFAULT_ASSIST } from '@game/context';
import type { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { defaultSettings, type Settings } from '@engine/save/settings';
import type { Code } from '@engine/input/bindings';
import { InputManager, type InputSource } from '@engine/input/input-manager';
import { Game } from '@game/scenes/game';
import type { MenuItem, MenuScene } from '@game/scenes/menu';
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

// G-091: the original's ButtonManager refuses a key that is already bound and asks again. Ours
// refuses another action's only key, and moves a spare one over, so no key does two things.
describe('G-091 remap never leaves a key on two actions', () => {
  it("refuses another action's only key and asks again", async () => {
    const h = harness();
    const m = await openControls(h);
    const kb = h.settings.input.bindings[0]!.keyboard;
    kb.attack = ['KeyV'];
    m.index = row(m, 'Key Jump');
    await h.tap('KeyZ');
    expect(h.input.capturing).toBe(true);
    h.kb.held.add('KeyV');
    await h.frame(4);
    expect(kb.jump).toEqual(['KeyZ', 'Space', 'KeyK']);
    expect(kb.attack).toEqual(['KeyV']);
    expect(m.status).toMatch(/already attack/i);
    expect(h.input.capturing).toBe(true);
    h.kb.held.delete('KeyV');
    await h.frame();
    h.kb.held.add('KeyB');
    await h.frame(4);
    expect(kb.jump).toEqual(['KeyB']);
    expect(h.input.capturing).toBe(false);
  });

  it('moves a spare key of another action over (Jump → X takes it from Attack)', async () => {
    const h = harness();
    const m = await openControls(h);
    const kb = h.settings.input.bindings[0]!.keyboard;
    m.index = row(m, 'Key Jump');
    await h.tap('KeyZ');
    h.kb.held.add('KeyX');
    await h.frame(4);
    expect(kb.jump).toEqual(['KeyX']);
    expect(kb.attack).toEqual(['ShiftLeft', 'KeyJ']);
  });

  it("refuses player 2's only key on the shared keyboard", async () => {
    const h = harness();
    const m = await openControls(h);
    m.index = row(m, 'Key Jump');
    await h.tap('KeyZ');
    h.kb.held.add('Numpad0');
    await h.frame(4);
    expect(m.status).toMatch(/P2 jump/i);
    expect(h.input.capturing).toBe(true);
    h.input.cancelCapture();
  });

  it("a pad button that is another action's only one is refused", async () => {
    const h = harness();
    const m = await openControls(h);
    m.index = row(m, 'Pad Jump');
    await h.tap('KeyZ');
    h.pad.held.add('pad:9');
    await h.frame(4);
    expect(h.settings.input.bindings[0]!.gamepad.jump).toEqual(['pad:0', 'pad:1']);
    expect(m.status).toMatch(/START is already Pause/i);
    h.input.cancelCapture();
  });
});
