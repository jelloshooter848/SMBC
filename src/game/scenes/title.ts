import { transformed, translucent, type Renderer } from '@engine/gfx/renderer';
import type { InputFrame } from '@engine/input/input-manager';
import { Actions } from '@engine/input/actions';
import type { TouchLabels } from '@engine/input/touch';
import { px, toPx } from '@engine/math/units';
import { FONT_COLOURS, type FontColour } from '@content/sprites/font';
import {
  CROSSOVER_ADVANCE,
  CROSSOVER_LETTERS,
  RIFT_PALETTES,
  RIFT_STAGES,
} from '@content/sprites/title-logo';
import { fxPalette } from '@content/sprites/palette-fx';
import { MenuScene, backToMenu, type MenuItem } from './menu';
import { abilityHint, controlScheme } from './hints';
import { OptionsScene } from './options';
import { FileSelectScene } from './file-select';
import { showChapter1Gate } from './chapter1-gate';
import { CheatCode, DEV_CODE } from './cheat';
import { PassphraseScene } from './passphrase';
import type { Game } from './game';
import { Player } from '../entities/player';
import type { CharacterDef } from '../characters/character';
import { listSaves } from '../save/save-files';
import { titleNotice } from '../pwa/home-screen';
import {
  bump,
  fall,
  heroRow,
  titleFreed,
  TITLE_GROUND_Y,
  TITLE_TIMING as T,
  type HeroSlot,
} from './title-anim';
import { TITLE_MUSIC } from './title-music';
import { CLASSIC_AT, type ClassicTitleScene } from './original-title';
import type { Decor } from '../level/schema';
import { decorPalette } from '../entities/objects/decoration';

export const TITLE_NAME = 'Super Mario Bros. Crossover: REMIX';

/** Where the logo pieces rest. */
const CROSS_X = 17;
const CROSS_Y = 30;
const TAG_X = 18;
const TAG_Y = 8;
const STAMP_X = 160;
/** The stamp frame's top (its right end is lifted by the shear). */
const STAMP_Y = 54;
const MENU_X = 80;
/**
 * 0.4.72 (owner, title option A): with the credits gone to Options > About, the menu sits in the
 * middle of the sky between the stamp and the heroes.
 */
export const MENU_Y = 118;
const MENU_STEP = 12;
/** Five rows: the block moves up a little and left, so its last row stays clear of the heroes. */
const MENU_FIVE = { x: 64, y: 106 } as const;
/** "DEV MODE UNLOCKED" flashes here (on the ground, where the version was), clear of the menu. */
const UNLOCKED_Y = 228;
/** The rift's centre on screen (where letters and heroes fly out from). */
const RIFT_CX = 128;
const RIFT_CY = 50;

const SKY = '#5c94fc';

/**
 * 0.4.74 (owner, 52A): the way back from CLASSIC, through the rift. A small rift portal (the
 * intro's own rift) tears open over the logo, CLASSIC stretches toward it and is sucked up into
 * it, shrinking and spinning, and then REMIX comes out of it, unwinding and growing into its
 * place; the portal closes behind it. It replaces 0.4.72's shatter-and-slam, which the owner
 * found went by too fast to read. Frames from the REMIX title's start. Reduce flashing plays the
 * same timeline calmly: the portal's colours hold still, nothing spins or overshoots, CLASSIC
 * fades as it shrinks and REMIX fades in as it grows.
 */
export const BACK = {
  /** Frames a portal stage (it tears open and closes through these, as the intro's rift does). */
  openStep: 3,
  /** CLASSIC is pulled up into the portal over these frames (gone at `suckTo`). */
  suckFrom: 6,
  suckTo: 42,
  /** REMIX comes out of the portal. */
  emergeFrom: 48,
  /**
   * REMIX is in its place (named for 0.4.72's slam): the stamp's thud, the theme from its loop
   * point, the heroes and the menu (about 1.33 s in).
   */
  slam: 80,
  /** The portal has closed: the finished title. */
  end: 92,
} as const;
/** The portal's centre on screen, and the rift stage it opens to (of RIFT_STAGES). */
export const PORTAL = { x: 186, y: 42, stage: 4 } as const;
/** CLASSIC's size (the 'classic' frame) and the REMIX stamp's ('remix'). */
const CLASSIC_W = 173;
const CLASSIC_H = 29;
const STAMP_W = 92;
const STAMP_H = 44;

/** Where a logo word is drawn on the way back: its centre, turn (radians), scale and opacity. */
export interface Pose {
  x: number;
  y: number;
  angle: number;
  sx: number;
  sy: number;
  alpha: number;
}

const clamp01 = (k: number) => Math.min(1, Math.max(0, k));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/**
 * CLASSIC `t` frames into the way back (null once it is gone into the portal). It waits while
 * the portal opens, stretches toward it, then is pulled in, faster and faster, shrinking (and
 * spinning, two turns, unless `calm`).
 */
