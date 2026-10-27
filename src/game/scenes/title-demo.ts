import type { Action } from '@engine/input/actions';
import type { Renderer } from '@engine/gfx/renderer';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { px, tileAt, toPx } from '@engine/math/units';
import { getLevel } from '@content/levels';
import { World } from '../world/world';
import { Player } from '../entities/player';
import { ScriptedInput, type InputScript } from '../sim/headless';
import { DEFAULT_ASSIST, newGameState, type GameContext } from '../context';
import type { CharacterDef } from '../characters/character';
import { CHARACTERS, CLASSIC_EXTRAS, heroFor } from '../characters/registry';
import { MARIO } from '../characters/mario';

/**
 * The CLASSIC title's live demo (O-04; TitleLevel.as): SMB 1-1 with the HUD hidden. Mario waits
 * MARIO_WAIT frames, then runs right and jumps by himself; nine more heroes stand powered up
 * along the level and, as the screen reaches each one, play their own recorded moves. Nobody
 * takes damage, no one takes a pipe or a door, and at the level's end the demo starts again.
 * The demo reads no player input at all: the title scene above it owns every press.
 */

/**
 * Mario's wait before he runs, 60 frames (1 s), on every run of the demo; the prompt blinks from
 * then. v0.4.77 item 179 (owner deviation): TitleLevel.as MARIO_WAIT_TMR_DEL is 5000 ms.
 */
export const MARIO_WAIT = 60;
/**
 * A hero wakes when the screen's right edge comes within this many px of his spot
 * (TitleLevel.as gameLoop: `locStgRht + 20 > activatePnt.x`, 20 stage px = 10 of ours).
 */
export const WAKE_AHEAD = 10;
/** A demo that has not reached the flag by now starts again anyway (a stuck run never hangs). */
export const DEMO_MAX_FRAMES = 60 * 150;

/** One demo hero: who, where his feet stand (screen px in the level), and his moves. */
export interface DemoHero {
  id: string;
  /** Centre x and feet y, level px: TitleLevel.as IND_START_POS halved (its stage is 2x ours). */
  x: number;
  y: number;
  /**
   * Our own recording (never the original's): from the frame he wakes, each step holds its
   * actions until the next. Its first move and its last release fall on the original's frames
   * (DEMO_TIMING), so each hero acts for as long as he did there.
   */
  script: InputScript['steps'];
}

const S = (frame: number, ...hold: Action[]) => ({ frame, hold });

/**
 * The original's timing per hero, in frames at 60 per second: when his first move comes after
 * he wakes, and when his last release does (TitleLevel.as IND_SEQ, delays summed). Our scripts
 * keep both; what happens between is ours.
 */
export const DEMO_TIMING: Readonly<Record<string, { first: number; last: number }>> = {
  bass: { first: 90, last: 296 },
  bill: { first: 240, last: 844 },
  link: { first: 66, last: 319 },
  luigi: { first: 90, last: 247 },
  megaman: { first: 0, last: 296 },
  ryu: { first: 0, last: 362 },
  samus: { first: 12, last: 510 },
  simon: { first: 150, last: 560 },
  sophia: { first: 72, last: 484 },
};

