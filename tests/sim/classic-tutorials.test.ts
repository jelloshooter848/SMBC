import { describe, expect, it } from 'vitest';
import { defaultSettings, loadSettings, saveSettings, type Settings } from '@engine/save/settings';
import {
  CLASSIC_WEAPON_VALUES,
  defaultClassicSettings,
  type ClassicSettings,
  type ClassicWeapons,
} from '@engine/save/original-options';
import { MARIO } from '@game/characters/mario';
import { LINK } from '@game/characters/link';
import { MEGAMAN } from '@game/characters/megaman';
import { RYU } from '@game/characters/ryu';
import { SOPHIA } from '@game/characters/sophia';
import { CLASSIC_CHARACTERS } from '@game/characters/registry';
import { BASS_CLASSIC } from '@game/characters/bass/classic';
import { MM_WEAPONS } from '@game/characters/megaman/classic-weapons';
import { CLASSIC_ARTS } from '@game/characters/ryu/classic-weapons';
import { SIMON_TOOL_LABELS } from '@game/characters/simon';
import type { Player } from '@game/entities/player';
import type { World } from '@game/world/world';
import { runSim } from '@game/sim/headless';
import { testLevel } from './classic-harness';
import { fontText } from '@game/hud/text';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import { SCREEN_H, SCREEN_W } from '@engine/viewport';
import { BOX_FRAME, BOX_GROW_PER_FRAME, DEFAULT_SELECT_THEME } from '@game/scenes/select-grid';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { CARD_GUARD_FRAMES } from '@game/scenes/message';
import { LevelScene } from '@game/scenes/level';
import type { MenuItem, MenuScene } from '@game/scenes/menu';
import { ClassicOptionsScene, TUTORIALS_HINT } from '@game/scenes/original-game';
import {
  fillAbilities,
  TUTORIAL_IDS,
  TUTORIAL_TEXT,
  TUTORIAL_COLS,
  TUTORIAL_GUARD_FRAMES,
  TutorialBoxScene,
  upgradeTutorials,
} from '@game/tutorial/original-tutorials';
import type { Announcer } from '@engine/a11y/announcer';
import { draw, file, makeGame, useStorage, type H } from './heroes-harness';
import { isolateClassicRegistry } from './classic-registry';

// O-15 / G-042: Classic mode's Tutorials, the original's TutorialManager.as (41-258, 276-341)
// behind General > Tutorials (GeneralOptions.as 25), off by default (GameSettings.as 89).

useStorage();
isolateClassicRegistry({ hideExtras: true });

type TH = H & { settings: Settings };

function game(tutorials = true, over: Partial<ClassicSettings> = {}): TH {
  const settings: Settings = { ...defaultSettings(), classic: { ...defaultClassicSettings(), ...over } };
  if (tutorials) settings.classicTutorials = true;
  // An announcer that remembers its last line, as the real one does (Announcer.lastText).
  const lines: string[] = [];
  const announcer = {
    say: (t: string) => void lines.push(t),
    get lastText() {
      return lines.at(-1) ?? '';
    },
  } as unknown as Announcer;
  const h = makeGame({ deps: { settings, applySettings: () => {}, announcer } });
  return { ...h, settings, said: lines };
}

const box = (h: H) => (h.top() instanceof TutorialBoxScene ? (h.top() as TutorialBoxScene) : null);
const level = (h: H) => h.top() as LevelScene;

/** Closes the box on top, a page at a time, returning each page's words. */
function readBox(h: H): string[] {
  const b = box(h);
  expect(b, 'a Tutorials box is up').not.toBeNull();
  const pages = [...(b as TutorialBoxScene).pages];
  for (let i = 0; i < 40 && box(h) === b; i++) {
    // The next press only once the page takes one (not while it grows or shrinks).
    for (let k = 0; k < 200 && box(h) === b && !(b as TutorialBoxScene).interactive; k++) h.step();
    if (box(h) !== b) break;
    h.tap('jump');
  }
  expect(box(h)).not.toBe(b);
  return pages;
}

/** The ids the pages came from, in the order shown (each box's first page identifies it). */
function idsOf(pages: readonly string[], h: H): string[] {
  const at = (id: string) => {
    const first = TUTORIAL_TEXT[id]?.[0];
    return first === undefined ? -1 : pages.indexOf(fillAbilities(h.game, first));
  };
  return TUTORIAL_IDS.filter((id) => at(id) >= 0).sort((a, b) => at(a) - at(b));
}

/** Into a Classic run's first level with `hero` (closing the select's box on the way). */
function play(h: TH, hero = MARIO, seen?: string[]): LevelScene {
  h.game.classicSelect('1-1', () => h.game.showClassicMenu());
  // Boxes already seen this game (set after the new game cleared them).
  if (seen) h.settings.classicTutorialsSeen = [...seen];
  if (box(h)) readBox(h);
  const s = h.top() as CharacterSelectScene;
  expect(s).toBeInstanceOf(CharacterSelectScene);
  h.idle(40); // the select takes input once it has opened (it grows open without Reduce flashing)
  // The cursor on the hero (the select's rows: right along a row, down to the next).
  for (let i = 0; i < 40 && s.chars[s.cursor]?.id !== hero.id; i++) h.tap(i % 8 === 7 ? 'down' : 'right');
  expect(s.chars[s.cursor]?.id).toBe(hero.id);
  h.tap('jump');
  h.until(() => h.top() instanceof LevelScene || box(h) !== null, 900);
  return h.top() instanceof LevelScene
    ? level(h)
    : (h.game.scenes.find((x) => x instanceof LevelScene) as LevelScene);
}

/** Runs frames until a box is up (or `max` frames pass). */
function untilBox(h: H, max = 400): TutorialBoxScene | null {
  for (let i = 0; i < max && !box(h); i++) h.step();
  return box(h);
}

