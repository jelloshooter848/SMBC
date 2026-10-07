import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { TouchLabels } from '@engine/input/touch';
import { SCREEN_W } from '@engine/viewport';
import { MAX_ETANKS, MAX_HP } from '../../characters/megaman';
import { RUSH, WEAPON_ENERGY, WEAPONS } from '../../characters/megaman/weapons';
import type { Game } from '../../scenes/game';
import { abilityHint } from '../../scenes/hints';
import { NO_TOUCH_BUTTONS } from '../../touch-labels';
import { BAR_SEGMENTS, LIFE_COLOUR } from './hud';

/*
 * Station Escape's weapon screen, as Mega Man 2's START screen: the weapons Mega Man has in this
 * round, each with its energy bar (P, the Mega Buster, shows his life, as in Mega Man 2), the
 * E-tanks (choosing them fills his life), his lives, and a row for the round's menu (Continue /
 * Give up). Up and down choose (it wraps), OK or MENU on a weapon equips it and play goes on.
 * Layout and colours are from memory of the NES screen; the art is plain boxes and text.
 */

/** What the screen needs from the round (StationScene). */
export interface WeaponScreenHost {
  readonly player: {
    hp: number;
    scratch: Record<string, number | undefined>;
  };
  /** Lives left (the one in play counted). */
  readonly livesLeft: number;
  /** The round's own menu (Continue / Give up, the dev assists). */
  openOptions(): void;
  /** The tools Mega Man carries now (the buster first), as his CharacterDef lists them. */
  tools(): readonly { id: string }[];
}

export type WeaponRow =
  { kind: 'weapon'; tool: number; id: string; label: string } | { kind: 'etank' } | { kind: 'options' };

const LABELS: Readonly<Record<string, string>> = { buster: 'P', rush: 'RUSH' };
const NAMES: Readonly<Record<string, string>> = { buster: 'Mega Buster', rush: 'Rush Coil' };

/** The screen's text, art and box sizes (px). */
const PANEL = { x: 24, y: 24, w: SCREEN_W - 48, h: 192 };
const ROW_H = 18;
const BAR_X = 120;

export class StationWeaponScene implements Scene {
  readonly rows: WeaponRow[];
  cursor = 0;
  private t = 0;

  constructor(
    private readonly game: Game,
    private readonly host: WeaponScreenHost,
  ) {
    const tools = host.tools();
    this.rows = [
      ...tools.map((t, i): WeaponRow => {
        const w = WEAPONS.find((x) => x.id === t.id);
        const label = LABELS[t.id] ?? (w ? w.name.toUpperCase() : t.id.toUpperCase());
        return { kind: 'weapon', tool: i, id: t.id, label };
      }),
      { kind: 'etank' },
      { kind: 'options' },
    ];
    const now = host.player.scratch.tool ?? 0;
    this.cursor = Math.max(
      0,
      this.rows.findIndex((r) => r.kind === 'weapon' && r.tool === now % Math.max(1, tools.length)),
    );
  }

  get etanks(): number {
    return this.host.player.scratch.etanks ?? 0;
  }

  enter(): void {
    const audio = this.game.ctx.audio;
    audio.sfx('pause');
    audio.pause();
    this.say(
      `Weapons. ${this.rowSaid(this.rows[this.cursor] as WeaponRow)}. Up and down to choose, ${abilityHint(this.game, 'OK', 'jump')} to take it.`,
    );
  }

  exit(): void {
    this.game.ctx.audio.resume();
  }

  private say(text: string): void {
    this.game.deps.announcer?.say(text);
  }

  /** A row as the announcer says it. */
  private rowSaid(r: WeaponRow): string {
    if (r.kind === 'etank') return `E-tanks, ${this.etanks}`;
    if (r.kind === 'options') return 'Menu: continue or give up';
    const w = WEAPONS.find((x) => x.id === r.id);
    const name = NAMES[r.id] ?? w?.name ?? r.id;
    if (r.id === 'buster') return `${name}, life ${this.host.player.hp} of ${MAX_HP}`;
    return `${name}, energy ${this.energy(r.id)} of ${WEAPON_ENERGY}`;
  }

  /** A weapon's energy (the buster: Mega Man's life, as Mega Man 2 shows it under P). */
  energy(id: string): number {
    if (id === 'buster') return this.host.player.hp;
    return this.host.player.scratch[`w${id}`] ?? WEAPON_ENERGY;
  }

