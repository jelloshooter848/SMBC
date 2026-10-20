import {
  CLASSIC_ROW_VALUES,
  CLASSIC_WEAPON_PAIRS,
  CLASSIC_WEAPON_VALUES,
  defaultClassicSettings,
  type ClassicSettings,
  type ClassicWeapons,
} from '@engine/save/original-options';
import { MenuScene, type MenuItem } from './menu';
import type { Game } from './game';

/**
 * Classic mode's option menus (title > CLASSIC > Options; FU-7a More Settings, FU-7b Game Mode,
 * FU-7c Customize Weapons): rows that step through Settings.classic's value lists with Left /
 * Right (or OK), each saying what it changes. A row not at the original's value is marked `*`
 * and spoken as changed, so a run is never silently non-original; Restore originals puts every
 * row of the menu back.
 */

/** One option row: its label, its spoken help, and its values' names. */
export interface OptionRow<T extends string | number> {
  label: string;
  hint: string;
  values: readonly T[];
  get(s: ClassicSettings): T;
  set(s: ClassicSettings, v: T): void;
  /** The value as the row shows and speaks it. */
  name(v: T): string;
  /** A value this row may not take now (a weapon pair's other half). */
  taken?(s: ClassicSettings, v: T): boolean;
}

type AnyRow = OptionRow<string> | OptionRow<number>;

/** Shown and spoken value names. Short enough for a menu row beside its label (24 columns). */
const NAMES: Record<string, string> = {
  'lose-everything': 'Lose everything',
  'previous-state': 'Previous state',
  'instant-death': 'Instant death',
  'very-weak': 'Very weak',
  weak: 'Weak',
  normal: 'Normal',
  strong: 'Strong',
  'very-strong': 'Very strong',
  'very-low': 'Very low',
  low: 'Low',
  high: 'High',
  'very-high': 'Very high',
  fast: 'Fast',
  some: 'Some pipes',
  all: 'All pipes',
  'green-some': 'Green some',
  'green-all': 'Green all',
  'red-some': 'Red some',
  'red-all': 'Red all',
  off: 'Off',
  buzzy: 'Buzzy Beetle',
  spiny: 'Spiny',
  'spike-top': 'Spike Top',
  // Game Mode
  single: 'Single hero',
  'single-random': 'Single random',
  // Weapons (the original's names)
  'super-arm': 'Super Arm',
  'metal-blade': 'Metal Blade',
  'hard-knuckle': 'Hard Knuckle',
  'pharaoh-shot': 'Pharaoh Shot',
  'charge-kick': 'Charge Kick',
  'flame-blast': 'Flame Blast',
  'magma-bazooka': 'Magma Bazooka',
  'water-shield': 'Water Shield',
  'screw-crusher': 'Screw Crusher',
  flare: 'Flare',
  laser: 'Laser',
  mg: 'Machine Gun',
  spread: 'Spread',
  bomb: 'Bomb',
  bow: 'Bow and Arrow',
  shuriken: 'Shuriken',
  windmill: 'Windmill',
  'jump-slash': 'Jump Slash',
  'fire-wheel': 'Fire Wheel',
  'dragon-ball': 'Dragon Ball',
  ice: 'Ice Beam',
  wave: 'Wave Beam',
  dagger: 'Dagger',
  'hand-axe': 'Axe',
  'holy-water': 'Holy Water',
  cross: 'Cross',
  stopwatch: 'Stopwatch',
  triple: 'Triple Missile',
  homing: 'Homing Missile',
};

/** A value's shown name (the id itself for one with none). */
export function optionName(v: string | number): string {
  return typeof v === 'number' ? String(v) : (NAMES[v] ?? v);
}

/** The Game Mode value names, fuller than a row has room for in the menu (spoken in hints). */
const GAME_MODE_NAMES: Record<string, string> = {
  all: 'All heroes',
  single: 'Single hero',
  'single-random': 'Single random',
};

function row<K extends keyof typeof CLASSIC_ROW_VALUES>(
  key: K,
  label: string,
  hint: string,
  name: (v: ClassicSettings[K]) => string = optionName,
): OptionRow<ClassicSettings[K] & (string | number)> {
  return {
    label,
    hint,
    values: CLASSIC_ROW_VALUES[key] as unknown as readonly (ClassicSettings[K] & (string | number))[],
    get: (s) => s[key] as ClassicSettings[K] & (string | number),
    set: (s, v) => {
      (s as unknown as Record<string, unknown>)[key] = v;
    },
    name,
  };
}

/** More Settings (DifficultySettingsMenu under Classic power-ups), in the original's order. */
export const MORE_SETTINGS_ROWS: readonly AnyRow[] = [
  row('lives', 'Lives', 'Lives at the start and after each continue'),
  row(
    'whenHit',
    'When hit',
    'Lose everything: any hit leaves you small. Previous state: Fire goes to big. Instant death: any hit defeats you',
  ),
  row('attack', 'Attack', "Every hero's attack strength"),
  row('drops', 'Item drops', 'How often enemies and blocks drop ammo'),
  row('piranhas', 'Piranhas', 'Which pipes have Piranha Plants, and their colour'),
  row('goombas', 'Goombas', 'Every Goomba becomes this enemy'),
  row('enemySpeed', 'Enemy speed', 'Walking enemies move faster when fast'),
] as AnyRow[];

/** The Game Mode row (NewGameOptionsMenu's GAME_MODE under Classic mode). */
export const GAME_MODE_ROW = row(
  'gameMode',
  'Game mode',
  'All heroes: choose before every level and life. Single hero: choose once. Single random: the game picks your hero every level and life',
  (v) => GAME_MODE_NAMES[v] ?? v,
) as AnyRow;

