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
}

/**
 * A new game's select screen (no HeroPick) started somewhere other than the custom levels: Classic
 * mode's (title > CLASSIC). `begin` starts the run with the picked heroes; `back` leaves.
 */
export interface NewGamePick {
  /** Starts the run (one player: Classic mode has no co-op, so player two cannot join). */
  begin: (c: CharacterDef) => void;
  back: () => void;
}

/** The second row of heroes (heroes past the first row's) sits this far below the first. */
export const SECOND_ROW_DY = 40;

export class CharacterSelectScene implements Scene {
  private index = 0;
  private index2 = 1;
  private p2 = false;
  private t = 0;
  /** The cursor is on RETURN TO MAP rather than the hero row. */
  private onMapRow = false;
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

  /** Where hero `i` stands: its slot's centre x and its feet y. */
  slot(i: number): { x: number; y: number } {
    const n = this.chars.length;
    const first = this.firstRow;
    const row = i < first ? 0 : 1;
    const len = row === 0 ? first : n - first;
    const k = row === 0 ? i : i - first;
    const spacing = Math.min(64, 224 / Math.max(1, len));
    const x0 = 128 - ((len - 1) * spacing) / 2;
    return { x: Math.round(x0 + k * spacing), y: 120 + row * SECOND_ROW_DY };
  }

  /** Hero `i` is a brainwashed captive on this campaign file: drawn as a silhouette, skipped. */
  private locked(i: number): boolean {
    const c = this.chars[i];
    return !c || this.game.heroLocked(c);
  }

  /** An unlocked index: `i` itself, else the first hero (Mario), else the first unlocked one. */
  private unlocked(i: number): number {
    if (!this.locked(i)) return i;
    const chars = this.chars;
    const first = chars.indexOf(this.game.firstHero);
    if (first >= 0 && !this.locked(first)) return first;
    return Math.max(
      0,
      chars.findIndex((_, k) => !this.locked(k)),
    );
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
    return this.firstRow < this.chars.length ? ' up and down for the other row,' : '';
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
    const ids = this.game.cheatUnlocks.splice(0);
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
    if (pick) {
      // A locked current hero (it should not happen) falls back to Mario.
      this.index = this.unlocked(
        Math.max(
          0,
          chars.findIndex((c) => c.id === pick.current.id),
        ),
      );
      const who = this.game.state.character2 ? `Player ${pick.player + 1}, choose` : 'Choose';
      const name = chars[this.index]?.name ?? pick.current.name;
      this.game.deps.announcer?.say(
        `${who} your hero. ${name}. Left and right to choose,${this.rowsHint()} OK to confirm.` +
          (pick.onMap ? ' Down for return to map.' : '') +
          this.toFind() +
          news,
      );
      return;
    }
    this.index = this.unlocked(this.index);
    this.index2 = this.unlocked(this.index2);
    this.game.deps.announcer?.say(
      `Select your hero. Left and right to choose,${this.rowsHint()} OK to begin.${this.start ? '' : ' Player two: press menu to join.'}` +
        this.toFind() +
        news,
    );
  }

  /** Touch drives player 1, who can also make player 2's pick (one device sets up both). */
  touchLabels(): TouchLabels {
    if (this.pick?.onMap) return { jump: 'OK', attack: 'MAP', special: null, start: null, select: null };
    const back = !this.pick || !!this.pick.onCancel;
    return { jump: 'OK', attack: back ? 'BACK' : null, special: null, start: null, select: null };
  }

  update(input: InputFrame, inputs: InputFrame[] = [input]): void {
    this.t++;
    const chars = this.chars;
    const n = chars.length;
    // Left/right step to the next hero that is not locked (wrapping); with every other hero
    // locked the cursor stays put.
    const move = (idx: number, f: InputFrame): number => {
      const d = f.pressed('left') ? n - 1 : f.pressed('right') ? 1 : 0;
      if (!d) return idx;
      let to = (idx + d) % n;
      while (to !== idx && this.locked(to)) to = (to + d) % n;
      this.game.ctx.audio.sfx(to === idx ? 'bump' : 'select');
      const c = chars[to];
      if (c) this.game.deps.announcer?.say(c.name);
      return to;
    };
    // Two rows (the Classic extras): Up / Down go to the other row's nearest unlocked hero by
    // column; Up on the first row or Down on the second bumps (Down there is left to RETURN TO
    // MAP when the pick has it). One row: null, nothing changes (today's select).
    const rows = this.firstRow < n;
    const rowMove = (idx: number, f: InputFrame): number | null => {
      if (!rows) return null;
      const up = f.pressed('up');
      const down = f.pressed('down');
      if (up === down) return null;
      const first = this.firstRow;
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
        if (this.locked(k)) continue;
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
      const c = chars[best];
      if (c) this.game.deps.announcer?.say(`${c.name}, ${to === 0 ? 'first' : 'second'} row`);
      return best;
    };
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
        const h = chars[this.index];
        if (h) this.game.deps.announcer?.say(h.name);
      }
      const c = chars[this.index];
      const ok = this.t > 10 && (pressed('start') || pressed('jump'));
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
      const c = chars[this.index];
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
    const heading =
      this.pick && this.game.state.character2
        ? `P${this.pick.player + 1} SELECT YOUR HERO`
        : 'SELECT YOUR HERO';
    r.text(font, heading, 128 - heading.length * 4, 32);
    const find = this.game.heroesToFind;
    if (find > 0) {
      const line = `${find} ${find === 1 ? 'HERO' : 'HEROES'} TO FIND`;
      r.text(font, line, 128 - line.length * 4, 52);
    }
    this.renderCheatNews(r, font);
    const chars = this.chars;
    const first = this.firstRow;
    // A second row of heroes moves the lines under the heroes down by its height.
    const below = first < chars.length ? SECOND_ROW_DY : 0;
    chars.forEach((c, i) => {
      const { x, y: feet } = this.slot(i);
      const row = i < first ? first : chars.length - first;
      const spacing = Math.min(64, 224 / Math.max(1, row));
      const locked = this.locked(i);
      const pt = this.portraitOf(c);
      const sheet = assets.sheet(pt.sheet, locked ? fxPalette(pt.palette, 'silhouette') : pt.palette);
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
    // With a second row the lines below close up a little so everything fits the screen.
    const low = below ? below - 2 : 0;
    if (this.pick) {
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
    if ((this.t >> 5) % 2 === 0) r.text(font, go, 128 - go.length * 4, goY);
    if (this.pick?.onMap) {
      const label = 'RETURN TO MAP';
      const x = 128 - label.length * 4;
      const y = below ? 224 : 204;
      r.text(font, label, x, y);
      if (this.onMapRow) r.text(font, '>', x - 12, y);
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
