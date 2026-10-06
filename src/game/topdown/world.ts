import type { InputFrame } from '@engine/input/input-manager';
import { Rng } from '@engine/rng';
import {
  DIR_VEC,
  ROOM_COLS,
  ROOM_H,
  ROOM_ROWS,
  ROOM_W,
  SIDE_DIR,
  TILE,
  boxesOverlap,
  dirToward,
  type Box,
  type Side,
} from './geometry';
import { FloorSwitch, Pickup, PushBlock, TdEnemy, Torch, type TdEntity } from './entity';
import { Bat, Knight, Projectile, Spitter } from './enemies';
import { TdHero } from './hero';
import {
  neighbourCell,
  sideOf,
  tileAt,
  type Cond,
  type Dungeon,
  type Room,
  type Spawn,
  type TileKind,
} from './room';

/**
 * How something moves through tiles. `link`: the hero (open doors and exits let him through, and
 * an open doorway lets him walk off the edge into the next room). `walk`: walking enemies.
 * `fly`: over water, blocks and statues but not walls. `shot`: projectiles (over water).
 * `block`: a push block (only onto open floor).
 */
export type Mover = 'link' | 'walk' | 'fly' | 'shot' | 'block';

export type TdEvent =
  | { type: 'sword' }
  | { type: 'hit'; kind: string }
  | { type: 'kill'; kind: string }
  | { type: 'hurt'; hp: number }
  | { type: 'dying' }
  | { type: 'dead' }
  | { type: 'block' }
  | { type: 'spit' }
  | { type: 'push' }
  | { type: 'switch' }
  | { type: 'torch' }
  | { type: 'pickup'; kind: string }
  | { type: 'unlock'; side: Side }
  | { type: 'met'; cond: Cond }
  | { type: 'shutters'; open: boolean }
  | { type: 'reveal' }
  | { type: 'room'; id: string; first: boolean }
  | { type: 'exit' }
  | { type: string; [k: string]: unknown };

/** What a room remembers between visits (for the whole run). */
export interface RoomState {
  visited: boolean;
  /** Conditions met once (they stay met). */
  met: Set<Cond>;
  /** Locked doorways opened with a key. */
  unlocked: Set<Side>;
  /** Pickups taken, by their room-text cell ("col,row"). */
  taken: Set<string>;
  /** Floor switches pressed (they latch). */
  pressed: Set<string>;
  /** Torches lit. */
  lit: Set<string>;
  /** Where the push blocks ended up once the room's plates were solved (else they reset). */
  blocks: Map<string, { x: number; y: number }> | null;
}

/** Builds an entity for a spawn character; null skips it. */
export type Spawner = (world: TopDownWorld, s: Spawn) => TdEntity | null;

export const DEFAULT_SPAWNERS: Readonly<Record<string, Spawner>> = {
  bat: (_w, s) => new Bat(s.x, s.y),
  knight: (_w, s) => new Knight(s.x, s.y),
  spitter: (_w, s) => new Spitter(s.x, s.y),
  'push-block': (w, s) => {
    const at = w.state().blocks?.get(`${s.col},${s.row}`);
    const b = new PushBlock(at?.x ?? s.x, at?.y ?? s.y);
    if (at) b.fixed = true;
    return b;
  },
  plate: (_w, s) => new FloorSwitch(s.x, s.y, 'plate'),
  switch: (w, s) => {
    const sw = new FloorSwitch(s.x, s.y, 'latch');
    sw.pressed = w.state().pressed.has(`${s.col},${s.row}`);
    return sw;
  },
  torch: (w, s) => new Torch(s.x, s.y, w.state().lit.has(`${s.col},${s.row}`)),
  'torch-lit': (_w, s) => new Torch(s.x, s.y, true),
  key: (w, s) => (w.state().taken.has(`${s.col},${s.row}`) ? null : new Pickup(s.x + 4, s.y, 'key')),
  heart: (w, s) => (w.state().taken.has(`${s.col},${s.row}`) ? null : new Pickup(s.x + 4, s.y + 4, 'heart')),
  'heart-container': (w, s) =>
    w.state().taken.has(`${s.col},${s.row}`) ? null : new Pickup(s.x, s.y, 'heart-container'),
};

