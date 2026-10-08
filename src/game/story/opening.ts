import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { TouchLabels } from '@engine/input/touch';
import type { Action } from '@engine/input/actions';
import { SCREEN_H, SCREEN_W } from '@engine/viewport';
import { FONT_COLOURS } from '@content/sprites/font';
import type { Game } from '@game/scenes/game';
import { Player } from '@game/entities/player';
import { CARD_GUARD_FRAMES } from '@game/scenes/message';
import { abilityHint } from '@game/scenes/hints';
import { NO_TOUCH_BUTTONS } from '@game/touch-labels';
import { fontText } from '@game/hud/text';
import { beat, storyOn } from './beats';
import { pageSaid } from './cards';
import { OPENING_CAPTION, OPENING_TOAD_PAGES, PEACH_NOTE, type Page } from './script';

/*
 * A new file's opening (docs/STORY.md 2.1; campaign, once per file, before the World 1 map shows
 * for the first time): Peach's castle at dawn, its courtyard in SMB tiles. Mario stands in the
 * courtyard; Toad runs out of the castle door waving a sheet of paper and stops beside him. The
 * caption shows in the box at the top; then the screen dims and Peach's note fills the middle of
 * it, on a tilted parchment with torn edges and a wax seal, in brown ink that looks handwritten
 * (the bitmap font, each letter nudged up or down a pixel in a fixed pattern), written out a line
 * at a time. Back in the courtyard Toad's two pages; then the two run off to the right and the
 * screen fades to the map.
 *
 * No text moves on by itself. OK turns a page (on the note: shows the rest at once, then closes
 * it); BACK skips the rest of the opening. The walks and fades are animations on timers.
 */

export const OPENING_TIMING = {
  /** Toad comes out of the door, runs to Mario, and the caption shows. */
  toadOut: 40,
  captionAt: 112,
  /** Frames the screen takes to dim for the note, and per line written. */
  dim: 20,
  lineFrames: 14,
  /** The run off to the right, and the fade to black. */
  leave: 70,
  fade: 30,
} as const;
const T = OPENING_TIMING;

type Phase = 'court' | 'caption' | 'note' | 'toad' | 'leave' | 'done';

const OK_KEYS: readonly Action[] = ['jump', 'start'];
const BACK_KEYS: readonly Action[] = ['attack'];
const pressed = (inputs: readonly InputFrame[], keys: readonly Action[]) =>
  inputs.some((i) => keys.some((k) => i.pressed(k)));

/** The courtyard's ground line, the castle's place (castle-big: 144x176), its door. */
const GROUND_Y = 208;
const CASTLE_X = 104;
const CASTLE_Y = GROUND_Y - 176;
const DOOR_X = CASTLE_X + 64;
const MARIO_X = 56;
const TOAD_STOP = MARIO_X + 22;

/** The parchment: its box, and where the first line of the note is written. */
export const PARCHMENT = { x: 12, y: 18, w: 232, h: 206 } as const;
const NOTE_X = 24;
const NOTE_Y = 34;
const NOTE_LINE_H = 11;

/**
 * The note's fixed "handwriting": each letter's nudge up or down (in pixels) by line and column,
 * the same every frame so the text never shimmers.
 */
export function inkNudge(line: number, col: number): number {
  const n = (line * 7 + col * 13 + ((line * col) % 5)) % 6;
  return n === 0 ? -1 : n === 3 ? 1 : 0;
}

/**
 * How far (px) the parchment's row at screen y is moved right: a tilt of about a degree and a
 * half, the top a little left of the bottom.
 */
export function tiltAt(y: number): number {
  return Math.round((y - PARCHMENT.y) * 0.026);
}

/** What the announcer reads for the note: the whole letter, then what to press. */
export function noteSaid(): string {
  return `Peach's note: ${pageSaid(
    PEACH_NOTE.map((l) => l.trim()),
    true,
  )}`;
}

export class OpeningScene implements Scene {
  private phase: Phase = 'court';
  private t = 0;
  private pt = 0;
  private page = 0;
  private toadX = DOOR_X;
  private marioX = MARIO_X;
  private readonly mario: Player | null;

