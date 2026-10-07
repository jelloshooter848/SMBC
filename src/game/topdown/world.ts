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
  type Dir,
  type Side,
} from './geometry';
import { Chest, FloorSwitch, Pickup, PushBlock, TdEnemy, Torch, type TdEntity } from './entity';
import { DEFAULT_ITEMS, Inventory, circleHits, type TdItem } from './items';
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
 * How something moves through tiles. `hero`: the player (open doors and exits let him through, and
 * an open doorway lets him walk off the edge into the next room). `walk`: walking enemies.
 * `fly`: over water, blocks and statues but not walls. `shot`: projectiles (over water).
 * `block`: a push block (only onto open floor).
 */
export type Mover = 'hero' | 'walk' | 'fly' | 'shot' | 'block';

export type TdEvent =
  | { type: 'sword' }
  | { type: 'beam' }
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
  | { type: 'item'; id: string }
  | { type: 'item-select'; id: string }
  | { type: 'chest'; item: string }
  | { type: 'stun'; kind: string }
  | { type: 'secret' }
  | { type: 'bomb' }
  | { type: 'fuse' }
  | { type: 'blast' }
  | { type: 'whirr' }
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
  /** Cracked walls blown open: doorway sides ('n', 'e', ...) and inner cells ("col,row"). */
  blasted: Set<string>;
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
  refill: (w, s) => (w.state().taken.has(`${s.col},${s.row}`) ? null : new Pickup(s.x, s.y, 'refill')),
  map: (w, s) => (w.state().taken.has(`${s.col},${s.row}`) ? null : new Pickup(s.x + 4, s.y, 'map')),
  compass: (w, s) => (w.state().taken.has(`${s.col},${s.row}`) ? null : new Pickup(s.x, s.y, 'compass')),
  chest: (w, s) => {
    const chests = w.room.spawns.filter((c) => c.kind === 'chest');
    const contents = w.room.def.chests?.[chests.indexOf(s)] ?? 'heart';
    return new Chest(s.x, s.y, contents, w.state().taken.has(`${s.col},${s.row}`));
  },
};

