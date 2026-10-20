import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import { shownPortrait, type CharacterDef } from '../characters/character';
import { heroFor, skinGame } from '../characters/registry';
import type { Game } from './game';
import { cheatInfo } from '../cheats';
import { abilityHint } from './hints';
import { fontText } from '../hud/text';
import type { TouchLabels } from '@engine/input/touch';
import type { Action } from '@engine/input/actions';
import { fxPalette } from '@content/sprites/palette-fx';
import { askTraining, needsTraining } from '../tutorial/training';
import { MIN_LIVES_FOR_REVIVAL, type Survival } from '../survival';
import { menuTouchLabels } from '../touch-labels';
import { drawSelectHud } from '../hud/select-hud';
import { SKY } from '../world/tile-render';
import { decorPalette } from '../entities/objects/decoration';
import {
  NAME_BOX,
  ORIGINAL_GRID,
  SELECT_GRID,
  type GridLayout,
  SKIN_GRID,
  drawCell,
  drawDownArrow,
  drawPanel,
  cursorColour,
  DEFAULT_SELECT_THEME,
  type SelectTheme,
  drawnFace,
  faceAt,
  gridPanel,
  inCell,
  skinCell,
  skinLayout,
} from './select-grid';

/**
 * One player picks a hero mid-run: entering a level from the world map, after a death with lives
 * left, or after a continue. The original goes through CharacterSelect every time a level is
 * (re)loaded with newLev set (ScreenManager.createLevel), with no way back to the title.
 */
export interface HeroPick {
  /** Which player picks (0 = player 1); the other player's hero is kept. */
  player: number;
  /** Hero highlighted on entry (the one that just died). */
  current: CharacterDef;
  onPick: (c: CharacterDef) => void;
  /** Back (B/Select), e.g. to the world map; without it there is no way back. */
  onCancel?: () => void;
  /**
   * Campaign deaths: RETURN TO MAP, an entry below the hero row (Down, then OK) and the
   * B/Select shortcut (shown on touch as MAP). Leaves the level as Pause → Quit to map does.
   */
  onMap?: () => void;
  /**
   * The music playing under the pick (the map's), put back after a training stage so the next
   * pick (player two's) has it.
   */
  music?: string | undefined;
  /**
   * false: never ask about training on this pick (a round played for fun, which must not change
   * the file's training answers). Default: the first pick of a freed hero asks (needsTraining).
   */
  training?: boolean;
  /**
   * Classic mode (FU-4): a Random slot ("?") after the last hero; OK on it picks a random hero
   * (Game.randomHero) and goes on as if that hero was chosen.
   */
  random?: boolean;
}

/**
 * A new game's select screen (no HeroPick) started somewhere other than the custom levels: Classic
 * mode's (title > CLASSIC). `begin` starts the run with the picked heroes; `back` leaves.
 */
export interface NewGamePick {
  /** Starts the run (one player: Classic mode has no co-op, so player two cannot join). */
  begin: (c: CharacterDef) => void;
  back: () => void;
  /** The Random slot (HeroPick.random). */
  random?: boolean;
}

/** The second row of heroes (heroes past the first row's) sits this far below the first. */
export const SECOND_ROW_DY = 40;
/**
 * A third row sits this far below the second (closer, to fit): outside Classic mode's grid (a dev
 * free-play pick under Classic rules), the Classic-only heroes split over two rows once they are
 * more than ROW_MAX.
 */
export const THIRD_ROW_DY = 34;
/** The most slots a row past the first holds before the rest move to a third row. */
export const ROW_MAX = 11;

/** Survival's box: its line height and its padding (CharacterSelectScene.boxRect). */
const BOX_LINE = 10;
const BOX_PAD = 6;
/** Frames the name box takes to grow open (MessageBox.resizeBox; instant with Reduce flashing). */
const BOX_GROW = 6;

/**
 * Look `look` of slot hero `host` as said: the look's name, then the hero's ("Break Man, Proto
 * Man"); a hero's own look is just its name (no repeat).
 */
export function lookName(host: CharacterDef, look: CharacterDef): string {
  return look === host ? host.name : `${look.name}, ${host.name}`;
}

/** Classic Survival's box over the select: the revive news, or the "finished?" question. */
type SurvivalBox = { kind: 'cheats' } | { kind: 'news' } | { kind: 'finished'; yes: boolean };

/** The revive news (MessageBoxMessages.YOU_CAN_NOW_REVIVE), as the lines the box draws. */
export const REVIVE_NEWS = ['YOU CAN NOW REVIVE', 'AND STRENGTHEN HEROES.'];
/** The question before leaving revive mode (MessageBoxMessages.CANCEL_REVIVE). */
export const REVIVE_DONE_QUESTION = ['ARE YOU FINISHED', 'REVIVING AND', 'STRENGTHENING HEROES?'];

export class CharacterSelectScene implements Scene {
  private index = 0;
  private index2 = 1;
  private p2 = false;
  private t = 0;
  /** The cursor is on RETURN TO MAP rather than the hero row. */
  private onMapRow = false;
  /**
   * Classic Survival's revive mode (CharacterSelectBox MODE_REVIVE): OK spends a life to revive
   * the hero under the cursor (or strengthen a standing one); DONE goes on to pick a hero.
   */
  private _reviving = false;
  /** Classic Survival's box over the select, while it is up (it waits for a press). */
  private box: SurvivalBox | null = null;
  /** The boxes still to show after this one (the cheat news, then the revive news). */
  private boxQueue: SurvivalBox[] = [];
  /** The cheat news read out with its box (revive mode shows it in a box of its own). */
  private cheatSaid = '';
  /**
   * Classic mode's skin menu (the original's CharacterSkinMenu), while it is open: the slot's
   * hero, its looks and the one under the cursor.
   */
  private picker: { slot: number; host: CharacterDef; list: readonly CharacterDef[]; at: number } | null =
    null;
  /** The frame the name box last started growing from (its lines changed). */
  private boxT = 0;
  /** The look the name box grew for (a new one grows again). */
  private boxFor = '';
  /** Taps and clicks on the canvas (Classic mode's cells), screen px, handled in update. */
  private readonly taps: { x: number; y: number }[] = [];
  /** A tap on the cell under the cursor confirms it this frame (as OK). */
  private tapOk = false;
  private unbindPointer: (() => void) | null = null;
  constructor(
    private readonly game: Game,
    private readonly pick: HeroPick | null = null,
    private readonly start: NewGamePick | null = null,
  ) {}

  /**
   * The heroes to pick from: the run's roster (Game.roster; the Classic extras follow the usual
   * ones), one slot per hero: a hero's other skins are chosen on its slot (Game.heroSlots, FU-8).
   */
  get chars(): readonly CharacterDef[] {
    return this.game.heroSlots;
  }

  /**
   * How many heroes the first row holds: the usual ones (the registry's); any extra heroes after
   * them go on a second row, as in the original's two-row grid.
   */
  get firstRow(): number {
    const chars = this.chars;
    const base = this.game.deps.characters;
    let n = 0;
    while (n < chars.length && n < base.length && chars[n] === base[n]) n++;
    return n === 0 ? chars.length : n;
  }

  /** Classic Survival's state for this select (Game.survival), else null. */
  get survival(): Survival | null {
    return this.hasRandom ? this.game.survival : null;
  }

  /** In revive mode (Classic Survival). */
  get reviving(): boolean {
    return this._reviving;
  }

  /** The box over the select ('news' or 'finished'), else null. */
  get boxShown(): SurvivalBox['kind'] | null {
    return this.box?.kind ?? null;
  }

  /** The slot under the cursor. */
  get cursor(): number {
    return this.index;
  }

  /** Hero `i` has fallen (Classic Survival). */
  fallen(i: number): boolean {
    const c = this.chars[i];
    return !this.isRandom(i) && !!c && this.survival?.isFallen(c.id) === true;
  }

  /**
   * Classic Survival: slot `i` cannot be picked in the mode shown (CharacterSelectBox.changeMode):
   * picking a hero, the fallen; reviving, the standing heroes already fully strengthened. The
   * Random slot always can.
   */
  private unpickable(i: number): boolean {
    if (!this.survival || this.isRandom(i)) return false;
    const c = this.chars[i];
    if (!c) return true;
    return this._reviving ? this.game.fullyUpgraded(c) : this.fallen(i);
  }

  /** The cursor passes over slot `i`: a locked captive, or one Survival's mode leaves out. */
  private skipped(i: number): boolean {
    return this.locked(i) || this.unpickable(i);
  }