/** The nine heroes along 1-1, left to right (TitleLevel.as STATIC_DATA_DCT's spots). */
export const DEMO_HEROES: readonly DemoHero[] = [
  {
    // Drops in over the first blocks and shows off his buster.
    id: 'megaman',
    x: 283,
    y: 80,
    script: [
      S(0, 'left'),
      S(36, 'right'),
      S(60),
      S(78, 'attack'),
      S(84),
      S(92, 'attack'),
      S(98),
      S(112, 'right', 'attack'),
      S(150, 'right'),
      S(196, 'right', 'jump'),
      S(212, 'left'),
      S(240, 'left', 'jump'),
      S(262, 'left'),
      S(272, 'left', 'jump'),
      S(290, 'left'),
      S(296),
    ],
  },
  {
    // Between the pipes: a hop, his shots ahead, then a jump back.
    id: 'bass',
    x: 547,
    y: 208,
    script: [
      S(0),
      S(90, 'right'),
      S(110, 'right', 'jump'),
      S(136, 'right'),
      S(154, 'attack'),
      S(162),
      S(176, 'attack'),
      S(184),
      S(228, 'left'),
      S(236, 'left', 'jump'),
      S(288, 'left'),
      S(296),
    ],
  },
  {
    // On top of the third pipe: off it with a slash, then his tool, then back up.
    id: 'link',
    x: 757,
    y: 144,
    script: [
      S(0),
      S(66, 'right', 'jump'),
      S(86, 'right'),
      S(104, 'attack'),
      S(112),
      S(162, 'right'),
      S(176),
      S(182, 'left'),
      S(188, 'special'),
      S(196),
      S(236, 'left'),
      S(248, 'left', 'jump'),
      S(286, 'left'),
      S(319),
    ],
  },
  {
    // Before the first pit: a high jump and a fireball on the way back.
    id: 'luigi',
    x: 1033,
    y: 208,
    script: [
      S(0),
      S(90, 'jump'),
      S(118),
      S(146, 'left'),
      S(178, 'left', 'attack'),
      S(194, 'left', 'attack', 'jump'),
      S(206, 'attack', 'jump'),
      S(216, 'left', 'attack', 'jump'),
      S(236, 'attack'),
      S(247),
    ],
  },
  {
    // Over the first pit: his whip, then his sub-weapon three times.
    id: 'simon',
    x: 1077,
    y: 208,
    script: [
      S(0),
      S(150, 'right'),
      S(164, 'right', 'jump'),
      S(174, 'right'),
      S(220, 'right', 'jump'),
      S(228, 'right'),
      S(236, 'attack'),
      S(248),
      S(284, 'special'),
      S(292),
      S(326, 'special'),
      S(336),
      S(378, 'special'),
      S(388),
      S(474, 'left'),
      S(516, 'left', 'jump'),
      S(526, 'left'),
      S(560),
    ],
  },
  {
    // At the edge of the second pit: over it, up the far side, a pair of stars.
    id: 'ryu',
    x: 1366,
    y: 208,
    script: [
      S(0, 'left'),
      S(2),
      S(30, 'right'),
      S(36, 'right', 'jump'),
      S(64, 'right'),
      S(102),
      S(106, 'right', 'up'),
      S(128),
      S(182, 'special'),
      S(190),
      S(242, 'special'),
      S(252),
      S(292, 'left', 'up', 'jump'),
      S(304, 'left', 'up'),
      S(330, 'left', 'up', 'jump'),
      S(340, 'left'),
      S(362),
    ],
  },
  {
    // On the bricks: crouch, beams both ways, up and a run.
    id: 'samus',
    x: 1624,
    y: 144,
    script: [
      S(0),
      S(12, 'down'),
      S(20),
      S(28, 'down'),
      S(36, 'attack'),
      S(44),
      S(50, 'left', 'attack'),
      S(66),
      S(72, 'up', 'right'),
      S(84),
      S(92, 'jump'),
      S(112, 'jump', 'right'),
      S(120, 'right'),
      S(152, 'right'),
      S(198, 'right', 'up'),
      S(214, 'right', 'up', 'attack'),
      S(222, 'right', 'up'),
      S(250, 'right', 'up', 'attack'),
      S(260, 'right', 'up'),
      S(292, 'right', 'up', 'attack'),
      S(300, 'right', 'up'),
      S(324, 'left', 'up'),
      S(330, 'left'),
      S(510),
    ],
  },
  {
    // The tank: a burst of shots, a hop and a jump.
    id: 'sophia',
    x: 1904,
    y: 208,
    script: [
      S(0),
      ...[72, 86, 100, 114, 128].flatMap((f) => [S(f, 'attack'), S(f + 6)]),
      S(146, 'right'),
      ...[188, 202, 216, 230].flatMap((f) => [S(f, 'right', 'attack'), S(f + 6, 'right')]),
      S(254, 'right', 'jump'),
      S(272, 'right'),
      S(290),
      S(300, 'left'),
      S(326, 'left', 'jump'),
      S(346, 'left'),
      S(364, 'right'),
      S(376),
      S(382, 'left'),
      S(406, 'left', 'jump'),
      S(464, 'left'),
      S(484),
    ],
  },
  {
    // Past the stairs: a run with jumps, then rapid fire, low and high.
    id: 'bill',
    x: 2316,
    y: 208,
    script: [
      S(0),
      S(240, 'right'),
      S(270, 'right', 'jump'),
      S(292, 'right'),
      S(340, 'right', 'jump'),
      S(350, 'right'),
      S(444, 'right', 'jump'),
      S(452, 'right'),
      S(534, 'down'),
      ...[562, 572, 582, 592, 602, 612, 622, 632].flatMap((f) => [S(f, 'down', 'attack'), S(f + 5, 'down')]),
      S(664),
      S(670, 'right'),
      S(680, 'right', 'up'),
      ...[688, 698, 708, 718].flatMap((f) => [S(f, 'up', 'attack'), S(f + 5, 'up')]),
      ...[728, 740, 752, 764, 776, 788].flatMap((f) => [S(f, 'left', 'up', 'attack'), S(f + 6, 'up')]),
      S(806, 'left', 'up'),
      S(810, 'left'),
      S(834, 'left', 'jump'),
      S(844),
    ],
  },
];

