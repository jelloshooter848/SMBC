import { FOLK } from '@content/town/kakariko';
import type { CharacterDef } from '../characters/character';
import { TdPerson, type PersonOptions } from '../topdown/person';
import { TILE, boxesOverlap, type Dir } from '../topdown/geometry';
import type { Spawner, TopDownWorld } from '../topdown/world';
import type { Page } from '../story/script';
import {
  BARKEEP,
  CHILD,
  FALLEN_LOG,
  GARDENER,
  GARDENER_LINK,
  GUARD_AGAIN,
  GUARD_FIRST,
  HEALER_HEALS,
  HEALER_PLUMBER,
  KID,
  KID_MEGAMAN,
  KID_SAMUS,
  MOTHER,
  oldManPages,
  PATRON,
  PATRON_2,
  SHOP_SIGN,
  STRANGER,
  WEATHERVANE,
  WOMAN,
  wellPage,
} from '../story/kakariko';

/** What a townsperson's words depend on: who is walking the village, and how they play. */
export interface TalkContext {
  hero: CharacterDef;
  /** The hero's name as the font writes it. */
  heroName: string;
  /** The first visit (the guard greets you). */
  firstVisit: boolean;
  /** What the hero-switch button is called right now: TOOLS, or HERO on the touch pad. */
  switchButton: string;
}

/** After the cards: the healer heals. */
export type TalkAfter = 'heal' | null;

interface FolkDef {
  name: string;
  /** Frames on the townsfolk sheet (null: drawn by the tiles). */
  frames: string | null;
  verb?: string;
  across?: boolean;
  pages(ctx: TalkContext): readonly Page[];
  after?: (ctx: TalkContext) => TalkAfter;
}

const plumber = (c: CharacterDef) => c.damage.kind === 'powerup';

/** Every townsperson and thing to read, by FOLK id. */
export const FOLK_DEFS: Readonly<Record<string, FolkDef>> = {
  guard: { name: 'GUARD', frames: 'guard', pages: (c) => (c.firstVisit ? GUARD_FIRST : GUARD_AGAIN) },
  kid: {
    name: 'KID',
    frames: 'kid',
    pages: (c) => (c.hero.id === 'samus' ? KID_SAMUS : c.hero.id === 'megaman' ? KID_MEGAMAN : KID),
  },
  hen: { name: 'HEN', frames: 'hen', pages: () => [] },
  woman: { name: 'WOMAN', frames: 'woman', pages: () => WOMAN },
  gardener: {
    name: 'GARDENER',
    frames: 'gardener',
    pages: (c) => (c.hero.id === 'link' ? GARDENER_LINK : GARDENER),
  },
  'old-man': { name: 'OLD MAN', frames: 'old-man', pages: (c) => oldManPages(c.switchButton) },
  barkeep: { name: 'BARKEEP', frames: 'barkeep', across: true, pages: () => BARKEEP },
  patron: { name: 'PATRON', frames: 'patron', pages: () => PATRON },
  'patron-2': { name: 'PATRON', frames: 'patron-2', pages: () => PATRON_2 },
  error: { name: 'STRANGER', frames: 'stranger', pages: () => STRANGER },
  healer: {
    name: 'HEALER',
    frames: 'healer',
    pages: (c) => (plumber(c.hero) ? HEALER_PLUMBER : HEALER_HEALS),
    after: (c) => (plumber(c.hero) ? null : 'heal'),
  },
  mother: { name: 'MOTHER', frames: 'mother', pages: () => MOTHER },
  child: { name: 'CHILD', frames: 'child', pages: () => CHILD },
  weathervane: { name: 'WEATHERVANE', frames: null, verb: 'READ', pages: () => WEATHERVANE },
  well: { name: 'WELL', frames: null, verb: 'LOOK', pages: (c) => wellPage(c.heroName) },
  log: { name: 'LOG', frames: null, verb: 'LOOK', pages: () => FALLEN_LOG },
  'shop-sign': { name: 'SIGN', frames: null, verb: 'READ', pages: () => SHOP_SIGN },
};

/** A townsperson of the village (TdPerson with their FOLK_DEFS entry). */
export class Townsperson extends TdPerson {
  constructor(
    x: number,
    y: number,
    readonly def: FolkDef,
    opts: PersonOptions,
  ) {
    super(x, y, opts);
  }

  pages(ctx: TalkContext): readonly Page[] {
    return this.def.pages(ctx);
  }

  after(ctx: TalkContext): TalkAfter {
    return this.def.after?.(ctx) ?? null;
  }
}