export function suckPose(t: number, calm: boolean): Pose | null {
  if (t >= BACK.suckTo) return null;
  // Whole pixels (posed() draws a frame's top left at its centre less half its size, rounded down).
  const x0 = CLASSIC_AT.x + (CLASSIC_W >> 1);
  const y0 = CLASSIC_AT.y + (CLASSIC_H >> 1);
  const k = clamp01((t - BACK.suckFrom) / (BACK.suckTo - BACK.suckFrom));
  // The stretch: taller and narrower, leaning a little toward the portal.
  const s = Math.sin(clamp01(k / 0.25) * (Math.PI / 2));
  // The pull: q runs 0..1 after the stretch.
  const q = clamp01((k - 0.25) / 0.75);
  const size = Math.pow(1 - q, 1.3);
  const m = 0.1 * s + 0.9 * q * q;
  // A swirl off the straight line (not calm).
  const off = calm ? 0 : Math.sin(m * Math.PI) * 12;
  return {
    x: lerp(x0, PORTAL.x, m) + off,
    y: lerp(y0, PORTAL.y, m) + off * 0.4,
    angle: calm ? 0 : -0.12 * s + q * q * 4 * Math.PI,
    sx: (1 - 0.2 * s) * size,
    sy: (1 + 0.5 * s) * size,
    alpha: calm ? 1 - 0.7 * q : 1,
  };
}

/**
 * REMIX `t` frames into the way back (null before it comes out): out of the portal's centre
 * into its place, growing (with a little overshoot) and unwinding one turn, unless `calm`. At
 * BACK.slam it is exactly at rest.
 */
export function emergePose(t: number, calm: boolean): Pose | null {
  if (t < BACK.emergeFrom) return null;
  const q = clamp01((t - BACK.emergeFrom) / (BACK.slam - BACK.emergeFrom));
  const out = 1 - (1 - q) * (1 - q);
  // easeOutBack: 0 to 1, a little past 1 near the end.
  const c = 1.70158;
  const back = 1 + (c + 1) * Math.pow(q - 1, 3) + c * Math.pow(q - 1, 2);
  const s = calm ? out : back;
  return {
    x: lerp(PORTAL.x, STAMP_X + (STAMP_W >> 1), out),
    y: lerp(PORTAL.y, STAMP_Y + (STAMP_H >> 1), out),
    angle: calm ? 0 : -2 * Math.PI * (1 - q) * (1 - q),
    sx: s,
    sy: s,
    alpha: calm ? clamp01(q * 1.5) : 1,
  };
}

/** The portal's rift stage `t` frames into the way back (0: none): open, a gulp, then closing. */
export function portalStage(t: number, calm: boolean): number {
  const S = PORTAL.stage;
  if (t >= BACK.slam) return Math.max(0, S - Math.floor((t - BACK.slam) / BACK.openStep));
  // It gulps (one stage smaller for a moment) as CLASSIC goes in; not with Reduce flashing.
  if (!calm && t >= BACK.suckTo && t < BACK.suckTo + 4) return S - 1;
  return Math.min(S, 1 + Math.floor(t / BACK.openStep));
}

/**
 * The speaker in the top-right corner (0.4.35, owner): sound on / off without a menu, the same
 * mute as Options > Audio > Mute. Its box (screen px) is also what a tap or click hits.
 */
const SPEAKER = { x: 236, y: 4, w: 16, h: 12 } as const;
/** The speaker's pixel rows: `#` white, `x` the red cross when muted, waves `)` while sound is on. */
const SPEAKER_BODY = ['....##', '...###', '######', '######', '######', '######', '...###', '....##'];

/**
 * 'gate' (BUG-13): the start gate before the rift intro, while the browser holds the sound back
 * (the page load's first title, before any press). Then the rift (the intro), the quick drop
 * (every later title), and the finished screen.
 */
export type TitlePhase = 'gate' | 'rift' | 'drop' | 'back' | 'ready';

/**
 * BUG-13: the page load's first title waits behind a start gate when its sound is not running
 * yet (the browser starts audio only on a press), so the rift intro is heard from its first
 * frame. A sink that says nothing of its state (the headless sim, tests) never needs one.
 */
export function needsStartGate(audio: { readonly state?: string }): boolean {
  return audio.state !== undefined && audio.state !== 'running';
}

/** One hero on the ground: a throwaway Player posed for the sprite pickers (as the guide does). */
interface Actor {
  slot: HeroSlot;
  p: Player;
  /** Current centre x and feet y. */
  x: number;
  y: number;
  /** Frames left in a pose (attack), 0 standing. */
  pose: number;
  /** Walking in from the left. */
  walking: boolean;
  /** Frame the hero starts moving (walk-in, or the flight out of the rift). */
  start: number;
}

function poser(def: CharacterDef): Player {
  const states = def.damage.kind === 'powerup' ? def.damage.states : [];
  const power = states.includes('big')
    ? 'big'
    : def.damage.kind === 'powerup'
      ? (states[0] ?? 'small')
      : 'full';
  const p = new Player(px(0), px(0), def, power, def.damage.kind === 'hp' ? def.damage.max : 0);
  p.body.onGround = true;
  p.refitHitbox();
  return p;
}

export class TitleScene extends MenuScene {
  private readonly cheat = new CheatCode(DEV_CODE);
  private unlockedFlash = 0;
  /** Heroes on the ground, registry order; freed ones in colour. */
  readonly heroes: HeroSlot[];
  private readonly actors: Actor[];
  phase: TitlePhase;
  /** Frames since the title opened (the timeline clock). */
  private clock = 0;
  /** Frame of the stamp's landing on the current timeline. */
  private stampAt: number;

  /** 1-1's scenery on its first screen (tile coords), the field's (0.4.72: the two titles match). */
  private readonly scenery: readonly Decor[];
  private readonly sceneryPalette: string;

