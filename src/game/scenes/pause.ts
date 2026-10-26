import { MenuScene, backToMenu, type MenuItem } from './menu';
import { AssistOptionsScene, OptionsScene } from './options';
import { confirmQuitRun } from './quit-run';
import { DevMenuScene } from './dev';
import { CheatsScene } from './cheats-menu';
import { advancedCheatsItem } from './advanced-cheats-menu';
import { GuideScene } from './guide';
import type { Game } from './game';
import type { World } from '../world/world';
import type { TouchLabels } from '@engine/input/touch';
import type { Renderer } from '@engine/gfx/renderer';
import type { TouchMode } from '@engine/save/settings';
import { nextTouchMode } from '@engine/input/touch-logic';
import { trainFromPause, trainingOffered } from '../tutorial/training';
import { endStageRound } from '../arena/stage-round';
import { lastTipsItem } from '../tutorial/last-tips';
import { guidePages, TutorialBoxScene } from '../tutorial/original-tutorials';

/** A Classic mode run's pause (not an editor play-test's): the original's short pause, in boxes. */
const classicPause = (game: Game) => game.classicRun && !game.playtestDone;

const TOUCH_MODE_LABELS: Record<TouchMode, string> = { auto: 'Auto', on: 'On', off: 'Off' };

export class PauseScene extends MenuScene {
  constructor(
    game: Game,
    private readonly world: World | null = null,
  ) {
    // v0.4.73 item 54: the Classic pause is a CLASSIC box (PauseMenu.as, a MenuBox), and BACK
    // closes it as the original's cancel does; every page opened from it is a box too
    // (MenuScene.pushedOver). The campaign's pause is as it was (no BACK, the panel).
    super(game, 'PAUSE', [], classicPause(game) ? () => game.scenes.pop() : null, true);
    if (classicPause(game)) this.boxStyle();
    this.rebuild();
  }

  /** The original's pause box has no title row (PauseMenu.as). */
  protected override boxHeader(): string | null {
    return null;
  }

  /** The menu, with the short SMBC REMIX logo in the panel's bottom right corner. */
  override render(r: Renderer): void {
    super.render(r);
    if (!this.boxed) r.sprite(this.game.ctx.assets.sheet('title-logo'), 'smbc-line', 146, 200);
  }

  /**
   * v0.4.73 item 67: back from Dev mode > Dev mode off. Its rows go, so the cursor goes to
   * Continue (where the pause opens), and the page says so.
   */
  devModeOff(): void {
    this.rebuild();
    this.index = 0;
    const it = this.items[0];
    this.game.deps.announcer?.say(`Dev mode off. ${it ? it.label : ''}`.trim());
  }