/** Frames the hen flutters away for after the hero walks into her. */
export const HEN_FLUTTER = 24;

/**
 * The hen: she pecks about her corner of Gate Street, and when the hero walks into her she
 * flutters off a couple of tiles (calmly; nothing in the village can be hurt). She is not
 * solid: the hero never gets stuck on her.
 */
export class Hen extends Townsperson {
  /** Frames left fluttering, and which way. */
  flutterT = 0;
  private dir: Dir = 'right';
  private home: { x: number; y: number };
  private pause = 60;

  constructor(x: number, y: number, def: FolkDef) {
    super(x, y, def, { id: 'hen', name: def.name, frames: def.frames, solid: false });
    this.home = { x, y };
  }

  override talkBox() {
    // Nothing to say: out of reach.
    return { x: -999, y: -999, w: 0, h: 0 };
  }

  override update(world: TopDownWorld): void {
    super.update(world);
    const hero = world.hero.feet();
    if (this.flutterT === 0 && boxesOverlap(hero, this.body())) {
      this.flutterT = HEN_FLUTTER;
      const dx = this.x + 8 - (hero.x + hero.w / 2);
      const dy = this.y + 8 - (hero.y + hero.h / 2);
      this.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
      world.emit({ type: 'hen' });
    }
    if (this.flutterT > 0) {
      this.flutterT--;
      this.step(world, this.dir, 2);
      return;
    }
    // Pecking about: a short walk now and then, never far from home.
    if (--this.pause > 0) return;
    this.pause = 40 + ((this.t * 37) % 50);
    const far = Math.abs(this.x - this.home.x) + Math.abs(this.y - this.home.y) > 2 * TILE;
    const ways: Dir[] = ['left', 'right', 'up', 'down'];
    this.dir = far
      ? Math.abs(this.x - this.home.x) > Math.abs(this.y - this.home.y)
        ? this.x > this.home.x
          ? 'left'
          : 'right'
        : this.y > this.home.y
          ? 'up'
          : 'down'
      : (ways[(this.t >> 3) & 3] as Dir);
    for (let i = 0; i < 8; i++) this.step(world, this.dir, 1);
  }

  private step(world: TopDownWorld, dir: Dir, n: number): void {
    if (dir === 'left' || dir === 'right') this.facing = dir;
    const v = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[dir];
    world.moveEntity(this, (v[0] as number) * n, (v[1] as number) * n, 'walk');
  }

  override frame(view: Parameters<TdPerson['frame']>[0]) {
    if (this.frames === null) return null;
    const flap = this.flutterT > 0 && !view.reduceFlashing ? (this.flutterT >> 2) & 1 : 0;
    const base = this.flutterT > 0 ? `${this.frames}-flap` : `${this.frames}-${Math.floor(this.t / 24) & 1}`;
    return { frame: flap ? `${this.frames}-0` : base, flip: this.facing === 'left' };
  }
}

/**
 * The kid: always a few steps behind the hen, never quite catching her. He stops to talk (and
 * turns to face the hero) when spoken to.
 */
export class Kid extends Townsperson {
  talking = false;

  override update(world: TopDownWorld): void {
    super.update(world);
    if (this.talking) return;
    const hen = world.entities.find((e): e is Hen => e instanceof Hen);
    if (!hen || this.t % 2 !== 0) return;
    const dx = hen.x - this.x;
    const dy = hen.y - this.y;
    if (Math.abs(dx) + Math.abs(dy) < 28) return;
    const mx = Math.sign(dx);
    const my = Math.abs(dy) > 4 ? Math.sign(dy) : 0;
    if (mx !== 0) {
      this.facing = mx < 0 ? 'left' : 'right';
      world.moveEntity(this, mx, 0, 'walk');
    }
    if (my !== 0) world.moveEntity(this, 0, my, 'walk');
  }
}

/** Builds whoever stands at a FOLK spot of the room on screen. */
export const folkSpawner: Spawner = (w, s) => {
  const spot = FOLK.find((f) => f.room === w.room.id && f.col === s.col && f.row === s.row);
  if (!spot) return null;
  const def = FOLK_DEFS[spot.who];
  if (!def) throw new Error(`no townsperson "${spot.who}"`);
  if (spot.who === 'hen') return new Hen(s.x, s.y, def);
  const opts: PersonOptions = {
    id: spot.who,
    name: def.name,
    frames: def.frames,
    ...(def.verb ? { verb: def.verb } : {}),
    ...(def.across ? { across: true } : {}),
  };
  if (spot.who === 'kid') return new Kid(s.x, s.y, def, opts);
  return new Townsperson(s.x, s.y, def, opts);
};
