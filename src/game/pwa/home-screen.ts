import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { TouchLabels } from '@engine/input/touch';
import type { InstallVariant } from '@engine/platform';
import type { HomeScreenFlags } from '@engine/save/settings';
import { SCREEN_W } from '@engine/viewport';
import { FONT_COLOURS, type FontColour } from '@content/sprites/font';
import { APP_ICON, APP_ICON_COLOURS } from '@content/sprites/app-icon';
import { CardScene, cardContinues } from '../scenes/message';
import { abilityHint } from '../scenes/hints';
import type { MenuItem } from '../scenes/menu';
import type { Game } from '../scenes/game';
import { NO_TOUCH_BUTTONS } from '../touch-labels';

/*
 * iPhone Home Screen support in the game (0.4.44): Options → ADD TO HOME SCREEN and its guide,
 * the one-time phone tip after a first level, the Home Screen app's one-time note on its own
 * saves (and the downloaded copy's, 0.4.49), and the title's UPDATE READY notice. Each card is read out and waits for a press. The
 * browser side (platform detection, the install prompt, the service worker) comes in through
 * GameDeps.homeScreen (main.ts); without it (the sims) none of this shows.
 */

/** What main.ts hands the game (engine/platform.ts and engine/pwa.ts behind it). */
export interface HomeScreenHooks {
  /** An iPhone or iPad. */
  readonly ios: boolean;
  /** A phone or tablet (iOS or Android). */
  readonly phone: boolean;
  /** Running from the Home Screen (an installed app). */
  readonly standalone: boolean;
  /**
   * The downloaded copy, opened from the disk (file://, `pnpm build:offline`, 0.4.49): its saves
   * are its own, and there is nothing to add to a Home Screen.
   */
  readonly fileCopy?: boolean;
  /** What Options → ADD TO HOME SCREEN does now. */
  variant(): InstallVariant;
  /** The browser's saved install prompt (variant `prompt`). */
  prompt(): Promise<'accepted' | 'dismissed' | 'unavailable'>;
  /** A new release is downloaded and waiting. */
  updateReady(): boolean;
  /** Switch to it (the page reloads). */
  applyUpdate(): void;
}

export const ADD_TO_HOME_SCREEN = 'Add to Home Screen';

/** Lines fit the card box (at most 28 characters; the title's cards go at the top, clear of the footer). */
export const PHONE_TIP_LINES: readonly string[] = [
  'TIP: ADD TO HOME SCREEN',
  'FOR FULL SCREEN AND',
  'OFFLINE PLAY.',
  '',
  'SEE OPTIONS >',
  'ADD TO HOME SCREEN.',
];
const PHONE_TIP_SAID =
  'Tip: add to Home Screen for full screen and offline play. It is in Options, Add to Home Screen. OK to close.';

export const STANDALONE_NOTICE_LINES: readonly string[] = [
  'WELCOME TO THE HOME SCREEN',
  'APP! IT KEEPS ITS OWN SAVES,',
  "APART FROM SAFARI'S.",
  '',
  'TO BRING A SAVE OVER FROM',
  'SAFARI, USE OPTIONS >',
  'SAVE FILES > PASTE CODE.',
];
const STANDALONE_NOTICE_SAID =
  "Welcome to the Home Screen app! It keeps its own saves, apart from Safari's. To bring a save over from Safari, use Options, Save files, Paste code. OK to continue.";

export const OFFLINE_NOTICE_LINES: readonly string[] = [
  'PLAYING FROM A DOWNLOAD!',
  'THIS COPY KEEPS ITS OWN',
  'SAVES, APART FROM THE',
  "WEBSITE'S.",
  '',
  'TO MOVE A SAVE, USE',
  'OPTIONS > SAVE FILES:',
  'COPY CODE ON ONE, THEN',
  'PASTE CODE ON THE OTHER.',
];
const OFFLINE_NOTICE_SAID =
  "You are playing from a download. This copy keeps its own saves, apart from the website's. To move a save, use Options, Save files: Copy code on one, then Paste code on the other. OK to continue.";

