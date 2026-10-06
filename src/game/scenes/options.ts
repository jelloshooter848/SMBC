import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import { Actions, ActionLabels, type Action } from '@engine/input/actions';
import { describeCode } from '@engine/input/bindings';
import { PALETTE_MODES, type PaletteMode } from '@engine/gfx/palette';
import { packStore } from '@engine/assets/idb';
import { exportTemplate, importPackFiles } from '@engine/assets/pack-loader';
import type { Settings } from '@engine/save/settings';
import { MenuScene, type MenuItem } from './menu';
import type { Game } from './game';
import { GuideIndexScene } from './guide';

const pct = (v: number) => `${Math.round(v * 100)}%`;
const onOff = (b: boolean) => (b ? 'On' : 'Off');
const step = (v: number, dir: number, lo: number, hi: number, by: number) =>
  Math.max(lo, Math.min(hi, Math.round((v + dir * by) * 100) / 100));

/** Options root: video, audio, controls, assists and asset packs. Every change is applied and saved immediately. */
export class OptionsScene extends MenuScene {
  constructor(game: Game, onBack: () => void, translucent = false) {
    super(game, 'OPTIONS', [], onBack, translucent);
    this.setItems([
      { label: 'Video', select: () => this.push(new VideoOptions(game, () => this.pop())) },
      { label: 'Audio', select: () => this.push(new AudioOptions(game, () => this.pop())) },
      { label: 'Controls', select: () => this.push(new ControlsOptions(game, () => this.pop())) },
      {
        label: 'How to play',
        select: () => this.push(new GuideIndexScene(game, () => this.pop())),
        hint: 'Controls and power-ups for every hero',
      },
      { label: 'Asset packs', select: () => this.push(new PacksOptions(game, () => this.pop())) },
      // The editor leaves the current game, so it is only offered from the title.
      ...(translucent ? [] : [{ label: 'Level editor', select: () => game.openEditor() }]),
      { label: 'Back', select: onBack },
    ]);
  }
  private push(s: MenuScene): void {
    s.translucent = this.translucent;
    this.game.scenes.push(s);
  }
  private pop(): void {
    this.game.scenes.pop();
    this.announce();
  }
}

function settings(game: Game): Settings {
  return game.deps.settings as Settings;
}
function apply(game: Game): void {
  game.deps.applySettings?.();
}

class VideoOptions extends MenuScene {
  constructor(game: Game, onBack: () => void) {
    super(game, 'VIDEO', [], onBack);
    const s = settings(game);
    this.setItems([
      {
        label: 'Integer scale',
        value: () => onOff(s.video.integerScale),
        adjust: () => void ((s.video.integerScale = !s.video.integerScale), apply(game)),
      },
      {
        label: 'Palette',
        value: () => PALETTE_LABELS[s.video.palette],
        adjust: (d) => {
          const i = PALETTE_MODES.indexOf(s.video.palette);
          s.video.palette = PALETTE_MODES[
            (i + d + PALETTE_MODES.length) % PALETTE_MODES.length
          ] as PaletteMode;
          apply(game);
        },
        hint: 'Colour-blind safe and high contrast palettes',
      },
      {
        label: 'Reduce flash',
        value: () => onOff(s.video.reduceFlashing),
        adjust: () => void ((s.video.reduceFlashing = !s.video.reduceFlashing), apply(game)),
        hint: 'Steady colours instead of flashing',
      },
      {
        label: 'Show FPS',
        value: () => onOff(s.video.showFps),
        adjust: () => void ((s.video.showFps = !s.video.showFps), apply(game)),
      },
      {
        label: 'Announce',
        value: () => onOff(s.announce),
        adjust: () => void ((s.announce = !s.announce), apply(game)),
        hint: 'Screen reader announcements',
      },
      { label: 'Back', select: onBack },
    ]);
  }
}

const PALETTE_LABELS: Record<PaletteMode, string> = {
  default: 'Default',
  deuteranopia: 'Deuteran.',
  protanopia: 'Protan.',
  tritanopia: 'Tritan.',
  highContrast: 'High con.',
};

