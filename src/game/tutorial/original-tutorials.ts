import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Action } from '@engine/input/actions';
import type { Renderer } from '@engine/gfx/renderer';
import type { TouchLabels } from '@engine/input/touch';
import { SCREEN_H, SCREEN_W } from '@engine/viewport';
import { saveSettings } from '@engine/save/settings';
import { defaultClassicWeapons } from '@engine/save/original-options';
import type { Game } from '../scenes/game';
import type { World } from '../world/world';
import type { Player } from '../entities/player';
import { abilityHint } from '../scenes/hints';
import { BOX_FRAME, BOX_GROW_PER_FRAME, DEFAULT_SELECT_THEME, drawScaledPanel } from '../scenes/select-grid';
import { fontText } from '../hud/text';
import { NO_TOUCH_BUTTONS } from '../touch-labels';
import { wrapPrompt } from './stage-prompts';

/*
 * Classic mode's Tutorials (O-15 / G-042): the original's TutorialManager (managers/
 * TutorialManager.as 41-258, 276-341), behind its General > Tutorials setting (GeneralOptions.as
 * 25), which is off by default (GameSettings.as 89). With it on, a box of the original's own words
 * (the source is MIT) comes up at the hero select, at the first level start, at each hero's first
 * start, and at each Mushroom, Fire Flower upgrade and Star the first time: each page waits for a
 * press (never a timer), is read out, and works with touch (OK), keys and pad. Each box shows once
 * per game, as the original keeps its "enabled" flags in the save and turns them all back on for a
 * new game (saveData, loadData, startNewGameHandler): Settings.classicTutorialsSeen, cleared by a
 * new Classic game. Never in the campaign, never in an editor play-test.
 *
 * The words are the original's, changed only where our rules ask: they name abilities ({JUMP},
 * {ATTACK}, ...: filled in with the ability and the real key or pad button, input-aware, as every
 * hint is) instead of keys, and drop what is not true here (the pause menu's save and load and
 * its music consoles, the Exploding Rabbit website and forum).
 */

/** The generic ability names a box's words use, by placeholder: the ability shown, and its action. */
const ABILITIES: Readonly<Record<string, readonly [string, Action]>> = {
  JUMP: ['JUMP', 'jump'],
  ATTACK: ['ATTACK', 'attack'],
  SPECIAL: ['SPECIAL', 'special'],
  TOOLS: ['TOOLS', 'select'],
  MENU: ['MENU', 'start'],
  OK: ['OK', 'jump'],
  DONE: ['DONE', 'attack'],
};

/** The actions a `{NAME:action}` placeholder may name. */
const ACTIONS: readonly Action[] = ['jump', 'attack', 'special', 'select', 'start'];

/** Mega Man's weapons' button names (megaman/classic-weapons.ts MM_WEAPONS' labels). */
const MM_LABELS: Readonly<Record<string, string>> = {
  'metal-blade': 'BLADE',
  'super-arm': 'ARM',
  'hard-knuckle': 'KNUCKLE',
  'pharaoh-shot': 'PHARAOH',
  'charge-kick': 'KICK',
  'flame-blast': 'FLAME',
  'magma-bazooka': 'MAGMA',
  'water-shield': 'SHIELD',
  'screw-crusher': 'SCREW',
};
/** Ryu's arts' button names (ryu/classic-weapons.ts). */
const RYU_LABELS: Readonly<Record<string, string>> = {
  shuriken: 'SHURIKEN',
  windmill: 'WINDMILL',
  'fire-wheel': 'WHEEL',
  'dragon-ball': 'DRAGON',
  'jump-slash': 'SPIN',
};
/** Simon's sub-weapons' button names (simon/index.ts SIMON_TOOL_LABELS). */
const SIMON_LABELS: Readonly<Record<string, string>> = {
  dagger: 'DAGGER',
  'hand-axe': 'AXE',
  'holy-water': 'WATER',
  cross: 'CROSS',
  stopwatch: 'WATCH',
};