/** Pixels per frame the view slides between rooms (Zelda's pace: about a second across). */
export const SLIDE_SPEED = 4;

export interface Transition {
  /** The edge the hero left by. */
  side: Side;
  from: Room;
  t: number;
  frames: number;
}

export interface TdWorldOptions {
  seed?: number;
  /** Extra spawn kinds (a game's own enemies), or replacements for the defaults. */
  spawners?: Readonly<Record<string, Spawner>>;
  /** Hero hit points in half hearts. */
  maxHp?: number;
}

/**
 * A top-down world of one-screen rooms on a grid. Owns the hero, the entities of the room on
 * screen, every room's memory, the keys held and the slide between rooms.
 *
 * Update order (no pause inside; menus are scenes on top):
 *   1. a room slide in progress only advances the slide;
 *   2. the hero (input, sword, walking, pushing, keys on locked doors);
 *   3. every entity (enemies, shots, blocks, switches);
 *   4. contacts: the sword, enemy touch, shots (shield), pickups;
 *   5. the room: conditions met, shutters, hidden pickups, sealing;
 *   6. leaving: exit tiles, a doorway edge starts a slide;
 *   7. dead entities are dropped.
 * Everything random comes from `rng` (seeded), so a run with the same inputs is the same run.
 */
export class TopDownWorld {
  readonly rng: Rng;
  readonly hero: TdHero;
  readonly spawners: Readonly<Record<string, Spawner>>;
  room: Room;
  entities: TdEntity[] = [];
  readonly events: TdEvent[] = [];
  frame = 0;
  keys = 0;
  transition: Transition | null = null;
  /** The hero has stepped in past the doorway: the room's shutters may close. */
  sealed = false;
  /** An exit tile was reached. */
  exited = false;
  private readonly states = new Map<string, RoomState>();
  private shutWas = false;
  /** The room on screen started with enemies in it. */
  private hadEnemies = false;

  constructor(
    readonly dungeon: Dungeon,
    opts: TdWorldOptions = {},
  ) {
    // Mix the seed and skip a few draws: xorshift's first numbers from a small seed are small.
    this.rng = new Rng(Math.imul((opts.seed ?? 0x5eed) ^ 0x9e3779b9, 0x85ebca6b) >>> 0);
    for (let i = 0; i < 8; i++) this.rng.next();
    this.spawners = { ...DEFAULT_SPAWNERS, ...opts.spawners };
    const start = dungeon.rooms.get(dungeon.startRoom) as Room;
    const at = start.start ?? { x: 7 * TILE, y: 5 * TILE };
    this.hero = new TdHero(at.x, at.y, opts.maxHp);
    this.room = start;
    this.enterRoom(start);
  }

  emit(e: TdEvent): void {
    this.events.push(e);
  }

  add(e: TdEntity): void {
    this.entities.push(e);
  }

  /** The memory of a room (the current one by default). */
  state(id = this.room.id): RoomState {
    let s = this.states.get(id);
    if (!s) {
      s = {
        visited: false,
        met: new Set(),
        unlocked: new Set(),
        taken: new Set(),
        pressed: new Set(),
        lit: new Set(),
        blocks: null,
      };
      this.states.set(id, s);
    }
    return s;
  }

  /** Rooms seen so far (for the minimap). */
  visited(): string[] {
    return [...this.states.entries()].filter(([, s]) => s.visited).map(([id]) => id);
  }