  constructor(
    private readonly game: Game,
    private readonly next: () => void,
  ) {
    const def = game.deps.characters.find((c) => c.id === 'mario');
    this.mario = def ? new Player(0, 0, def, 'small', 0) : null;
    if (this.mario) {
      this.mario.facing = 1;
      this.mario.body.onGround = true;
    }
  }

  get stage(): Phase {
    return this.phase;
  }

  /** The page in the box at the top now (the caption, Toad's pages), or null. */
  get lines(): Page | null {
    if (this.phase === 'caption') return OPENING_CAPTION;
    if (this.phase === 'toad') return OPENING_TOAD_PAGES[this.page] ?? null;
    return null;
  }

  /** Lines of the note written so far (all of them once it is finished). */
  get noteLines(): number {
    if (this.phase !== 'note') return 0;
    return Math.min(PEACH_NOTE.length, Math.max(0, Math.floor((this.pt - T.dim) / T.lineFrames) + 1));
  }

  /** The note is fully written (the next OK closes it). */
  get noteDone(): boolean {
    return this.noteLines >= PEACH_NOTE.length;
  }

  enter(): void {
    this.game.ctx.audio.playMusic('opening');
    this.game.deps.announcer?.say(
      "Peach's castle at dawn. Mario stands in the courtyard. Toad runs out of the castle waving a sheet of paper.",
    );
  }

  touchLabels(): TouchLabels {
    if (this.phase === 'leave' || this.phase === 'done') return NO_TOUCH_BUTTONS;
    if (this.pt <= CARD_GUARD_FRAMES) return NO_TOUCH_BUTTONS;
    return { ...NO_TOUCH_BUTTONS, jump: this.phase === 'court' ? 'SKIP' : 'OK', attack: 'BACK' };
  }

  private go(phase: Phase): void {
    this.phase = phase;
    this.pt = 0;
  }

  private say(page: Page, last: boolean): void {
    this.game.deps.announcer?.say(pageSaid(page, last));
  }

  private showToad(i: number): void {
    this.page = i;
    this.go('toad');
    this.say(OPENING_TOAD_PAGES[i] as Page, i === OPENING_TOAD_PAGES.length - 1);
  }

  update(_input: InputFrame, inputs: InputFrame[]): void {
    if (this.phase === 'done') return;
    this.t++;
    this.pt++;
    const guarded = this.pt > CARD_GUARD_FRAMES;
    const back = guarded && pressed(inputs, BACK_KEYS);
    const ok = guarded && pressed(inputs, OK_KEYS);
    if (back && this.phase !== 'leave') return this.go('leave');
    switch (this.phase) {
      case 'court':
        if (this.t >= T.toadOut) this.toadX = Math.max(TOAD_STOP, this.toadX - 2);
        if (this.t >= T.captionAt || ok) {
          this.toadX = TOAD_STOP;
          this.go('caption');
          this.say(OPENING_CAPTION, false);
        }
        return;
      case 'caption':
        if (!ok) return;
        this.go('note');
        this.game.ctx.audio.sfx('pause');
        this.game.deps.announcer?.say(noteSaid());
        return;
      case 'note':
        if (!ok) return;
        // The first OK writes the rest at once; the next closes the note.
        if (!this.noteDone) this.pt = T.dim + PEACH_NOTE.length * T.lineFrames;
        else this.showToad(0);
        return;
      case 'toad':
        if (!ok) return;
        if (this.page < OPENING_TOAD_PAGES.length - 1) this.showToad(this.page + 1);
        else this.go('leave');
        return;
      case 'leave':
        this.toadX += 3;
        this.marioX += 2;
        if (this.mario) {
          this.mario.anim = 'walk';
          if (this.pt % 4 === 0) this.mario.walkFrame = (this.mario.walkFrame + 1) % 3;
        }
        if (this.pt >= T.leave + T.fade) {
          this.phase = 'done';
          this.next();
        }
        return;
      default:
    }
  }

