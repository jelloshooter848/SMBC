import type { Renderer } from '@engine/gfx/renderer';
import type { InputFrame } from '@engine/input/input-manager';
import type { Scene } from '@engine/scene';
import type { Game } from './game';
import { MenuScene } from './menu';
import { guideHeroes } from './guide';
import type { DemoBackdrop } from './original-box-menu';
import { guidePages, TutorialBoxScene } from '../tutorial/original-tutorials';

/*
 * v0.4.73 item 82 (owner): Classic mode's Options > How to play (CLASSIC > Options > Video, audio,
 * controls, and the Classic pause's Options) is a CLASSIC box of the Classic select's heroes
 * (guideHeroes, as GuideIndexScene lists them), each opening the original's tutorial boxes for that
 * hero (TutorialBoxScene, guidePages): the screens the Classic pause's Guide shows for the hero
 * played (item 55). Over the Classic pause it is a box over the paused level (MenuScene.boxStyle);
 * from the CLASSIC menu, a box under the CLASSIC logo over the title's demo, which plays on. The
 * campaign's Options keep GuideIndexScene and GuideScene.
 */

const isBackdrop = (s: Scene): s is Scene & DemoBackdrop =>
  (s as Partial<DemoBackdrop>).classicBackdrop === true;

export class ClassicTutorialHeroesScene extends MenuScene {
  /** The CLASSIC title drawn round the box (from the CLASSIC menu), else null (over the level). */
  private backdrop: (Scene & DemoBackdrop) | null = null;

  constructor(game: Game, onBack: () => void) {
    super(game, 'HOW TO PLAY', [], onBack);
    this.entryTitle = 'How to play';
    const { heroes } = guideHeroes(game, true);
    this.setItems([
      ...heroes.map((c) => ({
        label: c.name,
        select: () => game.scenes.push(new TutorialBoxScene(game, guidePages(game, game.slotOf(c).id), null)),
        hint: `${c.name}'s tutorial`,
      })),
      { label: 'Back', select: onBack },
    ]);
    this.boxStyle();
  }

  /**
   * Over a CLASSIC box (the Classic pause's pages) it is one more box over the level. Anywhere else
   * (the full-screen Options page of the CLASSIC menu) it draws the CLASSIC title round itself.
   */
  override pushedOver(below: Scene | undefined): void {
    super.pushedOver(below);
    if (below instanceof MenuScene && below.boxed) return;
    this.backdrop = (this.game.scenes.find(isBackdrop) as (Scene & DemoBackdrop) | undefined) ?? null;
    this.translucent = false;
  }

  protected override boxCentre(): number | null {
    return this.backdrop ? null : super.boxCentre();
  }

  override update(input: InputFrame): void {
    this.backdrop?.tickDemo();
    super.update(input);
  }

  override render(r: Renderer): void {
    if (!this.translucent) {
      if (this.backdrop) this.backdrop.render(r);
      else r.clear('#000');
    }
    super.render(r);
  }
}
