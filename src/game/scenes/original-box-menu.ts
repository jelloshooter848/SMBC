import type { Renderer } from '@engine/gfx/renderer';
import type { Scene } from '@engine/scene';
import { FONT_COLOURS } from '@content/sprites/font';
import type { Game } from './game';
import type { MenuItem } from './menu';
import { abilityHint } from './hints';
import { boxCentreUnderLogo, boxGrowth, boxLayout, drawMenuBox, type BoxRow } from './menu-box';

/*
 * BUG-01 (owner): CLASSIC > Options and the pages it opens (More settings, Weapons, Disable
 * heroes, Cheats) are boxes over the CLASSIC title's demo, as the Start box and the map set box
 * are, not full-screen pages. A menu opened over the title (directly, or over boxes that are
 * over it) finds the title with demoUnder, keeps its demo playing and draws its rows with
 * renderBoxedMenu; anywhere else (the Classic pause menu's Cheats) it stays as it was.
 */

/** The CLASSIC title as a backdrop (original-title.ts ClassicTitleScene). */
export interface DemoBackdrop {
  readonly classicBackdrop: true;
  tickDemo(): void;
}

const isBackdrop = (s: Scene): s is Scene & DemoBackdrop =>
  (s as Partial<DemoBackdrop>).classicBackdrop === true;

/**
 * The CLASSIC title the scene about to open goes over: the top scene, or the one under a run of
 * see-through scenes from the top (so it shows through them all); null anywhere else.
 */
export function demoUnder(game: Game): DemoBackdrop | null {
  let blocked = false;
  const found = game.scenes.find((s) => {
    if (blocked) return false;
    if (isBackdrop(s)) return true;
    if (!s.translucent) blocked = true;
    return false;
  });
  return found && isBackdrop(found) ? found : null;
}

export interface BoxedMenu {
  /** The page's name, drawn on its own gold row at the box's top (every boxed page has one). */
  header?: string;
  items: readonly MenuItem[];
  index: number;
  t: number;
  /** The status line under the box ('' for none). */
  status: string;
  /** Frames since the box opened (it grows open), or null to draw it open. */
  age?: number | null;
  /** The action that goes BACK on this page, named in the hint (MenuScene.backAction; 'attack'). */
  backAction?: 'attack' | 'select';
}

/** A menu's rows in a box under the CLASSIC logo, its status line and the BACK hint under it. */
export function renderBoxedMenu(r: Renderer, game: Game, m: BoxedMenu): void {
  const calm = game.ctx.reduceFlashing;
  const rows: BoxRow[] = m.items.map((it) => {
    const value = it.value?.();
    return { label: it.label, ...(value !== undefined ? { value } : {}) };
  });
  const status = m.status !== '';
  const at = boxLayout(rows, status, boxCentreUnderLogo(rows, m.header), m.header);
  const grow = m.age === null || m.age === undefined ? 1 : boxGrowth(m.age, calm);
  drawMenuBox(r, game.ctx.assets, rows, m.index, {
    cx: 128,
    cy: at.cy,
    grow,
    t: m.t,
    calm,
    ...(m.header ? { header: m.header } : {}),
  });
  if (grow < 1) return;
  const assets = game.ctx.assets;
  const line = (s: string, y: number) => {
    const x = Math.round(128 - (s.length * 8) / 2);
    r.text(assets.sheet('font', FONT_COLOURS.black), s, x + 1, y + 1);
    r.text(assets.sheet('font'), s, x, y);
  };
  if (status && at.statusY !== null) line(m.status.toUpperCase().slice(0, 31), at.statusY);
  line(abilityHint(game, 'BACK', m.backAction ?? 'attack'), at.backY);
}