  /** The heroes OK can take now (Survival's Random slot picks among them). */
  private pickable(): CharacterDef[] {
    return this.chars.filter((_, i) => !this.skipped(i));
  }

  /** Classic mode's Random slot is shown: it is slot `chars.length`, after the last hero. */
  get hasRandom(): boolean {
    return (this.pick?.random ?? this.start?.random) === true;
  }

  /** Every slot: the heroes, then the Random slot when shown. */
  private get total(): number {
    return this.chars.length + (this.hasRandom ? 1 : 0);
  }

  /**
   * Slots on the first row: the usual heroes when a second row holds the extras (the Random slot
   * then ends the second row), else every slot.
   */
  private get firstRowSlots(): number {
    const first = this.firstRow;
    return first < this.chars.length ? first : this.total;
  }

  /** Slot `i` is the Random slot. */
  private isRandom(i: number): boolean {
    return this.hasRandom && i === this.chars.length;
  }

  /**
   * Classic mode's select (title > CLASSIC, and its picks after a death or a clear) is drawn in
   * the original 3.1.21's layout: a grid of portrait cells with a name box and a skin menu
   * (select-grid.ts). Every other select keeps the rows of standing heroes.
   */
  get classicLayout(): boolean {
    return this.hasRandom;
  }

  /** The skin menu is open (Classic mode). */
  get pickerOpen(): boolean {
    return this.picker !== null;
  }

  /** The look under the skin menu's cursor, while it is open. */
  get pickerSkin(): CharacterDef | null {
    return this.picker ? (this.picker.list[this.picker.at] ?? null) : null;
  }

  /**
   * Where each row starts (slot index), then the total: the first row, then the slots past it on
   * one row, or on two (the larger first) when they are more than ROW_MAX. Classic mode's grid:
   * rows of its grid's columns (`grid`).
   */
  private get rowStarts(): number[] {
    const n = this.total;
    if (this.classicLayout) {
      const cols = this.grid.cols;
      // CharacterSelectBox.alignPortraits: the top row holds half the cells (rounded up, the
      // Random slot counted), one fewer with no map-skin cell (`col == numTopRow - 1` when
      // enabledSkinSetCount == 1), so the eleven slots break 5 / 6.
      const top = this.grid === ORIGINAL_GRID ? Math.min(cols, Math.ceil((n + 1) / 2) - 1) : cols;
      const starts: number[] = [0];
      for (let i = top; i < n; i += cols) starts.push(i);
      starts.push(n);
      return starts;
    }
    const first = this.firstRowSlots;
    if (first >= n) return [0, n];
    const rest = n - first;
    if (rest <= ROW_MAX) return [0, first, n];
    return [0, first, first + Math.ceil(rest / 2), n];
  }

  /** Classic mode's grid: cell `i`'s top-left (each row starts at the grid's left). */
  cellOf(i: number): { x: number; y: number } {
    const g = this.grid;
    const r = this.rowOf(i);
    const k = i - (this.rowStarts[r] as number);
    return { x: g.x + k * (g.cell + g.gap), y: g.y + r * (g.cell + g.gap) };
  }

  /** How many rows the select has (1 to 3). */
  get rows(): number {
    return this.rowStarts.length - 1;
  }

  /** The row slot `i` is on. */
  private rowOf(i: number): number {
    const starts = this.rowStarts;
    let r = 0;
    while (r + 1 < starts.length - 1 && i >= (starts[r + 1] as number)) r++;
    return r;
  }

  /** The feet line of row `r`. */
  private rowY(r: number): number {
    return 120 + (r > 0 ? SECOND_ROW_DY : 0) + (r > 1 ? THIRD_ROW_DY : 0);
  }

  /** The spacing of the slots on slot `i`'s row. */
  private spacingOf(i: number): number {
    const starts = this.rowStarts;
    const r = this.rowOf(i);
    const len = (starts[r + 1] as number) - (starts[r] as number);
    return Math.min(64, 224 / Math.max(1, len));
  }

  /**
   * Where slot `i` stands (a hero, or the Random slot): its centre x and its feet y. Classic
   * mode's grid: its cell's centre x and bottom.
   */
  slot(i: number): { x: number; y: number } {
    if (this.classicLayout) {
      const c = this.cellOf(i);
      return { x: c.x + this.grid.cell / 2, y: c.y + this.grid.cell };
    }
    const starts = this.rowStarts;
    const row = this.rowOf(i);
    const len = (starts[row + 1] as number) - (starts[row] as number);
    const k = i - (starts[row] as number);
    const spacing = this.spacingOf(i);
    const x0 = 128 - ((len - 1) * spacing) / 2;
    return { x: Math.round(x0 + k * spacing), y: this.rowY(row) };
  }

  /**
   * The lines under the heroes: the name, the line under it (lives, P2, revive's action), revive's
   * two prompts, PRESS OK and RETURN TO MAP. A second row moves them down by its height; with a
   * third they close up to fit the screen.
   */
  private get lines(): {
    name: number;
    under: number;
    ok: number;
    leave: number;
    press: number;
    map: number;
  } {
    const rows = this.rows;
    if (rows >= 3) return { name: 204, under: 213, ok: 222, leave: 231, press: 224, map: 232 };
    if (rows === 2) return { name: 184, under: 196, ok: 208, leave: 220, press: 210, map: 224 };
    return { name: 144, under: 158, ok: 170, leave: 182, press: 184, map: 204 };
  }

  /** Hero `i` is a brainwashed captive on this campaign file: drawn as a silhouette, skipped. */
  private locked(i: number): boolean {
    if (this.isRandom(i)) return false;
    const c = this.chars[i];
    return !c || this.game.heroLocked(c);
  }

  /**
   * What slot `i` is called (spoken): its hero's name, or Random. A hero with skins (FU-8) says
   * its look too: "Proto Man, skin Break Man".
   */
  private slotName(i: number): string {
    if (this.isRandom(i)) return 'Random';
    const c = this.chars[i];
    if (!c) return '';
    return lookName(c, this.game.skinFor(c));
  }

  /**
   * What a move onto slot `i` says: its look and hero, then in Classic mode the look's game, as the
   * name box shows them ("Break Man, Proto Man, Mega Man 3"; "Proto Man, Mega Man 3").
   */
  private sayName(i: number): string {
    if (this.isRandom(i)) return 'Random';
    const c = this.chars[i];
    if (!c) return '';
    return this.lookSay(c, this.game.skinFor(c));
  }

  /** Look `look` of slot hero `host` as said: lookName, then in Classic mode the look's game. */
  private lookSay(host: CharacterDef, look: CharacterDef): string {
    const name = lookName(host, look);
    const game = this.classicLayout ? skinGame(look) : '';
    return game ? `${name}, ${game}` : name;
  }

  /** The looks slot `i`'s hero can wear (FU-8; one when it has no other skins). */
  private skinsAt(i: number): readonly CharacterDef[] {
    const c = this.isRandom(i) ? undefined : this.chars[i];
    return c ? this.game.skinsFor(c) : [];
  }

  /** The hero under the cursor has other skins: the skin picker is offered. */
  get skinPicker(): boolean {
    return !this._reviving && !this.onMapRow && this.skinsAt(this.index).length > 1;
  }

  /** The skin picker (SKIN): slot `i`'s hero takes its next look, remembered and said. */
  private nextSkin(i: number): void {
    const c = this.chars[i];
    const list = this.skinsAt(i);
    if (!c || list.length < 2) return;
    const at = list.indexOf(this.game.skinFor(c));
    const skin = list[(at + 1) % list.length] ?? c;
    this.game.setSkin(c, skin);
    this.game.ctx.audio.sfx('select');
    this.game.deps.announcer?.say(this.lookSay(c, skin));
  }

  /** OK on slot `i` opens the skin menu: Classic mode, picking (not reviving), a hero with looks. */
  private opensPicker(i: number): boolean {
    return this.classicLayout && !this._reviving && this.skinsAt(i).length > 1;
  }

  /** Opens the skin menu on slot `i`, its cursor on the hero's chosen look. */
  private openPicker(i: number): void {
    const host = this.chars[i];
    if (!host) return;
    const list = this.skinsAt(i);
    const at = Math.max(0, list.indexOf(this.game.skinFor(host)));
    this.picker = { slot: i, host, list, at };
    this.game.ctx.audio.sfx('coin');
    this.game.deps.announcer?.say(
      `Choose a look for ${host.name}. ${this.pickerSay()} ${list.length} looks. ` +
        `Arrows to choose, OK to pick, back to return.`,
    );
  }