describe('the Tutorials setting (O-15 / G-042: General > Tutorials, off by default)', () => {
  it('is off by default (GameSettings.as 89: _tutorials = false), and an old file loads with it off', () => {
    expect(defaultSettings().classicTutorials).toBeUndefined();
    expect(loadSettings().classicTutorials).toBeUndefined();
    const s = defaultSettings();
    s.classicTutorials = true;
    s.classicTutorialsSeen = ['marioStart'];
    saveSettings(s);
    expect(loadSettings().classicTutorials).toBe(true);
    expect(loadSettings().classicTutorialsSeen).toEqual(['marioStart']);
  });

  it('is a row of Classic options, Off then On, with help that names what it does', () => {
    const h = game(false);
    const o = new ClassicOptionsScene(h.game, () => {});
    const row = (o as unknown as MenuScene & { items: MenuItem[] }).items.find(
      (i) => i.label === 'Tutorials',
    );
    expect(row?.value?.()).toBe('Off');
    expect(row?.hint).toBe(TUTORIALS_HINT);
    row?.adjust?.(1);
    expect(h.settings.classicTutorials).toBe(true);
    expect(row?.value?.()).toBe('On');
    row?.adjust?.(1);
    expect(h.settings.classicTutorials).toBeUndefined();
  });

  it('off (the default): a Classic run shows no box at the select, the start, a Mushroom or a Star', () => {
    const h = game(false);
    const l = play(h);
    expect(box(h)).toBeNull();
    const p = l.world.player;
    p.def.behaviour.onPowerUp(p, 'mushroom', l.world);
    p.def.behaviour.onPowerUp(p, 'star', l.world);
    expect(untilBox(h, 300)).toBeNull();
    expect(h.game.classicTutorials.seen).toEqual([]);
  });
});

describe('the campaign never shows a Tutorials box (O-15: Classic only)', () => {
  it('with Tutorials on, a campaign file plays its levels with no box and records nothing', () => {
    const h = game(true);
    h.game.openFile(1, file());
    expect(h.game.campaign).not.toBeNull();
    h.game.goToLevel('1-1', { mode: 'stand' });
    h.until(() => h.top() instanceof LevelScene, 600);
    const l = level(h);
    const p = l.world.player;
    p.def.behaviour.onPowerUp(p, 'mushroom', l.world);
    p.def.behaviour.onPowerUp(p, 'star', l.world);
    expect(untilBox(h, 400)).toBeNull();
    expect(h.game.classicTutorials.on).toBe(false);
    expect(h.game.classicTutorials.pending).toEqual([]);
    expect(h.game.classicTutorials.seen).toEqual([]);
    expect(h.game.scenes.find((s) => s instanceof TutorialBoxScene)).toBeUndefined();
  });

  it('with Tutorials on, a Current free-play start (not Classic mode) shows no box either', () => {
    const h = game(true);
    h.game.newGame(MARIO);
    h.until(() => h.top() instanceof LevelScene, 600);
    expect(untilBox(h, 300)).toBeNull();
    expect(h.game.classicTutorials.seen).toEqual([]);
  });
});

describe('the triggers (O-15 / G-042: TutorialManager.as 276-341)', () => {
  it('the select: its box over the Classic select, read out, gone with OK (CharacterSelectBox → characterSelect)', () => {
    const h = game(true);
    h.game.classicSelect('1-1', () => h.game.showClassicMenu());
    const b = box(h);
    expect(b).not.toBeNull();
    expect(h.game.scenes.find((s) => s instanceof CharacterSelectScene)).toBeDefined();
    expect(idsOf(b?.pages ?? [], h)).toEqual(['characterSelect']);
    h.step();
    expect(h.said.at(-1)).toMatch(/Tutorial\. Use the directions to move the cursor/);
    readBox(h);
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
    // The select's own line is read again as the box closes.
    expect(h.said.at(-1)).toMatch(/Select your hero/);
  });

  it("Survival's select shows the Survival box instead (characterSelect: CampaignModes.SURVIVAL)", () => {
    const h = game(true, { gameMode: 'survival' });
    h.game.classicSelect('1-1', () => h.game.showClassicMenu());
    expect(idsOf(readBox(h), h)).toEqual(['survival']);
  });

  it("the first start and the hero's start (Level → startLevel: firstCharacterStart, then marioStart)", () => {
    const h = game(true);
    play(h);
    const b = untilBox(h);
    expect(idsOf(b?.pages ?? [], h)).toEqual(['firstCharacterStart', 'marioStart']);
    expect(b?.pages.length).toBe(6);
    readBox(h);
    expect(h.top()).toBeInstanceOf(LevelScene);
  });

  it("another hero's first start shows only that hero's box (Link: linkStart's two pages)", () => {
    const h = game(true);
    play(h, LINK, ['characterSelect', 'firstCharacterStart']);
    const b = untilBox(h);
    expect(idsOf(b?.pages ?? [], h)).toEqual(['linkStart']);
    expect(b?.pages.length).toBe(2);
  });

  it('a Mushroom: the mushroom box, and Mega Man adds his charge box (MegaManBase.getMushroomEnd → gotPowerUp)', () => {
    const h = game(true);
    const l = play(h, MEGAMAN, ['characterSelect', 'firstCharacterStart', 'megamanStart']);
    expect(untilBox(h, 60)).toBeNull();
    const p = l.world.player;
    p.def.behaviour.onPowerUp(p, 'mushroom', l.world);
    // The box waits for the 60-frame power-up freeze to end.
    h.step();
    expect(box(h)).toBeNull();
    const b = untilBox(h);
    expect(idsOf(b?.pages ?? [], h)).toEqual(['mushroom', 'megamanPowerUp']);
  });

  it("each upgrade: Link's Mushroom (Blue Ring, Bomb) and Fire Flower (Red Ring, Bomb Bag) boxes", () => {
    const h = game(true);
    const l = play(h, LINK, ['characterSelect', 'firstCharacterStart', 'linkStart']);
    const p = l.world.player;
    expect(untilBox(h, 60)).toBeNull();
    p.def.behaviour.onPowerUp(p, 'mushroom', l.world);
    expect(idsOf(untilBox(h)?.pages ?? [], h)).toEqual(['mushroom', 'linkBlueRing', 'linkBomb']);
    readBox(h);
    p.def.behaviour.onPowerUp(p, 'flower', l.world);
    expect(idsOf(untilBox(h)?.pages ?? [], h)).toEqual(['linkRedRing', 'linkBombBag']);
    readBox(h);
    // A second Mushroom after a hit: nothing again this game.
    p.powerState = 'small';
    h.step();
    p.def.behaviour.onPowerUp(p, 'mushroom', l.world);
    expect(untilBox(h, 200)).toBeNull();
  });

  it('a Star: the star box (Character.hitPickup → TYPE_STAR)', () => {
    const h = game(true);
    const l = play(h, MARIO, ['characterSelect', 'firstCharacterStart', 'marioStart']);
    const p = l.world.player;
    expect(untilBox(h, 30)).toBeNull();
    p.def.behaviour.onPowerUp(p, 'star', l.world);
    const b = untilBox(h);
    expect(idsOf(b?.pages ?? [], h)).toEqual(['star']);
  });

  it('a cheat unlocked mid-level: its card, then the cheat box (Cheats.as → TYPE_CHEAT)', () => {
    const h = game(true);
    const l = play(h, MARIO, ['characterSelect', 'firstCharacterStart', 'marioStart']);
    expect(untilBox(h, 30)).toBeNull();
    h.game.cheatUnlocks.push('allHammerBros');
    h.step();
    expect(box(h)).toBeNull(); // the unlock card first
    for (let i = 0; i < 5 && !(h.top() instanceof LevelScene) && !box(h); i++) {
      h.idle(CARD_GUARD_FRAMES + 1);
      h.tap('jump');
    }
    expect(l).toBeDefined();
    const b = untilBox(h);
    expect(idsOf(b?.pages ?? [], h)).toEqual(['cheat']);
  });
});