/**
 * The `{=name}` placeholders: a button whose name (and, for Ryu's Jump Slash, place) follows the
 * Customize Weapons choice and the hero, as the hero's touch buttons do.
 */
function dynamicAbility(
  game: Game,
  name: string,
  hero: string | undefined,
): readonly [string, Action] | null {
  const w = game.deps.settings?.classic.weapons ?? defaultClassicWeapons();
  switch (name) {
    case 'link-tool':
      return [w.link === 'bow' ? 'BOW' : 'BOMB', 'select'];
    case 'weapon':
      // Bass's Flower weapon (his own Water Shield button reads WATER), else Mega Man's.
      if (hero === 'bass')
        return [w.bass === 'water-shield' ? 'WATER' : (MM_LABELS[w.bass] ?? 'WEAPON'), 'special'];
      return [MM_LABELS[w.megaman] ?? 'WEAPON', 'special'];
    case 'ryu-art':
      return [RYU_LABELS[w.ryuStart] ?? 'SPECIAL', 'special'];
    case 'ryu-slash':
      return w.ryuStart === 'jump-slash' ? ['SPIN', 'special'] : ['SPIN', 'select'];
    case 'simon-start':
      return [SIMON_LABELS[w.simonStart] ?? 'SPECIAL', 'special'];
    case 'sophia-missile':
      return [w.sophia === 'homing' ? 'HOMING' : 'MISSILE', 'special'];
    default:
      return null;
  }
}

/**
 * The `[[name|words]]` (or `[[!name|words]]`) conditions: the words show only when the condition
 * holds (or does not) for the hero's kit and the Customize Weapons choice.
 */
function condition(game: Game, name: string, hero: string | undefined): boolean {
  const w = game.deps.settings?.classic.weapons ?? defaultClassicWeapons();
  switch (name) {
    case 'swap':
      // Every Flower weapon swaps buttons with the buster but the Charge Kick (megaman/classic.ts).
      return (hero === 'bass' ? w.bass : w.megaman) !== 'charge-kick';
    case 'bass':
      return hero === 'bass';
    case 'ryu-slash-art':
      return w.ryuStart === 'jump-slash';
    default:
      return false;
  }
}

/**
 * Each box's pages (TutorialManager's *_MSG arrays), by the original's name for it: a hero's start
 * is `<hero id>Start`, Mega Man's Mushroom `megamanPowerUp`, an upgrade its PickupInfo name. A
 * hero's own box names its buttons as its touch buttons do: `{SHOOT:attack}` is the ability SHOOT
 * on the attack action, `{=link-tool}` a name that follows the weapon choice (dynamicAbility).
 *
 * Where our Classic heroes play differently from the words (our buttons, our kits), the words say
 * what ours do; directions are UP, DOWN, LEFT and RIGHT, or "away from" / "toward" a wall.
 */
