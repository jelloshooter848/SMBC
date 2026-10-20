import type { MapDifficulty } from '@engine/save/settings';
import { MAP_DIFFICULTIES } from '@engine/save/settings';
import { MenuScene } from './menu';
import type { Game } from './game';
import { DIFFICULTY_NAMES, MAP_SETS, type MapSet } from './original-game';

/*
 * The Level Select cheat (G-007): the original's 17th cheat (Cheats.as:47), unlocked by beating
 * every map set on Hard (StatManager.allMapPacksBeatOnHard) or by the code. Its page
 * (messageBoxes/LevelSelectMenu.as:58-133): Map set, Difficulty, World (The Lost Levels' A-D
 * too), Level, then Go, which starts there. Reached from the Cheats page (a new Classic run) and
 * the Classic pause menu (the run goes on from there: PauseMenu.as:37-38).
 */

/** The short names the value column has room for. */
const SHORT: Record<string, string> = { smb: 'SMB', special: 'Special', lost: 'Lost Levels' };

/** A world's name as the original shows it (LevelID.ToDisplay): 10-13 are A-D. */
export function worldName(world: number): string {
  return world > 9 ? String.fromCharCode(65 + world - 10) : String(world);
}

/** Level `world`-`level` of map set `set` as an area id (its start: intro or first area). */
export function levelSelectTarget(game: Game, set: MapSet, world: number, level: number): string {
  const id = `${set.start.replace(/\d+-\d+$/, '')}${world}-${level}`;
  const intro = `${id}-intro`;
  try {
    game.deps.getLevel(intro);
    return intro;
  } catch {
    return game.firstArea(id);
  }
}

export class LevelSelectScene extends MenuScene {
  private set: MapSet;
  private difficulty: MapDifficulty;
  private world = 1;
  private level = 1;

  constructor(game: Game, onBack: () => void, translucent = false) {
    super(game, 'LEVEL SELECT', [], onBack, translucent);
    this.set = MAP_SETS[0] as MapSet;
    this.difficulty = game.classicRun
      ? game.classicDifficulty
      : (game.deps.settings?.classicMapDifficulty ?? 'normal');
    this.build();
  }

  private build(): void {
    const step = <T>(list: readonly T[], v: T, d: -1 | 1): T =>
      list[(list.indexOf(v) + d + list.length) % list.length] as T;
    this.setItems([
      {
        label: 'Map set',
        value: () => SHORT[this.set.id] ?? this.set.label,
        adjust: (d) => {
          this.set = step(MAP_SETS, this.set, d);
          this.world = Math.min(this.world, this.set.lastWorld);
        },
        hint: 'Which game',
      },
      {
        label: 'Difficulty',
        value: () => DIFFICULTY_NAMES[this.difficulty],
        adjust: (d) => {
          this.difficulty = step(MAP_DIFFICULTIES, this.difficulty, d);
        },
        hint: 'Map difficulty: Easy, Normal or Hard',
      },
      {
        label: 'World',
        value: () => worldName(this.world),
        adjust: (d) => {
          this.world = ((this.world - 1 + d + this.set.lastWorld) % this.set.lastWorld) + 1;
        },
      },
      {
        label: 'Level',
        value: () => String(this.level),
        adjust: (d) => {
          this.level = ((this.level - 1 + d + 4) % 4) + 1;
        },
      },
      {
        label: 'Go',
        value: () => `${worldName(this.world)}-${this.level}`,
        select: () => this.go(),
        hint: 'Start there',
      },
      { label: 'Back', select: () => this.onBack?.() },
    ]);
  }

  private go(): void {
    const game = this.game;
    const target = levelSelectTarget(game, this.set, this.world, this.level);
    game.classicLevelSelect(target, this.difficulty);
  }

  override enter(): void {
    const it = this.items[this.index];
    const v = it?.value ? `: ${it.value()}` : '';
    this.game.deps.announcer?.say(`Level select. ${it?.label ?? ''}${v}${it?.hint ? `. ${it.hint}` : ''}`);
  }
}
