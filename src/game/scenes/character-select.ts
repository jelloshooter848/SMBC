import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import { shownPortrait, type CharacterDef } from '../characters/character';
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
  constructor(
    private readonly game: Game,
    private readonly pick: HeroPick | null = null,
    private readonly start: NewGamePick | null = null,
  ) {}

  /** The heroes to pick from: the run's roster (Game.roster; the Classic extras follow the usual ones). */
  get chars(): readonly CharacterDef[] {
    return this.game.roster;
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

  /** Where slot `i` stands (a hero, or the Random slot): its centre x and its feet y. */
  slot(i: number): { x: number; y: number } {
    const n = this.total;
    const first = this.firstRowSlots;
    const row = i < first ? 0 : 1;
    const len = row === 0 ? first : n - first;
    const k = row === 0 ? i : i - first;
    const spacing = Math.min(64, 224 / Math.max(1, len));
    const x0 = 128 - ((len - 1) * spacing) / 2;
    return { x: Math.round(x0 + k * spacing), y: 120 + row * SECOND_ROW_DY };
  }

  /** Hero `i` is a brainwashed captive on this campaign file: drawn as a silhouette, skipped. */
  private locked(i: number): boolean {
    if (this.isRandom(i)) return false;
    const c = this.chars[i];
    return !c || this.game.heroLocked(c);
  }

  /** What slot `i` is called (spoken): its hero's name, or Random. */
  private slotName(i: number): string {
    return this.isRandom(i) ? 'Random' : (this.chars[i]?.name ?? '');
  }

  /** The hero OK on slot `i` gives: its own, or for the Random slot a random one. */
  private heroAt(i: number): CharacterDef | undefined {
    if (!this.isRandom(i)) return this.chars[i];
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
    if (!c.portraitFor) return shownPortrait(c);
    const s = this.game.state;
    const second = this.pick?.player === 1 && s.character2 !== null;
    const mine = second ? s.character2 : s.character;
    return mine === c ? c.portraitFor(second ? s.kit2 : s.kit) : shownPortrait(c);
  }

  /** With a second row: " up and down for the other row,"; one row: nothing (today's text). */
  private rowsHint(): string {
    return this.firstRowSlots < this.total ? ' up and down for the other row,' : '';
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
        const current = (pick?.current ?? this.game.state.character).id;
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
          chars.findIndex((c) => c.id === pick.current.id),
        ),
      );
      // The last pick was the Random slot: the cursor starts there again.
      if (this.hasRandom && this.game.pickedRandom) this.index = chars.length;
      const who = this.game.state.character2 ? `Player ${pick.player + 1}, choose` : 'Choose';
      const name = this.slotName(this.index) || pick.current.name;
      this.game.deps.announcer?.say(
        `${who} your hero. ${name}. Left and right to choose,${this.rowsHint()} OK to confirm.` +
          (pick.onMap ? ' Down for return to map.' : '') +
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
        `Left and right to choose,${this.rowsHint()} OK to revive.${how}` +
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
    if (this.t > 10 && (input.pressed('jump') || input.pressed('start'))) {
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
    if (this._reviving)
      return { jump: 'OK', attack: this.reviveLeave(), special: null, start: null, select: null };
    if (this.pick?.onMap) return { jump: 'OK', attack: 'MAP', special: null, start: null, select: null };
    const back = !this.pick || !!this.pick.onCancel;
    return { jump: 'OK', attack: back ? 'BACK' : null, special: null, start: null, select: null };
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
      const name = this.slotName(to);
      if (name) this.game.deps.announcer?.say(name);
      return to;
    };
    // Two rows (the Classic extras): Up / Down go to the other row's nearest unlocked hero by
    // column; Up on the first row or Down on the second bumps (Down there is left to RETURN TO
    // MAP when the pick has it). One row: null, nothing changes (today's select).
    const rows = this.firstRowSlots < n;
    const rowMove = (idx: number, f: InputFrame): number | null => {
      if (!rows) return null;
      const up = f.pressed('up');
      const down = f.pressed('down');
      if (up === down) return null;
      const first = this.firstRowSlots;
      const row = idx < first ? 0 : 1;
      const to = up ? 0 : 1;
      if (to === row) {
        if (down && this.pick?.onMap) return null;
        this.game.ctx.audio.sfx('bump');
        return idx;
      }
      const x = this.slot(idx).x;
      let best = -1;
      let bd = Infinity;
      for (let k = to === 0 ? 0 : first; k < (to === 0 ? first : n); k++) {
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
      const name = this.slotName(best);
      if (name) this.game.deps.announcer?.say(`${name}, ${to === 0 ? 'first' : 'second'} row`);
      return best;
    };
    if (this.box) {
      this.updateBox(this.box, (a) => inputs.some((f) => f.pressed(a)));
      return;
    }
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
      const ok = this.t > 10 && (pressed('start') || pressed('jump'));
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
    if (this.t > 10 && (input.pressed('start') || input.pressed('jump'))) {
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
    const chars = this.chars;
    const first = this.firstRowSlots;
    const total = this.total;
    // A second row of heroes moves the lines under the heroes down by its height.
    const below = first < total ? SECOND_ROW_DY : 0;
    const spacingOf = (i: number) => Math.min(64, 224 / Math.max(1, i < first ? first : total - first));
    chars.forEach((c, i) => {
      const { x, y: feet } = this.slot(i);
      const spacing = spacingOf(i);
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
        r.text(font, c.name.toUpperCase(), 128 - (c.name.length * 8) / 2, 144 + below);
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
          if (spacingOf(i) < 40)
            r.rect(x - 8, feet + 2, 16, 2, (this.t >> 3) % 2 === 0 ? '#fcfcfc' : '#f8d878');
          else r.text(font, '>', x - 20, feet - 8 - h / 2);
        }
        r.text(font, 'RANDOM', 128 - 24, 144 + below);
      }
    }
    // With a second row the lines below close up a little so everything fits the screen.
    const low = below ? below - 2 : 0;
    if (this._reviving) this.renderRevive(r, low);
    else if (this.pick || sv) {
      // The original's CharacterSelect shows the lives left (numLives / livesTxt).
      r.text(font, `×  ${this.game.state.lives}`, 108, 158 + low);
    } else if (this.p2) {
      const c2 = chars[this.index2];
      if (c2) r.text(font, `P2: ${c2.name.toUpperCase()}`, 128 - ((c2.name.length + 4) * 8) / 2, 158 + low);
    } else if (!this.start && (this.t >> 6) % 2 === 1) {
      const join = fontText(`P2 ${abilityHint(this.game, 'MENU', 'start', 1)} TO JOIN`);
      r.text(font, join, 128 - join.length * 4, 158 + low);
    }
    // Named by ability (OK), with the real key or pad button when not on touch.
    const go = fontText(`PRESS ${abilityHint(this.game, 'OK', 'jump')}`);
    const goY = below ? 210 : 184;
    if (!this._reviving && (this.t >> 5) % 2 === 0) r.text(font, go, 128 - go.length * 4, goY);
    if (this.pick?.onMap) {
      const label = 'RETURN TO MAP';
      const x = 128 - label.length * 4;
      const y = below ? 224 : 204;
      r.text(font, label, x, y);
      if (this.onMapRow) r.text(font, '>', x - 12, y);
    }
  }

  /**
   * Revive mode's lines (CharacterSelectBox.changeNameBoxText): what OK does under the cursor,
   * then the two steady prompts (no blinking here, whatever Reduce flashing says).
   */
  private renderRevive(r: Renderer, low: number): void {
    const font = this.game.ctx.assets.sheet('font');
    // The lives left, under the count of heroes standing ("2 lives remaining").
    const n = this.game.state.lives;
    const lives = `${n} ${n === 1 ? 'LIFE' : 'LIVES'} LEFT`;
    r.text(font, lives, 128 - lives.length * 4, 66);
    const action = this.reviveAction(this.index).toUpperCase();
    r.text(font, action, 128 - action.length * 4, 158 + low);
    const goY = 170 + low;
    // What OK does under the cursor: a standing hero is powered up instead.
    const verb = this.isRandom(this.index) || this.fallen(this.index) ? 'REVIVE' : 'POWER UP';
    const ok = fontText(`${abilityHint(this.game, 'OK', 'jump')} TO ${verb}`);
    r.text(font, ok, 128 - ok.length * 4, goY);
    const leave = this.reviveLeave();
    if (leave) {
      const line = fontText(
        `${abilityHint(this.game, leave, 'attack')} ${leave === 'DONE' ? 'WHEN FINISHED' : 'TO LEAVE'}`,
      );
      r.text(font, line, 128 - line.length * 4, goY + 12);
    }
    if (this.box) this.renderBox(r, this.box);
  }

  /** Survival's box (the revive news, or the "finished?" question with NO and YES). */
  private renderBox(r: Renderer, box: SurvivalBox): void {
    const font = this.game.ctx.assets.sheet('font');
    const lines =
      box.kind === 'cheats'
        ? [
            this.cheatNews.length === 1 ? 'CHEAT UNLOCKED!' : 'CHEATS UNLOCKED!',
            ...this.cheatNews.map((n) => n.toUpperCase()),
          ]
        : box.kind === 'news'
          ? REVIVE_NEWS
          : REVIVE_DONE_QUESTION;
    const rows = lines.length + 2;
    const h = rows * 12 + 12;
    const y = 120 - (h >> 1);
    r.rect(16, y, 224, h, '#fcfcfc');
    r.rect(18, y + 2, 220, h - 4, '#000000');
    lines.forEach((l, i) => r.text(font, l, 128 - l.length * 4, y + 8 + i * 12));
    const last = y + 8 + (lines.length + 1) * 12;
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