  /** The skin menu's line for the look under its cursor: its name, its hero, its game. */
  private pickerSay(): string {
    const pk = this.picker;
    const skin = pk?.list[pk.at];
    if (!pk || !skin) return '';
    return `${this.lookSay(pk.host, skin)}.`;
  }

  /** The skin menu's page (SKIN_GRID.cols x rows looks a page). */
  private get pickerPage(): number {
    return Math.floor((this.picker?.at ?? 0) / (SKIN_GRID.cols * SKIN_GRID.rows));
  }

  /** Moves the skin menu's cursor to look `to` (said; a bump where it cannot go). */
  private pickerTo(to: number): void {
    const pk = this.picker;
    if (!pk) return;
    if (to < 0 || to >= pk.list.length || to === pk.at) {
      this.game.ctx.audio.sfx('bump');
      return;
    }
    pk.at = to;
    this.game.ctx.audio.sfx('select');
    this.game.deps.announcer?.say(this.pickerSay());
  }

  /** The skin menu's input: arrows move, OK picks the look (and the hero), BACK returns. */
  private updatePicker(pressed: (a: Action) => boolean): void {
    const pk = this.picker;
    if (!pk) return;
    const tap = this.taps.shift();
    if (tap) {
      const per = SKIN_GRID.cols * SKIN_GRID.rows;
      const page = this.pickerPage;
      for (let k = 0; k < per && page * per + k < pk.list.length; k++) {
        const c = skinCell(k, pk.list.length);
        if (tap.x >= c.x && tap.x < c.x + SKIN_GRID.w && tap.y >= c.y && tap.y < c.y + SKIN_GRID.h) {
          if (page * per + k === pk.at) this.choosePicked();
          else this.pickerTo(page * per + k);
          return;
        }
      }
    }
    const cols = SKIN_GRID.cols;
    if (pressed('left')) this.pickerTo(pk.at === 0 ? pk.list.length - 1 : pk.at - 1);
    else if (pressed('right')) this.pickerTo((pk.at + 1) % pk.list.length);
    else if (pressed('up')) this.pickerTo(pk.at - cols);
    else if (pressed('down')) {
      // The next row's cell below, or its last when the row is short; on the last row, a bump.
      const lastRow = Math.floor((pk.list.length - 1) / cols);
      this.pickerTo(Math.floor(pk.at / cols) < lastRow ? Math.min(pk.at + cols, pk.list.length - 1) : -1);
    } else if (pressed('jump') || pressed('start')) this.choosePicked();
    else if (pressed('attack') || pressed('select')) {
      // BACK: to the select, the look unchanged (CharacterSkinMenu.pressAtkBtn).
      this.picker = null;
      this.game.ctx.audio.sfx('bump');
      this.game.deps.announcer?.say(this.sayName(this.index));
    }
  }

  /** OK in the skin menu: the look is remembered and the hero picked in it (chooseCharacter). */
  private choosePicked(): void {
    const pk = this.picker;
    const skin = pk?.list[pk.at];
    if (!pk || !skin) return;
    this.picker = null;
    this.game.setSkin(pk.host, skin);
    this.confirm(skin);
  }

  /** OK takes hero `c` (a slot's, in its look): the pick's or the new game's next step. */
  private confirm(c: CharacterDef): void {
    const pick = this.pick;
    if (pick) {
      this.game.pickedRandom = false;
      this.game.ctx.audio.sfx(c.pickSfx ?? 'coin');
      // Campaign: the first pick of a hero on the file asks about training first.
      if (pick.training !== false && needsTraining(this.game, c))
        askTraining(this.game, c, pick.player, () => pick.onPick(c), pick.music);
      else pick.onPick(c);
      return;
    }
    if (this.start) this.game.pickedRandom = false;
    if (c.pickSfx) this.game.ctx.audio.sfx(c.pickSfx);
    if (this.start) this.start.begin(c);
    else this.game.newGame(c, '1-1', null);
  }

  /**
   * A tap or click at screen (x, y) on Classic mode's select: on a cell, the cursor goes there
   * (or, on the cell under it, OK). Taken in the next update.
   */
  tapAt(x: number, y: number): boolean {
    if (!this.classicLayout || this.box) return false;
    this.taps.push({ x, y });
    return true;
  }

  /** The grid slot under screen (x, y), or -1. */
  private slotAt(x: number, y: number): number {
    const n = this.total;
    for (let i = 0; i < n; i++) {
      const c = this.cellOf(i);
      const n = this.grid.cell;
      if (x >= c.x && x < c.x + n && y >= c.y && y < c.y + n) return i;
    }
    return -1;
  }

  /** A grid tap (Classic mode): onto a cell, or OK on the one under the cursor. */
  private takeGridTap(): void {
    this.tapOk = false;
    const tap = this.taps.shift();
    if (!tap) return;
    const i = this.slotAt(tap.x, tap.y);
    if (i < 0 || this.skipped(i)) return;
    if (i === this.index) {
      this.tapOk = true;
      return;
    }
    this.index = i;
    this.game.ctx.audio.sfx('select');
    const name = this.sayName(i);
    if (name)
      this.game.deps.announcer?.say(this._reviving ? `${name}: ${this.reviveAction(i).toLowerCase()}` : name);
  }

  /** Taps and clicks on the canvas reach the cells while this select is on top (Classic mode). */
  private bindPointer(): void {
    const canvas = this.game.deps.canvas;
    const viewport = this.game.deps.viewport;
    if (!this.classicLayout || !canvas || !viewport || this.unbindPointer) return;
    const down = (e: PointerEvent) => {
      if (this.game.scenes.top !== this) return;
      const s = viewport.toScreen(e.clientX, e.clientY);
      if (this.tapAt(s.x, s.y)) e.preventDefault();
    };
    canvas.addEventListener('pointerdown', down);
    this.unbindPointer = () => canvas.removeEventListener('pointerdown', down);
  }

  exit(): void {
    this.unbindPointer?.();
    this.unbindPointer = null;
  }

  /** The hero OK on slot `i` gives: its own (in its chosen look), or for the Random slot a random one. */
  private heroAt(i: number): CharacterDef | undefined {
    if (!this.isRandom(i)) {
      const c = this.chars[i];
      return c && this.game.skinFor(c);
    }
    // Revive mode's Random revives a random hero among those it can (getRandomCharInd).
    const c = this._reviving ? this.game.randomHero(this.pickable()) : this.game.randomHero();
    this.game.deps.announcer?.say(`Random: ${c.name}.`);
    return c;
  }

  /** An unlocked index: `i` itself, else the first hero (Mario), else the first unlocked one. */
  private unlocked(i: number): number {
    if (!this.skipped(i)) return i;
    const chars = this.chars;
    const first = chars.indexOf(this.game.firstHero);
    if (first >= 0 && !this.skipped(first)) return first;
    const k = chars.findIndex((_, j) => !this.skipped(j));
    // Survival with no hero to take: the Random slot.
    if (k < 0 && this.survival) return chars.length;
    return Math.max(0, k);
  }

  /**
   * The portrait for hero `c`: the picking player's own hero shows its carried kit's look
   * (CharacterDef.portraitFor: the Warriors of Light's remembered class), else `portrait`.
   */
  private portraitOf(c: CharacterDef): CharacterDef['portrait'] {
    // A Classic run shows each hero's Classic art (R1: drawn at the original's sizes), in the
    // look chosen for it (FU-8).
    if (!c.portraitFor) return shownPortrait(heroFor(this.game.skinFor(c), this.game.liveRules));
    const s = this.game.state;
    const second = this.pick?.player === 1 && s.character2 !== null;
    const mine = second ? s.character2 : s.character;
    return mine === c ? c.portraitFor(second ? s.kit2 : s.kit) : shownPortrait(c);
  }

  /** With a second row: " up and down for the other row,"; one row: nothing (today's text). */
  private rowsHint(): string {
    if (this.rows > 2) return ' up and down for the other rows,';
    return this.rows === 2 ? ' up and down for the other row,' : '';
  }

  /** " Skin to change a hero's look." when some hero has other skins (FU-8), else nothing. */
  private skinHint(): string {
    return this.chars.some((_, i) => this.skinsAt(i).length > 1) ? " Skin to change a hero's look." : '';
  }

