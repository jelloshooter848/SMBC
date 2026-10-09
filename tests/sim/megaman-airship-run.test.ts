import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { MEGAMAN } from '@game/characters/megaman';
import { Larry } from '@game/entities/enemies/larry';
import { Yoku } from '@game/entities/enemies/wily-sky';
import { CrystalBall } from '@game/entities/objects/crystal-ball';
import type { LevelScene } from '@game/scenes/level';
import { CardScene } from '@game/scenes/message';
import { WorldMapScene } from '@game/scenes/world-map';
import { BOSS_BAR } from '@game/hud/smb3-hero-panel';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import { CRASH_PAGES, LARRY_PAGES, STORY_CRYSTAL_BALL_PAGES } from '@game/story/script';
import { closeCards, dropInAndClimb, file, makeGame, useStorage } from './heroes-harness';
import { megamanShipBot } from './megaman-airship-bot';

// The whole campaign run to Larry's airship and back as Mega Man (0.4.39): the anchor scene (skipped
// here; tests/sim/anchor-scene.test.ts plays it), his deck (the Wily fortress music, his rules, the
// appearing blocks), Larry with his hit-point bar beaten by buster hits, the crystal ball, and the
// airship crash on the map with Toad's cards after it, all still as before.

useStorage();

/** The rects a scene draws (Larry's bar is drawn as rects at BOSS_BAR). */
function rects(scene: { render(r: Renderer): void }) {
  const out: { x: number; y: number; w: number; h: number }[] = [];
  const r: Renderer = Object.assign(new NullRenderer(), {
    rect(x: number, y: number, w: number, h: number): void {
      out.push({ x, y, w, h });
    },
  });
  scene.render(r);
  return out;
}

describe('the whole campaign run as Mega Man', () => {
  it('anchor scene, his deck, Larry with a bar, the ball, the crash and Toad', () => {
    const h = makeGame();
    file(
      {
        cleared: [
          '1-0',
          '1-1',
          '1-2',
          '1-3',
          '1-4',
          '2-1',
          '2-2',
          '2-3',
          '2-4',
          '3-1',
          '3-2',
          '3-3',
          '3-4',
          '4-1',
        ],
        pages: ['smb-1', 'smb-2', 'smb-3', 'smb-4'],
        position: { page: 'smb-4', node: '4-2' },
        lives: 4,
      },
      MEGAMAN.id,
    );
    h.game.openFile(1);
    h.idle(8);
    for (let i = 0; i < 10 && h.top() instanceof CardScene; i++) closeCards(h);
    h.game.state.kit = { ...h.game.state.kit, helmet: 1 };
    h.game.startLevel(getLevel('4-2'), { mode: 'stand', x: 200, y: 1, time: 300 });
    h.step();
    const main = h.top() as LevelScene;
    dropInAndClimb(h, main);
    const deck = h.top() as LevelScene;
    expect(deck.level.id).toBe('4-2-airship');
    expect(deck.world.megamanShip).toBe(true);
    expect(h.audio.playMusic).toHaveBeenLastCalledWith('mm-wily');
    expect(
      deck.world.entities.some((e) => e instanceof Yoku) ||
        deck.level.entities.some((e) => e.type === 'yoku'),
    ).toBe(true);
    // Across with the Mega Man bot (it takes the appearing-block climb), unhurtable.
    deck.world.assist.invulnerable = true;
    const bot = megamanShipBot();
    for (let f = 0; f < 9000 && h.top() === deck; f++) h.step(bot(deck.world));
    deck.world.assist.invulnerable = false;
    const room = h.top() as LevelScene;
    expect(room.level.id).toBe('4-2-larry');
    h.until(() => !room.world.player.frozen, 200);
    h.step();
    expect(closeCards(h)).toEqual(LARRY_PAGES);
    h.until(() => room.world.entities.some((e) => e instanceof Larry), 200);
    const larry = room.world.entities.find((e): e is Larry => e instanceof Larry) as Larry;
    expect(larry.hpMode).toBe(true);
    // His bar stands at the cabin's top right: 28 notches of two rows.
    const bar = rects(room).filter((r) => r.x === BOSS_BAR.x && r.w === 8);
    expect(bar).toHaveLength(56);
    room.world.player.invuln = 100000;
    for (let n = 0; n < 20 && !larry.defeated; n++) {
      h.until(() => (larry.invuln === 0 && !larry.inShell) || h.top() !== room, 400);
      expect(h.top(), `hit ${n}: ${larry.state} ${larry.hp}`).toBe(room);
      larry.hit({ kind: 'buster', amount: 1, owner: null, dirX: 1 }, room.world);
    }
    expect(larry.defeated).toBe(true);
    // The ball drops where he stood (taken at once if the hero stands there).
    h.until(
      () =>
        h.top() instanceof CardScene ||
        room.world.entities.some((e) => e instanceof CrystalBall && e.body.onGround),
      300,
    );
    const ball = room.world.entities.find((e): e is CrystalBall => e instanceof CrystalBall && e.alive);
    if (ball && h.top() === room) {
      const p = room.world.player;
      p.body.x = ball.body.x;
      p.body.y = ball.body.y + ball.body.h - p.body.h;
      h.step();
    }
    expect(closeCards(h)).toEqual(STORY_CRYSTAL_BALL_PAGES);
    const map = h.top() as WorldMapScene;
    expect(map).toBeInstanceOf(WorldMapScene);
    expect(map.cutscene).toBe(true);
    expect(h.game.mapProgress.secrets).toContain('larry');
    // The crash plays out, then Toad's pages in his map box.
    h.until(() => !map.cutscene, 3000);
    const pages: (readonly string[])[] = [];
    for (let i = 0; i < 10 && map.mode === 'story'; i++) {
      h.until(() => map.toad?.lines != null || map.mode !== 'story', 600);
      const lines = map.toad?.lines;
      if (!lines) break;
      pages.push(lines);
      h.idle(31);
      h.tap('jump');
    }
    expect(pages).toEqual(CRASH_PAGES);
  });
});