export const UPDATE_LINES: readonly string[] = [
  'UPDATE READY!',
  'A NEW VERSION OF THE GAME',
  'IS READY.',
  '',
  'OK: UPDATE NOW',
  'BACK: LATER',
];
const UPDATE_SAID =
  'Update ready! A new version of the game is ready. OK updates now, Back keeps playing this one.';

/** The settings' Home Screen flags (filled in when missing). */
function flags(game: Game): HomeScreenFlags | null {
  const s = game.deps.settings;
  if (!s) return null;
  s.homeScreen ??= { tipDone: false, noticeDone: false, offlineDone: false };
  return s.homeScreen;
}

function setFlag(game: Game, key: keyof HomeScreenFlags): void {
  const f = flags(game);
  if (!f) return;
  f[key] = true;
  game.deps.applySettings?.();
}

/** A card in a box over the scene beneath, read out; OK (and BACK) close it. */
function card(
  game: Game,
  lines: readonly string[],
  said: string,
  onOk: () => void,
  opts: { top?: boolean; onBack?: () => void } = {},
): void {
  game.ctx.audio.sfx('pause');
  game.deps.announcer?.say(said);
  const back = opts.onBack ?? onOk;
  game.scenes.push(
    new CardScene(game, lines, onOk, null, {
      panel: true,
      overlay: true,
      top: opts.top === true,
      keys: ['jump', 'start'],
      skipKeys: ['attack'],
      onSkip: back,
      prompt: () => abilityHint(game, 'OK', 'jump'),
    }),
  );
}

// ------------------------------------------------------------------ the map: the phone tip

/** The phone tip is due: a phone in the browser, a campaign file's first level just cleared. */
export function phoneTipDue(game: Game): boolean {
  const hs = game.deps.homeScreen;
  const f = flags(game);
  if (!hs || !f || f.tipDone || !hs.phone || hs.standalone || hs.fileCopy || !game.campaign) return false;
  return game.mapProgress.cleared.length === 1;
}

/** The map is idle: shows the phone tip when due (true: a card is up). */
export function mapNotice(game: Game): boolean {
  if (!phoneTipDue(game)) return false;
  const close = () => {
    setFlag(game, 'tipDone');
    game.scenes.pop();
  };
  card(game, PHONE_TIP_LINES, PHONE_TIP_SAID, close, { top: true });
  return true;
}

// ------------------------------------------------------------------ the title's notices

/** Games whose player put the update off this session. */
const updateLater = new WeakSet<Game>();

/** The Home Screen app's note is due: the first launch from the iPhone's Home Screen. */
export function standaloneNoticeDue(game: Game): boolean {
  const hs = game.deps.homeScreen;
  const f = flags(game);
  return !!hs && !!f && !f.noticeDone && hs.ios && hs.standalone;
}

/** The downloaded copy's note is due: its first launch from the disk. */
export function offlineNoticeDue(game: Game): boolean {
  const hs = game.deps.homeScreen;
  const f = flags(game);
  return !!hs && !!f && !f.offlineDone && hs.fileCopy === true;
}

export function updateNoticeDue(game: Game): boolean {
  const hs = game.deps.homeScreen;
  return !!hs && !updateLater.has(game) && hs.updateReady();
}

/** The title is ready: its notices, one at a time (true: a card is up). */
export function titleNotice(game: Game): boolean {
  if (offlineNoticeDue(game)) {
    const close = () => {
      setFlag(game, 'offlineDone');
      game.scenes.pop();
    };
    card(game, OFFLINE_NOTICE_LINES, OFFLINE_NOTICE_SAID, close, { top: true });
    return true;
  }
  if (standaloneNoticeDue(game)) {
    const close = () => {
      setFlag(game, 'noticeDone');
      game.scenes.pop();
    };
    card(game, STANDALONE_NOTICE_LINES, STANDALONE_NOTICE_SAID, close, { top: true });
    return true;
  }
  if (updateNoticeDue(game)) {
    updateLater.add(game); // asked once a session; a later launch picks the update up anyway
    card(
      game,
      UPDATE_LINES,
      UPDATE_SAID,
      () => {
        game.scenes.pop();
        game.deps.announcer?.say('Updating.');
        game.deps.homeScreen?.applyUpdate();
      },
      { top: true, onBack: () => game.scenes.pop() },
    );
    return true;
  }
  return false;
}

