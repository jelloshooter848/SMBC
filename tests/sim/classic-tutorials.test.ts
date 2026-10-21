import { describe, expect, it } from 'vitest';
import { defaultSettings, loadSettings, saveSettings, type Settings } from '@engine/save/settings';
import { defaultClassicSettings, type ClassicSettings } from '@engine/save/original-options';
import { MARIO } from '@game/characters/mario';
import { LINK } from '@game/characters/link';
import { MEGAMAN } from '@game/characters/megaman';
import { RYU } from '@game/characters/ryu';
import { fontText } from '@game/hud/text';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { CARD_GUARD_FRAMES } from '@game/scenes/message';
import { LevelScene } from '@game/scenes/level';
import type { MenuItem, MenuScene } from '@game/scenes/menu';
import { ClassicOptionsScene, TUTORIALS_HINT } from '@game/scenes/original-game';
import {
  fillAbilities,
  TUTORIAL_IDS,
  TUTORIAL_TEXT,
  TutorialBoxScene,
  upgradeTutorials,
} from '@game/tutorial/original-tutorials';
import type { Announcer } from '@engine/a11y/announcer';
import { file, makeGame, useStorage, type H } from './heroes-harness';
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
    h.idle(CARD_GUARD_FRAMES + 1);
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
  h.idle(12);
  for (let i = 0; i < 20 && s.chars[s.cursor]?.id !== hero.id; i++) h.tap('right');
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
    expect(h.said.at(-1)).toMatch(/Tutorial\. Use LEFT and RIGHT to move the cursor/);
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
    h.idle(CARD_GUARD_FRAMES + 1);
    h.tap('special');
    expect(b.pageIndex).toBe(1);
    h.idle(CARD_GUARD_FRAMES + 1);
    h.tap('start');
    expect(b.pageIndex).toBe(2);
    h.idle(CARD_GUARD_FRAMES + 1);
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
        expect(filled, id).not.toMatch(/\{[A-Z]+\}|_BTN|\b(button|key) [A-Z]\b|\b[ABXY] (button|to)\b/i);
        expect(filled, id).not.toMatch(/arrow keys|Exploding Rabbit/i);
        for (const part of filled.split('\n'))
          expect(fontText(part).length, `${id}: ${part}`).toBe(part.toUpperCase().length);
      }
    }
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
