import type { Renderer } from '@engine/gfx/renderer';
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
import { MenuScene, type MenuItem } from './menu';
import { OptionsScene } from './options';
import { FileSelectScene } from './file-select';
import { CheatCode, DEV_CODE } from './cheat';
import type { Game } from './game';
import { Player } from '../entities/player';
import type { CharacterDef } from '../characters/character';
import { listSaves } from '../save/save-files';
import {
  bump,
  fall,
  heroRow,
  titleFreed,
  TITLE_GROUND_Y,
  TITLE_TIMING as T,
  type HeroSlot,
} from './title-anim';

export const TITLE_NAME = 'Super Mario Bros. Crossover: REMIX';
const MADE = 'MADE BY JELLOSHOOTER848';
const BASED = ['BASED ON SUPER MARIO BROS.', 'CROSSOVER BY EXPLODING RABBIT'];
const FOOTER = 'PRE-RELEASE';
const CHAPTER = 'CHAPTER 1';

/** Where the logo pieces rest. */
const CROSS_X = 17;
const CROSS_Y = 30;
const TAG_X = 18;
const TAG_Y = 8;
const STAMP_X = 160;
/** The stamp frame's top (its right end is lifted by the shear). */
const STAMP_Y = 54;
const MENU_X = 80;
const MENU_Y = 96;
const MENU_STEP = 12;
/** The rift's centre on screen (where letters and heroes fly out from). */
const RIFT_CX = 128;
const RIFT_CY = 50;

const SKY = '#5c94fc';

