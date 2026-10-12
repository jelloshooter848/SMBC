import { describe, expect, it } from 'vitest';
import type { Action } from '@engine/input/actions';
import { tileDef } from '@game/level/tiles';
import { LevelScene } from '@game/scenes/level';
import type { HeroStageScene } from '@game/tutorial/hero-stage';
import { lessonBlocks } from '@game/tutorial/stage-prompts';
import { MARIO_10 } from '@game/tutorial/mario-1-0';
import { CardScene } from '@game/scenes/message';
import { file, makeGame, useStorage, type H } from './heroes-harness';
import { playStage, skipGreeting, startStage } from './stage-bot';
import { okTip, playTutorial } from './tutorial-bot';
import { billBot } from './bots/bill';
import { linkBot } from './bots/link';
import { luigiBot } from './bots/luigi';
import { megamanBot } from './bots/megaman';
import { ryuBot } from './bots/ryu';
import { samusBot } from './bots/samus';
import { simonBot } from './bots/simon';
import { sophiaBot } from './bots/sophia';

// Every block hit early, in every hero's training (0.4.43, owner: Simon's stage soft-locked once both
// ? blocks were bumped before the first item was taken). The rule: a lesson whose block is spent
// without its item being taken rebuilds that stretch (TutorialDirector.spentLesson), after Toad's
// card. Here, each time an item lesson comes up, every power block still standing in it and in the
// lessons after it is struck at once (a small hero's blocks all give the grow item), and the hero's
// own bot then plays on: the stage still ends at the flagpole with every lesson done.

useStorage();

const BOTS: Readonly<Record<string, () => (s: HeroStageScene) => Action[]>> = {
  link: linkBot,
  luigi: luigiBot,
  megaman: megamanBot,
  samus: samusBot,
  simon: simonBot,
  ryu: ryuBot,
  bill: billBot,
  sophia: sophiaBot,
};

/** A block still unspent (a ? block or a brick). */
const standing = (s: HeroStageScene, b: { x: number; y: number }): boolean =>
  !!tileDef(s.world.map.get(b.x, b.y)).block;

describe('training: every block hit early', () => {
  for (const [hero, makeBot] of Object.entries(BOTS)) {
    it(`${hero}: every block struck as soon as its lesson comes up; the stage still clears`, () => {
      const { h, stage } = startStage(hero);
      const s = stage();
      skipGreeting(h);
      const bot = makeBot();
      const struck = new Set<string>();
      const lessons = s.director.def.lessons;
      const log = playStage(
        h,
        s,
        (st) => {
          const l = st.director.lesson;
          if (l && (l.item || l.brick) && !struck.has(l.id)) {
            struck.add(l.id);
            const from = lessons.indexOf(l);
            const p = st.world.player;
            for (const later of lessons.slice(from))
              for (const b of [...lessonBlocks(later), ...(later.brick ? [later.brick] : [])])
                if (standing(st, b)) st.world.strikeBlock(b.x, b.y, p, true);
          }
          return bot(st);
        },
        () => s.cleared,
        40000,
      );
      expect(s.cleared, `stuck at ${s.director.lesson?.id}`).toBe(true);
      expect(s.director.done).toEqual(lessons.map((l) => l.id));
      // A small hero's first strikes give the grow item from every block: the stretch was rebuilt.
      expect(log.spent.length).toBeGreaterThan(0);
      // New tips held the stage (0.4.45) and the bot went on with OK; a rebuilt stretch's tips
      // never held twice.
      expect(log.holds.length).toBeGreaterThan(0);
      const held = log.holds.map((x) => x.lesson);
      for (const id of new Set(held)) expect(held.filter((x) => x === id).length, id).toBeLessThanOrEqual(2);
    });
  }

  it("mario (1-0): the coin and mushroom blocks bumped before their lessons; a lost mushroom's block comes back", () => {
    const h: H = makeGame();
    file();
    h.game.openFile(1);
    h.idle(8);
    h.tap('jump');
    h.until(() => h.top() instanceof LevelScene, 300);
    h.until(() => h.top() instanceof CardScene, 60);
    for (let i = 0; i < 20 && h.top() instanceof CardScene; i++) {
      h.idle(32);
      h.tap('jump');
    }
    const level = () => h.top() as LevelScene;
    const lessonId = () => (h.top() instanceof LevelScene ? level().tutorial?.lesson?.id : undefined);
    expect(lessonId()).toBe('walk');
    okTip(h);
    // Both blocks bumped at once, at the start; the mushroom is then lost (it slid off and fell).
    const scene = level();
    const w = scene.world;
    w.strikeBlock(MARIO_10.coinBlock.x, MARIO_10.coinBlock.y, w.player, false);
    w.strikeBlock(MARIO_10.mushroomBlock.x, MARIO_10.mushroomBlock.y, w.player, false);
    h.idle(40);
    for (const e of w.entities) if (e.kind === 'powerup') e.alive = false;
    // Toad's card, then the stretch is rebuilt with the mushroom's block standing again.
    h.until(() => h.top() instanceof CardScene, 120);
    expect(scene.tutorial?.cardKind).toBe('spent');
    h.idle(40);
    h.tap('jump');
    h.until(() => h.top() instanceof LevelScene, 120);
    const w2 = level().world;
    expect(w2).not.toBe(w);
    expect(tileDef(w2.map.get(MARIO_10.mushroomBlock.x, MARIO_10.mushroomBlock.y)).block).toBeTruthy();
    playTutorial(h, () => lessonId() === 'flag' || lessonId() === undefined, 12000);
  });
});