  /* ---------- drawing ---------- */

  render(r: Renderer): void {
    this.drawCourtyard(r);
    if (this.phase === 'note') this.drawNote(r);
    const lines = this.lines;
    if (lines) this.drawBox(r, lines);
    if (this.phase === 'leave' && this.pt > T.leave) {
      const k = Math.min(1, (this.pt - T.leave) / T.fade);
      r.rect(0, 0, SCREEN_W, SCREEN_H, `rgba(0,0,0,${k.toFixed(3)})`);
    }
  }

  /** Dawn over Peach's castle: a pale sky in bands, the castle with its flag, the courtyard. */
  private drawCourtyard(r: Renderer): void {
    const assets = this.game.ctx.assets;
    // A pale dawn sky: blue high up, warming to a peach glow at the horizon.
    const bands = ['#88b0f8', '#a0c0f8', '#b8d0f8', '#d0d8f0', '#f0d8c8', '#f8d0a8'];
    const bh = Math.ceil(GROUND_Y / bands.length);
    bands.forEach((c, i) => r.rect(0, i * bh, SCREEN_W, bh, c));
    const decor = assets.sheet('decor');
    r.sprite(decor, 'cloud-1', 18, 40);
    r.sprite(decor, 'cloud-2', 196, 64);
    r.sprite(decor, 'hill-big', -24, GROUND_Y - 35);
    // The flag over the top tower (the princess's pink pennant on a white pole).
    const poleX = CASTLE_X + 71;
    r.rect(poleX, CASTLE_Y - 22, 2, 22, '#fcfcfc');
    r.rect(poleX - 1, CASTLE_Y - 25, 4, 3, '#f8d878');
    const wave = this.t >> 4;
    for (let i = 0; i < 6; i++)
      r.rect(poleX + 2, CASTLE_Y - 21 + i, 10 - i * 2 + ((wave + i) & 1), 1, i < 3 ? '#f878f8' : '#d800cc');
    r.sprite(decor, 'castle-big', CASTLE_X, CASTLE_Y);
    r.sprite(decor, 'bush-1', 8, GROUND_Y - 16);
    r.sprite(decor, 'bush-2', 216, GROUND_Y - 16);
    const tiles = assets.sheet('tiles', 'tiles-overworld');
    for (let x = 0; x < SCREEN_W; x += 16) {
      r.sprite(tiles, 'ground', x, GROUND_Y);
      r.sprite(tiles, 'ground', x, GROUND_Y + 16);
    }
    // Mario, then Toad (out of the door once he comes, waving the note as he runs).
    if (this.mario && this.marioX < SCREEN_W + 16) {
      const s = this.mario.def.sprite(this.mario, this.t, this.game.ctx.reduceFlashing);
      const sheet = assets.sheet(s.sheet, s.palette);
      const h = sheet.frames.get(s.frame)?.h ?? 16;
      r.sprite(sheet, s.frame, Math.round(this.marioX), GROUND_Y - h, s.flip);
    }
    if (this.phase === 'court' && this.t < T.toadOut) return;
    if (this.toadX >= SCREEN_W + 16) return;
    const running = (this.phase === 'court' && this.toadX > TOAD_STOP) || this.phase === 'leave';
    const hop = running && ((this.t >> 2) & 1) === 1 ? -2 : 0;
    const tx = Math.round(this.toadX);
    // Facing left (toward Mario) as he comes, right as they leave.
    const facingLeft = this.phase !== 'leave';
    r.sprite(assets.sheet('items'), 'toad', tx, GROUND_Y - 24 + hop, facingLeft);
    if (this.phase === 'court' || this.phase === 'caption') {
      const wave2 = running ? (this.t >> 3) & 1 : 0;
      r.sprite(
        assets.sheet('story'),
        'note-sheet',
        facingLeft ? tx - 6 : tx + 14,
        GROUND_Y - 30 + hop - wave2 * 2,
      );
    }
  }