  /** Puts the room's things in place: enemies (unless the room was cleared), blocks, pickups. */
  private enterRoom(room: Room): void {
    this.room = room;
    this.entities = [];
    this.sealed = false;
    const st = this.state();
    const first = !st.visited;
    st.visited = true;
    const cleared = st.met.has('clear');
    this.hadEnemies = false;
    for (const s of room.spawns) {
      const make = this.spawners[s.kind];
      if (!make) throw new Error(`room "${room.id}": no spawner for "${s.kind}"`);
      const e = make(this, s);
      if (!e) continue;
      if (e.enemy) this.hadEnemies = true;
      if (e.enemy && cleared) continue;
      e.key = `${s.col},${s.row}`;
      this.entities.push(e);
    }
    this.syncHidden();
    this.shutWas = this.shuttersShut();
    this.emit({ type: 'room', id: room.id, first });
  }

  /** Is the room's condition true right now (or met before)? */
  met(cond: Cond | undefined): boolean {
    if (!cond) return false;
    if (this.state().met.has(cond)) return true;
    return this.metNow(cond);
  }

  private metNow(cond: Cond): boolean {
    const es = this.entities;
    switch (cond) {
      case 'clear':
        return !es.some((e) => e.enemy && !e.dead);
      case 'plates': {
        const plates = es.filter((e): e is FloorSwitch => e instanceof FloorSwitch && e.kind === 'plate');
        return plates.length > 0 && plates.every((p) => p.pressed);
      }
      case 'switches': {
        const sw = es.filter((e): e is FloorSwitch => e instanceof FloorSwitch && e.kind === 'latch');
        return sw.length > 0 && sw.every((p) => p.pressed);
      }
      case 'torches': {
        const t = es.filter((e): e is Torch => e instanceof Torch);
        return t.length > 0 && t.every((p) => p.lit);
      }
    }
  }

  /** Are this room's shutter doors closed right now? */
  shuttersShut(): boolean {
    const cond = this.room.def.shutters;
    return this.sealed && !!cond && !this.met(cond);
  }

  /** Can the hero walk through the doorway on `side` right now? */
  doorOpen(side: Side): boolean {
    const kind = this.room.doors[side];
    if (!kind) return false;
    if (kind === 'open') return true;
    if (kind === 'locked') return this.state().unlocked.has(side);
    return !this.shuttersShut();
  }

  /** Is a tile solid for a mover (`col`/`row` may be outside the room)? */
  private tileSolid(col: number, row: number, mover: Mover): boolean {
    const inside = col >= 0 && row >= 0 && col < ROOM_COLS && row < ROOM_ROWS;
    if (!inside) {
      if (mover !== 'link') return true;
      // Past the edge: open only straight through an open doorway.
      const c = Math.max(0, Math.min(ROOM_COLS - 1, col));
      const r = Math.max(0, Math.min(ROOM_ROWS - 1, row));
      if ((c !== col) === (r !== row)) return true; // a corner beyond the room
      return tileAt(this.room, c, r) !== 'door' || !this.doorOpen(sideOf(c, r) as Side);
    }
    const t = tileAt(this.room, col, row) as TileKind;
    switch (t) {
      case 'floor':
      case 'floor-alt':
      case 'stairs':
        return false;
      case 'wall':
        return true;
      case 'block':
      case 'statue':
        return mover !== 'fly';
      case 'water':
        return mover === 'link' || mover === 'walk' || mover === 'block';
      case 'exit':
        return mover !== 'link';
      case 'door':
        return mover !== 'link' || !this.doorOpen(sideOf(col, row) as Side);
    }
  }

  /** The solid entity (push block, torch) overlapping `box`, other than `self`. */
  solidEntityAt(box: Box, self: TdEntity | null = null): TdEntity | null {
    for (const e of this.entities)
      if (e !== self && e.solid && !e.dead && boxesOverlap(e.body(), box)) return e;
    return null;
  }