class AudioOptions extends MenuScene {
  constructor(game: Game, onBack: () => void) {
    super(game, 'AUDIO', [], onBack);
    const s = settings(game);
    const vol = (label: string, key: 'master' | 'music' | 'sfx'): MenuItem => ({
      label,
      value: () => pct(s.audio[key]),
      adjust: (d) => void ((s.audio[key] = step(s.audio[key], d, 0, 1, 0.1)), apply(game)),
    });
    this.setItems([
      {
        label: 'Mute',
        value: () => onOff(s.audio.muted),
        adjust: () => void ((s.audio.muted = !s.audio.muted), apply(game)),
      },
      vol('Master', 'master'),
      vol('Music', 'music'),
      vol('Sound', 'sfx'),
      { label: 'Back', select: onBack },
    ]);
  }
}

class ControlsOptions extends MenuScene {
  private capturing: { action: Action; kind: 'keyboard' | 'gamepad' } | null = null;
  constructor(game: Game, onBack: () => void) {
    super(game, 'CONTROLS', [], onBack);
    this.rebuild();
  }

  private rebuild(): void {
    const game = this.game;
    const s = settings(game);
    const b = s.input.bindings[0];
    if (!b) return;
    const items: MenuItem[] = [];
    items.push({
      label: 'Touch pad',
      value: () => s.input.touch,
      adjust: (d) => {
        const modes = ['auto', 'on', 'off'] as const;
        s.input.touch = modes[(modes.indexOf(s.input.touch) + d + 3) % 3] as typeof s.input.touch;
        apply(game);
      },
    });
    items.push({
      label: 'Touch d-pad',
      value: () => (s.input.dpad === 'floating' ? 'Floating' : 'Fixed'),
      adjust: () => void ((s.input.dpad = s.input.dpad === 'floating' ? 'fixed' : 'floating'), apply(game)),
      hint: 'Fixed pad, or a stick that appears under your thumb on the left of the screen',
    });
    items.push({
      label: 'Touch size',
      value: () => pct(s.input.touchScale),
      adjust: (d) => void ((s.input.touchScale = step(s.input.touchScale, d, 0.6, 1.6, 0.1)), apply(game)),
    });
    for (const a of Actions) {
      items.push({
        label: `Key ${ActionLabels[a].split(' ')[0]}`,
        value: () => describeCode(b.keyboard[a][0] ?? '-'),
        select: () => this.capture(a, 'keyboard'),
        hint: 'Press A to change',
      });
    }
    for (const a of Actions) {
      items.push({
        label: `Pad ${ActionLabels[a].split(' ')[0]}`,
        value: () => describeCode(b.gamepad[a][0] ?? '-'),
        select: () => this.capture(a, 'gamepad'),
        hint: 'Press A then a button',
      });
    }
    items.push({
      label: 'Reset keys',
      select: () => {
        s.input.bindings = [defaultBindingsFor(0), defaultBindingsFor(1)];
        apply(game);
        this.rebuild();
        this.status = 'Controls reset';
      },
    });
    items.push({ label: 'Back', select: () => this.onBack?.() });
    this.setItems(items);
  }

  private capture(action: Action, kind: 'keyboard' | 'gamepad'): void {
    const input = this.game.deps.input;
    if (!input) return;
    this.capturing = { action, kind };
    this.status = kind === 'keyboard' ? 'Press a key (Esc cancels)' : 'Press a button';
    this.game.deps.announcer?.say(this.status);
    void input.captureNext().then(({ code, kind: got }) => {
      const s = settings(this.game);
      const b = s.input.bindings[0];
      if (b && got === kind) {
        b[kind][action] = [code];
        apply(this.game);
        this.status = `${ActionLabels[action]} = ${describeCode(code)}`;
      } else this.status = 'Cancelled';
      this.capturing = null;
      this.announce();
    });
  }

  override update(input: InputFrame): void {
    if (this.capturing) return;
    super.update(input);
  }