export const TUTORIAL_TEXT: Readonly<Record<string, readonly string[]>> = {
  characterSelect: ['Use the directions to move the cursor, and press {OK} to select a character.'],
  firstCharacterStart: [
    'Each character controls just like they do in their own games. Use the directions to move, and press {JUMP} to jump and {ATTACK} to attack. Hold {ATTACK} to run with Mario and Luigi.',
    'Some skins control a bit differently than the base character. The descriptions for the differences can be seen on the skin selection menu.',
    'Note that of the original heroes, only Mario and Luigi can jump on enemies. Some heroes also have a second attack and a tool button: the guide in the pause menu names them.',
    'You can pause the game by pressing {MENU}. In the pause menu, you can change several options.',
    'Also, playing with a gamepad is highly recommended.',
  ],
  survival: [
    'Survival mode:\nWhen a character dies in this mode, they will be unusable until you revive them. Reviving a character costs one life. To revive a character, select the character and press {OK}.',
    'If you revive a character that is already alive, that character will gain 2 random power ups plus ammo. You will only be able to revive characters when you enter a new world (after a bowser level).',
    "When you're done reviving characters, press {DONE} to enter character select mode.",
  ],
  star: [
    'A star will give you temporary invincibility. All characters have infinite ammo for the duration of the star.',
  ],
  cheat: [
    'Cheats can be unlocked by meeting certain conditions. To find out the required conditions for a cheat, pause the game, go into the cheats menu and select a locked cheat.',
  ],
  mushroom: [
    'Mushroom:\nA mushroom gives you an extra hit and enhances most characters. By default, if you take damage you will lose the mushroom and some upgrades you collected. You can get most of them back by collecting another mushroom.',
  ],
  bassStart: [
    'Bass:\nPress DOWN and {JUMP} to dash. Bass can perform a dash jump if you jump while dashing. Bass can also double jump in the air. Hold {SHOOT:attack} for rapid fire.',
    'With a fire flower, press {=weapon} to use his weapon.[[swap| Press {SWAP:select} to swap the shot and weapon buttons.]]',
  ],
  billStart: [
    'Bill:\nBill can shoot in different directions if you hold UP and DOWN while moving. With only his rifle, he will be killed in one hit.',
  ],
  linkStart: [
    'Link:\nWhile in the air, Link can perform an upward thrust or downward thrust by pressing UP or DOWN.',
    'He can throw his boomerang to stun enemies and grab items by pressing {BOOMERANG:special}. Once he has bombs or a bow, press {=link-tool} to use them.',
  ],
  linkBlueRing: ["Blue Ring:\nThe blue ring makes Link's sword stronger."],
  linkBow: ['Bow and Arrows:\nPress {BOW:select} to shoot an arrow across the screen.'],
  linkBomb: [
    'Bomb:\nPress {BOMB:select} to place a bomb. It will explode after a short time. Link is never hurt by his own bombs.',
  ],
  linkBombBag: ["Bomb Bag:\nThe bomb bag increases Link's bomb capacity."],
  linkQuiver: ["Quiver:\nThe quiver increases Link's arrow capacity."],
  linkRedRing: ['Red Ring:\nThe red ring allows Link to shoot sword beams across the screen.'],
  luigiStart: [
    'Luigi:\nLuigi can run if you hold {RUN:attack} while moving. If he has firepower, press {FIRE:attack} to throw fireballs.',
    'He controls similarly to Mario, but his controls are more loose and he can jump higher.',
  ],
  marioStart: [
    'Mario:\nMario can run if you hold {RUN:attack} while moving. If he has firepower, press {FIRE:attack} to throw fireballs.',
  ],
  megamanStart: [
    'Mega Man:\nMega Man can slide by pressing DOWN and {JUMP} while on the ground. With a fire flower, press {=weapon} to use his weapon.[[swap| Hold {RUSH:select} to swap the shoot and weapon buttons.]]',
    'Mega Man begins with Rush Coil, which can be used to help Mega Man make some long or high jumps. Tap {RUSH:select} to call Rush.',
  ],
  megamanPowerUp: [
    'When Mega Man has a mushroom, hold {SHOOT:attack} to charge up his mega buster.',
    "Note that some Mega Man skins can't charge up their mega buster.",
  ],
  megamanChargeKick: [
    'Charge Kick:\nIt is on: press DOWN and {JUMP} to damage enemies while [[bass|dashing]][[!bass|sliding]]. Press {=weapon} to turn it off or on.',
  ],
  megamanHardKnuckle: [
    'Hard Knuckle:\nWhile the hard knuckle is on the screen, press UP or DOWN to move it up or down.',
  ],
  megamanMetalBlade: ['Metal Blade:\nMetal blades can be thrown in 8 directions.'],
  megamanPharaohShot: ['Pharaoh Shot:\nYou can hold {=weapon} to charge up the pharaoh shot.'],
  megamanSuperArm: [
    'Super Arm:\nPress {=weapon} when touching a brick to pick it up. Press {=weapon} again to throw it.',
  ],
  megamanWaterShield: [
    'Water Shield:\nPress {=weapon} to form a shield around you. Press {=weapon} again to shoot the shield outward.',
  ],
  ryuStart: [
    'Ryu:\nRyu can climb any wall by jumping toward it. While climbing, press away from the wall and {JUMP} to jump backwards off a wall, or press DOWN and {JUMP} to detach from a wall.',
    "If you're near the top of a wall, press {JUMP} to jump on top of it. [[!ryu-slash-art|Press {=ryu-art} to throw special weapons when you have enough ammo.]][[ryu-slash-art|Press {=ryu-art} in the air for the jump slash when you have enough ammo.]]",
  ],
  ryuJumpSlash: ['Jump Slash:\nPress {=ryu-slash} while in the air to use the jump slash.'],
  ryuScroll: ["Scroll:\nThe scroll increases Ryu's ammo capacity."],
  samusStart: [
    'Samus:\nSamus can shoot upward while standing, running, and jumping. Press DOWN while crouching to turn into the morph ball. While in morph ball state, you can set bombs with {BOMB:attack}.',
  ],
  samusIceBeam: [
    'Ice Beam:\nShooting enemies with the ice beam will freeze them in place for a short time. Frozen enemies can be used as platforms.',
  ],
  samusWaveBeam: [
    'Wave Beam:\nThe wave beam arcs up and down as it travels across the screen and passes through walls and pipes.',
  ],
  samusScrewAttack: ['Screw Attack:\nScrew attack causes spin jumps to damage enemies.'],
  samusMissileExpansion: ["Missile Expansion:\nThe missile expansion increases Samus' ammo capacity."],
  simonStart: [
    'Simon:\nSimon can double jump if you press {JUMP} while in the air. Press {=simon-start} to use subweapons if you have enough ammo.',
  ],
  sophiaStart: ['Sophia:\nSophia can fire missiles with {=sophia-missile} when you have them.'],
  sophiaHomingMissile: ['Homing Missile:\nPress {HOMING:special} to fire a homing missile.'],
  sophiaWallClimb: [
    'Wall Climb:\nHold UP while driving into a wall to climb up it. Hold DOWN while driving off a cliff to climb down it.',
    'While climbing a wall, press {JUMP} to jump off and grapple to a nearby wall. To drop from a wall without jumping, hold the direction toward the wall and press {JUMP}.',
  ],
  sophiaCeilingClimb: [
    'Ceiling Climb:\nJump into a ceiling to grapple to it. To temporarily disable grapple, hold DOWN while in the air.',
  ],
  sophiaHover: [
    'Hover:\nPress and hold {JUMP} while in the air to hover. The hover bar will recharge over time.',
  ],
};

