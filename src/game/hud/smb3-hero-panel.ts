import type { Renderer } from '@engine/gfx/renderer';
import type { AssetRegistry } from '@engine/assets/registry';
import type { GameState } from '../context';
import type { Player } from '../entities/player';
import { isFound } from '../items/flags';
import { drawPlayerTwoStatsOver, pad } from './hud';
import { STATUS_BAR_Y } from './smb3-status';

/*
 * The heroes' own stats on an SMB3 piece (Larry's airship deck and room, the Hammer Bro battle),
 * 0.4.35: inside the status bar, in a framed box over the end-card slots (empty there, never
 * filled), so nothing covers the play: a hero pinned to the deck's left edge was under the SMB1
 * HUD's bars. Player one's hit points on the box's first row (a horizontal Mega Man style bar,
 * Link's hearts, Samus's EN and tanks), the weapon / secondary meter on the second, the tool
 * belt's icon and count with the hero's extra (Mega Man's E-tanks) on the third. Player two's
 * stats stay at the top right of the play (drawPlayerTwoStatsOver), clear of the deck's left edge.
 */

/** The box (screen px): over the three card slots, the bar's frame insets kept. */
export const HERO_PANEL = { x: 180, y: STATUS_BAR_Y + 2, w: 72, h: 28 } as const;
/** Where the box's rows start (x) and their tops: hit points, the meter, the belt. */
const X0 = HERO_PANEL.x + 4;
const ROW1 = STATUS_BAR_Y + 4;
const ROW2 = STATUS_BAR_Y + 13;
const ROW3 = STATUS_BAR_Y + 21;
const WHITE = '#fcfcfc';

/** Player one has stats of their own to show (hit points, a belt, a meter or an extra). */
function hasStats(state: GameState, p: Player): boolean {
  const c = state.character;
  return c.damage.kind === 'hp' || !!c.tools?.(p)?.length || !!c.meter?.(p) || !!c.hudExtra?.(p);
}

/** A Mega Man style bar laid flat: `max` segments of 2 px (a light and a coloured column). */
function flatBar(r: Renderer, x: number, y: number, max: number, filled: number, colour: string): void {
  r.rect(x - 1, y - 1, max * 2 + 2, 6, '#000');
  for (let i = 0; i < max; i++) {
    const on = i < filled;
    r.rect(x + i * 2, y, 1, 4, on ? WHITE : '#404040');
    r.rect(x + i * 2 + 1, y, 1, 4, on ? colour : '#202020');
  }
}

/**
 * Player one's stats in the SMB3 status bar's box (HERO_PANEL), and player two's over the play.
 * Drawn after drawSmb3Status. Nothing for a hero without stats of their own (Mario keeps the
 * empty card slots).
 */
export function drawSmb3HeroStats(
  r: Renderer,
  assets: AssetRegistry,
  state: GameState,
  players: Player[],
): void {
  drawPlayerTwoStatsOver(r, assets, state, players, -16);
  const p = players[0];
  if (!p || !hasStats(state, p)) return;
  const font = assets.sheet('font');
  const text = (s: string, x: number, y: number) => r.text(font, s, x, y);
  const { x, y, w, h } = HERO_PANEL;
  // The box: black over the card slots, SMB3's open-cornered white frame.
  r.rect(x - 2, y - 2, 256 - x + 2, h + 4, '#000');
  r.rect(x + 1, y, w - 2, 1, WHITE);
  r.rect(x + 1, y + h - 1, w - 2, 1, WHITE);
  r.rect(x, y + 1, 1, h - 2, WHITE);
  r.rect(x + w - 1, y + 1, 1, h - 2, WHITE);

  const c = state.character;
  const dmg = c.damage;
  // Row 1: hit points.
  if (dmg.kind === 'hp') {
    if (dmg.hudStyle === 'number') {
      const tanks = c.energyTanks?.(p);
      text(`EN${pad(tanks ? tanks.bar : p.hp, 2)}`, X0, ROW1);
      // NES Metroid's tank boxes after it, filled while the tank holds energy.
      for (let i = 0; i < (tanks?.total ?? 0); i++) {
        r.rect(X0 + 36 + i * 7, ROW1 + 1, 6, 5, WHITE);
        if (i >= (tanks?.full ?? 0)) r.rect(X0 + 37 + i * 7, ROW1 + 2, 4, 3, '#202020');
      }
    } else if (dmg.hudStyle === 'hearts') {
      const full = Math.floor(p.hp / 2);
      const half = p.hp % 2;
      const total = Math.ceil((p.scratch.maxHp ?? dmg.max) / 2);
      let s = '';
      for (let i = 0; i < total; i++) s += i < full ? 'h' : i === full && half ? 'f' : 'e';
      text(s, X0, ROW1);
    } else {
      const max = isFound(p) ? (p.scratch.maxHp ?? dmg.max) : dmg.max;
      flatBar(r, X0, ROW1 + 2, max, p.hp, '#f8d878');
    }
  }
  // Row 2: the weapon / secondary meter.
  const m = c.meter?.(p);
  if (m) {
    const k = Math.max(0, Math.min(m.value, m.max)) / m.max;
    if (dmg.kind === 'hp' && dmg.hudStyle === 'bar')
      flatBar(r, X0, ROW2 + 2, dmg.max, Math.round(k * dmg.max), m.colour);
    else {
      text(m.label, X0, ROW2);
      r.rect(X0 + 10, ROW2 + 1, 34, 5, WHITE);
      r.rect(X0 + 11, ROW2 + 2, 32, 3, '#202020');
      const fill = Math.round(k * 32);
      if (fill > 0) r.rect(X0 + 11, ROW2 + 2, fill, 3, m.colour);
    }
  }
  // Row 3: the tool in hand (icon and count), and the hero's extra at the right (E×2).
  const tools = c.tools?.(p);
  if (tools?.length) {
    const n = tools.length;
    const t = tools[(((p.scratch.tool ?? 0) % n) + n) % n];
    if (t) {
      const sheet = assets.sheet(t.sheet ?? 'items');
      r.sprite(sheet, t.icon, X0, ROW3);
      const iw = sheet.frames?.get(t.icon)?.w ?? 8;
      if (t.count !== null) text(`×${pad(t.count, 2)}`, X0 + 1 + iw, ROW3);
    }
  }
  const extra = c.hudExtra?.(p);
  if (extra) text(extra, x + w - 4 - extra.length * 8, ROW3);
}
