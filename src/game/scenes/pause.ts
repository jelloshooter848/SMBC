import { MenuScene, type MenuItem } from './menu';
import { AssistOptionsScene, OptionsScene } from './options';
import { DevMenuScene } from './dev';
import { GuideScene } from './guide';
import type { Game } from './game';
import type { World } from '../world/world';
import { TOUCH_MODES, type TouchMode } from '@engine/save/settings';

const TOUCH_MODE_LABELS: Record<TouchMode, string> = { auto: 'Auto', on: 'On', off: 'Off' };

export class PauseScene extends MenuScene {
  constructor(
    game: Game,
    private readonly world: World | null = null,
  ) {
    super(game, 'PAUSE', [], null, true);
    this.rebuild();
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
    // Stored items (E-tanks) are used from here, like the original weapon menu.
    const world = this.world;
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
    // The on-screen pad can be forced on or off right here (saved and applied at once).
    const s = game.deps.settings;
    if (s?.input) {
      const cycle = (d: -1 | 1) => {
        const i = TOUCH_MODES.indexOf(s.input.touch);
        s.input.touch = TOUCH_MODES[(i + d + TOUCH_MODES.length) % TOUCH_MODES.length] as TouchMode;
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
    return this.game.devMode && !this.game.campaign;
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

  override update(input: Parameters<MenuScene['update']>[0]): void {
    // Returning from a sub-menu (dev mode off) must refresh the entries.
    const has = (label: string) => this.items.some((i) => i.label === label);
    if (has('Dev mode') !== this.showDev || has('Assists') !== this.showAssists) this.rebuild();
    // Start selects the highlighted entry (Continue by default), so a double tap of Start still resumes.
    super.update(input);
  }
}
