import { describe, expect, it } from 'vitest';
import { defaultSettings } from '@engine/save/settings';
import { CardScene, MessageScene } from '@game/scenes/message';
import { LevelScene } from '@game/scenes/level';
import { captives, draw, file, intoBonus, makeGame, standByLuigi, useStorage } from './heroes-harness';
import type { Captive } from '@game/entities/objects/captive';
import { px } from '@engine/math/units';

// UP no longer talks (0.4.43, owner: it went off by accident on touch). Talking is the TALK button
// only, on every input: in a level SPECIAL (on touch the C button, captioned TALK); the prompt
// over a captive or a partner and what is said name that button. Up keeps its own jobs.

useStorage();

describe('talking is the TALK button only', () => {
  it('by a captive: up does nothing, the TALK button talks', () => {
    const h = makeGame();
    file();
    const l = intoBonus(h);
    standByLuigi(h, l);
    h.tap('up');
    h.idle(4);
    expect(h.top()).toBe(l);
    h.tap('special');
    expect(h.top() instanceof CardScene || h.top() instanceof MessageScene).toBe(true);
  });

  it("with keys the prompt and the announcer name the TALK button's key, never up", () => {
    const h = makeGame();
    h.game.deps.settings = defaultSettings();
    h.game.deps.controlScheme = () => 'keyboard';
    file();
    const l = intoBonus(h);
    standByLuigi(h, l);
    h.idle(4);
    expect(h.top()).toBeInstanceOf(LevelScene);
    const texts = draw(l).texts.map((t) => t.str);
    expect(texts).toContain('TALK (C)');
    expect(texts.some((t) => t.includes('(UP)'))).toBe(false);
    expect(h.said).toContain('Luigi. Press TALK (C) to talk.');
    expect(h.said.some((t) => /up to talk/i.test(t))).toBe(false);
  });

  it("in co-op the announcer names the TALK key of the player in reach (player 2's own key)", () => {
    const h = makeGame();
    h.game.deps.settings = defaultSettings();
    h.game.deps.controlScheme = () => 'keyboard';
    file({ character2: 'link' });
    const l = intoBonus(h);
    const p2 = l.world.players[1];
    expect(p2).toBeDefined();
    // Player 1 off to the side; player 2 by Luigi.
    const c = captives(l)[0] as Captive;
    const p1 = l.world.players[0] as (typeof l.world.players)[0];
    p1.body.x = px(2 * 16);
    const b = (p2 as typeof p1).body;
    b.x = c.body.x - px(18);
    b.y = c.body.y + c.body.h - b.h - px(2);
    b.vx = 0;
    b.vy = 0;
    h.until(() => b.onGround, 60);
    h.idle(10);
    expect(h.said).toContain('Player 2: Luigi. Press TALK (NUM ENTER) to talk.');
  });
});