export type TitlePhase = 'rift' | 'drop' | 'ready';

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
  private readonly version = `V${__APP_VERSION__}`.toUpperCase();

  constructor(game: Game) {
    super(game, '', [], null);
    this.heroes = heroRow(game.deps.characters, titleFreed(listSaves()));
    const intro = game.deps.titleIntro === true && !game.titleIntroPlayed;
    game.titleIntroPlayed = true;
    this.phase = intro ? 'rift' : 'drop';
    this.stampAt = intro ? T.riftStamp : T.dropStamp;
    let walker = 0;
    this.actors = this.heroes.map((slot, i) => {
      const walks = !intro && slot.freed;
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
    const items: MenuItem[] = [
      { label: 'Start game', select: () => game.scenes.replace(new FileSelectScene(game)) },
      { label: 'Custom levels', select: () => game.showCustomLevels() },
      {
        label: 'Options',
        select: () => game.scenes.push(new OptionsScene(game, () => game.scenes.pop())),
        hint: 'Settings, how to play and the level editor',
      },
    ];
    if (game.devMode) items.push({ label: 'Dev mode', select: () => game.showDevMenu() });
    this.setItems(items);
  }

  override enter(): void {
    const audio = this.game.ctx.audio;
    if (this.phase === 'rift') audio.playJingle('title-rift');
    else audio.playMusic('title');
    this.rebuild();
    // Mario starts free, so count the heroes to find, as character select does.
    const toFind = this.heroes.filter((h) => h.def.id !== 'mario');
    const freed = toFind.filter((h) => h.freed).length;
    const it = this.items[this.index];
    this.game.deps.announcer?.say(
      [
        `${TITLE_NAME}. Chapter 1.`,
        `${freed} of ${toFind.length} heroes freed.`,
        'Made by jelloshooter848. Based on Super Mario Bros. Crossover by Exploding Rabbit. Pre-release.',
        `Version ${__APP_VERSION__}.`,
        this.phase === 'rift' ? 'Press any button to skip the intro.' : '',
        it ? `${it.label}${it.hint ? `. ${it.hint}` : ''}` : '',
      ]
        .filter(Boolean)
        .join(' '),
    );
  }

  /** B does nothing here, but stays (blank) so the developer code can be entered by touch. */
  override touchLabels(): TouchLabels {
    if (this.phase === 'rift') return { jump: 'SKIP', attack: '', special: null, start: null, select: null };
    return { ...super.touchLabels(), attack: '' };
  }

  // ------------------------------------------------------------ effects (reduce flashing aware)

  private get calm(): boolean {
    return this.game.ctx.reduceFlashing;
  }

  /** Vertical screen shake in px as the stamp lands (always 0 with reduce flashing). */
  shake(): number {
    if (this.calm) return 0;
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
    if (t === this.stampAt) {
      if (this.phase === 'rift') this.game.ctx.audio.playMusic('title');
      this.game.ctx.audio.sfx('stamp');
    }
    if (this.phase === 'rift' && t >= T.riftEnd) this.phase = 'ready';
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
    if (this.phase === 'rift') {
      this.t++;
      if (Actions.some((a) => input.pressed(a))) this.finish();
      else this.tick();
      return; // the press that skips never reaches the menu
    }
    this.tick();
    if (this.unlockedFlash > 0) this.unlockedFlash--;
    if (this.cheat.feed(input)) {
      const s = this.game.deps.settings;
      if (s && !s.dev) {
        s.dev = true;
        this.game.deps.applySettings?.();
      }
      this.rebuild();
      this.index = this.items.length - 1; // land on the new Dev mode entry
      this.unlockedFlash = 120;
      this.game.ctx.audio.sfx('1up');
      this.game.deps.announcer?.say('Developer mode unlocked.');
      return; // the final press of the code must not also activate a menu item
    }
    if (this.phase === 'drop' && Actions.some((a) => input.pressed(a))) this.finish();
    super.update(input);
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

  /** The SMB field: sky, drifting clouds and hills (slow parallax), two rows of ground. */
  private field(r: Renderer, dy: number): void {
    const assets = this.game.ctx.assets;
    r.clear(SKY);
    const decor = assets.sheet('decor');
    const drift = (speed: number, x: number) => {
      const period = 256 + 64;
      return ((((x - this.clock * speed) % period) + period) % period) - 48;
    };
    r.sprite(decor, 'hill-big', drift(1 / 16, -16 + 48), 178 + dy);
    r.sprite(decor, 'hill-small', drift(1 / 16, 204 + 48), 186 + dy);
    r.sprite(decor, 'bush-1', drift(1 / 16, 96 + 48), 192 + dy);
    r.sprite(decor, 'cloud-1', drift(1 / 8, 212 + 48), 6 + dy);
    r.sprite(decor, 'cloud-2', drift(1 / 8, 4 + 48), 92 + dy);
    r.sprite(decor, 'cloud-1', drift(1 / 8, 214 + 48 + 160), 104 + dy);
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
    if (this.phase === 'ready') return { x: restX, y: CROSS_Y };
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
    if (this.phase === 'ready') return TAG_Y;
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
    if (this.phase === 'ready' || this.clock >= this.stampAt - T.stampPop)
      this.text(r, CHAPTER, 22, 70 + dy, undefined, true);
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
    if (st < T.dustFrames && this.phase !== 'ready') {
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
    this.items.forEach((it, i) => {
      const y = MENU_Y + i * MENU_STEP + dy;
      if (i === this.index && (this.t >> 4) % 2 === 0) this.text(r, '>', MENU_X - 12, y, undefined, true);
      this.text(r, it.label.toUpperCase(), MENU_X, y, it.label === 'Dev mode' ? 'grey' : undefined, true);
    });
  }

  private credits(r: Renderer, dy: number): void {
    this.ctext(r, MADE, 148 + dy, 'gold', true);
    this.ctext(r, BASED[0] as string, 160 + dy);
    this.ctext(r, BASED[1] as string, 169 + dy);
    this.text(r, FOOTER, 4, 228 + dy, undefined, true);
    // The version shares the footer line (release and V0.4.19-DEV.ABC1234 builds fit); only an
    // unusually long build string moves up a line rather than running into the footer.
    const v = this.version;
    const vy = FOOTER.length + 1 + v.length > 31 ? 214 : 228;
    this.text(r, v, 252 - (v.length * 8 - 1), vy + dy, undefined, true);
    if (this.unlockedFlash > 0 && (this.calm || (this.unlockedFlash >> 3) % 2 === 0))
      this.ctext(r, 'DEV MODE UNLOCKED', 140 + dy, 'gold', true);
  }

  override render(r: Renderer): void {
    const dy = this.shake();
    const t = this.clock;
    this.field(r, dy);
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
      return; // the menu and credits appear with the field
    }
    this.menu(r, dy);
    this.credits(r, dy);
  }
}
