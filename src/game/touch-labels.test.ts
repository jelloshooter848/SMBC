import { describe, expect, it } from 'vitest';
import type { TouchLabels } from '@engine/input/touch';
import type { Action } from '@engine/input/actions';
import { LABEL_MIN_PX, buttonShape, fitLabel } from '@engine/input/touch-logic';
import { Player } from './entities/player';
import type { World } from './world/world';
import type { CharacterDef } from './characters/character';
import { CHARACTERS } from './characters/registry';
import { MARIO } from './characters/mario';
import { LUIGI } from './characters/luigi';
import { LINK, LINK_TOOL_LABELS } from './characters/link';
import { MEGAMAN, MEGAMAN_TOOL_LABELS } from './characters/megaman';
import { SAMUS } from './characters/samus';
import { SIMON, SIMON_TOOL_LABELS } from './characters/simon';
import { RYU, RYU_TOOL_LABELS } from './characters/ryu';
import { BILL, BILL_TOOL_LABELS } from './characters/bill';
import { levelTouchLabels } from './touch-labels';

/** No hero's labels read the world; the level passes it for heroes that may want it. */
const world = {} as World;

interface Setup {
  power?: string;
  kit?: Record<string, number>;
  water?: boolean;
  vine?: boolean;
  dead?: boolean;
}

function hero(def: CharacterDef, s: Setup = {}): Player {
  const power = s.power ?? (def.damage.kind === 'powerup' ? 'small' : 'full');
  const p = new Player(0, 0, def, power, def.damage.kind === 'hp' ? def.damage.max : 0);
  Object.assign(p.scratch, s.kit ?? {});
  p.inWater = !!s.water;
  if (s.vine) p.vine = { x: 0, top: 0, bottom: 64 };
  p.dead = !!s.dead;
  return p;
}

/** The five buttons, in A B C START SELECT order ('-' = hidden). */
function row(l: TouchLabels): string {
  return [l.jump, l.attack, l.special, l.start, l.select].map((x) => x ?? '-').join(' ');
}

const MM = { helmet: 1, weapons: 5 };
const SIMON_ALL = { subs: 5, hearts: 10 };
const RYU_ALL = { arts: 4, ninpo: 40 };