function weaponRow<K extends keyof ClassicWeapons>(key: K, label: string, hint: string): OptionRow<string> {
  const pair = CLASSIC_WEAPON_PAIRS.find(([a, b]) => a === key || b === key);
  const other = pair ? (pair[0] === key ? pair[1] : pair[0]) : null;
  return {
    label,
    hint,
    values: CLASSIC_WEAPON_VALUES[key] as readonly string[],
    get: (s) => s.weapons[key],
    set: (s, v) => {
      (s.weapons as unknown as Record<string, string>)[key] = v;
    },
    name: optionName,
    ...(other ? { taken: (s: ClassicSettings, v: string) => s.weapons[other] === v } : {}),
  };
}

/** Customize Weapons (CustomizeWeaponsMenu), in the original's order. */
export const WEAPON_ROWS: readonly OptionRow<string>[] = [
  weaponRow('bass', 'Bass', "Bass's Fire Flower weapon"),
  weaponRow('billFirst', 'Bill gun 1', "Bill's Mushroom gun"),
  weaponRow('billSecond', 'Bill gun 2', "Bill's Fire Flower gun"),
  weaponRow('link', 'Link', "Link's Mushroom weapon"),
  weaponRow('megaman', 'Mega Man', "Mega Man's Fire Flower weapon"),
  weaponRow('ryuStart', 'Ryu start', "Ryu's first art"),
  weaponRow('ryuExtra', 'Ryu extra', "Ryu's Fire Flower art"),
  weaponRow('samus', 'Samus', "Samus's Fire Flower beam"),
  weaponRow('simonStart', 'Simon start', "Simon's first sub-weapon"),
  weaponRow('simonExtra', 'Simon extra', "Simon's Fire Flower sub-weapon"),
  weaponRow('sophia', 'Sophia', "Sophia III's missile"),
];

/** Whether every row of `rows` holds the original's value in `s`. */
export function rowsOriginal(rows: readonly AnyRow[], s: ClassicSettings): boolean {
  const d = defaultClassicSettings();
  return rows.every((r) => (r as OptionRow<string>).get(s) === (r as OptionRow<string>).get(d));
}

/** The next value of `r` in `dir` (wrapping), skipping one its pair holds. */
export function stepRow(r: AnyRow, s: ClassicSettings, dir: -1 | 1): void {
  const rr = r as OptionRow<string>;
  const n = rr.values.length;
  let i = rr.values.indexOf(rr.get(s));
  for (let k = 0; k < n; k++) {
    i = (i + dir + n) % n;
    const v = rr.values[i] as string;
    if (!rr.taken?.(s, v)) {
      rr.set(s, v);
      return;
    }
  }
}

/** A row's MenuItem: `*` on its label and "changed" in its hint while not the original's value. */
export function optionItem(game: Game, r: AnyRow, after: () => void): MenuItem {
  const rr = r as OptionRow<string>;
  const s = game.deps.settings?.classic ?? defaultClassicSettings();
  const changed = rr.get(s) !== rr.get(defaultClassicSettings());
  return {
    label: changed ? `${rr.label}*` : rr.label,
    value: () => rr.name(rr.get(game.deps.settings?.classic ?? defaultClassicSettings())),
    adjust: (dir) => {
      const cs = game.deps.settings?.classic;
      if (!cs) return;
      stepRow(r, cs, dir);
      game.deps.applySettings?.();
      after();
    },
    hint: changed
      ? `${rr.hint}. Changed from the original: ${rr.name(rr.get(defaultClassicSettings()))}`
      : rr.hint,
  };
}

/**
 * A Classic option menu: its rows, then Restore originals and Back. Left / Right (or OK) step a
 * row; the menu rebuilds after each change so the `*` marks follow.
 */
export class ClassicOptionRowsScene extends MenuScene {
  constructor(
    game: Game,
    title: string,
    private readonly rows: readonly AnyRow[],
    private readonly spokenTitle: string,
    onBack: () => void,
  ) {
    super(game, title, [], onBack);
    this.build();
  }

  private build(): void {
    const items = this.rows.map((r) => optionItem(this.game, r, () => this.build()));
    items.push(
      {
        label: 'Restore originals',
        select: () => {
          const cs = this.game.deps.settings?.classic;
          if (cs) {
            const d = defaultClassicSettings();
            for (const r of this.rows) (r as OptionRow<string>).set(cs, (r as OptionRow<string>).get(d));
            this.game.deps.applySettings?.();
          }
          this.build();
          this.game.deps.announcer?.say('Every setting here is back to the original.');
        },
        hint: 'Puts every setting here back to the original game',
      },
      { label: 'Back', select: () => this.onBack?.() },
    );
    this.setItems(items);
  }

  override enter(): void {
    const it = this.items[this.index];
    const v = it?.value ? `: ${it.value()}` : '';
    this.game.deps.announcer?.say(
      `${this.spokenTitle}. Left and right to change. ${it ? `${it.label.replace(/\*$/, '')}${v}. ${it.hint ?? ''}` : ''}`,
    );
  }

  protected override announce(): void {
    const it = this.items[this.index];
    if (!it) return;
    const v = it.value ? `: ${it.value()}` : '';
    this.game.deps.announcer?.say(`${it.label.replace(/\*$/, '')}${v}${it.hint ? `. ${it.hint}` : ''}`);
  }
}