/** Chance that a monster with no heart for the hero leaves ammo for an item he owns. */
export const AMMO_DROP = 0.25;

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
  /** The items there are (the kit's boomerang and bombs by default). */
  items?: Readonly<Record<string, TdItem>>;
  /** Does the hero start with a shield (default yes)? */
  shield?: boolean;
  /** Asked whenever the hero is hurt: true keeps his hearts (a no-damage assist). */
  noDamage?: () => boolean;
  /** Does a stab at full hearts also throw a sword beam (beam.ts; default no)? */
  swordBeam?: boolean;
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
  readonly items: Readonly<Record<string, TdItem>>;
  /** The hero's items, the one in the slot and ammo. */
  readonly inv: Inventory;
  /** True keeps the hero's hearts when he is hurt (asked each time, so it can change mid-run). */
  readonly noDamage: () => boolean;
  /** A stab at full hearts also throws a sword beam (TdHero.beamReady). */
  readonly swordBeam: boolean;
  room: Room;
  entities: TdEntity[] = [];
  readonly events: TdEvent[] = [];
  frame = 0;
  keys = 0;
  /** The dungeon's treasures found: its map, its compass (and a game's own, e.g. a Triforce). */
  readonly found = new Set<string>();
  transition: Transition | null = null;
  /**
   * After a slide the hero walks himself in through the doorway, as Link does in a Zelda
   * dungeon: the way he walks and the spot just past the wall where he stops (pad ignored).
   */
  walkIn: { dir: Dir; x: number; y: number } | null = null;
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
    this.items = opts.items ?? DEFAULT_ITEMS;
    this.inv = new Inventory(this.items);
    this.noDamage = opts.noDamage ?? (() => false);
    this.swordBeam = opts.swordBeam ?? false;
    const start = dungeon.rooms.get(dungeon.startRoom) as Room;
    const at = start.start ?? { x: 7 * TILE, y: 5 * TILE };
    this.hero = new TdHero(at.x, at.y, opts.maxHp);
    this.hero.shield = opts.shield ?? true;
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
        blasted: new Set(),
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
    if (kind === 'cracked') return this.state().blasted.has(side);
    return !this.shuttersShut();
  }

  /** Is a tile solid for a mover (`col`/`row` may be outside the room)? */
  private tileSolid(col: number, row: number, mover: Mover): boolean {
    const inside = col >= 0 && row >= 0 && col < ROOM_COLS && row < ROOM_ROWS;
    if (!inside) {
      if (mover !== 'hero') return true;
      // Past the edge: open only straight through an open doorway.
      const c = Math.max(0, Math.min(ROOM_COLS - 1, col));
      const r = Math.max(0, Math.min(ROOM_ROWS - 1, row));
      if ((c !== col) === (r !== row)) return true; // a corner beyond the room
      return tileAt(this.room, c, r) !== 'door' || !this.doorOpen(sideOf(c, r, this.room.wall) as Side);
    }
    const t = tileAt(this.room, col, row) as TileKind;
    switch (t) {
      case 'floor':
      case 'floor-alt':
      case 'stairs':
        return false;
      case 'wall':
        return true;
      case 'cracked':
        return !this.state().blasted.has(`${col},${row}`);
      case 'block':
      case 'statue':
        return mover !== 'fly';
      case 'water':
        return mover === 'hero' || mover === 'walk' || mover === 'block';
      case 'exit':
        return mover !== 'hero';
      case 'door':
        return mover !== 'hero' || !this.doorOpen(sideOf(col, row, this.room.wall) as Side);
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
    if (mover === 'hero' && this.inDoorJamb(box)) return true;
    if (mover === 'fly') return false;
    return this.solidEntityAt(box, self) !== null;
  }

  /**
   * A two-cell north or south doorway is drawn as one 16-px door centred across its cells: the
   * outer 8 px of each cell are its jambs, solid to the hero (all the way through the wall).
   */
  private inDoorJamb(box: Box): boolean {
    const wall = this.room.wall * TILE;
    for (const side of ['n', 's'] as const) {
      const cells = this.room.doorCells[side];
      if (!cells || cells.length !== 2) continue;
      const top = side === 'n' ? -Infinity : ROOM_H - wall;
      const bottom = side === 'n' ? wall : Infinity;
      if (box.y + box.h <= top || box.y >= bottom) continue;
      const left = (cells[0] as number) * TILE;
      const right = left + 2 * TILE;
      if (box.x + box.w <= left || box.x >= right) continue;
      if (box.x < left + TILE / 2 || box.x + box.w > right - TILE / 2) return true;
    }
    return false;
  }

  /**
   * `box` if the hero could stand on it, else the same box centred in the nearest tile (by
   * distance from its centre) that the hero can walk onto.
   */
  openSpotNear(box: Box): { x: number; y: number } {
    if (!this.blocked(box, 'hero')) return { x: box.x, y: box.y };
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    let best: { x: number; y: number; d: number } | null = null;
    const wall = this.room.wall;
    for (let row = wall; row < ROOM_ROWS - wall; row++)
      for (let col = wall; col < ROOM_COLS - wall; col++) {
        const x = col * TILE + (TILE - box.w) / 2;
        const y = row * TILE + (TILE - box.h) / 2;
        if (this.blocked({ x, y, w: box.w, h: box.h }, 'hero')) continue;
        const d = (x + box.w / 2 - cx) ** 2 + (y + box.h / 2 - cy) ** 2;
        if (!best || d < best.d) best = { x, y, d };
      }
    return best ?? { x: box.x, y: box.y };
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
        const side = sideOf(c, r, this.room.wall);
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

  /** Is the hero walking himself in from a doorway (the pad does nothing meanwhile)? */
  get walkingIn(): boolean {
    return this.walkIn !== null;
  }

  update(input: InputFrame): void {
    this.frame++;
    if (this.transition) {
      if (++this.transition.t >= this.transition.frames) this.transition = null;
      return;
    }
    const hero = this.hero;
    if (this.walkIn) {
      const w = this.walkIn;
      if (!hero.walkInStep(this, w.dir, w.x, w.y) || hero.kbT > 0 || hero.dying) this.walkIn = null;
    } else hero.update(this, input);
    if (hero.holdT > 0) return; // holding up a prize: the room waits
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
      // The blade wins ties: a monster it touches this frame does no touch damage.
      const bladed = !!sword && boxesOverlap(sword, e.hurtbox());
      if (bladed && e.onSword(this, hero.facing)) {
        if (e instanceof Torch) this.state().lit.add(e.key ?? '');
      }
      if (e.dead) continue;
      if (e instanceof TdEnemy && e.contact > 0 && !bladed && boxesOverlap(hb, e.hurtbox()))
        hero.hurt(this, hero.contactDamage(e.contact), dirToward(e.hurtbox(), hb));
      else if (e instanceof Projectile && e.hostile && boxesOverlap(hb, e.hurtbox())) {
        e.dead = true;
        if (e.blockable && hero.shieldBlocks(e.heading())) this.emit({ type: 'block' });
        else hero.hurt(this, e.damage, e.dir ?? dirToward(e.hurtbox(), hb));
      } else if (e instanceof Pickup && !e.hidden && boxesOverlap(hb, e.hurtbox())) this.collect(e);
    }
  }

  /** The hero (or his boomerang) takes a pickup. */
  collect(p: Pickup): void {
    if (p.dead || p.hidden) return;
    p.dead = true;
    if (p.key) this.state().taken.add(p.key);
    this.grant(p.kind);
  }

  /**
   * Gives the hero something (see PickupKind): a heart, a key, a heart container (one more
   * heart, all refilled), a refill, the shield, the dungeon's map or compass (or a Triforce),
   * an item's ammo, or an item. Emits 'pickup'.
   */
  grant(what: string): void {
    const hero = this.hero;
    switch (what) {
      case 'heart':
        hero.heal(2);
        break;
      case 'key':
        this.keys++;
        break;
      case 'heart-container':
        hero.maxHp += 2;
        hero.heal(hero.maxHp);
        break;
      case 'refill':
        hero.heal(hero.maxHp);
        break;
      case 'shield':
        hero.shield = true;
        break;
      case 'map':
      case 'compass':
      case 'triforce':
        this.found.add(what);
        break;
      default: {
        const ammo = Object.values(this.items).find((i) => i.ammo?.pickup === what);
        if (ammo?.ammo) this.inv.addAmmo(ammo.id, ammo.ammo.refill);
        else this.inv.give(what);
      }
    }
    this.emit({ type: 'pickup', kind: what });
  }

  /** What a dying monster leaves (seeded): a heart by its chance, else maybe ammo for an owned item. */
  lootFor(heartChance: number): string | null {
    if (heartChance <= 0) return null;
    if (this.rng.chance(heartChance)) return 'heart';
    const ammo = this.inv.withAmmo();
    if (ammo.length === 0 || !this.rng.chance(AMMO_DROP)) return null;
    return this.rng.pick(ammo).ammo?.pickup ?? null;
  }

  /** Can the item in the slot be used right now (owned, ammo left, `ready`)? */
  itemUsable(): boolean {
    const it = this.inv.current;
    if (!it) return false;
    if (it.ammo && this.inv.count(it.id) <= 0) return false;
    return !it.ready || it.ready(this);
  }

  /** Uses the item in the slot (SPECIAL); spends its ammo. True if it was used. */
  useItem(): boolean {
    const it = this.inv.current;
    if (!it || !this.itemUsable() || !it.use(this)) return false;
    if (it.ammo) this.inv.addAmmo(it.id, -1);
    this.emit({ type: 'item', id: it.id });
    return true;
  }

  /** Moves the item slot to the next owned item (SELECT). */
  cycleItem(): boolean {
    if (!this.inv.cycle()) return false;
    this.emit({ type: 'item-select', id: this.inv.current?.id ?? '' });
    return true;
  }

  /**
   * A blast at (cx, cy): monsters within `radius` take `damage`, the hero `selfDamage`, each
   * knocked away from it; cracked walls within it open (a cracked doorway on both sides).
   */
  blast(cx: number, cy: number, radius: number, damage: number, selfDamage: number): void {
    const at = { x: cx - 1, y: cy - 1, w: 2, h: 2 };
    for (const e of this.entities)
      if (e instanceof TdEnemy && !e.dead && circleHits(cx, cy, radius, e.hurtbox()))
        e.hurt(this, damage, dirToward(at, e.hurtbox()));
    const hero = this.hero;
    if (!hero.dying && circleHits(cx, cy, radius, hero.hurtbox()))
      hero.hurt(this, selfDamage, dirToward(at, hero.hurtbox()));
    const st = this.state();
    let opened = false;
    for (let row = 0; row < ROOM_ROWS; row++)
      for (let col = 0; col < ROOM_COLS; col++) {
        const box = { x: col * TILE, y: row * TILE, w: TILE, h: TILE };
        if (!circleHits(cx, cy, radius, box)) continue;
        const t = tileAt(this.room, col, row);
        if (t === 'cracked' && !st.blasted.has(`${col},${row}`)) {
          st.blasted.add(`${col},${row}`);
          opened = true;
        } else if (t === 'door') {
          const side = sideOf(col, row, this.room.wall) as Side;
          if (this.room.doors[side] !== 'cracked' || st.blasted.has(side)) continue;
          st.blasted.add(side);
          const [gx, gy] = neighbourCell(this.room, side);
          const next = this.dungeon.roomAt(gx, gy);
          const back = ({ n: 's', s: 'n', e: 'w', w: 'e' } as const)[side];
          if (next?.doors[back] === 'cracked') this.state(next.id).blasted.add(back);
          opened = true;
        }
      }
    if (opened) this.emit({ type: 'secret' });
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
      const w = this.room.wall * TILE;
      if (f.x >= w && f.y >= w && f.x + f.w <= ROOM_W - w && f.y + f.h <= ROOM_H - w) this.sealed = true;
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
    // Then in past the wall: to the first floor tile.
    const w = next.wall * TILE;
    const to =
      side === 'w'
        ? { x: ROOM_W - w - TILE, y: hero.y }
        : side === 'e'
          ? { x: w, y: hero.y }
          : side === 'n'
            ? { x: hero.x, y: ROOM_H - w - TILE }
            : { x: hero.x, y: w };
    this.walkIn = { dir: SIDE_DIR[side], ...to };
  }

  /** Puts the hero straight into a room at (x, y), no slide (tests, dev tools). */
  warpTo(id: string, x: number, y: number): void {
    const room = this.dungeon.rooms.get(id);
    if (!room) throw new Error(`no room "${id}"`);
    this.transition = null;
    this.walkIn = null;
    this.hero.x = x;
    this.hero.y = y;
    this.enterRoom(room);
  }

  /** Living enemies in the room. */
  enemies(): TdEnemy[] {
    return this.entities.filter((e): e is TdEnemy => e instanceof TdEnemy && !e.dead);
  }
}
