import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getLevel } from '@content/levels';
import { CHARACTERS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { LINK } from '@game/characters/link';
import { startHp, type CharacterDef } from '@game/characters/character';
import { Enemy } from '@game/entities/enemies/enemy';
import { runSim, type InputScript, type SimOptions } from '@game/sim/headless';
import type { GameState } from '@game/context';
import type { World } from '@game/world/world';

/**
 * Golden parity fixture (TG-36): Current play must never drift. Recorded on the untouched
 * main checkout before any Classic code landed:
 *   RECORD_PARITY=1 pnpm vitest run tests/sim/current-parity.test.ts && pnpm prettier --write tests/sim/fixtures
 * Each run hashes every frame's (x, y, vx, vy, powerState, hp) for each player, keeps a coarse
 * sample every 30 frames to help find a drift, and records the end state (score, coins, lives,
 * outcome, the event list's hash, the tile map's hash and the alive enemies). Every run is
 * checked as recorded and again with `rules: 'current'` passed explicitly (TG-37).
 */

const FIXTURE = fileURLToPath(new URL('./fixtures/current-parity.json', import.meta.url));
const RECORD = process.env.RECORD_PARITY === '1';

/** Run right, a jump every 40 frames (held 12) and an attack tap 20 frames after it. */
function runJumpAttack(frames: number): InputScript {
  const steps: InputScript['steps'] = [];
  for (let f = 0; f < frames; f += 40) {
    steps.push({ frame: f, hold: ['right', 'run', 'jump'] });
    steps.push({ frame: f + 12, hold: ['right', 'run'] });
    steps.push({ frame: f + 18, hold: ['right'] });
    steps.push({ frame: f + 20, hold: ['right', 'attack'] });
    steps.push({ frame: f + 23, hold: ['right', 'run'] });
  }
  return { steps };
}

/** Swim right: a stroke (jump tap) every 20 frames. */
function strokes(frames: number): InputScript {
  const steps: InputScript['steps'] = [];
  for (let f = 0; f < frames; f += 20) {
    steps.push({ frame: f, hold: ['right', 'jump'] });
    steps.push({ frame: f + 6, hold: ['right'] });
  }
  return { steps };
}

/** FNV-1a 32-bit over a string, as 8 hex digits. */
function fnv(s: string, h = 0x811c9dc5): number {
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
const hex = (n: number) => n.toString(16).padStart(8, '0');

interface RunRecord {
  frames: number;
  outcome: string;
  frameHash: string;
  samples: (string | number)[][];
  score: number;
  coins: number;
  lives: number;
  events: number;
  eventHash: string;
  tileHash: string;
  enemies: string[];
}

interface RunSpec {
  name: string;
  level: string;
  character: CharacterDef;
  script: InputScript;
  maxFrames: number;
  state?: Partial<GameState>;
}

/** The hero's top power with its full dev kit, as devStart(…, power, fullKit) sets it. */
function topState(c: CharacterDef): Partial<GameState> {
  const kit = c.devKit?.() ?? {};
  if (c.damage.kind === 'powerup') {
    const states = c.damage.states;
    return { kit, powerState: states[states.length - 1] as string };
  }
  return { kit, hp: kit.maxHp ?? startHp(c) };
}

function specs(): RunSpec[] {
  const out: RunSpec[] = [];
  for (const c of CHARACTERS) {
    out.push({ name: `${c.id} 1-1`, level: '1-1', character: c, script: runJumpAttack(900), maxFrames: 900 });
    out.push({ name: `${c.id} 1-2`, level: '1-2', character: c, script: runJumpAttack(900), maxFrames: 900 });
    out.push({ name: `${c.id} 2-2`, level: '2-2', character: c, script: strokes(400), maxFrames: 400 });
    out.push({
      name: `${c.id} 1-1 top kit`,
      level: '1-1',
      character: c,
      script: runJumpAttack(900),
      maxFrames: 900,
      state: topState(c),
    });
  }
  out.push({
    name: 'co-op mario+link 1-1',
    level: '1-1',
    character: MARIO,
    script: runJumpAttack(900),
    maxFrames: 900,
    state: { character2: LINK, lives: 5 },
  });
  return out;
}

function record(spec: RunSpec, extra: Partial<SimOptions> = {}): RunRecord {
  let h = 0x811c9dc5;
  const samples: (string | number)[][] = [];
  const tick = (world: World, frame: number) => {
    for (const p of world.players) {
      const b = p.body;
      const t = `${frame}|${p.index}|${b.x}|${b.y}|${b.vx}|${b.vy}|${p.powerState}|${p.hp};`;
      h = fnv(t, h);
      if (frame % 30 === 0) samples.push([frame, p.index, b.x, b.y, p.powerState, p.hp]);
    }
    return false;
  };
  const r = runSim({
    level: getLevel(spec.level),
    character: spec.character,
    script: spec.script,
    maxFrames: spec.maxFrames,
    ...(spec.state ? { state: spec.state } : {}),
    until: tick,
    ...extra,
  });
  const enemies = r.world.entities
    .filter((e): e is Enemy => e instanceof Enemy && e.alive)
    .map((e) => `${e.constructor.name}@${e.body.x},${e.body.y}`)
    .sort();
  return {
    frames: r.frames,
    outcome: r.outcome,
    frameHash: hex(h),
    samples,
    score: r.score,
    coins: r.coins,
    lives: r.lives,
    events: r.events.length,
    eventHash: hex(fnv(JSON.stringify(r.events))),
    tileHash: hex(fnv(Array.from(r.world.map.tiles).join(','))),
    enemies,
  };
}

const fixture: Record<string, RunRecord> =
  !RECORD && existsSync(FIXTURE)
    ? (JSON.parse(readFileSync(FIXTURE, 'utf8')) as Record<string, RunRecord>)
    : {};

describe('Current parity fixture (TG-36)', () => {
  const all = specs();

  if (RECORD) {
    it('records the fixture', () => {
      const out: Record<string, RunRecord> = {};
      for (const s of all) out[s.name] = record(s);
      writeFileSync(FIXTURE, `${JSON.stringify(out)}\n`);
      expect(Object.keys(out)).toHaveLength(all.length);
    }, 600_000);
    return;
  }

  it('covers every Current hero', () => {
    for (const c of CHARACTERS) expect(fixture[`${c.id} 1-1`], c.id).toBeDefined();
    expect(Object.keys(fixture).sort()).toEqual(all.map((s) => s.name).sort());
  });

  for (const s of all) {
    it(`${s.name} plays exactly as recorded`, () => {
      expect(record(s)).toEqual(fixture[s.name]);
    });
  }
});