  constructor(
    game: Game,
    /**
     * The CLASSIC title this one comes back from (0.4.72): whether it got as far as its overworld
     * (cut for the REMIX theme on the way back) and whether BACK came before CLASSIC arrived.
     */
    private classic: ClassicTitleScene | null = null,
  ) {
    super(game, '', [], null);
    // 38f: the page's name when a notice that covered it closes (enter says the whole title).
    this.entryTitle = TITLE_NAME;
    // 0.5.0 (G-111): the campaign is closed until Chapter 1 (G-100), so outside dev mode every hero
    // stands in colour; with dev mode on (the campaign playable) the row shows the best file's.
    const all = game.deps.characters.map((c) => c.id);
    this.heroes = heroRow(game.deps.characters, game.campaignOpen ? titleFreed(listSaves()) : all);
    const intro = game.deps.titleIntro === true && !game.titleIntroPlayed;
    game.titleIntroPlayed = true;
    // BACK while CLASSIC was still falling (or, with Reduce flashing, while the theme was still
    // fading out under the crossfade): CLASSIC never arrived, so there is no way back to play;
    // the finished title at once (the stamp was there all along), its theme coming back up.
    const unhit =
      !intro &&
      classic !== null &&
      ((classic.backBeforeImpact && !classic.overworldAsked) || classic.backMidCrossfade);
    if (unhit) this.classic = null;
    const back = !intro && this.classic !== null;
    if (intro) {
      this.phase = needsStartGate(game.ctx.audio) ? 'gate' : 'rift';
      this.stampAt = T.riftStamp;
    } else if (back) {
      this.phase = 'back';
      // 0.4.74: Reduce flashing plays the same timeline, calmly (no more instant swap).
      this.stampAt = BACK.slam;
    } else if (unhit) {
      this.phase = 'ready';
      this.stampAt = -T.dustFrames - T.stampShake; // landed long ago: no shake, no dust
    } else {
      this.phase = 'drop';
      this.stampAt = T.dropStamp;
    }
    const level = game.deps.getLevel('1-1');
    this.scenery = level.decor.filter((d) => d.x * 16 < 256 && d.y * 16 < 240);
    this.sceneryPalette = decorPalette(level.theme);
    let walker = 0;
    this.actors = this.heroes.map((slot, i) => {
      // Back from CLASSIC the heroes are already standing in their places (no walk-in).
      const walks = !intro && !back && !unhit && slot.freed;
      return {
        slot,
        p: poser(slot.def),
        x: walks ? -16 : slot.x,
        y: TITLE_GROUND_Y,
        pose: 0,
        walking: walks,
        start: intro ? T.heroesFrom + i * T.heroGap : T.dropEnd + walker++ * T.walkGap,
      };
    });
    this.rebuild();
  }

  private rebuild(): void {
    const game = this.game;
    // 0.5.0 (G-112): Classic first; then the Campaign (O-02), closed outside dev mode (G-100).
    const items: MenuItem[] = [
      {
        label: 'Classic',
        select: () => game.showClassicTitle(),
        hint: 'The original game, as it was',
      },
      {
        label: 'Campaign',
        select: () =>
          game.campaignOpen ? game.scenes.replace(new FileSelectScene(game)) : showChapter1Gate(game),
        hint: game.campaignOpen ? 'The story mode' : 'Coming soon',
      },
      {
        label: 'Options',
        // 38f: back from Options, the title says its focused row again.
        select: () => game.scenes.push(new OptionsScene(game, () => backToMenu(game))),
        hint: 'Settings, how to play, custom levels and the level editor',
      },
    ];
    if (game.devMode) items.push({ label: 'Dev mode', select: () => game.showDevMenu() });
    this.setItems(items);
  }

  override enter(): void {
    this.bindPointer();
    this.rebuild();
    if (this.phase === 'gate') {
      this.bindGate();
      this.game.deps.announcer?.say(`${TITLE_NAME}. ${this.gateSaid}`);
      return;
    }
    const audio = this.game.ctx.audio;
    if (this.phase === 'rift') audio.playJingle('title-rift');
    else if (this.phase === 'back') this.startBack();
    else audio.playMusic('title');
    this.sayTitle();
  }

  // ------------------------------------------------------------ the way back from CLASSIC

  /** The slam has happened (its thud, and the theme from its loop point). */
  private slammed = false;

  /**
   * The music of the way back (0.4.72): the overworld is cut as the portal opens, and the stamp's
   * thud as REMIX lands in place is the sting the REMIX theme comes in on. BACK before CLASSIC's impact left
   * the theme playing (no overworld yet): it just comes back up (BUG-12).
   */
  private startBack(): void {
    const audio = this.game.ctx.audio;
    if (!this.classic?.overworldAsked) audio.playMusic('title');
    else if (audio.fadeOutMusic) audio.fadeOutMusic(TITLE_MUSIC.shatterOut);
    else audio.stopMusic();
  }

  /** REMIX lands in place: the stamp's thud, and the theme from bar 3 (past its fanfare). Once. */
  private slam(): void {
    if (this.slammed) return;
    this.slammed = true;
    // The CLASSIC title's frame is no longer drawn: let it (its demo World) go.
    this.classic = null;
    const audio = this.game.ctx.audio;
    // The same song still playing (BACK before the impact) only comes back up, never restarted.
    audio.playMusic('title', 0, true);
    audio.sfx('stamp');
  }

  // ------------------------------------------------------------ the start gate (BUG-13)

  /** The gate's words: touch taps, everything else presses any key (or pad button). */
  get gateText(): string {
    return controlScheme(this.game) === 'touch' ? 'TAP TO START' : 'PRESS ANY KEY';
  }
  private get gateSaid(): string {
    return controlScheme(this.game) === 'touch' ? 'Tap to start.' : 'Press any key to start.';
  }

