import { describe, expect, it } from 'vitest';
import type { Action } from '@engine/input/actions';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { SAMUS } from '@game/characters/samus';
import { ICE_BEAM, LONG_BEAM, MISSILE } from '@game/characters/samus/weapons';
import { activeTool } from '@game/characters/toolbelt';
import { Projectile } from '@game/entities/projectiles/projectile';
import { FOUND } from '@game/items/flags';
import { itemRules } from '@game/items/heroes';
import { heroStart } from '@game/items/heroes';
import { Player } from '@game/entities/player';
import { levelTouchLabels } from '@game/touch-labels';
import type { World } from '@game/world/world';

// Samus's buttons in the campaign (0.4.43, owner: the tool button always said MISSILE, whatever
// was picked). SHOOT always fires her beam (the last beam picked); the tool button fires the
// weapon picked on the belt and reads as it, on touch and in the HUD; WEAPON (TOOLS) cycles it.
// Classic play keeps the original's buttons.

const field = () =>
  parseTextMap(
    [
      'id: t',
      'time: 300',
      'start: 2,12',
      '',
      '[tiles]',
      ...Array.from({ length: 13 }, () => '.'.repeat(64)),
      '#'.repeat(64),
      '#'.repeat(64),
    ].join('\n'),
  );

/** What each press did: the shot's spec, the missiles left, the tool button's caption and the HUD's icon. */
function play(kit: Record<string, number>, presses: Record<number, Action>) {
  const log: string[] = [];
  const name = (w: World) => {
    const shots = w.entities.filter((e): e is Projectile => e instanceof Projectile && e.alive);
    const s = shots.at(-1)?.spec;
    return s === MISSILE ? 'missile' : s === ICE_BEAM ? 'ice' : s === LONG_BEAM ? 'beam' : s ? 'other' : '-';
  };
  runSim({
    level: field(),
    character: SAMUS,
    script: { steps: [] },
    maxFrames: 200,
    state: { kit, hp: 30 },
    controller: (w, f) => {
      // Clear the last shot, so each press shows its own.
      if (f % 20 === 19) for (const e of w.entities) if (e instanceof Projectile) e.alive = false;
      if (f % 20 === 4 && presses[f - 4] !== undefined) {
        const p = w.player;
        const labels = levelTouchLabels(p, w);
        const icon = activeTool(p, p.def.tools?.(p) ?? [])?.icon;
        log.push(
          `${presses[f - 4]}:${name(w)} m${p.scratch.missiles} B=${labels.attack} C=${labels.special} hud=${icon}`,
        );
      }
      const a = presses[f];
      return a ? [a] : [];
    },
  });
  return log;
}

const campaign = { [FOUND]: 1, tanks: 1, maxHp: 130, 'has-long-beam': 1, 'has-missiles': 1, missiles: 10 };

describe("Samus's buttons (campaign)", () => {
  it('SHOOT fires the beam even with missiles picked; the tool button fires what is picked and reads as it', () => {
    // The belt: Beam, Ice, Missile. Missiles picked, the Ice Beam the last beam picked.
    const log = play(
      { ...campaign, 'has-ice-beam': 1, tool: 2, beamPick: 1 },
      {
        0: 'attack',
        20: 'special',
        40: 'select',
        60: 'special',
        80: 'attack',
        100: 'select',
        120: 'special',
        140: 'attack',
      },
    );
    expect(log).toEqual([
      'attack:ice m10 B=SHOOT C=MISSILE hud=icon-missile',
      'special:missile m9 B=SHOOT C=MISSILE hud=icon-missile',
      // WEAPON cycles to the Power Beam (Long): the tool button reads BEAM and fires it.
      'select:- m9 B=SHOOT C=BEAM hud=icon-beam',
      'special:beam m9 B=SHOOT C=BEAM hud=icon-beam',
      'attack:beam m9 B=SHOOT C=BEAM hud=icon-beam',
      'select:- m9 B=SHOOT C=ICE hud=icon-ice-beam',
      'special:ice m9 B=SHOOT C=ICE hud=icon-ice-beam',
      'attack:ice m9 B=SHOOT C=ICE hud=icon-ice-beam',
    ]);
  });

  it('a belt item just found is the one picked: Missiles ready on the tool button', () => {
    const p = new Player(0, 0, SAMUS, 'full', 30);
    Object.assign(p.scratch, heroStart(SAMUS).kit, { tanks: 1, 'has-ice-beam': 1, tool: 1 });
    expect(activeTool(p, SAMUS.tools?.(p) ?? [])?.id).toBe('ice');
    itemRules('samus')?.give(p, 'missiles');
    expect(activeTool(p, SAMUS.tools?.(p) ?? [])?.id).toBe('missile');
    itemRules('samus')?.give(p, 'wave-beam');
    expect(activeTool(p, SAMUS.tools?.(p) ?? [])?.id).toBe('wave');
  });

  it('classic play keeps the original buttons: C always a missile, B the selected beam or missile', () => {
    const log = play({ missiles: 10, tool: 1 }, { 0: 'attack', 20: 'special' });
    expect(log.map((l) => l.split(' ')[0])).toEqual(['attack:missile', 'special:missile']);
  });
});