  /** " 7 heroes still to be found." in campaign play while any are locked, else nothing. */
  private toFind(): string {
    const n = this.game.heroesToFind;
    return n > 0 ? ` ${n} ${n === 1 ? 'hero' : 'heroes'} still to be found.` : '';
  }

  /**
   * Classic mode's cheats unlocked by the clear (or the game) before this screen (Game.cheatUnlocks;
   * the original's "You unlocked ... cheat!" boxes): shown over the heroes and read out with the
   * screen's own line, which already waits for a press.
   */
  private cheatNews: string[] = [];

  /** The cheats just unlocked, taken from the game: their names, and the line read out. */
  private takeCheatNews(): string {
    const ids = this.game.cheatUnlocks?.splice(0) ?? [];
    if (!ids.length) return '';
    this.cheatNews = ids.map((id) => cheatInfo(id).name);
    this.game.ctx.audio.sfx('1up');
    const names = this.cheatNews.join(', ');
    return ids.length === 1 ? ` You unlocked the ${names} cheat!` : ` You unlocked these cheats: ${names}!`;
  }

  enter(): void {
    this.bindPointer();
    const news = this.takeCheatNews();
    const pick = this.pick;
    const chars = this.chars;
    const sv = this.survival;
    if (sv) {
      // CharacterSelectBox.initiate: revival allowed and a life to pay with opens revive mode
      // (none to revive or strengthen: the select instead); the select uses the allowance up
      // (characterSelectStartHandler). Unless every hero has fallen, the news comes first.
      this._reviving = sv.reviveAllowed && this.game.state.lives >= MIN_LIVES_FOR_REVIVAL;
      sv.reviveAllowed = false;
      if (this._reviving && this.pickable().length === 0) this._reviving = false;
      if (this._reviving) {
        const current = this.game.slotOf(pick?.current ?? this.game.state.character).id;
        this.index = this.unlocked(
          Math.max(
            0,
            chars.findIndex((c) => c.id === current),
          ),
        );
        // Cheats unlocked by the clear come first (Cheats.unlockCheat's boxes), then the revive news
        // unless every hero has fallen; each waits for OK, then revive mode is read out.
        this.cheatSaid = news.trim();
        const boxes: SurvivalBox[] = [];
        if (news) boxes.push({ kind: 'cheats' });
        if (!sv.allFallen) boxes.push({ kind: 'news' });
        this.showBox(boxes);
        return;
      }
    }
    if (pick) {
      // A locked current hero (it should not happen) falls back to Mario.
      this.index = this.unlocked(
        Math.max(
          0,
          chars.findIndex((c) => c.id === this.game.slotOf(pick.current).id),
        ),
      );
      // The last pick was the Random slot: the cursor starts there again.
      if (this.hasRandom && this.game.pickedRandom) this.index = chars.length;
      const who = this.game.state.character2 ? `Player ${pick.player + 1}, choose` : 'Choose';
      const name = this.sayName(this.index) || pick.current.name;
      this.game.deps.announcer?.say(
        `${who} your hero. ${name}. Left and right to choose,${this.rowsHint()} OK to confirm.` +
          (pick.onMap ? ' Down for return to map.' : '') +
          this.skinHint() +
          this.toFind() +
          this.fallenNote() +
          news,
      );
      return;
    }
    this.index = this.unlocked(this.index);
    this.index2 = this.unlocked(this.index2);
    this.game.deps.announcer?.say(
      `Select your hero. Left and right to choose,${this.rowsHint()} OK to begin.${this.start ? '' : ' Player two: press menu to join.'}` +
        this.skinHint() +
        this.toFind() +
        this.fallenNote() +
        news,
    );
  }

  /** "2 lives left" (CharacterSelectBox: "2 lives remaining"). */
  private livesLeft(): string {
    const n = this.game.state.lives;
    return `${n} ${n === 1 ? 'life' : 'lives'} left`;
  }

  /**
   * Survival: which heroes are lost, by the shorter list: " Fallen: Mario, Link." or
   * " Standing: Luigi." (" Every hero has fallen." with none standing); nothing while none has
   * fallen.
   */
  private fallenNote(): string {
    if (!this.survival) return '';
    const heroes = this.chars.filter((_, i) => !this.locked(i));
    const fallen = heroes.filter((c) => this.survival?.isFallen(c.id));
    const standing = heroes.filter((c) => !fallen.includes(c));
    if (!fallen.length) return '';
    if (!standing.length) return ' Every hero has fallen.';
    const names = (l: CharacterDef[]) => l.map((c) => c.name).join(', ');
    return fallen.length <= standing.length ? ` Fallen: ${names(fallen)}.` : ` Standing: ${names(standing)}.`;
  }

  /** What OK does to slot `i` in revive mode (CharacterSelectBox.changeNameBoxText). */
  private reviveAction(i: number): string {
    if (this.isRandom(i)) return 'Revive or power up';
    return this.fallen(i) ? 'Revive' : 'Power up';
  }

  /** What OK does in revive mode, as the screen says it: REVIVE, or POWER UP on a standing hero. */
  private reviveVerb(i: number): 'revive' | 'power up' {
    return this.isRandom(i) || this.fallen(i) ? 'revive' : 'power up';
  }

  /** DONE (attack) in revive mode: the question; BACK at a new game's select with every hero fallen. */
  private reviveLeave(): string | null {
    if (!this.survival?.allFallen) return 'DONE';
    return this.start ? 'BACK' : null;
  }

  /** Revive mode's spoken instructions. */
  private sayRevive(): void {
    const leave = this.reviveLeave();
    const how = leave === 'DONE' ? ' DONE when finished.' : leave === 'BACK' ? ' BACK to leave.' : '';
    this.game.deps.announcer?.say(
      `Revive your heroes: each costs one life. ${this.livesLeft()}. ${this.slotName(this.index)}: ${this.reviveAction(this.index).toLowerCase()}. ` +
        `Left and right to choose,${this.rowsHint()} OK to ${this.reviveVerb(this.index)}.${how}` +
        this.fallenNote(),
    );
  }

  /** Revive mode ends (out of lives, none left to revive, or DONE): on to the select. */
  private endRevive(): void {
    this._reviving = false;
    this.box = null;
    this.index = this.unlocked(this.index);
    const name = this.slotName(this.index);
    this.game.deps.announcer?.say(
      `Choose your hero. ${name}. Left and right to choose,${this.rowsHint()} OK to confirm.` +
        this.skinHint() +
        this.fallenNote(),
    );
  }

  /** OK in revive mode: CharacterSelectBox.reviveCharacter for the slot under the cursor. */
  private revive(): void {
    const c = this.heroAt(this.index);
    if (!c) return;
    const how = this.game.reviveHero(c);
    // SN_REVIVE_CHARACTER is the power-up sound.
    this.game.ctx.audio.sfx('powerup');
    this.game.deps.announcer?.say(
      `${c.name} ${how === 'revived' ? 'revived' : 'powered up'}. ${this.livesLeft()}.`,
    );
    if (this.game.state.lives < MIN_LIVES_FOR_REVIVAL || this.pickable().length === 0) {
      this.endRevive();
      return;
    }
    // The cursor stays (a revived hero can still be strengthened), or moves on from one now full.
    if (this.skipped(this.index)) this.index = this.unlocked(this.index);
  }

  /** Shows the first of `boxes` (the rest queued) and reads it out; none: revive mode is read out. */
  private showBox(boxes: SurvivalBox[]): void {
    const [box, ...rest] = boxes;
    this.box = box ?? null;
    this.boxQueue = rest;
    if (!box) this.sayRevive();
    else if (box.kind === 'cheats') this.game.deps.announcer?.say(`${this.cheatSaid} OK to go on.`);
    else if (box.kind === 'news')
      this.game.deps.announcer?.say('You can now revive and strengthen heroes. OK to go on.');
  }

  /** The box's input: the news closes on OK; the question toggles with the arrows, OK answers. */
  private updateBox(box: SurvivalBox, pressed: (a: Action) => boolean): void {
    if (this.t <= 10) return;
    if (
      box.kind === 'finished' &&
      (pressed('up') || pressed('down') || pressed('left') || pressed('right'))
    ) {
      box.yes = !box.yes;
      this.game.ctx.audio.sfx('select');
      this.game.deps.announcer?.say(box.yes ? 'Yes' : 'No');
      return;
    }
    if (!(pressed('jump') || pressed('start'))) return;
    this.game.ctx.audio.sfx('select');
    this.box = null;
    if (box.kind === 'finished' && box.yes) this.endRevive();
    else if (box.kind === 'finished') this.sayRevive();
    else this.showBox(this.boxQueue);
  }

