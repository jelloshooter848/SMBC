import { MenuScene } from './menu';
import { LevelScene } from './level';
import type { Game } from './game';
import { MAP_SETS, mapSetOf, type MapSet } from './original-game';

/*
 * The Level Select cheat (G-007): the original's 17th cheat (Cheats.as:47), unlocked by beating
 * every map set on Hard (StatManager.allMapPacksBeatOnHard) or by the code. Its page
 * (messageBoxes/LevelSelectMenu.as:58-133): Map set, World (The Lost Levels' A-D too), Level,
 * then Go, which starts there. Reached from the Cheats page and the Classic pause menu (the run
 * goes on from there: PauseMenu.as:37-38). B-L (owner): no Difficulty row. In a run the file's
 * Map difficulty is fixed and the run stays in its own file, whichever set it goes to; from the
 * menus Go starts a practice run (the original's rules at Normal, no file, counting for nothing).
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
  private world = 1;
  private level = 1;

  constructor(game: Game, onBack: () => void, translucent = false) {
    super(game, 'LEVEL SELECT', [], onBack, translucent);
    this.set = MAP_SETS[0] as MapSet;
    // From a level (the pause menu): its map set, world and level (LevelSelectMenu.as:35-46).
    const here = game.scenes.find((s) => s instanceof LevelScene) as LevelScene | undefined;
    const id = here?.world.level.id;
    if (id) {
      this.set = mapSetOf(id);
      const m = /(\d+)-(\d+)/.exec(id.slice(this.set.start.replace(/\d+-\d+$/, '').length));
      if (m) {
        this.world = Math.min(Math.max(1, Number(m[1])), this.set.lastWorld);
        this.level = Math.min(Math.max(1, Number(m[2])), 4);
      }
    }
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
        hint: this.game.classicRun
          ? 'Go there, keeping your lives and score'
          : "Practise there with the original's rules; nothing is saved",
      },
      { label: 'Back', select: () => this.onBack?.() },
    ]);
  }

  private go(): void {
    const game = this.game;
    game.classicLevelSelect(levelSelectTarget(game, this.set, this.world, this.level));
  }

  override enter(): void {
    const it = this.items[this.index];
    const v = it?.value ? `: ${it.value()}` : '';
    this.game.deps.announcer?.say(`Level select. ${it?.label ?? ''}${v}${it?.hint ? `. ${it.hint}` : ''}`);
  }
}
