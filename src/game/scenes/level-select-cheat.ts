import type { MapDifficulty } from '@engine/save/settings';
import { MenuScene } from './menu';
import { LevelScene } from './level';
import type { Game } from './game';
import { MAP_SETS, mapDifficultyItem, mapSetOf, type MapSet } from './original-game';
import { ClassicOverwriteScene } from './original-saves';

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
  private world = 1;
  private level = 1;
  /** The page's Map difficulty, from the settings; saved by Go only. */
  private difficulty: MapDifficulty;

  constructor(game: Game, onBack: () => void, translucent = false) {
    super(game, 'LEVEL SELECT', [], onBack, translucent);
    this.set = MAP_SETS[0] as MapSet;
    this.difficulty = game.deps.settings?.classicMapDifficulty ?? 'normal';
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

  /** Whether the run plays (or will play) Classic rules: Map difficulty applies only then. */
  private get classic(): boolean {
    const g = this.game;
    return (g.classicRun ? g.liveRules : g.classicRules) === 'classic';
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
      // Kept on this page until Go, which saves it (LevelSelectMenu: changeMapDifficulty on
      // GO_TO_WORLD only); Back leaves the CLASSIC menu's as it was.
      mapDifficultyItem(this.game, () => this.classic, {
        get: () => this.difficulty,
        set: (d) => {
          this.difficulty = d;
        },
      }),
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
    const difficulty = this.classic ? this.difficulty : 'normal';
    const go = () => game.classicLevelSelect(target, difficulty);
    // Per-set saves: Go asks first (Cancel focused) whenever it would overwrite a saved run: from
    // the menus (a new run), and in a run (the pause menu) going to another set that has its own
    // (the run writes that set's slot from then on; the set it leaves keeps its save). In a run
    // within its own set, the run just goes on.
    const here = game.classicRun
      ? (game.scenes.find((s) => s instanceof LevelScene) as LevelScene | undefined)
      : undefined;
    const sameSet = here !== undefined && mapSetOf(here.world.level.id).id === this.set.id;
    const kept = sameSet ? null : game.classicResume(this.set.id);
    if (!kept) return go();
    game.scenes.push(
      new ClassicOverwriteScene(
        game,
        this.set,
        kept,
        () => {
          game.scenes.pop();
          go();
        },
        () => {
          game.scenes.pop();
          this.announce();
        },
        null,
        here !== undefined,
      ),
    );
  }

  override enter(): void {
    const it = this.items[this.index];
    const v = it?.value ? `: ${it.value()}` : '';
    this.game.deps.announcer?.say(`Level select. ${it?.label ?? ''}${v}${it?.hint ? `. ${it.hint}` : ''}`);
  }
}