describe('each box waits for a press, is read out and works with touch (O-15)', () => {
  it('a press during the guard does nothing; OK turns the page; nothing moves on by itself', () => {
    const h = game(true);
    play(h);
    const b = untilBox(h) as TutorialBoxScene;
    h.step();
    expect(h.said.at(-1)).toMatch(/^Tutorial, page 1 of 6\. Each character controls/);
    expect(b.touchLabels().jump).toBeNull();
    // Still inside the original's 1000 ms cancel timer (MessageBox CANCEL_TMR_DUR): ignored.
    h.idle(TUTORIAL_GUARD_FRAMES - 10);
    h.tap('jump');
    expect(b.pageIndex).toBe(0);
    h.idle(2000);
    expect(box(h)).toBe(b);
    expect(b.pageIndex).toBe(0);
    // Touch: OK on the jump button, SKIP on attack while pages remain.
    expect(b.touchLabels().jump).toBe('OK');
    expect(b.touchLabels().attack).toBe('SKIP');
    h.tap('jump');
    expect(b.pageIndex).toBe(1);
    expect(h.said.at(-1)).toMatch(/^Tutorial, page 2 of 6\. Some skins/);
  });

  it('TALK (special) and MENU turn a page too; SKIP closes the box with its pages seen', () => {
    const h = game(true);
    play(h);
    const b = untilBox(h) as TutorialBoxScene;
    h.idle(TUTORIAL_GUARD_FRAMES + 1);
    h.tap('special');
    expect(b.pageIndex).toBe(1);
    h.idle(TUTORIAL_GUARD_FRAMES + 1);
    h.tap('start');
    expect(b.pageIndex).toBe(2);
    h.idle(TUTORIAL_GUARD_FRAMES + 1);
    h.tap('attack');
    expect(box(h)).toBeNull();
    expect(h.top()).toBeInstanceOf(LevelScene);
    expect(h.game.classicTutorials.seen).toEqual(
      expect.arrayContaining(['characterSelect', 'firstCharacterStart', 'marioStart']),
    );
  });

  it('every page names abilities, never a button letter, and the font draws it', () => {
    const h = game(true);
    for (const id of TUTORIAL_IDS) {
      for (const t of TUTORIAL_TEXT[id] ?? []) {
        const filled = fillAbilities(h.game, t);
        expect(filled, id).not.toMatch(
          /\{[^}]*\}|\[\[|\]\]|_BTN|\b(button|key) [A-Z]\b|\b[ABXY] (button|to)\b/i,
        );
        expect(filled, id).not.toMatch(/arrow keys/i);
        for (const part of filled.split('\n'))
          expect(fontText(part).length, `${id}: ${part}`).toBe(part.toUpperCase().length);
      }
    }
  });
});