/** The look a demo hero plays as: his Classic def (Bass is a Classic-only hero). */
export function demoDef(id: string): CharacterDef {
  const roster = CHARACTERS.find((c) => c.id === id);
  if (roster) return heroFor(roster, 'classic');
  return CLASSIC_EXTRAS.find((c) => c.id === id) ?? heroFor(MARIO, 'classic');
}

/** A hero's powered-up state (TITLE_SCREEN_UPGRADES: MUSHROOM): big, or full hit points. */
function poweredUp(def: CharacterDef): { power: string; hp: number } {
  if (def.damage.kind === 'hp') return { power: 'full', hp: def.damage.max };
  const states = def.damage.kind === 'powerup' ? def.damage.states : [];
  return { power: states.includes('big') ? 'big' : (states[0] ?? 'small'), hp: 0 };
}

interface Waiting {
  hero: DemoHero;
  p: Player;
  input: ScriptedInput;
  awake: boolean;
  /** Out of the demo: fallen, or left behind by the screen. */
  gone: boolean;
}

/** A demo heroes' every step as one more frame of their own scripts (held actions only). */
export class ClassicDemo {
  world!: World;
  /** Frames since this run of the demo started. */
  t = 0;
  /** Times the demo has started again (the loop). */
  loops = 0;
  private heroes: Waiting[] = [];
  private mario = new ScriptedInput({ steps: [] });
  /** Mario holds jump until he lands (TitleLevel.checkForJump releases it on the ground). */
  private holdJump = false;
  private readonly ctx: GameContext;

  constructor(base: GameContext) {
    // The demo's own context: Classic rules, the original's options, no damage, no clock, and
    // silent (the title's own music and menu sounds play over it).
    this.ctx = {
      assets: base.assets,
      audio: NULL_AUDIO,
      assist: { ...DEFAULT_ASSIST, invulnerable: true, infiniteTime: true, infiniteLives: true },
      get reduceFlashing() {
        return base.reduceFlashing;
      },
      rules: 'classic',
      mapDifficulty: 'normal',
    };
    this.restart();
  }

  /** Every hero's Player in this run (Mario first), awake or not. */
  get players(): Player[] {
    return [this.world.player, ...this.heroes.map((h) => h.p)];
  }

  /** The heroes the screen has reached so far (their scripts running). */
  get awake(): string[] {
    return this.heroes.filter((h) => h.awake).map((h) => h.hero.id);
  }

  /** Start (again) from the beginning of 1-1 (TitleLevel.completeLevel: a new TitleLevel). */
  restart(): void {
    const state = newGameState(MARIO, null, 'classic');
    state.powerState = 'small';
    this.world = new World(getLevel('1-1'), this.ctx, state, { demo: true, rules: 'classic' });
    this.heroes = DEMO_HEROES.map((hero) => {
      const def = demoDef(hero.id);
      const { power, hp } = poweredUp(def);
      const tmp = new Player(0, 0, def, power, hp);
      const hb = def.hitbox(tmp);
      const p = new Player(px(hero.x) - px(hb.w >> 1), px(hero.y) - px(hb.h), def, power, hp);
      p.profile = { ...def.movement, coyoteFrames: 0 };
      p.classicOptions = this.world.classic;
      // Facing Mario, as they stand waiting.
      p.facing = -1;
      return { hero, p, input: new ScriptedInput({ steps: hero.script }), awake: false, gone: false };
    });
    this.t = 0;
    this.holdJump = false;
    this.mario = new ScriptedInput({ steps: [] });
  }