  private rebuild(): void {
    const game = this.game;
    const items: MenuItem[] = [{ label: 'Continue', select: () => game.scenes.pop() }];
    this.entryTitle = null;
    // A Classic mode run: the original's short pause, plus every developer row while dev mode is on.
    if (classicPause(game)) {
      // 38f: it opens saying its name, then the focused row ("Paused. Continue").
      this.entryTitle = 'Paused';
      items.push(...this.reserveItem());
      // v0.4.73 item 55: the Guide is the original's tutorial boxes for the hero played.
      items.push(...this.classicGuideItems());
      items.push({
        label: 'Options',
        // 38f review: BACK says the pause's focused row again.
        select: () => game.scenes.push(new OptionsScene(game, () => backToMenu(game), true, true)),
      });
      // v0.4.73 item 94 (owner): no Level Select cheat row (PauseMenu.as:37-38 had one).
      items.push(...this.devItems());
      // The cheats mid-run (G-031: the original's Pause > Options > Cheats): the unlocked ones,
      // with Classic rules (the only rules cheats play under). Invincible and the assist-like
      // cheats apply at once; Water Mode floods the paused level at once.
      if (!game.devMode && game.cheatsLive)
        items.push({
          label: 'Cheats',
          select: () =>
            game.scenes.push(
              new CheatsScene(game, () => game.scenes.pop(), {
                all: false,
                world: this.world,
                translucent: true,
              }),
            ),
          hint: 'Turn the cheats you have unlocked on or off',
        });
      // Developer mode: every cheat, at once (owner decision; Classic mode's Cheats page).
      if (game.devMode)
        items.push({
          label: 'Cheats',
          select: () =>
            game.scenes.push(
              new CheatsScene(game, () => game.scenes.pop(), {
                all: true,
                world: this.world,
                translucent: true,
              }),
            ),
          hint: 'Every original cheat, in developer mode',
        });
      // v0.4.73 (item 60): a CLEARED file's replay, beaten on Hard: its Advanced cheats.
      // Item 134: only while the slot still holds the file the replay was made for.
      const rp = game.replayRun;
      if (rp && game.advancedCheatsOf(rp.ref, rp.fp))
        items.push(advancedCheatsItem(game, rp.ref, undefined, rp.fp));
      if (game.stageRound) items.push(this.giveUp());
      // O-16: Quit asks first (NO / YES), then goes to the CLASSIC menu.
      items.push({
        label: 'Quit',
        // 38f: NO says "Paused." and the focused row (Quit), as the pause opens.
        select: () => confirmQuitRun(game, null),
        // G-008, B-L: the run's file holds this level's start, only when the run has one
        // (Game.keepsResume: not a developer, link or practice run).
        hint: game.replayRun
          ? // v0.4.73 (owner 97a): a CLEARED file's replay goes back to its file box.
            'Back to the file box; the file stays cleared'
          : game.keepsResume
            ? 'Back to the Classic menu; your file picks the run up from this level'
            : 'Back to the Classic menu',
      });
      this.setItems(items);
      return;
    }
    // A stage tutorial (1-0): its last three tips, read again (0.4.43).
    if (game.tutorialRun) items.push(...lastTipsItem(game, this.world));
    // The hero's own guide (and player two's in co-op).
    const heroes = [game.state.character, ...(game.state.character2 ? [game.state.character2] : [])];
    const world = this.world;
    items.push(...this.guideItems());
    // Campaign levels: replay the hero's training stage, then back to this paused level.
    if (world)
      heroes.forEach((c, i) => {
        if (!trainingOffered(game, c)) return;
        items.push({
          label: 'Training',
          ...(heroes.length > 1 ? { value: () => c.name } : {}),
          select: () => trainFromPause(game, c, i),
          hint: `Practise ${c.name}'s moves in a training stage`,
        });
      });
    items.push(...this.reserveItem());
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
    items.push(...this.devItems());
    // A stage played as an arena round (arena/stage-round.ts): Give up ends the round, nothing else.
    if (game.stageRound) {
      items.push(this.giveUp());
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
        select: () => {
          if (game.playtestDone) game.playtestDone();
          // v0.4.73 items 63 / 64: a dev START page start goes back to Dev > Level select.
          else if (!game.backToLevelSelect()) game.showTitle();
        },
        ...(game.levelSelectBack && !game.playtestDone ? { hint: 'Back to the level select' } : {}),
      });
    this.setItems(items);
  }

  /** The guide of each hero being played (the def for the World's rules, TG-19), player two's too. */
  private guideItems(): MenuItem[] {
    const game = this.game;
    const heroes = [game.state.character, ...(game.state.character2 ? [game.state.character2] : [])];
    return heroes.map((c, i) => {
      const def = this.world?.players[i]?.def ?? c;
      return {
        label: heroes.length > 1 ? `Guide: ${def.name}` : 'Guide',
        select: () => game.scenes.push(new GuideScene(game, def, () => game.scenes.pop())),
      };
    });
  }

  /**
   * v0.4.73 item 55 (owner): the Classic pause's Guide opens the original's tutorial boxes
   * (TutorialBoxScene) for the hero being played (player two's too): its start box, then the
   * boxes of what its Mushroom and Fire Flower bring (original-tutorials.ts guidePages). Each page
   * is read out and waits for a press; after the last the pause says its Guide row again.
   */
  private classicGuideItems(): MenuItem[] {
    const game = this.game;
    const heroes = [game.state.character, ...(game.state.character2 ? [game.state.character2] : [])];
    return heroes.map((c, i) => {
      const def = this.world?.players[i]?.def ?? c;
      const hero = game.slotOf(def).id;
      return {
        label: heroes.length > 1 ? `Guide: ${def.name}` : 'Guide',
        select: () => game.scenes.push(new TutorialBoxScene(game, guidePages(game, hero), null)),
        hint: `${def.name}'s tutorial`,
      };
    });
  }

  /** Stored items (E-tanks) are used from here, like the original weapon menu. */
  private reserveItem(): MenuItem[] {
    const world = this.world;
    const p = world?.player;
    const reserve = p?.def.reserve;
    const label = p && reserve ? reserve.label(p) : null;
    if (!world || !p || !reserve || !label) return [];
    return [
      {
        label,
        select: () => {
          if (reserve.use(p, world)) this.game.scenes.pop();
        },
      },
    ];
  }

  /** The developer rows: Dev mode's menu, and the assists on their own (campaign, Classic run). */
  private devItems(): MenuItem[] {
    const game = this.game;
    const items: MenuItem[] = [];
    if (this.showDev)
      items.push({ label: 'Dev mode', select: () => game.scenes.push(new DevMenuScene(game, true)) });
    // In campaign play dev mode offers only the assists (no level select, which would leave the file).
    if (this.showAssists)
      items.push({
        label: 'Assists',
        select: () => game.scenes.push(new AssistOptionsScene(game, () => backToMenu(game))),
      });
    return items;
  }

  private giveUp(): MenuItem {
    return { label: 'Give up', select: () => endStageRound(this.game, 'quit'), hint: 'Ends the round' };
  }

  /** Dev mode's full menu (level select, dev mode off) stays out of campaign play. */
  private get showDev(): boolean {
    return this.game.devMode && !this.game.campaign && !this.game.stageRound;
  }

  /** Campaign play in dev mode gets the assists on their own. */
  private get showAssists(): boolean {
    return this.game.devMode && (!!this.game.campaign || this.game.classicRun);
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