/** Every box's id (tests). */
export const TUTORIAL_IDS: readonly string[] = Object.keys(TUTORIAL_TEXT);

/**
 * A page's words with each placeholder filled in: the ability (the generic `{JUMP}`, the hero's own
 * `{SHOOT:attack}`, or `{=name}`, dynamicAbility for `hero`), then the real key in brackets on
 * keyboard and pad.
 */
export function fillAbilities(game: Game, text: string, hero?: string): string {
  const kept = text.replace(
    /\[\[(!?)([a-z-]+)\|([^\]]*)\]\]/g,
    (_all, not: string, name: string, words: string) =>
      condition(game, name, hero) !== (not === '!') ? words : '',
  );
  return kept.replace(
    /\{(=?)([A-Za-z-]+)(?::([a-z]+))?\}/g,
    (all, dyn: string, name: string, act?: string) => {
      const a = dyn
        ? dynamicAbility(game, name, hero)
        : act
          ? ACTIONS.includes(act as Action)
            ? ([name, act as Action] as const)
            : null
          : ABILITIES[name];
      return a ? abilityHint(game, a[0], a[1]) : all;
    },
  );
}

/** A Mega Man weapon's box id: `megaman` and the weapon in camel case (megamanMetalBlade). */
const mmBox = (weapon: string): string =>
  `megaman${weapon.replace(/(^|-)([a-z])/g, (_, _d, c: string) => c.toUpperCase())}`;