  /** Revive mode's input (one player: Classic mode has no co-op). */
  private updateRevive(
    input: InputFrame,
    move: (idx: number, f: InputFrame) => number,
    rowMove: (idx: number, f: InputFrame) => number | null,
  ): void {
    const was = this.index;
    this.index = rowMove(this.index, input) ?? move(this.index, input);
    if (this.index !== was) {
      // Say what OK would do there (the name was just said).
      this.game.deps.announcer?.say(
        `${this.slotName(this.index)}: ${this.reviveAction(this.index).toLowerCase()}`,
      );
    }
    if (this.t > 10 && (input.pressed('jump') || input.pressed('start') || this.tapOk)) {
      this.revive();
      return;
    }
    if (!input.pressed('attack') && !input.pressed('select')) return;
    const leave = this.reviveLeave();
    if (leave === 'DONE') {
      // pressAtkBtn: "Are you finished reviving and strengthening characters?" NO / YES.
      this.box = { kind: 'finished', yes: false };
      this.game.ctx.audio.sfx('select');
      this.game.deps.announcer?.say(
        `Are you finished reviving and strengthening heroes? No. Up and down to choose, OK to answer.`,
      );
    } else if (leave === 'BACK' && this.start) {
      // Every hero still fallen: the run has not begun, so BACK leaves as on any new game's select.
      this.game.ctx.audio.sfx('select');
      this.start.back();
    } else this.game.ctx.audio.sfx('bump');
  }

  /** Touch drives player 1, who can also make player 2's pick (one device sets up both). */
  touchLabels(): TouchLabels {
    if (this.box) return menuTouchLabels(false);
    if (this.picker) return { jump: 'OK', attack: 'BACK', special: null, start: null, select: null };
    if (this._reviving)
      return { jump: 'OK', attack: this.reviveLeave(), special: null, start: null, select: null };
    // The skin picker (FU-8) on the touch Special button.
    const special = this.skinPicker ? 'SKIN' : null;
    if (this.pick?.onMap) return { jump: 'OK', attack: 'MAP', special, start: null, select: null };
    const back = !this.pick || !!this.pick.onCancel;
    return { jump: 'OK', attack: back ? 'BACK' : null, special, start: null, select: null };
  }

  update(input: InputFrame, inputs: InputFrame[] = [input]): void {
    this.t++;
    const chars = this.chars;
    const n = this.total;
    // Left/right step to the next hero that is not locked (wrapping); with every other hero
    // locked the cursor stays put.
    const move = (idx: number, f: InputFrame): number => {
      const d = f.pressed('left') ? n - 1 : f.pressed('right') ? 1 : 0;
      if (!d) return idx;
      let to = (idx + d) % n;
      while (to !== idx && this.skipped(to)) to = (to + d) % n;
      this.game.ctx.audio.sfx(to === idx ? 'bump' : 'select');
      const name = this.sayName(to);
      if (name) this.game.deps.announcer?.say(name);
      return to;
    };
    // Two rows (the Classic extras): Up / Down go to the other row's nearest unlocked hero by
    // column; Up on the first row or Down on the second bumps (Down there is left to RETURN TO
    // MAP when the pick has it). One row: null, nothing changes (today's select).
    const rows = this.rows > 1;
    const starts = this.rowStarts;
    const ROW_NAMES = ['first', 'second', 'third'];
    const rowMove = (idx: number, f: InputFrame): number | null => {
      if (!rows) return null;
      const up = f.pressed('up');
      const down = f.pressed('down');
      if (up === down) return null;
      const row = this.rowOf(idx);
      const to = up ? row - 1 : row + 1;
      if (to < 0 || to >= this.rows) {
        if (down && this.pick?.onMap) return null;
        this.game.ctx.audio.sfx('bump');
        return idx;
      }
      const x = this.slot(idx).x;
      let best = -1;
      let bd = Infinity;
      for (let k = starts[to] as number; k < (starts[to + 1] as number); k++) {
        if (this.skipped(k)) continue;
        const d = Math.abs(this.slot(k).x - x);
        if (d < bd) {
          bd = d;
          best = k;
        }
      }
      if (best < 0) {
        this.game.ctx.audio.sfx('bump');
        return idx;
      }
      this.game.ctx.audio.sfx('select');
      const name = this.sayName(best);
      if (name) this.game.deps.announcer?.say(`${name}, ${ROW_NAMES[to] ?? 'next'} row`);
      return best;
    };
    if (this.box) {
      this.updateBox(this.box, (a) => inputs.some((f) => f.pressed(a)));
      return;
    }
    if (this.picker) {
      this.updatePicker((a) => input.pressed(a));
      return;
    }
    this.takeGridTap();
    if (this._reviving) {
      this.updateRevive(input, move, rowMove);
      return;
    }
    if (this.pick) {
      // Player 2's pick also takes player 1's input, so one device (a phone's touch buttons
      // drive player 1 only) can set up both heroes; player 2's own device works too.
      const own = inputs[this.pick.player] ?? input;
      const frames = [...new Set(this.pick.player === 0 ? [own] : [own, inputs[0] ?? input])];
      const pressed = (a: Action) => frames.some((f) => f.pressed(a));
      const steer = frames.find((f) => f.pressed('left') || f.pressed('right'));
      if (steer) {
        this.index = move(this.index, steer);
        this.onMapRow = false;
      }
      const onMap = this.pick.onMap;
      const vert = this.onMapRow ? undefined : frames.find((f) => f.pressed('up') !== f.pressed('down'));
      const rowTo = vert && !steer ? rowMove(this.index, vert) : null;
      if (rowTo !== null) this.index = rowTo;
      else if (onMap && !this.onMapRow && pressed('down')) {
        this.onMapRow = true;
        this.game.ctx.audio.sfx('select');
        this.game.deps.announcer?.say('Return to map');
      } else if (this.onMapRow && pressed('up')) {
        this.onMapRow = false;
        this.game.ctx.audio.sfx('select');
        const name = this.slotName(this.index);
        if (name) this.game.deps.announcer?.say(name);
      }
      if (pressed('special') && !this.onMapRow && !this.isRandom(this.index)) this.nextSkin(this.index);
      const ok = this.t > 10 && (pressed('start') || pressed('jump') || this.tapOk);
      // Classic mode: a hero with other looks opens the skin menu first (CharacterSkinMenu).
      if (ok && !this.onMapRow && this.opensPicker(this.index)) {
        this.openPicker(this.index);
        return;
      }
      const c = ok && !this.onMapRow ? this.heroAt(this.index) : chars[this.index];
      if (ok && !this.onMapRow) this.game.pickedRandom = this.isRandom(this.index);
      if (onMap && (pressed('select') || pressed('attack') || (ok && this.onMapRow))) {
        this.game.ctx.audio.sfx('select');
        onMap();
      } else if (ok && c) {
        this.game.ctx.audio.sfx(c.pickSfx ?? 'coin');
        // Campaign: the first pick of a hero on the file asks about training first.
        const pick = this.pick;
        if (pick.training !== false && needsTraining(this.game, c))
          askTraining(this.game, c, pick.player, () => pick.onPick(c), pick.music);
        else pick.onPick(c);
      } else if (this.pick.onCancel && (pressed('select') || pressed('attack'))) {
        this.game.ctx.audio.sfx('select');
        this.pick.onCancel();
      }
      return;
    }
    this.index = rowMove(this.index, input) ?? move(this.index, input);
    if (input.pressed('special') && !this.isRandom(this.index)) this.nextSkin(this.index);
    const f2 = inputs[1];
    // Classic mode is one player (no join).
    if (f2 && !this.start) {
      if (!this.p2 && f2.pressed('start')) {
        this.p2 = true;
        this.game.ctx.audio.sfx('1up');
        this.game.deps.announcer?.say('Player two joined.');
      } else if (this.p2) {
        this.index2 = rowMove(this.index2, f2) ?? move(this.index2, f2);
        if (f2.pressed('select')) this.p2 = false;
      }
    }
    if (this.t > 10 && (input.pressed('start') || input.pressed('jump') || this.tapOk)) {
      if (this.opensPicker(this.index)) {
        this.openPicker(this.index);
        return;
      }
      const c = this.heroAt(this.index);
      if (this.start) this.game.pickedRandom = this.isRandom(this.index);
      const c2 = this.p2 ? (chars[this.index2] ?? null) : null;
      if (c) {
        if (c.pickSfx) this.game.ctx.audio.sfx(c.pickSfx);
        if (this.start) this.start.begin(c);
        else this.game.newGame(c, '1-1', c2);
      }
      return;
    }
    if (input.pressed('select') || input.pressed('attack')) {
      if (this.start) this.start.back();
      else this.game.showTitle();
    }
  }