describe("the box looks like the original's (PlainMessageBox in the SMB NES map skin, O-15)", () => {
  /** Every rect a render fills, with its colour. */
  function rects(scene: {
    render(r: Renderer): void;
  }): { x: number; y: number; w: number; h: number; c: string }[] {
    const out: { x: number; y: number; w: number; h: number; c: string }[] = [];
    const r: Renderer = Object.assign(new NullRenderer(), {
      rect(x: number, y: number, w: number, h: number, c: string): void {
        out.push({ x, y, w, h, c });
      },
    });
    scene.render(r);
    return out;
  }

  it("the menus' panel: brick fill, pink bevel with a black shadow, rivets; centred; no page count or press mark", () => {
    const h = game(true);
    play(h);
    const b = untilBox(h) as TutorialBoxScene;
    h.idle(TUTORIAL_GUARD_FRAMES + 1);
    const P = b.panel;
    // Centred on the stage (MessageBox DEF_POS_PNT), as big as its words plus the 7 px frame.
    expect(P.x + P.w / 2).toBeCloseTo(SCREEN_W / 2, 0);
    expect(P.y + P.h / 2).toBeCloseTo(SCREEN_H / 2, 0);
    const longest = Math.max(...b.lines.map((l) => l.length));
    expect(P.w).toBe(longest * 8 + 2 + 2 * BOX_FRAME);
    const th = DEFAULT_SELECT_THEME;
    const fills = rects(b).map((x) => x.c);
    expect(fills).toContain('#c84c0c');
    expect(fills).toContain('#fcbcb0');
    expect(fills).toContain('#000000');
    expect(th.fill).toBe('#c84c0c');
    // Left-aligned words inside the frame, and nothing else: no "1/6" tab, no "OK" mark.
    const t = draw(b).texts;
    const words = new Set(b.lines);
    for (const x of t) {
      expect(words.has(x.str), x.str).toBe(true);
      expect(x.x === P.x + BOX_FRAME + 1 || x.x === P.x + BOX_FRAME + 2).toBe(true);
    }
    expect(t.some((x) => /\d\/\d/.test(x.str))).toBe(false);
  });

  it('every page of every box fits the 256 x 240 screen (the phone shows the same screen)', () => {
    const h = game(true);
    for (const id of TUTORIAL_IDS) {
      const b = new TutorialBoxScene(
        h.game,
        (TUTORIAL_TEXT[id] ?? []).map((t) => fillAbilities(h.game, t)),
        null,
      );
      for (let k = 0; k < b.pages.length; k++) {
        (b as unknown as { page: number }).page = k;
        const P = b.panel;
        expect(
          b.lines.every((l) => l.length <= TUTORIAL_COLS),
          id,
        ).toBe(true);
        expect(P.x, id).toBeGreaterThanOrEqual(0);
        expect(P.y, id).toBeGreaterThanOrEqual(0);
        expect(P.x + P.w, id).toBeLessThanOrEqual(SCREEN_W);
        expect(P.y + P.h, id).toBeLessThanOrEqual(SCREEN_H);
      }
    }
  });

  it('grows open from its centre and shrinks shut (MessageBox.grow, shrink), the next page growing after', () => {
    const h = game(true);
    h.game.ctx.reduceFlashing = false;
    play(h);
    const b = untilBox(h) as TutorialBoxScene;
    expect(b.openness).toBeLessThan(1);
    // No words while it grows.
    expect(draw(b).texts).toEqual([]);
    const frames = Math.ceil(1 / BOX_GROW_PER_FRAME);
    h.idle(frames);
    expect(b.openness).toBe(1);
    expect(draw(b).texts.length).toBe(2 * b.lines.length); // each line over its shadow
    h.idle(TUTORIAL_GUARD_FRAMES);
    h.tap('jump');
    expect(b.pageIndex).toBe(0);
    expect(b.openness).toBeLessThan(1);
    h.idle(frames);
    expect(b.pageIndex).toBe(1);
    expect(b.openness).toBeLessThan(1);
    expect(h.said.at(-1)).toMatch(/^Tutorial, page 2 of 6\./);
    h.idle(frames);
    expect(b.openness).toBe(1);
  });

  it('with Reduce flashing the box is simply there, and goes at once', () => {
    const h = game(true);
    expect(h.game.ctx.reduceFlashing).toBe(true);
    play(h);
    const b = untilBox(h) as TutorialBoxScene;
    expect(b.openness).toBe(1);
    expect(draw(b).texts.length).toBe(2 * b.lines.length); // each line over its shadow
    h.idle(TUTORIAL_GUARD_FRAMES + 1);
    h.tap('jump');
    expect(b.pageIndex).toBe(1);
    expect(b.openness).toBe(1);
  });
});