  /** Does `box` touch anything solid for this mover (tiles, then solid entities)? */
  blocked(box: Box, mover: Mover, self: TdEntity | null = null): boolean {
    const c0 = Math.floor(box.x / TILE);
    const c1 = Math.floor((box.x + box.w - 1) / TILE);
    const r0 = Math.floor(box.y / TILE);
    const r1 = Math.floor((box.y + box.h - 1) / TILE);
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++) if (this.tileSolid(c, r, mover)) return true;
    if (mover === 'fly') return false;
    return this.solidEntityAt(box, self) !== null;
  }

  /** Moves an entity pixel by pixel; returns false (stopping there) when something solid is in the way. */
  moveEntity(e: TdEntity, dx: number, dy: number, mover: Mover): boolean {
    const n = Math.max(Math.abs(dx), Math.abs(dy));
    const sx = Math.sign(dx);
    const sy = Math.sign(dy);
    for (let i = 0; i < n; i++) {
      const mx = i < Math.abs(dx) ? sx : 0;
      const my = i < Math.abs(dy) ? sy : 0;
      const b = e.body();
      if (this.blocked({ x: b.x + mx, y: b.y + my, w: b.w, h: b.h }, mover, e)) return false;
      e.x += mx;
      e.y += my;
    }
    return true;
  }

  /** The hero bumped `box`: a locked doorway in it opens if a key is held (both sides of it). */
  tryUnlock(box: Box): boolean {
    if (this.keys <= 0) return false;
    const c0 = Math.floor(box.x / TILE);
    const c1 = Math.floor((box.x + box.w - 1) / TILE);
    const r0 = Math.floor(box.y / TILE);
    const r1 = Math.floor((box.y + box.h - 1) / TILE);
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++) {
        if (tileAt(this.room, c, r) !== 'door') continue;
        const side = sideOf(c, r);
        if (!side || this.room.doors[side] !== 'locked' || this.state().unlocked.has(side)) continue;
        this.keys--;
        this.state().unlocked.add(side);
        const [gx, gy] = neighbourCell(this.room, side);
        const next = this.dungeon.roomAt(gx, gy);
        const back = ({ n: 's', s: 'n', e: 'w', w: 'e' } as const)[side];
        if (next?.doors[back] === 'locked') this.state(next.id).unlocked.add(back);
        this.emit({ type: 'unlock', side });
        return true;
      }
    return false;
  }

  /** Shows the room's hidden pickups once its `reveal` condition is met (hides them before). */
  private syncHidden(): boolean {
    const cond = this.room.def.reveal;
    const hide = !!cond && !this.met(cond);
    let shown = false;
    for (const e of this.entities)
      if (e instanceof Pickup && e.key !== null) {
        if (e.hidden && !hide) shown = true;
        e.hidden = hide;
      }
    return shown;
  }

  update(input: InputFrame): void {
    this.frame++;
    if (this.transition) {
      if (++this.transition.t >= this.transition.frames) this.transition = null;
      return;
    }
    const hero = this.hero;
    hero.update(this, input);
    for (const e of [...this.entities]) if (!e.dead) e.update(this);
    if (!hero.dying) this.contacts();
    this.roomLogic();
    if (!hero.dying) this.leaving();
    this.entities = this.entities.filter((e) => !e.dead);
  }

  private contacts(): void {
    const hero = this.hero;
    const sword = hero.swordBox();
    const hb = hero.hurtbox();
    for (const e of this.entities) {
      if (e.dead) continue;
      if (sword && boxesOverlap(sword, e.hurtbox()) && e.onSword(this, hero.facing)) {
        if (e instanceof Torch) this.state().lit.add(e.key ?? '');
      }
      if (e.dead) continue;
      if (e instanceof TdEnemy && e.contact > 0 && boxesOverlap(hb, e.hurtbox()))
        hero.hurt(this, e.contact, dirToward(e.hurtbox(), hb));
      else if (e instanceof Projectile && e.hostile && boxesOverlap(hb, e.hurtbox())) {
        e.dead = true;
        if (e.blockable && hero.shieldBlocks(e.dir)) this.emit({ type: 'block' });
        else hero.hurt(this, e.damage, e.dir ?? dirToward(e.hurtbox(), hb));
      } else if (e instanceof Pickup && !e.hidden && boxesOverlap(hb, e.hurtbox())) {
        e.dead = true;
        if (e.key) this.state().taken.add(e.key);
        if (e.kind === 'key') this.keys++;
        else if (e.kind === 'heart') hero.heal(2);
        else hero.heal(hero.maxHp);
        this.emit({ type: 'pickup', kind: e.kind });
      }
    }
  }

  private roomLogic(): void {
    const st = this.state();
    for (const e of this.entities)
      if (e instanceof FloorSwitch && e.kind === 'latch' && e.pressed && e.key) st.pressed.add(e.key);
    for (const cond of ['clear', 'plates', 'switches', 'torches'] as const) {
      if (st.met.has(cond) || !this.metNow(cond)) continue;
      const used = this.room.def.shutters === cond || this.room.def.reveal === cond;
      // 'clear' is remembered for every room that had enemies (they stay gone).
      const had = cond === 'clear' && this.hadEnemies;
      if (!used && !had) continue;
      st.met.add(cond);
      if (cond === 'plates') {
        // Solved: the blocks stay where they are from now on.
        st.blocks = new Map();
        for (const e of this.entities)
          if (e instanceof PushBlock && e.key) {
            e.fixed = true;
            st.blocks.set(e.key, { x: e.x, y: e.y });
          }
      }
      this.emit({ type: 'met', cond });
    }
    if (this.syncHidden()) this.emit({ type: 'reveal' });
    if (!this.sealed) {
      const f = this.hero.feet();
      if (f.x >= TILE && f.y >= TILE && f.x + f.w <= ROOM_W - TILE && f.y + f.h <= ROOM_H - TILE)
        this.sealed = true;
    }
    const shut = this.shuttersShut();
    if (shut !== this.shutWas && Object.values(this.room.doors).includes('shutter'))
      this.emit({ type: 'shutters', open: !shut });
    this.shutWas = shut;
  }

  private leaving(): void {
    const hero = this.hero;
    const f = hero.feet();
    if (!this.exited) {
      const c0 = Math.floor(f.x / TILE);
      const c1 = Math.floor((f.x + f.w - 1) / TILE);
      const r0 = Math.floor(f.y / TILE);
      const r1 = Math.floor((f.y + f.h - 1) / TILE);
      for (let r = r0; r <= r1; r++)
        for (let c = c0; c <= c1; c++)
          if (tileAt(this.room, c, r) === 'exit' && !this.exited) {
            this.exited = true;
            this.emit({ type: 'exit' });
          }
    }
    let side: Side | null = null;
    if (hero.x < -4) side = 'w';
    else if (hero.x > ROOM_W - 12) side = 'e';
    else if (hero.y < -4) side = 'n';
    else if (hero.y > ROOM_H - 12) side = 's';
    if (side) this.slide(side);
  }

  /** Starts the slide to the room past `side` and puts the hero in its doorway. */
  private slide(side: Side): void {
    const [gx, gy] = neighbourCell(this.room, side);
    const next = this.dungeon.roomAt(gx, gy);
    if (!next) return;
    const from = this.room;
    const hero = this.hero;
    if (side === 'w') hero.x = ROOM_W - TILE;
    else if (side === 'e') hero.x = 0;
    else if (side === 'n') hero.y = ROOM_H - TILE;
    else hero.y = 0;
    hero.facing = SIDE_DIR[side];
    hero.attackT = 0;
    hero.kbT = 0;
    const v = DIR_VEC[SIDE_DIR[side]];
    const frames = Math.round((v.dx !== 0 ? ROOM_W : ROOM_H) / SLIDE_SPEED);
    this.enterRoom(next);
    this.transition = { side, from, t: 0, frames };
  }

  /** Puts the hero straight into a room at (x, y), no slide (tests, dev tools). */
  warpTo(id: string, x: number, y: number): void {
    const room = this.dungeon.rooms.get(id);
    if (!room) throw new Error(`no room "${id}"`);
    this.transition = null;
    this.hero.x = x;
    this.hero.y = y;
    this.enterRoom(room);
  }

  /** Living enemies in the room. */
  enemies(): TdEnemy[] {
    return this.entities.filter((e): e is TdEnemy => e instanceof TdEnemy && !e.dead);
  }
}
