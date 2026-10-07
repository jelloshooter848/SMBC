import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { runSim } from '@game/sim/headless';
import { CHARACTERS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import type { TeleportPad } from '@game/entities/objects/teleporter';
import { T } from '@game/level/tiles';
import { carryTime, LevelScene } from '@game/scenes/level';
import { WorldMapScene } from '@game/scenes/world-map';
import { autoPlayer, newBot } from '@game/sim/bot';
import { px, toPx } from '@engine/math/units';
import type { World } from '@game/world/world';
import type { Action } from '@engine/input/actions';
import type { Captive } from '@game/entities/objects/captive';
import { captiveDialogue, CARD_COLS } from '@game/scenes/free-hero';
import { fontText } from '@game/hud/text';
import type { MiniGameDef } from '@game/minigames';
import { captives, draw, file, makeGame, useStorage, type H } from './heroes-harness';

// The 3-1 coin heaven's way up to the space station (owner design, Mega Man): past the end of the
// clouds a coin trail, two small cloud platforms and a hidden block (91,7) over the second one;
// bumped, a teleport pad rises out of that platform at (93,10); standing on it beams the player
// up to 3-1-station (beamed down onto its arrival pad), where captive Mega Man waits and a return
// pad beams the player back down into 3-1 at column 162, as the coin heaven's drop does.

useStorage();

const none = { steps: [{ frame: 0, hold: [] as Action[] }] };
const sky = () => getLevel('3-1-sky');
const station = () => getLevel('3-1-station');

/** Platform B: cloud blocks on row 11, columns 90-94; the block at (91, 7); the pad at (93, 10). */
const B = { x0: 90, x1: 94, top: 11 };
const BLOCK = { tx: 91, ty: 7 };
const PAD = { tx: 93, ty: 10 };
const TO_STATION = { level: '3-1-station', x: 3, y: 12, exitDir: 'beam' };
const TO_3_1 = { level: '3-1', x: 162, y: 0, exitDir: 'fall' };

const feetRow = (w: World) => toPx(w.player.body.y + w.player.body.h) / 16;
const centerCol = (w: World) => toPx(w.player.centerX) / 16;
const onB = (w: World) =>
  w.player.body.onGround && feetRow(w) === B.top && centerCol(w) >= B.x0 && centerCol(w) < B.x1 + 1;
const padOf = (w: World) => w.pads[0] as TeleportPad;

/**
 * Walk right off the end of the clouds and hop from platform to platform (the floor ends at
 * 83*16 px, platform A at 85-87 on row 12): jump at the edge of what we stand on and steer in the
 * air toward the middle of the next platform. Stops on platform B.
 */
function hopToB(w: World, f: number, s: { hold: number; mid: number }): Action[] {
  const b = w.player.body;
  const right = toPx(b.x + b.w);
  const cx = toPx(w.player.centerX);
  const out: Action[] = [];
  if (b.onGround) {
    s.hold = 0;
    out.push('right');
    const onFloor = feetRow(w) === 13;
    const edge = onFloor ? 83 * 16 : 88 * 16;
    if (right >= edge - 2 && f > 2) {
      s.hold = 24;
      s.mid = onFloor ? 86.5 * 16 : (B.x0 + 1.5) * 16;
      out.push('jump');
    }
    return out;
  }
  if (s.hold > 0) {
    s.hold--;
    out.push('jump');
  }
  if (cx < s.mid - 4) out.push('right');
  else if (cx > s.mid + 4) out.push('left');
  return out;
}

/** On platform B under the block: jump until the pad shows, then walk right onto it. */
function bumpAndStep(w: World, f: number): Action[] {
  const pad = padOf(w);
  if (!pad.shown) return f > 2 && f % 50 < 22 ? ['jump'] : [];
  if (!w.player.body.onGround) return [];
  return centerCol(w) < PAD.tx + 0.5 ? ['right'] : ['left'];
}

describe('3-1 sky: the hidden teleporter block', () => {
  it('the pad is hidden until the block is bumped: walking over its spot does nothing', () => {
    let stood = false;
    const r = runSim({
      level: sky(),
      character: MARIO,
      script: none,
      start: { x: B.x0, y: B.top - 1, mode: 'stand' },
      maxFrames: 200,
      controller: (w) => {
        stood ||= padOf(w).standing(w.player); // where the pad will be
        return centerCol(w) < PAD.tx + 0.2 ? ['right'] : [];
      },
    });
    expect(stood).toBe(true);
    expect(r.outcome).toBe('timeout');
    expect(padOf(r.world).shown).toBe(false);
    expect(r.world.map.get(BLOCK.tx, BLOCK.ty)).toBe(T.HIDDEN_TELEPORTER);
    expect(r.world.beaming).toBe(false);
  });

  it('small Mario bumps the block from the platform: it appears and the pad rises beside it', () => {
    let at = -1;
    const r = runSim({
      level: sky(),
      character: MARIO,
      script: none,
      start: { x: BLOCK.tx, y: B.top - 1, mode: 'stand' },
      maxFrames: 160,
      controller: (w, f) => {
        if (at < 0 && padOf(w).shown) at = f;
        return f > 2 && f < 20 ? ['jump'] : [];
      },
      until: (w) => padOf(w).active,
    });
    expect(r.outcome).toBe('stopped');
    expect(r.world.map.get(BLOCK.tx, BLOCK.ty)).toBe(T.USED);
    const pad = padOf(r.world);
    expect([pad.zone.x, pad.zone.y]).toEqual([PAD.tx, PAD.ty]);
    expect(toPx(pad.body.y + pad.body.h)).toBe(B.top * 16); // lying on the platform
    expect(at).toBeGreaterThan(0);
    expect(r.world.beaming).toBe(false); // nobody on it
  });

  it('bump → pad → step on: the hero is hidden, a streak rises, then the station loads (clock kept)', () => {
    let beamAt = -1;
    let hiddenInBeam = false;
    let timeAtBeam: number | null = null;
    const r = runSim({
      level: sky(),
      character: MARIO,
      script: none,
      start: { x: BLOCK.tx, y: B.top - 1, mode: 'stand', time: 300 },
      maxFrames: 600,
      controller: (w, f) => {
        if (w.beaming && beamAt < 0) {
          beamAt = f;
          timeAtBeam = w.time;
        }
        if (w.beaming) hiddenInBeam ||= w.player.hidden;
        return bumpAndStep(w, f);
      },
    });
    expect(r.outcome).toBe('pipe');
    expect(beamAt).toBeGreaterThan(0);
    expect(hiddenInBeam).toBe(true);
    expect(r.events.find((e) => e.type === 'pipe')).toMatchObject({ target: TO_STATION });
    // The beam takes a moment (gather, rise off the screen, hold) and the clock stands still.
    expect(r.frames - beamAt).toBeGreaterThan(20);
    expect(r.world.time).toBe(timeAtBeam);
    expect(carryTime(sky(), station(), 280)).toBe(280);
  });

  it('a hero standing where the pad appears is not beamed until he steps off and back on', () => {
    const r = runSim({
      level: sky(),
      character: MARIO,
      script: none,
      start: { x: PAD.tx, y: PAD.ty, mode: 'stand' },
      maxFrames: 120,
      controller: (w) => {
        if (!padOf(w).shown) padOf(w).reveal();
        return [];
      },
    });
    expect(padOf(r.world).active).toBe(true);
    expect(r.outcome).toBe('timeout');
  });

  it('off the end of the clouds without a hop onto the platforms still drops back into 3-1 at 162', () => {
    const r = runSim({
      level: sky(),
      character: MARIO,
      script: none,
      start: { x: 78, y: 12, mode: 'stand' },
      maxFrames: 400,
      controller: () => ['right'],
    });
    expect(r.outcome).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toMatchObject({ target: TO_3_1 });
  });

  it.each(CHARACTERS.map((c) => [c.name, c] as const))(
    '%s hops from the end of the clouds to the platform, bumps the block and beams up from the pad',
    (_name, c) => {
      const s = { hold: 0, mid: 0 };
      const reach = runSim({
        level: sky(),
        character: c,
        script: none,
        start: { x: 78, y: 12, mode: 'stand' },
        maxFrames: 600,
        controller: (w, f) => hopToB(w, f, s),
        until: (w, f) => f > 5 && onB(w),
      });
      expect(reach.outcome, `${c.name} reached B`).toBe('stopped');

      const go = runSim({
        level: sky(),
        character: c,
        script: none,
        start: { x: BLOCK.tx, y: B.top - 1, mode: 'stand' },
        maxFrames: 1200,
        controller: bumpAndStep,
      });
      expect(padOf(go.world).shown, `${c.name} revealed the pad`).toBe(true);
      expect(go.world.map.get(BLOCK.tx, BLOCK.ty)).toBe(T.USED);
      expect(go.outcome, `${c.name} beamed up`).toBe('pipe');
      expect(go.events.find((e) => e.type === 'pipe')).toMatchObject({ target: TO_STATION });
    },
  );
});

describe('the space station (3-1-station)', () => {
  it('beamed down: hidden while the streak falls, then on the arrival pad, not sent straight back', () => {
    let seenHidden = 0;
    const r = runSim({
      level: station(),
      character: MARIO,
      script: none,
      start: { time: 300 },
      maxFrames: 240,
      controller: (w) => {
        if (w.player.hidden) seenHidden++;
        return [];
      },
    });
    expect(seenHidden).toBeGreaterThan(20);
    expect(r.outcome).toBe('timeout');
    expect(r.world.beaming).toBe(false);
    expect(r.world.player.hidden).toBe(false);
    expect(r.world.player.frozen).toBe(false);
    expect(r.world.player.body.onGround).toBe(true);
    expect(Math.floor(centerCol(r.world))).toBe(3);
    expect(r.world.time).toBeLessThanOrEqual(300);
  });

  it('jumping over the return pad, in the air above it, does not beam; landing past it neither', () => {
    let overInAir = 0;
    let beamedInAir = false;
    const r = runSim({
      level: station(),
      character: MARIO,
      script: none,
      start: { x: 40, y: 12, mode: 'stand' },
      maxFrames: 160,
      controller: (w, f) => {
        const p = w.player;
        const pad = w.pads.find((q) => q.tx === 44) as TeleportPad;
        const over = Math.floor(centerCol(w)) === 44;
        if (over && !p.body.onGround) {
          overInAir++;
          beamedInAir ||= w.beaming;
        }
        if (pad.standing(p)) throw new Error(`landed on the pad at frame ${f}`);
        if (centerCol(w) > 45.2) return []; // past it: stop
        return f > 5 && centerCol(w) > 42.3 && p.body.onGround ? ['right', 'jump', 'run'] : ['right', 'run'];
      },
    });
    expect(overInAir).toBeGreaterThan(0);
    expect(beamedInAir).toBe(false);
    expect(r.outcome).toBe('timeout');
    expect(r.world.beaming).toBe(false);
    expect(centerCol(r.world)).toBeGreaterThan(45);
  });

  it('jumping straight up on the arrival pad does not send the hero back down', () => {
    const r = runSim({
      level: station(),
      character: MARIO,
      script: none,
      maxFrames: 300,
      controller: (w, f) => (w.player.frozen ? [] : f % 40 < 15 ? ['jump'] : []),
    });
    expect(r.outcome).toBe('timeout');
    expect(Math.floor(centerCol(r.world))).toBe(3);
  });

  it('two players: each beams down in turn (player 2 a moment later), then both play', () => {
    const shown: number[] = [-1, -1];
    const r = runSim({
      level: station(),
      character: MARIO,
      state: { character2: MARIO, powerState2: 'small' },
      script: none,
      maxFrames: 200,
      controller: (w, f) => {
        w.players.forEach((p, i) => {
          if (shown[i] === -1 && !p.hidden) shown[i] = f;
        });
        return [];
      },
    });
    expect(r.world.players).toHaveLength(2);
    expect(shown[0]).toBeGreaterThan(20);
    expect(shown[1]).toBeGreaterThan(shown[0] as number);
    expect(r.world.beaming).toBe(false);
    expect(r.world.players.every((p) => !p.frozen && !p.hidden)).toBe(true);
  });

  it('stepping off the arrival pad and back on beams down to 3-1 at 162', () => {
    let phase = 0;
    const r = runSim({
      level: station(),
      character: MARIO,
      script: none,
      maxFrames: 600,
      controller: (w) => {
        if (w.player.frozen) return [];
        if (phase === 0 && centerCol(w) > 6) phase = 1;
        return phase === 0 ? ['right'] : ['left'];
      },
    });
    expect(phase).toBe(1);
    expect(r.outcome).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toMatchObject({ target: TO_3_1 });
  });

  it('every hero lands from the beam and crosses the station, past Mega Man, to the return pad', () => {
    for (const c of CHARACTERS) {
      const bot = newBot();
      const r = runSim({
        level: station(),
        character: c,
        script: none,
        maxFrames: 3000,
        controller: (w) => (w.player.frozen ? [] : autoPlayer(w, bot)),
      });
      expect(r.outcome, c.name).toBe('pipe');
      expect(r.playerX, c.name).toBeGreaterThan(43 * 16);
      expect(
        r.events.find((e) => e.type === 'pipe'),
        c.name,
      ).toMatchObject({ target: TO_3_1 });
    }
  });
});

/** File 1 open, then into the station as from the pad in 3-1-sky. */
function intoStation(h: H, time = 300): LevelScene {
  h.game.openFile(1);
  expect(h.top()).toBeInstanceOf(WorldMapScene);
  h.game.startLevel(station(), { mode: 'beam', x: 3, y: 12, time });
  h.step();
  expect(h.top()).toBeInstanceOf(LevelScene);
  return h.top() as LevelScene;
}

/** Put player 1 on the deck at column `col` and let the screen catch up. */
function onDeck(h: H, l: LevelScene, col: number): void {
  const p = l.world.player;
  h.until(() => !p.frozen && !p.hidden, 300);
  for (let x = 8; x <= col; x += 8) {
    p.body.x = px(Math.min(x, col) * 16);
    p.body.y = px(13 * 16) - p.body.h;
    h.idle(20);
  }
}

describe('the whole way: coin heaven → station → 3-1 (campaign play)', () => {
  it('the pad in 3-1-sky beams into the station, and the return pad lands in 3-1 at 162, clock running', () => {
    const h = makeGame();
    file();
    h.game.openFile(1);
    h.game.startLevel(sky(), { mode: 'stand', x: BLOCK.tx, y: B.top - 1, time: 300 });
    h.step();
    let l = h.top() as LevelScene;
    expect(l.level.id).toBe('3-1-sky');
    for (let f = 0; f < 900 && (h.top() as LevelScene).level?.id === '3-1-sky'; f++)
      h.step(bumpAndStep(l.world, f));
    l = h.top() as LevelScene;
    expect(l).toBeInstanceOf(LevelScene);
    expect(l.level.id).toBe('3-1-station');
    expect(l.world.beaming).toBe(true); // arriving by beam
    const arrived = l.world.time as number;
    expect(arrived).toBeLessThanOrEqual(300);
    expect(arrived).toBeGreaterThan(280);
    // Across the deck to the return pad.
    const bot = newBot();
    for (let f = 0; f < 3000 && (h.top() as LevelScene).level?.id === '3-1-station'; f++)
      h.step(l.world.player.frozen ? [] : autoPlayer(l.world, bot));
    const main = h.top() as LevelScene;
    expect(main).toBeInstanceOf(LevelScene);
    expect(main.level.id).toBe('3-1');
    expect(Math.floor(toPx(main.world.player.body.x) / 16)).toBe(162);
    expect(main.world.time).toBeLessThanOrEqual(arrived);
    expect(main.world.time).toBeGreaterThan(arrived - 40);
  });
});

describe('captive Mega Man in the space station', () => {
  it('stands on the command deck; walking over shows TALK', () => {
    const h = makeGame();
    file();
    const l = intoStation(h);
    onDeck(h, l, 34);
    const cs = captives(l);
    expect(cs).toHaveLength(1);
    const c = cs[0] as Captive;
    expect(c.hero.id).toBe('megaman');
    expect(toPx(c.body.y + c.body.h)).toBe(13 * 16);
    expect(toPx(c.body.x + (c.body.w >> 1)) >> 4).toBe(38);
    const p = l.world.player;
    for (let i = 0; i < 120 && !c.prompt; i++) h.step(['right']);
    expect(c.prompt).toBe(true);
    expect(toPx(p.centerX) >> 4).toBeLessThan(44); // short of the return pad
    expect(draw(l).texts.some((t) => t.str === 'TALK')).toBe(true);
    expect(h.said.some((t) => /^Mega Man\. Up to talk\.$/.test(t))).toBe(true);
  });

  it('is there only in campaign play, and only until Mega Man is freed', () => {
    const h0 = makeGame();
    file();
    const l0 = intoStation(h0);
    onDeck(h0, l0, 34);
    expect(captives(l0)).toHaveLength(1);
    const h = makeGame();
    file({ freed: ['mario', 'megaman'] });
    const l = intoStation(h);
    onDeck(h, l, 34);
    expect(captives(l)).toHaveLength(0);
    const h2 = makeGame();
    h2.game.devStart('3-1-station', MARIO, 'small');
    h2.until(() => h2.top() instanceof LevelScene);
    const l2 = h2.top() as LevelScene;
    onDeck(h2, l2, 34);
    expect(captives(l2)).toHaveLength(0);
  });
});

describe("Mega Man's words before the round", () => {
  const def: MiniGameDef = {
    hero: 'megaman',
    title: 'DARK MEGA MAN',
    rules: [],
    create: () => ({ update() {}, render() {} }),
  };
  const megaman = CHARACTERS.find((c) => c.id === 'megaman')!;

  it('the brainwashing is a rogue program in his systems; he names whoever came to talk', () => {
    for (const talker of CHARACTERS) {
      const pages = captiveDialogue(megaman, def, talker);
      for (const page of pages)
        for (const line of page) expect(line.length, `${talker.id}: ${line}`).toBeLessThanOrEqual(CARD_COLS);
      const own = (pages[1] ?? []).join(' ');
      expect(own).toContain('ROGUE PROGRAM');
      expect(own).toContain(`${fontText(talker.name)}...`);
      expect(own).not.toContain('NO ONE PASSES HERE.'); // his own lines, not the generic ones
      expect(pages[0]?.join(' ')).toContain('SERVES');
    }
  });
});