/**
 * What a hero's Classic power states bring that the original has a box for (the Classic power
 * kit, PS-C5, with the Customize Weapons choice): the Mushroom's, then the Fire Flower's. The
 * original shows these as each upgrade is collected (Character.hitPickup → checkTutorial).
 */
export function upgradeTutorials(game: Game, hero: string, state: 'big' | 'fire'): string[] {
  const w = game.deps.settings?.classic.weapons ?? defaultClassicWeapons();
  const big = state === 'big';
  switch (hero) {
    case 'link': {
      const bow = w.link === 'bow';
      return big
        ? ['linkBlueRing', bow ? 'linkBow' : 'linkBomb']
        : ['linkRedRing', bow ? 'linkQuiver' : 'linkBombBag'];
    }
    case 'samus':
      return big
        ? []
        : [w.samus === 'ice' ? 'samusIceBeam' : 'samusWaveBeam', 'samusScrewAttack', 'samusMissileExpansion'];
    case 'megaman':
      return big ? ['megamanPowerUp'] : [mmBox(w.megaman)];
    case 'bass':
      // Bass's Flower weapon is one of Mega Man's: the same box.
      return big ? [] : [mmBox(w.bass)];
    case 'ryu':
      return big ? [] : ['ryuScroll', ...(w.ryuExtra === 'jump-slash' ? ['ryuJumpSlash'] : [])];
    case 'sophia':
      return big
        ? ['sophiaHover']
        : [
            'sophiaWallClimb',
            'sophiaCeilingClimb',
            ...(w.sophia === 'homing' ? ['sophiaHomingMissile'] : []),
          ];
    default:
      return [];
  }
}

/** The boxes a hero's first level start shows: its own start, and a start weapon with a box. */
export function startTutorials(game: Game, hero: string): string[] {
  const w = game.deps.settings?.classic.weapons ?? defaultClassicWeapons();
  return [`${hero}Start`, ...(hero === 'ryu' && w.ryuStart === 'jump-slash' ? ['ryuJumpSlash'] : [])];
}

/** Frames a level start or an upgrade waits for the hero to land before its box shows anyway. */
const LAND_WAIT = 120;

/** What the level knew of player 1 last frame (a new state or Star shows its boxes). */
interface Watch {
  world: World;
  power: string;
  star: boolean;
}

/** Classic mode's Tutorials: the setting, the boxes seen this game, and their triggers. */
export class ClassicTutorials {
  /** Box ids waiting for the moment to show (TutorialManager.MSGS_TO_SHOW). */
  private readonly queue: string[] = [];
  /** The hero each queued box was offered for (its buttons' names follow that hero). */
  private readonly heroOf = new Map<string, string>();
  private watch: Watch | null = null;
  private wait = 0;

  constructor(private readonly game: Game) {}

  /** The Tutorials setting is on, outside the campaign and an editor play-test. */
  get enabled(): boolean {
    const g = this.game;
    return g.deps.settings?.classicTutorials === true && g.campaign === null && !g.playtestDone;
  }

  /** The boxes show now: the setting is on and a Classic mode run plays. */
  get on(): boolean {
    return this.enabled && this.game.classicRun;
  }

  /** The boxes shown this game. */
  get seen(): readonly string[] {
    return this.game.deps.settings?.classicTutorialsSeen ?? [];
  }

