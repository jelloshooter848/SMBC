import { describe, expect, it } from 'vitest';
import { px } from '@engine/math/units';
import { loadProgress, PROGRESS_KEY, recordBeat, allSetsBeaten, saveProgress } from '@engine/save/progress';
import { defaultSettings, type Settings } from '@engine/save/settings';
import type { CharacterDef } from '@game/characters/character';
import { CHARACTERS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { Bowser } from '@game/entities/enemies/bowser';
import { Princess } from '@game/entities/objects/princess';
import { Toad } from '@game/entities/objects/toad';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { CreditsScene } from '@game/scenes/credits';
import { LevelScene } from '@game/scenes/level';
import type { MenuItem } from '@game/scenes/menu';
import { CARD_GUARD_FRAMES, CardScene, MessageScene } from '@game/scenes/message';
import type { ClassicMenuScene } from '@game/scenes/original-game';
import {
  MAP_SETS,
  classicBeatStatus,
  classicNextWorld,
  mapSetOf,
  recordClassicBeat,
} from '@game/scenes/original-game';
import { TitleScene } from '@game/scenes/title';
import { makeGame, store, useStorage, type H } from './heroes-harness';
import { isolateClassicRegistry } from './classic-registry';

// 0.5.0 Classic gap list, batch 2: the Lost Levels run straight on from 1-1 to D-4 with 8-4 an
// ordinary castle (G-001, G-002); every map set is offered from the start and the credits go back
// to the title (G-003, G-004, owner decision D3); each set keeps its beat status (G-005). The
// campaign keeps its own flow (tests/sim/lost-campaign.test.ts, ending.test.ts).

isolateClassicRegistry({ hideExtras: true });
useStorage();

const items = (s: unknown) => (s as { items: MenuItem[] }).items;

function classic(over: Partial<Settings> = {}): H {
  return makeGame({ deps: { settings: { ...defaultSettings(), ...over }, applySettings: () => {} } });
}

const inLevel = (h: H) => h.top() instanceof LevelScene;
const level = (h: H) => h.top() as LevelScene;

/** Into the level through its WORLD card. */
function enterLevel(h: H): LevelScene {
  h.until(() => inLevel(h), 600);
  return level(h);
}

/** On a select screen: pick `def` (the cursor starts on the current hero). */
function choose(h: H, def: CharacterDef): void {
  h.until(() => h.top() instanceof CharacterSelectScene, 600);
  h.idle(12);
  const said = () => h.said.at(-1)?.split(', ')[0];
  for (let i = 0; i <= CHARACTERS.length && said() !== def.name; i++) h.tap('right');
  h.tap('jump');
}

/**
 * Takes the axe in the castle on top (the hero set on it once its Bowser is there) and presses
 * OK whenever the castle's text waits; returns every castle text seen, until the level is left.
 */
function takeAxe(h: H, axe: number): string[][] {
  const l = level(h);
  const w = l.world;
  h.game.ctx.assist.invulnerable = true;
  const texts: string[][] = [];
  let placed = false;
  const put = (col: number) => {
    const b = w.player.body;
    b.x = px(col * 16 + 2);
    b.y = px(9 * 16) - b.h;
    b.vx = 0;
    b.vy = 0;
    w.camera.snapTo(b.x);
  };
  // Near the bridge first, so its Bowser comes into reach.
  put(axe - 6);
  for (let i = 0; i < 2000 && h.top() === l; i++) {
    if (!placed && w.entities.some((e) => e instanceof Bowser && !e.fake)) {
      placed = true;
      put(axe);
    }
    h.step(w.castleWaiting && i % 2 === 0 ? ['jump'] : []);
    const t = w.castleText;
    if (t.length && t.join('|') !== (texts.at(-1) ?? []).join('|')) texts.push([...t]);
  }
  expect(placed).toBe(true);
  return texts;
}

describe('G-001/G-002: the Lost Levels run straight on from 1-1 to D-4', () => {
  it('every castle but the last world goes on to the next world (Level.as X-4 to (X+1)-1)', () => {
    expect(classicNextWorld('ll-8-4')).toBe('ll-9-1');
    expect(classicNextWorld('ll-9-4')).toBe('ll-10-1');
    expect(classicNextWorld('ll-12-4')).toBe('ll-13-1');
    expect(classicNextWorld('ll-13-4')).toBeNull();
    expect(classicNextWorld('1-4')).toBe('2-1');
    expect(classicNextWorld('8-4')).toBeNull();
    expect(classicNextWorld('ll-8-3')).toBeNull();
    expect(mapSetOf('ll-10-2-exit').id).toBe('lost');
    expect(mapSetOf('8-4-end').id).toBe('smb');
  });

  it('8-4: Toad, "another castle", then the select screen and World 9 (a warped run too)', () => {
    const h = classic();
    h.game.classicGame(MARIO, 'll-8-4-end3');
    const l = enterLevel(h);
    // Warps never shut World 9 in the original (no warp check anywhere).
    h.game.state.warped = true;
    expect(l.world.classicEnd).toEqual({ next: 'll-9-1-start' });
    const texts = takeAxe(h, 125);
    expect(texts.at(-1)).toEqual(['THANK YOU MARIO!', '', 'BUT OUR PRINCESS IS IN', 'ANOTHER CASTLE!']);
    expect(l.world.entities.some((e) => e instanceof Toad)).toBe(true);
    expect(l.world.entities.some((e) => e instanceof Princess)).toBe(false);
    // No NES ending card, no games-beaten tally.
    expect(h.top()).not.toBeInstanceOf(CardScene);
    choose(h, MARIO);
    expect(enterLevel(h).level.id).toBe('ll-9-1-start');
    expect(h.game.classicRun).toBe(true);
    // The NES progress store is left alone.
    expect(loadProgress().lost.beaten).toBe(0);
  });

  it("9-4's flag goes on to World A (10-1)", () => {
    const h = classic();
    h.game.classicGame(MARIO, 'll-9-4');
    const l = enterLevel(h);
    expect(l.world.classicEnd).toEqual({ next: 'll-10-1' });
    // The flag's exit (World.updateClear 'flag') reads the same way on.
    expect((l.world as unknown as { exitNext(n?: string): string }).exitNext('end')).toBe('ll-10-1');
    l.world.events.push({ type: 'exit', next: 'll-10-1' });
    h.step();
    choose(h, MARIO);
    expect(enterLevel(h).level.id).toBe('ll-10-1');
  });

  it('D-4: "YOUR QUEST IS OVER.", the credits, the cheat cards, then the title; Lost Levels beaten', () => {
    const h = classic();
    h.game.classicGame(MARIO, 'll-13-4-end');
    const l = enterLevel(h);
    expect(l.world.classicEnd).toEqual({ next: null });
    const texts = takeAxe(h, 109);
    expect(texts.at(-1)).toEqual(['THANK YOU MARIO!', '', 'YOUR QUEST IS OVER.']);
    const credits = h.top() as CreditsScene;
    expect(credits).toBeInstanceOf(CreditsScene);
    h.until(() => credits.touchLabels().jump === 'OK', 6000);
    h.tap('jump');
    for (let i = 0; i < 12 && h.top() instanceof MessageScene; i++) {
      expect(h.said.at(-1)).toMatch(/^You unlocked the .+ cheat!/);
      h.idle(CARD_GUARD_FRAMES + 2);
      h.tap('jump');
    }
    expect(h.top()).toBeInstanceOf(TitleScene);
    expect(classicBeatStatus('lost')).toBe('normal');
    expect(classicBeatStatus('smb')).toBe('none');
    expect(h.game.deps.settings?.classicCheats.beaten.lost).toBe(true);
  });

  it('outside Classic mode the NES rules stay (free play: no way on from 8-4)', () => {
    const h = classic();
    h.game.newGame(MARIO, 'll-8-4');
    expect(enterLevel(h).world.classicEnd).toBeNull();
  });
});

describe('G-003/G-004: every map set from the start; the title after the credits', () => {
  it('the CLASSIC menu lists the map sets in the original order, each read out with its state', () => {
    const h = classic();
    h.game.showClassicMenu();
    const menu = h.top() as ClassicMenuScene;
    expect(items(menu).map((i) => i.label)).toEqual([...MAP_SETS.map((m) => m.label), 'Options', 'Back']);
    expect(MAP_SETS.map((m) => m.id)).toEqual(['smb', 'lost']);
    for (const it of items(menu)) expect(`${it.label} ${it.hint ?? ''}`).not.toMatch(/\d-\d/);
    h.idle(8);
    h.tap('down');
    expect(h.said.at(-1)).toMatch(/^The Lost Levels\. The harder second quest/);
    expect(h.said.at(-1)).not.toMatch(/Beaten/);
  });

  it('a beaten set says so on its line (G-005)', () => {
    recordClassicBeat('smb');
    const h = classic();
    h.game.showClassicMenu();
    const smb = items(h.top())[0] as MenuItem;
    expect(smb.hint).toMatch(/Beaten on Normal/);
    expect(items(h.top())[1]?.hint).not.toMatch(/Beaten/);
  });
});

describe('G-005: beat status per map set and difficulty', () => {
  it('keeps the best difficulty each set was beaten on (StatManager.setBeatGameStatus)', () => {
    let p = loadProgress();
    expect(p.classicBeat).toEqual({ smb: 'none', special: 'none', lost: 'none' });
    p = recordBeat(p, 'smb', 'hard');
    p = recordBeat(p, 'smb', 'easy');
    expect(p.classicBeat?.smb).toBe('hard');
    p = recordBeat(p, 'lost', 'normal');
    expect(allSetsBeaten(p, 'normal', ['smb', 'lost'])).toBe(true);
    expect(allSetsBeaten(p, 'hard', ['smb', 'lost'])).toBe(false);
    expect(allSetsBeaten(p, 'easy')).toBe(false); // Special not beaten yet
    saveProgress(p);
    expect(loadProgress().classicBeat).toEqual({ smb: 'hard', special: 'none', lost: 'normal' });
  });

  it("an older store's Classic 8-4 clear counts as SMB beaten on Normal; bad values fall back", () => {
    store.set(PROGRESS_KEY, JSON.stringify({ v: 1, cleared: ['8-4'], classicBeat: { lost: 'wow' } }));
    expect(loadProgress().classicBeat).toEqual({ smb: 'normal', special: 'none', lost: 'none' });
  });
});
