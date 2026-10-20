import { describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import {
  CLASSIC_GAME_MODES,
  defaultClassicSettings,
  type ClassicSettings,
} from '@engine/save/original-options';
import { MARIO } from '@game/characters/mario';
import { LUIGI } from '@game/characters/luigi';
import { SIMON } from '@game/characters/simon';
import { CharacterSelectScene, REVIVE_DONE_QUESTION, REVIVE_NEWS } from '@game/scenes/character-select';
import { GameOverScene, GAME_OVER_CARD_FRAMES } from '@game/scenes/game-over';
import { IntroScene } from '@game/scenes/intro';
import { LevelScene } from '@game/scenes/level';
import { GAME_MODE_ROW } from '@game/scenes/original-options';
import { REVIVAL_PICKUPS, revivalAfter, STRENGTHEN_STEPS, Survival } from '@game/survival';
import { draw, file, makeGame, useStorage, type H } from './heroes-harness';
import { isolateClassicRegistry } from './classic-registry';

// Classic mode's Survival (Options > Game mode), FU-7b of docs/classic/FOLLOW_UPS_PROPOSAL.md,
// as the original SMBC 3.1.21 plays it. Citations are to the original's source:
// conv/StatManager.as, conv/CharacterSelectBox.as, smbc/src/com/smbc/managers/EventManager.as,
// ScreenManager.as, screens/InformativeBlackScreen.as, data/CampaignModes.as.

useStorage();
isolateClassicRegistry({ hideExtras: true });

function classic(over: Partial<ClassicSettings> = {}): H & { settings: Settings } {
  const settings = { ...defaultSettings(), classic: { ...defaultClassicSettings(), ...over } };
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  return { ...h, settings };
}
const survival = (over: Partial<ClassicSettings> = {}) => classic({ gameMode: 'survival', ...over });

const inLevel = (h: H) => h.top() instanceof LevelScene;
const sel = (h: H) => h.top() as CharacterSelectScene;

function enterLevel(h: H): LevelScene {
  h.until(() => inLevel(h), 600);
  h.idle(2);
  return h.top() as LevelScene;
}

function die(h: H): void {
  const w = enterLevel(h).world;
  w.kill(w.player);
  h.until(() => !inLevel(h), 400);
}

/** The first select of a Survival run, idled until it takes input. */
function start(h: H, levelId = '1-1'): CharacterSelectScene {
  h.game.classicSelect(levelId, () => h.game.showClassicMenu());
  const s = sel(h);
  expect(s).toBeInstanceOf(CharacterSelectScene);
  h.idle(12);
  return s;
}

/** Moves the select's cursor to hero `id` (rightwards). */
function to(h: H, id: string): void {
  const s = sel(h);
  for (let i = 0; i < 20 && s.chars[s.cursor]?.id !== id; i++) h.tap('right');
  expect(s.chars[s.cursor]?.id).toBe(id);
}

/** Answers the "finished?" box YES (Up toggles NO → YES, OK answers). */
function finishReviving(h: H): void {
  h.tap('attack');
  expect(sel(h).boxShown).toBe('finished');
  h.tap('up');
  h.tap('jump');
  expect(sel(h).reviving).toBe(false);
}

/** A Survival run in its first level with Mario (revived), the other heroes fallen. */
function playing(h: H, revive: string[] = [MARIO.id], levelId = '1-1'): void {
  start(h, levelId);
  for (const id of revive) {
    to(h, id);
    h.tap('jump');
  }
  if (sel(h).reviving) finishReviving(h);
  to(h, revive[0] as string);
  h.tap('jump');
  enterLevel(h);
}

describe('the Game mode row: Survival added, the other modes unchanged', () => {
  it('Survival is the second Game mode value, as in CampaignModeMenu.as 21-24 (CampaignModes.as 7, 13), named Survival, explained in the hint', () => {
    expect(CLASSIC_GAME_MODES).toEqual(['all', 'survival', 'single', 'single-random']);
    expect((GAME_MODE_ROW.name as (v: string) => string)('survival')).toBe('Survival');
    expect(GAME_MODE_ROW.hint).toMatch(/Survival: each hero has one life/);
    // The original's default is All Characters (GameSettings.as 88).
    expect(defaultClassicSettings().gameMode).toBe('all');
  });

  it('guard: All heroes, Single hero and Single random decide as before; Survival always selects', () => {
    const g = (gameMode: ClassicSettings['gameMode']) => classic({ gameMode }).game;
    expect([g('all').classicHeroChoice(true), g('all').classicHeroChoice(false)]).toEqual([
      'select',
      'select',
    ]);
    expect([g('single').classicHeroChoice(true), g('single').classicHeroChoice(false)]).toEqual([
      'select',
      'keep',
    ]);
    expect([g('single-random').classicHeroChoice(true), g('single-random').classicHeroChoice(false)]).toEqual(
      ['random', 'random'],
    );
    // ScreenManager.createLevel shows CharacterSelect in every mode but the single ones.
    expect([g('survival').classicHeroChoice(true), g('survival').classicHeroChoice(false)]).toEqual([
      'select',
      'select',
    ]);
  });

  it('guard: the other modes have no Survival: no revive mode, a death costs a life and no one falls', () => {
    for (const gameMode of ['all', 'single'] as const) {
      const h = classic({ gameMode });
      h.game.classicSelect('1-1', () => h.game.showClassicMenu());
      h.idle(12);
      expect(sel(h).reviving).toBe(false);
      expect(h.game.survival).toBeNull();
      h.tap('jump');
      const lives = h.game.state.lives;
      die(h);
      expect(h.game.state.lives).toBe(lives - 1);
      expect(h.game.cardLives).toBe(lives - 1);
    }
    const h = classic({ gameMode: 'single-random' });
    h.game.classicSelect('1-1', () => h.game.showClassicMenu());
    expect(h.top()).toBeInstanceOf(IntroScene);
    expect(h.game.survival).toBeNull();
  });

  it('guard: the campaign never has Survival, even with the setting on', () => {
    const h = survival();
    file();
    h.game.openFile(1);
    h.game.enterLevelFromMap('1-1');
    expect(h.game.survival).toBeNull();
    expect(sel(h).survival).toBeNull();
    expect(sel(h).reviving).toBe(false);
  });
});

describe('a new game', () => {
  it('starts with every hero fallen (StatManager.as 250, 287-288) and opens in revive mode (CharacterSelectBox.as 131-135)', () => {
    const h = survival();
    const s = start(h);
    expect(s.reviving).toBe(true);
    expect(s.chars.every((_, i) => s.fallen(i))).toBe(true);
    expect(h.game.survival?.allFallen).toBe(true);
    // No news box while every hero has fallen (136: !checkPStateVecForAllZeroes()).
    expect(s.boxShown).toBeNull();
    expect(h.said.at(-1)).toMatch(
      /^Revive your heroes: each costs one life\. 3 lives left\. Mario: revive\./,
    );
    expect(h.said.at(-1)).toMatch(/OK to revive\. BACK to leave\. Every hero has fallen\.$/);
    expect(h.game.state.lives).toBe(3);
    // The fallen are drawn grey (markPortraitFallen: desaturate).
    const d = draw(s);
    expect(d.sprites.some((x) => x.key.endsWith('~fallen'))).toBe(true);
    expect(d.texts.map((t) => t.str)).toEqual(
      // The original's layout: the name box says what OK does, the hero, the lives remaining.
      expect.arrayContaining(['REVIVE', 'MARIO', '3 LIVES REMAINING', '0 OF 9 HEROES STANDING']),
    );
  });

  it('starts with More Settings > Lives to revive with (resetAllStats: initialLivesCount)', () => {
    const h = survival({ lives: 5 });
    start(h);
    expect(h.game.state.lives).toBe(5);
  });

  it('BACK with every hero still fallen leaves for the CLASSIC menu (the run has not begun)', () => {
    const h = survival();
    start(h);
    h.tap('attack');
    expect(h.game.classicRun).toBe(false);
    expect(h.game.survival).toBeNull();
  });
});

describe('revive mode (CharacterSelectBox.reviveCharacter, 406-455)', () => {
  it('OK revives the fallen hero for one life (410: loseLife; 432-436: PS_NORMAL), with the power-up sound', () => {
    const h = survival();
    start(h);
    h.tap('jump');
    expect(h.game.survival?.isFallen(MARIO.id)).toBe(false);
    expect(h.game.state.lives).toBe(2);
    expect(h.said.at(-1)).toBe('Mario revived. 2 lives left.');
    expect(h.audio.sfx).toHaveBeenCalledWith('powerup');
    // A revived hero can still be strengthened: still in revive mode, cursor kept.
    expect(sel(h).reviving).toBe(true);
    expect(sel(h).chars[sel(h).cursor]).toBe(MARIO);
  });

  it('OK on a standing hero strengthens it (421-430): two power-ups, so it starts its next level with the Fire Flower and no points', () => {
    const h = survival({ lives: 5 });
    start(h);
    h.tap('jump'); // revive Mario
    h.tap('jump'); // strengthen Mario
    expect(h.said.at(-1)).toBe('Mario powered up. 3 lives left.');
    expect(h.game.survival?.boosted(MARIO.id)).toBe(true);
    // Fully upgraded (charIsFullyUpgraded): Mario is no longer offered (438-444, 324).
    expect(h.game.fullyUpgraded(MARIO)).toBe(true);
    expect(sel(h).chars[sel(h).cursor]).not.toBe(MARIO);
    finishReviving(h);
    to(h, MARIO.id);
    h.tap('jump');
    const w = enterLevel(h).world;
    expect(w.player.powerState).toBe('fire');
    expect(STRENGTHEN_STEPS).toBe(2);
    // StatManager.addPoints scores nothing at character select; no grow animation either.
    expect(h.game.state.score).toBe(0);
    expect(w.player.transition).toBeNull();
    expect(h.game.survival?.boosted(MARIO.id)).toBe(false);
  });

  it('a strengthened hero also gets its revivalBoost ammo (Simon.as: two big hearts)', () => {
    const hearts = (strengthen: boolean) => {
      const h = survival({ lives: 5 });
      start(h);
      to(h, SIMON.id);
      h.tap('jump');
      if (strengthen) h.tap('jump');
      finishReviving(h);
      to(h, SIMON.id);
      h.tap('jump');
      const w = enterLevel(h).world;
      return { hearts: w.player.scratch.hearts ?? 0, power: w.player.powerState };
    };
    const plain = hearts(false);
    const boosted = hearts(true);
    expect(plain.power).toBe('small');
    expect(boosted.power).toBe('fire');
    expect(REVIVAL_PICKUPS.simon).toEqual(['heart-large', 'heart-large']);
    expect(boosted.hearts).toBe(plain.hearts + 10);
  });

  it('the Random slot revives a random hero it can (720-721: getRandomCharInd)', () => {
    const h = survival();
    start(h);
    h.tap('left'); // the Random slot
    expect(sel(h).cursor).toBe(sel(h).chars.length);
    h.tap('jump');
    expect(h.game.survival?.standing().length).toBe(1);
    expect(h.said.at(-2)).toMatch(/^Random: /);
  });

  it('ends when the lives run out (448: numLives < MIN_LIVES_FOR_ALLOW_REVIVAL)', () => {
    const h = survival({ lives: 1 });
    start(h);
    h.tap('jump');
    expect(h.game.state.lives).toBe(0);
    expect(sel(h).reviving).toBe(false);
    expect(h.said.at(-1)).toMatch(/^Choose your hero\. Mario\./);
    // Picking: only standing heroes (changeMode: pState != PS_FALLEN).
    h.tap('right');
    expect(sel(h).cursor).toBe(sel(h).chars.length); // the Random slot, past the fallen
    h.tap('right');
    expect(sel(h).chars[sel(h).cursor]).toBe(MARIO);
  });

  it('ends when nothing is left to revive or strengthen (448: only the Random slot left)', () => {
    const h = survival();
    const s = start(h);
    h.game.state.lives = 99;
    for (let i = 0; i < s.chars.length * 2 && s.reviving; i++) h.tap('jump');
    expect(s.reviving).toBe(false);
    expect(s.chars.every((c) => h.game.fullyUpgraded(c))).toBe(true);
    expect(h.game.state.lives).toBe(99 - s.chars.length * 2);
  });

  it('DONE asks first (618-626: CANCEL_REVIVE, NO / YES); NO stays, YES goes on to pick (628-631)', () => {
    const h = survival();
    start(h);
    h.tap('jump');
    h.tap('attack');
    expect(sel(h).boxShown).toBe('finished');
    expect(h.said.at(-1)).toMatch(/^Are you finished reviving and strengthening heroes\? No\./);
    expect(draw(sel(h)).texts.map((t) => t.str)).toEqual(
      expect.arrayContaining([...REVIVE_DONE_QUESTION, 'NO', 'YES']),
    );
    // It waits: nothing moves on by itself.
    h.idle(600);
    expect(sel(h).boxShown).toBe('finished');
    h.tap('jump'); // NO
    expect(sel(h).boxShown).toBeNull();
    expect(sel(h).reviving).toBe(true);
    finishReviving(h);
    expect(h.said.at(-1)).toMatch(/^Choose your hero\..* Standing: Mario\.$/);
  });

  it('needs at least one life to open (53, 133: MIN_LIVES_FOR_ALLOW_REVIVAL = 1)', () => {
    const h = survival();
    playing(h, [MARIO.id, LUIGI.id, SIMON.id]);
    expect(h.game.state.lives).toBe(0);
    // A warp pipe allows revival, but there is no life to pay with: the plain select.
    h.game.warpToLevel('4-1', { mode: 'stand' });
    expect(sel(h).reviving).toBe(false);
  });
});

describe('deaths and the end of the run', () => {
  it('a death makes the hero fall and costs no life (StatManager.as 1560-1577); the next select picks among the standing', () => {
    const h = survival();
    playing(h, [MARIO.id, LUIGI.id]);
    expect(h.game.state.lives).toBe(1);
    die(h);
    expect(h.game.state.lives).toBe(1);
    expect(h.game.survival?.isFallen(MARIO.id)).toBe(true);
    // characterSelectStartHandler used the revival up: the plain select.
    const s = sel(h);
    expect(s).toBeInstanceOf(CharacterSelectScene);
    expect(s.reviving).toBe(false);
    expect(s.chars[s.cursor]).toBe(LUIGI);
    expect(h.said.at(-1)).toMatch(/ Standing: Luigi\.$/);
    expect(draw(s).texts.map((t) => t.str)).toContain('1 OF 9 HEROES STANDING');
  });

  it('the pre-level card shows one life (InformativeBlackScreen: numLives = 1 in Survival)', () => {
    const h = survival({ lives: 7 });
    playing(h, [MARIO.id, LUIGI.id]);
    die(h);
    h.idle(12);
    h.tap('jump'); // Luigi
    expect(h.top()).toBeInstanceOf(IntroScene);
    expect(h.game.cardLives).toBe(1);
    expect(h.said.at(-1)).toBe('World 1-1. 1 life.');
    expect(draw(h.top() as IntroScene).texts.map((t) => t.str)).toContain('×  1');
  });

  it('the run is over when every hero has fallen, whatever the lives (EventManager.checkGameOver)', () => {
    const h = survival({ lives: 5 });
    playing(h);
    expect(h.game.state.lives).toBe(4);
    die(h);
    expect(h.top()).toBeInstanceOf(GameOverScene);
  });

  it('with no lives left the run goes on while a hero stands', () => {
    const h = survival();
    playing(h, [MARIO.id, LUIGI.id, SIMON.id]);
    expect(h.game.state.lives).toBe(0);
    die(h);
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
  });

  it('a continue starts over: every hero fallen, the lives back, revival allowed (continueAfterDyingHandler)', () => {
    const h = survival();
    playing(h);
    die(h);
    h.idle(GAME_OVER_CARD_FRAMES + 2);
    h.tap('jump'); // CONTINUE: YES
    const s = sel(h);
    expect(s).toBeInstanceOf(CharacterSelectScene);
    expect(s.reviving).toBe(true);
    expect(h.game.state.lives).toBe(3);
    expect(h.game.survival?.allFallen).toBe(true);
  });

  it('infinite lives: a death plays as in the other modes (playerDie: || Cheats.infiniteLives)', () => {
    const h = survival();
    playing(h);
    h.game.ctx.assist.infiniteLives = true;
    die(h);
    expect(h.game.survival?.isFallen(MARIO.id)).toBe(false);
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
    // Reviving costs nothing then either (loseLife returns).
    expect(h.game.reviveHero(LUIGI)).toBe('revived');
    expect(h.game.state.lives).toBe(2);
  });
});

describe('when revival comes back', () => {
  it('after a castle, or world 8 stage 3 (StatManager.beatLevelHandler)', () => {
    expect(revivalAfter(1, 4)).toBe(true);
    expect(revivalAfter(8, 3)).toBe(true);
    expect(revivalAfter(8, 4)).toBe(true);
    expect(revivalAfter(1, 3)).toBe(false);
    expect(revivalAfter(7, 3)).toBe(false);
    expect(revivalAfter(1, 1)).toBe(false);
  });

  it('a castle clear opens revive mode with the news first (CharacterSelectBox.as 136-141); other clears do not', () => {
    const h = survival();
    playing(h);
    h.game.levelExitTo('1-3', { world: 1, stage: 2 });
    expect(sel(h).reviving).toBe(false);
    h.idle(12);
    h.tap('jump');
    enterLevel(h);
    h.game.levelExitTo('2-1', { world: 1, stage: 4 });
    const s = sel(h);
    expect(s.reviving).toBe(true);
    expect(s.boxShown).toBe('news');
    expect(h.said.at(-1)).toBe('You can now revive and strengthen heroes. OK to go on.');
    expect(draw(s).texts.map((t) => t.str)).toEqual(expect.arrayContaining(REVIVE_NEWS));
    // The news waits for OK.
    h.idle(600);
    expect(s.boxShown).toBe('news');
    h.tap('jump');
    expect(s.boxShown).toBeNull();
    expect(h.said.at(-1)).toMatch(/^Revive your heroes: .*DONE when finished\./);
  });

  it('a warp pipe to another level allows it (EventManager.levelTransfer → StatManager.warpPipeHandler)', () => {
    const h = survival();
    playing(h);
    h.game.warpToLevel('4-1', { mode: 'stand' });
    expect(sel(h).reviving).toBe(true);
  });

  it('each select uses it up (characterSelectStartHandler)', () => {
    const s = new Survival(() => ['a', 'b']);
    expect(s.reviveAllowed).toBe(true);
    const h = survival();
    playing(h);
    expect(h.game.survival?.reviveAllowed).toBe(false);
  });
});

describe('accessibility and touch', () => {
  it('revive mode names abilities on touch: OK and DONE (BACK while every hero has fallen)', () => {
    const h = survival();
    const s = start(h);
    expect(s.touchLabels()).toMatchObject({ jump: 'OK', attack: 'BACK' });
    h.tap('jump');
    expect(s.touchLabels()).toMatchObject({ jump: 'OK', attack: 'DONE' });
    h.tap('attack');
    expect(s.touchLabels()).toMatchObject({ jump: 'OK', attack: null });
  });

  it('moving the cursor says the hero and what OK does there', () => {
    const h = survival();
    start(h);
    h.tap('jump');
    h.tap('right');
    expect(h.said.at(-1)).toBe('Luigi: revive');
    h.tap('left');
    expect(h.said.at(-1)).toBe('Mario: power up');
  });

  it('revive mode draws no blinking text: the same lines on every frame', () => {
    const h = survival();
    const s = start(h);
    const lines = new Set<string>();
    for (let i = 0; i < 80; i++) {
      h.idle(1);
      lines.add(
        draw(s)
          .texts.map((t) => t.str)
          .join('|'),
      );
    }
    expect(lines.size).toBe(1);
  });
});

describe('runs started without the first select (QA)', () => {
  it('a dev Level select Classic run with Survival set plays Survival, its hero standing', () => {
    const h = survival();
    h.game.devStart('1-1', MARIO, 'small', false, undefined, { rules: 'classic', classic: true });
    expect(h.game.survivalRun).toBe(true);
    expect(h.game.survival?.standing()).toEqual([MARIO.id]);
    expect(h.game.survival?.reviveAllowed).toBe(false);
    expect(h.game.cardLives).toBe(1);
    die(h);
    // Mario fell and he was the only one standing: the run is over.
    expect(h.top()).toBeInstanceOf(GameOverScene);
  });

  it('Free play started from inside a Survival run has no Survival: lives, no falls', () => {
    const h = survival();
    playing(h);
    expect(h.game.survivalRun).toBe(true);
    h.game.devStart('1-1', MARIO, 'small');
    expect(h.game.survival).toBeNull();
    expect(h.game.cardLives).toBe(h.game.state.lives);
    const lives = h.game.state.lives;
    die(h);
    expect(h.game.state.lives).toBe(lives - 1);
    expect(h.top()).toBeInstanceOf(IntroScene);
  });

  it('infinite lives with no lives left: the run goes on while a hero stands (checkGameOver)', () => {
    const h = survival();
    playing(h, [MARIO.id, LUIGI.id, SIMON.id]);
    expect(h.game.state.lives).toBe(0);
    h.game.ctx.assist.infiniteLives = true;
    die(h);
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
    expect(h.game.survival?.isFallen(MARIO.id)).toBe(false);
  });
});

describe('the revive prompt (QA)', () => {
  it('says what OK does: REVIVE for a fallen hero, POWER UP for a standing one', () => {
    const h = survival();
    const s = start(h);
    const prompt = () => draw(s).texts.find((t) => /^OK\b.* TO /.test(t.str))?.str;
    expect(prompt()).toMatch(/^OK( \(.+\))? TO REVIVE$/);
    h.tap('jump');
    expect(prompt()).toMatch(/^OK( \(.+\))? TO POWER UP$/);
  });
});

describe('with Classic mode cheats (merged with the cheats branch)', () => {
  it('the Infinite Lives cheat: a death plays as in the other modes, and reviving is free', () => {
    const h = survival();
    h.settings.classicCheats.on.infiniteLives = true;
    h.settings.classicCheats.unlocked.infiniteLives = true;
    playing(h);
    expect(h.game.state.lives).toBe(3);
    die(h);
    expect(h.game.survival?.isFallen(MARIO.id)).toBe(false);
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
    expect(h.game.reviveHero(LUIGI)).toBe('revived');
    expect(h.game.state.lives).toBe(3);
  });

  it("a level's exit passes the cleared level: a castle brings revival back, another level does not", () => {
    const h = survival();
    playing(h);
    (h.top() as LevelScene).world.events.push({ type: 'exit', next: '1-2' });
    h.step();
    expect(sel(h).reviving).toBe(false);
    const h2 = survival();
    playing(h2, [MARIO.id], '1-4');
    (h2.top() as LevelScene).world.events.push({ type: 'exit', next: '2-1' });
    h2.step();
    expect(sel(h2).reviving).toBe(true);
  });

  it('a first 1-4 clear: the cheat news first (read out, waits for OK), then the revive news and screen', () => {
    const h = survival();
    playing(h, [MARIO.id], '1-4');
    (h.top() as LevelScene).world.events.push({ type: 'exit', next: '2-1' });
    h.step();
    expect(h.settings.classicCheats.unlocked.extraCheckpoints).toBe(true);
    const s = sel(h);
    expect(s.reviving).toBe(true);
    expect(s.boxShown).toBe('cheats');
    expect(h.said.at(-1)).toMatch(/^You unlocked these cheats: .*Extra Checkpoints.*! OK to go on\.$/);
    const texts = () => draw(s).texts.map((t) => t.str);
    expect(texts()).toEqual(
      expect.arrayContaining(['CHEATS UNLOCKED!', 'EXTRA CHECKPOINTS', '1 OF 9 HEROES STANDING']),
    );
    // Drawn in the box only: not over the counts under the heading.
    expect(draw(s).texts.filter((t) => t.str === 'CHEATS UNLOCKED!' && t.y < 80)).toEqual([]);
    h.idle(600);
    expect(s.boxShown).toBe('cheats');
    h.tap('jump');
    expect(s.boxShown).toBe('news');
    expect(h.said.at(-1)).toBe('You can now revive and strengthen heroes. OK to go on.');
    h.tap('jump');
    expect(s.boxShown).toBeNull();
    expect(h.said.at(-1)).toMatch(/^Revive your heroes: /);
  });
});
