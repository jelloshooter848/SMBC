import type { Renderer } from '@engine/gfx/renderer';
import { worldLabel } from './world-label';
import type { AssetRegistry } from '@engine/assets/registry';
import type { GameState } from '../context';
import type { Player } from '../entities/player';

/** The original's StatManager.SCORE_MAX. */
export const SCORE_MAX = 9999999;

export function pad(n: number, width: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(width, '0');
}

/** SMB1-style two-row HUD across the top of the screen, plus HP for hit-point characters. */
export function drawHud(
  r: Renderer,
  assets: AssetRegistry,
  state: GameState,
  time: number | null,
  frame: number,
  players: Player[],
): void {
  const player = players[0] ?? null;
  const font = assets.sheet('font');
  const name = state.character.hudName.slice(0, 6).padEnd(6);
  r.text(font, name, 24, 8);
  // A 7-digit score (World.addScore caps it at SCORE_MAX). The coin counter sits 16 px after it,
  // as in the original's TopScreenText (SCORE_TXT_PNT, COIN_SYMBOL_PNT).
  r.text(font, pad(state.score, 7), 24, 16);
  r.text(font, `$×${pad(state.coins, 2)}`, 96, 16);
  r.text(font, 'WORLD', 144, 8);
  r.text(font, `${worldLabel(state.world)}-${state.stage}`, 152, 16);
  r.text(font, 'TIME', 200, 8);
  if (time !== null) r.text(font, pad(time, 3), 208, 16);
  const dmg = state.character.damage;
  if (dmg.kind === 'hp' && player) {
    if (dmg.hudStyle === 'number') {
      r.text(font, `EN${pad(player.hp, 2)}`, 24, 24);
    } else if (dmg.hudStyle === 'hearts') {
      const full = Math.floor(player.hp / 2);
      const half = player.hp % 2;
      const total = Math.ceil((player.scratch.maxHp ?? dmg.max) / 2);
      let s = '';
      for (let i = 0; i < total; i++) s += i < full ? 'h' : i === full && half ? 'f' : 'e';
      r.text(font, s, 24, 24);
    } else {
      // Mega Man style vertical bar: 28 segments, 2 px each, at the left edge.
      const x = 8;
      const y0 = 40;
      r.rect(x - 1, y0 - 1, 8, dmg.max * 2 + 2, '#000');
      for (let i = 0; i < dmg.max; i++) {
        const filled = i < player.hp;
        r.rect(x, y0 + (dmg.max - 1 - i) * 2, 6, 1, filled ? '#fcfcfc' : '#404040');
        r.rect(x, y0 + (dmg.max - 1 - i) * 2 + 1, 6, 1, filled ? '#f8d878' : '#202020');
      }
    }
  }
  // Tool belt (icon + ammo) under the coin counter and a secondary meter under the hearts.
  if (player) {
    const tools = state.character.tools?.(player);
    if (tools && tools.length) {
      const n = tools.length;
      const i = (((player.scratch.tool ?? 0) % n) + n) % n;
      const t = tools[i];
      if (t) {
        r.sprite(assets.sheet('items'), t.icon, 96, 24);
        if (t.count !== null) r.text(font, `×${pad(t.count, 2)}`, 105, 24);
      }
    }
    const extra = state.character.hudExtra?.(player);
    if (extra) r.text(font, extra, dmg.kind === 'hp' && dmg.hudStyle === 'number' ? 64 : 24, 24);
    const m = state.character.meter?.(player);
    if (m && dmg.kind === 'hp' && dmg.hudStyle === 'bar') {
      // Weapon energy: a second vertical bar beside the health bar.
      const x = 16;
      const y0 = 40;
      const segs = dmg.max;
      r.rect(x - 1, y0 - 1, 8, segs * 2 + 2, '#000');
      const filled = Math.round((Math.max(0, Math.min(m.value, m.max)) / m.max) * segs);
      for (let i = 0; i < segs; i++) {
        const on = i < filled;
        r.rect(x, y0 + (segs - 1 - i) * 2, 6, 1, on ? '#fcfcfc' : '#404040');
        r.rect(x, y0 + (segs - 1 - i) * 2 + 1, 6, 1, on ? m.colour : '#202020');
      }
    } else if (m) {
      r.text(font, m.label, 24, 33);
      r.rect(32, 34, 34, 5, '#fcfcfc'); // white frame so the bar reads against the sky
      r.rect(33, 35, 32, 3, '#202020');
      const w = Math.round((Math.max(0, Math.min(m.value, m.max)) / m.max) * 32);
      if (w > 0) r.rect(33, 35, w, 3, m.colour);
    }
  }
  // Player two: name under WORLD, hearts or a short bar at the right edge.
  const p2 = players[1];
  if (p2 && state.character2) {
    const d2 = state.character2.damage;
    r.text(font, state.character2.hudName.slice(0, 6), 144, 24);
    if (d2.kind === 'hp' && d2.hudStyle === 'hearts') {
      const full = Math.floor(p2.hp / 2);
      const half = p2.hp % 2;
      const total = Math.ceil((p2.scratch.maxHp ?? d2.max) / 2);
      let s = '';
      for (let i = 0; i < total; i++) s += i < full ? 'h' : i === full && half ? 'f' : 'e';
      r.text(font, s, 144, 32);
    } else if (d2.kind === 'hp' && d2.hudStyle === 'number') {
      r.text(font, `EN${pad(p2.hp, 2)}`, 144, 32);
    } else if (d2.kind === 'hp') {
      const x = 242;
      const y0 = 40;
      r.rect(x - 1, y0 - 1, 8, d2.max * 2 + 2, '#000');
      for (let i = 0; i < d2.max; i++) {
        const filled = i < p2.hp;
        r.rect(x, y0 + (d2.max - 1 - i) * 2, 6, 1, filled ? '#fcfcfc' : '#404040');
        r.rect(x, y0 + (d2.max - 1 - i) * 2 + 1, 6, 1, filled ? '#f8d878' : '#202020');
      }
    }
    if (p2.out) r.text(font, 'OUT', 200, 24);
  }
  // Blink the timer label when low.
  if (time !== null && time <= 100 && (frame >> 4) % 2 === 0) r.text(font, 'TIME', 200, 8);
}