  render(r: Renderer): void {
    if (this.classicLayout) {
      this.renderClassic(r);
      return;
    }
    r.clear('#000');
    const assets = this.game.ctx.assets;
    const font = assets.sheet('font');
    const heading = this._reviving
      ? 'REVIVE YOUR HEROES'
      : this.pick && this.game.state.character2
        ? `P${this.pick.player + 1} SELECT YOUR HERO`
        : 'SELECT YOUR HERO';
    r.text(font, heading, 128 - heading.length * 4, 32);
    const find = this.game.heroesToFind;
    const sv = this.survival;
    if (find > 0) {
      const line = `${find} ${find === 1 ? 'HERO' : 'HEROES'} TO FIND`;
      r.text(font, line, 128 - line.length * 4, 52);
    } else if (sv) {
      // Survival: how many heroes still stand; the fallen are drawn grey.
      const n = this.chars.filter((_, i) => !this.locked(i)).length;
      const line = `${sv.standing().length} OF ${n} HEROES STANDING`;
      // The cheat news takes this place on the select (revive mode shows it in its own box).
      if (this._reviving || !this.cheatNews.length) r.text(font, line, 128 - line.length * 4, 52);
    }
    if (!this._reviving) this.renderCheatNews(r, font);
    // The skin picker's hint (FU-8), named by ability with the real key when not on touch.
    if (this.skinPicker && !this.cheatNews.length && !this.box) {
      const hint = fontText(`${abilityHint(this.game, 'SKIN', 'special')} CHANGES LOOK`);
      r.text(font, hint, 128 - hint.length * 4, 42);
    }
    const chars = this.chars;
    // Rows of heroes move the lines under them down (Layout: lines).
    const L = this.lines;
    chars.forEach((c, i) => {
      const { x, y: feet } = this.slot(i);
      const spacing = this.spacingOf(i);
      const locked = this.locked(i);
      const pt = this.portraitOf(c);
      // Survival's fallen heroes are greyed (CharacterSelectBox.markPortraitFallen: desaturate).
      const fx = locked ? 'silhouette' : this.fallen(i) ? 'fallen' : null;
      const sheet = assets.sheet(pt.sheet, fx ? fxPalette(pt.palette, fx) : pt.palette);
      const f = sheet.frames.get(pt.frame);
      const h = f?.h ?? 32;
      // Centred on its slot (a 16 px hero at x - 8; Sophia III's tank is wider).
      const left = x - ((f?.w ?? 16) >> 1);
      if (locked) {
        // A captive still to be found: a black silhouette with a grey rim (so it reads on the
        // black screen) and ??? for its name.
        const rim = assets.sheet(pt.sheet, fxPalette(pt.palette, 'rim'));
        for (const [dx, dy] of [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ] as const)
          r.sprite(rim, pt.frame, left + dx, feet - h + dy);
        r.text(font, '???', x - 12, feet + 8);
      }
      r.sprite(sheet, pt.frame, left, feet - h);
      // With a full roster the heroes stand close together, so the cursor becomes an underline.
      const tight = spacing < 40;
      if (i === this.index) {
        // While the cursor is on RETURN TO MAP the hero stays named but unmarked.
        if (!this.onMapRow) {
          if (tight) r.rect(x - 8, feet + 2, 16, 2, (this.t >> 3) % 2 === 0 ? '#fcfcfc' : '#f8d878');
          else r.text(font, '>', x - 20, feet - 8 - h / 2);
        }
        // The name of the look chosen for it (FU-8: a skin's own name). Survival's box takes the
        // lines under the heroes while it shows (boxRect).
        const name = this.game.skinFor(c).name;
        if (!this.box) r.text(font, name.toUpperCase(), 128 - (name.length * 8) / 2, L.name);
      }
      if (this.p2 && i === this.index2)
        r.text(font, '2', tight ? x - 4 : x + 12, tight ? feet - h - 10 : feet - 8 - h / 2);
    });
    if (this.hasRandom) {
      // The Random slot (FU-4): our own "?" art, the height of a small hero; it blinks slowly
      // (held still with Reduce flashing).
      const i = chars.length;
      const { x, y: feet } = this.slot(i);
      const items = assets.sheet('items');
      const frame =
        !this.game.ctx.reduceFlashing && (this.t >> 4) % 2 === 1 ? 'select-random-1' : 'select-random-0';
      const h = items.frames.get(frame)?.h ?? 20;
      r.sprite(items, frame, x - 8, feet - h);
      if (i === this.index) {
        if (!this.onMapRow) {
          if (this.spacingOf(i) < 40)
            r.rect(x - 8, feet + 2, 16, 2, (this.t >> 3) % 2 === 0 ? '#fcfcfc' : '#f8d878');
          else r.text(font, '>', x - 20, feet - 8 - h / 2);
        }
        if (!this.box) r.text(font, 'RANDOM', 128 - 24, L.name);
      }
    }
    if (this._reviving) this.renderRevive(r);
    else if (this.pick || sv) {
      // The original's CharacterSelect shows the lives left (numLives / livesTxt).
      r.text(font, `×  ${this.game.state.lives}`, 108, L.under);
    } else if (this.p2) {
      const c2 = chars[this.index2];
      if (c2) r.text(font, `P2: ${c2.name.toUpperCase()}`, 128 - ((c2.name.length + 4) * 8) / 2, L.under);
    } else if (!this.start && (this.t >> 6) % 2 === 1) {
      const join = fontText(`P2 ${abilityHint(this.game, 'MENU', 'start', 1)} TO JOIN`);
      r.text(font, join, 128 - join.length * 4, L.under);
    }
    // Named by ability (OK), with the real key or pad button when not on touch.
    const go = fontText(`PRESS ${abilityHint(this.game, 'OK', 'jump')}`);
    if (!this._reviving && (this.t >> 5) % 2 === 0) r.text(font, go, 128 - go.length * 4, L.press);
    if (this.pick?.onMap) {
      const label = 'RETURN TO MAP';
      const x = 128 - label.length * 4;
      const y = L.map;
      r.text(font, label, x, y);
      if (this.onMapRow) r.text(font, '>', x - 12, y);
    }
  }

  /** The hero shown in the HUD and on the ground: the skin menu's look, else the slot's in its look. */
  private shownHero(): CharacterDef | null {
    if (this.picker) return this.pickerSkin;
    if (this.isRandom(this.index)) return null;
    const c = this.chars[this.index];
    return c ? this.game.skinFor(c) : null;
  }

  /** The portrait frame Classic mode draws for `c` (its Classic art). */
  private artOf(c: CharacterDef): CharacterDef['portrait'] {
    return shownPortrait(heroFor(c, this.game.liveRules));
  }

  /**
   * The name box's three lines (CharacterSelectBox.changeNameBoxText): the look's name in quotes
   * (none for a hero's own look), the hero, its game; revive mode: what OK does, the hero, the
   * lives remaining.
   */
  nameBoxLines(): string[] {
    const i = this.index;
    if (this._reviving) {
      const n = this.game.state.lives;
      const hero = this.isRandom(i) ? 'RANDOM' : fontText(this.chars[i]?.name ?? '');
      return [fontText(this.reviveAction(i)), hero, `${n} ${n === 1 ? 'LIFE' : 'LIVES'} REMAINING`];
    }
    // The skin menu's cursor look, else the slot's in its chosen look.
    const host = this.picker?.host ?? (this.isRandom(i) ? undefined : this.chars[i]);
    if (!host) return ['RANDOM'];
    const look = this.picker ? (this.pickerSkin ?? host) : this.game.skinFor(host);
    // CharNameBox.changeText: a look with a name of its own adds it in quotes on top; a hero's own
    // look (no skin name) has the two lines only, and the box closes up.
    const lines = [fontText(host.name), fontText(skinGame(look))];
    return look === host ? lines : [`"${fontText(look.name)}"`, ...lines];
  }

