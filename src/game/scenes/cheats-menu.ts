import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { TouchLabels } from '@engine/input/touch';
import { saveSettings, type ClassicCheatId, type ClassicCheatsSettings } from '@engine/save/settings';
import { MenuScene, type MenuItem } from './menu';
import { demoUnder, renderBoxedMenu } from './original-box-menu';
import type { Game } from './game';
import type { World } from '../world/world';
import { CardScene } from './message';
import { CheatCode, DEV_CODE } from './cheat';
import { abilityHint } from './hints';
import { wrapText } from '../hud/text';
import { CHEATS, allUnlocked, lockedText, unlockAll, type CheatInfo } from '../cheats';
import { NO_TOUCH_BUTTONS } from '../touch-labels';
import { LevelSelectScene } from './level-select-cheat';

/** What a locked row shows in place of its name (MenuBoxItems.HIDDEN_CHEAT). */
export const HIDDEN_CHEAT = '?????';

/** Columns of a goal card's lines (the panel's inside, with a margin). */
const CARD_COLS = 26;

/**
 * Classic mode's Cheats page (CheatMenu.as): every cheat with On / Off, a locked one as ?????
 * whose row tells how to unlock it, Enter code (the original's code unlocks them all) while any
 * is locked, and Back. Reached from CLASSIC > Options (the unlocked ones) and, in developer
 * mode, from the Classic pause menu, where `all` makes every cheat available. A toggle is saved
 * and read out at once; `world` (the paused level) takes Water Mode at once, as
 * Level.forceWaterLevel; the other level-edit cheats start with the next area.
 */
export class CheatsScene extends MenuScene {
  /** Entering the code: the presses so far (CheatMenu.beginEnteringCode). */
  private code: CheatCode | null = null;
  private codeAt = 0;

  constructor(
    game: Game,
    onBack: () => void,
    private readonly opts: { all: boolean; world?: World | null; translucent?: boolean },
  ) {
    super(game, 'CHEATS', [], onBack, opts.translucent === true);
    if (this.over) {
      this.translucent = true;
      this.moveSfx = 'fireball';
      this.backSfx = 'bump';
      this.adjustSfx = 'coin';
      this.okAdjustSfx = 'coin';
    }
    this.rebuild();
  }

  /** BUG-01: the CLASSIC title it is a box over (from CLASSIC > Options), else null. */
  private readonly over = demoUnder(this.game);

  private get store(): ClassicCheatsSettings | null {
    return this.game.deps.settings?.classicCheats ?? null;
  }

  private open(id: ClassicCheatId): boolean {
    return this.opts.all || this.store?.unlocked[id] === true;
  }

  private rebuild(): void {
    const c = this.store;
    const items: MenuItem[] = [];
    if (c)
      for (const info of CHEATS)
        items.push(this.open(info.id) ? this.cheatRow(c, info) : this.lockedRow(c, info));
    if (c && !this.opts.all && !allUnlocked(c))
      items.push({
        label: 'Enter code',
        select: () => this.beginCode(),
        hint: 'Enter the secret code to unlock every cheat',
      });
    // The Level Select cheat once unlocked (G-007): its page. Mid-run it goes on from there.
    if (c?.levelSelect)
      items.push({
        label: 'Level select',
        select: () =>
          this.game.scenes.push(
            new LevelSelectScene(this.game, () => this.game.scenes.pop(), this.opts.translucent === true),
          ),
        hint: 'Start any level of any map set, on any difficulty',
      });
    items.push({ label: 'Back', select: () => this.onBack?.() });
    this.setItems(items);
    this.status = this.opts.all ? 'Dev mode: all cheats' : '';
  }

  private cheatRow(c: ClassicCheatsSettings, info: CheatInfo): MenuItem {
    const toggle = () => {
      const on = !c.on[info.id];
      c.on[info.id] = on;
      this.save();
      // Water Mode floods (or drains) the paused level at once (CheatMenu: forceWaterLevel).
      if (info.id === 'waterMode' && this.opts.world?.rules === 'classic') this.opts.world.setWaterMode(on);
    };
    return {
      label: info.name,
      value: () => (c.on[info.id] ? 'On' : 'Off'),
      adjust: toggle,
      hint: info.what,
    };
  }

  private lockedRow(c: ClassicCheatsSettings, info: CheatInfo): MenuItem {
    return {
      label: HIDDEN_CHEAT,
      select: () => this.showGoal(c, info),
      hint: `Locked cheat. ${lockedText(c, info.id)}`,
    };
  }

