import { describe, expect, it } from 'vitest';
import { tileToSub, toPx } from '@engine/math/units';
import { CardScene } from '@game/scenes/message';
import { Goomba } from '@game/entities/enemies/goomba';
import { T } from '@game/level/tiles';
import type { HeroStageScene } from '@game/tutorial/hero-stage';
import { LINK_LESSONS, LINK_STAGE, ringLights } from '@game/tutorial/heroes/link';
import { stageWatch } from '@game/tutorial/targets';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import { useStorage } from './heroes-harness';
import { stepPast } from './tutorial-bot';
import { linkBot } from './bots/link';
import { choose, heroCol, playStage, skipGreeting, startAtLabels, startStage } from './stage-bot';

// Link's training stage (0.4.37, design section 4): his basic kit, then each item from a ? block
// in his order. The Blue Ring's lesson shows its one rule: with full hearts, the first bump lights
// FREE and costs nothing, the next lights HURT and costs half a heart.

useStorage();

const S = LINK_STAGE;
const lessonId = (s: HeroStageScene) => s.director.lesson?.id;

describe("Link's stage", () => {
  it('a bot plays it to the TRAINING CLEAR card in about two minutes, the box always clear', () => {
    const { h, stage } = startStage('link');
    const s = stage();
    // The basic kit: three hearts, the Boomerang only.
    const p0 = s.world.player;
    expect([p0.hp, p0.scratch.maxHp ?? 6, p0.scratch.tunic, p0.scratch.beam]).toEqual([
      6,
      6,
      undefined,
      undefined,
    ]);
    skipGreeting(h);
    const log = playStage(h, s, linkBot(), () => s.cleared, 8400);
    expect(s.director.done).toEqual(LINK_LESSONS.map((l) => l.id));
    expect(log.cards).toEqual([]);
    expect(log.frames).toBeLessThan(7800);
    expect(h.top()).toBeInstanceOf(CardScene);
  });

  it('the Blue Ring: hearts full, the first bump lights FREE and costs nothing, the next lights HURT', () => {
    const { h, stage } = startStage('link', { replay: true });
    expect(startAtLabels(h)).toEqual([
      'Beginning',
      'Heart Container',
      'Bomb Bag',
      'Shield Spell',
      'Jump Spell',
      'Blue Ring',
      'Fire Spell',
      'Magical Sword',
    ]);
    choose(h, 'Blue Ring');
    const s = stage();
    expect(lessonId(s)).toBe('blue-ring');
    const p = () => s.world.player;
    // Earlier items given quietly: four hearts, the bag and the spells; no ring yet.
    expect([p().scratch.maxHp, p().scratch['has-bomb-bag'], p().scratch.tunic]).toEqual([8, 1, undefined]);
    const bot = linkBot();
    const seen: string[] = [];
    let lit = '-/-';
    playStage(
      h,
      s,
      (st) => {
        const pl = st.world.player;
        // No walkers until the ring is taken.
        if (!pl.scratch.tunic)
          expect(st.world.entities.some((e) => e instanceof Goomba && e.alive)).toBe(false);
        else if (seen.length === 0) seen.push(`ring:${pl.hp}`);
        const l = ringLights(st.world);
        const now = `${l.free ? 'FREE' : '-'}/${l.hurt ? 'HURT' : '-'}`;
        if (now !== lit) seen.push(`${now}:${pl.hp}`);
        lit = now;
        return bot(st);
      },
      () => lessonId(s) !== 'blue-ring',
      2400,
    );
    // Full hearts at the grab; FREE with nothing lost; then HURT, half a heart gone, both lit a while.
    expect(seen).toEqual(['ring:8', 'FREE/-:8', 'FREE/HURT:7']);
    const costs = stageWatch(s.world).hurts.map((x) => x.cost);
    expect(costs).toEqual([0, 1]);
    // The next lesson comes up with full hearts again.
    expect(lessonId(s)).toBe('fire-spell');
    expect(p().hp).toBe(8);
  });

  it("bombs all spent missing the target: Toad's put-back gives the bag's bombs again", () => {
    const { h, stage } = startStage('link', { replay: true });
    choose(h, 'Bomb Bag');
    const s = stage();
    const bot = linkBot();
    playStage(h, s, bot, () => !!s.world.player.scratch['has-bomb-bag'], 900);
    expect(lessonId(s)).toBe('bomb');
    // Every bomb thrown away, then on to the gate without one: Toad's card, then OK.
    s.world.player.scratch.bombs = 0;
    playStage(
      h,
      s,
      () => ['right'],
      () => h.top() instanceof CardScene,
      900,
    );
    expect(h.top()).toBeInstanceOf(CardScene);
    for (let i = 0; i < 40 && h.top() instanceof CardScene; i++) h.step(i % 8 === 7 ? ['jump'] : []);
    expect(lessonId(s)).toBe('bomb');
    expect(s.world.player.scratch.bombs).toBe(4);
    // And the lesson can be done.
    playStage(h, s, bot, () => lessonId(s) !== 'bomb', 900);
    expect(lessonId(s)).toBe('shield-spell');
  });

  it('the START AT list and the stage menu show their entries in full (HEART CONTAINER, SKIP THIS LESSON)', () => {
    const { h, stage } = startStage('link', { replay: true });
    const texts = (): string[] => {
      const out: string[] = [];
      const r: Renderer = Object.assign(new NullRenderer(), {
        text(_font: unknown, t: string): void {
          out.push(t);
        },
      });
      h.top()?.render(r);
      return out;
    };
    expect(texts()).toContain('HEART CONTAINER');
    choose(h, 'Beginning');
    skipGreeting(h);
    expect(h.top()).toBe(stage());
    h.idle(2);
    h.tap('start');
    expect(texts()).toContain('SKIP THIS LESSON');
  });

  it("a Shield spell still running is put out at the ring's lesson; ring and spell make every hit free", () => {
    const { h, stage } = startStage('link', { replay: true });
    choose(h, 'Jump Spell');
    const s = stage();
    const bot = linkBot();
    playStage(h, s, bot, () => !!s.world.player.scratch['has-jump-spell'], 900);
    s.world.player.scratch.shieldSpell = 590;
    playStage(h, s, bot, () => lessonId(s) === 'blue-ring', 1200);
    expect(s.world.player.scratch.shieldSpell ?? 0).toBe(0);
    // Ring taken, then the spell cast: every bump is free while it lasts.
    playStage(h, s, bot, () => !!s.world.player.scratch.tunic, 900);
    s.world.player.scratch.shieldSpell = 600;
    playStage(h, s, bot, () => (s.world.player.scratch.shieldSpell ?? 0) === 0, 700);
    expect(ringLights(s.world)).toMatchObject({ free: true, hurt: false });
    expect(s.world.player.hp).toBe(8);
  });

  it("Toad's card at the boomerang's gate comes only standing still; OK puts Link back before the ledge", () => {
    const { h, stage } = startStage('link', { replay: true });
    choose(h, 'Beginning');
    const s = stage();
    skipGreeting(h);
    s.director.startAt(LINK_LESSONS.findIndex((l) => l.id === 'boomerang'));
    // Walk on past the ledge without the boomerang: the gate holds, and Toad comes when he stops.
    const log = playStage(
      h,
      s,
      () => ['right'],
      () => h.top() instanceof CardScene,
      900,
    );
    expect(log.frames).toBeGreaterThan(0);
    expect(heroCol(s)).toBe(S.boomerangGate - 1);
    const card = h.top() as CardScene;
    expect(card.lines.join(' ')).toMatch(/BOOMERANG/);
    h.idle(300);
    expect(h.top()).toBe(card);
    h.tap('jump');
    expect(lessonId(s)).toBe('boomerang');
    expect(heroCol(s)).toBe(50);
    expect(s.director.closedGates).toContain(S.boomerangGate);
    // The lesson goes on in the fresh stretch: the coin is back on its ledge.
    expect(s.world.map.get(S.coin.x, S.coin.y)).toBe(T.COIN);
    playStage(h, s, linkBot(), () => lessonId(s) !== 'boomerang', 900);
    expect(s.director.done).toContain('boomerang');
  });

  it('the up-thrust is taught on a brick: a head bump leaves it, a brick broken the wrong way is rebuilt', () => {
    const { h, stage } = startStage('link', { replay: true });
    choose(h, 'Beginning');
    const s = stage();
    skipGreeting(h);
    s.director.startAt(LINK_LESSONS.findIndex((l) => l.id === 'up-thrust'));
    const w = () => s.world;
    expect(w().map.get(S.brick.x, S.brick.y)).toBe(T.BRICK);
    // The tip names the difference (0.4.43, owner).
    expect(s.director.lines().join(' ')).toMatch(/\? BLOCKS OPEN WITH ANY HIT\. BRICKS NEED AN UP-STRIKE/);
    // A plain jump under the brick: it only bumps (no soft-lock: nothing is spent).
    let jumped = false;
    playStage(
      h,
      s,
      (st) => {
        const cx = toPx(st.world.player.centerX);
        const dx = S.brick.x * 16 + 8 - cx;
        if (Math.abs(dx) > 3) return [dx > 0 ? 'right' : 'left'];
        if (!jumped && st.world.player.body.onGround) {
          jumped = true;
          return ['jump'];
        }
        return [];
      },
      () => jumped && w().player.body.onGround && w().player.body.vy === 0,
      600,
    );
    h.idle(30);
    expect(w().map.get(S.brick.x, S.brick.y)).toBe(T.BRICK);
    expect(lessonId(s)).toBe('up-thrust');
    expect(h.top()).toBe(s);
    // Broken the wrong way (a swing, not a stab): Toad's card, then the stretch is rebuilt.
    w().strikeBlock(S.brick.x, S.brick.y, w().player, true);
    h.until(() => h.top() instanceof CardScene, 60);
    expect(s.director.cardKind).toBe('spent');
    expect((h.top() as CardScene).lines.join(' ')).toMatch(/UP-STRIKE/);
    h.idle(40);
    h.tap('jump');
    expect(h.top()).toBe(s);
    expect(lessonId(s)).toBe('up-thrust');
    expect(w().map.get(S.brick.x, S.brick.y)).toBe(T.BRICK);
    // Now with the stab: the brick breaks and the lesson is done.
    playStage(h, s, linkBot(), () => lessonId(s) !== 'up-thrust', 600);
    expect(s.director.done).toContain('up-thrust');
    expect(w().map.get(S.brick.x, S.brick.y)).toBe(T.AIR);
  });

  it('a death costs no life and keeps the kit floor', () => {
    const { h, stage } = startStage('link', { replay: true });
    choose(h, 'Jump Spell');
    const s = stage();
    const w = s.world;
    w.kill(w.player);
    for (let i = 0; i < 400 && s.world === w; i++) stepPast(h);
    expect(s.world).not.toBe(w);
    const p = s.world.player;
    expect(lessonId(s)).toBe('jump-spell');
    expect([p.scratch.maxHp, p.hp, p.scratch['has-bomb-bag'], p.scratch['has-shield-spell']]).toEqual([
      8, 8, 1, 1,
    ]);
    expect(s.state.lives).toBe(1);
    expect(heroCol(s)).toBe(84);
    expect(tileToSub(1)).toBeGreaterThan(0);
  });
});