  override render(r: Renderer): void {
    super.render(r);
  }
}

function defaultBindingsFor(i: number) {
  // Imported lazily to keep this module light in tests.
  return defaultBindings(i);
}
import { defaultBindings } from '@engine/input/bindings';

export class AssistOptionsScene extends MenuScene {
  constructor(game: Game, onBack: () => void) {
    super(game, 'ASSISTS', [], onBack);
    const s = settings(game);
    const a = s.assist;
    const toggle = (label: string, key: keyof typeof a, hint?: string): MenuItem => ({
      label,
      value: () => onOff(Boolean(a[key])),
      adjust: () => {
        (a as unknown as Record<string, boolean>)[key] = !a[key];
        apply(game);
      },
      ...(hint ? { hint } : {}),
    });
    this.setItems([
      toggle('Scroll back', 'allowLeftScroll', 'Camera can scroll left'),
      toggle('Inf. lives', 'infiniteLives'),
      toggle('Inf. time', 'infiniteTime'),
      toggle('No damage', 'invulnerable'),
      toggle('Fire keeps big', 'fireRevertsToBig', 'Losing fire power keeps you big'),
      {
        label: 'Coyote time',
        value: () => `${a.coyoteFrames}f`,
        adjust: (d) => void ((a.coyoteFrames = Math.max(0, Math.min(10, a.coyoteFrames + d))), apply(game)),
        hint: 'Frames you can still jump after leaving a ledge',
      },
      {
        label: 'Slow motion',
        value: () => (a.slowMotion === 2 ? 'Half' : 'Off'),
        adjust: () => void ((a.slowMotion = a.slowMotion === 2 ? 1 : 2), apply(game)),
      },
      { label: 'Back', select: onBack },
    ]);
  }
}

class PacksOptions extends MenuScene {
  private names: string[] = [];
  constructor(game: Game, onBack: () => void) {
    super(game, 'ASSET PACKS', [], onBack);
    this.rebuild();
    void this.refresh();
  }

  private async refresh(): Promise<void> {
    this.names = (await packStore.list()).map((p) => p.name).sort();
    this.rebuild();
  }

  private rebuild(): void {
    const game = this.game;
    const s = settings(game);
    const items: MenuItem[] = [];
    items.push({
      label: 'Import pack',
      select: () => this.pickFolder(),
      hint: 'Choose a folder with manifest.json',
    });
    items.push({
      label: 'Export template',
      select: () => void exportTemplate(game.ctx.assets, game.ctx.assets.ids()),
      hint: 'Downloads PNGs to repaint',
    });
    for (const name of this.names) {
      items.push({
        label: name.slice(0, 12),
        value: () => (s.packs.includes(name) ? 'On' : 'Off'),
        adjust: () => {
          s.packs = s.packs.includes(name) ? s.packs.filter((n) => n !== name) : [...s.packs, name];
          apply(game);
        },
        hint: 'Left/right toggles. Press A to delete',
      });
    }
    if (this.names.length) {
      items.push({
        label: 'Delete pack',
        select: () => {
          const name = this.names[0];
          if (!name) return;
          void packStore.remove(name).then(() => {
            s.packs = s.packs.filter((n) => n !== name);
            apply(game);
            this.status = `Deleted ${name}`;
            void this.refresh();
          });
        },
        hint: 'Deletes the first listed pack',
      });
    }
    items.push({ label: 'Back', select: () => this.onBack?.() });
    this.setItems(items);
  }

  private pickFolder(): void {
    if (typeof document === 'undefined') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.setAttribute('webkitdirectory', '');
    input.onchange = () => {
      const files = Array.from(input.files ?? []);
      void importPackFiles(files)
        .then((name) => {
          const s = settings(this.game);
          if (!s.packs.includes(name)) s.packs.push(name);
          apply(this.game);
          this.status = `Imported ${name}`;
          return this.refresh();
        })
        .catch((e: Error) => {
          this.status = e.message.slice(0, 28);
        });
    };
    input.click();
  }
}