  /** The dimmed screen and the parchment with the note being penned on it. */
  private drawNote(r: Renderer): void {
    const k = Math.min(1, this.pt / T.dim);
    r.rect(0, 0, SCREEN_W, SCREEN_H, `rgba(0,0,0,${(0.6 * k).toFixed(3)})`);
    if (k < 1) return;
    const { x, y, w, h } = PARCHMENT;
    // Row by row (2 px strips) so the sheet leans; the torn edges are a fixed ragged pattern.
    for (let sy = 0; sy < h; sy += 2) {
      const yy = y + sy;
      const dx = tiltAt(yy);
      const tearL = (sy * 7) % 5 === 0 ? 2 : (sy * 3) % 7 === 0 ? 1 : 0;
      const tearR = (sy * 11) % 6 === 0 ? 2 : (sy * 5) % 9 === 0 ? 1 : 0;
      const top = sy < 4 || sy >= h - 4;
      const left = x + dx + tearL;
      const width = w - tearL - tearR;
      r.rect(left, yy, width, 2, top ? '#c89858' : '#f8e8c0');
      r.rect(left, yy, 3, 2, '#c89858');
      r.rect(left + width - 3, yy, 3, 2, '#c89858');
      if (!top) r.rect(left + 3, yy, 2, 2, '#e8d0a0');
    }
    const assets = this.game.ctx.assets;
    const ink = assets.sheet('font', FONT_COLOURS.ink);
    const shown = this.noteLines;
    const writing = this.noteDone ? -1 : shown - 1;
    PEACH_NOTE.slice(0, shown).forEach((line, i) => {
      const ly = NOTE_Y + i * NOTE_LINE_H;
      // The line being penned shows its letters one by one.
      const since = this.pt - T.dim - i * T.lineFrames;
      const chars =
        i === writing
          ? Math.min(line.length, Math.max(0, Math.round((since / T.lineFrames) * line.length * 1.4)))
          : line.length;
      for (let c = 0; c < chars; c++) {
        const ch = line[c] as string;
        if (ch === ' ') continue;
        r.text(ink, ch, NOTE_X + tiltAt(ly) + c * 8, ly + inkNudge(i, c));
      }
    });
    // The wax seal at the foot, once the note is written.
    if (this.noteDone) {
      const sy = y + h - 26;
      r.sprite(assets.sheet('story'), 'wax-seal', x + (w >> 1) - 6 + tiltAt(sy), sy);
      const font = assets.sheet('font');
      const prompt = fontText(abilityHint(this.game, 'OK', 'jump'));
      if (this.pt > CARD_GUARD_FRAMES) {
        r.rect(SCREEN_W - 22 - prompt.length * 8, SCREEN_H - 14, prompt.length * 8 + 4, 11, '#000');
        r.text(font, prompt, SCREEN_W - 20 - prompt.length * 8, SCREEN_H - 12);
      }
    }
  }

  private drawBox(r: Renderer, lines: Page): void {
    const font = this.game.ctx.assets.sheet('font');
    const prompt = fontText(abilityHint(this.game, 'OK', 'jump'));
    const y = 16;
    const h = (lines.length + 1) * 10 + 12;
    r.rect(12, y, SCREEN_W - 24, h, '#fcfcfc');
    r.rect(14, y + 2, SCREEN_W - 28, h - 4, '#000');
    lines.forEach((l, i) => r.text(font, l, (SCREEN_W - l.length * 8) >> 1, y + 7 + i * 10));
    if (this.pt > CARD_GUARD_FRAMES)
      r.text(font, prompt, SCREEN_W - 20 - prompt.length * 8, y + 7 + lines.length * 10);
  }
}

/**
 * Game.openFile for a file just created (Game.startNewFile): the opening plays first, once per
 * file, in the campaign's story, then `then` (the map). False when it does not play.
 */
export function playOpening(game: Game, then: () => void): boolean {
  if (!storyOn(game) || game.seen(beat.opening)) return false;
  game.markSeen(beat.opening);
  game.scenes.clear();
  game.scenes.push(new OpeningScene(game, then));
  return true;
}