  /** A new Classic game: every box shows again (TutorialManager.startNewGameHandler). */
  newGame(): void {
    this.queue.length = 0;
    this.heroOf.clear();
    this.watch = null;
    const s = this.game.deps.settings;
    if (s?.classicTutorialsSeen) {
      delete s.classicTutorialsSeen;
      saveSettings(s);
    }
  }

  /** Queue box `id` unless it was seen this game, is queued, or has no words (checkTutorial). */
  offer(id: string, hero?: string): void {
    if (!this.enabled || !TUTORIAL_TEXT[id] || this.seen.includes(id) || this.queue.includes(id)) return;
    this.queue.push(id);
    if (hero) this.heroOf.set(id, hero);
  }

  /** Waiting boxes (tests). */
  get pending(): readonly string[] {
    return this.queue;
  }

  /** The queued boxes' pages, recorded as seen (saved at once, as the original's save keeps them). */
  private take(): string[] {
    const ids = this.queue.splice(0);
    const s = this.game.deps.settings;
    if (s && ids.length) {
      s.classicTutorialsSeen = [...new Set([...(s.classicTutorialsSeen ?? []), ...ids])];
      saveSettings(s);
    }
    const pages = ids.flatMap((id) =>
      (TUTORIAL_TEXT[id] ?? []).map((t) => fillAbilities(this.game, t, this.heroOf.get(id))),
    );
    this.heroOf.clear();
    return pages;
  }

  /** Push the queued boxes over the scene on top (it stays frozen beneath until the last page). */
  private show(world: World | null): void {
    const pages = this.take();
    if (pages.length) this.game.scenes.push(new TutorialBoxScene(this.game, pages, world));
  }

  /**
   * A Classic select screen opened (EventManager.characterSelectStart → characterSelect): the
   * select's box, or Survival's in Survival mode. It goes over the select at once. Only Classic
   * selects call it (Game.selectEntered), the first one of a run included (before classicRun).
   */
  atSelect(): void {
    if (!this.enabled) return;
    this.offer(this.game.survival !== null ? 'survival' : 'characterSelect');
    // Cheats unlocked by the clear are told on this select (Cheats.as 108: the cheat box follows).
    if (this.game.cheatUnlocks.length) this.offer('cheat');
    this.show(null);
  }

  /** A mid-level cheat unlock (Cheats.as: its card, then the cheat box once). */
  cheatUnlocked(): void {
    this.offer('cheat');
  }

  /**
   * Each frame of a Classic level, after the world's: the first start's and the hero's start
   * boxes (Level → TutorialManager.startLevel), the Mushroom's, each upgrade's and the Star's
   * (Character.hitPickup → checkTutorial) as player 1 reaches them. They show once nothing holds
   * play and the hero stands (or has been in the air a while), over the frozen level.
   */
  levelTick(world: World, scene: Scene): void {
    if (!this.on) return;
    const p = world.players[0];
    if (!p) return;
    const hero = this.game.slotOf(p.def).id;
    const w = this.watch;
    if (!w || w.world !== world) {
      this.watch = { world, power: p.powerState, star: p.star > 0 };
      this.offer('firstCharacterStart');
      for (const id of startTutorials(this.game, hero)) this.offer(id, hero);
    } else {
      if (p.powerState !== w.power) {
        const from = w.power;
        const to = p.powerState;
        if (to === 'big' && from === 'small') {
          this.offer('mushroom');
          for (const id of upgradeTutorials(this.game, hero, 'big')) this.offer(id, hero);
        } else if (to === 'fire') {
          if (from === 'small')
            for (const id of upgradeTutorials(this.game, hero, 'big')) this.offer(id, hero);
          for (const id of upgradeTutorials(this.game, hero, 'fire')) this.offer(id, hero);
        }
        w.power = to;
      }
      const star = p.star > 0;
      if (star && !w.star) this.offer('star');
      w.star = star;
    }
    if (!this.queue.length) return;
    if (!world.inControl || this.game.scenes.top !== scene) return;
    if (!steady(p) && ++this.wait <= LAND_WAIT) return;
    this.wait = 0;
    this.show(world);
  }
}