  /** A key, click or tap seen by the page while the gate is up (any key, bound or not). */
  private gatePressed = false;
  /** The press that passed the gate is still held: it is not a skip. */
  private gateHeld = false;
  private unbindGate: (() => void) | null = null;

  private bindGate(): void {
    if (typeof window === 'undefined' || this.unbindGate) return;
    const press = () => {
      if (this.game.scenes.top === this) this.gatePressed = true;
    };
    window.addEventListener('keydown', press, true);
    window.addEventListener('pointerdown', press, true);
    this.unbindGate = () => {
      window.removeEventListener('keydown', press, true);
      window.removeEventListener('pointerdown', press, true);
    };
  }

  /**
   * The gate's press: sound starts (main.ts has already unlocked it in that key's or tap's own
   * event; a pad button has no such event, so it is asked here too) and the rift intro plays
   * from its first frame. That press is not a skip.
   */
  passGate(): void {
    if (this.phase !== 'gate') return;
    this.unbindGate?.();
    this.unbindGate = null;
    this.gatePressed = false;
    this.gateHeld = true;
    this.game.ctx.audio.unlock?.();
    // The intro at full level from its first note: no sound-start fade for it.
    this.game.ctx.audio.skipStartFade?.();
    this.phase = 'rift';
    this.clock = 0;
    this.game.ctx.audio.playJingle('title-rift');
    this.sayTitle();
  }

  private sayTitle(): void {
    const it = this.items[this.index];
    this.game.deps.announcer?.say(
      [
        `${TITLE_NAME}.`,
        // The credit stays in what is said (the version is on Options > About, 0.4.72).
        'Made by jelloshooter848. Based on Super Mario Bros. Crossover by Jay Pavlina and Exploding Rabbit.',
        this.phase === 'rift' ? 'Press any button to skip the intro.' : '',
        this.game.deps.settings?.audio
          ? `Sound ${this.muted ? 'off' : 'on'}. ${controlScheme(this.game) === 'touch' ? 'SOUND' : abilityHint(this.game, 'SOUND', 'select')} ${this.muted ? 'turns it on' : 'mutes it'}.`
          : '',
        it ? `${it.label}${it.hint ? `. ${it.hint}` : ''}` : '',
      ]
        .filter(Boolean)
        .join(' '),
    );
  }

  /**
   * B does nothing here, but stays (blank) so the developer code can be entered by touch. SELECT
   * is the SOUND button (the speaker).
   */
  override touchLabels(): TouchLabels {
    if (this.phase === 'gate')
      return { jump: 'START', attack: null, special: null, start: null, select: null };
    if (this.phase === 'rift') return { jump: 'SKIP', attack: '', special: null, start: null, select: null };
    return { ...super.touchLabels(), attack: '', select: 'SOUND' };
  }

  // ------------------------------------------------------------ the speaker (sound on / off)

  /** All sound is off (Options > Audio > Mute). */
  get muted(): boolean {
    return this.game.deps.settings?.audio?.muted ?? false;
  }

  /** The speaker's box, screen px (a tap or click inside it toggles the sound). */
  get speakerBox(): { x: number; y: number; w: number; h: number } {
    return { ...SPEAKER };
  }

  /** Sound on / off: the setting Options > Audio > Mute changes, saved and applied, and said. */
  toggleSound(): void {
    const s = this.game.deps.settings;
    if (!s?.audio) return;
    s.audio.muted = !s.audio.muted;
    this.game.deps.applySettings?.();
    if (!s.audio.muted) this.game.ctx.audio.sfx('select');
    this.game.deps.announcer?.say(s.audio.muted ? 'Sound off.' : 'Sound on.');
  }

  /** The speaker is on screen (not behind the gate, in the rift, or before REMIX is back in place). */
  get speakerShown(): boolean {
    if (this.phase === 'gate' || this.phase === 'rift') return false;
    return !(this.phase === 'back' && this.clock < this.stampAt);
  }

  /** A tap or click at screen (x, y): on the speaker, while it shows, it toggles the sound (true). */
  tapAt(x: number, y: number): boolean {
    if (!this.speakerShown) return false;
    const b = SPEAKER;
    // A little slack around the icon: a fingertip is bigger than 16 px.
    if (x < b.x - 6 || x > b.x + b.w + 4 || y < b.y - 4 || y > b.y + b.h + 6) return false;
    this.toggleSound();
    return true;
  }

  private unbindPointer: (() => void) | null = null;

  /** Taps and clicks on the canvas reach the speaker while the title is on top. */
  private bindPointer(): void {
    const canvas = this.game.deps.canvas;
    const viewport = this.game.deps.viewport;
    if (!canvas || !viewport || this.unbindPointer) return;
    const down = (e: PointerEvent) => {
      if (this.game.scenes.top !== this || !this.speakerShown) return;
      const s = viewport.toScreen(e.clientX, e.clientY);
      if (this.tapAt(s.x, s.y)) e.preventDefault();
    };
    canvas.addEventListener('pointerdown', down);
    this.unbindPointer = () => canvas.removeEventListener('pointerdown', down);
  }

  exit(): void {
    this.unbindPointer?.();
    this.unbindPointer = null;
    this.unbindGate?.();
    this.unbindGate = null;
  }