describe("the words are the original's, changed only where our rules or our game require it (O-15)", () => {
  /** A game whose controls in use are `scheme` (touch: names only; keyboard: the key after). */
  function schemed(scheme: 'touch' | 'keyboard', over: Partial<ClassicSettings> = {}): TH {
    const settings: Settings = { ...defaultSettings(), classic: { ...defaultClassicSettings(), ...over } };
    settings.classicTutorials = true;
    const h = makeGame({ deps: { settings, applySettings: () => {}, controlScheme: () => scheme } });
    return { ...h, settings };
  }
  const pages = (h: H, id: string, hero?: string) =>
    (TUTORIAL_TEXT[id] ?? []).map((t) => fillAbilities(h.game, t, hero));

  /**
   * TutorialManager.as 49-205, word for word, with each key token ("+JMP_BTN_STR+" and the like) as
   * `<K>` and only these changes: (a) "the arrow keys" / "arrow keys" are "the directions"; (b) the
   * typos "Suvival", "Mega man", "Press SPC place", a double space and a stray space are fixed. The
   * boxes our game makes false are in DEVIATIONS below, not here.
   */
  const ORIGINAL: Readonly<Record<string, readonly string[]>> = {
    characterSelect: ['Use the directions to move the cursor, and press <K> to select a character.'],
    survival: [
      'Survival mode:\nWhen a character dies in this mode, they will be unusable until you revive them. Reviving a character costs one life. To revive a character, select the character and press <K>.',
      'If you revive a character that is already alive, that character will gain 2 random power ups plus ammo. You will only be able to revive characters when you enter a new world (after a bowser level).',
      "When you're done reviving characters, press <K> to enter character select mode.",
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
    linkBombBag: ["Bomb Bag:\nThe bomb bag increases Link's bomb capacity."],
    linkQuiver: ["Quiver:\nThe quiver increases Link's arrow capacity."],
    linkRedRing: ['Red Ring:\nThe red ring allows Link to shoot sword beams across the screen.'],
    luigiStart: [
      'Luigi:\nLuigi can run if you hold <K> while moving. If he has firepower, press <K> to throw fireballs.',
      'He controls similarly to Mario, but his controls are more loose and he can jump higher.',
    ],
    marioStart: [
      'Mario:\nMario can run if you hold <K> while moving. If he has firepower, press <K> to throw fireballs.',
    ],
    megamanPowerUp: [
      'When Mega Man has a mushroom, hold <K> to charge up his mega buster.',
      "Note that some Mega Man skins can't charge up their mega buster.",
    ],
    megamanChargeKick: ['Charge Kick:\nPress DOWN and <K> to damage enemies while sliding.'],
    megamanHardKnuckle: [
      'Hard Knuckle:\nWhile the hard knuckle is on the screen, press UP or DOWN to move it up or down.',
    ],
    megamanMetalBlade: ['Metal Blade:\nMetal blades can be thrown in 8 directions.'],
    megamanPharaohShot: ['Pharaoh Shot:\nYou can hold <K> to charge up the pharaoh shot.'],
    megamanSuperArm: [
      'Super Arm:\nPress <K> when touching a brick to pick it up. Press <K> again to throw it.',
    ],
    megamanWaterShield: [
      'Water Shield:\nPress <K> to form a shield around you. Press <K> again to shoot the shield outward.',
    ],
    ryuJumpSlash: ['Jump Slash:\nPress <K> while in the air to use the jump slash.'],
    ryuScroll: ["Scroll:\nThe scroll increases Ryu's ammo capacity."],
    samusStart: [
      'Samus:\nSamus can shoot upward while standing, running, and jumping. Press down while crouching to turn into the morph ball. While in morph ball state, you can set bombs with <K>.',
    ],
    samusIceBeam: [
      'Ice Beam:\nShooting enemies with the ice beam will freeze them in place for a short time. Frozen enemies can be used as platforms.',
    ],
    samusWaveBeam: [
      'Wave Beam:\nThe wave beam arcs up and down as it travels across the screen and passes through walls and pipes.',
    ],
    samusScrewAttack: ['Screw Attack:\nScrew attack causes spin jumps to damage enemies.'],
    samusMissileExpansion: ["Missile Expansion:\nThe missile expansion increases Samus' ammo capacity."],
    sophiaWallClimb: [
      'Wall Climb:\nHold up while approaching a wall to climb up it. Hold down while approaching a cliff to climb down it. Sophia can climb into gaps by holding the direction toward the gap while driving over it.',
      'While climbing a wall, press <K> to jump off and grapple to a nearby wall. To drop from a wall without jumping, hold the direction toward the wall and press <K>.',
    ],
    sophiaCeilingClimb: [
      'Ceiling Climb:\nJump into a ceiling to grapple to it. To temporarily disable grapple, hold down while in the air.',
    ],
    sophiaHover: [
      'Hover:\nPress and hold <K> while in the air to hover. The hover bar will recharge over time.',
    ],
  };

  /**
   * (c): the boxes with a sentence our game makes false, changed by the least (the original's words
   * in the comment; docs/classic/TUTORIAL_DEVIATIONS.md gives each reason with its file and line).
   */
  const DEVIATIONS: Readonly<Record<string, readonly string[]>> = {
    // p3: "Mario and Luigi are the only characters..." (false only with Yoshi in the select);
    // p4: "you can save or load a game and change several options" (no save or load there).
    firstCharacterStart: [
      'Each character controls just like they do in their own games. Use the directions to move, and press <K> to jump and <K> to attack. Hold <K> to run with Mario and Luigi.',
      'Some skins control a bit differently than the base character. The descriptions for the differences can be seen on the skin selection menu.',
      'Note that Mario and Luigi are the only characters that can jump on enemies. For some characters, you can press <K> for an alternate attack and <K> to change weapons.',
      'You can pause the game by pressing <K>. In the pause menu, you can change several options. If the game runs slowly, try changing music consoles or turn the music off.',
      'Also, playing with a gamepad is highly recommended. See the Exploding Rabbit website for info on setting that up. If you have questions about the game, feel free to ask them in the Super Mario Bros. Crossover forum.',
    ],
    // "Press SEL or SPC to cycle through weapons when you have them."
    bassStart: [
      'Bass:\nPress DOWN and <K> to dash. Bass can perform a dash jump if you jump while dashing. Bass can also double jump in the air. Press <K> to use his weapon when you have it.',
    ],
    // "He cannot collect a mushroom and will be killed in one hit."
    billStart: [
      'Bill:\nBill can shoot in different directions if you hold UP and DOWN while moving. He will be killed in one hit without a mushroom.',
    ],
    // p2: "Press SEL to switch subweapons if you have more than one."
    linkStart: [
      'Link:\nWhile in the air, Link can perform an upward thrust or downward thrust by pressing UP or DOWN.',
      'He can throw his boomerang to stun enemies and grab items by pressing <K>. Press <K> to use his subweapon when he has one.',
    ],
    // "The blue ring prevents Link from getting damaged by his bombs."
    linkBlueRing: ["Blue Ring:\nThe blue ring makes Link's sword stronger."],
    // "Press SPC to shoot an arrow...": (a) only, the bow is on TOOLS here.
    linkBow: ['Bow and Arrows:\nPress <K> to shoot an arrow across the screen.'],
    // "Bombs damage Link if he does not have a mushroom."
    linkBomb: [
      'Bomb:\nPress <K> to place a bomb. It will explode after a short time. Bombs do not damage Link.',
    ],
    // p1: "Press SEL or SPC to cycle through weapons..."; p2: "Press SEL or SPC to switch to Rush Coil."
    megamanStart: [
      'Mega Man:\nMega Man can slide by pressing DOWN and <K> while on the ground. Press <K> to use his weapon when you have it.',
      'Mega Man begins with Rush Coil, which can be used to help Mega Man make some long or high jumps. Tap <K> to call Rush Coil.',
    ],
    // p2: "Press SPC or UP and ATK to throw special weapons..." (no UP and ATTACK throw).
    ryuStart: [
      'Ryu:\nRyu can climb any wall by jumping toward it. While climbing, press back and <K> to jump backwards off a wall, or press down and <K> to detach from a wall.',
      "If you're near the top of a wall, press <K> to jump on top of it. Press <K> to throw special weapons when you have enough ammo.",
    ],
    // "Press SPC or UP and ATK to use subweapons..."
    simonStart: [
      'Simon:\nSimon can double jump if you press <K> while in the air. Press <K> to use subweapons if you have enough ammo.',
    ],
    // "...with SPC or DWN and ATK when you have them. Press SEL to switch between them."
    sophiaStart: ['Sophia:\nSophia can use special weapons with <K> when you have them.'],
    // "Press SPC or DWN and ATK to fire a homing missile when enemies are on screen. If you have
    // multiple weapons, press SEL to switch between them."
    sophiaHomingMissile: ['Homing Missile:\nPress <K> to fire a homing missile.'],
  };

  it('every box is the original word for word (keys as abilities), or a listed deviation', () => {
    const h = schemed('touch');
    const asKeys = (t: string) => t.replace(/\{[^}]*\}/g, '<K>');
    // Every page fills in for this game (no placeholder left over).
    for (const id of TUTORIAL_IDS)
      for (const t of TUTORIAL_TEXT[id] ?? []) expect(fillAbilities(h.game, t), id).not.toMatch(/[{}]|\[\[/);
    for (const id of TUTORIAL_IDS) {
      const want = ORIGINAL[id] ?? DEVIATIONS[id];
      expect(want, `${id} is listed`).toBeDefined();
      // Placeholders to <K> before filling (the filled names vary with the hero and the scheme).
      const raw = (TUTORIAL_TEXT[id] ?? []).map((t) =>
        asKeys(
          t.replace(/\[\[(!?)([a-z-]+)\|([^\]]*)\]\]/g, (_a, not: string, _n: string, w: string) =>
            not ? w : '',
          ),
        ),
      );
      expect(raw, id).toEqual(want);
    }
    expect(Object.keys(ORIGINAL).length + Object.keys(DEVIATIONS).length).toBe(TUTORIAL_IDS.length);
  });

  it('(c) Link: the boomerang on SPECIAL, bombs or the bow on TOOLS, bombs never hurt him, the blue ring a stronger sword', () => {
    const h = schemed('touch');
    expect(pages(h, 'linkStart').join(' ')).toMatch(/pressing BOOMERANG\. Press BOMB to use his subweapon/);
    expect(pages(h, 'linkBomb')[0]).toMatch(/Press BOMB to place a bomb.*Bombs do not damage Link\.$/);
    expect(pages(h, 'linkBow')[0]).toMatch(/Press BOW to shoot an arrow/);
    const bow = schemed('touch', { weapons: { ...defaultClassicSettings().weapons, link: 'bow' } });
    expect(pages(bow, 'linkStart').join(' ')).toMatch(/Press BOW to use his subweapon/);
    // Keyboard: the name, then the real key.
    const k = schemed('keyboard');
    expect(pages(k, 'linkBomb')[0]).toMatch(/Press BOMB \([^)]+\) to place a bomb/);
  });

  it('(c) Mega Man and Bass: the weapon on SPECIAL, a tap of TOOLS calls Rush; the Charge Kick box is the original (on from the Flower)', () => {
    const h = schemed('touch');
    expect(pages(h, 'megamanStart').join(' ')).toMatch(
      /Press BLADE to use his weapon.*Tap RUSH to call Rush Coil\./,
    );
    expect(pages(h, 'megamanPowerUp')[0]).toMatch(/hold SHOOT to charge/);
    expect(pages(h, 'bassStart', 'bass')[0]).toMatch(/Press WATER to use his weapon when you have it\.$/);
    const arm = schemed('touch', { weapons: { ...defaultClassicSettings().weapons, megaman: 'super-arm' } });
    expect(pages(arm, 'megamanSuperArm')[0]).toMatch(/Press ARM when touching a brick/);
    const kick = schemed('touch', {
      weapons: { ...defaultClassicSettings().weapons, megaman: 'charge-kick' },
    });
    expect(pages(kick, 'megamanChargeKick', 'megaman')).toEqual([
      'Charge Kick:\nPress DOWN and JUMP to damage enemies while sliding.',
    ]);
    expect(pages(h, 'megamanWaterShield', 'bass')[0]).toMatch(/Press WATER to form a shield/);
  });

  it('(c) the rest: Bill, Ryu, Simon, Sophia; the first start with Yoshi in the select', () => {
    const h = schemed('touch');
    expect(pages(h, 'billStart')[0]).toMatch(/He will be killed in one hit without a mushroom\.$/);
    expect(pages(h, 'ryuStart')[1]).toMatch(/Press SHURIKEN to throw special weapons/);
    const spin = schemed('touch', {
      weapons: { ...defaultClassicSettings().weapons, ryuStart: 'jump-slash' },
    });
    expect(pages(spin, 'ryuStart')[1]).toMatch(/Press SPIN to use the jump slash in the air when/);
    expect(pages(h, 'simonStart')[0]).toMatch(/Press AXE to use subweapons/);
    expect(pages(h, 'sophiaStart')).toEqual([
      'Sophia:\nSophia can use special weapons with MISSILE when you have them.',
    ]);
    expect(pages(h, 'sophiaHomingMissile')).toEqual([
      'Homing Missile:\nPress HOMING to fire a homing missile.',
    ]);
    expect(pages(h, 'firstCharacterStart')[2]).toMatch(/^Note that Mario and Luigi are the only characters/);
    const yoshi = Object.assign(Object.create(Object.getPrototypeOf(h.game)) as typeof h.game, h.game);
    Object.defineProperty(yoshi, 'heroSlots', { get: () => [{ id: 'yoshi' }] });
    expect(fillAbilities(yoshi, TUTORIAL_TEXT.firstCharacterStart?.[2] ?? '')).toMatch(
      /^Note that Mario, Luigi and Yoshi are the only characters/,
    );
  });

  it('the boxes for pickups our Classic kits never give are left out', () => {
    // TutorialManager.as 217, 235, 246, 248, 249: Bill's Rapid, the Energy Balancer, the Morph Ball
    // (ours has it from the start), the Varia Suit (SA-C16), and Samus's ammo (its trigger is
    // commented out in the original too, Samus.as 639-644).
    for (const id of ['billRapid', 'megamanEnergyBalancer', 'samusMorphBall', 'samusVariaSuit', 'samusAmmo'])
      expect(TUTORIAL_TEXT[id], id).toBeUndefined();
  });

  it('a level start box names the hero buttons in play (Link on touch: BOOMERANG, BOMB)', () => {
    const h = schemed('touch');
    play(h as TH, LINK, ['characterSelect', 'firstCharacterStart']);
    const b = untilBox(h) as TutorialBoxScene;
    expect(b.pages.join(' ')).toMatch(/pressing BOOMERANG/);
  });

  it('over a level the box re-reads nothing as it closes; over the select it re-reads the select', () => {
    const h = game(true);
    play(h);
    untilBox(h);
    readBox(h);
    expect(h.top()).toBeInstanceOf(LevelScene);
    expect(h.said.at(-1)).toMatch(/^Tutorial, page 6 of 6/);
  });

  it('cheats unlocked by a clear, told at the select: the cheat box follows the select box (Cheats.as 108)', () => {
    const h = game(true);
    h.game.cheatUnlocks.push('allHammerBros');
    h.game.classicSelect('1-1', () => h.game.showClassicMenu());
    expect(idsOf(readBox(h), h)).toEqual(['characterSelect', 'cheat']);
  });

  it("Sophia's Fire Flower shows the wall and ceiling climb boxes in play", () => {
    const h = game(true);
    const l = play(h, SOPHIA, ['characterSelect', 'firstCharacterStart', 'sophiaStart']);
    expect(untilBox(h, 60)).toBeNull();
    const p = l.world.player;
    p.def.behaviour.onPowerUp(p, 'mushroom', l.world);
    expect(idsOf(untilBox(h)?.pages ?? [], h)).toEqual(['mushroom', 'sophiaHover']);
    readBox(h);
    p.def.behaviour.onPowerUp(p, 'flower', l.world);
    expect(idsOf(untilBox(h)?.pages ?? [], h)).toEqual(['sophiaWallClimb', 'sophiaCeilingClimb']);
  });
});

