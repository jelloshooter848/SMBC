import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { WORLD_8_UNDERWORLD } from '@content/worldmap/world8-underworld';
import { VALLEY_LIVE } from '@content/worldmap/valley-of-bowser';
import { px } from '@engine/math/units';
import { MARIO } from '@game/characters/mario';
import { Bowser } from '@game/entities/enemies/bowser';
import { CostumePile } from '@game/entities/effects/costume-pile';
import { WandBreak } from '@game/entities/effects/wand-break';
import { CreditsScene, CREDITS } from '@game/scenes/credits';
import { LevelScene } from '@game/scenes/level';
import { MAP_SLIDE_FRAMES, WorldMapScene } from '@game/scenes/world-map';
import { FINALE } from '@game/story/finale';
import { file, makeGame, useStorage, type H } from './heroes-harness';
import { seeAllStory } from './story-seen';

// INT54: the two halves of 0.4.54 together, end to end. F54 makes the campaign's 8-4 a fake (the
// Plutonium Boss costume over a Piranha Plant) but keeps the ending there for now (FINALE.castle);
// M54 draws World 8 as THE UNDERWORLD with its road on to Lost World 1 while the Valley is not live.
// So from 8-4's axe: the fake unmasked, the wand, the credits, then THE UNDERWORLD's 8-4 with the
// road on drawn in and walkable to Lost World 1. No dead end. Classic 8-4 stays the real king.

const W1_7 = ['1-0', ...[1, 2, 3, 4, 5, 6, 7].flatMap((w) => [1, 2, 3, 4].map((s) => `${w}-${s}`))];
const FREED = ['mario', 'luigi', 'link', 'megaman', 'samus', 'simon', 'ryu', 'bill'];
const P8 = [1, 2, 3, 4, 5, 6, 7, 8].map((w) => `smb-${w}`);

const worldOf = (h: H) => (h.top() as LevelScene).world;

/** Take 8-4-end's axe, past the king (invulnerable), and run until the credits roll. */
function axeToCredits(h: H): { texts: string[][]; bowser: Bowser } {
  const w = worldOf(h);
  w.assist.invulnerable = true;
  const axe = (w.level.entities.find((e) => e.type === 'axe') as { x: number }).x;
  const p = w.player.body;
  p.x = px((axe - 6) * 16);
  p.y = px(10 * 16) - p.h;
  w.camera.snapTo(p.x);
  h.until(() => w.entities.some((e) => e instanceof Bowser && e.alive), 120);
  const bowser = w.entities.find((e) => e instanceof Bowser) as Bowser;
  p.x = px(axe * 16 + 2);
  p.y = px(9 * 16) - p.h;
  p.vx = 0;
  p.vy = 0;
  const texts: string[][] = [];
  for (let i = 0; i < 3000 && !(h.top() instanceof CreditsScene); i++) {
    const waits = h.top() instanceof LevelScene ? worldOf(h).castleWaiting : true;
    h.step(waits && i % 2 === 0 ? ['jump'] : []);
    const t = h.top() instanceof LevelScene ? worldOf(h).castleText : null;
    if (t && t.length && t.join('|') !== (texts.at(-1) ?? []).join('|')) texts.push([...t]);
  }
  expect(h.top()).toBeInstanceOf(CreditsScene);
  return { texts, bowser };
}

/** Through the credits (OK at their end) to the map, idle. */
function creditsToMap(h: H): WorldMapScene {
  for (let i = 0; i < 6000 && !(h.top() instanceof WorldMapScene); i++) h.step(i % 2 ? [] : ['start']);
  h.until(() => h.top() instanceof WorldMapScene && (h.top() as WorldMapScene).mode === 'idle', 3000);
  h.idle(10);
  return h.top() as WorldMapScene;
}