// ------------------------------------------------------------------ Options

/**
 * Options → ADD TO HOME SCREEN, or nothing when it is hidden (in the Home Screen app, in the
 * downloaded copy, and on a desktop browser with no install API). `status` shows a line under the menu.
 */
export function homeScreenItems(game: Game, status: (s: string) => void): MenuItem[] {
  const hs = game.deps.homeScreen;
  const variant = hs && !hs.fileCopy ? hs.variant() : 'hidden';
  if (!hs || variant === 'hidden') return [];
  if (variant === 'prompt')
    return [
      {
        label: ADD_TO_HOME_SCREEN,
        hint: 'Installs the game as an app, for full screen and offline play',
        select: () =>
          void hs.prompt().then((outcome) => {
            const s =
              outcome === 'accepted'
                ? 'Added to Home Screen'
                : outcome === 'dismissed'
                  ? 'Not added'
                  : 'Use the browser menu';
            status(s);
            game.deps.announcer?.say(`${s}.`);
          }),
      },
    ];
  return [
    {
      label: ADD_TO_HOME_SCREEN,
      hint: 'How to play full screen and offline',
      select: () => game.scenes.push(new InstallGuideScene(game, variant, () => game.scenes.pop())),
    },
  ];
}

// ------------------------------------------------------------------ the guide

/** Pixel icons (original art): `#` and letters are colours, `.` is left clear. */
type Icon = { rows: readonly string[]; colours: Readonly<Record<string, string>> };

const BLUE = '#3c8cfc';
/** Safari's Share: a box with an arrow up out of it. */
const SHARE: Icon = {
  rows: [
    '......#......',
    '.....###.....',
    '....#.#.#....',
    '......#......',
    '......#......',
    '.###..#..###.',
    '.#....#....#.',
    '.#.........#.',
    '.#.........#.',
    '.#.........#.',
    '.#.........#.',
    '.###########.',
  ],
  colours: { '#': BLUE },
};
/** The share sheet's ADD TO HOME SCREEN: a plus in a rounded square. */
const PLUS: Icon = {
  rows: [
    '.#########.',
    '#.........#',
    '#....#....#',
    '#....#....#',
    '#..#####..#',
    '#....#....#',
    '#....#....#',
    '#.........#',
    '.#########.',
  ],
  colours: { '#': '#fcfcfc' },
};
/** Safari (a compass). */
const COMPASS: Icon = {
  rows: [
    '....#####....',
    '..##bbbbb##..',
    '.#bbbbbbbrr#.',
    '.#bbbbbbrrb#.',
    '#bbbbbbrrbbb#',
    '#bbbbbrrbbbb#',
    '#bbbbbwwbbbb#',
    '#bbbbwwbbbbb#',
    '#bbbwwbbbbbb#',
    '.#bwwbbbbbb#.',
    '.#wwbbbbbbb#.',
    '..##bbbbb##..',
    '....#####....',
  ],
  colours: { '#': '#fcfcfc', b: BLUE, r: '#d82800', w: '#bcbcbc' },
};
/** The arrow toward Safari's toolbar (drawn pointing down; flipped for a toolbar on top). */
const ARROW: Icon = {
  rows: [
    '...###...',
    '...###...',
    '...###...',
    '#########',
    '.#######.',
    '..#####..',
    '...###...',
    '....#....',
  ],
  colours: { '#': '#fcd860' },
};
const BACK_CHEVRON: Icon = {
  rows: ['...#', '..#.', '.#..', '#...', '.#..', '..#.', '...#'],
  colours: { '#': BLUE },
};
const FWD_CHEVRON: Icon = {
  rows: ['#...', '.#..', '..#.', '...#', '..#.', '.#..', '#...'],
  colours: { '#': '#a8a8a8' },
};
const TABS: Icon = {
  rows: ['..######', '..#....#', '######.#', '#....#.#', '#....###', '#....#..', '######..'],
  colours: { '#': BLUE },
};