/** The hero stands, climbs, swims or clings, with no grow or shrink under way. */
function steady(p: Player): boolean {
  if (p.dead || p.out) return true;
  return (p.body.onGround || !!p.vine || !!p.stairs || p.inWater || p.clinging) && !p.transition;
}

/** Presses that turn a page: OK (JUMP), TALK (SPECIAL) or MENU. */
export const TUTORIAL_NEXT_KEYS: readonly Action[] = ['jump', 'special', 'start'];
/** The press that skips the box's remaining pages (they stay seen). */
export const TUTORIAL_SKIP_KEYS: readonly Action[] = ['attack'];

/**
 * The box's text block (PlainMessageBox): MessageBox END_WIDTH 400 at 512, halved, in 8 px
 * columns, left-aligned (DEFAULT_ALIGN), one line every 12 px (the menu font's 16 px and
 * TXT_LEADING 7, halved and rounded up).
 */
export const TUTORIAL_COLS = 25;
export const TUTORIAL_LINE = 12;
/**
 * Frames before a page takes a press: MessageBox's cancel timer (CANCEL_TMR_DUR 1000 ms) from the
 * moment it opens; it has finished growing by then.
 */
export const TUTORIAL_GUARD_FRAMES = 60;

/** Where a page stands: growing open, open (it waits for a press), or shrinking shut. */
type Phase = 'grow' | 'open' | 'shrink';

/**
 * One box (MessageBoxManager.tutorialStart's PlainMessageBox series): a page at a time, in a
 * MessageBox in the select's and menus' look (the SMB NES map skin: brick fill, bevel, rivets),
 * centred on the screen (DEF_POS_PNT, the stage centre) and as big as its words. Each page grows
 * open from its centre and shrinks shut after the press that closes it (MessageBox.grow, shrink;
 * the next page then grows); with Reduce flashing it simply appears and goes. There is no page
 * count or press mark on it, as on the original's. Each page is read out and waits for a press,
 * never a timer; SKIP closes the box at once. After the last page a select beneath is read out
 * again; a level is not (nothing it said is current).
 */
export class TutorialBoxScene implements Scene {
  readonly translucent = true;
  private page = 0;
  private t = 0;
  private said = false;
  private phase: Phase = 'grow';
  private scale = 0.01;
  /** After this page shrinks: the next page (false) or the box closes (true). */
  private closing = false;
  /** What the screen beneath had last read out (it is read again when the box closes). */
  private before = '';

  constructor(
    private readonly game: Game,
    readonly pages: readonly string[],
    /** The level beneath, if any (the box is centred over it either way). */
    readonly world: World | null,
  ) {
    if (game.ctx.reduceFlashing) this.openNow();
  }

  /** The page's lines: its heading (the original's "Name:\n") on a line of its own, then wrapped. */
  get lines(): string[] {
    const text = this.pages[this.page] ?? '';
    return text.split('\n').flatMap((part) => wrapPrompt(fontText(part.trim()), TUTORIAL_COLS));
  }

  /** The page shown now (tests). */
  get pageIndex(): number {
    return this.page;
  }

  /** How open the box is, 0 to 1 (tests). */
  get openness(): number {
    return this.scale;
  }

  /** The page takes a press now: open, and its guard is over. */
  get interactive(): boolean {
    return this.phase === 'open' && this.t > TUTORIAL_GUARD_FRAMES;
  }

  /** The panel at full size: its fill as big as the words (+1 px, createGraphics), the frame round it. */
  get panel(): { x: number; y: number; w: number; h: number } {
    const lines = this.lines;
    const textW = Math.max(1, ...lines.map((l) => l.length)) * 8;
    const w = textW + 2 + 2 * BOX_FRAME;
    const h = lines.length * TUTORIAL_LINE - 2 + 2 * BOX_FRAME;
    return { x: (SCREEN_W - w) >> 1, y: (SCREEN_H - h) >> 1, w, h };
  }

