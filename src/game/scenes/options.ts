import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import { Actions, ActionLabels, type Action } from '@engine/input/actions';
import { bindingClashes, describeCode, describePad } from '@engine/input/bindings';
import { PALETTE_MODES, type PaletteMode } from '@engine/gfx/palette';
import { packStore } from '@engine/assets/idb';
import { exportTemplate, importPackFiles, importPackZip, PackImportError } from '@engine/assets/pack-loader';
import { ZipError, type ZipErrorCode } from '@engine/save/zip';
import { pickFile } from '@engine/file-pick';
import { TOUCH_SCALE_MAX, TOUCH_SCALE_MIN, type AssistSettings, type Settings } from '@engine/save/settings';
import { nextTouchMode, readTouchFacts } from '@engine/input/touch-logic';
import { folderPickerSupported, packsFolderless } from '@engine/assets/folder-picker';
import { MenuScene, backToMenu, type MenuItem } from './menu';
import { controlScheme } from './hints';
import type { Game } from './game';
import { GuideIndexScene } from './guide';
import { ClassicTutorialHeroesScene } from './how-to-play-boxes';
import { homeScreenItems } from '../pwa/home-screen';
import { SaveFilesOptions } from './save-codes';
import { AboutScene } from './about';
import { SaveDataOptions } from './save-data';

const pct = (v: number) => `${Math.round(v * 100)}%`;
const onOff = (b: boolean) => (b ? 'On' : 'Off');
const step = (v: number, dir: number, lo: number, hi: number, by: number) =>
  Math.max(lo, Math.min(hi, Math.round((v + dir * by) * 100) / 100));

