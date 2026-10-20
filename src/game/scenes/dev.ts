import { MenuScene } from './menu';
import { DevLevelSelectScene } from './dev-level-select';
import { DevMiniGamesScene } from './dev-minigames';
import { DevBonusGamesScene } from '../bonus/dev';
import { AssistOptionsScene } from './options';
import type { Game } from './game';
import type { MenuItem } from './menu';
import type { InputFrame } from '@engine/input/input-manager';
import { CLASSIC_EXTRAS } from '../characters/registry';

/**
 * Developer tools menu, reachable from the title and (translucently) from the pause menu.
 * More test tools go here as rows.
 */
export class DevMenuScene extends MenuScene {
  constructor(game: Game, fromPause = false) {
    super(game, 'DEV MODE', [], () => game.scenes.pop(), fromPause);
    const push = (s: MenuScene) => {
      s.translucent = this.translucent;
      game.scenes.push(s);
    };
    this.setItems([
      { label: 'Level select', select: () => push(new DevLevelSelectScene(game, () => game.scenes.pop())) },
      {
        label: 'Mini games',
        select: () => push(new DevMiniGamesScene(game, fromPause)),
        hint: "Play any hero's freeing mini game; nothing is saved",
      },
      {
        label: 'Bonus games',
        select: () => push(new DevBonusGamesScene(game, fromPause)),
        hint: 'Toad House, N-spade and the spade game; nothing is saved',
      },
      {
        label: 'Assists',
        select: () => push(new AssistOptionsScene(game, () => game.scenes.pop())),
        hint: 'Only active while dev mode is on',
      },
      ...classicToggleRows(game),
      {
        label: 'Dev mode off',
        select: () => {
          const s = game.deps.settings;
          if (s) {
            s.dev = false;
            game.deps.applySettings?.();
          }
          if (fromPause)
            game.scenes.pop(); // back to the pause menu, which rebuilds without the entry
          else game.showTitle();
        },
        hint: 'Hides developer mode until the code is entered again',
      },
      { label: 'Back', select: () => game.scenes.pop() },
    ]);
  }

  /**
   * START (Enter, Escape, a pad's Start) on a toggle row leaves the menu as BACK does, never
   * flipping the toggle: Escape is START, and leaving must not change a setting. JUMP and
   * left / right still flip it.
   */
  override update(input: InputFrame): void {
    const it = this.items[this.index];
    if (this.t + 1 >= 6 && it && TOGGLE_ROWS.has(it) && input.pressed('start') && this.onBack) {
      this.t++;
      this.game.ctx.audio.sfx('select');
      this.onBack();
      return;
    }
    super.update(input);
  }
}

/** The rows classicToggleRows made (DevMenuScene.update: START never flips them). */
const TOGGLE_ROWS = new WeakSet<MenuItem>();

/** A toggle row's label room beside an ON / OFF value (MenuScene: 24 columns less 4). */
const TOGGLE_COLS = 20;

/**
 * "Classic: <hero>" for a hero's Dev menu toggle, the name's last words left off while it does not
 * fit the row beside its value ("CLASSIC: WARRIORS"). Names, never the HUD's short name.
 */
export function classicHeroLabel(def: { name: string }): string {
  const words = def.name.split(' ');
  const cut = () => words.length > 1 && `Classic: ${words.join(' ')}`.length > TOGGLE_COLS;
  let shortened = false;
  while (cut()) {
    words.pop();
    shortened = true;
  }
  // Never end on a joining word ("WARRIORS OF").
  while (shortened && words.length > 1 && /^(of|the|and)$/i.test(words.at(-1) ?? '')) words.pop();
  return `Classic: ${words.join(' ')}`;
}

/** ON / OFF for a toggle row's value. */
const onOff = (on: boolean): string => (on ? 'ON' : 'OFF');

/**
 * The Classic mode toggles (Settings.classicDev, saved; read only in dev mode): the Yoshi mount
 * (off by default, so Classic plays as the original), then each Classic hero the original SMBC
 * 3.1.21 did not have (CharacterDef.notInOriginal; on by default). A hero turned off is not on
 * the Classic select, and a `?char=` start for it falls back. Changes apply from the next start.
 */
export function classicToggleRows(game: Game): MenuItem[] {
  const s = game.deps.settings;
  if (!s) return [];
  s.classicDev ??= { yoshiMount: false, heroesOff: [] };
  const save = () => game.deps.applySettings?.();
  const mount = () => {
    s.classicDev.yoshiMount = !s.classicDev.yoshiMount;
    save();
  };
  const rows: MenuItem[] = [
    {
      label: 'Classic: Yoshi mount',
      value: () => onOff(s.classicDev.yoshiMount),
      adjust: mount,
      select: mount,
      hint: 'Classic mode: Yoshi eggs hatch from blocks. Off plays the original',
    },
  ];
  for (const def of CLASSIC_EXTRAS) {
    if (!def.notInOriginal) continue;
    const flip = () => {
      const off = s.classicDev.heroesOff;
      const i = off.indexOf(def.id);
      if (i >= 0) off.splice(i, 1);
      else off.push(def.id);
      save();
    };
    rows.push({
      label: classicHeroLabel(def),
      value: () => onOff(!s.classicDev.heroesOff.includes(def.id)),
      adjust: flip,
      select: flip,
      hint: 'Classic mode hero not in the original game. Off hides it from the hero select',
    });
  }
  for (const r of rows) TOGGLE_ROWS.add(r);
  return rows;
}