describe("the boxes' button names are the heroes' own touch labels, for every Customize Weapons choice (O-15 QA)", () => {
  /** A Classic World for hero `id` with weapon option `over`, its hero powered up to the Flower. */
  function fired(id: string, over: Partial<ClassicWeapons>): { p: Player; world: World } {
    const def = id === 'bass' ? BASS_CLASSIC : CLASSIC_CHARACTERS[id];
    if (!def) throw new Error(id);
    const classic = {
      ...defaultClassicSettings(),
      weapons: { ...defaultClassicSettings().weapons, ...over },
    };
    const world = runSim({
      level: testLevel(),
      character: def,
      script: { steps: [] },
      maxFrames: 0,
      rules: 'classic',
      classic,
    }).world;
    const p = world.player;
    p.scratch.hearts = 99; // Simon's sub-weapons show only with hearts to throw
    p.def.behaviour.onPowerUp(p, 'flower', world);
    p.def.behaviour.onPowerUp(p, 'flower', world);
    expect(p.powerState).toBe('fire');
    return { p, world };
  }
  const labelOf = (id: string, over: Partial<ClassicWeapons>, action: 'special' | 'select') => {
    const { p, world } = fired(id, over);
    return p.def.touchLabels?.(p, world)[action] ?? null;
  };
  /** The tutorial's name for `placeholder`, on touch (the bare ability name). */
  function said(placeholder: string, over: Partial<ClassicWeapons>, hero: string): string {
    const settings: Settings = {
      ...defaultSettings(),
      classic: { ...defaultClassicSettings(), weapons: { ...defaultClassicSettings().weapons, ...over } },
    };
    const h = makeGame({ deps: { settings, controlScheme: () => 'touch' } });
    return fillAbilities(h.game, placeholder, hero);
  }

  it("Mega Man's and Bass's Flower weapon (SPECIAL), every choice", () => {
    for (const w of CLASSIC_WEAPON_VALUES.megaman) {
      expect(said('{=weapon}', { megaman: w }, 'megaman'), w).toBe(
        labelOf('megaman', { megaman: w }, 'special'),
      );
      expect(mmLabelFromSource(w)).toBeDefined();
    }
    for (const w of CLASSIC_WEAPON_VALUES.bass)
      expect(said('{=weapon}', { bass: w }, 'bass'), w).toBe(labelOf('bass', { bass: w }, 'special'));
    // RUSH on TOOLS for Mega Man, SWAP for Bass (but the Charge Kick, which swaps nothing).
    expect(labelOf('megaman', {}, 'select')).toBe('RUSH');
    expect(labelOf('bass', {}, 'select')).toBe('SWAP');
    expect(labelOf('bass', { bass: 'charge-kick' }, 'select')).toBeNull();
  });

  it("Link's bombs or bow (TOOLS), and the boomerang (SPECIAL)", () => {
    for (const w of CLASSIC_WEAPON_VALUES.link)
      expect(said('{=link-tool}', { link: w }, 'link'), w).toBe(labelOf('link', { link: w }, 'select'));
    expect(labelOf('link', {}, 'special')).toBe('BOOMERANG');
  });

  it("Ryu's art (SPECIAL) and a Jump Slash on either button; Simon's sub-weapon; Sophia's missile", () => {
    for (const w of CLASSIC_WEAPON_VALUES.ryuStart) {
      const extra = w === 'windmill' ? 'shuriken' : 'windmill';
      expect(said('{=ryu-art}', { ryuStart: w, ryuExtra: extra }, 'ryu'), w).toBe(
        labelOf('ryu', { ryuStart: w, ryuExtra: extra }, 'special'),
      );
    }
    expect(said('{=ryu-slash}', { ryuExtra: 'jump-slash' }, 'ryu')).toBe(
      labelOf('ryu', { ryuExtra: 'jump-slash' }, 'select'),
    );
    for (const w of CLASSIC_WEAPON_VALUES.simonStart) {
      const extra = w === 'cross' ? 'dagger' : 'cross';
      expect(said('{=simon-start}', { simonStart: w, simonExtra: extra }, 'simon'), w).toBe(
        labelOf('simon', { simonStart: w, simonExtra: extra }, 'special'),
      );
    }
    for (const w of CLASSIC_WEAPON_VALUES.sophia)
      expect(said('{=sophia-missile}', { sophia: w }, 'sophia'), w).toBe(
        labelOf('sophia', { sophia: w }, 'special'),
      );
  });

  it('the copied label tables match their sources (MM_WEAPONS, CLASSIC_ARTS, SIMON_TOOL_LABELS)', () => {
    for (const wp of MM_WEAPONS)
      expect(said('{=weapon}', { megaman: wp.id }, 'megaman'), wp.id).toBe(wp.label);
    for (const a of CLASSIC_ARTS) {
      const extra = a.id === 'windmill' ? 'shuriken' : 'windmill';
      expect(said('{=ryu-art}', { ryuStart: a.id, ryuExtra: extra }, 'ryu'), a.id).toBe(a.label);
    }
    for (const [id, label] of Object.entries(SIMON_TOOL_LABELS)) {
      const extra = id === 'cross' ? 'dagger' : 'cross';
      expect(
        said(
          '{=simon-start}',
          { simonStart: id as ClassicWeapons['simonStart'], simonExtra: extra },
          'simon',
        ),
        id,
      ).toBe(label);
    }
  });
});

