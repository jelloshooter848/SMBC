import type { Renderer } from '@engine/gfx/renderer';
import { px, toPx } from '@engine/math/units';
import { partnersDef } from '@content/sprites/partners';
import { Entity, type View } from '../entity';
import type { Player } from '../player';
import { CoinPop } from '../effects/effects';
import { TALK_REACH_PX } from './captive';
import { PARTNERS, type PartnerScript } from '../../story/script';
import type { World } from '../../world/world';

/** The blink: frames per cycle, and how many of them show the `-1` frame (the statue's glow). */
const BLINK_FRAMES = 150;
const BLINK_SHUT = 8;
const GLOW_FRAMES = 96;

/**
 * A partner in a campaign level (`partner x y who=old-man campaign=true`, docs/STORY.md 2.5-2.10):
 * someone from a hero's own game who says what to try to find that hero. Scenery, like a captive
 * hero (objects/captive.ts): no collision, never despawns, and it never leaves. A player standing
 * within reach on the ground sees TALK (the statue: READ) above it with an up arrow; pressing up
 * talks (World.checkTalk raises a `partner` event; LevelScene plays its pages, story/partners.ts).
 * Anchored on the tile its feet stand in (`dx`: px further right). Spawns only while the story
 * plays (World.storyMode).
 */
export class Partner extends Entity {
  readonly kind = 'partner';
  /** A player is within talking reach (the word shows). */
  prompt = false;
  /** The coin it gives (the old man's "TAKE THIS.") is given: once a visit to the level. */
  coinGiven = false;
  private t = 0;
  /** Players in reach last frame, so each new arrival is announced once. */
  private readonly near = new Set<Player>();

  constructor(
    tx: number,
    ty: number,
    readonly who: string,
    readonly script: PartnerScript,
    dx = 0,
  ) {
    const frame = partnersDef.frames[`${who}-0`] ?? [];
    const w = frame[0]?.length ?? 16;
    const h = frame.length || 32;
    super(px(tx * 16 + ((16 - w) >> 1) + dx), px((ty + 1) * 16 - h), w, h);
    this.layer = 'main';
    this.despawnMargin = null;
  }

  /** The partner `who` at (tx, ty), `dx` px right, or null for one the script does not know. */
  static create(tx: number, ty: number, who: string, dx = 0): Partner | null {
    const script = PARTNERS[who];
    return script && partnersDef.frames[`${who}-0`] ? new Partner(tx, ty, who, script, dx) : null;
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
        world.events.push({ type: 'partner-near', who: this.who, player: world.players.indexOf(p) });
    this.near.clear();
    for (const p of near) this.near.add(p);
  }

  /** The coin it gives pops out over its head and is added to the coins: once a visit. */
  giveCoin(world: World): boolean {
    if (this.coinGiven) return false;
    this.coinGiven = true;
    world.spawn(new CoinPop(this.centerX - px(4), this.body.y - px(16)));
    world.addCoin();
    return true;
  }

  render(r: Renderer, view: View): void {
    // A blink now and then; the statue's eyes glow brighter slowly (held dim with reduce flashing).
    const alt =
      this.who === 'chozo'
        ? !view.reduceFlashing && this.t % GLOW_FRAMES >= GLOW_FRAMES / 2
        : this.t % BLINK_FRAMES >= BLINK_FRAMES - BLINK_SHUT;
    const sheet = view.assets.sheet('partners');
    const x = toPx(this.body.x) - view.camX;
    const top = toPx(this.body.y);
    r.sprite(sheet, `${this.who}-${alt ? 1 : 0}`, x, top);
    if (!this.prompt) return;
    // TALK (or READ) with a small up arrow: up talks.
    const font = view.assets.sheet('font');
    const cx = toPx(this.centerX) - view.camX;
    const y = Math.max(0, top - 12);
    const tx = cx - 16 + 4;
    r.text(font, this.script.verb, tx, y);
    const ax = tx - 7;
    r.rect(ax + 2, y, 1, 1, '#fcfcfc');
    r.rect(ax + 1, y + 1, 3, 1, '#fcfcfc');
    r.rect(ax, y + 2, 5, 1, '#fcfcfc');
    r.rect(ax + 2, y + 3, 1, 4, '#fcfcfc');
  }
}