// [hero, state, setup, "A B C START SELECT"]
const TABLE: [CharacterDef, string, Setup, string][] = [
  [MARIO, 'small', {}, 'JUMP RUN - PAUSE -'],
  [MARIO, 'big', { power: 'big' }, 'JUMP RUN - PAUSE -'],
  [MARIO, 'fire', { power: 'fire' }, 'JUMP FIRE - PAUSE -'],
  [MARIO, 'small, swimming (no running in water)', { water: true }, 'SWIM - - PAUSE -'],
  [MARIO, 'fire, swimming', { power: 'fire', water: true }, 'SWIM FIRE - PAUSE -'],
  [MARIO, 'on a vine', { power: 'fire', vine: true }, '- - - PAUSE -'],
  [MARIO, 'dead', { dead: true }, '- - - PAUSE -'],
  [LUIGI, 'small', {}, 'JUMP RUN - PAUSE -'],
  [LUIGI, 'fire', { power: 'fire' }, 'JUMP FIRE - PAUSE -'],
  [LINK, 'boomerang', {}, 'JUMP SWORD RANG PAUSE TOOLS'],
  [LINK, 'boomerang in flight', { kit: { boomerangOut: 1 } }, 'JUMP SWORD - PAUSE TOOLS'],
  [LINK, 'bombs, none left', { kit: { tool: 1 } }, 'JUMP SWORD - PAUSE TOOLS'],
  [LINK, 'bombs', { kit: { tool: 1, bombs: 3 } }, 'JUMP SWORD BOMB PAUSE TOOLS'],
  [LINK, 'jump spell', { kit: { tool: 2 } }, 'JUMP SWORD HI-JUMP PAUSE TOOLS'],
  [LINK, 'jump spell, low magic', { kit: { tool: 2, magic: 4 } }, 'JUMP SWORD - PAUSE TOOLS'],
  [LINK, 'shield spell', { kit: { tool: 3 } }, 'JUMP SWORD SHIELD PAUSE TOOLS'],
  [LINK, 'fire spell', { kit: { tool: 4, magic: 4 } }, 'JUMP SWORD FIRE PAUSE TOOLS'],
  [MEGAMAN, 'no helmet', {}, 'JUMP SHOOT BUSTER PAUSE -'],
  [MEGAMAN, 'helmet (buster + Rush)', { kit: { helmet: 1 } }, 'JUMP SHOOT BUSTER PAUSE WEAPON'],
  [MEGAMAN, 'Rush selected', { kit: { helmet: 1, tool: 1 } }, 'JUMP SHOOT RUSH PAUSE WEAPON'],
  [MEGAMAN, 'Saw Disc', { kit: { ...MM, tool: 1 } }, 'JUMP SHOOT SAW PAUSE WEAPON'],
  [MEGAMAN, 'Saw Disc, empty', { kit: { ...MM, tool: 1, wsaw: 0 } }, 'JUMP SHOOT - PAUSE WEAPON'],
  [MEGAMAN, 'Leaf Guard', { kit: { ...MM, tool: 2 } }, 'JUMP SHOOT LEAF PAUSE WEAPON'],
  [MEGAMAN, 'Flame Wave', { kit: { ...MM, tool: 3 } }, 'JUMP SHOOT FLAME PAUSE WEAPON'],
  [MEGAMAN, 'Homing Knuckle', { kit: { ...MM, tool: 4 } }, 'JUMP SHOOT KNUCKLE PAUSE WEAPON'],
  [MEGAMAN, 'Bolt', { kit: { ...MM, tool: 5 } }, 'JUMP SHOOT BOLT PAUSE WEAPON'],
  [MEGAMAN, 'Rush, all weapons', { kit: { ...MM, tool: 6 } }, 'JUMP SHOOT RUSH PAUSE WEAPON'],
  [SAMUS, 'beam, no missiles', {}, 'JUMP SHOOT - PAUSE WEAPON'],
  [SAMUS, 'beam, missiles', { kit: { missiles: 5 } }, 'JUMP SHOOT MISSILE PAUSE WEAPON'],
  [SAMUS, 'missiles selected', { kit: { missiles: 5, tool: 1 } }, 'JUMP MISSILE MISSILE PAUSE WEAPON'],
  [SAMUS, 'missiles selected, none left', { kit: { tool: 1 } }, 'JUMP - - PAUSE WEAPON'],
  [SAMUS, 'morph ball', { kit: { ball: 1, missiles: 5 } }, '- BOMB BOMB PAUSE WEAPON'],
  [SAMUS, 'swimming', { water: true }, 'SWIM SHOOT - PAUSE WEAPON'],
  [SIMON, 'whip only', {}, 'JUMP WHIP - PAUSE -'],
  [SIMON, 'dagger only', { kit: { subs: 1 } }, 'JUMP WHIP DAGGER PAUSE -'],
  [SIMON, 'axe', { kit: { ...SIMON_ALL, tool: 1 } }, 'JUMP WHIP AXE PAUSE TOOLS'],
  [SIMON, 'holy water', { kit: { ...SIMON_ALL, tool: 2 } }, 'JUMP WHIP WATER PAUSE TOOLS'],
  [SIMON, 'cross', { kit: { ...SIMON_ALL, tool: 3 } }, 'JUMP WHIP CROSS PAUSE TOOLS'],
  [SIMON, 'stopwatch', { kit: { ...SIMON_ALL, tool: 4 } }, 'JUMP WHIP WATCH PAUSE TOOLS'],
  [SIMON, 'stopwatch, 4 hearts', { kit: { ...SIMON_ALL, tool: 4, hearts: 4 } }, 'JUMP WHIP - PAUSE TOOLS'],
  [RYU, 'no arts', {}, 'JUMP SLASH - PAUSE -'],
  [RYU, 'throwing star', { kit: { ...RYU_ALL, tool: 0 } }, 'JUMP SLASH STAR PAUSE NINPO'],
  [RYU, 'windmill', { kit: { ...RYU_ALL, tool: 1 } }, 'JUMP SLASH WIND-MILL PAUSE NINPO'],
  [RYU, 'fire wheel', { kit: { ...RYU_ALL, tool: 2 } }, 'JUMP SLASH WHEEL PAUSE NINPO'],
  [RYU, 'jump and slash', { kit: { ...RYU_ALL, tool: 3 } }, 'JUMP SLASH SPIN PAUSE NINPO'],
  [RYU, 'out of ninpo', { kit: { ...RYU_ALL, ninpo: 0 } }, 'JUMP SLASH - PAUSE NINPO'],
  [BILL, 'rifle', {}, 'JUMP SHOOT RIFLE PAUSE -'],
  [BILL, 'machine gun', { kit: { guns: 4, tool: 1 } }, 'JUMP SHOOT M-GUN PAUSE WEAPON'],
  [BILL, 'spread', { kit: { guns: 4, tool: 2 } }, 'JUMP SHOOT SPREAD PAUSE WEAPON'],
  [BILL, 'laser', { kit: { guns: 4, tool: 3 } }, 'JUMP SHOOT LASER PAUSE WEAPON'],
  [BILL, 'flame thrower', { kit: { guns: 4, tool: 4 } }, 'JUMP SHOOT FLAME PAUSE WEAPON'],
];

