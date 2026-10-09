import type { Renderer } from '@engine/gfx/renderer';
import { px, toPx } from '@engine/math/units';
import { partnersDef } from '@content/sprites/partners';
import { npcsDef } from '@content/sprites/npcs';
import { sophiaDef } from '@content/sprites/sophia';
import { stationDef } from '@content/sprites/station';
import { Entity, type View } from '../entity';
import type { Player } from '../player';
import { CoinPop } from '../effects/effects';
import { TALK_REACH_PX } from './captive';
import { PARTNERS, partnerGone, type PartnerScript } from '../../story/script';
import type { World } from '../../world/world';
import { drawTalkPrompt } from './talk-prompt';

/** The blink: frames per cycle, and how many of them show the `-1` frame (the statue's glow). */
const BLINK_FRAMES = 150;
const BLINK_SHUT = 8;
const GLOW_FRAMES = 96;
/** Jason looks about for Fred: frames per cycle, and how many of them he looks the other way. */
const LOOK_FRAMES = 160;
const LOOK_BACK = 48;
/**
 * Partners that float (the fairy in 2-1-sky): drawn `lift` px above their spot, bobbing `bob` px
 * up and down once every `period` frames, their wings beating (the `-1` frame) every `beat`
 * frames. Their spot (and so the talking reach) is the ground under them.
 */
const FLOAT: Readonly<Record<string, { lift: number; bob: number; period: number; beat: number }>> = {
  fairy: { lift: 14, bob: 3, period: 96, beat: 8 },
  // 0.4.40: 4-4's baby Metroid drifts lower and slower; its `-1` frame is a slow pulse.
  'baby-metroid': { lift: 10, bob: 2, period: 120, beat: 24 },
};

/**
 * Partners drawn from another sheet instead of `partners` (both frames the same picture):
 * Jason, Sophia III's pilot, is her sheet's side-view `jason-stand` (16x16, facing right), turned
 * to face left (toward the heroes coming up the pipe) and now and then right (the pool) (`look`).
 * `rows` sizes it: a frame whose bottom row is empty is cut there, so its feet stand on the floor.
 */
const BORROWED: Readonly<
  Record<string, { sheet: string; frame: string; rows: readonly string[]; look: boolean }>
> = {
  jason: { sheet: 'sophia', frame: 'jason-stand', rows: sophiaDef.frames['jason-stand'] ?? [], look: true },
  // Fred, by 8-4-end's trap pipe (0.4.23): her sheet's sitting frog, looking at the heroes coming
  // from the left and now and then down the pipe to his right.
  fred: { sheet: 'sophia', frame: 'fred-0', rows: sophiaDef.frames['fred-0'] ?? [], look: true },
  // 0.4.40: a Sniper Joe on his break at the door of 3-4's fortress, Mega Man's airship guard
  // (`station` sheet), behind his shield and facing the heroes. His frame's bottom row is empty.
  'sniper-joe': {
    sheet: 'station',
    frame: 'joe-guard',
    rows: (stationDef.frames['joe-guard'] ?? []).slice(0, -1),
    look: false,
  },
};

/** The sheet a partner's own `<who>-0` / `<who>-1` frames are on: `partners`, or (0.4.40) `npcs`. */
const sheetOf = (who: string): 'partners' | 'npcs' | null =>
  partnersDef.frames[`${who}-0`] ? 'partners' : npcsDef.frames[`${who}-0`] ? 'npcs' : null;

/** The idle frame's rows of partner `who` (its own sheet's `<who>-0`, or a borrowed one). */
const idleRows = (who: string): readonly string[] | undefined => {
  const sheet = sheetOf(who);
  return BORROWED[who]?.rows ?? (sheet === 'npcs' ? npcsDef : partnersDef).frames[`${who}-0`];
};

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
  /** Talked to on this visit (World.checkTalk): Jason's frog Fred hops off (objects/fred.ts). */
  talked = false;
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
    const frame = idleRows(who) ?? [];
    const w = frame[0]?.length ?? 16;
    const h = frame.length || 32;
    super(px(tx * 16 + ((16 - w) >> 1) + dx), px((ty + 1) * 16 - h), w, h);
    this.layer = 'main';
    this.despawnMargin = null;
  }

  /**
   * The partner `who` at (tx, ty), `dx` px right, or null for one the script does not know, or
   * one gone once its hero is freed on the file (`isFreed`; Fred, home with Jason).
   */
  static create(
    tx: number,
    ty: number,
    who: string,
    dx = 0,
    isFreed: (hero: string) => boolean = () => false,
  ): Partner | null {
    const script = PARTNERS[who];
    if (!script || partnerGone(script, script.hero && isFreed(script.hero) ? [script.hero] : [])) return null;
    return idleRows(who)?.length ? new Partner(tx, ty, who, script, dx) : null;
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
    const float = FLOAT[this.who];
    const alt = float
      ? Math.floor(this.t / float.beat) % 2 === 1
      : this.who === 'chozo'
        ? !view.reduceFlashing && this.t % GLOW_FRAMES >= GLOW_FRAMES / 2
        : this.t % BLINK_FRAMES >= BLINK_FRAMES - BLINK_SHUT;
    const x = toPx(this.body.x) - view.camX;
    // A floating partner hangs over its spot, bobbing gently (a slow sine, whole pixels).
    const top = float
      ? toPx(this.body.y) -
        float.lift -
        Math.round(Math.sin((this.t / float.period) * 2 * Math.PI) * float.bob)
      : toPx(this.body.y);
    const borrowed = BORROWED[this.who];
    if (borrowed)
      r.sprite(
        view.assets.sheet(borrowed.sheet),
        borrowed.frame,
        x,
        top,
        borrowed.look && this.t % LOOK_FRAMES < LOOK_FRAMES - LOOK_BACK,
      );
    else r.sprite(view.assets.sheet(sheetOf(this.who) ?? 'partners'), `${this.who}-${alt ? 1 : 0}`, x, top);
    // TALK (or READ), with its key: up (or the TALK button) talks.
    if (this.prompt) drawTalkPrompt(r, view, this.script.verb, toPx(this.centerX) - view.camX, top);
  }
}