/** Mega Man's weapon label as its source table gives it. */
function mmLabelFromSource(id: string): string | undefined {
  return MM_WEAPONS.find((w) => w.id === id)?.label;
}

describe('the press that closes a box never makes the hero jump (O-15 release review)', () => {
  // Mega Man, Ryu and Sophia jump from the jump buffer (JUMP_BUFFER_FRAMES): a press still in it
  // when the box goes would jump on the level's next frame.
  for (const hero of [MEGAMAN, RYU, SOPHIA])
    for (const reduce of [true, false])
      it(`${hero.name}, Reduce flashing ${reduce ? 'on' : 'off'}: OK closes the start box and the hero stays on the ground`, () => {
        const h = game(true);
        h.game.ctx.reduceFlashing = reduce;
        const l = play(h, hero, ['characterSelect', 'firstCharacterStart']);
        untilBox(h);
        readBox(h);
        expect(h.top()).toBeInstanceOf(LevelScene);
        const p = l.world.player;
        const y = p.body.y;
        for (let i = 0; i < 30; i++) {
          h.step();
          expect(p.body.y, `frame ${i}`).toBe(y);
        }
      });
});

describe('a box queued as a run ends never shows in the next run (O-15 release review)', () => {
  it('leaving for the CLASSIC menu, or resuming from Continue, clears the queue', () => {
    const h = game(true);
    play(h, MARIO, ['characterSelect', 'firstCharacterStart', 'marioStart']);
    h.game.classicTutorials.offer('star', 'mario');
    expect(h.game.classicTutorials.pending).toEqual(['star']);
    h.game.showClassicMenu();
    expect(h.game.classicTutorials.pending).toEqual([]);
    h.game.classicTutorials.offer('mushroom', 'mario');
    expect(h.game.classicTutorials.pending).toEqual(['mushroom']);
    h.game.resumeClassic();
    expect(h.game.classicTutorials.pending).toEqual([]);
  });
});