  /** A locked row picked: its unlock goal on a card (CheatMenu.chooseItem's PlainMessageBox). */
  private showGoal(c: ClassicCheatsSettings, info: CheatInfo): void {
    const lines = ['TO UNLOCK THIS CHEAT:', '', ...wrapText(lockedText(c, info.id).toUpperCase(), CARD_COLS)];
    this.game.deps.announcer?.say(`To unlock this cheat: ${lockedText(c, info.id)} OK to go back.`);
    this.game.scenes.push(
      new CardScene(
        this.game,
        lines,
        () => {
          this.game.scenes.pop();
          this.announce();
        },
        null,
        {
          panel: true,
          overlay: true,
          keys: ['start', 'attack', 'jump'],
          prompt: () => abilityHint(this.game, 'OK', 'jump'),
        },
      ),
    );
  }

  private save(): void {
    const s = this.game.deps.settings;
    if (s) saveSettings(s);
  }

  /** Enter code: the next ten presses are the code (CheatMenu.captureInput). */
  private beginCode(): void {
    this.code = new CheatCode(DEV_CODE);
    this.codeAt = 0;
    this.backAction = 'select';
    // The key that goes BACK while the code is taken (SELECT's), named as the page's hint names it.
    this.game.deps.announcer?.say(`Enter the code. ${abilityHint(this.game, 'BACK', 'select')} to stop.`);
  }

  private endCode(): void {
    this.code = null;
    this.backAction = 'attack';
  }

  override touchLabels(): TouchLabels {
    if (!this.code) return super.touchLabels();
    // Select is no part of the code: it is the way out (BACK), on touch too.
    return { ...NO_TOUCH_BUTTONS, jump: 'JUMP', attack: 'ATTACK', select: 'BACK' };
  }

  override update(input: InputFrame): void {
    this.over?.tickDemo();
    if (!this.code) {
      super.update(input);
      return;
    }
    this.t++;
    const pressed = (
      ['up', 'down', 'left', 'right', 'jump', 'attack', 'special', 'start', 'select'] as const
    ).filter((a) => input.pressed(a));
    if (!pressed.length) return;
    // Select (BACK) leaves the code entry, back to the menu (the code's B and A are Attack, Jump).
    if (pressed.includes('select')) {
      // The original's way out of the code (cancelCodeInput) plays the bump (SFX_GAME_HIT_CEILING).
      this.endCode();
      this.game.ctx.audio.sfx('bump');
      this.game.deps.announcer?.say('Back. Enter code.');
      return;
    }
    // Any press off the code ends it (cancelCodeInput); the whole code unlocks every cheat.
    for (const a of pressed) {
      if (a !== DEV_CODE[this.codeAt]) {
        this.endCode();
        this.game.ctx.audio.sfx('bump');
        this.game.deps.announcer?.say('Wrong code.');
        return;
      }
      this.codeAt++;
    }
    if (this.codeAt < DEV_CODE.length) return;
    this.endCode();
    const c = this.store;
    if (c) {
      unlockAll(c);
      this.save();
    }
    this.game.ctx.audio.sfx('1up');
    this.rebuild();
    this.index = 0;
    this.game.deps.announcer?.say('Every cheat is unlocked.');
  }

  override render(r: Renderer): void {
    if (this.over) {
      renderBoxedMenu(r, this.game, {
        backAction: this.backAction,
        header: this.title,
        items: this.items,
        index: this.index,
        t: this.t,
        // The code prompt in the status line's place while it is being entered.
        status: this.code ? 'Enter the code' : this.status,
        age: this.t,
      });
      return;
    }
    super.render(r);
    if (!this.code) return;
    const font = this.game.ctx.assets.sheet('font');
    const msg = 'ENTER THE CODE';
    r.text(font, msg, 128 - msg.length * 4, this.translucent ? 184 : 200);
  }

  override enter(): void {
    this.rebuild();
    const it = this.items[this.index];
    if (!it) return;
    const v = it.value ? `: ${it.value()}` : '';
    const line =
      it.label === HIDDEN_CHEAT ? (it.hint ?? 'Locked cheat') : `${it.label}${v}. ${it.hint ?? ''}`;
    this.game.deps.announcer?.say(`Cheats. ${line.trim()}`);
  }

  /** Reads a locked row as "Locked cheat", never as its question marks. */
  protected override announce(): void {
    const it = this.items[this.index];
    if (it?.label === HIDDEN_CHEAT) {
      this.game.deps.announcer?.say(it.hint ?? 'Locked cheat');
      return;
    }
    super.announce();
  }
}