  /**
   * The speaker icon. 0.4.72 (owner): no key label beside it any more; SELECT still toggles it and
   * the title still says which key does (sayTitle).
   */
  private speaker(r: Renderer, dy: number): void {
    const b = SPEAKER;
    const x = b.x;
    const y = b.y + 2 + dy;
    const px1 = (cx: number, cy: number, c: string) => r.rect(x + cx, y + cy, 1, 1, c);
    SPEAKER_BODY.forEach((row, cy) => {
      for (let cx = 0; cx < row.length; cx++)
        if (row[cx] === '#') {
          px1(cx + 1, cy + 1, '#000');
          px1(cx, cy, '#fcfcfc');
        }
    });
    if (this.muted) {
      // A red cross where the waves were.
      for (let i = 0; i < 6; i++) {
        px1(8 + i, 1 + i, '#d82800');
        px1(13 - i, 1 + i, '#d82800');
      }
    } else {
      // Two sound waves.
      for (const [cx, cy, h] of [
        [8, 2, 4],
        [10, 1, 6],
        [12, 0, 8],
      ] as const) {
        if (cx === 12 && (this.t >> 5) % 2 === 1 && !this.calm) continue;
        r.rect(x + cx, y + cy, 1, h, '#fcfcfc');
      }
    }
  }

  // ------------------------------------------------------------ effects (reduce flashing aware)

  private get calm(): boolean {
    return this.game.ctx.reduceFlashing;
  }

  /**
   * Vertical screen shake in px as the stamp lands (always 0 with reduce flashing, and on the
   * way back, where REMIX comes out of the portal rather than slamming down).
   */
  shake(): number {
    if (this.calm || this.phase === 'back') return 0;
    const t = this.clock - this.stampAt;
    return t >= 0 && t < T.stampShake ? (t % 2 === 0 ? -2 : 2) : 0;
  }

  /** The wand bolt's white flash frame (never with reduce flashing). */
  boltFlash(): boolean {
    return !this.calm && this.phase === 'rift' && this.clock >= T.flashFrom && this.clock < T.flashTo;
  }

  /** The wand blast's frame: it flickers between two, held steady with reduce flashing. */
  blastFrame(t: number): number {
    return this.calm ? 0 : (t >> 2) % 2;
  }

  /** Which rotation of the rift's band colours shows (fixed with reduce flashing). */
  rimPhase(): number {
    return this.calm ? 0 : Math.floor(this.clock / T.rimStep) % 4;
  }

  // ------------------------------------------------------------ timeline

  /** Jump to the finished screen: logo in place, stamp on, every hero in their place. */
  private finish(): void {
    if (this.phase === 'rift') this.game.ctx.audio.playMusic('title');
    if (this.phase === 'back') this.slam();
    this.phase = 'ready';
    this.clock = Math.max(this.clock, this.stampAt + T.dustFrames, T.dropEnd);
    for (const a of this.actors) {
      a.x = a.slot.x;
      a.y = TITLE_GROUND_Y;
      a.walking = false;
      a.start = 0;
    }
  }

  private tick(): void {
    this.clock++;
    const t = this.clock;
    if (this.phase === 'back' && t === BACK.suckFrom) this.game.ctx.audio.sfx('pipe');
    if (t === this.stampAt && this.phase === 'back') this.slam();
    else if (t === this.stampAt) {
      if (this.phase === 'rift') this.game.ctx.audio.playMusic('title');
      this.game.ctx.audio.sfx('stamp');
    }
    if (this.phase === 'back' && t >= BACK.end) this.phase = 'ready';
    if (this.phase === 'rift' && t >= T.riftEnd) {
      this.phase = 'ready';
      // 32b: the intro played out with no skip: "press any button to skip" is stale, so the
      // menu's focused row is said, as after a skip.
      this.announce();
    }
    if (this.phase === 'drop' && t >= T.dropEnd) this.phase = 'ready';
    for (const a of this.actors) {
      if (a.walking && t >= a.start) {
        a.x = Math.min(a.slot.x, a.x + T.walkSpeed);
        if (a.x >= a.slot.x) a.walking = false;
      }
      if (a.pose > 0) a.pose--;
      const p = a.p;
      const moving = a.walking && t >= a.start;
      p.anim = moving ? 'walk' : a.pose > 0 ? 'attack' : 'idle';
      p.attackTimer = a.pose > 0 ? 12 : 0;
      p.body.vx = moving ? p.profile.maxWalk : 0;
      if (moving && t % 6 === 0) p.walkFrame = (p.walkFrame + 1) % 3;
    }
    // Now and then a freed hero standing in place strikes a pose.
    if (this.phase === 'ready' && t % T.poseEvery === 0) {
      const idle = this.actors.filter((a) => a.slot.freed && !a.walking && a.pose === 0);
      const a = idle[Math.floor(t / T.poseEvery) % Math.max(1, idle.length)];
      if (a) a.pose = T.poseFrames;
    }
  }

