import { describe, expect, it } from 'vitest';
import type { Action } from '@engine/input/actions';
import { px, toPx } from '@engine/math/units';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { FIRE_SPELL, LINK, MAX_MAGIC } from '@game/characters/link';
import { activeTool } from '@game/characters/toolbelt';
import { Goomba } from '@game/entities/enemies/goomba';
import { HeroItem } from '@game/entities/objects/hero-item';
import { FIRE_BEAM, Projectile } from '@game/entities/projectiles/projectile';
import { FOUND } from '@game/items/flags';
import { LINK_STAGE } from '@game/tutorial/heroes/link';
import type { World } from '@game/world/world';
import { useStorage } from './heroes-harness';
import { linkBot } from './bots/link';
import { choose, playStage, startStage } from './stage-bot';

// Link's Fire spell (0.4.43, owner: "it doesn't work"). Taken with another tool picked (the Jump
// spell, the lesson before), USE TOOL cast that one instead, and the swing then threw nothing; the
// spark it threw was hard to see too. Now the spell is picked as it is taken, and its swing throws
// a fireball (FIRE_BEAM) that flies on and hits.

useStorage();

/** A campaign-rules field: Link's ? block at column 8 holds the Fire spell; a Goomba far right. */
function fireField() {
  const rows = Array.from({ length: 13 }, () => '.'.repeat(48));
  rows[9] = '.'.repeat(8) + 'M' + '.'.repeat(39);
  rows[12] = '.'.repeat(30) + 'g' + '.'.repeat(17);
  return parseTextMap(
    [
      'id: t',
      'time: 300',
      'start: 2,12',
      '',
      '[tiles]',
      ...rows,
      '#'.repeat(48),
      '#'.repeat(48),
      '',
      '[hero-items]',
      '8 9 link=fire-spell',
    ].join('\n'),
  );
}

const toolId = (w: World) => activeTool(w.player, w.player.def.tools?.(w.player) ?? [])?.id;

describe("Link's Fire spell", () => {
  it('campaign: taken from its block, it is the tool picked; one press casts, the swing throws a fireball', () => {
    const seen: string[] = [];
    let phase = 0;
    let at = 0;
    const r = runSim({
      level: fireField(),
      character: LINK,
      script: { steps: [] },
      maxFrames: 900,
      // The Jump spell found earlier and picked (it was the lesson before in his training).
      state: { kit: { [FOUND]: 1, maxHp: 8, 'has-jump-spell': 1, magic: MAX_MAGIC, tool: 1 }, hp: 8 },
      controller: (w, f) => {
        const p = w.player;
        const b = p.body;
        if (f === 0) {
          w.useHeroItems(w.level.heroItems ?? []);
          expect(toolId(w)).toBe('jump');
        }
        const out: Action[] = [];
        const item = w.entities.find((e): e is HeroItem => e instanceof HeroItem && e.alive);
        switch (phase) {
          case 0: {
            // Under the block, a hop into it.
            const dx = 8 * 16 + 8 - toPx(p.centerX);
            if (item) phase = 1;
            else if (Math.abs(dx) > 2) out.push(dx > 0 ? 'right' : 'left');
            else if (b.onGround && f % 2 === 0) out.push('jump');
            break;
          }
          case 1:
            // Onto the item (it rests on the block), then down.
            if (item?.out) {
              b.x = item.body.x;
              b.y = item.body.y + item.body.h - b.h;
            }
            if (p.scratch['has-fire-spell']) {
              seen.push(`picked ${toolId(w)}`);
              b.x = px(4 * 16);
              b.y = px(12 * 16) - b.h;
              phase = 2;
              at = f;
            }
            break;
          case 2:
            // Stand still, then one press of USE TOOL: the Fire spell, not the Jump spell.
            if (f === at + 20) {
              out.push('special');
              phase = 3;
            }
            break;
          case 3:
            if (f === at + 30) {
              seen.push(`magic ${MAX_MAGIC - (p.scratch.magic ?? 0)} jump ${p.scratch.jumpSpell ?? 0}`);
              out.push('attack');
            }
            if (f === at + 32) {
              const shot = w.entities.find((e): e is Projectile => e instanceof Projectile && e.alive);
              seen.push(`shot ${shot?.spec === FIRE_BEAM}`);
              phase = 4;
            }
            break;
        }
        return out;
      },
      until: (w) => phase === 4 && !w.entities.some((e) => e instanceof Goomba && e.alive && e.contactHurts),
    });
    expect(seen).toEqual(['picked fire', `magic ${FIRE_SPELL.cost} jump 0`, 'shot true']);
    // The fireball flew on and felled the Goomba.
    expect(r.outcome).toBe('stopped');
  });

  it('training: the lesson is done with USE TOOL and the sword alone (no TOOLS press)', () => {
    const { h, stage } = startStage('link', { replay: true });
    choose(h, 'Fire Spell');
    const s = stage();
    const bot = linkBot();
    // The Jump spell is picked when the lesson comes up (the one before).
    s.world.player.scratch.tool = 2;
    playStage(h, s, bot, () => !!s.world.player.scratch['has-fire-spell'], 900);
    expect(toolId(s.world)).toBe('fire');
    let selects = 0;
    let fireballs = 0;
    playStage(
      h,
      s,
      (st) => {
        const out = bot(st).filter((a) => a !== 'up');
        if (out.includes('select')) selects++;
        if (st.world.entities.some((e) => e instanceof Projectile && e.alive && e.spec === FIRE_BEAM))
          fireballs++;
        return out;
      },
      () => s.director.lesson?.id !== 'fire-spell',
      900,
    );
    expect(s.director.done).toContain('fire-spell');
    expect(selects).toBe(0);
    expect(fireballs).toBeGreaterThan(0);
    expect(LINK_STAGE.fireTarget).toBe(125);
  });
});