  /** Classic mode's select, in the original 3.1.21's layout (select-grid.ts). */
  /**
   * The select's look (select-grid.ts SELECT_THEMES): the original's default, SMB NES, until the
   * owner chooses (the original follows the map skin).
   */
  get theme(): SelectTheme {
    return DEFAULT_SELECT_THEME;
  }

  /**
   * The portrait grid's layout (select-grid.ts): SELECT_GRID for this roster; the original's,
   * ORIGINAL_GRID, is a data change with its roster.
   */
  get grid(): GridLayout {
    // The original's two rows of six hold its eleven heroes and Random; a longer list (Options >
    // Expansion heroes, a test's stand-in) uses the wider grid, so it still fits two or three rows.
    return this.total <= ORIGINAL_GRID.cols * 2 ? ORIGINAL_GRID : SELECT_GRID;
  }

  /** The cursor ring's colour now (revive mode's own cycle). */
  private cursorNow(): string {
    const th = this.theme;
    return cursorColour(this._reviving ? th.reviveCursor : th.cursor, this.t, this.game.ctx.reduceFlashing);
  }

  private renderClassic(r: Renderer): void {
    // The next level's sky (the original's select is a level themed like the one ahead).
    r.clear(SKY[this.groundTheme()] ?? '#000000');
    // The level behind: its scenery, ground and the hero standing there, under the boxes (not while
    // Survival's box takes the name box's place over them: boxRect).
    if (!this.box) this.renderClassicGround(r, this.shownHero());
    const assets = this.game.ctx.assets;
    const font = assets.sheet('font');
    const centred = (str: string, y: number) => r.text(font, str, 128 - str.length * 4, y);
    const shown = this.shownHero();
    // The HUD's face: the shown look's drawn face, else its art (doubled there).
    const face = shown ? drawnFace(shown.id) : null;
    drawSelectHud(
      r,
      assets,
      this.game.state,
      shown,
      face ?? (shown ? this.artOf(shown) : null),
      this.theme.hudFrame,
    );
    const pan = gridPanel(this.rows, this.grid);
    const by = pan.y + pan.h + 4;
    if (this.picker) {
      // The skin menu takes the select box's place (CharacterSelectBox opens CharacterSkinMenu
      // instead of itself), so no cell shows behind or under it.
      this.renderPicker(r);
      return;
    }
    // The portrait grid: each hero's face, our standing art doubled (the original's close-ups).
    const th = this.theme;
    drawPanel(r, pan.x, pan.y, pan.w, pan.h, th);
    const cell = this.grid.cell;
    const ring = this.cursorNow();
    for (let i = 0; i < this.total; i++) {
      const at = this.cellOf(i);
      drawCell(r, at.x, at.y, cell, cell, i === this.index ? ring : null, th);
      inCell(r, at.x, at.y, cell, cell, () => {
        if (this.isRandom(i)) {
          // The Random cell: our own "?" (held still with Reduce flashing).
          const items = assets.sheet('items');
          const frame =
            !this.game.ctx.reduceFlashing && (this.t >> 4) % 2 === 1 ? 'select-random-1' : 'select-random-0';
          const f = items.frames.get(frame);
          r.sprite(items, frame, at.x + ((cell - (f?.w ?? 16)) >> 1), at.y + ((cell - (f?.h ?? 20)) >> 1));
          return;
        }
        const c = this.chars[i];
        if (!c) return;
        const look = this.game.skinFor(c);
        // Survival's fallen heroes are greyed (CharacterSelectBox.markPortraitFallen: desaturate).
        const grey = (p: string) => (this.fallen(i) ? fxPalette(p, 'fallen') : p);
        // The look's drawn face (head and shoulders filling the cell), else its art's head doubled.
        const face = drawnFace(look.id);
        if (face) {
          r.sprite(assets.sheet(face.sheet, grey(face.palette)), face.frame, at.x + 1, at.y + 1);
          return;
        }
        const pt = this.artOf(look);
        const f = faceAt(pt.sheet, pt.frame, at.x + 1, at.y + 1, cell - 2, 2, 1);
        r.sprite(assets.sheet(pt.sheet, grey(pt.palette)), pt.frame, f.x, f.y, false, false, 0, 2);
      });
    }
    // The name box under it (Survival's box takes its place while it shows: boxRect).
    if (this.box) {
      this.renderBox(r, this.box);
      return;
    }
    const lines = this.nameBoxLines();
    const boxH = NAME_BOX.h;
    // A new look (or hero) grows its box again.
    const key = lines.join('|');
    if (key !== this.boxFor) {
      this.boxFor = key;
      this.boxT = this.t;
    }
    // The box grows open (MessageBox.resizeBox): three frames wide, then tall, then its lines;
    // instant with Reduce flashing.
    const grow = this.game.ctx.reduceFlashing ? 1 : Math.min(1, (this.t - this.boxT) / BOX_GROW);
    const w = Math.round(NAME_BOX.w * Math.min(1, grow * 2));
    const hNow = grow < 0.5 ? 8 : Math.round(8 + (boxH - 8) * ((grow - 0.5) / 0.5));
    drawPanel(r, 128 - (w >> 1), by + ((boxH - hNow) >> 1), w, hNow, th);
    // The hero's name in the menu font; the look's name and the game in the selected tint.
    // The lines spread over the box as the original's (three, or two centred for a hero's own
    // look), and our one prompt in its bottom row (named by ability, the real key when not on touch).
    const top = lines.length >= 3 ? 12 : 20;
    const step = lines.length >= 3 ? 15 : 16;
    if (grow >= 1) {
      lines.forEach((l, k) =>
        this.outlined(
          r,
          l,
          by + top + k * step,
          l.startsWith('"') || k === lines.length - 1 ? 'tint' : 'name',
        ),
      );
      const ok = abilityHint(this.game, 'OK', 'jump');
      const verb = this.isRandom(this.index) || this.fallen(this.index) ? 'REVIVE' : 'POWER UP';
      const prompt = this._reviving
        ? `${ok} TO ${verb}`
        : this.skinsAt(this.index).length > 1
          ? `${ok} TO CHOOSE A LOOK`
          : `${ok} TO PICK`;
      this.outlined(r, fontText(prompt), by + boxH - 14);
    }
    const py = by + boxH + 4;
    const sv = this.survival;
    if (this._reviving) {
      const leave = this.reviveLeave();
      if (leave)
        centred(
          fontText(
            `${abilityHint(this.game, leave, 'attack')} ${leave === 'DONE' ? 'WHEN FINISHED' : 'TO LEAVE'}`,
          ),
          py,
        );
      if (sv) {
        const n = this.chars.filter((_, i) => !this.locked(i)).length;
        centred(`${sv.standing().length} OF ${n} HEROES STANDING`, py + 10);
      }
    } else {
      if (this.cheatNews.length) {
        const news = [this.cheatNews.length === 1 ? 'CHEAT UNLOCKED!' : 'CHEATS UNLOCKED!'];
        news.push(...this.cheatNews.slice(0, 1).map((n) => n.toUpperCase()));
        news.forEach((l, k) => centred(fontText(l), py + k * 10));
      } else if (sv) {
        const n = this.chars.filter((_, i) => !this.locked(i)).length;
        centred(`${sv.standing().length} OF ${n} HEROES STANDING`, py);
      }
    }
    if ((this.pick || sv) && !this._reviving) r.text(font, `×  ${this.game.state.lives}`, 200, 196);
  }