  override update(input: InputFrame): void {
    if (this.phase === 'gate') {
      this.t++;
      if (this.gatePressed || Actions.some((a) => input.pressed(a))) this.passGate();
      return; // the press that starts the sound never reaches the intro or the menu
    }
    if (this.phase === 'rift') {
      this.t++;
      // The gate's press, still held (or seen a frame late), is not a skip: a later one is.
      if (this.gateHeld) this.gateHeld = Actions.some((a) => input.held(a));
      if (!this.gateHeld && Actions.some((a) => input.pressed(a))) {
        this.finish();
        // The intro's "press any button to skip" is stale now: the menu's focused row instead.
        this.announce();
      } else this.tick();
      return; // the press that skips never reaches the menu
    }
    this.tick();
    // A resume link (#save=) opened: once the title is up, ask which file to load it into.
    if (this.phase === 'ready' && this.game.offerSaveLink()) return;
    // The Home Screen app's note and UPDATE READY (0.4.44) wait over the finished title.
    if (this.phase === 'ready' && titleNotice(this.game)) return;
    if (this.unlockedFlash > 0) this.unlockedFlash--;
    if (this.cheat.feed(input)) {
      // 0.5.0 (game/dev-lock.ts): a release build asks for the owner's passphrase first, and one
      // built without it has no way in (the code does nothing at all).
      const lock = this.game.devLock;
      if (lock.mode === 'closed') return;
      if (lock.mode === 'locked' && !this.game.devMode) {
        this.game.scenes.push(new PassphraseScene(this.game, lock, () => this.unlockDev(lock.hash)));
        return;
      }
      this.unlockDev('');
      return; // the final press of the code must not also activate a menu item
    }
    if (this.phase === 'back' && Actions.some((a) => input.pressed(a))) {
      this.finish();
      // 0.4.74: the press that skips the way back never reaches the menu (it would pick CLASSIC
      // again once the menu's first frames are past, now the way back is longer).
      return;
    }
    if (this.phase === 'drop' && Actions.some((a) => input.pressed(a))) this.finish();
    if (input.pressed('select')) {
      this.toggleSound();
      return;
    }
    super.update(input);
  }

  /** Dev mode on (the code, or the passphrase on a release build: `unlock` its lock's hash). */
  private unlockDev(unlock: string): void {
    const s = this.game.deps.settings;
    if (s && (!s.dev || (unlock && s.devUnlock !== unlock))) {
      s.dev = true;
      if (unlock) s.devUnlock = unlock;
      this.game.deps.applySettings?.();
    }
    this.rebuild();
    this.index = this.items.length - 1; // land on the new Dev mode entry
    this.unlockedFlash = 120;
    this.game.ctx.audio.sfx('1up');
    this.game.deps.announcer?.say('Developer mode unlocked.');
  }

  // ------------------------------------------------------------ drawing

  private text(r: Renderer, s: string, x: number, y: number, colour?: FontColour, shadow = false): void {
    const assets = this.game.ctx.assets;
    if (shadow) r.text(assets.sheet('font', FONT_COLOURS.black), s, x + 1, y + 1);
    r.text(colour ? assets.sheet('font', FONT_COLOURS[colour]) : assets.sheet('font'), s, x, y);
  }

  private ctext(r: Renderer, s: string, y: number, colour?: FontColour, shadow = false): void {
    this.text(r, s, Math.round(128 - (s.length * 8 - 1) / 2), y, colour, shadow);
  }

  /**
   * The SMB field: sky, two rows of ground and 1-1's own first screen of scenery, standing still
   * (0.4.72), so the REMIX and CLASSIC titles share one backdrop.
   */
  private field(r: Renderer, dy: number): void {
    const assets = this.game.ctx.assets;
    r.clear(SKY);
    const decor = assets.sheet('decor', this.sceneryPalette);
    for (const d of this.scenery) {
      // Anchored at its bottom-left tile, as the level draws it (Decoration).
      const h = decor.frames.get(d.kind)?.h ?? 16;
      r.sprite(decor, d.kind, d.x * 16, (d.y + 1) * 16 - h + dy);
    }
    const tiles = assets.sheet('tiles');
    for (let x = 0; x < 256; x += 16) {
      r.sprite(tiles, 'ground', x, TITLE_GROUND_Y + dy);
      r.sprite(tiles, 'ground', x, TITLE_GROUND_Y + 16 + dy);
    }
  }

  /** Deep space for the rift: black with a scatter of fixed stars. */
  private space(r: Renderer, alpha: number): void {
    r.rect(0, 0, 256, 240, alpha >= 1 ? '#000' : `rgba(0,0,0,${alpha.toFixed(3)})`);
    if (alpha < 0.5) return;
    for (let k = 0; k < 70; k++) {
      const x = (k * 97 + 13) % 256;
      const y = (k * 61 + 7) % 240;
      const c = k % 3 === 0 ? '#fcfcfc' : k % 3 === 1 ? '#a4e4fc' : '#9878f8';
      r.rect(x, y, 1, 1, c);
    }
  }

  /** The rift stage showing now (0 = none): tearing open, open, then closing. */
  private riftStage(): number {
    const t = this.clock;
    if (this.phase !== 'rift' || t < T.tearFrom) return 0;
    if (t < T.closeFrom) return Math.min(RIFT_STAGES, 1 + Math.floor((t - T.tearFrom) / T.tearStep));
    return Math.max(0, RIFT_STAGES - Math.floor((t - T.closeFrom) / T.tearStep));
  }

  private bolt(r: Renderer): void {
    const t = this.clock;
    if (this.phase !== 'rift' || t >= T.boltEnd) return;
    // A jagged bolt from the wand off the top left to the rift's centre.
    const k = Math.min(1, t / 10);
    let x = 0;
    let y = 0;
    for (let s = 1; s <= 8; s++) {
      const f = (s / 8) * k;
      const nx = Math.round(RIFT_CX * f + (s < 8 ? ((s * 37) % 11) - 5 : 0));
      const ny = Math.round(RIFT_CY * f + (s < 8 ? ((s * 53) % 9) - 4 : 0));
      r.line(x, y, nx, ny, s % 2 ? '#fcfcfc' : '#3cbcfc');
      x = nx;
      y = ny;
    }
    if (k >= 1)
      r.sprite(
        this.game.ctx.assets.sheet('smb3'),
        `wand-blast-${this.blastFrame(t)}`,
        RIFT_CX - 8,
        RIFT_CY - 8,
      );
  }