/** Options root: video, audio, controls, assists and asset packs. Every change is applied and saved immediately. */
export class OptionsScene extends MenuScene {
  /** `classic`: opened from Classic mode's menus (How to play then lists its heroes, G-093). */
  /** `name`: what the page is called on entry (the row that opened it, 38f review). */
  constructor(game: Game, onBack: () => void, translucent = false, classic = false, name = 'Options') {
    super(game, 'OPTIONS', [], onBack, translucent);
    // 38f: on entry, the page's name before its focused row ("Options. Video").
    this.entryTitle = name;
    this.setItems([
      { label: 'Video', select: () => this.push(new VideoOptions(game, () => this.pop())) },
      { label: 'Audio', select: () => this.push(new AudioOptions(game, () => this.pop())) },
      { label: 'Controls', select: () => this.push(new ControlsOptions(game, () => this.pop())) },
      // The campaign's save files (and their backup reminders): only while the campaign is open,
      // so with dev mode on until Chapter 1 (O-07 option c, O-08). Classic keeps its Continue.
      ...(game.campaignOpen
        ? [
            {
              label: 'Save files',
              select: () => this.push(new SaveFilesOptions(game, () => this.pop(), translucent)),
              hint: 'Share, copy or paste save codes',
            },
          ]
        : []),
      // 0.4.73 (owner, item 81): not in the REMIX title's Options (neither translucent nor
      // Classic's); the Campaign's Options (world map, pause) and Classic's keep it. Item 82:
      // Classic mode's Options (the CLASSIC menu's and the Classic pause's) list the Classic
      // select's heroes, each opening the original's tutorial boxes for that hero.
      ...(translucent || classic
        ? [
            {
              label: 'How to play',
              select: () =>
                this.push(
                  classic
                    ? new ClassicTutorialHeroesScene(game, () => this.pop())
                    : new GuideIndexScene(game, () => this.pop(), false),
                ),
              hint: 'Controls and power-ups for every hero',
            },
          ]
        : []),
      { label: 'Asset packs', select: () => this.push(new PacksOptions(game, () => this.pop())) },
      // iPhone Home Screen support (0.4.44): only where it can help (hidden in the app itself).
      ...homeScreenItems(game, (s) => (this.status = s)),
      // Custom levels and the editor leave the current game, so they are only offered from the
      // title's Options, never in a game or in Classic's options (O-01, RC-027). The custom levels
      // open over Options, so Back comes back here.
      ...(translucent || classic
        ? []
        : [
            // Owner items 86-88: export, import or erase everything the game keeps here.
            {
              label: 'Save data',
              select: () => this.push(new SaveDataOptions(game, () => this.pop())),
              hint: 'Export, import or erase all game data on this device',
            },
            {
              label: 'Custom levels',
              select: () => game.showCustomLevels(() => this.pop()),
              hint: 'Play the levels you made in the level editor',
            },
            { label: 'Level editor', select: () => game.openEditor() },
            // 0.4.72 (owner, title option A): the version and the credits left the title for here.
            {
              label: 'About',
              select: () => this.push(new AboutScene(game, () => this.pop())),
              hint: 'Version and credits',
            },
          ]),
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
    this.entryTitle = 'Video';
    const s = settings(game);
    this.setItems([
      {
        // 0.4.73 (owner): was "Integer scale: On/Off". FILL fills the screen (fractional scale,
        // the default); SHARP keeps whole pixels and may leave a border. Stored as integerScale.
        label: 'Picture size',
        value: () => (s.video.integerScale ? 'Sharp' : 'Fill'),
        adjust: () => void ((s.video.integerScale = !s.video.integerScale), apply(game)),
        hint: 'Fill: bigger picture. Sharp: crisp, even pixels, may leave a border',
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
    this.entryTitle = 'Audio';
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
    this.entryTitle = 'Controls';
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
        // On touch, Off is skipped: it would hide the pad with no touch way back.
        s.input.touch = nextTouchMode(s.input.touch, d, game.deps.lastInput?.() ?? null);
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
      adjust: (d) =>
        void ((s.input.touchScale = step(s.input.touchScale, d, TOUCH_SCALE_MIN, TOUCH_SCALE_MAX, 0.1)),
        apply(game)),
    });
    items.push({
      label: 'Key hints',
      value: () => onOff(!!s.input.keyHints),
      adjust: () => void ((s.input.keyHints = !s.input.keyHints), apply(game)),
      hint: 'Shows each ability with its key beside the game',
    });
    for (const a of Actions) {
      items.push({
        label: `Key ${ActionLabels[a].split(' ')[0]}`,
        value: () => describeCode(b.keyboard[a][0] ?? '-'),
        select: () => this.capture(a, 'keyboard'),
        hint: 'OK, then press the new key',
      });
    }
    for (const a of Actions) {
      items.push({
        label: `Pad ${ActionLabels[a].split(' ')[0]}`,
        value: () => (b.gamepad[a][0] ? describePad(b.gamepad[a][0]) : '-'),
        select: () => this.capture(a, 'gamepad'),
        hint: 'OK, then press the new pad button',
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

  /** `taken` (G-091): the last key was refused; the line says whose it is, and asks again. */
  private capture(action: Action, kind: 'keyboard' | 'gamepad', taken?: string): void {
    const input = this.game.deps.input;
    if (!input) return;
    this.capturing = { action, kind };
    const ask = kind === 'keyboard' ? 'Press a key (Esc cancels)' : 'Press a button';
    this.status = taken ?? ask;
    this.game.deps.announcer?.say(taken ? `${taken}. ${ask.replace('a ', 'another ')}` : ask);
    void input.captureNext().then((got) => {
      const s = settings(this.game);
      const b = s.input.bindings[0];
      const clashes =
        b && got && got.kind === kind ? bindingClashes(s.input.bindings, 0, kind, action, got.code) : [];
      // G-091: a key that is another action's only key is refused, and the screen asks again
      // (as the original's ButtonManager does). A spare key of another action (our defaults
      // give most actions two or three) moves over instead, so no key ever does two things.
      const taken = clashes.find((c) => c.only);
      if (got && taken) {
        const name = kind === 'gamepad' ? describePad(got.code) : describeCode(got.code);
        const who = taken.player === 0 ? '' : `P${taken.player + 1} `;
        this.capture(action, kind, `${name} is already ${who}${ActionLabels[taken.action].split(' ')[0]}`);
        return;
      }
      if (got) {
        for (const c of clashes) {
          const map = s.input.bindings[c.player]?.[kind];
          if (map) map[c.action] = map[c.action].filter((x) => x !== got.code);
        }
      }
      if (b && got && got.kind === kind) {
        b[kind][action] = [got.code];
        apply(this.game);
        const name = kind === 'gamepad' ? describePad(got.code) : describeCode(got.code);
        this.status = `${ActionLabels[action]}: ${name}`;
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
    this.entryTitle = 'Assists';
    this.setItems([
      ...assistItems(settings(game).assist, () => apply(game)),
      { label: 'Back', select: onBack },
    ]);
  }
}

/**
 * The Assists rows over values `a` (`changed` after each change): the dev Assists page's, and
 * v0.4.73's ADVANCED CHEATS page's (item 60: every dev Assist, as each plays here).
 */
export function assistItems(a: AssistSettings, changed: () => void): MenuItem[] {
  const toggle = (label: string, key: keyof AssistSettings, hint?: string): MenuItem => ({
    label,
    value: () => onOff(Boolean(a[key])),
    adjust: () => {
      (a as unknown as Record<string, boolean>)[key] = !a[key];
      changed();
    },
    ...(hint ? { hint } : {}),
  });
  return [
    toggle('Scroll back', 'allowLeftScroll', 'Camera can scroll left'),
    toggle('Inf. lives', 'infiniteLives'),
    toggle('Inf. time', 'infiniteTime'),
    toggle('No damage', 'invulnerable'),
    toggle('Fire keeps big', 'fireRevertsToBig', 'Losing fire power keeps you big'),
    toggle('Safety floor', 'safetyFloor', 'Pits and lava catch you'),
    // 0.4.72 (owner item 8).
    toggle('Show hidden items', 'showHidden', 'Every block shows what it holds; hidden blocks appear'),
    {
      label: 'Coyote time',
      value: () => `${a.coyoteFrames}f`,
      adjust: (d) => void ((a.coyoteFrames = Math.max(0, Math.min(10, a.coyoteFrames + d))), changed()),
      hint: 'Frames you can still jump after leaving a ledge',
    },
    {
      label: 'Slow motion',
      value: () => (a.slowMotion === 2 ? 'Half' : 'Off'),
      adjust: () => void ((a.slowMotion = a.slowMotion === 2 ? 1 : 2), changed()),
    },
  ];
}

class PacksOptions extends MenuScene {
  private names: string[] = [];
  /**
   * A phone or tablet (a coarse pointer), or the touch pad up with no folder picker (items 84,
   * 128, packsFolderless): no Import pack (folder) or Export template. Every device has Import
   * pack (.zip) (item 141), and the packs already stored stay listed (On/Off, OK deletes).
   */
  private readonly folderless: boolean;
  /** A zip being read: a second pick waits for it. */
  private importing = false;
  constructor(game: Game, onBack: () => void) {
    super(game, 'ASSET PACKS', [], onBack);
    this.folderless = packsFolderless({
      touchShown: controlScheme(game) === 'touch',
      coarsePointer: readTouchFacts().coarsePointer,
      folderPicker: folderPickerSupported(),
    });
    this.rebuild();
    void this.refresh();
  }

  private async refresh(): Promise<void> {
    this.names = (await packStore.list()).map((p) => p.name).sort();
    this.rebuild();
  }

  /**
   * The import rows: Import pack (folder) on a computer, Import pack (.zip) everywhere (item
   * 141), then Export template on a computer (not on a phone or tablet, item 128).
   */
  private importRows(): MenuItem[] {
    const game = this.game;
    const zip: MenuItem = {
      label: 'Import pack (.zip)',
      select: () => this.pickZip(),
      // The file dialog only opens from inside the press's own event.
      gesture: true,
      hint: 'Choose an asset pack zip file',
    };
    if (this.folderless) return [zip];
    return [
      {
        label: 'Import pack (folder)',
        select: () => this.pickFolder(),
        // The file dialog only opens from inside the press's own event.
        gesture: true,
        hint: 'Choose a folder with manifest.json',
      },
      zip,
      {
        label: 'Export template',
        // Item 92: one download, smbc-remix-pack-template.zip (the PNGs, their layouts and a README
        // listing the ids, read live).
        select: () =>
          void exportTemplate(game.ctx.assets, game.ctx.audio.registeredIds?.() ?? { songs: [], sfx: [] }),
        hint: 'Downloads a zip of PNGs to repaint',
      },
    ];
  }

  /** The first pack row's index (after the import rows and Export template). */
  private get packRowsFrom(): number {
    return this.folderless ? 1 : PACK_ROWS_FROM;
  }

  private rebuild(): void {
    const game = this.game;
    const s = settings(game);
    const items: MenuItem[] = [];
    items.push(...this.importRows());
    for (const name of this.names) {
      items.push({
        label: name.slice(0, 12),
        value: () => (s.packs.includes(name) ? 'On' : 'Off'),
        adjust: () => {
          s.packs = s.packs.includes(name) ? s.packs.filter((n) => n !== name) : [...s.packs, name];
          apply(game);
        },
        // 0.4.73 (item 84): OK deletes this pack (the old Delete pack row always took the first).
        select: () => this.confirmDelete(name),
        hint: 'Left/right toggles. OK deletes it',
      });
    }
    items.push({ label: 'Back', select: () => this.onBack?.() });
    this.setItems(items);
  }

  /** DELETE <NAME>? with NO first; YES deletes that pack and turns it off. */
  private confirmDelete(name: string): void {
    const game = this.game;
    const keep = () => backToMenu(game);
    const box = new ConfirmMenu(
      game,
      `DELETE ${name.toUpperCase().slice(0, 22)}?`,
      `Delete ${name}?`,
      [
        { label: 'No', select: keep },
        {
          label: 'Yes',
          select: () => {
            game.scenes.pop();
            const at = this.names.indexOf(name);
            void packStore
              .remove(name)
              .then(async () => {
                const s = settings(game);
                s.packs = s.packs.filter((n) => n !== name);
                apply(game);
                this.status = `Deleted ${name}`;
                await this.refresh();
                // The cursor stays on the nearest pack left, else Export template (never
                // silently on Back), and the line names where it is.
                const near = Math.min(at, this.names.length - 1);
                const from = this.packRowsFrom;
                this.index = near >= 0 ? from + near : Math.max(0, from - 1);
                game.deps.announcer?.say(`${this.status}. ${this.focusLine()}`);
              })
              .catch(() => {
                this.status = 'Could not delete';
                game.deps.announcer?.say(this.status);
              });
          },
        },
      ],
      keep,
    );
    game.scenes.push(box);
  }

  /** The status line and the screen reader. */
  private tell(status: string, said: string, bump = false): void {
    if (bump) this.game.ctx.audio.sfx('bump');
    this.status = status;
    this.game.deps.announcer?.say(said);
  }

  /** Import pack (.zip): the chooser in this press's own event, then the whole zip checked. */
  private pickZip(): void {
    if (this.importing) {
      this.tell('READING ZIP...', 'Still reading the zip.');
      return;
    }
    const pick = this.game.deps.pickFile ?? pickFile;
    // Zips by name and type, and application/octet-stream: some Android pickers label zips so
    // and would grey them out. What is picked is checked as a zip anyway.
    pick(
      '.zip,application/zip,application/x-zip-compressed,application/octet-stream',
      (file) => void this.importZip(file),
    );
  }

  /**
   * importPackZip reads the file, then the pack in it, then stores it (committed); each step's
   * failure has its own line (refuseZip), and only a stored pack is turned on.
   */
  private async importZip(file: File): Promise<void> {
    if (this.importing) return this.tell('READING ZIP...', 'Still reading the zip.');
    this.importing = true;
    this.tell('READING ZIP...', 'Reading the zip.');
    let name: string;
    try {
      name = await importPackZip(file);
    } catch (e) {
      return this.refuseZip(e);
    } finally {
      this.importing = false;
    }
    // Stored (committed): from here it is on, whatever else happens.
    const s = settings(this.game);
    if (!s.packs.includes(name)) s.packs.push(name);
    apply(this.game);
    this.tell(`Imported ${name}`, `Imported ${name}. It is turned on.`);
    await this.refresh();
  }

  /** Why importPackZip stored nothing: its step's own line, said, ending "Nothing changed." */
  private refuseZip(e: unknown): void {
    const step = e instanceof PackImportError ? e.step : 'pack';
    const cause = e instanceof PackImportError ? e.cause : e;
    if (step === 'size')
      return this.tell(
        'ZIP TOO BIG (OVER 100 MB)',
        'That zip is over 100 MB, too big to import. Nothing changed.',
        true,
      );
    if (step === 'read')
      return this.tell(
        'COULD NOT READ FILE',
        'The file could not be read. If it is in the cloud, download it to this device first. Nothing changed.',
        true,
      );
    if (step === 'store')
      return this.tell(
        'COULD NOT SAVE PACK',
        'The pack could not be saved: storage may be full or blocked. Nothing changed.',
        true,
      );
    if (cause instanceof ZipError) {
      const [status, said] = ZIP_REFUSED[cause.code];
      return this.tell(status, `${said} Nothing changed.`, true);
    }
    this.tell(
      'NOT AN ASSET PACK',
      `That zip is not an asset pack: ${(cause as Error).message}. Nothing changed.`,
      true,
    );
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

/** The first pack row on a computer's ASSET PACKS page (after the two imports and Export template). */
const PACK_ROWS_FROM = 3;

/** What a zip that could not be imported shows (font text) and says, by its reason (item 141). */
const ZIP_REFUSED: Readonly<Record<ZipErrorCode, readonly [string, string]>> = {
  'not-zip': ['NOT A ZIP FILE', 'That file is not a zip file.'],
  damaged: ['ZIP FILE IS DAMAGED', 'That zip file is damaged.'],
  crc: ['ZIP FILE IS DAMAGED', 'That zip file is damaged: a file inside it does not match its check.'],
  'unsafe-path': ['ZIP HAS UNSAFE PATHS', 'That zip has unsafe paths in it, so it was not read.'],
  'too-many': ['TOO MANY FILES IN ZIP', 'That zip holds too many files to be an asset pack.'],
  'too-big': ['ZIP TOO BIG TO IMPORT', 'That zip unpacks to more than 128 MB, too big to import.'],
  unsupported: ['ZIP KIND NOT SUPPORTED', 'That kind of zip is not supported: encrypted, split or zip64.'],
  method: [
    'ZIP COMPRESSION UNREADABLE',
    "That zip is compressed in a way the game can't read. Zip the pack again with normal compression.",
  ],
  'no-deflate': [
    'BROWSER CANNOT UNZIP IT',
    'This browser cannot read compressed zip files. Update it, or zip the pack without compression.',
  ],
};

/** A YES / NO question: its title said before the focused row. */
class ConfirmMenu extends MenuScene {
  constructor(
    game: Game,
    title: string,
    private readonly question: string,
    items: MenuItem[],
    onBack: () => void,
  ) {
    super(game, title, items, onBack);
  }

  /** "Delete beta? No": the question, then the focused answer. */
  override enter(): void {
    const it = this.items[this.index];
    this.game.deps.announcer?.say(it ? `${this.question} ${it.label}` : this.question);
  }
}
