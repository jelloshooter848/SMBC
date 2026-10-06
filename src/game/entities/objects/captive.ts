import type { Renderer } from '@engine/gfx/renderer';
import { px, toPx } from '@engine/math/units';
import { fxPalette } from '@content/sprites/palette-fx';
import { Entity, type View } from '../entity';
import { Player } from '../player';
import { startHp, type CharacterDef } from '../../characters/character';
import type { World } from '../../world/world';

/** How close (px, centre to centre) a player on the ground must stand to talk. */
export const TALK_REACH_PX = 24;
/** The slow trance pulse: frames per cycle, and how many of them the lighter palette shows. */
const PULSE_FRAMES = 96;
const GLOW_FRAMES = 12;

/**
 * A brainwashed hero waiting in a campaign level (`captive x y hero=luigi`, see docs/HEROES.md):
 * the hero's own idle sprite in a dark purple trance, swaying slowly (the lighter pulse is left
 * out with reduce flashing). Scenery: no collision, never despawns. A player standing within
 * reach on the ground sees TALK above it; pressing up talks (World.checkTalk raises a `talk`
 * event and the level starts the unlock flow). Anchored on the tile its feet stand in.
 */
export class Captive extends Entity {
  readonly kind = 'captive';
  /** A player is within talking reach (TALK shows). */
  prompt = false;
  /** The hero as it would stand in play: only used to pick its idle sprite. */
  private readonly pose: Player;
  private t = 0;
  /** Players in reach last frame, so each new arrival is announced once. */
  private readonly near = new Set<Player>();

  constructor(
    tx: number,
    ty: number,
    readonly hero: CharacterDef,
  ) {
    const states = hero.damage.kind === 'powerup' ? hero.damage.states : [];
    const power =
      hero.damage.kind === 'powerup' ? (states.includes('big') ? 'big' : (states[0] ?? 'small')) : 'full';
    const pose = new Player(0, 0, hero, power, startHp(hero));
    const w = toPx(pose.body.w);
    const h = toPx(pose.body.h);
    super(px(tx * 16 + ((16 - w) >> 1)), px((ty + 1) * 16 - h), w, h);
    pose.body.x = this.body.x;
    pose.body.y = this.body.y;
    pose.body.onGround = true;
    pose.facing = -1;
    this.pose = pose;
    this.layer = 'main';
    this.despawnMargin = null;
    this.facing = -1;
  }

  private get centerX(): number {
    return this.body.x + (this.body.w >> 1);
  }

  /** Player `p` can talk: on the ground, on the same floor, within TALK_REACH_PX. */
  inReach(p: Player): boolean {
    if (p.dead || p.out || p.hidden || !p.body.onGround) return false;
    const dx = Math.abs(p.centerX - this.centerX);
    const dy = Math.abs(p.body.y + p.body.h - (this.body.y + this.body.h));
    return dx <= px(TALK_REACH_PX) && dy <= px(8);
  }

  update(world: World): void {
    this.t++;
    const near = world.activePlayers().filter((p) => this.inReach(p));
    this.prompt = near.length > 0;
    for (const p of near)
      if (!this.near.has(p))
        world.events.push({ type: 'captive-near', hero: this.hero.id, player: world.players.indexOf(p) });
    this.near.clear();
    for (const p of near) this.near.add(p);
    // He turns to whoever comes close, but stays where he is.
    const p = near[0] ?? null;
    if (p) this.pose.facing = p.centerX < this.centerX ? -1 : 1;
  }

  /** Freed: a puff where he stood, and gone. */
  free(world: World): void {
    world.spawn(new FreedPuff(this.centerX, this.body.y + (this.body.h >> 1)));
    this.destroy();
  }

  render(r: Renderer, view: View): void {
    const s = this.hero.sprite(this.pose, 0, view.reduceFlashing);
    const glow = !view.reduceFlashing && this.t % PULSE_FRAMES < GLOW_FRAMES;
    const sheet = view.assets.sheet(s.sheet, fxPalette(s.palette, glow ? 'brainwashed-glow' : 'brainwashed'));
    const w = sheet.frames.get(s.frame)?.w ?? 16;
    // A slow sway, one pixel either way, as if in a trance.
    const sway = Math.round(Math.sin((this.t * Math.PI * 2) / PULSE_FRAMES));
    const bw = toPx(this.body.w);
    const x = toPx(this.body.x) - view.camX - (s.flip ? w - bw - s.offsetX : s.offsetX) + sway;
    const top = toPx(this.body.y) - s.offsetY;
    r.sprite(sheet, s.frame, x, top, s.flip);
    if (!this.prompt) return;
    // TALK with a small up arrow: up talks.
    const font = view.assets.sheet('font');
    const cx = toPx(this.centerX) - view.camX;
    const y = Math.max(0, top - 12);
    const tx = cx - 16 + 4;
    r.text(font, 'TALK', tx, y);
    const ax = tx - 7;
    r.rect(ax + 2, y, 1, 1, '#fcfcfc');
    r.rect(ax + 1, y + 1, 3, 1, '#fcfcfc');
    r.rect(ax, y + 2, 5, 1, '#fcfcfc');
    r.rect(ax + 2, y + 3, 1, 4, '#fcfcfc');
  }
}

/** Sparkles bursting outward where a captive was freed (drawn, no sprite sheet). */
export class FreedPuff extends Entity {
  readonly kind = 'freed-puff';
  private age = 0;
  static readonly FRAMES = 28;

  constructor(cx: number, cy: number) {
    super(cx, cy, 1, 1);
    this.layer = 'front';
    this.despawnMargin = null;
  }

  update(): void {
    if (++this.age >= FreedPuff.FRAMES) this.destroy();
  }

  render(r: Renderer, view: View): void {
    const cx = toPx(this.body.x) - view.camX;
    const cy = toPx(this.body.y);
    const d = 2 + this.age * 1.2;
    const size = this.age < FreedPuff.FRAMES - 8 ? 2 : 1;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 + this.age * 0.05;
      const col = i % 2 === 0 ? '#fcfcfc' : '#f8d878';
      r.rect(Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d), size, size, col);
    }
    // A soft cloud in the middle for the first few frames.
    if (this.age < 10) {
      const c = 6 - (this.age >> 1);
      r.rect(cx - c, cy - c, c * 2, c * 2, '#bcbcbc');
    }
  }
}
