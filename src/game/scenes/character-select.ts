import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { CharacterDef } from '../characters/character';
import type { Game } from './game';

/**
 * One player picks a hero mid-run: after a death with lives left, or after a continue. The
 * original goes through CharacterSelect every time a level is (re)loaded with newLev set
 * (ScreenManager.createLevel), with no way back to the title.
 */
export interface HeroPick {
  /** Which player picks (0 = player 1); the other player's hero is kept. */
  player: number;
  /** Hero highlighted on entry (the one that just died). */
  current: CharacterDef;
  onPick: (c: CharacterDef) => void;
  /** Back (B/Select), e.g. to the world map; without it there is no way back. */
  onCancel?: () => void;
}

/** New-game mode hooks (file select): the chosen heroes go back to the caller instead of `newGame`. */
export interface NewGameHooks {
  onStart: (c: CharacterDef, c2: CharacterDef | null) => void;
  /** Back (B/Select); defaults to the title. */
  onBack?: () => void;
}

export class CharacterSelectScene implements Scene {
  private index = 0;
  private index2 = 1;
  private p2 = false;
  private t = 0;
  constructor(
    private readonly game: Game,
    private readonly pick: HeroPick | null = null,
    private readonly hooks: NewGameHooks | null = null,
  ) {}

  enter(): void {
    const pick = this.pick;
    if (pick) {
      this.index = Math.max(
        0,
        this.game.deps.characters.findIndex((c) => c.id === pick.current.id),
      );
      const who = this.game.state.character2 ? `Player ${pick.player + 1}, choose` : 'Choose';
      this.game.deps.announcer?.say(
        `${who} your hero. ${pick.current.name}. Left and right to choose, start to confirm.`,
      );
      return;
    }
    this.game.deps.announcer?.say(
      'Select your hero. Left and right to choose, start to begin. Player two: press start to join.',
    );
  }

  update(input: InputFrame, inputs: InputFrame[] = [input]): void {
    this.t++;
    const chars = this.game.deps.characters;
    const n = chars.length;
    const move = (idx: number, f: InputFrame): number => {
      if (f.pressed('left')) {
        this.game.ctx.audio.sfx('select');
        const c = chars[(idx + n - 1) % n];
        if (c) this.game.deps.announcer?.say(c.name);
        return (idx + n - 1) % n;
      }
      if (f.pressed('right')) {
        this.game.ctx.audio.sfx('select');
        const c = chars[(idx + 1) % n];
        if (c) this.game.deps.announcer?.say(c.name);
        return (idx + 1) % n;
      }
      return idx;
    };
    if (this.pick) {
      const f = inputs[this.pick.player] ?? input;
      this.index = move(this.index, f);
      const c = chars[this.index];
      if (this.t > 10 && c && (f.pressed('start') || f.pressed('jump'))) {
        this.game.ctx.audio.sfx('coin');
        this.pick.onPick(c);
      } else if (this.pick.onCancel && (f.pressed('select') || f.pressed('attack'))) {
        this.game.ctx.audio.sfx('select');
        this.pick.onCancel();
      }
      return;
    }
    this.index = move(this.index, input);
    const f2 = inputs[1];
    if (f2) {
      if (!this.p2 && f2.pressed('start')) {
        this.p2 = true;
        this.game.ctx.audio.sfx('1up');
        this.game.deps.announcer?.say('Player two joined.');
      } else if (this.p2) {
        this.index2 = move(this.index2, f2);
        if (f2.pressed('select')) this.p2 = false;
      }
    }
    if (this.t > 10 && (input.pressed('start') || input.pressed('jump'))) {
      const c = chars[this.index];
      const c2 = this.p2 ? chars[this.index2] : null;
      if (c && this.hooks) this.hooks.onStart(c, c2 ?? null);
      else if (c) this.game.newGame(c, '1-1', c2 ?? null);
      return;
    }
    if (input.pressed('select') || input.pressed('attack')) {
      if (this.hooks?.onBack) this.hooks.onBack();
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
    const chars = this.game.deps.characters;
    const spacing = Math.min(64, 224 / Math.max(1, chars.length));
    const x0 = 128 - ((chars.length - 1) * spacing) / 2;
    chars.forEach((c, i) => {
      const x = Math.round(x0 + i * spacing);
      const sheet = assets.sheet(c.portrait.sheet, c.portrait.palette);
      const f = sheet.frames.get(c.portrait.frame);
      const h = f?.h ?? 32;
      r.sprite(sheet, c.portrait.frame, x - 8, 120 - h);
      // With a full roster the heroes stand close together, so the cursor becomes an underline.
      const tight = spacing < 40;
      if (i === this.index) {
        if (tight) r.rect(x - 8, 122, 16, 2, (this.t >> 3) % 2 === 0 ? '#fcfcfc' : '#f8d878');
        else r.text(font, '>', x - 20, 112 - h / 2);
        r.text(font, c.name.toUpperCase(), 128 - (c.name.length * 8) / 2, 144);
      }
      if (this.p2 && i === this.index2)
        r.text(font, '2', tight ? x - 4 : x + 12, tight ? 120 - h - 10 : 112 - h / 2);
    });
    if (this.pick) {
      // The original's CharacterSelect shows the lives left (numLives / livesTxt).
      r.text(font, `×  ${this.game.state.lives}`, 108, 158);
    } else if (this.p2) {
      const c2 = chars[this.index2];
      if (c2) r.text(font, `P2: ${c2.name.toUpperCase()}`, 128 - ((c2.name.length + 4) * 8) / 2, 158);
    } else if ((this.t >> 6) % 2 === 1) r.text(font, 'P2 PRESS START TO JOIN', 40, 158);
    if ((this.t >> 5) % 2 === 0) r.text(font, 'PRESS START', 84, 184);
  }
}
