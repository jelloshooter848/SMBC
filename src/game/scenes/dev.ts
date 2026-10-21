import { MenuScene } from './menu';
import { DevLevelSelectScene } from './dev-level-select';
import { DevMiniGamesScene } from './dev-minigames';
import { DevBonusGamesScene } from '../bonus/dev';
import { AssistOptionsScene } from './options';
import type { Game } from './game';
import type { MenuItem } from './menu';
import type { InputFrame } from '@engine/input/input-manager';
import { CLASSIC_EXTRAS, EXPANSION_HEROES } from '../characters/registry';
import type { CharacterDef } from '../characters/character';
import { DevCampaignScene, DevClassicScene, devAgainItem } from './dev-play';

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
    const again = devAgainItem(game);
    this.setItems([
      // O-05: the Level select as pages (dev-play.ts); Again replays the last start in one press.
      ...(again ? [again] : []),
      {
        label: 'Classic',
        select: () => push(new DevClassicScene(game, this.translucent)),
        hint: 'Map set, world, level, then the start page',
      },
      {
        label: 'Campaign',
        select: () => push(new DevCampaignScene(game, this.translucent)),
        hint: 'World map, story levels, village, training, games; nothing is saved',
      },
      {
        label: 'Level select',
        select: () => push(new DevLevelSelectScene(game, () => game.scenes.pop())),
        hint: 'Every area by its id, on one page',
      },
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
      {
        label: 'Classic heroes',
        select: () => push(new DevClassicHeroesScene(game, () => game.scenes.pop())),
        hint: 'Release, On or Off for each Expansion hero, and the Yoshi mount',
      },
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

/** The rows DevClassicHeroesScene made (its update: START never flips them). */
const TOGGLE_ROWS = new WeakSet<MenuItem>();

/** A toggle row's label room beside an ON / OFF value (MenuScene: 24 columns less 4). */
const TOGGLE_COLS = 20;

/**
 * "Classic: <hero>" for a hero's Dev menu toggle, the name's last words left off while it does not
 * fit the row beside its value ("CLASSIC: WARRIORS"). Names, never the HUD's short name.
 */
export function classicHeroLabel(def: { name: string }): string {
  return `Classic: ${fitName(def.name, TOGGLE_COLS - 'Classic: '.length)}`;
}

/** `name` with its last words left off while longer than `cols`, never ending on "of" / "the". */
function fitName(name: string, cols: number): string {
  const words = name.split(' ');
  let shortened = false;
  while (words.length > 1 && words.join(' ').length > cols) {
    words.pop();
    shortened = true;
  }
  while (shortened && words.length > 1 && /^(of|the|and)$/i.test(words.at(-1) ?? '')) words.pop();
  return words.join(' ');
}

/** An O-06 hero override: Release (what players get), On (always, in dev mode) or Off (hidden). */
export type HeroOverride = 'release' | 'on' | 'off';
const OVERRIDE_NAMES: Record<HeroOverride, string> = { release: 'Release', on: 'On', off: 'Off' };
const OVERRIDES: readonly HeroOverride[] = ['release', 'on', 'off'];

/** Yoshi mount values (Settings.classicDev.yoshiMount and yoshiRide). */
type Mount = 'off' | 'on' | 'ride';
const MOUNTS: readonly Mount[] = ['off', 'on', 'ride'];
const MOUNT_NAMES: Record<Mount, string> = { off: 'Off', on: 'On', ride: 'Ride' };

/**
 * Dev > Classic heroes (O-06): one row per Expansion hero (EXPANSION_HEROES, the heroes SMBC
 * 3.1.21 never had) with Release / On / Off, an All row (Release, All on, All off; Mixed when they
 * differ) and the Yoshi mount (Off / On / Ride). Saved in Settings.classicDev, read only in dev
 * mode (Game.expansionHeroOffered), so release players always get the release rule.
 */
export class DevClassicHeroesScene extends MenuScene {
  constructor(game: Game, onBack: () => void) {
    super(game, 'CLASSIC HEROES', [], onBack);
    const s = game.deps.settings;
    if (!s) {
      this.setItems([{ label: 'Back', select: onBack }]);
      return;
    }
    s.classicDev ??= { yoshiMount: false, heroesOff: [] };
    const dev = s.classicDev;
    const save = () => game.deps.applySettings?.();
    const heroes = EXPANSION_HEROES.map((id) => CLASSIC_EXTRAS.find((d) => d.id === id)).filter(
      (d): d is CharacterDef => d !== undefined,
    );
    const get = (id: string): HeroOverride =>
      dev.heroesOff.includes(id) ? 'off' : dev.heroesOn?.includes(id) ? 'on' : 'release';
    const set = (id: string, v: HeroOverride) => {
      dev.heroesOff = dev.heroesOff.filter((h) => h !== id);
      const on = (dev.heroesOn ?? []).filter((h) => h !== id);
      if (v === 'off') dev.heroesOff.push(id);
      if (v === 'on') on.push(id);
      if (on.length) dev.heroesOn = on;
      else delete dev.heroesOn;
    };
    const step = <T>(list: readonly T[], v: T, d: -1 | 1): T =>
      list[(list.indexOf(v) + d + list.length) % list.length] as T;
    const all = (): HeroOverride | 'mixed' => {
      const vs = new Set(heroes.map((d) => get(d.id)));
      return vs.size === 1 ? ([...vs][0] as HeroOverride) : 'mixed';
    };
    const released = (d: CharacterDef) => (game.heroReleased(d.id) ? 'shown' : 'hidden');
    const rows: MenuItem[] = [];
    const flipAll = (d: -1 | 1) => {
      const now = all();
      const next = now === 'mixed' ? (d > 0 ? 'release' : 'off') : step(OVERRIDES, now, d);
      for (const h of heroes) set(h.id, next);
      save();
    };
    rows.push({
      label: 'All',
      value: () => {
        const v = all();
        return v === 'mixed' ? 'Mixed' : v === 'release' ? 'Release' : `All ${v}`;
      },
      adjust: flipAll,
      select: () => flipAll(1),
      hint: 'Release, All on or All off for every hero below',
    });
    for (const def of heroes) {
      const flip = (d: -1 | 1) => {
        set(def.id, step(OVERRIDES, get(def.id), d));
        save();
      };
      rows.push({
        label: fitName(def.name, 24 - 'Release'.length - 1),
        value: () => OVERRIDE_NAMES[get(def.id)],
        adjust: flip,
        select: () => flip(1),
        get hint() {
          return `Release: as players get it, ${released(def)} now. On: always in dev mode. Off: hidden`;
        },
      });
    }
    const mount = (): Mount => (dev.yoshiMount ? (dev.yoshiRide ? 'ride' : 'on') : 'off');
    const setMount = (d: -1 | 1) => {
      const next = step(MOUNTS, mount(), d);
      dev.yoshiMount = next !== 'off';
      if (next === 'ride') dev.yoshiRide = true;
      else delete dev.yoshiRide;
      save();
    };
    rows.push({
      label: 'Yoshi mount',
      value: () => MOUNT_NAMES[mount()],
      adjust: setMount,
      select: () => setMount(1),
      hint: 'Classic mode: Yoshi eggs hatch from blocks; Ride starts each level riding him. Off plays the original',
    });
    for (const r of rows) TOGGLE_ROWS.add(r);
    rows.push({ label: 'Back', select: onBack });
    this.setItems(rows);
  }

  override enter(): void {
    const it = this.items[this.index];
    const v = it?.value ? `: ${it.value()}` : '';
    this.game.deps.announcer?.say(`Classic heroes. ${it?.label ?? ''}${v}${it?.hint ? `. ${it.hint}` : ''}`);
  }

  /** START on a toggle row leaves the page as BACK does, never flipping it (DevMenuScene's rule). */
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