  /** One frame. */
  update(): void {
    this.t++;
    const w = this.world;
    // Mario: still for MARIO_WAIT, then right, jumping walls and gaps by himself.
    this.mario.setHeld(this.t > MARIO_WAIT ? this.marioHold() : []);
    this.mario.next();
    const right = toPx(w.camera.x) + 256 + WAKE_AHEAD;
    for (const h of this.heroes) {
      if (!h.awake && right > h.hero.x) {
        h.awake = true;
        h.p.index = 0; // no player-two tag over them
        w.players.push(h.p);
      }
    }
    // World.players is Mario then the awake heroes still in play, each with his own script.
    const inputs = w.players.map((p) => (p === w.player ? this.mario : this.byPlayer(p)));
    for (const i of inputs.slice(1)) i.next();
    w.update(inputs);
    // A hero who fell, or whom the screen left behind, leaves the demo (off the stage, as the
    // original's are once out of sight).
    const left = w.camera.x - px(48);
    for (let i = w.players.length - 1; i > 0; i--) {
      const p = w.players[i] as Player;
      if (p.dead || p.body.x + p.body.w < left || toPx(p.body.y) > 240) {
        w.players.splice(i, 1);
        const h = this.heroes.find((x) => x.p === p);
        if (h) h.gone = true;
      }
    }
    const ended = w.events.splice(0).some((e) => e.type === 'exit' || e.type === 'died');
    if (ended || w.player.dead || this.t > DEMO_MAX_FRAMES) {
      this.loops++;
      this.restart();
    }
  }

  private byPlayer(p: Player): ScriptedInput {
    return this.heroes.find((h) => h.p === p)?.input ?? this.mario;
  }

  /** TitleLevel.checkForJump, in our tiles: a wall or a gap ahead starts a full jump. */
  private marioHold(): Action[] {
    const w = this.world;
    const b = w.player.body;
    if (!b.onGround) return this.holdJump ? ['right', 'jump'] : ['right'];
    if (this.holdJump) {
      this.holdJump = false;
      return ['right'];
    }
    const col = tileAt(b.x + b.w);
    const feet = tileAt(b.y + b.h - 1);
    const wall = w.map.isSolid(col + 1, feet) || w.map.isSolid(col + 1, feet - 1) || w.map.isSolid(col, feet);
    const below = (c: number) => {
      for (let r = feet + 1; r < w.map.height; r++) {
        const k = w.map.collisionAt(c, r);
        if (k === 'solid' || k === 'top') return true;
      }
      return false;
    };
    const gap = !below(col + 1);
    if (wall || gap) {
      this.holdJump = true;
      return ['right', 'jump'];
    }
    return ['right'];
  }

  /** The level and every hero, the sleepers standing where they wait (no HUD: TitleLevel.as:221). */
  render(r: Renderer): void {
    this.world.render(r);
    const camX = this.world.camera.pxX;
    const assets = this.ctx.assets;
    for (const h of this.heroes) {
      if (h.awake) continue;
      const p = h.p;
      const x0 = toPx(p.body.x) - camX;
      if (x0 > 256 + 32 || x0 < -48) continue;
      const s = p.def.sprite(p, this.world.frame, this.ctx.reduceFlashing);
      const sheet = assets.sheet(s.sheet, s.palette);
      const f = sheet.frames.get(s.frame);
      const fw = f?.w ?? 16;
      const bw = toPx(p.body.w);
      const x = x0 - (s.flip ? fw - bw - s.offsetX : s.offsetX);
      r.sprite(sheet, s.frame, x, toPx(p.body.y) - s.offsetY, s.flip);
    }
  }
}