describe('touch labels in a level', () => {
  it.each(TABLE.map(([d, state, s, want]) => [d.name, state, s, want, d] as const))(
    '%s, %s',
    (_n, _state, s, want, def) => {
      expect(row(levelTouchLabels(hero(def, s), world))).toBe(want);
    },
  );

  it('every hero has labels and covers the table', () => {
    for (const c of CHARACTERS) {
      expect(c.touchLabels, c.name).toBeDefined();
      expect(TABLE.some(([d]) => d === c)).toBe(true);
    }
  });

  it('labels are short upper-case words that fit a round button', () => {
    for (const [def, , s] of TABLE) {
      for (const l of Object.values(levelTouchLabels(hero(def, s), world)))
        if (l !== null && l !== undefined) expect(l).toMatch(/^[A-Z][A-Z-]{1,8}$/);
    }
  });

  it(`every label fits its button at ${LABEL_MIN_PX} px or more (widest font, touch scale 1)`, () => {
    const shown: [Action, string][] = [];
    for (const [def, , s] of TABLE)
      for (const [a, l] of Object.entries(levelTouchLabels(hero(def, s), world)))
        if (l) shown.push([a as Action, l]);
    // Every tool caption C can show, whether or not a table row selects it.
    for (const names of [
      LINK_TOOL_LABELS,
      MEGAMAN_TOOL_LABELS,
      SIMON_TOOL_LABELS,
      RYU_TOOL_LABELS,
      BILL_TOOL_LABELS,
    ])
      for (const l of Object.values(names)) shown.push(['special', l]);
    for (const [a, l] of shown) {
      const shape = buttonShape(a);
      const fit = fitLabel(l, shape);
      expect(fit.fits, `${a} ${l}`).toBe(true);
      expect(fit.scale * shape.font, `${a} ${l}`).toBeGreaterThanOrEqual(LABEL_MIN_PX);
    }
    expect(shown.length).toBeGreaterThan(TABLE.length);
  });

  it('labels follow the state: a power-up, the ball and a tool switch change them', () => {
    const p = hero(MARIO);
    expect(levelTouchLabels(p, world).attack).toBe('RUN');
    p.powerState = 'fire';
    expect(levelTouchLabels(p, world).attack).toBe('FIRE');
    const s = hero(SAMUS);
    s.scratch.ball = 1;
    expect(levelTouchLabels(s, world).jump).toBeNull();
    s.scratch.ball = 0;
    expect(levelTouchLabels(s, world).jump).toBe('JUMP');
    const l = hero(LINK, { kit: { bombs: 2 } });
    expect(levelTouchLabels(l, world).special).toBe('RANG');
    l.scratch.tool = 1;
    expect(levelTouchLabels(l, world).special).toBe('BOMB');
  });

  it('with no player there is still a pause button', () => {
    expect(row(levelTouchLabels(undefined, world))).toBe('JUMP - - PAUSE -');
  });

  it("each guide's touch captions are labels the hero's buttons really show", () => {
    for (const c of CHARACTERS) {
      const shown = new Set<string>(['JUMP']);
      for (const [def, , s] of TABLE)
        if (def === c)
          for (const l of Object.values(levelTouchLabels(hero(def, s), world))) if (l) shown.add(l);
      for (const ctl of c.guide.controls) {
        if (!ctl.touch) continue;
        // C named after the selected tool is described as "<THING> BUTTON".
        if (ctl.touch.endsWith(' BUTTON')) expect(ctl.action, c.name).toBe('special');
        else expect(shown.has(ctl.touch), `${c.name}: ${ctl.touch}`).toBe(true);
      }
      // Rows for B, C and Select say which caption to look for.
      for (const ctl of c.guide.controls)
        if (/attack|special|select/.test(ctl.action))
          expect(ctl.touch, `${c.name} ${ctl.action}`).toBeDefined();
    }
  });
});