  /** Where CROSSOVER letter `i` is now (null: not out yet). */
  private letterPos(i: number): { x: number; y: number } | null {
    const t = this.clock;
    const restX = CROSS_X + i * CROSSOVER_ADVANCE;
    if (this.phase === 'ready' || this.phase === 'back') return { x: restX, y: CROSS_Y };
    if (this.phase === 'rift') {
      const lt = t - (T.lettersFrom + i * T.letterGap);
      if (lt < 0) return null;
      if (lt < T.letterFlight) {
        // A hop out of the rift's centre into place.
        const k = lt / T.letterFlight;
        const sx = RIFT_CX - 15;
        const sy = RIFT_CY - 19;
        return {
          x: Math.round(sx + (restX - sx) * k),
          y: Math.round(sy + (CROSS_Y - sy) * k - Math.sin(k * Math.PI) * 24),
        };
      }
      return { x: restX, y: CROSS_Y + bump(lt - T.letterFlight) };
    }
    const lt = t - (T.dropLetterFrom + i * T.dropLetterGap);
    if (lt < 0) return null;
    if (lt < T.dropFall) return { x: restX, y: CROSS_Y + Math.round(fall(lt, 70, T.dropFall)) };
    return { x: restX, y: CROSS_Y + bump(lt - T.dropFall) };
  }

  private tagY(): number | null {
    const t = this.clock;
    if (this.phase === 'ready' || this.phase === 'back') return TAG_Y;
    const from = this.phase === 'rift' ? T.lettersFrom + CROSSOVER_LETTERS.length * T.letterGap + 10 : 0;
    const lt = t - from;
    if (lt < 0) return null;
    if (lt < T.dropFall) return TAG_Y + Math.round(fall(lt, 34, T.dropFall));
    return TAG_Y + bump(lt - T.dropFall);
  }

  private logo(r: Renderer, dy: number): void {
    const sheet = this.game.ctx.assets.sheet('title-logo');
    const ty = this.tagY();
    if (ty !== null) r.sprite(sheet, 'smb-tag', TAG_X, ty + dy);
    for (let i = 0; i < CROSSOVER_LETTERS.length; i++) {
      const p = this.letterPos(i);
      if (p) r.sprite(sheet, `cross-${i}`, p.x, p.y + dy);
    }
    const st = this.clock - this.stampAt;
    if (st < -T.stampPop) return;
    if (st < 0 && !this.calm) {
      // One big frame of the stamp coming down, centred on where it lands.
      const f = sheet.frames.get('remix');
      const w = f?.w ?? 92;
      const h = f?.h ?? 44;
      r.sprite(sheet, 'remix-2x', STAMP_X - (w >> 1), STAMP_Y - (h >> 1) + dy);
      return;
    }
    if (st < 0) return;
    r.sprite(sheet, 'remix-shadow', STAMP_X + 2, STAMP_Y + 2 + dy);
    r.sprite(sheet, 'remix', STAMP_X, STAMP_Y + dy);
    // The landing's dust, not on the way back (REMIX comes out of the portal; 72: so never
    // with Reduce flashing there either).
    if (st < T.dustFrames && this.phase !== 'ready' && this.phase !== 'back') {
      const k = Math.min(2, Math.floor(st / (T.dustFrames / 3)));
      r.sprite(sheet, `dust-${k}`, STAMP_X - 14, STAMP_Y + 34 + dy);
      r.sprite(sheet, `dust-${k}`, STAMP_X + 74, STAMP_Y + 18 + dy);
    }
  }

  /** Hero `a`'s position this frame (null: not out of the rift yet). */
  private actorPos(a: Actor): { x: number; y: number } | null {
    if (this.phase !== 'rift') return { x: a.x, y: a.y };
    const lt = this.clock - a.start;
    if (lt < 0) return null;
    if (lt >= T.heroFlight) return { x: a.slot.x, y: TITLE_GROUND_Y };
    const k = lt / T.heroFlight;
    return {
      x: Math.round(RIFT_CX + (a.slot.x - RIFT_CX) * k),
      y: Math.round(RIFT_CY + 16 + (TITLE_GROUND_Y - RIFT_CY - 16) * k * k - Math.sin(k * Math.PI) * 30),
    };
  }

  private heroesDraw(r: Renderer, dy: number): void {
    const assets = this.game.ctx.assets;
    for (const a of this.actors) {
      const pos = this.actorPos(a);
      if (!pos) continue;
      const def = a.slot.def;
      const p = a.p;
      const s = def.sprite(p, this.clock, this.calm);
      // Still to be found: a black silhouette with a "?" over its head.
      // In their select-screen colours (a hero's in-level palette can depend on its kit).
      const palette = s.sheet === def.portrait.sheet ? def.portrait.palette : s.palette;
      const sheet = assets.sheet(s.sheet, a.slot.freed ? palette : fxPalette(palette, 'silhouette'));
      const f = sheet.frames.get(s.frame);
      const w = f?.w ?? 16;
      const bw = toPx(p.body.w);
      const bodyX = Math.round(pos.x) - (bw >> 1);
      const x = bodyX - (s.flip ? w - bw - s.offsetX : s.offsetX);
      const feet = toPx(p.body.y + p.body.h);
      const y = toPx(p.body.y) - s.offsetY + (pos.y - feet);
      r.sprite(sheet, s.frame, x, y + dy, s.flip);
      if (!a.slot.freed) this.text(r, '?', Math.round(pos.x - 4), y + 2 + dy);
    }
  }