  /**
   * Text on the select's panels, in the look's font (`name`, or the `tint` of the look and game
   * lines) with its shadow, over a 1 px black outline: the panels' fills are mid colours (white on
   * SMB NES's brick is 4.5:1, on Zelda II's blue 2.9:1), and the outline keeps every letter's edge
   * readable on a phone (black on brick 4.5:1, on blue 7.3:1).
   */
  private outlined(r: Renderer, str: string, y: number, kind: 'name' | 'tint' = 'name'): void {
    const assets = this.game.ctx.assets;
    const th = this.theme;
    const x = 128 - str.length * 4;
    const dark = assets.sheet('font', fxPalette('font', 'silhouette'));
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const)
      r.text(dark, str, x + dx, y + dy);
    r.text(assets.sheet('font', th.shadowFont), str, x + 1, y + 1);
    r.text(assets.sheet('font', kind === 'tint' ? th.tintFont : th.nameFont), str, x, y);
  }

  /**
   * The level the select is for: the one about to be played (Game.selectLevel), whose ground the
   * hero stands on (the original's CharacterSelect is drawn over the level's own ground).
   */
  private groundTheme(): string {
    const id = this.game.selectLevel;
    if (!id) return 'overworld';
    try {
      return this.game.deps.getLevel(id).theme ?? 'overworld';
    } catch {
      return 'overworld';
    }
  }

  /**
   * The next level's scenery and ground, and the hero (or look) standing on it. The original's
   * select is a real level (9-1a: clouds, a hill and bushes over two rows of ground) themed by the
   * level ahead; ours draws the same pieces from that theme's sheets.
   */
  private renderClassicGround(r: Renderer, shown: CharacterDef | null): void {
    const assets = this.game.ctx.assets;
    const theme = this.groundTheme();
    const tiles = assets.sheet('tiles', `tiles-${theme}`);
    // Its scenery: only where the theme has it (underground and castle levels are bare).
    const decor = assets.sheet('decor', decorPalette(theme));
    if (decor.frames.get('hill-big') && (SKY[theme] ?? '#000000') !== '#000000') {
      r.sprite(decor, 'cloud-1', 16, 180);
      r.sprite(decor, 'cloud-2', 92, 186);
      r.sprite(decor, 'hill-big', 164, 176);
      r.sprite(decor, 'bush-1', 40, 192);
      r.sprite(decor, 'bush-1', 208, 192);
    }
    for (let x = 0; x < 256; x += 16) {
      r.sprite(tiles, 'ground', x, 208);
      r.sprite(tiles, 'ground', x, 224);
    }
    if (shown) {
      const pt = this.artOf(shown);
      const sheet = assets.sheet(pt.sheet, pt.palette);
      const f = sheet.frames.get(pt.frame);
      // At the screen's centre, as the original's (CharacterSelect.PLAYER_X_POS); in revive mode,
      // whose prompts run three lines, at the left.
      const cx = this._reviving ? 28 : 128;
      r.sprite(sheet, pt.frame, cx - ((f?.w ?? 16) >> 1), 208 - (f?.h ?? 32));
    }
  }

  /** The skin menu (CharacterSkinMenu): the look's name, a page of looks, its source game. */
  private renderPicker(r: Renderer): void {
    const pk = this.picker;
    if (!pk) return;
    const assets = this.game.ctx.assets;
    const P = skinLayout(pk.list.length);
    const th = this.theme;
    drawPanel(r, P.x, P.y, P.w, P.h, th);
    const skin = pk.list[pk.at];
    this.outlined(r, fontText(skin?.name ?? ''), P.y + 8);
    const per = SKIN_GRID.cols * SKIN_GRID.rows;
    const page = this.pickerPage;
    for (let k = 0; k < per; k++) {
      const look = pk.list[page * per + k];
      if (!look) break;
      const c = skinCell(k, pk.list.length);
      drawCell(r, c.x, c.y, SKIN_GRID.w, SKIN_GRID.h, page * per + k === pk.at ? this.cursorNow() : null, th);
      const pt = this.artOf(look);
      const sheet = assets.sheet(pt.sheet, pt.palette);
      const f = sheet.frames.get(pt.frame);
      // Standing in its cell, feet 2 px above the bottom.
      inCell(r, c.x, c.y, SKIN_GRID.w, SKIN_GRID.h, () =>
        r.sprite(
          sheet,
          pt.frame,
          c.x + ((SKIN_GRID.w - (f?.w ?? 16)) >> 1),
          c.y + SKIN_GRID.h - 2 - (f?.h ?? 32),
        ),
      );
    }
    // More pages: down-arrows in the bottom corners.
    if ((page + 1) * per < pk.list.length) {
      drawDownArrow(r, P.x + 6, P.y + P.h - 10, th);
      drawDownArrow(r, P.x + P.w - 13, P.y + P.h - 10, th);
    }
    this.outlined(r, fontText(skin ? skinGame(skin) : ''), P.y + P.h - 16);
  }

  /**
   * Revive mode's lines (CharacterSelectBox.changeNameBoxText): what OK does under the cursor,
   * then the two steady prompts (no blinking here, whatever Reduce flashing says).
   */
  private renderRevive(r: Renderer): void {
    const L = this.lines;
    const font = this.game.ctx.assets.sheet('font');
    // The lives left, under the count of heroes standing ("2 lives remaining").
    const n = this.game.state.lives;
    const lives = `${n} ${n === 1 ? 'LIFE' : 'LIVES'} LEFT`;
    r.text(font, lives, 128 - lives.length * 4, 66);
    // The box takes the place of the lines under the heroes (boxRect), so no hero is covered.
    if (this.box) return this.renderBox(r, this.box);
    const action = this.reviveAction(this.index).toUpperCase();
    r.text(font, action, 128 - action.length * 4, L.under);
    const goY = L.ok;
    // What OK does under the cursor: a standing hero is powered up instead.
    const verb = this.reviveVerb(this.index).toUpperCase();
    const ok = fontText(`${abilityHint(this.game, 'OK', 'jump')} TO ${verb}`);
    r.text(font, ok, 128 - ok.length * 4, goY);
    const leave = this.reviveLeave();
    if (leave) {
      const line = fontText(
        `${abilityHint(this.game, leave, 'attack')} ${leave === 'DONE' ? 'WHEN FINISHED' : 'TO LEAVE'}`,
      );
      r.text(font, line, 128 - line.length * 4, L.leave);
    }
  }

  /**
   * Where Survival's box goes for `lines` text lines (and its prompt row): under the heroes, from
   * just below the lowest row's feet (and the cursor's underline), so no hero is covered. The
   * lines it covers there (the name, what OK does, DONE) are left out while it shows.
   */
  boxRect(lines: number): { y: number; h: number } {
    const h = (lines + 2) * BOX_LINE + BOX_PAD * 2 - 4;
    const y = Math.min(238 - h, this.heroesBottom() + 6);
    return { y, h };
  }

  /** The lowest row's feet (every slot of a row stands on the same line). */
  heroesBottom(): number {
    // Classic mode's grid: its panel's bottom (a cell's portrait may reach past its cell).
    if (this.classicLayout) {
      const pan = gridPanel(this.rows, this.grid);
      return pan.y + pan.h;
    }
    return this.slot(Math.max(0, this.total - 1)).y;
  }

  /** Survival's box (the revive news, or the "finished?" question with NO and YES). */
  private renderBox(r: Renderer, box: SurvivalBox): void {
    const font = this.game.ctx.assets.sheet('font');
    const names = this.cheatNews.map((n) => n.toUpperCase());
    const lines =
      box.kind === 'cheats'
        ? [
            this.cheatNews.length === 1 ? 'CHEAT UNLOCKED!' : 'CHEATS UNLOCKED!',
            // Two names at most, as under the heading (renderCheatNews); all are read out.
            ...names.slice(0, 2),
            ...(names.length > 2 ? [`AND ${names.length - 2} MORE`] : []),
          ]
        : box.kind === 'news'
          ? REVIVE_NEWS
          : REVIVE_DONE_QUESTION;
    const { y, h } = this.boxRect(lines.length);
    r.rect(16, y, 224, h, '#fcfcfc');
    r.rect(18, y + 2, 220, h - 4, '#000000');
    lines.forEach((l, i) => r.text(font, l, 128 - l.length * 4, y + BOX_PAD + i * BOX_LINE));
    const last = y + BOX_PAD + (lines.length + 1) * BOX_LINE;
    if (box.kind !== 'finished') {
      const ok = fontText(`PRESS ${abilityHint(this.game, 'OK', 'jump')}`);
      r.text(font, ok, 128 - ok.length * 4, last);
    } else {
      r.text(font, 'NO', 84, last);
      r.text(font, 'YES', 148, last);
      r.text(font, '>', box.yes ? 136 : 72, last);
    }
  }

  /** The cheats just unlocked, under the heading: CHEAT UNLOCKED! and the names (two at most). */
  private renderCheatNews(r: Renderer, font: ReturnType<Game['ctx']['assets']['sheet']>): void {
    if (!this.cheatNews.length) return;
    const lines = [this.cheatNews.length === 1 ? 'CHEAT UNLOCKED!' : 'CHEATS UNLOCKED!'];
    const names = this.cheatNews.map((n) => n.toUpperCase());
    lines.push(...names.slice(0, 2));
    if (names.length > 2) lines.push(`AND ${names.length - 2} MORE`);
    lines.forEach((l, i) => r.text(font, l, 128 - l.length * 4, 47 + i * 10));
  }
}