  touchLabels(): TouchLabels {
    return { ...NO_TOUCH_BUTTONS, jump: 'OK', start: 'OK' };
  }

  update(input: InputFrame): void {
    this.t++;
    const d = input.pressed('up') ? -1 : input.pressed('down') ? 1 : 0;
    if (d) {
      this.cursor = (this.cursor + d + this.rows.length) % this.rows.length;
      this.game.ctx.audio.sfx('select');
      this.say(this.rowSaid(this.rows[this.cursor] as WeaponRow));
      return;
    }
    if (input.pressed('jump') || input.pressed('start')) this.choose();
  }

  /** OK on the row under the cursor. */
  choose(): void {
    const r = this.rows[this.cursor] as WeaponRow;
    const p = this.host.player;
    if (r.kind === 'options') {
      this.host.openOptions();
      return;
    }
    if (r.kind === 'etank') {
      if (this.etanks <= 0 || p.hp >= MAX_HP) {
        this.game.ctx.audio.sfx('bump');
        return;
      }
      p.scratch.etanks = this.etanks - 1;
      p.hp = MAX_HP;
      this.game.ctx.audio.sfx('powerup');
      this.say(`Life filled. ${this.etanks} E-tanks left.`);
      return;
    }
    p.scratch.tool = r.tool;
    this.game.scenes.pop();
    this.say(`${this.rowSaid(r).split(',')[0]}.`);
  }

  render(r: Renderer): void {
    const font = this.game.ctx.assets.sheet('font');
    // Mega Man 2's screen: a dark blue panel framed in white over black.
    r.clear('#000');
    r.rect(PANEL.x, PANEL.y, PANEL.w, PANEL.h, '#fcfcfc');
    r.rect(PANEL.x + 2, PANEL.y + 2, PANEL.w - 4, PANEL.h - 4, '#0000a8');
    this.rows.forEach((row, i) => {
      const y = PANEL.y + 12 + i * ROW_H;
      const on = i === this.cursor;
      // The chosen row blinks its label (held lit with reduce flashing).
      const shown = !on || this.game.ctx.reduceFlashing || ((this.t >> 3) & 1) === 0;
      if (on) r.text(font, '>', PANEL.x + 10, y);
      if (row.kind === 'weapon') {
        if (shown) r.text(font, row.label, PANEL.x + 22, y);
        const colour =
          row.id === 'buster' ? LIFE_COLOUR : row.id === RUSH.id ? RUSH.colour : weaponColour(row.id);
        const max = row.id === 'buster' ? MAX_HP : WEAPON_ENERGY;
        drawHBar(r, BAR_X, y, this.energy(row.id), max, colour);
      } else if (row.kind === 'etank') {
        if (shown) r.text(font, 'E-TANK', PANEL.x + 22, y);
        r.text(font, `×${this.etanks}`, BAR_X, y);
        for (let k = 0; k < MAX_ETANKS; k++)
          r.rect(BAR_X + 32 + k * 10, y, 8, 8, k < this.etanks ? '#3cbcfc' : '#202020');
      } else if (shown) r.text(font, 'MENU', PANEL.x + 22, y);
    });
    // Lives, at the foot of the panel as on the NES screen.
    const lives = `MEGA MAN ×${this.host.livesLeft}`;
    r.text(font, lives, PANEL.x + PANEL.w - 12 - lives.length * 8, PANEL.y + PANEL.h - 18);
    const hint = `UP/DOWN  ${abilityHint(this.game, 'OK', 'jump')}`;
    r.text(font, hint.length <= 24 ? hint : 'UP/DOWN  OK', PANEL.x + 10, PANEL.y + PANEL.h - 34);
  }
}

function weaponColour(id: string): string {
  return WEAPONS.find((w) => w.id === id)?.colour ?? '#fcfcfc';
}

/** A weapon's energy as Mega Man 2's menu shows it: a row of 28 two-px ticks. */
function drawHBar(r: Renderer, x: number, y: number, value: number, max: number, colour: string): void {
  const lit = Math.round((Math.max(0, Math.min(value, max)) / max) * BAR_SEGMENTS);
  r.rect(x - 1, y - 1, BAR_SEGMENTS * 2 + 2, 10, '#000');
  for (let i = 0; i < BAR_SEGMENTS; i++) {
    r.rect(x + i * 2, y, 1, 8, i < lit ? '#fcfcfc' : '#404040');
    r.rect(x + i * 2 + 1, y, 1, 8, i < lit ? colour : '#202020');
  }
}
