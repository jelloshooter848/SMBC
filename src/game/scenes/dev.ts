import { MenuScene, backToMenu } from './menu';
import { AssistOptionsScene } from './options';
import type { Game } from './game';
import type { MenuItem } from './menu';
import type { InputFrame } from '@engine/input/input-manager';
import {
  CLASSIC_CHARACTERS,
  CLASSIC_EXTRAS,
  EXPANSION_HEROES,
  expansionReleased,
} from '../characters/registry';
import type { Rules } from '../context';
import type { CharacterDef } from '../characters/character';
import { DevLevelPagesScene, devAgainItem } from './dev-play';

/**
 * Developer tools menu, reachable from the title and (translucently) from the pause menu.
 * More test tools go here as rows.
 */
export class DevMenuScene extends MenuScene {
  constructor(game: Game, fromPause = false) {
    // 32a: BACK to the title or the pause menu says its focused row again.
    super(game, 'DEV MODE', [], () => backToMenu(game), fromPause);
    this.entryTitle = 'Dev mode';
    const push = (s: MenuScene) => {
      s.translucent = this.translucent;
      game.scenes.push(s);
    };
    const again = devAgainItem(game);
    this.setItems([
      // O-05: Again replays the last start in one press. BUG-09: one Level select, its pages
      // nesting Classic, Campaign, Mini games and Bonus games (dev-play.ts).
      ...(again ? [again] : []),
      {
        label: 'Level select',
        select: () => push(new DevLevelPagesScene(game, this.translucent)),
        hint: 'Classic, Campaign, Mini games and Bonus games',
      },
      {
        label: 'Assists',
        select: () => push(new AssistOptionsScene(game, () => backToMenu(game))),
        hint: 'Only active while dev mode is on',
      },
      {
        // BUG-10: was Classic heroes; its Classic page is that page, its Campaign page is new.
        label: 'Toggle heroes',
        select: () => push(new DevToggleHeroesScene(game, () => backToMenu(game))),
        hint: 'Classic: who is offered, the Yoshi mount and which design each hero plays. Campaign: which design each hero plays',
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
      { label: 'Back', select: () => backToMenu(game) },
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
 * Dev > Toggle heroes > Classic (O-06, was Dev > Classic heroes): one row per Expansion hero (EXPANSION_HEROES, the heroes SMBC
 * 3.1.21 never had) with Release / On / Off, an All row (Release, All on, All off; Mixed when they
 * differ) and the Yoshi mount (Off / On / Ride). Saved in Settings.classicDev, read only in dev
 * mode (Game.expansionHeroOffered), so release players always get the release rule.
 */
export class DevClassicHeroesScene extends MenuScene {
  constructor(game: Game, onBack: () => void) {
    super(game, 'TOGGLE HEROES: CLASSIC', [], onBack);
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
      select: () => this.picked(() => flipAll(1)),
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
        select: () => this.picked(() => flip(1)),
        get hint() {
          const players = expansionReleased(def.id) ? 'released to players' : 'not released to players';
          return `Release: as players get it, ${released(def)} now; ${players}. On: always in dev mode. Off: hidden`;
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
      select: () => this.picked(() => setMount(1)),
      hint: 'Classic mode: Yoshi eggs hatch from blocks; Ride starts each level riding him. Off plays the original',
    });
    for (const r of rows) TOGGLE_ROWS.add(r);
    // BUG-10: each Classic hero's Plays as (Classic / Campaign design), on a page of its own.
    rows.push({
      label: 'Plays as',
      value: () => playsAsSummary(game, 'classic'),
      select: () => game.scenes.push(new DevPlaysAsScene(game, 'classic', () => backToMenu(game))),
      hint: 'Each hero plays its Classic or its Campaign design in Classic mode',
    });
    rows.push({ label: 'Back', select: onBack });
    this.setItems(rows);
  }

  /** OK on a row steps it as RIGHT does, and reads the new value out (MenuScene says it for RIGHT only). */
  private picked(step: () => void): void {
    step();
    this.announce();
  }

  override enter(): void {
    const it = this.items[this.index];
    const v = it?.value ? `: ${it.value()}` : '';
    this.game.deps.announcer?.say(
      `Toggle heroes: Classic. ${it?.label ?? ''}${v}${it?.hint ? `. ${it.hint}` : ''}`,
    );
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

/**
 * BUG-10: Dev > Toggle heroes (was Classic heroes): its Classic page (DevClassicHeroesScene: who
 * the Classic select offers, the Yoshi mount and each hero's Plays as) and its Campaign page (each
 * campaign hero's Plays as). Saved in Settings.classicDev; dev mode only.
 */
export class DevToggleHeroesScene extends MenuScene {
  constructor(game: Game, onBack: () => void) {
    super(game, 'TOGGLE HEROES', [], onBack);
    this.setItems([
      {
        label: 'Classic',
        select: () => game.scenes.push(new DevClassicHeroesScene(game, () => backToMenu(game))),
        hint: 'Release, On or Off for each Expansion hero, the Yoshi mount, and Plays as',
      },
      {
        label: 'Campaign',
        select: () => game.scenes.push(new DevPlaysAsScene(game, 'current', () => backToMenu(game))),
        hint: 'Plays as Campaign or Classic for each campaign hero',
      },
      { label: 'Back', select: onBack },
    ]);
  }

  override enter(): void {
    const it = this.items[this.index];
    this.game.deps.announcer?.say(`Toggle heroes. ${it?.label ?? ''}${it?.hint ? `. ${it.hint}` : ''}`);
  }
}

/** The design names, by the rules each is resolved under (the 'current' rules are "Campaign"). */
const DESIGN_NAMES: Record<Rules, string> = { classic: 'Classic', current: 'Campaign' };

const other = (r: Rules): Rules => (r === 'classic' ? 'current' : 'classic');

/** The heroes with both designs (a Campaign def and a Classic one): the ones Plays as can swap. */
function swappable(game: Game): CharacterDef[] {
  return game.deps.characters.filter((c) => CLASSIC_CHARACTERS[c.id] !== undefined);
}

/** The Settings.classicDev list a page under `rules` keeps: the heroes playing the other design. */
const SWAP_KEY = { classic: 'playsCampaign', current: 'playsClassic' } as const;

/** "All Classic", "All Campaign" or "Mixed": the Classic page's Plays as row. */
function playsAsSummary(game: Game, rules: Rules): string {
  const list = game.deps.settings?.classicDev?.[SWAP_KEY[rules]] ?? [];
  const heroes = swappable(game);
  const n = heroes.filter((c) => list.includes(c.id)).length;
  if (n === 0) return `All ${DESIGN_NAMES[rules]}`;
  return n === heroes.length ? `All ${DESIGN_NAMES[other(rules)]}` : 'Mixed';
}

/**
 * BUG-10, Dev > Toggle heroes > Classic > Plays as (`rules` 'classic') or > Campaign (`rules`
 * 'current'): one row per hero with both designs, playing its own design (Classic in Classic
 * mode, Campaign in the campaign) or the other one, so a dev can test either kit in either mode.
 * Saved in Settings.classicDev (playsCampaign / playsClassic); read only in dev mode
 * (Game.heroSwaps), from the next level on.
 */
export class DevPlaysAsScene extends MenuScene {
  constructor(
    game: Game,
    readonly rules: Rules,
    onBack: () => void,
  ) {
    super(game, rules === 'classic' ? 'CLASSIC: PLAYS AS' : 'TOGGLE HEROES: CAMPAIGN', [], onBack);
    // Every hero and Back on one screen, under the title and over the BACK line.
    this.visibleRows = 10;
    const s = game.deps.settings;
    if (!s) {
      this.setItems([{ label: 'Back', select: onBack }]);
      return;
    }
    s.classicDev ??= { yoshiMount: false, heroesOff: [] };
    const dev = s.classicDev;
    const key = SWAP_KEY[rules];
    const own = DESIGN_NAMES[rules];
    const swap = DESIGN_NAMES[other(rules)];
    const mode = rules === 'classic' ? 'Classic mode' : 'the campaign';
    const rows: MenuItem[] = swappable(game).map((def) => {
      const flip = () => {
        const was = dev[key] ?? [];
        const list = was.filter((id) => id !== def.id);
        if (!was.includes(def.id)) list.push(def.id);
        if (list.length) dev[key] = list;
        else delete dev[key];
        game.deps.applySettings?.();
      };
      const row: MenuItem = {
        label: fitName(def.name, 24 - 'Campaign'.length - 1),
        value: () => ((dev[key] ?? []).includes(def.id) ? swap : own),
        adjust: flip,
        select: () => {
          flip();
          this.announce();
        },
        hint: `Plays as: ${own} or ${swap}, in ${mode}, from the next level. Dev mode only`,
      };
      TOGGLE_ROWS.add(row);
      return row;
    });
    rows.push({ label: 'Back', select: onBack });
    this.setItems(rows);
  }

  override enter(): void {
    const it = this.items[this.index];
    const v = it?.value ? `: ${it.value()}` : '';
    const page = this.rules === 'classic' ? 'Toggle heroes: Classic, plays as' : 'Toggle heroes: Campaign';
    this.game.deps.announcer?.say(`${page}. ${it?.label ?? ''}${v}${it?.hint ? `. ${it.hint}` : ''}`);
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
