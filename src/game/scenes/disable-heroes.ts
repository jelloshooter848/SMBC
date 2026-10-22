import { saveSettings } from '@engine/save/settings';
import { MenuScene, type MenuItem } from './menu';
import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import { demoUnder, renderBoxedMenu } from './original-box-menu';
import type { Game } from './game';

/**
 * Classic mode's Disable heroes (G-032; the original's General > Disable characters,
 * GeneralOptions.as 23, 47-53, CharacterSelectBox.as 684-697): every select-slot hero with On or
 * Off. An Off hero leaves the select, the Random slot and Single random (Game.heroSlots). The
 * last hero on cannot be turned off, as the original keeps one. Saved at once.
 */
export class ClassicHeroesScene extends MenuScene {
  /** BUG-01: the CLASSIC title it is a box over (null: a full-screen page). */
  private readonly over = demoUnder(this.game);

  constructor(game: Game, onBack: () => void) {
    super(game, 'DISABLE HEROES', [], onBack);
    if (this.over) {
      this.translucent = true;
      this.moveSfx = 'fireball';
      this.backSfx = 'bump';
      this.adjustSfx = 'coin';
      this.okAdjustSfx = 'coin';
    }
    this.build();
  }

  /** The demo under the box plays on while it is up. */
  override update(input: InputFrame): void {
    this.over?.tickDemo();
    super.update(input);
  }

  override render(r: Renderer): void {
    if (!this.over) return super.render(r);
    renderBoxedMenu(r, this.game, {
      backAction: this.backAction,
      header: this.title,
      items: this.items,
      index: this.index,
      t: this.t,
      status: this.status,
      age: this.t,
    });
  }

  private get off(): string[] {
    return this.game.deps.settings?.classicHeroesOff ?? [];
  }

  private build(): void {
    const game = this.game;
    const rules = game.classicRules;
    const heroes = game.slotsFor(rules);
    const items: MenuItem[] = heroes.map((c) => ({
      label: c.name,
      value: () => (this.off.includes(c.id) ? 'Off' : 'On'),
      adjust: () =>
        this.toggle(
          c.id,
          heroes.map((h) => h.id),
        ),
      hint: 'Off leaves this hero out of the select and Random',
    }));
    items.push({ label: 'Back', select: () => this.onBack?.() });
    this.setItems(items);
  }

  private toggle(id: string, all: readonly string[]): void {
    const s = this.game.deps.settings;
    if (!s) return;
    const off = new Set(s.classicHeroesOff ?? []);
    if (off.has(id)) off.delete(id);
    else {
      // GeneralOptions: at least one hero stays.
      const on = all.filter((h) => !off.has(h) && h !== id);
      if (on.length === 0) {
        this.status = 'One hero must stay on';
        this.game.ctx.audio.sfx('bump');
        this.game.deps.announcer?.say('One hero must stay on.');
        return;
      }
      off.add(id);
    }
    this.status = '';
    if (off.size) s.classicHeroesOff = [...off];
    else delete s.classicHeroesOff;
    saveSettings(s);
  }

  override enter(): void {
    const it = this.items[this.index];
    const v = it?.value ? `: ${it.value()}` : '';
    this.game.deps.announcer?.say(`Disable heroes. ${it?.label ?? ''}${v}. ${it?.hint ?? ''}`.trim());
  }
}