  private openNow(): void {
    this.phase = 'open';
    this.scale = 1;
  }

  private say(): void {
    const g = this.game;
    const text = (this.pages[this.page] ?? '').replace(/\n\s*/g, ' ');
    const more = this.page < this.pages.length - 1;
    g.deps.announcer?.say(
      `Tutorial${this.pages.length > 1 ? `, page ${this.page + 1} of ${this.pages.length}` : ''}. ${text} ` +
        `${abilityHint(g, 'OK', 'jump')} to ${more ? 'go on' : 'continue'}${more ? `, ${abilityHint(g, 'SKIP', 'attack')} to skip` : ''}.`,
    );
  }

  touchLabels(): TouchLabels {
    if (!this.interactive) return NO_TOUCH_BUTTONS;
    const more = this.page < this.pages.length - 1;
    return { ...NO_TOUCH_BUTTONS, jump: 'OK', ...(more ? { attack: 'SKIP' } : {}) };
  }

  update(_input: InputFrame, inputs: InputFrame[]): void {
    if (!this.said) {
      // Read out on the first frame, after the scene beneath has read itself out (a select's
      // enter() speaks after it pushed this box): that line is read again when the box closes.
      // Over a level nothing is read again (its last line is stale by now).
      if (!this.world)
        this.before = (this.game.deps.announcer as { lastText?: string } | undefined)?.lastText ?? '';
      this.said = true;
      this.say();
    }
    this.t++;
    const instant = this.game.ctx.reduceFlashing;
    if (this.phase === 'grow') {
      this.scale = instant ? 1 : Math.min(1, this.scale + BOX_GROW_PER_FRAME);
      if (this.scale >= 1) this.phase = 'open';
      return;
    }
    if (this.phase === 'shrink') {
      this.scale = instant ? 0 : this.scale - BOX_GROW_PER_FRAME;
      if (this.scale <= 0) this.next();
      return;
    }
    if (this.t <= TUTORIAL_GUARD_FRAMES) return;
    const pressed = (keys: readonly Action[]) => inputs.some((i) => keys.some((k) => i.pressed(k)));
    if (pressed(TUTORIAL_SKIP_KEYS)) this.closing = true;
    else if (pressed(TUTORIAL_NEXT_KEYS)) this.closing = this.page >= this.pages.length - 1;
    else return;
    this.phase = 'shrink';
    if (instant) {
      this.scale = 0;
      this.next();
    }
  }

  /** The page has shrunk shut: the next one grows open, or the box closes. */
  private next(): void {
    if (this.closing || this.page >= this.pages.length - 1) return this.close();
    this.page++;
    this.t = 0;
    this.phase = 'grow';
    this.scale = 0.01;
    if (this.game.ctx.reduceFlashing) this.openNow();
    this.say();
  }

  private close(): void {
    if (this.game.scenes.top === this) this.game.scenes.pop();
    if (this.before) this.game.deps.announcer?.say(this.before);
  }

  render(r: Renderer): void {
    if (this.scale <= 0) return;
    const P = this.panel;
    drawScaledPanel(r, P.x + P.w / 2, P.y + P.h / 2, P.w, P.h, this.scale);
    // The words show once the box is open (they are not scaled with it).
    if (this.phase !== 'open') return;
    const assets = this.game.ctx.assets;
    const th = DEFAULT_SELECT_THEME;
    const shadow = assets.sheet('font', th.shadowFont);
    const font = assets.sheet('font', th.nameFont);
    const x = P.x + BOX_FRAME + 1;
    this.lines.forEach((l, k) => {
      const y = P.y + BOX_FRAME + 1 + k * TUTORIAL_LINE;
      r.text(shadow, l, x + 1, y + 1);
      r.text(font, l, x, y);
    });
  }
}
