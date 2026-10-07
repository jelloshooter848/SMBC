import { afterEach, describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { T } from '@game/level/tiles';
import { mapPage } from '@content/worldmap';
import { px } from '@engine/math/units';
import type { Settings } from '@engine/save/settings';
import type { Scene } from '@engine/scene';
import { WorldMapScene, GUARD_GRACE_FRAMES } from '@game/scenes/world-map';
import { LevelScene, CRYSTAL_BALL_CARD } from '@game/scenes/level';
import { CardScene, MessageScene } from '@game/scenes/message';
import { GameOverScene } from '@game/scenes/game-over';
import { IntroScene } from '@game/scenes/intro';
import { HammerBattleScene, BATTLE_WIN_DELAY } from '@game/scenes/hammer-battle';
import { Larry } from '@game/entities/enemies/larry';
import { HammerBro } from '@game/entities/enemies/hammer-bro';
import { CrystalBall } from '@game/entities/objects/crystal-ball';
import { loadSave, type SaveFile } from '@game/save/save-files';
import { registerBonusGame, BONUS_CLOSED_HINT, type BonusOutcome } from '@game/map/bonus-spot';
import { SMB3_BONUS } from '@game/bonus/spot';
import type { MapNode, WorldMapPage } from '@game/map/types';
import { draw, file, makeGame, rideToStern, useStorage, type H } from './heroes-harness';

// Larry Koopa's airship (4-2), the crystal ball and World 4's bonus spot with its Hammer Bro
// (docs/HEROES.md "Larry Koopa and the crystal ball", docs/WORLD_MAP.md "The bonus spot and its
// Hammer Bro"), played through the game's scenes on a campaign file.

useStorage();
afterEach(() => registerBonusGame(SMB3_BONUS));

const W3 = ['1-0', '1-1', '1-2', '1-3', '1-4', '2-1', '2-2', '2-3', '2-4', '3-1', '3-2', '3-3', '3-4'];
/** A file on World 4 with 4-1 cleared, standing on `node`. */
const world4 = (over: Partial<SaveFile> = {}, node = '4-2'): Partial<SaveFile> => ({
  cleared: [...W3, '4-1'],
  pages: ['smb-1', 'smb-2', 'smb-3', 'smb-4'],
  position: { page: 'smb-4', node },
  lives: 4,
  ...over,
});
const W4 = mapPage('smb-4') as WorldMapPage;
const node = (id: string) => W4.nodes.find((n) => n.id === id) as MapNode;

function onMap(over: Partial<SaveFile>): { h: H; map: () => WorldMapScene } {
  const h = makeGame();
  h.game.deps.settings = { dev: false } as Settings;
  file(over);
  h.game.openFile(1);
  h.idle(8);
  expect(h.top()).toBeInstanceOf(WorldMapScene);
  return { h, map: () => h.top() as WorldMapScene };
}

/** Into Larry's room as from the airship deck's stern pipe; Larry is found once spawned. */
function intoAirship(h: H): { level: LevelScene; larry: Larry } {
  h.game.startLevel(getLevel('4-2-larry'), { mode: 'pipe-exit', x: 2, y: 12, time: 300 });
  h.step();
  const level = h.top() as LevelScene;
  expect(level).toBeInstanceOf(LevelScene);
  h.until(() => level.world.entities.some((e) => e instanceof Larry), 120);
  const larry = level.world.entities.find((e): e is Larry => e instanceof Larry) as Larry;
  return { level, larry };
}

/** Three stomps' worth of hits, each once he is out of his shell. */
function beatLarry(h: H, level: LevelScene, larry: Larry): void {
  level.world.player.invuln = 100000;
  for (let n = 0; n < 3; n++) {
    h.until(() => !larry.inShell, 400);
    larry.hit({ kind: 'stomp', amount: 1, owner: null, dirX: 1 }, level.world);
  }
  expect(larry.defeated).toBe(true);
}

/** Walk the hero onto the crystal ball once it lies on the floor. */
function touchBall(h: H, level: LevelScene): void {
  h.until(() => level.world.entities.some((e) => e instanceof CrystalBall && e.body.onGround), 300);
  const ball = level.world.entities.find((e): e is CrystalBall => e instanceof CrystalBall) as CrystalBall;
  const p = level.world.player;
  p.body.x = ball.body.x;
  p.body.y = ball.body.y + ball.body.h - p.body.h;
  h.step();
}

describe('the crystal ball (campaign)', () => {
  it('beating Larry and touching the ball: its card, then World 4 with the bonus road drawn in', () => {
    const { h } = onMap(world4());
    const { level, larry } = intoAirship(h);
    beatLarry(h, level, larry);
    touchBall(h, level);
    const card = h.top() as CardScene;
    expect(card).toBeInstanceOf(CardScene);
    expect(card.lines).toEqual(CRYSTAL_BALL_CARD);
    expect(h.said.some((t) => t.startsWith('THE CRYSTAL BALL SHOWS WHERE YOUR FRIENDS ARE HIDDEN!'))).toBe(
      true,
    );
    h.idle(32);
    h.tap('jump');
    const map = h.top() as WorldMapScene;
    expect(map).toBeInstanceOf(WorldMapScene);
    expect(map.page.id).toBe('smb-4');
    expect(map.node).toBe('4-2');
    // The secret is kept, 4-2 is not cleared, the inventory is unlocked; all saved.
    expect(h.game.mapProgress.secrets).toContain('larry');
    expect(h.game.mapProgress.cleared).not.toContain('4-2');
    expect(h.game.inventoryUnlocked).toBe(true);
    const saved = loadSave(1) as SaveFile;
    expect(saved.secrets).toContain('larry');
    expect(saved.inventoryUnlocked).toBe(true);
    expect(saved.cleared).not.toContain('4-2');
    // Only the road to the bonus spot is drawn in (4-3 waits for 4-2's flagpole).
    // The airship crash cutscene plays first (airship-crash.test.ts), then the road draws in.
    expect(map.cutscene).toBe(true);
    expect(map.revealing).toBe(true);
    h.until(() => !map.revealing, 600);
    expect(h.game.pendingReveal).toEqual([]);
    // The SMB3 bonus games are registered (bonus/spot.ts): the rotation starts at the Toad House.
    expect(
      draw(map).sprites.some(
        (s) => s.x === 2 * 16 && s.y === 13 * 16 && s.key === 'smb3' && s.frame === 'node-toad-house',
      ),
    ).toBe(true);
    expect(h.said.at(-1)).toMatch(/Toad House, open/);
  });

  it("4-2's anchor chain (the campaign's way in, no pipe) boards the deck; its stern pipe leads into the room", () => {
    const { h } = onMap(world4());
    const main = getLevel('4-2');
    // The chain stands where the warp-zone pipe stood (anchor-chain.test.ts has the details).
    const pipe = main.zones.find((z) => z.kind === 'pipe' && z.x === 214) as { x: number; y: number };
    h.game.startLevel(main, { mode: 'stand', x: pipe.x, y: 12, time: 300 });
    h.step();
    for (let f = 0; f < 900 && (h.top() as LevelScene).level?.id !== '4-2-airship'; f++) h.step(['up']);
    const deck = h.top() as LevelScene;
    expect(deck.level.id).toBe('4-2-airship');
    expect(h.game.airship).not.toBeNull();
    // Up the arrival chain at column 2 and off it onto the deck in column 3, the clock held
    // (hidden), no map change.
    h.until(() => !deck.world.arriving && deck.world.player.body.onGround, 900);
    expect(Math.floor((deck.world.player.centerX >> 8) / 16)).toBe(3);
    expect(deck.world.time).toBeNull();
    expect(h.game.mapProgress.secrets).not.toContain('larry');
    // Along the deck to the stern pipe and down it: Larry's room.
    rideToStern(h, deck);
    const cabin = h.top() as LevelScene;
    expect(cabin.level.id).toBe('4-2-larry');
    // Out of the pipe at columns 2-3 onto its top (row 13), still no clock.
    h.until(() => !cabin.world.player.frozen, 200);
    const p = cabin.world.player;
    expect((p.body.y + p.body.h) >> 8).toBe(13 * 16);
    expect(p.centerX >> 8).toBe(3 * 16); // the middle of the 2-wide pipe
    expect(cabin.world.time).toBeNull();
    expect(h.game.airship?.reachedRoom).toBe(true);
    h.until(() => cabin.world.entities.some((e) => e instanceof Larry), 30);
  });

  it('a file without the ball never shows the bonus node, even with 4-2 cleared', () => {
    const { map } = onMap(world4({ cleared: [...W3, '4-1', '4-2'] }));
    const b = node('bonus-4');
    const at = (s: { frame: string; x: number; y: number }) =>
      s.x === b.x * 16 && s.y === b.y * 16 && s.frame.startsWith('map-node');
    expect(draw(map()).sprites.some(at)).toBe(false);
  });

  it('outside the campaign the ball goes on to 4-3', () => {
    const h = makeGame();
    h.game.devStart('4-2-larry', h.game.deps.characters[0]!, 'big');
    h.until(() => h.top() instanceof LevelScene, 400);
    const level = h.top() as LevelScene;
    h.until(() => level.world.entities.some((e) => e instanceof Larry), 200);
    const larry = level.world.entities.find((e): e is Larry => e instanceof Larry) as Larry;
    beatLarry(h, level, larry);
    touchBall(h, level);
    expect(h.top()).toBeInstanceOf(CardScene);
    h.idle(32);
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(IntroScene);
    expect(h.game.state.stage).toBe(3);
  });
});

describe("the cabin's look (the SMB3 art)", () => {
  it('is an airship playing the SMB3 boss tune', () => {
    const l = getLevel('4-2-larry');
    expect(l.theme).toBe('airship');
    expect(l.music).toBe('smb3-boss');
  });

  it("is enclosed like the SMB3 cabin, built for the SMB3 art's frames", () => {
    const l = getLevel('4-2-larry');
    const t = (x: number, y: number) => l.tiles[y * l.width + x];
    const at = (kind: string) =>
      l.decor
        .filter((d) => d.kind === kind)
        .map((d) => `${d.x},${d.y}`)
        .sort();
    const cells = (xs: number[], ys: number[]) => xs.flatMap((x) => ys.map((y) => `${x},${y}`)).sort();
    const span = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
    expect(l.width).toBe(16);
    // No sky at all: the log back wall even behind the HUD, solid hull, posts or the pipe.
    for (let y = 0; y < 15; y++) for (let x = 0; x < 16; x++) expect(t(x, y), `${x},${y}`).not.toBe(T.AIR);
    for (let y = 3; y < 12; y++) for (let x = 1; x < 15; x++) expect(t(x, y), `${x},${y}`).toBe(T.WALL);
    // The ceiling row and both edge columns are solid, each tile covered by its 16x16 decor: a
    // ceiling beam along row 2, a pillar per row down columns 0 and 15.
    for (let x = 0; x < 16; x++) expect(t(x, 2)).toBe(T.CASTLE_BRICK);
    for (let y = 2; y < 13; y++)
      for (const x of [0, 15]) expect(t(x, y), `edge ${x},${y}`).toBe(T.CASTLE_BRICK);
    expect(at('smb3:ceiling-beam')).toEqual(cells(span(1, 14), [2]));
    expect(at('smb3:pillar')).toEqual(cells([0, 15], span(2, 12)));
    expect(at('smb3:porthole')).toEqual(['10,6', '5,6']);
    // The floor: post tops (`#`) on row 13, the posts going on (`%`) on row 14; the raised post's
    // top at (7,12) with its post under it; the arrival pipe (the deck's stern pipe leads to `4-2-larry 2 12`) in the floor.
    for (const x of span(0, 15)) {
      if (x === 2 || x === 3) continue;
      expect(t(x, 13), `top ${x}`).toBe(x === 7 ? T.CASTLE_BRICK : T.GROUND);
      expect(t(x, 14), `post ${x}`).toBe(T.CASTLE_BRICK);
    }
    expect(t(7, 12)).toBe(T.GROUND);
    expect([t(2, 13), t(3, 13), t(2, 14), t(3, 14)]).toEqual([T.PIPE_TL, T.PIPE_TR, T.PIPE_BL, T.PIPE_BR]);
  });

  it('draws Larry from the smb3 sheet, bottom-centred, facing the hero; a hit flashes smb3-flash', () => {
    const { h } = onMap(world4());
    const { level, larry } = intoAirship(h);
    h.idle(4);
    const larryAt = () => draw(level).sprites.filter((s) => /^larry-/.test(s.frame));
    const [s] = larryAt();
    expect(s).toMatchObject({ key: 'smb3', frame: 'larry-0' });
    const b = larry.body;
    expect(s!.y + 24).toBe((b.y + b.h) >> 8);
    expect(s!.x + 8).toBe((b.x + (b.w >> 1)) >> 8);
    // A fireball: he flashes (the harness has reduce flashing on: blanched without blinking).
    larry.hit({ kind: 'fireball', amount: 1, owner: null, dirX: 1 }, level.world);
    expect(larryAt()[0]?.key).toBe('smb3@smb3-flash');
    // A stomp: the flinch (no wand), then the spinning shell.
    h.until(() => larry.invuln === 0 && larry.body.onGround, 200);
    larry.hit({ kind: 'stomp', amount: 1, owner: null, dirX: 1 }, level.world);
    h.step();
    expect(larryAt()[0]?.frame).toBe('larry-hurt');
    h.idle(12);
    expect(larryAt()[0]?.frame).toMatch(/^larry-shell-[0-3]$/);
  });
});

describe('crystal-ball hints on the map', () => {
  it('every hero not freed shows its silhouette by its level before that level is cleared', () => {
    // Only 1-0 cleared: 1-1 (Luigi's) is open but not cleared.
    const { h, map } = onMap({
      cleared: ['1-0'],
      secrets: ['larry'],
      position: { page: 'smb-1', node: '1-1' },
    });
    const { sprites, texts } = draw(map());
    expect(sprites.some((s) => s.key === 'mario@luigi~shade-grass')).toBe(true);
    expect(map().hintLine).toBe('SOMEONE IS HIDING IN THIS LEVEL');
    expect(texts.map((t) => t.str)).toContain('SOMEONE IS HIDING IN THIS LEVEL');
    expect(h.said.some((t) => t.includes('Someone is hiding in this level.'))).toBe(true);
  });

  it("Unlock all shows no silhouette on a node the file hasn't really reached", () => {
    const h = makeGame();
    h.game.deps.settings = { dev: true } as Settings;
    file({
      cleared: ['1-0'],
      secrets: ['larry'],
      devUnlockAll: true,
      position: { page: 'smb-1', node: '1-1' },
    });
    h.game.openFile(1);
    h.idle(8);
    // 1-1 is open on the file itself: Luigi's silhouette.
    expect(draw(h.top() as WorldMapScene).sprites.some((s) => s.key === 'mario@luigi~shade-grass')).toBe(
      true,
    );
    // World 2 is open only through Unlock all: no Link by 2-1.
    h.game.travelToPage('smb-2');
    h.idle(8);
    const map = h.top() as WorldMapScene;
    expect(map.page.id).toBe('smb-2');
    expect(draw(map).sprites.some((s) => s.key.includes('~shade-'))).toBe(false);
  });

  it('without the ball, nothing before the clear', () => {
    const { map } = onMap({ cleared: ['1-0'], position: { page: 'smb-1', node: '1-1' } });
    expect(draw(map()).sprites.some((s) => s.key.includes('~shade-'))).toBe(false);
  });
});

describe("World 4's bonus spot and its Hammer Bro", () => {
  const found = (over: Partial<SaveFile> = {}, at = 'bonus-4') => world4({ secrets: ['larry'], ...over }, at);

  it('JUMP on the open node plays the bonus (the placeholder when no bonus game is registered), then it is used', () => {
    registerBonusGame(null);
    const { h, map } = onMap(found());
    expect(map().hintLine).toBe('BONUS GAME');
    expect(map().touchLabels().jump).toBe('ENTER');
    expect(map().guard).toBeNull();
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(MessageScene);
    h.idle(32);
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    expect(h.game.bonusOpen).toBe(false);
    expect(loadSave(1)?.bonusOpen).toBe(false);
    expect(map().node).toBe('bonus-4');
    expect(map().hintLine).toBe(BONUS_CLOSED_HINT);
    // Used: no way in, and the Hammer Bro is out on the road, as far from the hero as can be,
    // drawn with the SMB3 map frames.
    expect(map().guard?.tile).toEqual([4, 12]);
    expect(draw(map()).sprites.some((s) => s.key === 'smb3' && /^hammer-bro-map-[01]$/.test(s.frame))).toBe(
      true,
    );
    h.idle(10);
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(WorldMapScene);
  });

  it('a registered bonus game is played instead; backing out leaves it open', () => {
    let outcome: BonusOutcome = 'left';
    const scene: Scene = { update() {}, render() {} };
    let finish: ((o: BonusOutcome) => void) | null = null;
    registerBonusGame({
      label: () => 'TOAD HOUSE',
      icon: () => 'smb3:node-toad-house',
      create: (_g, spot, done) => {
        expect(spot).toEqual({ page: 'smb-4', node: 'bonus-4' });
        finish = done;
        return scene;
      },
    });
    const { h, map } = onMap(found());
    expect(map().hintLine).toBe('TOAD HOUSE');
    h.tap('jump');
    expect(h.top()).toBe(scene);
    (finish as unknown as (o: BonusOutcome) => void)(outcome);
    expect(h.top()).toBeInstanceOf(WorldMapScene);
    expect(h.game.bonusOpen).toBe(true);
    outcome = 'used';
    h.idle(8);
    h.tap('jump');
    (finish as unknown as (o: BonusOutcome) => void)(outcome);
    expect(h.game.bonusOpen).toBe(false);
  });

  it('the Hammer Bro wanders the road and walks into a hero waiting on the bonus node: battle', () => {
    const { h, map } = onMap(found({ bonusOpen: false }));
    const g = map().guard;
    expect(g).not.toBeNull();
    const seen = new Set<string>();
    h.until(() => {
      const gg = map().guard;
      if (gg) seen.add(gg.tile.join(','));
      return h.top() instanceof HammerBattleScene;
    }, 6000);
    expect(seen.size).toBeGreaterThan(1);
    expect(h.game.mapProgress.position).toEqual({ page: 'smb-4', node: 'bonus-4' });
  });

  it('walking into him on the road starts the battle too', () => {
    const { h, map } = onMap(found({ bonusOpen: false }, '4-2'));
    // He starts on the bonus node, far from the hero; the hero sets off down the road.
    expect(map().guard?.tile).toEqual([2, 13]);
    h.idle(GUARD_GRACE_FRAMES);
    h.tap('down');
    h.until(() => h.top() instanceof HammerBattleScene, 400);
    expect(h.game.mapProgress.position).toEqual({ page: 'smb-4', node: '4-2' });
  });

  it('winning the battle opens the bonus again, and the Hammer Bro is gone', () => {
    const { h } = onMap(found({ bonusOpen: false }, '4-2'));
    h.game.startHammerBattle();
    const battle = h.top() as HammerBattleScene;
    h.idle(3);
    const bros = battle.world.entities.filter((e): e is HammerBro => e instanceof HammerBro);
    expect(bros).toHaveLength(2);
    battle.world.player.invuln = 100000;
    for (const b of bros) b.hit({ kind: 'fireball', amount: 1, owner: null, dirX: 1 }, battle.world);
    h.idle(BATTLE_WIN_DELAY + 2);
    expect(h.top()).toBeInstanceOf(CardScene);
    h.idle(32);
    h.tap('jump');
    const map = h.top() as WorldMapScene;
    expect(map).toBeInstanceOf(WorldMapScene);
    expect(h.game.bonusOpen).toBe(true);
    expect(loadSave(1)?.bonusOpen).toBe(true);
    // SMB3's prize for beating them: an item in the inventory (docs/BONUS.md).
    expect(h.game.bonus.inventory).toHaveLength(1);
    expect(['mushroom', 'flower', 'star']).toContain(h.game.bonus.inventory[0]);
    expect(loadSave(1)?.inventory).toEqual(h.game.bonus.inventory);
    expect(map.guard).toBeNull();
    expect(map.node).toBe('4-2');
  });

  it('losing the battle costs a life and goes back to the map, the Hammer Bro still there', () => {
    const { h } = onMap(found({ bonusOpen: false }, '4-2'));
    h.game.startHammerBattle();
    const battle = h.top() as HammerBattleScene;
    h.idle(3);
    battle.world.kill(battle.world.player);
    h.until(() => h.top() instanceof WorldMapScene, 400);
    expect(h.game.state.lives).toBe(3);
    expect(loadSave(1)?.lives).toBe(3);
    expect(h.game.bonusOpen).toBe(false);
    expect((h.top() as WorldMapScene).guard).not.toBeNull();
  });

  it('losing the last life is GAME OVER', () => {
    const { h } = onMap(found({ bonusOpen: false, lives: 1 }, '4-2'));
    h.game.startHammerBattle();
    const battle = h.top() as HammerBattleScene;
    h.idle(3);
    battle.world.kill(battle.world.player);
    h.until(() => h.top() instanceof GameOverScene, 400);
  });

  it('the battle is fought with the run: power carries in, stomping a Hammer Bro works', () => {
    const { h } = onMap(found({ bonusOpen: false, powerState: 'big' }, '4-2'));
    h.game.startHammerBattle();
    const battle = h.top() as HammerBattleScene;
    h.idle(3);
    const p = battle.world.player;
    expect(p.powerState).toBe('big');
    const bro = battle.world.entities.find((e): e is HammerBro => e instanceof HammerBro) as HammerBro;
    p.invuln = 100000;
    p.body.x = bro.body.x;
    p.body.y = bro.body.y - p.body.h - px(1);
    p.body.vy = 0x03000;
    p.body.onGround = false;
    p.body.prevBottom = p.body.y + p.body.h;
    h.step();
    expect(bro.alive).toBe(false);
    expect(battle.brosLeft).toBe(1);
  });
});