describe.runIf(!VALLEY_LIVE)('0.4.54: the campaign from 8-4 to the Lost Levels, no dead end', () => {
  useStorage();

  it('the ending is still at 8-4 in this release', () => {
    expect(FINALE.castle).toBe('8-4');
  });

  it('8-4: the fake unmasked, the wand, the credits, then THE UNDERWORLD with the road on to Lost World 1', () => {
    const h = makeGame();
    h.game.openFile(
      1,
      file({
        cleared: [...W1_7, '8-1', '8-2', '8-3'],
        freed: [...FREED, 'sophia'],
        pages: P8,
        position: { page: 'smb-8', node: '8-4' },
      }),
    );
    seeAllStory(h.game);
    h.game.startLevel(getLevel('8-4-end'), { mode: 'stand' });
    h.step();
    const w = worldOf(h);
    expect(w.storyMode).toBe(true);
    const { bowser } = axeToCredits(h);
    // The fake: no real king here (his costume dropped in a pile), and the wand still breaks.
    expect(w.trueForm()).toBeGreaterThan(0);
    expect(bowser.costume).toBe(0);
    expect(w.entities.some((e) => e instanceof CostumePile)).toBe(true);
    expect(w.entities.some((e) => e instanceof WandBreak)).toBe(true);
    expect(h.said.some((s) => s.includes('PIRANHA'))).toBe(true);
    expect(h.said.some((s) => s.includes('THAT WAS THE REAL KING'))).toBe(false);
    const m = creditsToMap(h);
    expect(h.game.mapProgress.gameCleared).toBe(true);
    expect(h.game.mapProgress.cleared).toContain('8-4');
    expect(m.page).toBe(WORLD_8_UNDERWORLD);
    expect(m.node).toBe('8-4');
    // The road on draws in, then RIGHT walks it off the page to Lost World 1.
    h.until(() => h.game.mapProgress.pages.includes('ll-1') && m.mode === 'idle', 3000);
    h.idle(10);
    h.tap('right');
    h.until(() => (h.top() as WorldMapScene).mode === 'slide', 600);
    h.idle(MAP_SLIDE_FRAMES);
    h.until(() => (h.top() as WorldMapScene).mode === 'idle', 800);
    expect((h.top() as WorldMapScene).page.id).toBe('ll-1');
  });

  it('Sophia III still captive: the credits roll, the road on stays sealed until she is freed (8-1 is open)', () => {
    const h = makeGame();
    h.game.openFile(
      1,
      file({
        cleared: [...W1_7, '8-1', '8-2', '8-3'],
        freed: FREED,
        pages: P8,
        position: { page: 'smb-8', node: '8-4' },
      }),
    );
    seeAllStory(h.game);
    h.game.startLevel(getLevel('8-4-end'), { mode: 'stand' });
    h.step();
    axeToCredits(h);
    const m = creditsToMap(h);
    expect(h.game.mapProgress.gameCleared).toBe(true);
    expect(m.page).toBe(WORLD_8_UNDERWORLD);
    h.idle(300);
    expect(h.game.mapProgress.pages).not.toContain('ll-1');
    // Her level is still open to go back to.
    for (const to of ['8-3', '8-2', '8-1']) {
      const p = m.page.paths.find((x) => x.to === m.node && x.from === to)!;
      const [a, b] = [...p.points].reverse() as [number, number][];
      h.tap(b![0] > a![0] ? 'right' : b![0] < a![0] ? 'left' : b![1] > a![1] ? 'down' : 'up');
      h.until(() => m.mode === 'idle', 600);
      expect(m.node).toBe(to);
    }
  });

  it('classic 8-4 is unchanged: the real king, no costume, YOUR QUEST IS OVER', () => {
    const h = makeGame();
    h.game.newGame(MARIO, '8-4-end');
    h.until(() => h.top() instanceof LevelScene, 400);
    const w = worldOf(h);
    expect(w.storyMode).toBe(false);
    const { texts, bowser } = axeToCredits(h);
    expect(w.trueForm()).toBe(0);
    expect(bowser.costume).toBe(0);
    expect(w.entities.some((e) => e instanceof CostumePile)).toBe(false);
    expect(w.entities.some((e) => e instanceof WandBreak)).toBe(false);
    expect(texts.flat().join(' ')).toContain('YOUR QUEST IS OVER.');
    expect((h.top() as CreditsScene).lines).toEqual(CREDITS);
  });
});