  private menu(r: Renderer, dy: number): void {
    const five = this.items.length > 4;
    const x = five ? MENU_FIVE.x : MENU_X;
    const top = five ? MENU_FIVE.y : MENU_Y;
    this.items.forEach((it, i) => {
      const y = top + i * MENU_STEP + dy;
      if (i === this.index && (this.t >> 4) % 2 === 0) this.text(r, '>', x - 12, y, undefined, true);
      this.text(r, it.label.toUpperCase(), x, y, it.label === 'Dev mode' ? 'grey' : undefined, true);
    });
  }

  /** "DEV MODE UNLOCKED", flashing for a moment after the code (steady with Reduce flashing). */
  private unlockedLine(r: Renderer, dy: number): void {
    const on = this.unlockedFlash > 0 && (this.calm || (this.unlockedFlash >> 3) % 2 === 0);
    if (on) this.ctext(r, 'DEV MODE UNLOCKED', UNLOCKED_Y + dy, 'gold', true);
  }

  /** The way back's rift portal (the intro's rift, smaller), at its stage now. */
  private portal(r: Renderer): void {
    const stage = portalStage(this.clock, this.calm);
    if (stage <= 0) return;
    const sheet = this.game.ctx.assets.sheet('title-rift', RIFT_PALETTES[this.rimPhase()]);
    // The rift's frames are the whole width with the tear at their centre (RIFT_CX, RIFT_CY).
    r.sprite(sheet, `rift-${stage}`, PORTAL.x - RIFT_CX, PORTAL.y - RIFT_CY);
  }

  /** `frame` of the logo sheet drawn centred at `p`'s place, turned, scaled and faded. */
  private posed(r: Renderer, frame: string, w: number, h: number, p: Pose, dx = 0, dy = 0): void {
    const sheet = this.game.ctx.assets.sheet('title-logo');
    translucent(r, p.alpha, () =>
      transformed(r, p.x + dx, p.y + dy, p.angle, p.sx, p.sy, (l) =>
        l.sprite(sheet, frame, -(w >> 1), -(h >> 1)),
      ),
    );
  }

  /**
   * The way back before REMIX is in place (0.4.74): the REMIX field (1-1's first screen, still)
   * from the BACK press on, so nothing behind moves or cuts however far the demo had scrolled;
   * SMB and CROSSOVER in place, the portal over them, and CLASSIC going into it or REMIX coming
   * out. No heroes or menu yet: they are there when REMIX lands.
   */
  private renderBack(r: Renderer): void {
    const sheet = this.game.ctx.assets.sheet('title-logo');
    this.field(r, 0);
    r.sprite(sheet, 'smb-tag', TAG_X, TAG_Y);
    for (let i = 0; i < CROSSOVER_LETTERS.length; i++)
      r.sprite(sheet, `cross-${i}`, CROSS_X + i * CROSSOVER_ADVANCE, CROSS_Y);
    this.portal(r);
    const gone = suckPose(this.clock, this.calm);
    if (gone) this.posed(r, 'classic', CLASSIC_W, CLASSIC_H, gone);
    const out = emergePose(this.clock, this.calm);
    if (out) {
      this.posed(r, 'remix-shadow', STAMP_W, STAMP_H, out, 2 * out.sx, 2 * out.sy);
      this.posed(r, 'remix', STAMP_W, STAMP_H, out);
    }
  }

  override render(r: Renderer): void {
    if (this.phase === 'gate') {
      // Deep space, as the rift opens on, and the gate's words, steady (no blink, no flash).
      this.space(r, 1);
      this.ctext(r, this.gateText, 116, undefined, true);
      return;
    }
    if (this.phase === 'back' && this.clock < this.stampAt) {
      this.renderBack(r);
      return;
    }
    const dy = this.shake();
    const t = this.clock;
    this.field(r, dy);
    // The way back's portal closing behind REMIX.
    if (this.phase === 'back') this.portal(r);
    if (this.phase === 'rift') {
      // Space around the rift, fading to the SMB field as the logo and heroes land.
      const fade = t < T.fadeFrom ? 1 : Math.max(0, 1 - (t - T.fadeFrom) / (T.fadeTo - T.fadeFrom));
      if (fade > 0) this.space(r, fade);
      const stage = this.riftStage();
      if (stage > 0)
        r.sprite(
          this.game.ctx.assets.sheet('title-rift', RIFT_PALETTES[this.rimPhase()]),
          `rift-${stage}`,
          0,
          RIFT_CY - 50,
        );
      this.bolt(r);
    }
    // Heroes first: those flying out of the rift pass behind the logo, which stays readable.
    this.heroesDraw(r, dy);
    this.logo(r, dy);
    if (this.phase === 'rift' && t < T.fadeFrom) {
      if (this.boltFlash()) r.rect(0, 0, 256, 240, '#fcfcfc');
      return; // the menu appears with the field
    }
    this.menu(r, dy);
    this.unlockedLine(r, dy);
    this.speaker(r, dy);
  }
}