function drawIcon(r: Renderer, icon: Icon, x: number, y: number, flipY = false): void {
  const n = icon.rows.length;
  icon.rows.forEach((row, i) => {
    const yy = y + (flipY ? n - 1 - i : i);
    for (let c = 0; c < row.length; c++) {
      const colour = icon.colours[row[c] as string];
      if (colour) r.rect(x + c, yy, 1, 1, colour);
    }
  });
}

/** The Home Screen icon itself, `scale` px a cell. */
function drawAppIcon(r: Renderer, x: number, y: number, scale: number): void {
  APP_ICON.forEach((row, gy) => {
    for (let gx = 0; gx < row.length; gx++)
      r.rect(x + gx * scale, y + gy * scale, scale, scale, APP_ICON_COLOURS[row[gx] as string] ?? '#000');
  });
}

/** Where Safari's toolbar is: at the bottom on an upright iPhone, at the top on its side. */
export type ToolbarSide = 'bottom' | 'top';

function toolbarSide(): ToolbarSide {
  return typeof window !== 'undefined' && window.innerWidth > window.innerHeight ? 'top' : 'bottom';
}

/** The page's address for the "open in Safari" guide, when it fits a line. */
function pageAddress(): string {
  if (typeof location === 'undefined') return '';
  const a = `${location.host}${location.pathname}`.toUpperCase();
  return a.length <= 30 ? a : '';
}

const GUIDE_SAID: Record<Exclude<InstallVariant, 'hidden' | 'prompt'>, string> = {
  'ios-safari':
    "Add to Home Screen, for full screen and offline play. Step 1: tap Share, the square with an arrow, in Safari's toolbar. No Share button? Tap the three dots first. Step 2: tap Add to Home Screen. Step 3: tap Add. Then play from the new icon. OK to close.",
  'ios-other':
    "Add to Home Screen: open this page in Safari first. This browser can't add the game to the Home Screen. Copy the address, open Safari and paste it, then come back to Options, Add to Home Screen. OK to close.",
  'browser-menu':
    "Add to Home Screen: open your browser's menu, the three dots, and pick Add to Home Screen or Install app. OK to close.",
};

/**
 * Options → ADD TO HOME SCREEN's guide (iPhone, iPad, an Android browser with no install
 * prompt): pixel-art steps, read out; OK or BACK closes it, never a timer.
 */
export class InstallGuideScene implements Scene {
  private t = 0;
  private done = false;
  readonly side: ToolbarSide;
  private readonly address: string;
  constructor(
    private readonly game: Game,
    readonly variant: Exclude<InstallVariant, 'hidden' | 'prompt'>,
    private readonly onClose: () => void,
    side: ToolbarSide = toolbarSide(),
  ) {
    this.side = side;
    this.address = variant === 'ios-other' ? pageAddress() : '';
  }

  enter(): void {
    this.game.deps.announcer?.say(GUIDE_SAID[this.variant]);
  }

  touchLabels(): TouchLabels {
    return { ...NO_TOUCH_BUTTONS, jump: 'OK', attack: 'BACK' };
  }

  update(_input: InputFrame, inputs: InputFrame[]): void {
    if (this.done) return;
    this.t++;
    if (cardContinues(this.t, inputs, ['jump', 'start', 'attack'])) {
      this.done = true;
      this.game.ctx.audio.sfx('select');
      this.onClose();
    }
  }

  private text(r: Renderer, s: string, x: number, y: number, colour?: FontColour): void {
    const assets = this.game.ctx.assets;
    r.text(colour ? assets.sheet('font', FONT_COLOURS[colour]) : assets.sheet('font'), s, x, y);
  }

  private ctext(r: Renderer, s: string, y: number, colour?: FontColour): void {
    this.text(r, s, (SCREEN_W - s.length * 8) >> 1, y, colour);
  }

  render(r: Renderer): void {
    r.clear('#000');
    if (this.variant === 'ios-safari') this.safari(r);
    else if (this.variant === 'ios-other') this.openInSafari(r);
    else this.browserMenu(r);
  }

