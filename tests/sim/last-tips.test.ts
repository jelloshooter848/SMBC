import { describe, expect, it } from 'vitest';
import type { Scene } from '@engine/scene';
import { CardScene, CARD_GUARD_FRAMES } from '@game/scenes/message';
import type { MenuItem } from '@game/scenes/menu';
import { LevelScene } from '@game/scenes/level';
import { PauseScene } from '@game/scenes/pause';
import { StageMenu } from '@game/tutorial/hero-stage';
import { LAST_TIPS } from '@game/tutorial/tips';
import { file, makeGame, useStorage } from './heroes-harness';
import { linkBot } from './bots/link';
import { choose, playStage, skipGreeting, startStage } from './stage-bot';
import { playTutorial } from './tutorial-bot';

// Tips stay (0.4.43, owner: tutorial text disappeared too easily, and what was missed was gone).
// A tip stays on screen until the next one replaces it, never on a timer; the pause menu offers
// LAST TIPS: the last three tips, the newest first, read out again; it waits for OK.

useStorage();

const labels = (s: Scene | undefined) => (s as unknown as { items: MenuItem[] }).items.map((i) => i.label);

describe('tips stay', () => {
  it('a training tip stays up however long the hero waits; only doing it brings the next', () => {
    const { h, stage } = startStage('link');
    const s = stage();
    skipGreeting(h);
    const first = s.director.lines().join(' ');
    expect(first).toMatch(/SWORD/);
    for (let i = 0; i < 1800; i++) {
      h.step();
      if (i % 300 === 0) expect(s.director.box()?.rows.join(' ')).toContain(first.split(' ')[0] as string);
    }
    expect(s.director.lines().join(' ')).toBe(first);
    expect(h.game.tips.current?.said).toBe(first);
  });

  it('training: MENU → LAST TIPS shows the last three tips, the newest first, read again; OK goes back', () => {
    const { h, stage } = startStage('link');
    const s = stage();
    skipGreeting(h);
    const bot = linkBot();
    const shown: string[] = [];
    playStage(
      h,
      s,
      (st) => {
        const now = st.director.lines().join(' ');
        if (now && shown.at(-1) !== now) shown.push(now);
        return bot(st);
      },
      () => s.director.lesson?.id === 'boomerang',
      3000,
    );
    expect(shown.length).toBeGreaterThan(LAST_TIPS);
    h.idle(2);
    h.tap('start');
    expect(h.top()).toBeInstanceOf(StageMenu);
    expect(labels(h.top())).toContain('Last tips');
    const said = h.said.length;
    choose(h, 'Last tips');
    const card = h.top() as CardScene;
    expect(card).toBeInstanceOf(CardScene);
    expect(card.lines[0]).toBe('LAST TIPS');
    const tips = h.game.tips.last();
    expect(tips).toHaveLength(LAST_TIPS);
    expect(tips[0]?.said).toBe(shown.at(-1));
    expect(card.lines.join(' ')).toContain((tips[0]?.lines ?? []).join(' '));
    expect(h.said.slice(said).join(' ')).toContain(tips.map((t) => t.said).join(' '));
    // It waits for a press, then the menu is back.
    h.idle(600);
    expect(h.top()).toBe(card);
    h.idle(CARD_GUARD_FRAMES);
    h.tap('jump');
    expect(h.top()).toBeInstanceOf(StageMenu);
  });

  it('1-0: the pause menu offers LAST TIPS while the tutorial runs', () => {
    const h = makeGame();
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
    playTutorial(h, () => h.top() instanceof LevelScene && level().tutorial?.lesson?.id === 'sprint');
    // NICE! over the jump's tip, then the sprint's.
    h.idle(80);
    h.tap('start');
    expect(h.top()).toBeInstanceOf(PauseScene);
    expect(labels(h.top())).toContain('Last tips');
    expect(h.game.tips.last().map((t) => t.said)[0]).toMatch(/SPRINT/);
  });
});
