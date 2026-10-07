import { MenuScene, type MenuItem } from './menu';
import { AssistOptionsScene, OptionsScene } from './options';
import { DevMenuScene } from './dev';
import { GuideScene } from './guide';
import type { Game } from './game';
import type { World } from '../world/world';
import type { TouchLabels } from '@engine/input/touch';
import type { Renderer } from '@engine/gfx/renderer';
import type { TouchMode } from '@engine/save/settings';
import { nextTouchMode } from '@engine/input/touch-logic';
import { trainFromPause, trainingOffered } from '../tutorial/training';
import { endStageRound } from '../arena/stage-round';

const TOUCH_MODE_LABELS: Record<TouchMode, string> = { auto: 'Auto', on: 'On', off: 'Off' };

export class PauseScene extends MenuScene {
  constructor(
    game: Game,
    private readonly world: World | null = null,
  ) {
    super(game, 'PAUSE', [], null, true);
    this.rebuild();
  }

  /** The menu, with the short SMBC REMIX logo in the panel's bottom right corner. */
  override render(r: Renderer): void {
    super.render(r);
    r.sprite(this.game.ctx.assets.sheet('title-logo'), 'smbc-line', 146, 200);
  }

  private rebuild(): void {
    const game = this.game;
    const items: MenuItem[] = [{ label: 'Continue', select: () => game.scenes.pop() }];
    // The hero's own guide (and player two's in co-op).
    const heroes = [game.state.character, ...(game.state.character2 ? [game.state.character2] : [])];
    for (const c of heroes)
      items.push({
        label: heroes.length > 1 ? `Guide: ${c.name}` : 'Guide',
        select: () => game.scenes.push(new GuideScene(game, c, () => game.scenes.pop())),
      });
    const world = this.world;
    // Campaign levels: replay the hero's practice room, then back to this paused level.
    if (world)
      heroes.forEach((c, i) => {
        if (!trainingOffered(game, c)) return;
        items.push({
          label: 'Training',
          ...(heroes.length > 1 ? { value: () => c.name } : {}),
          select: () => trainFromPause(game, c, i),
          hint: `Practise ${c.name}'s moves in a training room`,
        });
      });
    // Stored items (E-tanks) are used from here, like the original weapon menu.
    const p = world?.player;
    const reserve = p?.def.reserve;
    const label = p && reserve ? reserve.label(p) : null;
    if (world && p && reserve && label) {
      items.push({
        label,
        select: () => {
          if (reserve.use(p, world)) game.scenes.pop();
        },
      });
    }
    // The on-screen pad can be forced on or off right here (saved and applied at once). On touch
    // the row skips Off, which would leave no touch control to turn it back on.
    const s = game.deps.settings;
    if (s?.input) {
      const cycle = (d: -1 | 1) => {
        s.input.touch = nextTouchMode(s.input.touch, d, game.deps.lastInput?.() ?? null);
        game.deps.applySettings?.();
        this.announce();
      };
      items.push({
        label: 'Touch controls',
        value: () => TOUCH_MODE_LABELS[s.input.touch],
        adjust: cycle,
        select: () => cycle(1),
        hint: 'Auto shows them on phones and tablets',
      });
    }
    items.push({
      label: 'Options',
      select: () => game.scenes.push(new OptionsScene(game, () => game.scenes.pop(), true)),
    });
    if (this.showDev)
      items.push({ label: 'Dev mode', select: () => game.scenes.push(new DevMenuScene(game, true)) });
    // In campaign play dev mode offers only the assists (no level select, which would leave the file).
    if (this.showAssists)
      items.push({
        label: 'Assists',
        select: () => game.scenes.push(new AssistOptionsScene(game, () => game.scenes.pop())),
      });
    // A stage played as an arena round (arena/stage-round.ts): Give up ends the round, nothing else.
    if (game.stageRound) {
      items.push({
        label: 'Give up',
        select: () => endStageRound(game, 'quit'),
        hint: 'Ends the round',
      });
      this.setItems(items);
      return;
    }
    // A stage tutorial (1-0) can be skipped: it counts as cleared (Game.skipTutorial).
    if (game.tutorialRun && !game.playtestDone)
      items.push({
        label: 'Skip tutorial',
        select: () => game.skipTutorial(),
        hint: 'Counts as cleared and opens the next level',
      });
    if (game.campaign && !game.playtestDone) {
      // Leave the level for the map (any level, cleared or not; no clear is recorded, the run's
      // lives, score, coins and power are kept and saved), or save and go to the title.
      items.push({ label: 'Quit to map', select: () => game.returnToMap() });
      items.push({ label: 'Quit to title', select: () => game.saveAndQuit() });
    } else
      items.push({
        label: 'Quit',
        select: () => (game.playtestDone ? game.playtestDone() : game.showTitle()),
      });
    this.setItems(items);
  }

  /** Dev mode's full menu (level select, dev mode off) stays out of campaign play. */
  private get showDev(): boolean {
    return this.game.devMode && !this.game.campaign && !this.game.stageRound;
  }

  /** Campaign play in dev mode gets the assists on their own. */
  private get showAssists(): boolean {
    return this.game.devMode && !!this.game.campaign;
  }

  override enter(): void {
    this.game.ctx.audio.sfx('pause');
    this.game.ctx.audio.pause();
    this.rebuild();
    super.enter();
  }
  exit(): void {
    this.game.ctx.audio.resume();
  }

  /** Start resumes from Continue (where the cursor starts); elsewhere it would pick that entry. */
  override touchLabels(): TouchLabels {
    return { ...super.touchLabels(), start: this.index === 0 ? 'RESUME' : null };
  }

  override update(input: Parameters<MenuScene['update']>[0]): void {
    // Returning from a sub-menu (dev mode off) must refresh the entries.
    const has = (label: string) => this.items.some((i) => i.label === label);
    if (has('Dev mode') !== this.showDev || has('Assists') !== this.showAssists) this.rebuild();
    // Start selects the highlighted entry (Continue by default), so a double tap of Start still resumes.
    super.update(input);
  }
}
