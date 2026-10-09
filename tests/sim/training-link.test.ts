import { describe, expect, it } from 'vitest';
import type { Action } from '@engine/input/actions';
import { tileToSub, toPx } from '@engine/math/units';
import { CardScene } from '@game/scenes/message';
import { Goomba } from '@game/entities/enemies/goomba';
import { HeroItem } from '@game/entities/objects/hero-item';
import { activeTool } from '@game/characters/toolbelt';
import { T } from '@game/level/tiles';
import type { HeroStageScene } from '@game/tutorial/hero-stage';
import { LINK_LESSONS, LINK_STAGE, ringLights } from '@game/tutorial/heroes/link';
import { stageWatch } from '@game/tutorial/targets';
import { useStorage } from './heroes-harness';
import { choose, heroCol, playStage, skipGreeting, startAtLabels, startStage } from './stage-bot';

// Link's training stage (0.4.37, design section 4): his basic kit, then each item from a ? block
// in his order. The Blue Ring's lesson shows its one rule: with full hearts, the first bump lights
// FREE and costs nothing, the next lights HURT and costs half a heart.

useStorage();

const S = LINK_STAGE;
const lessonId = (s: HeroStageScene) => s.director.lesson?.id;

/** Link's bot: reads the current lesson and plays it as a player would. */
export function linkBot(): (s: HeroStageScene) => Action[] {
  let bombAt = -1;
  let swung = 0;
  return (s) => {
    const w = s.world;
    const p = w.player;
    const b = p.body;
    const cx = toPx(p.centerX);
    const out: Action[] = [];
    const tools = p.def.tools?.(p) ?? [];
    const tool = activeTool(p, tools)?.id;
    /** Walk to column `col`'s centre (within 3 px), true once there and still. */
    const goTo = (col: number, slack = 3): boolean => {
      const dx = col * 16 + 8 - cx;
      if (Math.abs(dx) <= slack) return Math.abs(b.vx) < 0x100 && b.onGround;
      const dir = dx > 0 ? 1 : -1;
      out.push(dir > 0 ? 'right' : 'left');
      // A step in the way (out of the dip): hop it.
      const ahead = Math.floor((dir > 0 ? toPx(b.x + b.w) + 1 : toPx(b.x) - 1) / 16);
      const feet = Math.floor((toPx(b.y + b.h) - 1) / 16);
      if (b.onGround && w.map.isSolid(ahead, feet) && (w.frame & 3) === 0) out.push('jump');
      return false;
    };
    /** Stand at column `col` (within 6 px) facing right: true once there, still. */
    const standAt = (col: number): boolean => {
      const dx = col * 16 + 8 - cx;
      if (Math.abs(dx) > 6) return goTo(col, 6);
      if (p.facing < 0) {
        out.push('right');
        return false;
      }
      return b.onGround && Math.abs(b.vx) < 0x100;
    };
    /** Picks belt tool `id` (a press of TOOLS every few frames). */
    const pick = (id: string): boolean => {
      if (tool === id) return true;
      if ((w.frame & 7) === 0) out.push('select');
      return false;
    };
    const press = (a: Action, every = 12) => {
      if (w.frame % every === 0) out.push(a);
    };
    /** Open the block at (x, y) with an up-thrust, then take its item from the left side. */
    const takeFrom = (blk: { x: number; y: number }): void => {
      const used = w.map.get(blk.x, blk.y) !== T.Q_POWERUP;
      const item = w.entities.find((e) => e instanceof HeroItem && e.alive);
      if (!used) {
        if (!b.onGround) {
          out.push('up');
          const dx = blk.x * 16 + 8 - cx;
          if (Math.abs(dx) > 2) out.push(dx > 0 ? 'right' : 'left');
          return;
        }
        if (goTo(blk.x)) press('jump', 4);
        return;
      }
      if (!item) return;
      // From whichever side he is on (the screen does not scroll back left).
      const side = cx <= blk.x * 16 + 8 ? -2 : 2;
      if (!b.onGround) {
        out.push(side < 0 ? 'right' : 'left');
        return;
      }
      if (goTo(blk.x + side)) press('jump', 4);
    };
    const taken = (id: string) =>
      s.director.lesson?.item !== id || !s.director.lines()[0]?.startsWith('OPEN');
    switch (lessonId(s)) {
      case 'sword':
        if (goTo(S.sword - 1, 6)) press('attack', 16);
        break;
      case 'shield':
        // Stand still a few steps from the shooter, facing it.
        if (cx < (S.shooter - 5) * 16) out.push('right');
        break;
      case 'down-thrust': {
        const g = w.entities.find((e): e is Goomba => e instanceof Goomba && e.alive);
        if (!g) {
          out.push('right');
          break;
        }
        const gx = toPx(g.body.x + (g.body.w >> 1));
        if (!b.onGround) {
          if (cx < gx - 2) out.push('right');
          else if (cx > gx + 2) out.push('left');
          if (b.vy > 0) out.push('down');
          break;
        }
        if (goTo(S.dip.from - 1, 4)) press('jump', 6);
        break;
      }
      case 'up-thrust':
        if (!b.onGround) {
          out.push('up');
          const dx = S.coinBlock.x * 16 + 8 - cx;
          if (Math.abs(dx) > 2) out.push(dx > 0 ? 'right' : 'left');
        } else if (goTo(S.coinBlock.x)) press('jump', 6);
        break;
      case 'boomerang':
        if (!b.onGround) {
          if (b.vy >= 0 && b.vy < 0x400) out.push('special');
          break;
        }
        if (w.entities.some((e) => e.alive && e.kind === 'boomerang')) break;
        if (standAt(S.ledge.from - 1)) press('jump', 30);
        break;
      case 'heart-container':
        takeFrom(S.heartBlock);
        break;
      case 'bomb':
        if (!taken('bomb-bag') || !p.scratch['has-bomb-bag']) {
          takeFrom(S.bombBlock);
          break;
        }
        if (!pick('bomb')) break;
        if (bombAt < 0 || w.frame - bombAt > 150) {
          if (goTo(S.bombTarget - 2, 4)) {
            out.push('special');
            bombAt = w.frame;
          }
        } else goTo(S.bombTarget - 6, 4);
        break;
      case 'shield-spell':
        if (!p.scratch['has-shield-spell']) {
          takeFrom(S.shieldBlock);
          break;
        }
        if (pick('shield') && !p.scratch.shieldSpell) press('special', 10);
        break;
      case 'jump-spell':
        if (!p.scratch['has-jump-spell']) {
          takeFrom(S.jumpBlock);
          break;
        }
        if (!p.scratch.jumpSpell) {
          if (pick('jump')) press('special', 10);
          break;
        }
        if (!b.onGround) {
          out.push('right');
          break;
        }
        if (goTo(S.wall.from - 2)) press('jump', 4);
        break;
      case 'blue-ring':
        if (!p.scratch.tunic) {
          takeFrom(S.ringBlock);
          break;
        }
        // Down off the block, then stand and let the walkers bump him.
        goTo(S.ringBlock.x + 3, 6);
        break;
      case 'fire-spell':
        if (!p.scratch['has-fire-spell']) {
          takeFrom(S.fireBlock);
          break;
        }
        if (!standAt(S.ditch.from - 2)) break;
        if (!p.scratch.fireSpell) {
          if (pick('fire')) press('special', 10);
          break;
        }
        press('attack', 20);
        break;
      case 'magical-sword':
        if (!p.scratch.beam) {
          takeFrom(S.swordBlock);
          break;
        }
        if (standAt(S.swordTarget - 4) && ++swung % 24 === 0) out.push('attack');
        break;
      default:
        out.push('right');
        if (b.onGround && cx >= (S.flag - 3) * 16) out.push('jump');
    }
    return out;
  };
}

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
    // Full hearts at the grab; FREE with nothing lost; then the hit that lit HURT cost half a heart.
    expect(seen).toEqual(['ring:8', 'FREE/-:8']);
    const costs = stageWatch(s.world).hurts.map((x) => x.cost);
    expect(costs).toEqual([0, 1]);
    // The next lesson comes up with full hearts again.
    expect(lessonId(s)).toBe('fire-spell');
    expect(p().hp).toBe(8);
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
    expect(ringLights(s.world)).toEqual({ free: true, hurt: false });
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

  it('the up-thrust counts only a stab: a head bump uses the block up and Toad puts it back', () => {
    const { h, stage } = startStage('link', { replay: true });
    choose(h, 'Beginning');
    const s = stage();
    skipGreeting(h);
    s.director.startAt(LINK_LESSONS.findIndex((l) => l.id === 'up-thrust'));
    const w = () => s.world;
    // A plain jump under the block: its coin, but no stab.
    let jumped = false;
    playStage(
      h,
      s,
      (st) => {
        const cx = toPx(st.world.player.centerX);
        const dx = S.coinBlock.x * 16 + 8 - cx;
        if (Math.abs(dx) > 3) return [dx > 0 ? 'right' : 'left'];
        if (!jumped && st.world.player.body.onGround) {
          jumped = true;
          return ['jump'];
        }
        return [];
      },
      () => w().map.get(S.coinBlock.x, S.coinBlock.y) !== T.Q_COIN,
      600,
    );
    h.idle(30);
    expect(lessonId(s)).toBe('up-thrust');
    playStage(
      h,
      s,
      () => ['right'],
      () => h.top() instanceof CardScene,
      600,
    );
    h.idle(40);
    h.tap('jump');
    expect(w().map.get(S.coinBlock.x, S.coinBlock.y)).toBe(T.Q_COIN);
    // Now with the stab.
    playStage(h, s, linkBot(), () => lessonId(s) !== 'up-thrust', 600);
    expect(s.director.done).toContain('up-thrust');
  });

  it('a death costs no life and keeps the kit floor', () => {
    const { h, stage } = startStage('link', { replay: true });
    choose(h, 'Jump Spell');
    const s = stage();
    const w = s.world;
    w.kill(w.player);
    for (let i = 0; i < 400 && s.world === w; i++) h.step();
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