describe('which boxes have been seen (TutorialManager.saveData / startNewGameHandler)', () => {
  it('each box shows once a game, is saved at once, and a new game shows them all again', () => {
    const h = game(true);
    play(h);
    untilBox(h);
    readBox(h);
    expect(loadSettings().classicTutorialsSeen).toEqual([
      'characterSelect',
      'firstCharacterStart',
      'marioStart',
    ]);
    // The next level start: nothing new for Mario.
    h.game.goToLevel('1-2', { mode: 'stand' });
    h.until(() => h.top() instanceof LevelScene, 600);
    expect(untilBox(h, 200)).toBeNull();
    // A new game from the CLASSIC menu: the select's box again.
    h.game.classicSelect('1-1', () => h.game.showClassicMenu());
    expect(h.game.classicTutorials.seen).toEqual(['characterSelect']);
    expect(idsOf(readBox(h), h)).toEqual(['characterSelect']);
  });
});

describe('upgradeTutorials follows the Classic kits and Customize Weapons (PS-C5)', () => {
  it("names the original's boxes for each hero's Mushroom and Fire Flower", () => {
    const h = game(true);
    expect(upgradeTutorials(h.game, LINK.id, 'big')).toEqual(['linkBlueRing', 'linkBomb']);
    expect(upgradeTutorials(h.game, LINK.id, 'fire')).toEqual(['linkRedRing', 'linkBombBag']);
    expect(upgradeTutorials(h.game, 'samus', 'fire')).toEqual([
      'samusWaveBeam',
      'samusScrewAttack',
      'samusMissileExpansion',
    ]);
    expect(upgradeTutorials(h.game, MEGAMAN.id, 'big')).toEqual(['megamanPowerUp']);
    expect(upgradeTutorials(h.game, MEGAMAN.id, 'fire')).toEqual(['megamanMetalBlade']);
    expect(upgradeTutorials(h.game, RYU.id, 'fire')).toEqual(['ryuScroll']);
    expect(upgradeTutorials(h.game, 'sophia', 'big')).toEqual(['sophiaHover']);
    // SOPHIA_WALL_CLIMB and SOPHIA_CEILING_CLIMB: our Flower (Crusher) brings both climbs.
    expect(upgradeTutorials(h.game, 'sophia', 'fire')).toEqual(['sophiaWallClimb', 'sophiaCeilingClimb']);
    // Bass's Flower weapon is one of Mega Man's: the same box (his Water Shield by default).
    expect(upgradeTutorials(h.game, 'bass', 'fire')).toEqual(['megamanWaterShield']);
    expect(upgradeTutorials(h.game, 'bass', 'big')).toEqual([]);
    expect(upgradeTutorials(h.game, MARIO.id, 'fire')).toEqual([]);
    const bow = game(true, {
      weapons: { ...defaultClassicSettings().weapons, link: 'bow', megaman: 'super-arm' },
    });
    expect(upgradeTutorials(bow.game, LINK.id, 'big')).toEqual(['linkBlueRing', 'linkBow']);
    expect(upgradeTutorials(bow.game, MEGAMAN.id, 'fire')).toEqual(['megamanSuperArm']);
    for (const hero of ['link', 'samus', 'megaman', 'ryu', 'sophia'])
      for (const st of ['big', 'fire'] as const)
        for (const id of upgradeTutorials(h.game, hero, st)) expect(TUTORIAL_TEXT[id], id).toBeDefined();
  });
});