  /** OK (and its key) at the bottom right of the text, once it takes input. */
  private prompt(r: Renderer, y: number): void {
    const ok = abilityHint(this.game, 'OK', 'jump');
    this.text(r, ok, SCREEN_W - 16 - ok.length * 8, y);
  }

  private safari(r: Renderer): void {
    const top = this.side === 'top';
    const dy = top ? 44 : 0;
    this.ctext(r, 'ADD TO HOME SCREEN', 10 + dy, 'gold');
    this.text(r, '1. TAP SHARE', 16, 30 + dy);
    drawIcon(r, SHARE, 120, 26 + dy);
    this.text(r, '(NO SHARE? TAP ... FIRST)', 32, 44 + dy, 'grey');
    this.text(r, '2. ADD TO HOME SCREEN', 16, 62 + dy);
    drawIcon(r, PLUS, 192, 61 + dy);
    this.text(r, '3. TAP ADD', 16, 80 + dy);
    this.ctext(r, 'THEN PLAY FROM THE ICON:', 100 + dy, 'grey');
    drawAppIcon(r, 104, 112 + dy, 2);
    this.prompt(r, 168 + dy);
    this.toolbar(r);
  }

  /** A sketch of Safari's toolbar at its side of the screen, an arrow at its Share button. */
  private toolbar(r: Renderer): void {
    const top = this.side === 'top';
    const barY = top ? 0 : 204;
    r.rect(0, barY, SCREEN_W, 36, '#e4e4e4');
    r.rect(0, top ? barY + 35 : barY, SCREEN_W, 1, '#a8a8a8');
    const iy = barY + 12;
    drawIcon(r, BACK_CHEVRON, 20, iy);
    drawIcon(r, FWD_CHEVRON, 68, iy);
    // Share, ringed: the one to tap.
    const sx = top ? 186 : 122;
    r.rect(sx - 4, iy - 4, 21, 20, '#fcd860');
    r.rect(sx - 3, iy - 3, 19, 18, '#e4e4e4');
    drawIcon(r, SHARE, sx, iy - 1);
    if (!top) drawIcon(r, TABS, 220, iy);
    // The arrow bobs toward it (held still with reduce flashing).
    const bob = this.game.ctx.reduceFlashing ? 0 : (this.t >> 4) % 2;
    const ax = sx + 2;
    if (top) drawIcon(r, ARROW, ax, barY + 40 - bob, true);
    else drawIcon(r, ARROW, ax, barY - 13 + bob);
  }

  private openInSafari(r: Renderer): void {
    this.ctext(r, 'ADD TO HOME SCREEN', 10, 'gold');
    drawIcon(r, COMPASS, 121, 28);
    this.ctext(r, 'OPEN THIS PAGE IN SAFARI', 50, 'gold');
    this.ctext(r, 'FIRST.', 62, 'gold');
    this.ctext(r, "THIS BROWSER CAN'T ADD THE", 82);
    this.ctext(r, 'GAME TO THE HOME SCREEN.', 94);
    this.text(r, '1. COPY THIS ADDRESS:', 16, 114);
    if (this.address) this.ctext(r, this.address, 126, 'cyan');
    this.text(r, '2. OPEN SAFARI, PASTE IT', 16, 142);
    this.text(r, '3. OPTIONS > ADD TO HOME', 16, 158);
    this.text(r, 'SCREEN, THERE', 40, 170);
    this.prompt(r, 196);
  }

  private browserMenu(r: Renderer): void {
    this.ctext(r, 'ADD TO HOME SCREEN', 10, 'gold');
    this.ctext(r, "OPEN YOUR BROWSER'S MENU", 60);
    // The three dots.
    for (let i = 0; i < 3; i++) r.rect(126, 78 + i * 6, 4, 4, '#fcfcfc');
    this.ctext(r, 'AND PICK ADD TO HOME SCREEN', 106);
    this.ctext(r, 'OR INSTALL APP.', 118);
    this.ctext(r, 'FULL SCREEN, AND IT PLAYS', 146, 'grey');
    this.ctext(r, 'WITH NO SIGNAL TOO.', 158, 'grey');
    this.prompt(r, 196);
  }
}
